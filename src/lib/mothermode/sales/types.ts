/**
 * MotherMode Sales Funnel domain types + pure row mappers.
 *
 * A sales funnel is a full purchase path:
 *   optin → sales → vsl → checkout → upsell1-4 → success → access
 *
 * Content for each step lives in JSONB blocks on mothermode_sales_funnels so
 * the page shape can grow without migrations. Mappers are pure and defensive
 * (JSONB is untyped at the DB boundary).
 *
 * Visual language: Editorial Warm (bone / ink / mode / brass) — same as
 * the optin funnel and MotherModeSalesPage.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const SALES_FUNNEL_STATUSES = ['draft', 'published', 'archived'] as const;
export type SalesFunnelStatus = (typeof SALES_FUNNEL_STATUSES)[number];

export const SALES_LEAD_STATUSES = [
  'captured',
  'checkout_started',
  'purchased',
  'upsell_skipped',
] as const;
export type SalesLeadStatus = (typeof SALES_LEAD_STATUSES)[number];

export const SALES_FUNNEL_STEPS = [
  'optin',
  'sales',
  'vsl',
  'checkout',
  'upsell1',
  'upsell2',
  'upsell3',
  'upsell4',
  'success',
  'access',
] as const;
export type SalesFunnelStep = (typeof SALES_FUNNEL_STEPS)[number];

export type SalesEventType =
  | 'view'
  | 'optin_submit'
  | 'sales_view'
  | 'vsl_view'
  | 'checkout_start'
  | 'purchase'
  | 'upsell_yes'
  | 'upsell_no'
  | 'success_view'
  | 'access_view';

// ---------------------------------------------------------------------------
// Content blocks
// ---------------------------------------------------------------------------

/** Optin (step 1) page copy + form chrome. Same shape as optin funnel. */
export interface SalesOptinContent {
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
  coverImageUrl: string;
  heroVideoUrl: string;
  emailPlaceholder: string;
  namePlaceholder: string;
  collectName: boolean;
  privacyNote: string;
}

/** Sales page (step 2) — full MotherMode long-form structure (editable).
 *  Mirrors MotherModeOffer sections so the public page can reuse the exact
 *  production layout while remaining fully customizable per funnel.
 */
export interface SalesPageContent {
  // Identity / pricing
  name: string;
  tagline: string;
  category: string;
  priceCents: number;
  originalPriceCents: number;
  priceLabel: string;
  originalPriceLabel: string;
  priceDescription: string;
  ctaText: string;
  ctaSubtext: string;
  guaranteeTitle: string;
  guaranteeText: string;
  heroImageUrl: string;
  heroVideoUrl: string;
  founderPhotoUrl: string;

  // Hero
  eyebrow: string;
  headline: string;
  headlineEmphasis: string;
  headlineSuffix: string;
  subheadline: string;
  audience: string;
  promise: string;

  // Problem
  problemHeading: string;
  problemIntro: string;
  problemScene: string;
  problemPoints: string[];
  problemCost: string;
  /** @deprecated flat body kept for older funnels */
  problemBody: string;

  // Origin
  originEyebrow: string;
  originHeading: string;
  originParagraphs: string[];

  // What is / solution
  whatIsHeading: string;
  whatIsParagraphs: string[];
  solutionHeading: string;
  solutionBody: string;

  // Mechanism
  mechanismEyebrow: string;
  mechanismHeading: string;
  mechanismLabel: string;
  mechanismParagraphs: string[];
  mechanismPoints: { title: string; description: string }[];

  // Inside / features
  insideHeading: string;
  insideSubheading: string;
  insideLead: string;
  insideItems: {
    title: string;
    description: string;
    tag: string;
    value: string;
    outcome: string;
  }[];
  featuresHeading: string;
  features: string[];

  // Method
  methodHeading: string;
  methodSubheading: string;
  methodSteps: {
    number: number;
    title: string;
    description: string;
    meta: string;
    shift: string;
  }[];
  methodCloser: string;

  // Old vs new
  oldWayHeading: string;
  oldWayItems: string[];
  newWayHeading: string;
  newWayItems: string[];

  // Proof / testimonials
  proof: { name: string; role: string; quote: string; real: boolean }[];
  testimonialsHeading: string;
  testimonials: { quote: string; author: string; role: string }[];

  // Bonuses
  bonusesEyebrow: string;
  bonusesHeading: string;
  bonusesIntro: string;
  bonusesItems: { title: string; description: string; value: string }[];
  bonusesTotalValue: string;
  bonusesCloser: string;

  // Founder letter
  founderEyebrow: string;
  founderHeading: string;
  founderGreeting: string;
  founderParagraphs: string[];
  founderSignoff: string;
  founderPs: string;

  // FAQ / final
  faqHeading: string;
  faqs: { question: string; answer: string }[];
  finalCtaHeading: string;
  finalCtaBody: string;

