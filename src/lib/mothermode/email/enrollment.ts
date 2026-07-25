/**
 * Email sequence enrollment analytics (pure, unit-testable, zero server deps).
 *
 * Phase 5 expansion of the Email Flow / Testing / Analytics build. Phase 4
 * added per-email aggregate stats (sent/opened/clicked). This module adds
 * subscriber-level analytics: enrollment funnels, per-email drop-off, cohort
 * retention, and individual subscriber journeys.
 *
 * Like `analytics.ts`, every function is pure and zero-safe: empty/null
 * inputs produce empty results (never throw). The UI degrades to a
 * "connect your ESP" empty state when no enrollment rows exist.
 *
 * Purity is deliberate: the flow dashboard overlay and the analytics
 * dashboard read through these helpers so there is no display math in the
 * components, and the behavior is testable without a DOM or a database.
 */
import type { EmailSequence } from './types';
import type { EmailStat, SequenceStats } from './analytics';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The lifecycle status of a subscriber in a sequence. */
export type EnrollmentStatus =
  | 'enrolled'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'completed'
  | 'dropped'
  | 'unsubscribed';

export const ENROLLMENT_STATUSES: EnrollmentStatus[] = [
  'enrolled',
  'sent',
  'delivered',
  'opened',
  'clicked',
  'completed',
  'dropped',
  'unsubscribed',
];

/** A single subscriber's enrollment record (their current position + status). */
export interface Enrollment {
  subscriberId: string;
  /** Current email id (empty = enrolled but not yet sent to). */
  emailId: string;
  status: EnrollmentStatus;
  enrolledAt: string;
  lastEventAt: string;
  metadata?: Record<string, unknown>;
}

/** A single touchpoint in a subscriber's journey. */
export interface EmailEvent {
  subscriberId: string;
  emailId: string;
  eventType: string;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}

/** Aggregated enrollment data for a kit. */
export interface EnrollmentData {
  kitId: string;
  enrollments: Enrollment[];
  /** ISO timestamp of the last ingestion, or null when never populated. */
  updatedAt: string | null;
}

// ---------------------------------------------------------------------------
// Funnel
// ---------------------------------------------------------------------------

/** A single step in the enrollment funnel. */
export interface FunnelStep {
  /** The stage label (enrolled, delivered, opened, clicked, completed). */
  stage: string;
  /** Count of subscribers who reached this stage. */
  count: number;
  /** Conversion rate from the previous step (0 for the first step). */
  rate: number;
  /** Cumulative conversion rate from enrollment (1.0 for the first step). */
  cumulativeRate: number;
}

/**
 * Compute the enrollment funnel from aggregate stats. Uses the sequence-level
 * totals from `SequenceStats` to derive how many subscribers progressed
 * through each stage.
 *
 * The funnel stages are: enrolled (= sent) → delivered → opened → clicked →
 * converted (= clicked as proxy, same as `conversionRate`).
 *
 * Pure and zero-safe: empty stats → empty funnel.
 */
export function enrollmentFunnel(stats: SequenceStats | null | undefined): FunnelStep[] {
  if (!stats || !stats.byEmail) return [];

  const totals: EmailStat = {
    emailId: '__total__',
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    unsubscribed: 0,
    bounced: 0,
  };
  for (const s of Object.values(stats.byEmail)) {
    totals.sent += s.sent;
    totals.delivered += s.delivered;
    totals.opened += s.opened;
    totals.clicked += s.clicked;
    totals.unsubscribed += s.unsubscribed;
    totals.bounced += s.bounced;
  }

  if (totals.sent === 0) return [];

  const steps = [
    { stage: 'Enrolled', count: totals.sent },
    { stage: 'Delivered', count: totals.delivered },
    { stage: 'Opened', count: totals.opened },
    { stage: 'Clicked', count: totals.clicked },
    { stage: 'Converted', count: totals.clicked }, // proxy: clicks as conversions
  ];

  const enrolled = totals.sent;
  return steps.map((step, i) => {
    const prev = i === 0 ? step.count : steps[i - 1].count;
    const rate = prev > 0 ? step.count / prev : 0;
    const cumulativeRate = enrolled > 0 ? step.count / enrolled : 0;
    return {
      stage: step.stage,
      count: step.count,
      rate: i === 0 ? 1 : clamp01(rate),
      cumulativeRate: clamp01(cumulativeRate),
    };
  });
}

