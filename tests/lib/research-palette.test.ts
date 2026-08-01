import { describe, it, expect } from 'vitest';

import {
  buildPaletteActions,
  paletteMatches,
  gatedRuns,
  type PaletteAction,
} from '@/lib/mothermode/research/recipes/crew';
import {
  nodeStatusClasses,
  nodeStatusTitle,
} from '@/components/mothermode/NodeCard';
import type { Recipe, RecipeRun } from '@/lib/mothermode/research/recipes/types';

/**
 * The UI/UX threads, pinned: ONE status vocabulary for the build maps
 * (NodeCard), the palette's ordering + matching, and the gates page's
 * filter.
 */

describe('the NodeCard vocabulary (built/draft/failed/pending)', () => {
  it('maps every status to its ring + title, degrades unknown to pending', () => {
    expect(nodeStatusClasses('built')).toContain('emerald');
    expect(nodeStatusClasses('draft')).toContain('amber');
    expect(nodeStatusClasses('failed')).toContain('red');
    expect(nodeStatusClasses('pending')).toContain('bone');
    expect(nodeStatusTitle('built')).toContain('Built');
    expect(nodeStatusTitle('draft')).toContain('Draft');
    expect(nodeStatusTitle('failed')).toContain('failed');
    expect(nodeStatusTitle('pending')).toBe('Pending');
    // An out-of-vocabulary status degrades to pending, never a crash.
    expect(nodeStatusClasses('nope' as never)).toBe(
      nodeStatusClasses('pending'),
    );
  });
});

describe('buildPaletteActions', () => {
  const recipes = [
    { id: 'r1', slug: 'deep-dive', name: 'Deep Dive' },
    { id: 'r2', slug: 'weekly-sweep', name: 'Weekly Sweep' },
  ] as unknown as Recipe[];
  const sessions = [
    { id: 's1', title: 'The Offload Map research' },
    { id: 's2', title: '' },
  ];

  it('orders gates first (with the recipe name + step), then plays, then sessions', () => {
    const runs = [
      { id: 'run1', status: 'gated', recipeId: 'r1', currentStep: 1 },
      { id: 'run2', status: 'running', recipeId: 'r2', currentStep: 0 },
      { id: 'run3', status: 'done', recipeId: 'r1', currentStep: 3 },
    ] as unknown as RecipeRun[];
    const actions = buildPaletteActions({ recipes, runs, sessions });
    expect(actions[0]).toMatchObject({
      kind: 'gate',
      label: 'Approve: Deep Dive',
      target: 'run1',
    });
    expect(actions[0].hint).toContain('step 2');
    // Only the gated run becomes a gate action.
    expect(actions.filter((a) => a.kind === 'gate')).toHaveLength(1);
    // Then both plays in order, then both sessions.
    expect(actions.slice(1, 3).map((a) => a.target)).toEqual([
      'deep-dive',
      'weekly-sweep',
    ]);
    expect(actions.slice(3).map((a) => a.kind)).toEqual([
      'session',
      'session',
    ]);
    // A nameless session lists honestly.
    expect(actions[4].label).toBe('Research session');
    // A gate whose recipe is gone still lists.
    const orphan = buildPaletteActions({
      recipes: [],
      runs: [{ id: 'x', status: 'gated', recipeId: 'gone', currentStep: 0 } as unknown as RecipeRun],
      sessions: [],
    });
    expect(orphan[0].label).toBe('Approve: a play');
  });
});

describe('paletteMatches', () => {
  const action: PaletteAction = {
    id: 'play-deep-dive',
    kind: 'play',
    label: 'Deep Dive',
    hint: 'play · deep-dive',
    target: 'deep-dive',
  };
  it('matches label or hint, case-insensitive; empty query matches all', () => {
    expect(paletteMatches(action, '')).toBe(true);
    expect(paletteMatches(action, '  ')).toBe(true);
    expect(paletteMatches(action, 'deep')).toBe(true);
    expect(paletteMatches(action, 'DIVE')).toBe(true);
    expect(paletteMatches(action, 'play')).toBe(true);
    expect(paletteMatches(action, 'offload')).toBe(false);
  });
});

describe('gatedRuns', () => {
  it('keeps only runs paused on a human yes', () => {
    const runs = [
      { id: 'a', status: 'gated' },
      { id: 'b', status: 'running' },
      { id: 'c', status: 'gated' },
      { id: 'd', status: 'done' },
    ] as unknown as RecipeRun[];
    expect(gatedRuns(runs).map((r) => r.id)).toEqual(['a', 'c']);
    expect(gatedRuns([])).toEqual([]);
  });
});
