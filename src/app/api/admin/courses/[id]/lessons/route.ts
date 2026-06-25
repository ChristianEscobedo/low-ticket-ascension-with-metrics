import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * GET: List all lessons for a course (admin — no publish filter).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const { id: courseId } = await params;
    const { data: lessons, error } = await (supabase as any)
      .from('lessons')
      .select('*')
      .eq('course_id', courseId)
      .order('chapter_number', { ascending: true })
      .order('lesson_number', { ascending: true });

    if (error) {
      console.error('[admin/lessons] GET error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, lessons: lessons || [] });
  } catch (error) {
    console.error('[admin/lessons] GET Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch lessons' },
      { status: 500 }
    );
  }
}

/**
 * POST: Create a lesson under a course. Updates course aggregates.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const { id: courseId } = await params;
    const body = await request.json();
    const {
      title,
      description,
      video_url,
      thumbnail_url,
      video_duration_seconds,
      chapter_number,
      lesson_number,
      is_preview,
      content_markdown,
      resources,
      ctas,
      chat_slug
    } = body;

    if (!title) {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
        { status: 400 }
      );
    }

    const insertData: Record<string, unknown> = {
      id: randomUUID(),
      course_id: courseId,
      title,
      description: description || null,
      video_url: video_url || null,
      thumbnail_url: thumbnail_url || null,
      video_duration_seconds: video_duration_seconds || 0,
      chapter_number: chapter_number || 1,
      lesson_number: lesson_number || 1,
      is_preview: is_preview ?? false,
      content_markdown: content_markdown || null,
      resources: resources || []
    };
    if (ctas !== undefined && Array.isArray(ctas)) insertData.ctas = ctas;
    if (chat_slug !== undefined) insertData.chat_slug = chat_slug || null;

    const { data: lesson, error } = await (supabase as any)
      .from('lessons')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('[admin/lessons] Create error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    await updateCourseStats(supabase, courseId);

    return NextResponse.json({ success: true, lesson });
  } catch (error) {
    console.error('[admin/lessons] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create lesson' },
      { status: 500 }
    );
  }
}

/**
 * PUT: Partial update to a lesson (preserve unsent fields).
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const { id: courseId } = await params;
    const body = await request.json();
    const {
      id,
      title,
      description,
      video_url,
      thumbnail_url,
      video_duration_seconds,
      chapter_number,
      lesson_number,
      is_preview,
      content_markdown,
      resources,
      ctas,
      chat_slug
    } = body;

    if (!id || !title) {
      return NextResponse.json(
        { success: false, error: 'ID and title are required' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      title,
      updated_at: new Date().toISOString()
    };
    if (description !== undefined) updateData.description = description || null;
    if (video_url !== undefined) updateData.video_url = video_url;
    if (thumbnail_url !== undefined)
      updateData.thumbnail_url = thumbnail_url || null;
    if (video_duration_seconds !== undefined)
      updateData.video_duration_seconds = video_duration_seconds || 0;
    if (chapter_number !== undefined)
      updateData.chapter_number = chapter_number || 1;
    if (lesson_number !== undefined)
      updateData.lesson_number = lesson_number || 1;
    if (is_preview !== undefined) updateData.is_preview = is_preview ?? false;
    if (content_markdown !== undefined)
      updateData.content_markdown = content_markdown || null;
    if (resources !== undefined) updateData.resources = resources || [];
    if (ctas !== undefined) updateData.ctas = ctas || [];
    if (chat_slug !== undefined) updateData.chat_slug = chat_slug || null;

    const { data: lesson, error } = await (supabase as any)
      .from('lessons')
      .update(updateData)
      .eq('id', id)
      .eq('course_id', courseId)
      .select()
      .single();

    if (error) {
      console.error('[admin/lessons] Update error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    await updateCourseStats(supabase, courseId);

    return NextResponse.json({ success: true, lesson });
  } catch (error) {
    console.error('[admin/lessons] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update lesson' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Remove a lesson via body { id: lessonId } and refresh course stats.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const { id: courseId } = await params;
    const body = await request.json();
    const { id: lessonId } = body;

    if (!lessonId) {
      return NextResponse.json(
        { success: false, error: 'Lesson ID is required' },
        { status: 400 }
      );
    }

    const { error } = await (supabase as any)
      .from('lessons')
      .delete()
      .eq('id', lessonId)
      .eq('course_id', courseId);

    if (error) {
      console.error('[admin/lessons] Delete error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    await updateCourseStats(supabase, courseId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/lessons] Delete Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete lesson' },
      { status: 500 }
    );
  }
}

async function updateCourseStats(client: SupabaseClient, courseId: string) {
  try {
    const { data: lessons } = await (client as any)
      .from('lessons')
      .select('video_duration_seconds')
      .eq('course_id', courseId);

    if (lessons) {
      const lessonCount = lessons.length;
      const totalSeconds = (lessons as { video_duration_seconds: number }[]).reduce(
        (sum, l) => sum + (l.video_duration_seconds || 0),
        0
      );
      const totalMinutes = Math.ceil(totalSeconds / 60);

      await (client as any)
        .from('courses')
        .update({
          lesson_count: lessonCount,
          total_duration_minutes: totalMinutes
        })
        .eq('id', courseId);
    }
  } catch (error) {
    console.error('[admin/lessons] Failed to update course stats:', error);
  }
}
