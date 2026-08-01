/**
 * 1:1 Personalization domain types + pure row mappers.
 *
 * The system in one paragraph: an email CTA carries a signed `?pp=` token
 * naming the recipient. A dynamic funnel route verifies the token, loads the
 * cached AI payload for that lead, and deep-merges sparse copy overrides onto
 * the funnel's JSONB content blocks BEFORE render — so one funnel serves every
 * lead a page written for them, with zero client-side flicker and nothing
 * sensitive in the URL. In `gated` mode a missing/invalid token renders a
 * decoy page instead of the offer (competitor cloaking).
 *
 * Two tables (service-role only, like every mothermode store):
 *   mothermode_personalization_campaigns — per-funnel settings (mode, guidance)
 *   mothermode_lead_personalizations     — cached AI payload per lead per funnel
 *
 * Mappers are pure and defensive (JSONB is untyped at the DB boundary), in the
 * same style as the sales/optin funnel type modules.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const FUNNEL_KINDS = ['sales', 'optin'] as const;
export type FunnelKind = (typeof FUNNEL_KINDS)[number];

/**
 * off     — personalization disabled; token ignored.
 * overlay — token holders get a personalized page; everyone else sees the
 *           generic page as today.
 * gated   — ONLY valid-token holders see the offer; everyone else gets the
 *           decoy page. This is the "blank page without the key" play.
 */
export const PERSONALIZATION_MODES = ['off', 'overlay', 'gated'] as const;
export type PersonalizationMode = (typeof PERSONALIZATION_MODES)[number];

export const PERSONALIZATION_SOURCES = ['ai', 'admin'] as const;
export type PersonalizationSource = (typeof PERSONALIZATION_SOURCES)[number];

// ---------------------------------------------------------------------------
// Settings (mothermode_personalization_campaigns)
// ---------------------------------------------------------------------------

export interface PersonalizationSettings {
  funnelKind: FunnelKind;
  funnelId: string;
  mode: PersonalizationMode;
  /** Free-form admin steering for the AI pass ("they came from TikTok…"). */
  guidance: string;
  /** Optional branded background for the dynamic email image endpoint. */
  baseImageUrl: string;
  /** Whether the dynamic email-image URL for this funnel is active. */
  emailImageEnabled: boolean;
  updatedAt: string | null;
}

