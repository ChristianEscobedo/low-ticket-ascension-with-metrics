/**
 * 1:1 Personalization store. Service-role only (bypasses RLS), same pattern
 * as every mothermode store: lazy client, never throws on missing env,
 * every read degrades to null/[]/0 so a missing table can never 500 a
 * public funnel page.
 */
import { createClient } from '@supabase/supabase-js';
import {
  normalizeSettings,
  rowToLeadPersonalization,
  toFunnelKind,
  toPersonalizationMode,
  type FunnelKind,
  type LeadPersonalizationRecord,
  type LeadPersonalizationRow,
  type PersonalizationCampaignRow,
  type PersonalizationMode,
  type PersonalizationSettings,
  type PersonalizationSource,
} from './types';
import type { LeadPersonalizationPayload } from './types';

const CAMPAIGNS = 'mothermode_personalization_campaigns';
const LEADS = 'mothermode_lead_personalizations';

const CAMPAIGN_COLUMNS =
  'id, funnel_kind, funnel_id, mode, guidance, base_image_url, email_image_enabled, created_at, updated_at';
const LEAD_COLUMNS =
  'id, funnel_kind, funnel_id, lead_key, first_name, intent_segment, payload, model, source, generated_at';

let _service: ReturnType<typeof createClient> | null = null;
function serviceClient() {
  if (_service) return _service;
  _service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );
  return _service;
}

