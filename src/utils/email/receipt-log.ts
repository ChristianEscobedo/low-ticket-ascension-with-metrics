import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { PurchaseEvent } from '@/utils/integrations/dispatch';
import type { ReceiptSendResult } from './receipt';

// Service-role client — lazy so module import never throws on missing env.
let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;
  _supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
  return _supabase;
}

export type ReceiptLogStatus = 'sent' | 'skipped' | 'failed';

export interface ReceiptLogRow {
  id: string;
  stripe_event_id: string | null;
  payment_intent_id: string | null;
  product_id: string | null;
  customer_email: string | null;
  amount_cents: number | null;
  currency: string | null;
  provider: string | null;
  status: ReceiptLogStatus;
  http_status: number | null;
  message_id: string | null;
  error: string | null;
  skipped_reason: string | null;
  created_at: string;
  delivery_status: string | null;
  delivered_at: string | null;
  bounced_at: string | null;
  bounce_reason: string | null;
  complained_at: string | null;
  last_event_type: string | null;
  last_event_at: string | null;
}

/** Derive the log status enum from a {@link ReceiptSendResult}. */
function deriveStatus(result: ReceiptSendResult): ReceiptLogStatus {
  if (result.sent) return 'sent';
  if (result.skipped) return 'skipped';
  return 'failed';
}

/**
 * Best-effort insert into `receipt_log`. Never throws — the receipt flow
 * must remain robust to a missing table or auth misconfig (the webhook
 * still needs to return 200 to Stripe).
 */
export async function recordReceiptAttempt(
  payload: PurchaseEvent,
  result: ReceiptSendResult
): Promise<void> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return;
  }
  try {
    const row = {
      stripe_event_id: payload.stripe_event_id ?? null,
      payment_intent_id: payload.payment_intent_id ?? null,
      product_id: payload.product_id ?? null,
      customer_email: payload.customer_email ?? null,
      amount_cents: payload.amount_cents ?? null,
      currency: payload.currency ?? null,
      provider: result.provider ?? null,
      status: deriveStatus(result),
      http_status: result.status ?? null,
      message_id: result.messageId ?? null,
      error: result.error ?? null,
      skipped_reason: result.skipped ?? null
    };
    const { error } = await (getSupabase() as any)
      .from('receipt_log')
      .insert(row);
    if (error) {
      console.error('recordReceiptAttempt insert failed:', error.message);
    }
  } catch (err) {
    console.error('recordReceiptAttempt threw:', err);
  }
}

export interface ReceiptLogFilters {
  status?: ReceiptLogStatus | null;
  /** Substring match against customer_email (case-insensitive). */
  email?: string | null;
}

/**
 * Fetch the most recent N audit-log rows. Returns [] on missing env / table.
 */
export async function getRecentReceiptLog(
  limit = 100,
  filters: ReceiptLogFilters = {}
): Promise<ReceiptLogRow[]> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return [];
  }
  try {
    let q = (getSupabase() as any)
      .from('receipt_log')
      .select(
        'id, stripe_event_id, payment_intent_id, product_id, customer_email, amount_cents, currency, provider, status, http_status, message_id, error, skipped_reason, created_at, delivery_status, delivered_at, bounced_at, bounce_reason, complained_at, last_event_type, last_event_at'
      )
      .order('created_at', { ascending: false })
      .limit(limit);
    if (filters.status) q = q.eq('status', filters.status);
    if (filters.email?.trim()) {
      q = q.ilike('customer_email', `%${filters.email.trim()}%`);
    }
    const { data, error } = await q;
    if (error) {
      console.error('getRecentReceiptLog failed:', error.message);
      return [];
    }
    return (data as ReceiptLogRow[] | null) ?? [];
  } catch (err) {
    console.error('getRecentReceiptLog threw:', err);
    return [];
  }
}

export interface ReceiptLogTotals {
  sent: number;
  skipped: number;
  failed: number;
}

/** Roll up a batch of log rows into totals. Pure / safe for tests. */
export function rollupReceiptLog(rows: ReceiptLogRow[]): ReceiptLogTotals {
  const totals: ReceiptLogTotals = { sent: 0, skipped: 0, failed: 0 };
  for (const r of rows) totals[r.status] += 1;
  return totals;
}

