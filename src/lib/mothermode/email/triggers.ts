/**
 * Sequence TRIGGERS — the event that enrolls a subscriber into an email
 * sequence (Phase 2 of the flow/testing/analytics build, extended in Phase 3+
 * to map each trigger onto a concrete FUNNEL PAGE / page event or a CONTENT
 * lifecycle event).
 *
 * This is the shared, single source of truth for the trigger enum so the email
 * flow canvas, exporters, and any future funnel-event assignment work all agree
 * on the same values. Keeping it here (rather than duplicating the union
 * inline) means the enum can later be promoted/merged with the funnel-event
 * work described in EMAIL_FUNNEL_EVENT_ASSIGNMENT_HANDOFF.md without a rename
 * across the codebase.
 *
 * WHAT'S NEW (trigger→funnel/content mapping):
 *   Every trigger now carries METADATA describing WHERE it fires:
 *     - `category`      — 'funnel' (a page / purchase event) or 'content'
 *                         (something happened to a content piece).
 *     - `funnelPage`    — for funnel triggers, the page the event happens on
 *                         (opt-in page, sales page, checkout, upsell, booking…).
 *     - `contentStage`  — for content triggers, the lifecycle stage that fires
 *                         it (generated → approved → scheduled → published, or
 *                         rejected). These line up 1:1 with the content review
 *                         states in `content/review.ts`.
 *   This lets the flow canvas and exporters explain, in plain language, exactly
 *   which page/event or content action drops a subscriber into the sequence,
 *   and gives GHL/ESP exporters a concrete page-event to bind a workflow to.
 *
 * Backward-compat: a sequence with no stored trigger defaults to 'optin' (the
 * overwhelmingly common entry point), so existing kits render unchanged. Every
 * new value is additive; the normalizer still coerces unknowns to 'optin'.
 */

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

/** The two broad families a trigger belongs to. */
export const EMAIL_TRIGGER_CATEGORIES = ['funnel', 'content'] as const;
export type EmailTriggerCategory = (typeof EMAIL_TRIGGER_CATEGORIES)[number];

export const EMAIL_TRIGGER_CATEGORY_LABELS: Record<EmailTriggerCategory, string> = {
  funnel: 'Funnel & purchase events',
  content: 'Content events',
};

// ---------------------------------------------------------------------------
// Funnel pages (WHERE a funnel event fires)
// ---------------------------------------------------------------------------

/**
 * The funnel pages an event can happen on. `any` = not page-specific (e.g. a
 * tag applied in the ESP or a refund processed by the processor). Each maps
 * cleanly onto a GHL/ClickFunnels-style page in a standard low-ticket funnel.
 */
export const EMAIL_FUNNEL_PAGES = [
  'optin-page',
  'sales-page',
  'checkout-page',
  'upsell-page',
  'thank-you-page',
  'booking-page',
  'any',
] as const;
export type EmailFunnelPage = (typeof EMAIL_FUNNEL_PAGES)[number];

export const EMAIL_FUNNEL_PAGE_LABELS: Record<EmailFunnelPage, string> = {
  'optin-page': 'Opt-in page',
  'sales-page': 'Sales page',
  'checkout-page': 'Checkout page',
  'upsell-page': 'Upsell / OTO page',
  'thank-you-page': 'Thank-you page',
  'booking-page': 'Booking / calendar page',
  any: 'Any page / ESP',
};

// ---------------------------------------------------------------------------
// Content lifecycle stages (WHICH content action fires a content trigger)
// ---------------------------------------------------------------------------

/**
 * The content lifecycle stages that can fire a content trigger. These line up
 * with the content hub review/approval flow: a piece is generated, approved by
 * a reviewer, scheduled, then published (or rejected/sent back).
 */
export const EMAIL_CONTENT_STAGES = [
  'generated',
  'approved',
  'scheduled',
  'published',
  'rejected',
] as const;
export type EmailContentStage = (typeof EMAIL_CONTENT_STAGES)[number];

export const EMAIL_CONTENT_STAGE_LABELS: Record<EmailContentStage, string> = {
  generated: 'Content generated',
  approved: 'Content approved',
  scheduled: 'Content scheduled',
  published: 'Content published',
  rejected: 'Content rejected',
};

