import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';
import { getUserCourseAccess } from '@/utils/courses/access';

const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * GET: Current user's accessible courses with embedded course summary fields.
 */
export async function GET() {
  try {
    const authed = createClient();
    const user = await getUser(authed);

    if (!user) {
      return NextResponse.json({ success: true, access: [] });
    }

    const access = await getUserCourseAccess(user.id, user.email ?? null);
    const courseIds = access.map((a) => a.course_id);

    let coursesData: Record<string, unknown>[] = [];
    if (courseIds.length > 0) {
      const { data } = await (supabase as any)
        .from('courses')
        .select(
          'id, title, short_description, thumbnail_url, lesson_count, total_duration_minutes, badge_text'
        )
        .in('id', courseIds);
      coursesData = (data as Record<string, unknown>[] | null) ?? [];
    }

    const accessWithCourses = access.map((a) => ({
      ...a,
      courses: coursesData.find((c) => c.id === a.course_id) ?? null
    }));

    return NextResponse.json({ success: true, access: accessWithCourses });
  } catch (error) {
    console.error('[courses/access] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch access' },
      { status: 500 }
    );
  }
}

/**
 * POST: Activate a license key for the signed-in user.
 * Body: { license_key: string }
 */
export async function POST(request: NextRequest) {
  try {
    const authed = createClient();
    const user = await getUser(authed);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Sign in required to redeem a license' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);
    const licenseKey = body?.license_key as string | undefined;
    if (!licenseKey) {
      return NextResponse.json(
        { success: false, error: 'License key required' },
        { status: 400 }
      );
    }

    const { data: license, error: licenseError } = await (supabase as any)
      .from('course_license_keys')
      .select('*')
      .eq('license_key', licenseKey)
      .eq('is_active', true)
      .single();

    if (licenseError || !license) {
      return NextResponse.json(
        { success: false, error: 'Invalid or inactive license key' },
        { status: 400 }
      );
    }

    if (license.current_activations >= license.max_activations) {
      return NextResponse.json(
        { success: false, error: 'License key has reached maximum activations' },
        { status: 400 }
      );
    }

    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'License key has expired' },
        { status: 400 }
      );
    }

    const grant = async (courseId: string) =>
      (supabase as any).from('user_course_access').upsert(
        {
          user_id: user.id,
          course_id: courseId,
          access_type: 'license',
          license_key: licenseKey,
          granted_at: new Date().toISOString()
        },
        { onConflict: 'user_id,course_id' }
      );

    if (license.is_all_access) {
      const { data: courses } = await (supabase as any)
        .from('courses')
        .select('id')
        .eq('is_published', true);
      for (const c of (courses as { id: string }[] | null) ?? []) {
        await grant(c.id);
      }
    } else if (license.course_id) {
      await grant(license.course_id);
    }

    await (supabase as any)
      .from('course_license_keys')
      .update({ current_activations: license.current_activations + 1 })
      .eq('id', license.id);

    return NextResponse.json({
      success: true,
      message: license.is_all_access
        ? 'All-access granted!'
        : 'Course access granted!'
    });
  } catch (error) {
    console.error('[courses/access] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to activate license' },
      { status: 500 }
    );
  }
}
