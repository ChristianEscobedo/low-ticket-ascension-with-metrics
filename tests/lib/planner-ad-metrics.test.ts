import { describe, it, expect } from 'vitest';

import {
  breakEvenSummary,
  deriveFunnelEconomics,
  formatCents,
  formatCentsPrecise,
  formatRate,
  formatRoas,
  ratio,
  trafficType,
  trafficTypeLabel
} from '@/lib/mothermode/planner/adMetrics';

/**
 * These tests are weighted deliberately toward the ways this module could lie
 * rather than toward its happy path. A wrong EPC is a wrong bid, and a wrong
 * ROAS keeps a losing campaign running — so the zero/null/Infinity cases get
 * the coverage, and "5 clicks 1 sale" gets one line.
 */

describe('ratio', () => {
  it('divides normally', () => {
    expect(ratio(10, 4)).toBe(2.5);
  });

  it('returns null rather than Infinity when the denominator is zero', () => {
    // The headline case: `5 / 0` is Infinity in JS and React renders it.
    expect(ratio(5, 0)).toBeNull();
  });

  it('returns null rather than NaN for 0/0', () => {
    expect(ratio(0, 0)).toBeNull();
  });

  it('propagates unknown inputs as null', () => {
    expect(ratio(null, 10)).toBeNull();
    expect(ratio(10, null)).toBeNull();
    expect(ratio(undefined, 10)).toBeNull();
  });

  it('refuses non-finite inputs so one bad number cannot poison a row', () => {
    expect(ratio(Infinity, 10)).toBeNull();
    expect(ratio(NaN, 10)).toBeNull();
    expect(ratio(10, Infinity)).toBeNull();
  });

  it('refuses a negative denominator instead of returning a negative rate', () => {
    expect(ratio(10, -5)).toBeNull();
  });

  it('allows a legitimately fractional result (EPC is usually cents)', () => {
    expect(ratio(34, 100)).toBeCloseTo(0.34);
  });
});

describe('trafficType', () => {
  it('classifies known paid mediums', () => {
    expect(trafficType('cpc')).toBe('paid');
    expect(trafficType('paid_social')).toBe('paid');
    expect(trafficType('retargeting')).toBe('paid');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(trafficType('  CPC  ')).toBe('paid');
  });

  it('treats a recognised non-paid medium as organic', () => {
    expect(trafficType('social')).toBe('organic');
    expect(trafficType('email')).toBe('organic');
  });

  it('treats a MISSING medium as unattributed, never organic', () => {
    /*
     * The most important assertion in this file. If an untagged row defaulted to
     * organic, a mis-tagged ad would show its leads as free organic reach while
     * its cost sat in the paid bucket — flattering both numbers at once, and so
     * never questioned.
     */
    expect(trafficType('')).toBe('unattributed');
    expect(trafficType(null)).toBe('unattributed');
    expect(trafficType(undefined)).toBe('unattributed');
    expect(trafficType('   ')).toBe('unattributed');
  });

  it('sends an unrecognised medium to organic, not silently to paid', () => {
    // Allowlist semantics: unknown is not paid, because claiming spend exists
    // where none was recorded would invent a cost.
    expect(trafficType('paid_social_advantage_plus')).toBe('organic');
  });

  it('labels each bucket once', () => {
    expect(trafficTypeLabel('paid')).toBe('Paid');
    expect(trafficTypeLabel('organic')).toBe('Organic');
    expect(trafficTypeLabel('unattributed')).toBe('Untagged');
  });
});

describe('deriveFunnelEconomics — Tier A (no spend)', () => {
  const base = {
    clicks: 100,
    optins: 20,
    purchases: 4,
    revenueCents: 39600 // 4 x $99
  };

  it('derives yield and conversion metrics', () => {
    const e = deriveFunnelEconomics(base);
    expect(e.epcCents).toBeCloseTo(396); // $3.96 per click
    expect(e.eplCents).toBeCloseTo(1980); // $19.80 per lead
    expect(e.aovCents).toBeCloseTo(9900); // $99.00
    expect(e.optinRate).toBeCloseTo(0.2);
    expect(e.leadToSaleRate).toBeCloseTo(0.2);
    expect(e.clickToSaleRate).toBeCloseTo(0.04);
  });

  it('reads every cost metric as null while spend is unrecorded', () => {
    const e = deriveFunnelEconomics(base);
    expect(e.cpcCents).toBeNull();
    expect(e.cplCents).toBeNull();
    expect(e.cacCents).toBeNull();
    expect(e.roas).toBeNull();
    expect(e.losingMoneyPerLead).toBe(false);
  });

  it('does NOT report revenue as profit when spend is unknown', () => {
    // `revenue - 0` here would make an unmeasured campaign look healthy.
    expect(deriveFunnelEconomics(base).profitCents).toBeNull();
  });

  it('handles a brand-new piece with no traffic at all', () => {
    const e = deriveFunnelEconomics({
      clicks: 0,
      optins: 0,
      purchases: 0,
      revenueCents: 0
    });
    expect(e.epcCents).toBeNull();
    expect(e.optinRate).toBeNull();
    expect(e.aovCents).toBeNull();
  });

  it('keeps EPC null when revenue is unknown even though clicks exist', () => {
    const e = deriveFunnelEconomics({
      clicks: 50,
      optins: null,
      purchases: null,
      revenueCents: null
    });
    expect(e.epcCents).toBeNull();
    expect(e.eplCents).toBeNull();
    expect(e.optinRate).toBeNull();
  });

  it('reports a real zero-revenue result as $0 EPC, not unknown', () => {
    // Clicks happened, revenue is genuinely 0. That is a measured failure and
    // must not be dressed up as "not measurable".
    const e = deriveFunnelEconomics({
      clicks: 80,
      optins: 5,
      purchases: 0,
      revenueCents: 0
    });
    expect(e.epcCents).toBe(0);
    expect(e.clickToSaleRate).toBe(0);
    expect(e.aovCents).toBeNull(); // no purchases to average over
  });
});