  // Pricing chrome labels (editable on-page)
  soldSeparatelyLabel: string;
  todayLabel: string;
  pricingStackTotalLabel: string;
  savingsLabel: string;
  foundingPriceLabel: string;
  timerNote: string;
  resourcesInstantLabel: string;
  secureCheckoutLabel: string;
  guaranteeNote: string;
  proofEyebrow: string;
  brandLine: string;
  conversionLine: string;
  generationalLine: string;
  categoryLine: string;
  founderName: string;
  founderRole: string;

  // Bumps
  bumps: {
    id: string;
    title: string;
    description: string;
    price: string;
  }[];
}

/** VSL page (step 3) — video sales letter with sticky player + timed CTA. */
export interface VslPageContent {
  eyebrow: string;
  headline: string;
  subheadline: string;
  videoUrl: string;
  ctaRevealSeconds: number;
  ctaText: string;
  ctaHref: string;
  bullets: string[];
  stickyPlayer: boolean;
  autoplay: boolean;
}

/** Checkout page (step 4) — Stripe checkout. */
export interface CheckoutContent {
  eyebrow: string;
  headline: string;
  subheadline: string;
  priceLabel: string;
  priceCents: number;
  stripePriceId: string;
  productName: string;
  productId: string;
  /** Optional product mockup / thumbnail shown above the order card. */
  productImageUrl: string;
  bullets: string[];
  ctaText: string;
  guaranteeText: string;
  paymentType: string;
  trialDays: number;
  /** Top urgency timer bar label (before the countdown). */
  timerLabel: string;
  /** Header brand wordmark text on the checkout page. */
  brandLabel: string;
}

/** One feature row in an upsell value stack (JSON-safe; icons reattached at render). */
export interface UpsellFeatureContent {
  title: string;
  description: string;
  value: string;
  core?: boolean;
}

/** One gallery shot in an upsell media block. */
export interface UpsellShotContent {
  src: string;
  alt: string;
  caption: string;
  hint: string;
}

/**
 * Upsell page (steps 5-8) — full MotherMode OTO shape.
 * Mirrors AscensionOffer so MotherModeUpsellPage can render production layout.
 * Legacy fields (bullets/imageUrl/videoUrl) kept for back-compat with older rows.
 */
export interface UpsellContent {
  enabled: boolean;

  // Identity / pricing (from AscensionOffer)
  productId: string;
  billingType: 'subscription' | 'one_time' | string;
  interval: string;
  priceCents: number;
  priceLabel: string;
  originalPriceLabel: string;
  metadataType: string;
  pageType: string;
  stripePriceId: string;
  productName: string;
  paymentType: string;

  // Timer
  timerLabel: string;
  timerMinutes: number;

  // Media (production gallery + optional simple image/video)
  mediaVideo: boolean;
  mediaVideoPoster: string;
  galleryEyebrow: string;
  galleryAspect: string;
  gallery: UpsellShotContent[];
  imageUrl: string;
  videoUrl: string;

  // Copy
  eyebrow: string;
  headline: string;
  headlineEmphasis: string;
  headlineSuffix: string;
  subheadline: string;
  letter: string[];
  /** Legacy simple bullets — used when features is empty. */
  bullets: string[];

  // Value stack
  stackEyebrow: string;
  stackHeading: string;
  features: UpsellFeatureContent[];
  totalValueLabel: string;
  bigIdea: string;

  // CTAs / guarantee
  ctaYes: string;
  ctaNo: string;
  yesHref: string;
  guaranteeTitle: string;
  guaranteeBody: string;
}

/** Event → email kit binding for multi-sequence funnel enrollment. */
/** Success page (step 9) — receipt + delivery cards. */
export interface SuccessContent {
  headline: string;
  subheadline: string;
  purchaseSummary: string;
  inboxNote: string;
  deliverySectionHeading: string;
  deliverySectionIntro: string;
  deliveryCards: { title: string; description: string; href: string; icon: string }[];
  nextEyebrow: string;
  nextHeading: string;
  nextBody: string;
  ctaText: string;
  ctaHref: string;
  supportEmail: string;
  secondaryNote: string;
}

/** Access page (step 10) — members delivery + onboarding. */
export interface AccessContent {
  headline: string;
  subheadline: string;
  badgeText: string;
  onboardingEyebrow: string;
  onboardingHeading: string;
  onboardingItems: { title: string; description: string; href: string }[];
  libraryEyebrow: string;
  libraryHeading: string;
  libraryIntro: string;
  deliveryLinks: { label: string; href: string; description: string }[];
  welcomeVideoUrl: string;
  communityHref: string;
  communityLabel: string;
  communityBody: string;
  supportHeading: string;
  supportBody: string;
  supportEmail: string;
}

