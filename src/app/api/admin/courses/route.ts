import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

function generateId(): string {
  return `course_${Date.now().toString(36)}_${nanoid(8)}`;
}

/**
 * GET: List all courses (including unpublished) for admin.
 */
export async function GET() {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const { data: courses, error } = await (supabase as any)
      .from('courses')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[admin/courses] Error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, courses: courses || [] });
  } catch (error) {
    console.error('[admin/courses] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch courses' },
      { status: 500 }
    );
  }
}

/**
 * POST: Create a new course.
 */
export async function POST(request: Request) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const body = await request.json();
    const {
      title,
      description,
      short_description,
      thumbnail_url,
      instructor_name,
      price_cents,
      is_free,
      is_published,
      is_featured,
      badge_text
    } = body;

    if (!title) {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
        { status: 400 }
      );
    }

    const courseId = generateId();
    const { data: course, error } = await (supabase as any)
      .from('courses')
      .insert({
        id: courseId,
        title,
        description: description || null,
        short_description: short_description || null,
        thumbnail_url: thumbnail_url || null,
        instructor_name: instructor_name || 'Course Team',
        price_cents: price_cents || 0,
        is_free: is_free ?? true,
        is_published: is_published ?? false,
        is_featured: is_featured ?? false,
        badge_text: badge_text || null
      })
      .select()
      .single();

    if (error) {
      console.error('[admin/courses] Create error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, course });
  } catch (error) {
    console.error('[admin/courses] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create course' },
      { status: 500 }
    );
  }
}

/**
 * PUT: Partial update an existing course.
 */
export async function PUT(request: Request) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const body = await request.json();
    const { id, ...fields } = body;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID is required' },
        { status: 400 }
      );
    }

    const allowed = [
      'title',
      'description',
      'short_description',
      'thumbnail_url',
      'instructor_name',
      'price_cents',
      'is_free',
      'is_published',
      'is_featured',
      'badge_text'
    ] as const;

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };
    for (const key of allowed) {
      if (fields[key] !== undefined) updates[key] = fields[key];
    }

    const { data: course, error } = await (supabase as any)
      .from('courses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[admin/courses] Update error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, course });
  } catch (error) {
    console.error('[admin/courses] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update course' },
      { status: 500 }
    );
  }
}
