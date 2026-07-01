import type { PurchaseEvent } from '@/utils/integrations/dispatch';
import { getEmailProvider } from './provider';
import { getEmailDelivery } from '@/utils/integrations/runtime-config';
import { recordReceiptAttempt } from './receipt-log';
import {
  buildReceiptTokens,
  getReceiptTemplate,
  renderTemplate
} from './templates';
import { DEFAULT_RECEIPT_TEMPLATE } from './defaults';
import { getOfferEmailTemplate } from './offer-emails';

// Best-effort transactional receipt for funnel purchases. Same posture as
// dispatchPurchase: never throws, silently no-ops when not configured, errors
// are logged so Stripe still gets a clean 200 from the webhook.
//
// Provider selection is driven by RECEIPT_PROVIDER (default: "resend").
// Currently supported: "resend", "postmark". Configure with:
//   RESEND_API_KEY          — Resend API key (re_...)                    required for resend
//   POSTMARK_API_TOKEN      — Postmark server token                      required for postmark
//   RECEIPT_POSTMARK_STREAM — Postmark message stream slug (postmark only) optional, default "outbound"
//   RECEIPT_FROM_EMAIL      — verified From address ("Brand <noreply@x>") required
//   RECEIPT_BRAND_NAME      — brand shown in the subject + signoff       optional
//   RECEIPT_SUBJECT_PREFIX  — prefixed to every subject line             optional
//   RECEIPT_REPLY_TO        — Reply-To header on the outbound email      optional
//   RECEIPT_BCC             — comma-separated BCC list (e.g. GHL inbox)  optional
// Leave the provider credential or RECEIPT_FROM_EMAIL unset to disable receipts entirely.

// Receipt rendering now flows entirely through the shared template pipeline
// (templates.ts + render.ts) and the Editorial Warm layout. See the template
// selection block in sendPurchaseReceiptInner below.

interface BrandOptions {
  brandName: string | null;
  subjectPrefix: string | null;
}

export interface ReceiptSendResult {
  /** True only when the provider returned a 2xx. */
  sent: boolean;
  /** Provider name actually used (resend / postmark / ...) when one was selected. */
  provider?: string;
  /** Human-readable reason a no-op happened (missing env, no recipient, etc.). */
  skipped?: string;
  /** Provider-side HTTP status when the call was attempted. */
  status?: number;
  /** Provider-side error detail when the call failed. */
  error?: string;
  /** Provider-assigned message id when the send succeeded. */
  messageId?: string;
}

export interface SendPurchaseReceiptOptions {
  /**
   * When provided, render using this template (subject + bodies) instead of
   * looking one up from the DB. Used by the admin editor "Send test" flow so
   * unsaved drafts can be previewed in a real email without persisting them.
   */
  overrideTemplate?: {
    subject: string;
    body_html: string;
    body_text: string;
  } | null;
  /** Skip the receipt_log insert. Useful for the editor's send-test flow. */
  skipAuditLog?: boolean;
}

export async function sendPurchaseReceipt(
  payload: PurchaseEvent,
  options: SendPurchaseReceiptOptions = {}
): Promise<ReceiptSendResult> {
  const result = await sendPurchaseReceiptInner(payload, options);
  // Best-effort audit log. Never blocks / throws — receipt sending and
  // the surrounding webhook must remain robust to logging failures.
  if (!options.skipAuditLog) {
    await recordReceiptAttempt(payload, result);
  }
  return result;
}

async function sendPurchaseReceiptInner(
  payload: PurchaseEvent,
  options: SendPurchaseReceiptOptions
): Promise<ReceiptSendResult> {
  // Delivery identity (from / reply-to / subject prefix / bcc) resolves
  // DB-first (enabled `email` integration) then RECEIPT_* env fallback.
  const delivery = await getEmailDelivery();
  const from = delivery.from;
  if (!from) return { sent: false, skipped: 'RECEIPT_FROM_EMAIL is not set' };
  if (!payload.customer_email) {
    return { sent: false, skipped: 'payload has no customer_email' };
  }

  const provider = await getEmailProvider();
  if (!provider) {
    return {
      sent: false,
      skipped: 'no email provider configured (check RECEIPT_PROVIDER + credentials)'
    };
  }

  const opts: BrandOptions = {
    brandName: process.env.RECEIPT_BRAND_NAME?.trim() || null,
    subjectPrefix: delivery.subjectPrefix
  };
  const replyTo = delivery.replyTo;
  // BCC allowlist of addresses copied on every receipt — typically a GHL
  // contact-ingest inbox for unified comms history.
  const bcc = delivery.bcc;

  // Template selection, most specific first:
  //   1. explicit override (admin editor "send test")
  //   2. admin-edited DB template (product-specific, then global default)
  //   3. code-keyed per-offer email (./offer-emails)
  //   4. themed default receipt (./defaults)
  // Every branch is a {subject, body_html, body_text} carrying {{tokens}}, so
  // they all flow through the same render pipeline below.
  const template =
    options.overrideTemplate ??
    (await getReceiptTemplate(payload.product_id)) ??
    getOfferEmailTemplate(payload.product_id) ??
    DEFAULT_RECEIPT_TEMPLATE;

  const tokens = buildReceiptTokens(payload, { brandName: opts.brandName });
  const renderedSubject = renderTemplate(template.subject, tokens);
  const subject = opts.subjectPrefix
    ? `${opts.subjectPrefix} ${renderedSubject}`
    : renderedSubject;
  const html = renderTemplate(template.body_html, tokens, { escapeHtml: true });
  const text = renderTemplate(template.body_text, tokens);

  try {
    const result = await provider.send({
      from,
      to: [payload.customer_email],
      subject,
      html,
      text,
      replyTo,
      bcc: bcc.length > 0 ? bcc : null
    });
    if (!result.ok) {
      console.error(
        `sendPurchaseReceipt: ${provider.name} ${result.status ?? 'error'}`,
        (result.detail ?? '').slice(0, 200)
      );
      return {
        sent: false,
        provider: provider.name,
        status: result.status,
        error: (result.detail ?? '').slice(0, 200)
      };
    }
    return {
      sent: true,
      provider: provider.name,
      status: result.status,
      messageId: result.messageId
    };
  } catch (err) {
    console.error('sendPurchaseReceipt: send failed', err);
    return {
      sent: false,
      provider: provider.name,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}
