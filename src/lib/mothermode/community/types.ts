/**
 * Community Kit types + pure row<->object mappers.
 *
 * Two layers:
 *   - CommunityIntake: the short admin brief that seeds generation.
 *   - CommunityKit: the structured, editable launch kit the generator returns
 *     and the editor persists. Stored as JSONB in mothermode_community_kits.kit.
 *
 * CommunityKitRecord is the full row (intake + kit + metadata) as the app uses
 * it. Mappers are pure and side-effect free so they can be unit tested without
 * a database.
 */

// ---------------------------------------------------------------------------
// Enums / small unions
// ---------------------------------------------------------------------------

import {
  normalizeContextRefs,
  type ContextRef,
} from '@/lib/mothermode/context';

export const COMMUNITY_TYPES = ['paid', 'free', 'both'] as const;
export type CommunityType = (typeof COMMUNITY_TYPES)[number];


export const COMMUNITY_STATUSES = ['draft', 'active', 'archived'] as const;
export type CommunityStatus = (typeof COMMUNITY_STATUSES)[number];

/** Community platforms the kit can be tailored for. `label` is what the admin
 *  sees; `hint` gives the generator platform-specific nuance (post format,
 *  how members join, whether DMs / calls apply). */
export const COMMUNITY_PLATFORMS = [
  {
    value: 'Skool',
    label: 'Skool',
    hint: 'Skool community: members join with an application (answer up to 3 questions), engagement lives in a feed, and DMs happen inside Skool chat. Pinned post is a welcome/community classroom pointer.',
  },
  {
    value: 'Circle',
    label: 'Circle',
    hint: 'Circle community: spaces + posts, member DMs, and a welcome post. Joining is via invite or paid membership.',
  },
  {
    value: 'Mass (Tribes)',
    label: 'Mass (Tribes)',
    hint: 'Mass / Tribes community: mobile-first tribe feed with push notifications, member DMs, and a pinned welcome. Lean into short, punchy posts.',
  },
  {
    value: 'GHL (GoKollab)',
    label: 'GHL (GoKollab)',
    hint: 'GoHighLevel GoKollab community: channels + posts tied into a CRM, so DMs and calls can be booked through GHL calendars/automations. Pinned post should point to the next automated step.',
  },
  {
    value: 'Facebook Group',
    label: 'Facebook Group',
    hint: 'Facebook Group: up to 3 membership questions on join, a featured/announcement pinned post, and Messenger DMs. Meta lead-form ads drive traffic in.',
  },
  {
    value: 'Discord',
    label: 'Discord',
    hint: 'Discord server: channels + roles, onboarding rules gate, and DMs. Pinned post is a welcome + rules + role guide.',
  },
  {
    value: 'Other',
    label: 'Other community platform',
    hint: 'Generic community platform: a public description, a join/qualify flow, member DMs, and a pinned welcome post.',
  },
] as const;

export type CommunityPlatformValue = (typeof COMMUNITY_PLATFORMS)[number]['value'];

/** Platform-specific guidance for the generator, tolerant of free text. */
export function platformHint(value: string): string {
  const found = COMMUNITY_PLATFORMS.find(
    (p) => p.value.toLowerCase() === value.trim().toLowerCase(),
  );
  return found?.hint ?? '';
}


/** The audiences a kit's qualifying questions are produced for. */
export type CommunityAudience = 'paid' | 'free';

