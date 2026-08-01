'use client';

/**
 * Mission Control (roadmap UI thread): the loop as the home screen. One
 * panel on /admin — the strip (gates badge, today's fleet spend, the job
 * lane, active watches), crew presence (who's working, on what, which
 * step), and the FLEET's live event feed (cross-run, newest first).
 *
 * The 2s poll is the bridge while anything is active or gated (SSE is the
 * later upgrade); 30s when idle so a cron-fired run still surfaces.
 * Read-only by design: gate decisions happen on the run page, this is
 * the place that tells you one is waiting.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import {
  Activity,
  ArrowRight,
  Banknote,
  Eye,
  Loader2,
  PauseCircle,
  Zap,
} from 'lucide-react';
import type {
  Recipe,
  RecipeRun,
} from '@/lib/mothermode/research/recipes/types';
import type { RecipeRunEvent } from '@/lib/mothermode/research/recipes/store';
import type { AgentJob } from '@/lib/mothermode/research/recipes/jobs';
import type { ResearchWatchlist } from '@/lib/mothermode/research/watchlists';
import {
  expertDisplayName,
  formatAgo,
  missionSummary,
  type ExpertInfo,
} from '@/lib/mothermode/research/recipes/crew';

const RECIPES_API = '/api/admin/mothermode-recipes';
const JOBS_API = '/api/admin/mothermode-jobs';
const FEED_ROWS = 12;

interface Payload {
  recipes: Recipe[];
  runs: RecipeRun[];
  watchlists: ResearchWatchlist[];
  experts: ExpertInfo[];
}

export default function MissionControl() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [events, setEvents] = useState<RecipeRunEvent[] | null>(null);
  /** null = no reading yet OR the log read failed — both render 'n/a'. */
  const [costCentsToday, setCostCentsToday] = useState<number | null>(null);
  const [jobs, setJobs] = useState<AgentJob[]>([]);

  const load = useCallback(async () => {
    const [main, activity, lane] = await Promise.all([
      fetch(RECIPES_API, { cache: 'no-store' }).then((r) => r.json()),
      fetch(`${RECIPES_API}?activity=1`, { cache: 'no-store' }).then((r) =>
        r.json(),
      ),
      fetch(JOBS_API, { cache: 'no-store' }).then((r) => r.json()),
    ]);
    setPayload({
      recipes: main.recipes ?? [],
      runs: main.runs ?? [],
      watchlists: main.watchlists ?? [],
      experts: main.experts ?? [],
    });
    setEvents(activity.events ?? []);
    setCostCentsToday(
      typeof activity.fleetCostCentsToday === 'number'
        ? activity.fleetCostCentsToday
        : null,
    );
    setJobs(lane.jobs ?? []);
  }, []);

  const live =
    payload?.runs.some(
      (r) => r.status === 'running' || r.status === 'gated',
    ) ?? false;

  // The bridge: 2s while anything needs watching, 30s at idle.
  useEffect(() => {
    load().catch(() => {});
    const t = window.setInterval(
      () => load().catch(() => {}),
      live ? 2000 : 30000,
    );
    return () => window.clearInterval(t);
  }, [load, live]);

  const summary = useMemo(
    () => (payload ? missionSummary(payload) : null),
    [payload],
  );
  const experts = payload?.experts ?? [];

  /** runId → recipe name, for the feed rows. */
  const recipeNameForRun = useCallback(
    (runId: string): string => {
      const run = payload?.runs.find((r) => r.id === runId);
      const recipe = payload?.recipes.find((r) => r.id === run?.recipeId);
      return recipe?.name ?? 'a play';
    },
    [payload],
  );

  const queuedJobs = jobs.filter((j) => j.status === 'queued').length;
  const runningJobs = jobs.filter((j) => j.status === 'running').length;

  return (
    <section className="mt-8 rounded-2xl border border-bone/10 bg-bone/[0.02] p-4">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-brass" />
        <h2 className="text-sm font-semibold text-bone/85">Crew activity</h2>
        {live && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-300">
            <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-300" />
            live
          </span>
        )}
        <Link
          href="/admin/recipes"
          className="ml-auto inline-flex items-center gap-1 text-[11px] text-brass/80 hover:text-brass"
        >
          all runs <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* the strip: what needs you, what it cost, what the lane is doing */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
        {summary && summary.gatesWaiting > 0 && (
          <Link
            href="/admin/recipes"
            className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 font-semibold text-amber-300 hover:bg-amber-400/20"
          >
            <PauseCircle className="h-3 w-3" />
            {summary.gatesWaiting} gate{summary.gatesWaiting === 1 ? '' : 's'}{' '}
            waiting on you
          </Link>
        )}
        <span
          className="inline-flex items-center gap-1 rounded-full bg-bone/10 px-2 py-0.5 text-bone/55"
          title="Estimated agent spend today, across every session (tool-call estimates, not a ledger)"
        >
          <Banknote className="h-3 w-3 text-bone/40" />
          {costCentsToday === null
            ? 'spend n/a'
            : `~$${(costCentsToday / 100).toFixed(2)} today est.`}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-bone/10 px-2 py-0.5 text-bone/55">
          <Zap className="h-3 w-3 text-bone/40" />
          lane: {runningJobs} running · {queuedJobs} queued
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-bone/10 px-2 py-0.5 text-bone/55">
          <Eye className="h-3 w-3 text-bone/40" />
          {summary?.watches ?? 0} watching
        </span>
      </div>

      {/* crew presence: who's working, on what, where */}
      {summary && summary.crew.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {summary.crew.map((c) => (
            <Link
              key={c.runId}
              href={`/admin/recipes/${c.runId}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-brass/25 bg-brass/[0.07] px-2 py-0.5 text-[10px] font-medium text-brass/90 hover:bg-brass/15"
            >
              <Loader2 className="h-3 w-3 animate-spin" />
              {expertDisplayName(c.expertSlug, experts)} · {c.recipeName} ·{' '}
              {c.stepLabel}
            </Link>
          ))}
        </div>
      )}

      {/* the fleet feed: what the crew did, newest first */}
      <div className="mt-3 border-t border-bone/10 pt-2">
        {events === null ? (
          <div className="flex items-center gap-1.5 py-1 text-[11px] text-bone/40">
            <Loader2 className="h-3 w-3 animate-spin" /> tuning in…
          </div>
        ) : events.length === 0 ? (
          <p className="py-1 text-[11px] text-bone/35">
            The crew is idle — run a play from{' '}
            <Link href="/admin/recipes" className="text-brass/80 hover:text-brass">
              Recipes
            </Link>{' '}
            and this becomes the live feed.
          </p>
        ) : (
          <ol className="space-y-0.5">
            {events.slice(0, FEED_ROWS).map((e) => (
              <li key={e.id} className="flex items-start gap-1.5 text-[11px]">
                <span
                  className={clsx(
                    'shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                    e.kind === 'failed' || e.kind === 'handoff-failed'
                      ? 'bg-red-400/15 text-red-300'
                      : e.kind === 'gated'
                        ? 'bg-amber-400/15 text-amber-300'
                        : e.kind === 'done' || e.kind === 'handoff-completed'
                          ? 'bg-emerald-400/15 text-emerald-300'
                          : 'bg-bone/10 text-bone/50',
                  )}
                >
                  {e.kind.replace('-', ' ')}
                </span>
                <span className="min-w-0 flex-1 leading-snug text-bone/55">
                  <Link
                    href={`/admin/recipes/${e.runId}`}
                    className="text-brass/70 hover:text-brass"
                  >
                    {recipeNameForRun(e.runId)}
                  </Link>
                  {' — '}
                  {e.text}
                </span>
                <span className="shrink-0 text-[9px] text-bone/30">
                  {formatAgo(e.createdAt)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
