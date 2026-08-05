/**
 * Clipping Studio Vault store. Same house pattern as reel/store.ts: lazy
 * service client, never throws on missing env/table, reads degrade to [].
 */
import { createClient } from '@supabase/supabase-js';
import type { ReelClip } from './types';
import { makeClipId } from './types';

export type VaultKind = 'intro' | 'outro' | 'reaction' | 'sticker' | 'lower-third';
export type VaultSource = 'mine' | 'licensed' | 'reference-only';

export interface VaultAsset {
  id: string;
  kind: VaultKind;
  name: string;
  url: string;
  thumbnailUrl: string | null;
  durationSec: number;
  tags: string[];
  emotion: string | null;
  source: VaultSource;
  useCount: number;
  winRate: number | null;
  createdAt: string;
}

export const VAULT_KINDS: VaultKind[] = ['intro', 'outro', 'reaction', 'sticker', 'lower-third'];

interface VaultRow {
  id: string;
  kind: VaultKind;
  name: string;
  url: string;
  thumbnail_url: string | null;
  duration_sec: number | string;
  tags: string[] | null;
  emotion: string | null;
  source: VaultSource;
  use_count: number;
  win_rate: number | string | null;
  created_at: string;
}

const TABLE = 'clipping_vault_assets';
const COLUMNS =
  'id, kind, name, url, thumbnail_url, duration_sec, tags, emotion, source, use_count, win_rate, created_at';

let _service: ReturnType<typeof createClient> | null = null;
function serviceClient() {
  if (_service) return _service;
  _service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );
  return _service;
}

function rowToAsset(r: VaultRow): VaultAsset {
  return {
    id: r.id,
    kind: r.kind,
    name: r.name,
    url: r.url,
    thumbnailUrl: r.thumbnail_url,
    durationSec: Number(r.duration_sec) || 0,
    tags: Array.isArray(r.tags) ? r.tags : [],
    emotion: r.emotion,
    source: r.source,
    useCount: r.use_count ?? 0,
    winRate: r.win_rate == null ? null : Number(r.win_rate),
    createdAt: r.created_at,
  };
}

/** Wilson-score lower bound (95%) â€” the honest win rate for small samples. */
export function wilsonLowerBound(wins: number, n: number): number {
  if (n <= 0) return 0;
  const z = 1.96;
  const p = wins / n;
  const denom = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return Math.max(0, (centre - margin) / denom);
}

/** Star tier for a win rate: â˜…â˜…â˜… â‰¥5%, â˜…â˜… â‰¥3%, â˜… â‰¥1.5%, otherwise none. */
export function winStars(winRate: number | null): 0 | 1 | 2 | 3 {
  if (winRate == null) return 0;
  if (winRate >= 0.05) return 3;
  if (winRate >= 0.03) return 2;
  if (winRate >= 0.015) return 1;
  return 0;
}

/**
 * Apply bookends: intro asset pinned as scene 0, outro pinned as the last
 * scene. Idempotent â€” re-applying replaces the previously pinned clips of the
 * same kind instead of stacking duplicates (the pin lives in the clip name
 * prefix so it survives the JSON round-trip).
 */
export function applyBookends(
  clips: ReelClip[],
  intro: VaultAsset | null,
  outro: VaultAsset | null,
): ReelClip[] {
  const PIN_INTRO = '[intro] ';
  const PIN_OUTRO = '[outro] ';

  const stripped = clips.filter(
    (c) => !c.name.startsWith(PIN_INTRO) && !c.name.startsWith(PIN_OUTRO),
  );
  const toClip = (a: VaultAsset, pin: string): ReelClip => ({
    id: makeClipId(),
    name: `${pin}${a.name}`.slice(0, 60),
    url: a.url,
    durationSec: a.durationSec > 0 ? a.durationSec : 2.5,
    trimEndSec: 0,
  });
  const next = [...stripped];
  if (outro) next.push(toClip(outro, PIN_OUTRO));
  if (intro) next.unshift(toClip(intro, PIN_INTRO));
  return next;
}

/** Insert a hook asset after index `at` (-1 = after scene 0's front). */
export function insertHookAt(clips: ReelClip[], asset: VaultAsset, at: number): ReelClip[] {
  const clip: ReelClip = {
    id: makeClipId(),
    name: asset.name.slice(0, 60),
    url: asset.url,
    durationSec: asset.durationSec > 0 ? asset.durationSec : 2.5,
    trimEndSec: 0,
  };
  const next = clips.slice();
  next.splice(Math.max(0, Math.min(at + 1, next.length)), 0, clip);
  return next;
}

