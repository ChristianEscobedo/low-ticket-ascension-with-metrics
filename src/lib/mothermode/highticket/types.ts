/**
 * High Ticket Kit types + pure row<->object mappers, built on the D.I.M.E.
 * offer-creation method and the 7 A's contrarian-copy framework.
 *
 * The methodology (see supabase/migrations/dime-method-high-ticket.txt):
 *   1. Basics       - who you help (avatar) + the problems / cost / result.
 *   2. 7 A's        - Attention, Acknowledge, Agitate, Authority, Angst,
 *                     Ambiguity, Appeal. The 16-question offer extraction that
 *                     makes the messaging "bullet proof" and creates cognitive
 *                     dissonance the prospect can only resolve by acting.
 *   3. Offer        - the extracted core: the Super "I help" statement, program
 *                     name, price, and appeal add-ons.
 *   4. Problems     - the 3-4 D.I.M.E. problem pillars, each with Problem,
 *                     Angst, Solution, Implementation.
 *   5. Offer script - those pillars assembled into a spoken enrollment-call
 *                     presentation (one script pillar per problem).
 *
 * Two layers:
 *   - HighTicketIntake: the short admin brief that seeds generation.
 *   - HighTicketKit: the structured, editable kit the generator returns and the
 *     editor persists. Stored as JSONB in mothermode_high_ticket_kits.kit.
 *
 * Mappers are pure and side-effect free so they can be unit tested without a
 * database.
 */

import { type ContextRef, normalizeContextRefs } from '@/lib/mothermode/context';

// ---------------------------------------------------------------------------
// Enums / small unions
// ---------------------------------------------------------------------------


export const HIGH_TICKET_STATUSES = ['draft', 'active', 'archived'] as const;
export type HighTicketStatus = (typeof HIGH_TICKET_STATUSES)[number];

/** The regeneratable sections. Drives the per-section Regenerate cards and the
 *  `regenerate` action switch. Ordered as the method is worked. */
export const KIT_SECTIONS = [
  'basics',
  'sevenAs',
  'offer',
  'problems',
  'offerScript',
] as const;
export type KitSection = (typeof KIT_SECTIONS)[number];

/** The seven copy elements, in presentation order. */
export const SEVEN_A_KEYS = [
  'attention',
  'acknowledge',
  'agitate',
  'authority',
  'angst',
  'ambiguity',
  'appeal',
] as const;
export type SevenAKey = (typeof SEVEN_A_KEYS)[number];

// ---------------------------------------------------------------------------
// Intake
// ---------------------------------------------------------------------------

export interface HighTicketIntake {
  /** Market / topic the offer serves. */
  niche: string;
  /** Who the offer is for (the avatar in a sentence). */
  audience: string;
  /** The core outcome / transformation. */
  transformation: string;
  /** The unique method / mechanism, if known. */
  mechanism: string;
  /** Price band, e.g. 10k-20k. */
  priceBand: string;
  /** Results / credibility / proof to weave in. */
  proof: string;
  /** Program length / timeline. */
  timeline: string;
  /** Brand voice / tone notes. */
  tone: string;
  /** Anything else the generator should honor. */
  notes: string;
}

export function blankIntake(): HighTicketIntake {
  return {
    niche: '',
    audience: '',
    transformation: '',
    mechanism: '',
    priceBand: '',
    proof: '',
    timeline: '',
    tone: '',
    notes: '',
  };
}

// ---------------------------------------------------------------------------
// Kit: Basics
// ---------------------------------------------------------------------------

/** Who the person you help is. */
export interface Avatar {
  /** Gender(s). */
  genders: string;
  /** Age range, e.g. 40-60. */
  ageRange: string;
  /** Identity / belief labels, e.g. "believe in self dev, plateaued in business". */
  labels: string;
}

/** A single problem / cost / result row from the basics table. */
export interface ProblemRow {
  /** The problem you solve. */
  problem: string;
  /** The cost of the problem (money, time, emotion). */
  cost: string;
  /** The result they get once solved. */
  result: string;
}

export interface Basics {
  avatar: Avatar;
  problems: ProblemRow[];
}

export function blankAvatar(): Avatar {
  return { genders: '', ageRange: '', labels: '' };
}

export function blankProblemRow(): ProblemRow {
  return { problem: '', cost: '', result: '' };
}


export function blankBasics(): Basics {
  return { avatar: blankAvatar(), problems: [] };
}

// ---------------------------------------------------------------------------
// Kit: 7 A's
// ---------------------------------------------------------------------------

