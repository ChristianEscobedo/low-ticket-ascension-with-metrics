/**
 * Sales funnel -> Email Marketing Kit planning layer.
 *
 * A sales funnel already binds one email kit per funnel EVENT (opt-in captured,
 * checkout started, purchase completed, upsell accepted/declined, ...). Until
 * now those bindings could only point at kits an admin had already hand-built
 * in /admin/email-marketing. This module is the missing translation step: given
 * a funnel record, it decides *what sequence each event deserves* — which
 * campaign blueprint to follow, what the kit should be called, what intake the
 * generator should be seeded with, and which context sources to attach.
 *
 * It is deliberately pure and side-effect free. No DB, no OpenAI, no fetch. The
 * API route consumes a plan and performs the effects; the editor can render a
 * preview of the same plan without spending a token. That split keeps the
 * interesting decisions (event -> campaign, funnel copy -> intake) unit
 * testable, which is where the bugs actually live.
 */
import type {
  EmailCampaignType,
  EmailFramework,
  EmailKitIntake,
} from '@/lib/mothermode/email/types';
import type { ContextRef } from '@/lib/mothermode/context';
import {
  SALES_EMAIL_EVENTS,
  SALES_EMAIL_EVENT_LABELS,
  type SalesEmailEvent,
  type SalesFunnelRecord,
} from './types';

// ---------------------------------------------------------------------------
// Event -> campaign blueprint
// ---------------------------------------------------------------------------

/**
 * Which campaign blueprint each funnel event should be generated from.
 *
 * The reasoning behind the non-obvious picks:
 *  - `optin` is a lead-magnet handoff, so it uses the lead-magnet arc that
 *    delivers the promised asset before it ever asks for money.
 *  - `checkout_start` is a literal abandoned cart, so it uses the recovery arc.
 *  - accepted upsells and the purchase/success/access events are all
 *    post-purchase: confirm, onboard, drive first use. They share the
 *    pre/post-purchase arc.
 *  - a DECLINED upsell is not a dead lead — the buyer already paid once. It gets
 *    the nurture-to-offer arc so the declined product is re-presented later with
 *    value in front of it, rather than nagged about like an abandoned cart.
 */
export const SALES_EVENT_CAMPAIGN_MAP: Record<SalesEmailEvent, EmailCampaignType> = {
  optin: 'leadmag-to-lowticket',
  checkout_start: 'cart-abandonment',
  purchase: 'pre-post-purchase',
  upsell1_yes: 'pre-post-purchase',
  upsell1_no: 'nurture-to-offer',
  upsell2_yes: 'pre-post-purchase',
  upsell2_no: 'nurture-to-offer',
  upsell3_yes: 'pre-post-purchase',
  upsell3_no: 'nurture-to-offer',
  upsell4_yes: 'pre-post-purchase',
  upsell4_no: 'nurture-to-offer',
  success: 'pre-post-purchase',
  access: 'community-onboarding',
};

/**
 * The outcome each event's sequence drives toward. This becomes intake.goal,
 * which the outline prompt treats as the north star for every email, so it is
 * phrased as a single concrete action rather than a vibe.
 */
const SALES_EVENT_GOALS: Record<SalesEmailEvent, string> = {
  optin: 'Deliver the promised lead magnet, then convert the subscriber into a first-time buyer.',
  checkout_start: 'Recover the abandoned checkout and complete the purchase.',
  purchase: 'Confirm the purchase, reduce refund risk, and get the buyer to consume what they bought.',
  upsell1_yes: 'Onboard the buyer into the upgrade they just accepted so they use it fast.',
  upsell1_no: 'Re-present the declined upgrade later with value first, and win the upgrade.',
  upsell2_yes: 'Onboard the buyer into the upgrade they just accepted so they use it fast.',
  upsell2_no: 'Re-present the declined upgrade later with value first, and win the upgrade.',
  upsell3_yes: 'Onboard the buyer into the upgrade they just accepted so they use it fast.',
  upsell3_no: 'Re-present the declined upgrade later with value first, and win the upgrade.',
  upsell4_yes: 'Onboard the buyer into the upgrade they just accepted so they use it fast.',
  upsell4_no: 'Re-present the declined upgrade later with value first, and win the upgrade.',
  success: 'Get the new buyer to take the first meaningful action inside the product.',
  access: 'Activate the member: log in, complete setup, and reach the first win.',
};

/** Which funnel upsell block (if any) an event is about. */
const UPSELL_EVENT_INDEX: Partial<Record<SalesEmailEvent, 1 | 2 | 3 | 4>> = {
  upsell1_yes: 1, upsell1_no: 1,
  upsell2_yes: 2, upsell2_no: 2,
  upsell3_yes: 3, upsell3_no: 3,
  upsell4_yes: 4, upsell4_no: 4,
};

