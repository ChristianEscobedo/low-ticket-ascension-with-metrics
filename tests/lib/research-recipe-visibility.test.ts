import { describe, it, expect, vi } from 'vitest';

import { rowToResearchMessage } from '@/lib/mothermode/research/types';
import {
  expertDisplayName,
  recipeCrew,
  crewSummary,
  runProgress,
  isRunActive,
  formatAgo,
  researchLabHref,
  handoffTargetLabel,
  handoffNotice,
  nextUnfinishedStepIndex,
  citationCoverage,
  CITATION_FLOOR,
  type ExpertInfo,
} from '@/lib/mothermode/research/recipes/crew';
import {
  runRecipe,
  type RecipeDeps,
} from '@/lib/mothermode/research/recipes/run';
import type { Recipe, RecipeRun } from '@/lib/mothermode/research/recipes/types';
import { blankIntake } from '@/lib/mothermode/research/intake';
import { DEFAULT_RESEARCH_EXPERT } from '@/lib/mothermode/research/experts/types';
import type {
  ResearchArtifact,
  ResearchSession,
} from '@/lib/mothermode/research/types';

/**
 * The recipes visibility pass, pinned:
 *   - message provenance (expert_slug / recipe_run_id / recipe_step_index)
 *     maps defensively at the DB boundary,
 *   - the interpreter stamps every step turn with the run id + step index,
 *   - the owner can CANCEL a running run: it stops between steps, honestly
 *     (the in-flight step's completed work stays done),
 *   - the crew/run display helpers the mission UI and the lab share.
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

function run(stepsState?: RecipeRun['stepsState']): RecipeRun {
  return {
    id: 'run1',
    recipeId: 'r1',
    sessionId: 'sess1',
    status: 'running',
    currentStep: 0,
    stepsState: stepsState ?? [],
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
    runHandoff: vi.fn(async () => {}),
    updateRun: vi.fn(async () => {}),
  };
}

const twoSteps = recipe([
  {
    expert: 'research',
    instruction: 'research it. goal: {input}',
    inputFrom: 'brief',
    outputArtifact: 'research-brief',
    gate: 'auto',
  },
  {
    expert: 'strategist',
    instruction: 'decide from:\n{input}',
    inputFrom: 'previous',
    outputArtifact: 'offer-brief',
    gate: 'auto',
  },
]);

// ---------------------------------------------------------------------------
// Message provenance at the DB boundary
// ---------------------------------------------------------------------------

describe('rowToResearchMessage provenance', () => {
  it('maps the provenance columns when present', () => {
    const m = rowToResearchMessage({
      id: 'm1',
      session_id: 's1',
      role: 'assistant',
      content: 'done',
      tool_calls: [],
      model: 'x',
      expert_slug: 'strategist',
      recipe_run_id: 'run9',
      recipe_step_index: 2,
      created_at: null,
    });
    expect(m.expertSlug).toBe('strategist');
    expect(m.recipeRunId).toBe('run9');
    expect(m.recipeStepIndex).toBe(2);
  });

  it('a pre-migration row (no provenance columns) reads as a plain chat turn', () => {
    const m = rowToResearchMessage({
      id: 'm2',
      session_id: 's1',
      role: 'user',
      content: 'hi',
      tool_calls: [],
      model: null,
      created_at: null,
    });
    expect(m.expertSlug).toBe('');
    expect(m.recipeRunId).toBe('');
    expect(m.recipeStepIndex).toBeNull();
  });

  it('junk provenance degrades, never crashes', () => {
    const m = rowToResearchMessage({
      id: 'm3',
      session_id: 's1',
      role: 'assistant',
      content: '',
      tool_calls: [],
      model: null,
      expert_slug: 42 as never,
      recipe_run_id: null,
      recipe_step_index: -3,
      created_at: null,
    });
    expect(m.expertSlug).toBe('');
    expect(m.recipeStepIndex).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The interpreter stamps every step turn with run + step provenance
// ---------------------------------------------------------------------------

describe('runRecipe provenance', () => {
  it('every step turn carries the run id and its 0-based step index', async () => {
    const brief = artifact('a1', 'research-brief', 'the research');
    const offer = artifact('a2', 'offer-brief');
    const deps = fakeDeps([offer, brief]);
    const status = await runRecipe({
      recipe: twoSteps,
      run: run(),
      session,
      deps,
    });
    expect(status).toBe('done');
    const turns = (deps.runTurn as ReturnType<typeof vi.fn>).mock.calls;
    expect(turns[0][0].recipeRunId).toBe('run1');
    expect(turns[0][0].recipeStepIndex).toBe(0);
    expect(turns[1][0].recipeRunId).toBe('run1');
    expect(turns[1][0].recipeStepIndex).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Cancel a running run
// ---------------------------------------------------------------------------

describe('runRecipe cancel', () => {
  it('canceled before the first step: nothing runs, the step is skipped', async () => {
    const deps = fakeDeps([]);
    deps.isCanceled = vi.fn(async () => true);
    const status = await runRecipe({
      recipe: twoSteps,
      run: run(),
      session,
      deps,
    });
    expect(status).toBe('canceled');
    expect(deps.runTurn).not.toHaveBeenCalled();
    const updates = (deps.updateRun as ReturnType<typeof vi.fn>).mock.calls;
    const last = updates.at(-1)![1];
    expect(last.status).toBe('canceled');
    expect(last.stepsState[0].status).toBe('skipped');
    expect(last.stepsState[0].note).toContain('canceled');
  });

  it('canceled mid-run: the in-flight step completes, the next never starts', async () => {
    const brief = artifact('a1', 'research-brief');
    const deps = fakeDeps([brief]);
    let canceled = false;
    // The owner cancels while step 1's turn is in flight.
    (deps.runTurn as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      canceled = true;
    });
    deps.isCanceled = vi.fn(async () => canceled);
    const status = await runRecipe({
      recipe: twoSteps,
      run: run(),
      session,
      deps,
    });
    expect(status).toBe('canceled');
    // One turn ran — the strategist's step never started.
    expect(deps.runTurn).toHaveBeenCalledTimes(1);
    const updates = (deps.updateRun as ReturnType<typeof vi.fn>).mock.calls;
    const last = updates.at(-1)![1];
    expect(last.status).toBe('canceled');
    // The completed step's work stays done with its artifact recorded.
    expect(last.stepsState[0].status).toBe('done');
    expect(last.stepsState[0].artifactId).toBe('a1');
  });

  it('no isCanceled dep (tests, inline starts): runs exactly as before', async () => {
    const brief = artifact('a1', 'research-brief');
    const offer = artifact('a2', 'offer-brief');
    const deps = fakeDeps([offer, brief]);
    const status = await runRecipe({
      recipe: twoSteps,
      run: run(),
      session,
      deps,
    });
    expect(status).toBe('done');
    expect(deps.runTurn).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// The handoff chat trail (initiated -> completed/failed, with provenance)
// ---------------------------------------------------------------------------

describe('the handoff chat trail', () => {
  const withHandoff = () =>
    recipe([
      {
        expert: 'leadmagnet',
        instruction: 'design. {input}',
        inputFrom: 'brief',
        outputArtifact: 'lead-magnet',
        gate: 'auto',
        handoff: { target: 'leadgen-kit', generate: true },
      },
    ]);

  it('posts initiated + completed notices stamped with the run + step', async () => {
    const magnet = artifact('a1', 'lead-magnet');
    const deps = fakeDeps([magnet]);
    // The resolved expert config lands on the notice (the leadmagnet crew
    // member, in production — the test resolves it the same way).
    deps.getExpert = vi.fn(async () => ({
      ...DEFAULT_RESEARCH_EXPERT,
      slug: 'leadmagnet',
    }));
    (deps.runHandoff as ReturnType<typeof vi.fn>).mockResolvedValue(
      'The Offload Map (drafted)',
    );
    deps.postNotice = vi.fn(async () => {});
    const status = await runRecipe({
      recipe: withHandoff(),
      run: run(),
      session,
      deps,
    });
    expect(status).toBe('done');
    const notices = (deps.postNotice as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0],
    );
    expect(notices).toHaveLength(2);
    expect(notices[0].text).toContain('Handoff initiated');
    expect(notices[0].text).toContain('lead gen kit');
    expect(notices[0].sessionId).toBe('sess1');
    expect(notices[0].recipeRunId).toBe('run1');
    expect(notices[0].recipeStepIndex).toBe(0);
    expect(notices[0].expertSlug).toBe('leadmagnet');
    expect(notices[1].text).toContain('Handoff completed');
    expect(notices[1].text).toContain('The Offload Map (drafted)');
  });

  it('a failed handoff posts the failure notice AND still fails the step', async () => {
    const magnet = artifact('a1', 'lead-magnet');
    const deps = fakeDeps([magnet]);
    (deps.runHandoff as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('leadgen store down'),
    );
    deps.postNotice = vi.fn(async () => {});
    const status = await runRecipe({
      recipe: withHandoff(),
      run: run(),
      session,
      deps,
    });
    expect(status).toBe('failed');
    const notices = (deps.postNotice as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0],
    );
    expect(notices).toHaveLength(2);
    expect(notices[1].text).toContain('Handoff failed');
    expect(notices[1].text).toContain('leadgen store down');
    const updates = (deps.updateRun as ReturnType<typeof vi.fn>).mock.calls;
    expect(updates.at(-1)![1].status).toBe('failed');
  });
});

// ---------------------------------------------------------------------------
// The notice text builders
// ---------------------------------------------------------------------------

describe('handoffTargetLabel / handoffNotice', () => {
  it('labels every target, falls back to the raw target', () => {
    expect(handoffTargetLabel('planner-cards')).toBe('planner cards');
    expect(handoffTargetLabel('leadgen-kit')).toBe('lead gen kit');
    expect(handoffTargetLabel('email-kit')).toBe('email kit');
    expect(handoffTargetLabel('sales-funnel')).toBe('sales funnel draft');
    expect(handoffTargetLabel('system')).toBe('full system');
    expect(handoffTargetLabel('weird')).toBe('weird');
  });

  it('initiated reads as building (generate) or drafting (draft), system always builds', () => {
    expect(
      handoffNotice({
        phase: 'initiated',
        target: 'email-kit',
        generate: true,
        artifactTitle: 'X',
      }),
    ).toContain('Building the email kit');
    expect(
      handoffNotice({
        phase: 'initiated',
        target: 'sales-funnel',
        generate: false,
        artifactTitle: 'X',
      }),
    ).toContain('Drafting the sales funnel draft');
    expect(
      handoffNotice({
        phase: 'initiated',
        target: 'system',
        generate: false,
        artifactTitle: 'X',
      }),
    ).toContain('Building the full system');
  });

  it('completed carries the outcome label; failed carries the reason', () => {
    const done = handoffNotice({
      phase: 'completed',
      target: 'planner-cards',
      generate: false,
      artifactTitle: 'The Plan',
      detail: '12 planner cards',
    });
    expect(done).toContain('Handoff completed');
    expect(done).toContain('12 planner cards');
    expect(done).toContain('The Plan');
    const failed = handoffNotice({
      phase: 'failed',
      target: 'leadgen-kit',
      generate: true,
      artifactTitle: '',
      detail: 'store down',
    });
    expect(failed).toContain('Handoff failed');
    expect(failed).toContain('store down');
    expect(failed).toContain('untitled');
  });
});

// ---------------------------------------------------------------------------
// The shared display helpers
// ---------------------------------------------------------------------------

const CREW: ExpertInfo[] = [
  { slug: 'research', name: 'Research', tagline: 'Niche research' },
  { slug: 'strategist', name: 'Atlas', tagline: 'Offers' },
  { slug: 'copy', name: 'Wren', tagline: 'Hooks' },
];

describe('expertDisplayName / recipeCrew / crewSummary', () => {
  it('the directory name wins; unknown slugs prettify; empty degrades', () => {
    expect(expertDisplayName('strategist', CREW)).toBe('Atlas');
    expect(expertDisplayName('leadmagnet', CREW)).toBe('Leadmagnet');
    expect(expertDisplayName('', CREW)).toBe('Expert');
  });

  it('the crew is unique experts in first-use order', () => {
    const r = recipe([
      twoSteps.steps[0],
      twoSteps.steps[0], // research twice
      twoSteps.steps[1],
    ]);
    expect(recipeCrew(r)).toEqual(['research', 'strategist']);
    expect(crewSummary(r, CREW)).toBe('Research → Atlas');
  });
});

describe('citationCoverage', () => {
  it('counts receipts honestly: urls, subreddits, handles, percents, quotes', () => {
    const md = [
      '"I am the default parent and I am so tired" — 2.1k upvotes on r/workingmoms.',
      'This theme shows up in 12.4% of the winning posts this month.',
      'A vibe claim with no receipt at all, stated plainly as an assertion.',
      '# A HEADING DOES NOT COUNT AS A CLAIM LINE AT ALL EVER EVER EVER EVER',
      'Short.',
    ].join('\n');
    const c = citationCoverage(md);
    expect(c.total).toBe(3);
    expect(c.sourced).toBe(2);
    expect(c.ratio).toBeCloseTo(2 / 3, 2);
  });

  it('empty markdown scores zero total (never flagged)', () => {
    const c = citationCoverage('');
    expect(c).toEqual({ sourced: 0, total: 0, ratio: 0 });
    expect(CITATION_FLOOR).toBeGreaterThan(0);
    expect(CITATION_FLOOR).toBeLessThanOrEqual(1);
  });
});

describe('nextUnfinishedStepIndex', () => {
  it('finds the first pending or running step; past-the-end when settled', () => {
    expect(
      nextUnfinishedStepIndex(
        run([
          { status: 'done', artifactId: 'a1', note: '', at: null },
          { status: 'running', artifactId: '', note: '', at: null },
          { status: 'pending', artifactId: '', note: '', at: null },
        ]),
      ),
    ).toBe(1);
    expect(
      nextUnfinishedStepIndex(
        run([
          { status: 'done', artifactId: 'a1', note: '', at: null },
          { status: 'gated', artifactId: 'a2', note: '', at: null },
        ]),
      ),
    ).toBe(2);
    expect(nextUnfinishedStepIndex(run())).toBe(0);
  });
});

describe('runProgress / isRunActive', () => {
  it('counts done + gated as completed, failed as not', () => {
    const p = runProgress(
      run([
        { status: 'done', artifactId: 'a1', note: '', at: null },
        { status: 'gated', artifactId: 'a2', note: '', at: null },
        { status: 'failed', artifactId: '', note: '', at: null },
        { status: 'pending', artifactId: '', note: '', at: null },
      ]),
    );
    expect(p).toEqual({ done: 2, total: 4, percent: 50 });
    expect(isRunActive(run())).toBe(true);
    expect(
      isRunActive({ ...run(), status: 'done' }),
    ).toBe(false);
  });
});

describe('formatAgo / researchLabHref', () => {
  it('relative time reads honestly', () => {
    expect(formatAgo(null)).toBe('');
    expect(formatAgo('not-a-date')).toBe('');
    expect(formatAgo(new Date(Date.now() - 10 * 1000).toISOString())).toBe(
      'just now',
    );
    expect(formatAgo(new Date(Date.now() - 5 * 60000).toISOString())).toBe(
      '5m ago',
    );
    expect(
      formatAgo(new Date(Date.now() - 3 * 3600000).toISOString()),
    ).toBe('3h ago');
  });

  it('the deep link carries session + optional run + artifact', () => {
    expect(researchLabHref({ sessionId: 's1' })).toBe(
      '/admin/research?session=s1',
    );
    expect(
      researchLabHref({ sessionId: 's1', runId: 'r9', artifactId: 'a3' }),
    ).toBe('/admin/research?session=s1&run=r9&artifact=a3');
  });
});
