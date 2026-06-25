import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * POST: Batch update course sort_order values.
 * Body: { orders: [{ id: string, sort_order: number }] }
 */
export async function POST(request: Request) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const body = await request.json();
    const { orders } = body as {
      orders: { id: string; sort_order: number }[];
    };

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return NextResponse.json(
        { success: false, error: 'orders array is required' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const updates = orders.map((o) =>
      (supabase as any)
        .from('courses')
        .update({ sort_order: o.sort_order, updated_at: now })
        .eq('id', o.id)
    );

    const results = await Promise.all(updates);
    const errors = results.filter((r: any) => r.error);

    if (errors.length > 0) {
      console.error(
        '[admin/courses/reorder] Errors:',
        errors.map((e: any) => e.error?.message)
      );
      return NextResponse.json(
        { success: false, error: 'Some updates failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/courses/reorder] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reorder courses' },
      { status: 500 }
    );
  }
}
