'use client';

/**
 * Recipe runs inside the research chat: the session's plays, live.
 *
 * A compact rail section (Evidence / Phrases / Plays / Artifacts) that:
 * - lists THIS session's recipe runs with a progress bar, per-step expert
 *   chips + notes, est cost, and the actions each status needs (approve /
 *   stop / retry / jump to the run's transcript turns / open a step's
 *   emitted artifact),
 * - starts any seeded recipe as a background run in the active session,
 * - polls + ticks the job lane every 5s while any run is active (the same
 *   self-driving pattern as the mission UI, no cron needed),
 * - fires onLiveTick on every active poll so the workspace reloads the
 *   transcript: the run's expert turns appear step by step AS they land,
 * - fires onRunsChanged when a run settles (running → gated/done/failed).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
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
  FileText,
  RotateCcw,
  MessagesSquare,
  MinusCircle,
} from 'lucide-react';
import type {
  Recipe,
  RecipeRun,
  RecipeStepState,
} from '@/lib/mothermode/research/recipes/types';
import {
  expertDisplayName,
  recipeCrew,
  runProgress,
  isRunActive,
  type ExpertInfo,
} from '@/lib/mothermode/research/recipes/crew';

const API = '/api/admin/mothermode-recipes';
const JOBS_API = '/api/admin/mothermode-jobs';

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

export default function RecipeRunsPanel({
  sessionId,
  onRunsChanged,
  onOpenArtifact,
  onJumpToRun,
  onLiveTick,
}: {
  sessionId: string;
  /** Fired when a run settles or an action lands — the workspace reloads the
   *  session so the run's turns and artifacts appear. */
  onRunsChanged?: () => void;
  /** Open a step's emitted artifact in the workspace viewer. */
  onOpenArtifact?: (artifactId: string) => void;
  /** Scroll the transcript to this run's turns. */
  onJumpToRun?: (runId: string) => void;
  /** Fired on every poll WHILE a run is active — the workspace reloads the
   *  transcript so the crew's turns land step by step, live. */
  onLiveTick?: () => void;
}) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [experts, setExperts] = useState<ExpertInfo[]>([]);
  const [runs, setRuns] = useState<RecipeRun[] | null>(null);
  const [slug, setSlug] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(true);
  /** runId -> last seen status, for the settle detection. */
  const seenRef = useRef<Map<string, RecipeRun['status']>>(new Map());
  /** The callbacks, ref-guarded so inline props never retrigger the load. */
  const changedRef = useRef(onRunsChanged);
  changedRef.current = onRunsChanged;
  const liveRef = useRef(onLiveTick);
  liveRef.current = onLiveTick;

  const load = useCallback(async () => {
    const res = await fetch(API, { cache: 'no-store' });
    const json = await res.json();
    const all = (json.recipes ?? []) as Recipe[];
    setRecipes(all);
    setExperts((json.experts ?? []) as ExpertInfo[]);
    setSlug((prev) => prev || all[0]?.slug || '');
    const mine = ((json.runs ?? []) as RecipeRun[])
      .filter((r) => r.sessionId === sessionId)
      .slice(0, 6);
    // Settle detection: a run that LEFT running brought new turns/artifacts.
    let settled = false;
    for (const r of mine) {
      if (seenRef.current.get(r.id) === 'running' && r.status !== 'running') {
        settled = true;
      }
      seenRef.current.set(r.id, r.status);
    }
    setRuns(mine);
    if (settled) changedRef.current?.();
    // Live-follow: while a run is active, every poll lets the transcript
    // show the newest step turns as they land.
    if (mine.some((r) => r.status === 'running')) liveRef.current?.();
  }, [sessionId]);

  // Fresh session: reset the view and load.
  useEffect(() => {
    seenRef.current = new Map();
    setRuns(null);
    setError('');
    load().catch(() => setRuns([]));
  }, [load]);

  // Poll + tick the job lane while any run of this session is active.
  useEffect(() => {
    if (!runs?.some((r) => r.status === 'running')) return;
    const t = window.setInterval(() => {
      fetch(JOBS_API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'tick' }),
      }).catch(() => {});
      load().catch(() => {});
    }, 5000);
    return () => window.clearInterval(t);
  }, [runs, load]);

  const activeCount = runs?.filter(isRunActive).length ?? 0;
  // An active run is the thing the owner came to watch: unfold for it.
  useEffect(() => {
    if (activeCount > 0) setOpen(true);
  }, [activeCount]);

  const start = async () => {
    if (!slug) return;
    setBusy('start');
    setError('');
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          slug,
          sessionId,
          background: true,
        }),
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
      // The gate resumed the run inline (approve) or closed it (cancel) —
      // either way the session has new state to show.
      changedRef.current?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gate failed');
    } finally {
      setBusy(null);
    }
  };

  /** Stop a RUNNING run (the lane closes it out between steps). */
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
      changedRef.current?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setBusy(null);
    }
  };

  /** Re-queue a failed/canceled run from the step it stopped at. */
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

  const recipeFor = (id: string) => recipes.find((r) => r.id === id);
  const recipeName = (id: string) => recipeFor(id)?.name ?? 'recipe';

  return (
    <div className="shrink-0 border-b border-bone/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.18em] text-bone/50 hover:text-bone"
      >
        <Workflow className="h-3.5 w-3.5 text-brass/70" />
        Plays
        {activeCount > 0 && (
          <span className="rounded-full bg-brass/20 px-1.5 py-0.5 text-[10px] font-semibold text-brass">
            {activeCount} active
          </span>
        )}
      </button>
      {open && (
        <div className="px-2 pb-2.5">
          {error && (
            <p className="mb-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-200">
              {error}
            </p>
          )}
          {runs === null ? (
            <div className="flex justify-center py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-bone/40" />
            </div>
          ) : runs.length === 0 ? (
            <p className="px-1 pb-1.5 text-[11px] text-bone/40">
              No runs in this session yet. Pick a play below — its steps,
              artifacts, and chat turns land here, live.
            </p>
          ) : (
            <div className="mb-1.5 space-y-1.5">
              {runs.map((run) => {
                const recipe = recipeFor(run.recipeId);
                const progress = runProgress(run);
                return (
                  <div
                    key={run.id}
                    className="rounded-lg border border-bone/10 bg-bone/[0.03] px-2 py-1.5"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className={clsx(
                          'rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase',
                          STATUS_STYLE[run.status],
                        )}
                      >
                        {run.status}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[11px] text-bone/75">
                        {recipeName(run.recipeId)}
                      </span>
                      {onJumpToRun && (
                        <button
                          type="button"
                          onClick={() => onJumpToRun(run.id)}
                          className="shrink-0 rounded p-0.5 text-bone/35 hover:text-brass"
                          title="Scroll the chat to this run's turns"
                          aria-label="Jump to run in chat"
                        >
                          <MessagesSquare className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <span className="text-[9px] text-bone/30">
                        ~${(run.estCostCents / 100).toFixed(2)}
                      </span>
                    </div>

                    {/* the progress bar: completed steps of the play */}
                    {progress.total > 0 && (
                      <div className="mt-1.5 flex items-center gap-1.5">
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
                          {progress.done}/{progress.total}
                          {recipe
                            ? ` · ~$${(recipe.budgetEstCents / 100).toFixed(2)} cap`
                            : ''}
                        </span>
                      </div>
                    )}

                    <div className="mt-1 space-y-0.5">
                      {run.stepsState.map((s, i) => {
                        const step = recipe?.steps[i];
                        const baseNote = step
                          ? `step ${i + 1}: ${step.expert} → ${step.outputArtifact}`
                          : `step ${i + 1}`;
                        // The note minus the part the chip row already says.
                        const extra = s.note.startsWith(baseNote)
                          ? s.note.slice(baseNote.length).trim()
                          : s.note;
                        return (
                          <div key={i} className="flex items-start gap-1.5">
                            <StepGlyph status={s.status} />
                            <div className="min-w-0 flex-1">
                              <span className="text-[10px] leading-snug text-bone/60">
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
                                  <span className="text-bone/50">
                                    step {i + 1}
                                  </span>
                                )}
                                {extra && (
                                  <span className="block text-bone/40">
                                    {s.status === 'gated' ? s.note : extra}
                                  </span>
                                )}
                              </span>
                            </div>
                            {s.artifactId &&
                              (s.status === 'done' || s.status === 'gated') &&
                              onOpenArtifact && (
                                <button
                                  type="button"
                                  onClick={() => onOpenArtifact(s.artifactId)}
                                  className="shrink-0 rounded p-0.5 text-bone/35 hover:text-brass"
                                  title={
                                    s.status === 'gated'
                                      ? 'Review the artifact before approving'
                                      : 'Open this step’s output'
                                  }
                                  aria-label="View step output"
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                </button>
                              )}
                          </div>
                        );
                      })}
                    </div>

                    {run.status === 'gated' && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => gate(run.id, 'approve')}
                          disabled={busy !== null}
                          className="inline-flex items-center gap-1 rounded-md bg-brass px-2 py-1 text-[10px] font-semibold text-ink hover:bg-brass/90 disabled:opacity-50"
                        >
                          {busy === run.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                          Approve & continue
                        </button>
                        <button
                          type="button"
                          onClick={() => gate(run.id, 'cancel')}
                          disabled={busy !== null}
                          className="inline-flex items-center gap-1 rounded-md border border-bone/15 px-2 py-1 text-[10px] text-bone/55 hover:bg-bone/10 disabled:opacity-50"
                        >
                          <X className="h-3 w-3" />
                          Cancel
                        </button>
                      </div>
                    )}
                    {run.status === 'running' && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => cancelRun(run.id)}
                          disabled={busy !== null}
                          className="inline-flex items-center gap-1 rounded-md border border-bone/15 px-2 py-1 text-[10px] text-bone/55 hover:bg-bone/10 disabled:opacity-50"
                          title="Stop after the in-flight step (the current expert finishes its turn)"
                        >
                          {busy === run.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                          Stop run
                        </button>
                      </div>
                    )}
                    {(run.status === 'failed' ||
                      run.status === 'canceled') && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => retryRun(run.id)}
                          disabled={busy !== null}
                          className="inline-flex items-center gap-1 rounded-md border border-brass/30 px-2 py-1 text-[10px] font-medium text-brass hover:bg-brass/10 disabled:opacity-50"
                          title="Re-queue from the step it stopped at — completed steps never re-run"
                        >
                          {busy === run.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3 w-3" />
                          )}
                          Retry from stopped step
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {/* start a play in this session */}
          <div className="flex items-center gap-1.5">
            <select
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-bone/15 bg-ink px-1.5 py-1 text-[11px] text-bone/75"
              title="The play to run in this session (runs in the background)"
            >
              {recipes.length === 0 && <option value="">no plays seeded</option>}
              {recipes.map((r) => (
                <option key={r.id} value={r.slug}>
                  {r.name} · ~${(r.budgetEstCents / 100).toFixed(2)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={start}
              disabled={busy !== null || !slug}
              className="inline-flex shrink-0 items-center gap-1 rounded-md bg-brass px-2 py-1 text-[11px] font-semibold text-ink hover:bg-brass/90 disabled:opacity-50"
            >
              {busy === 'start' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Play className="h-3 w-3" />
              )}
              Run
            </button>
          </div>
          {/* the selected play's crew, so a multi-expert run is no surprise */}
          {slug &&
            (() => {
              const selected = recipes.find((r) => r.slug === slug);
              if (!selected) return null;
              const crew = recipeCrew(selected).map((s) =>
                expertDisplayName(s, experts),
              );
              return (
                <p className="mt-1 px-0.5 text-[10px] leading-snug text-bone/35">
                  {selected.steps.length} steps · crew: {crew.join(' → ')}
                  {selected.steps.some((s) => s.gate === 'approve')
                    ? ' · pauses for approval'
                    : ' · no gates'}
                </p>
              );
            })()}
        </div>
      )}
    </div>
  );
}
