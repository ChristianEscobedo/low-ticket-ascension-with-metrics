import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  listVersions,
  upsertVersion,
  deleteVersion,
} from '@/utils/mothermode/versions-content';
import { getOffer } from '@/lib/mothermode/offers';
import type { SavedVersion } from '@/lib/mothermode/content/versions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Composed-version backend. Admin-only. Holds the whole post versions a team
 * assembled in the Version Composer, scoped per (offer, piece) so everyone sees
 * the same library and can schedule or publish from it. The full SavedVersion is
 * stored in the `version` JSONB column with status/schedule in their own columns.
 * Data access lives in src/utils/mothermode/versions-content.ts.
 *   GET    ?offer=slug&piece=id   -> every version for the piece (or offer).
 *   PUT    {offer,pieceId,version} -> upsert one composed version.
 *   DELETE ?id=                    -> remove one version.
 */
const bad = (error: string, status = 400) =>
  NextResponse.json({ ok: false, error }, { status });

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

export async function GET(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const { searchParams } = new URL(request.url);
  const offer = str(searchParams.get('offer') ?? undefined);
  if (!offer || !getOffer(offer)) return bad('A valid offer is required');
  const piece = str(searchParams.get('piece') ?? undefined);

  try {
    const versions = await listVersions(offer, piece);
    return NextResponse.json({ ok: true, versions });
  } catch (err) {
    console.error('[mothermode/content/versions] list failed', err);
    return bad('Could not load versions', 500);
  }
}

export async function PUT(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return bad('invalid JSON body');
  }

  const offer = str(body.offer);
  if (!offer || !getOffer(offer)) return bad('A valid offer is required');
  const pieceId = str(body.pieceId);
  if (!pieceId) return bad('pieceId is required');
  const version = body.version as SavedVersion | undefined;
  if (!version || typeof version !== 'object' || !str(version.id))
    return bad('version object with an id is required');

  try {
    await upsertVersion(offer, pieceId, version, guard.email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[mothermode/content/versions] save failed', err);
    return bad('Could not save version', 500);
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const id = str(new URL(request.url).searchParams.get('id') ?? undefined);
  if (!id) return bad('id is required');

  try {
    await deleteVersion(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[mothermode/content/versions] delete failed', err);
    return bad('Could not delete version', 500);
  }
}
