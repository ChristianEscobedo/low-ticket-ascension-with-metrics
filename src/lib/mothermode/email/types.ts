/**
 * Email Marketing Kit domain types + pure row<->object mappers.
 *
 * The Email Marketing Kit is the campaign-producing sibling of the Lead Gen /
 * High Ticket / Community kits. From a short intake plus one or more attached
 * context sources (an offer, a lead magnet, a high-ticket offer, a community
 * kit) it produces a complete, outcome-driven email SEQUENCE: an ordered list
 * of emails, each with a role, send-timing, a per-email framework, and full
 * copy rendered as plain text (the source of truth) and brand-styled HTML.
 *
 * Two shapes differ from the document kits:
 *   1. It is sequence-shaped (an ordered EmailMessage[] rather than one doc).
 *   2. It is context-native: it stores ContextRef[] and resolves them at
 *      generation time via the shared Offer <-> Kit context bridge.
 *
 * Mappers are pure and side-effect free so they can be unit tested without a
 * database (JSONB is untyped at the DB boundary, so every normalizer is
 * defensive).
 */
import {
  normalizeContextRefs,
  type ContextRef,
  type ContextSourceKind,
} from '@/lib/mothermode/context';
import {
  toEmailTriggerEvent,
  normalizeTriggerConfig,
  type EmailTriggerEvent,
  type EmailTriggerConfig,
} from './triggers';


// ---------------------------------------------------------------------------
// Enums / small unions
// ---------------------------------------------------------------------------

export const EMAIL_KIT_STATUSES = ['draft', 'active', 'archived'] as const;
export type EmailKitStatus = (typeof EMAIL_KIT_STATUSES)[number];

/** Campaign types. Each drives a §3 sequence blueprint the generator follows. */
export const EMAIL_CAMPAIGN_TYPES = [
  'leadmag-to-lowticket',
  'nurture-to-offer',
  'cart-abandonment',
  'pre-post-purchase',
  'webinar-event',
  'community-onboarding',
  'event-nurture',
  'reengagement',
] as const;
export type EmailCampaignType = (typeof EMAIL_CAMPAIGN_TYPES)[number];

/** Per-email writing frameworks. Each maps to a §4 framework module. */
export const EMAIL_FRAMEWORKS = [
  'soap-opera',
  'pas',
  'value-longform',
  'story-lesson',
  'quick-win',
  'founder-note',
  'case-study',
  'objection-crusher',
  'listicle',
] as const;
export type EmailFramework = (typeof EMAIL_FRAMEWORKS)[number];

/**
 * POST-SCRIPT (P.S.) SELLING FRAMEWORKS.
 *
 * A P.S. is the most-read line of an email after the subject. These frameworks
 * let an admin bolt a proven, soft-sell P.S. onto an email's body without
 * changing its main framework. 'none' leaves the body untouched. Each maps to a
 * guidance block in openai-email.ts that tells the model how to write the P.S.
 */
export const EMAIL_PS_FRAMEWORKS = [
  'none',
  'free-or-paid-resource',
  'offer-limited-spots',
  'offer-promotion',
  'sending-traffic',
  'handling-objections',
  'booking-call',
  'low-ticket-offer',
] as const;
export type EmailPsFramework = (typeof EMAIL_PS_FRAMEWORKS)[number];

/** Human labels for the P.S. framework picker. */
export const EMAIL_PS_FRAMEWORK_LABELS: Record<EmailPsFramework, string> = {
  none: 'No P.S.',
  'free-or-paid-resource': 'P.S. — Free or paid resource',
  'offer-limited-spots': 'P.S. — Offer with limited spots',
  'offer-promotion': 'P.S. — Offer promotion',
  'sending-traffic': 'P.S. — Sending traffic (recent post)',
  'handling-objections': 'P.S. — Handling objections',
  'booking-call': 'P.S. — Booking a call (free or paid)',
  'low-ticket-offer': 'P.S. — Low-ticket offer',
};


/** The role one email plays in the sequence arc. */
export const EMAIL_ROLES = [
  'deliver',
  'nurture',
  'teach',
  'story',
  'proof',
  'bridge',
  'offer',
  'objection',
  'urgency',
  'last-call',
  'welcome',
  'onboard',
  'reminder',
  'invite',
  'replay',
  'reengage',
] as const;
export type EmailRole = (typeof EMAIL_ROLES)[number];

/** Timing style scales the send-offsets a blueprint provides. */
export const EMAIL_TIMING_STYLES = ['aggressive', 'standard', 'gentle'] as const;
export type EmailTimingStyle = (typeof EMAIL_TIMING_STYLES)[number];

