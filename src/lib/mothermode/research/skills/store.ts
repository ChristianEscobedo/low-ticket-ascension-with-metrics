/**
 * Skills store (Phase 3): the rows + the outcome accounting behind the
 * circuit breaker. Service-role only, lazy client, reads DEGRADE
 * ([] / null), writes throw — the house pattern.
 *
 * Agent calls log into the shared call log as tool `skill:<slug>` with
 * the row's cost estimate, so the fleet meter and the per-day rate limit
 * read the SAME ledger the rest of the loop already uses.
 */
import { createClient } from '@supabase/supabase-js';
import {
  rowToSkill,
  SKILL_BREAKER_FAILURES,
  type ResearchSkill,
  type SkillExecutor,
  type SkillRow,
  type SkillStatus,
} from './types';

const TABLE = 'mothermode_research_skills';
const CALL_LOG = 'mothermode_research_call_log';
const COLUMNS =
  'id, slug, name, description, input_keys, allowed_hosts, executor, cost_est_cents, max_calls_per_day, status, consecutive_failures, last_called_at, created_at, updated_at';

let _service: ReturnType<typeof createClient> | null = null;
function serviceClient() {
  if (_service) return _service;
  _service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );
  return _service;
}

/** Admin read: every skill, slug order. [] on failure. */
export async function listSkills(): Promise<ResearchSkill[]> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(TABLE)
      .select(COLUMNS)
      .order('slug', { ascending: true });
    if (error || !data) return [];
    return (data as SkillRow[]).map(rowToSkill);
  } catch {
    return [];
  }
}

/** Admin read: the ACTIVE skills (the agent bridge's set). [] on failure. */
export async function listActiveSkills(): Promise<ResearchSkill[]> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(TABLE)
      .select(COLUMNS)
      .eq('status', 'active')
      .order('slug', { ascending: true });
    if (error || !data) return [];
    return (data as SkillRow[]).map(rowToSkill);
  } catch {
    return [];
  }
}

/** Admin read: one skill by id, or null. */
export async function getSkill(id: string): Promise<ResearchSkill | null> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(TABLE)
      .select(COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return rowToSkill(data as SkillRow);
  } catch {
    return null;
  }
}

/** Create or update by slug. The ROUTE validates before calling; an
 *  activation with validation errors is refused there, not here. */
export async function upsertSkill(input: {
  slug: string;
  name: string;
  description?: string;
  inputKeys?: string[];
  allowedHosts?: string[];
  executor?: SkillExecutor;
  costEstCents?: number;
  maxCallsPerDay?: number;
  status?: SkillStatus;
}): Promise<ResearchSkill> {
  const slug = (input.slug || '').trim();
  if (!slug) throw new Error('slug is required');
  const row: Record<string, unknown> = {
    slug,
    updated_at: new Date().toISOString(),
  };
  if (input.name !== undefined) row.name = input.name;
  if (input.description !== undefined) row.description = input.description;
  if (input.inputKeys !== undefined) row.input_keys = input.inputKeys;
  if (input.allowedHosts !== undefined) row.allowed_hosts = input.allowedHosts;
  if (input.executor !== undefined) row.executor = input.executor;
  if (input.costEstCents !== undefined)
    row.cost_est_cents = Math.max(0, Math.floor(input.costEstCents));
  if (input.maxCallsPerDay !== undefined)
    row.max_calls_per_day = Math.max(1, Math.floor(input.maxCallsPerDay));
  if (input.status !== undefined) row.status = input.status;
  const { data, error } = await (serviceClient() as any)
    .from(TABLE)
    .upsert(row, { onConflict: 'slug' })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return rowToSkill(data as SkillRow);
}

/** Patch status (the pause/unpause actions) — throws on failure. */
export async function updateSkillStatus(
  id: string,
  status: SkillStatus,
): Promise<void> {
  const { error } = await (serviceClient() as any)
    .from(TABLE)
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * The outcome accounting behind the breaker: success zeroes the streak;
 * a failure increments it and, at SKILL_BREAKER_FAILURES, the skill
 * pauses ITSELF — a dead endpoint stops burning money without waiting
 * for anyone to notice. Best-effort: the accounting never fails the call
 * it records.
 */
export async function recordSkillOutcome(
  id: string,
  ok: boolean,
): Promise<void> {
  try {
    const skill = await getSkill(id);
    if (!skill) return;
    const patch: Record<string, unknown> = {
      last_called_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (ok) {
      patch.consecutive_failures = 0;
    } else {
      const failures = skill.consecutiveFailures + 1;
      patch.consecutive_failures = failures;
      if (failures >= SKILL_BREAKER_FAILURES && skill.status === 'active') {
        patch.status = 'paused';
      }
    }
    await (serviceClient() as any).from(TABLE).update(patch).eq('id', id);
  } catch {
    /* accounting never blocks */
  }
}

/** Today's AGENT calls of one skill, from the shared call log. Degrades
 *  to 0 — a dead log never blocks the lane (the readCallUsage rule). */
export async function readSkillCallsToday(slug: string): Promise<number> {
  try {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const { data, error } = await (serviceClient() as any)
      .from(CALL_LOG)
      .select('id')
      .eq('tool', `skill:${slug}`)
      .gte('created_at', since.toISOString());
    if (error || !data) return 0;
    return (data as unknown[]).length;
  } catch {
    return 0;
  }
}

/** Remove a skill. */
export async function deleteSkill(id: string): Promise<void> {
  const { error } = await (serviceClient() as any)
    .from(TABLE)
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}