/** Programmable footer for sales funnel pages. Same shape as optin footer. */
export interface SalesFooterContent {
  enabled: boolean;
  brandLine: string;
  disclaimer: string;
  links: { label: string; href: string }[];
  copyright: string;
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------


export type SalesEmailEvent =
  | 'optin'
  | 'checkout_start'
  | 'purchase'
  | 'upsell1_yes' | 'upsell1_no'
  | 'upsell2_yes' | 'upsell2_no'
  | 'upsell3_yes' | 'upsell3_no'
  | 'upsell4_yes' | 'upsell4_no'
  | 'success' | 'access';

/** @deprecated alias — use SalesEmailEvent */
export type SalesEmailKitEvent = SalesEmailEvent;

export const SALES_EMAIL_EVENTS: SalesEmailEvent[] = [
  'optin', 'checkout_start', 'purchase',
  'upsell1_yes', 'upsell1_no', 'upsell2_yes', 'upsell2_no',
  'upsell3_yes', 'upsell3_no', 'upsell4_yes', 'upsell4_no',
  'success', 'access',
];

export const SALES_EMAIL_EVENT_LABELS: Record<SalesEmailEvent, string> = {
  optin: 'Opt-in capture',
  checkout_start: 'Checkout started',
  purchase: 'Purchase completed',
  upsell1_yes: 'Upsell 1 accepted',
  upsell1_no: 'Upsell 1 declined',
  upsell2_yes: 'Upsell 2 accepted',
  upsell2_no: 'Upsell 2 declined',
  upsell3_yes: 'Upsell 3 accepted',
  upsell3_no: 'Upsell 3 declined',
  upsell4_yes: 'Upsell 4 accepted',
  upsell4_no: 'Upsell 4 declined',
  success: 'Success page',
  access: 'Access page',
};

export interface SalesEmailKitBinding {
  event: SalesEmailEvent;
  emailKitId: string;
}

export interface SalesFunnelRecord {
  id: string;
  slug: string;
  name: string;
  status: SalesFunnelStatus;
  offerSlug: string | null;
  leadGenSlug: string | null;
  deliverableSlug: string | null;
  deliverableKey: string | null;
  emailKitId: string | null;
  /** Multi-event email kit bindings. emailKitId remains legacy optin kit. */
  emailKits: SalesEmailKitBinding[];
  productId: string | null;
  optin: SalesOptinContent;

  sales: SalesPageContent;
  vsl: VslPageContent;
  checkout: CheckoutContent;
  upsell1: UpsellContent;
  upsell2: UpsellContent;
  upsell3: UpsellContent;
  upsell4: UpsellContent;
  success: SuccessContent;
  access: AccessContent;
  footer: SalesFooterContent;
  viewCount: number;
  conversionCount: number;
  checkoutCount: number;
  purchaseCount: number;
  upsell1Yes: number;
  upsell1No: number;
  upsell2Yes: number;
  upsell2No: number;
  upsell3Yes: number;
  upsell3No: number;
  upsell4Yes: number;
  upsell4No: number;
  revenueCents: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
}

export interface SalesLeadRecord {
  id: string;
  funnelId: string;
  email: string;
  firstName: string | null;
  status: SalesLeadStatus;
  stepReached: string;
  purchased: boolean;
  purchaseAmountCents: number;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  /** Piece id of the content that produced the lead. Null until utm_content ships. */
  utmContent: string | null;
  referrer: string | null;
  createdAt: string;
  updatedAt: string;
  funnelName?: string;
  funnelSlug?: string;
}

/** Raw DB row shape (snake_case). */
export interface SalesFunnelRow {
  id: string;
  slug: string;
  name: string;
  status: string;
  offer_slug: string | null;
  lead_gen_slug: string | null;
  deliverable_slug: string | null;
  deliverable_key: string | null;
  email_kit_id: string | null;
  email_kits?: unknown;
  product_id: string | null;
  optin: unknown;

