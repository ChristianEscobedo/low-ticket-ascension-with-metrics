/**
 * The model cascade (research/agent/modelCascade.ts + its interpreter
 * wiring): which model runs a step, decided by the step's shape and the
 * expert's scorecard. Pins the routing table, the escalation rule (up
 * only, never down), the expert-config-wins rule, and the run.ts
 * application (override into runTurn + the reason in the step note).
 */
import { describe, expect, it } from 'vitest';
import {
  CASCADE_TIER_MODELS,
  ESCALATION_FAILURE_RATE,
  ESCALATION_MIN_SETTLED,
  resolveStepModel,
  tierForArtifact,
  tierOfModel,
} from '@/lib/mothermode/research/agent/modelCascade';
import { TEXT_MODELS } from '@/lib/mothermode/content/models';
import { runRecipe, type RecipeDeps } from '@/lib/mothermode/research/recipes/run';
import {
  initialStepsState,
  type Recipe,
  type RecipeRun,
} from '@/lib/mothermode/research/recipes/types';
import { DEFAULT_RESEARCH_EXPERT } from '@/lib/mothermode/research/experts/types';
import type {
  ResearchArtifact,
  ResearchSession,
} from '@/lib/mothermode/research/types';
import { blankIntake } from '@/lib/mothermode/research/intake';

const FLAGSHIP = TEXT_MODELS[0].id;

function card(failureRate: number | null, done: number, failed: number) {
  return { failureRate, done, failed };
}

describe('tierForArtifact / tierOfModel', () => {
  it('sweeps run cheap, structure standard, money artifacts premium', () => {
    expect(tierForArtifact('research-brief').tier).toBe('cheap');
    expect(tierForArtifact('notes').tier).toBe('cheap');
    expect(tierForArtifact('content-plan').tier).toBe('standard');
    expect(tierForArtifact('lead-magnet').tier).toBe('standard');
    expect(tierForArtifact('offer-brief').tier).toBe('premium');
    expect(tierForArtifact('ad-angles').tier).toBe('premium');
    expect(tierForArtifact('email-outline').tier).toBe('premium');
  });

  it('unknown types land on standard — never cheap by accident', () => {
    expect(tierForArtifact('some-future-type').tier).toBe('standard');
    expect(tierForArtifact('').tier).toBe('standard');
  });

  it('the tier table points at the catalog (cheap = kimi, premium = flagship)', () => {
    expect(CASCADE_TIER_MODELS.cheap).toBe('kimi-k3');
    expect(CASCADE_TIER_MODELS.premium).toBe(FLAGSHIP);
    expect(CASCADE_TIER_MODELS.standard).toBe(''); // the owner's default
    expect(tierOfModel('kimi-k3')).toBe('cheap');
    expect(tierOfModel(FLAGSHIP)).toBe('premium');
    expect(tierOfModel('')).toBe('standard');
  });
});

describe('resolveStepModel', () => {
  it('an expert with a configured model keeps it — even a failing one', () => {
    const d = resolveStepModel({
      expertModel: 'gpt-5.5',
      outputArtifact: 'research-brief',
      scorecard: card(0.9, 1, 9),
    });
    expect(d.model).toBe('gpt-5.5');
    expect(d.reason).toBe('expert config');
    expect(d.escalated).toBe(false);
  });

  it('routes sweeps to the budget model and money artifacts to the flagship', () => {
    expect(
      resolveStepModel({ expertModel: '', outputArtifact: 'research-brief' }).model,
    ).toBe('kimi-k3');
    const premium = resolveStepModel({ expertModel: '', outputArtifact: 'offer-brief' });
    expect(premium.model).toBe(FLAGSHIP);
    expect(premium.reason).toBe('premium tier (strategy)');
  });

  it('standard steps stay on the owner’s default (model is empty)', () => {
    const d = resolveStepModel({ expertModel: '', outputArtifact: 'content-plan' });
    expect(d.model).toBe('');
    expect(d.tier).toBe('standard');
  });

  it('escalates UP one tier when the scorecard shows a failing pattern', () => {
    const settled = ESCALATION_MIN_SETTLED + 1; // 4
    const d = resolveStepModel({
      expertModel: '',
      outputArtifact: 'research-brief', // cheap → standard on escalation
      scorecard: card(0.5, 2, 2),
    });
    expect(d.tier).toBe('standard');
    expect(d.escalated).toBe(true);
    expect(d.reason).toContain('escalated: 50% of 4 settled steps failed');
  });

  it('…standard escalates to premium, and premium caps at premium', () => {
    const failing = card(ESCALATION_FAILURE_RATE, 1, 2); // exactly 40% of 3
    expect(
      resolveStepModel({ expertModel: '', outputArtifact: 'content-plan', scorecard: failing })
        .model,
    ).toBe(FLAGSHIP);
    expect(
      resolveStepModel({ expertModel: '', outputArtifact: 'offer-brief', scorecard: failing })
        .tier,
    ).toBe('premium');
  });

  it('never escalates on thin or clean history — and never downgrades', () => {
    // 2 settled < the floor of 3: no pattern yet.
    expect(
      resolveStepModel({ expertModel: '', outputArtifact: 'offer-brief', scorecard: card(1, 0, 2) })
        .escalated,
    ).toBe(false);
    // 1 of 3 settled: under the 40% floor.
    expect(
      resolveStepModel({ expertModel: '', outputArtifact: 'offer-brief', scorecard: card(1 / 3, 2, 1) })
        .escalated,
    ).toBe(false);
    // Nothing settled: the rate is null, the tier is the artifact's.
    expect(
      resolveStepModel({ expertModel: '', outputArtifact: 'offer-brief', scorecard: card(null, 0, 0) })
        .escalated,
    ).toBe(false);
    // A GREAT scorecard never buys a downgrade.
    expect(
      resolveStepModel({ expertModel: '', outputArtifact: 'offer-brief', scorecard: card(0, 12, 0) })
        .tier,
    ).toBe('premium');
  });
});

