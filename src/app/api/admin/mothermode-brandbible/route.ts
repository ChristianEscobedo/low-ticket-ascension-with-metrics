import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  listBiblesForAdmin,
  upsertBible,
  deleteBible,
} from '@/lib/mothermode/brandbible/store';
import { normalizeNegatives } from '@/lib/mothermode/brandbible/types';

/**
 * GET: admin-only. Lists every Brand Bible for the /admin/brand-bible editor.
 * Returns { success, admin, items }.
 */
export async function GET() {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const items = await listBiblesForAdmin();
  return NextResponse.json({ success: true, admin: true, items });
}

/**
 * POST: admin-only. Create or update one Brand Bible.
 * Body: { id?, name, scope?, visualDirection?, colorLanguage?, emotion?,
 *         camera?, negatives? }
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const body = await request.json();
    const {
      id,
      name,
      scope,
      visualDirection,
      colorLanguage,
      emotion,
      camera,
      negatives,
    } = body ?? {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'name is required' },
        { status: 400 },
      );
    }

    const str = (v: unknown) =>
      typeof v === 'string' && v.trim() ? v.trim() : null;

    const saved = await upsertBible({
      id: id ?? null,
      name: name.trim(),
      scope: str(scope),
      visualDirection: str(visualDirection),
      colorLanguage: str(colorLanguage),
      emotion: str(emotion),
      camera: str(camera),
      negatives: normalizeNegatives(negatives),
      updatedBy: guard.email,
    });

    revalidatePath('/admin/brand-bible');
    return NextResponse.json({ success: true, item: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Save failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * DELETE: admin-only. Remove one Brand Bible by id. Query: ?id=uuid
 */
export async function DELETE(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json(
      { success: false, error: 'id is required' },
      { status: 400 },
    );
  }

  try {
    await deleteBible(id);
    revalidatePath('/admin/brand-bible');
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
