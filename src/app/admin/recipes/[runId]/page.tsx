'use client';

/**
 * /admin/recipes/[runId] — the run detail page (roadmap Phase 2): one screen
 * to judge a run.
 *
 *   header     — status, cost, timing, the session it ran in, gate/stop/
 *                retry actions (the same POST actions as the mission feed).
 *   money map  — what the run made and what it earned: "12 cards · 1 funnel
 *                → 218 clicks → 31 leads → $412 attributed", per artifact.
 *   steps      — the recipe's steps with their outcomes + artifact links.
 *   timeline   — the trust-spine event log.
 *   transcript — the run's chat turns (provenance-stamped), with the tool
 *                trace inline.
 *
 * Polls + ticks the job lane while the run is active, like the feed.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { clsx } from 'clsx';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  MessagesSquare,
  MinusCircle,
  PauseCircle,
  RotateCcw,
  Share2,
  Trash2,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';
import type { RunDetail } from '@/lib/mothermode/research/recipes/runDetail';
import type { RunShare } from '@/lib/mothermode/research/recipes/shares';

import type { RecipeRun } from '@/lib/mothermode/research/recipes/types';
import type { ResearchMessage } from '@/lib/mothermode/research/types';
import {
  expertDisplayName,
  formatAgo,
  researchLabHref,
  runProgress,
  type ExpertInfo,
} from '@/lib/mothermode/research/recipes/crew';
import { moneyMapSummary } from '@/lib/mothermode/research/moneyMap';
import { formatCents } from '@/lib/mothermode/planner/adMetrics';

const API = '/api/admin/mothermode-recipes';

const STATUS_STYLE: Record<RecipeRun['status'], string> = {
  running: 'border-brass/40 bg-brass/10 text-brass',
  gated: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  done: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  failed: 'border-red-400/30 bg-red-400/10 text-red-300',
  canceled: 'border-bone/20 text-bone/40',
};

function StepGlyph({ status }: { status: string }) {
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

/** n/a for unknown (null), never a confident 0 — the money map's rule. */
function num(v: number | null): string {
  return v === null ? 'n/a' : v.toLocaleString();
}

function money(v: number | null): string {
  return v === null ? 'n/a' : formatCents(v);
}

// ---------------------------------------------------------------------------
// Money map
// ---------------------------------------------------------------------------