/**
 * Each element is a brain-dump answer to its mapped questions:
 *   attention   - Q1  biggest surface-level problems that grab attention.
 *   acknowledge - Q2  who suffers it most + Q3 what they currently do to fix it.
 *   agitate     - Q4  the real reason behind the problem + your mechanism.
 *   authority   - Q5 proof, Q6 certainty, Q7 sophistication level, Q8 time.
 *   angst       - Q9  the cost of doing nothing.
 *   ambiguity   - Q10 the 4-5 obstacles they must overcome (the exact steps).
 *   appeal      - price + additional features/benefits that make it a no-brainer.
 */
export type SevenAs = Record<SevenAKey, string>;

export function blankSevenAs(): SevenAs {
  return {
    attention: '',
    acknowledge: '',
    agitate: '',
    authority: '',
    angst: '',
    ambiguity: '',
    appeal: '',
  };
}

// ---------------------------------------------------------------------------
// Kit: Offer (extracted core)
// ---------------------------------------------------------------------------

export interface Offer {
  /** Program name options. */
  nameOptions: string[];
  /** The chosen program name. */
  chosenName: string;
  /**
   * The Super "I help" statement:
   * "I help [customer] solve the problem of [physical pain] by fixing [real
   *  problems] using [real solution] in [time]. Doing this, [customer] can
   *  stop/avoid [cost of doing nothing] and achieve [physical desire] without
   *  [obstacle]."
   */
  iHelpStatement: string;
  /** Price / price band. */
  price: string;
  /** Payment options. */
  paymentOptions: string[];
  /** Risk reversal / guarantee / certainty. */
  guarantee: string;
  /** Appeal add-ons (additional features/benefits that make it a no-brainer). */
  addOns: string[];
  /** Positioning: who it's for / who it's not for. */
  positioning: string;
}

export function blankOffer(): Offer {
  return {
    nameOptions: [],
    chosenName: '',
    iHelpStatement: '',
    price: '',
    paymentOptions: [],
    guarantee: '',
    addOns: [],
    positioning: '',
  };
}

// ---------------------------------------------------------------------------
// Kit: D.I.M.E. problem pillars
// ---------------------------------------------------------------------------

/**
 * One of the 3-4 problems the offer solves, mapped the D.I.M.E. way:
 *   Problem        - the problem being addressed (the real reason / clarity /
 *                    the thing they must reject / what makes results stick).
 *   Angst          - the "Where most [avatar] go wrong..." scenario + the cost
 *                    if it isn't solved (the common enemy).
 *   Solution       - "We map out ... so that you never have to deal with ...
 *                    This is the missing piece most [avatar] completely
 *                    overlook, and it all starts here."
 *   Implementation - the exact steps: "Finally, we action this out together
 *                    by: 1... 5..."
 */
export interface DimeProblem {
  /** Short label, e.g. "#1 Problem - Finding the real reason...". */
  title: string;
  problem: string;
  angst: string;
  solution: string;
  implementation: string[];
}

export function blankDimeProblem(): DimeProblem {
  return { title: '', problem: '', angst: '', solution: '', implementation: [] };
}

// ---------------------------------------------------------------------------
// Kit: Offer script (assembled enrollment-call presentation)
// ---------------------------------------------------------------------------

/** One spoken pillar of the enrollment-call script (built from a DimeProblem). */
export interface ScriptPillar {
  /** e.g. "SCRIPT | PILLAR ONE". */
  label: string;
  /** The full spoken script for this pillar, ending "Does that make sense?". */
  body: string;
}

export function blankScriptPillar(): ScriptPillar {
  return { label: '', body: '' };
}

// ---------------------------------------------------------------------------
// Kit
// ---------------------------------------------------------------------------

export interface HighTicketKit {
  basics: Basics;
  sevenAs: SevenAs;
  offer: Offer;
  problems: DimeProblem[];
  offerScript: ScriptPillar[];
}

export function blankKit(): HighTicketKit {
  return {
    basics: blankBasics(),
    sevenAs: blankSevenAs(),
    offer: blankOffer(),
    problems: [],
    offerScript: [],
  };
}

// ---------------------------------------------------------------------------
// Record + DB row
// ---------------------------------------------------------------------------

