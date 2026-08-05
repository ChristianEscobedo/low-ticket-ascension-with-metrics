/**
 * The Media Library store — one searchable home for every asset the app
 * touches (house pattern: lazy service client, degrades to empty arrays and
 * never throws on missing env/table).
 *
 * WHY ONE TABLE, MANY VIEWS
 * -------------------------
 * Vault assets, reel clips, hub renders, and Thumbnail Lab exports are all
 * the same shape: a named URL with a kind and tags. The Vault becomes a
 * filtered view (kind=video + tag hook/outro/reaction), Thumbnail Lab exports
 * land as source=thumbnail-lab, hub renders as source=generated. Every
 * surface reads through the same library, so AI prompts can finally use
 * prior media as context (image seeds, style refs, b-roll).
 */
import { createClient } from '@supabase/supabase-js';

const ASSETS = 'mothermode_media_assets';
const FOLDERS = 'mothermode_media_folders';

let _service: ReturnType<typeof createClient> | null = null;
function serviceClient() {
  if (_service) return _service;
  _service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );
  return _service;
}

export type MediaKind = 'video' | 'image' | 'audio';
export type MediaSource = 'upload' | 'generated' | 'thumbnail-lab' | 'vault' | 'external';

export interface MediaFolder {
  id: string;
  name: string;
  parentId: string | null;
  color: string | null;
}

export interface MediaAsset {
  id: string;
  name: string;
  url: string;
  kind: MediaKind;
  source: MediaSource;
  durationSec: number | null;
  thumbnailUrl: string | null;
  folderId: string | null;
  tags: string[];
  refId: string | null;
  refKind: string | null;
  createdAt: string | null;
}

function rowToFolder(r: Record<string, unknown>): MediaFolder {
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    parentId: r.parent_id ? String(r.parent_id) : null,
    color: r.color ? String(r.color) : null,
  };
}

function rowToAsset(r: Record<string, unknown>): MediaAsset {
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    url: String(r.url ?? ''),
    kind: (r.kind as MediaKind) || 'video',
    source: (r.source as MediaSource) || 'upload',
    durationSec: r.duration_sec != null ? Number(r.duration_sec) : null,
    thumbnailUrl: r.thumbnail_url ? String(r.thumbnail_url) : null,
    folderId: r.folder_id ? String(r.folder_id) : null,
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    refId: r.ref_id ? String(r.ref_id) : null,
    refKind: r.ref_kind ? String(r.ref_kind) : null,
    createdAt: r.created_at ? String(r.created_at) : null,
  };
}

/** Normalize a tag: lowercase, spaces → dashes, drop empties, dedupe. */
export function normalizeTags(tags: string[]): string[] {
  const out = new Set<string>();
  for (const t of tags) {
    const n = t.trim().toLowerCase().replace(/\s+/g, '-');
    if (n) out.add(n);
  }
  return Array.from(out);
}

/** Case-insensitive name + tag match for client-side grid search. */
export function assetMatches(asset: MediaAsset, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    asset.name.toLowerCase().includes(q) ||
    asset.tags.some((t) => t.includes(q)) ||
    asset.source.includes(q) ||
    asset.kind.includes(q)
  );
}

/** Folders with their asset counts, for the tree sidebar. */
export function folderCounts(
  assets: MediaAsset[],
  folders: MediaFolder[],
): Map<string | null, number> {
  const counts = new Map<string | null, number>();
  for (const a of assets) counts.set(a.folderId, (counts.get(a.folderId) ?? 0) + 1);
  // ensure every folder shows up even when empty
  for (const f of folders) if (!counts.has(f.id)) counts.set(f.id, 0);
  return counts;
}

/** Folders as a tree: roots first, then children grouped by parent. */
export function folderTree(folders: MediaFolder[]): { folder: MediaFolder; children: MediaFolder[] }[] {
  const roots = folders.filter((f) => !f.parentId);
  return roots.map((root) => ({
    folder: root,
    children: folders.filter((f) => f.parentId === root.id),
  }));
}

