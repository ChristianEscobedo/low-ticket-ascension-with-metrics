import { describe, it, expect } from 'vitest';

import {
  rankEndpoints,
  rowToEndpointStat,
  type EndpointStat,
} from '@/lib/mothermode/research/endpointStats';

/**
 * Endpoint learning (roadmap 4.3), pinned: the winner-first ordering
 * (successes lead, recent failures sink, unknowns keep discovered order)
 * and the defensive row mapper.
 */

const NOW = new Date('2026-07-30T12:00:00.000Z').getTime();
const daysAgo = (n: number) => new Date(NOW - n * 86400000).toISOString();

function stat(over: Partial<EndpointStat>): EndpointStat {
  return {
    endpoint: 'ep',
    runs: 0,
    failures: 0,
    lastOkAt: null,
    lastFailAt: null,
    ...over,
  };
}

const pool = ['a', 'b', 'c'].map((id) => ({ id }));

describe('rankEndpoints', () => {
  it('the endpoint with the best success record leads', () => {
    const stats = [
      stat({ endpoint: 'b', runs: 10, failures: 1, lastOkAt: daysAgo(1) }),
      stat({ endpoint: 'a', runs: 10, failures: 8, lastOkAt: daysAgo(10) }),
    ];
    expect(rankEndpoints(pool, stats, NOW).map((e) => e.id)).toEqual([
      'b',
      'c', // unknown scores 0, ahead of a lifetime loser
      'a',
    ]);
  });

  it('a failure in the last 3 days sinks even a good lifetime record', () => {
    const stats = [
      stat({ endpoint: 'a', runs: 20, failures: 2, lastFailAt: daysAgo(1) }),
      stat({ endpoint: 'b', runs: 5, failures: 1, lastOkAt: daysAgo(1) }),
    ];
    // a: successes 18 - 2 - (2*2 recent-fail) = 12. b: 4 - 1 = 3. a still leads.
    const ranked = rankEndpoints(pool, stats, NOW);
    expect(ranked[0].id).toBe('a');
    // But with MORE recent failures the lifetime winner sinks below the unknown.
    const stats2 = [
      stat({ endpoint: 'a', runs: 20, failures: 10, lastFailAt: daysAgo(1) }),
    ];
    const ranked2 = rankEndpoints(pool, stats2, NOW);
    expect(ranked2[0].id).not.toBe('a');
  });

  it('unknown endpoints keep their discovered order relative to each other', () => {
    expect(rankEndpoints(pool, [], NOW).map((e) => e.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});

describe('rowToEndpointStat', () => {
  it('maps a full row and defends junk numbers', () => {
    const s = rowToEndpointStat({
      endpoint: 'ep1',
      runs: 12,
      failures: 3,
      last_ok_at: 'x',
      last_fail_at: 'y',
    });
    expect(s).toEqual({
      endpoint: 'ep1',
      runs: 12,
      failures: 3,
      lastOkAt: 'x',
      lastFailAt: 'y',
    });
    expect(
      rowToEndpointStat({
        endpoint: 'ep2',
        runs: null,
        failures: Number.NaN,
        last_ok_at: null,
        last_fail_at: null,
      }),
    ).toEqual({
      endpoint: 'ep2',
      runs: 0,
      failures: 0,
      lastOkAt: null,
      lastFailAt: null,
    });
  });
});
