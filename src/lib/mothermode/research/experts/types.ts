/**
 * MotherMode Experts: the config-driven agent model (roadmap task 1.1).
 *
 * An Expert is a ROW, not code: persona prompt, model preference, tool
 * policy, context pack refs, artifact contract, handoff manners. One
 * generalized loop (agent/loop.ts) runs any of them. The research agent is
 * expert #1 and lives here as the code-level DEFAULT_RESEARCH_EXPERT — the
 * table can be empty and the lab behaves exactly as it always has.
 *
 * Pure: no server imports. The store (./store.ts) does the DB reads; the
 * executor (agent/tools.ts) enforces the artifact contract through
 * `expertAllowsArtifact`.
 */
import {
  normalizeContextRefs,
  type ContextRef,
} from '@/lib/mothermode/context';

export interface ResearchExpert {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  /** Icon key for the crew UI. */
  glyph: string;
  /** The persona system prompt. '' = the built-in research ROLE block. */
  persona: string;
  /** Picker model id. '' = Auto. */
  model: string;
  /** Tool allowlist from the shared registry. [] = the full lane. */
  tools: string[];
  /** Standing context packs (brand, writing examples, style cards). */
  contextRefs: ContextRef[];
  /** Artifact types this expert may create. [] = all types. */
  artifactTypes: string[];
  /** Handoff manners (advisory): artifact types accepted in / emitted out. */
  accepts: string[];
  emits: string[];
  status: 'active' | 'archived';
  sortOrder: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ResearchExpertRow {
  id: string;
  slug: string | null;
  name: string | null;
  tagline: string | null;
  glyph: string | null;
  persona: string | null;
  model: string | null;
  tools: unknown;
  context_refs: unknown;
  artifact_types: unknown;
  accepts: unknown;
  emits: unknown;
  status: string | null;
  sort_order: number | null;
  created_at: string | null;
  updated_at: string | null;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function strList(v: unknown, cap = 32): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const s = str(item);
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= cap) break;
  }
  return out;
}

/** Defensive row -> expert. Unknown shapes degrade to the safe defaults. */
export function rowToExpert(row: ResearchExpertRow): ResearchExpert {
  return {
    id: row.id,
    slug: str(row.slug),
    name: str(row.name) || str(row.slug),
    tagline: str(row.tagline),
    glyph: str(row.glyph) || 'flask',
    persona: str(row.persona),
    model: str(row.model),
    tools: strList(row.tools),
    contextRefs: normalizeContextRefs(row.context_refs),
    artifactTypes: strList(row.artifact_types),
    accepts: strList(row.accepts),
    emits: strList(row.emits),
    status: row.status === 'archived' ? 'archived' : 'active',
    sortOrder:
      typeof row.sort_order === 'number' && Number.isFinite(row.sort_order)
        ? row.sort_order
        : 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Expert #1: the research agent, as a config
// ---------------------------------------------------------------------------

export const RESEARCH_EXPERT_SLUG = 'research';

/**
 * The no-op config: every field is the empty/default that makes the loop
 * behave exactly as the hardcoded research agent always has — built-in
 * persona, full tool lane (deep tools when the session is deep), every
 * artifact type. Zero behavior change by construction.
 */
export const DEFAULT_RESEARCH_EXPERT: ResearchExpert = {
  id: '',
  slug: RESEARCH_EXPERT_SLUG,
  name: 'Research',
  tagline: 'Niche, voice, and evidence research',
  glyph: 'flask',
  persona: '',
  model: '',
  tools: [],
  contextRefs: [],
  artifactTypes: [],
  accepts: [],
  emits: [],
  status: 'active',
  sortOrder: 0,
  createdAt: null,
  updatedAt: null,
};

/**
 * The artifact contract check. An empty contract allows every type (the
 * research default). A set contract rejects with a READABLE reason naming
 * the expert and its contract — the model reads it and picks a legal type.
 */
export function expertAllowsArtifact(
  expert: ResearchExpert,
  type: string,
): { allowed: true } | { allowed: false; reason: string } {
  if (expert.artifactTypes.length === 0) return { allowed: true };
  if (expert.artifactTypes.includes(type)) return { allowed: true };
  return {
    allowed: false,
    reason: `the ${expert.name} expert does not create ${type} artifacts (contract: ${expert.artifactTypes.join(
      ', ',
    )})`,
  };
}
