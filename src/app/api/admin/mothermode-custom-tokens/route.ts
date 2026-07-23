import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  listCustomTokens,
  upsertCustomToken,
  deleteCustomToken,
} from '@/lib/mothermode/email/customTokens';

/**
 * Admin CRUD for custom merge tokens surfaced in the email editor's Tokens
 * dropdown. All handlers are admin-gated; the store uses the service role.
 */

/** GET: list every custom token. */
export async function GET() {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const items = await listCustomTokens();
  return NextResponse.json({ success: true, admin: true, items });
}

/**
 * POST: create or update one custom token.
 * Body: { id?, key, label, description?, defaultValue? }
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const { id, key, label, description, defaultValue } = await request.json();

    if (!key || typeof key !== 'string' || !key.trim()) {
      return NextResponse.json(
        { success: false, error: 'key is required' },
        { status: 400 },
      );
    }
    if (!label || typeof label !== 'string' || !label.trim()) {
      return NextResponse.json(
        { success: false, error: 'label is required' },
        { status: 400 },
      );
    }

    const item = await upsertCustomToken({
      id: id ?? null,
      key,
      label: label.trim(),
      description: typeof description === 'string' ? description : null,
      defaultValue: typeof defaultValue === 'string' ? defaultValue : null,
    });

    return NextResponse.json({ success: true, item });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Save failed';
    const friendly = /duplicate key|unique/i.test(message)
      ? 'That token key is already in use. Choose a unique key.'
      : message;
    return NextResponse.json({ success: false, error: friendly }, { status: 500 });
  }
}

/**
 * DELETE: remove one custom token by id.
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
    await deleteCustomToken(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
