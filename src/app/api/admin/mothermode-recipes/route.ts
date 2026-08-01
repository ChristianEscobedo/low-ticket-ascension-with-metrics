import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  listRecipes,
  getRecipe,
  listRecipeRuns,
  getRecipeRun,
  createRecipeRun,
  updateRecipeRun,
  listRunEvents,
  listRecentRunEvents,
  upsertRecipe,
  logRunEvent,
} from '@/lib/mothermode/research/recipes/store';

import {
  normalizeRecipeSteps,
  recipeDraftErrors,
} from '@/lib/mothermode/research/recipes/types';
import { runRecipe } from '@/lib/mothermode/research/recipes/run';
import { createAgentJob } from '@/lib/mothermode/research/recipes/jobs';
import {
  listWatchlists,
  upsertWatchlist,
  deleteWatchlist,
  normalizeWatchTrigger,
  type WatchTrigger,
} from '@/lib/mothermode/research/watchlists';
import {
  getSession,
  readFleetUsageToday,
} from '@/lib/mothermode/research/store';
import { listExperts } from '@/lib/mothermode/research/experts/store';
import {
  getRunDetail,
  getRunMoneyMap,
} from '@/lib/mothermode/research/recipes/runDetail';
import { getExpertScorecards } from '@/lib/mothermode/research/recipes/scorecards';
import {
  createRunShare,
  revokeRunShare,
  shareRunUrl,
} from '@/lib/mothermode/research/recipes/shares';

export const runtime = 'nodejs';

export const dynamic = 'force-dynamic';
// A full recipe is several agent turns; give it room.
export const maxDuration = 300;

/**
 * Agent Recipes (roadmap 3.1). Admin-only.
 *
 *   GET                    -> { ok, recipes, runs, watchlists, experts }
 *   GET ?run=<runId>       -> { ok, run }
 *   GET ?events=<runId>    -> { ok, events } (trust-spine timeline)
 *   GET ?money=<runId>     -> { ok, moneyMap } (the runs-feed summary line)
 *   GET ?detail=<runId>    -> { ok, detail } (the run detail page: run,
 *                              recipe, events, scoped transcript, artifacts,
 *                              money map)
 *   GET ?scorecards=1      -> { ok, scorecards } (per-expert acceptance /
 *                              failure / allocated cost over recent runs)
 *   POST {action:'start', slug, sessionId}   -> { ok, run } (runs to done/gated/failed)
 *   POST {action:'gate', runId, decision:'approve'|'cancel'} -> { ok, run }
 *   POST {action:'cancel', runId}            -> { ok, run } (stops a RUNNING
 *                                               run between steps)
 *   POST {action:'retry', runId}             -> { ok, run, job } (re-queues a
 *                                               failed/canceled run from the
 *                                               step it stopped at)
 *   POST {action:'share', runId}             -> { ok, share, url } (Phase 3:
 *                                               the public recap link —
 *                                               idempotent, one live link
 *                                               per run)
 *   POST {action:'unshare', runId}           -> { ok } (revokes it; the
 *                                               token 404s on its next read)
 */

