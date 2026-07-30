import { describe, it, expect } from 'vitest';

import {
  rowToResearchSession,
  rowToResearchMessage,
  rowToResearchArtifact,
  sessionTitleFrom,
  normalizeToolCalls,
  normalizeHandedOffTo,
  normalizeContentPlanItems,
  normalizeLeadMagnetConcept,
  normalizeEmailOutline,
  normalizeOfferBrief,
  handoffTargetsFor,
  isResearchArtifactType,
} from '@/lib/mothermode/research/types';
import {
  buildCacheKey,
  cacheFresh,
} from '@/lib/mothermode/research/cache';

/**
 * The Research Lab mappers are the boundary between untyped JSONB and the
 * agent/handoff code. The coverage is weighted toward malformed stored data,
 * because a handoff button that throws on a weird artifact is a handoff
 * button nobody trusts.
 */

describe('sessionTitleFrom', () => {
  it('keeps short text intact', () => {
    expect(sessionTitleFrom('  research mom burnout  ')).toBe(
      'research mom burnout',
    );
  });

  it('collapses whitespace and truncates long text', () => {
    const long = 'a'.repeat(100);
    expect(sessionTitleFrom(long)).toHaveLength(64);
    expect(sessionTitleFrom(long).endsWith('...')).toBe(true);
    expect(sessionTitleFrom('line1\n\nline2')).toBe('line1 line2');
  });

  it('falls back for empty text', () => {
    expect(sessionTitleFrom('   ')).toBe('New research');
  });
});

describe('rowToResearchSession', () => {
  it('normalizes a full row', () => {
    const s = rowToResearchSession({
      id: 's1',
      title: null,
      offer_slug: 'brain-dump',
      context_refs: [{ kind: 'offer', id: 'brain-dump' }],
      status: 'archived',
      created_at: 'a',
      updated_at: 'b',
      updated_by: 'x@y.z',
    });
    expect(s.title).toBe('New research');
    expect(s.status).toBe('archived');
    expect(s.contextRefs).toHaveLength(1);
    expect(s.offerSlug).toBe('brain-dump');
  });

  it('drops malformed context refs and unknown statuses', () => {
    const s = rowToResearchSession({
      id: 's1',
      title: 't',
      offer_slug: null,
      context_refs: [{ kind: 'nonsense', id: 'x' }, 'junk', { kind: 'text', value: 'note' }],
      status: 'weird',
      created_at: null,
      updated_at: null,
      updated_by: null,
    });
    expect(s.status).toBe('active');
    expect(s.contextRefs).toHaveLength(1);
    expect(s.contextRefs[0].kind).toBe('text');
  });
});

describe('normalizeToolCalls', () => {
  it('keeps valid calls, coerces status, drops junk', () => {
    const calls = normalizeToolCalls([
      { name: 'web_search', inputSummary: '"q"', status: 'ok', resultSummary: 'done', ms: 120 },
      { name: 'social_search', status: 'error' },
      { status: 'ok' },
      'nope',
      null,
    ]);
    expect(calls).toHaveLength(2);
    expect(calls[0].name).toBe('web_search');
    expect(calls[0].ms).toBe(120);
    expect(calls[1].status).toBe('error');
    expect(calls[1].id).toBe('call_2');
  });

  it('returns [] for non-arrays', () => {
    expect(normalizeToolCalls(null)).toEqual([]);
    expect(normalizeToolCalls({})).toEqual([]);
  });
});

describe('rowToResearchMessage', () => {
  it('maps assistant rows with the trace', () => {
    const m = rowToResearchMessage({
      id: 'm1',
      session_id: 's1',
      role: 'assistant',
      content: 'answer',
      tool_calls: [{ name: 'internal_metrics' }],
      model: 'claude-opus-4-8',
      created_at: 't',
    });
    expect(m.role).toBe('assistant');
    expect(m.toolCalls).toHaveLength(1);
    expect(m.model).toBe('claude-opus-4-8');
  });

  it('treats unknown roles as user', () => {
    const m = rowToResearchMessage({
      id: 'm2',
      session_id: 's1',
      role: 'system',
      content: 'x',
      tool_calls: undefined,
      model: null,
      created_at: null,
    });
    expect(m.role).toBe('user');
    expect(m.toolCalls).toEqual([]);
  });
});

describe('rowToResearchArtifact', () => {
  it('falls back to research-brief for unknown types and draft for unknown statuses', () => {
    const a = rowToResearchArtifact({
      id: 'a1',
      session_id: 's1',
      type: 'banana',
      title: 't',
      markdown: 'm',
      structured: 'not-an-object',
      status: 'gone',
      handed_off_to: 'junk',
      created_at: null,
      updated_at: null,
    });
    expect(a.type).toBe('research-brief');
    expect(a.status).toBe('draft');
    expect(a.structured).toEqual({});
    expect(a.handedOffTo).toBeNull();
  });

  it('accepts every declared artifact type', () => {
    for (const t of [
      'research-brief',
      'offer-brief',
      'content-plan',
      'lead-magnet',
      'ad-angles',
      'email-outline',
      'notes',
    ]) {
      expect(isResearchArtifactType(t)).toBe(true);
    }
    expect(isResearchArtifactType('report')).toBe(false);
  });
});