// ---------------------------------------------------------------------------
// Trigger events
// ---------------------------------------------------------------------------

/**
 * The event that starts a sequence. Deliberately provider-agnostic; each maps
 * cleanly to a GHL/ESP workflow trigger downstream. The first five values are
 * the original Phase-2 set (kept in place for back-compat); the rest map the
 * remaining funnel pages and the content lifecycle.
 *
 *   FUNNEL:
 *   - optin           — a lead opted in on the opt-in page. The default.
 *   - page_view       — a lead viewed a funnel page (not page-specific).
 *   - sales_page_view — a lead viewed the sales page.
 *   - checkout_start  — a lead reached / started the checkout page.
 *   - abandon         — a checkout/cart was abandoned.
 *   - purchase        — a purchase completed (any product).
 *   - upsell_purchase — an upsell / OTO was accepted.
 *   - booking         — a call was booked on the booking page.
 *   - refund          — a refund/chargeback was processed.
 *   - tag_added       — a tag/segment was applied in the ESP.
 *
 *   CONTENT:
 *   - content_generated — a content piece was generated.
 *   - content_approved  — a content piece was approved by a reviewer.
 *   - content_scheduled — a content piece was scheduled.
 *   - content_published — a content piece was published / posted.
 *   - content_rejected  — a content piece was rejected / sent back.
 */
export const EMAIL_TRIGGER_EVENTS = [
  // funnel
  'optin',
  'page_view',
  'sales_page_view',
  'checkout_start',
  'abandon',
  'purchase',
  'upsell_purchase',
  'booking',
  'refund',
  'tag_added',
  // content
  'content_generated',
  'content_approved',
  'content_scheduled',
  'content_published',
  'content_rejected',
] as const;
export type EmailTriggerEvent = (typeof EMAIL_TRIGGER_EVENTS)[number];

/** The default entry trigger when a sequence has none stored. */
export const DEFAULT_EMAIL_TRIGGER: EmailTriggerEvent = 'optin';

// ---------------------------------------------------------------------------
// Per-trigger metadata (label, description, category + page/stage mapping)
// ---------------------------------------------------------------------------

/**
 * The full descriptor for one trigger. `funnelPage` is present on every funnel
 * trigger; `contentStage` on every content trigger. Exactly one is set.
 */
export interface EmailTriggerMeta {
  label: string;
  description: string;
  category: EmailTriggerCategory;
  /** For funnel triggers: the page/event location. */
  funnelPage?: EmailFunnelPage;
  /** For content triggers: the content lifecycle stage. */
  contentStage?: EmailContentStage;
}

export const EMAIL_TRIGGER_META: Record<EmailTriggerEvent, EmailTriggerMeta> = {
  // --- Funnel & purchase events -------------------------------------------
  optin: {
    label: 'Opt-in',
    description: 'A lead opted in via a form or lead magnet on the opt-in page.',
    category: 'funnel',
    funnelPage: 'optin-page',
  },
  page_view: {
    label: 'Page view',
    description: 'A lead viewed a funnel page (not tied to a specific page).',
    category: 'funnel',
    funnelPage: 'any',
  },
  sales_page_view: {
    label: 'Sales page view',
    description: 'A lead viewed the sales page but has not yet checked out.',
    category: 'funnel',
    funnelPage: 'sales-page',
  },
  checkout_start: {
    label: 'Checkout started',
    description: 'A lead reached or began filling out the checkout page.',
    category: 'funnel',
    funnelPage: 'checkout-page',
  },
  abandon: {
    label: 'Cart abandon',
    description: 'A checkout or cart on the checkout page was abandoned.',
    category: 'funnel',
    funnelPage: 'checkout-page',
  },
  purchase: {
    label: 'Purchase',
    description: 'A purchase was completed on the checkout page.',
    category: 'funnel',
    funnelPage: 'checkout-page',
  },
  upsell_purchase: {
    label: 'Upsell accepted',
    description: 'An upsell / one-time-offer was accepted on the upsell page.',
    category: 'funnel',
    funnelPage: 'upsell-page',
  },
  booking: {
    label: 'Call booked',
    description: 'A call was booked on the booking / calendar page.',
    category: 'funnel',
    funnelPage: 'booking-page',
  },
  refund: {
    label: 'Refund',
    description: 'A refund or chargeback was processed.',
    category: 'funnel',
    funnelPage: 'any',
  },
  tag_added: {
    label: 'Tag added',
    description: 'A tag or segment was applied in your ESP.',
    category: 'funnel',
    funnelPage: 'any',
  },
  // --- Content events ------------------------------------------------------
  content_generated: {
    label: 'Content generated',
    description: 'A content piece was generated in the content hub.',
    category: 'content',
    contentStage: 'generated',
  },
  content_approved: {
    label: 'Content approved',
    description: 'A content piece was approved by a reviewer.',
    category: 'content',
    contentStage: 'approved',
  },
  content_scheduled: {
    label: 'Content scheduled',
    description: 'A content piece was scheduled for publishing.',
    category: 'content',
    contentStage: 'scheduled',
  },
  content_published: {
    label: 'Content published',
    description: 'A content piece was published / posted.',
    category: 'content',
    contentStage: 'published',
  },
  content_rejected: {
    label: 'Content rejected',
    description: 'A content piece was rejected or sent back for edits.',
    category: 'content',
    contentStage: 'rejected',
  },
};

