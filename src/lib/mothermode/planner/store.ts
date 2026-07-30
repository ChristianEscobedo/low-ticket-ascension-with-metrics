/**
 * Planner store. Service-role only (bypasses RLS) — the planner is an internal
 * admin surface and the three tables carry no anon policies.
 *
 * Two deliberate behaviours to know about:
 *
 * 1. **Boards fall back to code, never to nothing.** `getBoard` returns the
 *    seeded DB row when it exists, and `DEFAULT_*_COLUMNS` when Supabase is
 *    unconfigured or the seed never ran. A board is therefore always renderable,
 *    which is what lets `coerceStage` have a first column to snap orphans onto.
 *
 * 2. **The lead board is a left join done in memory.** Leads are the source of
 *    truth for *who* exists; `mothermode_lead_pipeline` only overlays CRM state.
 *    A lead with no pipeline row is seeded through `seedLeadPipeline` on read,
 *    so the board is fully populated on day one with no backfill migration.
 *    Seeded cards are marked `persisted: false` so the UI can tell "never
 *    touched" from "explicitly staged here".
 */
import { createClient } from '@supabase/supabase-js';
import {
  coerceStage,
  normalizeColumns,
  normalizePublishAccounts,
  rowToContentPlan,
  rowToLeadPipeline,
  rowToPlannerBoard,
  type ContentPlanRecord,
  type ContentPlanRow,
  type LeadPipelineRecord,
  type LeadPipelineRow,
  type PlannerBoard,
  type PlannerBoardKind,
  type PlannerBoardRow,
  type PlannerColumn,
} from './types';
import {
  DEFAULT_CONTENT_BOARD_NAME,
  DEFAULT_LEAD_BOARD_NAME,
  defaultColumns,
} from './defaults';
import { applyLeadEvent, seedLeadPipeline } from './board';
import { normalizePublishState } from './publishState';

const BOARDS = 'mothermode_planner_boards';
const CONTENT_PLAN = 'mothermode_content_plan';
const LEAD_PIPELINE = 'mothermode_lead_pipeline';
const LEADS = 'mothermode_sales_funnel_leads';

const BOARD_COLUMNS = 'id, kind, name, columns, is_default, updated_at, updated_by';

const PLAN_COLUMNS =
  'id, piece_id, offer_slug, board_id, scheduled_at, stage, platform, format, kind, title, owner, due_at, priority, notes, blocked, sort_order, published_at, external_url, funnel_id, funnel_page, destination_url, publish_state, publish_target, publish_ref, publish_accounts, publish_synced_at, updated_at, updated_by';

const PIPELINE_COLUMNS =
  'lead_id, funnel_id, board_id, stage, stage_manual, owner, next_action, next_action_at, value_cents, notes, tags, sort_order, updated_at, updated_by';

// Lazy client so the module never throws on missing env at import time.
let _service: ReturnType<typeof createClient> | null = null;
function serviceClient() {
  if (_service) return _service;
  _service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );
  return _service;
}

/** An in-memory board used when Supabase is unavailable or unseeded. */
function fallbackBoard(kind: PlannerBoardKind): PlannerBoard {
  return {
    id: '',
    kind,
    name: kind === 'leads' ? DEFAULT_LEAD_BOARD_NAME : DEFAULT_CONTENT_BOARD_NAME,
    columns: defaultColumns(kind),
    isDefault: true,
    updatedAt: null,
    updatedBy: null,
  };
}

// ---------------------------------------------------------------------------
// Boards
// ---------------------------------------------------------------------------

/**
 * The default board for a kind. Never throws and never returns null: an
 * unreachable DB degrades to the code-side defaults so every downstream call
 * (`coerceStage`, `groupByStage`) still has a valid column list.
 */
export async function getBoard(kind: PlannerBoardKind): Promise<PlannerBoard> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(BOARDS)
      .select(BOARD_COLUMNS)
      .eq('kind', kind)
      .eq('is_default', true)
      .maybeSingle();
    if (error || !data) return fallbackBoard(kind);
    return rowToPlannerBoard(data as PlannerBoardRow, defaultColumns(kind));
  } catch {
    return fallbackBoard(kind);
  }
}

