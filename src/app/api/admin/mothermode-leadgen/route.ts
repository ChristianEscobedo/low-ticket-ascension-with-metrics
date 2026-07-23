import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  listKitsForAdmin,
  getKitById,
  upsertKit,
  deleteKit,
  markPublished,
} from '@/lib/mothermode/leadgen/store';
import {
  normalizeIntake,
  normalizeDoc,
  toLeadGenStatus,
  toLeadMagnetFormat,
} from '@/lib/mothermode/leadgen/types';
import { docToDeliverableDoc } from '@/lib/mothermode/leadgen/export';
import { upsertDeliverable } from '@/lib/mothermode/deliverables/store';

/**
 * GET: admin-only. Lists every lead-gen kit (drafts included) for the
 * /admin/lead-gen editor. Returns { success, admin, items }.
 */
export async function GET() {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const items = await listKitsForAdmin();
  return NextResponse.json({ success: true, admin: true, items });
}

/**
 * POST: admin-only. Two shapes, discriminated by `action`:
 *
 *   { action?: 'save', id?, slug, name, format, status, intake, doc }
 *     Create or update one lead-gen kit (default when action is absent).
 *
 *   { action: 'publish', id, publishedSlug, publishedKey }
 *     Render the kit's stored doc to a brand-styled DeliverableDoc and upsert it
 *     into mothermode_deliverables so buyers see it at
 *     /mothermode/resource/[slug]/[key], then stamp (published_slug,
 *     published_key) back on the kit.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const action = String(body.action ?? 'save');

  // -- Publish to Deliverables ---------------------------------------------
  if (action === 'publish') {
    const id = typeof body.id === 'string' ? body.id : '';
    const publishedSlug =
      typeof body.publishedSlug === 'string' ? body.publishedSlug.trim() : '';
    const publishedKey =
      typeof body.publishedKey === 'string' ? body.publishedKey.trim() : '';

    if (!id || !publishedSlug || !publishedKey) {
      return NextResponse.json(
        { success: false, error: 'id, publishedSlug and publishedKey are required' },
        { status: 400 },
      );
    }

    const kit = await getKitById(id);
    if (!kit) {
      return NextResponse.json(
        { success: false, error: 'Kit not found' },
        { status: 404 },
      );
    }

    try {
      const deliverable = docToDeliverableDoc(kit.doc, publishedSlug, publishedKey);
      await upsertDeliverable({
        slug: deliverable.slug,
        key: deliverable.key,
        title: deliverable.title,
        subtitle: deliverable.subtitle,
        html: deliverable.html,
        updatedBy: guard.email,
      });
      await markPublished(id, publishedSlug, publishedKey);

      revalidatePath('/admin/lead-gen');
      revalidatePath(`/mothermode/resource/${publishedSlug}/${publishedKey}`);
      return NextResponse.json({ success: true, publishedSlug, publishedKey });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Publish failed';
      return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
  }

  // -- Save (create / update) ----------------------------------------------
  try {
    const { id, slug, name, format, status, intake, doc } = body ?? {};

    if (!slug || typeof slug !== 'string' || !slug.trim()) {
      return NextResponse.json(
        { success: false, error: 'slug is required' },
        { status: 400 },
      );
    }

    const saved = await upsertKit({
      id: typeof id === 'string' ? id : null,
      slug: slug.trim(),
      name: typeof name === 'string' ? name.trim() : '',
      format: toLeadMagnetFormat(format),
      status: toLeadGenStatus(status),
      intake: normalizeIntake(intake),
      doc: normalizeDoc(doc),
      updatedBy: guard.email,
    });

    revalidatePath('/admin/lead-gen');
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
 * DELETE: admin-only. Remove one lead-gen kit by id. Query: ?id=uuid
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
    revalidatePath('/admin/lead-gen');
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