describe('deriveFunnelEconomics — Tier B (spend present)', () => {
  const withSpend = {
    clicks: 100,
    optins: 20,
    purchases: 4,
    revenueCents: 39600,
    spendCents: 20000 // $200
  };

  it('derives cost metrics and ROAS', () => {
    const e = deriveFunnelEconomics(withSpend);
    expect(e.cpcCents).toBeCloseTo(200); // $2.00
    expect(e.cplCents).toBeCloseTo(1000); // $10.00
    expect(e.cacCents).toBeCloseTo(5000); // $50.00
    expect(e.roas).toBeCloseTo(1.98);
    expect(e.profitCents).toBe(19600);
  });

  it('flags a campaign paying more per lead than a lead is worth', () => {
    const e = deriveFunnelEconomics({ ...withSpend, spendCents: 60000 });
    // CPL $30 against EPL $19.80.
    expect(e.losingMoneyPerLead).toBe(true);
    expect(e.profitCents).toBe(-20400);
    expect(e.roas).toBeCloseTo(0.66);
  });

  it('never returns an infinite ROAS when spend is zero', () => {
    // An unbounded ROAS reads as the best campaign ever run.
    const e = deriveFunnelEconomics({ ...withSpend, spendCents: 0 });
    expect(e.roas).toBeNull();
    expect(e.profitCents).toBe(39600); // spend genuinely 0, so profit is known
  });

  it('treats a zero spend as a real $0 cost, not as unknown', () => {
    /*
     * The asymmetry that makes zero-spend subtle, and the reason it gets its own
     * test: a recorded spend of 0 is a FACT, so it behaves differently depending
     * on which side of the fraction it lands.
     *
     *   - as a numerator (CPC = spend / clicks) → 0 is the true answer. These
     *     100 clicks really did cost nothing.
     *   - as a denominator (ROAS = revenue / spend) → undefined, so null.
     *
     * Collapsing both to null would be over-cautious in a way that hides a real
     * measurement; collapsing both to 0 would report an infinite return as
     * break-even. Each side is judged on its own.
     */
    const e = deriveFunnelEconomics({ ...withSpend, spendCents: 0 });
    expect(e.cpcCents).toBe(0);
    expect(e.cplCents).toBe(0);
    expect(e.cacCents).toBe(0);
    // A free lead cannot cost more than it earns, so nothing is flagged.
    expect(e.losingMoneyPerLead).toBe(false);
  });

  it('does not flag losing money when spend is unknown', () => {
    const e = deriveFunnelEconomics({ ...withSpend, spendCents: null });
    expect(e.losingMoneyPerLead).toBe(false);
  });
});

describe('formatting', () => {
  it('renders null as n/a, matching the click surfaces vocabulary', () => {
    expect(formatCents(null)).toBe('n/a');
    expect(formatRate(null)).toBe('n/a');
    expect(formatRoas(null)).toBe('n/a');
    expect(formatCentsPrecise(null)).toBe('n/a');
  });

  it('formats dollars with separators', () => {
    expect(formatCents(123456)).toBe('$1,234.56');
    expect(formatCents(0)).toBe('$0.00');
  });

  it('keeps three decimals below a dollar where bidding differences live', () => {
    // $0.034 vs $0.04 is a third of your bid.
    expect(formatCentsPrecise(3.4)).toBe('$0.034');
    expect(formatCentsPrecise(250)).toBe('$2.50');
  });

  it('formats rates and ROAS', () => {
    expect(formatRate(0.125)).toBe('12.5%');
    expect(formatRoas(3.2)).toBe('3.20x');
  });

  it('never prints Infinity even if handed one directly', () => {
    expect(formatRoas(Infinity)).toBe('n/a');
    expect(formatCents(Infinity)).toBe('n/a');
    expect(formatRate(NaN)).toBe('n/a');
  });
});

describe('breakEvenSummary', () => {
  it('states both ceilings', () => {
    const e = deriveFunnelEconomics({
      clicks: 100,
      optins: 20,
      purchases: 4,
      revenueCents: 39600
    });
    expect(breakEvenSummary(e)).toBe('break-even CPC $3.96 · break-even CPL $19.80');
  });

  it('invents no bid ceiling when there is no revenue to derive one from', () => {
    const e = deriveFunnelEconomics({
      clicks: 0,
      optins: null,
      purchases: null,
      revenueCents: null
    });
    expect(breakEvenSummary(e)).toBeNull();
  });
});