/** Both default boards in one round trip's worth of code. */
export async function getBoards(): Promise<{
  content: PlannerBoard;
  leads: PlannerBoard;
}> {
  const [content, leads] = await Promise.all([
    getBoard('content'),
    getBoard('leads'),
  ]);
  return { content, leads };
}

/**
 * Save a board's columns (rename / reorder / add / remove) and name.
 *
 * Column *ids* are never rewritten here — `normalizeColumns` preserves whatever
 * id the client sent. That is the contract that lets a rename be a pure label
 * change while existing cards keep pointing at the same stage. Deleting a column
 * is allowed and leaves cards orphaned on purpose; `coerceStage` snaps them to
 * the first column on the next read rather than the save rewriting rows.
 */
export async function saveBoardColumns(input: {
  kind: PlannerBoardKind;
  name?: string;
  columns: unknown;
  updatedBy?: string | null;
}): Promise<PlannerBoard> {
  const fallback = defaultColumns(input.kind);
  const columns = normalizeColumns(input.columns, fallback);
  const existing = await getBoard(input.kind);

  const row: Record<string, unknown> = {
    kind: input.kind,
    name:
      input.name?.trim() ||
      existing.name ||
      (input.kind === 'leads' ? DEFAULT_LEAD_BOARD_NAME : DEFAULT_CONTENT_BOARD_NAME),
    columns,
    is_default: true,
    updated_by: input.updatedBy ?? null,
    updated_at: new Date().toISOString(),
  };
  if (existing.id) row.id = existing.id;

  const { data, error } = await (serviceClient() as any)
    .from(BOARDS)
    .upsert(row, { onConflict: 'id' })
    .select(BOARD_COLUMNS)
    .single();
  if (error || !data) {
    throw new Error(
      `saveBoardColumns failed: ${error?.message ?? 'no row returned'}`,
    );
  }
  return rowToPlannerBoard(data as PlannerBoardRow, fallback);
}

// ---------------------------------------------------------------------------
// Content plan (calendar + content kanban)
// ---------------------------------------------------------------------------

/**
 * Every planned piece, optionally scoped to one offer. Stages are coerced
 * against the live board on the way out, so a card whose column was deleted
 * still lands somewhere visible.
 */
export async function listContentPlan(opts?: {
  offerSlug?: string | null;
  columns?: PlannerColumn[];
}): Promise<ContentPlanRecord[]> {
  const columns = opts?.columns ?? (await getBoard('content')).columns;
  try {
    let query = (serviceClient() as any)
      .from(CONTENT_PLAN)
      .select(PLAN_COLUMNS)
      .order('sort_order', { ascending: true });
    if (opts?.offerSlug) query = query.eq('offer_slug', opts.offerSlug);
    const { data, error } = await query;
    if (error || !data) return [];
    return (data as ContentPlanRow[]).map((r) => rowToContentPlan(r, columns));
  } catch {
    return [];
  }
}

/**
 * Only the scheduled rows for an offer, keyed by `pieceId`. This is the shape
 * the export pipeline wants: `buildExportRows` looks a piece up by id and
 * prefers `scheduledAt` over its own campaignStart + week arithmetic.
 */
export async function getScheduleByPieceId(
  offerSlug?: string | null,
): Promise<Record<string, string>> {
  const plans = await listContentPlan({ offerSlug: offerSlug ?? null });
  const out: Record<string, string> = {};
  for (const plan of plans) {
    if (plan.scheduledAt) out[plan.pieceId] = plan.scheduledAt;
  }
  return out;
}

export interface UpsertContentPlanInput {
  id?: string | null;
  pieceId: string;
  offerSlug?: string | null;
  boardId?: string | null;
  scheduledAt?: string | null;
  stage?: string;
  platform?: string;
  format?: string;
  kind?: string;
  title?: string;
  owner?: string | null;
  dueAt?: string | null;
  priority?: number;
  notes?: string;
  blocked?: boolean;
  sortOrder?: number;
  publishedAt?: string | null;
  externalUrl?: string | null;
  funnelId?: string | null;
  funnelPage?: string;
  destinationUrl?: string | null;
  /** '' | 'draft' | 'scheduled' | 'published'. Coerced, never trusted raw. */
  publishState?: string | null;
  publishTarget?: string | null;
  publishRef?: string | null;
  publishAccounts?: unknown;
  publishSyncedAt?: string | null;
  updatedBy?: string | null;
}