/* ------------------------------------------------------------------ *
 * The interpreter wiring
 * ------------------------------------------------------------------ */

const SESSION: ResearchSession = {
  id: 'sess-1',
  title: 't',
  offerSlug: '',
  contextRefs: [],
  intake: blankIntake(),
  status: 'active',
  createdAt: null,
  updatedAt: null,
  updatedBy: null,
};

const NOTES_ARTIFACT: ResearchArtifact = {
  id: 'art-1',
  sessionId: SESSION.id,
  type: 'notes',
  title: 'Sweep notes',
  markdown: 'notes',
  structured: {},
  status: 'final',
  handedOffTo: null,
  version: 1,
  parentId: '',
  createdBy: 'agent',
  createdAt: null,
  updatedAt: null,
};

const RECIPE: Recipe = {
  id: 'r1',
  slug: 'r1',
  name: 'Sweep',
  description: '',
  steps: [
    {
      expert: 'atlas',
      instruction: 'sweep {input}',
      inputFrom: 'brief',
      outputArtifact: 'notes',
      gate: 'auto',
    },
  ],
  budgetEstCents: 150,
  status: 'active',
  createdAt: null,
  updatedAt: null,
};

function freshRun(): RecipeRun {
  return {
    id: 'run-1',
    recipeId: RECIPE.id,
    sessionId: SESSION.id,
    status: 'running',
    currentStep: 0,
    stepsState: initialStepsState(1),
    estCostCents: 0,
    createdAt: null,
    updatedAt: null,
  };
}

const AUTO_EXPERT = { ...DEFAULT_RESEARCH_EXPERT, slug: 'atlas', model: '' };

function harness(overrides: Partial<RecipeDeps>): {
  deps: RecipeDeps;
  seen: { models: string[]; notes: string[] };
} {
  const seen = { models: [] as string[], notes: [] as string[] };
  const deps: RecipeDeps = {
    getExpert: async () => AUTO_EXPERT,
    runTurn: async (input) => {
      seen.models.push(input.expert.model ?? '');
    },
    listArtifacts: async () => [NOTES_ARTIFACT],
    stampParent: async () => {},
    readUsageCents: async () => 0,
    runHandoff: async () => '', // this recipe hands nothing off
    updateRun: async (_id, patch) => {
      if (patch.stepsState?.[0]?.note) seen.notes.push(patch.stepsState[0].note);
    },
    ...overrides,
  };
  return { deps, seen };
}

describe('the cascade in the interpreter', () => {
  it('overrides an Auto expert’s model and says why in the step note', async () => {
    const { deps, seen } = harness({
      cascadeModel: async () => ({ model: 'kimi-k3', reason: 'cheap tier (sweep)' }),
    });
    const status = await runRecipe({
      recipe: RECIPE,
      run: freshRun(),
      session: SESSION,
      deps,
    });
    expect(status).toBe('done');
    expect(seen.models).toEqual(['kimi-k3']);
    expect(seen.notes.some((n) => n.includes('kimi-k3 (cheap tier (sweep))'))).toBe(true);
  });

  it('an inert decision (model unchanged) earns no override and no suffix', async () => {
    const { deps, seen } = harness({
      cascadeModel: async () => ({ model: '', reason: 'standard tier (structure)' }),
    });
    await runRecipe({ recipe: RECIPE, run: freshRun(), session: SESSION, deps });
    expect(seen.models).toEqual(['']);
    expect(seen.notes.every((n) => !n.includes('standard tier'))).toBe(true);
  });

  it('no cascade dep = the expert runs as-is (the tests’ default lane)', async () => {
    const { deps, seen } = harness({});
    await runRecipe({ recipe: RECIPE, run: freshRun(), session: SESSION, deps });
    expect(seen.models).toEqual(['']);
    expect(seen.notes[0]).toBe('step 1: atlas → notes');
  });

  it('a cascade failure never blocks the step', async () => {
    const { deps, seen } = harness({
      cascadeModel: async () => {
        throw new Error('scorecards read exploded');
      },
    });
    const status = await runRecipe({
      recipe: RECIPE,
      run: freshRun(),
      session: SESSION,
      deps,
    });
    expect(status).toBe('done');
    expect(seen.models).toEqual(['']);
  });
});
