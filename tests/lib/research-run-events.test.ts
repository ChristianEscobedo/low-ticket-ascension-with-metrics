import { describe, it, expect, vi } from 'vitest';

import {
  rowToRunEvent,
  type RecipeRunEventRow,
} from '@/lib/mothermode/research/recipes/store';
import {
  runRecipe,
  type RecipeDeps,
} from '@/lib/mothermode/research/recipes/run';
import type { Recipe, RecipeRun } from '@/lib/mothermode/research/recipes/types';
import { blankIntake } from '@/lib/mothermode/research/intake';
import type {
  ResearchArtifact,
  ResearchSession,
} from '@/lib/mothermode/research/types';

/**
 * The run event log (trust spine, part 1), pinned: the row mapper defends,
 * and the interpreter records every beat in order — step started, artifact
 * landed, handoff beats, gates, stops — so the timeline is the run's story.
 */

const session: ResearchSession = {
  id: 'sess1',
  title: 't',
  offerSlug: '',
  contextRefs: [],
  intake: { ...blankIntake(), goal: 'the next $17 offer' },
  status: 'active',
  createdAt: null,
  updatedAt: null,
  updatedBy: null,
};

function artifact(id: string, type: string, markdown = 'md'): ResearchArtifact {
  return {
    id,
    sessionId: 'sess1',
    type: type as never,
    title: `T-${id}`,
    markdown,
    structured: {},
    status: 'draft',
    handedOffTo: null,
    version: 1,
    parentId: '',
    createdBy: 'agent',
    createdAt: null,
    updatedAt: null,
  };
}

function recipe(steps: Recipe['steps']): Recipe {
  return {
    id: 'r1',
    slug: 'test',
    name: 'Test',
    description: '',
    steps,
    budgetEstCents: 150,
    status: 'active',
    createdAt: null,
    updatedAt: null,
  };
}

function run(): RecipeRun {
  return {
    id: 'run1',
    recipeId: 'r1',
    sessionId: 'sess1',
    status: 'running',
    currentStep: 0,
    stepsState: [],
    estCostCents: 0,
    createdAt: null,
    updatedAt: null,
  };
}

function fakeDeps(arts: ResearchArtifact[], cents = 0): RecipeDeps {
  return {
    getExpert: vi.fn(async () => null),
    runTurn: vi.fn(async () => {}),
    listArtifacts: vi.fn(async () => arts),
    stampParent: vi.fn(async () => {}),
    readUsageCents: vi.fn(async () => cents),
    runHandoff: vi.fn(async () => 'Kit Name (drafted)'),
    updateRun: vi.fn(async () => {}),
    logEvent: vi.fn(async () => {}),
  };
}

const twoSteps = () =>
  recipe([
    {
      expert: 'research',
      instruction: 'research it. goal: {input}',
      inputFrom: 'brief',
      outputArtifact: 'research-brief',
      gate: 'auto',
    },
    {
      expert: 'copy',
      instruction: 'plan from:\n{input}',
      inputFrom: 'previous',
      outputArtifact: 'content-plan',
      gate: 'auto',
      handoff: { target: 'planner-cards', generate: false },
    },
  ]);

/** The logEvent calls as [kind, stepIndex] pairs, in order. */
function kinds(deps: RecipeDeps): Array<[string, number | null]> {
  return (deps.logEvent as ReturnType<typeof vi.fn>).mock.calls.map(
    (c) => [c[0].kind, c[0].stepIndex ?? null] as [string, number | null],
  );
}

describe('rowToRunEvent', () => {
  it('maps defensively: known kinds pass, junk degrades', () => {
    const row: RecipeRunEventRow = {
      id: 'e1',
      run_id: 'run1',
      kind: 'handoff-completed',
      step_index: 2,
      text: '  Kit (drafted)  ',
      created_at: 't',
    };
    const e = rowToRunEvent(row);
    expect(e).toEqual({
      id: 'e1',
      runId: 'run1',
      kind: 'handoff-completed',
      stepIndex: 2,
      text: 'Kit (drafted)',
      createdAt: 't',
    });
    expect(
      rowToRunEvent({ ...row, kind: 'weird', step_index: null, text: null }),
    ).toEqual({
      id: 'e1',
      runId: 'run1',
      kind: 'step-started',
      stepIndex: null,
      text: '',
      createdAt: 't',
    });
  });
});

