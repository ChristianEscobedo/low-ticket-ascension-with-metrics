import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * GET: Search auth users by email substring. Used by admin grant UIs to
 * resolve an email to a user_id before granting course access.
 * Query: ?q=substring  (case-insensitive, returns up to 20)
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim().toLowerCase();

    // Supabase admin listUsers is paginated; we only need a small page for
    // typeahead. Pull one page, filter client-side. Good enough until a
    // dedicated search index is needed.
    const { data, error } = await (supabase as any).auth.admin.listUsers({
      page: 1,
      perPage: 200
    });

    if (error) {
      console.error('[admin/users] listUsers error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to list users' },
        { status: 500 }
      );
    }

    const all = (data?.users || []) as Array<{
      id: string;
      email?: string | null;
      created_at?: string;
      user_metadata?: Record<string, unknown>;
    }>;

    const matched = (q
      ? all.filter((u) => (u.email || '').toLowerCase().includes(q))
      : all
    )
      .slice(0, 20)
      .map((u) => ({
        id: u.id,
        email: u.email || null,
        full_name:
          (u.user_metadata?.full_name as string | undefined) ||
          (u.user_metadata?.name as string | undefined) ||
          null,
        created_at: u.created_at || null
      }));

    return NextResponse.json({ success: true, users: matched });
  } catch (error) {
    console.error('[admin/users] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal error' },
      { status: 500 }
    );
  }
}
