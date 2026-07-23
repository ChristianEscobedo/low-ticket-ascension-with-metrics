/**
 * Lead Gen Kit domain types + pure row<->object mappers.
 *
 * The Lead Gen Kit is the document-producing sibling of the High Ticket Kit and
 * Community Kit. From a short intake plus a chosen lead-magnet format it
 * produces a complete, long-form, brand-styled document (an ebook, guide, SOP,
 * course, checklist, worksheet, swipe file, etc.). The whole structured
 * document is stored as JSONB in mothermode_lead_gen_kits.doc.
 *
 * Two layers:
 *   - LeadGenIntake: the short admin brief that seeds generation.
 *   - LeadGenDoc: the structured, editable document the generator returns and
 *     the editor persists.
 *
 * Mappers are pure and side-effect free so they can be unit tested without a
 * database (JSONB is untyped at the DB boundary, so every normalizer is
 * defensive).
 */

// ---------------------------------------------------------------------------
// Enums / small unions
// ---------------------------------------------------------------------------

export const LEAD_GEN_STATUSES = ['draft', 'active', 'archived'] as const;
export type LeadGenStatus = (typeof LEAD_GEN_STATUSES)[number];

/** The lead-magnet formats. Each drives a §3 skeleton the generator fills. */
export const LEAD_MAGNET_FORMATS = [
  'ebook',
  'guide',
  'cheatsheet',
  'sop',
  'course',
  'minicourse',
  'template',
  'checklist',
  'worksheet',
  'swipefile',
] as const;
export type LeadMagnetFormat = (typeof LEAD_MAGNET_FORMATS)[number];

/** Length band drives the target section count in the outline prompt. */
export const LEAD_GEN_LENGTHS = ['short', 'standard', 'ultra'] as const;
export type LeadGenLength = (typeof LEAD_GEN_LENGTHS)[number];

/**
 * The content-block kinds a section can hold. Each maps 1:1 to a
 * deliverables/kit.ts builder so the renderer never sees an unknown block.
 */
export const DOC_BLOCK_KINDS = [
  'lead',
  'p',
  'h3',
  'ul',
  'checklist',
  'note',
  'pullQuote',
  'nextStep',
  'template',
] as const;
export type DocBlockKind = (typeof DOC_BLOCK_KINDS)[number];

/**
 * A format module: the skeleton the generator must follow plus a short
 * authoring-style note. Kept as data so a format can be tuned without touching
 * generation logic. Defined here (rather than in formats/index.ts) so each
 * format module can import the type without a circular dependency.
 */
export interface LeadMagnetFormatSpec {
  /** Human label for the picker. */
  label: string;
  /** One-line description of when to use this format. */
  hint: string;
  /** The document skeleton the generator fills (structure, not specifics). */
  skeleton: string;
  /** Authoring-style guidance (voice, density, pacing) for this format. */
  styleNote: string;
}

// ---------------------------------------------------------------------------
// Intake
// ---------------------------------------------------------------------------

export interface LeadGenIntake {
  /** Topic / subject the lead magnet covers. */
  topic: string;
  /** Who the magnet is for. */
  audience: string;
  /** The lead-gen job it does (opt-in, pre-frame, nurture). */
  goal: string;
  /** The promised outcome / transformation. */
  transformation: string;
  /** short | standard | ultra — drives section count. */
  length: string;
  /** Brand voice / tone notes. */
  tone: string;
  /** The next step it points to (book a call, join, buy). */
  cta: string;
  /** Optional link to an existing offer for positioning. */
  offerSlug: string;
  /** Anything else the generator should honor. */
  notes: string;
}

export function blankIntake(): LeadGenIntake {
  return {
    topic: '',
    audience: '',
    goal: '',
    transformation: '',
    length: 'standard',
    tone: '',
    cta: '',
    offerSlug: '',
    notes: '',
  };
}

// ---------------------------------------------------------------------------
// Document blocks + sections
// ---------------------------------------------------------------------------

/** One content block within a section. `kind` maps to a kit.ts builder. */
export interface DocBlock {
  kind: DocBlockKind;
  /** For text blocks (lead, p, h3, pullQuote, note body, template body). */
  text?: string;
  /** For ul / checklist blocks. */
  items?: string[];
  /** For note / nextStep labels. */
  title?: string;
}

export function blankBlock(kind: DocBlockKind = 'p'): DocBlock {
  return { kind, text: '', items: [], title: '' };
}

/** A nested lesson (course / minicourse formats only). */
export interface DocLesson {
  title: string;
  blocks: DocBlock[];
}

export interface DocSection {
  /** Stable id for per-section regen. */
  id: string;
  /** Rendered as h2. */
  heading: string;
  /** One-line, used in the outline + table of contents. */
  summary: string;
  /** Empty until the section is expanded. */
  blocks: DocBlock[];
  /** For course / minicourse only: nested lessons render as h3 sub-blocks. */
  lessons?: DocLesson[];
}

export function blankSection(id?: string): DocSection {
  return {
    id: id || makeSectionId(),
    heading: '',
    summary: '',
    blocks: [],
    lessons: [],
  };
}

/** Simple, dependency-free stable id generator for sections. */
export function makeSectionId(): string {
  return `sec-${Math.random().toString(36).slice(2, 10)}`;
}

export interface LeadGenCta {
  title: string;
  body: string;
  button: string;
}

