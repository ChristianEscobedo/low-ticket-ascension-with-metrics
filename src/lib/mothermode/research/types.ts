/**
 * Research Lab domain types + pure row<->object mappers.
 *
 * The Research Lab is the admin's offer-planning and research workspace: a chat
 * with an agent that can pull outside data (social scraping, Amazon reviews,
 * web search), internal metrics (tracked links, leads, attributed revenue) and
 * Context Bridge packs, then emit persistent ARTIFACTS that hand off to the
 * planner and the kit builders.
 *
 * Three persisted entities:
 *   - ResearchSession:  one conversation / investigation.
 *   - ResearchMessage:  one chat turn. Assistant turns carry the tool-call
 *                       trace (`toolCalls`) so the reasoning UI survives reload.
 *   - ResearchArtifact: a durable output (brief / plan / concept) with a
 *                       structured handoff payload and handoff state.
 *
 * Mappers are pure and side-effect free (JSONB is untyped at the DB boundary,
 * so every normalizer is defensive) — mirroring the kit-store conventions.
 */
import {
  normalizeContextRefs,
  type ContextRef,
} from '@/lib/mothermode/context';
import {
  blankIntake,
  normalizeResearchIntake,
  type ResearchIntake,
} from './intake';

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export const RESEARCH_SESSION_STATUSES = ['active', 'archived'] as const;
export type ResearchSessionStatus = (typeof RESEARCH_SESSION_STATUSES)[number];

