import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  listDeliverableOverrides,
  upsertDeliverable,
  deleteDeliverableOverride,
} from '@/lib/mothermode/deliverables/store';
import { listDeliverableDefaults } from '@/lib/mothermode/deliverables/index';

/**
 * GET: admin-only. Lists every registered resource for an offer, merging the
 * code default with any published override so the editor can show both the
 * shipped copy and whether it has been customized.
 * Query: ?slug=offer-slug
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const slug = request.nextUrl.searchParams.get('slug');
  if (!slug) {
    return NextResponse.json({ success: false, error: 'slug is required' }, { status: 400 });
  }

  const defaults = listDeliverableDefaults(slug);
  const overrides = await listDeliverableOverrides(slug);
  const overrideByKey = new Map(overrides.map((o) => [o.key, o]));

  const items = defaults.map((doc) => {
    const override = overrideByKey.get(doc.key);
    return {
      key: doc.key,
      defaultTitle: doc.title,
      defaultSubtitle: doc.subtitle,
      defaultHtml: doc.html,
      title: override?.title || doc.title,
      subtitle: override?.subtitle || doc.subtitle,
      html: override?.html || doc.html,
      customized: Boolean(override),
      updatedAt: override?.updated_at ?? null,
      updatedBy: override?.updated_by ?? null,
    };
  });

  return NextResponse.json({ success: true, admin: true, items });
}

/**
 * POST: admin-only. Publish an override for one resource document.
 * Body: { slug, key, title, subtitle, html }
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const { slug, key, title, subtitle, html } = await request.json();
    if (!slug || !key || typeof html !== 'string' || !html.trim()) {
      return NextResponse.json(
        { success: false, error: 'slug, key, and html are required' },
        { status: 400 },
      );
    }

    await upsertDeliverable({
      slug,
      key,
      title: title ?? '',
      subtitle: subtitle ?? '',
      html,
      updatedBy: guard.email,
    });

    revalidatePath(`/mothermode/resource/${slug}/${key}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Save failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * DELETE: admin-only. Remove the published override so the resource falls
 * back to its code default.
 * Query: ?slug=offer-slug&key=resource-key
 */
export async function DELETE(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const slug = request.nextUrl.searchParams.get('slug');
  const key = request.nextUrl.searchParams.get('key');
  if (!slug || !key) {
    return NextResponse.json({ success: false, error: 'slug and key are required' }, { status: 400 });
  }

  try {
    await deleteDeliverableOverride(slug, key);
    revalidatePath(`/mothermode/resource/${slug}/${key}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
