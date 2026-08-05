import { describe, expect, it } from 'vitest';

import {
  bidCeilingSummary,
  blendedRateCaveat,
  emptyTrafficSplit,
  pieceEconomics,
  sumAttributedSlices,
  sumTrafficSplits,
  trafficMix,
  type TrafficSplit
} from '@/lib/mothermode/planner/adMetrics';
import {
  rollupClicks,
  sumPieceAttribution,
  type LinkClickStats,
  type PieceAttribution,
  type UtmLinkRecord
} from '@/lib/mothermode/planner/links';

/**
 * The composition layer, tested where it can mislead rather than where it works.
 *
 * The Phase 1 file covered "is this arithmetic right". This one covers the only
 * question the display surfaces ask: "is this number allowed to be read as a
 * bid?" Every assertion below corresponds to a way a plausible-looking screen
 * would authorise spending money it should not.
 */

function slice(optins: number, purchases: number, revenueCents: number) {
  return { optins, purchases, revenueCents };
}

function split(over: Partial<TrafficSplit>): TrafficSplit {
  return { ...emptyTrafficSplit(), ...over };
}

describe('trafficMix', () => {
  it('describes the mix largest-share first', () => {
    const mix = trafficMix(
      split({ organic: slice(60, 0, 0), paid: slice(30, 0, 0), unattributed: slice(10, 0, 0) })
    );
    expect(mix.label).toBe('60% organic · 30% paid · 10% untagged');
    expect(mix.optins).toBe(100);
  });

  it('flags blended ONLY when paid and organic both produced leads', () => {
    // The flag that gates every "this is your bid ceiling" string in the UI.
    expect(trafficMix(split({ paid: slice(5, 0, 0), organic: slice(5, 0, 0) })).blended).toBe(true);
    expect(trafficMix(split({ paid: slice(5, 0, 0) })).blended).toBe(false);
    expect(trafficMix(split({ organic: slice(5, 0, 0) })).blended).toBe(false);
    // Untagged leads do not make a pure-paid row "blended" — they make it
    // incomplete, which is a different warning.
    expect(
      trafficMix(split({ paid: slice(5, 0, 0), unattributed: slice(5, 0, 0) })).blended
    ).toBe(false);
  });

  it('reports untagged opt-ins as their own number, never folded into organic', () => {
    const mix = trafficMix(split({ organic: slice(4, 0, 0), unattributed: slice(6, 0, 0) }));
    expect(mix.untaggedOptins).toBe(6);
    expect(mix.shares.organic).toBeCloseTo(0.4);
    expect(mix.shares.unattributed).toBeCloseTo(0.6);
  });

  it('says nothing at all with no opt-ins, rather than 0%', () => {
    const mix = trafficMix(emptyTrafficSplit());
    expect(mix.label).toBeNull();
    // Null, not 0 — "no leads yet" is not "0% of leads were paid".
    expect(mix.shares.paid).toBeNull();
    expect(mix.blended).toBe(false);
  });

  it('survives a missing split (failed attribution read)', () => {
    expect(trafficMix(null).label).toBeNull();
    expect(trafficMix(undefined).optins).toBe(0);
  });
});

