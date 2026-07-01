import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  listReviews,
  upsertReview,
  deleteReview,
} from '@/utils/mothermode/review-content';
import { getOffer } from '@/lib/mothermode/offers';
import type { PieceReview } from '@/lib/mothermode/content/review';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Per-piece review backend. Admin-only. Holds the copy edits, notes, metrics,
 * and replacement images a team applies to a content piece, scoped per offer so
 * the whole team sees the same work. The merged PieceReview is stored as-is in
 * the `review` JSONB column. Data access lives in
 * src/utils/mothermode/review-content.ts.
 *   GET    ?offer=slug        -> every review for the offer, keyed by piece id.
 *   PUT    {offer,pieceId,review} -> upsert one piece's merged review.
 *   DELETE ?offer=slug&id=    -> remove one piece's review.
 */
const bad = (error: string, status = 400) =>
  NextResponse.json({ ok: false, error }, { status });

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

export async function GET(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const offer = str(new URL(request.url).searchParams.get('offer') ?? undefined);
  if (!offer || !getOffer(offer)) return bad('A valid offer is required');

  try {
    const reviews = await listReviews(offer);
    return NextResponse.json({ ok: true, reviews });
  } catch (err) {
    console.error('[mothermode/content/review] list failed', err);
    return bad('Could not load review state', 500);
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
  if (!body.review || typeof body.review !== 'object')
    return bad('review object is required');

  try {
    await upsertReview(offer, pieceId, body.review as PieceReview, guard.email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[mothermode/content/review] save failed', err);
    return bad('Could not save review state', 500);
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const { searchParams } = new URL(request.url);
  const offer = str(searchParams.get('offer') ?? undefined);
  const pieceId = str(searchParams.get('id') ?? undefined);
  if (!offer || !getOffer(offer)) return bad('A valid offer is required');
  if (!pieceId) return bad('id is required');

  try {
    await deleteReview(offer, pieceId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[mothermode/content/review] delete failed', err);
    return bad('Could not delete review state', 500);
  }
}
