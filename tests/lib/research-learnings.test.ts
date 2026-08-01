import { describe, it, expect } from 'vitest';

import {
  parseLearnings,
  learningsBlock,
  rowToLearning,
} from '@/lib/mothermode/research/learnings';
import { buildResearchSystemPrompt } from '@/lib/mothermode/research/agent/prompt';
import { blankIntake } from '@/lib/mothermode/research/intake';
import type { ResearchSession } from '@/lib/mothermode/research/types';

/**
 * Cross-session memory (roadmap 4.4), pinned: the distiller's output
 * parser, the prompt block, and the injection point in the system prompt.
 */

const session: ResearchSession = {
  id: 's1',
  title: 't',
  offerSlug: 'reset-kit',
  contextRefs: [],
  intake: blankIntake(),
  status: 'active',
  createdAt: null,
  updatedAt: null,
  updatedBy: null,
};

describe('parseLearnings', () => {
  it('strips markers, drops chatter, caps at 5', () => {
    const out = parseLearnings(
      `Learnings:\n1. "5pm chaos" repeats in 9 of 14 comments\n- the $17 price point converts better than $27\n* Fair Play reviews complain about "another system to maintain"\n4. @momofthree's reel format outperforms 3:1\n5. bedtime content wins on tiktok, not instagram\n6. a sixth line that should drop\n\nHere are the learnings above.`,
    );
    expect(out).toHaveLength(5);
    expect(out[0]).toBe('"5pm chaos" repeats in 9 of 14 comments');
    expect(out[2]).toBe(
      'Fair Play reviews complain about "another system to maintain"',
    );
  });

  it('drops short lines and headers, never crashes on junk', () => {
    expect(parseLearnings('')).toEqual([]);
    expect(parseLearnings('ok\nno\n')).toEqual([]);
    expect(parseLearnings('Summary of the session')).toEqual([]);
  });
});

describe('learningsBlock', () => {
  it('builds the memory block, or stays silent when empty', () => {
    expect(learningsBlock([])).toBe('');
    const block = learningsBlock(['"5pm chaos" repeats', 'the $17 point wins']);
    expect(block).toContain('CROSS-SESSION MEMORY');
    expect(block).toContain('- "5pm chaos" repeats');
    expect(block).toContain('- the $17 point wins');
  });
});

describe('the prompt injection (4.4)', () => {
  it('learnings ride the system prompt as CROSS-SESSION MEMORY', () => {
    const sys = buildResearchSystemPrompt({
      session,
      packs: [],
      learnings: ['"5pm chaos" repeats in 9 of 14 comments'],
    });
    expect(sys).toContain('CROSS-SESSION MEMORY');
    expect(sys).toContain('"5pm chaos" repeats in 9 of 14 comments');
  });

  it('no learnings = byte-identical to before (a fresh offer stays silent)', () => {
    const a = buildResearchSystemPrompt({ session, packs: [] });
    const b = buildResearchSystemPrompt({ session, packs: [], learnings: [] });
    expect(b).toBe(a);
    expect(a).not.toContain('CROSS-SESSION MEMORY');
  });
});

describe('rowToLearning', () => {
  it('maps a row and defends nulls', () => {
    const l = rowToLearning({
      id: 'l1',
      offer_slug: 'reset-kit',
      body: '  the $17 point wins  ',
      source_session_id: 's1',
      created_at: 'x',
    });
    expect(l.body).toBe('the $17 point wins');
    expect(l.offerSlug).toBe('reset-kit');
    expect(
      rowToLearning({
        id: 'l2',
        offer_slug: null,
        body: null,
        source_session_id: null,
        created_at: null,
      }),
    ).toEqual({
      id: 'l2',
      offerSlug: '',
      body: '',
      sourceSessionId: '',
      createdAt: null,
    });
  });
});
