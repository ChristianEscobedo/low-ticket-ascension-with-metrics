// Pure board logic: stage derivation, event-driven auto-staging, drag/reorder
// maths, and calendar bucketing. No Supabase, no React — everything here is a
// function of its arguments so the rules are unit-testable and identical on the
// server (API routes) and the client (optimistic drag updates).

import type {
  ContentPlanRecord,
  LeadPipelineRecord,
  PlannerColumn,
} from './types';
import { coerceStage } from './types';

// ---------------------------------------------------------------------------
// Content stage derivation
// ---------------------------------------------------------------------------

/**
 * Signals we can read off existing systems for a piece that has never been
 * planned. Everything is optional: absent signals just mean "no evidence".
 */
export interface ContentStageSignals {
  /** SavedVersion.status from the content review store. */
  versionStatus?: 'draft' | 'scheduled' | 'published' | null;
  /** A PieceReview exists with edited copy. */
  hasEdits?: boolean;
  /** Generated/attached images, frame packs, reels, voiceovers. */
  hasMedia?: boolean;
  /** A compliance pass has been run. */
  hasCompliancePass?: boolean;
  /** Compliance came back clean. */
  compliancePassed?: boolean;
  /** mothermode_generated_content.status. */
  generatedStatus?: 'draft' | 'approved' | 'archived' | null;
  /** A real publish date already exists (SavedVersion.scheduledFor). */
  scheduledAt?: string | null;
}

/**
 * Best guess at where an unplanned piece belongs, using the most advanced
 * evidence available. Intentionally optimistic-but-conservative: a piece is
 * only 'published' if something recorded it as published, and only 'approved'
 * if a human approved it. Any stage id missing from the board degrades to the
 * closest earlier default, and finally to the first column.
 */
export function deriveContentStage(
  signals: ContentStageSignals,
  columns: PlannerColumn[],
): string {
  const has = (id: string) => columns.some((c) => c.id === id);
  const pick = (...ids: string[]): string | null => {
    for (const id of ids) if (has(id)) return id;
    return null;
  };

  if (signals.versionStatus === 'published') {
    const s = pick('published', 'scheduled', 'approved');
    if (s) return s;
  }
  if (signals.versionStatus === 'scheduled' || signals.scheduledAt) {
    const s = pick('scheduled', 'approved');
    if (s) return s;
  }
  if (signals.generatedStatus === 'approved' || signals.compliancePassed) {
    const s = pick('approved', 'review');
    if (s) return s;
  }
  if (signals.hasCompliancePass) {
    const s = pick('review');
    if (s) return s;
  }
  if (signals.hasMedia) {
    const s = pick('media', 'writing');
    if (s) return s;
  }
  if (signals.hasEdits) {
    const s = pick('writing');
    if (s) return s;
  }
  return columns[0]?.id ?? 'idea';
}

// ---------------------------------------------------------------------------
// Lead auto-staging
// ---------------------------------------------------------------------------

/** The column a funnel event points at, or null when no column claims it. */
export function stageForEvent(
  eventType: string,
  columns: PlannerColumn[],
): string | null {
  const hit = columns.find((c) => (c.autoEvents ?? []).includes(eventType));
  return hit ? hit.id : null;
}

/** Board position of a stage; -1 when the stage is not on this board. */
export function stageIndex(stage: string, columns: PlannerColumn[]): number {
  return columns.findIndex((c) => c.id === stage);
}

/**
 * Apply a funnel event to a pipeline record.
 *
 * Three rules, in order:
 *  1. A manually staged card is never moved by automation (`stageManual`).
 *  2. No column claims the event → no change.
 *  3. Events only ever move a card *forward*. A late `optin_submit` replay can
 *     never drag a Customer back to New.
 *
 * Returns the same object reference when nothing changed, so callers can skip
 * the write with a cheap identity check.
 */
export function applyLeadEvent(
  record: LeadPipelineRecord,
  eventType: string,
  columns: PlannerColumn[],
): LeadPipelineRecord {
  if (record.stageManual) return record;
  const target = stageForEvent(eventType, columns);
  if (!target) return record;
  const from = stageIndex(record.stage, columns);
  const to = stageIndex(target, columns);
  if (to < 0 || to <= from) return record;
  return { ...record, stage: target };
}

/**
 * Pipeline record for a lead that has never been touched by the planner,
 * seeded from the columns its lifecycle already implies. This is what makes the
 * lead board fully populated with zero backfill.
 */
export function seedLeadPipeline(
  lead: {
    id: string;
    funnelId?: string | null;
    status?: string;
    stepReached?: string;
    purchased?: boolean;
    purchaseAmountCents?: number;
  },
  columns: PlannerColumn[],
): LeadPipelineRecord {
  let stage = columns[0]?.id ?? 'new';
  const apply = (event: string) => {
    const next = stageForEvent(event, columns);
    if (next && stageIndex(next, columns) > stageIndex(stage, columns)) {
      stage = next;
    }
  };

  apply('optin_submit');
  const step = lead.stepReached ?? '';
  if (step === 'sales') apply('sales_view');
  if (step === 'vsl') apply('vsl_view');
  if (step === 'checkout' || lead.status === 'checkout_started') {
    apply('checkout_start');
  }
  if (lead.purchased || lead.status === 'purchased') apply('purchase');
  if (/^upsell/.test(step) && lead.purchased) apply('upsell_yes');

  return {
    leadId: lead.id,
    funnelId: lead.funnelId ?? null,
    boardId: null,
    stage: coerceStage(stage, columns),
    stageManual: false,
    owner: null,
    nextAction: '',
    nextActionAt: null,
    valueCents: lead.purchaseAmountCents ?? 0,
    notes: '',
    tags: [],
    sortOrder: 0,
    updatedAt: null,
    updatedBy: null,
  };
}

