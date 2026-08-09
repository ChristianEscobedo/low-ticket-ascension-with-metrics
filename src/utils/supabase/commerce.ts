/**
 * Commerce store: refunds, comped entitlements, and email-keyed customers.
 *
 * Kept separate from utils/supabase/admin.ts (Stripe-mirror helpers) — these
 * are the admin-workflow tables this project owns: funnel_purchases refund
 * bookkeeping and the comped_entitlements table behind "Add subscription →
 * comp access" in /admin/subscriptions.
 *
 * Service-role only. Call from server actions / API routes after an admin
 * check, never from the browser.
 */
import { createClient } from '@supabase/supabase-js';

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
// funnel_purchases — refunds
// ---------------------------------------------------------------------------

export interface FunnelPurchaseRefundRow {
  id: string;
  status: string;
  refunded_at: string | null;
  refund_id: string | null;
  refunded_amount_cents: number | null;
}

export async function getFunnelPurchaseById(id: string) {
  const { data, error } = await (serviceClient() as any)
    .from('funnel_purchases')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`getFunnelPurchaseById failed: ${error.message}`);
  return data as Record<string, any> | null;
}

/**
 * Mark a purchase refunded. Locates the row by id, falling back to
 * payment_intent_id / checkout_session_id (webhook path). Idempotent: an
 * already-refunded row is returned as-is.
 */
export async function markFunnelPurchaseRefunded(input: {
  purchaseId?: string;
  paymentIntentId?: string | null;
  checkoutSessionId?: string | null;
  refundId: string;
  amountCents?: number | null;
}): Promise<Record<string, any> | null> {
  const db = serviceClient() as any;
  let row: Record<string, any> | null = null;

  if (input.purchaseId) {
    const { data } = await db
      .from('funnel_purchases')
      .select('*')
      .eq('id', input.purchaseId)
      .maybeSingle();
    row = data;
  }
  if (!row && input.paymentIntentId) {
    const { data } = await db
      .from('funnel_purchases')
      .select('*')
      .eq('payment_intent_id', input.paymentIntentId)
      .maybeSingle();
    row = data;
  }
  if (!row && input.checkoutSessionId) {
    const { data } = await db
      .from('funnel_purchases')
      .select('*')
      .eq('checkout_session_id', input.checkoutSessionId)
      .maybeSingle();
    row = data;
  }
  if (!row) return null;
  if (row.status === 'refunded' && row.refund_id === input.refundId) return row;

  const { data, error } = await db
    .from('funnel_purchases')
    .update({
      status: 'refunded',
      refunded_at: new Date().toISOString(),
      refund_id: input.refundId,
      refunded_amount_cents: input.amountCents ?? row.amount_cents ?? null,
    })
    .eq('id', row.id)
    .select('*')
    .single();
  if (error) throw new Error(`markFunnelPurchaseRefunded failed: ${error.message}`);
  return data as Record<string, any>;
}

// ---------------------------------------------------------------------------
// comped_entitlements
// ---------------------------------------------------------------------------

export interface CompedEntitlement {
  id: string;
  customer_email: string;
  product_id: string | null;
  price_id: string | null;
  product_name: string | null;
  user_id: string | null;
  status: 'active' | 'revoked';
  note: string | null;
  created_by: string | null;
  created_at: string;
  revoked_at: string | null;
}

export async function insertCompedEntitlement(input: {
  customerEmail: string;
  productId?: string | null;
  priceId?: string | null;
  productName?: string | null;
  userId?: string | null;
  note?: string | null;
  createdBy?: string | null;
}): Promise<CompedEntitlement> {
  const { data, error } = await (serviceClient() as any)
    .from('comped_entitlements')
    .insert({
      customer_email: input.customerEmail.trim().toLowerCase(),
      product_id: input.productId || null,
      price_id: input.priceId || null,
      product_name: input.productName || null,
      user_id: input.userId || null,
      note: input.note || null,
      created_by: input.createdBy || null,
      status: 'active',
    })
    .select('*')
    .single();
  if (error || !data) {
    throw new Error(`insertCompedEntitlement failed: ${error?.message ?? 'no row'}`);
  }
  return data as CompedEntitlement;
}

export async function revokeCompedEntitlement(id: string): Promise<CompedEntitlement> {
  const { data, error } = await (serviceClient() as any)
    .from('comped_entitlements')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error || !data) {
    throw new Error(`revokeCompedEntitlement failed: ${error?.message ?? 'no row'}`);
  }
  return data as CompedEntitlement;
}

