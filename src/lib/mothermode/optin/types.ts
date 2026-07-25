/**
 * MotherMode Optin Funnel domain types + pure row mappers.
 *
 * An optin funnel is a three-step lead capture path:
 *   optin page → OTO (optional offer) → thank-you
 *
 * Content for each step lives in JSONB blocks on mothermode_optin_funnels so
 * the page shape can grow without migrations. Mappers are pure and defensive
 * (JSONB is untyped at the DB boundary).
 *
 * Visual language: Editorial Warm (bone / ink / mode / brass) — same as
 * MotherModeSalesPage. Not the storyflow glass templates.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const OPTIN_FUNNEL_STATUSES = ['draft', 'published', 'archived'] as const;
export type OptinFunnelStatus = (typeof OPTIN_FUNNEL_STATUSES)[number];

export const OPTIN_LEAD_STATUSES = ['captured', 'oto_accepted', 'oto_declined'] as const;
export type OptinLeadStatus = (typeof OPTIN_LEAD_STATUSES)[number];

// ---------------------------------------------------------------------------
// Content blocks
// ---------------------------------------------------------------------------

/** Optin (step 1) page copy + form chrome. */
export interface OptinPageContent {
  eyebrow: string;
  headline: string;
  /** Italic / mode-colored middle of the headline (optional). */
  headlineEmphasis: string;
  headlineSuffix: string;
  subheadline: string;
  /** Short audience line under the subhead (italic). */
  audience: string;
  benefits: string[];
  ctaText: string;
  badgeText: string;
  /** Lead magnet name shown near the form. */
  magnetTitle: string;
  magnetDescription: string;
  coverImageUrl: string;
  /** Hero video URL (YouTube embed, MP4, or empty). */
  heroVideoUrl: string;
  /** Placeholder text on the email input. */
  emailPlaceholder: string;
  namePlaceholder: string;
  /** Collect first name? */
  collectName: boolean;
  privacyNote: string;
}

/** OTO (step 2) — display + CTA link for v1 (paid charge comes later). */
export interface OptinOtoContent {
  enabled: boolean;
  eyebrow: string;
  headline: string;
  subheadline: string;
  bullets: string[];
  /** Display price, e.g. "$27" — not charged in Phase 1. */
  priceLabel: string;
  originalPriceLabel: string;
  ctaYes: string;
  ctaNo: string;
  /** Where "yes" goes (external URL or internal path). Empty = thank-you. */
  yesHref: string;
  timerMinutes: number;
  /** Product/mockup image URL for the OTO. */
  imageUrl: string;
  /** Product/demo video URL (YouTube embed, MP4, or empty). */
  videoUrl: string;
}

/** Thank-you (step 3). */
export interface OptinThankYouContent {
  headline: string;
  subheadline: string;
  /** Primary next-step button. */
  ctaText: string;
  /** Where the CTA goes. Falls back to offer_slug / deliverable if empty. */
  ctaHref: string;
  secondaryNote: string;
}

/**
 * Programmable footer for optin pages. No header chrome on these routes;
 * the footer carries disclaimers, advertising disclosures, links, and
 * copyright. All editable inline by admins.
 */
export interface OptinFooterContent {
  /** Show the footer at all? */
  enabled: boolean;
  /** Small brand line, e.g. "MotherMode" or empty to hide. */
  brandLine: string;
  /** Disclaimer / advertising disclosure paragraph. */
  disclaimer: string;
  /** Footer link rows: { label, href } */
  links: { label: string; href: string }[];
  /** Copyright line, e.g. "© 2026 MotherMode. All rights reserved." */
  copyright: string;
}


// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export interface OptinFunnelRecord {
  id: string;
  slug: string;
  name: string;
  status: OptinFunnelStatus;
  offerSlug: string | null;
  leadGenSlug: string | null;
  deliverableSlug: string | null;
  deliverableKey: string | null;
  /** Email Marketing kit id to auto-enroll on capture. */
  emailKitId: string | null;
  optin: OptinPageContent;
  oto: OptinOtoContent;
  thankyou: OptinThankYouContent;
  footer: OptinFooterContent;
  viewCount: number;
  conversionCount: number;
  otoYesCount: number;
  otoNoCount: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
}


