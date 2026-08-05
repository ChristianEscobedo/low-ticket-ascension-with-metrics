import { describe, it, expect } from 'vitest';

import {
  slugifyExpertName,
  composeExpertPersona,
  buildExpertDraft,
  expertDraftErrors,
  interviewToolOptions,
  type ExpertInterviewAnswers,
} from '@/lib/mothermode/research/experts/interview';
import { buildResearchToolDefs } from '@/lib/mothermode/research/agent/toolDefs';
import { RESEARCH_ARTIFACT_TYPES } from '@/lib/mothermode/research/types';
import { TEXT_MODELS } from '@/lib/mothermode/content/models';

/**
 * "Build me an agent" (roadmap Phase 3), pinned: the interview composes
 * DETERMINISTICALLY (no AI), the slug follows house rules, the persona
 * carries the four answers, the draft maps whole, and the SHARED
 * validator catches every hole — so the builder's live error line and
 * the API's 400 can never disagree.
 */

const ANSWERS: ExpertInterviewAnswers = {
  name: 'Comment Reply Coach',
  does: 'answers audience comments in our voice',
  optimizesFor: 'turning skeptics into buyers',
  tools: ['social_search', 'post_comments'],
  artifactTypes: ['research-brief'],
  model: '',
};

describe('slugifyExpertName', () => {
  it('follows the house rules (lowercase, dashed, leading letter, ≤40)', () => {
    expect(slugifyExpertName('Comment Reply Coach')).toBe('comment-reply-coach');
    expect(slugifyExpertName('  Atlas  ')).toBe('atlas');
    expect(slugifyExpertName('The 24/7 Agent!!')).toBe('the-24-7-agent');
    expect(slugifyExpertName('123 Numbers First')).toBe('agent-123-numbers-first');
    expect(slugifyExpertName('')).toBe('');
    expect(slugifyExpertName('A'.repeat(60)).length).toBeLessThanOrEqual(40);
  });
});

describe('composeExpertPersona', () => {
  it('carries the four answers and the standing rules, deterministically', () => {
    const p = composeExpertPersona(ANSWERS);
    expect(p).toContain('You are Comment Reply Coach, a MotherMode expert agent.');
    expect(p).toContain('Your job: answers audience comments in our voice.');
    expect(p).toContain('You optimize for one thing: turning skeptics into buyers.');
    expect(p).toContain('quote numbers exactly');
    expect(p).toContain('create_artifact');
    // No trailing period duplication.
    expect(p).not.toContain('..');
    // Empty optional answers leave no orphan lines.
    const bare = composeExpertPersona({ ...ANSWERS, does: '', optimizesFor: '' });
    expect(bare).not.toContain('Your job:');
    expect(bare).not.toContain('You optimize for');
    expect(bare).toContain('You are Comment Reply Coach');
  });
});

describe('buildExpertDraft', () => {
  it('maps the answers whole, dedupes, and derives the slug', () => {
    const d = buildExpertDraft({
      ...ANSWERS,
      tools: ['social_search', 'social_search', 'post_comments'],
    });
    expect(d.slug).toBe('comment-reply-coach');
    expect(d.name).toBe('Comment Reply Coach');
    expect(d.tagline).toBe('answers audience comments in our voice');
    expect(d.tools).toEqual(['social_search', 'post_comments']);
    expect(d.artifactTypes).toEqual(['research-brief']);
    expect(d.persona).toBe(composeExpertPersona(ANSWERS));
  });
});

describe('expertDraftErrors (the shared validator)', () => {
  it('passes a good draft and catches every named hole', () => {
    expect(expertDraftErrors(buildExpertDraft(ANSWERS))).toEqual([]);

    expect(expertDraftErrors({})).toContain('Name is required.');
    expect(
      expertDraftErrors({ name: 'X', slug: 'x', persona: 'p' }).some((e) =>
        e.includes('2-40 chars'),
      ),
    ).toBe(true);
    expect(
      expertDraftErrors({ name: 'Research', slug: 'research', persona: 'p' }),
    ).toContain('Slug "research" is the built-in agent — pick another name.');
    expect(
      expertDraftErrors({ name: 'X', slug: 'x-coach', persona: '' }),
    ).toContain('Persona is required (compose one from the interview answers).');
    expect(
      expertDraftErrors({
        name: 'X',
        slug: 'x-coach',
        persona: 'p',
        model: 'not-a-model',
      })[0],
    ).toContain('not in the text-model catalog');
    expect(
      expertDraftErrors({
        name: 'X',
        slug: 'x-coach',
        persona: 'p',
        tools: ['not_a_tool'],
      })[0],
    ).toContain('Unknown tool "not_a_tool"');
    expect(
      expertDraftErrors({
        name: 'X',
        slug: 'x-coach',
        persona: 'p',
        artifactTypes: ['not-a-type'],
      })[0],
    ).toContain('Unknown artifact type "not-a-type"');
  });

  it('the registries are real: every tool option is a def minus create_artifact; every model + type is known', () => {
    const defs = buildResearchToolDefs({ deep: true }).map((d) => d.name);
    const options = interviewToolOptions();
    expect(options).not.toContain('create_artifact');
    expect(options.sort()).toEqual(
      defs.filter((n) => n !== 'create_artifact').sort(),
    );
    // The catalog + artifact types the validator honors are the real ones.
    expect(TEXT_MODELS.length).toBeGreaterThan(0);
    expect(RESEARCH_ARTIFACT_TYPES).toContain('research-brief');
    // A draft with the real options validates clean.
    const d = buildExpertDraft({
      ...ANSWERS,
      tools: [options[0]],
      artifactTypes: [RESEARCH_ARTIFACT_TYPES[0]],
      model: TEXT_MODELS[0].id,
    });
    expect(expertDraftErrors(d)).toEqual([]);
  });
});