export interface ResearchSession {
  id: string;
  title: string;
  /** Convenience offer scope; also expressible as a ContextRef. */
  offerSlug: string;
  contextRefs: ContextRef[];
  /** The research brief the agent searches with (may be blank). */
  intake: ResearchIntake;
  status: ResearchSessionStatus;
  createdAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface ResearchSessionRow {
  id: string;
  title: string | null;
  offer_slug: string | null;
  context_refs: unknown;
  intake?: unknown;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

export function toResearchSessionStatus(v: unknown): ResearchSessionStatus {
  return v === 'archived' ? 'archived' : 'active';
}

export function rowToResearchSession(row: ResearchSessionRow): ResearchSession {
  return {
    id: row.id,
    title: (row.title || '').trim() || 'New research',
    offerSlug: (row.offer_slug || '').trim(),
    contextRefs: normalizeContextRefs(row.context_refs),
    // Optional at the DB boundary: a checkout running ahead of the intake
    // migration degrades to a blank brief, not a crash.
    intake: row.intake ? normalizeResearchIntake(row.intake) : blankIntake(),
    status: toResearchSessionStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

/** Session title from the first user message; short enough for a list row. */
export function sessionTitleFrom(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return 'New research';
  return clean.length <= 64 ? clean : `${clean.slice(0, 61).trimEnd()}...`;
}

// ---------------------------------------------------------------------------
// Messages + the tool-call trace
// ---------------------------------------------------------------------------

export type ResearchMessageRole = 'user' | 'assistant';

export const TOOL_CALL_STATUSES = ['ok', 'error'] as const;
export type ToolCallStatus = (typeof TOOL_CALL_STATUSES)[number];

/**
 * One tool invocation, summarized for the reasoning trace. The full result
 * stays in the model transcript (and, for scrapers, the cache); what persists
 * here is what a human needs to follow the agent's reasoning after reload.
 */
export interface ToolCallRecord {
  /** Provider-assigned tool-call id (or a synthetic one). */
  id: string;
  name: string;
  /** One line: `x: "mom burnout" limit 10`. Built by the tool runner. */
  inputSummary: string;
  status: ToolCallStatus;
  /** One line: `47 posts, top theme: time scarcity`. */
  resultSummary: string;
  ms: number;
}

export interface ResearchMessage {
  id: string;
  sessionId: string;
  role: ResearchMessageRole;
  content: string;
  toolCalls: ToolCallRecord[];
  /** The model id that wrote it ('' for user turns). */
  model: string;
  createdAt: string | null;
}

export interface ResearchMessageRow {
  id: string;
  session_id: string;
  role: string | null;
  content: string | null;
  tool_calls: unknown;
  model: string | null;
  created_at: string | null;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/** Coerce arbitrary JSONB into ToolCallRecord[]; drops malformed entries. */
export function normalizeToolCalls(value: unknown): ToolCallRecord[] {
  if (!Array.isArray(value)) return [];
  const out: ToolCallRecord[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const rec = raw as Record<string, unknown>;
    const name = str(rec.name).trim();
    if (!name) continue;
    out.push({
      id: str(rec.id) || `call_${out.length + 1}`,
      name,
      inputSummary: str(rec.inputSummary),
      status: rec.status === 'error' ? 'error' : 'ok',
      resultSummary: str(rec.resultSummary),
      ms: num(rec.ms),
    });
  }
  return out;
}

export function rowToResearchMessage(row: ResearchMessageRow): ResearchMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role === 'assistant' ? 'assistant' : 'user',
    content: str(row.content),
    toolCalls: normalizeToolCalls(row.tool_calls),
    model: str(row.model),
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

export const RESEARCH_ARTIFACT_TYPES = [
  'research-brief',
  'offer-brief',
  'content-plan',
  'lead-magnet',
  'ad-angles',
  'email-outline',
  'notes',
] as const;
export type ResearchArtifactType = (typeof RESEARCH_ARTIFACT_TYPES)[number];

export const ARTIFACT_TYPE_LABELS: Record<ResearchArtifactType, string> = {
  'research-brief': 'Research brief',
  'offer-brief': 'Offer brief',
  'content-plan': 'Content plan',
  'lead-magnet': 'Lead magnet concept',
  'ad-angles': 'Ad angles',
  'email-outline': 'Email outline',
  notes: 'Notes',
};

export const RESEARCH_ARTIFACT_STATUSES = ['draft', 'final', 'handed-off'] as const;
export type ResearchArtifactStatus = (typeof RESEARCH_ARTIFACT_STATUSES)[number];

/** Where an artifact went when it was handed off for creation. */
export interface HandedOffRef {
  kind: 'planner-cards' | 'leadgen-kit' | 'email-kit' | 'sales-funnel' | 'system';
  /** Kit id / funnel id, or '' for a multi-row handoff (planner cards, system). */
  id: string;
  /** Human label: kit name, funnel name, or "12 planner cards". */
  label: string;
  /** Rows created (planner handoffs) or parts built (system). */
  count?: number;
  at: string;
}

export interface ResearchArtifact {
  id: string;
  sessionId: string;
  type: ResearchArtifactType;
  title: string;
  /** Human-readable document (rendered + editable in the artifact view). */
  markdown: string;
  /**
   * The machine-readable handoff payload. Shape depends on type:
   * content-plan/ad-angles -> { items: ContentPlanItem[] },
   * lead-magnet -> LeadMagnetConcept, email-outline -> EmailOutline,
   * offer-brief -> OfferBrief. Normalized defensively at the boundary.
   */
  structured: Record<string, unknown>;
  status: ResearchArtifactStatus;
  handedOffTo: HandedOffRef | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ResearchArtifactRow {
  id: string;
  session_id: string;
  type: string | null;
  title: string | null;
  markdown: string | null;
  structured: unknown;
  status: string | null;
  handed_off_to: unknown;
  created_at: string | null;
  updated_at: string | null;
}

export function isResearchArtifactType(v: unknown): v is ResearchArtifactType {
  return (
    typeof v === 'string' &&
    (RESEARCH_ARTIFACT_TYPES as readonly string[]).includes(v)
  );
}

export function toResearchArtifactStatus(v: unknown): ResearchArtifactStatus {
  return v === 'final' || v === 'handed-off' ? v : 'draft';
}

/** Coerce the handed_off_to JSONB, or null when absent/malformed. */
export function normalizeHandedOffTo(value: unknown): HandedOffRef | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;
  const kind = rec.kind;
  if (
    kind !== 'planner-cards' &&
    kind !== 'leadgen-kit' &&
    kind !== 'email-kit' &&
    kind !== 'sales-funnel' &&
    kind !== 'system'
  ) {
    return null;
  }
  return {
    kind,
    id: str(rec.id),
    label: str(rec.label),
    count: typeof rec.count === 'number' ? Math.floor(rec.count) : undefined,
    at: str(rec.at),
  };
}

export function rowToResearchArtifact(
  row: ResearchArtifactRow,
): ResearchArtifact {
  return {
    id: row.id,
    sessionId: row.session_id,
    type: isResearchArtifactType(row.type) ? row.type : 'research-brief',
    title: str(row.title),
    markdown: str(row.markdown),
    structured:
      row.structured && typeof row.structured === 'object' && !Array.isArray(row.structured)
        ? (row.structured as Record<string, unknown>)
        : {},
    status: toResearchArtifactStatus(row.status),
    handedOffTo: normalizeHandedOffTo(row.handed_off_to),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Structured handoff payloads (normalized defensively; consumed by handoff.ts)
// ---------------------------------------------------------------------------

/** One planned post inside a content-plan / ad-angles artifact. */
export interface ContentPlanItem {
  title: string;
  hook: string;
  platform: string;
  format: string;
  /** 'organic' | 'paid' | 'lead'. */
  kind: string;
  /** ISO date the planner should schedule it for ('' = unscheduled). */
  date: string;
  notes: string;
}

export function normalizeContentPlanItems(value: unknown): ContentPlanItem[] {
  const list = Array.isArray(value) ? value : [];
  const out: ContentPlanItem[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const rec = raw as Record<string, unknown>;
    const title = str(rec.title).trim();
    const hook = str(rec.hook).trim();
    if (!title && !hook) continue;
    const kind = str(rec.kind).trim();
    out.push({
      title: title || hook.slice(0, 60),
      hook,
      platform: str(rec.platform).trim() || 'instagram',
      format: str(rec.format).trim() || 'feed',
      kind: kind === 'paid' || kind === 'lead' ? kind : 'organic',
      date: str(rec.date).trim(),
      notes: str(rec.notes).trim(),
    });
  }
  return out;
}

/** Lead-magnet concept -> Lead Gen Kit intake fields. */
export interface LeadMagnetConcept {
  title: string;
  format: string;
  promise: string;
  audience: string;
  outline: string[];
  cta: string;
  notes: string;
}

export function normalizeLeadMagnetConcept(value: unknown): LeadMagnetConcept {
  const rec = (value && typeof value === 'object' ? value : {}) as Record<
    string,
    unknown
  >;
  return {
    title: str(rec.title).trim(),
    format: str(rec.format).trim() || 'guide',
    promise: str(rec.promise).trim(),
    audience: str(rec.audience).trim(),
    outline: Array.isArray(rec.outline)
      ? rec.outline
          .filter((s): s is string => typeof s === 'string' && !!s.trim())
          .map((s) => s.trim())
      : [],
    cta: str(rec.cta).trim(),
    notes: str(rec.notes).trim(),
  };
}

/** Email outline -> Email Kit intake fields. */
export interface EmailOutline {
  goal: string;
  audience: string;
  campaignType: string;
  emails: Array<{ title: string; idea: string }>;
  notes: string;
}

export function normalizeEmailOutline(value: unknown): EmailOutline {
  const rec = (value && typeof value === 'object' ? value : {}) as Record<
    string,
    unknown
  >;
  return {
    goal: str(rec.goal).trim(),
    audience: str(rec.audience).trim(),
    campaignType: str(rec.campaignType).trim(),
    emails: Array.isArray(rec.emails)
      ? rec.emails
          .map((e) => {
            if (!e || typeof e !== 'object') return null;
            const r = e as Record<string, unknown>;
            const title = str(r.title).trim();
            const idea = str(r.idea).trim();
            return title || idea ? { title, idea } : null;
          })
          .filter((e): e is { title: string; idea: string } => e !== null)
      : [],
    notes: str(rec.notes).trim(),
  };
}

/** Offer brief -> sales funnel draft fields. */
export interface OfferBrief {
  name: string;
  audience: string;
  promise: string;
  mechanism: string;
  priceCents: number;
  angles: string[];
  notes: string;
}

export function normalizeOfferBrief(value: unknown): OfferBrief {
  const rec = (value && typeof value === 'object' ? value : {}) as Record<
    string,
    unknown
  >;
  return {
    name: str(rec.name).trim(),
    audience: str(rec.audience).trim(),
    promise: str(rec.promise).trim(),
    mechanism: str(rec.mechanism).trim(),
    priceCents:
      typeof rec.priceCents === 'number' && Number.isFinite(rec.priceCents)
        ? Math.max(0, Math.round(rec.priceCents))
        : 0,
    angles: Array.isArray(rec.angles)
      ? rec.angles
          .filter((s): s is string => typeof s === 'string' && !!s.trim())
          .map((s) => s.trim())
      : [],
    notes: str(rec.notes).trim(),
  };
}

/** Which handoff targets an artifact type supports, in button order. */
export function handoffTargetsFor(
  type: ResearchArtifactType,
): Array<HandedOffRef['kind']> {
  switch (type) {
    case 'content-plan':
      return ['planner-cards'];
    case 'ad-angles':
      return ['planner-cards'];
    case 'lead-magnet':
      return ['leadgen-kit'];
    case 'email-outline':
      return ['email-kit'];
    case 'offer-brief':
      return ['sales-funnel', 'system'];
    default:
      return [];
  }
}
