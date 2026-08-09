import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  deleteAssignment,
  listAllAssignments,
  listAssignmentsForFunnel,
  listAssignmentsForProduct,
  toAssignmentRole,
  toAssignmentStep,
  toDeliveryType,
  upsertAssignment,
} from '@/lib/mothermode/sales/productAssignments';
import { getProductsWithPrices } from '@/utils/supabase/admin';

/**
 * Admin API for product ↔ funnel assignments and the product picker.
 *
 *   GET    /api/admin/funnel-products                  → { products, assignments }
 *   GET    /api/admin/funnel-products?funnel=slug      → { assignments }
 *   GET    /api/admin/funnel-products?product=prod_..  → { assignments }
 *   POST   /api/admin/funnel-products { action: 'save', ...assignment }
 *   DELETE /api/admin/funnel-products?id=...
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const url = new URL(request.url);
  const funnel = url.searchParams.get('funnel');
  const product = url.searchParams.get('product');

  if (funnel) {
    const assignments = await listAssignmentsForFunnel(funnel);
    return NextResponse.json({ success: true, assignments });
  }
  if (product) {
    const assignments = await listAssignmentsForProduct(product);
    return NextResponse.json({ success: true, assignments });
  }

  const [products, assignments] = await Promise.all([
    getProductsWithPrices().catch(() => []),
    listAllAssignments(),
  ]);
  return NextResponse.json({ success: true, products, assignments });
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

  const productId = String(body.productId ?? '').trim();
  const funnelSlug = String(body.funnelSlug ?? '').trim();
  if (!productId || !funnelSlug) {
    return NextResponse.json(
      { success: false, error: 'productId and funnelSlug are required' },
      { status: 400 },
    );
  }

  try {
    const item = await upsertAssignment({
      id: (body.id as string | null | undefined) || null,
      productId,
      priceId: (body.priceId as string) || null,
      funnelSlug,
      step: toAssignmentStep(body.step),
      role: toAssignmentRole(body.role),
      deliveryType: toDeliveryType(body.deliveryType),
      delivery: (body.delivery as Record<string, unknown>) ?? {},
    });
    return NextResponse.json({ success: true, item });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Save failed' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const id = new URL(request.url).searchParams.get('id');
  if (!id) {
    return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
  }
  try {
    await deleteAssignment(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Delete failed' },
      { status: 500 },
    );
  }
}
