'use client';

/**
 * /admin/recipes (roadmap 3.2 + the visibility pass): the mission UI.
 *
 * LEFT: searchable, filterable recipe cards — the crew (expert names, in
 * order), step/gate/handoff badges, budget, expandable step preview, run +
 * weekly-watch actions.
 *
 * RIGHT: the runs feed — status pill, progress, relative time, per-step
 * expert chips with expandable detail, clickable step outputs, gate
 * actions, stop/retry, and "open in chat" deep links into the Research
 * Lab transcript (?session&run) where the crew's turns live.
 *
 * Polls + ticks the job lane while any run is active (no cron needed).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import {
  Play,
  Loader2,
  Check,
  X,
  PauseCircle,
  CheckCircle2,
  XCircle,
  CircleDashed,
  Workflow,
  Search,
  MessagesSquare,
  FileText,
  RotateCcw,
  ChevronDown,
  MinusCircle,
  Banknote,
  Zap,
  GitFork,
} from 'lucide-react';
import type {
  Recipe,
  RecipeRun,
  RecipeStepState,
} from '@/lib/mothermode/research/recipes/types';
import type { RecipeRunEvent } from '@/lib/mothermode/research/recipes/store';
import {
  expertDisplayName,
  recipeCrew,
  runProgress,
  formatAgo,
  researchLabHref,
  watchTriggerLine,
  TRIGGER_METRIC_LABELS,
  type ExpertInfo,
} from '@/lib/mothermode/research/recipes/crew';
import {
  moneyMapSummary,
  type RunMoneyMap,
} from '@/lib/mothermode/research/moneyMap';
import type {
  ResearchWatchlist,
  TriggerMetric,
  WatchTrigger,
} from '@/lib/mothermode/research/watchlists';
import RecipeDraftEditor, {
  blankRecipeDraft,
  draftStepsPayload,
  forkDraftFrom,
  type RecipeDraft,
} from './RecipeDraftEditor';
import type { ResearchSession } from '@/lib/mothermode/research/types';

const API = '/api/admin/mothermode-recipes';
const SESSIONS_API = '/api/admin/mothermode-research';

const STATUS_STYLE: Record<RecipeRun['status'], string> = {
  running: 'border-brass/40 bg-brass/10 text-brass',
  gated: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  done: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  failed: 'border-red-400/30 bg-red-400/10 text-red-300',
  canceled: 'border-bone/20 text-bone/40',
};

function StepGlyph({ status }: { status: RecipeStepState['status'] }) {
  if (status === 'done')
    return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />;
  if (status === 'gated')
    return <PauseCircle className="h-3.5 w-3.5 text-amber-300" />;
  if (status === 'failed')
    return <XCircle className="h-3.5 w-3.5 text-red-300" />;
  if (status === 'running')
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-brass" />;
  if (status === 'skipped')
    return <MinusCircle className="h-3.5 w-3.5 text-bone/35" />;
  return <CircleDashed className="h-3.5 w-3.5 text-bone/25" />;
}

/** Deduped list, order kept (no Set spread — ES5 target). */
function uniq(list: Array<string | undefined>): string[] {
  const out: string[] = [];
  for (const item of list) {
    if (item && !out.includes(item)) out.push(item);
  }
  return out;
}

/** The handoff targets a recipe fires, labeled for badges. */
function handoffBadges(recipe: Recipe): string[] {
  const LABELS: Record<string, string> = {
    'planner-cards': 'planner cards',
    'leadgen-kit': 'lead kit',
    'email-kit': 'email kit',
    'sales-funnel': 'funnel draft',
    system: 'full system',
  };
  return uniq(recipe.steps.map((s) => s.handoff?.target)).map(
    (t) => LABELS[t] ?? t,
  );
}