/**
 * Create or update one plan row.
 *
 * `onConflict: 'piece_id,offer_slug'` matches the table's UNIQUE constraint, so
 * planning an already-planned piece updates it instead of raising — the same
 * piece can still be planned once per offer.
 */
export async function upsertContentPlan(
  input: UpsertContentPlanInput,
  columns?: PlannerColumn[],
): Promise<ContentPlanRecord> {
  const cols = columns ?? (await getBoard('content')).columns;
  const row: Record<string, unknown> = {
    piece_id: input.pieceId,
    offer_slug: input.offerSlug ?? '',
    board_id: input.boardId ?? null,
    scheduled_at: input.scheduledAt ?? null,
    stage: coerceStage(input.stage, cols),
    platform: input.platform ?? '',
    format: input.format ?? '',
    kind: input.kind ?? '',
    title: input.title ?? '',
    owner: input.owner ?? null,
    due_at: input.dueAt ?? null,
    priority: input.priority ?? 0,
    notes: input.notes ?? '',
    blocked: input.blocked ?? false,
    sort_order: input.sortOrder ?? 0,
    published_at: input.publishedAt ?? null,
    external_url: input.externalUrl ?? null,
    funnel_id: input.funnelId ?? null,
    funnel_page: input.funnelPage ?? '',
    destination_url: input.destinationUrl ?? null,
    // Coerced on the way in, so a bad value from any caller can never make the
    // calendar claim a post will publish itself.
    publish_state: normalizePublishState(input.publishState),
    publish_target: input.publishTarget ?? '',
    publish_ref: input.publishRef ?? null,
    publish_accounts: normalizePublishAccounts(input.publishAccounts),
    publish_synced_at: input.publishSyncedAt ?? null,
    updated_by: input.updatedBy ?? null,
    updated_at: new Date().toISOString(),
  };
  if (input.id) row.id = input.id;

  const { data, error } = await (serviceClient() as any)
    .from(CONTENT_PLAN)
    .upsert(row, { onConflict: input.id ? 'id' : 'piece_id,offer_slug' })
    .select(PLAN_COLUMNS)
    .single();
  if (error || !data) {
    throw new Error(
      `upsertContentPlan failed: ${error?.message ?? 'no row returned'}`,
    );
  }
  return rowToContentPlan(data as ContentPlanRow, cols);
}

/**
 * Partial update by row id — the drag path.
 *
 * A stage/date/sort change writes only the fields that moved, so two admins
 * editing different facets of the same card don't clobber each other's work.
 * `published_at` is stamped automatically when a card lands on a terminal
 * column, because "when did this ship?" should not be a second manual step.
 */
