/**
 * Mission Control's missionSummary (crew.ts): the home strip's honest
 * roll-up — running runs are crew, gated runs wait on a HUMAN (never
 * "working"), settled runs are neither, and a run whose recipe is gone
 * still lists with the interpreter's own fallback slug.
 */
import { describe, expect, it } from 'vitest';
import { missionSummary } from '@/lib/mothermode/research/recipes/crew';
import type {
  Recipe,
  RecipeRun,
  RecipeStepState,
} from '@/lib/mothermode/research/recipes/types';

function stepState(
  status: RecipeStepState['status'],
): RecipeStepState {
  return { status, artifactId: '', note: '', at: null };
}

function run(
  id: string,
  recipeId: string,
  status: RecipeRun['status'],
  currentStep: number,
  stepsState: RecipeStepState[],
): RecipeRun {
  return {
    id,
    recipeId,
    sessionId: 's',
    status,
    currentStep,
    stepsState,
    estCostCents: 0,
    createdAt: null,
    updatedAt: null,
  };
}

const RECIPES: Array<Pick<Recipe, 'id' | 'name' | 'steps'>> = [
  {
    id: 'r1',
    name: 'Full System Build',
    steps: [
      { expert: 'research', instruction: 'a', inputFrom: 'brief', outputArtifact: 'research-brief', gate: 'auto' },
      { expert: 'atlas', instruction: 'b', inputFrom: 'previous', outputArtifact: 'offer-brief', gate: 'auto' },
      { expert: 'nova', instruction: 'c', inputFrom: 'previous', outputArtifact: 'content-plan', gate: 'auto' },
    ],
  },
];

describe('missionSummary', () => {
  it('a running run is crew, labeled with the IN-FLIGHT step (not currentStep)', () => {
    const s = missionSummary({
      runs: [
        run('run1', 'r1', 'running', 0, [
          stepState('done'),
          stepState('running'), // the lane's live marker wins over currentStep
          stepState('pending'),
        ]),
      ],
      recipes: RECIPES,
      watchlists: [],
    });
    expect(s.activeRuns).toBe(1);
    expect(s.gatesWaiting).toBe(0);
    expect(s.crew).toEqual([
      {
        runId: 'run1',
        recipeName: 'Full System Build',
        expertSlug: 'atlas',
        stepLabel: 'step 2 of 3',
      },
    ]);
  });

  it('a gated run waits on a human — counted, never crew', () => {
    const s = missionSummary({
      runs: [
        run('run1', 'r1', 'gated', 1, [stepState('done'), stepState('gated'), stepState('pending')]),
      ],
      recipes: RECIPES,
      watchlists: [],
    });
    expect(s.gatesWaiting).toBe(1);
    expect(s.activeRuns).toBe(0);
    expect(s.crew).toEqual([]);
  });

  it('settled runs are neither crew nor gates', () => {
    const s = missionSummary({
      runs: [
        run('d', 'r1', 'done', 3, [stepState('done'), stepState('done'), stepState('done')]),
        run('f', 'r1', 'failed', 1, [stepState('done'), stepState('failed'), stepState('pending')]),
        run('c', 'r1', 'canceled', 1, [stepState('done'), stepState('skipped'), stepState('pending')]),
      ],
      recipes: RECIPES,
      watchlists: [],
    });
    expect(s.activeRuns).toBe(0);
    expect(s.gatesWaiting).toBe(0);
    expect(s.crew).toEqual([]);
  });

  it('a run whose recipe is gone still lists, with the fallback slug + name', () => {
    const s = missionSummary({
      runs: [run('run9', 'gone', 'running', 0, [stepState('running')])],
      recipes: RECIPES,
      watchlists: [],
    });
    expect(s.crew[0].recipeName).toBe('a play');
    expect(s.crew[0].expertSlug).toBe('research');
  });

  it('watches count actives only', () => {
    const s = missionSummary({
      runs: [],
      recipes: [],
      watchlists: [
        { status: 'active' },
        { status: 'active' },
        { status: 'paused' },
      ],
    });
    expect(s.watches).toBe(2);
  });

  it('an empty fleet reads as zero, never a crash', () => {
    expect(
      missionSummary({ runs: [], recipes: [], watchlists: [] }),
    ).toEqual({ activeRuns: 0, gatesWaiting: 0, watches: 0, crew: [] });
  });
});