/**
 * BASIC BRANCHING MODEL.
 *
 * The sequence is still stored as a flat `EmailMessage[]`, but each email may
 * declare the RECIPIENT CONDITION under which it should send (`branch`) and,
 * optionally, which earlier email that condition is evaluated against
 * (`parentId`). This keeps every existing linear sequence valid (default
 * `branch: 'always'`, `parentId: null` = the main trunk) while letting an admin
 * express simple "if they opened / clicked / purchased" forks without a graph
 * editor. Downstream (GHL/Metricool) can map these to workflow conditions.
 */
export const EMAIL_BRANCH_CONDITIONS = [
  'always',
  'opened',
  'not-opened',
  'clicked',
  'not-clicked',
  'purchased',
  'not-purchased',
] as const;
export type EmailBranchCondition = (typeof EMAIL_BRANCH_CONDITIONS)[number];

/** The context kinds a campaign expects. Aliased to the shared bridge kind. */
export type EmailContextKind = ContextSourceKind;

/** Length target the framework asks the model to hit for one email. */
export type EmailLengthTarget = 'short' | 'short/medium' | 'medium' | 'long';

// ---------------------------------------------------------------------------
// Campaign + framework spec shapes (data modules import these)
// ---------------------------------------------------------------------------

/**
 * A campaign module: the sequence blueprint the generator must follow. Kept as
 * data so a campaign can be tuned without touching generation logic. Defined
 * here (rather than in campaigns/index.ts) so each campaign module can import
 * the type without a circular dependency.
 */
export interface EmailCampaignSpec {
  /** Human label for the picker. */
  label: string;
  /** The programmatic outcome every email drives toward. */
  goal: string;
  /** The context kinds this campaign is usually built around. */
  expectsContext: EmailContextKind[];
  /** Ordered email roles: the arc the model must fill, in order. */
  emailRoles: EmailRole[];
  /** Default send-offsets aligned 1:1 with emailRoles (e.g. '+0h', '+1d'). */
  defaultTiming: string[];
  /** Optional per-role default framework override for this campaign. */
  frameworkByRole?: Partial<Record<EmailRole, EmailFramework>>;
  /** Short strategy note injected into the outline prompt. */
  strategyNote: string;
}

/**
 * A framework module: the writing structure the model applies to a single
 * email plus a length target and a short style note.
 */
export interface EmailFrameworkSpec {
  label: string;
  /** The structure the generator follows for one email body. */
  structure: string;
  /** Length band. */
  lengthTarget: EmailLengthTarget;
  /** Authoring-style guidance for prompt injection. */
  styleNote: string;
}

// ---------------------------------------------------------------------------
// Intake
// ---------------------------------------------------------------------------

export interface EmailKitIntake {
  /** Who receives the sequence. */
  audience: string;
  /** The programmatic outcome (buy, register, activate, recover). */
  goal: string;
  /** Sender name; defaults to FOUNDER when blank. */
  senderName: string;
  /** Brand voice / tone notes. */
  tone: string;
  /** Convenience offer slug; also expressible as a ContextRef. */
  offerSlug: string;
  /** Scales the send-offsets from the blueprint. */
  timingStyle: EmailTimingStyle;
  /** Anything else the generator should honor. */
  notes: string;
}

export function blankIntake(): EmailKitIntake {
  return {
    audience: '',
    goal: '',
    senderName: '',
    tone: '',
    offerSlug: '',
    timingStyle: 'standard',
    notes: '',
  };
}

// ---------------------------------------------------------------------------
// Emails + sequence
// ---------------------------------------------------------------------------

export interface EmailCta {
  label: string;
  url: string;
}

/**
 * A/B SPLIT TESTING (Phase 2).
 *
 * An optional split attached to an email. When `enabled` and there are >= 2
 * variants, the flow canvas renders this email as a SPLIT node and the export
 * layer can emit each variant. Kept fully optional so every existing email is
 * valid without it (absent => no split). A variant currently overrides the
 * subject line (the highest-leverage thing to test); `weight` is the % of
 * recipients routed to that variant.
 */
export interface EmailAbVariant {
  /** Stable id for the variant. */
  id: string;
  /** Short human label, e.g. "A" / "B" / "Curiosity". */
  label: string;
  /** Subject line for this variant (falls back to the email subject if blank). */
  subject: string;
  /** Percentage of recipients (0–100). Weights should sum to ~100. */
  weight: number;
}

export interface EmailAbTest {
  /** Whether the split is live. */
  enabled: boolean;
  /** What the split optimizes for (used later to pick a winner). */
  metric: 'open' | 'click';
  /** Two or more variants. */
  variants: EmailAbVariant[];
}