/**
 * Human labels for the trigger picker + flow node. Derived from
 * EMAIL_TRIGGER_META so labels never drift from their metadata.
 */
export const EMAIL_TRIGGER_LABELS = Object.fromEntries(
  EMAIL_TRIGGER_EVENTS.map((t) => [t, EMAIL_TRIGGER_META[t].label]),
) as Record<EmailTriggerEvent, string>;

/** Short helper text explaining each trigger (for tooltips / menus). */
export const EMAIL_TRIGGER_DESCRIPTIONS = Object.fromEntries(
  EMAIL_TRIGGER_EVENTS.map((t) => [t, EMAIL_TRIGGER_META[t].description]),
) as Record<EmailTriggerEvent, string>;

// ---------------------------------------------------------------------------
// Normalizers + helpers (defensive: JSONB is untyped at the DB boundary)
// ---------------------------------------------------------------------------

/** Defensive normalizer for untyped JSONB / unknown input. */
export function toEmailTriggerEvent(value: unknown): EmailTriggerEvent {
  return EMAIL_TRIGGER_EVENTS.includes(value as EmailTriggerEvent)
    ? (value as EmailTriggerEvent)
    : DEFAULT_EMAIL_TRIGGER;
}

/** Human label for a trigger, tolerant of unknown values. */
export function emailTriggerLabel(value: unknown): string {
  return EMAIL_TRIGGER_LABELS[toEmailTriggerEvent(value)];
}

/** The full metadata descriptor for a trigger, tolerant of unknown values. */
export function emailTriggerMeta(value: unknown): EmailTriggerMeta {
  return EMAIL_TRIGGER_META[toEmailTriggerEvent(value)];
}

/** The category ('funnel' | 'content') a trigger belongs to. */
export function emailTriggerCategory(value: unknown): EmailTriggerCategory {
  return emailTriggerMeta(value).category;
}

/**
 * A short "where it fires" label for a trigger — the funnel page name for
 * funnel triggers, or the content stage for content triggers. Used by the flow
 * canvas and exporters to explain the enrollment point in plain language.
 */
export function emailTriggerLocationLabel(value: unknown): string {
  const meta = emailTriggerMeta(value);
  if (meta.category === 'content' && meta.contentStage) {
    return EMAIL_CONTENT_STAGE_LABELS[meta.contentStage];
  }
  if (meta.funnelPage) {
    return EMAIL_FUNNEL_PAGE_LABELS[meta.funnelPage];
  }
  return '';
}

// ---------------------------------------------------------------------------
// Editable trigger MAPPING (EmailTriggerConfig)
// ---------------------------------------------------------------------------