  sales: unknown;
  vsl: unknown;
  checkout: unknown;
  upsell1: unknown;
  upsell2: unknown;
  upsell3: unknown;
  upsell4: unknown;
  success: unknown;
  access: unknown;
  footer: unknown;
  view_count: number;
  conversion_count: number;
  checkout_count: number;
  purchase_count: number;
  upsell1_yes: number;
  upsell1_no: number;
  upsell2_yes: number;
  upsell2_no: number;
  upsell3_yes: number;
  upsell3_no: number;
  upsell4_yes: number;
  upsell4_no: number;
  revenue_cents: number;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export interface SalesLeadRow {
  id: string;
  funnel_id: string;
  email: string;
  first_name: string | null;
  status: string;
  step_reached: string;
  purchased: boolean;
  purchase_amount_cents: number;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  // Optional: absent from the row entirely until 20261005000000 is applied.
  utm_content?: string | null;
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

function asObjectArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null);
}

export function toSalesFunnelStatus(value: unknown): SalesFunnelStatus {
  if (typeof value === 'string' && (SALES_FUNNEL_STATUSES as readonly string[]).includes(value)) {
    return value as SalesFunnelStatus;
  }
  return 'draft';
}

export function toSalesLeadStatus(value: unknown): SalesLeadStatus {
  if (typeof value === 'string' && (SALES_LEAD_STATUSES as readonly string[]).includes(value)) {
    return value as SalesLeadStatus;
  }
  return 'captured';
}

export function toSalesFunnelStep(value: unknown): SalesFunnelStep {
  if (typeof value === 'string' && (SALES_FUNNEL_STEPS as readonly string[]).includes(value)) {
    return value as SalesFunnelStep;
  }
  return 'optin';
}

export function normalizeSalesOptin(raw: unknown): SalesOptinContent {
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

export function normalizeSalesPage(raw: unknown): SalesPageContent {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const str = (k: string, fb = '') => asString(o[k], fb);
  const arr = (k: string) => asStringArray(o[k]);
  const objs = (k: string) => asObjectArray(o[k]);
  const num = (k: string, fb = 0) => {
    const v = o[k];
    return typeof v === 'number' && Number.isFinite(v) ? v : fb;
  };

  const testimonials = objs('testimonials').map((t) => ({
    quote: asString(t.quote),
    author: asString(t.author) || asString(t.name),
    role: asString(t.role),
  }));

  const proofRaw = objs('proof');
  const proof =
    proofRaw.length > 0
      ? proofRaw.map((p) => ({
          name: asString(p.name) || asString(p.author),
          role: asString(p.role),
          quote: asString(p.quote),
          real: p.real !== false,
        }))
      : testimonials.map((t) => ({
          name: t.author,
          role: t.role,
          quote: t.quote,
          real: true,
        }));

  const faqs = objs('faqs').map((f) => ({
    question: asString(f.question) || asString(f.q),
    answer: asString(f.answer) || asString(f.a),
  }));

  const insideItems = objs('insideItems').map((item) => ({
    title: asString(item.title),
    description: asString(item.description),
    tag: asString(item.tag),
    value: asString(item.value),
    outcome: asString(item.outcome),
  }));

  const features = arr('features');
  const problemPoints = arr('problemPoints');

  return {
    name: str('name'),
    tagline: str('tagline'),
    category: str('category'),
    priceCents: num('priceCents'),
    originalPriceCents: num('originalPriceCents'),
    priceLabel: str('priceLabel'),
    originalPriceLabel: str('originalPriceLabel'),
    priceDescription: str('priceDescription'),
    ctaText: str('ctaText'),
    ctaSubtext: str('ctaSubtext'),
    guaranteeTitle: str('guaranteeTitle'),
    guaranteeText: str('guaranteeText'),
    heroImageUrl: str('heroImageUrl'),
    heroVideoUrl: str('heroVideoUrl'),
    founderPhotoUrl: str('founderPhotoUrl'),

    eyebrow: str('eyebrow'),
    headline: str('headline'),
    headlineEmphasis: str('headlineEmphasis'),
    headlineSuffix: str('headlineSuffix'),
    subheadline: str('subheadline'),
    audience: str('audience'),
    promise: str('promise'),

    problemHeading: str('problemHeading'),
    problemIntro: str('problemIntro') || str('problemBody'),
    problemScene: str('problemScene'),
    problemPoints,
    problemCost: str('problemCost'),
    problemBody: str('problemBody'),

    originEyebrow: str('originEyebrow'),
    originHeading: str('originHeading'),
    originParagraphs: arr('originParagraphs'),

    whatIsHeading: str('whatIsHeading') || str('solutionHeading'),
    whatIsParagraphs: arr('whatIsParagraphs'),
    solutionHeading: str('solutionHeading') || str('whatIsHeading'),
    solutionBody: str('solutionBody'),

    mechanismEyebrow: str('mechanismEyebrow'),
    mechanismHeading: str('mechanismHeading'),
    mechanismLabel: str('mechanismLabel'),
    mechanismParagraphs: arr('mechanismParagraphs'),
    mechanismPoints: objs('mechanismPoints').map((p) => ({
      title: asString(p.title),
      description: asString(p.description),
    })),

    insideHeading: str('insideHeading') || str('featuresHeading'),
    insideSubheading: str('insideSubheading'),
    insideLead: str('insideLead'),
    insideItems:
      insideItems.length > 0
        ? insideItems
        : features.map((title) => ({
            title,
            description: '',
            tag: '',
            value: '',
            outcome: '',
          })),
    featuresHeading: str('featuresHeading') || str('insideHeading'),
    features:
      features.length > 0
        ? features
        : insideItems.map((i) => i.title).filter(Boolean),

    methodHeading: str('methodHeading'),
    methodSubheading: str('methodSubheading'),
    methodSteps: objs('methodSteps').map((s, i) => ({
      number: typeof s.number === 'number' ? s.number : i + 1,
      title: asString(s.title),
      description: asString(s.description),
      meta: asString(s.meta),
      shift: asString(s.shift),
    })),
    methodCloser: str('methodCloser'),

    oldWayHeading: str('oldWayHeading'),
    oldWayItems: arr('oldWayItems'),
    newWayHeading: str('newWayHeading'),
    newWayItems: arr('newWayItems'),

    proof,
    testimonialsHeading: str('testimonialsHeading', 'What mothers say'),
    testimonials:
      testimonials.length > 0
        ? testimonials
        : proof.map((p) => ({
            quote: p.quote,
            author: p.name,
            role: p.role,
          })),

    bonusesEyebrow: str('bonusesEyebrow'),
    bonusesHeading: str('bonusesHeading'),
    bonusesIntro: str('bonusesIntro'),
    bonusesItems: objs('bonusesItems').map((b) => ({
      title: asString(b.title),
      description: asString(b.description),
      value: asString(b.value),
    })),
    bonusesTotalValue: str('bonusesTotalValue'),
    bonusesCloser: str('bonusesCloser'),

    founderEyebrow: str('founderEyebrow'),
    founderHeading: str('founderHeading'),
    founderGreeting: str('founderGreeting'),
    founderParagraphs: arr('founderParagraphs'),
    founderSignoff: str('founderSignoff'),
    founderPs: str('founderPs'),

    faqHeading: str('faqHeading', 'Questions'),
    faqs,
    finalCtaHeading: str('finalCtaHeading'),
    finalCtaBody: str('finalCtaBody'),

    soldSeparatelyLabel: str('soldSeparatelyLabel', 'Sold separately'),
    todayLabel: str('todayLabel', 'Today'),
    pricingStackTotalLabel: str('pricingStackTotalLabel'),
    savingsLabel: str('savingsLabel', 'You save {amount} today'),
    foundingPriceLabel: str('foundingPriceLabel', 'Founding price'),
    timerNote: str('timerNote', 'Founding price holds while the timer runs.'),
    resourcesInstantLabel: str(
      'resourcesInstantLabel',
      '{count} resources. Yours instantly.',
    ),
    secureCheckoutLabel: str(
      'secureCheckoutLabel',
      'Secure checkout. Instant digital delivery.',
    ),
    guaranteeNote: str('guaranteeNote', '14 days, no friction.'),
    proofEyebrow: str('proofEyebrow', 'In her words'),
    brandLine: str('brandLine', 'Motherhood, Redesigned.'),
    conversionLine: str('conversionLine', 'Reclaim more.'),
    generationalLine: str(
      'generationalLine',
      'So our daughters will not have to.',
    ),
    categoryLine: str('categoryLine', 'The OS for modern motherhood.'),
    founderName: str('founderName', 'Loni Brown'),
    founderRole: str('founderRole', 'Founder of MotherMode'),

    bumps: objs('bumps').map((b) => ({
      id: asString(b.id),
      title: asString(b.title),
      description: asString(b.description),
      price: asString(b.price),
    })),
  };
}

export function normalizeVslPage(raw: unknown): VslPageContent {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    eyebrow: asString(o.eyebrow),
    headline: asString(o.headline),
    subheadline: asString(o.subheadline),
    videoUrl: asString(o.videoUrl),
    ctaRevealSeconds: asNumber(o.ctaRevealSeconds, 0),
    ctaText: asString(o.ctaText, 'Get instant access'),
    ctaHref: asString(o.ctaHref),
    bullets: asStringArray(o.bullets),
    stickyPlayer: asBool(o.stickyPlayer, true),
    autoplay: asBool(o.autoplay, false),
  };
}

export function normalizeCheckout(raw: unknown): CheckoutContent {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    eyebrow: asString(o.eyebrow),
    headline: asString(o.headline),
    subheadline: asString(o.subheadline),
    priceLabel: asString(o.priceLabel),
    priceCents: asNumber(o.priceCents, 0),
    stripePriceId: asString(o.stripePriceId),
    productName: asString(o.productName),
    productId: asString(o.productId),
    productImageUrl: asString(o.productImageUrl),
    bullets: asStringArray(o.bullets),
    ctaText: asString(o.ctaText, 'Complete order'),
    guaranteeText: asString(o.guaranteeText),
    paymentType: asString(o.paymentType, 'one_time'),
    trialDays: asNumber(o.trialDays, 0),
    timerLabel: asString(o.timerLabel, 'Founding price held for:'),
    brandLabel: asString(o.brandLabel, 'MOTHERMODE'),
  };
}

