/**
 * Agent spend estimates (roadmap task 0.3): the pure cost model behind the
 * call telemetry and the workspace spend meter.
 *
 * These are ESTIMATES, documented as such — gateway prices drift, and the
 * honest UI says "~$0.19 est." rather than pretending a ledger. What IS
 * exact: cached calls cost zero (the pay-once rule), and failed/blocked
 * calls never count as paid runs.
 *
 * Pure: no imports. The server (loop telemetry) and the client (trace
 * meter) share this module.
 */

/** Estimated cents per FRESH (non-cached, non-failed) call, by tool. */
export const TOOL_COST_ESTIMATES_CENTS: Record<string, number> = {
  web_search: 0, // model-native, rides the model bill
  internal_metrics: 0, // our own DB
  get_context: 0,
  create_artifact: 0,
  social_search: 4, // one Monid run
  voice_audit: 8, // posts run + up to 3-5 comment runs
  reddit_deep_dive: 6, // search + comment runs (pullpush fallback is free)
  amazon_reviews: 3, // RapidAPI / Apify
  top_posts: 4, // one Monid run (deep)
  post_comments: 4, // one Monid run (deep)
  voice_deep_dive: 14, // posts run + up to 6 comment runs (deep)
};

export interface CallCostEstimate {
  /** True when this call counts as a fresh paid run. */
  paid: boolean;
  /** True when the result came from the cache (pay-once: cost zero). */
  cached: boolean;
  /** Estimated cents (0 for cached/failed/free calls). */
  estCostCents: number;
}

export interface SpendSummary {
  /** Tool calls total. */
  runs: number;
  /** Served from cache. */
  cachedRuns: number;
  /** Estimated fresh paid runs. */
  paidRuns: number;
  estCostCents: number;
}

/**
 * Estimate one call's cost from its trace record. The cache marker rides
 * the result summary (`cached, 4521 chars`, `6 posts ranked (cached)`) —
 * the executors put it there on purpose, and this is the second consumer.
 */
export function estimateCallCost(call: {
  name: string;
  resultSummary: string;
}): CallCostEstimate {
  const summary = (call.resultSummary || '').toLowerCase();
  const cached = /cached/.test(summary);
  const unsuccessful = /^(failed|blocked)/.test(summary);
  // Declarative skills (Phase 3): the estimate rides the result line as
  // `~est Nc`, stamped by the bridge from the skill ROW — the marker
  // convention, same as 'cached'. No marker, no claim: 0.
  if (call.name.startsWith('skill_')) {
    if (unsuccessful) return { paid: false, cached: false, estCostCents: 0 };
    const marker = /~est (\d+)c/.exec(call.resultSummary || '');
    const cents = marker ? Number.parseInt(marker[1], 10) : 0;
    return {
      paid: cents > 0,
      cached: false,
      estCostCents: cents,
    };
  }
  const table = TOOL_COST_ESTIMATES_CENTS[call.name] ?? 0;
  const paid = table > 0 && !cached && !unsuccessful;
  return { paid, cached, estCostCents: paid ? table : 0 };
}

/** Roll a turn's trace records into the meter totals. */
export function summarizeCalls(
  calls: Array<{ name: string; resultSummary: string }>,
): SpendSummary {
  const out: SpendSummary = {
    runs: calls.length,
    cachedRuns: 0,
    paidRuns: 0,
    estCostCents: 0,
  };
  for (const call of calls) {
    const est = estimateCallCost(call);
    if (est.cached) out.cachedRuns += 1;
    if (est.paid) out.paidRuns += 1;
    out.estCostCents += est.estCostCents;
  }
  return out;
}

/**
 * The meter line: `5 runs · 2 cached · ~$0.19 est.`, or
 * `3 runs · no paid calls` when nothing billed.
 */
export function formatSpendLine(summary: SpendSummary): string {
  const runs = `${summary.runs} run${summary.runs === 1 ? '' : 's'}`;
  if (summary.estCostCents === 0) {
    const cachedBit =
      summary.cachedRuns > 0 ? ` · ${summary.cachedRuns} cached` : '';
    return `${runs}${cachedBit} · no paid calls`;
  }
  return `${runs} · ${summary.cachedRuns} cached · ~$${(
    summary.estCostCents / 100
  ).toFixed(2)} est.`;
}
