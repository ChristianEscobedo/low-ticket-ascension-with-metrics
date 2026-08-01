import { describe, it, expect } from 'vitest';

import {
  cosineSimilarity,
  rankBySimilarity,
} from '@/lib/mothermode/research/embeddings';

/**
 * Semantic evidence search (roadmap 4.7), pinned: the cosine math and the
 * ranking contract (positive scores only, best first).
 */

describe('cosineSimilarity', () => {
  it('identical vectors score 1, orthogonal score 0', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 6);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);
  });

  it('is direction-only (magnitude never changes the score)', () => {
    expect(cosineSimilarity([1, 1], [5, 5])).toBeCloseTo(1, 6);
  });

  it('degenerates to 0 (empty, mismatched, or zero vectors, never NaN)', () => {
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([1, 2], [1])).toBe(0);
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
  });
});

describe('rankBySimilarity', () => {
  const items = [
    { id: 'close', v: [0.9, 0.1] },
    { id: 'far', v: [0.1, 0.9] },
    { id: 'zero', v: [0, 0] },
  ];

  it('ranks best first and drops zero scores', () => {
    const ranked = rankBySimilarity(items, (i) => i.v, [1, 0]);
    expect(ranked.map((r) => r.item.id)).toEqual(['close', 'far']);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });
});
