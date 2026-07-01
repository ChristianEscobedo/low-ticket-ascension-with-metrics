/**
 * Email sequence engine. Owns the database side of the re-engagement and
 * coaching-extension sequences: enrolling buyers, exiting them when they
 * convert, and the cron "tick" that sends each due step through the shared
 * Editorial Warm layout + the configured email provider.
 *
 * Posture matches the rest of the email stack: best-effort, never throws into
 * the webhook, silently no-ops when Supabase / the provider are not configured.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { PurchaseEvent } from '@/utils/integrations/dispatch';
import { getURL } from '@/utils/helpers';
import { getEmailProvider } from '../provider';
import { getEmailDelivery } from '@/utils/integrations/runtime-config';
import { renderEmail, type EmailDoc } from '../layout';
import {
  getSequence,
  stepDueAt,
  type SequenceContext,
  type SequenceDefinition,
} from './definitions';

const HOUR_MS = 3600_000;

/** CTA route per sequence (resolved to an absolute url at enrollment time). */
const SEQUENCE_OFFER_PATH: Record<string, string> = {
  upsell_os: 'mothermode/upsell',
  coaching_extension: 'mothermode/upsell-4',
};

let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;
  _supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
  return _supabase;
}

function isConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function firstName(name?: string | null): string {
  const n = (name ?? '').trim().split(/\s+/)[0];
  return n || 'there';
}

