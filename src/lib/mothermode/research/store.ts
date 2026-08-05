/**
 * Research Lab store. Admin-only tool: every read and write uses the
 * service-role client (which bypasses RLS). No anon path — the tables have no
 * anon policy. Mirrors email/store.ts conventions: lazy client, admin reads
 * degrade to [] / null, writes throw.
 */
import { createClient } from '@supabase/supabase-js';
import {
  rowToResearchSession,
  rowToResearchMessage,
  rowToResearchArtifact,
  rowToResearchArtifactVersion,
  sessionTitleFrom,
  shouldBumpArtifactVersion,
  type ResearchSession,
  type ResearchSessionRow,
  type ResearchSessionStatus,
  type ResearchMessage,
  type ResearchMessageRow,
  type ResearchArtifact,
  type ResearchArtifactRow,
  type ResearchArtifactVersion,
  type ResearchArtifactVersionRow,
  type ResearchArtifactType,
  type ResearchArtifactStatus,
  type ToolCallRecord,
  type HandedOffRef,
} from './types';
import type { ContextRef } from '@/lib/mothermode/context';
import type { ResearchIntake } from './intake';
import { sanitizeArtifactFields } from './redact';

import {
  rowToResearchEvidence,
  toEvidenceKind,
  type ResearchEvidence,
  type ResearchEvidenceRow,
} from './evidence';

const SESSIONS = 'mothermode_research_sessions';
const MESSAGES = 'mothermode_research_messages';
const ARTIFACTS = 'mothermode_research_artifacts';
const ARTIFACT_VERSIONS = 'mothermode_research_artifact_versions';
const CALL_LOG = 'mothermode_research_call_log';
const EVIDENCE = 'mothermode_research_evidence';

const SESSION_COLUMNS =
  'id, title, offer_slug, context_refs, intake, status, created_at, updated_at, updated_by';
const MESSAGE_COLUMNS =
  'id, session_id, role, content, tool_calls, model, expert_slug, recipe_run_id, recipe_step_index, created_at';
const ARTIFACT_COLUMNS =
  'id, session_id, type, title, markdown, structured, status, handed_off_to, version, parent_id, created_by, created_at, updated_at';
const ARTIFACT_VERSION_COLUMNS =
  'id, artifact_id, version, type, title, markdown, structured, created_by, created_at';
const EVIDENCE_COLUMNS =
  'id, session_id, artifact_id, offer_slug, kind, body, source_url, source_tool, expert, created_by, created_at';

// Service-role client for admin reads and all writes. Lazy so the module never
// throws on missing env at import time.
let _service: ReturnType<typeof createClient> | null = null;
function serviceClient() {
  if (_service) return _service;
  _service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );
  return _service;
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/** Admin read: active sessions first, newest first. Returns [] on failure. */
export async function listSessions(opts?: {
  includeArchived?: boolean;
}): Promise<ResearchSession[]> {
  try {
    let query = (serviceClient() as any)
      .from(SESSIONS)
      .select(SESSION_COLUMNS)
      .order('updated_at', { ascending: false });
    if (!opts?.includeArchived) query = query.neq('status', 'archived');
    const { data, error } = await query;
    if (error || !data) return [];
    return (data as ResearchSessionRow[]).map(rowToResearchSession);
  } catch {
    return [];
  }
}

/** Admin read: one session by id, or null. */
export async function getSession(id: string): Promise<ResearchSession | null> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(SESSIONS)
      .select(SESSION_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return rowToResearchSession(data as ResearchSessionRow);
  } catch {
    return null;
  }
}

export interface UpsertSessionInput {
  id?: string | null;
  title?: string;
  offerSlug?: string;
  contextRefs?: ContextRef[];
  intake?: ResearchIntake;
  status?: ResearchSessionStatus;
  updatedBy?: string | null;
}

