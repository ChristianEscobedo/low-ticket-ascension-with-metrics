/**
 * Lead Gen Kit store. Admin-only tool: every read and write uses the
 * service-role client (which bypasses RLS). No anon path — the table has no
 * anon policy. Buyer delivery rides mothermode_deliverables instead. Copied
 * from highticket/store.ts and renamed for the lead-gen table.
 */
import { createClient } from '@supabase/supabase-js';
import {
  rowToLeadGenKit,
  type LeadGenKitRecord,
  type LeadGenKitRow,
  type LeadGenIntake,
  type LeadGenDoc,
  type LeadGenStatus,
  type LeadMagnetFormat,
} from './types';

const TABLE = 'mothermode_lead_gen_kits';

const COLUMNS =
  'id, slug, name, format, status, intake, doc, published_slug, published_key, created_at, updated_at, updated_by';

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
export async function listKitsForAdmin(): Promise<LeadGenKitRecord[]> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(TABLE)
      .select(COLUMNS)
      .order('updated_at', { ascending: false });
    if (error || !data) return [];
    return (data as LeadGenKitRow[]).map(rowToLeadGenKit);
  } catch {
    return [];
  }
}

/** Admin read: a single kit by id, or null. */
export async function getKitById(id: string): Promise<LeadGenKitRecord | null> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(TABLE)
      .select(COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return rowToLeadGenKit(data as LeadGenKitRow);
  } catch {
    return null;
  }
}

/** Admin read: a single kit by slug, or null. */
export async function getKitBySlug(slug: string): Promise<LeadGenKitRecord | null> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(TABLE)
      .select(COLUMNS)
      .eq('slug', slug)
      .maybeSingle();
    if (error || !data) return null;
    return rowToLeadGenKit(data as LeadGenKitRow);
  } catch {
    return null;
  }
}

export interface UpsertKitInput {
  id?: string | null;
  slug: string;
  name: string;
  format: LeadMagnetFormat;
  status: LeadGenStatus;
  intake: LeadGenIntake;
  doc: LeadGenDoc;
  publishedSlug?: string | null;
  publishedKey?: string | null;
  updatedBy?: string | null;
}

/** Admin-only upsert. Insert when `id` is absent, update in place otherwise. */
export async function upsertKit(input: UpsertKitInput): Promise<LeadGenKitRecord> {
  const row: Record<string, unknown> = {
    slug: input.slug,
    name: input.name,
    format: input.format,
    status: input.status,
    intake: input.intake,
    doc: input.doc,
    published_slug: input.publishedSlug ?? null,
    published_key: input.publishedKey ?? null,
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
  return rowToLeadGenKit(data as LeadGenKitRow);
}

/** Persist the published (slug, key) on a kit after a Publish to Deliverables. */
export async function markPublished(
  id: string,
  publishedSlug: string,
  publishedKey: string,
): Promise<void> {
  const { error } = await (serviceClient() as any)
    .from(TABLE)
    .update({
      published_slug: publishedSlug,
      published_key: publishedKey,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) {
    throw new Error(`markPublished failed: ${error.message}`);
  }
}

/** Admin-only removal by id. */
export async function deleteKit(id: string): Promise<void> {
  const { error } = await (serviceClient() as any).from(TABLE).delete().eq('id', id);
  if (error) {
    throw new Error(`deleteKit failed: ${error.message}`);
  }
}
