import { describe, it, expect } from 'vitest';

import { runRecipe } from '@/lib/mothermode/research/recipes/run';
import {
  rowToRecipe,
  initialStepsState,
  type Recipe,
  type RecipeRun,
} from '@/lib/mothermode/research/recipes/types';
import {
  buildExpertScorecards,
  scorecardSummary,
} from '@/lib/mothermode/research/scorecards';
import type { ResearchArtifact, ResearchSession } from '@/lib/mothermode/research/types';
import { DEFAULT_RESEARCH_EXPERT } from '@/lib/mothermode/research/experts/types';

/**
 * Phase 4, pinned: the citation enforce mode (a thin sweep FAILS after the
 * one nudge, while 'flag' still lands honestly noted) and the measured
 * per-expert cost (the log's stamped rows WIN over the allocation,
 * absent experts keep it, the "~" hangs on the flag).
 */

const SESSION = { id: 's1', intake: { goal: 'g' } } as unknown as ResearchSession;

// Claim-length lines (40+ chars, the coverage's threshold) with NO
// receipts — total 2, sourced 0, ratio 0 < the floor.
const THIN =
  'This claim has no receipt attached to it whatsoever.\n' +
  'Neither does this second unsupported claim line at all.\n';

const RECEIPTED =
  'Bedtime is a war zone for 47% of moms surveyed according to https://example.com/study\n' +
  'r/mommit threads repeat the same three fixes verbatim across 12k comments\n' +
  '"Nobody warns you how loud 2am gets" said one thread with 3.2k upvotes\n';

function artifact(id: string, markdown: string): ResearchArtifact {
  return {
    id,
    sessionId: 's1',
    type: 'research-brief',
    title: 'Brief',
    markdown,
    structured: {},
    status: 'draft',
    handedOffTo: null,
    version: 1,
    parentId: '',
    createdBy: 'research',
    createdAt: null,
    updatedAt: null,
  } as ResearchArtifact;
}

function recipe(mode: 'flag' | 'enforce'): Recipe {
  return {
    id: 'r1',
    slug: 'sweep',
    name: 'Sweep',
    description: '',
    steps: [
      {
        expert: 'research',
        instruction: 'sweep the niche',
        inputFrom: 'brief',
        outputArtifact: 'research-brief',
        gate: 'auto',
      },
    ],
    budgetEstCents: 450,
    status: 'active',
    citationMode: mode,
    createdAt: null,
    updatedAt: null,
  };
}

function run(): RecipeRun {
  return {
    id: 'run1',
    recipeId: 'r1',
    sessionId: 's1',
    status: 'running',
    currentStep: 0,
    stepsState: initialStepsState(1),
    estCostCents: 0,
    createdAt: null,
    updatedAt: null,
  };
}

function deps(artifacts: ResearchArtifact[]) {
  let call = 0;
  return {
    getExpert: async () => null,
    runTurn: async () => {
      call += 1;
    },
    listArtifacts: async () => {
      // Turn 1 returns the thin brief; the nudge turn adds the receipted one.
      return call >= 2 ? [...artifacts] : artifacts.slice(0, 1);
    },
    stampParent: async () => {},
    readUsageCents: async () => 0,
    runHandoff: async () => {},
    updateRun: async () => {},
  };
}

describe('citation enforce mode (Phase 4)', () => {
  it('flag mode: a thin sweep lands with the honest receipts note (v1, unchanged)', async () => {
    const arts = [artifact('a1', THIN), artifact('a2', THIN)];
    const status = await runRecipe({
      recipe: recipe('flag'),
      run: run(),
      session: SESSION,
      deps: deps(arts),
    });
    expect(status).toBe('done');
  });

  it('enforce mode: a sweep still thin AFTER the nudge FAILS the step and the run', async () => {
    const arts = [artifact('a1', THIN), artifact('a2', THIN)];
    const status = await runRecipe({
      recipe: recipe('enforce'),
      run: run(),
      session: SESSION,
      deps: deps(arts),
    });
    expect(status).toBe('failed');
  });

  it('enforce mode: a sweep that FIXES its receipts on the nudge lands', async () => {
    const arts = [artifact('a1', THIN), artifact('a2', RECEIPTED)];
    const status = await runRecipe({
      recipe: recipe('enforce'),
      run: run(),
      session: SESSION,
      deps: deps(arts),
    });
    expect(status).toBe('done');
  });
});

describe('rowToRecipe citation_mode mapping', () => {
  it('maps enforce, degrades everything else to flag (pre-migration null included)', () => {
    const base = {
      id: 'r1',
      slug: 'x',
      name: 'X',
      description: '',
      steps: [],
      budget_est_cents: 100,
      status: 'active',
      created_at: null,
      updated_at: null,
    };
    expect(rowToRecipe({ ...base, citation_mode: 'enforce' }).citationMode).toBe('enforce');
    expect(rowToRecipe({ ...base, citation_mode: 'flag' }).citationMode).toBe('flag');
    expect(rowToRecipe({ ...base, citation_mode: 'garbage' }).citationMode).toBe('flag');
    expect(rowToRecipe(base).citationMode).toBe('flag');
  });
});

describe('measured per-expert cost (Phase 4)', () => {
  const oneRun = (id: string, cents: number): RecipeRun => ({
    id,
    recipeId: 'r1',
    sessionId: 's1',
    status: 'done',
    currentStep: 2,
    stepsState: [
      { status: 'done', artifactId: '', note: '', at: 'x' },
      { status: 'done', artifactId: '', note: '', at: 'x' },
    ],
    estCostCents: cents,
    createdAt: null,
    updatedAt: null,
  });
  const theRecipe: Recipe = {
    ...recipe('flag'),
    steps: [
      { expert: 'atlas', instruction: 'a', inputFrom: 'brief', outputArtifact: 'research-brief', gate: 'auto' },
      { expert: 'wren', instruction: 'b', inputFrom: 'previous', outputArtifact: 'offer-brief', gate: 'auto' },
    ],
  };

  it('measured rows WIN for the stamped expert; the unstamped keep the allocation; the ~ hangs on the flag', () => {
    const cards = buildExpertScorecards({
      runs: [oneRun('run1', 100)],
      recipes: [theRecipe],
      artifactsById: new Map(),
      measuredCostByExpert: new Map([['atlas', 73]]),
    });
    const atlas = cards.find((c) => c.slug === 'atlas')!;
    const wren = cards.find((c) => c.slug === 'wren')!;
    // atlas: measured replaces the 50-cent allocation; wren: keeps it.
    expect(atlas.estCostCents).toBe(73);
    expect(atlas.costMeasured).toBe(true);
    expect(wren.estCostCents).toBe(50);
    expect(wren.costMeasured).toBe(false);
    // The summary's "~" hangs on the flag, exactly.
    expect(scorecardSummary(atlas)).toContain('$0.73');
    expect(scorecardSummary(atlas)).not.toContain('~$');
    expect(scorecardSummary(wren)).toContain('~$0.50');
  });

  it('a null map (read failed / pre-migration) leaves every card allocated', () => {
    const cards = buildExpertScorecards({
      runs: [oneRun('run1', 100)],
      recipes: [theRecipe],
      artifactsById: new Map(),
      measuredCostByExpert: null,
    });
    expect(cards.every((c) => !c.costMeasured)).toBe(true);
    expect(cards.find((c) => c.slug === 'atlas')!.estCostCents).toBe(50);
  });
});

describe('the loop stamps (shape pin)', () => {
  it('the default research expert slug is what chat turns stamp', () => {
    expect(DEFAULT_RESEARCH_EXPERT.slug).toBe('research');
  });
});
