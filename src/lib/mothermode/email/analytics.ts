/**
 * Email sequence analytics (pure, unit-testable, zero server deps).
 *
 * Phase 4 of the Email Flow / Testing / Analytics plan. We currently
 * generate/export copy but do NOT ingest sends/opens/clicks, so this module is
 * the *shape* of analytics: defensive normalizers + zero-safe rate math + A/B
 * roll-ups that light up the instant an ESP integration populates
 * `mothermode_email_stats`. Every surface degrades to an empty state when no
 * rows exist (see `hasAnyStats`).
 *
 * Purity is deliberate: the canvas overlay (`EmailFlowPanel`) and any future
 * analytics panel read through these helpers so there is no display math in the
 * components, and the behavior is testable without a DOM or a database.
 */
import type { EmailSequence } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmailStat {
  /** `EmailMessage.id` (or a variant id for A/B roll-ups). */
  emailId: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  bounced: number;
  /** Attributed revenue (optional; ESP-dependent). */
  revenue?: number;
}

export interface SequenceStats {
  kitId: string;
  /** Keyed by `EmailMessage.id` (and optionally A/B variant id). */
  byEmail: Record<string, EmailStat>;
  /** ISO timestamp of the last ingestion, or null when never populated. */
  updatedAt: string | null;
}

/** What an A/B split optimizes for when picking a winner. */
export type AbWinnerMetric = 'open' | 'click' | 'ctor' | 'revenue';

export interface AbVariantStat {
  id: string;
  label: string;
  weight?: number;
  stat: EmailStat;
}

// ---------------------------------------------------------------------------
// Coercion helpers
// ---------------------------------------------------------------------------

