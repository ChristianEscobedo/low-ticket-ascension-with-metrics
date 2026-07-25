/**
 * MotherMode Sales Funnel store. Service-role only (bypasses RLS).
 * Public pages and capture go through API routes that call these helpers
 * after validation — never from the browser with the anon key.
 */
import { createClient } from '@supabase/supabase-js';
import { normalizeEmailKits } from './types';
import {
  normalizeSalesFooter,
  normalizeSalesOptin,
  normalizeSalesPage,
  normalizeVslPage,
  normalizeCheckout,
  normalizeUpsell,
  normalizeSuccess,
  normalizeAccess,
  rowToSalesFunnel,
  rowToSalesLead,
  slugifySalesName,
  toSalesFunnelStatus,
  type SalesEventType,
  type SalesFooterContent,
  type SalesFunnelRecord,
  type SalesFunnelRow,
  type SalesFunnelStatus,
  type SalesLeadRecord,
  type SalesLeadRow,
  type SalesOptinContent,
  type SalesPageContent,
  type VslPageContent,
  type CheckoutContent,
  type UpsellContent,
  type SuccessContent,
  type AccessContent,
  type SalesEmailKitBinding,
  type SalesEmailEvent,
} from './types';
import { upsertEnrollments } from '@/lib/mothermode/email/enrollmentStore';

const FUNNELS = 'mothermode_sales_funnels';
const LEADS = 'mothermode_sales_funnel_leads';
const EVENTS = 'mothermode_sales_funnel_events';

const FUNNEL_COLUMNS =
  'id, slug, name, status, offer_slug, lead_gen_slug, deliverable_slug, deliverable_key, email_kit_id, email_kits, product_id, optin, sales, vsl, checkout, upsell1, upsell2, upsell3, upsell4, success, access, footer, view_count, conversion_count, checkout_count, purchase_count, upsell1_yes, upsell1_no, upsell2_yes, upsell2_no, upsell3_yes, upsell3_no, upsell4_yes, upsell4_no, revenue_cents, created_at, updated_at, updated_by';

const LEAD_COLUMNS =
  'id, funnel_id, email, first_name, status, step_reached, purchased, purchase_amount_cents, utm_source, utm_medium, utm_campaign, referrer, user_agent, ip_hash, metadata, created_at, updated_at';

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
export async function listFunnelsForAdmin(): Promise<SalesFunnelRecord[]> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(FUNNELS)
      .select(FUNNEL_COLUMNS)
      .order('updated_at', { ascending: false });
    if (error || !data) return [];
    return (data as SalesFunnelRow[]).map(rowToSalesFunnel);
  } catch {
    return [];
  }
}

export async function getFunnelById(id: string): Promise<SalesFunnelRecord | null> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(FUNNELS)
      .select(FUNNEL_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return rowToSalesFunnel(data as SalesFunnelRow);
  } catch {
    return null;
  }
}

export async function getFunnelBySlug(slug: string): Promise<SalesFunnelRecord | null> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(FUNNELS)
      .select(FUNNEL_COLUMNS)
      .eq('slug', slug)
      .maybeSingle();
    if (error || !data) return null;
    return rowToSalesFunnel(data as SalesFunnelRow);
  } catch {
    return null;
  }
}

/** Public: published funnel only. */
export async function getPublishedFunnelBySlug(
  slug: string,
): Promise<SalesFunnelRecord | null> {
  const funnel = await getFunnelBySlug(slug);
  if (!funnel || funnel.status !== 'published') return null;
  return funnel;
}

export interface UpsertSalesFunnelInput {
  id?: string | null;
  slug: string;
  name: string;
  status: SalesFunnelStatus;
  offerSlug?: string | null;
  leadGenSlug?: string | null;
  deliverableSlug?: string | null;
  deliverableKey?: string | null;
  emailKitId?: string | null;
  emailKits?: SalesEmailKitBinding[];
  productId?: string | null;
  optin: SalesOptinContent;
  sales: SalesPageContent;
  vsl: VslPageContent;
  checkout: CheckoutContent;
  upsell1: UpsellContent;
  upsell2: UpsellContent;
  upsell3: UpsellContent;
  upsell4: UpsellContent;
  success: SuccessContent;
  access: AccessContent;
  footer: SalesFooterContent;
  updatedBy?: string | null;
}

