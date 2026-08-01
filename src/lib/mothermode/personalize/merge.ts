/**
 * Whitelist merge: apply a cached AI payload onto a funnel record.
 *
 * THE safety invariant of the whole system lives here. The AI may rewrite
 * COPY, but it can never touch money or plumbing — `priceCents`, Stripe ids,
 * product ids, CTA hrefs, timers and form behavior all pass through untouched
 * because merge functions only ever assign from an explicit whitelist of
 * string/array fields. A payload containing `checkout.priceCents = 1` is a
 * no-op, by construction.
 *
 * `{name}` templating: overrides may contain `{name}`, replaced with the
 * token's first name (or 'there' when unknown) so "Hey {name}," degrades to
 * "Hey there," instead of leaking a literal marker.
 *
 * Pure: same funnel + same payload => same output, never throws, and the
 * input record is not mutated (a shallow-copied overlay is returned).
 */
import type {
  OptinFunnelRecord,
  OptinPageContent,
  OptinOtoContent,
} from '@/lib/mothermode/optin/types';
import type {
  SalesFunnelRecord,
  SalesOptinContent,
  SalesPageContent,
  CheckoutContent,
  UpsellContent,
} from '@/lib/mothermode/sales/types';
import type { LeadPersonalizationPayload } from './types';

export interface MergeContext {
  /** First name from the verified token (for {name} templating). */
  firstName?: string | null;
}

// ---------------------------------------------------------------------------
// primitives
// ---------------------------------------------------------------------------

/** Replace `{name}` with the lead's first name, or 'there' when unknown. */
export function applyNameTemplate(value: string, firstName?: string | null): string {
  if (!/\{name\}/i.test(value)) return value;
  const name = (firstName || '').trim() || 'there';
  return value.replace(/\{name\}/gi, name);
}


/** Override only when the incoming string is non-blank. */
function str(base: string, override: string, ctx: MergeContext): string {
  const o = (override || '').trim();
  return o ? applyNameTemplate(o, ctx.firstName) : base;
}

/** Override only when the incoming array has entries. */
function arr(base: string[], override: string[], ctx: MergeContext): string[] {
  if (!Array.isArray(override) || override.length === 0) return base;
  return override.map((v) => applyNameTemplate(v, ctx.firstName));
}

/** Accept only well-formed hex colors; anything else is dropped. */
export function validAccentColor(value: string): string {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test((value || '').trim())
    ? value.trim()
    : '';
}

// ---------------------------------------------------------------------------
// block merges
// ---------------------------------------------------------------------------

function mergeSalesOptin(
  base: SalesOptinContent,
  p: LeadPersonalizationPayload,
  ctx: MergeContext,
): SalesOptinContent {
  const o = p.optin;
  return {
    ...base,
    eyebrow: str(base.eyebrow, o.eyebrow, ctx),
    headline: str(base.headline, o.headline, ctx),
    headlineEmphasis: str(base.headlineEmphasis, o.headlineEmphasis, ctx),
    headlineSuffix: str(base.headlineSuffix, o.headlineSuffix, ctx),
    subheadline: str(base.subheadline, o.subheadline, ctx),
    audience: str(base.audience, o.audience, ctx),
    benefits: arr(base.benefits, o.benefits, ctx),
    ctaText: str(base.ctaText, o.ctaText, ctx),
    badgeText: str(base.badgeText, o.badgeText, ctx),
    magnetTitle: str(base.magnetTitle, o.magnetTitle, ctx),
    magnetDescription: str(base.magnetDescription, o.magnetDescription, ctx),
  };
}

function mergeSalesPage(
  base: SalesPageContent,
  p: LeadPersonalizationPayload,
  ctx: MergeContext,
): SalesPageContent {
  const o = p.sales;
  return {
    ...base,
    eyebrow: str(base.eyebrow, o.eyebrow, ctx),
    headline: str(base.headline, o.headline, ctx),
    headlineEmphasis: str(base.headlineEmphasis, o.headlineEmphasis, ctx),
    headlineSuffix: str(base.headlineSuffix, o.headlineSuffix, ctx),
    subheadline: str(base.subheadline, o.subheadline, ctx),
    promise: str(base.promise, o.promise, ctx),
    problemHeading: str(base.problemHeading, o.problemHeading, ctx),
    problemScene: str(base.problemScene, o.problemScene, ctx),
    problemPoints: arr(base.problemPoints, o.problemPoints, ctx),
    ctaText: str(base.ctaText, o.ctaText, ctx),
    ctaSubtext: str(base.ctaSubtext, o.ctaSubtext, ctx),
    finalCtaHeading: str(base.finalCtaHeading, o.finalCtaHeading, ctx),
    finalCtaBody: str(base.finalCtaBody, o.finalCtaBody, ctx),
  };
}