/** Every distinct tag in the library, most-used first (for tag suggestions). */
export function tagRollup(assets: MediaAsset[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const a of assets) for (const t of a.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

export async function listMediaFolders(): Promise<MediaFolder[]> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(FOLDERS)
      .select('id, name, parent_id, color')
      .order('name');
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map(rowToFolder);
  } catch {
    return [];
  }
}

export async function createMediaFolder(input: {
  name: string;
  parentId?: string | null;
  color?: string | null;
}): Promise<MediaFolder | null> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(FOLDERS)
      .insert({
        name: input.name.trim().slice(0, 80),
        parent_id: input.parentId ?? null,
        color: input.color ?? null,
      })
      .select('id, name, parent_id, color')
      .maybeSingle();
    return error || !data ? null : rowToFolder(data);
  } catch {
    return null;
  }
}

export async function renameMediaFolder(id: string, name: string): Promise<boolean> {
  try {
    const { error } = await (serviceClient() as any)
      .from(FOLDERS)
      .update({ name: name.trim().slice(0, 80), updated_at: new Date().toISOString() })
      .eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

export async function deleteMediaFolder(id: string): Promise<boolean> {
  try {
    const { error } = await (serviceClient() as any).from(FOLDERS).delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

export async function listMediaAssets(opts?: {
  kind?: MediaKind;
  source?: MediaSource;
  folderId?: string | null;
  tag?: string;
  refId?: string;
  limit?: number;
}): Promise<MediaAsset[]> {
  try {
    let q = (serviceClient() as any)
      .from(ASSETS)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(opts?.limit ?? 500);
    if (opts?.kind) q = q.eq('kind', opts.kind);
    if (opts?.source) q = q.eq('source', opts.source);
    if (opts?.folderId !== undefined) {
      q = opts.folderId === null ? q.is('folder_id', null) : q.eq('folder_id', opts.folderId);
    }
    if (opts?.tag) q = q.contains('tags', [opts.tag]);
    if (opts?.refId) q = q.eq('ref_id', opts.refId);
    const { data, error } = await q;
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map(rowToAsset);
  } catch {
    return [];
  }
}

/** Upsert by URL — ingest is idempotent, so the same render never double-lists. */
export async function ingestMediaAsset(input: {
  name: string;
  url: string;
  kind: MediaKind;
  source: MediaSource;
  durationSec?: number | null;
  thumbnailUrl?: string | null;
  folderId?: string | null;
  tags?: string[];
  refId?: string | null;
  refKind?: string | null;
}): Promise<MediaAsset | null> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(ASSETS)
      .upsert(
        {
          name: input.name.trim().slice(0, 150),
          url: input.url,
          kind: input.kind,
          source: input.source,
          duration_sec: input.durationSec ?? null,
          thumbnail_url: input.thumbnailUrl ?? null,
          folder_id: input.folderId ?? null,
          tags: normalizeTags(input.tags ?? []),
          ref_id: input.refId ?? null,
          ref_kind: input.refKind ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'url' },
      )
      .select('*')
      .maybeSingle();
    return error || !data ? null : rowToAsset(data);
  } catch {
    return null;
  }
}

export async function patchMediaAsset(
  id: string,
  patch: {
    name?: string;
    folderId?: string | null;
    tags?: string[];
    thumbnailUrl?: string | null;
  },
): Promise<boolean> {
  try {
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined) row.name = patch.name.trim().slice(0, 150);
    if (patch.folderId !== undefined) row.folder_id = patch.folderId;
    if (patch.tags !== undefined) row.tags = normalizeTags(patch.tags);
    if (patch.thumbnailUrl !== undefined) row.thumbnail_url = patch.thumbnailUrl;
    const { error } = await (serviceClient() as any).from(ASSETS).update(row).eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

export async function deleteMediaAsset(id: string): Promise<boolean> {
  try {
    const { error } = await (serviceClient() as any).from(ASSETS).delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}
