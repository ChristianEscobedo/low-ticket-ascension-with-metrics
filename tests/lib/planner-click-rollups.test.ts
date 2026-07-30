import { describe, expect, it } from 'vitest';

import {
  rollupClicks,
  type LinkClickStats,
  type UtmLinkRecord,
} from '@/lib/mothermode/planner/links';

function link(over: Partial<UtmLinkRecord>): UtmLinkRecord {
  return {
    id: 'l1',
    planId: null,
    funnelId: null,
    optinFunnelId: null,
    funnelPage: '',
    pieceId: '',
    label: '',
    baseUrl: 'https://example.com/funnel/x',
    utmSource: 'facebook',
    utmMedium: 'organic_social',
    utmCampaign: 'c',
    utmContent: '',
    utmTerm: '',
    fullUrl: 'https://example.com/funnel/x?utm_content=p1',
    shortCode: 'abc',
    clickCount: 0,
    lastClickedAt: null,
    createdAt: null,
    createdBy: null,
    ...over,
  } as UtmLinkRecord;
}

/**
 * `ips` is a convenience: tests say `ips: ['a', 'b']` and get the Set the real
 * reader builds. Defaulting `uniqueIps` to an empty Set matters — `rollupClicks`
 * unions it unconditionally, so a helper that omitted it would throw rather than
 * fail an assertion, and the message would point at the wrong thing.
 */
function stats(
  over: Partial<LinkClickStats> & { ips?: string[] },
): LinkClickStats {
  const { ips, ...rest } = over;
  return {
    recent: 0,
    bots: 0,
    uniqueIps: new Set<string>(ips || []),
    noIpHash: 0,
    firstClickAt: null,
    lastClickAt: null,
    ...rest,
  };
}


describe('rollupClicks', () => {
  it('keeps the all-time counter and the windowed count as separate numbers', () => {
    // The counter says 10 all-time; the window only has 3 rows left. Summing or
    // substituting these would make the dashboard total shrink over time.
    const out = rollupClicks(
      [link({ id: 'a', clickCount: 10 })],
      new Map([['a', stats({ recent: 3, bots: 2 })]]),
    );

    expect(out.totalClicks).toBe(10);
    expect(out.recentClicks).toBe(3);
    expect(out.botClicks).toBe(2);
    // Bots are never folded into either click number.
    expect(out.totalClicks + out.recentClicks).not.toBe(15);
  });

  it('breaks clicks down by funnel, lead magnet and piece', () => {
    const out = rollupClicks(
      [
        link({ id: 'a', funnelId: 'f1', utmContent: 'p1', clickCount: 4 }),
        link({ id: 'b', funnelId: 'f1', utmContent: 'p2', clickCount: 6 }),
        link({ id: 'c', optinFunnelId: 'o1', utmContent: 'p1', clickCount: 5 }),
      ],
      new Map(),
    );

    expect(out.byFunnelId).toEqual({ f1: 10 });
    expect(out.byOptinFunnelId).toEqual({ o1: 5 });
    // p1 pools across a sales funnel link and a lead magnet link — per-post
    // attribution is per piece, not per destination.
    expect(out.byPieceId).toEqual({ p1: 9, p2: 6 });
    expect(out.totalClicks).toBe(15);
  });

  it('keys the piece breakdown on utm_content, falling back to pieceId', () => {
    // utm_content is what the lead row carries, so it must win. A hand-edited
    // value that differs from pieceId attributes to what was actually published.
    const out = rollupClicks(
      [
        link({ id: 'a', pieceId: 'real-id', utmContent: 'typed-id', clickCount: 2 }),
        link({ id: 'b', pieceId: 'only-piece', utmContent: '', clickCount: 3 }),
      ],
      new Map(),
    );

    expect(out.byPieceId).toEqual({ 'typed-id': 2, 'only-piece': 3 });
  });

  it('reports the newest click across both sources', () => {
    const out = rollupClicks(
      [
        link({ id: 'a', clickCount: 1, lastClickedAt: '2026-01-01T00:00:00Z' }),
        link({ id: 'b', clickCount: 1, lastClickedAt: '2026-03-01T00:00:00Z' }),
      ],
      new Map([['a', stats({ lastClickAt: '2026-02-01T00:00:00Z' })]]),
    );

    expect(out.lastClickAt).toBe('2026-03-01T00:00:00Z');
  });

  it('counts only links that earned a click as used', () => {
    const out = rollupClicks(
      [link({ id: 'a', clickCount: 3 }), link({ id: 'b', clickCount: 0 })],
      new Map(),
    );

    expect(out.linkCount).toBe(2);
    expect(out.linksWithClicks).toBe(1);
    // A zero-click link must not appear in a breakdown as a 0 entry — an empty
    // row reads as "measured and failed" rather than "never used".
    expect(out.byPieceId).toEqual({});
  });

  it('returns zeroes, not NaN, for an empty registry', () => {
    const out = rollupClicks([], new Map());
    expect(out.totalClicks).toBe(0);
    expect(out.lastClickAt).toBeNull();
    expect(out.byFunnelId).toEqual({});
  });
});
