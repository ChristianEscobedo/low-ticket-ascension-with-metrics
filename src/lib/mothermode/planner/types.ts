// Planner domain types + row mappers.
//
// The planner is one store with three views: a content calendar, a content
// kanban, and a lead kanban. The calendar and the content kanban are the *same*
// records seen through different lenses (`scheduledAt` vs `stage`), which is why
// there is a single ContentPlanRecord rather than a schedule and a board.
//
// Columns are admin-configurable, so `stage` is a plain string keyed to a
// PlannerColumn.id rather than a union type. Every consumer that needs a valid
// stage passes through `coerceStage()` so a renamed or deleted column can never
// orphan a card.

import { normalizePublishState, type PublishState } from './publishState';

// ---------------------------------------------------------------------------
// Boards + columns
// ---------------------------------------------------------------------------

export type PlannerBoardKind = 'content' | 'leads';

export interface PlannerColumn {
  /** Stable slug used as the card's `stage`. Never renamed once cards exist. */
  id: string;
  /** Human label; safe to rename freely. */
  label: string;
  /** Hex swatch for the column header, card dot, and calendar chip. */
  color?: string;
  /** Soft cap; the board warns above it rather than blocking the drop. */
  wipLimit?: number | null;
  /** End-of-life column (Published / Closed Won / Closed Lost). */
  terminal?: boolean;
  /**
   * Lead boards only: funnel event types that auto-move a card into this
   * column. Ignored once the card is manually staged (see stageManual).
   */
  autoEvents?: string[];
}

export interface PlannerBoard {
  id: string;
  kind: PlannerBoardKind;
  name: string;
  columns: PlannerColumn[];
  isDefault: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface PlannerBoardRow {
  id: string;
  kind: string;
  name: string | null;
  columns: unknown;
  is_default: boolean | null;
  updated_at: string | null;
  updated_by: string | null;
}

// ---------------------------------------------------------------------------
// Content plan (calendar + content kanban)
// ---------------------------------------------------------------------------

/**
 * One social account a post went out to.
 *
 * `platform` is stored as the scheduler reported it (GHL says 'twitter' for X)
 * and NOT normalized on write: normalizing would destroy the only evidence of
 * what the integration actually said, which is the first thing you need when a
 * post lands on the wrong channel. `canonicalPlatform()` maps it for display.
 */
export interface PublishAccount {
  id: string;
  platform: string;
  name: string;
}

export interface ContentPlanRecord {
  id: string;
  /** Catalog piece id or generated piece id ('gen_<batch>_<n>'). */
  pieceId: string;
  offerSlug: string;
  boardId: string | null;
  /** ISO string. The export pipeline's first choice of publish date. */
  scheduledAt: string | null;
  stage: string;
  platform: string;
  format: string;
  kind: string;
  title: string;
  owner: string | null;
  dueAt: string | null;
  priority: number;
  notes: string;
  blocked: boolean;
  sortOrder: number;
  publishedAt: string | null;
  externalUrl: string | null;
  /**
   * Where this piece points. Added by 20261005000000: the card knew what it was
   * and when it shipped, but not what it was driving traffic to.
   *
   * `funnelId` and `destinationUrl` are alternatives, not a pair — a piece
   * either drives one of our funnels or an outside URL (a YouTube video, a
   * partner page). `funnelPage` only means anything alongside `funnelId`.
   */
  funnelId: string | null;
  funnelPage: string;
  destinationUrl: string | null;
  /**
   * What this card was actually sent to a scheduler AS — '' | 'draft' |
   * 'scheduled' | 'published'.
   *
   * Deliberately not derived from `stage`. `stage` is a user-editable workflow
   * column (rename it, delete it, and `coerceStage` reshuffles the cards);
   * "GoHighLevel is holding this as a draft for Tuesday" is a fact that has to
   * survive someone reorganising their board. And it is not derived from
   * `scheduledAt` either: a draft and a live schedule both carry a date, and the
   * difference between them — will it publish itself? — is the entire point.
   */
  publishState: PublishState;
  /** Which scheduler holds it: 'ghl', or '' when planned here only. */
  publishTarget: string;
  /** The scheduler's own id for the post, so a card traces to the real thing. */
  publishRef: string | null;
  /**
   * The social accounts it went to, snapshotted on the card.
   *
   * Snapshotted rather than looked up live because the planner has to draw these
   * logos for a post from six months ago, when the account may since have been
   * disconnected — a live lookup would silently blank the history.
   */
  publishAccounts: PublishAccount[];
  publishSyncedAt: string | null;
  updatedAt: string | null;

