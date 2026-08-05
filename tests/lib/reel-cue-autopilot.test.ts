import { describe, expect, it } from 'vitest';
import {
  RESEARCH_ARTIFACT_TYPES,
  handoffTargetsFor,
  normalizeHandedOffTo,
  normalizeReelCuePlan,
} from '@/lib/mothermode/research/types';
import {
  normalizeRecipeSteps,
  recipeDraftErrors,
} from '@/lib/mothermode/research/recipes/types';
import { RECIPE_SEEDS } from '@/lib/mothermode/research/recipes/seed';

describe('reel-cue-plan: the autopilot artifact payload', () => {
  it('keeps valid beats, drops junk, defaults the word from the prompt', () => {
    const plan = normalizeReelCuePlan({
      projectId: 'reel-1',
      beats: [
        { clipId: 'clip-a', wordIndex: 4, word: 'money', imagePrompt: 'a stack of cash on a desk' },
        { clipId: 'clip-a', wordIndex: 9, imagePrompt: 'a rocket lifting off' }, // no word → first prompt token
        { clipId: '', wordIndex: 1, imagePrompt: 'no clip id — dropped' },
        { clipId: 'clip-a', wordIndex: -2, imagePrompt: 'negative index — dropped' },
        { clipId: 'clip-a', wordIndex: 2 }, // no prompt — dropped
        'not-an-object',
      ],
    });
    expect(plan.projectId).toBe('reel-1');
    expect(plan.beats).toHaveLength(2);
    expect(plan.beats[0]).toMatchObject({ clipId: 'clip-a', wordIndex: 4, word: 'money' });
    expect(plan.beats[1].word).toBe('a');
  });

  it('caps at 12 beats and keeps an optional style hint verbatim', () => {
    const plan = normalizeReelCuePlan({
      projectId: 'reel-1',
      beats: Array.from({ length: 20 }, (_, i) => ({
        clipId: 'clip-a',
        wordIndex: i,
        word: `w${i}`,
        imagePrompt: `prompt ${i}`,
        ...(i === 0 ? { style: { widthPct: 48, xPct: 10 } } : {}),
      })),
    });
    expect(plan.beats).toHaveLength(12);
    expect(plan.beats[0].style).toEqual({ widthPct: 48, xPct: 10 });
  });

  it('a non-object payload normalizes to an empty plan (never throws)', () => {
    expect(normalizeReelCuePlan('junk')).toEqual({ projectId: '', beats: [] });
    expect(normalizeReelCuePlan(null)).toEqual({ projectId: '', beats: [] });
  });
});

describe('the reel-cues handoff target', () => {
  it('the artifact type is registered and maps to reel-cues', () => {
    expect(RESEARCH_ARTIFACT_TYPES).toContain('reel-cue-plan');
    expect(handoffTargetsFor('reel-cue-plan')).toEqual(['reel-cues']);
  });

  it('handed_off_to round-trips a reel-cues ref', () => {
    const ref = normalizeHandedOffTo({
      kind: 'reel-cues',
      id: 'reel-1',
      label: 'My reel — 6 cue(s) · 4 matched free · 2 generated',
      count: 6,
      at: '2026-08-05T00:00:00.000Z',
    });
    expect(ref).toMatchObject({ kind: 'reel-cues', id: 'reel-1', count: 6 });
    expect(normalizeHandedOffTo({ kind: 'reel-cue-plan' })).toBeNull(); // not a target
  });

  it('recipe steps keep the reel-cues handoff; the draft validator accepts it', () => {
    const steps = normalizeRecipeSteps([
      {
        expert: 'design',
        instruction: 'propose beats',
        outputArtifact: 'reel-cue-plan',
        gate: 'approve',
        handoff: { target: 'reel-cues', generate: true },
      },
    ]);
    expect(steps).toHaveLength(1);
    expect(steps[0].handoff).toEqual({ target: 'reel-cues', generate: true });

    const errors = recipeDraftErrors({
      name: 'Cue play',
      slug: 'cue-play',
      steps: [
        {
          expert: 'design',
          instruction: 'propose beats',
          outputArtifact: 'reel-cue-plan',
          gate: 'approve',
          handoff: { target: 'reel-cues', generate: true },
        },
      ],
    });
    expect(errors).toEqual([]);
  });
});

describe('the seeded Reel Cue Autopilot play', () => {
  it('is one gated step that hands off to reel-cues on approval', () => {
    const seed = RECIPE_SEEDS.find((s) => s.slug === 'reel-cue-autopilot');
    expect(seed).toBeDefined();
    expect(seed!.steps).toHaveLength(1);
    const step = seed!.steps[0];
    // The gate sits BEFORE the money: the owner approves/edits the beat list,
    // and only then does the handoff match (free) or generate (paid).
    expect(step.gate).toBe('approve');
    expect(step.outputArtifact).toBe('reel-cue-plan');
    expect(step.inputFrom).toBe('brief');
    expect(step.handoff).toEqual({ target: 'reel-cues', generate: true });
    // The instruction must name the exact export shape the bridge packages.
    expect(step.instruction).toContain('REEL_PROJECT_ID');
    expect(step.instruction).toContain('wordIndex');
    expect(step.instruction).toContain('clipId');
  });
});
