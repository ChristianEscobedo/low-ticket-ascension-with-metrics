/**
 * MotherMode Optin Funnel store. Service-role only (bypasses RLS).
 * Public pages and capture go through API routes that call these helpers
 * after validation — never from the browser with the anon key.
 */
import { createClient } from '@supabase/supabase-js';
import {
  normalizeOptinFooter,
  normalizeOptinOto,
  normalizeOptinPage,
  normalizeOptinThankYou,
  rowToOptinFunnel,
  rowToOptinLead,
  slugifyOptinName,
  toOptinFunnelStatus,
  type OptinEventType,
  type OptinFooterContent,
  type OptinFunnelRecord,
  type OptinFunnelRow,
  type OptinFunnelStatus,
  type OptinLeadRecord,
  type OptinLeadRow,
  type OptinLeadStatus,
  type OptinOtoContent,
  type OptinPageContent,
  type OptinThankYouContent,
} from './types';
import { upsertEnrollments } from '@/lib/mothermode/email/enrollmentStore';


const FUNNELS = 'mothermode_optin_funnels';
const LEADS = 'mothermode_optin_leads';

const FUNNEL_COLUMNS =
  'id, slug, name, status, offer_slug, lead_gen_slug, deliverable_slug, deliverable_key, email_kit_id, optin, oto, thankyou, footer, view_count, conversion_count, oto_yes_count, oto_no_count, created_at, updated_at, updated_by';

const EVENTS = 'mothermode_optin_events';


const LEAD_COLUMNS =
  'id, funnel_id, email, first_name, status, oto_accepted, utm_source, utm_medium, utm_campaign, referrer, user_agent, ip_hash, metadata, created_at, updated_at';

let _service: ReturnType<typeof createClient> | null = null;
function serviceClient() {
  if (_service) return _service;
  _service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );
  return _service;
}

// ---------------------------------------------------------------------------
// Funnels
// ---------------------------------------------------------------------------

/** Admin: every funnel, newest first. */
export async function listFunnelsForAdmin(): Promise<OptinFunnelRecord[]> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(FUNNELS)
      .select(FUNNEL_COLUMNS)
      .order('updated_at', { ascending: false });
    if (error || !data) return [];
    return (data as OptinFunnelRow[]).map(rowToOptinFunnel);
  } catch {
    return [];
  }
}

export async function getFunnelById(id: string): Promise<OptinFunnelRecord | null> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(FUNNELS)
      .select(FUNNEL_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return rowToOptinFunnel(data as OptinFunnelRow);
  } catch {
    return null;
  }
}

export async function getFunnelBySlug(slug: string): Promise<OptinFunnelRecord | null> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(FUNNELS)
      .select(FUNNEL_COLUMNS)
      .eq('slug', slug)
      .maybeSingle();
    if (error || !data) return null;
    return rowToOptinFunnel(data as OptinFunnelRow);
  } catch {
    return null;
  }
}

/** Public: published funnel only. */
export async function getPublishedFunnelBySlug(
  slug: string,
): Promise<OptinFunnelRecord | null> {
  const funnel = await getFunnelBySlug(slug);
  if (!funnel || funnel.status !== 'published') return null;
  return funnel;
}

export interface UpsertFunnelInput {
  id?: string | null;
  slug: string;
  name: string;
  status: OptinFunnelStatus;
  offerSlug?: string | null;
  leadGenSlug?: string | null;
  deliverableSlug?: string | null;
  deliverableKey?: string | null;
  emailKitId?: string | null;
  optin: OptinPageContent;
  oto: OptinOtoContent;
  thankyou: OptinThankYouContent;
  footer: OptinFooterContent;
  updatedBy?: string | null;
}