export function normalizeUpsell(raw: unknown): UpsellContent {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const features = asObjectArray(o.features).map((f) => ({
    title: asString(f.title),
    description: asString(f.description),
    value: asString(f.value),
    core: f.core === true,
  }));
  const gallery = asObjectArray(o.gallery).map((s) => ({
    src: asString(s.src),
    alt: asString(s.alt),
    caption: asString(s.caption),
    hint: asString(s.hint),
  }));
  const letter = asStringArray(o.letter);
  const bullets = asStringArray(o.bullets);
  const billingRaw = asString(o.billingType) || asString(o.paymentType, 'one_time');
  const billingType =
    billingRaw === 'subscription' ? 'subscription' : billingRaw === 'one_time' ? 'one_time' : billingRaw;

  return {
    enabled: asBool(o.enabled, true),
    productId: asString(o.productId),
    billingType,
    interval: asString(o.interval),
    priceCents: asNumber(o.priceCents, 0),
    priceLabel: asString(o.priceLabel),
    originalPriceLabel: asString(o.originalPriceLabel),
    metadataType: asString(o.metadataType),
    pageType: asString(o.pageType),
    stripePriceId: asString(o.stripePriceId),
    productName: asString(o.productName),
    paymentType: asString(o.paymentType, billingType === 'subscription' ? 'subscription' : 'one_time'),
    timerLabel: asString(o.timerLabel),
    timerMinutes: asNumber(o.timerMinutes, 15),
    mediaVideo: asBool(o.mediaVideo, false),
    mediaVideoPoster: asString(o.mediaVideoPoster),
    galleryEyebrow: asString(o.galleryEyebrow),
    galleryAspect: asString(o.galleryAspect),
    gallery,
    imageUrl: asString(o.imageUrl),
    videoUrl: asString(o.videoUrl),
    eyebrow: asString(o.eyebrow),
    headline: asString(o.headline),
    headlineEmphasis: asString(o.headlineEmphasis),
    headlineSuffix: asString(o.headlineSuffix),
    subheadline: asString(o.subheadline),
    letter,
    bullets,
    stackEyebrow: asString(o.stackEyebrow),
    stackHeading: asString(o.stackHeading),
    features,
    totalValueLabel: asString(o.totalValueLabel),
    bigIdea: asString(o.bigIdea),
    ctaYes: asString(o.ctaYes, 'Yes, add this to my order'),
    ctaNo: asString(o.ctaNo, 'No thanks, continue'),
    yesHref: asString(o.yesHref),
    guaranteeTitle: asString(o.guaranteeTitle),
    guaranteeBody: asString(o.guaranteeBody),
  };
}

