import { describe, it, expect } from 'vitest';
import {
  clampPartCount,
  activeParts,
  isTextDimension,
  isPerspective,
  isSophistication,
  AMPLIFY_PARTS,
  ALL_TEXT_DIMENSIONS,
  MAX_PART_COUNT,
} from '@/lib/mothermode/content/amplify';

describe('clampPartCount', () => {
  it('keeps an in-range count and rounds fractional values', () => {
    expect(clampPartCount(0)).toBe(0);
    expect(clampPartCount(5)).toBe(5);
    expect(clampPartCount(3.4)).toBe(3);
    expect(clampPartCount(3.6)).toBe(4);
  });

  it('caps at MAX_PART_COUNT and floors at 0', () => {
    expect(clampPartCount(MAX_PART_COUNT + 5)).toBe(MAX_PART_COUNT);
    expect(clampPartCount(-2)).toBe(0);
  });

  it('treats non-finite input as 0', () => {
    expect(clampPartCount(NaN)).toBe(0);
    expect(clampPartCount(Infinity)).toBe(0);
  });
});

describe('activeParts', () => {
  it('returns only ticked parts (count > 0), so 0/absent parts are kept', () => {
    const parts = activeParts({ hooks: 3, ctas: 0 });
    expect(parts).toEqual([{ dimension: 'hooks', count: 3 }]);
  });

  it('returns nothing when every part is locked', () => {
    expect(activeParts({})).toEqual([]);
    expect(activeParts({ hooks: 0, angles: 0, ctas: 0, bodies: 0 })).toEqual([]);
  });

  it('emits parts in canonical order regardless of input order', () => {
    const parts = activeParts({ bodies: 2, hooks: 3 });
    expect(parts.map((p) => p.dimension)).toEqual(['hooks', 'bodies']);
  });

  it('clamps each part count into [0, MAX_PART_COUNT]', () => {
    const parts = activeParts({ hooks: MAX_PART_COUNT + 4, angles: 2.6 });
    expect(parts).toEqual([
      { dimension: 'hooks', count: MAX_PART_COUNT },
      { dimension: 'angles', count: 3 },
    ]);
  });
});

describe('isTextDimension', () => {
  it('is true for the four single-text parts', () => {
    for (const d of ['hooks', 'angles', 'ctas', 'bodies'] as const) {
      expect(isTextDimension(d)).toBe(true);
    }
  });

  it('is false for whole-piece dimensions', () => {
    expect(isTextDimension('full')).toBe(false);
    expect(isTextDimension('crossPlatform')).toBe(false);
  });
});

describe('AMPLIFY_PARTS and ALL_TEXT_DIMENSIONS', () => {
  it('cover exactly the four text dimensions in canonical order', () => {
    expect(ALL_TEXT_DIMENSIONS).toEqual(['hooks', 'angles', 'ctas', 'bodies']);
    expect(AMPLIFY_PARTS.map((p) => p.value)).toEqual(ALL_TEXT_DIMENSIONS);
  });

  it('only lists text dimensions (no full or crossPlatform)', () => {
    expect(AMPLIFY_PARTS.every((p) => isTextDimension(p.value))).toBe(true);
  });
});

describe('isPerspective', () => {
  it('accepts the known voices and rejects anything else', () => {
    expect(isPerspective('first')).toBe(true);
    expect(isPerspective('second')).toBe(true);
    expect(isPerspective('third')).toBe(true);
    expect(isPerspective('fourth')).toBe(false);
    expect(isPerspective(undefined)).toBe(false);
  });
});

describe('isSophistication', () => {
  it('accepts the five awareness levels and rejects anything else', () => {
    for (const s of ['unaware', 'problem', 'solution', 'product', 'most']) {
      expect(isSophistication(s)).toBe(true);
    }
    expect(isSophistication('expert')).toBe(false);
    expect(isSophistication(null)).toBe(false);
  });
});