export async function upsertFunnel(input: UpsertFunnelInput): Promise<OptinFunnelRecord> {
  const row: Record<string, unknown> = {
    slug: input.slug,
    name: input.name,
    status: toOptinFunnelStatus(input.status),
    offer_slug: input.offerSlug || null,
    lead_gen_slug: input.leadGenSlug || null,
    deliverable_slug: input.deliverableSlug || null,
    deliverable_key: input.deliverableKey || null,
    email_kit_id: input.emailKitId || null,
    optin: normalizeOptinPage(input.optin),
    oto: normalizeOptinOto(input.oto),
    thankyou: normalizeOptinThankYou(input.thankyou),
    footer: normalizeOptinFooter(input.footer),
    updated_by: input.updatedBy ?? null,
    updated_at: new Date().toISOString(),
  };
  if (input.id) row.id = input.id;

  // If we have an id, update by id. If no id (new funnel), check if a row
  // with this slug already exists (e.g. from a previous failed save) and
  // update that row instead of inserting a duplicate.
  if (!input.id) {
    const existing = await (serviceClient() as any)
      .from(FUNNELS)
      .select('id')
      .eq('slug', input.slug)
      .maybeSingle();
    if (existing.data) {
      row.id = existing.data.id;
    }
  }

  const { data, error } = await (serviceClient() as any)
    .from(FUNNELS)
    .upsert(row, { onConflict: 'id' })
    .select(FUNNEL_COLUMNS)
    .single();
  if (error || !data) {
    throw new Error(`upsertFunnel failed: ${error?.message ?? 'no row returned'}`);
  }
  return rowToOptinFunnel(data as OptinFunnelRow);
}


export async function deleteFunnel(id: string): Promise<void> {
  const { error } = await (serviceClient() as any).from(FUNNELS).delete().eq('id', id);
  if (error) throw new Error(`deleteFunnel failed: ${error.message}`);
}

export async function incrementFunnelViews(id: string): Promise<void> {
  try {
    const funnel = await getFunnelById(id);
    if (!funnel) return;
    await (serviceClient() as any)
      .from(FUNNELS)
      .update({ view_count: funnel.viewCount + 1 })
      .eq('id', id);
  } catch {
    // non-fatal
  }
}

export async function incrementFunnelConversions(id: string): Promise<void> {
  try {
    const funnel = await getFunnelById(id);
    if (!funnel) return;
    await (serviceClient() as any)
      .from(FUNNELS)
      .update({ conversion_count: funnel.conversionCount + 1 })
      .eq('id', id);
  } catch {
    // non-fatal
  }
}

export async function incrementOtoCount(id: string, accepted: boolean): Promise<void> {
  try {
    const funnel = await getFunnelById(id);
    if (!funnel) return;
    const patch = accepted
      ? { oto_yes_count: funnel.otoYesCount + 1 }
      : { oto_no_count: funnel.otoNoCount + 1 };
    await (serviceClient() as any).from(FUNNELS).update(patch).eq('id', id);
  } catch {
    // non-fatal
  }
}

export async function recordOptinEvent(input: {
  funnelId: string;
  eventType: OptinEventType;
  leadId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await (serviceClient() as any).from(EVENTS).insert({
      funnel_id: input.funnelId,
      event_type: input.eventType,
      lead_id: input.leadId || null,
      metadata: input.metadata ?? {},
    });
  } catch {
    // non-fatal
  }
}

/** Duplicate a funnel with a unique slug suffix. */
export async function duplicateFunnel(
  id: string,
  updatedBy?: string | null,
): Promise<OptinFunnelRecord> {
  const src = await getFunnelById(id);
  if (!src) throw new Error('Funnel not found');

  let base = slugifyOptinName(`${src.slug}-copy`);
  if (!base) base = `funnel-copy-${Date.now().toString(36)}`;
  let slug = base;
  for (let i = 0; i < 20; i++) {
    const existing = await getFunnelBySlug(slug);
    if (!existing) break;
    slug = slugifyOptinName(`${base}-${i + 2}`);
  }

  return upsertFunnel({
    slug,
    name: `${src.name || src.slug} (copy)`,
    status: 'draft',
    offerSlug: src.offerSlug,
    leadGenSlug: src.leadGenSlug,
    deliverableSlug: src.deliverableSlug,
    deliverableKey: src.deliverableKey,
    emailKitId: src.emailKitId,
    optin: src.optin,
    oto: src.oto,
    thankyou: src.thankyou,
    footer: src.footer,
    updatedBy: updatedBy ?? null,
  });
}

/**
 * Enroll a lead into the funnel's linked Email Marketing kit.
 * Uses email as subscriber_id. Non-throwing for capture path.
 */
export async function enrollLeadInEmailKit(input: {
  emailKitId: string;
  email: string;
  leadId: string;
  funnelId: string;
  funnelSlug: string;
  firstName?: string | null;
}): Promise<boolean> {
  try {
    const email = input.email.trim().toLowerCase();
    if (!input.emailKitId || !email) return false;
    const now = new Date().toISOString();
    await upsertEnrollments(input.emailKitId, [
      {
        subscriberId: email,
        emailId: '',
        status: 'enrolled',
        enrolledAt: now,
        lastEventAt: now,
        metadata: {
          source: 'optin_capture',
          leadId: input.leadId,
          funnelId: input.funnelId,
          funnelSlug: input.funnelSlug,
          firstName: input.firstName || null,
        },
      },
    ]);
    return true;
  } catch (err) {
    console.error('[optin] email enroll failed:', err);
    return false;
  }
}