export interface EmailMessage {
  /** Stable id for per-email regen / patch-merge. */
  id: string;
  role: EmailRole;
  /** Per-email framework (defaults to the kit framework). */
  framework: EmailFramework;
  /** e.g. '+0h', '+1d', '+2d'. */
  sendOffset: string;
  subject: string;
  /** Alternate subject lines. */
  subjectIdeas: string[];
  /** Inbox preview text. */
  preview: string;
  /** Plain-text body — the source of truth. */
  bodyText: string;
  /** Rendered styled HTML (derived from bodyText; optional until rendered). */
  bodyHtml: string;
  cta: EmailCta;
  /** One-line, used in the outline. */
  summary: string;
  /**
   * Recipient condition that gates this email (basic branching). 'always' is
   * the linear trunk; the others fork on prior recipient behavior.
   */
  branch: EmailBranchCondition;
  /**
   * Id of the earlier email this branch condition is evaluated against, or null
   * to evaluate against the immediately preceding trunk email.
   */
  parentId: string | null;
  /**
   * Optional post-script selling framework appended to the body. 'none' leaves
   * the body untouched; any other value tells the generator to end the email
   * with a P.S. written in that framework.
   */
  psFramework: EmailPsFramework;
  /**
   * Hosted image URLs attached to this email (first = primary/hero). Generated
   * or edited in the per-email Image Studio; ride inside the sequence JSON.
   */
  images: string[];
  /**
   * Optional A/B split test for this email (Phase 2). Absent/undefined means no
   * split — every existing email is valid without it.
   */
  abTest?: EmailAbTest;
}

/** Stable id generator for A/B variants. */
export function makeAbVariantId(): string {
  return `ab-${Math.random().toString(36).slice(2, 8)}`;
}

/** Simple, dependency-free stable id generator for emails. */
export function makeEmailId(): string {
  return `eml-${Math.random().toString(36).slice(2, 10)}`;
}

export function blankEmail(id?: string): EmailMessage {
  return {
    id: id || makeEmailId(),
    role: 'nurture',
    framework: 'story-lesson',
    sendOffset: '+1d',
    subject: '',
    subjectIdeas: [],
    preview: '',
    bodyText: '',
    bodyHtml: '',
    cta: { label: '', url: '' },
    summary: '',
    branch: 'always',
    parentId: null,
    psFramework: 'none',
    images: [],
  };
}



export interface EmailSequence {
  name: string;
  goal: string;
  /**
   * The funnel event that enrolls a subscriber into this sequence (Phase 2).
   * Defaults to 'optin' when absent, so existing sequences render unchanged.
   */
  trigger: EmailTriggerEvent;
  /**
   * Optional admin-editable MAPPING for the trigger — which funnel page / offer
   * a funnel trigger binds to, or which content piece a content trigger fires
   * on, plus a free-form note. Absent means "use the trigger's default location
   * and bind nothing concrete", so existing sequences render unchanged.
   */
  triggerConfig?: EmailTriggerConfig;
  emails: EmailMessage[];
}

export function blankSequence(): EmailSequence {
  return { name: '', goal: '', trigger: 'optin', emails: [] };
}



// ---------------------------------------------------------------------------
// Record + DB row
// ---------------------------------------------------------------------------