export async function patchContentPlan(
  id: string,
  patch: {
    stage?: string;
    scheduledAt?: string | null;
    sortOrder?: number;
    owner?: string | null;
    dueAt?: string | null;
    priority?: number;
    notes?: string;
    blocked?: boolean;
    title?: string;
    externalUrl?: string | null;
    publishedAt?: string | null;
    funnelId?: string | null;
    funnelPage?: string;
    destinationUrl?: string | null;
    publishState?: string | null;
    publishTarget?: string | null;
    publishRef?: string | null;
    publishAccounts?: unknown;
    publishSyncedAt?: string | null;
  },
  columns?: PlannerColumn[],
): Promise<ContentPlanRecord | null> {
  const cols = columns ?? (await getBoard('content')).columns;
  const row: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.stage !== undefined) {
    const stage = coerceStage(patch.stage, cols);
    row.stage = stage;
    const column = cols.find((c) => c.id === stage);
    // Terminal column = shipped. Stamp it once; never clear it on a move back,
    // because a piece that was published stays published historically.
    if (column?.terminal && patch.publishedAt === undefined) {
      row.published_at = new Date().toISOString();
    }
  }
  if (patch.scheduledAt !== undefined) row.scheduled_at = patch.scheduledAt;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
  if (patch.owner !== undefined) row.owner = patch.owner;
  if (patch.dueAt !== undefined) row.due_at = patch.dueAt;
  if (patch.priority !== undefined) row.priority = patch.priority;
  if (patch.notes !== undefined) row.notes = patch.notes;
  if (patch.blocked !== undefined) row.blocked = patch.blocked;
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.externalUrl !== undefined) row.external_url = patch.externalUrl;
  if (patch.publishedAt !== undefined) row.published_at = patch.publishedAt;
  // Linking a card to a funnel is a patch like any other, so setting a
  // destination never has to re-send the fields the drawer didn't load.
  if (patch.funnelId !== undefined) row.funnel_id = patch.funnelId;
  if (patch.funnelPage !== undefined) row.funnel_page = patch.funnelPage;
  // `!== undefined` throughout, not truthiness: '' is a meaningful value for
  // publish_state ("planned here only") and clearing it back to that has to be
  // expressible, which `if (patch.publishState)` would silently forbid.
  if (patch.publishState !== undefined) {
    row.publish_state = normalizePublishState(patch.publishState);
  }
  if (patch.publishTarget !== undefined) {
    row.publish_target = patch.publishTarget ?? '';
  }
  if (patch.publishRef !== undefined) row.publish_ref = patch.publishRef;
  if (patch.publishAccounts !== undefined) {
    row.publish_accounts = normalizePublishAccounts(patch.publishAccounts);
  }
  if (patch.publishSyncedAt !== undefined) {
    row.publish_synced_at = patch.publishSyncedAt;
  }
  if (patch.destinationUrl !== undefined) {
    row.destination_url = patch.destinationUrl;
  }

  try {
    const { data, error } = await (serviceClient() as any)
      .from(CONTENT_PLAN)
      .update(row)
      .eq('id', id)
      .select(PLAN_COLUMNS)
      .maybeSingle();
    if (error || !data) return null;
    return rowToContentPlan(data as ContentPlanRow, cols);
  } catch {
    return null;
  }
}

