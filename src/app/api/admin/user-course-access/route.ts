import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * GET: Fetch course access rows. Optional ?user_id filter.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    let query = (supabase as any)
      .from('user_course_access')
      .select(
        `id, user_id, course_id, access_type, granted_at, expires_at,
         courses:course_id ( id, title, short_description, is_published )`
      )
      .order('granted_at', { ascending: false });

    if (userId) query = query.eq('user_id', userId);

    const { data, error } = await query;
    if (error) {
      console.error('[user-course-access] GET error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch course access' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, courseAccess: data || [] });
  } catch (error) {
    console.error('[user-course-access] GET Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal error' },
      { status: 500 }
    );
  }
}

/**
 * POST: Grant a course to a user. Idempotent (upsert on user_id+course_id).
 * Body: { user_id, course_id, access_type?, expires_at? }
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const body = await request.json();
    const {
      user_id,
      course_id,
      access_type = 'admin',
      expires_at
    } = body;

    if (!user_id || !course_id) {
      return NextResponse.json(
        { success: false, error: 'user_id and course_id are required' },
        { status: 400 }
      );
    }

    const { data, error } = await (supabase as any)
      .from('user_course_access')
      .upsert(
        {
          user_id,
          course_id,
          access_type,
          granted_at: new Date().toISOString(),
          expires_at: expires_at || null
        },
        { onConflict: 'user_id,course_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('[user-course-access] POST error:', error);
      return NextResponse.json(
        { success: false, error: `Failed to grant access: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, access: data });
  } catch (error) {
    console.error('[user-course-access] POST Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Revoke a course grant by ?id=... or ?user_id=...&course_id=...
 */
export async function DELETE(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('user_id');
    const courseId = searchParams.get('course_id');

    if (!id && !(userId && courseId)) {
      return NextResponse.json(
        { success: false, error: 'id or (user_id + course_id) required' },
        { status: 400 }
      );
    }

    let query = (supabase as any).from('user_course_access').delete();
    if (id) query = query.eq('id', id);
    else query = query.eq('user_id', userId!).eq('course_id', courseId!);

    const { error } = await query;
    if (error) {
      console.error('[user-course-access] DELETE error:', error);
      return NextResponse.json(
        { success: false, error: `Failed to revoke: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[user-course-access] DELETE Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal error' },
      { status: 500 }
    );
  }
}