function MoneyMapCard({
  detail,
}: {
  detail: RunDetail;
}) {
  const map = detail.moneyMap;
  const summary = moneyMapSummary(map);
  const t = map.totals;

  const cells: Array<{ label: string; value: string }> = [
    { label: 'cards', value: num(t.cards) },
    { label: 'kits', value: String(t.kits) },
    { label: 'funnels', value: String(t.funnels) },
    { label: 'links', value: num(t.links) },
    { label: 'clicks', value: num(t.clicks) },
    { label: 'leads', value: num(t.optins) },
    { label: 'sales', value: num(t.purchases) },
    { label: 'attributed', value: money(t.revenueCents) },
  ];

  return (
    <section className="rounded-xl border border-brass/25 bg-brass/[0.04] px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brass/80">
          Money map
        </span>
        <span className="text-[10px] text-bone/30">
          what this run made, and what it brought back
        </span>
      </div>
      <p className="mt-1 text-sm font-medium text-bone/90">
        {summary ??
          'Nothing handed off yet — this run’s outputs haven’t been sent downstream, so there is nothing to attribute.'}
      </p>

      {t.artifactsHandedOff > 0 && (
        <>
          <div className="mt-2.5 grid grid-cols-4 gap-2 sm:grid-cols-8">
            {cells.map((c) => (
              <div key={c.label}>
                <div className="text-sm font-semibold text-bone/90">
                  {c.value}
                </div>
                <div className="text-[9px] uppercase tracking-wide text-bone/35">
                  {c.label}
                </div>
              </div>
            ))}
          </div>

          {map.perArtifact.length > 0 && (
            <div className="mt-3 space-y-1 border-t border-bone/10 pt-2">
              {map.perArtifact.map((a) => (
                <div
                  key={a.artifactId}
                  className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]"
                >
                  <Link
                    href={researchLabHref({
                      sessionId: detail.run.sessionId,
                      runId: detail.run.id,
                      artifactId: a.artifactId,
                    })}
                    className="inline-flex min-w-0 items-center gap-1 text-bone/70 hover:text-brass"
                    title="Open the artifact in the lab"
                  >
                    <FileText className="h-3 w-3 shrink-0" />
                    <span className="truncate">{a.title || a.type}</span>
                  </Link>
                  {a.handedOffLabel &&
                    (a.handedOffHref ? (
                      <Link
                        href={a.handedOffHref}
                        className="shrink-0 rounded bg-brass/15 px-1.5 py-0.5 text-[9px] font-semibold text-brass hover:bg-brass/25"
                      >
                        {a.handedOffLabel}
                      </Link>
                    ) : (
                      <span className="shrink-0 rounded bg-bone/10 px-1.5 py-0.5 text-[9px] font-semibold text-bone/55">
                        {a.handedOffLabel}
                      </span>
                    ))}
                  <span className="ml-auto shrink-0 text-bone/45">
                    {a.clicks === null && a.optins === null
                      ? 'no tracked results yet'
                      : [
                          a.clicks !== null
                            ? `${num(a.clicks)} clicks`
                            : null,
                          a.optins !== null ? `${num(a.optins)} leads` : null,
                          a.revenueCents !== null && a.revenueCents > 0
                            ? money(a.revenueCents)
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' → ')}
                  </span>
                </div>
              ))}
            </div>
          )}

          <p className="mt-2 text-[10px] leading-snug text-bone/30">
            {map.caveat}
          </p>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Transcript
// ---------------------------------------------------------------------------

/** One turn, clamped — step instructions and artifacts are long. */
function TurnBody({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  const CLAMP = 700;
  const long = content.length > CLAMP;
  const shown = open || !long ? content : `${content.slice(0, CLAMP).trimEnd()}…`;
  return (
    <div>
      <p className="whitespace-pre-wrap text-xs leading-relaxed text-bone/70">
        {shown}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] text-brass/70 hover:text-brass"
        >
          <ChevronDown
            className={clsx('h-3 w-3 transition-transform', open && 'rotate-180')}
          />
          {open ? 'show less' : `show all (${content.length.toLocaleString()} chars)`}
        </button>
      )}
    </div>
  );
}

function TranscriptTurn({
  message,
  experts,
}: {
  message: ResearchMessage;
  experts: ExpertInfo[];
}) {
  const isUser = message.role === 'user';
  const speaker = isUser
    ? message.recipeStepIndex !== null
      ? `step ${message.recipeStepIndex + 1} instruction`
      : 'owner'
    : expertDisplayName(message.expertSlug || 'research', experts);
  return (
    <div
      className={clsx(
        'rounded-lg border px-3 py-2',
        isUser
          ? 'border-bone/10 bg-bone/[0.02]'
          : 'border-brass/15 bg-brass/[0.03]',
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={clsx(
            'rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
            isUser ? 'bg-bone/10 text-bone/50' : 'bg-brass/15 text-brass',
          )}
        >
          {speaker}
        </span>
        {message.recipeStepIndex !== null && !isUser && (
          <span className="text-[9px] text-bone/30">
            step {message.recipeStepIndex + 1}
          </span>
        )}
        {message.model ? (
          <span className="text-[9px] text-bone/25">{message.model}</span>
        ) : null}
        <span className="ml-auto text-[9px] text-bone/30">
          {formatAgo(message.createdAt)}
        </span>
      </div>
      {message.toolCalls.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {message.toolCalls.map((call) => (
            <span
              key={call.id}
              className={clsx(
                'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px]',
                call.status === 'error'
                  ? 'border-red-400/30 text-red-300/80'
                  : 'border-bone/15 text-bone/50',
              )}
              title={`${call.inputSummary}${call.resultSummary ? ` → ${call.resultSummary}` : ''}`}
            >
              <Wrench className="h-2.5 w-2.5" />
              {call.name}
              {call.resultSummary ? ` · ${call.resultSummary.slice(0, 60)}` : ''}
            </span>
          ))}
        </div>
      )}
      <div className="mt-1.5">
        <TurnBody content={message.content} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

export default function RunDetailPage() {
  const params = useParams<{ runId: string }>();
  const runId = typeof params?.runId === 'string' ? params.runId : '';
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [experts, setExperts] = useState<ExpertInfo[]>([]);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!runId) return;
    const res = await fetch(`${API}?detail=${runId}`, { cache: 'no-store' });
    if (res.status === 404) {
      setMissing(true);
      return;
    }
    const json = await res.json();
    if (json.detail) setDetail(json.detail as RunDetail);
  }, [runId]);

  useEffect(() => {
    load().catch(() => setMissing(true));
    // Expert display names, for the transcript's speaker chips.
    fetch(API, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setExperts((j.experts ?? []) as ExpertInfo[]))
      .catch(() => {});
  }, [load]);

  // Poll + tick the job lane while the run is active (same bridge as the feed).
  useEffect(() => {
    if (!detail || detail.run.status !== 'running') return;
    const t = window.setInterval(() => {
      fetch('/api/admin/mothermode-jobs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'tick' }),
      }).catch(() => {});
      load().catch(() => {});
    }, 5000);
    return () => window.clearInterval(t);
  }, [detail, load]);

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Action failed');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  if (missing) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <BackLink />
        <p className="mt-6 rounded-lg border border-bone/10 px-4 py-6 text-center text-sm text-bone/40">
          Run not found — it may belong to a different environment, or the row
          was removed.
        </p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <BackLink />
        <div className="mt-6 flex items-center gap-2 text-sm text-bone/40">
          <Loader2 className="h-4 w-4 animate-spin" /> loading the run…
        </div>
      </div>
    );
  }

  const { run, recipe } = detail;
  const progress = runProgress(run);
  const chatHref = researchLabHref({ sessionId: run.sessionId, runId: run.id });

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <BackLink />

      {/* header: status, cost, timing, actions */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={clsx(
            'rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase',
            STATUS_STYLE[run.status],
          )}
        >
          {run.status}
        </span>
        <h1 className="font-display text-xl font-semibold text-bone">
          {recipe?.name ?? 'Recipe run'}
        </h1>
        <span className="text-[11px] text-bone/40">
          ~${(run.estCostCents / 100).toFixed(2)} spent
          {recipe ? ` of ~$${(recipe.budgetEstCents / 100).toFixed(2)}` : ''}
          {run.createdAt ? ` · started ${formatAgo(run.createdAt)}` : ''}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {!detail.share && (
            <button
              type="button"
              onClick={() => act({ action: 'share', runId: run.id })}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-lg border border-brass/30 px-2 py-1 text-[11px] font-medium text-brass hover:bg-brass/10 disabled:opacity-50"
              title="Create a public read-only link to this run's recap (transcript, build map, money map) — anyone with the link can view"
            >
              <Share2 className="h-3 w-3" />
              Share run
            </button>
          )}
          <Link
            href={chatHref}
            className="inline-flex items-center gap-1 rounded-lg border border-brass/30 px-2 py-1 text-[11px] font-medium text-brass hover:bg-brass/10"
          >
            <MessagesSquare className="h-3 w-3" />
            Open in chat
          </Link>

          {run.status === 'gated' && (
            <>
              <button
                type="button"
                onClick={() =>
                  act({ action: 'gate', runId: run.id, decision: 'approve' })
                }
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-lg bg-brass px-2.5 py-1 text-xs font-semibold text-bone hover:bg-brass/90 disabled:opacity-50"
              >
                <Check className="h-3 w-3" />
                Approve & continue
              </button>
              <button
                type="button"
                onClick={() =>
                  act({ action: 'gate', runId: run.id, decision: 'cancel' })
                }
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-lg border border-bone/15 px-2.5 py-1 text-xs text-bone/60 hover:bg-bone/10 disabled:opacity-50"
              >
                <X className="h-3 w-3" />
                Cancel run
              </button>
            </>
          )}
          {run.status === 'running' && (
            <button
              type="button"
              onClick={() => act({ action: 'cancel', runId: run.id })}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-lg border border-bone/15 px-2.5 py-1 text-xs text-bone/60 hover:bg-bone/10 disabled:opacity-50"
              title="Stop after the in-flight step (the current expert finishes its turn)"
            >
              <X className="h-3 w-3" />
              Stop run
            </button>
          )}
          {(run.status === 'failed' || run.status === 'canceled') && (
            <button
              type="button"
              onClick={() => act({ action: 'retry', runId: run.id })}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-lg border border-brass/30 px-2.5 py-1 text-xs font-medium text-brass hover:bg-brass/10 disabled:opacity-50"
              title="Re-queue from the step it stopped at — completed steps never re-run"
            >
              <RotateCcw className="h-3 w-3" />
              Retry from stopped step
            </button>
          )}
        </div>
      </div>

      <p className="mt-1 text-[11px] text-bone/40">
        {detail.sessionTitle ? `session: ${detail.sessionTitle} · ` : ''}
        {progress.done}/{progress.total} steps
        {recipe ? ` · crew: ${recipeCrewNames(recipe, experts)}` : ''}
      </p>

      {detail.share && (
        <ShareBar
          share={detail.share}
          busy={busy}
          onRevoke={() => act({ action: 'unshare', runId: run.id })}
        />
      )}

      {error && (

        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/100/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="mt-4 space-y-4">
        <MoneyMapCard detail={detail} />

        {/* steps + their artifacts */}
        <section className="rounded-xl border border-bone/10 bg-bone/[0.02] px-4 py-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-bone/40">
            Steps
          </span>
          <div className="mt-2 space-y-1.5">
            {run.stepsState.map((s, i) => {
              const step = recipe?.steps[i];
              return (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <StepGlyph status={s.status} />
                  <div className="min-w-0 flex-1">
                    <span className="text-bone/70">
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
                        `step ${i + 1}`
                      )}
                    </span>
                    {s.note && (
                      <span className="block text-[11px] leading-snug text-bone/40">
                        {s.note}
                      </span>
                    )}
                  </div>
                  {s.artifactId &&
                    (s.status === 'done' || s.status === 'gated') && (
                      <Link
                        href={researchLabHref({
                          sessionId: run.sessionId,
                          runId: run.id,
                          artifactId: s.artifactId,
                        })}
                        className="inline-flex shrink-0 items-center gap-1 rounded border border-bone/15 px-1.5 py-0.5 text-[10px] text-bone/55 hover:border-brass/40 hover:text-brass"
                      >
                        <FileText className="h-3 w-3" />
                        {s.status === 'gated' ? 'review' : 'output'}
                      </Link>
                    )}
                </div>
              );
            })}
          </div>
        </section>

        {/* the trust-spine timeline */}
        <section className="rounded-xl border border-bone/10 bg-bone/[0.02] px-4 py-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-bone/40">
            Timeline
          </span>
          {detail.events.length === 0 ? (
            <p className="mt-1.5 text-[11px] text-bone/35">
              No events logged (runs from before the event log are quiet here).
            </p>
          ) : (
            <ol className="mt-1.5 space-y-1">
              {detail.events.map((e) => (
                <li key={e.id} className="flex items-start gap-1.5 text-[11px]">
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
        </section>

        {/* the scoped transcript */}
        <section className="rounded-xl border border-bone/10 bg-bone/[0.02] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-bone/40">
              Transcript
            </span>
            <span className="text-[10px] text-bone/30">
              {detail.transcript.length} turns · the full conversation lives in{' '}
              <Link href={chatHref} className="text-brass/70 hover:text-brass">
                the lab
              </Link>
            </span>
          </div>
          {detail.transcript.length === 0 ? (
            <p className="mt-1.5 text-[11px] text-bone/35">
              No turns carry this run’s provenance (pre-provenance runs, and
              runs whose turns aged past the read window, are quiet here — the
              timeline above is the complete record).
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              {detail.transcript.map((m) => (
                <TranscriptTurn key={m.id} message={m} experts={experts} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/recipes"
      className="inline-flex items-center gap-1 text-[11px] text-bone/45 hover:text-brass"
    >
      <ArrowLeft className="h-3 w-3" />
      all runs
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Share Run recap (Phase 3): the live public link, copy/open/revoke
// ---------------------------------------------------------------------------

function ShareBar({
  share,
  busy,
  onRevoke,
}: {
  share: RunShare;
  busy: boolean;
  onRevoke: () => void;
}) {
  const [copied, setCopied] = useState(false);
  // The public path mirrors the /share/run/<token> route (shares.ts owns the
  // server-side builder; this client bundle builds the same string).
  const path = `/share/run/${share.token}`;
  const fullUrl =
    typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard denied — the URL is selectable in the bar */
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-brass/25 bg-brass/[0.05] px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Share2 className="h-3.5 w-3.5 shrink-0 text-brass" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brass/80">
          Public recap link
        </span>
        <code className="min-w-0 flex-1 truncate rounded bg-ink/40 px-2 py-1 text-[11px] text-bone/60">
          {fullUrl}
        </code>
        <button
          type="button"
          onClick={copy}
          className="inline-flex shrink-0 items-center gap-1 rounded border border-bone/15 px-2 py-1 text-[10px] text-bone/60 hover:bg-bone/10"
          title="Copy the link"
        >
          {copied ? (
            <Check className="h-3 w-3 text-emerald-300" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          {copied ? 'copied' : 'copy'}
        </button>
        <a
          href={path}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded border border-bone/15 px-2 py-1 text-[10px] text-bone/60 hover:bg-bone/10"
          title="Open the public recap"
        >
          <ExternalLink className="h-3 w-3" />
          open
        </a>
        <button
          type="button"
          onClick={onRevoke}
          disabled={busy}
          className="inline-flex shrink-0 items-center gap-1 rounded border border-red-400/30 px-2 py-1 text-[10px] text-red-300/80 hover:bg-red-400/10 disabled:opacity-50"
          title="Revoke the link — it 404s on its very next load"
        >
          <Trash2 className="h-3 w-3" />
          revoke
        </button>
      </div>
      <p className="mt-1.5 text-[10px] leading-snug text-bone/30">
        Anyone with the link can view the recap (transcript, build map, money
        map) — read-only, unlisted, credentials redacted. Revoking kills it
        instantly.
      </p>
    </div>
  );
}


/** "Atlas → Wren → Nova" for the header sub-line. */
function recipeCrewNames(
  recipe: NonNullable<RunDetail['recipe']>,
  experts: ExpertInfo[],
): string {
  const seen: string[] = [];
  for (const step of recipe.steps) {
    const slug = step.expert.trim();
    if (slug && !seen.includes(slug)) seen.push(slug);
  }
  return seen.map((s) => expertDisplayName(s, experts)).join(' → ');
}
