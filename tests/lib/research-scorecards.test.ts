/**
 * Expert scorecards (research/scorecards.ts): the per-expert read on the
 * run history — steps, outcomes, artifact fates, allocated cost. These pin
 * the honest-accounting rules: never-started steps are not evidence, a
 * failed fate read is unknown (never "all deleted"), rates are null with
 * no denominator, and cost is an allocation by touched-step share.
 */
import { describe, expect, it } from 'vitest';
import {
  buildExpertScorecards,
  scorecardSummary,
  type ArtifactFateLike,
  type ExpertScorecard,
} from '@/lib/mothermode/research/scorecards';
import type {
  Recipe,
  RecipeRun,
  RecipeStepState,
} from '@/lib/mothermode/research/recipes/types';

/* ------------------------------------------------------------------ */

function recipe(id: string, experts: string[]): Recipe {
  return {
    id,
    slug: id,
    name: id,
    description: '',
    steps: experts.map((expert, i) => ({
      expert,
      instruction: `do thing ${i + 1} with {input}`,
      inputFrom: 'previous',
      outputArtifact: 'research-brief',
      gate: 'auto',
    })),
    budgetEstCents: 150,
    status: 'active',
    createdAt: null,
    updatedAt: null,
  };
}

function step(
  status: RecipeStepState['status'],
  partial?: Partial<RecipeStepState>,
): RecipeStepState {
  return {
    status,
    artifactId: '',
    note: status === 'pending' ? '' : `step note`,
    at: status === 'pending' ? null : '2026-07-30T12:00:00Z',
    ...partial,
  };
}

function run(
  id: string,
  recipeId: string,
  stepsState: RecipeStepState[],
  estCostCents = 0,
): RecipeRun {
  return {
    id,
    recipeId,
    sessionId: 'sess',
    status: 'done',
    currentStep: stepsState.length,
    stepsState,
    estCostCents,
    createdAt: null,
    updatedAt: null,
  };
}

const RECIPES = [recipe('r1', ['atlas', 'wren']), recipe('r2', ['atlas'])];

// The scenario: two recipes, four runs, every fate bucket occupied.
const RUNS: RecipeRun[] = [
  // atlas done (a1), wren failed — $0.90 split 1:1.
  run('run1', 'r1', [step('done', { artifactId: 'a1' }), step('failed')], 90),
  // atlas done with thin receipts (a2), wren gated (a3) — $0.40 split 1:1.
  run(
    'run2',
    'r1',
    [
      step('done', { artifactId: 'a2', note: 'step 1: atlas → research-brief · receipts 3/10 (low)' }),
      step('gated', { artifactId: 'a3', note: 'review "x" — approve to continue' }),
    ],
    40,
  ),
  // A fresh run: the only step never started — no evidence, no cost.
  run('run3', 'r2', [step('pending', { note: '', at: null })], 0),
  // The recipe row is gone: the step lands on the 'research' fallback,
  // exactly like the interpreter's own default.
  run('run4', 'gone', [step('done', { artifactId: 'a4' })], 30),
];

const FATES = new Map<string, ArtifactFateLike>([
  ['a1', { status: 'handed-off', version: 1 }],
  ['a2', { status: 'final', version: 3 }], // owner revised it twice
  // a3 has no row: deleted.
  ['a4', { status: 'draft', version: 1 }],
]);