export async function upsertFunnel(
  input: UpsertSalesFunnelInput,
): Promise<SalesFunnelRecord> {
  const row: Record<string, unknown> = {
    slug: input.slug,
    name: input.name,
    status: toSalesFunnelStatus(input.status),
    offer_slug: input.offerSlug || null,
    lead_gen_slug: input.leadGenSlug || null,
    deliverable_slug: input.deliverableSlug || null,
    deliverable_key: input.deliverableKey || null,
    email_kit_id: input.emailKitId || null,
    email_kits: normalizeEmailKits(input.emailKits),
    // keep legacy optin kit in sync when multi-map provides optin
    // (email_kit_id already set above; override if optin binding present)
    product_id: input.productId || null,
    optin: normalizeSalesOptin(input.optin),
    sales: normalizeSalesPage(input.sales),
    vsl: normalizeVslPage(input.vsl),
    checkout: normalizeCheckout(input.checkout),
    upsell1: normalizeUpsell(input.upsell1),
    upsell2: normalizeUpsell(input.upsell2),
    upsell3: normalizeUpsell(input.upsell3),
    upsell4: normalizeUpsell(input.upsell4),
    success: normalizeSuccess(input.success),
    access: normalizeAccess(input.access),
    footer: normalizeSalesFooter(input.footer),
    updated_by: input.updatedBy ?? null,
    updated_at: new Date().toISOString(),
  };
  if (input.id) row.id = input.id;

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
  return rowToSalesFunnel(data as SalesFunnelRow);
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

export async function incrementCheckoutCount(id: string): Promise<void> {
  try {
    const funnel = await getFunnelById(id);
    if (!funnel) return;
    await (serviceClient() as any)
      .from(FUNNELS)
      .update({ checkout_count: funnel.checkoutCount + 1 })
      .eq('id', id);
  } catch {
    // non-fatal
  }
}

export async function incrementPurchaseCount(id: string, revenueCents: number): Promise<void> {
  try {
    const funnel = await getFunnelById(id);
    if (!funnel) return;
    await (serviceClient() as any)
      .from(FUNNELS)
      .update({
        purchase_count: funnel.purchaseCount + 1,
        revenue_cents: funnel.revenueCents + revenueCents,
      })
      .eq('id', id);
  } catch {
    // non-fatal
  }
}

export async function incrementUpsellCount(
  id: string,
  slot: 1 | 2 | 3 | 4,
  accepted: boolean,
): Promise<void> {
  try {
    const funnel = await getFunnelById(id);
    if (!funnel) return;
    const yesKey = `upsell${slot}_yes`;
    const noKey = `upsell${slot}_no`;
    const patch = accepted
      ? { [yesKey]: (funnel as any)[yesKey] + 1 }
      : { [noKey]: (funnel as any)[noKey] + 1 };
    await (serviceClient() as any).from(FUNNELS).update(patch).eq('id', id);
  } catch {
    // non-fatal
  }
}

export async function recordSalesEvent(input: {
  funnelId: string;
  eventType: SalesEventType;
  leadId?: string | null;
  step?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await (serviceClient() as any).from(EVENTS).insert({
      funnel_id: input.funnelId,
      event_type: input.eventType,
      lead_id: input.leadId || null,
      step: input.step || null,
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
): Promise<SalesFunnelRecord> {
  const src = await getFunnelById(id);
  if (!src) throw new Error('Funnel not found');

  let base = slugifySalesName(`${src.slug}-copy`);
  if (!base) base = `funnel-copy-${Date.now().toString(36)}`;
  let slug = base;
  for (let i = 0; i < 20; i++) {
    const existing = await getFunnelBySlug(slug);
    if (!existing) break;
    slug = slugifySalesName(`${base}-${i + 2}`);
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
    emailKits: src.emailKits,
    productId: src.productId,
    optin: src.optin,
    sales: src.sales,
    vsl: src.vsl,
    checkout: src.checkout,
    upsell1: src.upsell1,
    upsell2: src.upsell2,
    upsell3: src.upsell3,
    upsell4: src.upsell4,
    success: src.success,
    access: src.access,
    footer: src.footer,
    updatedBy: updatedBy ?? null,
  });
}

/**
 * Enroll a lead into the funnel's linked Email Marketing kit.
 * Uses email as subscriber_id. Non-throwing for capture path.
 */

/** Resolve kit id for a funnel event. Falls back to legacy emailKitId for optin. */
export function resolveEmailKitIdForEvent(
  funnel: { emailKitId: string | null; emailKits?: SalesEmailKitBinding[] },
  event: SalesEmailEvent | string,
): string | null {
  const kits = Array.isArray(funnel.emailKits) ? funnel.emailKits : [];
  const hit = kits.find((k) => k.event === event && k.emailKitId);
  if (hit?.emailKitId) return hit.emailKitId;
  // legacy fallback
  const legacy = kits.find((k: any) => k.event === event && (k as any).kitId);
  if (legacy && (legacy as any).kitId) return (legacy as any).kitId as string;
  if (event === 'optin' && funnel.emailKitId) return funnel.emailKitId;
  return null;
}

export async function enrollLeadInEmailKit(input: {
  emailKitId: string;
  email: string;
  leadId: string;
  funnelId: string;
  funnelSlug: string;
  event?: string;
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
          source: 'sales_funnel_capture',
          leadId: input.leadId,
          funnelId: input.funnelId,
          funnelSlug: input.funnelSlug,
          firstName: input.firstName || null,
        },
      },
    ]);
    return true;
  } catch (err) {
    console.error('[sales-funnel] email enroll failed:', err);
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

export interface CaptureSalesLeadInput {
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
  input: CaptureSalesLeadInput,
): Promise<{ lead: SalesLeadRecord; isNew: boolean }> {
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
    return { lead: rowToSalesLead(data as SalesLeadRow), isNew: false };
  }

  const insertRow = {
    funnel_id: input.funnelId,
    email,
    first_name: input.firstName?.trim() || null,
    status: 'captured',
    step_reached: 'optin',
    purchased: false,
    purchase_amount_cents: 0,
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
  return { lead: rowToSalesLead(data as SalesLeadRow), isNew: true };
}

/** Mark which step a lead has reached. */
export async function markLeadStep(
  leadId: string,
  step: string,
): Promise<string | null> {
  const { data, error } = await (serviceClient() as any)
    .from(LEADS)
    .update({
      step_reached: step,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId)
    .select('funnel_id')
    .maybeSingle();
  if (error) throw new Error(`markLeadStep failed: ${error.message}`);
  return data?.funnel_id ?? null;
}

/** Mark a lead as having started checkout. */
export async function markLeadCheckoutStarted(leadId: string): Promise<string | null> {
  const { data, error } = await (serviceClient() as any)
    .from(LEADS)
    .update({
      status: 'checkout_started',
      step_reached: 'checkout',
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId)
    .select('funnel_id')
    .maybeSingle();
  if (error) throw new Error(`markLeadCheckoutStarted failed: ${error.message}`);
  return data?.funnel_id ?? null;
}

/** Mark a lead as having purchased. */
export async function markLeadPurchase(
  leadId: string,
  amountCents: number,
): Promise<string | null> {
  const { data, error } = await (serviceClient() as any)
    .from(LEADS)
    .update({
      status: 'purchased',
      purchased: true,
      purchase_amount_cents: amountCents,
      step_reached: 'success',
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId)
    .select('funnel_id')
    .maybeSingle();
  if (error) throw new Error(`markLeadPurchase failed: ${error.message}`);
  return data?.funnel_id ?? null;
}

/** Mark upsell outcome for a lead. */
export async function markLeadUpsell(
  leadId: string,
  slot: 1 | 2 | 3 | 4,
  accepted: boolean,
): Promise<string | null> {
  const step = `upsell${slot}`;
  const { data, error } = await (serviceClient() as any)
    .from(LEADS)
    .update({
      step_reached: step,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId)
    .select('funnel_id')
    .maybeSingle();
  if (error) throw new Error(`markLeadUpsell failed: ${error.message}`);
  return data?.funnel_id ?? null;
}

/** Fetch a single lead by id (for event-based email enrollment). */
export async function getLeadById(leadId: string): Promise<SalesLeadRecord | null> {
  if (!leadId) return null;
  try {
    const { data, error } = await (serviceClient() as any)
      .from(LEADS)
      .select(LEAD_COLUMNS)
      .eq('id', leadId)
      .maybeSingle();
    if (error || !data) return null;
    return rowToSalesLead(data as SalesLeadRow);
  } catch {
    return null;
  }
}

/** Admin: recent leads, optionally filtered by funnel. */
export async function listLeadsForAdmin(opts?: {
  funnelId?: string;
  limit?: number;
}): Promise<SalesLeadRecord[]> {
  try {
    const limit = opts?.limit ?? 100;
    let q = (serviceClient() as any)
      .from(LEADS)
      .select(
        `${LEAD_COLUMNS}, funnel:mothermode_sales_funnels!funnel_id ( name, slug )`,
      )
      .order('created_at', { ascending: false })
      .limit(limit);
    if (opts?.funnelId) q = q.eq('funnel_id', opts.funnelId);

    const { data, error } = await q;
    if (error || !data) return [];

    return (data as Array<SalesLeadRow & { funnel?: { name?: string; slug?: string } | null }>).map(
      (row) =>
        rowToSalesLead(row, {
          funnelName: row.funnel?.name,
          funnelSlug: row.funnel?.slug,
        }),
    );
  } catch {
    return [];
  }
}