/** Admin-only upsert. Insert when `id` is absent, update in place otherwise. */
export async function upsertSession(
  input: UpsertSessionInput,
): Promise<ResearchSession> {
  const row: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: input.updatedBy ?? null,
  };
  if (input.title !== undefined) row.title = input.title.trim() || 'New research';
  if (input.offerSlug !== undefined) row.offer_slug = input.offerSlug.trim();
  if (input.contextRefs !== undefined) row.context_refs = input.contextRefs;
  if (input.intake !== undefined) row.intake = input.intake;
  if (input.status !== undefined) row.status = input.status;

  if (input.id) {
    const { data, error } = await (serviceClient() as any)
      .from(SESSIONS)
      .update(row)
      .eq('id', input.id)
      .select(SESSION_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return rowToResearchSession(data as ResearchSessionRow);
  }

  if (row.title === undefined) row.title = 'New research';
  const { data, error } = await (serviceClient() as any)
    .from(SESSIONS)
    .insert(row)
    .select(SESSION_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return rowToResearchSession(data as ResearchSessionRow);
}

/** Admin-only removal by id (messages + artifacts cascade). */
export async function deleteSession(id: string): Promise<void> {
  const { error } = await (serviceClient() as any)
    .from(SESSIONS)
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Bump updated_at (called on every message append so the session list stays
 * recency-ordered) and set a real title once the first user message exists.
 */
export async function touchSession(
  id: string,
  firstUserText?: string,
): Promise<void> {
  try {
    const row: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (firstUserText) row.title = sessionTitleFrom(firstUserText);
    await (serviceClient() as any).from(SESSIONS).update(row).eq('id', id);
  } catch {
    /* recency ordering is best-effort */
  }
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/** Admin read: a session's messages, oldest first. Returns [] on failure. */
export async function listMessages(
  sessionId: string,
  opts?: { limit?: number },
): Promise<ResearchMessage[]> {
  try {
    let query = (serviceClient() as any)
      .from(MESSAGES)
      .select(MESSAGE_COLUMNS)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    if (opts?.limit && opts.limit > 0) query = query.limit(opts.limit);
    const { data, error } = await query;
    if (error || !data) return [];
    return (data as ResearchMessageRow[]).map(rowToResearchMessage);
  } catch {
    return [];
  }
}

export interface AppendMessageInput {
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCallRecord[];
  model?: string;
  /** Provenance: the expert config that produced this turn. */
  expertSlug?: string;
  /** Provenance: the recipe run + 0-based step this turn belongs to. */
  recipeRunId?: string;
  recipeStepIndex?: number;
}

/** Append one chat turn; returns the persisted row. */
export async function appendMessage(
  input: AppendMessageInput,
): Promise<ResearchMessage> {
  const { data, error } = await (serviceClient() as any)
    .from(MESSAGES)
    .insert({
      session_id: input.sessionId,
      role: input.role,
      content: input.content,
      tool_calls: input.toolCalls ?? [],
      model: input.model ?? '',
      expert_slug: input.expertSlug?.trim() || null,
      recipe_run_id: input.recipeRunId?.trim() || null,
      recipe_step_index:
        typeof input.recipeStepIndex === 'number' &&
        Number.isFinite(input.recipeStepIndex)
          ? Math.max(0, Math.floor(input.recipeStepIndex))
          : null,
    })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return rowToResearchMessage(data as ResearchMessageRow);
}

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

/**
 * Admin read: a session's artifacts, newest first. THROWS on read failure —
 * an empty rail from a swallowed error is indistinguishable from "no
 * artifacts", which is exactly the bug report this change answers.
 */
export async function listArtifacts(
  sessionId: string,
): Promise<ResearchArtifact[]> {
  const { data, error } = await (serviceClient() as any)
    .from(ARTIFACTS)
    .select(ARTIFACT_COLUMNS)
    .eq('session_id', sessionId)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ResearchArtifactRow[]).map(rowToResearchArtifact);
}

/**
 * Admin read: artifacts by id, any session (the scorecards' fate join —
 * runs span sessions, so per-session reads would fan out). THROWS on
 * failure, like listArtifacts: a swallowed empty read would make every
 * fate look 'deleted', the worst lie available here.
 *
 * Ids are deduped and capped (default 1000) because PostgREST `in` lists
 * have URL limits. Past the cap the map is PARTIAL — callers must treat a
 * miss as "not returned", which is why the scorecards read only
 * references ids from the runs being scored (far under the cap).
 */
export async function listArtifactsByIds(
  ids: string[],
  opts?: { cap?: number },
): Promise<Map<string, ResearchArtifact>> {
  const cap = Math.max(1, Math.floor(opts?.cap ?? 1000));
  const unique: string[] = [];
  for (const raw of ids) {
    const id = (raw || '').trim();
    if (id && !unique.includes(id)) unique.push(id);
    if (unique.length >= cap) break;
  }
  const out = new Map<string, ResearchArtifact>();
  if (unique.length === 0) return out;
  const { data, error } = await (serviceClient() as any)
    .from(ARTIFACTS)
    .select(ARTIFACT_COLUMNS)
    .in('id', unique);
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as ResearchArtifactRow[]) {
    out.set(row.id, rowToResearchArtifact(row));
  }
  return out;
}

/** Admin read: one artifact by id, or null. */
export async function getArtifact(
  id: string,
): Promise<ResearchArtifact | null> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(ARTIFACTS)
      .select(ARTIFACT_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return rowToResearchArtifact(data as ResearchArtifactRow);
  } catch {
    return null;
  }
}