export function normalizeEmailKits(raw: unknown): SalesEmailKitBinding[] {
  if (!Array.isArray(raw)) return [];
  const out: SalesEmailKitBinding[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const event = asString(o.event) as SalesEmailEvent;
    const emailKitId = asString(o.emailKitId) || asString(o.kitId);
    if (!emailKitId) continue;
    if (!(SALES_EMAIL_EVENTS as readonly string[]).includes(event)) continue;
    if (seen.has(event)) continue;
    seen.add(event);
    out.push({ event, emailKitId });
  }
  return out;
}


export function normalizeSuccess(raw: unknown): SuccessContent {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    headline: asString(o.headline, "You're in. Here's what happens next."),
    subheadline: asString(o.subheadline),
    purchaseSummary: asString(o.purchaseSummary),
    inboxNote: asString(
      o.inboxNote,
      'Check your inbox for the receipt and login. If it is not there in a minute, check spam.',
    ),
    deliverySectionHeading: asString(o.deliverySectionHeading, 'What is now yours'),
    deliverySectionIntro: asString(
      o.deliverySectionIntro,
      'Open any card below, or go straight to your full access hub.',
    ),
    deliveryCards: asObjectArray(o.deliveryCards).map((c) => ({
      title: asString(c.title),
      description: asString(c.description),
      href: asString(c.href),
      icon: asString(c.icon, 'check'),
    })),
    nextEyebrow: asString(o.nextEyebrow, 'What comes next'),
    nextHeading: asString(o.nextHeading, 'This is the first room of the redesign.'),
    nextBody: asString(
      o.nextBody,
      'Use what you just unlocked. When you are ready for the full system, your access hub is where everything lives.',
    ),
    ctaText: asString(o.ctaText, 'Go to my access'),
    ctaHref: asString(o.ctaHref),
    supportEmail: asString(o.supportEmail, 'support@mothermode.com'),
    secondaryNote: asString(o.secondaryNote),
  };
}

export function normalizeAccess(raw: unknown): AccessContent {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    headline: asString(o.headline, 'Welcome to your members area'),
    subheadline: asString(o.subheadline),
    badgeText: asString(o.badgeText, 'Members area'),
    onboardingEyebrow: asString(o.onboardingEyebrow, 'Start here'),
    onboardingHeading: asString(o.onboardingHeading, 'Your first three moves'),
    onboardingItems: asObjectArray(o.onboardingItems).map((i) => ({
      title: asString(i.title),
      description: asString(i.description),
      href: asString(i.href),
    })),
    libraryEyebrow: asString(o.libraryEyebrow, 'Your library'),
    libraryHeading: asString(o.libraryHeading, 'Everything included'),
    libraryIntro: asString(
      o.libraryIntro,
      'Open any resource below. Bookmark this page — it is your home base.',
    ),
    deliveryLinks: asObjectArray(o.deliveryLinks).map((l) => ({
      label: asString(l.label),
      href: asString(l.href),
      description: asString(l.description),
    })),
    welcomeVideoUrl: asString(o.welcomeVideoUrl),
    communityHref: asString(o.communityHref),
    communityLabel: asString(o.communityLabel, 'Join the community'),
    communityBody: asString(
      o.communityBody,
      'Meet the people doing this with you. Introduce yourself and say what you are offloading this week.',
    ),
    supportHeading: asString(o.supportHeading, 'Need a hand?'),
    supportBody: asString(
      o.supportBody,
      'Questions about access, downloads, or your order — we are here.',
    ),
    supportEmail: asString(o.supportEmail, 'support@mothermode.com'),
  };
}