export function blankCta(): LeadGenCta {
  return { title: '', body: '', button: '' };
}

export interface LeadGenDoc {
  title: string;
  subtitle: string;
  /** Intro / lead paragraph (the hook). */
  hook: string;
  /** The outline, then expanded. */
  sections: DocSection[];
  cta: LeadGenCta;
  /** Optional, via aiGenerateImage. */
  coverImageUrl: string;
}

export function blankDoc(): LeadGenDoc {
  return {
    title: '',
    subtitle: '',
    hook: '',
    sections: [],
    cta: blankCta(),
    coverImageUrl: '',
  };
}

// ---------------------------------------------------------------------------
// Record + DB row
// ---------------------------------------------------------------------------

export interface LeadGenKitRecord {
  id: string;
  slug: string;
  name: string;
  format: LeadMagnetFormat;
  status: LeadGenStatus;
  intake: LeadGenIntake;
  doc: LeadGenDoc;
  publishedSlug: string | null;
  publishedKey: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface LeadGenKitRow {
  id: string;
  slug: string;
  name: string | null;
  format: string | null;
  status: string | null;
  intake: unknown;
  doc: unknown;
  published_slug: string | null;
  published_key: string | null;
  created_at: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

// ---------------------------------------------------------------------------
// Normalizers (defensive: JSONB is untyped at the DB boundary)
// ---------------------------------------------------------------------------

export function toLeadGenStatus(value: unknown): LeadGenStatus {
  return LEAD_GEN_STATUSES.includes(value as LeadGenStatus)
    ? (value as LeadGenStatus)
    : 'draft';
}

export function toLeadMagnetFormat(value: unknown): LeadMagnetFormat {
  return LEAD_MAGNET_FORMATS.includes(value as LeadMagnetFormat)
    ? (value as LeadMagnetFormat)
    : 'guide';
}

export function toLeadGenLength(value: unknown): LeadGenLength {
  return LEAD_GEN_LENGTHS.includes(value as LeadGenLength)
    ? (value as LeadGenLength)
    : 'standard';
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function strArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : [];
}

function toBlockKind(value: unknown): DocBlockKind {
  return DOC_BLOCK_KINDS.includes(value as DocBlockKind)
    ? (value as DocBlockKind)
    : 'p';
}

/** Coerce arbitrary intake JSON into a fully-populated LeadGenIntake. */
export function normalizeIntake(value: unknown): LeadGenIntake {
  const i = (value ?? {}) as Record<string, unknown>;
  const base = blankIntake();
  return {
    topic: str(i.topic) || base.topic,
    audience: str(i.audience) || base.audience,
    goal: str(i.goal) || base.goal,
    transformation: str(i.transformation) || base.transformation,
    length: str(i.length) || base.length,
    tone: str(i.tone) || base.tone,
    cta: str(i.cta) || base.cta,
    offerSlug: str(i.offerSlug) || base.offerSlug,
    notes: str(i.notes) || base.notes,
  };
}

export function normalizeBlock(value: unknown): DocBlock {
  const b = (value ?? {}) as Record<string, unknown>;
  return {
    kind: toBlockKind(b.kind),
    text: str(b.text),
    items: strArray(b.items),
    title: str(b.title),
  };
}

function normalizeBlocks(value: unknown): DocBlock[] {
  return Array.isArray(value) ? value.map(normalizeBlock) : [];
}

function normalizeLessons(value: unknown): DocLesson[] {
  return Array.isArray(value)
    ? value.map((l) => {
        const row = (l ?? {}) as Record<string, unknown>;
        return { title: str(row.title), blocks: normalizeBlocks(row.blocks) };
      })
    : [];
}

export function normalizeSection(value: unknown): DocSection {
  const s = (value ?? {}) as Record<string, unknown>;
  const lessons = normalizeLessons(s.lessons);
  return {
    id: str(s.id) || makeSectionId(),
    heading: str(s.heading),
    summary: str(s.summary),
    blocks: normalizeBlocks(s.blocks),
    lessons,
  };
}

function normalizeSections(value: unknown): DocSection[] {
  return Array.isArray(value) ? value.map(normalizeSection) : [];
}

function normalizeCta(value: unknown): LeadGenCta {
  const c = (value ?? {}) as Record<string, unknown>;
  return {
    title: str(c.title),
    body: str(c.body),
    button: str(c.button),
  };
}

/** Coerce arbitrary doc JSON into a fully-populated LeadGenDoc. */
export function normalizeDoc(value: unknown): LeadGenDoc {
  const d = (value ?? {}) as Record<string, unknown>;
  return {
    title: str(d.title),
    subtitle: str(d.subtitle),
    hook: str(d.hook),
    sections: normalizeSections(d.sections),
    cta: normalizeCta(d.cta),
    coverImageUrl: str(d.coverImageUrl),
  };
}

// ---------------------------------------------------------------------------
// Row -> record mapper (pure)
// ---------------------------------------------------------------------------

export function rowToLeadGenKit(row: LeadGenKitRow): LeadGenKitRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: str(row.name),
    format: toLeadMagnetFormat(row.format),
    status: toLeadGenStatus(row.status),
    intake: normalizeIntake(row.intake),
    doc: normalizeDoc(row.doc),
    publishedSlug: row.published_slug,
    publishedKey: row.published_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}
