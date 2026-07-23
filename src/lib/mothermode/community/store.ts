/**
 * Community Kit store. Admin-only tool: every read and write uses the
 * service-role client (which bypasses RLS). No anon path — the table has no
 * anon policy. If a public share surface lands, add an anon read here scoped to
 * a `published` flag, exactly like mothermode help.
 */
import { createClient } from '@supabase/supabase-js';
import {
  rowToCommunityKit,
  type CommunityKitRecord,
  type CommunityKitRow,
  type CommunityIntake,
  type CommunityKit,
  type CommunityType,
  type CommunityStatus,
} from './types';
import type { ContextRef } from '@/lib/mothermode/context';

const TABLE = 'mothermode_community_kits';

const COLUMNS =
  'id, slug, name, community_type, status, intake, kit, context_refs, created_at, updated_at, updated_by';


// Service-role client for admin reads and all writes. Lazy so the module never
// throws on missing env at import time.
let _service: ReturnType<typeof createClient> | null = null;
function serviceClient() {
  if (_service) return _service;
  _service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );
  return _service;
}

/** Admin read: every kit, newest first. Returns [] on any failure. */
export async function listKitsForAdmin(): Promise<CommunityKitRecord[]> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(TABLE)
      .select(COLUMNS)
      .order('updated_at', { ascending: false });
    if (error || !data) return [];
    return (data as CommunityKitRow[]).map(rowToCommunityKit);
  } catch {
    return [];
  }
}

/** Admin read: a single kit by id, or null. */
export async function getKitById(id: string): Promise<CommunityKitRecord | null> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(TABLE)
      .select(COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return rowToCommunityKit(data as CommunityKitRow);
  } catch {
    return null;
  }
}

/** Admin read: a single kit by slug, or null. */
export async function getKitBySlug(slug: string): Promise<CommunityKitRecord | null> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(TABLE)
      .select(COLUMNS)
      .eq('slug', slug)
      .maybeSingle();
    if (error || !data) return null;
    return rowToCommunityKit(data as CommunityKitRow);
  } catch {
    return null;
  }
}

export interface UpsertKitInput {
  id?: string | null;
  slug: string;
  name: string;
  communityType: CommunityType;
  status: CommunityStatus;
  intake: CommunityIntake;
  kit: CommunityKit;
  contextRefs: ContextRef[];
  updatedBy?: string | null;
}


/** Admin-only upsert. Insert when `id` is absent, update in place otherwise. */
export async function upsertKit(input: UpsertKitInput): Promise<CommunityKitRecord> {
  const row: Record<string, unknown> = {
    slug: input.slug,
    name: input.name,
    community_type: input.communityType,
    status: input.status,
    intake: input.intake,
    kit: input.kit,
    context_refs: input.contextRefs,
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
    throw new Error(`upsertKit failed: ${error?.message ?? 'no row returned'}`);
  }
  return rowToCommunityKit(data as CommunityKitRow);
}

/** Admin-only removal by id. */
export async function deleteKit(id: string): Promise<void> {
  const { error } = await (serviceClient() as any).from(TABLE).delete().eq('id', id);
  if (error) {
    throw new Error(`deleteKit failed: ${error.message}`);
  }
}