/** Simple in-memory rate limit for capture (per process). */
const captureBuckets = new Map<string, { count: number; resetAt: number }>();

export function checkCaptureRateLimit(
  key: string,
  limit = 12,
  windowMs = 60_000,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const cur = captureBuckets.get(key);
  if (!cur || cur.resetAt <= now) {
    captureBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (cur.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((cur.resetAt - now) / 1000)) };
  }
  cur.count += 1;
  return { ok: true };
}


// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export interface CaptureLeadInput {
  funnelId: string;
  email: string;
  firstName?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  referrer?: string | null;
  userAgent?: string | null;
  ipHash?: string | null;
}

/**
 * Upsert a lead by (funnel_id, email). Returns { lead, isNew }.
 * isNew=true means conversion_count should bump.
 */
export async function captureLead(
  input: CaptureLeadInput,
): Promise<{ lead: OptinLeadRecord; isNew: boolean }> {
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    throw new Error('Valid email is required');
  }

  const existing = await (serviceClient() as any)
    .from(LEADS)
    .select(LEAD_COLUMNS)
    .eq('funnel_id', input.funnelId)
    .eq('email', email)
    .maybeSingle();

  if (existing.data) {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (input.firstName) patch.first_name = input.firstName.trim();
    const { data, error } = await (serviceClient() as any)
      .from(LEADS)
      .update(patch)
      .eq('id', existing.data.id)
      .select(LEAD_COLUMNS)
      .single();
    if (error || !data) {
      throw new Error(`captureLead update failed: ${error?.message ?? 'no row'}`);
    }
    return { lead: rowToOptinLead(data as OptinLeadRow), isNew: false };
  }

  const insertRow = {
    funnel_id: input.funnelId,
    email,
    first_name: input.firstName?.trim() || null,
    status: 'captured',
    oto_accepted: false,
    utm_source: input.utmSource || null,
    utm_medium: input.utmMedium || null,
    utm_campaign: input.utmCampaign || null,
    referrer: input.referrer || null,
    user_agent: input.userAgent || null,
    ip_hash: input.ipHash || null,
    metadata: {},
  };

  const { data, error } = await (serviceClient() as any)
    .from(LEADS)
    .insert(insertRow)
    .select(LEAD_COLUMNS)
    .single();
  if (error || !data) {
    throw new Error(`captureLead insert failed: ${error?.message ?? 'no row'}`);
  }
  return { lead: rowToOptinLead(data as OptinLeadRow), isNew: true };
}

/** Mark OTO outcome. Returns funnel_id for stats, or null if lead missing. */
export async function markLeadOto(
  leadId: string,
  accepted: boolean,
): Promise<string | null> {
  const status: OptinLeadStatus = accepted ? 'oto_accepted' : 'oto_declined';
  const { data, error } = await (serviceClient() as any)
    .from(LEADS)
    .update({
      oto_accepted: accepted,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId)
    .select('funnel_id')
    .maybeSingle();
  if (error) throw new Error(`markLeadOto failed: ${error.message}`);
  return data?.funnel_id ?? null;
}


/** Admin: recent leads, optionally filtered by funnel. */
export async function listLeadsForAdmin(opts?: {
  funnelId?: string;
  limit?: number;
}): Promise<OptinLeadRecord[]> {
  try {
    const limit = opts?.limit ?? 100;
    let q = (serviceClient() as any)
      .from(LEADS)
      .select(
        `${LEAD_COLUMNS}, funnel:mothermode_optin_funnels!funnel_id ( name, slug )`,
      )
      .order('created_at', { ascending: false })
      .limit(limit);
    if (opts?.funnelId) q = q.eq('funnel_id', opts.funnelId);

    const { data, error } = await q;
    if (error || !data) return [];

    return (data as Array<OptinLeadRow & { funnel?: { name?: string; slug?: string } | null }>).map(
      (row) =>
        rowToOptinLead(row, {
          funnelName: row.funnel?.name,
          funnelSlug: row.funnel?.slug,
        }),
    );
  } catch {
    return [];
  }
}
