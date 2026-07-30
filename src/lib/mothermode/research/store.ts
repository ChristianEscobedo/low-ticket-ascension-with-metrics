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
  sessionTitleFrom,
  type ResearchSession,
  type ResearchSessionRow,
  type ResearchSessionStatus,
  type ResearchMessage,
  type ResearchMessageRow,
  type ResearchArtifact,
  type ResearchArtifactRow,
  type ResearchArtifactType,
  type ResearchArtifactStatus,
  type ToolCallRecord,
  type HandedOffRef,
} from './types';
import type { ContextRef } from '@/lib/mothermode/context';
import type { ResearchIntake } from './intake';

const SESSIONS = 'mothermode_research_sessions';
const MESSAGES = 'mothermode_research_messages';
const ARTIFACTS = 'mothermode_research_artifacts';

const SESSION_COLUMNS =
  'id, title, offer_slug, context_refs, intake, status, created_at, updated_at, updated_by';
const MESSAGE_COLUMNS =
  'id, session_id, role, content, tool_calls, model, created_at';
const ARTIFACT_COLUMNS =
  'id, session_id, type, title, markdown, structured, status, handed_off_to, created_at, updated_at';

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
}

/** Admin-only upsert. Insert when `id` is absent, update in place otherwise. */
export async function upsertArtifact(
  input: UpsertArtifactInput,
): Promise<ResearchArtifact> {
  const row: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.type !== undefined) row.type = input.type;
  if (input.title !== undefined) row.title = input.title;
  if (input.markdown !== undefined) row.markdown = input.markdown;
  if (input.structured !== undefined) row.structured = input.structured;
  if (input.status !== undefined) row.status = input.status;
  if (input.handedOffTo !== undefined) row.handed_off_to = input.handedOffTo;

  if (input.id) {
    const { data, error } = await (serviceClient() as any)
      .from(ARTIFACTS)
      .update(row)
      .eq('id', input.id)
      .select(ARTIFACT_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return rowToResearchArtifact(data as ResearchArtifactRow);
  }

  row.session_id = input.sessionId;
  if (row.type === undefined) row.type = 'research-brief';
  if (row.title === undefined) row.title = '';
  if (row.markdown === undefined) row.markdown = '';
  if (row.structured === undefined) row.structured = {};
  const { data, error } = await (serviceClient() as any)
    .from(ARTIFACTS)
    .insert(row)
    .select(ARTIFACT_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return rowToResearchArtifact(data as ResearchArtifactRow);
}

/** Admin-only removal by id. */
export async function deleteArtifact(id: string): Promise<void> {
  const { error } = await (serviceClient() as any)
    .from(ARTIFACTS)
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}