  updatedBy: string | null;
}

export interface ContentPlanRow {
  id: string;
  piece_id: string;
  offer_slug: string | null;
  board_id: string | null;
  scheduled_at: string | null;
  stage: string | null;
  platform: string | null;
  format: string | null;
  kind: string | null;
  title: string | null;
  owner: string | null;
  due_at: string | null;
  priority: number | null;
  notes: string | null;
  blocked: boolean | null;
  sort_order: number | null;
  published_at: string | null;
  external_url: string | null;
  funnel_id?: string | null;
  funnel_page?: string | null;
  destination_url?: string | null;
  // Optional so a checkout running ahead of its migrations degrades to
  // "Planned / no accounts" instead of throwing on every planner read.
  publish_state?: string | null;
  publish_target?: string | null;
  publish_ref?: string | null;
  publish_accounts?: unknown;
  publish_synced_at?: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

// ---------------------------------------------------------------------------
// Lead pipeline (lead kanban)
// ---------------------------------------------------------------------------

export interface LeadPipelineRecord {
  leadId: string;
  funnelId: string | null;
  boardId: string | null;
  stage: string;
  /** True once a human dragged the card; freezes event-driven auto-staging. */
  stageManual: boolean;
  owner: string | null;
  nextAction: string;
  nextActionAt: string | null;
  valueCents: number;
  notes: string;
  tags: string[];
  sortOrder: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface LeadPipelineRow {
  lead_id: string;
  funnel_id: string | null;
  board_id: string | null;
  stage: string | null;
  stage_manual: boolean | null;
  owner: string | null;
  next_action: string | null;
  next_action_at: string | null;
  value_cents: number | null;
  notes: string | null;
  tags: unknown;
  sort_order: number | null;
  updated_at: string | null;
  updated_by: string | null;
}

// ---------------------------------------------------------------------------
// Column normalizing
// ---------------------------------------------------------------------------

/** Lowercase, hyphen-free slug for a freshly added column label. */
export function toColumnId(label: string): string {
  return (
    label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'column'
  );
}

/**
 * Coerce arbitrary JSONB into a usable PlannerColumn[]: drops entries without a
 * usable id/label, de-duplicates ids (the second wins a suffix), and guarantees
 * at least one column so a board can never render empty.
 */
export function normalizeColumns(
  value: unknown,
  fallback: PlannerColumn[],
): PlannerColumn[] {
  if (!Array.isArray(value)) return fallback.map((c) => ({ ...c }));
  const seen = new Set<string>();
  const out: PlannerColumn[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const rec = raw as Record<string, unknown>;
    const label = typeof rec.label === 'string' ? rec.label.trim() : '';
    const rawId = typeof rec.id === 'string' ? rec.id.trim() : '';
    const base = rawId || toColumnId(label);
    if (!base && !label) continue;
    let id = base || toColumnId(label);
    let n = 2;
    while (seen.has(id)) id = `${base}_${n++}`;
    seen.add(id);
    out.push({
      id,
      label: label || id,
      color: typeof rec.color === 'string' ? rec.color : undefined,
      wipLimit:
        typeof rec.wipLimit === 'number' && rec.wipLimit > 0
          ? Math.floor(rec.wipLimit)
          : null,
      terminal: rec.terminal === true,
      autoEvents: Array.isArray(rec.autoEvents)
        ? rec.autoEvents.filter((e): e is string => typeof e === 'string')
        : undefined,
    });
  }
  return out.length ? out : fallback.map((c) => ({ ...c }));
}

/**
 * Snap a possibly stale stage onto the board. Unknown stages land in the first
 * column, which is how a card survives its column being deleted.
 */
export function coerceStage(stage: unknown, columns: PlannerColumn[]): string {
  const first = columns[0]?.id ?? 'idea';
  if (typeof stage !== 'string' || !stage) return first;
  return columns.some((c) => c.id === stage) ? stage : first;
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Coerce JSONB into PublishAccount[].
 *
 * Entries with neither a platform nor a name are dropped: a chip with no logo
 * AND no label is an unexplained empty box on the card, which reads as a
 * rendering bug rather than as missing data. A missing `id` is kept — it is only
 * a React key, and the index covers it.
 */
export function normalizePublishAccounts(value: unknown): PublishAccount[] {
  if (!Array.isArray(value)) return [];
  const out: PublishAccount[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const rec = raw as Record<string, unknown>;
    const platform = str(rec.platform).trim();
    const name = str(rec.name).trim();
    if (!platform && !name) continue;
    out.push({ id: str(rec.id), platform, name });
  }
  return out;
}

export function rowToPlannerBoard(
  row: PlannerBoardRow,
  fallback: PlannerColumn[],
): PlannerBoard {
  return {
    id: row.id,
    kind: row.kind === 'leads' ? 'leads' : 'content',
    name: str(row.name),
    columns: normalizeColumns(row.columns, fallback),
    isDefault: Boolean(row.is_default),
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

export function rowToContentPlan(
  row: ContentPlanRow,
  columns: PlannerColumn[],
): ContentPlanRecord {
  return {
    id: row.id,
    pieceId: row.piece_id,
    offerSlug: str(row.offer_slug),
    boardId: row.board_id,
    scheduledAt: row.scheduled_at,
    stage: coerceStage(row.stage, columns),
    platform: str(row.platform),
    format: str(row.format),
    kind: str(row.kind),
    title: str(row.title),
    owner: row.owner,
    dueAt: row.due_at,
    priority: num(row.priority),
    notes: str(row.notes),
    blocked: Boolean(row.blocked),
    sortOrder: num(row.sort_order),
    publishedAt: row.published_at,
    externalUrl: row.external_url,
    funnelId: row.funnel_id ?? null,
    funnelPage: str(row.funnel_page),
    destinationUrl: row.destination_url ?? null,
    publishState: normalizePublishState(row.publish_state),
    publishTarget: str(row.publish_target),
    publishRef: row.publish_ref ?? null,
    publishAccounts: normalizePublishAccounts(row.publish_accounts),
    publishSyncedAt: row.publish_synced_at ?? null,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

export function rowToLeadPipeline(
  row: LeadPipelineRow,
  columns: PlannerColumn[],
): LeadPipelineRecord {
  return {
    leadId: row.lead_id,
    funnelId: row.funnel_id,
    boardId: row.board_id,
    stage: coerceStage(row.stage, columns),
    stageManual: Boolean(row.stage_manual),
    owner: row.owner,
    nextAction: str(row.next_action),
    nextActionAt: row.next_action_at,
    valueCents: num(row.value_cents),
    notes: str(row.notes),
    tags: Array.isArray(row.tags)
      ? row.tags.filter((t): t is string => typeof t === 'string')
      : [],
    sortOrder: num(row.sort_order),
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}
