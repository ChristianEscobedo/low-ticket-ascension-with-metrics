/**
 * The blueprint store: the `system_blueprints` table's read/write half.
 *
 * Service-role only, lazy client, and the house's two error policies:
 *   - READS DEGREE ([] / null) — a dead table never takes the System Map down;
 *     the pending overlay just renders nothing.
 *   - WRITES THROW — a proposal that fails to persist, or an approve that
 *     can't flip the status, must surface loudly. A silent blueprint is the
 *     wrong default (the operator would approve a ghost).
 *
 * This table only ever holds the PROPOSAL and its lifecycle — never a source
 * record. The gated invariant lives here by construction: `createBlueprint`
 * writes a 'proposed' row (the overlay), and only `materializeBlueprint`
 * (research/skills/blueprint.ts, invoked solely by the approve route) writes
 * to a source table.
 */
import { createClient } from '@supabase/supabase-js';
import {
  rowToBlueprint,
  toBlueprintStatus,
  type BlueprintMode,
  type BlueprintNode,
  type BlueprintSource,
  type BlueprintStatus,
  type SystemBlueprint,
  type SystemBlueprintRow,
} from './blueprint';

const TABLE = 'system_blueprints';
const COLUMNS =
  'id, name, mode, source, nodes, status, recipe_run_id, created_at, updated_at';

let _service: ReturnType<typeof createClient> | null = null;
function serviceClient() {
  if (_service) return _service;
  _service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );
  return _service;
}

/** Admin read: every blueprint, newest first. [] on failure. */
export async function listBlueprints(opts?: {
  status?: BlueprintStatus;
}): Promise<SystemBlueprint[]> {
  try {
    let query = (serviceClient() as any)
      .from(TABLE)
      .select(COLUMNS)
      .order('created_at', { ascending: false })
      .limit(200);
    if (opts?.status) query = query.eq('status', opts.status);
    const { data, error } = await query;
    if (error || !data) return [];
    return (data as SystemBlueprintRow[]).map(rowToBlueprint);
  } catch {
    return [];
  }
}

/** Admin read: the proposed blueprints — the map's pending overlay. [] on failure. */
export async function listPendingBlueprints(): Promise<SystemBlueprint[]> {
  return listBlueprints({ status: 'proposed' });
}

/** Admin read: one blueprint by id, or null. */
export async function getBlueprint(id: string): Promise<SystemBlueprint | null> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(TABLE)
      .select(COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return rowToBlueprint(data as SystemBlueprintRow);
  } catch {
    return null;
  }
}

/**
 * Persist a proposal. Always lands as 'proposed' — a blueprint is never born
 * materialized (the gated pattern). Throws on failure.
 */
export async function createBlueprint(input: {
  name: string;
  mode: BlueprintMode;
  source: BlueprintSource;
  nodes: BlueprintNode[];
  recipeRunId?: string | null;
}): Promise<SystemBlueprint> {
  const row: Record<string, unknown> = {
    name: input.name,
    mode: input.mode,
    source: input.source,
    nodes: input.nodes,
    status: 'proposed',
    recipe_run_id: input.recipeRunId ?? null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await (serviceClient() as any)
    .from(TABLE)
    .insert(row)
    .select(COLUMNS)
    .single();
  if (error || !data) {
    throw new Error(`createBlueprint failed: ${error?.message ?? 'no row returned'}`);
  }
  return rowToBlueprint(data as SystemBlueprintRow);
}

/**
 * Flip the status (proposed → approved/materialized, or → rejected). Throws on
 * failure — an approve that doesn't persist would leave the operator thinking
 * a system is live when it isn't.
 */
export async function setBlueprintStatus(
  id: string,
  status: BlueprintStatus,
): Promise<void> {
  const next = toBlueprintStatus(status);
  const { error } = await (serviceClient() as any)
    .from(TABLE)
    .update({ status: next, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(`setBlueprintStatus failed: ${error.message}`);
}

/** Remove a proposal (the reject-and-discard path). Throws on failure. */
export async function deleteBlueprint(id: string): Promise<void> {
  const { error } = await (serviceClient() as any)
    .from(TABLE)
    .delete()
    .eq('id', id);
  if (error) throw new Error(`deleteBlueprint failed: ${error.message}`);
}