describe('pieceEconomics', () => {
  /**
   * The headline scenario, and the reason the paid/blended split exists.
   *
   * A post with big organic reach and a small ad behind it. Organic converts
   * ~4x better, so the blended break-even CPL is ~3.7x the paid one — bid the
   * blended number and every lead loses money while the dashboard looks fine.
   */
  const bigOrganicSmallAd = {
    clicks: 1100,
    clicksByTrafficType: { organic: 1000, paid: 100, unattributed: 0 },
    slice: slice(15, 3, 55_000),
    split: split({ organic: slice(10, 2, 50_000), paid: slice(5, 1, 5_000) })
  };

  it('derives a paid bid ceiling far below the blended one', () => {
    const econ = pieceEconomics(bigOrganicSmallAd);
    expect(econ.blended.eplCents).toBeCloseTo(55_000 / 15);
    expect(econ.paid.eplCents).toBe(1_000);
    expect(econ.paid.eplCents!).toBeLessThan(econ.blended.eplCents!);
    expect(econ.blendedUnsafeForBidding).toBe(true);
  });

  it('divides paid revenue by PAID clicks, not the blended click count', () => {
    const econ = pieceEconomics(bigOrganicSmallAd);
    // 5000c / 100 paid clicks, not / 1100.
    expect(econ.paid.epcCents).toBeCloseTo(50);
    expect(econ.blended.epcCents).toBeCloseTo(55_000 / 1_100);
  });

  it('refuses a paid EPC when the paid click count is unknown', () => {
    // Would otherwise silently borrow the blended denominator and report a
    // ceiling ~11x too low here — wrong in the safe direction today, wrong in
    // the dangerous direction as soon as the ratio inverts.
    const econ = pieceEconomics({ ...bigOrganicSmallAd, clicksByTrafficType: null });
    expect(econ.paid.epcCents).toBeNull();
    // Lead-based figures still work: they never needed clicks.
    expect(econ.paid.eplCents).toBe(1_000);
  });

  it('keeps spend on the paid side and out of the blend', () => {
    const econ = pieceEconomics({ ...bigOrganicSmallAd, spendCents: 4_000 });
    expect(econ.paid.cpcCents).toBeCloseTo(40);
    expect(econ.paid.roas).toBeCloseTo(1.25);
    expect(econ.paid.profitCents).toBe(1_000);
    /*
     * The blend must not divide organic revenue by an ad bill. Blended ROAS here
     * would read 13.75x — a spectacular number for a campaign that is barely
     * breaking even.
     */
    expect(econ.blended.roas).toBeNull();
    expect(econ.blended.cpcCents).toBeNull();
    expect(econ.blended.profitCents).toBeNull();
  });

  it('catches the losing-money case on paid results only', () => {
    const econ = pieceEconomics({ ...bigOrganicSmallAd, spendCents: 9_000 });
    // CPL $18.00 against a paid EPL of $10.00.
    expect(econ.paid.losingMoneyPerLead).toBe(true);
    // The blended EPL ($36.67) would have called this profitable.
    expect(econ.blended.losingMoneyPerLead).toBe(false);
  });

  it('propagates a failed attribution read as null, never as zero earnings', () => {
    const econ = pieceEconomics({ clicks: 400, slice: null, split: null });
    expect(econ.blended.epcCents).toBeNull();
    expect(econ.blended.optinRate).toBeNull();
    expect(econ.paid.eplCents).toBeNull();
    expect(econ.mix.label).toBeNull();
  });

  it('propagates a failed click read without inventing an EPC', () => {
    const econ = pieceEconomics({ clicks: null, slice: slice(5, 1, 5_000), split: null });
    expect(econ.blended.epcCents).toBeNull();
    // Revenue-per-lead survives: it does not depend on clicks.
    expect(econ.blended.eplCents).toBe(1_000);
  });

  it('reports a click-only piece as 0% opt-in rate, which IS a measurement', () => {
    // Distinct from the null cases above: 40 clicks and no leads is the finding.
    const econ = pieceEconomics({ clicks: 40, slice: slice(0, 0, 0), split: emptyTrafficSplit() });
    expect(econ.blended.optinRate).toBe(0);
    expect(econ.blended.epcCents).toBe(0);
    expect(econ.blended.eplCents).toBeNull();
  });
});

describe('bidCeilingSummary / blendedRateCaveat', () => {
  it('quotes paid figures and labels them as paid', () => {
    const econ = pieceEconomics({
      clicks: 100,
      clicksByTrafficType: { paid: 100 },
      slice: slice(5, 1, 5_000),
      split: split({ paid: slice(5, 1, 5_000) })
    });
    const summary = bidCeilingSummary(econ)!;
    expect(summary).toContain('Paid traffic only');
    expect(summary).toContain('$10.00');
  });

  it('stays silent when paid traffic has earned nothing to reason from', () => {
    // An invented "$0.00 max bid" would be read as an instruction.
    const econ = pieceEconomics({
      clicks: 900,
      clicksByTrafficType: { organic: 900 },
      slice: slice(20, 4, 80_000),
      split: split({ organic: slice(20, 4, 80_000) })
    });
    expect(bidCeilingSummary(econ)).toBeNull();
    // And with no paid leads there is no blend to warn about either.
    expect(blendedRateCaveat(econ.mix)).toBeNull();
  });

  it('warns exactly when the rates above are budget-weighted', () => {
    const blended = trafficMix(split({ paid: slice(5, 0, 0), organic: slice(5, 0, 0) }));
    expect(blendedRateCaveat(blended)).toContain('blend paid and organic');
  });
});

describe('sumAttributedSlices / sumTrafficSplits', () => {
  it('adds all three fields, including revenue', () => {
    expect(sumAttributedSlices([slice(1, 1, 100), slice(2, 0, 0), null, undefined])).toEqual({
      optins: 3,
      purchases: 1,
      revenueCents: 100
    });
  });

  it('adds splits bucket by bucket without cross-contamination', () => {
    const total = sumTrafficSplits([
      split({ paid: slice(1, 1, 500) }),
      split({ organic: slice(2, 0, 0), paid: slice(1, 0, 0) })
    ]);
    expect(total.paid).toEqual({ optins: 2, purchases: 1, revenueCents: 500 });
    expect(total.organic).toEqual({ optins: 2, purchases: 0, revenueCents: 0 });
    expect(total.unattributed).toEqual({ optins: 0, purchases: 0, revenueCents: 0 });
  });
});