// ---------------------------------------------------------------------------
// Active subscribers
// ---------------------------------------------------------------------------

/**
 * Count subscribers currently "in flight" — enrolled but not yet completed,
 * dropped, or unsubscribed.
 *
 * Pure and zero-safe: empty data → 0.
 */
export function activeSubscribers(data: EnrollmentData | null | undefined): number {
  if (!data || !Array.isArray(data.enrollments)) return 0;
  return data.enrollments.filter(
    (e) => e.status !== 'completed' && e.status !== 'dropped' && e.status !== 'unsubscribed',
  ).length;
}

/** Total enrolled count (all statuses). */
export function totalEnrolled(data: EnrollmentData | null | undefined): number {
  if (!data || !Array.isArray(data.enrollments)) return 0;
  return data.enrollments.length;
}

/** Count subscribers by status. */
export function countByStatus(
  data: EnrollmentData | null | undefined,
): Record<EnrollmentStatus, number> {
  const empty: Record<EnrollmentStatus, number> = {
    enrolled: 0,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    completed: 0,
    dropped: 0,
    unsubscribed: 0,
  };
  if (!data || !Array.isArray(data.enrollments)) return empty;
  for (const e of data.enrollments) {
    if (e.status in empty) empty[e.status]++;
  }
  return empty;
}

// ---------------------------------------------------------------------------
// Per-email drop-off
// ---------------------------------------------------------------------------

/** Drop-off data for a single email. */
export interface EmailDropoff {
  emailId: string;
  /** Subscribers who were sent this email. */
  sent: number;
  /** Subscribers who opened it. */
  opened: number;
  /** Subscribers who clicked. */
  clicked: number;
  /** Subscribers who dropped after this email (didn't progress). */
  dropped: number;
  /** Drop-off rate: dropped / sent. */
  dropoffRate: number;
  /** Open rate: opened / sent. */
  openRate: number;
  /** CTR: clicked / sent. */
  ctr: number;
}

/**
 * Compute per-email drop-off from aggregate stats + enrollment data.
 *
 * Uses `stats` for sent/opened/clicked counts and `enrollments` for the
 * dropped count (subscribers whose `status === 'dropped'` and `emailId`
 * matches this email).
 *
 * Pure and zero-safe: empty inputs → empty array.
 */
export function dropoffByEmail(
  sequence: EmailSequence | null | undefined,
  stats: SequenceStats | null | undefined,
  data: EnrollmentData | null | undefined,
): EmailDropoff[] {
  const emails = Array.isArray(sequence?.emails) ? sequence!.emails : [];
  if (emails.length === 0) return [];

  // Build a map of dropped counts by emailId from enrollment data.
  const droppedBy: Record<string, number> = {};
  if (data && Array.isArray(data.enrollments)) {
    for (const e of data.enrollments) {
      if (e.status === 'dropped' && e.emailId) {
        droppedBy[e.emailId] = (droppedBy[e.emailId] ?? 0) + 1;
      }
    }
  }

  return emails.map((email) => {
    const stat = stats?.byEmail?.[email.id];
    const sent = stat?.sent ?? 0;
    const opened = stat?.opened ?? 0;
    const clicked = stat?.clicked ?? 0;
    const dropped = droppedBy[email.id] ?? 0;
    return {
      emailId: email.id,
      sent,
      opened,
      clicked,
      dropped,
      dropoffRate: ratio(dropped, sent),
      openRate: ratio(opened, sent),
      ctr: ratio(clicked, sent),
    };
  });
}

// ---------------------------------------------------------------------------
// Cohort retention
// ---------------------------------------------------------------------------

/** A cohort bucket for retention analysis. */
export interface CohortBucket {
  /** Cohort label, e.g. "2026-07 W3" or "2026-07". */
  label: string;
  /** ISO date of the cohort start. */
  startDate: string;
  /** Number of subscribers enrolled in this cohort. */
  enrolled: number;
  /** Per-email retention: index i = % of cohort still active after email i. */
  retention: number[];
}