describe('buildExpertScorecards', () => {
  const cards = buildExpertScorecards({ runs: RUNS, recipes: RECIPES, artifactsById: FATES });
  const bySlug = new Map(cards.map((c) => [c.slug, c] as const));

  it('one card per expert, busiest first, ties by slug', () => {
    expect(cards.map((c) => c.slug)).toEqual(['atlas', 'wren', 'research']);
  });

  it('atlas: two clean done steps, one accepted + one edited, thin receipts flagged', () => {
    const c = bySlug.get('atlas')!;
    expect(c.runs).toBe(2);
    expect(c.steps).toBe(2);
    expect(c.done).toBe(2);
    expect(c.failed).toBe(0);
    expect(c.artifacts).toBe(2);
    expect(c.handedOff).toBe(1);
    expect(c.edited).toBe(1);
    expect(c.deleted).toBe(0);
    expect(c.citationLow).toBe(1);
    expect(c.acceptanceRate).toBe(0.5); // 1 handed-off of 2 known fates
    expect(c.failureRate).toBe(0);
    expect(c.estCostCents).toBe(65); // 45 + 20
  });

  it('wren: a failure and a gate settle into the rates honestly', () => {
    const c = bySlug.get('wren')!;
    expect(c.steps).toBe(2);
    expect(c.failed).toBe(1);
    expect(c.gated).toBe(1);
    expect(c.failureRate).toBe(1); // 1 of 1 settled
    expect(c.deleted).toBe(1); // a3's row is gone
    expect(c.acceptanceRate).toBe(0); // 0 accepted of 1 known fate
    expect(c.estCostCents).toBe(65);
  });

  it('a run whose recipe is gone attributes to the research fallback', () => {
    const c = bySlug.get('research')!;
    expect(c.runs).toBe(1);
    expect(c.steps).toBe(1);
    expect(c.done).toBe(1);
    expect(c.untouched).toBe(1);
    expect(c.acceptanceRate).toBe(0);
    expect(c.estCostCents).toBe(30);
  });

  it('a step that never started is not evidence — not even a cost share', () => {
    // run3's pending step gave atlas NOTHING from that run: runs counts
    // only run1+run2 (2, not 3), and run3's 0 cents had no denominator.
    const atlas = bySlug.get('atlas')!;
    expect(atlas.runs).toBe(2);
  });

  it('allocated cost still sums to the runs’ total', () => {
    const total = cards.reduce((sum, c) => sum + c.estCostCents, 0);
    expect(total).toBe(90 + 40 + 30); // rounding keeps the cent
  });

  it('a failed fate read nulls the fate family — never "everything deleted"', () => {
    const broken = buildExpertScorecards({ runs: RUNS, recipes: RECIPES, artifactsById: null });
    const atlas = broken.find((c) => c.slug === 'atlas')!;
    expect(atlas.fatesKnown).toBe(false);
    expect(atlas.acceptanceRate).toBeNull();
    expect(atlas.artifacts).toBe(0); // unknown, not zero-by-claim
    expect(atlas.deleted).toBe(0);
    // …while the run-row evidence still counts.
    expect(atlas.done).toBe(2);
    expect(atlas.citationLow).toBe(1);
  });

  it('rates are null when nothing has settled', () => {
    const gated = buildExpertScorecards({
      runs: [run('run9', 'r1', [step('gated'), step('pending', { note: '', at: null })])],
      recipes: RECIPES,
      artifactsById: new Map(),
    });
    const atlas = gated.find((c) => c.slug === 'atlas')!;
    expect(atlas.failureRate).toBeNull(); // nothing done, nothing failed
    expect(atlas.acceptanceRate).toBeNull(); // no fates to judge
    expect(atlas.gated).toBe(1);
  });

  it('a retried step still counts as touched (its timestamp survived the reset)', () => {
    const cards2 = buildExpertScorecards({
      runs: [
        run('run10', 'r2', [
          step('pending', { note: '', at: '2026-07-31T09:00:00Z' }), // reset by retry
        ]),
      ],
      recipes: RECIPES,
      artifactsById: new Map(),
    });
    const atlas = cards2.find((c) => c.slug === 'atlas')!;
    expect(atlas.steps).toBe(1);
    expect(atlas.pending).toBe(1);
    expect(atlas.failureRate).toBeNull();
  });

  it('no runs, no cards', () => {
    expect(buildExpertScorecards({ runs: [], recipes: RECIPES, artifactsById: new Map() })).toEqual([]);
  });
});

describe('scorecardSummary', () => {
  const card = (partial: Partial<ExpertScorecard>): ExpertScorecard => ({
    slug: 'atlas',
    runs: 0,
    steps: 0,
    done: 0,
    failed: 0,
    gated: 0,
    pending: 0,
    artifacts: 0,
    handedOff: 0,
    edited: 0,
    deleted: 0,
    untouched: 0,
    citationLow: 0,
    failureRate: null,
    acceptanceRate: null,
    estCostCents: 0,
    fatesKnown: true,
    ...partial,
  });

  it('is null when the expert never worked', () => {
    expect(scorecardSummary(card({}))).toBeNull();
  });

  it('reads steps, acceptance, real failures, and allocated cost', () => {
    expect(
      scorecardSummary(
        card({ steps: 5, acceptanceRate: 0.5, failureRate: 0.2, failed: 1, estCostCents: 65 }),
      ),
    ).toBe('5 steps · 50% accepted · 20% failed · ~$0.65');
  });

  it('hides a zero failure rate and unknown acceptance', () => {
    expect(
      scorecardSummary(card({ steps: 1, failureRate: 0, failed: 0 })),
    ).toBe('1 step');
  });
});
