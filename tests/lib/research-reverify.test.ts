import { describe, it, expect } from 'vitest';

import {
  diffArtifacts,
  reverifySummary,
} from '@/lib/mothermode/research/reverify';

/**
 * Re-verify with diff (roadmap 4.5), pinned: the line-level artifact diff
 * (added/removed/held, occurrence-aware) and the one-line summary.
 */

describe('diffArtifacts', () => {
  it('computes added, removed, and held', () => {
    const diff = diffArtifacts(
      'the $17 point wins\n"5pm chaos" repeats\nFair Play complaints',
      '"5pm chaos" repeats\nnew voice performs\nFair Play complaints',
    );
    expect(diff.added).toEqual(['new voice performs']);
    expect(diff.removed).toEqual(['the $17 point wins']);
    expect(diff.held).toBe(2);
  });

  it('is occurrence-aware: a repeated line vanishing twice removes twice', () => {
    const diff = diffArtifacts('chaos\nchaos\nkeep', 'keep');
    expect(diff.removed).toEqual(['chaos', 'chaos']);
    expect(diff.held).toBe(1);
  });

  it('identical docs are all held, empty diffs', () => {
    const diff = diffArtifacts('a\nb', 'a\nb');
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.held).toBe(2);
  });

  it('empty previous = everything added; empty fresh = everything removed', () => {
    expect(diffArtifacts('', 'a\nb').added).toEqual(['a', 'b']);
    expect(diffArtifacts('a\nb', '').removed).toEqual(['a', 'b']);
  });

  it('whitespace differences never fake a change', () => {
    const diff = diffArtifacts('the  $17   point', 'the $17 point');
    expect(diff.held).toBe(1);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
  });
});

describe('reverifySummary', () => {
  it('reads as the one-line answer', () => {
    expect(
      reverifySummary({ added: ['a', 'b'], removed: ['c'], held: 11 }),
    ).toBe('2 new lines · 1 gone · 11 held');
    expect(reverifySummary({ added: ['a'], removed: [], held: 3 })).toBe(
      '1 new line · 3 held',
    );
    expect(reverifySummary({ added: [], removed: [], held: 4 })).toBe('4 held');
  });
});