type FilterKey = 'all' | 'gated' | 'handoffs' | 'sweeps';
const FILTERS: Array<{
  key: FilterKey;
  label: string;
  match: (r: Recipe) => boolean;
}> = [
  { key: 'all', label: 'All', match: () => true },
  {
    key: 'gated',
    label: 'With gates',
    match: (r) => r.steps.some((s) => s.gate === 'approve'),
  },
  {
    key: 'handoffs',
    label: 'Builds assets',
    match: (r) => r.steps.some((s) => s.handoff),
  },
  {
    key: 'sweeps',
    label: 'Sweeps',
    match: (r) => r.steps.every((s) => s.gate === 'auto' && !s.handoff),
  },
];

// ---------------------------------------------------------------------------
// Recipe card
// ---------------------------------------------------------------------------

function RecipeCard({
  recipe,
  experts,
  watch,
  busy,
  canRun,
  onStart,
  onToggleWatch,
  onSetTrigger,
  onFork,
}: {
  recipe: Recipe;
  experts: ExpertInfo[];
  /** The session's watch row for this recipe (null = not watched). */
  watch: ResearchWatchlist | null;
  busy: boolean;
  canRun: boolean;
  onStart: () => void;
  onToggleWatch: () => void;
  onSetTrigger: (trigger: WatchTrigger | null) => void;
  onFork: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  /** The trigger mini-form's state (open + the three fields). */
  const [triggerOpen, setTriggerOpen] = useState(false);
  const [triggerMetric, setTriggerMetric] =
    useState<TriggerMetric>('recentClicks');
  const [triggerOp, setTriggerOp] = useState<'lt' | 'gte'>('lt');
  const [triggerValue, setTriggerValue] = useState('');
  const crew = recipeCrew(recipe);
  const gateCount = recipe.steps.filter((s) => s.gate === 'approve').length;
  const badges = handoffBadges(recipe);
  const visibleSteps = expanded ? recipe.steps : recipe.steps.slice(0, 3);
  const watching = !!watch;
  const armedLine = watchTriggerLine(watch?.trigger);

  /** Validate + hand the trigger up. Counts are integers; revenue is
   *  entered in dollars and stored in cents (money is cents until
   *  formatted). */
  const submitTrigger = () => {
    const raw = Number.parseFloat(triggerValue);
    if (!Number.isFinite(raw) || raw < 0) return;
    onSetTrigger({
      metric: triggerMetric,
      op: triggerOp,
      value:
        triggerMetric === 'revenueCents'
          ? Math.round(raw * 100)
          : Math.round(raw),
    });
    setTriggerOpen(false);
    setTriggerValue('');
  };

  return (
    <div className="rounded-xl border border-bone/10 bg-bone/[0.03] px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="min-w-0 truncate text-sm font-medium text-bone/90">
          {recipe.name}
        </span>
        <span className="ml-auto shrink-0 text-[10px] text-bone/35">
          ~${(recipe.budgetEstCents / 100).toFixed(2)} cap
        </span>
      </div>
      <p className="mt-0.5 text-xs leading-snug text-bone/45">
        {recipe.description}
      </p>

      {/* the crew: who works this play, in order */}
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {crew.map((slug, i) => (
          <span key={slug} className="inline-flex items-center gap-1">
            {i > 0 && <span className="text-[9px] text-bone/25">→</span>}
            <span
              className="rounded-full border border-brass/25 bg-brass/[0.08] px-1.5 py-0.5 text-[9px] font-semibold text-brass/90"
              title={experts.find((e) => e.slug === slug)?.tagline || slug}
            >
              {expertDisplayName(slug, experts)}
            </span>
          </span>
        ))}
        <span className="text-[9px] text-bone/30">
          {recipe.steps.length} steps
        </span>
        {gateCount > 0 && (
          <span className="rounded bg-amber-400/15 px-1 py-0.5 text-[9px] font-semibold uppercase text-amber-300">
            {gateCount} gate{gateCount === 1 ? '' : 's'}
          </span>
        )}
        {badges.map((b) => (
          <span
            key={b}
            className="rounded bg-bone/10 px-1 py-0.5 text-[9px] uppercase tracking-wide text-bone/50"
          >
            {b}
          </span>
        ))}
      </div>

      {/* steps preview, expandable */}
      <div className="mt-1.5 space-y-0.5">
        {visibleSteps.map((s, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 text-[11px] text-bone/50"
          >
            <span className="text-bone/30">{i + 1}.</span>
            <span className="font-medium text-brass/80">
              {expertDisplayName(s.expert, experts)}
            </span>
            <span className="truncate">→ {s.outputArtifact}</span>
            {s.gate === 'approve' && (
              <span className="rounded bg-amber-400/15 px-1 text-[9px] font-semibold uppercase text-amber-300">
                gate
              </span>
            )}
            {s.handoff && (
              <span className="rounded bg-bone/10 px-1 text-[9px] uppercase text-bone/45">
                {s.handoff.generate ? 'builds' : 'drafts'}
              </span>
            )}
          </div>
        ))}
        {recipe.steps.length > 3 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[10px] text-brass/70 hover:text-brass"
          >
            {expanded
              ? 'show fewer'
              : `+${recipe.steps.length - 3} more steps`}
          </button>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={onStart}
          disabled={busy || !canRun}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brass px-2.5 py-1 text-xs font-semibold text-ink hover:bg-brass/90 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Play className="h-3 w-3" />
          )}
          Run
        </button>
        <button
          type="button"
          onClick={onToggleWatch}
          disabled={busy || !canRun}
          className={clsx(
            'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] disabled:opacity-50',
            watching
              ? 'border-brass/40 bg-brass/10 text-brass'
              : 'border-bone/15 text-bone/50 hover:text-bone',
          )}
          title={
            watching
              ? 'Watching weekly — click to stop'
              : 'Run this recipe every week in the selected session (the 8am cron queues it)'
          }
        >
          <PauseCircle className="h-3 w-3" />
          {watching ? 'Watching weekly' : 'Watch weekly'}
        </button>
        <button
          type="button"
          onClick={onFork}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-lg border border-bone/15 px-2 py-1 text-[11px] text-bone/50 hover:border-brass/40 hover:text-brass disabled:opacity-50"
          title="Clone this play into the editor — reorder steps, change the crew, save it as your own (writes by slug)"
        >
          <GitFork className="h-3 w-3" />
          Fork
        </button>
      </div>

      {/* the metric trigger (Phase 2): the armed threshold, or the way to
          set one — evaluated on the digest pass off the same rollups the
          dashboards read */}
      {watching && armedLine && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-amber-300/80">
          <Zap className="h-3 w-3 shrink-0" />
          <span className="min-w-0 truncate">{armedLine}</span>
          <button
            type="button"
            onClick={() => onSetTrigger(null)}
            disabled={busy}
            className="ml-auto shrink-0 text-bone/30 hover:text-bone/60"
            title="Remove the trigger (the weekly watch stays)"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      {watching && !watch?.trigger && (
        <div className="mt-1.5">
          {triggerOpen ? (
            <div className="flex flex-wrap items-center gap-1 text-[10px]">
              <span className="text-bone/35">when</span>
              <select
                value={triggerMetric}
                onChange={(e) =>
                  setTriggerMetric(e.target.value as TriggerMetric)
                }
                className="rounded border border-bone/15 bg-ink px-1 py-0.5 text-bone/70"
              >
                {Object.entries(TRIGGER_METRIC_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={triggerOp}
                onChange={(e) => setTriggerOp(e.target.value as 'lt' | 'gte')}
                className="rounded border border-bone/15 bg-ink px-1 py-0.5 text-bone/70"
              >
                <option value="lt">drop below</option>
                <option value="gte">reach</option>
              </select>
              <input
                value={triggerValue}
                onChange={(e) => setTriggerValue(e.target.value)}
                placeholder={triggerMetric === 'revenueCents' ? 'dollars' : 'count'}
                className="w-16 rounded border border-bone/15 bg-ink px-1 py-0.5 text-bone/70 outline-none placeholder:text-bone/25"
              />
              <button
                type="button"
                onClick={submitTrigger}
                disabled={busy || !triggerValue.trim()}
                className="rounded bg-brass px-1.5 py-0.5 font-semibold text-ink disabled:opacity-50"
              >
                Set
              </button>
              <button
                type="button"
                onClick={() => setTriggerOpen(false)}
                className="text-bone/35 hover:text-bone"
              >
                cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setTriggerOpen(true)}
              className="inline-flex items-center gap-1 text-[10px] text-bone/35 hover:text-brass"
              title="Also run this play when a metric crosses a line you set — evaluated on the digest pass, off the same rollups as the dashboards. A trigger never fires on a failed read."
            >
              <Zap className="h-3 w-3" /> add a metric trigger
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Run row
// ---------------------------------------------------------------------------

function RunRow({
  run,
  recipe,
  experts,
  busy,
  onGate,
  onCancel,
  onRetry,
}: {
  run: RecipeRun;
  recipe: Recipe | undefined;
  experts: ExpertInfo[];
  busy: boolean;
  onGate: (runId: string, decision: 'approve' | 'cancel') => void;
  onCancel: (runId: string) => void;
  onRetry: (runId: string) => void;
}) {
  const [expanded, setExpanded] = useState(run.status === 'gated');
  /** The trust-spine timeline, lazy-fetched on first expand. */
  const [events, setEvents] = useState<RecipeRunEvent[] | null>(null);
  /** The money map's summary line: undefined = not fetched, null = nothing
   *  to say yet (no handoffs / no tracked results). */
  const [moneyLine, setMoneyLine] = useState<string | null | undefined>(
    undefined,
  );
  const progress = runProgress(run);
  const chatHref = researchLabHref({ sessionId: run.sessionId, runId: run.id });

  /** The lazy reads behind an expanded row (events timeline + money line).
   *  Shared by the toggle AND the mount effect below. */
  const fetchExpanded = useCallback(async () => {
    if (events === null) {
      try {
        const res = await fetch(`${API}?events=${run.id}`, {
          cache: 'no-store',
        });
        const json = await res.json();
        setEvents((json.events ?? []) as RecipeRunEvent[]);
      } catch {
        setEvents([]);
      }
    }
    if (moneyLine === undefined) {
      try {
        const res = await fetch(`${API}?money=${run.id}`, {
          cache: 'no-store',
        });
        const json = await res.json();
        setMoneyLine(
          json.moneyMap
            ? moneyMapSummary(json.moneyMap as RunMoneyMap)
            : null,
        );
      } catch {
        setMoneyLine(null);
      }
    }
  }, [events, moneyLine, run.id]);

  const toggleExpanded = () => {
    const opening = !expanded;
    setExpanded(opening);
    if (opening) fetchExpanded().catch(() => {});
  };

  // A gated run starts expanded — its fetches must fire on mount, not wait
  // for a collapse/expand that may never come.
  useEffect(() => {
    if (expanded) fetchExpanded().catch(() => {});
    // Only when the expanded state flips open; fetchExpanded guards the
    // already-loaded case.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  return (
    <div className="rounded-xl border border-bone/10 bg-bone/[0.02] px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span
          className={clsx(
            'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase',
            STATUS_STYLE[run.status],
          )}
        >
          {run.status}
        </span>
        <span className="min-w-0 truncate text-sm text-bone/80">
          {recipe?.name ?? 'recipe'}
        </span>
        <span className="ml-auto shrink-0 text-[10px] text-bone/35">
          ~${(run.estCostCents / 100).toFixed(2)}
          {run.createdAt ? ` · ${formatAgo(run.createdAt)}` : ''}
        </span>
        <Link
          href={`/admin/recipes/${run.id}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-bone/15 px-1.5 py-0.5 text-[10px] font-medium text-bone/60 hover:border-brass/40 hover:text-brass"
          title="The run page — money map, steps, timeline, transcript in one screen"
        >
          <Banknote className="h-3 w-3" />
          Run page
        </Link>
        <Link
          href={chatHref}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-brass/30 px-1.5 py-0.5 text-[10px] font-medium text-brass hover:bg-brass/10"
          title="Open this run in the Research Lab chat — the crew's turns, step by step"
        >
          <MessagesSquare className="h-3 w-3" />
          Open in chat
        </Link>
        <button
          type="button"
          onClick={toggleExpanded}
          className="shrink-0 rounded p-0.5 text-bone/40 hover:text-bone"
          aria-label={expanded ? 'Collapse run detail' : 'Expand run detail'}
        >
          <ChevronDown
            className={clsx(
              'h-3.5 w-3.5 transition-transform',
              expanded && 'rotate-180',
            )}
          />
        </button>
      </div>

      {/* progress: completed steps of the play */}
      {progress.total > 0 && (
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-bone/10">
            <div
              className={clsx(
                'h-full rounded-full transition-all',
                run.status === 'failed'
                  ? 'bg-red-400/70'
                  : run.status === 'done'
                    ? 'bg-emerald-400/80'
                    : 'bg-brass/80',
              )}
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <span className="shrink-0 text-[9px] text-bone/35">
            {progress.done}/{progress.total} steps
          </span>
        </div>
      )}

      {/* the crew, glanceable without expanding */}
      {recipe && (
        <p className="mt-1 text-[10px] text-bone/40">
          crew:{' '}
          {recipeCrew(recipe)
            .map((s) => expertDisplayName(s, experts))
            .join(' → ')}
        </p>
      )}

      {expanded && (
        <div className="mt-1.5 space-y-1">
          {run.stepsState.map((s, i) => {
            const step = recipe?.steps[i];
            const baseNote = step
              ? `step ${i + 1}: ${step.expert} → ${step.outputArtifact}`
              : `step ${i + 1}`;
            const extra = s.note.startsWith(baseNote)
              ? s.note.slice(baseNote.length).trim()
              : s.note;
            return (
              <div key={i} className="flex items-start gap-2 text-xs">
                <StepGlyph status={s.status} />
                <div className="min-w-0 flex-1">
                  <span className="text-bone/60">
                    {step ? (
                      <>
                        <span className="font-medium text-brass/80">
                          {expertDisplayName(step.expert, experts)}
                        </span>
                        <span className="text-bone/35">
                          {' '}
                          → {step.outputArtifact}
                        </span>
                      </>
                    ) : (
                      <span className="text-bone/50">step {i + 1}</span>
                    )}
                    {extra && (
                      <span className="block text-[11px] text-bone/40">
                        {s.status === 'gated' ? s.note : extra}
                      </span>
                    )}
                  </span>
                </div>
                {s.artifactId && (s.status === 'done' || s.status === 'gated') && (
                  <Link
                    href={researchLabHref({
                      sessionId: run.sessionId,
                      runId: run.id,
                      artifactId: s.artifactId,
                    })}
                    className="inline-flex shrink-0 items-center gap-1 rounded border border-bone/15 px-1.5 py-0.5 text-[10px] text-bone/55 hover:border-brass/40 hover:text-brass"
                    title={
                      s.status === 'gated'
                        ? 'Review the artifact before approving'
                        : 'Open this step’s output in the lab'
                    }
                  >
                    <FileText className="h-3 w-3" />
                    {s.status === 'gated' ? 'review' : 'output'}
                  </Link>
                )}
              </div>
            );
          })}

          {/* the money line (Phase 2): what this run made and brought back */}
          {moneyLine && (
            <Link
              href={`/admin/recipes/${run.id}`}
              className="mt-1 flex items-center gap-1.5 rounded-lg border border-brass/20 bg-brass/[0.05] px-2 py-1 text-[11px] font-medium text-brass/90 hover:bg-brass/10"
              title="Open the run page for the full money map"
            >
              <Banknote className="h-3 w-3 shrink-0" />
              {moneyLine}
            </Link>
          )}

          {/* the trust-spine timeline: what the run did, in order */}
          <div className="mt-2 border-t border-bone/10 pt-1.5">
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-bone/35">
              Timeline
            </span>
            {events === null ? (
              <div className="flex items-center gap-1.5 py-1 text-[11px] text-bone/40">
                <Loader2 className="h-3 w-3 animate-spin" /> loading events…
              </div>
            ) : events.length === 0 ? (
              <p className="py-1 text-[11px] text-bone/35">
                No events logged yet (runs from before the event log are
                quiet here).
              </p>
            ) : (
              <ol className="mt-1 space-y-0.5">
                {events.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-start gap-1.5 text-[11px]"
                  >
                    <span className="shrink-0 rounded bg-bone/10 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-bone/50">
                      {e.kind.replace('-', ' ')}
                    </span>
                    <span className="min-w-0 flex-1 leading-snug text-bone/55">
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
        </div>
      )}

      {run.status === 'gated' && (
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onGate(run.id, 'approve')}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg bg-brass px-2.5 py-1 text-xs font-semibold text-ink hover:bg-brass/90 disabled:opacity-50"
          >
            <Check className="h-3 w-3" />
            Approve & continue
          </button>
          <button
            type="button"
            onClick={() => onGate(run.id, 'cancel')}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg border border-bone/15 px-2.5 py-1 text-xs text-bone/60 hover:bg-bone/10 disabled:opacity-50"
          >
            <X className="h-3 w-3" />
            Cancel run
          </button>
        </div>
      )}
      {run.status === 'running' && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => onCancel(run.id)}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg border border-bone/15 px-2.5 py-1 text-xs text-bone/60 hover:bg-bone/10 disabled:opacity-50"
            title="Stop after the in-flight step (the current expert finishes its turn)"
          >
            <X className="h-3 w-3" />
            Stop run
          </button>
        </div>
      )}
      {(run.status === 'failed' || run.status === 'canceled') && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => onRetry(run.id)}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg border border-brass/30 px-2.5 py-1 text-xs font-medium text-brass hover:bg-brass/10 disabled:opacity-50"
            title="Re-queue from the step it stopped at — completed steps never re-run"
          >
            <RotateCcw className="h-3 w-3" />
            Retry from stopped step
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [experts, setExperts] = useState<ExpertInfo[]>([]);
  const [runs, setRuns] = useState<RecipeRun[]>([]);
  const [watchlists, setWatchlists] = useState<ResearchWatchlist[]>([]);
  const [sessions, setSessions] = useState<ResearchSession[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [allSessions, setAllSessions] = useState(false);
  /** The fork/edit draft (Phase 2: owner-authored plays). Null = closed. */
  const [draft, setDraft] = useState<RecipeDraft | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(API, { cache: 'no-store' });
    const json = await res.json();
    setRecipes(json.recipes ?? []);
    setExperts(json.experts ?? []);
    setRuns(json.runs ?? []);
    setWatchlists(json.watchlists ?? []);
  }, []);

  useEffect(() => {
    load().catch(() => setRecipes([]));
    fetch(SESSIONS_API, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        const list = (j.sessions ?? []) as ResearchSession[];
        setSessions(list);
        if (list[0]) setSessionId(list[0].id);
      })
      .catch(() => {});
  }, [load]);

  // Poll while any run is active — and tick the job lane (4.1) so queued
  // background runs drive themselves without a cron.
  useEffect(() => {
    if (!runs.some((r) => r.status === 'running')) return;
    const t = window.setInterval(() => {
      fetch('/api/admin/mothermode-jobs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'tick' }),
      }).catch(() => {});
      load().catch(() => {});
    }, 5000);
    return () => window.clearInterval(t);
  }, [runs, load]);

  const start = async (slug: string) => {
    if (!sessionId) {
      setError('Pick a session to run in first.');
      return;
    }
    setBusy(slug);
    setError('');
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'start', slug, sessionId, background: true }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Run failed');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Run failed');
    } finally {
      setBusy(null);
    }
  };

  const gate = async (runId: string, decision: 'approve' | 'cancel') => {
    setBusy(runId);
    setError('');
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'gate', runId, decision }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Gate failed');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gate failed');
    } finally {
      setBusy(null);
    }
  };

  const cancelRun = async (runId: string) => {
    setBusy(runId);
    setError('');
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', runId }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Cancel failed');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setBusy(null);
    }
  };

  const retryRun = async (runId: string) => {
    setBusy(runId);
    setError('');
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'retry', runId }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Retry failed');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setBusy(null);
    }
  };

  /** The weekly watch (4.2): one per session+recipe, re-adding reactivates. */
  const watchFor = (slug: string) =>
    watchlists.find((w) => w.recipeSlug === slug && w.sessionId === sessionId);

  const toggleWatch = async (slug: string) => {
    const existing = watchFor(slug);
    setBusy(`watch-${slug}`);
    setError('');
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          existing
            ? { action: 'unwatch', id: existing.id }
            : { action: 'watch', sessionId, recipeSlug: slug },
        ),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Watch failed');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Watch failed');
    } finally {
      setBusy(null);
    }
  };

  /** Arm or clear the watch's metric trigger (null clears). The watch row
   *  is re-saved through the same watch action — one row per
   *  session+recipe, updated in place. */
  const setTriggerFor = async (slug: string, trigger: WatchTrigger | null) => {
    setBusy(`watch-${slug}`);
    setError('');
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'watch',
          sessionId,
          recipeSlug: slug,
          trigger,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Trigger failed');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Trigger failed');
    } finally {
      setBusy(null);
    }
  };

  /** Save the fork/edit draft — the API re-validates and 400s with the
   *  same needs-list the editor shows live. Saves by slug (upsert). */
  const saveDraft = async () => {
    if (!draft) return;
    setBusy('draft');
    setError('');
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          slug: draft.slug,
          name: draft.name,
          description: draft.description,
          budgetEstCents: draft.budgetEstCents,
          citationMode: draft.citationMode,
          steps: draftStepsPayload(draft),

        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Save failed');
      setDraft(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(null);
    }
  };

  /** Search + chip-filter the catalog. */
  const visibleRecipes = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = FILTERS.find((f) => f.key === filter)?.match ?? (() => true);
    return (recipes ?? []).filter((r) => {
      if (!match(r)) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.slug.includes(q)
      );
    });
  }, [recipes, query, filter]);

  /** The runs feed: the selected session's runs, or everything. */
  const visibleRuns = useMemo(
    () =>
      allSessions ? runs : runs.filter((r) => r.sessionId === sessionId),
    [runs, allSessions, sessionId],
  );

  const recipeFor = (id: string) => recipes?.find((r) => r.id === id);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Workflow className="h-6 w-6 text-brass" />
        <div>
          <h1 className="font-display text-2xl font-semibold text-bone">
            Recipes
          </h1>
          <p className="text-sm text-bone/45">
            Declarative multi-expert plays. Run one in a research session,
            watch the crew work in the chat, approve the gates as artifacts
            land.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDraft(blankRecipeDraft())}
            className="inline-flex items-center gap-1 rounded-lg border border-brass/30 px-2.5 py-1.5 text-xs font-medium text-brass hover:bg-brass/10"
            title="Author your own play from a blank draft"
          >
            <GitFork className="h-3.5 w-3.5" /> New play
          </button>
          <span className="text-[10px] uppercase tracking-wider text-bone/35">
            run in
          </span>
          <select
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            className="max-w-[240px] rounded-lg border border-bone/15 bg-ink px-2 py-1.5 text-xs text-bone/80"
            title="The research session the run works in (its artifacts and chat turns land there)"
          >
            {sessions.length === 0 && <option value="">no sessions</option>}
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/100/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {/* search + filters for a 17-play catalog */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-bone/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search plays…"
            className="w-52 rounded-lg border border-bone/15 bg-ink py-1.5 pl-7 pr-2 text-xs text-bone/80 outline-none placeholder:text-bone/30 focus:border-brass/40"
          />
        </div>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={clsx(
              'rounded-full border px-2.5 py-1 text-[11px]',
              filter === f.key
                ? 'border-brass/40 bg-brass/10 text-brass'
                : 'border-bone/15 text-bone/50 hover:text-bone',
            )}
          >
            {f.label}
          </button>
        ))}
        <span className="text-[10px] text-bone/30">
          {visibleRecipes.length} of {recipes?.length ?? 0} plays
        </span>
      </div>

      {/* the fork & edit panel (owner-authored plays) */}
      {draft && (
        <RecipeDraftEditor
          draft={draft}
          experts={experts}
          busy={busy === 'draft'}
          onChange={setDraft}
          onSave={saveDraft}
          onCancel={() => setDraft(null)}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        {/* Recipe cards */}
        <div className="space-y-2">
          {recipes === null ? (
            <Loader2 className="h-4 w-4 animate-spin text-bone/40" />
          ) : visibleRecipes.length === 0 ? (
            <p className="rounded-lg border border-bone/10 px-3 py-3 text-xs text-bone/40">
              {(recipes?.length ?? 0) === 0 ? (
                <>
                  No recipes seeded yet. Run{' '}
                  <code className="text-brass/80">
                    node scripts/seed-agent-recipes.cjs
                  </code>
                  .
                </>
              ) : (
                'No plays match that search or filter.'
              )}
            </p>
          ) : (
            visibleRecipes.map((r) => (
              <RecipeCard
                key={r.id}
                recipe={r}
                experts={experts}
                watch={watchFor(r.slug) ?? null}
                busy={busy === r.slug || busy === `watch-${r.slug}`}
                canRun={!!sessionId}
                onStart={() => start(r.slug)}
                onToggleWatch={() => toggleWatch(r.slug)}
                onSetTrigger={(t) => setTriggerFor(r.slug, t)}
                onFork={() => setDraft(forkDraftFrom(r))}
              />
            ))
          )}
        </div>

        {/* Runs feed */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-bone/50">
              Runs
            </span>
            <button
              type="button"
              onClick={() => setAllSessions((v) => !v)}
              className={clsx(
                'ml-auto rounded-full border px-2 py-0.5 text-[10px]',
                allSessions
                  ? 'border-brass/40 bg-brass/10 text-brass'
                  : 'border-bone/15 text-bone/45 hover:text-bone',
              )}
              title="Show runs from every session, or just the selected one"
            >
              {allSessions ? 'all sessions' : 'selected session'}
            </button>
          </div>
          {visibleRuns.length === 0 ? (
            <div className="flex items-center justify-center rounded-xl border border-dashed border-bone/10 p-10 text-sm text-bone/35">
              {allSessions
                ? 'No runs yet. Pick a session and run a recipe.'
                : 'No runs in this session yet — run a play, then open it in the chat to watch the crew work.'}
            </div>
          ) : (
            visibleRuns.map((run) => (
              <RunRow
                key={run.id}
                run={run}
                recipe={recipeFor(run.recipeId)}
                experts={experts}
                busy={busy !== null}
                onGate={gate}
                onCancel={cancelRun}
                onRetry={retryRun}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