export interface PersonalizationCampaignRow {
  id: string;
  funnel_kind: string;
  funnel_id: string;
  mode: string;
  guidance: string | null;
  base_image_url: string | null;
  email_image_enabled: boolean | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Signed token (the `?pp=` value)
// ---------------------------------------------------------------------------

/**
 * Self-contained signed token payload. Deterministic per (kind, funnel, email)
 * so the same lead always gets the same token — which is what makes bulk CSV
 * export to an ESP possible (token precomputed, uploaded as a custom field).
 */
export interface PersonalizationTokenPayload {
  /** Token format version. */
  v: 1;
  /** Funnel kind — binds the token to a funnel family. */
  k: FunnelKind;
  /** Funnel id — binds the token to one funnel (no cross-funnel replay). */
  fid: string;
  /** Recipient email, lowercased. The lead lookup key. */
  em: string;
  /** Recipient first name (for {name} templating). Optional. */
  fn?: string;
  /** ISO deadline for evergreen urgency (carried now, consumed by checkout later). */
  dl?: string;
  /** Unix-seconds expiry. Absent = never expires. */
  exp?: number;
}

// ---------------------------------------------------------------------------
// AI payload (mothermode_lead_personalizations.payload)
// ---------------------------------------------------------------------------

/**
 * Sparse copy overrides for the optin step. Every field empty = no override.
 * The merge layer whitelists exactly these keys — pricing, Stripe ids, hrefs
 * and product ids can NEVER be overridden by AI output.
 */
export interface OptinCopyOverrides {
  eyebrow: string;
  headline: string;
  headlineEmphasis: string;
  headlineSuffix: string;
  subheadline: string;
  audience: string;
  benefits: string[];
  ctaText: string;
  badgeText: string;
  magnetTitle: string;
  magnetDescription: string;
}

/** Sparse overrides for the long-form sales page (copy fields only). */
export interface SalesCopyOverrides {
  eyebrow: string;
  headline: string;
  headlineEmphasis: string;
  headlineSuffix: string;
  subheadline: string;
  promise: string;
  problemHeading: string;
  problemScene: string;
  problemPoints: string[];
  ctaText: string;
  ctaSubtext: string;
  finalCtaHeading: string;
  finalCtaBody: string;
}

/** Sparse overrides for checkout copy (never price / Stripe fields). */
export interface CheckoutCopyOverrides {
  eyebrow: string;
  headline: string;
  subheadline: string;
  ctaText: string;
  bullets: string[];
}

/** Sparse overrides applied to every enabled upsell step + optin-funnel OTO. */
export interface UpsellCopyOverrides {
  eyebrow: string;
  headline: string;
  headlineEmphasis: string;
  headlineSuffix: string;
  subheadline: string;
  bigIdea: string;
}

export interface LeadPersonalizationPayload {
  version: 1;
  /** AI's read of buying intent, e.g. 'hot-clicker', 'cart-abandoner'. */
  intentSegment: string;
  /** One-line, admin-facing explanation of the personalization choices. */
  intentSummary: string;
  /** The urgency lever the copy uses: 'deadline' | 'bonus' | 'soft' | … */
  urgencyAngle: string;
  optin: OptinCopyOverrides;
  sales: SalesCopyOverrides;
  checkout: CheckoutCopyOverrides;
  upsell: UpsellCopyOverrides;
  /** Prompt for a later personalized hero image (phase 3; carried now). */
  heroImagePrompt: string;
  /** Optional hex accent ('#532B3C') — validated at merge time. */
  accentColor: string;
}

export interface LeadPersonalizationRecord {
  id: string;
  funnelKind: FunnelKind;
  funnelId: string;
  /** Lowercased recipient email — the lookup key. */
  leadKey: string;
  firstName: string | null;
  intentSegment: string;
  payload: LeadPersonalizationPayload;
  model: string;
  source: PersonalizationSource;
  generatedAt: string;
}

export interface LeadPersonalizationRow {
  id: string;
  funnel_kind: string;
  funnel_id: string;
  lead_key: string;
  first_name: string | null;
  intent_segment: string | null;
  payload: unknown;
  model: string | null;
  source: string | null;
  generated_at: string;
}

// ---------------------------------------------------------------------------
// Normalizers (pure, never throw)
// ---------------------------------------------------------------------------

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asStringArray(value: unknown, maxItems = 12, maxLen = 400): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .slice(0, maxItems)
    .map((v) => v.slice(0, maxLen));
}

export function toFunnelKind(value: unknown): FunnelKind {
  return value === 'optin' ? 'optin' : 'sales';
}

export function toPersonalizationMode(value: unknown): PersonalizationMode {
  return (PERSONALIZATION_MODES as readonly string[]).includes(value as string)
    ? (value as PersonalizationMode)
    : 'off';
}

export function toPersonalizationSource(value: unknown): PersonalizationSource {
  return value === 'admin' ? 'admin' : 'ai';
}

/** Cap any single copy override so a runaway model can't bloat a page. */
function copy(value: unknown, max = 400): string {
  return asString(value).slice(0, max);
}

export function normalizeOptinOverrides(raw: unknown): OptinCopyOverrides {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    eyebrow: copy(o.eyebrow, 120),
    headline: copy(o.headline, 200),
    headlineEmphasis: copy(o.headlineEmphasis, 120),
    headlineSuffix: copy(o.headlineSuffix, 160),
    subheadline: copy(o.subheadline, 300),
    audience: copy(o.audience, 200),
    benefits: asStringArray(o.benefits, 8, 200),
    ctaText: copy(o.ctaText, 80),
    badgeText: copy(o.badgeText, 80),
    magnetTitle: copy(o.magnetTitle, 160),
    magnetDescription: copy(o.magnetDescription, 300),
  };
}

export function normalizeSalesOverrides(raw: unknown): SalesCopyOverrides {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    eyebrow: copy(o.eyebrow, 120),
    headline: copy(o.headline, 200),
    headlineEmphasis: copy(o.headlineEmphasis, 120),
    headlineSuffix: copy(o.headlineSuffix, 160),
    subheadline: copy(o.subheadline, 300),
    promise: copy(o.promise, 300),
    problemHeading: copy(o.problemHeading, 200),
    problemScene: copy(o.problemScene, 600),
    problemPoints: asStringArray(o.problemPoints, 8, 240),
    ctaText: copy(o.ctaText, 80),
    ctaSubtext: copy(o.ctaSubtext, 160),
    finalCtaHeading: copy(o.finalCtaHeading, 200),
    finalCtaBody: copy(o.finalCtaBody, 400),
  };
}

