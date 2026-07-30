import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  listArticlesForAdmin,
  upsertArticle,
  deleteArticle,
} from '@/lib/mothermode/help/store';

/**
 * GET: admin-only. Lists every knowledge base article (drafts included) for
 * the /admin/help editor.
 */
export async function GET() {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const items = await listArticlesForAdmin();
  return NextResponse.json({ success: true, admin: true, items });
}

/**
 * POST: admin-only. Create or update one help article.
 * Body: { id?, slug, title, category, excerpt?, body, published, sortOrder }
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const {
      id,
      slug,
      title,
      category,
      excerpt,
      body,
      published,
      sortOrder,
      audience,
    } = await request.json();

    if (!slug || typeof slug !== 'string' || !slug.trim()) {
      return NextResponse.json(
        { success: false, error: 'slug is required' },
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

    const aud = audience === 'buyer' ? 'buyer' : 'admin';
    await upsertArticle({
      id: id ?? null,
      slug: slug.trim(),
      title: title.trim(),
      category: (category ?? 'General').trim() || 'General',
      excerpt: excerpt ?? null,
      body,
      published: Boolean(published),
      sortOrder: Number.isFinite(sortOrder) ? Number(sortOrder) : 0,
      audience: aud,
      updatedBy: guard.email,
    });

    // Buyer articles show on the public help center; admin docs show in admin.
    revalidatePath('/mothermode/help');
    revalidatePath(`/mothermode/help/${slug.trim()}`);
    revalidatePath('/admin/help-docs');
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Save failed';
    // A duplicate slug surfaces as a unique-constraint violation; make it friendly.
    const friendly = /duplicate key|unique/i.test(message)
      ? 'That slug is already in use. Choose a unique slug.'
      : message;
    return NextResponse.json({ success: false, error: friendly }, { status: 500 });
  }
}

/**
 * DELETE: admin-only. Remove one help article by id.
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
    await deleteArticle(id);
    revalidatePath('/mothermode/help');
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