export interface OptinLeadRecord {
  id: string;
  funnelId: string;
  email: string;
  firstName: string | null;
  status: OptinLeadStatus;
  otoAccepted: boolean;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrer: string | null;
  createdAt: string;
  updatedAt: string;
  /** Joined funnel name when listing from admin. */
  funnelName?: string;
  funnelSlug?: string;
}

/** Raw DB row shape (snake_case). */
export interface OptinFunnelRow {
  id: string;
  slug: string;
  name: string;
  status: string;
  offer_slug: string | null;
  lead_gen_slug: string | null;
  deliverable_slug: string | null;
  deliverable_key: string | null;
  email_kit_id: string | null;
  optin: unknown;
  oto: unknown;
  thankyou: unknown;
  footer: unknown;
  view_count: number;
  conversion_count: number;
  oto_yes_count?: number;
  oto_no_count?: number;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export type OptinEventType = 'view' | 'submit' | 'oto_yes' | 'oto_no';


export interface OptinLeadRow {
  id: string;
  funnel_id: string;
  email: string;
  first_name: string | null;
  status: string;
  oto_accepted: boolean;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer: string | null;
  user_agent: string | null;
  ip_hash: string | null;
  metadata: unknown;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Normalizers (pure, never throw)
// ---------------------------------------------------------------------------

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asBool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
}

export function toOptinFunnelStatus(value: unknown): OptinFunnelStatus {
  if (typeof value === 'string' && (OPTIN_FUNNEL_STATUSES as readonly string[]).includes(value)) {
    return value as OptinFunnelStatus;
  }
  return 'draft';
}

export function toOptinLeadStatus(value: unknown): OptinLeadStatus {
  if (typeof value === 'string' && (OPTIN_LEAD_STATUSES as readonly string[]).includes(value)) {
    return value as OptinLeadStatus;
  }
  return 'captured';
}

export function normalizeOptinPage(raw: unknown): OptinPageContent {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    eyebrow: asString(o.eyebrow),
    headline: asString(o.headline),
    headlineEmphasis: asString(o.headlineEmphasis),
    headlineSuffix: asString(o.headlineSuffix),
    subheadline: asString(o.subheadline),
    audience: asString(o.audience),
    benefits: asStringArray(o.benefits),
    ctaText: asString(o.ctaText, 'Send it to me'),
    badgeText: asString(o.badgeText),
    magnetTitle: asString(o.magnetTitle),
    magnetDescription: asString(o.magnetDescription),
    coverImageUrl: asString(o.coverImageUrl),
    heroVideoUrl: asString(o.heroVideoUrl),
    emailPlaceholder: asString(o.emailPlaceholder, 'you@email.com'),
    namePlaceholder: asString(o.namePlaceholder, 'First name'),
    collectName: asBool(o.collectName, true),
    privacyNote: asString(
      o.privacyNote,
      'No spam. Unsubscribe anytime. Your email stays private.',
    ),
  };
}

export function normalizeOptinOto(raw: unknown): OptinOtoContent {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    enabled: asBool(o.enabled, true),
    eyebrow: asString(o.eyebrow),
    headline: asString(o.headline),
    subheadline: asString(o.subheadline),
    bullets: asStringArray(o.bullets),
    priceLabel: asString(o.priceLabel),
    originalPriceLabel: asString(o.originalPriceLabel),
    ctaYes: asString(o.ctaYes, 'Yes, I want this'),
    ctaNo: asString(o.ctaNo, 'No thanks, continue'),
    yesHref: asString(o.yesHref),
    timerMinutes: asNumber(o.timerMinutes, 15),
    imageUrl: asString(o.imageUrl),
    videoUrl: asString(o.videoUrl),
  };
}

export function normalizeOptinThankYou(raw: unknown): OptinThankYouContent {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    headline: asString(o.headline, 'You are in.'),
    subheadline: asString(o.subheadline),
    ctaText: asString(o.ctaText, 'Continue'),
    ctaHref: asString(o.ctaHref),
    secondaryNote: asString(o.secondaryNote),
  };
}

