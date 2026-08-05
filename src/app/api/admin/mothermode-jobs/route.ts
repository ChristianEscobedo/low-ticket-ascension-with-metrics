import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  listAgentJobs,
  claimNextAgentJob,
  updateAgentJob,
  createAgentJob,
} from '@/lib/mothermode/research/recipes/jobs';
import {
  getRecipeRun,
  listRecipes,
  getRecipe,
  createRecipeRun,
} from '@/lib/mothermode/research/recipes/store';
import { runRecipe } from '@/lib/mothermode/research/recipes/run';
import { nextUnfinishedStepIndex } from '@/lib/mothermode/research/recipes/crew';
import { getSession } from '@/lib/mothermode/research/store';
import {
  listWatchlists,
  updateWatchlist,
  isWatchlistDue,
  isTriggerCoolingDown,
  evaluateWatchTrigger,
  readWatchTriggerMetrics,
  type ResearchWatchlist,
} from '@/lib/mothermode/research/watchlists';
import { distillSessionLearnings } from '@/lib/mothermode/research/distill';

/** Queue a background run for a watch — the digest's one side effect.
 *  False (never throws) when the recipe is gone or the write fails: one
 *  bad watch never stops the pass. */
async function queueWatchRun(w: ResearchWatchlist): Promise<boolean> {
  try {
    const recipe = await getRecipe(w.recipeSlug);
    if (!recipe || recipe.steps.length === 0) return false;
    const run = await createRecipeRun({
      recipeId: recipe.id,
      sessionId: w.sessionId,
      stepCount: recipe.steps.length,
    });
    await createAgentJob({
      kind: 'recipe-run',
      refId: run.id,
      total: recipe.steps.length,
    });
    return true;
  } catch {
    return false;
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// A claimed recipe run is several agent turns; give it room.
export const maxDuration = 300;

/** A Vercel cron carries the shared secret; the owner carries the session. */
function isCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

/**
 * The background job lane (roadmap 4.1). Admin, or cron via CRON_SECRET.
 *
 *   GET                  -> admin: { ok, jobs }. cron: runs the weekly
 *                           DIGEST (queue due watchlists), then the
 *                           metric-TRIGGER pass (armed triggers evaluated
 *                           against the click/lead/revenue rollups — a
 *                           trip queues a run), then one tick.
 *   POST {action:'tick'} -> claims the OLDEST queued job and runs it to a
 *                           finish state (done/failed), stamping progress.
 */
export async function GET(request: NextRequest) {
  if (isCron(request)) {
    // The weekly digest (4.2): every due watchlist gets a queued
    // background run, then one tick starts the lane.
    const all = await listWatchlists();
    const due = all.filter((w) => isWatchlistDue(w));
    let queued = 0;
    for (const w of due) {
      if (await queueWatchRun(w)) {
        await updateWatchlist(w.id, {
          lastRunAt: new Date().toISOString(),
        }).catch(() => {});
        queued += 1;
      }
    }

    // Metric triggers (Phase 2): armed watches (active, trigger set,
    // outside the cooldown) evaluated against the rollups. A fire queues
    // the same background run the weekly digest would and restarts BOTH
    // clocks — the fire IS this period's run. An unreadable metric never
    // fires (the evaluator's spending rule).
    let triggered = 0;
    const triggerLog: string[] = [];
    const armed = all.filter(
      (w) => w.status === 'active' && w.trigger && !isTriggerCoolingDown(w),
    );
    if (armed.length > 0) {
      const metrics = await readWatchTriggerMetrics();
      for (const w of armed) {
        const verdict = evaluateWatchTrigger(w.trigger!, metrics);
        if (!verdict.tripped) continue;
        if (await queueWatchRun(w)) {
          const now = new Date().toISOString();
          await updateWatchlist(w.id, {
            lastRunAt: now,
            lastTriggeredAt: now,
          }).catch(() => {});
          triggered += 1;
          triggerLog.push(`${w.recipeSlug}: ${verdict.reason}`);
        }
      }
    }
    return NextResponse.json({
      ok: true,
      due: due.length,
      queued,
      triggered,
      triggerLog: triggerLog.slice(0, 10),
    });
  }
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;
  const jobs = await listAgentJobs({ limit: 20 });
  return NextResponse.json({ ok: true, jobs });
}

export async function POST(request: NextRequest) {
  if (!isCron(request)) {
    const guard = await requireAdminRoute();
    if (!guard.ok) return guard.response!;
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    /* an empty body ticks too */
  }
  const action = typeof body.action === 'string' ? body.action.trim() : 'tick';
  if (action !== 'tick') {
    return NextResponse.json(
      { ok: false, error: 'unknown action' },
      { status: 400 },
    );
  }

  const job = await claimNextAgentJob();
  if (!job) {
    return NextResponse.json({ ok: true, job: null, note: 'lane empty' });
  }

  try {
    if (job.kind !== 'recipe-run') {
      throw new Error(`unknown job kind "${job.kind}"`);
    }
    const run = await getRecipeRun(job.refId);
    const recipes = await listRecipes();
    const recipe = run ? recipes.find((r) => r.id === run.recipeId) : null;
    const session = run ? await getSession(run.sessionId) : null;
    if (!run || !recipe || !session) {
      throw new Error('the job\'s run, recipe, or session is gone');
    }

    // The step-sized lane: ONE step per claimed job. The resume index is
    // the first unfinished step (a fresh run starts at 0; a re-claimed run
    // continues where the last job stopped; a crash mid-step re-runs that
    // step — the artifact dedupe makes that honest).
    const startStep =
      run.status === 'gated'
        ? run.currentStep + 1
        : nextUnfinishedStepIndex(run);
    await updateAgentJob(job.id, {
      progress: {
        step: startStep,
        total: recipe.steps.length,
        note: `step ${startStep + 1} of ${recipe.steps.length}`,
      },
    });
    const finalStatus = await runRecipe({
      recipe,
      run,
      session,
      startStep,
      maxSteps: 1,
    });

    // The cap bit: this job did its slice — queue the NEXT step's job and
    // finish this one done. The run stays 'running' until the last slice.
    if (finalStatus === 'running') {
      const fresh = await getRecipeRun(run.id);
      const nextStep = fresh ? nextUnfinishedStepIndex(fresh) : startStep + 1;
      await createAgentJob({
        kind: 'recipe-run',
        refId: run.id,
        total: recipe.steps.length,
      });
      await updateAgentJob(job.id, {
        status: 'done',
        progress: {
          step: nextStep,
          total: recipe.steps.length,
          note: `advanced to step ${nextStep + 1} of ${recipe.steps.length}`,
        },
        finishedAt: new Date().toISOString(),
      });
      return NextResponse.json({
        ok: true,
        job: { ...job, status: 'done' },
        note: `step-sized lane: advanced, ${recipe.steps.length - nextStep} steps left`,
      });
    }

    const done = finalStatus === 'done' || finalStatus === 'gated';
    // A canceled run is neither done nor failed: the owner stopped it, and
    // the job closes as canceled so the lane reads honestly.
    await updateAgentJob(job.id, {
      status:
        done ? 'done' : finalStatus === 'canceled' ? 'canceled' : 'failed',
      progress: {
        step: recipe.steps.length,
        total: recipe.steps.length,
        note:
          finalStatus === 'gated'
            ? 'waiting on a gate'
            : finalStatus === 'canceled'
              ? 'canceled by the owner'
              : finalStatus,
      },
      error: done || finalStatus === 'canceled' ? '' : `run finished as ${finalStatus}`,
      finishedAt: new Date().toISOString(),
    });
    // Cross-session memory (4.4): a completed run distills its session's
    // learnings, best-effort — a distill failure never fails the job.
    if (finalStatus === 'done') {
      await distillSessionLearnings(session.id).catch(() => []);
    }
    return NextResponse.json({
      ok: true,
      job: {
        ...job,
        status: done ? 'done' : finalStatus === 'canceled' ? 'canceled' : 'failed',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'job failed';
    await updateAgentJob(job.id, {
      status: 'failed',
      error: message,
      finishedAt: new Date().toISOString(),
    }).catch(() => {});
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