export async function GET(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  // A run's event timeline (the trust spine read): oldest first.
  const eventsRunId = request.nextUrl.searchParams.get('events')?.trim() ?? '';
  if (eventsRunId) {
    const events = await listRunEvents(eventsRunId);
    return NextResponse.json({ ok: true, events });
  }

  const runId = request.nextUrl.searchParams.get('run')?.trim() ?? '';
  if (runId) {
    const run = await getRecipeRun(runId);
    if (!run) {
      return NextResponse.json(
        { ok: false, error: 'run not found' },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, run });
  }

  // Just the money map (Phase 2): the per-run "12 cards → 218 clicks → 31
  // leads → $412 attributed" line, without the transcript's weight.
  const moneyRunId = request.nextUrl.searchParams.get('money')?.trim() ?? '';
  if (moneyRunId) {
    const moneyMap = await getRunMoneyMap(moneyRunId);
    if (!moneyMap) {
      return NextResponse.json(
        { ok: false, error: 'run not found' },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, moneyMap });
  }

  // The full run detail (Phase 2): one screen to judge a run.
  const detailRunId = request.nextUrl.searchParams.get('detail')?.trim() ?? '';
  if (detailRunId) {
    const detail = await getRunDetail(detailRunId);
    if (!detail) {
      return NextResponse.json(
        { ok: false, error: 'run not found' },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, detail });
  }

  // Expert scorecards (Phase 2): acceptance / failure / allocated cost per
  // expert over the recent run history. Lazy (the crew editor fetches it
  // once on mount) — it stays OUT of the polled main GET.
  if (request.nextUrl.searchParams.get('scorecards')) {
    const scorecards = await getExpertScorecards();
    return NextResponse.json({ ok: true, scorecards });
  }

  // Mission Control's activity read (the admin home): the FLEET's event
  // feed + today's spend across every session. The meter is null (not $0)
  // when the log read fails — "unknown", never "a free day".
  if (request.nextUrl.searchParams.get('activity')) {
    const [events, fleetCostCentsToday] = await Promise.all([
      listRecentRunEvents({ limit: 30 }),
      readFleetUsageToday(),
    ]);
    return NextResponse.json({ ok: true, events, fleetCostCentsToday });
  }

  const [recipes, runs, watchlists, experts] = await Promise.all([
    listRecipes(),
    listRecipeRuns({ limit: 20 }),
    listWatchlists(),
    // The crew directory, for expert names/taglines on chips. Degrades to
    // [] pre-seed; the UI falls back to prettified slugs.
    listExperts(),
  ]);
  return NextResponse.json({ ok: true, recipes, runs, watchlists, experts });
}

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
  const action = typeof body.action === 'string' ? body.action.trim() : '';

  try {
    if (action === 'start') {
      const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
      const sessionId =
        typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
      if (!slug || !sessionId) {
        return NextResponse.json(
          { ok: false, error: 'slug and sessionId are required' },
          { status: 400 },
        );
      }
      const [recipe, session] = await Promise.all([
        getRecipe(slug),
        getSession(sessionId),
      ]);
      if (!recipe) {
        return NextResponse.json(
          { ok: false, error: 'recipe not found (seed it first)' },
          { status: 404 },
        );
      }
      if (!session) {
        return NextResponse.json(
          { ok: false, error: 'session not found' },
          { status: 404 },
        );
      }
      if (recipe.steps.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'recipe has no steps' },
          { status: 400 },
        );
      }
      const run = await createRecipeRun({
        recipeId: recipe.id,
        sessionId: session.id,
        stepCount: recipe.steps.length,
      });
      // The background lane (4.1): queue a job and return immediately; the
      // tick worker (mission UI poll or cron) runs it.
      if (body.background === true) {
        const job = await createAgentJob({
          kind: 'recipe-run',
          refId: run.id,
          total: recipe.steps.length,
        });
        return NextResponse.json({ ok: true, run, job });
      }
      await runRecipe({ recipe, run, session });
      const final = await getRecipeRun(run.id);
      return NextResponse.json({ ok: true, run: final ?? run });
    }

    if (action === 'gate') {
      const runId = typeof body.runId === 'string' ? body.runId.trim() : '';
      const decision =
        typeof body.decision === 'string' ? body.decision.trim() : '';
      if (!runId || (decision !== 'approve' && decision !== 'cancel')) {
        return NextResponse.json(
          { ok: false, error: 'runId and decision (approve|cancel) are required' },
          { status: 400 },
        );
      }
      const run = await getRecipeRun(runId);
      if (!run || run.status !== 'gated') {
        return NextResponse.json(
          { ok: false, error: 'no gated run with that id' },
          { status: 404 },
        );
      }
      if (decision === 'cancel') {
        await updateRecipeRun(run.id, { status: 'canceled' });
        const canceled = await getRecipeRun(run.id);
        return NextResponse.json({ ok: true, run: canceled ?? run });
      }
      // Approve: resume from the NEXT step with the gated artifact as the
      // chain's previous envelope.
      const recipes = await listRecipes();
      const recipe = recipes.find((r) => r.id === run.recipeId);
      const session = await getSession(run.sessionId);
      if (!recipe || !session) {
        return NextResponse.json(
          { ok: false, error: 'the run\'s recipe or session is gone' },
          { status: 404 },
        );
      }
      await runRecipe({
        recipe,
        run,
        session,
        startStep: run.currentStep + 1,
      });
      const final = await getRecipeRun(run.id);
      return NextResponse.json({ ok: true, run: final ?? run });
    }

    if (action === 'cancel') {
      // Stop a RUNNING run (the gate path covers gated ones). The job lane
      // sees the flipped status between steps and closes out honestly.
      const runId = typeof body.runId === 'string' ? body.runId.trim() : '';
      if (!runId) {
        return NextResponse.json(
          { ok: false, error: 'runId is required' },
          { status: 400 },
        );
      }
      const run = await getRecipeRun(runId);
      if (!run || run.status !== 'running') {
        return NextResponse.json(
          { ok: false, error: 'no running run with that id' },
          { status: 404 },
        );
      }
      await updateRecipeRun(run.id, { status: 'canceled' });
      const canceled = await getRecipeRun(run.id);
      return NextResponse.json({ ok: true, run: canceled ?? run });
    }

    if (action === 'retry') {
      // Re-queue a settled-as-stopped run (failed/canceled) from the step it
      // stopped at — the same resume plumbing the gate path uses. Completed
      // steps never re-run.
      const runId = typeof body.runId === 'string' ? body.runId.trim() : '';
      if (!runId) {
        return NextResponse.json(
          { ok: false, error: 'runId is required' },
          { status: 400 },
        );
      }
      const run = await getRecipeRun(runId);
      if (!run || (run.status !== 'failed' && run.status !== 'canceled')) {
        return NextResponse.json(
          { ok: false, error: 'no failed or canceled run with that id' },
          { status: 404 },
        );
      }
      const recipes = await listRecipes();
      const recipe = recipes.find((r) => r.id === run.recipeId);
      if (!recipe) {
        return NextResponse.json(
          { ok: false, error: 'the run\'s recipe is gone' },
          { status: 404 },
        );
      }
      // Reset the stopped step: 'failed'/'skipped' -> pending so the lane
      // re-runs it; earlier done/gated steps are untouched.
      const stepsState = run.stepsState.map((s) =>
        s.status === 'failed' || s.status === 'skipped'
          ? { ...s, status: 'pending' as const, note: '' }
          : s,
      );
      await updateRecipeRun(run.id, { status: 'running', stepsState });
      const job = await createAgentJob({
        kind: 'recipe-run',
        refId: run.id,
        total: recipe.steps.length,
      });
      const retried = await getRecipeRun(run.id);
      return NextResponse.json({ ok: true, run: retried ?? run, job });
    }

    // Share Run recap (Phase 3): mint (or return) the run's ONE live
    // public link. The token never appears in the run event text — the
    // trust spine records the exposure, not the capability.
    if (action === 'share') {
      const runId = typeof body.runId === 'string' ? body.runId.trim() : '';
      if (!runId) {
        return NextResponse.json(
          { ok: false, error: 'runId is required' },
          { status: 400 },
        );
      }
      const run = await getRecipeRun(runId);
      if (!run) {
        return NextResponse.json(
          { ok: false, error: 'run not found' },
          { status: 404 },
        );
      }
      const share = await createRunShare(run.id);
      await logRunEvent({
        runId: run.id,
        kind: 'share-created',
        text: 'Public recap link created — transcript, build map, and money map are readable by anyone with the link.',
      });
      return NextResponse.json({
        ok: true,
        share,
        url: shareRunUrl(share.token),
      });
    }

    if (action === 'unshare') {
      const runId = typeof body.runId === 'string' ? body.runId.trim() : '';
      if (!runId) {
        return NextResponse.json(
          { ok: false, error: 'runId is required' },
          { status: 400 },
        );
      }
      const run = await getRecipeRun(runId);
      if (!run) {
        return NextResponse.json(
          { ok: false, error: 'run not found' },
          { status: 404 },
        );
      }
      await revokeRunShare(run.id);
      await logRunEvent({
        runId: run.id,
        kind: 'share-revoked',
        text: 'Public recap link revoked — the old URL 404s from now on.',
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'watch') {

      const sessionId =
        typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
      if (!sessionId) {
        return NextResponse.json(
          { ok: false, error: 'sessionId is required' },
          { status: 400 },
        );
      }
      // The optional metric trigger (Phase 2): null clears it, an object
      // sets it — and an INVALID spec is a 400, never a silent "no
      // trigger" save.
      let trigger: WatchTrigger | null | undefined = undefined;
      if (body.trigger !== undefined) {
        if (body.trigger === null) {
          trigger = null;
        } else {
          const parsed = normalizeWatchTrigger(body.trigger);
          if (!parsed) {
            return NextResponse.json(
              {
                ok: false,
                error:
                  'invalid trigger — needs { metric: one of the rollup metrics, op: lt|gte, value: number }',
              },
              { status: 400 },
            );
          }
          trigger = parsed;
        }
      }
      const watchlist = await upsertWatchlist({
        sessionId,
        recipeSlug:
          typeof body.recipeSlug === 'string' ? body.recipeSlug : undefined,
        ...(trigger !== undefined ? { trigger } : {}),
      });
      return NextResponse.json({ ok: true, watchlist });
    }

    // Owner-authored plays (Phase 2): fork & edit. Saves BY SLUG (upsert)
    // — forking a house play writes a new slug; re-saving your own slug
    // updates your play. An invalid draft is a 400 with the needs-list,
    // never a silent partial save.
    if (action === 'save') {
      const draft = {
        slug: typeof body.slug === 'string' ? body.slug.trim() : '',
        name: typeof body.name === 'string' ? body.name.trim() : '',
        description:
          typeof body.description === 'string' ? body.description : '',
        budgetEstCents:
          typeof body.budgetEstCents === 'number' &&
          Number.isFinite(body.budgetEstCents) &&
          body.budgetEstCents > 0
            ? Math.floor(body.budgetEstCents)
            : 150,
        steps: Array.isArray(body.steps) ? body.steps : [],
      };
      const errors = recipeDraftErrors(draft);
      if (errors.length > 0) {
        return NextResponse.json(
          { ok: false, error: `the play needs ${errors.join(', ')}` },
          { status: 400 },
        );
      }
      const recipe = await upsertRecipe({
        slug: draft.slug,
        name: draft.name,
        description: draft.description,
        steps: normalizeRecipeSteps(draft.steps),
        budgetEstCents: draft.budgetEstCents,
        // Phase 4: the receipts mode. Anything else degrades to 'flag'
        // (v1) — never a silent enforce.
        citationMode: body.citationMode === 'enforce' ? 'enforce' : 'flag',
      });

      return NextResponse.json({ ok: true, recipe });
    }

    if (action === 'unwatch') {
      const id = typeof body.id === 'string' ? body.id.trim() : '';
      if (!id) {
        return NextResponse.json(
          { ok: false, error: 'id is required' },
          { status: 400 },
        );
      }
      await deleteWatchlist(id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { ok: false, error: 'unknown action' },
      { status: 400 },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'request failed' },
      { status: 500 },
    );
  }
}
