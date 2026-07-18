import { createClient } from '@supabase/supabase-js';
import type { DeliverableOverrideRow } from './types';

const TABLE = 'mothermode_deliverables';

// Anon, cookie-free client for public reads. Mirrors offerMedia.ts: published
// overrides are public (RLS allows anon SELECT), so the delivery page can stay
// cacheable rather than forcing per-request dynamic rendering.
let _anon: ReturnType<typeof createClient> | null = null;
function anonClient() {
  if (_anon) return _anon;
  _anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  );
  return _anon;
}

// Service-role client for admin writes. Lazy so the module never throws on
// missing env at import time.
let _service: ReturnType<typeof createClient> | null = null;
function serviceClient() {
  if (_service) return _service;
  _service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );
  return _service;
}

/**
 * Read a single published override, keyed by (slug, key). Returns null when
 * nothing is published, the table is absent, or Supabase is not configured,
 * so the delivery page always has a code default to fall back on.
 */
export async function getDeliverableOverride(
  slug: string,
  key: string,
): Promise<DeliverableOverrideRow | null> {
  try {
    const { data, error } = await (anonClient() as any)
      .from(TABLE)
      .select('slug, key, title, subtitle, html, updated_at, updated_by')
      .eq('slug', slug)
      .eq('key', key)
      .maybeSingle();
    if (error || !data) return null;
    return data as DeliverableOverrideRow;
  } catch {
    return null;
  }
}

/** Lists every stored override for one offer, keyed by resource key. Used by
 *  the admin editor to show which resources already have a custom version. */
export async function listDeliverableOverrides(
  slug: string,
): Promise<DeliverableOverrideRow[]> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(TABLE)
      .select('slug, key, title, subtitle, html, updated_at, updated_by')
      .eq('slug', slug);
    if (error || !data) return [];
    return data as DeliverableOverrideRow[];
  } catch {
    return [];
  }
}

export interface UpsertDeliverableInput {
  slug: string;
  key: string;
  title: string;
  subtitle: string;
  html: string;
  updatedBy?: string | null;
}

/** Admin-only upsert. Overwrites the published document for (slug, key). */
export async function upsertDeliverable(
  input: UpsertDeliverableInput,
): Promise<void> {
  const { error } = await (serviceClient() as any).from(TABLE).upsert(
    {
      slug: input.slug,
      key: input.key,
      title: input.title,
      subtitle: input.subtitle,
      html: input.html,
      updated_by: input.updatedBy ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'slug,key' },
  );
  if (error) {
    throw new Error(`upsertDeliverable failed: ${error.message}`);
  }
}

/** Admin-only removal. The resource falls back to its code default. */
export async function deleteDeliverableOverride(
  slug: string,
  key: string,
): Promise<void> {
  const { error } = await (serviceClient() as any)
    .from(TABLE)
    .delete()
    .eq('slug', slug)
    .eq('key', key);
  if (error) {
    throw new Error(`deleteDeliverableOverride failed: ${error.message}`);
  }
}
