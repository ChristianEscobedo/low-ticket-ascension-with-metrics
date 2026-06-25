import { NextRequest, NextResponse } from 'next/server';
import { applyDeliveryPatch } from '@/utils/email/receipt-log';
import {
  projectResendEvent,
  verifyResendWebhook,
  type ResendWebhookEvent
} from '@/utils/email/resend-webhook';

export const dynamic = 'force-dynamic';

/**
 * Inbound webhook from Resend (Svix-signed). Maps delivery events back onto
 * the originating row in `receipt_log` via Resend's email id (which we
 * captured as `message_id` when sending). Always returns 200 once a payload
 * is parsed — Svix retries on non-2xx, and we never want to thrash on rows
 * we don't yet have (e.g. event arrives before the send is logged).
 */
export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: 'RESEND_WEBHOOK_SECRET not configured' },
      { status: 503 }
    );
  }

  const rawBody = await request.text();
  const verification = verifyResendWebhook({
    secret,
    svixId: request.headers.get('svix-id'),
    svixTimestamp: request.headers.get('svix-timestamp'),
    svixSignature: request.headers.get('svix-signature'),
    rawBody
  });
  if (!verification.ok) {
    return NextResponse.json(
      { ok: false, error: verification.reason ?? 'invalid signature' },
      { status: 401 }
    );
  }

  let evt: ResendWebhookEvent;
  try {
    evt = JSON.parse(rawBody) as ResendWebhookEvent;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid json' },
      { status: 400 }
    );
  }

  const messageId = evt?.data?.email_id;
  if (!messageId) {
    return NextResponse.json(
      { ok: true, ignored: 'no email_id' },
      { status: 200 }
    );
  }

  const patch = projectResendEvent(evt);
  if (!patch) {
    return NextResponse.json(
      { ok: true, ignored: `untracked event ${evt.type}` },
      { status: 200 }
    );
  }

  const result = await applyDeliveryPatch(
    messageId,
    patch as unknown as Record<string, unknown>
  );
  return NextResponse.json(
    {
      ok: true,
      type: evt.type,
      message_id: messageId,
      matched: result.matched,
      skipped: result.skipped ?? null,
      error: result.error ?? null
    },
    { status: 200 }
  );
}