export interface UpsertArtifactInput {
  id?: string | null;
  sessionId: string;
  type?: ResearchArtifactType;
  title?: string;
  markdown?: string;
  structured?: Record<string, unknown>;
  status?: ResearchArtifactStatus;
  handedOffTo?: HandedOffRef | null;
  /** The expert slug creating/editing ('research' from the agent, 'owner'
   *  for hand edits). '' = keep the existing value / 'agent' on creation. */
  createdBy?: string;
  /** Lineage: the artifact this one derives from (recipes stamp it). */
  parentId?: string;
}

/** Append one snapshot to the versions table (best-effort: never blocks
 *  the artifact write it follows). */
async function snapshotArtifactVersion(a: ResearchArtifact): Promise<void> {
  try {
    await (serviceClient() as any).from(ARTIFACT_VERSIONS).insert({
      artifact_id: a.id,
      version: a.version,
      type: a.type,
      title: a.title,
      markdown: a.markdown,
      structured: a.structured,
      created_by: a.createdBy,
    });
  } catch {
    /* a missed snapshot is a gap in history, never a failed save */
  }
}

/**
 * Admin-only upsert (roadmap 1.4). Insert when `id` is absent, update in
 * place otherwise. Content-changing updates (type/title/markdown/structured,
 * decided by shouldBumpArtifactVersion) bump `version` and append an
 * append-only snapshot; status/handoff flips never bump.
 */