/** The answer shapes a qualifying question can take on a join screen. */
export const QUESTION_TYPES = ['multiple_choice', 'short_text', 'email'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** The regeneratable sections. Drives the per-section Regenerate cards and the
 *  `regenerateKitSection` action switch. */
export const KIT_SECTIONS = [
  'names',
  'description',
  'qualifyingQuestions',
  'dmScript',
  'salesCall',
  'ad',
  'leadForm',
  'pinnedPost',
] as const;
export type KitSection = (typeof KIT_SECTIONS)[number];

// ---------------------------------------------------------------------------
// Intake
// ---------------------------------------------------------------------------

export interface CommunityIntake {
  /** Market / topic the community serves. */
  niche: string;
  /** Who it's for (the avatar). */
  audience: string;
  /** The core result / transformation promised. */
  promise: string;
  /** The unexpected way / mechanism they get the result. */
  unexpectedWay: string;
  /** Pains and obstacles, free text (one per line is fine). */
  pains: string;
  /** Where the community lives (Skool, Facebook, Circle, etc.). */
  platform: string;
  /** The conversion the owner wants: book a call, sell a low-ticket offer, join
   *  a masterclass/webinar, or grow the membership. Drives every script/CTA. */
  goal: string;
  /** What the community leads to: entry offer, strategy call, workshop, webinar. */
  nextStep: string;
  /** Price point for the entry offer or paid step, if any (free text). */
  price: string;
  /** Named lead magnet / welcome asset to deliver in question 2. */
  freebie: string;
  /** Brand voice / tone notes. */
  tone: string;
  /** Anything else the generator should honor. */
  notes: string;
}

export function blankIntake(): CommunityIntake {
  return {
    niche: '',
    audience: '',
    promise: '',
    unexpectedWay: '',
    pains: '',
    platform: '',
    goal: '',
    nextStep: '',
    price: '',
    freebie: '',
    tone: '',
    notes: '',
  };
}

// ---------------------------------------------------------------------------
// Kit sections
// ---------------------------------------------------------------------------

export interface QualifyingQuestion {
  prompt: string;
  type: QuestionType;
  /** Present for multiple_choice. */
  options?: string[];
  required: boolean;
}

/** Exactly-3-per-audience qualifying questions. */
export interface QualifyingQuestions {
  paid: QualifyingQuestion[];
  free: QualifyingQuestion[];
}

export interface DmStage {
  /** welcome | qualify | invite | reengage (kept open for future stages). */
  key: string;
  label: string;
  message: string;
}

export interface DmScript {
  stages: DmStage[];
}

export interface SalesCallPhase {
  key: string;
  label: string;
  /** Speakable lines / prompts for this phase. */
  lines: string[];
}

export interface SalesCallScript {
  phases: SalesCallPhase[];
}

export interface AdConcept {
  concept: string;
  primaryText: string;
  headline: string;
  description: string;
  imagePrompt: string;
}

/** Paste-ready Facebook/Meta lead form that drives ad traffic into the group. */
export interface LeadForm {
  /** Intro card headline. */
  headline: string;
  /** Intro card body: value stack of what is inside the community. */
  description: string;
  /** Light pre-qualify questions (optional; may be empty). */
  questions: string[];
  /** Thank-you screen headline. */
  completionHeadline: string;
  /** Thank-you screen body: deliver the freebie + point to the next step. */
  completionDescription: string;
  /** Button label (matches the goal). */
  callToAction: string;
  /** Community / group link placeholder the owner pastes. */
  groupUrl: string;
}

export interface CommunityKit {
  nameOptions: string[];
  chosenName: string;
  description: string;
  qualifyingQuestions: QualifyingQuestions;
  dmScript: DmScript;
  salesCallScript: SalesCallScript;
  ad: AdConcept;
  leadForm: LeadForm;
  pinnedPost: string;
}

export function blankKit(): CommunityKit {
  return {
    nameOptions: [],
    chosenName: '',
    description: '',
    qualifyingQuestions: { paid: [], free: [] },
    dmScript: { stages: [] },
    salesCallScript: { phases: [] },
    ad: {
      concept: '',
      primaryText: '',
      headline: '',
      description: '',
      imagePrompt: '',
    },
    leadForm: {
      headline: '',
      description: '',
      questions: [],
      completionHeadline: '',
      completionDescription: '',
      callToAction: '',
      groupUrl: '',
    },
    pinnedPost: '',
  };
}

// ---------------------------------------------------------------------------
// Record + DB row
// ---------------------------------------------------------------------------

export interface CommunityKitRecord {
  id: string;
  slug: string;
  name: string;
  communityType: CommunityType;
  status: CommunityStatus;
  intake: CommunityIntake;
  kit: CommunityKit;
  contextRefs: ContextRef[];
  createdAt: string | null;

  updatedAt: string | null;
  updatedBy: string | null;
}

export interface CommunityKitRow {
  id: string;
  slug: string;
  name: string | null;
  community_type: string | null;
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

export function toCommunityType(value: unknown): CommunityType {
  return COMMUNITY_TYPES.includes(value as CommunityType)
    ? (value as CommunityType)
    : 'paid';
}

export function toCommunityStatus(value: unknown): CommunityStatus {
  return COMMUNITY_STATUSES.includes(value as CommunityStatus)
    ? (value as CommunityStatus)
    : 'draft';
}

export function toQuestionType(value: unknown): QuestionType {
  return QUESTION_TYPES.includes(value as QuestionType)
    ? (value as QuestionType)
    : 'multiple_choice';
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function normalizeQuestion(value: unknown): QualifyingQuestion {
  const q = (value ?? {}) as Record<string, unknown>;
  const type = toQuestionType(q.type);
  return {
    prompt: str(q.prompt),
    type,
    options: type === 'multiple_choice' ? strArray(q.options) : undefined,
    required: q.required !== false,
  };
}

function normalizeQuestions(value: unknown): QualifyingQuestion[] {
  return Array.isArray(value) ? value.map(normalizeQuestion) : [];
}

/** Coerce arbitrary intake JSON into a fully-populated CommunityIntake. */
export function normalizeIntake(value: unknown): CommunityIntake {
  const i = (value ?? {}) as Record<string, unknown>;
  const base = blankIntake();
  return {
    niche: str(i.niche) || base.niche,
    audience: str(i.audience) || base.audience,
    promise: str(i.promise) || base.promise,
    unexpectedWay: str(i.unexpectedWay) || base.unexpectedWay,
    pains: str(i.pains) || base.pains,
    platform: str(i.platform) || base.platform,
    goal: str(i.goal) || base.goal,
    nextStep: str(i.nextStep) || base.nextStep,
    price: str(i.price) || base.price,
    freebie: str(i.freebie) || base.freebie,
    tone: str(i.tone) || base.tone,
    notes: str(i.notes) || base.notes,
  };
}

/** Coerce arbitrary kit JSON into a fully-populated CommunityKit. */
export function normalizeKit(value: unknown): CommunityKit {
  const k = (value ?? {}) as Record<string, unknown>;
  const qq = (k.qualifyingQuestions ?? {}) as Record<string, unknown>;
  const dm = (k.dmScript ?? {}) as Record<string, unknown>;
  const sc = (k.salesCallScript ?? {}) as Record<string, unknown>;
  const ad = (k.ad ?? {}) as Record<string, unknown>;
  const lf = (k.leadForm ?? {}) as Record<string, unknown>;

  return {
    nameOptions: strArray(k.nameOptions),
    chosenName: str(k.chosenName),
    description: str(k.description),
    qualifyingQuestions: {
      paid: normalizeQuestions(qq.paid),
      free: normalizeQuestions(qq.free),
    },
    dmScript: {
      stages: Array.isArray(dm.stages)
        ? dm.stages.map((s) => {
            const stage = (s ?? {}) as Record<string, unknown>;
            return {
              key: str(stage.key),
              label: str(stage.label),
              message: str(stage.message),
            };
          })
        : [],
    },
    salesCallScript: {
      phases: Array.isArray(sc.phases)
        ? sc.phases.map((p) => {
            const phase = (p ?? {}) as Record<string, unknown>;
            return {
              key: str(phase.key),
              label: str(phase.label),
              lines: strArray(phase.lines),
            };
          })
        : [],
    },
    ad: {
      concept: str(ad.concept),
      primaryText: str(ad.primaryText),
      headline: str(ad.headline),
      description: str(ad.description),
      imagePrompt: str(ad.imagePrompt),
    },
    leadForm: {
      headline: str(lf.headline),
      description: str(lf.description),
      questions: strArray(lf.questions),
      completionHeadline: str(lf.completionHeadline),
      completionDescription: str(lf.completionDescription),
      callToAction: str(lf.callToAction),
      groupUrl: str(lf.groupUrl),
    },
    pinnedPost: str(k.pinnedPost),
  };
}

// ---------------------------------------------------------------------------
// Row -> record mapper (pure)
// ---------------------------------------------------------------------------

export function rowToCommunityKit(row: CommunityKitRow): CommunityKitRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: str(row.name),
    communityType: toCommunityType(row.community_type),
    status: toCommunityStatus(row.status),
    intake: normalizeIntake(row.intake),
    kit: normalizeKit(row.kit),
    contextRefs: normalizeContextRefs(row.context_refs),
    createdAt: row.created_at,

    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}
