import { describe, it, expect } from 'vitest';

import {
  rowToResearchEvidence,
  toEvidenceKind,
  inferEvidenceKind,
} from '@/lib/mothermode/research/evidence';

/**
 * The evidence base boundary (roadmap 2.1), pinned: defensive mapping of
 * untyped rows and the kind inference the pin button relies on.
 */

describe('toEvidenceKind', () => {
  it('keeps real kinds, coerces junk to quote', () => {
    expect(toEvidenceKind('phrase')).toBe('phrase');
    expect(toEvidenceKind('metric')).toBe('metric');
    expect(toEvidenceKind('note')).toBe('note');
    expect(toEvidenceKind('banana')).toBe('quote');
    expect(toEvidenceKind(undefined)).toBe('quote');
  });
});

describe('rowToResearchEvidence', () => {
  it('maps a full row with provenance', () => {
    const e = rowToResearchEvidence({
      id: 'e1',
      session_id: 's1',
      artifact_id: 'a1',
      offer_slug: 'brain-dump',
      kind: 'quote',
      body: 'I am drowning in laundry',
      source_url: 'https://reddit.com/r/Parenting/x',
      source_tool: 'reddit_deep_dive',
      expert: 'research',
      created_by: 'owner',
      created_at: 'when',
    });
    expect(e.kind).toBe('quote');
    expect(e.sourceTool).toBe('reddit_deep_dive');
    expect(e.artifactId).toBe('a1');
    expect(e.offerSlug).toBe('brain-dump');
  });

  it('degrades nulls and junk kinds safely', () => {
    const e = rowToResearchEvidence({
      id: 'e2',
      session_id: 's1',
      artifact_id: null,
      offer_slug: null,
      kind: 'nonsense',
      body: null,
      source_url: null,
      source_tool: null,
      expert: null,
      created_by: null,
      created_at: null,
    });
    expect(e.kind).toBe('quote');
    expect(e.artifactId).toBe('');
    expect(e.createdBy).toBe('agent');
    expect(e.body).toBe('');
  });
});

describe('inferEvidenceKind', () => {
  it('short digit-carrying text reads as a metric', () => {
    expect(inferEvidenceKind('1,239 clicks · 312 opt-ins')).toBe('metric');
  });

  it('a 1-4 word snippet reads as a phrase', () => {
    expect(inferEvidenceKind('mental load')).toBe('phrase');
    expect(inferEvidenceKind('5pm witching hour')).toBe('phrase');
  });

  it('longer text reads as a quote', () => {
    expect(
      inferEvidenceKind('I just want one evening where nobody needs me'),
    ).toBe('quote');
  });

  it('empty text is a note, never a crash', () => {
    expect(inferEvidenceKind('   ')).toBe('note');
  });

  it('whitespace collapses before the judgment', () => {
    expect(inferEvidenceKind('mental\n\nload')).toBe('phrase');
  });
});
