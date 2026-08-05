import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CONTENT_COLUMNS,
  DEFAULT_LEAD_COLUMNS,
  applyLeadEvent,
  coerceStage,
  deriveContentStage,
  groupByDay,
  groupByStage,
  isOverWipLimit,
  normalizeColumns,
  normalizeSortOrders,
  rescheduleToDay,
  seedLeadPipeline,
  sortOrderForDrop,
  stageForEvent,
  toColumnId,
  type ContentPlanRecord,
  type LeadPipelineRecord,
} from '../../src/lib/mothermode/planner';

const CONTENT = DEFAULT_CONTENT_COLUMNS;
const LEADS = DEFAULT_LEAD_COLUMNS;

function plan(over: Partial<ContentPlanRecord> = {}): ContentPlanRecord {
  return {
    id: 'p1',
    pieceId: 'piece-1',
    offerSlug: 'brain-dump',
    boardId: null,
    scheduledAt: null,
    stage: 'idea',
    platform: 'instagram',
    format: 'reel',
    kind: 'social',
    title: 'Hook test',
    owner: null,
    dueAt: null,
    priority: 0,
    notes: '',
    funnelId: null,
    funnelPage: '',
    destinationUrl: null,
    blocked: false,
    sortOrder: 0,
    publishedAt: null,
    externalUrl: null,
    // '' is the honest default for a fixture: these cards were never sent to a
    // scheduler, and 'draft' would quietly assert one is holding them.
    publishState: '',
    publishTarget: '',
    publishRef: null,
    publishAccounts: [],
    publishSyncedAt: null,
    updatedAt: null,
    updatedBy: null,
    ...over,
  };
}

function lead(over: Partial<LeadPipelineRecord> = {}): LeadPipelineRecord {
  return {
    leadId: 'l1',
    funnelId: null,
    boardId: null,
    stage: 'new',
    stageManual: false,
    owner: null,
    nextAction: '',
    nextActionAt: null,
    valueCents: 0,
    notes: '',
    tags: [],
    sortOrder: 0,
    updatedAt: null,
    updatedBy: null,
    ...over,
  };
}

describe('column configuration', () => {
  it('slugifies labels into stable ids', () => {
    expect(toColumnId('Waiting on Client!')).toBe('waiting_on_client');
    expect(toColumnId('   ')).toBe('column');
  });

  it('drops junk, de-duplicates ids, and falls back when empty', () => {
    const cols = normalizeColumns(
      [
        { id: 'idea', label: 'Idea' },
        null,
        'nope',
        { id: 'idea', label: 'Idea Again' },
        { label: 'Needs Legal', wipLimit: 3.7 },
      ],
      CONTENT,
    );
    expect(cols.map((c) => c.id)).toEqual(['idea', 'idea_2', 'needs_legal']);
    expect(cols[2].wipLimit).toBe(3);
    expect(normalizeColumns('garbage', CONTENT)).toHaveLength(CONTENT.length);
    expect(normalizeColumns([], CONTENT)).toHaveLength(CONTENT.length);
  });

  it('snaps unknown stages to the first column so cards never orphan', () => {
    expect(coerceStage('review', CONTENT)).toBe('review');
    expect(coerceStage('deleted_column', CONTENT)).toBe('idea');
    expect(coerceStage(null, CONTENT)).toBe('idea');
  });
});

describe('deriveContentStage', () => {
  it('uses the most advanced signal available', () => {
    expect(deriveContentStage({ versionStatus: 'published' }, CONTENT)).toBe(
      'published',
    );
    expect(deriveContentStage({ scheduledAt: '2026-01-01' }, CONTENT)).toBe(
      'scheduled',
    );
    expect(deriveContentStage({ compliancePassed: true }, CONTENT)).toBe(
      'approved',
    );
    expect(deriveContentStage({ hasCompliancePass: true }, CONTENT)).toBe(
      'review',
    );
    expect(deriveContentStage({ hasMedia: true }, CONTENT)).toBe('media');
    expect(deriveContentStage({ hasEdits: true }, CONTENT)).toBe('writing');
    expect(deriveContentStage({}, CONTENT)).toBe('idea');
  });

  it('degrades gracefully when the board lacks the ideal column', () => {
    const trimmed = [
      { id: 'backlog', label: 'Backlog' },
      { id: 'approved', label: 'Approved' },
    ];
    expect(deriveContentStage({ versionStatus: 'published' }, trimmed)).toBe(
      'approved',
    );
    expect(deriveContentStage({ hasMedia: true }, trimmed)).toBe('backlog');
  });
});