function mergeCheckout(
  base: CheckoutContent,
  p: LeadPersonalizationPayload,
  ctx: MergeContext,
): CheckoutContent {
  const o = p.checkout;
  return {
    ...base,
    eyebrow: str(base.eyebrow, o.eyebrow, ctx),
    headline: str(base.headline, o.headline, ctx),
    subheadline: str(base.subheadline, o.subheadline, ctx),
    ctaText: str(base.ctaText, o.ctaText, ctx),
    bullets: arr(base.bullets, o.bullets, ctx),
  };
}

function mergeUpsell(
  base: UpsellContent,
  p: LeadPersonalizationPayload,
  ctx: MergeContext,
): UpsellContent {
  const o = p.upsell;
  return {
    ...base,
    eyebrow: str(base.eyebrow, o.eyebrow, ctx),
    headline: str(base.headline, o.headline, ctx),
    headlineEmphasis: str(base.headlineEmphasis, o.headlineEmphasis, ctx),
    headlineSuffix: str(base.headlineSuffix, o.headlineSuffix, ctx),
    subheadline: str(base.subheadline, o.subheadline, ctx),
    bigIdea: str(base.bigIdea, o.bigIdea, ctx),
  };
}

function mergeOptinPage(
  base: OptinPageContent,
  p: LeadPersonalizationPayload,
  ctx: MergeContext,
): OptinPageContent {
  const o = p.optin;
  return {
    ...base,
    eyebrow: str(base.eyebrow, o.eyebrow, ctx),
    headline: str(base.headline, o.headline, ctx),
    headlineEmphasis: str(base.headlineEmphasis, o.headlineEmphasis, ctx),
    headlineSuffix: str(base.headlineSuffix, o.headlineSuffix, ctx),
    subheadline: str(base.subheadline, o.subheadline, ctx),
    audience: str(base.audience, o.audience, ctx),
    benefits: arr(base.benefits, o.benefits, ctx),
    ctaText: str(base.ctaText, o.ctaText, ctx),
    badgeText: str(base.badgeText, o.badgeText, ctx),
    magnetTitle: str(base.magnetTitle, o.magnetTitle, ctx),
    magnetDescription: str(base.magnetDescription, o.magnetDescription, ctx),
  };
}

function mergeOptinOto(
  base: OptinOtoContent,
  p: LeadPersonalizationPayload,
  ctx: MergeContext,
): OptinOtoContent {
  const o = p.upsell;
  return {
    ...base,
    eyebrow: str(base.eyebrow, o.eyebrow, ctx),
    headline: str(base.headline, o.headline, ctx),
    subheadline: str(base.subheadline, o.subheadline, ctx),
  };
}

// ---------------------------------------------------------------------------
// record merges
// ---------------------------------------------------------------------------

/**
 * Sales funnel: optin step, sales page, checkout and all four upsell blocks
 * get overlays; vsl/success/access pass through (video + receipt copy are
 * deliberately not AI-rewritten in phase 1).
 */
export function mergeSalesFunnelPayload(
  funnel: SalesFunnelRecord,
  payload: LeadPersonalizationPayload,
  ctx: MergeContext = {},
): SalesFunnelRecord {
  return {
    ...funnel,
    optin: mergeSalesOptin(funnel.optin, payload, ctx),
    sales: mergeSalesPage(funnel.sales, payload, ctx),
    checkout: mergeCheckout(funnel.checkout, payload, ctx),
    upsell1: mergeUpsell(funnel.upsell1, payload, ctx),
    upsell2: mergeUpsell(funnel.upsell2, payload, ctx),
    upsell3: mergeUpsell(funnel.upsell3, payload, ctx),
    upsell4: mergeUpsell(funnel.upsell4, payload, ctx),
  };
}

/** Optin funnel: optin page + OTO copy overlays. */
export function mergeOptinFunnelPayload(
  funnel: OptinFunnelRecord,
  payload: LeadPersonalizationPayload,
  ctx: MergeContext = {},
): OptinFunnelRecord {
  return {
    ...funnel,
    optin: mergeOptinPage(funnel.optin, payload, ctx),
    oto: mergeOptinOto(funnel.oto, payload, ctx),
  };
}