export async function listCompedEntitlements(opts?: {
  email?: string;
  activeOnly?: boolean;
  limit?: number;
}): Promise<CompedEntitlement[]> {
  try {
    let q = (serviceClient() as any)
      .from('comped_entitlements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(opts?.limit ?? 200);
    if (opts?.email) q = q.eq('customer_email', opts.email.trim().toLowerCase());
    if (opts?.activeOnly) q = q.eq('status', 'active');
    const { data, error } = await q;
    if (error || !data) return [];
    return data as CompedEntitlement[];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Email-keyed customers (funnel buyers without auth accounts)
// ---------------------------------------------------------------------------

export interface EmailCustomerSummary {
  email: string;
  name: string | null;
  purchaseCount: number;
  lifetimeCents: number;
  lastPurchaseAt: string;
  firstPurchaseAt: string;
  /** True when this email also belongs to an auth user. */
  hasAccount: boolean;
  userId: string | null;
}

/**
 * Aggregate funnel_purchases by customer email. Auth users are merged in when
 * their email matches (hasAccount + userId set), so the admin Customers page
 * shows BOTH account-holders and checkout-only buyers with their purchases.
 */
export async function listEmailCustomers(opts?: {
  limit?: number;
}): Promise<EmailCustomerSummary[]> {
  const db = serviceClient() as any;
  const cap = Math.min(Math.max(opts?.limit ?? 500, 50), 2000);
  try {
    const { data: purchases, error } = await db
      .from('funnel_purchases')
      .select('customer_email, customer_name, amount_cents, status, created_at')
      .not('customer_email', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5000);
    if (error || !purchases) return [];

    const byEmail = new Map<string, EmailCustomerSummary>();
    for (const p of purchases as any[]) {
      const email = String(p.customer_email ?? '').trim().toLowerCase();
      if (!email) continue;
      const cur = byEmail.get(email);
      const succeeded = p.status !== 'refunded';
      if (cur) {
        cur.purchaseCount += 1;
        if (succeeded) cur.lifetimeCents += Number(p.amount_cents ?? 0);
        if (p.created_at > cur.lastPurchaseAt) cur.lastPurchaseAt = p.created_at;
        if (p.created_at < cur.firstPurchaseAt) cur.firstPurchaseAt = p.created_at;
        if (!cur.name && p.customer_name) cur.name = p.customer_name;
      } else {
        byEmail.set(email, {
          email,
          name: p.customer_name ?? null,
          purchaseCount: 1,
          lifetimeCents: succeeded ? Number(p.amount_cents ?? 0) : 0,
          lastPurchaseAt: p.created_at,
          firstPurchaseAt: p.created_at,
          hasAccount: false,
          userId: null,
        });
      }
    }

    // Merge auth users by email so account status shows on the same row.
    const { data: usersList } = await db.auth.admin.listUsers({
      page: 1,
      perPage: 500,
    });
    const users =
      (usersList?.users as { id: string; email?: string | null; created_at?: string }[]) ??
      [];
    for (const u of users) {
      const email = (u.email ?? '').trim().toLowerCase();
      if (!email) continue;
      const cur = byEmail.get(email);
      if (cur) {
        cur.hasAccount = true;
        cur.userId = u.id;
      } else {
        byEmail.set(email, {
          email,
          name: null,
          purchaseCount: 0,
          lifetimeCents: 0,
          lastPurchaseAt: u.created_at ?? '',
          firstPurchaseAt: u.created_at ?? '',
          hasAccount: true,
          userId: u.id,
        });
      }
    }

    return Array.from(byEmail.values())
      .sort((a, b) => (b.lastPurchaseAt || '').localeCompare(a.lastPurchaseAt || ''))
      .slice(0, cap);
  } catch {
    return [];
  }
}

/** Everything the admin needs on one buyer, keyed by email. */
export async function getCustomerByEmail(emailRaw: string): Promise<{
  email: string;
  purchases: Record<string, any>[];
  comps: CompedEntitlement[];
  userId: string | null;
}> {
  const email = emailRaw.trim().toLowerCase();
  const db = serviceClient() as any;
  const [{ data: purchases }, comps, { data: usersList }] = await Promise.all([
    db
      .from('funnel_purchases')
      .select('*')
      .eq('customer_email', email)
      .order('created_at', { ascending: false })
      .limit(200),
    listCompedEntitlements({ email }),
    db.auth.admin.listUsers({ page: 1, perPage: 500 }),
  ]);
  const users = (usersList?.users as { id: string; email?: string | null }[]) ?? [];
  const match = users.find((u) => (u.email ?? '').trim().toLowerCase() === email);
  return {
    email,
    purchases: (purchases as Record<string, any>[]) ?? [],
    comps,
    userId: match?.id ?? null,
  };
}