function formatDeadline(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

interface ThemedSendResult {
  sent: boolean;
  provider?: string;
  skipped?: string;
  status?: number;
  error?: string;
  messageId?: string;
}

/** Send one themed email through the configured provider (resend/postmark). */
async function sendThemedEmail(
  to: string,
  subject: string,
  doc: EmailDoc
): Promise<ThemedSendResult> {
  const delivery = await getEmailDelivery();
  const from = delivery.from;
  if (!from) return { sent: false, skipped: 'RECEIPT_FROM_EMAIL is not set' };
  const provider = await getEmailProvider();
  if (!provider) return { sent: false, skipped: 'no email provider configured' };

  const subjectPrefix = delivery.subjectPrefix;
  const replyTo = delivery.replyTo;
  const bcc = delivery.bcc;
  const { html, text } = renderEmail(doc);
  try {
    const r = await provider.send({
      from,
      to: [to],
      subject: subjectPrefix ? `${subjectPrefix} ${subject}` : subject,
      html,
      text,
      replyTo,
      bcc: bcc.length > 0 ? bcc : null,
    });
    if (!r.ok) {
      return {
        sent: false,
        provider: provider.name,
        status: r.status,
        error: (r.detail ?? '').slice(0, 200),
      };
    }
    return {
      sent: true,
      provider: provider.name,
      status: r.status,
      messageId: r.messageId,
    };
  } catch (err) {
    return {
      sent: false,
      provider: provider.name,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** True when this buyer already purchased the given product. */
async function hasPurchased(email: string, productId: string): Promise<boolean> {
  try {
    const { data } = await (getSupabase() as any)
      .from('funnel_purchases')
      .select('id')
      .eq('customer_email', email)
      .eq('product_id', productId)
      .eq('status', 'succeeded')
      .limit(1);
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

export interface EnrollArgs {
  sequenceId: string;
  email: string;
  name?: string | null;
  /** Hard close for deadline sequences. Defaults to now + def.windowHours. */
  deadlineAt?: Date | null;
  /** Re-enroll/restart even if a live row already exists (coaching extend). */
  restart?: boolean;
  extraContext?: Record<string, unknown>;
  now?: Date;
}

export interface EnrollResult {
  ok: boolean;
  enrolled: boolean;
  deadlineAt?: string | null;
  reason?: string;
}

/**
 * Create or refresh an enrollment. Existing active rows are left alone unless
 * `restart` is set. Returns enrolled:false (ok:true) when an active row already
 * exists, so callers can stay idempotent on Stripe webhook re-deliveries.
 */
export async function enrollInSequence(args: EnrollArgs): Promise<EnrollResult> {
  if (!isConfigured()) return { ok: false, enrolled: false, reason: 'not configured' };
  const def = getSequence(args.sequenceId);
  if (!def) return { ok: false, enrolled: false, reason: 'unknown sequence' };
  const email = args.email?.trim();
  if (!email) return { ok: false, enrolled: false, reason: 'missing email' };

  const now = args.now ?? new Date();
  const deadlineAt =
    args.deadlineAt ??
    (def.windowHours ? new Date(now.getTime() + def.windowHours * HOUR_MS) : null);
  const offerUrl = getURL(SEQUENCE_OFFER_PATH[def.id] ?? 'mothermode');
  const context: Record<string, unknown> = {
    offerUrl,
    deadlineLabel: deadlineAt ? formatDeadline(deadlineAt) : undefined,
    ...args.extraContext,
  };
  const nextSendAt = stepDueAt(def, 0, now);

  try {
    const db = getSupabase() as any;
    const { data: existing } = await db
      .from('email_sequence_enrollments')
      .select('id, status')
      .eq('sequence_id', def.id)
      .eq('customer_email', email)
      .maybeSingle();

    if (existing && existing.status === 'active' && !args.restart) {
      return { ok: true, enrolled: false, reason: 'already active' };
    }

    const row = {
      sequence_id: def.id,
      customer_email: email,
      customer_name: args.name ?? null,
      target_product_id: def.targetProductId,
      status: 'active',
      current_step: 0,
      context,
      next_send_at: nextSendAt ? nextSendAt.toISOString() : null,
      deadline_at: deadlineAt ? deadlineAt.toISOString() : null,
      enrolled_at: now.toISOString(),
      last_sent_at: null,
      updated_at: now.toISOString(),
    };
    const { error } = await db
      .from('email_sequence_enrollments')
      .upsert(row, { onConflict: 'sequence_id,customer_email' });
    if (error) {
      console.error('enrollInSequence upsert failed:', error.message);
      return { ok: false, enrolled: false, reason: error.message };
    }
    return {
      ok: true,
      enrolled: true,
      deadlineAt: deadlineAt ? deadlineAt.toISOString() : null,
    };
  } catch (err) {
    console.error('enrollInSequence threw:', err);
    return { ok: false, enrolled: false, reason: 'exception' };
  }
}

/** Exit every active enrollment whose target is this product (buyer converted). */
export async function convertSequencesForProduct(
  email: string | null | undefined,
  productId: string | null | undefined,
  now: Date = new Date()
): Promise<void> {
  if (!isConfigured() || !email || !productId) return;
  try {
    const { error } = await (getSupabase() as any)
      .from('email_sequence_enrollments')
      .update({ status: 'converted', next_send_at: null, updated_at: now.toISOString() })
      .eq('customer_email', email)
      .eq('target_product_id', productId)
      .eq('status', 'active');
    if (error) console.error('convertSequencesForProduct failed:', error.message);
  } catch (err) {
    console.error('convertSequencesForProduct threw:', err);
  }
}

/** True for front-end pack purchases (page_type fe, or an mm_ product id). */
function isFrontEndPurchase(payload: PurchaseEvent): boolean {
  return (
    payload.page_type === 'fe' || (payload.product_id ?? '').startsWith('mm_')
  );
}

/**
 * Webhook hook. Exits any sequence this purchase satisfies, then enrolls
 * front-end buyers into the OS re-engagement sequence. Never throws.
 */
export async function enrollOnPurchase(payload: PurchaseEvent): Promise<void> {
  if (!isConfigured()) return;
  const email = payload.customer_email?.trim();
  if (!email) return;
  await convertSequencesForProduct(email, payload.product_id);
  if (isFrontEndPurchase(payload)) {
    await enrollInSequence({
      sequenceId: 'upsell_os',
      email,
      name: payload.customer_name,
      extraContext: { feProduct: payload.product_id ?? null },
    });
  }
}

interface EnrollmentRow {
  id: string;
  sequence_id: string;
  customer_email: string;
  customer_name: string | null;
  target_product_id: string | null;
  current_step: number;
  context: Record<string, unknown> | null;
  deadline_at: string | null;
  enrolled_at: string;
}

export interface TickResult {
  ok: boolean;
  processed: number;
  sent: number;
  converted: number;
  completed: number;
  failed: number;
  skipped?: string;
  error?: string;
}

const DEFAULT_BATCH = 50;
function batchSize(): number {
  const raw = Number.parseInt(process.env.EMAIL_SEQUENCE_BATCH_SIZE ?? '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_BATCH;
}

async function setStatus(id: string, status: string, now: Date): Promise<void> {
  await (getSupabase() as any)
    .from('email_sequence_enrollments')
    .update({ status, next_send_at: null, updated_at: now.toISOString() })
    .eq('id', id);
}

async function logSend(
  row: EnrollmentRow,
  stepIndex: number,
  result: ThemedSendResult
): Promise<void> {
  try {
    await (getSupabase() as any).from('email_sequence_sends').insert({
      enrollment_id: row.id,
      sequence_id: row.sequence_id,
      step_index: stepIndex,
      customer_email: row.customer_email,
      provider: result.provider ?? null,
      status: result.sent ? 'sent' : result.skipped ? 'skipped' : 'failed',
      message_id: result.messageId ?? null,
      error: result.error ?? null,
    });
  } catch (err) {
    console.error('logSend threw:', err);
  }
}

function contextFor(row: EnrollmentRow): SequenceContext {
  const ctx = row.context ?? {};
  return {
    name: firstName(row.customer_name),
    email: row.customer_email,
    offerUrl: (ctx.offerUrl as string) || getURL('mothermode'),
    deadlineLabel: ctx.deadlineLabel as string | undefined,
  };
}

/**
 * Process every due enrollment: exit converted / expired rows, otherwise send
 * the current step and advance the pointer. Returns a structured summary for
 * the cron route. Never throws.
 */
export async function tickSequences(now: Date = new Date()): Promise<TickResult> {
  const base: TickResult = {
    ok: true,
    processed: 0,
    sent: 0,
    converted: 0,
    completed: 0,
    failed: 0,
  };
  if (!isConfigured()) return { ...base, ok: false, skipped: 'not configured' };

  let rows: EnrollmentRow[] = [];
  try {
    const { data, error } = await (getSupabase() as any)
      .from('email_sequence_enrollments')
      .select(
        'id, sequence_id, customer_email, customer_name, target_product_id, current_step, context, deadline_at, enrolled_at'
      )
      .eq('status', 'active')
      .lte('next_send_at', now.toISOString())
      .order('next_send_at', { ascending: true })
      .limit(batchSize());
    if (error) return { ...base, ok: false, error: error.message };
    rows = (data ?? []) as EnrollmentRow[];
  } catch (err) {
    return { ...base, ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  for (const row of rows) {
    base.processed += 1;
    const def: SequenceDefinition | null = getSequence(row.sequence_id);
    if (!def) {
      await setStatus(row.id, 'completed', now);
      base.completed += 1;
      continue;
    }
    if (
      row.target_product_id &&
      (await hasPurchased(row.customer_email, row.target_product_id))
    ) {
      await setStatus(row.id, 'converted', now);
      base.converted += 1;
      continue;
    }
    if (row.deadline_at && new Date(row.deadline_at) <= now) {
      await setStatus(row.id, 'completed', now);
      base.completed += 1;
      continue;
    }

    const step = def.steps[row.current_step];
    if (!step) {
      await setStatus(row.id, 'completed', now);
      base.completed += 1;
      continue;
    }

    const ctx = contextFor(row);
    const result = await sendThemedEmail(ctx.email, step.subject(ctx), step.build(ctx));
    await logSend(row, row.current_step, result);

    if (result.skipped) {
      // Provider/env not ready: abort the whole tick, leave rows untouched.
      return { ...base, ok: false, skipped: result.skipped };
    }
    if (!result.sent) {
      base.failed += 1;
      continue; // leave row in place to retry on the next tick
    }

    const nextIndex = row.current_step + 1;
    const nextDue = stepDueAt(def, nextIndex, new Date(row.enrolled_at));
    await (getSupabase() as any)
      .from('email_sequence_enrollments')
      .update({
        current_step: nextIndex,
        next_send_at: nextDue ? nextDue.toISOString() : null,
        status: nextDue ? 'active' : 'completed',
        last_sent_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', row.id);
    base.sent += 1;
    if (!nextDue) base.completed += 1;
  }

  return base;
}