export async function upsertArtifact(
  input: UpsertArtifactInput,
): Promise<ResearchArtifact> {
  // THE SECRET SCAN (roadmap Phase 3): title/markdown/structured pass the
  // redaction vocabulary on the way IN, so a persona (or a paste into the
  // editor) can never store a credential — every downstream surface (the
  // drawer, the handoffs, the public recap) then reads clean data. The
  // bump comparison below uses the SANITIZED fields, so a write whose
  // only change is a newly-masked secret still versions honestly.
  const clean = sanitizeArtifactFields({
    title: input.title,
    markdown: input.markdown,
    structured: input.structured,
  });
  const row: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.type !== undefined) row.type = input.type;
  if (clean.title !== undefined) row.title = clean.title;
  if (clean.markdown !== undefined) row.markdown = clean.markdown;
  if (clean.structured !== undefined) row.structured = clean.structured;

  if (input.status !== undefined) row.status = input.status;
  if (input.handedOffTo !== undefined) row.handed_off_to = input.handedOffTo;
  if (input.parentId !== undefined) row.parent_id = input.parentId || null;
  if (input.createdBy) row.created_by = input.createdBy;

  if (input.id) {
    // The bump decision needs the CURRENT row's content (metadata-only
    // updates must not version).
    const prev = await getArtifact(input.id);
    const bump =
      prev !== null &&
      shouldBumpArtifactVersion(prev, {
        type: input.type,
        title: clean.title,
        markdown: clean.markdown,
        structured: clean.structured,
      });

    if (bump) row.version = prev.version + 1;
    const { data, error } = await (serviceClient() as any)
      .from(ARTIFACTS)
      .update(row)
      .eq('id', input.id)
      .select(ARTIFACT_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    const artifact = rowToResearchArtifact(data as ResearchArtifactRow);
    if (bump) await snapshotArtifactVersion(artifact);
    return artifact;
  }

  row.session_id = input.sessionId;
  if (row.type === undefined) row.type = 'research-brief';
  if (row.title === undefined) row.title = '';
  if (row.markdown === undefined) row.markdown = '';
  if (row.structured === undefined) row.structured = {};
  row.version = 1;
  const { data, error } = await (serviceClient() as any)
    .from(ARTIFACTS)
    .insert(row)
    .select(ARTIFACT_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  const artifact = rowToResearchArtifact(data as ResearchArtifactRow);
  await snapshotArtifactVersion(artifact);
  return artifact;
}

/** Admin read: an artifact's version history, newest first. [] on failure. */
export async function listArtifactVersions(
  artifactId: string,
): Promise<ResearchArtifactVersion[]> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(ARTIFACT_VERSIONS)
      .select(ARTIFACT_VERSION_COLUMNS)
      .eq('artifact_id', artifactId)
      .order('version', { ascending: false });
    if (error || !data) return [];
    return (data as ResearchArtifactVersionRow[]).map(
      rowToResearchArtifactVersion,
    );
  } catch {
    return [];
  }
}

