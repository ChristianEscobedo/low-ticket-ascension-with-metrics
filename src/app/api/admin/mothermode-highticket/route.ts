import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  listKitsForAdmin,
  upsertKit,
  deleteKit,
} from '@/lib/mothermode/highticket/store';
import {
  normalizeIntake,
  normalizeKit,
  toHighTicketStatus,
} from '@/lib/mothermode/highticket/types';
import { normalizeContextRefs } from '@/lib/mothermode/context';


/**
 * GET: admin-only. Lists every high-ticket kit (drafts included) for the
 * /admin/high-ticket editor. Returns { success, admin, items }.
 */
export async function GET() {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const items = await listKitsForAdmin();
  return NextResponse.json({ success: true, admin: true, items });
}

/**
 * POST: admin-only. Create or update one high-ticket kit.
 * Body: { id?, slug, name, status, intake, kit }
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const body = await request.json();
    const { id, slug, name, status, intake, kit, contextRefs } = body ?? {};


    if (!slug || typeof slug !== 'string' || !slug.trim()) {
      return NextResponse.json(
        { success: false, error: 'slug is required' },
        { status: 400 },
      );
    }

    const saved = await upsertKit({
      id: id ?? null,
      slug: slug.trim(),
      name: typeof name === 'string' ? name.trim() : '',
      status: toHighTicketStatus(status),
      intake: normalizeIntake(intake),
      kit: normalizeKit(kit),
      contextRefs: normalizeContextRefs(contextRefs),
      updatedBy: guard.email,

    });

    revalidatePath('/admin/high-ticket');
    return NextResponse.json({ success: true, item: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Save failed';
    const friendly = /duplicate key|unique/i.test(message)
      ? 'That slug is already in use. Choose a unique slug.'
      : message;
    return NextResponse.json({ success: false, error: friendly }, { status: 500 });
  }
}

/**
 * DELETE: admin-only. Remove one high-ticket kit by id. Query: ?id=uuid
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
    await deleteKit(id);
    revalidatePath('/admin/high-ticket');
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