// ---------------------------------------------------------------------------
// Plan shape
// ---------------------------------------------------------------------------

/** Everything needed to create one email kit for one funnel event. */
export interface SalesEmailKitPlan {
  event: SalesEmailEvent;
  /** Human label for the event, reused in UI status lines. */
  eventLabel: string;
  campaignType: EmailCampaignType;
  /** Proposed kit name, e.g. "Weekend Reset — Checkout started". */
  name: string;
  /** Proposed kit slug, unique per funnel + event. */
  slug: string;
  /** Seeded intake for the generator. */
  intake: EmailKitIntake;
  /** Context sources to attach so generation is grounded in the real offer. */
  contextRefs: ContextRef[];
  /** True when the funnel already has a kit bound to this event. */
  alreadyBound: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** First non-blank string, or '' when everything is blank. */
function firstFilled(...values: (string | null | undefined)[]): string {
  for (const value of values) {
    const trimmed = (value ?? '').trim();
    if (trimmed) return trimmed;
  }
  return '';
}

/**
 * Who this sequence is written to. The sales page's explicit `audience` field is
 * the best source; when it is blank we fall back to the promise/tagline so the
 * generator still has a person in mind instead of inventing one.
 */
function resolveAudience(funnel: SalesFunnelRecord, event: SalesEmailEvent): string {
  const base = firstFilled(
    funnel.sales?.audience,
    funnel.sales?.promise,
    funnel.sales?.tagline,
    funnel.optin?.headline,
  );
  const stage = SALES_EVENT_AUDIENCE_STAGE[event];
  if (!base) return stage;
  return `${base} — ${stage}`;
}

/**
 * Where the reader is in the funnel when the sequence fires. Two people can
 * share a demographic and need completely different emails depending on whether
 * they have paid yet, so the stage is appended to the audience.
 */
const SALES_EVENT_AUDIENCE_STAGE: Record<SalesEmailEvent, string> = {
  optin: 'brand new subscriber who has not bought anything yet',
  checkout_start: 'started checkout but did not pay',
  purchase: 'just completed their first purchase',
  upsell1_yes: 'buyer who accepted the first upgrade',
  upsell1_no: 'buyer who declined the first upgrade',
  upsell2_yes: 'buyer who accepted the second upgrade',
  upsell2_no: 'buyer who declined the second upgrade',
  upsell3_yes: 'buyer who accepted the third upgrade',
  upsell3_no: 'buyer who declined the third upgrade',
  upsell4_yes: 'buyer who accepted the fourth upgrade',
  upsell4_no: 'buyer who declined the fourth upgrade',
  success: 'brand new buyer on the success page',
  access: 'new member who just got access',
};

/**
 * Free-form notes handed to the generator. This is where funnel-specific facts
 * go: the product being sold, its price, the promise, and for upsell events the
 * specific upgrade in question. Blank fields are omitted rather than sent as
 * empty labels, so the model never sees "Price: " and hallucinates one.
 */
function buildNotes(funnel: SalesFunnelRecord, event: SalesEmailEvent): string {
  const lines: string[] = [];

  const product = firstFilled(
    funnel.checkout?.productName,
    funnel.sales?.name,
    funnel.name,
  );
  if (product) lines.push(`Product: ${product}`);

  const price = firstFilled(funnel.checkout?.priceLabel, funnel.sales?.priceLabel);
  if (price) lines.push(`Price: ${price}`);

  const promise = firstFilled(funnel.sales?.promise, funnel.sales?.subheadline);
  if (promise) lines.push(`Core promise: ${promise}`);

  const guarantee = firstFilled(funnel.sales?.guaranteeText, funnel.checkout?.guaranteeText);
  if (guarantee) lines.push(`Guarantee: ${guarantee}`);

  const upsellIndex = UPSELL_EVENT_INDEX[event];
  if (upsellIndex) {
    const upsell = funnel[`upsell${upsellIndex}` as 'upsell1'];
    const upsellName = firstFilled(upsell?.productName, upsell?.headline);
    if (upsellName) lines.push(`Upgrade in question: ${upsellName}`);
    const upsellPrice = firstFilled(upsell?.priceLabel);
    if (upsellPrice) lines.push(`Upgrade price: ${upsellPrice}`);
  }

  lines.push(`Funnel: ${funnel.name || funnel.slug}`);
  return lines.join('\n');
}

/**
 * Context sources to attach to the generated kit. These are real refs resolved
 * at generation time by the shared Offer <-> Kit bridge, which is what keeps the
 * copy factual instead of generically upbeat.
 */
function buildContextRefs(funnel: SalesFunnelRecord, event: SalesEmailEvent): ContextRef[] {
  const refs: ContextRef[] = [];

  if (funnel.offerSlug) {
    refs.push({ kind: 'offer', id: funnel.offerSlug, label: funnel.offerSlug });
  }

  // The lead magnet only matters for the sequence that has to deliver it.
  if (event === 'optin' && funnel.leadGenSlug) {
    refs.push({ kind: 'lead-gen-kit', id: funnel.leadGenSlug, label: funnel.leadGenSlug });
  }

  return refs;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** The set of events that already have a kit bound on this funnel. */
export function boundSalesEmailEvents(funnel: SalesFunnelRecord): Set<SalesEmailEvent> {
  const bound = new Set<SalesEmailEvent>();
  for (const binding of funnel.emailKits ?? []) {
    if (binding?.emailKitId) bound.add(binding.event);
  }
  // emailKitId is the legacy single-kit field and still means "optin".
  if (funnel.emailKitId) bound.add('optin');
  return bound;
}

/** Build the plan for a single funnel event. */
export function planSalesEmailKit(
  funnel: SalesFunnelRecord,
  event: SalesEmailEvent,
): SalesEmailKitPlan {
  const eventLabel = SALES_EMAIL_EVENT_LABELS[event];
  const funnelLabel = funnel.name || funnel.slug;
  const funnelSlug = funnel.slug || slugify(funnel.name || 'funnel');

  return {
    event,
    eventLabel,
    campaignType: SALES_EVENT_CAMPAIGN_MAP[event],
    name: `${funnelLabel} — ${eventLabel}`,
    slug: `${funnelSlug}-${slugify(event)}`,
    intake: {
      audience: resolveAudience(funnel, event),
      goal: SALES_EVENT_GOALS[event],
      senderName: firstFilled(funnel.footer?.brandLine, funnel.checkout?.brandLabel),
      tone: firstFilled(funnel.sales?.tagline),
      offerSlug: funnel.offerSlug ?? '',
      timingStyle: 'standard',
      notes: buildNotes(funnel, event),
    },
    contextRefs: buildContextRefs(funnel, event),
    alreadyBound: boundSalesEmailEvents(funnel).has(event),
  };
}

/**
 * Build plans for a funnel. Defaults to every known event; pass `events` to
 * scope it to one. Set `onlyMissing` to skip events that already have a kit,
 * which is what the bulk "generate missing sequences" button uses so it never
 * silently overwrites hand-edited copy.
 */
export function buildSalesEmailPlan(
  funnel: SalesFunnelRecord,
  options: { events?: SalesEmailEvent[]; onlyMissing?: boolean } = {},
): SalesEmailKitPlan[] {
  const events = options.events?.length ? options.events : SALES_EMAIL_EVENTS;
  const plans = events
    .filter((event) => (SALES_EMAIL_EVENTS as readonly string[]).includes(event))
    .map((event) => planSalesEmailKit(funnel, event));
  return options.onlyMissing ? plans.filter((plan) => !plan.alreadyBound) : plans;
}

/**
 * Kit-level default framework per campaign blueprint.
 *
 * A kit stores one `framework`, but a campaign's blueprint can override it per
 * email role, so this value is the fallback voice for any email the blueprint
 * does not pin. It is chosen to match the emotional job of the arc:
 *  - cart abandonment is objection work, not storytelling: the reader already
 *    wanted it and stalled on a specific doubt.
 *  - post-purchase mail is a human check-in from the person behind the product,
 *    so it defaults to the founder note.
 *  - nurture-to-offer has to earn attention before it re-asks, so it leads with
 *    a story and its lesson.
 *  - a lead-magnet handoff has to over-deliver on the asset first, so long-form
 *    value is the safer default.
 */
export const SALES_CAMPAIGN_FRAMEWORK_MAP: Record<EmailCampaignType, EmailFramework> = {
  'leadmag-to-lowticket': 'value-longform',
  'nurture-to-offer': 'story-lesson',
  'cart-abandonment': 'objection-crusher',
  'pre-post-purchase': 'founder-note',
  'webinar-event': 'pas',
  'community-onboarding': 'founder-note',
  'event-nurture': 'story-lesson',
  reengagement: 'founder-note',
};

/** The framework a generated kit should carry for a given funnel event. */
export function salesEmailKitFramework(event: SalesEmailEvent): EmailFramework {
  return SALES_CAMPAIGN_FRAMEWORK_MAP[SALES_EVENT_CAMPAIGN_MAP[event]];
}