describe('sumPieceAttribution', () => {
  function piece(utmContent: string, over: Partial<PieceAttribution>): PieceAttribution {
    return {
      utmContent,
      optins: 0,
      purchases: 0,
      revenueCents: 0,
      byTrafficType: emptyTrafficSplit(),
      ...over
    } as PieceAttribution;
  }

  it('totals the map and keeps the traffic split', () => {
    const total = sumPieceAttribution(
      new Map([
        [
          'p1',
          piece('p1', {
            optins: 10,
            purchases: 2,
            revenueCents: 20_000,
            byTrafficType: split({ paid: slice(10, 2, 20_000) })
          })
        ],
        [
          'p2',
          piece('p2', {
            optins: 5,
            purchases: 1,
            revenueCents: 5_000,
            byTrafficType: split({ organic: slice(5, 1, 5_000) })
          })
        ]
      ])
    );

    expect(total.revenueCents).toBe(25_000);
    expect(total.optins).toBe(15);
    expect(total.purchases).toBe(3);
    expect(total.pieces).toBe(2);
    expect(total.byTrafficType.paid.revenueCents).toBe(20_000);
    expect(total.byTrafficType.organic.revenueCents).toBe(5_000);
  });

  it('returns zeros AND pieces: 0 when the read failed', () => {
    // `pieces: 0` is how a caller tells "the join failed" from "nothing has
    // been attributed yet" without being handed a null revenue to format.
    const total = sumPieceAttribution(null);
    expect(total.revenueCents).toBe(0);
    expect(total.pieces).toBe(0);
  });
});

describe('rollupClicks — clicks split by link medium', () => {
  function link(over: Partial<UtmLinkRecord>): UtmLinkRecord {
    return {
      id: 'l1',
      planId: null,
      funnelId: null,
      optinFunnelId: null,
      funnelPage: '',
      pieceId: '',
      label: '',
      baseUrl: 'https://example.com/f',
      utmSource: 'facebook',
      utmMedium: 'organic_social',
      utmCampaign: 'c',
      utmContent: '',
      utmTerm: '',
      fullUrl: 'https://example.com/f',
      shortCode: 'abc',
      clickCount: 0,
      lastClickedAt: null,
      createdAt: null,
      createdBy: null,
      ...over
    } as UtmLinkRecord;
  }

  const empty = new Map<string, LinkClickStats>();

  it('splits a piece\u2019s clicks across its boosted and organic links', () => {
    // The denominator that makes a paid EPC possible: one piece, two links.
    const out = rollupClicks(
      [
        link({ id: 'a', utmContent: 'p1', utmMedium: 'paid_social', clickCount: 100 }),
        link({ id: 'b', utmContent: 'p1', utmMedium: 'organic_social', clickCount: 900 })
      ],
      empty
    );

    expect(out.byPieceId.p1).toBe(1_000);
    expect(out.mediumSplitByPieceId.p1).toEqual({ paid: 100, organic: 900, unattributed: 0 });
    expect(out.clicksByTrafficType).toEqual({ paid: 100, organic: 900, unattributed: 0 });
  });

  it('puts an untagged link\u2019s clicks in unattributed, never in organic', () => {
    /*
     * Same rule as leads, and the same reason: a mis-tagged AD link is exactly
     * how a row arrives with no medium. Calling those clicks organic would shrink
     * the paid denominator, which INFLATES the paid EPC and therefore the bid.
     */
    const out = rollupClicks([link({ id: 'a', utmContent: 'p1', utmMedium: '', clickCount: 50 })], empty);
    expect(out.mediumSplitByPieceId.p1).toEqual({ paid: 0, organic: 0, unattributed: 50 });
    expect(out.clicksByTrafficType.organic).toBe(0);
  });

  it('omits pieces with no clicks rather than writing zeroed buckets', () => {
    const out = rollupClicks([link({ id: 'a', utmContent: 'p1', clickCount: 0 })], empty);
    expect(out.mediumSplitByPieceId.p1).toBeUndefined();
  });

  it('leaves the IP-hash "unattributed" numbers untouched', () => {
    // Two unrelated unknowns share the word: no medium (where from) vs no hash
    // (who). This asserts they stay separate fields.
    const out = rollupClicks(
      [link({ id: 'a', utmContent: 'p1', utmMedium: 'cpc', clickCount: 10 })],
      new Map([
        [
          'a',
          {
            recent: 10,
            bots: 0,
            uniqueIps: new Set<string>(),
            noIpHash: 10,
            firstClickAt: null,
            lastClickAt: null
          }
        ]
      ])
    );

    expect(out.clicksByTrafficType.paid).toBe(10);
    expect(out.unattributedClicks).toBe(10);
    expect(out.mediumSplitByPieceId.p1.unattributed).toBe(0);
  });
});