export function normalizeSalesFooter(raw: unknown): SalesFooterContent {
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

export function rowToSalesFunnel(row: SalesFunnelRow): SalesFunnelRecord {
  const emailKitId = row.email_kit_id ?? null;
  let emailKits = normalizeEmailKits(row.email_kits);
  // Back-compat: legacy single kit becomes optin binding when email_kits empty.
  if (emailKits.length === 0 && emailKitId) {
    emailKits = [{ event: 'optin', emailKitId }];
  }
  return {
    id: row.id,
    slug: row.slug,
    name: row.name ?? '',
    status: toSalesFunnelStatus(row.status),
    offerSlug: row.offer_slug,
    leadGenSlug: row.lead_gen_slug,
    deliverableSlug: row.deliverable_slug,
    deliverableKey: row.deliverable_key,
    emailKitId,
    emailKits,
    productId: row.product_id ?? null,
    optin: normalizeSalesOptin(row.optin),

    sales: normalizeSalesPage(row.sales),
    vsl: normalizeVslPage(row.vsl),
    checkout: normalizeCheckout(row.checkout),
    upsell1: normalizeUpsell(row.upsell1),
    upsell2: normalizeUpsell(row.upsell2),
    upsell3: normalizeUpsell(row.upsell3),
    upsell4: normalizeUpsell(row.upsell4),
    success: normalizeSuccess(row.success),
    access: normalizeAccess(row.access),
    footer: normalizeSalesFooter(row.footer),
    viewCount: asNumber(row.view_count, 0),
    conversionCount: asNumber(row.conversion_count, 0),
    checkoutCount: asNumber(row.checkout_count, 0),
    purchaseCount: asNumber(row.purchase_count, 0),
    upsell1Yes: asNumber(row.upsell1_yes, 0),
    upsell1No: asNumber(row.upsell1_no, 0),
    upsell2Yes: asNumber(row.upsell2_yes, 0),
    upsell2No: asNumber(row.upsell2_no, 0),
    upsell3Yes: asNumber(row.upsell3_yes, 0),
    upsell3No: asNumber(row.upsell3_no, 0),
    upsell4Yes: asNumber(row.upsell4_yes, 0),
    upsell4No: asNumber(row.upsell4_no, 0),
    revenueCents: asNumber(row.revenue_cents, 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

// ---------------------------------------------------------------------------
// Rate helpers (pure, zero-safe)
// ---------------------------------------------------------------------------

/** Optin rate 0–1 from views + conversions. Zero-safe. */
export function salesOptinRate(views: number, conversions: number): number {
  if (!views || views <= 0) return 0;
  return Math.min(1, Math.max(0, conversions / views));
}

/** Checkout completion rate 0–1 from checkout starts + purchases. Zero-safe. */
export function checkoutCompletionRate(checkoutStarts: number, purchases: number): number {
  if (!checkoutStarts || checkoutStarts <= 0) return 0;
  return Math.min(1, Math.max(0, purchases / checkoutStarts));
}

/** Upsell take rate 0–1 from yes / (yes+no). Zero-safe. */
export function upsellTakeRate(yes: number, no: number): number {
  const total = (yes || 0) + (no || 0);
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, (yes || 0) / total));
}

/** Revenue in dollars from cents. */
export function revenueDollars(cents: number): number {
  return (cents || 0) / 100;
}

// ---------------------------------------------------------------------------
// Lead mapper
// ---------------------------------------------------------------------------

export function rowToSalesLead(
  row: SalesLeadRow,
  extras?: { funnelName?: string; funnelSlug?: string },
): SalesLeadRecord {
  return {
    id: row.id,
    funnelId: row.funnel_id,
    email: row.email,
    firstName: row.first_name,
    status: toSalesLeadStatus(row.status),
    stepReached: row.step_reached || 'optin',
    purchased: Boolean(row.purchased),
    purchaseAmountCents: asNumber(row.purchase_amount_cents, 0),
    utmSource: row.utm_source,
    utmMedium: row.utm_medium,
    utmCampaign: row.utm_campaign,
    utmContent: row.utm_content ?? null,
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

export function blankSalesOptin(): SalesOptinContent {
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

export function blankSalesPage(): SalesPageContent {
  return {
    name: '',
    tagline: '',
    category: '',
    priceCents: 0,
    originalPriceCents: 0,
    priceLabel: '',
    originalPriceLabel: '',
    priceDescription: '',
    ctaText: 'Get instant access',
    ctaSubtext: '',
    guaranteeTitle: '',
    guaranteeText: '',
    heroImageUrl: '',
    heroVideoUrl: '',
    founderPhotoUrl: '',

    eyebrow: '',
    headline: '',
    headlineEmphasis: '',
    headlineSuffix: '',
    subheadline: '',
    audience: '',
    promise: '',

    problemHeading: '',
    problemIntro: '',
    problemScene: '',
    problemPoints: [],
    problemCost: '',
    problemBody: '',

    originEyebrow: '',
    originHeading: '',
    originParagraphs: [],

    whatIsHeading: '',
    whatIsParagraphs: [],
    solutionHeading: '',
    solutionBody: '',

    mechanismEyebrow: '',
    mechanismHeading: '',
    mechanismLabel: '',
    mechanismParagraphs: [],
    mechanismPoints: [],

    insideHeading: '',
    insideSubheading: '',
    insideLead: '',
    insideItems: [],
    featuresHeading: '',
    features: [],

    methodHeading: '',
    methodSubheading: '',
    methodSteps: [],
    methodCloser: '',

    oldWayHeading: '',
    oldWayItems: [],
    newWayHeading: '',
    newWayItems: [],

    proof: [],
    testimonialsHeading: '',
    testimonials: [],

    bonusesEyebrow: '',
    bonusesHeading: '',
    bonusesIntro: '',
    bonusesItems: [],
    bonusesTotalValue: '',
    bonusesCloser: '',

    founderEyebrow: '',
    founderHeading: '',
    founderGreeting: '',
    founderParagraphs: [],
    founderSignoff: '',
    founderPs: '',

    soldSeparatelyLabel: 'Sold separately',
    todayLabel: 'Today',
    pricingStackTotalLabel: '',
    savingsLabel: 'You save {amount} today',
    foundingPriceLabel: 'Founding price',
    timerNote: 'Founding price holds while the timer runs.',
    resourcesInstantLabel: '{count} resources. Yours instantly.',
    secureCheckoutLabel: 'Secure checkout. Instant digital delivery.',
    guaranteeNote: '14 days, no friction.',
    proofEyebrow: 'In her words',
    brandLine: 'Motherhood, Redesigned.',
    conversionLine: 'Reclaim more.',
    generationalLine: 'So our daughters will not have to.',
    categoryLine: 'The OS for modern motherhood.',
    founderName: 'Loni Brown',
    founderRole: 'Founder of MotherMode',

    faqHeading: '',
    faqs: [],
    finalCtaHeading: '',
    finalCtaBody: '',

    bumps: [],
  };
}

export function blankVslPage(): VslPageContent {
  return {
    eyebrow: '',
    headline: '',
    subheadline: '',
    videoUrl: '',
    ctaRevealSeconds: 0,
    ctaText: 'Get instant access',
    ctaHref: '',
    bullets: [],
    stickyPlayer: true,
    autoplay: false,
  };
}

export function blankCheckout(): CheckoutContent {
  return {
    eyebrow: '',
    headline: '',
    subheadline: '',
    priceLabel: '',
    priceCents: 0,
    stripePriceId: '',
    productName: '',
    productId: '',
    productImageUrl: '',
    bullets: [],
    ctaText: 'Complete order',
    guaranteeText: '',
    paymentType: 'one_time',
    trialDays: 0,
    timerLabel: '',
    brandLabel: '',
  };
}

export function blankUpsell(): UpsellContent {
  return {
    enabled: true,
    productId: '',
    billingType: 'one_time',
    interval: '',
    priceCents: 0,
    priceLabel: '',
    originalPriceLabel: '',
    metadataType: '',
    pageType: '',
    stripePriceId: '',
    productName: '',
    paymentType: 'one_time',
    timerLabel: '',
    timerMinutes: 15,
    mediaVideo: false,
    mediaVideoPoster: '',
    galleryEyebrow: '',
    galleryAspect: '',
    gallery: [],
    imageUrl: '',
    videoUrl: '',
    eyebrow: '',
    headline: '',
    headlineEmphasis: '',
    headlineSuffix: '',
    subheadline: '',
    letter: [],
    bullets: [],
    stackEyebrow: '',
    stackHeading: '',
    features: [],
    totalValueLabel: '',
    bigIdea: '',
    ctaYes: 'Yes, add this to my order',
    ctaNo: 'No thanks, continue',
    yesHref: '',
    guaranteeTitle: '',
    guaranteeBody: '',
  };
}


export function blankSuccess(): SuccessContent {
  return {
    headline: "You're in. Here's what happens next.",
    subheadline: '',
    purchaseSummary: '',
    inboxNote:
      'Check your inbox for the receipt and login. If it is not there in a minute, check spam.',
    deliverySectionHeading: 'What is now yours',
    deliverySectionIntro: 'Open any card below, or go straight to your full access hub.',
    deliveryCards: [],
    nextEyebrow: 'What comes next',
    nextHeading: 'This is the first room of the redesign.',
    nextBody:
      'Use what you just unlocked. When you are ready for the full system, your access hub is where everything lives.',
    ctaText: 'Go to my access',
    ctaHref: '',
    supportEmail: 'support@mothermode.com',
    secondaryNote: '',
  };
}

export function blankAccess(): AccessContent {
  return {
    headline: 'Welcome to your members area',
    subheadline: '',
    badgeText: 'Members area',
    onboardingEyebrow: 'Start here',
    onboardingHeading: 'Your first three moves',
    onboardingItems: [],
    libraryEyebrow: 'Your library',
    libraryHeading: 'Everything included',
    libraryIntro: 'Open any resource below. Bookmark this page — it is your home base.',
    deliveryLinks: [],
    welcomeVideoUrl: '',
    communityHref: '',
    communityLabel: 'Join the community',
    communityBody:
      'Meet the people doing this with you. Introduce yourself and say what you are offloading this week.',
    supportHeading: 'Need a hand?',
    supportBody: 'Questions about access, downloads, or your order — we are here.',
    supportEmail: 'support@mothermode.com',
  };
}

export function blankSalesFooter(): SalesFooterContent {
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
export function slugifySalesName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}