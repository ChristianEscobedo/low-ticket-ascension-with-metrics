/**
 * Agent Recipes store (roadmap 3.1). Admin-only: service-role client, lazy
 * like research/store.ts. Reads DEGRADE ([] / null) so a missing table
 * never breaks the workspace; writes throw.
 */
import { createClient } from '@supabase/supabase-js';
import {
  rowToRecipe,
  rowToRecipeRun,
  initialStepsState,
  type Recipe,
  type RecipeRow,
  type RecipeRun,
  type RecipeRunRow,
} from './types';

const RECIPES = 'mothermode_recipes';
const RUNS = 'mothermode_recipe_runs';
const RUN_EVENTS = 'mothermode_recipe_run_events';
const RECIPE_COLUMNS =
  'id, slug, name, description, steps, budget_est_cents, status, citation_mode, created_at, updated_at';
// Pre-Phase-4 column list: reads fall back to it when the migration is
// not applied yet (citationMode maps to 'flag' — the v1 behavior).
const RECIPE_COLUMNS_PRE_V2 =
  'id, slug, name, description, steps, budget_est_cents, status, created_at, updated_at';

/** True when the DB says citation_mode doesn't exist (migration pending). */
function isMissingCitationMode(error: unknown): boolean {
  return /citation_mode/i.test(
    (error as { message?: string } | null)?.message ?? '',
  );
}


const RUN_COLUMNS =
  'id, recipe_id, session_id, status, current_step, steps_state, est_cost_cents, created_at, updated_at';
const RUN_EVENT_COLUMNS = 'id, run_id, kind, step_index, text, created_at';

/** Admin read: the FLEET's events, newest first (Mission Control's live
 *  feed) — every run, one bounded read. [] on failure. */
