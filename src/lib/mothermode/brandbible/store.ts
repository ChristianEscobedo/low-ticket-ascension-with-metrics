/**
 * Brand Bible store. Admin-only tool: every read and write uses the
 * service-role client (which bypasses RLS). No anon path — the table has no
 * anon policy, exactly like the other mothermode kit stores.
 *
 * The DB row is snake_case; `rowToBrandBible` remaps it to the camelCase
 * `BrandBible` shape and runs it through `normalizeBrandBible` so malformed
 * rows are dropped rather than thrown.
 */
import { createClient } from '@supabase/supabase-js';
import {
  normalizeBrandBible,
  normalizeNegatives,
  type BrandBible,
} from './types';

const TABLE = 'mothermode_brand_bibles';

const COLUMNS =
  'id, name, scope, visual_direction, color_language, emotion, camera, negatives, created_at, updated_at, updated_by';

// Lazy service-role client so the module never throws on missing env at import.
let _service: ReturnType<typeof createClient> | null = null;
function serviceClient() {
  if (_service) return _service;
  _service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );
  return _service;
}

/** Map a persisted snake_case row into a clean BrandBible (or null). */
export function rowToBrandBible(row: Record<string, unknown>): BrandBible | null {
  return normalizeBrandBible({
    id: row.id,
    name: row.name,
    scope: row.scope,
    visualDirection: row.visual_direction,
    colorLanguage: row.color_language,
    emotion: row.emotion,
    camera: row.camera,
    negatives: row.negatives,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

/** Admin read: every bible, newest first. Returns [] on any failure. */
export async function listBiblesForAdmin(): Promise<BrandBible[]> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(TABLE)
      .select(COLUMNS)
      .order('updated_at', { ascending: false });
    if (error || !data) return [];
    return (data as Record<string, unknown>[])
      .map(rowToBrandBible)
      .filter((b): b is BrandBible => b !== null);
  } catch {
    return [];
  }
}

/** Admin read: a single bible by id, or null. */
export async function getBibleById(id: string): Promise<BrandBible | null> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(TABLE)
      .select(COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return rowToBrandBible(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

export interface UpsertBibleInput {
  id?: string | null;
  name: string;
  scope?: string | null;
  visualDirection?: string | null;
  colorLanguage?: string | null;
  emotion?: string | null;
  camera?: string | null;
  negatives?: unknown;
  updatedBy?: string | null;
}

/** Admin-only upsert. Insert when `id` is absent, update in place otherwise. */
export async function upsertBible(input: UpsertBibleInput): Promise<BrandBible> {
  const row: Record<string, unknown> = {
    name: input.name,
    scope: input.scope ?? null,
    visual_direction: input.visualDirection ?? null,
    color_language: input.colorLanguage ?? null,
    emotion: input.emotion ?? null,
    camera: input.camera ?? null,
    negatives: normalizeNegatives(input.negatives),
    updated_by: input.updatedBy ?? null,
    updated_at: new Date().toISOString(),
  };
  if (input.id) row.id = input.id;

  const { data, error } = await (serviceClient() as any)
    .from(TABLE)
    .upsert(row, { onConflict: 'id' })
    .select(COLUMNS)
    .single();
  if (error || !data) {
    throw new Error(`upsertBible failed: ${error?.message ?? 'no row returned'}`);
  }
  const bible = rowToBrandBible(data as Record<string, unknown>);
  if (!bible) throw new Error('upsertBible failed: row did not normalize');
  return bible;
}

/** Admin-only removal by id. */
export async function deleteBible(id: string): Promise<void> {
  const { error } = await (serviceClient() as any).from(TABLE).delete().eq('id', id);
  if (error) {
    throw new Error(`deleteBible failed: ${error.message}`);
  }
}
