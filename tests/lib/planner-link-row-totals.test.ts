import { describe, expect, it } from 'vitest';

import {
  duplicatedPieceKeys,
  formatCents,
  pieceEconomics,
  summarizeLinkRows,
  type LinkRowLike
} from '@/lib/mothermode/planner/adMetrics';

/**
 * The trap the Tracking tab walks into on its own.
 *
 * Its rows are per LINK; opt-ins and revenue are per `utm_content`. The route
 * therefore stamps the SAME piece-level money onto every link that shares a
 * piece — so the obvious totals row (reduce over rows, add the column) reports
 * more revenue than the account has, two clicks away from /admin's total, which
 * sums the same money once. These tests pin the asymmetry: clicks add over rows,
 * money adds over distinct pieces.
 */

function row(over: Partial<LinkRowLike> = {}): LinkRowLike {
  return {
    utmContent: 'piece-a',
    clicks: 0,
    optins: 0,
    purchases: 0,
    revenueCents: 0,
    ...over
  };
}

describe('summarizeLinkRows', () => {
  it('counts a two-link piece once for money and twice for clicks', () => {
    // The exact shape the route returns: one boosted link, one organic link,
    // both carrying the whole piece's 12 opt-ins and $200.
    const rows = [
      row({ utmContent: 'p1', clicks: 90, optins: 12, purchases: 3, revenueCents: 20_000 }),
      row({ utmContent: 'p1', clicks: 30, optins: 12, purchases: 3, revenueCents: 20_000 })
    ];

    const totals = summarizeLinkRows(rows);

    expect(totals.links).toBe(2);
    expect(totals.pieces).toBe(1);
    // Clicks DO add: a click belongs to exactly one link.
    expect(totals.clicks).toBe(120);
    // Money does not. The naive column sum would be $400 on a $200 account.
    expect(totals.revenueCents).toBe(20_000);
    expect(totals.optins).toBe(12);
    expect(totals.purchases).toBe(3);
    expect(totals.duplicatedPieces).toBe(1);
  });

  it('adds distinct pieces normally', () => {
    const totals = summarizeLinkRows([
      row({ utmContent: 'p1', clicks: 10, optins: 2, revenueCents: 5_000 }),
      row({ utmContent: 'p2', clicks: 5, optins: 1, revenueCents: 2_500 })
    ]);

    expect(totals.pieces).toBe(2);
    expect(totals.duplicatedPieces).toBe(0);
    expect(totals.revenueCents).toBe(7_500);
    expect(totals.optins).toBe(3);
  });

  it('counts an untagged link\u2019s clicks but never its leads', () => {
    // A link with no utm_content can send real traffic and can never be joined
    // to a lead. Dropping its clicks would understate the denominator of every
    // rate on the strip; crediting it with 0 opt-ins would be a measurement.
    const totals = summarizeLinkRows([
      row({ utmContent: '', clicks: 40, optins: 0, revenueCents: 0 }),
      row({ utmContent: 'p1', clicks: 10, optins: 2, revenueCents: 5_000 })
    ]);

    expect(totals.clicks).toBe(50);
    expect(totals.untaggedLinks).toBe(1);
    expect(totals.pieces).toBe(1);
    expect(totals.revenueCents).toBe(5_000);
  });

  it('treats whitespace-only utm_content as untagged, not as a piece', () => {
    const totals = summarizeLinkRows([row({ utmContent: '   ', clicks: 3 })]);
    expect(totals.untaggedLinks).toBe(1);
    expect(totals.pieces).toBe(0);
  });

  it('nulls the whole money total when any row\u2019s attribution failed', () => {
    /*
     * The route nulls every row together when the join fails, so a null row means
     * "we could not read leads at all". Summing the readable rest and printing it
     * as a total would understate revenue while looking authoritative — and the
     * strip has no way to say "partial".
     */
    const totals = summarizeLinkRows([
      row({ utmContent: 'p1', clicks: 10, optins: null, revenueCents: null }),
      row({ utmContent: 'p2', clicks: 5, optins: 1, revenueCents: 2_500 })
    ]);

    expect(totals.optins).toBeNull();
    expect(totals.revenueCents).toBeNull();
    expect(totals.slice).toBeNull();
    // Clicks come from a different read and survive it.
    expect(totals.clicks).toBe(15);
  });

  it('survives an empty table without dividing by anything', () => {
    const totals = summarizeLinkRows([]);
    expect(totals).toMatchObject({ links: 0, pieces: 0, clicks: 0, revenueCents: 0 });
    expect(pieceEconomics({ clicks: totals.clicks, slice: totals.slice }).blended.epcCents)
      .toBeNull();
  });

  it('ignores holes in the array rather than throwing on them', () => {
    const totals = summarizeLinkRows([null, undefined, row({ clicks: 4 })]);
    expect(totals.links).toBe(1);
    expect(totals.clicks).toBe(4);
  });

  it('hands the strip a slice `pieceEconomics` can divide correctly', () => {
    // The strip must not compute `revenueCents / clicks` itself: this is the one
    // surface where the right denominator (row clicks) sits beside a wrong
    // numerator (row revenue). It passes the deduped slice instead.
    const totals = summarizeLinkRows([
      row({ utmContent: 'p1', clicks: 75, optins: 10, purchases: 2, revenueCents: 15_000 }),
      row({ utmContent: 'p1', clicks: 75, optins: 10, purchases: 2, revenueCents: 15_000 })
    ]);

    const econ = pieceEconomics({ clicks: totals.clicks, slice: totals.slice });

    // $150 over 150 clicks = $1.00, not the $2.00 a doubled numerator gives.
    expect(econ.blended.epcCents).toBe(100);
    expect(formatCents(totals.revenueCents)).toBe('$150.00');
  });

  it('leaves paid figures unknown when the tab sends no medium split', () => {
    // The Tracking tab payload has no per-medium breakdown, so the paid side must
    // read n/a rather than quietly reusing the blend as a bid ceiling.
    const totals = summarizeLinkRows([
      row({ utmContent: 'p1', clicks: 50, optins: 5, revenueCents: 10_000 })
    ]);

    const econ = pieceEconomics({
      clicks: totals.clicks,
      slice: totals.slice,
      clicksByTrafficType: null,
      split: null,
      spendCents: null
    });

    expect(econ.blended.epcCents).toBe(200);
    expect(econ.paid.epcCents).toBeNull();
  });
});