export async function listRecentRunEvents(opts?: {
  limit?: number;
}): Promise<RecipeRunEvent[]> {
  const limit = Math.max(1, Math.floor(opts?.limit ?? 30));
  try {
    const { data, error } = await (serviceClient() as any)
      .from(RUN_EVENTS)
      .select(RUN_EVENT_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return (data as RecipeRunEventRow[]).map(rowToRunEvent);
  } catch {
    return [];
  }
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

/** Admin read: active recipes, name order. [] on failure. Degrades to the
 *  pre-Phase-4 column list when citation_mode is not applied yet. */
export async function listRecipes(opts?: {
  includeArchived?: boolean;
}): Promise<Recipe[]> {
  try {
    let query = (serviceClient() as any)
      .from(RECIPES)
      .select(RECIPE_COLUMNS)
      .order('name', { ascending: true });
    if (!opts?.includeArchived) query = query.neq('status', 'archived');
    let { data, error } = await query;
    if (error && isMissingCitationMode(error)) {
      let fallback = (serviceClient() as any)
        .from(RECIPES)
        .select(RECIPE_COLUMNS_PRE_V2)
        .order('name', { ascending: true });
      if (!opts?.includeArchived) fallback = fallback.neq('status', 'archived');
      ({ data, error } = await fallback);
    }
    if (error || !data) return [];
    return (data as RecipeRow[]).map(rowToRecipe);
  } catch {
    return [];
  }
}

/** Admin read: one ACTIVE recipe by slug, or null. Same degrade. */
export async function getRecipe(slug: string): Promise<Recipe | null> {
  const clean = (slug || '').trim();
  if (!clean) return null;
  try {
    let { data, error } = await (serviceClient() as any)
      .from(RECIPES)
      .select(RECIPE_COLUMNS)
      .eq('slug', clean)
      .eq('status', 'active')
      .maybeSingle();
    if (error && isMissingCitationMode(error)) {
      ({ data, error } = await (serviceClient() as any)
        .from(RECIPES)
        .select(RECIPE_COLUMNS_PRE_V2)
        .eq('slug', clean)
        .eq('status', 'active')
        .maybeSingle());
    }
    if (error || !data) return null;
    return rowToRecipe(data as RecipeRow);
  } catch {
    return null;
  }
}


/** Admin-only upsert by slug (the seed path). */
export async function upsertRecipe(input: {
  slug: string;
  name?: string;
  description?: string;
  steps?: Recipe['steps'];
  budgetEstCents?: number;
  status?: 'active' | 'archived';
  citationMode?: 'flag' | 'enforce';
}): Promise<Recipe> {

  const slug = (input.slug || '').trim();
  if (!slug) throw new Error('slug is required');
  const row: Record<string, unknown> = {
    slug,
    updated_at: new Date().toISOString(),
  };
  if (input.name !== undefined) row.name = input.name;
  if (input.description !== undefined) row.description = input.description;
  if (input.steps !== undefined) row.steps = input.steps;
  if (input.budgetEstCents !== undefined)
    row.budget_est_cents = input.budgetEstCents;
  if (input.status !== undefined) row.status = input.status;
  if (input.citationMode !== undefined) row.citation_mode = input.citationMode;
  let { data, error } = await (serviceClient() as any)
    .from(RECIPES)
    .upsert(row, { onConflict: 'slug' })

    .select(RECIPE_COLUMNS)
    .single();
  if (error && isMissingCitationMode(error)) {
    // Migration pending: retry without the new column (the mode lands
    // when the migration applies; behavior until then is v1 anyway).
    delete row.citation_mode;
    ({ data, error } = await (serviceClient() as any)
      .from(RECIPES)
      .upsert(row, { onConflict: 'slug' })
      .select(RECIPE_COLUMNS_PRE_V2)
      .single());
  }
  if (error) throw new Error(error.message);
  return rowToRecipe(data as RecipeRow);
}


/** Start a run row (status running, fresh steps_state). */
export async function createRecipeRun(input: {
  recipeId: string;
  sessionId: string;
  stepCount: number;
}): Promise<RecipeRun> {
  const { data, error } = await (serviceClient() as any)
    .from(RUNS)
    .insert({
      recipe_id: input.recipeId,
      session_id: input.sessionId,
      status: 'running',
      current_step: 0,
      steps_state: initialStepsState(input.stepCount),
      est_cost_cents: 0,
    })
    .select(RUN_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return rowToRecipeRun(data as RecipeRunRow);
}

/** Admin read: one run by id, or null. */
export async function getRecipeRun(id: string): Promise<RecipeRun | null> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(RUNS)
      .select(RUN_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return rowToRecipeRun(data as RecipeRunRow);
  } catch {
    return null;
  }
}

/** Admin read: recent runs, newest first (optionally one recipe's). */
export async function listRecipeRuns(opts?: {
  recipeId?: string;
  limit?: number;
}): Promise<RecipeRun[]> {
  try {
    let query = (serviceClient() as any)
      .from(RUNS)
      .select(RUN_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(opts?.limit ?? 20);
    if (opts?.recipeId) query = query.eq('recipe_id', opts.recipeId);
    const { data, error } = await query;
    if (error || !data) return [];
    return (data as RecipeRunRow[]).map(rowToRecipeRun);
  } catch {
    return [];
  }
}

/** Patch a run (the interpreter's state writes). */
export async function updateRecipeRun(
  id: string,
  patch: Partial<
    Pick<RecipeRun, 'status' | 'currentStep' | 'stepsState' | 'estCostCents'>
  >,
): Promise<void> {
  const row: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.currentStep !== undefined) row.current_step = patch.currentStep;
  if (patch.stepsState !== undefined) row.steps_state = patch.stepsState;
  if (patch.estCostCents !== undefined) row.est_cost_cents = patch.estCostCents;
  const { error } = await (serviceClient() as any)
    .from(RUNS)
    .update(row)
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Run events (the trust spine, part 1): the append-only "what the run did"
// log. The mission UI's run timeline, the future run detail page, expert
// scorecards, and eval diffs all read from here.
// ---------------------------------------------------------------------------

export const RUN_EVENT_KINDS = [
  'step-started',
  'artifact',
  'gated',
  'handoff-initiated',
  'handoff-completed',
  'handoff-failed',
  'canceled',
  'budget-stopped',
  'citation-low',
  'share-created',
  'share-revoked',
  'done',
  'failed',
] as const;

export type RunEventKind = (typeof RUN_EVENT_KINDS)[number];

export interface RecipeRunEvent {
  id: string;
  runId: string;
  kind: RunEventKind;
  stepIndex: number | null;
  text: string;
  createdAt: string | null;
}

export interface RecipeRunEventRow {
  id: string;
  run_id: string;
  kind: string | null;
  step_index: number | null;
  text: string | null;
  created_at: string | null;
}

function toRunEventKind(v: unknown): RunEventKind {
  return (RUN_EVENT_KINDS as readonly string[]).includes(v as string)
    ? (v as RunEventKind)
    : 'step-started';
}

/** Defensive row -> event. */
export function rowToRunEvent(row: RecipeRunEventRow): RecipeRunEvent {
  return {
    id: row.id,
    runId: row.run_id,
    kind: toRunEventKind(row.kind),
    stepIndex:
      typeof row.step_index === 'number' && Number.isFinite(row.step_index)
        ? Math.floor(row.step_index)
        : null,
    text: (row.text || '').trim(),
    createdAt: row.created_at,
  };
}

/**
 * Append one event. BEST-EFFORT by design — a logging failure must never
 * fail the step it describes, so this swallows and the interpreter moves
 * on (the run row's steps_state remains the source of truth).
 */
export async function logRunEvent(input: {
  runId: string;
  kind: RunEventKind;
  stepIndex?: number | null;
  text: string;
}): Promise<void> {
  try {
    await (serviceClient() as any).from(RUN_EVENTS).insert({
      run_id: input.runId,
      kind: input.kind,
      step_index:
        typeof input.stepIndex === 'number' &&
        Number.isFinite(input.stepIndex)
          ? Math.max(0, Math.floor(input.stepIndex))
          : null,
      text: input.text.slice(0, 500),
    });
  } catch {
    /* the event log never blocks the run */
  }
}

/** Admin read: a run's events, oldest first (the timeline). [] on failure. */
export async function listRunEvents(
  runId: string,
  opts?: { limit?: number },
): Promise<RecipeRunEvent[]> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(RUN_EVENTS)
      .select(RUN_EVENT_COLUMNS)
      .eq('run_id', runId)
      .order('created_at', { ascending: true })
      .limit(opts?.limit ?? 100);
    if (error || !data) return [];
    return (data as RecipeRunEventRow[]).map(rowToRunEvent);
  } catch {
    return [];
  }
}
