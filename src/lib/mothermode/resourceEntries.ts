import { createClient } from '@supabase/supabase-js';

const TABLE = 'mothermode_resource_entries';

/**
 * Buyer-entered data for interactive resource tools (Brain Dump Template,
 * Weekly Reset, Delegate Scripts tracker, Load Map builder). Keyed by
 * (slug, key, email, periodKey) so a resource can either hold a single
 * ongoing record or a running history of periods (weeks, months) the buyer
 * can page through and clone forward.
 *
 * There is no buyer auth in this funnel, so `email` is self-reported (typed
 * once into the resource page, cached in localStorage). RLS on the table
 * grants nothing to anon/authenticated, so only this service-role client,
 * used exclusively by /api/mothermode/resource-entries, can touch it.
 */
export interface ResourceEntry {
  periodKey: string;
  periodLabel: string;
  data: Record<string, unknown>;
  updatedAt: string;
}

let _service: ReturnType<typeof createClient> | null = null;
function serviceClient() {
  if (_service) return _service;
  _service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );
  return _service;
}

const normEmail = (email: string) => email.trim().toLowerCase();

/** Every stored period for one buyer on one resource, most recent first. */
export async function listResourceEntries(
  slug: string,
  key: string,
  email: string,
): Promise<ResourceEntry[]> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(TABLE)
      .select('period_key, period_label, data, updated_at')
      .eq('slug', slug)
      .eq('key', key)
      .eq('email', normEmail(email))
      .order('updated_at', { ascending: false });
    if (error || !data) return [];
    return data.map((row: any) => ({
      periodKey: row.period_key,
      periodLabel: row.period_label,
      data: row.data ?? {},
      updatedAt: row.updated_at,
    }));
  } catch {
    return [];
  }
}

export interface UpsertResourceEntryInput {
  slug: string;
  key: string;
  email: string;
  periodKey: string;
  periodLabel: string;
  data: Record<string, unknown>;
}

/** Upsert one period's data. Overwrites on (slug, key, email, periodKey). */
export async function upsertResourceEntry(
  input: UpsertResourceEntryInput,
): Promise<void> {
  const { error } = await (serviceClient() as any).from(TABLE).upsert(
    {
      slug: input.slug,
      key: input.key,
      email: normEmail(input.email),
      period_key: input.periodKey,
      period_label: input.periodLabel,
      data: input.data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'slug,key,email,period_key' },
  );
  if (error) {
    throw new Error(`upsertResourceEntry failed: ${error.message}`);
  }
}
