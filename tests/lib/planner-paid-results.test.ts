/**
 * The paid block on a piece: when it may appear, and what it may not claim.
 *
 * These tests exist because the paid block is the one place a reader could
 * mistake "we never recorded your budget" for "your tracking is broken", and the
 * one place an ad with clicks and no sales could be silently hidden.
 */

import { describe, it, expect } from 'vitest';
import {
  paidResultsSummary,
  pieceEconomics,
  SPEND_NOT_RECORDED_NOTE,
  emptyTrafficSplit
} from '@/lib/mothermode/planner/adMetrics';

describe('paidClicks as the gate for paid figures', () => {
  it('is null when no medium split was read, so a surface cannot claim the piece was never advertised', () => {
    const economics = pieceEconomics({
      clicks: 100,
      clicksByTrafficType: null,
      slice: { optins: 10, purchases: 1, revenueCents: 4900 }
    });

    expect(economics.paidClicks).toBeNull();
    // Absent gate → no paid block at all, rather than "0 paid clicks".
    expect(paidResultsSummary(economics)).toBeNull();
  });

  it('is 0 — not null — when the split was read and this piece simply was not boosted', () => {
    const economics = pieceEconomics({
      clicks: 100,
      clicksByTrafficType: { paid: 0, organic: 100 },
      slice: { optins: 10, purchases: 1, revenueCents: 4900 }
    });

    expect(economics.paidClicks).toBe(0);
    expect(paidResultsSummary(economics)).toBeNull();
  });
});

describe('paidResultsSummary', () => {
  it('reports a running ad that has earned nothing — the case bidCeilingSummary must stay silent about', () => {
    const split = emptyTrafficSplit();
    const economics = pieceEconomics({
      clicks: 200,
      clicksByTrafficType: { paid: 200 },
      slice: { optins: 0, purchases: 0, revenueCents: 0 },
      split
    });

    const summary = paidResultsSummary(economics);
    expect(summary).toContain('200 paid clicks');
    expect(summary).toContain('0.0% opted in');
    /*
     * $0.000 IS shown, and that is correct rather than a gap: revenue here is a
     * measured zero, so "every one of those 200 clicks earned nothing" is a
     * fact — and the most actionable one on the screen. It is `n/a` that would
     * be the lie, since it would imply the ad was never measured.
     */
    expect(summary).toContain('$0.000 per paid click');
  });

  it('omits the per-click figure entirely when paid revenue is UNKNOWN, rather than showing $0.000', () => {
    // No split at all = the attribution join failed. Distinct from the case
    // above, where the join succeeded and the answer was zero.
    const economics = pieceEconomics({
      clicks: 200,
      clicksByTrafficType: { paid: 200 },
      slice: null,
      split: null
    });

    const summary = paidResultsSummary(economics);
    expect(summary).toContain('200 paid clicks');
    expect(summary).not.toContain('per paid click');
    expect(summary).not.toContain('opted in');
  });


  it('divides paid revenue by PAID clicks, never by the blended click count', () => {
    /*
     * The figures are chosen so paid and blended CANNOT coincide. Organic here
     * earns nine times what paid does on four times the clicks, so a blended
     * EPC is double the paid one — if the paid line were ever divided by the
     * blended click count, or fed blended revenue, this assertion breaks.
     * An arithmetic tie would let the bug pass, which is why it is avoided.
     */
    const split = emptyTrafficSplit();
    split.paid = { optins: 10, purchases: 2, revenueCents: 10000 };
    split.organic = { optins: 40, purchases: 8, revenueCents: 90000 };

    const economics = pieceEconomics({
      clicks: 1000,
      clicksByTrafficType: { paid: 200, organic: 800 },
      slice: { optins: 50, purchases: 10, revenueCents: 100000 },
      split
    });

    // $100.00 paid revenue ÷ 200 paid clicks = $0.500 per paid click.
    expect(economics.paid.epcCents).toBe(50);
    expect(paidResultsSummary(economics)).toContain('$0.500 per paid click');

    // The blend is $1,000 ÷ 1,000 clicks = $1.00 — twice as generous, and the
    // number a bid must NOT be set from.
    expect(economics.blended.epcCents).toBe(100);
    expect(paidResultsSummary(economics)).not.toContain('$1.00');

    // Paid opted in at 10/200 = 5%, the blend at 50/1000 = 5% — equal by
    // accident of these counts, so the paid rate is pinned directly instead of
    // being asserted through a string that proves nothing.
    expect(economics.paid.optinRate).toBeCloseTo(0.05);
  });

  it('singularises one click, because "1 paid clicks" reads as a bug in the number', () => {
    const economics = pieceEconomics({
      clicks: 1,
      clicksByTrafficType: { paid: 1 },
      slice: { optins: 0, purchases: 0, revenueCents: 0 },
      split: emptyTrafficSplit()
    });

    expect(paidResultsSummary(economics)).toContain('1 paid click');
    expect(paidResultsSummary(economics)).not.toContain('1 paid clicks');
  });
});

describe('SPEND_NOT_RECORDED_NOTE', () => {
  it('blames the missing budget rather than the measurement, so nobody debugs the click pipeline', () => {
    expect(SPEND_NOT_RECORDED_NOTE).toContain('not recorded');
    expect(SPEND_NOT_RECORDED_NOTE).toMatch(/earnings only/);
  });

  it('states the grain, because a per-post ROAS is not derivable from what ad platforms export', () => {
    expect(SPEND_NOT_RECORDED_NOTE).toContain('per campaign');
  });
});