export async function deleteContentPlan(id: string): Promise<void> {
  const { error } = await (serviceClient() as any)
    .from(CONTENT_PLAN)
    .delete()
    .eq('id', id);
  if (error) throw new Error(`deleteContentPlan failed: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Lead pipeline (lead kanban)
// ---------------------------------------------------------------------------

/**
 * A pipeline record plus the identity fields the card needs to be readable.
 * `persisted` is false for a card seeded from lifecycle only — nothing has been
 * written to `mothermode_lead_pipeline` for that lead yet.
 */
export interface LeadBoardCard extends LeadPipelineRecord {
  email: string;
  firstName: string;
  createdAt: string | null;
  persisted: boolean;
}

/**
 * The lead board: every lead, overlaid with its pipeline row when one exists.
 *
 * Ordering is newest-lead-first before the board regroups by stage, so a fresh
 * opt-in appears at the top of "New" rather than buried under a month of
 * history.
 */
export async function listLeadBoard(opts?: {
  funnelId?: string | null;
  limit?: number;
  columns?: PlannerColumn[];
}): Promise<LeadBoardCard[]> {
  const columns = opts?.columns ?? (await getBoard('leads')).columns;
  try {
    let leadQuery = (serviceClient() as any)
      .from(LEADS)
      .select(
        'id, funnel_id, email, first_name, status, step_reached, purchased, purchase_amount_cents, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(opts?.limit ?? 500);
    if (opts?.funnelId) leadQuery = leadQuery.eq('funnel_id', opts.funnelId);

    const [{ data: leadRows }, { data: pipelineRows }] = await Promise.all([
      leadQuery,
      (serviceClient() as any).from(LEAD_PIPELINE).select(PIPELINE_COLUMNS),
    ]);
    if (!leadRows) return [];

    const overlay = new Map<string, LeadPipelineRecord>();
    for (const raw of (pipelineRows ?? []) as LeadPipelineRow[]) {
      overlay.set(raw.lead_id, rowToLeadPipeline(raw, columns));
    }

    return (leadRows as Record<string, any>[]).map((lead) => {
      const existing = overlay.get(lead.id as string);
      const base =
        existing ??
        seedLeadPipeline(
          {
            id: lead.id as string,
            funnelId: (lead.funnel_id as string) ?? null,
            status: (lead.status as string) ?? '',
            stepReached: (lead.step_reached as string) ?? '',
            purchased: Boolean(lead.purchased),
            purchaseAmountCents: Number(lead.purchase_amount_cents) || 0,
          },
          columns,
        );
      return {
        ...base,
        funnelId: base.funnelId ?? ((lead.funnel_id as string) ?? null),
        email: (lead.email as string) ?? '',
        firstName: (lead.first_name as string) ?? '',
        createdAt: (lead.created_at as string) ?? null,
        persisted: Boolean(existing),
      };
    });
  } catch {
    return [];
  }
}

export interface UpsertLeadPipelineInput {
  leadId: string;
  funnelId?: string | null;
  boardId?: string | null;
  stage?: string;
  /** True when a human moved the card — freezes event automation for this lead. */
  stageManual?: boolean;
  owner?: string | null;
  nextAction?: string;
  nextActionAt?: string | null;
  valueCents?: number;
  notes?: string;
  tags?: string[];
  sortOrder?: number;
  updatedBy?: string | null;
}

/**
 * Write a lead's pipeline row. Called by the board on drag and by the detail
 * editor; `stageManual` is the caller's decision, because a notes edit should
 * not silently freeze automation the way a drag does.
 */
export async function upsertLeadPipeline(
  input: UpsertLeadPipelineInput,
  columns?: PlannerColumn[],
): Promise<LeadPipelineRecord> {
  const cols = columns ?? (await getBoard('leads')).columns;
  const row: Record<string, unknown> = {
    lead_id: input.leadId,
    funnel_id: input.funnelId ?? null,
    board_id: input.boardId ?? null,
    stage: coerceStage(input.stage, cols),
    stage_manual: input.stageManual ?? false,
    owner: input.owner ?? null,
    next_action: input.nextAction ?? '',
    next_action_at: input.nextActionAt ?? null,
    value_cents: input.valueCents ?? 0,
    notes: input.notes ?? '',
    tags: input.tags ?? [],
    sort_order: input.sortOrder ?? 0,
    updated_by: input.updatedBy ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await (serviceClient() as any)
    .from(LEAD_PIPELINE)
    .upsert(row, { onConflict: 'lead_id' })
    .select(PIPELINE_COLUMNS)
    .single();
  if (error || !data) {
    throw new Error(
      `upsertLeadPipeline failed: ${error?.message ?? 'no row returned'}`,
    );
  }
  return rowToLeadPipeline(data as LeadPipelineRow, cols);
}

/**
 * Apply a funnel event to a lead's pipeline position.
 *
 * Called from the funnel event write path, so it must be cheap and silent:
 * every failure is swallowed and the funnel keeps working. The `===` identity
 * check is the whole point of `applyLeadEvent` returning the same reference
 * when nothing changed — a `sales_view` on an existing Customer, or on any
 * manually staged card, costs one read and zero writes.
 */
export async function applyFunnelEventToPipeline(input: {
  leadId: string;
  funnelId?: string | null;
  eventType: string;
}): Promise<void> {
  if (!input.leadId || !input.eventType) return;
  try {
    const columns = (await getBoard('leads')).columns;
    const { data } = await (serviceClient() as any)
      .from(LEAD_PIPELINE)
      .select(PIPELINE_COLUMNS)
      .eq('lead_id', input.leadId)
      .maybeSingle();

    // No row yet: derive the lead's implied position first, so an event never
    // resets a lead that already got further than the event it just fired.
    const current: LeadPipelineRecord = data
      ? rowToLeadPipeline(data as LeadPipelineRow, columns)
      : seedLeadPipeline(
          { id: input.leadId, funnelId: input.funnelId ?? null },
          columns,
        );

    const next = applyLeadEvent(current, input.eventType, columns);
    if (next === current && data) return; // nothing to write

    await upsertLeadPipeline(
      {
        leadId: input.leadId,
        funnelId: next.funnelId ?? input.funnelId ?? null,
        stage: next.stage,
        stageManual: next.stageManual,
        owner: next.owner,
        nextAction: next.nextAction,
        nextActionAt: next.nextActionAt,
        valueCents: next.valueCents,
        notes: next.notes,
        tags: next.tags,
        sortOrder: next.sortOrder,
      },
      columns,
    );
  } catch {
    // Non-fatal: the planner must never break lead capture or checkout.
  }
}