export interface HighTicketKitRecord {
  id: string;
  slug: string;
  name: string;
  status: HighTicketStatus;
  intake: HighTicketIntake;
  kit: HighTicketKit;
  /** Context sources (offers/kits/links/notes) attached for AI generation. */
  contextRefs: ContextRef[];
  createdAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface HighTicketKitRow {
  id: string;
  slug: string;
  name: string | null;
  status: string | null;
  intake: unknown;
  kit: unknown;
  context_refs?: unknown;
  created_at: string | null;

  updated_at: string | null;
  updated_by: string | null;
}

// ---------------------------------------------------------------------------
// Normalizers (defensive: JSONB is untyped at the DB boundary)
// ---------------------------------------------------------------------------

export function toHighTicketStatus(value: unknown): HighTicketStatus {
  return HIGH_TICKET_STATUSES.includes(value as HighTicketStatus)
    ? (value as HighTicketStatus)
    : 'draft';
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function strArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : [];
}

/** Coerce arbitrary intake JSON into a fully-populated HighTicketIntake. */
export function normalizeIntake(value: unknown): HighTicketIntake {
  const i = (value ?? {}) as Record<string, unknown>;
  const base = blankIntake();
  return {
    niche: str(i.niche) || base.niche,
    audience: str(i.audience) || base.audience,
    transformation: str(i.transformation) || base.transformation,
    mechanism: str(i.mechanism) || base.mechanism,
    priceBand: str(i.priceBand) || base.priceBand,
    proof: str(i.proof) || base.proof,
    timeline: str(i.timeline) || base.timeline,
    tone: str(i.tone) || base.tone,
    notes: str(i.notes) || base.notes,
  };
}

function normalizeAvatar(value: unknown): Avatar {
  const a = (value ?? {}) as Record<string, unknown>;
  return {
    genders: str(a.genders),
    ageRange: str(a.ageRange),
    labels: str(a.labels),
  };
}

function normalizeProblemRows(value: unknown): ProblemRow[] {
  return Array.isArray(value)
    ? value.map((p) => {
        const row = (p ?? {}) as Record<string, unknown>;
        return { problem: str(row.problem), cost: str(row.cost), result: str(row.result) };
      })
    : [];
}

function normalizeBasics(value: unknown): Basics {
  const b = (value ?? {}) as Record<string, unknown>;
  return {
    avatar: normalizeAvatar(b.avatar),
    problems: normalizeProblemRows(b.problems),
  };
}

function normalizeSevenAs(value: unknown): SevenAs {
  const s = (value ?? {}) as Record<string, unknown>;
  const out = blankSevenAs();
  for (const key of SEVEN_A_KEYS) out[key] = str(s[key]);
  return out;
}

function normalizeOffer(value: unknown): Offer {
  const o = (value ?? {}) as Record<string, unknown>;
  return {
    nameOptions: strArray(o.nameOptions),
    chosenName: str(o.chosenName),
    iHelpStatement: str(o.iHelpStatement),
    price: str(o.price),
    paymentOptions: strArray(o.paymentOptions),
    guarantee: str(o.guarantee),
    addOns: strArray(o.addOns),
    positioning: str(o.positioning),
  };
}

function normalizeDimeProblems(value: unknown): DimeProblem[] {
  return Array.isArray(value)
    ? value.map((p) => {
        const row = (p ?? {}) as Record<string, unknown>;
        return {
          title: str(row.title),
          problem: str(row.problem),
          angst: str(row.angst),
          solution: str(row.solution),
          implementation: strArray(row.implementation),
        };
      })
    : [];
}

function normalizeScriptPillars(value: unknown): ScriptPillar[] {
  return Array.isArray(value)
    ? value.map((p) => {
        const row = (p ?? {}) as Record<string, unknown>;
        return { label: str(row.label), body: str(row.body) };
      })
    : [];
}

/** Coerce arbitrary kit JSON into a fully-populated HighTicketKit. */
export function normalizeKit(value: unknown): HighTicketKit {
  const k = (value ?? {}) as Record<string, unknown>;
  return {
    basics: normalizeBasics(k.basics),
    sevenAs: normalizeSevenAs(k.sevenAs),
    offer: normalizeOffer(k.offer),
    problems: normalizeDimeProblems(k.problems),
    offerScript: normalizeScriptPillars(k.offerScript),
  };
}

// ---------------------------------------------------------------------------
// Row -> record mapper (pure)
// ---------------------------------------------------------------------------

export function rowToHighTicketKit(row: HighTicketKitRow): HighTicketKitRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: str(row.name),
    status: toHighTicketStatus(row.status),
    intake: normalizeIntake(row.intake),
    kit: normalizeKit(row.kit),
    contextRefs: normalizeContextRefs(row.context_refs),
    createdAt: row.created_at,

    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}