/** Admin-only removal by id. */
export async function deleteArtifact(id: string): Promise<void> {
  const { error } = await (serviceClient() as any)
    .from(ARTIFACTS)
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Agent call telemetry (roadmap task 0.3)
// ---------------------------------------------------------------------------

export interface LogAgentCallInput {
sessionId: string;
  tool: string;
  inputSummary: string;
  status: string;
  resultSummary: string;
  ms: number;
  cached: boolean;
  estCostCents: number;
  /** Phase 4 provenance: which expert made the call, and (for recipe
   *  turns) which run. Both ride nullable columns (migration
   *  20261118000000); included only when set, so chat-turn writes stay
   *  byte-identical and pre-migration chat writes never fail. */
  expertSlug?: string;
  recipeRunId?: string;
}

/**
 * Telemetry write: one row per tool call. THROWS on failure — the loop
 * catches per call, because telemetry must never break a research turn.
 */
export async function logAgentCall(input: LogAgentCallInput): Promise<void> {
  const { error } = await (serviceClient() as any).from(CALL_LOG).insert({
    session_id: input.sessionId,
    tool: input.tool,
    input_summary: input.inputSummary,
    status: input.status,
    result_summary: input.resultSummary,
    ms: Math.max(0, Math.round(input.ms)),
    cached: input.cached,
    est_cost_cents: Math.max(0, Math.round(input.estCostCents)),
    ...(input.expertSlug ? { expert_slug: input.expertSlug } : {}),
    ...(input.recipeRunId ? { recipe_run_id: input.recipeRunId } : {}),
  });
  if (error) throw new Error(error.message);
}

/**
 * Phase 4: MEASURED per-expert cost for a set of runs — est cents summed
 * by expert over call-log rows stamped with those run ids. Returns NULL
 * on any failure (a missing column pre-migration, a read error) — the
 * scorecard falls back to its step-share allocation, honestly marked.
 * A run with no stamped rows is simply absent from the map (its calls
 * predate the stamp), which the builder treats as "unknown → allocate".
 */
export async function readExpertCostByRun(
  runIds: string[],
): Promise<Map<string, number> | null> {
  if (runIds.length === 0) return new Map();
  const { data, error } = await (serviceClient() as any)
    .from(CALL_LOG)
    .select('expert_slug, est_cost_cents')
    .in('recipe_run_id', runIds.slice(0, 500))
    .not('expert_slug', 'is', null);
  if (error) return null;
  const out = new Map<string, number>();
  for (const row of data ?? []) {
    const slug = typeof row.expert_slug === 'string' ? row.expert_slug.trim() : '';
    const cents =
      typeof row.est_cost_cents === 'number' && Number.isFinite(row.est_cost_cents)
        ? Math.max(0, Math.round(row.est_cost_cents))
        : 0;
    if (slug) out.set(slug, (out.get(slug) ?? 0) + cents);
  }
  return out;
}


/**
 * Today's paid usage for one session (the budget's input, roadmap 2.4).
 * Degrades to zeros on failure — a dead log table never BLOCKS research,
 * consistent with the telemetry rule.
 */
export async function readCallUsage(sessionId: string): Promise<{
  paidRunsToday: number;
  estCostCentsToday: number;
}> {
  try {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const { data, error } = await (serviceClient() as any)
      .from(CALL_LOG)
      .select('est_cost_cents')
      .eq('session_id', sessionId)
      .gte('created_at', since.toISOString());
    if (error || !data) return { paidRunsToday: 0, estCostCentsToday: 0 };
    let paidRuns = 0;
    let cents = 0;
    for (const row of data as Array<{ est_cost_cents: number | null }>) {
      const c = row.est_cost_cents ?? 0;
      if (c > 0) {
        paidRuns += 1;
        cents += c;
      }
    }
    return { paidRunsToday: paidRuns, estCostCentsToday: cents };
  } catch {
    return { paidRunsToday: 0, estCostCentsToday: 0 };
  }
}

/**
 * Today's spend across EVERY session (Mission Control's fleet meter).
 * NULL on failure, unlike the per-session read: a display meter must say
 * "unknown", not $0.00 — zero on a broken read would look like a free day.
 */
export async function readFleetUsageToday(): Promise<number | null> {
  try {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const { data, error } = await (serviceClient() as any)
      .from(CALL_LOG)
      .select('est_cost_cents')
      .gte('created_at', since.toISOString());
    if (error || !data) return null;
    let cents = 0;
    for (const row of data as Array<{ est_cost_cents: number | null }>) {
      cents += row.est_cost_cents ?? 0;
    }
    return cents;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// The evidence base (roadmap task 2.1)
// ---------------------------------------------------------------------------

export interface PinEvidenceInput {
  sessionId: string;
  artifactId?: string;
  offerSlug?: string;
  kind?: string;
  body: string;
  sourceUrl?: string;
  sourceTool?: string;
  expert?: string;
  createdBy?: string;
}

/** Pin one piece of evidence (verbatim text + provenance). THROWS on
 *  failure — the route surfaces it. */
export async function pinEvidence(
  input: PinEvidenceInput,
): Promise<ResearchEvidence> {
  const { data, error } = await (serviceClient() as any)
    .from(EVIDENCE)
    .insert({
      session_id: input.sessionId,
      artifact_id: input.artifactId || null,
      offer_slug: (input.offerSlug || '').trim(),
      kind: toEvidenceKind(input.kind),
      body: input.body,
      source_url: (input.sourceUrl || '').trim(),
      source_tool: (input.sourceTool || '').trim(),
      expert: (input.expert || '').trim(),
      created_by: (input.createdBy || '').trim() || 'agent',
    })
    .select(EVIDENCE_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return rowToResearchEvidence(data as ResearchEvidenceRow);
}

/** Admin read: a session's evidence, newest first. [] on failure. */
export async function listEvidence(
  sessionId: string,
): Promise<ResearchEvidence[]> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(EVIDENCE)
      .select(EVIDENCE_COLUMNS)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return (data as ResearchEvidenceRow[]).map(rowToResearchEvidence);
  } catch {
    return [];
  }
}

/** Admin-only removal by id. */
export async function deleteEvidence(id: string): Promise<void> {
  const { error } = await (serviceClient() as any)
    .from(EVIDENCE)
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}
