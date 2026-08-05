/**
 * The background job lane (roadmap 4.1): job rows + the claim/update
 * primitives the tick worker uses. Admin-only: service-role client, lazy
 * like the other research stores. Reads DEGRADE ([] / null); writes throw.
 */
import { createClient } from '@supabase/supabase-js';

const JOBS = 'mothermode_agent_jobs';
const COLUMNS =
  'id, kind, ref_id, status, progress, error, created_at, started_at, finished_at';

export const AGENT_JOB_STATUSES = [
  'queued',
  'running',
  'done',
  'failed',
  'canceled',
] as const;
export type AgentJobStatus = (typeof AGENT_JOB_STATUSES)[number];

export interface AgentJob {
  id: string;
  kind: string;
  refId: string;
  status: AgentJobStatus;
  progress: { step: number; total: number; note: string };
  error: string;
  createdAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface AgentJobRow {
  id: string;
  kind: string | null;
  ref_id: string;
  status: string | null;
  progress: unknown;
  error: string | null;
  created_at: string | null;
  started_at: string | null;
  finished_at: string | null;
}

function toStatus(v: unknown): AgentJobStatus {
  return v === 'running' || v === 'done' || v === 'failed' || v === 'canceled'
    ? v
    : 'queued';
}

/** Defensive row -> job. */
export function rowToAgentJob(row: AgentJobRow): AgentJob {
  const p =
    row.progress && typeof row.progress === 'object' && !Array.isArray(row.progress)
      ? (row.progress as Record<string, unknown>)
      : {};
  return {
    id: row.id,
    kind: (row.kind || '').trim() || 'recipe-run',
    refId: row.ref_id,
    status: toStatus(row.status),
    progress: {
      step:
        typeof p.step === 'number' && Number.isFinite(p.step)
          ? Math.floor(p.step)
          : 0,
      total:
        typeof p.total === 'number' && Number.isFinite(p.total)
          ? Math.floor(p.total)
          : 0,
      note: typeof p.note === 'string' ? p.note : '',
    },
    error: (row.error || '').trim(),
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

let _service: ReturnType<typeof createClient> | null = null;
function serviceClient() {
  if (_service) return _service;
  _service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );
  return _service;
}

/** Queue a job. */
export async function createAgentJob(input: {
  kind: string;
  refId: string;
  total?: number;
}): Promise<AgentJob> {
  const { data, error } = await (serviceClient() as any)
    .from(JOBS)
    .insert({
      kind: input.kind,
      ref_id: input.refId,
      status: 'queued',
      progress: { step: 0, total: input.total ?? 0, note: 'queued' },
    })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return rowToAgentJob(data as AgentJobRow);
}

/** Admin read: recent jobs, newest first. [] on failure. */
export async function listAgentJobs(opts?: {
  limit?: number;
}): Promise<AgentJob[]> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(JOBS)
      .select(COLUMNS)
      .order('created_at', { ascending: false })
      .limit(opts?.limit ?? 20);
    if (error || !data) return [];
    return (data as AgentJobRow[]).map(rowToAgentJob);
  } catch {
    return [];
  }
}

/** Admin read: one job by id, or null. */
export async function getAgentJob(id: string): Promise<AgentJob | null> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(JOBS)
      .select(COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return rowToAgentJob(data as AgentJobRow);
  } catch {
    return null;
  }
}

/** A claimed job gets this long to finish before the lane takes it back —
 *  a crashed tick (deploy, timeout, OOM) must never wedge the queue. */
export const AGENT_JOB_LEASE_MS = 15 * 60 * 1000;

/**
 * Claim the OLDEST queued job (queued -> running). Returns null when the
 * lane is empty. The update is conditional on the row still being queued,
 * so two ticks never claim the same job.
 *
 * First: requeue STALE running jobs (running, unfinished, started more
 * than AGENT_JOB_LEASE_MS ago) — the lease that keeps the lane honest.
 */
export async function claimNextAgentJob(): Promise<AgentJob | null> {
  try {
    const staleBefore = new Date(Date.now() - AGENT_JOB_LEASE_MS).toISOString();
    await (serviceClient() as any)
      .from(JOBS)
      .update({ status: 'queued' })
      .eq('status', 'running')
      .is('finished_at', null)
      .lt('started_at', staleBefore);

    const { data: next, error: readError } = await (serviceClient() as any)
      .from(JOBS)
      .select('id')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (readError || !next) return null;
    const { data, error } = await (serviceClient() as any)
      .from(JOBS)
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', next.id)
      .eq('status', 'queued')
      .select(COLUMNS)
      .maybeSingle();
    if (error || !data) return null;
    return rowToAgentJob(data as AgentJobRow);
  } catch {
    return null;
  }
}

/** Patch a job (progress stamps, finish states). */
export async function updateAgentJob(
  id: string,
  patch: Partial<{
    status: AgentJobStatus;
    progress: AgentJob['progress'];
    error: string;
    finishedAt: string | null;
  }>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.progress !== undefined) row.progress = patch.progress;
  if (patch.error !== undefined) row.error = patch.error;
  if (patch.finishedAt !== undefined) row.finished_at = patch.finishedAt;
  const { error } = await (serviceClient() as any)
    .from(JOBS)
    .update(row)
    .eq('id', id);
  if (error) throw new Error(error.message);
}
