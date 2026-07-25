import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  deleteFunnel,
  duplicateFunnel,
  listFunnelsForAdmin,
  listLeadsForAdmin,
  upsertFunnel,
} from '@/lib/mothermode/optin/store';

import {
  normalizeOptinFooter,
  normalizeOptinOto,
  normalizeOptinPage,
  normalizeOptinThankYou,
  slugifyOptinName,
  toOptinFunnelStatus,
} from '@/lib/mothermode/optin/types';


/**
 * GET: admin-only.
 *   ?leads=1[&funnelId=]  → { success, admin, leads }
 *   default               → { success, admin, items }  (funnels)
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const { searchParams } = new URL(request.url);
  if (searchParams.get('leads') === '1') {
    const funnelId = searchParams.get('funnelId') || undefined;
    const leads = await listLeadsForAdmin({ funnelId });
    return NextResponse.json({ success: true, admin: true, leads });
  }

  const items = await listFunnelsForAdmin();
  return NextResponse.json({ success: true, admin: true, items });
}

/**
 * POST: admin-only save.
 *   { action?: 'save', id?, slug, name, status, offerSlug?, …, optin, oto, thankyou }
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const action = String(body.action ?? 'save');

  if (action === 'duplicate') {
    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }
    try {
      const item = await duplicateFunnel(id, guard.email);
      revalidatePath('/admin/funnels');
      return NextResponse.json({ success: true, admin: true, item });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : 'Duplicate failed' },
        { status: 500 },
      );
    }
  }

  if (action !== 'save') {
    return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
  }


  const name = typeof body.name === 'string' ? body.name.trim() : '';
  let slug = typeof body.slug === 'string' ? body.slug.trim() : '';
  if (!slug && name) slug = slugifyOptinName(name);
  if (!slug) {
    return NextResponse.json(
      { success: false, error: 'slug or name is required' },
      { status: 400 },
    );
  }
  slug = slugifyOptinName(slug);

  try {
    const item = await upsertFunnel({
      id: typeof body.id === 'string' ? body.id : null,
      slug,
      name: name || slug,
      status: toOptinFunnelStatus(body.status),
      offerSlug: typeof body.offerSlug === 'string' ? body.offerSlug.trim() || null : null,
      leadGenSlug: typeof body.leadGenSlug === 'string' ? body.leadGenSlug.trim() || null : null,
      deliverableSlug:
        typeof body.deliverableSlug === 'string' ? body.deliverableSlug.trim() || null : null,
      deliverableKey:
        typeof body.deliverableKey === 'string' ? body.deliverableKey.trim() || null : null,
      emailKitId: typeof body.emailKitId === 'string' ? body.emailKitId.trim() || null : null,
      optin: normalizeOptinPage(body.optin),

      oto: normalizeOptinOto(body.oto),
      thankyou: normalizeOptinThankYou(body.thankyou),
      footer: normalizeOptinFooter(body.footer),
      updatedBy: guard.email,

    });

    revalidatePath('/admin/funnels');
    revalidatePath(`/optin/${item.slug}`);
    revalidatePath(`/optin/${item.slug}/oto`);
    revalidatePath(`/optin/${item.slug}/thank-you`);

    return NextResponse.json({ success: true, admin: true, item });
  } catch (err) {
    console.error('[mothermode-optin] save failed:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Save failed' },
      { status: 500 },
    );
  }
}

/**
 * DELETE: admin-only. ?id=
 */
export async function DELETE(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const id = new URL(request.url).searchParams.get('id');
  if (!id) {
    return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
  }

  try {
    await deleteFunnel(id);
    revalidatePath('/admin/funnels');
    return NextResponse.json({ success: true, admin: true });
  } catch (err) {
    console.error('[mothermode-optin] delete failed:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Delete failed' },
      { status: 500 },
    );
  }
}