export async function listVaultAssets(kind?: VaultKind): Promise<VaultAsset[]> {
  try {
    let q = (serviceClient() as any)
      .from(TABLE)
      .select(COLUMNS)
      .order('win_rate', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (kind) q = q.eq('kind', kind);
    const { data, error } = await q;
    if (error || !data) return [];
    return (data as VaultRow[]).map(rowToAsset);
  } catch {
    return [];
  }
}

export async function createVaultAsset(input: {
  kind: VaultKind;
  name: string;
  url: string;
  thumbnailUrl?: string | null;
  durationSec: number;
  tags?: string[];
  emotion?: string | null;
  source?: VaultSource;
}): Promise<VaultAsset | null> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(TABLE)
      .insert({
        kind: input.kind,
        name: input.name.slice(0, 120),
        url: input.url,
        thumbnail_url: input.thumbnailUrl ?? null,
        duration_sec: input.durationSec,
        tags: input.tags ?? [],
        emotion: input.emotion ?? null,
        source: input.source ?? 'mine',
      })
      .select(COLUMNS)
      .single();
    if (error || !data) return null;
    return rowToAsset(data as VaultRow);
  } catch {
    return null;
  }
}

export async function bumpVaultUseCount(id: string): Promise<void> {
  try {
    const { data } = await (serviceClient() as any)
      .from(TABLE)
      .select('use_count')
      .eq('id', id)
      .maybeSingle();
    if (!data) return;
    await (serviceClient() as any)
      .from(TABLE)
      .update({ use_count: (data.use_count ?? 0) + 1, updated_at: new Date().toISOString() })
      .eq('id', id);
  } catch {
    /* best effort */
  }
}

export async function deleteVaultAsset(id: string): Promise<boolean> {
  try {
    const { error } = await (serviceClient() as any).from(TABLE).delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}
/**
 * R2 Scoreboard: recompute every asset'\''s win rate from the loop'\''s recorded
 * metrics. Attribution is URL-based — any reel project whose JSON references
 * the asset URL contributes its variants'\'' impressions/clicks. Ranked with the
 * Wilson lower bound, and only once there are =300 impressions (small samples
 * stay unrated instead of lying).
 */
export async function syncVaultWinRates(): Promise<{ updated: number }> {
  try {
    const supa = serviceClient() as any;
    const assets = await listVaultAssets();
    if (assets.length === 0) return { updated: 0 };
    const { data: projs } = await supa.from('mothermode_reel_projects').select('id, project').limit(200);
    const { data: vs } = await supa.from('mothermode_reel_variants').select('id, project_id').limit(500);
    const { data: ms } = await supa.from('mothermode_reel_variant_metrics').select('variant_id, impressions, clicks').limit(1000);

    const metricByVariant = new Map<string, { i: number; c: number }>();
    for (const m of (ms ?? []) as { variant_id: string; impressions: number | null; clicks: number | null }[]) {
      const cur = metricByVariant.get(m.variant_id) ?? { i: 0, c: 0 };
      cur.i += m.impressions ?? 0;
      cur.c += m.clicks ?? 0;
      metricByVariant.set(m.variant_id, cur);
    }
    const metricsByProject = new Map<string, { i: number; c: number }>();
    for (const v of (vs ?? []) as { id: string; project_id: string }[]) {
      const m = metricByVariant.get(v.id);
      if (!m) continue;
      const cur = metricsByProject.get(v.project_id) ?? { i: 0, c: 0 };
      cur.i += m.i;
      cur.c += m.c;
      metricsByProject.set(v.project_id, cur);
    }
    let updated = 0;
    for (const a of assets) {
      const usedBy = new Set<string>();
      for (const p of (projs ?? []) as { id: string; project: unknown }[]) {
        if (JSON.stringify(p.project ?? {}).includes(a.url)) usedBy.add(p.id);
      }
      let i = 0;
      let c = 0;
      usedBy.forEach((pid) => {
        const m = metricsByProject.get(pid);
        if (m) {
          i += m.i;
          c += m.c;
        }
      });

      const winRate = i >= 300 ? wilsonLowerBound(c, i) : null;
      await supa
        .from(TABLE)
        .update({ win_rate: winRate, updated_at: new Date().toISOString() })
        .eq('id', a.id);

      updated += 1;
    }
    return { updated };
  } catch {
    return { updated: 0 };
  }
}
