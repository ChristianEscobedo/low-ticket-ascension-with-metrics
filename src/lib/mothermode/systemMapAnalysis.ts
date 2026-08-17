/**
 * The System Map analysis engine (pure): the metrics that matter live on the
 * EDGES, not the nodes. This module turns the funnel records' step counts into
 * a conversion rate per connection, grades each edge's health, and finds the
 * leak — the weakest connection in the whole system.
 *
 * The money spine of a sales funnel is sequential, and the funnel record
 * already tracks each step's count:
 *
 *   view ──optin──► lead ──checkout──► checkout ──purchase──► sale
 *   (viewCount)  (conversionCount)   (checkoutCount)      (purchaseCount)
 *
 * Each rate rides the edge INTO that page in the graph: the funnel→checkout
 * edge carries the optin→checkout rate, and so on. Upsells carry their take
 * rate (yes / yes+no). No new queries — it's pure computation over the same
 * `SystemMapInput` the builder takes.
 *
 * TWO AXES, NEVER MIXED (the NodeCard doc's rule): the node card's
 * built/draft/pending is the BUILD axis; an edge's good/ok/bad here is the
 * PERFORMANCE axis. The page colors edges by this, never the node cards.
 *
 * Pure: no server imports, no React — unit-tested, and the page is a dumb
 * renderer of the result.
 */
import type { SystemMapInput } from './systemMap';

// ---------------------------------------------------------------------------
// The result
// ---------------------------------------------------------------------------

/** The performance health of one connection (the edge's axis). */
export type EdgeHealth = 'good' | 'ok' | 'bad';

export interface EdgeRate {
  /** The builder edge this rate rides: `e:funnel:<id>->page:<id>:<key>`. */
  edgeId: string;
  funnelId: string;
  /** The step this rate arrives at (the page key: optin, checkout, success…). */
  pageKey: string;
  /** "Opt-in rate", "Checkout rate", "Upsell 1 take"… */
  label: string;
  /** 0..1. */
  rate: number;
  /** The denominator (how many reached the prior step). */
  fromCount: number;
  /** The numerator (how many arrived). */
  toCount: number;
  health: EdgeHealth;
}

export interface SystemMapLeak {
  funnelId: string;
  funnelName: string;
  edgeId: string;
  /** The node to link to (the page the leak is at). */
  nodeId: string;
  label: string;
  rate: number;
  fromCount: number;
}

export interface SystemMapAnalysis {
  edgeRates: EdgeRate[];
  /** The leaks across every funnel, worst-first. Empty when nothing's leaky. */
  leaks: SystemMapLeak[];
}

// ---------------------------------------------------------------------------
// The thresholds (per step — a "good" optin rate ≠ a "good" purchase rate)
// ---------------------------------------------------------------------------

interface StepDef {
  pageKey: string;
  label: string;
  /** rate ≥ good → 'good'; ≥ ok → 'ok'; below → 'bad'. */
  good: number;
  ok: number;
}

const SALES_STEPS: StepDef[] = [
  { pageKey: 'optin', label: 'Opt-in rate', good: 0.25, ok: 0.1 },
  { pageKey: 'checkout', label: 'Checkout rate', good: 0.2, ok: 0.08 },
  { pageKey: 'success', label: 'Purchase rate', good: 0.3, ok: 0.15 },
];
const UPSELL_STEP = (n: 1 | 2 | 3 | 4): StepDef => ({
  pageKey: `upsell${n}`,
  label: `Upsell ${n} take`,
  good: 0.2,
  ok: 0.1,
});

/** Below this many reaching the prior step, a rate is too thin to grade. */
const MIN_VOLUME = 10;

function healthOf(rate: number, step: StepDef): EdgeHealth {
  if (rate >= step.good) return 'good';
  if (rate >= step.ok) return 'ok';
  return 'bad';
}

/** The builder's edge id for the funnel→page connection (the join key). */
function spineEdgeId(funnelId: string, pageKey: string): string {
  return `e:funnel:${funnelId}->page:${funnelId}:${pageKey}`;
}

// ---------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------

/**
 * Analyze the system. For each funnel, walk the money spine and grade each
 * step's arrival rate; the leak is the lowest-rated edge with enough volume
 * to be meaningful (and only flagged when it's actually underperforming —
 * never cry wolf on a healthy funnel).
 */
export function analyzeSystemMap(input: SystemMapInput): SystemMapAnalysis {
  const edgeRates: EdgeRate[] = [];
  const leaks: SystemMapLeak[] = [];

  for (const f of input.funnels) {
    const m = f.metrics;
    // The sequential money spine: each step's (numerator, denominator).
    // optin: leads / views · checkout: checkouts / leads · purchase: sales / checkouts.
    const spine: Array<{ step: StepDef; to: number; from: number }> = [
      { step: SALES_STEPS[0], to: m.leads, from: m.views },
      { step: SALES_STEPS[1], to: m.checkouts, from: m.leads },
      { step: SALES_STEPS[2], to: m.purchases, from: m.checkouts },
    ];

    const funnelEdges: EdgeRate[] = [];
    for (const { step, to, from } of spine) {
      // Only grade a step the funnel actually has a page for, with volume.
      if (!f.pages.some((p) => p.key === step.pageKey)) continue;
      if (from < MIN_VOLUME) continue;
      const rate = to / from;
      funnelEdges.push({
        edgeId: spineEdgeId(f.id, step.pageKey),
        funnelId: f.id,
        pageKey: step.pageKey,
        label: step.label,
        rate,
        fromCount: from,
        toCount: to,
        health: healthOf(rate, step),
      });
    }

    // The upsell take rates (yes / yes+no) — only for enabled upsell pages.
    // (The funnel input doesn't carry the yes/no split yet — when it does,
    // these light up. The spine above is the v1 signal.)
    void UPSELL_STEP;

    edgeRates.push(...funnelEdges);

    // The leak: this funnel's worst edge, only when it's underperforming.
    const worst = [...funnelEdges].sort((a, b) => a.rate - b.rate)[0];
    if (worst && worst.health === 'bad') {
      leaks.push({
        funnelId: f.id,
        funnelName: f.name || f.slug,
        edgeId: worst.edgeId,
        nodeId: `page:${f.id}:${worst.pageKey}`,
        label: worst.label,
        rate: worst.rate,
        fromCount: worst.fromCount,
      });
    }
  }

  // Rank every funnel's leak worst-first — the top of the list is where the
  // operator starts the day.
  leaks.sort((a, b) => a.rate - b.rate);

  return { edgeRates, leaks };
}

/** The edge's health color (the page reads this — the performance axis). */
export const EDGE_HEALTH_COLOR: Record<EdgeHealth, string> = {
  good: 'rgba(52, 211, 153, 0.55)', // emerald
  ok: 'rgba(251, 191, 36, 0.5)', // amber
  bad: 'rgba(248, 113, 113, 0.6)', // red
};