describe('the interpreter records every beat, in order', () => {
  it('a clean run logs step-started, artifact (per step), done', async () => {
    const brief = artifact('a1', 'research-brief', 'the research');
    const plan = artifact('a2', 'content-plan');
    const deps = fakeDeps([plan, brief]);
    const status = await runRecipe({
      recipe: twoSteps(),
      run: run(),
      session,
      deps,
    });
    expect(status).toBe('done');
    expect(kinds(deps)).toEqual([
      ['step-started', 0],
      ['artifact', 0],
      ['step-started', 1],
      ['artifact', 1],
      ['handoff-initiated', 1],
      ['handoff-completed', 1],
      ['done', null],
    ]);
  });

  it('a gated run logs through the gate and stops there', async () => {
    const gated = recipe([
      {
        expert: 'strategist',
        instruction: 'decide. {input}',
        inputFrom: 'brief',
        outputArtifact: 'offer-brief',
        gate: 'approve',
      },
      {
        expert: 'copy',
        instruction: 'plan. {input}',
        inputFrom: 'previous',
        outputArtifact: 'content-plan',
        gate: 'auto',
      },
    ]);
    const offer = artifact('a1', 'offer-brief');
    const deps = fakeDeps([offer]);
    const status = await runRecipe({
      recipe: gated,
      run: run(),
      session,
      deps,
    });
    expect(status).toBe('gated');
    expect(kinds(deps)).toEqual([
      ['step-started', 0],
      ['artifact', 0],
      ['gated', 0],
    ]);
  });

  it('a budget stop logs budget-stopped, a step failure logs failed', async () => {
    const brief = artifact('a1', 'research-brief');
    const deps = fakeDeps([brief]);
    (deps.readUsageCents as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(0)
      .mockResolvedValue(500);
    const status = await runRecipe({
      recipe: twoSteps(),
      run: run(),
      session,
      deps,
    });
    expect(status).toBe('failed');
    expect(kinds(deps)).toEqual([
      ['step-started', 0],
      ['artifact', 0],
      ['budget-stopped', 0],
    ]);

    const deps2 = fakeDeps([]); // nothing emitted
    const status2 = await runRecipe({
      recipe: twoSteps(),
      run: run(),
      session,
      deps: deps2,
    });
    expect(status2).toBe('failed');
    expect(kinds(deps2)).toEqual([
      ['step-started', 0],
      ['failed', 0],
    ]);
  });

  it('a handoff failure logs handoff-initiated then handoff-failed, then failed', async () => {
    const brief = artifact('a1', 'research-brief', 'the research');
    const plan = artifact('a2', 'content-plan');
    const deps = fakeDeps([plan, brief]);
    (deps.runHandoff as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('planner down'),
    );
    const status = await runRecipe({
      recipe: twoSteps(),
      run: run(),
      session,
      deps,
    });
    expect(status).toBe('failed');
    expect(kinds(deps)).toEqual([
      ['step-started', 0],
      ['artifact', 0],
      ['step-started', 1],
      ['artifact', 1],
      ['handoff-initiated', 1],
      ['handoff-failed', 1],
      ['failed', 1],
    ]);
  });

  it('a canceled run logs canceled before the next step starts', async () => {
    const brief = artifact('a1', 'research-brief');
    const deps = fakeDeps([brief]);
    let canceled = false;
    (deps.runTurn as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      canceled = true;
    });
    deps.isCanceled = vi.fn(async () => canceled);
    const status = await runRecipe({
      recipe: twoSteps(),
      run: run(),
      session,
      deps,
    });
    expect(status).toBe('canceled');
    expect(kinds(deps)).toEqual([
      ['step-started', 0],
      ['artifact', 0],
      ['canceled', 0],
    ]);
  });
});

// ---------------------------------------------------------------------------
// The step-sized lane (maxSteps)
// ---------------------------------------------------------------------------

