import { describe, it, expect, vi } from 'vitest';

import {
  normalizeRecipeSteps,
  normalizeStepsState,
  initialStepsState,
  rowToRecipe,
  rowToRecipeRun,
  type Recipe,
  type RecipeRun,
} from '@/lib/mothermode/research/recipes/types';
import { runRecipe, type RecipeDeps } from '@/lib/mothermode/research/recipes/run';
import { RECIPE_SEEDS } from '@/lib/mothermode/research/recipes/seed';
import { DEFAULT_RESEARCH_EXPERT } from '@/lib/mothermode/research/experts/types';
import { blankIntake } from '@/lib/mothermode/research/intake';
import type { ResearchArtifact, ResearchSession } from '@/lib/mothermode/research/types';

/**
 * The recipe engine (roadmap 3.1), pinned: defensive step normalization,
 * the sequential envelope chain with lineage stamps, the approve gate's
 * pause-and-resume, and the per-run budget stop. Deps are injected fakes —
 * no paid calls, fully deterministic.
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

describe('normalizeRecipeSteps', () => {
  it('keeps valid steps, defaults gate/inputFrom, drops junk', () => {
    const steps = normalizeRecipeSteps([
      { expert: 'research', instruction: 'do', outputArtifact: 'research-brief' },
      { expert: 'copy', instruction: 'do', outputArtifact: 'notes', gate: 'approve', inputFrom: 'previous' },
      { expert: '', instruction: 'do', outputArtifact: 'notes' },
      'junk',
      null,
    ]);
    expect(steps).toHaveLength(2);
    expect(steps[0].gate).toBe('auto');
    expect(steps[0].inputFrom).toBe('brief');
    expect(steps[1].gate).toBe('approve');
    expect(steps[1].inputFrom).toBe('previous');
  });

  it('the seed recipe is well-formed (research → strategist(gate) → copy)', () => {
    const seed = RECIPE_SEEDS[0];
    expect(seed.steps.map((s) => s.expert)).toEqual([
      'research',
      'strategist',
      'copy',
    ]);
    expect(seed.steps[1].gate).toBe('approve');
    expect(seed.steps[1].inputFrom).toBe('previous');
    for (const step of seed.steps) {
      expect(step.instruction).toContain('{input}');
    }
  });

  it('the house recipes are well-formed: unique slugs, valid chains', () => {
    const slugs = RECIPE_SEEDS.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toEqual(
      expect.arrayContaining([
        'low-ticket-launch',
        'full-system',
        'niche-watch',
        'voice-check',
        'bulk-content-engine',
        'full-funnel-build',
        'paid-launch-system',
        'email-sequence-build',
        'repurpose-engine',
        'launch-week',
        'influencer-panel',
        'comment-mining-sweep',
        'cross-channel-sweep',
        'reddit-rabbit-hole',
        'video-deep-dive',
        'audience-mosaic',
      ]),
    );
    // The intelligence producers run UNATTENDED (the watchers back the
    // weekly digest; the deep research fleet is safe to leave running or
    // watch weekly): they never gate. The builders may.
    const UNGATED = new Set([
      'niche-watch',
      'voice-check',
      'influencer-panel',
      'comment-mining-sweep',
      'cross-channel-sweep',
      'reddit-rabbit-hole',
      'video-deep-dive',
    ]);
    for (const seed of RECIPE_SEEDS) {
      expect(seed.budgetEstCents).toBeGreaterThan(0);
      // Every step after the first reads the previous envelope.
      seed.steps.forEach((step, i) => {
        expect(step.instruction).toContain('{input}');
        if (i > 0) expect(step.inputFrom).toBe('previous');
      });
      if (UNGATED.has(seed.slug)) {
        expect(seed.steps.every((s) => s.gate === 'auto')).toBe(true);
      }
    }
  });

  it('the builder fleet hands off through the existing pipeline', () => {
    const bySlug = new Map(RECIPE_SEEDS.map((r) => [r.slug, r]));

    // Bulk Content Engine: the 30-day plan gates into the planner, then
    // design + compliance advise AFTER the cards land.
    const bulk = bySlug.get('bulk-content-engine')!;
    expect(bulk.steps.map((s) => s.expert)).toEqual([
      'research',
      'copy',
      'design',
      'compliance',
    ]);
    expect(bulk.steps[1].gate).toBe('approve');
    expect(bulk.steps[1].handoff).toEqual({
      target: 'planner-cards',
      generate: false,
    });

    // Full Funnel Build: the offer gates into the SYSTEM fan-out, then a
    // post-purchase kit builds and compliance closes.
    const funnel = bySlug.get('full-funnel-build')!;
    expect(funnel.steps.map((s) => s.expert)).toEqual([
      'research',
      'strategist',
      'email',
      'compliance',
    ]);
    expect(funnel.steps[1].gate).toBe('approve');
    expect(funnel.steps[1].handoff).toEqual({
      target: 'system',
      generate: false,
    });
    expect(funnel.steps[2].handoff).toEqual({
      target: 'email-kit',
      generate: true,
    });

    // Paid Launch System: TWO gates — the offer (→ sales funnel draft) and
    // the ad angles (→ paid planner cards) — then design + compliance.
    const paid = bySlug.get('paid-launch-system')!;
    expect(paid.steps.map((s) => s.expert)).toEqual([
      'research',
      'strategist',
      'copy',
      'design',
      'compliance',
    ]);
    expect(paid.steps[1].handoff).toEqual({
      target: 'sales-funnel',
      generate: false,
    });
    expect(paid.steps[2].gate).toBe('approve');
    expect(paid.steps[2].handoff).toEqual({
      target: 'planner-cards',
      generate: false,
    });

    // Email Sequence Build: the nurture kit builds auto; the launch kit
    // gates and builds on approval. Two kits from one run.
    const email = bySlug.get('email-sequence-build')!;
    expect(email.steps.map((s) => s.expert)).toEqual([
      'research',
      'email',
      'email',
      'compliance',
    ]);
    expect(email.steps[1].handoff).toEqual({
      target: 'email-kit',
      generate: true,
    });
    expect(email.steps[2].gate).toBe('approve');
    expect(email.steps[2].handoff).toEqual({
      target: 'email-kit',
      generate: true,
    });

    // Repurpose Engine: the analyst opens (our numbers, not scrapers), the
    // re-cut calendar gates into the planner.
    const repurpose = bySlug.get('repurpose-engine')!;
    expect(repurpose.steps.map((s) => s.expert)).toEqual([
      'analyst',
      'copy',
      'design',
    ]);
    expect(repurpose.steps[1].gate).toBe('approve');
    expect(repurpose.steps[1].handoff).toEqual({
      target: 'planner-cards',
      generate: false,
    });

    // Launch Week: the mega-recipe — system fan-out on the gated offer,
    // gated paid angles, then organic calendar + launch kit + advisory tail.
    const launch = bySlug.get('launch-week')!;
    expect(launch.steps.map((s) => s.expert)).toEqual([
      'research',
      'strategist',
      'copy',
      'copy',
      'email',
      'design',
      'compliance',
    ]);
    expect(launch.steps[1].handoff).toEqual({
      target: 'system',
      generate: false,
    });
    expect(launch.steps[2].gate).toBe('approve');
    expect(launch.steps[2].handoff).toEqual({
      target: 'planner-cards',
      generate: false,
    });
    expect(launch.steps[3].handoff).toEqual({
      target: 'planner-cards',
      generate: false,
    });
    expect(launch.steps[4].handoff).toEqual({
      target: 'email-kit',
      generate: true,
    });
    // Compliance always runs last across the fleet.
    for (const slug of [
      'bulk-content-engine',
      'full-funnel-build',
      'paid-launch-system',
      'email-sequence-build',
      'launch-week',
    ]) {
      const steps = bySlug.get(slug)!.steps;
      expect(steps[steps.length - 1].expert).toBe('compliance');
    }
  });

  it('the full-system recipe hands off through the existing pipeline (3.3)', () => {
    const seed = RECIPE_SEEDS.find((r) => r.slug === 'full-system');
    expect(seed).toBeDefined();
    expect(seed!.steps.map((s) => s.expert)).toEqual([
      'strategist',
      'leadmagnet',
      'email',
      'copy',
    ]);
    // The offer gates AND drafts the sales funnel on approval; the rest
    // build through the existing handoff targets.
    expect(seed!.steps[0].gate).toBe('approve');
    expect(seed!.steps[0].handoff).toEqual({
      target: 'sales-funnel',
      generate: false,
    });
    expect(seed!.steps[1].handoff).toEqual({
      target: 'leadgen-kit',
      generate: true,
    });
    expect(seed!.steps[2].handoff).toEqual({
      target: 'email-kit',
      generate: true,
    });
    expect(seed!.steps[3].handoff).toEqual({
      target: 'planner-cards',
      generate: false,
    });
  });

  it('the deep research fleet mines every channel, artifact-only', () => {
    const bySlug = new Map(RECIPE_SEEDS.map((r) => [r.slug, r]));
    const intelligence = [
      'influencer-panel',
      'comment-mining-sweep',
      'cross-channel-sweep',
      'reddit-rabbit-hole',
      'video-deep-dive',
    ];
    for (const slug of intelligence) {
      const seed = bySlug.get(slug)!;
      // Artifact-only: no step hands anything off; the owner reads the
      // briefs and runs a builder when the intelligence says go.
      expect(seed.steps.every((s) => s.handoff === undefined)).toBe(true);
      // Research opens every play; copy closes it with a handoff-able
      // artifact (ad-angles or content-plan) for the owner's next move.
      expect(seed.steps[0].expert).toBe('research');
      const last = seed.steps[seed.steps.length - 1];
      expect(last.expert).toBe('copy');
      expect(['ad-angles', 'content-plan']).toContain(last.outputArtifact);
    }
    // The multi-step research plays chain research → research.
    expect(bySlug.get('influencer-panel')!.steps.map((s) => s.expert)).toEqual(
      ['research', 'research', 'copy'],
    );
    expect(
      bySlug.get('comment-mining-sweep')!.steps.map((s) => s.expert),
    ).toEqual(['research', 'research', 'copy']);
    expect(
      bySlug.get('cross-channel-sweep')!.steps.map((s) => s.expert),
    ).toEqual(['research', 'research', 'copy']);
    expect(bySlug.get('video-deep-dive')!.steps.map((s) => s.expert)).toEqual(
      ['research', 'research', 'copy'],
    );

    // The Audience Mosaic: three research steps (channels → panel →
    // reddit/youtube), the strategist's unified map, then the gated hook
    // bank into the planner.
    const mosaic = bySlug.get('audience-mosaic')!;
    expect(mosaic.steps.map((s) => s.expert)).toEqual([
      'research',
      'research',
      'research',
      'strategist',
      'copy',
    ]);
    expect(mosaic.steps[3].outputArtifact).toBe('ad-angles');
    expect(mosaic.steps[4].gate).toBe('approve');
    expect(mosaic.steps[4].handoff).toEqual({
      target: 'planner-cards',
      generate: false,
    });
    // LinkedIn and Facebook coverage is honestly search-cited (no scrape
    // lane exists): the sweep steps name the web_search passes.
    const sweepText = mosaic.steps
      .slice(0, 3)
      .map((s) => s.instruction)
      .join('\n');
    expect(sweepText).toContain('LinkedIn');
    expect(sweepText).toContain('Facebook');
    expect(sweepText).toContain('web_search');
  });

  it('normalizeRecipeSteps defends the handoff field', () => {
    const steps = normalizeRecipeSteps([
      {
        expert: 'copy',
        instruction: 'do',
        outputArtifact: 'notes',
        handoff: { target: 'email-kit', generate: true },
      },
      {
        expert: 'strategist',
        instruction: 'do',
        outputArtifact: 'offer-brief',
        handoff: { target: 'system', generate: false },
      },
      {
        expert: 'copy',
        instruction: 'do',
        outputArtifact: 'notes',
        handoff: { target: 'not-a-target', generate: true },
      },
      {
        expert: 'copy',
        instruction: 'do',
        outputArtifact: 'notes',
        handoff: 'junk',
      },
    ]);
    expect(steps[0].handoff).toEqual({ target: 'email-kit', generate: true });
    // 'system' (the Full System fan-out) is a valid recipe step handoff.
    expect(steps[1].handoff).toEqual({ target: 'system', generate: false });
    expect(steps[2].handoff).toBeUndefined();
    expect(steps[3].handoff).toBeUndefined();
  });
});

describe('rowToRecipe / rowToRecipeRun', () => {
  it('maps rows defensively', () => {
    const r = rowToRecipe({
      id: 'r1',
      slug: 'x',
      name: null,
      description: null,
      steps: [{ expert: 'research', instruction: 'i', outputArtifact: 'notes' }],
      budget_est_cents: null,
      status: 'weird',
      created_at: null,
      updated_at: null,
    });
    expect(r.budgetEstCents).toBe(150);
    expect(r.status).toBe('active');
    expect(r.steps).toHaveLength(1);

    const runRow = rowToRecipeRun({
      id: 'u1',
      recipe_id: 'r1',
      session_id: null,
      status: 'gated',
      current_step: 1,
      steps_state: [{ status: 'done', artifactId: 'a1', note: 'n', at: 't' }],
      est_cost_cents: 42,
      created_at: null,
      updated_at: null,
    });
    expect(runRow.status).toBe('gated');
    expect(runRow.sessionId).toBe('');
    expect(runRow.stepsState[0].artifactId).toBe('a1');
    expect(runRow.estCostCents).toBe(42);
  });

  it('initialStepsState starts every step pending', () => {
    const s = initialStepsState(3);
    expect(s).toHaveLength(3);
    expect(s.every((x) => x.status === 'pending' && x.artifactId === '')).toBe(
      true,
    );
  });
});

describe('runRecipe', () => {
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

  it('runs steps sequentially, chains envelopes, and stamps lineage', async () => {
    const brief = artifact('a1', 'research-brief', 'the research');
    const offer = artifact('a2', 'offer-brief');
    const deps = fakeDeps([offer, brief]);
    const events: string[] = [];
    const status = await runRecipe({
      recipe: twoSteps,
      run: run(),
      session,
      deps,
      emit: (e) => events.push(e.type),
    });
    expect(status).toBe('done');
    // Step 1 got the brief goal; step 2 got step 1's markdown.
    const turnCalls = (deps.runTurn as ReturnType<typeof vi.fn>).mock.calls;
    expect(turnCalls[0][0].userText).toContain('the next $17 offer');
    expect(turnCalls[1][0].userText).toContain('the research');
    // Lineage: the offer-brief's parent is the research-brief.
    expect(deps.stampParent).toHaveBeenCalledWith('a2', 'a1');
    // The run row was patched to done with both artifacts recorded.
    const updates = (deps.updateRun as ReturnType<typeof vi.fn>).mock.calls;
    const last = updates.at(-1)![1];
    expect(last.status).toBe('done');
    expect(last.stepsState[0].artifactId).toBe('a1');
    expect(last.stepsState[1].artifactId).toBe('a2');
    expect(events).toContain('done');
  });

  it('an approve gate pauses with the artifact reviewable, and resume continues', async () => {
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
        instruction: 'plan from:\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'content-plan',
        gate: 'auto',
      },
    ]);
    const offer = artifact('a1', 'offer-brief', 'the offer');
    const deps = fakeDeps([offer]);
    const status = await runRecipe({
      recipe: gated,
      run: run(),
      session,
      deps,
    });
    expect(status).toBe('gated');
    // Only ONE turn ran — the copy step never started.
    expect(deps.runTurn).toHaveBeenCalledTimes(1);
    const updates = (deps.updateRun as ReturnType<typeof vi.fn>).mock.calls;
    const gatedUpdate = updates.at(-1)![1];
    expect(gatedUpdate.status).toBe('gated');
    expect(gatedUpdate.stepsState[0].status).toBe('gated');
    expect(gatedUpdate.stepsState[0].note).toContain('review');

    // Resume: the copy step runs with the gated artifact as its envelope.
    const plan = artifact('a2', 'content-plan');
    const deps2 = fakeDeps([plan, offer]);
    const gatedRun = run([
      { status: 'gated', artifactId: 'a1', note: 'review', at: null },
      { status: 'pending', artifactId: '', note: '', at: null },
    ]);
    const status2 = await runRecipe({
      recipe: gated,
      run: gatedRun,
      session,
      startStep: 1,
      deps: deps2,
    });
    expect(status2).toBe('done');
    const turn2 = (deps2.runTurn as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(turn2.userText).toContain('the offer');
    expect(deps2.stampParent).toHaveBeenCalledWith('a2', 'a1');
  });

  it('fails the run when a step emits no artifact of the required type', async () => {
    const deps = fakeDeps([]); // nothing emitted
    const status = await runRecipe({
      recipe: twoSteps,
      run: run(),
      session,
      deps,
    });
    expect(status).toBe('failed');
    const updates = (deps.updateRun as ReturnType<typeof vi.fn>).mock.calls;
    const last = updates.at(-1)![1];
    expect(last.status).toBe('failed');
    expect(last.stepsState[0].note).toContain('no research-brief artifact');
  });

  it('stops the run when it spends past the recipe budget', async () => {
    const brief = artifact('a1', 'research-brief');
    const deps = fakeDeps([brief]);
    // 0 at the start of the run, 500 (way past the 150-cent budget) after
    // the first step — the delta is what the budget reads.
    (deps.readUsageCents as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(0)
      .mockResolvedValue(500);
    const status = await runRecipe({
      recipe: twoSteps,
      run: run(),
      session,
      deps,
    });
    expect(status).toBe('failed');
    // The second step never ran.
    expect(deps.runTurn).toHaveBeenCalledTimes(1);
    const updates = (deps.updateRun as ReturnType<typeof vi.fn>).mock.calls;
    const last = updates.at(-1)![1];
    expect(last.stepsState[0].note).toContain('budget');
  });

  it('falls back to the default expert when the slug resolves to nothing', async () => {
    const brief = artifact('a1', 'research-brief');
    const deps = fakeDeps([brief]);
    await runRecipe({
      recipe: recipe([twoSteps.steps[0]]),
      run: run(),
      session,
      deps,
    });
    const turn = (deps.runTurn as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(turn.expert).toBe(DEFAULT_RESEARCH_EXPERT);
  });

  it('an auto step fires its handoff on completion (3.3)', async () => {
    const withHandoff = recipe([
      {
        expert: 'leadmagnet',
        instruction: 'design. {input}',
        inputFrom: 'brief',
        outputArtifact: 'lead-magnet',
        gate: 'auto',
        handoff: { target: 'leadgen-kit', generate: true },
      },
    ]);
    const magnet = artifact('a1', 'lead-magnet');
    const deps = fakeDeps([magnet]);
    const status = await runRecipe({
      recipe: withHandoff,
      run: run(),
      session,
      deps,
    });
    expect(status).toBe('done');
    expect(deps.runHandoff).toHaveBeenCalledWith(
      expect.objectContaining({
        artifactId: 'a1',
        target: 'leadgen-kit',
        generate: true,
      }),
    );
    const updates = (deps.updateRun as ReturnType<typeof vi.fn>).mock.calls;
    const last = updates.at(-1)![1];
    expect(last.stepsState[0].note).toContain('leadgen-kit (built)');
  });

  it('a gated step fires its handoff on APPROVAL, never before (3.3)', async () => {
    const gated = recipe([
      {
        expert: 'strategist',
        instruction: 'decide. {input}',
        inputFrom: 'brief',
        outputArtifact: 'offer-brief',
        gate: 'approve',
        handoff: { target: 'sales-funnel', generate: false },
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
    // The handoff did NOT fire while the owner is still reviewing.
    expect(deps.runHandoff).not.toHaveBeenCalled();

    // Approval: the handoff fires BEFORE the next step's turn.
    const plan = artifact('a2', 'content-plan');
    const deps2 = fakeDeps([plan, offer]);
    const gatedRun = run([
      { status: 'gated', artifactId: 'a1', note: 'review', at: null },
      { status: 'pending', artifactId: '', note: '', at: null },
    ]);
    const status2 = await runRecipe({
      recipe: gated,
      run: gatedRun,
      session,
      startStep: 1,
      deps: deps2,
    });
    expect(status2).toBe('done');
    expect(deps2.runHandoff).toHaveBeenCalledWith(
      expect.objectContaining({
        artifactId: 'a1',
        target: 'sales-funnel',
        generate: false,
      }),
    );
    // And the gated step's state closed out as done with the handoff noted.
    const updates = (deps2.updateRun as ReturnType<typeof vi.fn>).mock.calls;
    const last = updates.at(-1)![1];
    expect(last.stepsState[0].status).toBe('done');
    expect(last.stepsState[0].note).toContain('sales-funnel (draft)');
  });

  it('a handoff failure fails the step honestly (3.3)', async () => {
    const withHandoff = recipe([
      {
        expert: 'leadmagnet',
        instruction: 'design. {input}',
        inputFrom: 'brief',
        outputArtifact: 'lead-magnet',
        gate: 'auto',
        handoff: { target: 'leadgen-kit', generate: true },
      },
    ]);
    const magnet = artifact('a1', 'lead-magnet');
    const deps = fakeDeps([magnet]);
    (deps.runHandoff as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('leadgen store down'),
    );
    const status = await runRecipe({
      recipe: withHandoff,
      run: run(),
      session,
      deps,
    });
    expect(status).toBe('failed');
    const updates = (deps.updateRun as ReturnType<typeof vi.fn>).mock.calls;
    const last = updates.at(-1)![1];
    expect(last.status).toBe('failed');
    expect(last.stepsState[0].note).toContain('handoff FAILED');
    expect(last.stepsState[0].note).toContain('leadgen store down');
  });
});