/** Default retention window when RECEIPT_LOG_RETENTION_DAYS is unset / invalid. */
export const DEFAULT_RECEIPT_LOG_RETENTION_DAYS = 90;

export function getReceiptLogRetentionDays(): number {
  const raw = process.env.RECEIPT_LOG_RETENTION_DAYS;
  if (!raw) return DEFAULT_RECEIPT_LOG_RETENTION_DAYS;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_RECEIPT_LOG_RETENTION_DAYS;
  return n;
}

/** Compute the ISO cutoff for a retention window in days, relative to `now`. */
export function computeRetentionCutoff(
  retentionDays: number,
  now: Date = new Date()
): string {
  const cutoff = new Date(now.getTime() - retentionDays * 86_400_000);
  return cutoff.toISOString();
}

export interface PurgeReceiptLogResult {
  ok: boolean;
  retentionDays: number;
  cutoff: string;
  deleted: number;
  skipped?: string;
  error?: string;
}

/**
 * Delete `receipt_log` rows older than the configured retention window.
 * Never throws — returns a structured result so callers (cron + admin UI)
 * can surface what happened. Returns `skipped` when env is missing.
 */
export async function purgeReceiptLog(
  retentionDays: number = getReceiptLogRetentionDays(),
  now: Date = new Date()
): Promise<PurgeReceiptLogResult> {
  const cutoff = computeRetentionCutoff(retentionDays, now);
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return {
      ok: false,
      retentionDays,
      cutoff,
      deleted: 0,
      skipped: 'supabase env not configured'
    };
  }
  try {
    const { data, error } = await (getSupabase() as any)
      .from('receipt_log')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff)
      .select('id');
    if (error) {
      return {
        ok: false,
        retentionDays,
        cutoff,
        deleted: 0,
        error: error.message
      };
    }
    return {
      ok: true,
      retentionDays,
      cutoff,
      deleted: Array.isArray(data) ? data.length : 0
    };
  } catch (err) {
    return {
      ok: false,
      retentionDays,
      cutoff,
      deleted: 0,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

export interface ApplyDeliveryPatchResult {
  ok: boolean;
  matched: boolean;
  skipped?: string;
  error?: string;
}

/**
 * Patch a receipt_log row keyed by Resend's `message_id`. Used by the
 * resend-webhook ingest route. Returns `matched: false` when no row exists
 * (e.g. event arrived before the send was logged, or for an unrelated id).
 */
export async function applyDeliveryPatch(
  messageId: string,
  patch: Record<string, unknown>
): Promise<ApplyDeliveryPatchResult> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return { ok: false, matched: false, skipped: 'supabase env not configured' };
  }
  if (!messageId) {
    return { ok: false, matched: false, skipped: 'missing message_id' };
  }
  try {
    const { data, error } = await (getSupabase() as any)
      .from('receipt_log')
      .update(patch)
      .eq('message_id', messageId)
      .select('id');
    if (error) {
      return { ok: false, matched: false, error: error.message };
    }
    return { ok: true, matched: Array.isArray(data) && data.length > 0 };
  } catch (err) {
    return {
      ok: false,
      matched: false,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

export interface ResendWebhookHealth {
  /** Most recent attempt to send a receipt, regardless of provider response. */
  lastSendAt: string | null;
  /** Most recent inbound webhook event, derived from `last_event_at`. */
  lastEventAt: string | null;
  /** What the most recent webhook event was (delivered, bounced, ...). */
  lastEventType: string | null;
  /** Receipt sends recorded in the last 7d (any provider). */
  sent7d: number;
  /** Receipts confirmed delivered by Resend in the last 7d. */
  delivered7d: number;
  /** Receipts marked bounced by Resend in the last 7d. */
  bounced7d: number;
  /** Receipts marked as a spam complaint by Resend in the last 7d. */
  complained7d: number;
  /** Sent rows in the last 7d that haven't received any webhook event yet. */
  awaiting7d: number;
  /** bounced / sent (in [0,1]) over the window; null when sent7d == 0. */
  bounceRate: number | null;
  /** complained / sent (in [0,1]) over the window; null when sent7d == 0. */
  complaintRate: number | null;
  /** True when env vars or table are missing so the UI can render a stub. */
  configured: boolean;
}

const EMPTY_HEALTH: ResendWebhookHealth = {
  lastSendAt: null,
  lastEventAt: null,
  lastEventType: null,
  sent7d: 0,
  delivered7d: 0,
  bounced7d: 0,
  complained7d: 0,
  awaiting7d: 0,
  bounceRate: null,
  complaintRate: null,
  configured: false
};

/**
 * Inspect `receipt_log` to estimate the health of the Resend webhook ingest:
 * last send + last inbound event timestamps and 7-day delivery / bounce /
 * complaint counts. Best-effort: returns a zero-filled shape on missing env
 * or query errors so the dashboard always renders.
 */
export async function getResendWebhookHealth(
  now: Date = new Date()
): Promise<ResendWebhookHealth> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return EMPTY_HEALTH;
  }
  try {
    const since = new Date(now.getTime() - 7 * 86_400_000).toISOString();
    const client = getSupabase() as any;
    const [recent, lastSendRes, lastEventRes] = await Promise.all([
      client
        .from('receipt_log')
        .select('status, delivery_status')
        .gte('created_at', since)
        .limit(10_000),
      client
        .from('receipt_log')
        .select('created_at')
        .eq('status', 'sent')
        .order('created_at', { ascending: false })
        .limit(1),
      client
        .from('receipt_log')
        .select('last_event_at, last_event_type')
        .not('last_event_at', 'is', null)
        .order('last_event_at', { ascending: false })
        .limit(1)
    ]);
    if (recent.error) {
      console.error('getResendWebhookHealth recent:', recent.error.message);
      return { ...EMPTY_HEALTH, configured: true };
    }
    type R = { status: string; delivery_status: string | null };
    let sent = 0,
      delivered = 0,
      bounced = 0,
      complained = 0,
      awaiting = 0;
    for (const r of (recent.data ?? []) as R[]) {
      if (r.status !== 'sent') continue;
      sent += 1;
      const ds = r.delivery_status;
      if (ds === 'delivered') delivered += 1;
      else if (ds === 'bounced') bounced += 1;
      else if (ds === 'complained') complained += 1;
      else awaiting += 1;
    }
    const lastSendAt =
      Array.isArray(lastSendRes.data) && lastSendRes.data.length > 0
        ? (lastSendRes.data[0] as { created_at: string }).created_at
        : null;
    const lastEventRow =
      Array.isArray(lastEventRes.data) && lastEventRes.data.length > 0
        ? (lastEventRes.data[0] as {
            last_event_at: string;
            last_event_type: string | null;
          })
        : null;
    return {
      lastSendAt,
      lastEventAt: lastEventRow?.last_event_at ?? null,
      lastEventType: lastEventRow?.last_event_type ?? null,
      sent7d: sent,
      delivered7d: delivered,
      bounced7d: bounced,
      complained7d: complained,
      awaiting7d: awaiting,
      bounceRate: sent > 0 ? bounced / sent : null,
      complaintRate: sent > 0 ? complained / sent : null,
      configured: true
    };
  } catch (err) {
    console.error('getResendWebhookHealth threw:', err);
    return { ...EMPTY_HEALTH, configured: true };
  }
}

export interface ReceiptLogStats {
  total: number | null;
  oldest: string | null;
}

/**
 * Lightweight metadata for the admin view: total row count + oldest timestamp.
 * Both fall back to `null` on missing env / errors so the UI can degrade.
 */
export async function getReceiptLogStats(): Promise<ReceiptLogStats> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return { total: null, oldest: null };
  }
  try {
    const client = getSupabase() as any;
    const [{ count, error: countErr }, { data: oldestRows, error: oldErr }] =
      await Promise.all([
        client
          .from('receipt_log')
          .select('id', { count: 'exact', head: true }),
        client
          .from('receipt_log')
          .select('created_at')
          .order('created_at', { ascending: true })
          .limit(1)
      ]);
    if (countErr) console.error('getReceiptLogStats count:', countErr.message);
    if (oldErr) console.error('getReceiptLogStats oldest:', oldErr.message);
    const oldest =
      Array.isArray(oldestRows) && oldestRows.length > 0
        ? (oldestRows[0] as { created_at: string }).created_at
        : null;
    return {
      total: typeof count === 'number' ? count : null,
      oldest
    };
  } catch (err) {
    console.error('getReceiptLogStats threw:', err);
    return { total: null, oldest: null };
  }
}
