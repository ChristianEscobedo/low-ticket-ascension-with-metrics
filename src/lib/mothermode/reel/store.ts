/**
 * Reel Studio store. Service-role only (bypasses RLS), house pattern: lazy
 * client, never throws on missing env, every read degrades to null/[] so a
 * missing table can never 500 the admin page.
 */
import { createClient } from '@supabase/supabase-js';
import {
  normalizeProjectJson,
  projectToJson,
  rowToReelProject,
  type ReelProject,
  type ReelProjectRow,
} from './types';

const TABLE = 'mothermode_reel_projects';
const COLUMNS = 'id, name, project, created_at, updated_at, updated_by';

let _service: ReturnType<typeof createClient> | null = null;
function serviceClient() {
  if (_service) return _service;
  _service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );
  return _service;
}

export async function listReelProjects(): Promise<ReelProject[]> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(TABLE)
      .select(COLUMNS)
      .order('updated_at', { ascending: false });
    if (error || !data) return [];
    return (data as ReelProjectRow[]).map(rowToReelProject);
  } catch {
    return [];
  }
}

export async function getReelProject(id: string): Promise<ReelProject | null> {
  if (!id) return null;
  try {
    const { data, error } = await (serviceClient() as any)
      .from(TABLE)
      .select(COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return rowToReelProject(data as ReelProjectRow);
  } catch {
    return null;
  }
}

/**
 * Insert or update a project. When `id` is absent a row is created and the
 * generated id returned inside the saved record. Clips/audio/composed fields
 * are re-normalized through normalizeProjectJson on the way in, so anything
 * the client sends is sanitized before it lands.
 */
export async function upsertReelProject(input: {
  id?: string;
  name: string;
  clips: ReelProject['clips'];
  audio: ReelProject['audio'];
  composedUrl?: string;
  composedAt?: string | null;
  captions?: ReelProject['captions'];
  captionStyle?: ReelProject['captionStyle'];
  captionOverrides?: ReelProject['captionOverrides'];
  overlays?: ReelProject['overlays'];
  updatedBy?: string | null;
}): Promise<ReelProject | null> {
  try {
    const json = normalizeProjectJson(
      projectToJson({
        clips: input.clips,
        audio: input.audio,
        composedUrl: input.composedUrl,
        composedAt: input.composedAt ?? null,
        captions: input.captions ?? {},
        captionStyle: input.captionStyle,
        captionOverrides: input.captionOverrides,
        overlays: input.overlays,
      }),
    );

    const row: Record<string, unknown> = {
      name: (input.name || 'Untitled reel').slice(0, 160),
      project: json,
      updated_at: new Date().toISOString(),
      updated_by: input.updatedBy ?? null,
    };
    if (input.id) row.id = input.id;
    const { data, error } = await (serviceClient() as any)
      .from(TABLE)
      .upsert(row)
      .select(COLUMNS)
      .maybeSingle();
    if (error || !data) return null;
    return rowToReelProject(data as ReelProjectRow);
  } catch {
    return null;
  }
}

/** Patch only the composed output (after a successful fal compose). */
export async function markReelComposed(
  id: string,
  composedUrl: string,
): Promise<ReelProject | null> {
  const existing = await getReelProject(id);
  if (!existing) return null;
  return upsertReelProject({
    id,
    name: existing.name,
    clips: existing.clips,
    audio: existing.audio,
    composedUrl,
    composedAt: new Date().toISOString(),
    captions: existing.captions,
    captionStyle: existing.captionStyle,
    captionOverrides: existing.captionOverrides,
    overlays: existing.overlays,
    updatedBy: existing.updatedBy,
  });

}

export async function deleteReelProject(id: string): Promise<boolean> {
  if (!id) return false;
  try {
    const { error } = await (serviceClient() as any).from(TABLE).delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}
