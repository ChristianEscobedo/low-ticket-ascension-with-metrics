import { describe, expect, it } from 'vitest';
import {
  normalizeBrandBible,
  normalizeNegatives,
} from '@/lib/mothermode/brandbible/types';
import { fromBrandBible } from '@/lib/mothermode/context/fromBrandBible';

describe('normalizeNegatives', () => {
  it('trims, splits strings, drops empties and dedupes case-insensitively', () => {
    expect(normalizeNegatives('  neon , cartoon\ncartoon,, ')).toEqual([
      'neon',
      'cartoon',
    ]);
    expect(normalizeNegatives(['  a ', 'A', 'b', '', 3 as never])).toEqual([
      'a',
      'b',
    ]);
    expect(normalizeNegatives(undefined)).toEqual([]);
  });
});

describe('normalizeBrandBible', () => {
  it('requires id + name and keeps only non-empty fields', () => {
    expect(normalizeBrandBible({ name: 'x' })).toBeNull();
    expect(normalizeBrandBible({ id: 'a' })).toBeNull();
    expect(normalizeBrandBible(null)).toBeNull();

    const bible = normalizeBrandBible({
      id: '  b1 ',
      name: ' Warm Doc ',
      emotion: '  ',
      colorLanguage: 'amber highs',
      negatives: ['neon', 'neon'],
    });
    expect(bible).toEqual({
      id: 'b1',
      name: 'Warm Doc',
      colorLanguage: 'amber highs',
      negatives: ['neon'],
    });
  });
});

describe('fromBrandBible', () => {
  it('emits a brand-bible ContextPack with a plain-text prompt block', () => {
    const pack = fromBrandBible({
      id: 'b1',
      name: 'Warm Doc',
      visualDirection: '16mm film',
      colorLanguage: 'amber highs, teal shadows',
      emotion: 'earned confidence',
      camera: 'slow push-ins',
      negatives: ['neon', 'cartoon'],
    });
    expect(pack.kind).toBe('brand-bible');
    expect(pack.id).toBe('b1');
    expect(pack.title).toBe('Warm Doc');
    expect(pack.summary).toContain('earned confidence');
    expect(pack.prompt).toContain('BRAND BIBLE — Warm Doc');
    expect(pack.prompt).toContain('Visual direction: 16mm film');
    expect(pack.prompt).toContain('Camera grammar: slow push-ins');
    expect(pack.prompt).toContain('Never: neon, cartoon');
    expect(pack.prompt).not.toContain('<');
  });

  it('omits empty sections gracefully', () => {
    const pack = fromBrandBible({ id: 'b2', name: 'Minimal' });
    expect(pack.prompt).toContain('BRAND BIBLE — Minimal');
    expect(pack.prompt).not.toContain('Never:');
    expect(pack.summary).toBe('Brand Bible: Minimal');
  });
});