export function normalizeCheckoutOverrides(raw: unknown): CheckoutCopyOverrides {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    eyebrow: copy(o.eyebrow, 120),
    headline: copy(o.headline, 200),
    subheadline: copy(o.subheadline, 300),
    ctaText: copy(o.ctaText, 80),
    bullets: asStringArray(o.bullets, 8, 200),
  };
}

export function normalizeUpsellOverrides(raw: unknown): UpsellCopyOverrides {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    eyebrow: copy(o.eyebrow, 120),
    headline: copy(o.headline, 200),
    headlineEmphasis: copy(o.headlineEmphasis, 120),
    headlineSuffix: copy(o.headlineSuffix, 160),
    subheadline: copy(o.subheadline, 300),
    bigIdea: copy(o.bigIdea, 400),
  };
}

export function blankPayload(): LeadPersonalizationPayload {
  return {
    version: 1,
    intentSegment: '',
    intentSummary: '',
    urgencyAngle: '',
    optin: normalizeOptinOverrides(null),
    sales: normalizeSalesOverrides(null),
    checkout: normalizeCheckoutOverrides(null),
    upsell: normalizeUpsellOverrides(null),
    heroImagePrompt: '',
    accentColor: '',
  };
}

export function normalizePayload(raw: unknown): LeadPersonalizationPayload {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    version: 1,
    intentSegment: copy(o.intentSegment, 80),
    intentSummary: copy(o.intentSummary, 240),
    urgencyAngle: copy(o.urgencyAngle, 60),
    optin: normalizeOptinOverrides(o.optin),
    sales: normalizeSalesOverrides(o.sales),
    checkout: normalizeCheckoutOverrides(o.checkout),
    upsell: normalizeUpsellOverrides(o.upsell),
    heroImagePrompt: copy(o.heroImagePrompt, 500),
    accentColor: copy(o.accentColor, 20),
  };
}

/** True when no copy override is set (payload exists but changes nothing). */
export function isEmptyPayload(p: LeadPersonalizationPayload): boolean {
  const strs = [
    ...Object.values(p.optin),
    ...Object.values(p.sales),
    ...Object.values(p.checkout),
    ...Object.values(p.upsell),
  ];
  return strs.every((v) => (Array.isArray(v) ? v.length === 0 : !String(v).trim()));
}

export function normalizeSettings(row: PersonalizationCampaignRow | null): PersonalizationSettings | null {
  if (!row) return null;
  return {
    funnelKind: toFunnelKind(row.funnel_kind),
    funnelId: asString(row.funnel_id),
    mode: toPersonalizationMode(row.mode),
    guidance: asString(row.guidance),
    baseImageUrl: asString(row.base_image_url),
    emailImageEnabled: row.email_image_enabled === true,
    updatedAt: row.updated_at ?? null,
  };
}

export function rowToLeadPersonalization(row: LeadPersonalizationRow): LeadPersonalizationRecord {
  return {
    id: row.id,
    funnelKind: toFunnelKind(row.funnel_kind),
    funnelId: asString(row.funnel_id),
    leadKey: asString(row.lead_key),
    firstName: row.first_name ?? null,
    intentSegment: asString(row.intent_segment),
    payload: normalizePayload(row.payload),
    model: asString(row.model),
    source: toPersonalizationSource(row.source),
    generatedAt: row.generated_at,
  };
}

/** Normalize + validate a parsed token object. Returns null when malformed. */
export function toTokenPayload(raw: unknown): PersonalizationTokenPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== 1) return null;
  const k = o.k === 'optin' ? 'optin' : o.k === 'sales' ? 'sales' : null;
  if (!k) return null;
  const fid = asString(o.fid).trim();
  const em = asString(o.em).trim().toLowerCase();
  if (!fid || !em || !em.includes('@')) return null;
  const out: PersonalizationTokenPayload = { v: 1, k, fid, em };
  const fn = asString(o.fn).trim();
  if (fn) out.fn = fn.slice(0, 60);
  const dl = asString(o.dl).trim();
  if (dl) out.dl = dl.slice(0, 40);
  if (typeof o.exp === 'number' && Number.isFinite(o.exp)) out.exp = Math.floor(o.exp);
  return out;
}
