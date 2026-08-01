import { describe, it, expect } from 'vitest';

import { outcomeDigestInstruction } from '@/lib/mothermode/research/outcome';
import { blankIntake } from '@/lib/mothermode/research/intake';
import type { ResearchSession } from '@/lib/mothermode/research/types';

/**
 * Post-publish learning (roadmap 4.6), pinned: the analyst instruction
 * names the scope honestly and carries the standing rules (exact quotes,
 * paid/organic split, thin data said out loud).
 */

function session(offerSlug: string): ResearchSession {
  return {
    id: 's1',
    title: 't',
    offerSlug,
    contextRefs: [],
    intake: blankIntake(),
    status: 'active',
    createdAt: null,
    updatedAt: null,
    updatedBy: null,
  };
}

describe('outcomeDigestInstruction', () => {
  it('a scoped session names its offer for the metrics filter', () => {
    const text = outcomeDigestInstruction(session('reset-kit'));
    expect(text).toContain('the offer "reset-kit"');
    expect(text).toContain('filter internal_metrics to it');
  });

  it('an unscoped session reads the whole account, never invents a scope', () => {
    const text = outcomeDigestInstruction(session(''));
    expect(text).toContain('the whole account');
    expect(text).not.toContain('the offer ""');
  });

  it('the standing rules ride every instruction', () => {
    const text = outcomeDigestInstruction(session('reset-kit'));
    expect(text).toContain('quote the numbers exactly');
    expect(text).toContain('paid/organic split');
    expect(text).toContain('never summed with Stripe totals');
    expect(text).toContain('SAY they are thin');
    expect(text).toContain('research-brief');
  });
});