describe('duplicatedPieceKeys', () => {
  it('returns only the keys that really repeat', () => {
    const dupes = duplicatedPieceKeys([
      row({ utmContent: 'p1' }),
      row({ utmContent: 'p1' }),
      row({ utmContent: 'p2' })
    ]);

    expect(dupes.has('p1')).toBe(true);
    expect(dupes.has('p2')).toBe(false);
    expect(dupes.size).toBe(1);
  });

  it('never reports untagged rows as a shared piece', () => {
    // Two links with no utm_content are not "the same piece seen twice" — they
    // are two links joined to nothing, and dimming them as repeats would imply
    // their (absent) money had already been counted somewhere.
    const dupes = duplicatedPieceKeys([row({ utmContent: '' }), row({ utmContent: '' })]);
    expect(dupes.size).toBe(0);
  });

  it('agrees with summarizeLinkRows about what was collapsed', () => {
    // The table dims cells from this function and totals from that one. If they
    // ever disagree, the explanation on screen stops describing the arithmetic.
    const rows = [
      row({ utmContent: 'p1', clicks: 1 }),
      row({ utmContent: 'p1', clicks: 1 }),
      row({ utmContent: 'p2', clicks: 1 }),
      row({ utmContent: '', clicks: 1 })
    ];

    expect(duplicatedPieceKeys(rows).size).toBe(summarizeLinkRows(rows).duplicatedPieces);
  });
});
