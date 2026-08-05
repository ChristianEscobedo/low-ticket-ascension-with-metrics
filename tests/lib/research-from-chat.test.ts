import { describe, it, expect } from 'vitest';

import { buildPlayDraft } from '@/lib/mothermode/research/recipes/fromChat';
import { normalizeRecipeSteps } from '@/lib/mothermode/research/recipes/types';
import type { ResearchArtifact } from '@/lib/mothermode/research/types';

/**
 * "Turn this chat into a play" (Phase 3), pinned: the distilled draft
 * replays the chat's own arc — artifacts in creation order, the expert
 * that made each one (or the house type fallback), the same handoffs with
 * the seeds' generate/gate rules, a deterministic per-session slug, and a
 * budget that mirrors the house plays. And the output is always a draft
 * the save path accepts whole (no silently dropped steps).
 */

const SESSION = { id: 'abcd1234-5678-90ab-cdef-abcdefabcdef', title: 'The Offload Map research' };

function artifact(
  type: string,
  over: Partial<
    Pick<ResearchArtifact, 'createdBy' | 'handedOffTo' | 'createdAt'>
  > = {},
): Pick<ResearchArtifact, 'type' | 'createdBy' | 'handedOffTo' | 'createdAt'> {
  return {
    type: type as ResearchArtifact['type'],
    createdBy: 'agent',
    handedOffTo: null,
    createdAt: null,
    ...over,
  };
}

describe('buildPlayDraft', () => {
  it('returns null when the chat has nothing to replay', () => {
    expect(buildPlayDraft({ session: SESSION, artifacts: [] })).toBeNull();
  });

  it('chains artifacts in creation order: first reads the brief, the rest the previous', () => {
    const draft = buildPlayDraft({
      session: SESSION,
      artifacts: [
        artifact('content-plan', { createdAt: '2026-07-30T12:00:00Z' }),
        artifact('research-brief', { createdAt: '2026-07-29T12:00:00Z' }),
        artifact('offer-brief', { createdAt: '2026-07-30T06:00:00Z' }),
      ],
    });
    expect(draft).not.toBeNull();
    expect(draft!.steps.map((s) => s.outputArtifact)).toEqual([
      'research-brief',
      'offer-brief',
      'content-plan',
    ]);
    expect(draft!.steps[0].inputFrom).toBe('brief');
    expect(draft!.steps.slice(1).every((s) => s.inputFrom === 'previous')).toBe(
      true,
    );
  });

  it('resolves experts: createdBy wins when real, else the house type map', () => {
    const draft = buildPlayDraft({
      session: SESSION,
      artifacts: [
        artifact('research-brief'), // agent -> research
        artifact('offer-brief'), // agent -> strategist
        artifact('notes', { createdBy: 'design' }), // a real expert wins
        artifact('notes', { createdBy: 'owner' }), // owner -> type map (copy)
      ],
    });
    expect(draft!.steps.map((s) => s.expert)).toEqual([
      'research',
      'strategist',
      'design',
      'copy',
    ]);
  });

  it('replays handoffs with the seeds’ generate + gate rules', () => {
    const draft = buildPlayDraft({
      session: SESSION,
      artifacts: [
        artifact('offer-brief', {
          handedOffTo: { kind: 'system', id: '', label: 'Full system', at: '' },
        }),
        artifact('lead-magnet', {
          handedOffTo: { kind: 'leadgen-kit', id: 'k1', label: 'Kit', at: '' },
        }),
        artifact('content-plan', {
          handedOffTo: { kind: 'planner-cards', id: '', label: '9 cards', at: '' },
        }),
        artifact('offer-brief', {
          handedOffTo: { kind: 'sales-funnel', id: 'f1', label: 'Funnel', at: '' },
        }),
      ],
    });
    const [system, kit, cards, funnel] = draft!.steps;
    // money surfaces gate
    expect(system.gate).toBe('approve');
    expect(funnel.gate).toBe('approve');
    expect(kit.gate).toBe('auto');
    expect(cards.gate).toBe('auto');
    // generate mirrors the seeds: kits build, everything else drafts
    expect(system.handoff).toEqual({ target: 'system', generate: false });
    expect(kit.handoff).toEqual({ target: 'leadgen-kit', generate: true });
    expect(cards.handoff).toEqual({ target: 'planner-cards', generate: false });
    expect(funnel.handoff).toEqual({ target: 'sales-funnel', generate: false });
  });

  it('mints a deterministic per-session slug (re-distilling updates, not forks)', () => {
    const a = buildPlayDraft({
      session: SESSION,
      artifacts: [artifact('research-brief')],
    });
    const b = buildPlayDraft({
      session: SESSION,
      artifacts: [artifact('research-brief'), artifact('ad-angles')],
    });
    expect(a!.slug).toBe('play-abcd1234');
    expect(b!.slug).toBe('play-abcd1234');
    expect(a!.slug).toMatch(/^[a-z0-9][a-z0-9-]{1,59}$/);
  });

  it('carries the session title as the name and a step-count-scaled budget', () => {
    const one = buildPlayDraft({
      session: SESSION,
      artifacts: [artifact('research-brief')],
    });
    const six = buildPlayDraft({
      session: SESSION,
      artifacts: Array.from({ length: 6 }, () => artifact('notes')),
    });
    const ten = buildPlayDraft({
      session: SESSION,
      artifacts: Array.from({ length: 10 }, () => artifact('notes')),
    });
    expect(one!.name).toBe('The Offload Map research');
    expect(one!.budgetEstCents).toBe(125);
    expect(six!.budgetEstCents).toBe(450); // capped at the mega-recipe's cap
    expect(ten!.budgetEstCents).toBe(450);
    expect(one!.description).toContain('The Offload Map research');
  });

  it('writes house-voice instructions with {input} where the seeds put it', () => {
    const draft = buildPlayDraft({
      session: SESSION,
      artifacts: [artifact('research-brief'), artifact('offer-brief')],
    });
    expect(draft!.steps[0].instruction).toContain('Brief goal: {input}');
    expect(draft!.steps[1].instruction).toContain('{input}');
    expect(draft!.steps[1].instruction).not.toContain('Brief goal');
  });

  it('rows without timestamps keep store order at the end', () => {
    const draft = buildPlayDraft({
      session: SESSION,
      artifacts: [
        artifact('notes'),
        artifact('research-brief', { createdAt: '2026-07-29T12:00:00Z' }),
      ],
    });
    expect(draft!.steps.map((s) => s.outputArtifact)).toEqual([
      'research-brief',
      'notes',
    ]);
  });

  it('the distilled draft survives the save path whole (no dropped steps)', () => {
    const draft = buildPlayDraft({
      session: SESSION,
      artifacts: [
        artifact('research-brief'),
        artifact('offer-brief', {
          handedOffTo: { kind: 'system', id: '', label: 'sys', at: '' },
        }),
        artifact('email-outline', {
          handedOffTo: { kind: 'email-kit', id: 'k', label: 'kit', at: '' },
        }),
      ],
    });
    const normalized = normalizeRecipeSteps(draft!.steps);
    expect(normalized).toHaveLength(3);
    expect(normalized.map((s) => s.outputArtifact)).toEqual([
      'research-brief',
      'offer-brief',
      'email-outline',
    ]);
    expect(normalized[1].gate).toBe('approve');
    expect(normalized[1].handoff).toEqual({ target: 'system', generate: false });
    expect(normalized[2].handoff).toEqual({
      target: 'email-kit',
      generate: true,
    });
  });
});
