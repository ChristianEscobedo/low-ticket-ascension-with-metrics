import { describe, it, expect } from 'vitest';

import {
  formatAge,
  isCachedSummary,
} from '@/lib/mothermode/research/freshness';

/**
 * Freshness + cache badges (roadmap 0.4), pinned: the human age ladder
 * and the cached-call detection.
 */

const NOW = new Date('2026-07-30T12:00:00.000Z').getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe('formatAge', () => {
  it('ladders just now → m → h → d → w → mo', () => {
    expect(formatAge(ago(30_000), NOW)).toBe('just now');
    expect(formatAge(ago(5 * 60_000), NOW)).toBe('5m');
    expect(formatAge(ago(2 * 3600_000), NOW)).toBe('2h');
    expect(formatAge(ago(3 * 86400_000), NOW)).toBe('3d');
    expect(formatAge(ago(14 * 86400_000), NOW)).toBe('2w');
    expect(formatAge(ago(90 * 86400_000), NOW)).toBe('3mo');
  });

  it('null, junk, and future dates degrade safely', () => {
    expect(formatAge(null, NOW)).toBe('');
    expect(formatAge('not-a-date', NOW)).toBe('');
    expect(formatAge(new Date(NOW + 60_000).toISOString(), NOW)).toBe(
      'just now',
    );
  });
});

describe('isCachedSummary', () => {
  it('detects the (cached) stamp, never false-positives', () => {
    expect(isCachedSummary('12 posts (cached)')).toBe(true);
    expect(isCachedSummary('5 reviews, 2 low-star (cached)')).toBe(true);
    expect(isCachedSummary('12 posts')).toBe(false);
    expect(isCachedSummary('cached results incoming')).toBe(false);
    expect(isCachedSummary('')).toBe(false);
  });
});
