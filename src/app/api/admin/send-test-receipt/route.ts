import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import { sendPurchaseReceipt } from '@/utils/email/receipt';
import type { PurchaseEvent } from '@/utils/integrations/dispatch';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST { email, draft? } — send a synthetic purchase receipt to a chosen
 * address through the currently-configured email provider. Admin-only.
 * When `draft` (subject + body_html + body_text) is supplied, the unsaved
 * template is used instead of the stored copy — drives the editor preview-
 * send button.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const body = await request.json().catch(() => null);
  const email = (body?.email as string | undefined)?.trim();
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { success: false, error: 'A valid email address is required' },
      { status: 400 }
    );
  }

  // Optional unsaved-draft override from the template editor.
  let overrideTemplate: {
    subject: string;
    body_html: string;
    body_text: string;
  } | null = null;
  const draft = body?.draft;
  if (draft && typeof draft === 'object') {
    const subject = typeof draft.subject === 'string' ? draft.subject.trim() : '';
    const html = typeof draft.body_html === 'string' ? draft.body_html : '';
    const text = typeof draft.body_text === 'string' ? draft.body_text : '';
    if (!subject || !html.trim() || !text.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: 'draft.subject, draft.body_html and draft.body_text are all required'
        },
        { status: 400 }
      );
    }
    overrideTemplate = { subject, body_html: html, body_text: text };
  }

  const payload: PurchaseEvent = {
    stripe_event_id: `evt_test_${Date.now()}`,
    payment_intent_id: `pi_test_${Date.now()}`,
    product_id: 'prod_test_receipt',
    page_type: 'fe',
    amount_cents: 2700,
    currency: 'usd',
    customer_email: email,
    customer_name: 'Test Buyer'
  };

  const result = await sendPurchaseReceipt(payload, {
    overrideTemplate,
    skipAuditLog: !!overrideTemplate
  });
  if (!result.sent) {
    return NextResponse.json(
      {
        success: false,
        provider: result.provider ?? null,
        skipped: result.skipped ?? null,
        status: result.status ?? null,
        error: result.error ?? null
      },
      { status: result.skipped ? 422 : 502 }
    );
  }

  return NextResponse.json({
    success: true,
    provider: result.provider,
    status: result.status ?? 200,
    to: email
  });
}