/**
 * Group enrollments into cohort buckets by enrollment week (or month).
 *
 * Each cohort's retention array shows what % of the cohort is still active
 * (not dropped/unsubscribed) at each email position in the sequence.
 *
 * Pure and zero-safe: empty data → empty array.
 *
 * @param period 'week' | 'month' (default 'week')
 */
export function cohortBuckets(
  sequence: EmailSequence | null | undefined,
  data: EnrollmentData | null | undefined,
  period: 'week' | 'month' = 'week',
): CohortBucket[] {
  if (!data || !Array.isArray(data.enrollments) || data.enrollments.length === 0) return [];

  const emails = Array.isArray(sequence?.emails) ? sequence!.emails : [];
  const emailCount = emails.length;

  // Group enrollments by cohort key.
  const groups = new Map<string, Enrollment[]>();
  for (const e of data.enrollments) {
    const key = cohortKey(e.enrolledAt, period);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }

  // Sort cohorts chronologically.
  const sortedKeys = Array.from(groups.keys()).sort();

  return sortedKeys.map((key) => {
    const cohort = groups.get(key)!;
    const enrolled = cohort.length;
    const startDate = cohort[0]?.enrolledAt ?? '';

    // Retention: for each email position, count how many cohort members
    // are still active (not dropped/unsubscribed) and have progressed to
    // at least that email.
    const retention: number[] = [];
    for (let i = 0; i < emailCount; i++) {
      const emailId = emails[i].id;
      const stillActive = cohort.filter(
        (e) =>
          e.status !== 'dropped' &&
          e.status !== 'unsubscribed' &&
          // They've reached at least this email (their current email is at
          // or past position i, or they've completed).
          (e.status === 'completed' ||
            emailIndexInSequence(e.emailId, emails) >= i),
      ).length;
      retention.push(enrolled > 0 ? stillActive / enrolled : 0);
    }

    return { label: key, startDate, enrolled, retention };
  });
}

// ---------------------------------------------------------------------------
// Subscriber journey
// ---------------------------------------------------------------------------

/** A single touchpoint in a subscriber's journey, enriched with email info. */
export interface JourneyTouchpoint {
  emailId: string;
  eventType: string;
  occurredAt: string;
  /** The subject line of the email this event pertains to (if known). */
  subject?: string;
  /** The role of the email (if known). */
  role?: string;
}

/**
 * Build an ordered timeline of touchpoints for a single subscriber.
 *
 * Pure and zero-safe: empty events → empty array.
 */
export function journeyForSubscriber(
  events: EmailEvent[] | null | undefined,
  sequence: EmailSequence | null | undefined,
  subscriberId: string,
): JourneyTouchpoint[] {
  if (!events || !Array.isArray(events)) return [];

  const emails = Array.isArray(sequence?.emails) ? sequence!.emails : [];
  const emailMap = new Map(emails.map((e) => [e.id, e]));

  return events
    .filter((e) => e.subscriberId === subscriberId)
    .sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0))
    .map((e) => {
      const email = emailMap.get(e.emailId);
      return {
        emailId: e.emailId,
        eventType: e.eventType,
        occurredAt: e.occurredAt,
        ...(email?.subject ? { subject: email.subject } : {}),
        ...(email?.role ? { role: email.role } : {}),
      };
    });
}

// ---------------------------------------------------------------------------
// Normalizers (defensive: JSONB is untyped at the DB boundary)
// ---------------------------------------------------------------------------

/** Coerce an unknown status string into an `EnrollmentStatus`. */
export function toEnrollmentStatus(value: unknown): EnrollmentStatus {
  const s = typeof value === 'string' ? value : '';
  return ENROLLMENT_STATUSES.includes(s as EnrollmentStatus)
    ? (s as EnrollmentStatus)
    : 'enrolled';
}

