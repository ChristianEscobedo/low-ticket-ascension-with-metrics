import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { customAlphabet } from 'nanoid';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Readable upper-alphanumeric ids, grouped 4-4-4-4 for human entry.
const segment = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 4);
function generateKey(): string {
  return `${segment()}-${segment()}-${segment()}-${segment()}`;
}

/**
 * GET: List all license keys (newest first) with the associated course title.
 */
export async function GET() {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const { data: keys, error } = await (supabase as any)
      .from('course_license_keys')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[admin/licenses] List error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const courseIds = Array.from(
      new Set(
        ((keys as { course_id: string | null }[] | null) ?? [])
          .map((k) => k.course_id)
          .filter((id): id is string => !!id)
      )
    );

    let titlesById: Record<string, string> = {};
    if (courseIds.length > 0) {
      const { data: courses } = await (supabase as any)
        .from('courses')
        .select('id, title')
        .in('id', courseIds);
      for (const c of (courses as { id: string; title: string }[] | null) ??
        []) {
        titlesById[c.id] = c.title;
      }
    }

    const enriched = ((keys as Record<string, unknown>[] | null) ?? []).map(
      (k) => ({
        ...k,
        course_title:
          k.course_id && typeof k.course_id === 'string'
            ? titlesById[k.course_id] ?? null
            : null
      })
    );

    return NextResponse.json({ success: true, keys: enriched });
  } catch (error) {
    console.error('[admin/licenses] List error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load licenses' },
      { status: 500 }
    );
  }
}

/**
 * POST: Create a license key. If `license_key` is omitted, one is generated.
 * Body: {
 *   license_key?: string,
 *   course_id?: string | null,
 *   is_all_access?: boolean,
 *   max_activations?: number,
 *   expires_at?: string | null,
 *   notes?: string | null
 * }
 */
export async function POST(request: Request) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const body = await request.json().catch(() => ({}));
    const {
      license_key,
      course_id,
      is_all_access,
      max_activations,
      expires_at,
      notes
    } = body as Record<string, unknown>;

    const isAll = Boolean(is_all_access);
    if (!isAll && !course_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'A course must be selected unless the key is all-access.'
        },
        { status: 400 }
      );
    }

    const key =
      typeof license_key === 'string' && license_key.trim().length > 0
        ? license_key.trim().toUpperCase()
        : generateKey();

    const { data: created, error } = await (supabase as any)
      .from('course_license_keys')
      .insert({
        license_key: key,
        course_id: isAll ? null : (course_id as string),
        is_all_access: isAll,
        max_activations:
          typeof max_activations === 'number' && max_activations > 0
            ? Math.floor(max_activations)
            : 1,
        expires_at:
          typeof expires_at === 'string' && expires_at.length > 0
            ? expires_at
            : null,
        notes: typeof notes === 'string' ? notes : null,
        created_by: guard.email
      })
      .select()
      .single();

    if (error) {
      console.error('[admin/licenses] Create error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, key: created });
  } catch (error) {
    console.error('[admin/licenses] Create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create license' },
      { status: 500 }
    );
  }
}
