import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  generateContentBatch,
  type BatchInput,
  type BatchOfferContext,
} from '@/utils/integrations/openai-content';
import {
  insertGeneratedBatch,
  listGeneratedPieces,
  deleteGeneratedPiece,
  deleteGeneratedBatch,
} from '@/utils/mothermode/generated-content';
import { getOffer } from '@/lib/mothermode/offers';
import { ROUTES } from '@/lib/mothermode/brand';
import {
  isPerspective,
  isSophistication,
} from '@/lib/mothermode/content/amplify';
import {
  PLATFORM_LABEL,
  FORMAT_LABEL,
  TONE_LABEL,
  type ContentFormat,
  type ContentPiece,
  type ContentPlatform,
  type ToneRegister,
} from '@/lib/mothermode/content';
import type { MotherModeOffer } from '@/lib/mothermode/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Generated-content backend. Admin-only. Generates an offer-grounded batch of
 * formatted posts/ads (or variations of one post), persists them to Supabase,
 * and lists/deletes them for the content hub. The provider calls live in
 * src/utils/integrations/openai-content.ts.
 *   POST   -> generate + persist a batch, returns the pieces.
 *   GET    -> list every saved generated piece.
 *   DELETE -> remove one piece (?id=) or a whole batch (?batch=).
 */
const bad = (error: string, status = 400) =>
  NextResponse.json({ ok: false, error }, { status });

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, Math.round(n)));

/** Pull the offer facts the generator grounds every claim in. */
function offerContext(offer: MotherModeOffer): BatchOfferContext {
  const dollars = offer.priceCents / 100;
  return {
    name: offer.name,
    category: offer.category,
    tagline: offer.tagline,
    audience: offer.hero?.audience,
    promise: offer.hero?.promise,
    problemPoints: offer.problem?.points,
    cost: offer.problem?.cost,
    insideOutcomes: (offer.inside?.items ?? [])
      .map((i) => i.outcome)
      .filter((o): o is string => !!o),
    priceLabel: `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`,
    url: `${ROUTES.offerBase}/${offer.slug}`,
  };
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return bad('invalid JSON body');
  }

  const offer = getOffer(typeof body.offerSlug === 'string' ? body.offerSlug : '');
  if (!offer) return bad('A valid offerSlug is required');

  const { platform, format, kind, tone } = body;
  if (typeof platform !== 'string' || !(platform in PLATFORM_LABEL))
    return bad('invalid platform');
  if (typeof format !== 'string' || !(format in FORMAT_LABEL))
    return bad('invalid format');
  if (kind !== 'organic' && kind !== 'ad')
    return bad('kind must be organic or ad');
  if (typeof tone !== 'string' || !(tone in TONE_LABEL))
    return bad('invalid tone');

  const mode = body.mode === 'variations' ? 'variations' : 'batch';
  const source =
    mode === 'variations' && body.source && typeof body.source === 'object'
      ? (body.source as ContentPiece)
      : undefined;

  const input: BatchInput = {
    mode,
    count: clamp(Number(body.count) || 0, 1, 10),
    platform: platform as ContentPlatform,
    format: format as ContentFormat,
    kind,
    tone: tone as ToneRegister,
    theme: str(body.theme),
    guides: str(body.guides),
    offer: offerContext(offer),
    source,
    perspective: isPerspective(body.perspective) ? body.perspective : undefined,
    sophistication: isSophistication(body.sophistication)
      ? body.sophistication
      : undefined,
    model: str(body.model),
  };

  const result = await generateContentBatch(input);
  if (!result.ok) return bad(result.error, result.status);

  const batchId = randomUUID();
  try {
    await insertGeneratedBatch(result.data.pieces, {
      batchId,
      offerSlug: offer.slug,
      sourcePieceId: source?.id ?? null,
      guides: input.guides ?? null,
      model: result.data.model,
      createdBy: guard.email,
    });
  } catch (err) {
    console.error('[mothermode/content/generated] persist failed', err);
    return bad('Generated, but saving failed', 500);
  }

  return NextResponse.json({ ok: true, pieces: result.data.pieces, batchId });
}

export async function GET() {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;
  try {
    const pieces = await listGeneratedPieces();
    return NextResponse.json({ ok: true, pieces });
  } catch (err) {
    console.error('[mothermode/content/generated] list failed', err);
    return bad('Could not load generated content', 500);
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const batch = searchParams.get('batch');
  try {
    if (id) await deleteGeneratedPiece(id);
    else if (batch) await deleteGeneratedBatch(batch);
    else return bad('id or batch is required');
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[mothermode/content/generated] delete failed', err);
    return bad('Could not delete', 500);
  }
}
