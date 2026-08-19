import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  deleteFunnel,
  duplicateFunnel,
  listFunnelsForAdmin,
  listLeadsForAdmin,
  setFunnelStatus,
  upsertFunnel,
} from '@/lib/mothermode/sales/store';
import { toSalesFunnelStatus } from '@/lib/mothermode/sales/types';

/**
 * Admin CRUD for MotherMode Sales Funnels.
 *
 *   GET  /api/admin/mothermode-sales            â†’ { funnels }
 *   GET  /api/admin/mothermode-sales?leads=1    â†’ { leads }
 *   POST /api/admin/mothermode-sales  { action: 'save', ... }     â†’ { item }
 *   POST /api/admin/mothermode-sales  { action: 'duplicate', id } â†’ { item }
 *   DELETE /api/admin/mothermode-sales?id=...                    â†’ { success }
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const url = new URL(request.url);
  const leadsParam = url.searchParams.get('leads');
  const funnelId = url.searchParams.get('funnelId') || undefined;

  if (leadsParam === '1') {
    const leads = await listLeadsForAdmin({ funnelId });
    return NextResponse.json({ success: true, leads });
  }

  const funnels = await listFunnelsForAdmin();
  return NextResponse.json({ success: true, funnels });
}

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

  try {
    // Publish/unpublish — a status-only flip (never the upsert, which would
    // clobber the content). The System Map's "Publish this funnel" calls this.
    if (action === 'publish') {
      const id = String(body.id ?? '');
      if (!id) {
        return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
      }
      await setFunnelStatus(id, 'published');
      return NextResponse.json({ success: true });
    }

    if (action === 'duplicate') {
      const id = String(body.id ?? '');
      if (!id) {
        return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
      }
      const item = await duplicateFunnel(id, guard.email);
      return NextResponse.json({ success: true, item });
    }

    // action === 'save'
    const id = (body.id as string | null | undefined) || null;
    const slug = String(body.slug ?? '').trim();
    const name = String(body.name ?? '').trim();
    if (!slug) {
      return NextResponse.json({ success: false, error: 'Slug is required' }, { status: 400 });
    }

    const item = await upsertFunnel({
      id,
      slug,
      name,
      status: toSalesFunnelStatus(body.status),
      offerSlug: (body.offerSlug as string) || null,
      leadGenSlug: (body.leadGenSlug as string) || null,
      deliverableSlug: (body.deliverableSlug as string) || null,
      deliverableKey: (body.deliverableKey as string) || null,
      emailKitId: (body.emailKitId as string) || null,
      emailKits: Array.isArray(body.emailKits) ? (body.emailKits as any) : [],
      productId: (body.productId as string) || null,
      optin: body.optin as any,
      sales: body.sales as any,
      vsl: body.vsl as any,
      checkout: body.checkout as any,
      upsell1: body.upsell1 as any,
      upsell2: body.upsell2 as any,
      upsell3: body.upsell3 as any,
      upsell4: body.upsell4 as any,
      success: (body.success ?? body.successBlock) as any,

      access: body.access as any,
      footer: body.footer as any,
      // The per-funnel test/live toggle. A boolean writes it; absent preserves it.
      testMode: typeof body.testMode === 'boolean' ? body.testMode : undefined,
      updatedBy: guard.email,
    });

    return NextResponse.json({ success: true, item });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Save failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
  }

  try {
    await deleteFunnel(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}