/** Coerce any partial/unknown object into a well-formed `Enrollment`. */
export function normalizeEnrollment(input: unknown): Enrollment {
  const o = (input ?? {}) as Record<string, unknown>;
  return {
    subscriberId:
      typeof o.subscriberId === 'string'
        ? o.subscriberId
        : typeof o.subscriber_id === 'string'
          ? (o.subscriber_id as string)
          : '',
    emailId:
      typeof o.emailId === 'string'
        ? o.emailId
        : typeof o.email_id === 'string'
          ? (o.email_id as string)
          : '',
    status: toEnrollmentStatus(o.status),
    enrolledAt:
      typeof o.enrolledAt === 'string'
        ? o.enrolledAt
        : typeof o.enrolled_at === 'string'
          ? (o.enrolled_at as string)
          : '',
    lastEventAt:
      typeof o.lastEventAt === 'string'
        ? o.lastEventAt
        : typeof o.last_event_at === 'string'
          ? (o.last_event_at as string)
          : '',
    ...(o.metadata && typeof o.metadata === 'object'
      ? { metadata: o.metadata as Record<string, unknown> }
      : {}),
  };
}

/** Coerce any partial/unknown object into a well-formed `EmailEvent`. */
export function normalizeEvent(input: unknown): EmailEvent {
  const o = (input ?? {}) as Record<string, unknown>;
  return {
    subscriberId:
      typeof o.subscriberId === 'string'
        ? o.subscriberId
        : typeof o.subscriber_id === 'string'
          ? (o.subscriber_id as string)
          : '',
    emailId:
      typeof o.emailId === 'string'
        ? o.emailId
        : typeof o.email_id === 'string'
          ? (o.email_id as string)
          : '',
    eventType:
      typeof o.eventType === 'string'
        ? o.eventType
        : typeof o.event_type === 'string'
          ? (o.event_type as string)
          : '',
    occurredAt:
      typeof o.occurredAt === 'string'
        ? o.occurredAt
        : typeof o.occurred_at === 'string'
          ? (o.occurred_at as string)
          : '',
    ...(o.metadata && typeof o.metadata === 'object'
      ? { metadata: o.metadata as Record<string, unknown> }
      : {}),
  };
}

/** Coerce a stored/ESP payload into a well-formed `EnrollmentData`. */
export function normalizeEnrollmentData(input: unknown): EnrollmentData {
  const o = (input ?? {}) as Record<string, unknown>;
  const kitId = typeof o.kitId === 'string' ? o.kitId : '';
  const rawEnrollments = Array.isArray(o.enrollments)
    ? o.enrollments
    : Array.isArray(o.data)
      ? o.data
      : [];
  const enrollments = rawEnrollments.map(normalizeEnrollment);
  const updatedAt =
    typeof o.updatedAt === 'string'
      ? o.updatedAt
      : typeof o.updated_at === 'string'
        ? (o.updated_at as string)
        : null;
  return { kitId, enrollments, updatedAt };
}

/** An empty enrollment data object for a kit (drives the empty-state gate). */
export function emptyEnrollmentData(kitId: string): EnrollmentData {
  return { kitId, enrollments: [], updatedAt: null };
}

/** Whether any enrollment rows exist (drives the empty-state gate). */
export function hasEnrollments(data: EnrollmentData | null | undefined): boolean {
  if (!data || !Array.isArray(data.enrollments)) return false;
  return data.enrollments.length > 0;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Zero-safe ratio: denominator 0 → 0 (never NaN/Infinity), clamped to [0,1]. */
function ratio(numerator: number, denominator: number): number {
  if (!denominator || denominator <= 0) return 0;
  const r = numerator / denominator;
  if (!Number.isFinite(r) || r < 0) return 0;
  return r > 1 ? 1 : r;
}

/** Clamp a number to [0, 1]. */
function clamp01(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return n > 1 ? 1 : n;
}

/** Find the index of an email id in the sequence, or -1. */
function emailIndexInSequence(emailId: string, emails: { id: string }[]): number {
  return emails.findIndex((e) => e.id === emailId);
}

/** Generate a cohort key from an ISO timestamp. */
function cohortKey(iso: string, period: 'week' | 'month'): string {
  if (!iso) return 'unknown';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'unknown';
    if (period === 'month') {
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    }
    // Week: ISO week number.
    const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayNum = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${tmp.getUTCFullYear()} W${String(weekNum).padStart(2, '0')}`;
  } catch {
    return 'unknown';
  }
}