// ---------------------------------------------------------------------------
// Drag + reorder
// ---------------------------------------------------------------------------

/** Gap between sort_order values, so a single insert rarely renumbers siblings. */
export const SORT_STEP = 100;

/**
 * sort_order for a card dropped at `index` within `siblings` (the destination
 * column's cards, already ordered, excluding the dragged card). Midpoint
 * insertion keeps writes to one row; callers only need `normalizeSortOrders`
 * when the gap collapses to zero.
 */
export function sortOrderForDrop(
  siblings: { sortOrder: number }[],
  index: number,
): number {
  const at = Math.max(0, Math.min(index, siblings.length));
  const before = at > 0 ? siblings[at - 1].sortOrder : null;
  const after = at < siblings.length ? siblings[at].sortOrder : null;
  if (before === null && after === null) return SORT_STEP;
  if (before === null) return (after as number) - SORT_STEP;
  if (after === null) return before + SORT_STEP;
  const mid = Math.floor((before + after) / 2);
  // Gap exhausted: signal a renumber by returning the lower bound. Callers
  // detect `mid === before` and rewrite the column with normalizeSortOrders.
  return mid === before ? before : mid;
}

/** Evenly spaced sort orders, for the rare full-column renumber. */
export function normalizeSortOrders<T extends { sortOrder: number }>(
  cards: T[],
): T[] {
  return cards.map((card, i) => ({ ...card, sortOrder: (i + 1) * SORT_STEP }));
}

/** Cards bucketed by column id, each bucket ordered by sortOrder then title. */
export function groupByStage<
  T extends { stage: string; sortOrder: number; title?: string },
>(cards: T[], columns: PlannerColumn[]): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const col of columns) out[col.id] = [];
  for (const card of cards) {
    const key = coerceStage(card.stage, columns);
    (out[key] ??= []).push(card);
  }
  for (const key of Object.keys(out)) {
    out[key].sort(
      (a, b) =>
        a.sortOrder - b.sortOrder || (a.title ?? '').localeCompare(b.title ?? ''),
    );
  }
  return out;
}

/** True when a column is over its soft WIP limit (a warning, not a block). */
export function isOverWipLimit(column: PlannerColumn, count: number): boolean {
  return typeof column.wipLimit === 'number' && column.wipLimit > 0
    ? count > column.wipLimit
    : false;
}

// ---------------------------------------------------------------------------
// Calendar bucketing
// ---------------------------------------------------------------------------

/** Local-time YYYY-MM-DD key for an ISO timestamp. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Scheduled cards bucketed by local day for the calendar grid. Unscheduled
 * cards are returned separately as the drag-source backlog rail.
 */
export function groupByDay(cards: ContentPlanRecord[]): {
  byDay: Record<string, ContentPlanRecord[]>;
  backlog: ContentPlanRecord[];
} {
  const byDay: Record<string, ContentPlanRecord[]> = {};
  const backlog: ContentPlanRecord[] = [];
  for (const card of cards) {
    const key = card.scheduledAt ? dayKey(card.scheduledAt) : '';
    if (!key) {
      backlog.push(card);
      continue;
    }
    (byDay[key] ??= []).push(card);
  }
  for (const key of Object.keys(byDay)) {
    byDay[key].sort(
      (a, b) =>
        (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? '') ||
        a.sortOrder - b.sortOrder,
    );
  }
  backlog.sort(
    (a, b) => b.priority - a.priority || a.title.localeCompare(b.title),
  );
  return { byDay, backlog };
}

/**
 * Move a card to a calendar day, preserving its existing time-of-day (or
 * defaulting to 09:00 local when it had no date yet). Dropping on a day should
 * never silently reset a carefully chosen posting time.
 */
export function rescheduleToDay(
  card: ContentPlanRecord,
  isoDay: string,
): ContentPlanRecord {
  const [y, m, d] = isoDay.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return card;
  const prev = card.scheduledAt ? new Date(card.scheduledAt) : null;
  const hours = prev && !Number.isNaN(prev.getTime()) ? prev.getHours() : 9;
  const mins = prev && !Number.isNaN(prev.getTime()) ? prev.getMinutes() : 0;
  const next = new Date(y, m - 1, d, hours, mins, 0, 0);
  return { ...card, scheduledAt: next.toISOString() };
}

/** Overdue = a next action / due date in the past. Drives the red card chip. */
export function isOverdue(at: string | null, now: Date = new Date()): boolean {
  if (!at) return false;
  const t = new Date(at).getTime();
  return Number.isFinite(t) && t < now.getTime();
}