describe('lead auto-staging', () => {
  it('maps funnel events onto the columns that claim them', () => {
    expect(stageForEvent('purchase', LEADS)).toBe('customer');
    expect(stageForEvent('checkout_start', LEADS)).toBe('checkout_started');
    expect(stageForEvent('mystery_event', LEADS)).toBeNull();
  });

  it('advances forward only', () => {
    const engaged = lead({ stage: 'engaged' });
    expect(applyLeadEvent(engaged, 'purchase', LEADS).stage).toBe('customer');
    // A replayed early event must not drag a customer backwards.
    const customer = lead({ stage: 'customer' });
    expect(applyLeadEvent(customer, 'optin_submit', LEADS)).toBe(customer);
  });

  it('never overrides a manually dragged card', () => {
    const manual = lead({ stage: 'call_booked', stageManual: true });
    expect(applyLeadEvent(manual, 'purchase', LEADS)).toBe(manual);
  });

  it('ignores events no column claims', () => {
    const l = lead();
    expect(applyLeadEvent(l, 'unclaimed', LEADS)).toBe(l);
  });

  it('seeds a stage from existing lead lifecycle fields', () => {
    expect(seedLeadPipeline({ id: 'a' }, LEADS).stage).toBe('new');
    expect(
      seedLeadPipeline({ id: 'b', stepReached: 'checkout' }, LEADS).stage,
    ).toBe('checkout_started');
    const buyer = seedLeadPipeline(
      { id: 'c', purchased: true, purchaseAmountCents: 4700 },
      LEADS,
    );
    expect(buyer.stage).toBe('customer');
    expect(buyer.valueCents).toBe(4700);
    expect(buyer.stageManual).toBe(false);
    expect(
      seedLeadPipeline(
        { id: 'd', stepReached: 'upsell-2', purchased: true },
        LEADS,
      ).stage,
    ).toBe('upsell_taken');
  });
});

describe('drag + reorder', () => {
  it('computes midpoint sort orders for a drop', () => {
    expect(sortOrderForDrop([], 0)).toBe(100);
    expect(sortOrderForDrop([{ sortOrder: 100 }], 0)).toBe(0);
    expect(sortOrderForDrop([{ sortOrder: 100 }], 1)).toBe(200);
    expect(
      sortOrderForDrop([{ sortOrder: 100 }, { sortOrder: 200 }], 1),
    ).toBe(150);
  });

  it('signals a renumber when the gap is exhausted', () => {
    const siblings = [{ sortOrder: 100 }, { sortOrder: 101 }];
    expect(sortOrderForDrop(siblings, 1)).toBe(100);
    expect(normalizeSortOrders(siblings).map((s) => s.sortOrder)).toEqual([
      100, 200,
    ]);
  });

  it('groups cards into every column, ordered and gap-filled', () => {
    const grouped = groupByStage(
      [
        plan({ id: 'b', stage: 'writing', sortOrder: 200, title: 'B' }),
        plan({ id: 'a', stage: 'writing', sortOrder: 100, title: 'A' }),
        plan({ id: 'z', stage: 'ghost_column', sortOrder: 0, title: 'Z' }),
      ],
      CONTENT,
    );
    expect(grouped.writing.map((c) => c.id)).toEqual(['a', 'b']);
    expect(grouped.idea.map((c) => c.id)).toEqual(['z']);
    expect(grouped.review).toEqual([]);
  });

  it('treats wip limits as soft warnings', () => {
    expect(isOverWipLimit({ id: 'x', label: 'X', wipLimit: 2 }, 3)).toBe(true);
    expect(isOverWipLimit({ id: 'x', label: 'X', wipLimit: 2 }, 2)).toBe(false);
    expect(isOverWipLimit({ id: 'x', label: 'X' }, 99)).toBe(false);
  });
});

describe('calendar', () => {
  it('buckets by local day and keeps unscheduled cards in the backlog', () => {
    const d1 = new Date(2026, 0, 5, 9, 0).toISOString();
    const d2 = new Date(2026, 0, 5, 17, 30).toISOString();
    const { byDay, backlog } = groupByDay([
      plan({ id: 'late', scheduledAt: d2 }),
      plan({ id: 'early', scheduledAt: d1 }),
      plan({ id: 'idea-a', priority: 1, title: 'A' }),
      plan({ id: 'idea-b', priority: 5, title: 'B' }),
    ]);
    expect(byDay['2026-01-05'].map((c) => c.id)).toEqual(['early', 'late']);
    // Backlog is priority-first so the next thing to schedule is on top.
    expect(backlog.map((c) => c.id)).toEqual(['idea-b', 'idea-a']);
  });

  it('preserves time-of-day when rescheduling, defaulting to 09:00', () => {
    const existing = plan({
      scheduledAt: new Date(2026, 0, 5, 14, 45).toISOString(),
    });
    const moved = new Date(rescheduleToDay(existing, '2026-02-10').scheduledAt!);
    expect(moved.getMonth()).toBe(1);
    expect(moved.getDate()).toBe(10);
    expect(moved.getHours()).toBe(14);
    expect(moved.getMinutes()).toBe(45);

    const fresh = new Date(rescheduleToDay(plan(), '2026-02-10').scheduledAt!);
    expect(fresh.getHours()).toBe(9);

    // Malformed day keys are a no-op rather than an invalid date.
    expect(rescheduleToDay(existing, 'nope').scheduledAt).toBe(
      existing.scheduledAt,
    );
  });
});