describe('runRecipe maxSteps (the step-sized lane)', () => {
  it('maxSteps 1 runs exactly one step and returns running (no done event)', async () => {
    const brief = artifact('a1', 'research-brief', 'the research');
    const plan = artifact('a2', 'content-plan');
    const deps = fakeDeps([plan, brief]);
    const status = await runRecipe({
      recipe: twoSteps(),
      run: run(),
      session,
      maxSteps: 1,
      deps,
    });
    expect(status).toBe('running');
    expect(deps.runTurn).toHaveBeenCalledTimes(1);
    expect(kinds(deps)).toEqual([
      ['step-started', 0],
      ['artifact', 0],
    ]);
    // The run row was patched as running with step 1 done, never done.
    const updates = (deps.updateRun as ReturnType<typeof vi.fn>).mock.calls;
    const last = updates.at(-1)![1];
    expect(last.status).toBe('running');
    expect(last.stepsState[0].status).toBe('done');
    expect(last.stepsState[1].status).toBe('pending');
  });

  it('the next slice resumes at step 2 and finishes the recipe', async () => {
    const brief = artifact('a1', 'research-brief', 'the research');
    const plan = artifact('a2', 'content-plan');
    const deps = fakeDeps([plan, brief]);
    const status = await runRecipe({
      recipe: twoSteps(),
      run: {
        ...run(),
        currentStep: 1,
        stepsState: [
          { status: 'done', artifactId: 'a1', note: '', at: null },
          { status: 'pending', artifactId: '', note: '', at: null },
        ],
      },
      session,
      startStep: 1,
      maxSteps: 1,
      deps,
    });
    expect(status).toBe('done');
    expect(deps.runTurn).toHaveBeenCalledTimes(1);
    expect(kinds(deps)).toEqual([
      ['step-started', 1],
      ['artifact', 1],
      ['handoff-initiated', 1],
      ['handoff-completed', 1],
      ['done', null],
    ]);
  });

  it('no maxSteps: the whole recipe in one call, exactly as before', async () => {
    const brief = artifact('a1', 'research-brief');
    const plan = artifact('a2', 'content-plan');
    const deps = fakeDeps([plan, brief]);
    const status = await runRecipe({
      recipe: twoSteps(),
      run: run(),
      session,
      deps,
    });
    expect(status).toBe('done');
    expect(deps.runTurn).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Citations (research with receipts) + gate notifications
// ---------------------------------------------------------------------------

describe('citation enforcement v1', () => {
  const researchOnly = () =>
    recipe([
      {
        expert: 'research',
        instruction: 'research it. goal: {input}',
        inputFrom: 'brief',
        outputArtifact: 'research-brief',
        gate: 'auto',
      },
    ]);

  it('a thinly-sourced brief gets ONE nudge turn, then lands flagged', async () => {
    // Two claim lines, zero receipts.
    const thin = artifact(
      'a1',
      'research-brief',
      'Moms are overwhelmed by the invisible load of running the household.\nThe opportunity is a low-ticket reset kit sold at seventeen dollars.',
    );
    const deps = fakeDeps([thin]);
    const status = await runRecipe({
      recipe: researchOnly(),
      run: run(),
      session,
      deps,
    });
    expect(status).toBe('done');
    // The original turn + exactly one nudge.
    expect(deps.runTurn).toHaveBeenCalledTimes(2);
    const nudge = (deps.runTurn as ReturnType<typeof vi.fn>).mock.calls[1][0];
    expect(nudge.userText).toContain('every claim line must carry its receipt');
    expect(nudge.recipeRunId).toBe('run1');
    expect(nudge.recipeStepIndex).toBe(0);
    // The note says the coverage honestly, and the log flags it.
    const updates = (deps.updateRun as ReturnType<typeof vi.fn>).mock.calls;
    expect(updates.at(-1)![1].stepsState[0].note).toContain('receipts 0/2 (low)');
    expect(kinds(deps)).toContainEqual(['citation-low', 0]);
  });

  it('a well-sourced brief passes with no nudge and no flag', async () => {
    const rich = artifact(
      'a1',
      'research-brief',
      '"I am the default parent and I am so tired" — 2.1k upvotes on r/workingmoms.\nEngagement on reset-kit content runs 12.4% vs 3.1% on planners per our metrics.',
    );
    const deps = fakeDeps([rich]);
    const status = await runRecipe({
      recipe: researchOnly(),
      run: run(),
      session,
      deps,
    });
    expect(status).toBe('done');
    expect(deps.runTurn).toHaveBeenCalledTimes(1);
    const updates = (deps.updateRun as ReturnType<typeof vi.fn>).mock.calls;
    expect(updates.at(-1)![1].stepsState[0].note).toContain('receipts 2/2');
    expect(kinds(deps)).not.toContainEqual(['citation-low', 0]);
  });
});

describe('gate notifications', () => {
  it('a gated run tells the owner, with the gate note attached', async () => {
    const gated = recipe([
      {
        expert: 'strategist',
        instruction: 'decide. {input}',
        inputFrom: 'brief',
        outputArtifact: 'offer-brief',
        gate: 'approve',
      },
      {
        expert: 'copy',
        instruction: 'plan. {input}',
        inputFrom: 'previous',
        outputArtifact: 'content-plan',
        gate: 'auto',
      },
    ]);
    const offer = artifact('a1', 'offer-brief');
    const deps = fakeDeps([offer]);
    deps.notifyGate = vi.fn(async () => {});
    const status = await runRecipe({
      recipe: gated,
      run: run(),
      session,
      deps,
    });
    expect(status).toBe('gated');
    expect(deps.notifyGate).toHaveBeenCalledTimes(1);
    const call = (deps.notifyGate as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.recipeName).toBe('Test');
    expect(call.runId).toBe('run1');
    expect(call.sessionId).toBe('sess1');
    expect(call.stepNote).toContain('review');
  });
});
