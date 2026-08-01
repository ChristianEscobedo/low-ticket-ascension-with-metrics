'use client';

/**
 * The public run recap renderer (roadmap Phase 3, "Share Run recap").
 *
 * Fetches the ONE sanitized payload from /api/share/run/<token> and renders
 * it read-only: the headline (play, status, cost, crew), the money map
 * (what the run brought back), the build maps, the steps, and the run's
 * transcript with the slim tool trace. There is deliberately nothing to
 * click THROUGH to — the payload carries no admin links and no ids — and
 * nothing to type into: this surface is read-only end to end.
 */
import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import {
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Loader2,
  Map as MapIcon,
  MinusCircle,
  PauseCircle,
  Sparkles,
  Wrench,
  XCircle,
} from 'lucide-react';
import type { RunRecap, RecapTurn } from '@/lib/mothermode/research/recipes/recap';
import type { FunnelMap } from '@/lib/mothermode/research/funnelMap';

import { moneyMapSummary } from '@/lib/mothermode/research/moneyMap';
import { formatAgo } from '@/lib/mothermode/research/recipes/crew';
import { formatCents } from '@/lib/mothermode/planner/adMetrics';
import NodeCard from '@/components/mothermode/NodeCard';


const STATUS_STYLE: Record<string, string> = {
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

function MoneyMapSection({ recap }: { recap: RunRecap }) {
  const map = recap.moneyMap;
  const summary = moneyMapSummary(map);
  const t = map.totals;

  const cells: Array<{ label: string; value: string }> = [
    { label: 'cards', value: num(t.cards) },
    { label: 'kits', value: String(t.kits) },
    { label: 'funnels', value: String(t.funnels) },
    { label: 'clicks', value: num(t.clicks) },
    { label: 'leads', value: num(t.optins) },
    { label: 'sales', value: num(t.purchases) },
    { label: 'attributed', value: money(t.revenueCents) },
  ];

  return (
    <section className="rounded-xl border border-brass/25 bg-brass/[0.04] px-4 py-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brass/80">
        What it brought back
      </span>
      <p className="mt-1 text-sm font-medium text-bone/90">
        {summary ??
          'Nothing handed off downstream yet — there is nothing to attribute.'}
      </p>
      {t.artifactsHandedOff > 0 && (
        <>
          <div className="mt-2.5 grid grid-cols-4 gap-2 sm:grid-cols-7">
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
              {map.perArtifact.map((a, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]"
                >
                  <span className="min-w-0 truncate text-bone/70">
                    {a.title || a.type}
                  </span>
                  {a.handedOffLabel && (
                    <span className="shrink-0 rounded bg-brass/15 px-1.5 py-0.5 text-[9px] font-semibold text-brass">
                      {a.handedOffLabel}
                    </span>
                  )}
                  <span className="ml-auto shrink-0 text-bone/45">
                    {a.clicks === null && a.optins === null
                      ? 'no tracked results yet'
                      : [
                          a.clicks !== null ? `${num(a.clicks)} clicks` : null,
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
// Build maps (the funnel map, public edition — nodes are labels, not links)
// ---------------------------------------------------------------------------

function BuildMapCard({ map }: { map: FunnelMap }) {

  return (
    <div className="rounded-xl border border-brass/25 bg-brass/[0.05] px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-brass/80">
        <MapIcon className="h-3.5 w-3.5" />
        The build map
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {map.root.parentTitle && (
          <>
            <span className="max-w-[180px] truncate rounded-md border border-bone/15 bg-bone/[0.04] px-2 py-1 text-[11px] text-bone/50">
              {map.root.parentTitle}
            </span>
            <span className="text-brass/60">→</span>
          </>
        )}
        <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-brass/40 bg-brass/15 px-2 py-1 text-[11px] font-semibold text-brass">
          <span className="truncate">{map.root.title}</span>
          <span className="shrink-0 text-[9px] font-medium uppercase tracking-wider opacity-70">
            {map.root.typeLabel}
            {map.root.priceLabel ? ` · ${map.root.priceLabel}` : ''}
          </span>
        </span>
      </div>
      <div className="mt-2.5 space-y-1.5 border-l-2 border-brass/20 pl-3">
        {map.lanes.map((lane) => (
          <div key={lane.key} className="flex flex-wrap items-center gap-1.5">
            <span className="w-[72px] shrink-0 text-[9px] font-semibold uppercase tracking-wider text-bone/35">
              {lane.title}
            </span>
            {lane.nodes.map((node, i) => (
              <NodeCard
                key={`${node.id}-${i}`}
                status={node.status}
                label={node.label}
              />
            ))}

          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transcript
// ---------------------------------------------------------------------------

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

function Turn({ turn }: { turn: RecapTurn }) {
  const isUser = turn.role === 'user';
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
          {turn.speaker}
        </span>
        {turn.stepIndex !== null && !isUser && (
          <span className="text-[9px] text-bone/30">
            step {turn.stepIndex + 1}
          </span>
        )}
        {turn.model ? (
          <span className="text-[9px] text-bone/25">{turn.model}</span>
        ) : null}
      </div>
      {turn.tools.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {turn.tools.map((tool, i) => (
            <span
              key={i}
              className={clsx(
                'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px]',
                tool.status === 'error'
                  ? 'border-red-400/30 text-red-300/80'
                  : 'border-bone/15 text-bone/50',
              )}
              title={`${tool.inputSummary}${tool.resultSummary ? ` → ${tool.resultSummary}` : ''}`}
            >
              <Wrench className="h-2.5 w-2.5" />
              {tool.name}
              {tool.resultSummary ? ` · ${tool.resultSummary.slice(0, 60)}` : ''}
            </span>
          ))}
        </div>
      )}
      <div className="mt-1.5">
        <TurnBody content={turn.content} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

export default function SharedRunClient({ token }: { token: string }) {
  const [recap, setRecap] = useState<RunRecap | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!token) {
      setMissing(true);
      return;
    }
    fetch(`/api/share/run/${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) {
          setMissing(true);
          return null;
        }
        return res.json();
      })
      .then((json) => {
        if (json?.recap) setRecap(json.recap as RunRecap);
      })
      .catch(() => setMissing(true));
  }, [token]);

  return (
    <div className="min-h-dvh bg-ink">
      {/* the minimal brand header */}
      <header className="border-b border-bone/10">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <Sparkles className="h-4 w-4 text-brass" />
          <span className="font-display text-sm font-semibold tracking-wide text-bone">
            MotherMode
          </span>
          <span className="rounded-full border border-brass/30 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-brass">
            Shared run recap
          </span>
          <span className="ml-auto text-[10px] text-bone/30">read-only</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {missing ? (
          <p className="mt-6 rounded-lg border border-bone/10 px-4 py-10 text-center text-sm text-bone/40">
            This shared run is unavailable — the link may have been revoked,
            or it never existed.
          </p>
        ) : !recap ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-bone/40">
            <Loader2 className="h-4 w-4 animate-spin" /> loading the recap…
          </div>
        ) : (
          <>
            {/* the headline */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={clsx(
                  'rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase',
                  STATUS_STYLE[recap.status] ?? STATUS_STYLE.canceled,
                )}
              >
                {recap.status}
              </span>
              <h1 className="font-display text-xl font-semibold text-bone">
                {recap.recipeName}
              </h1>
            </div>
            <p className="mt-1 text-[11px] text-bone/40">
              {recap.stepsDone}/{recap.stepCount} steps · ~$
              {(recap.estCostCents / 100).toFixed(2)} spent
              {recap.startedAt ? ` · ran ${formatAgo(recap.startedAt)}` : ''}
              {recap.crew.length > 0 ? ` · crew: ${recap.crew.join(' → ')}` : ''}
            </p>

            <div className="mt-4 space-y-4">
              <MoneyMapSection recap={recap} />

              {recap.funnelMaps.map((map, i) => (
                <BuildMapCard key={i} map={map} />
              ))}

              {/* the steps */}
              <section className="rounded-xl border border-bone/10 bg-bone/[0.02] px-4 py-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-bone/40">
                  The play, step by step
                </span>
                <div className="mt-2 space-y-1.5">
                  {recap.steps.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <StepGlyph status={s.status} />
                      <div className="min-w-0 flex-1">
                        <span className="text-bone/70">
                          {s.expertName ? (
                            <>
                              <span className="font-medium text-brass/80">
                                {s.expertName}
                              </span>
                              <span className="text-bone/35">
                                {' '}
                                → {s.outputArtifact || `step ${i + 1}`}
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
                    </div>
                  ))}
                </div>
              </section>

              {/* the transcript */}
              <section className="rounded-xl border border-bone/10 bg-bone/[0.02] px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-bone/40">
                    The crew at work
                  </span>
                  <span className="text-[10px] text-bone/30">
                    {recap.transcript.length} turns
                  </span>
                </div>
                {recap.transcript.length === 0 ? (
                  <p className="mt-1.5 text-[11px] text-bone/35">
                    This run predates transcript provenance — the steps above
                    are its record.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {recap.transcript.map((turn, i) => (
                      <Turn key={i} turn={turn} />
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-bone/10">
        <p className="mx-auto max-w-3xl px-4 py-4 text-[10px] leading-snug text-bone/30">
          Shared by the owner of this run as a read-only recap — credential
          shapes are redacted and internal links removed before anything
          renders. Links like this one are unlisted and can be revoked at any
          time. Built by an AI crew on MotherMode.
        </p>
      </footer>
    </div>
  );
}
