/**
 * MotherMode Experts store (roadmap task 1.1). Admin-only: service-role
 * client, lazy like research/store.ts. Reads DEGRADE — a missing/unmigrated
 * table returns [] / null, and the loop falls back to the code-level
 * DEFAULT_RESEARCH_EXPERT, so nothing breaks before the seed lands.
 */
import { createClient } from '@supabase/supabase-js';
import {
  rowToExpert,
  type ResearchExpert,
  type ResearchExpertRow,
} from './types';

const EXPERTS = 'mothermode_experts';
const EXPERT_COLUMNS =
  'id, slug, name, tagline, glyph, persona, model, tools, context_refs, artifact_types, accepts, emits, status, sort_order, created_at, updated_at';

let _service: ReturnType<typeof createClient> | null = null;
function serviceClient() {
  if (_service) return _service;
  _service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );
  return _service;
}

/** Admin read: active experts, sort_order first. [] on any failure. */
export async function listExperts(opts?: {
  includeArchived?: boolean;
}): Promise<ResearchExpert[]> {
  try {
    let query = (serviceClient() as any)
      .from(EXPERTS)
      .select(EXPERT_COLUMNS)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (!opts?.includeArchived) query = query.neq('status', 'archived');
    const { data, error } = await query;
    if (error || !data) return [];
    return (data as ResearchExpertRow[]).map(rowToExpert);
  } catch {
    return [];
  }
}

/** Admin read: one ACTIVE expert by slug, or null (missing/inactive/error). */
export async function getExpert(slug: string): Promise<ResearchExpert | null> {
  const clean = (slug || '').trim();
  if (!clean) return null;
  try {
    const { data, error } = await (serviceClient() as any)
      .from(EXPERTS)
      .select(EXPERT_COLUMNS)
      .eq('slug', clean)
      .eq('status', 'active')
      .maybeSingle();
    if (error || !data) return null;
    return rowToExpert(data as ResearchExpertRow);
  } catch {
    return null;
  }
}

export interface UpsertExpertInput {
  id?: string | null;
  slug: string;
  name?: string;
  tagline?: string;
  glyph?: string;
  persona?: string;
  model?: string;
  tools?: string[];
  contextRefs?: ResearchExpert['contextRefs'];
  artifactTypes?: string[];
  accepts?: string[];
  emits?: string[];
  status?: 'active' | 'archived';
  sortOrder?: number;
}

/** Admin-only upsert: update by slug (or id), insert when neither exists. */
export async function upsertExpert(
  input: UpsertExpertInput,
): Promise<ResearchExpert> {
  const slug = (input.slug || '').trim();
  if (!slug) throw new Error('slug is required');
  const row: Record<string, unknown> = {
    slug,
    updated_at: new Date().toISOString(),
  };
  if (input.name !== undefined) row.name = input.name;
  if (input.tagline !== undefined) row.tagline = input.tagline;
  if (input.glyph !== undefined) row.glyph = input.glyph;
  if (input.persona !== undefined) row.persona = input.persona;
  if (input.model !== undefined) row.model = input.model;
  if (input.tools !== undefined) row.tools = input.tools;
  if (input.contextRefs !== undefined) row.context_refs = input.contextRefs;
  if (input.artifactTypes !== undefined) row.artifact_types = input.artifactTypes;
  if (input.accepts !== undefined) row.accepts = input.accepts;
  if (input.emits !== undefined) row.emits = input.emits;
  if (input.status !== undefined) row.status = input.status;
  if (input.sortOrder !== undefined) row.sort_order = input.sortOrder;

  if (input.id) {
    const { data, error } = await (serviceClient() as any)
      .from(EXPERTS)
      .update(row)
      .eq('id', input.id)
      .select(EXPERT_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return rowToExpert(data as ResearchExpertRow);
  }

  const existing = await getExpert(slug);
  if (existing) {
    const { data, error } = await (serviceClient() as any)
      .from(EXPERTS)
      .update(row)
      .eq('id', existing.id)
      .select(EXPERT_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return rowToExpert(data as ResearchExpertRow);
  }

  const { data, error } = await (serviceClient() as any)
    .from(EXPERTS)
    .insert(row)
    .select(EXPERT_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return rowToExpert(data as ResearchExpertRow);
}

/**
 * Seed the crew (idempotent by slug). Returns the upserted experts. Runs
 * from the seed script; the research seed is the no-op default in row form.
 */
export async function seedExperts(
  seeds: Array<Omit<UpsertExpertInput, 'id'>>,
): Promise<ResearchExpert[]> {
  const out: ResearchExpert[] = [];
  for (const seed of seeds) {
    out.push(await upsertExpert(seed));
  }
  return out;
}