/**
 * The admin-editable binding for a sequence's trigger. Where the per-trigger
 * `EmailTriggerMeta` describes the DEFAULT location an event fires, this config
 * lets an admin MAP the trigger onto a concrete target:
 *
 *   - `funnelPage`  — override the funnel page the event is bound to (funnel
 *                     triggers). Absent => use the trigger's default page.
 *   - `offerSlug`   — which offer / funnel this enrollment is wired to (funnel
 *                     triggers). Gives GHL/ESP export a concrete funnel to bind.
 *   - `contentRef`  — which content piece (id / slug / label) fires a content
 *                     trigger. Absent => any content at that stage.
 *   - `note`        — free-form note (e.g. the GHL workflow name) shown on the
 *                     canvas + editor so the wiring is self-documenting.
 *
 * Every field is optional. An all-empty config normalizes to `undefined` so an
 * untouched sequence stays byte-identical to a legacy one (back-compat).
 */
export interface EmailTriggerConfig {
  funnelPage?: EmailFunnelPage;
  offerSlug?: string;
  contentRef?: string;
  note?: string;
}

function trimStr(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toFunnelPageOrUndefined(value: unknown): EmailFunnelPage | undefined {
  return EMAIL_FUNNEL_PAGES.includes(value as EmailFunnelPage)
    ? (value as EmailFunnelPage)
    : undefined;
}

/**
 * Coerce arbitrary JSONB into an EmailTriggerConfig, or `undefined` when the
 * config is absent/empty. Defensive: tolerates any shape and never throws.
 */
export function normalizeTriggerConfig(value: unknown): EmailTriggerConfig | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const c = value as Record<string, unknown>;
  const funnelPage = toFunnelPageOrUndefined(c.funnelPage);
  const offerSlug = trimStr(c.offerSlug);
  const contentRef = trimStr(c.contentRef);
  const note = trimStr(c.note);
  const config: EmailTriggerConfig = {
    ...(funnelPage ? { funnelPage } : {}),
    ...(offerSlug ? { offerSlug } : {}),
    ...(contentRef ? { contentRef } : {}),
    ...(note ? { note } : {}),
  };
  return Object.keys(config).length > 0 ? config : undefined;
}

/**
 * The EFFECTIVE funnel page for a trigger: the config override when set and
 * valid, otherwise the trigger's default page from its metadata (or 'any').
 */
export function resolveTriggerFunnelPage(
  trigger: unknown,
  config?: EmailTriggerConfig | null,
): EmailFunnelPage {
  if (config?.funnelPage) return config.funnelPage;
  return emailTriggerMeta(trigger).funnelPage ?? 'any';
}

/**
 * The EFFECTIVE "where it fires" label honoring a config override — the
 * overridden funnel-page label for funnel triggers, else the default location.
 */
export function resolveTriggerLocationLabel(
  trigger: unknown,
  config?: EmailTriggerConfig | null,
): string {
  if (emailTriggerCategory(trigger) === 'funnel' && config?.funnelPage) {
    return EMAIL_FUNNEL_PAGE_LABELS[config.funnelPage];
  }
  return emailTriggerLocationLabel(trigger);
}

/**
 * A short, human "binding" summary for a mapped trigger — the offer slug for
 * funnel triggers or the content reference for content triggers. Empty when the
 * admin has not bound a target yet.
 */
export function resolveTriggerBindingLabel(
  trigger: unknown,
  config?: EmailTriggerConfig | null,
): string {
  if (!config) return '';
  if (emailTriggerCategory(trigger) === 'content') {
    return config.contentRef ? `Content: ${config.contentRef}` : '';
  }
  return config.offerSlug ? `Offer: ${config.offerSlug}` : '';
}

/** The trigger events belonging to one category, in declaration order. */
export function emailTriggerEventsByCategory(

  category: EmailTriggerCategory,
): EmailTriggerEvent[] {
  return EMAIL_TRIGGER_EVENTS.filter(
    (t) => EMAIL_TRIGGER_META[t].category === category,
  );
}

/**
 * All trigger events grouped by category, in category then declaration order —
 * ready to render as `<optgroup>`s in a picker.
 */
export function emailTriggerGroups(): Array<{
  category: EmailTriggerCategory;
  label: string;
  events: EmailTriggerEvent[];
}> {
  return EMAIL_TRIGGER_CATEGORIES.map((category) => ({
    category,
    label: EMAIL_TRIGGER_CATEGORY_LABELS[category],
    events: emailTriggerEventsByCategory(category),
  }));
}
