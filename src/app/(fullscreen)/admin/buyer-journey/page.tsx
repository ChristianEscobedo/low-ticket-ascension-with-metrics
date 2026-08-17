'use client';

/**
 * /admin/buyer-journey — the path buyers actually traveled, for one buyer or
 * many. Reads `/api/admin/buyer-journey` (the leads + the funnels) and runs
 * `buildBuyerJourney` client-side (the builder is pure, no server imports).
 *
 *   - **The aggregate** (many buyers) — the journey path: how many reached
 *     each step, where they dropped off, where they came from, how it ended.
 *   - **The individual** (one buyer) — pick a buyer; their path lights up to
 *     the step they reached, with the outcome.
 *
 * Entered from the System map ("Buyer journeys →" in the header).
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeftCircle, Loader2, CheckCircle2, TrendingDown } from 'lucide-react';
import {
  buildBuyerJourney,
  JOURNEY_STEPS,
  JOURNEY_STEP_LABEL,
  type BuyerJourneyInput,
  type BuyerJourneyLead,
} from '@/lib/mothermode/buyerJourney';

const money = (cents: number) =>
  (cents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

const stepIndex = (step: string) => {
  const i = (JOURNEY_STEPS as readonly string[]).indexOf(step);
  return i === -1 ? 0 : i;
};

/** One buyer's path — the steps light up to the one they reached. */
function BuyerPath({ buyer }: { buyer: BuyerJourneyLead }) {
  const reached = stepIndex(buyer.stepReached);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {JOURNEY_STEPS.slice(0, reached + 1).map((step, i) => (
        <span key={step} className="flex items-center gap-1">
          {i > 0 && <span className="text-bone/20">→</span>}
          <span
            className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${
              i === reached
                ? buyer.purchased
                  ? 'bg-emerald-400/20 text-emerald-300'
                  : 'bg-brass/20 text-brass'
                : 'bg-bone/[0.08] text-bone/50'
            }`}
          >
            {JOURNEY_STEP_LABEL[step] ?? step}
          </span>
        </span>
      ))}
      {buyer.purchased && (
        <span className="ml-1 inline-flex items-center gap-1 rounded bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">
          <CheckCircle2 className="h-2.5 w-2.5" />
          {money(buyer.purchaseAmountCents)}
        </span>
      )}
    </div>
  );
}

export default function BuyerJourneyPage() {
  const [input, setInput] = useState<BuyerJourneyInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The selected funnel (null = the most-active, the default). */
  const [funnelId, setFunnelId] = useState<string | null>(null);
  /** The selected buyer for the individual path (null = none). */
  const [buyerId, setBuyerId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/buyer-journey', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load');
        setInput(json.input as BuyerJourneyInput);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      }
    })();
  }, []);

  const journey = useMemo(() => (input ? buildBuyerJourney(input) : null), [input]);
  const aggregate =
    journey?.aggregates.find((a) => a.funnelId === funnelId) ?? journey?.aggregates[0] ?? null;
  const funnelBuyers = useMemo(
    () => (journey?.buyers ?? []).filter((b) => b.funnelId === aggregate?.funnelId),
    [journey, aggregate],
  );
  const selectedBuyer = funnelBuyers.find((b) => b.id === buyerId) ?? null;
  const maxReached = aggregate ? Math.max(...aggregate.steps.map((s) => s.reached), 1) : 1;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-noir">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-bone/10 px-4">
        <Link
          href="/admin/system-map"
          className="inline-flex items-center gap-1.5 rounded-lg border border-bone/15 px-2.5 py-1.5 text-xs text-bone/60 hover:bg-bone/10"
        >
          <ArrowLeftCircle className="h-3.5 w-3.5" /> System map
        </Link>
        <h1 className="font-display text-lg font-semibold text-bone">Buyer journey</h1>
        <span className="text-[10px] text-bone/35">
          the path buyers actually traveled — one buyer or many
        </span>
        {/* the funnel picker */}
        {journey && journey.aggregates.length > 1 && (
          <div className="ml-auto flex items-center gap-1">
            {journey.aggregates.map((a) => (
              <button
                key={a.funnelId}
                type="button"
                onClick={() => {
                  setFunnelId(a.funnelId);
                  setBuyerId(null);
                }}
                className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold ${
                  a.funnelId === aggregate?.funnelId
                    ? 'bg-brass/20 text-brass'
                    : 'text-bone/40 hover:bg-bone/10'
                }`}
              >
                {a.funnelName}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-6">
        {error ? (
          <p className="text-sm text-red-300">{error}</p>
        ) : !journey ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-bone/40" />
          </div>
        ) : !aggregate ? (
          <p className="py-12 text-center text-sm text-bone/40">
            No buyers yet — the journeys map here the moment the first lead opts in.
          </p>
        ) : (
          <>
            {/* ——— The aggregate: many buyers ——— */}
            <div className="mb-2 flex flex-wrap items-baseline gap-4">
              <h2 className="font-display text-xl font-semibold text-bone">{aggregate.funnelName}</h2>
              <span className="text-[11px] text-bone/40">{aggregate.totalBuyers} buyers</span>
              <span className="text-[11px] text-emerald-300">
                {aggregate.purchased} purchased · {money(aggregate.revenueCents)}
              </span>
              <span className="text-[11px] text-bone/40">{aggregate.inProgress} in progress</span>
            </div>

            {/* the journey path — how many reached each step, where they dropped */}
            <div className="rounded-xl border border-bone/10 bg-bone/[0.02] p-4">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-bone/35">
                The path · how many buyers reached each step
              </p>
              <div className="space-y-1.5">
                {aggregate.steps.map((s) => (
                  <div key={s.step} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 truncate text-[11px] text-bone/60">{s.label}</span>
                    <div className="relative h-5 min-w-0 flex-1">
                      <div
                        className="h-full rounded bg-brass/25"
                        style={{ width: `${(s.reached / maxReached) * 100}%` }}
                      />
                      <span className="absolute inset-y-0 left-2 flex items-center text-[10px] font-semibold text-bone/80">
                        {s.reached}
                      </span>
                    </div>
                    {s.stoppedHere > 0 && (
                      <span className="inline-flex w-24 shrink-0 items-center gap-1 text-[9px] text-bone/35">
                        <TrendingDown className="h-2.5 w-2.5" />
                        {s.stoppedHere} stopped
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {/* where they came from */}
              {aggregate.sources.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-bone/5 pt-3">
                  <span className="text-[9px] uppercase tracking-wide text-bone/30">From:</span>
                  {aggregate.sources.map((s) => (
                    <span
                      key={s.source}
                      className="rounded bg-bone/[0.08] px-1.5 py-0.5 text-[9px] font-semibold text-bone/60"
                    >
                      {s.source} · {s.count}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ——— The individual: one buyer ——— */}
            <div className="mt-6">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-bone/35">
                One buyer · pick one to see their path
              </p>
              <div className="grid gap-1.5">
                {funnelBuyers.slice(0, 30).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBuyerId(b.id === buyerId ? null : b.id)}
                    className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                      b.id === buyerId
                        ? 'border-brass/50 bg-brass/[0.08]'
                        : 'border-bone/10 bg-bone/[0.02] hover:bg-bone/[0.05]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-bone/85">
                        {b.name}
                      </span>
                      <span className="text-[9px] uppercase tracking-wide text-bone/35">
                        {b.source || 'direct'}
                      </span>
                      {b.purchased && (
                        <span className="text-[9px] font-semibold text-emerald-300">
                          {money(b.purchaseAmountCents)}
                        </span>
                      )}
                    </div>
                    {b.id === buyerId && (
                      <div className="mt-2 border-t border-bone/10 pt-2">
                        <BuyerPath buyer={b} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              {funnelBuyers.length > 30 && (
                <p className="mt-2 text-[10px] text-bone/30">
                  showing the 30 most recent of {funnelBuyers.length}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
