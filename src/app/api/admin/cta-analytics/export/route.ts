import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  ctaPerformanceRowsToCsv,
  getTopCtaPerformance
} from '@/utils/courses/cta-analytics';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/admin/cta-analytics/export?from=&to=&course=
 * Returns the same rows as the /admin/cta-analytics page, serialized as CSV
 * with a Content-Disposition attachment header. Admin-only.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const course = searchParams.get('course');

  const rows = await getTopCtaPerformance(10_000, {
    startDate: from && DATE_RE.test(from) ? from : null,
    endDate: to && DATE_RE.test(to) ? to : null,
    courseId: course?.trim() || null
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `cta-analytics-${stamp}.csv`;

  return new NextResponse(ctaPerformanceRowsToCsv(rows), {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store'
    }
  });
}
