import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  suggestIntakeFromContext,
  findResearchContext,
  suggestAmazonProducts,
} from '@/lib/mothermode/research/suggestIntake';
import { getSession, upsertSession } from '@/lib/mothermode/research/store';
import { normalizeContextRefs } from '@/lib/mothermode/context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// The find mode runs several web searches (parallel, ~30s each) before
// assembling the brief.
export const maxDuration = 300;

/**
 * Research intake engines. POST { mode, sessionId?, offerSlug?, goal?, apply? }
 *
 *   mode 'suggest'  cheap: draft the brief from offer/context packs only.
 *   mode 'find'     web: model-native web searches, then assemble the brief
 *                   (products with links, voices with profile URLs, subreddits).
 *
 *   sessionId: the brief is drafted against that session's offer+refs, and
 *              with `apply: true` it is also SAVED to the session (returned
 *              in `session`). Without apply it is a draft for the panel to
 *              edit first.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid JSON body' },
      { status: 400 },
    );
  }

  const mode =
    body.mode === 'find' ? 'find' : body.mode === 'products' ? 'products' : 'suggest';
  const goal = typeof body.goal === 'string' ? body.goal.trim() : undefined;
  const apply = body.apply === true;

  let offerSlug =
    typeof body.offerSlug === 'string' ? body.offerSlug.trim() : '';
  let contextRefs = normalizeContextRefs(body.contextRefs);

  const sessionId =
    typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  let session = null;
  if (sessionId) {
    session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { ok: false, error: 'session not found' },
        { status: 404 },
      );
    }
    if (!offerSlug) offerSlug = session.offerSlug;
    if (contextRefs.length === 0) contextRefs = session.contextRefs;
    if (!goal && session.intake.goal) {
      // keep the existing goal as steering when present
    }
  }

  // Product mode returns related books/products with working Amazon links —
  // no brief drafting, no session mutation.
  if (mode === 'products') {
    const result = await suggestAmazonProducts({
      offerSlug: offerSlug || undefined,
      contextRefs,
      goal,
      categoryKeywords: Array.isArray(body.categoryKeywords)
        ? body.categoryKeywords.filter((k): k is string => typeof k === 'string')
        : (session?.intake.categoryKeywords ?? []),
      audience:
        typeof body.audience === 'string'
          ? body.audience
          : session?.intake.audience,
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({ ok: true, products: result.products });
  }

  const engine = mode === 'find' ? findResearchContext : suggestIntakeFromContext;
  const result = await engine({
    offerSlug: offerSlug || undefined,
    contextRefs,
    goal: goal ?? (session?.intake.goal || undefined),
    ...(mode === 'find'
      ? {
          scope: body.scope === 'broad' ? ('broad' as const) : ('specific' as const),
          audience:
            typeof body.audience === 'string' && body.audience.trim()
              ? body.audience
              : session?.intake.audience || undefined,
        }
      : {}),
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status },
    );
  }

  if (apply && session) {
    session = await upsertSession({
      id: session.id,
      intake: result.intake,
      updatedBy: guard.email,
    });
  }

  return NextResponse.json({
    ok: true,
    intake: result.intake,
    sources: result.sources,
    ...(apply && session ? { session } : {}),
  });
}
