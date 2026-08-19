'use client';

/**
 * The funnel comparison — pick two systems and see them side by side: views,
 * leads, sales, the conversion rate, the revenue, with the delta between
 * them. The answer to "is the new funnel actually beating the old one" — the
 * A/B read the clone-variant blueprint sets up. A right-side sheet, like the
 * node peek.
 */
import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { SystemMapInput } from '@/lib/mothermode/systemMap';

type FunnelMetrics = SystemMapInput['funnels'][number]['metrics'];

function rate(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0;
}

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/** One metric row: the label, A's value, B's value, and who's ahead. */
function Row({
  label,
  a,
  b,
  higherIsBetter = true,
}: {
  label: string;
  a: number;
  b: number;
  higherIsBetter?: boolean;
}) {
  // Who's ahead — only meaningful when both have a signal.
  const aWins = a !== b && (higherIsBetter ? a > b : a < b);
  const bWins = a !== b && (higherIsBetter ? b > a : b < a);
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-3 py-1 text-[11px]">
      <span className="text-bone/50">{label}</span>
      <span className={`text-right font-semibold ${aWins ? 'text-emerald-300' : 'text-bone/80'}`}>
        {a.toLocaleString()}
      </span>
      <span className={`text-right font-semibold ${bWins ? 'text-emerald-300' : 'text-bone/80'}`}>
        {b.toLocaleString()}
      </span>
    </div>
  );
}

export default function ComparePanel({
  input,
  open,
  onClose,
}: {
  input: SystemMapInput | null;
  open: boolean;
  onClose: () => void;
}) {
  const funnels = input?.funnels ?? [];
  const [aId, setAId] = useState('');
  const [bId, setBId] = useState('');

  const a = funnels.find((f) => f.id === aId) ?? null;
  const b = funnels.find((f) => f.id === bId) ?? null;

  // The derived rates, per side. Conversion = sales per view (the whole
  // funnel's job); the rest are the stage rates.
  const derived = useMemo(() => {
    const d = (m: FunnelMetrics) => ({
      conversion: rate(m.purchases, m.views),
      optinRate: rate(m.leads, m.views),
      checkoutRate: rate(m.purchases, m.checkouts),
    });
    return { a: a ? d(a.metrics) : null, b: b ? d(b.metrics) : null };
  }, [a, b]);

  if (!open) return null;

  const selectCls =
    'min-w-0 flex-1 rounded-lg border border-bone/15 bg-ink px-2 py-1.5 text-[11px] text-bone/90 outline-none focus:border-brass/50';

  return (
    <div className="absolute right-0 top-0 z-20 flex h-full w-[440px] flex-col border-l border-bone/10 bg-ink shadow-2xl">
      <div className="flex items-start justify-between gap-2 border-b border-bone/10 px-5 py-4">
        <div>
          <p className="text-[9px] uppercase tracking-widest text-bone/40">Compare</p>
          <h3 className="mt-0.5 text-sm font-semibold text-bone">Two funnels, side by side</h3>
        </div>
        <button type="button" onClick={onClose} className="shrink-0 rounded p-1 text-bone/40 hover:text-bone">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {funnels.length < 2 ? (
          <p className="text-[11px] text-bone/45">
            You need at least two funnels to compare. Build a second one — or clone a winner into a
            variant — and the A/B read lands here.
          </p>
        ) : (
          <>
            {/* the two pickers */}
            <div className="grid grid-cols-2 gap-2">
              <select value={aId} onChange={(e) => setAId(e.target.value)} className={selectCls}>
                <option value="">Funnel A…</option>
                {funnels.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <select value={bId} onChange={(e) => setBId(e.target.value)} className={selectCls}>
                <option value="">Funnel B…</option>
                {funnels.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            {a && b && a.id !== b.id && derived.a && derived.b ? (
              <div className="mt-4">
                {/* the column headers */}
                <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-3 border-b border-bone/10 pb-2 text-[10px] uppercase tracking-wide text-bone/40">
                  <span>Metric</span>
                  <span className="max-w-[120px] truncate text-right text-brass/90">{a.name}</span>
                  <span className="max-w-[120px] truncate text-right text-sky-300/90">{b.name}</span>
                </div>
                <div className="mt-1 divide-y divide-bone/[0.06]">
                  <Row label="Views" a={a.metrics.views} b={b.metrics.views} />
                  <Row label="Leads" a={a.metrics.leads} b={b.metrics.leads} />
                  <Row label="Checkouts" a={a.metrics.checkouts} b={b.metrics.checkouts} />
                  <Row label="Sales" a={a.metrics.purchases} b={b.metrics.purchases} />
                </div>
                <div className="mt-1 divide-y divide-bone/[0.06] border-t border-bone/10 pt-1">
                  <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-3 py-1 text-[11px]">
                    <span className="text-bone/50">Conversion (sales / view)</span>
                    <span className={`text-right font-semibold ${derived.a.conversion > derived.b.conversion ? 'text-emerald-300' : 'text-bone/80'}`}>
                      {(derived.a.conversion * 100).toFixed(1)}%
                    </span>
                    <span className={`text-right font-semibold ${derived.b.conversion > derived.a.conversion ? 'text-emerald-300' : 'text-bone/80'}`}>
                      {(derived.b.conversion * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-3 py-1 text-[11px]">
                    <span className="text-bone/50">Revenue</span>
                    <span className={`text-right font-semibold ${a.metrics.revenueCents > b.metrics.revenueCents ? 'text-emerald-300' : 'text-bone/80'}`}>
                      {money(a.metrics.revenueCents)}
                    </span>
                    <span className={`text-right font-semibold ${b.metrics.revenueCents > a.metrics.revenueCents ? 'text-emerald-300' : 'text-bone/80'}`}>
                      {money(b.metrics.revenueCents)}
                    </span>
                  </div>
                </div>
                {/* the verdict — who's ahead on the metric that matters */}
                {a.metrics.views > 0 && b.metrics.views > 0 && derived.a.conversion !== derived.b.conversion && (
                  <p className="mt-3 rounded-lg border border-brass/30 bg-brass/[0.08] px-3 py-2 text-[11px] leading-relaxed text-bone/80">
                    <span className="font-semibold text-brass">
                      {derived.a.conversion > derived.b.conversion ? a.name : b.name}
                    </span>{' '}
                    converts better —{' '}
                    {Math.abs(derived.a.conversion - derived.b.conversion) * 100 >= 0.05
                      ? `${(Math.abs(derived.a.conversion - derived.b.conversion) * 100).toFixed(1)} pts ahead`
                      : 'a hair ahead'}{' '}
                    on sales per view.
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-4 text-[11px] text-bone/45">
                {a && b && a.id === b.id
                  ? 'Pick two different funnels.'
                  : 'Pick two funnels to see them side by side.'}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
