import type { PurchaseEvent } from '@/utils/integrations/dispatch';
import { getEmailProvider } from './provider';
import { recordReceiptAttempt } from './receipt-log';
import {
  buildReceiptTokens,
  getReceiptTemplate,
  renderTemplate
} from './templates';

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

const formatAmount = (cents: number, currency: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: (currency || 'usd').toUpperCase(),
    minimumFractionDigits: 2
  }).format((cents || 0) / 100);

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

interface BrandOptions {
  brandName: string | null;
  subjectPrefix: string | null;
}

const buildSubject = (payload: PurchaseEvent, opts: BrandOptions) => {
  const amount = formatAmount(payload.amount_cents, payload.currency);
  const core = opts.brandName
    ? `Your ${opts.brandName} receipt — ${amount}`
    : `Your receipt — ${amount}`;
  return opts.subjectPrefix ? `${opts.subjectPrefix} ${core}` : core;
};

const buildHtml = (payload: PurchaseEvent, opts: BrandOptions) => {
  const amount = formatAmount(payload.amount_cents, payload.currency);
  const product = payload.product_id ? escapeHtml(payload.product_id) : '—';
  const ref = escapeHtml(
    payload.payment_intent_id || payload.checkout_session_id || payload.stripe_event_id
  );
  const name = payload.customer_name
    ? escapeHtml(payload.customer_name.split(/\s+/)[0])
    : 'there';
  const brand = opts.brandName ? escapeHtml(opts.brandName) : '';
  const eyebrow = brand
    ? `<div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#fbbf24;margin:0 0 8px;font-weight:600">${brand}</div>`
    : '';
  const signoff = brand
    ? `— The ${brand} team`
    : 'If anything looks off, just reply to this email.';
  return `<!doctype html><html><body style="font-family:system-ui,Segoe UI,Arial,sans-serif;background:#000;color:#fff;padding:24px;margin:0">
  <div style="max-width:560px;margin:0 auto;background:#0a0a0a;border:1px solid rgba(251,191,36,0.2);border-radius:16px;padding:24px">
    ${eyebrow}<h1 style="font-size:18px;font-weight:600;color:#fbbf24;margin:0 0 16px">Payment received</h1>
    <p style="margin:0 0 12px;color:rgba(255,255,255,0.8)">Hi ${name}, thanks for your purchase. Here's your receipt for your records.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:6px 0;color:rgba(255,255,255,0.5)">Amount</td><td style="padding:6px 0;text-align:right">${amount}</td></tr>
      <tr><td style="padding:6px 0;color:rgba(255,255,255,0.5)">Product</td><td style="padding:6px 0;text-align:right">${product}</td></tr>
      <tr><td style="padding:6px 0;color:rgba(255,255,255,0.5)">Reference</td><td style="padding:6px 0;text-align:right;font-family:monospace;font-size:12px">${ref}</td></tr>
    </table>
    <p style="margin:24px 0 0;font-size:12px;color:rgba(255,255,255,0.4)">${signoff}</p>
  </div>
</body></html>`;
};

const buildText = (payload: PurchaseEvent, opts: BrandOptions) => {
  const amount = formatAmount(payload.amount_cents, payload.currency);
  const product = payload.product_id || '—';
  const ref =
    payload.payment_intent_id || payload.checkout_session_id || payload.stripe_event_id;
  const signoff = opts.brandName
    ? `— The ${opts.brandName} team`
    : 'If anything looks off, just reply to this email.';
  return [
    'Payment received',
    '',
    `Amount: ${amount}`,
    `Product: ${product}`,
    `Reference: ${ref}`,
    '',
    signoff
  ].join('\n');
};

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
  const from = process.env.RECEIPT_FROM_EMAIL;
  if (!from) return { sent: false, skipped: 'RECEIPT_FROM_EMAIL is not set' };
  if (!payload.customer_email) {
    return { sent: false, skipped: 'payload has no customer_email' };
  }

  const provider = getEmailProvider();
  if (!provider) {
    return {
      sent: false,
      skipped: 'no email provider configured (check RECEIPT_PROVIDER + credentials)'
    };
  }

  const opts: BrandOptions = {
    brandName: process.env.RECEIPT_BRAND_NAME?.trim() || null,
    subjectPrefix: process.env.RECEIPT_SUBJECT_PREFIX?.trim() || null
  };
  const replyTo = process.env.RECEIPT_REPLY_TO?.trim() || null;
  // RECEIPT_BCC is a comma-separated allowlist of addresses BCC'd on every
  // receipt — typically a GHL contact-ingest inbox for unified comms history.
  const bcc = (process.env.RECEIPT_BCC ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Prefer an explicit override (editor preview), then an admin-edited DB
  // template, then hardcoded copy.
  const template =
    options.overrideTemplate ??
    (await getReceiptTemplate(payload.product_id));
  let subject: string;
  let html: string;
  let text: string;
  if (template) {
    const tokens = buildReceiptTokens(payload, { brandName: opts.brandName });
    const renderedSubject = renderTemplate(template.subject, tokens);
    subject = opts.subjectPrefix
      ? `${opts.subjectPrefix} ${renderedSubject}`
      : renderedSubject;
    html = renderTemplate(template.body_html, tokens, { escapeHtml: true });
    text = renderTemplate(template.body_text, tokens);
  } else {
    subject = buildSubject(payload, opts);
    html = buildHtml(payload, opts);
    text = buildText(payload, opts);
  }

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
