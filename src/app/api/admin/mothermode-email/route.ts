import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  listKitsForAdmin,
  upsertKit,
  deleteKit,
} from '@/lib/mothermode/email/store';
import {
  normalizeIntake,
  normalizeSequence,
  toEmailKitStatus,
  toEmailCampaignType,
  toEmailFramework,
} from '@/lib/mothermode/email/types';
import { renderSequenceHtml } from '@/lib/mothermode/email/export';
import { normalizeContextRefs } from '@/lib/mothermode/context';

/**
 * GET: admin-only. Lists every email kit (drafts included) for the
 * /admin/email-marketing editor. Returns { success, admin, items }.
 */
export async function GET() {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const items = await listKitsForAdmin();
  return NextResponse.json({ success: true, admin: true, items });
}

/**
 * POST: admin-only. Create or update one email kit.
 *   { id?, slug, name, campaignType, framework, status, intake, contextRefs, sequence }
 *
 * The sequence's per-email bodyHtml is (re)rendered from bodyText on save so the
 * stored HTML never drifts from the plain-text source of truth.
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

  try {
    const { id, slug, name } = body ?? {};

    if (!slug || typeof slug !== 'string' || !slug.trim()) {
      return NextResponse.json(
        { success: false, error: 'slug is required' },
        { status: 400 },
      );
    }

    const sequence = renderSequenceHtml(normalizeSequence(body.sequence));

    const saved = await upsertKit({
      id: typeof id === 'string' ? id : null,
      slug: slug.trim(),
      name: typeof name === 'string' ? name.trim() : '',
      campaignType: toEmailCampaignType(body.campaignType),
      framework: toEmailFramework(body.framework),
      status: toEmailKitStatus(body.status),
      intake: normalizeIntake(body.intake),
      contextRefs: normalizeContextRefs(body.contextRefs),
      sequence,
      updatedBy: guard.email,
    });

    revalidatePath('/admin/email-marketing');
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
 * DELETE: admin-only. Remove one email kit by id. Query: ?id=uuid
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
    revalidatePath('/admin/email-marketing');
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
