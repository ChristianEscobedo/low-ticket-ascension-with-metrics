import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import { buildCustomerReportCsv } from '@/utils/admin/customer-report';
import {
  getCustomerActivity,
  getCustomerById
} from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/customers/[id]/report
 * Streams a single multi-section CSV containing the customer header,
 * subscriptions, purchases, receipt deliveries, CTA clicks and lesson
 * progress — the same data the buyer drawer renders. Admin-only.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const detail = await getCustomerById(params.id);
  if (!detail) {
    return NextResponse.json(
      { success: false, error: 'Customer not found' },
      { status: 404 }
    );
  }

  const activity = await getCustomerActivity(
    detail.user.id,
    detail.user.email || null
  );
  const csv = buildCustomerReportCsv(detail, activity);

  const stamp = new Date().toISOString().slice(0, 10);
  const slug =
    (detail.user.email || detail.user.id)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'customer';
  const filename = `buyer-report-${slug}-${stamp}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store'
    }
  });
}