export interface EmailKitRecord {
  id: string;
  slug: string;
  name: string;
  campaignType: EmailCampaignType;
  framework: EmailFramework;
  status: EmailKitStatus;
  intake: EmailKitIntake;
  contextRefs: ContextRef[];
  sequence: EmailSequence;
  createdAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface EmailKitRow {
  id: string;
  slug: string;
  name: string | null;
  campaign_type: string | null;
  framework: string | null;
  status: string | null;
  intake: unknown;
  context_refs: unknown;
  sequence: unknown;
  created_at: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

// ---------------------------------------------------------------------------
// Normalizers (defensive: JSONB is untyped at the DB boundary)
// ---------------------------------------------------------------------------

export function toEmailKitStatus(value: unknown): EmailKitStatus {
  return EMAIL_KIT_STATUSES.includes(value as EmailKitStatus)
    ? (value as EmailKitStatus)
    : 'draft';
}

export function toEmailCampaignType(value: unknown): EmailCampaignType {
  return EMAIL_CAMPAIGN_TYPES.includes(value as EmailCampaignType)
    ? (value as EmailCampaignType)
    : 'nurture-to-offer';
}

export function toEmailFramework(value: unknown): EmailFramework {
  return EMAIL_FRAMEWORKS.includes(value as EmailFramework)
    ? (value as EmailFramework)
    : 'story-lesson';
}

export function toEmailRole(value: unknown): EmailRole {
  return EMAIL_ROLES.includes(value as EmailRole)
    ? (value as EmailRole)
    : 'nurture';
}

export function toEmailTimingStyle(value: unknown): EmailTimingStyle {
  return EMAIL_TIMING_STYLES.includes(value as EmailTimingStyle)
    ? (value as EmailTimingStyle)
    : 'standard';
}

export function toEmailBranchCondition(value: unknown): EmailBranchCondition {
  return EMAIL_BRANCH_CONDITIONS.includes(value as EmailBranchCondition)
    ? (value as EmailBranchCondition)
    : 'always';
}

export function toEmailPsFramework(value: unknown): EmailPsFramework {
  return EMAIL_PS_FRAMEWORKS.includes(value as EmailPsFramework)
    ? (value as EmailPsFramework)
    : 'none';
}


function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function strArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : [];
}

/** Coerce arbitrary intake JSON into a fully-populated EmailKitIntake. */
export function normalizeIntake(value: unknown): EmailKitIntake {
  const i = (value ?? {}) as Record<string, unknown>;
  const base = blankIntake();
  return {
    audience: str(i.audience) || base.audience,
    goal: str(i.goal) || base.goal,
    senderName: str(i.senderName) || base.senderName,
    tone: str(i.tone) || base.tone,
    offerSlug: str(i.offerSlug) || base.offerSlug,
    timingStyle: toEmailTimingStyle(i.timingStyle),
    notes: str(i.notes) || base.notes,
  };
}

function normalizeCta(value: unknown): EmailCta {
  const c = (value ?? {}) as Record<string, unknown>;
  return { label: str(c.label), url: str(c.url) };
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Coerce arbitrary A/B JSON into an EmailAbTest, or `undefined` when absent.
 * Returning `undefined` (rather than a disabled stub) keeps normalized emails
 * byte-identical to legacy ones that never had the field.
 */
export function normalizeAbTest(value: unknown): EmailAbTest | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const a = value as Record<string, unknown>;
  const rawVariants = Array.isArray(a.variants) ? a.variants : [];
  const variants: EmailAbVariant[] = rawVariants.map((v) => {
    const o = (v ?? {}) as Record<string, unknown>;
    return {
      id: str(o.id) || makeAbVariantId(),
      label: str(o.label),
      subject: str(o.subject),
      weight: num(o.weight, 50),
    };
  });
  return {
    enabled: a.enabled === true,
    metric: a.metric === 'click' ? 'click' : 'open',
    variants,
  };
}

export function normalizeEmail(value: unknown): EmailMessage {
  const e = (value ?? {}) as Record<string, unknown>;
  return {
    id: str(e.id) || makeEmailId(),
    role: toEmailRole(e.role),
    framework: toEmailFramework(e.framework),
    sendOffset: str(e.sendOffset) || '+1d',
    subject: str(e.subject),
    subjectIdeas: strArray(e.subjectIdeas),
    preview: str(e.preview),
    bodyText: str(e.bodyText),
    bodyHtml: str(e.bodyHtml),
    cta: normalizeCta(e.cta),
    summary: str(e.summary),
    branch: toEmailBranchCondition(e.branch),
    parentId: typeof e.parentId === 'string' ? e.parentId : null,
    psFramework: toEmailPsFramework(e.psFramework),
    images: Array.isArray(e.images)
      ? e.images.filter((s): s is string => typeof s === 'string' && !!s.trim())
      : [],
    ...(normalizeAbTest(e.abTest) ? { abTest: normalizeAbTest(e.abTest) } : {}),
  };
}



function normalizeEmails(value: unknown): EmailMessage[] {
  return Array.isArray(value) ? value.map(normalizeEmail) : [];
}

/** Coerce arbitrary sequence JSON into a fully-populated EmailSequence. */
export function normalizeSequence(value: unknown): EmailSequence {
  const s = (value ?? {}) as Record<string, unknown>;
  const triggerConfig = normalizeTriggerConfig(s.triggerConfig);
  return {
    name: str(s.name),
    goal: str(s.goal),
    trigger: toEmailTriggerEvent(s.trigger),
    ...(triggerConfig ? { triggerConfig } : {}),
    emails: normalizeEmails(s.emails),
  };
}



// ---------------------------------------------------------------------------
// Row -> record mapper (pure)
// ---------------------------------------------------------------------------

export function rowToEmailKit(row: EmailKitRow): EmailKitRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: str(row.name),
    campaignType: toEmailCampaignType(row.campaign_type),
    framework: toEmailFramework(row.framework),
    status: toEmailKitStatus(row.status),
    intake: normalizeIntake(row.intake),
    contextRefs: normalizeContextRefs(row.context_refs),
    sequence: normalizeSequence(row.sequence),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}
