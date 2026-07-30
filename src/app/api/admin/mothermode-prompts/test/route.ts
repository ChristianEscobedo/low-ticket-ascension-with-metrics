import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import { resolveAllRecipes } from '@/lib/mothermode/content/promptBankStore';
import {
  generateContentBatch,
  type BatchOfferContext,
} from '@/utils/integrations/openai-content';
import { getOffer } from '@/lib/mothermode/offers';
import {
  PLATFORM_LABEL,
  FORMAT_LABEL,
  type ContentFormat,
  type ContentPiece,
  type ContentPlatform,
} from '@/lib/mothermode/content';
import {
  clampSequenceCount,
  funnelArcGuide,
} from '@/lib/mothermode/content/promptBankActions';
import type { MotherModeOffer } from '@/lib/mothermode/types';
import { ROUTES } from '@/lib/mothermode/brand';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

/** Minimal offer facts for a one-piece test run (same shape as the batch route). */
function testOfferContext(offer: MotherModeOffer): BatchOfferContext {
  const dollars = offer.priceCents / 100;
  return {
    name: offer.name,
    category: offer.category,
    tagline: offer.tagline,
    audience: offer.hero?.audience,
    promise: offer.hero?.promise,
    scene: offer.problem?.scene,
    problemIntro: offer.problem?.intro,
    problemPoints: offer.problem?.points,
    cost: offer.problem?.cost,
    mechanismLabel: offer.mechanism?.label,
    mechanism: offer.mechanism?.paragraphs?.join(' '),
    insideOutcomes: (offer.inside?.items ?? [])
      .map((i) => i.outcome ?? `${i.title}: ${i.description}`)
      .filter((o): o is string => !!o),
    oldWay: offer.oldWay?.items,
    newWay: offer.newWay?.items,
    priceLabel: `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`,
    url: `${ROUTES.offerBase}/${offer.slug}`,
  };
}

/**
 * POST: admin-only. Run one recipe through the real batch generator and
 * return the single piece it produced, so the /admin/prompt-bank editor can
 * show a live platform preview of exactly what the recipe makes.
 *
 * Body: { recipeId, platform?, format?, offerSlug?, inputValues? }. Framework
 * and style recipes execute through `style`; image recipes through
 * `imageFramework`. `inputValues` carries the filled values for the recipe's
 * custom input fields (recipe.inputs), injected as user-supplied material.
 *
 * Action 'sequence' ({ action: 'sequence', source, count? }): expand the test
 * piece into a connected 3-5 post content funnel. Runs the batch generator in
 * variations mode with the piece as `source` plus the funnel-arc guide (post 1
 * hooks, middles prove, last converts). Every returned piece carries the
 * recipe id in `framework` for later analytics.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'invalid JSON body' },
      { status: 400 },
    );
  }

  const recipeId = str(body.recipeId);
  if (!recipeId) {
    return NextResponse.json(
      { success: false, error: 'recipeId is required' },
      { status: 400 },
    );
  }

  const { recipes } = await resolveAllRecipes();
  const recipe = recipes.find((r) => r.id === recipeId);
  if (!recipe) {
    return NextResponse.json(
      { success: false, error: `Unknown recipe: ${recipeId}` },
      { status: 404 },
    );
  }

  const platformRaw = str(body.platform);
  const platform = (
    platformRaw && platformRaw in PLATFORM_LABEL
      ? platformRaw
      : (recipe.platforms[0] ?? 'instagram')
  ) as ContentPlatform;
  const formatRaw = str(body.format);
  const format = (
    formatRaw && formatRaw in FORMAT_LABEL
      ? formatRaw
      : (recipe.formats[0] ?? 'feed')
  ) as ContentFormat;

  const offer = getOffer(str(body.offerSlug) ?? '');
  if (!offer) {
    return NextResponse.json(
      { success: false, error: 'A valid offerSlug is required' },
      { status: 400 },
    );
  }

  // -- Sequence: expand the test piece into a connected 3-5 post funnel ------
  if (str(body.action) === 'sequence') {
    const sourceRaw = body.source;
    const source =
      sourceRaw && typeof sourceRaw === 'object' && typeof (sourceRaw as ContentPiece).hook === 'string'
        ? (sourceRaw as ContentPiece)
        : null;
    if (!source) {
      return NextResponse.json(
        { success: false, error: 'A source piece is required for a sequence' },
        { status: 400 },
      );
    }
    const count = clampSequenceCount(Number(body.count) || 4);
    const seqResult = await generateContentBatch({
      mode: 'variations',
      count,
      platform,
      format,
      kind: recipe.kind ?? source.kind ?? 'organic',
      tone: 'confidante',
      offer: testOfferContext(offer),
      source,
      style: recipe.group === 'image' ? undefined : recipe.id,
      imageFramework: recipe.group === 'image' ? recipe.id : undefined,
      guides: funnelArcGuide(count),
    });
    if (!seqResult.ok) {
      return NextResponse.json(
        { success: false, error: seqResult.error },
        { status: seqResult.status },
      );
    }
    const pieces = seqResult.data.pieces.map((p) => ({
      ...p,
      framework: p.framework ?? recipe.id,
    }));
    return NextResponse.json({
      success: true,
      pieces,
      model: seqResult.data.model,
      platform,
      format,
      count,
    });
  }

  const inputValues =
    body.inputValues && typeof body.inputValues === 'object'
      ? Object.fromEntries(
          Object.entries(body.inputValues as Record<string, unknown>)
            .filter(([, v]) => typeof v === 'string' && v.trim())
            .map(([k, v]) => [k, (v as string).trim()]),
        )
      : undefined;

  const result = await generateContentBatch({
    mode: 'batch',
    count: 1,
    platform,
    format,
    kind: recipe.kind ?? 'organic',
    tone: 'confidante',
    offer: testOfferContext(offer),
    style: recipe.group === 'image' ? undefined : recipe.id,
    imageFramework: recipe.group === 'image' ? recipe.id : undefined,
    recipeInputs: inputValues,
  });

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status },
    );
  }
  const piece = result.data.pieces[0];
  if (!piece) {
    return NextResponse.json(
      { success: false, error: 'The generator returned no piece' },
      { status: 502 },
    );
  }
  return NextResponse.json({
    success: true,
    piece,
    model: result.data.model,
    platform,
    format,
  });
}