export function normalizeOptinFooter(raw: unknown): OptinFooterContent {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const rawLinks = Array.isArray(o.links) ? o.links : [];
  const links = rawLinks
    .filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
    .map((x) => ({ label: asString(x.label), href: asString(x.href) }))
    .filter((x) => x.label || x.href);
  return {
    enabled: asBool(o.enabled, true),
    brandLine: asString(o.brandLine, 'MotherMode'),
    disclaimer: asString(
      o.disclaimer,
      'This page may contain affiliate links. We may earn a commission if you purchase through them. Results are not guaranteed.',
    ),
    links,
    copyright: asString(o.copyright, `© ${new Date().getFullYear()} MotherMode. All rights reserved.`),
  };
}


export function rowToOptinFunnel(row: OptinFunnelRow): OptinFunnelRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name ?? '',
    status: toOptinFunnelStatus(row.status),
    offerSlug: row.offer_slug,
    leadGenSlug: row.lead_gen_slug,
    deliverableSlug: row.deliverable_slug,
    deliverableKey: row.deliverable_key,
    emailKitId: row.email_kit_id ?? null,
    optin: normalizeOptinPage(row.optin),
    oto: normalizeOptinOto(row.oto),
    thankyou: normalizeOptinThankYou(row.thankyou),
    footer: normalizeOptinFooter(row.footer),
    viewCount: asNumber(row.view_count, 0),
    conversionCount: asNumber(row.conversion_count, 0),
    otoYesCount: asNumber(row.oto_yes_count, 0),
    otoNoCount: asNumber(row.oto_no_count, 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

/** Optin rate 0–1 from views + conversions. Zero-safe. */
export function optinConversionRate(views: number, conversions: number): number {
  if (!views || views <= 0) return 0;
  return Math.min(1, Math.max(0, conversions / views));
}

/** OTO take rate 0–1 from yes / (yes+no). Zero-safe. */
export function otoTakeRate(yes: number, no: number): number {
  const total = (yes || 0) + (no || 0);
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, (yes || 0) / total));
}


export function rowToOptinLead(
  row: OptinLeadRow,
  extras?: { funnelName?: string; funnelSlug?: string },
): OptinLeadRecord {
  return {
    id: row.id,
    funnelId: row.funnel_id,
    email: row.email,
    firstName: row.first_name,
    status: toOptinLeadStatus(row.status),
    otoAccepted: Boolean(row.oto_accepted),
    utmSource: row.utm_source,
    utmMedium: row.utm_medium,
    utmCampaign: row.utm_campaign,
    referrer: row.referrer,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    funnelName: extras?.funnelName,
    funnelSlug: extras?.funnelSlug,
  };
}

// ---------------------------------------------------------------------------
// Blanks
// ---------------------------------------------------------------------------

export function blankOptinPage(): OptinPageContent {
  return {
    eyebrow: '',
    headline: '',
    headlineEmphasis: '',
    headlineSuffix: '',
    subheadline: '',
    audience: '',
    benefits: [],
    ctaText: 'Send it to me',
    badgeText: '',
    magnetTitle: '',
    magnetDescription: '',
    coverImageUrl: '',
    heroVideoUrl: '',
    emailPlaceholder: 'you@email.com',
    namePlaceholder: 'First name',
    collectName: true,
    privacyNote: 'No spam. Unsubscribe anytime. Your email stays private.',
  };
}

export function blankOptinOto(): OptinOtoContent {
  return {
    enabled: true,
    eyebrow: '',
    headline: '',
    subheadline: '',
    bullets: [],
    priceLabel: '',
    originalPriceLabel: '',
    ctaYes: 'Yes, I want this',
    ctaNo: 'No thanks, continue',
    yesHref: '',
    timerMinutes: 15,
    imageUrl: '',
    videoUrl: '',
  };
}

export function blankOptinThankYou(): OptinThankYouContent {
  return {
    headline: 'You are in.',
    subheadline: '',
    ctaText: 'Continue',
    ctaHref: '',
    secondaryNote: '',
  };
}

export function blankOptinFooter(): OptinFooterContent {
  return {
    enabled: true,
    brandLine: 'MotherMode',
    disclaimer:
      'This page may contain affiliate links. We may earn a commission if you purchase through them. Results are not guaranteed.',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'Contact', href: '/contact' },
    ],
    copyright: `© ${new Date().getFullYear()} MotherMode. All rights reserved.`,
  };
}


/** URL-safe slug from a name. */
export function slugifyOptinName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}
