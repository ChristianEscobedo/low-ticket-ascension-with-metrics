import { describe, it, expect } from 'vitest';

import {
  rowToWatchlist,
  isWatchlistDue,
  type WatchlistRow,
} from '@/lib/mothermode/research/watchlists';

/**
 * Watchlists (roadmap 4.2), pinned: the defensive row mapper and the due
 * rule the weekly digest reads (active + never run, or stale by a week).
 */

const NOW = new Date('2026-07-30T12:00:00.000Z').getTime();
const daysAgo = (n: number) =>
  new Date(NOW - n * 86400000).toISOString();

function row(over: Partial<WatchlistRow> = {}): WatchlistRow {
  return {
    id: 'w1',
    session_id: 's1',
    recipe_slug: 'niche-watch',
    cadence: 'weekly',
    last_run_at: null,
    status: 'active',
    created_at: null,
    ...over,
  };
}

describe('rowToWatchlist', () => {
  it('maps a full row and defends junk', () => {
    const w = rowToWatchlist(row());
    expect(w.recipeSlug).toBe('niche-watch');
    expect(w.status).toBe('active');
    expect(w.lastRunAt).toBeNull();
    expect(rowToWatchlist(row({ recipe_slug: null })).recipeSlug).toBe(
      'niche-watch',
    );
    expect(rowToWatchlist(row({ status: 'weird' })).status).toBe('active');
    expect(rowToWatchlist(row({ status: 'paused' })).status).toBe('paused');
  });
});

describe('isWatchlistDue', () => {
  it('a never-run active watch is due', () => {
    expect(isWatchlistDue({ lastRunAt: null, status: 'active' }, NOW)).toBe(
      true,
    );
  });

  it('a watch run six days ago is NOT due; eight days ago IS', () => {
    expect(
      isWatchlistDue({ lastRunAt: daysAgo(6), status: 'active' }, NOW),
    ).toBe(false);
    expect(
      isWatchlistDue({ lastRunAt: daysAgo(8), status: 'active' }, NOW),
    ).toBe(true);
  });

  it('a paused watch is never due, even when stale', () => {
    expect(isWatchlistDue({ lastRunAt: null, status: 'paused' }, NOW)).toBe(
      false,
    );
    expect(
      isWatchlistDue({ lastRunAt: daysAgo(30), status: 'paused' }, NOW),
    ).toBe(false);
  });

  it('a junk timestamp is not due (never pretend a broken row ran)', () => {
    expect(
      isWatchlistDue({ lastRunAt: 'not-a-date', status: 'active' }, NOW),
    ).toBe(false);
  });
});
