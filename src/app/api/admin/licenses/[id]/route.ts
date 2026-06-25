import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * PATCH: Update mutable fields on a license key.
 * Body may include: is_active, max_activations, expires_at, notes.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};
    if (typeof body.is_active === 'boolean') updates.is_active = body.is_active;
    if (typeof body.max_activations === 'number' && body.max_activations > 0)
      updates.max_activations = Math.floor(body.max_activations);
    if ('expires_at' in body)
      updates.expires_at =
        typeof body.expires_at === 'string' && body.expires_at.length > 0
          ? body.expires_at
          : null;
    if ('notes' in body)
      updates.notes = typeof body.notes === 'string' ? body.notes : null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No updatable fields supplied' },
        { status: 400 }
      );
    }

    const { data: key, error } = await (supabase as any)
      .from('course_license_keys')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[admin/licenses/[id]] PATCH error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, key });
  } catch (error) {
    console.error('[admin/licenses/[id]] PATCH error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update license' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Hard-delete a license key.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const { id } = await params;
    const { error } = await (supabase as any)
      .from('course_license_keys')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[admin/licenses/[id]] DELETE error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/licenses/[id]] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete license' },
      { status: 500 }
    );
  }
}