/** Emails are the lookup key; always compared lowercase. */
export function toLeadKey(email: string): string {
  return (email || '').trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Campaign settings
// ---------------------------------------------------------------------------

export async function getPersonalizationSettings(
  kind: FunnelKind,
  funnelId: string,
): Promise<PersonalizationSettings | null> {
  if (!funnelId) return null;
  try {
    const { data, error } = await (serviceClient() as any)
      .from(CAMPAIGNS)
      .select(CAMPAIGN_COLUMNS)
      .eq('funnel_kind', kind)
      .eq('funnel_id', funnelId)
      .maybeSingle();
    if (error || !data) return null;
    return normalizeSettings(data as PersonalizationCampaignRow);
  } catch {
    return null;
  }
}

export async function upsertPersonalizationSettings(input: {
  funnelKind: FunnelKind;
  funnelId: string;
  mode: PersonalizationMode;
  guidance?: string;
  baseImageUrl?: string;
  emailImageEnabled?: boolean;
}): Promise<PersonalizationSettings | null> {
  try {
    const row = {
      funnel_kind: toFunnelKind(input.funnelKind),
      funnel_id: input.funnelId,
      mode: toPersonalizationMode(input.mode),
      guidance: (input.guidance || '').slice(0, 2000),
      base_image_url: (input.baseImageUrl || '').slice(0, 500),
      email_image_enabled: input.emailImageEnabled === true,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await (serviceClient() as any)
      .from(CAMPAIGNS)
      .upsert(row, { onConflict: 'funnel_kind,funnel_id' })
      .select(CAMPAIGN_COLUMNS)
      .maybeSingle();
    if (error || !data) return null;
    return normalizeSettings(data as PersonalizationCampaignRow);
  } catch {
    return null;
  }
}

/** All campaigns with a live (non-off) mode — for the admin overview. */
export async function listPersonalizationCampaigns(): Promise<PersonalizationSettings[]> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(CAMPAIGNS)
      .select(CAMPAIGN_COLUMNS)
      .order('updated_at', { ascending: false });
    if (error || !data) return [];
    return (data as PersonalizationCampaignRow[])
      .map((r) => normalizeSettings(r))
      .filter((s): s is PersonalizationSettings => !!s);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Lead payloads
// ---------------------------------------------------------------------------

export async function getLeadPersonalization(
  kind: FunnelKind,
  funnelId: string,
  email: string,
): Promise<LeadPersonalizationRecord | null> {
  const leadKey = toLeadKey(email);
  if (!funnelId || !leadKey) return null;
  try {
    const { data, error } = await (serviceClient() as any)
      .from(LEADS)
      .select(LEAD_COLUMNS)
      .eq('funnel_kind', kind)
      .eq('funnel_id', funnelId)
      .eq('lead_key', leadKey)
      .maybeSingle();
    if (error || !data) return null;
    return rowToLeadPersonalization(data as LeadPersonalizationRow);
  } catch {
    return null;
  }
}

export async function upsertLeadPersonalization(input: {
  funnelKind: FunnelKind;
  funnelId: string;
  email: string;
  firstName?: string | null;
  intentSegment?: string;
  payload: LeadPersonalizationPayload;
  model?: string;
  source?: PersonalizationSource;
}): Promise<LeadPersonalizationRecord | null> {
  const leadKey = toLeadKey(input.email);
  if (!input.funnelId || !leadKey) return null;
  try {
    const row = {
      funnel_kind: toFunnelKind(input.funnelKind),
      funnel_id: input.funnelId,
      lead_key: leadKey,
      first_name: input.firstName?.trim() || null,
      intent_segment: (input.intentSegment || input.payload.intentSegment || '').slice(0, 80),
      payload: input.payload,
      model: (input.model || '').slice(0, 80),
      source: input.source === 'admin' ? 'admin' : 'ai',
      generated_at: new Date().toISOString(),
    };
    const { data, error } = await (serviceClient() as any)
      .from(LEADS)
      .upsert(row, { onConflict: 'funnel_kind,funnel_id,lead_key' })
      .select(LEAD_COLUMNS)
      .maybeSingle();
    if (error || !data) return null;
    return rowToLeadPersonalization(data as LeadPersonalizationRow);
  } catch {
    return null;
  }
}

export async function deleteLeadPersonalization(
  kind: FunnelKind,
  funnelId: string,
  email?: string,
): Promise<boolean> {
  try {
    let q = (serviceClient() as any)
      .from(LEADS)
      .delete()
      .eq('funnel_kind', kind)
      .eq('funnel_id', funnelId);
    const leadKey = toLeadKey(email || '');
    if (leadKey) q = q.eq('lead_key', leadKey);
    const { error } = await q;
    return !error;
  } catch {
    return false;
  }
}

/** Coverage stat for admin: how many leads have a payload on this funnel. */
export async function countLeadPersonalizations(
  kind: FunnelKind,
  funnelId: string,
): Promise<number> {
  try {
    const { count, error } = await (serviceClient() as any)
      .from(LEADS)
      .select('id', { count: 'exact', head: true })
      .eq('funnel_kind', kind)
      .eq('funnel_id', funnelId);
    if (error || count == null) return 0;
    return count as number;
  } catch {
    return 0;
  }
}

/** Recent payloads for the admin table (newest first). */
export async function listLeadPersonalizations(
  kind: FunnelKind,
  funnelId: string,
  limit = 50,
): Promise<LeadPersonalizationRecord[]> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(LEADS)
      .select(LEAD_COLUMNS)
      .eq('funnel_kind', kind)
      .eq('funnel_id', funnelId)
      .order('generated_at', { ascending: false })
      .limit(Math.max(1, Math.min(200, limit)));
    if (error || !data) return [];
    return (data as LeadPersonalizationRow[]).map(rowToLeadPersonalization);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Lead rows (read-only, from the funnel families' own tables)
// ---------------------------------------------------------------------------

/** The raw lead facts generate.ts builds an AI snapshot from. */
export interface LeadFactsRow {
  email: string;
  firstName: string | null;
  status: string;
  stepReached: string;
  purchased: boolean;
  purchaseAmountCents: number;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  referrer: string | null;
  createdAt: string;
  otoAccepted?: boolean;
}

/**
 * Read one lead from the funnel family's own table. Read-only and tolerant:
 * a missing utm_content column (pre-migration window) degrades that field to
 * null instead of failing the whole read — the same rollout logic as
 * leadUtmContent.ts, applied at SQL-string level by simply not selecting it.
 */
export async function getLeadFacts(
  kind: FunnelKind,
  funnelId: string,
  email: string,
): Promise<LeadFactsRow | null> {
  const leadKey = toLeadKey(email);
  if (!funnelId || !leadKey) return null;
  // The two lead tables have DIFFERENT shapes: sales carries
  // step_reached/purchased/purchase_amount_cents, optin carries oto_accepted.
  // Selecting the union would 42703 on both — keep per-kind column lists.
  const table = kind === 'sales' ? 'mothermode_sales_funnel_leads' : 'mothermode_optin_leads';
  const columns =
    kind === 'sales'
      ? 'email, first_name, status, step_reached, purchased, purchase_amount_cents, utm_source, utm_medium, utm_campaign, referrer, created_at'
      : 'email, first_name, status, oto_accepted, utm_source, utm_medium, utm_campaign, referrer, created_at';
  try {
    const { data, error } = await (serviceClient() as any)
      .from(table)
      .select(columns)
      .eq('funnel_id', funnelId)
      .eq('email', leadKey)
      .maybeSingle();
    if (error || !data) return null;

    const r = data as Record<string, unknown>;
    return {
      email: String(r.email || leadKey),
      firstName: (r.first_name as string) ?? null,
      status: String(r.status || 'captured'),
      stepReached: String(r.step_reached || ''),
      purchased: r.purchased === true,
      purchaseAmountCents: typeof r.purchase_amount_cents === 'number' ? r.purchase_amount_cents : 0,
      utmSource: (r.utm_source as string) ?? null,
      utmMedium: (r.utm_medium as string) ?? null,
      utmCampaign: (r.utm_campaign as string) ?? null,
      utmContent: null, // see docstring: intentionally not selected here
      referrer: (r.referrer as string) ?? null,
      createdAt: String(r.created_at || ''),
      ...(kind === 'optin' ? { otoAccepted: r.oto_accepted === true } : {}),
    };
  } catch {
    return null;
  }
}

/** Distinct lead emails for a funnel (admin "generate for all" batch). */
export async function listLeadEmailsForFunnel(
  kind: FunnelKind,
  funnelId: string,
  limit = 500,
): Promise<{ email: string; firstName: string | null }[]> {
  const table = kind === 'sales' ? 'mothermode_sales_funnel_leads' : 'mothermode_optin_leads';
  try {
    const { data, error } = await (serviceClient() as any)
      .from(table)
      .select('email, first_name')
      .eq('funnel_id', funnelId)
      .order('created_at', { ascending: false })
      .limit(Math.max(1, Math.min(2000, limit)));
    if (error || !data) return [];
    return (data as { email: string; first_name: string | null }[])
      .filter((r) => typeof r.email === 'string' && r.email.includes('@'))
      .map((r) => ({ email: r.email, firstName: r.first_name ?? null }));
  } catch {
    return [];
  }
}


