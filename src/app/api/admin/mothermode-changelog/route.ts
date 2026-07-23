import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  listChangelogForAdmin,
  upsertChangelogEntry,
  deleteChangelogEntry,
} from '@/lib/mothermode/help/store';

/**
 * GET: admin-only. Lists every changelog entry (drafts included), newest
 * first, for the /admin/help editor.
 */
export async function GET() {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const items = await listChangelogForAdmin();
  return NextResponse.json({ success: true, admin: true, items });
}

/**
 * POST: admin-only. Create or update one changelog entry.
 * Body: { id?, version?, releasedOn, entryType, title, body, published }
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const { id, version, releasedOn, entryType, title, body, published } =
      await request.json();

    if (!releasedOn || typeof releasedOn !== 'string') {
      return NextResponse.json(
        { success: false, error: 'releasedOn is required' },
        { status: 400 },
      );
    }
    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json(
        { success: false, error: 'title is required' },
        { status: 400 },
      );
    }
    if (typeof body !== 'string' || !body.trim()) {
      return NextResponse.json(
        { success: false, error: 'body is required' },
        { status: 400 },
      );
    }

    await upsertChangelogEntry({
      id: id ?? null,
      version: version ?? null,
      releasedOn,
      entryType: entryType ?? 'improved',
      title: title.trim(),
      body,
      published: Boolean(published),
      updatedBy: guard.email,
    });

    revalidatePath('/mothermode/changelog');
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Save failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * DELETE: admin-only. Remove one changelog entry by id.
 * Query: ?id=uuid
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
    await deleteChangelogEntry(id);
    revalidatePath('/mothermode/changelog');
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