/** Non-negative integer coercion (junk → 0). */
function count(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/** Non-negative float coercion (junk → 0). */
function amount(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/** Zero-safe ratio: denominator 0 → 0 (never NaN/Infinity), clamped to [0,1]. */
function ratio(numerator: number, denominator: number): number {
  if (!denominator || denominator <= 0) return 0;
  const r = numerator / denominator;
  if (!Number.isFinite(r) || r < 0) return 0;
  return r > 1 ? 1 : r;
}

// ---------------------------------------------------------------------------
// Stat construction / normalization
// ---------------------------------------------------------------------------

/** A zeroed stat for an email id — the safe default when no data exists. */
export function emptyStat(emailId: string): EmailStat {
  return {
    emailId,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    unsubscribed: 0,
    bounced: 0,
  };
}

/** Coerce any partial/unknown object into a well-formed `EmailStat`. */
export function normalizeStat(input: unknown, fallbackId = ''): EmailStat {
  const o = (input ?? {}) as Record<string, unknown>;
  const emailId =
    typeof o.emailId === 'string' && o.emailId
      ? o.emailId
      : typeof o.email_id === 'string' && o.email_id
        ? (o.email_id as string)
        : fallbackId;
  const stat: EmailStat = {
    emailId,
    sent: count(o.sent),
    delivered: count(o.delivered),
    opened: count(o.opened),
    clicked: count(o.clicked),
    unsubscribed: count(o.unsubscribed),
    bounced: count(o.bounced),
  };
  if (o.revenue !== undefined && o.revenue !== null) {
    stat.revenue = amount(o.revenue);
  }
  return stat;
}

/** Coerce a stored/ESP payload into a well-formed `SequenceStats`. */
export function normalizeSequenceStats(input: unknown): SequenceStats {
  const o = (input ?? {}) as Record<string, unknown>;
  const kitId = typeof o.kitId === 'string' ? o.kitId : '';
  const byEmail: Record<string, EmailStat> = {};

  // Accept either a map (`byEmail`) or a flat array of stats (`stats`).
  const rawMap = o.byEmail && typeof o.byEmail === 'object' ? (o.byEmail as Record<string, unknown>) : null;
  if (rawMap) {
    for (const [key, value] of Object.entries(rawMap)) {
      byEmail[key] = normalizeStat(value, key);
    }
  }
  const rawArray = Array.isArray(o.stats) ? o.stats : Array.isArray(o.byEmail) ? o.byEmail : null;
  if (rawArray) {
    for (const value of rawArray) {
      const stat = normalizeStat(value);
      if (stat.emailId) byEmail[stat.emailId] = stat;
    }
  }

  const updatedAt =
    typeof o.updatedAt === 'string'
      ? o.updatedAt
      : typeof o.updated_at === 'string'
        ? (o.updated_at as string)
        : null;

  return { kitId, byEmail, updatedAt };
}

/** An empty stats object for a kit (drives the "connect your ESP" state). */
export function emptySequenceStats(kitId: string): SequenceStats {
  return { kitId, byEmail: {}, updatedAt: null };
}

// ---------------------------------------------------------------------------
// Rate math (all zero-safe)
// ---------------------------------------------------------------------------

export function deliveryRate(stat: EmailStat): number {
  return ratio(stat.delivered, stat.sent);
}
export function openRate(stat: EmailStat): number {
  return ratio(stat.opened, stat.delivered);
}
/** Click-through rate: clicks / delivered. */
export function ctr(stat: EmailStat): number {
  return ratio(stat.clicked, stat.delivered);
}
/** Click-to-open rate: clicks / opens. */
export function clickToOpenRate(stat: EmailStat): number {
  return ratio(stat.clicked, stat.opened);
}
export function unsubscribeRate(stat: EmailStat): number {
  return ratio(stat.unsubscribed, stat.delivered);
}
export function bounceRate(stat: EmailStat): number {
  return ratio(stat.bounced, stat.sent);
}
/**
 * Conversion rate. Until an ESP reports true conversions, this uses clicks as a
 * proxy (clicks / delivered). Documented as a proxy in the port doc.
 */
export function conversionRate(stat: EmailStat): number {
  return ratio(stat.clicked, stat.delivered);
}
export function revenuePerEmail(stat: EmailStat): number {
  return stat.revenue ?? 0;
}

// ---------------------------------------------------------------------------
// Roll-ups
// ---------------------------------------------------------------------------

/** Sum every counter across all emails into one total stat. */
export function sequenceTotals(stats: SequenceStats): EmailStat {
  const total = emptyStat('__total__');
  let revenue = 0;
  let sawRevenue = false;
  for (const stat of Object.values(stats.byEmail)) {
    total.sent += stat.sent;
    total.delivered += stat.delivered;
    total.opened += stat.opened;
    total.clicked += stat.clicked;
    total.unsubscribed += stat.unsubscribed;
    total.bounced += stat.bounced;
    if (stat.revenue !== undefined) {
      revenue += stat.revenue;
      sawRevenue = true;
    }
  }
  if (sawRevenue) total.revenue = revenue;
  return total;
}

/** Whether any email has real volume (drives the empty-state gate). */
export function hasAnyStats(stats: SequenceStats | null | undefined): boolean {
  if (!stats || !stats.byEmail) return false;
  return Object.values(stats.byEmail).some((s) => s.sent > 0);
}

/** The stat for one email, or a zeroed default when absent. */
export function statFor(stats: SequenceStats | null | undefined, emailId: string): EmailStat {
  const found = stats?.byEmail?.[emailId];
  return found ? found : emptyStat(emailId);
}

// ---------------------------------------------------------------------------
// A/B winner selection
// ---------------------------------------------------------------------------

/** The comparable score for a variant under a given metric. */
function variantScore(stat: EmailStat, metric: AbWinnerMetric): number {
  switch (metric) {
    case 'click':
      return ctr(stat);
    case 'ctor':
      return clickToOpenRate(stat);
    case 'revenue':
      return revenuePerEmail(stat);
    case 'open':
    default:
      return openRate(stat);
  }
}

/**
 * Pick the winning A/B variant by a metric. Pure and deterministic:
 * - all-zero volume across variants → `null` (no winner yet)
 * - ties resolve to the higher weight, then the lexicographically-first label
 */
export function pickAbWinner(
  variants: AbVariantStat[],
  metric: AbWinnerMetric = 'open',
): AbVariantStat | null {
  if (!variants || variants.length === 0) return null;
  // No data at all → no winner.
  const anyVolume = variants.some((v) => v.stat.sent > 0 || v.stat.delivered > 0);
  if (!anyVolume) return null;

  let best: AbVariantStat | null = null;
  let bestScore = -1;
  for (const v of variants) {
    const score = variantScore(v.stat, metric);
    if (score > bestScore) {
      best = v;
      bestScore = score;
      continue;
    }
    if (score === bestScore && best) {
      const wA = best.weight ?? 0;
      const wB = v.weight ?? 0;
      if (wB > wA || (wB === wA && v.label.localeCompare(best.label) < 0)) {
        best = v;
      }
    }
  }
  // If the winning score is 0 (e.g. metric has no signal yet), no winner.
  return bestScore > 0 ? best : null;
}

/**
 * Roll up A/B variant stats for every enabled split in a sequence. Variant-level
 * stats are looked up by variant id in `stats.byEmail` (an ESP that reports
 * per-variant metrics keys them by variant id); falls back to a zeroed stat.
 */
export function abVariantStats(
  sequence: EmailSequence | null | undefined,
  stats: SequenceStats | null | undefined,
  metric: AbWinnerMetric = 'open',
): Array<{ emailId: string; variants: AbVariantStat[]; winner: AbVariantStat | null }> {
  const emails = Array.isArray(sequence?.emails) ? sequence!.emails : [];
  const out: Array<{ emailId: string; variants: AbVariantStat[]; winner: AbVariantStat | null }> = [];
  for (const email of emails) {
    const ab = email.abTest;
    if (!ab || !ab.enabled || !Array.isArray(ab.variants) || ab.variants.length === 0) {
      continue;
    }
    const variants: AbVariantStat[] = ab.variants.map((v) => ({
      id: v.id,
      label: v.label || v.id,
      weight: v.weight,
      stat: statFor(stats, v.id),
    }));
    out.push({ emailId: email.id, variants, winner: pickAbWinner(variants, metric) });
  }
  return out;
}
