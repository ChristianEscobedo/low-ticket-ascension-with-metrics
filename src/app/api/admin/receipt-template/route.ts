import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  deleteReceiptTemplate,
  upsertReceiptTemplate
} from '@/utils/email/templates';

/**
 * POST { subject, body_html, body_text } — admin-only upsert of the default
 * receipt template. The receipt sender prefers this stored copy over its
 * hardcoded fallback whenever the row is present.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const body = await request.json().catch(() => null);
  const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
  const html = typeof body?.body_html === 'string' ? body.body_html : '';
  const text = typeof body?.body_text === 'string' ? body.body_text : '';
  const productId =
    typeof body?.product_id === 'string' && body.product_id.trim()
      ? body.product_id.trim()
      : null;

  if (!subject || !html.trim() || !text.trim()) {
    return NextResponse.json(
      { success: false, error: 'subject, body_html and body_text are all required' },
      { status: 400 }
    );
  }

  try {
    await upsertReceiptTemplate({
      subject,
      body_html: html,
      body_text: text,
      product_id: productId,
      updated_by: guard.email
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[receipt-template] Save failed:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Save failed'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE { product_id?: string } — admin-only removal of a stored template.
 * Sending a product_id wipes that product's override and lets it fall back to
 * the default; omitting it (or sending null) deletes the default row itself.
 */
export async function DELETE(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const body = await request.json().catch(() => null);
  const productId =
    typeof body?.product_id === 'string' && body.product_id.trim()
      ? body.product_id.trim()
      : null;

  try {
    await deleteReceiptTemplate(productId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[receipt-template] Delete failed:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Delete failed'
      },
      { status: 500 }
    );
  }
}
