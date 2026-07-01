import { describe, it, expect } from 'vitest';
import {
  reviewImages,
  reviewHooks,
  clampIndex,
  isEmptyReview,
  mergeReview,
  withImages,
  withoutImages,
  type PieceReview,
} from '@/lib/mothermode/content/review';

describe('reviewImages', () => {
  it('prefers the gallery and drops blank entries', () => {
    expect(reviewImages({ images: ['a', '', '  ', 'b'] })).toEqual(['a', 'b']);
  });

  it('falls back to the legacy single image', () => {
    expect(reviewImages({ image: 'legacy' })).toEqual(['legacy']);
  });

  it('returns empty when nothing is set or values are blank', () => {
    expect(reviewImages({})).toEqual([]);
    expect(reviewImages({ image: '  ' })).toEqual([]);
    expect(reviewImages({ images: [] })).toEqual([]);
  });
});

describe('reviewHooks', () => {
  it('prefers the hooks list over the legacy single hook', () => {
    expect(reviewHooks({ hook: 'old', hooks: ['x', 'y'] })).toEqual(['x', 'y']);
  });

  it('falls back to the legacy single hook', () => {
    expect(reviewHooks({ hook: 'only' })).toEqual(['only']);
  });

  it('returns empty for undefined edits or no hook', () => {
    expect(reviewHooks(undefined)).toEqual([]);
    expect(reviewHooks({})).toEqual([]);
    expect(reviewHooks({ hook: '  ' })).toEqual([]);
  });
});

describe('clampIndex', () => {
  it('keeps an in-range index and floors it', () => {
    expect(clampIndex(2, 5)).toBe(2);
    expect(clampIndex(2.9, 5)).toBe(2);
  });

  it('returns 0 for out-of-range, non-finite, or empty-length cases', () => {
    expect(clampIndex(5, 5)).toBe(0);
    expect(clampIndex(-1, 5)).toBe(0);
    expect(clampIndex(undefined, 5)).toBe(0);
    expect(clampIndex(NaN, 5)).toBe(0);
    expect(clampIndex(0, 0)).toBe(0);
  });
});

describe('isEmptyReview', () => {
  it('is true for an empty object and blank-only fields', () => {
    expect(isEmptyReview({})).toBe(true);
    expect(isEmptyReview({ edits: { hook: '  ', caption: '' } })).toBe(true);
    expect(isEmptyReview({ metrics: {} })).toBe(true);
  });

  it('is false when any image, note, edit, or metric carries content', () => {
    expect(isEmptyReview({ images: ['a'] })).toBe(false);
    expect(isEmptyReview({ image: 'legacy' })).toBe(false);
    expect(isEmptyReview({ notes: 'fix this' })).toBe(false);
    expect(isEmptyReview({ edits: { body: 'new body' } })).toBe(false);
    expect(isEmptyReview({ edits: { hooks: ['', 'real'] } })).toBe(false);
    expect(isEmptyReview({ metrics: { likes: 0 } })).toBe(false);
  });
});

describe('mergeReview', () => {
  it('shallow-merges top-level fields and returns a new object', () => {
    const prev: PieceReview = { notes: 'a' };
    const next = mergeReview(prev, { notes: 'b' });
    expect(next).toEqual({ notes: 'b' });
    expect(next).not.toBe(prev);
  });

  it('deep-merges edits and metrics without clobbering siblings', () => {
    const prev: PieceReview = {
      edits: { hook: 'h', caption: 'c' },
      metrics: { likes: 10, shares: 2 },
    };
    const next = mergeReview(prev, {
      edits: { caption: 'c2' },
      metrics: { shares: 5 },
    });
    expect(next.edits).toEqual({ hook: 'h', caption: 'c2' });
    expect(next.metrics).toEqual({ likes: 10, shares: 5 });
  });

  it('keeps prev edits/metrics when the patch omits them', () => {
    const prev: PieceReview = { edits: { hook: 'h' }, metrics: { likes: 1 } };
    const next = mergeReview(prev, { notes: 'n' });
    expect(next.edits).toEqual({ hook: 'h' });
    expect(next.metrics).toEqual({ likes: 1 });
  });
});

describe('withImages', () => {
  it('sets the gallery, clamps the index, and drops the legacy image', () => {
    const prev: PieceReview = { image: 'legacy', notes: 'keep' };
    const next = withImages(prev, ['a', 'b'], 5);
    expect(next.images).toEqual(['a', 'b']);
    expect(next.imageIndex).toBe(0);
    expect(next.notes).toBe('keep');
    expect('image' in next).toBe(false);
  });

  it('clears the gallery on an empty array', () => {
    const next = withImages({ images: ['a'], imageIndex: 0 }, [], 0);
    expect(next.images).toBeUndefined();
    expect(next.imageIndex).toBeUndefined();
  });
});

describe('withoutImages', () => {
  it('removes gallery, index, and legacy image while keeping the rest', () => {
    const prev: PieceReview = {
      image: 'legacy',
      images: ['a'],
      imageIndex: 0,
      notes: 'n',
      edits: { hook: 'h' },
    };
    const next = withoutImages(prev);
    expect(next).toEqual({ notes: 'n', edits: { hook: 'h' } });
  });
});
