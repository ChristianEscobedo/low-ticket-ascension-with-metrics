import { describe, expect, it } from 'vitest';
import { defaultStackLayout } from '@/lib/mothermode/reel/types';

describe('defaultStackLayout', () => {
  it('returns one position per word', () => {
    expect(defaultStackLayout(5)).toHaveLength(5);
  });

  it('keeps coords inside the safe frame', () => {
    for (const p of defaultStackLayout(9, { rows: 3, wordsPerRow: 3 })) {
      expect(p.xPct).toBeGreaterThanOrEqual(8);
      expect(p.xPct).toBeLessThanOrEqual(92);
      expect(p.yPct).toBeGreaterThanOrEqual(6);
      expect(p.yPct).toBeLessThanOrEqual(88);
    }
  });

  it('stacks later rows higher (larger y from bottom)', () => {
    const layout = defaultStackLayout(6, { rows: 2, wordsPerRow: 3, baseYPct: 30 });
    // row0: indices 0..2, row1: 3..5
    expect(layout[3].yPct).toBeGreaterThan(layout[0].yPct);
  });

  it('centers a single word', () => {
    const [p] = defaultStackLayout(1, { baseXPct: 50, baseYPct: 40 });
    expect(p.xPct).toBe(50);
    expect(p.yPct).toBe(40);
  });
});
