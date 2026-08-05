/**
 * Owner-authored plays (Phase 2: fork & edit): the shared draft validator
 * (the editor's live error line AND the API's 400 — they can never
 * disagree), the fork mapping (a NEW slug is what makes it a fork), and
 * the editor→API step payload (handoff only when set). Also the contract
 * the save relies on: steps that pass the validator survive
 * normalizeRecipeSteps intact — the save never silently drops a step.
 */
import { describe, expect, it } from 'vitest';
import {
  normalizeRecipeSteps,
  recipeDraftErrors,
  type Recipe,
} from '@/lib/mothermode/research/recipes/types';
import {
  blankRecipeDraft,
  draftStepsPayload,
  forkDraftFrom,
} from '@/app/admin/recipes/RecipeDraftEditor';

const HOUSE: Recipe = {
  id: 'r1',
  slug: 'niche-watch',
  name: 'Niche Watch',
  description: 'the weekly sweep',
  steps: [
    {
      expert: 'research',
      instruction: 'sweep {input}',
      inputFrom: 'brief',
      outputArtifact: 'research-brief',
      gate: 'auto',
    },
    {
      expert: 'nova',
      instruction: 'plan from {input}',
      inputFrom: 'previous',
      outputArtifact: 'content-plan',
      gate: 'approve',
      handoff: { target: 'planner-cards', generate: true },
    },
  ],
  budgetEstCents: 60,
  status: 'active',
  createdAt: null,
  updatedAt: null,
};

describe('recipeDraftErrors', () => {
  it('a clean draft passes; each hole is named', () => {
    expect(
      recipeDraftErrors({
        name: 'My play',
        slug: 'my-play',
        steps: [
          { expert: 'atlas', instruction: 'do {input}', outputArtifact: 'notes' },
        ],
      }),
    ).toEqual([]);

    const errors = recipeDraftErrors({
      name: '',
      slug: 'Bad Slug!',
      steps: [
        { expert: '', instruction: '', outputArtifact: '' },
        'garbage',
        {
          expert: 'atlas',
          instruction: 'x',
          outputArtifact: 'notes',
          gate: 'maybe',
          handoff: { target: 'the-moon' },
        },
      ],
    });
    expect(errors).toContain('a name');
    expect(errors.some((e) => e.startsWith('a slug'))).toBe(true);
    expect(errors).toContain('step 1 needs an expert');
    expect(errors).toContain('step 1 needs an instruction');
    expect(errors).toContain('step 1 needs an output artifact');
    expect(errors).toContain('step 2 is malformed');
    expect(errors).toContain("step 3's gate is unknown");
    expect(errors).toContain("step 3's handoff target is unknown");
  });

  it('no steps is its own problem', () => {
    expect(
      recipeDraftErrors({ name: 'x', slug: 'ok-slug', steps: [] }),
    ).toEqual(['at least one step']);
    expect(
      recipeDraftErrors({ name: 'x', slug: 'ok-slug', steps: 'nope' }),
    ).toEqual(['at least one step']);
  });

  it('THE SAVE CONTRACT: a passing draft survives normalizeRecipeSteps intact', () => {
    const steps = [
      { expert: 'atlas', instruction: 'sweep {input}', outputArtifact: 'notes' },
      {
        expert: 'nova',
        instruction: 'plan {input}',
        outputArtifact: 'content-plan',
        gate: 'approve',
        handoff: { target: 'planner-cards', generate: true },
      },
    ];
    expect(
      recipeDraftErrors({ name: 'x', slug: 'ok', steps }),
    ).toEqual([]);
    const normalized = normalizeRecipeSteps(steps);
    expect(normalized).toHaveLength(2); // nothing silently dropped
    expect(normalized[1].gate).toBe('approve');
    expect(normalized[1].handoff).toEqual({
      target: 'planner-cards',
      generate: true,
    });
  });
});

describe('the fork mapping', () => {
  it('forks with a NEW slug (never overwrites the house play)', () => {
    const draft = forkDraftFrom(HOUSE);
    expect(draft.slug).toBe('niche-watch-mine');
    expect(draft.name).toBe('Niche Watch (mine)');
    expect(draft.budgetEstCents).toBe(60);
    expect(draft.steps).toHaveLength(2);
    expect(draft.steps[1].gate).toBe('approve');
    expect(draft.steps[1].handoffTarget).toBe('planner-cards');
    expect(draft.steps[1].handoffGenerate).toBe(true);
  });

  it('the blank draft starts invalid (expert + instruction needed) and named correctly once filled', () => {
    const blank = blankRecipeDraft();
    const errors = recipeDraftErrors({
      name: blank.name,
      slug: blank.slug,
      steps: draftStepsPayload(blank),
    });
    expect(errors).toContain('a name');
    expect(errors.some((e) => e.includes('needs an expert'))).toBe(true);
  });

  it('draftStepsPayload: handoff only when a target is set', () => {
    const draft = forkDraftFrom(HOUSE);
    const payload = draftStepsPayload(draft);
    expect(payload[0].handoff).toBeNull();
    expect(payload[1].handoff).toEqual({
      target: 'planner-cards',
      generate: true,
    });
    // …and the payload passes BOTH gates the save cares about.
    expect(
      recipeDraftErrors({
        name: draft.name,
        slug: draft.slug,
        steps: payload,
      }),
    ).toEqual([]);
    expect(normalizeRecipeSteps(payload)).toHaveLength(2);
  });
});