describe('normalizeHandedOffTo', () => {
  it('keeps a valid ref', () => {
    const ref = normalizeHandedOffTo({
      kind: 'planner-cards',
      id: '',
      label: '12 planner cards',
      count: 12,
      at: 'now',
    });
    expect(ref?.kind).toBe('planner-cards');
    expect(ref?.count).toBe(12);
  });

  it('keeps a system ref (the Full System builder)', () => {
    const ref = normalizeHandedOffTo({
      kind: 'system',
      id: '',
      label: 'Full system: 5 parts',
      count: 5,
      at: 'now',
    });
    expect(ref?.kind).toBe('system');
    expect(ref?.count).toBe(5);
  });

  it('rejects unknown kinds', () => {
    expect(normalizeHandedOffTo({ kind: 'cms', id: '1' })).toBeNull();
    expect(normalizeHandedOffTo([])).toBeNull();
    expect(normalizeHandedOffTo(null)).toBeNull();
  });
});

describe('normalizeContentPlanItems', () => {
  it('normalizes, defaults, and drops empty items', () => {
    const items = normalizeContentPlanItems([
      { title: 'Post A', hook: 'hook a', platform: 'TIKTOK'.toLowerCase(), kind: 'paid' },
      { hook: 'hook only' },
      { title: '' },
      { title: 'Post B', kind: 'weird' },
    ]);
    expect(items).toHaveLength(3);
    expect(items[0].kind).toBe('paid');
    expect(items[1].title).toBe('hook only');
    expect(items[2].kind).toBe('organic');
    expect(items[2].platform).toBe('instagram');
  });

  it('returns [] for non-arrays', () => {
    expect(normalizeContentPlanItems(undefined)).toEqual([]);
    expect(normalizeContentPlanItems({ items: [] })).toEqual([]);
  });
});

describe('concept normalizers', () => {
  it('lead magnet: fills defaults, filters outline', () => {
    const c = normalizeLeadMagnetConcept({
      title: 'The 5-Minute Reset',
      format: 'checklist',
      outline: ['one', '', 3, 'two'],
      promise: 'Calm evenings',
    });
    expect(c.format).toBe('checklist');
    expect(c.outline).toEqual(['one', 'two']);
    expect(normalizeLeadMagnetConcept(undefined).format).toBe('guide');
  });

  it('email outline: keeps titled emails only', () => {
    const o = normalizeEmailOutline({
      goal: 'sell the reset kit',
      emails: [{ title: 'E1', idea: 'job' }, { title: '' }, 'junk'],
    });
    expect(o.emails).toHaveLength(1);
    expect(o.emails[0].idea).toBe('job');
  });

  it('offer brief: coerces price, filters angles', () => {
    const b = normalizeOfferBrief({
      name: 'Reset Kit',
      priceCents: 1700.4,
      angles: ['a', '', 'b'],
    });
    expect(b.priceCents).toBe(1700);
    expect(b.angles).toEqual(['a', 'b']);
    expect(normalizeOfferBrief('junk').priceCents).toBe(0);
  });
});

describe('handoffTargetsFor', () => {
  it('maps each artifact type to its target', () => {
    expect(handoffTargetsFor('content-plan')).toEqual(['planner-cards']);
    expect(handoffTargetsFor('ad-angles')).toEqual(['planner-cards']);
    expect(handoffTargetsFor('lead-magnet')).toEqual(['leadgen-kit']);
    expect(handoffTargetsFor('email-outline')).toEqual(['email-kit']);
    expect(handoffTargetsFor('offer-brief')).toEqual(['sales-funnel', 'system']);
    expect(handoffTargetsFor('research-brief')).toEqual([]);
    expect(handoffTargetsFor('notes')).toEqual([]);
  });
});

describe('buildCacheKey', () => {
  it('is deterministic regardless of arg order', () => {
    const a = buildCacheKey('monid:social', { platform: 'x', query: 'mom burnout', limit: 12 });
    const b = buildCacheKey('monid:social', { limit: 12, query: 'mom burnout', platform: 'x' });
    expect(a).toBe(b);
  });

  it('collapses case and whitespace in string values', () => {
    const a = buildCacheKey('amazon:reviews', { asin: '', query: 'Mom   Burnout', maxReviews: 14 });
    const b = buildCacheKey('amazon:reviews', { asin: '', query: 'mom burnout', maxReviews: 14 });
    expect(a).toBe(b);
    expect(a).toContain('amazon:reviews:');
  });
});

describe('cacheFresh', () => {
  it('accepts future, rejects past and junk', () => {
    expect(cacheFresh(new Date(Date.now() + 60_000).toISOString())).toBe(true);
    expect(cacheFresh(new Date(Date.now() - 60_000).toISOString())).toBe(false);
    expect(cacheFresh('not-a-date')).toBe(false);
    expect(cacheFresh(null)).toBe(false);
  });
});
