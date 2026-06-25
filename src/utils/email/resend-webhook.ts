import crypto from 'crypto';

/**
 * Resend ships webhooks through Svix. The signing scheme is:
 *
 *   signed_payload = `${svix_id}.${svix_timestamp}.${rawBody}`
 *   signature      = base64( hmac_sha256(secret_bytes, signed_payload) )
 *
 * The webhook secret in the Resend dashboard is shown as `whsec_<base64>`.
 * We strip the prefix and base64-decode to get the raw key bytes Svix uses.
 *
 * The `svix-signature` header is a space-separated list of `vN,<sig>` pairs
 * (rotation-friendly). Treat the request as authentic if ANY v1 entry matches.
 */
export function verifyResendWebhook(opts: {
  secret: string;
  svixId: string | null;
  svixTimestamp: string | null;
  svixSignature: string | null;
  rawBody: string;
  /** Allow ± toleranceSeconds of clock drift. Default 5 minutes. */
  toleranceSeconds?: number;
  now?: number;
}): { ok: boolean; reason?: string } {
  const {
    secret,
    svixId,
    svixTimestamp,
    svixSignature,
    rawBody,
    toleranceSeconds = 300,
    now = Math.floor(Date.now() / 1000)
  } = opts;

  if (!secret) return { ok: false, reason: 'missing secret' };
  if (!svixId || !svixTimestamp || !svixSignature) {
    return { ok: false, reason: 'missing svix headers' };
  }

  const ts = Number.parseInt(svixTimestamp, 10);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'bad svix-timestamp' };
  if (Math.abs(now - ts) > toleranceSeconds) {
    return { ok: false, reason: 'timestamp outside tolerance' };
  }

  const keyMaterial = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  let keyBytes: Buffer;
  try {
    keyBytes = Buffer.from(keyMaterial, 'base64');
  } catch {
    return { ok: false, reason: 'bad secret encoding' };
  }
  if (keyBytes.length === 0) return { ok: false, reason: 'empty secret' };

  const signed = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expected = crypto
    .createHmac('sha256', keyBytes)
    .update(signed)
    .digest('base64');

  const candidates = svixSignature
    .split(' ')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s.startsWith('v1,'))
    .map((s) => s.slice(3));

  for (const candidate of candidates) {
    if (
      candidate.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(expected))
    ) {
      return { ok: true };
    }
  }
  return { ok: false, reason: 'no matching signature' };
}

export type ResendEventType =
  | 'email.sent'
  | 'email.delivered'
  | 'email.delivery_delayed'
  | 'email.bounced'
  | 'email.complained'
  | 'email.opened'
  | 'email.clicked'
  | 'email.failed';

export interface ResendWebhookEvent {
  type: ResendEventType | string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    bounce?: { message?: string } | null;
    [k: string]: unknown;
  };
}

export interface ReceiptLogDeliveryPatch {
  delivery_status?: string;
  delivered_at?: string;
  bounced_at?: string;
  bounce_reason?: string | null;
  complained_at?: string;
  last_event_type: string;
  last_event_at: string;
}

/**
 * Project a Resend event into a partial column update for receipt_log.
 * Returns null for events we don't track (so the route can early-return 202).
 */
export function projectResendEvent(
  evt: ResendWebhookEvent
): ReceiptLogDeliveryPatch | null {
  const at = evt.created_at ?? new Date().toISOString();
  const base: ReceiptLogDeliveryPatch = {
    last_event_type: evt.type,
    last_event_at: at
  };
  switch (evt.type) {
    case 'email.delivered':
      return { ...base, delivery_status: 'delivered', delivered_at: at };
    case 'email.bounced':
      return {
        ...base,
        delivery_status: 'bounced',
        bounced_at: at,
        bounce_reason: evt.data?.bounce?.message ?? null
      };
    case 'email.complained':
      return { ...base, delivery_status: 'complained', complained_at: at };
    case 'email.opened':
      return { ...base, delivery_status: 'opened' };
    case 'email.clicked':
      return { ...base, delivery_status: 'clicked' };
    case 'email.failed':
      return {
        ...base,
        delivery_status: 'failed',
        bounce_reason: (evt.data as any)?.failed?.reason ?? null
      };
    case 'email.delivery_delayed':
      return { ...base, delivery_status: 'delayed' };
    case 'email.sent':
      return { ...base, delivery_status: 'sent' };
    default:
      return null;
  }
}
