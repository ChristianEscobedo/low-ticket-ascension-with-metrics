/**
 * Lead context bundle — the input to the AI personalization pass.
 *
 * Two halves: a LEAD snapshot (who they are, where they came from, how far
 * they got) and a FUNNEL summary (what the page currently says). Both are
 * deliberately compact: the model personalizes better from 30 sharp facts
 * than from a raw 200-field contact dump (the "JSON bloat" lesson from the
 * original HighLevel writeup).
 *
 * Builders are pure so they are unit-testable; the lead-row reader lives in
 * store.ts with the other service-role plumbing.
 */
import type { SalesFunnelRecord } from '@/lib/mothermode/sales/types';
import type { OptinFunnelRecord } from '@/lib/mothermode/optin/types';
import type { FunnelKind } from './types';

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

/** What the model learns about the person. PII-minimal by design. */
export interface LeadSnapshot {
  firstName: string | null;
  /** Domain only ('gmail.com') — the full address never reaches the model. */
  emailDomain: string | null;
  /** Lifecycle stage: captured | checkout_started | purchased | … */
  status: string;
  /** Furthest funnel step seen (sales funnels). */
  stepReached: string;
  purchased: boolean;
  purchaseAmountCents: number;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  /** Planner piece id — which specific post/content drove them in. */
  utmContent: string | null;
  referrer: string | null;
  /** Days since they entered the funnel (recency signals intent). */
  daysSinceCapture: number | null;
  /** OTO outcome for optin funnels. */
  otoAccepted?: boolean;
}

/** What the model learns about the page it is rewriting. */
export interface FunnelSummary {
  kind: FunnelKind;
  name: string;
  slug: string;
  offerSlug: string | null;
  /** Current key copy, so overrides match voice and don't repeat it. */
  current: Record<string, unknown>;
}

export interface LeadAiContext {
  lead: LeadSnapshot;
  funnel: FunnelSummary;
  guidance: string;
}

// ---------------------------------------------------------------------------
// Pure builders
// ---------------------------------------------------------------------------

function emailDomain(email: string | null | undefined): string | null {
  const e = (email || '').trim();
  const at = e.lastIndexOf('@');
  if (at < 0 || at === e.length - 1) return null;
  return e.slice(at + 1).toLowerCase();
}


function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

/** Trim a lead row (either funnel family) into the AI-facing snapshot. */
export function buildLeadSnapshot(input: {
  email: string;
  firstName?: string | null;
  status?: string | null;
  stepReached?: string | null;
  purchased?: boolean;
  purchaseAmountCents?: number;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  referrer?: string | null;
  createdAt?: string | null;
  otoAccepted?: boolean;
}): LeadSnapshot {
  return {
    firstName: input.firstName?.trim() || null,
    emailDomain: emailDomain(input.email),
    status: input.status || 'captured',
    stepReached: input.stepReached || '',
    purchased: input.purchased === true,
    purchaseAmountCents: input.purchaseAmountCents || 0,
    utmSource: input.utmSource || null,
    utmMedium: input.utmMedium || null,
    utmCampaign: input.utmCampaign || null,
    utmContent: input.utmContent || null,
    referrer: input.referrer || null,
    daysSinceCapture: daysSince(input.createdAt),
    ...(input.otoAccepted !== undefined ? { otoAccepted: input.otoAccepted } : {}),
  };
}

/** Sales funnel: the copy blocks the model may rewrite (whitelisted subset). */
export function summarizeSalesFunnel(funnel: SalesFunnelRecord): FunnelSummary {
  return {
    kind: 'sales',
    name: funnel.name,
    slug: funnel.slug,
    offerSlug: funnel.offerSlug,
    current: {
      optin: {
        eyebrow: funnel.optin.eyebrow,
        headline: funnel.optin.headline,
        subheadline: funnel.optin.subheadline,
        audience: funnel.optin.audience,
        benefits: funnel.optin.benefits,
        ctaText: funnel.optin.ctaText,
        magnetTitle: funnel.optin.magnetTitle,
        magnetDescription: funnel.optin.magnetDescription,
      },
      sales: {
        headline: funnel.sales.headline,
        subheadline: funnel.sales.subheadline,
        promise: funnel.sales.promise,
        problemHeading: funnel.sales.problemHeading,
        problemScene: funnel.sales.problemScene,
        problemPoints: funnel.sales.problemPoints,
        ctaText: funnel.sales.ctaText,
        finalCtaHeading: funnel.sales.finalCtaHeading,
      },
      checkout: {
        headline: funnel.checkout.headline,
        subheadline: funnel.checkout.subheadline,
        ctaText: funnel.checkout.ctaText,
        bullets: funnel.checkout.bullets,
        productName: funnel.checkout.productName,
        priceLabel: funnel.checkout.priceLabel,
      },
      upsell1: funnel.upsell1.enabled
        ? { headline: funnel.upsell1.headline, subheadline: funnel.upsell1.subheadline }
        : null,
      priceLabel: funnel.sales.priceLabel,
      category: funnel.sales.category,
    },
  };
}

/** Optin funnel: optin page + OTO (the blocks the model may rewrite). */
export function summarizeOptinFunnel(funnel: OptinFunnelRecord): FunnelSummary {
  return {
    kind: 'optin',
    name: funnel.name,
    slug: funnel.slug,
    offerSlug: funnel.offerSlug,
    current: {
      optin: {
        eyebrow: funnel.optin.eyebrow,
        headline: funnel.optin.headline,
        subheadline: funnel.optin.subheadline,
        audience: funnel.optin.audience,
        benefits: funnel.optin.benefits,
        ctaText: funnel.optin.ctaText,
        magnetTitle: funnel.optin.magnetTitle,
        magnetDescription: funnel.optin.magnetDescription,
      },
      oto: funnel.oto.enabled
        ? {
            headline: funnel.oto.headline,
            subheadline: funnel.oto.subheadline,
            bullets: funnel.oto.bullets,
            priceLabel: funnel.oto.priceLabel,
          }
        : null,
    },
  };
}

/** A coarse stage label from facts alone — handy for admin lists and tests. */
export function coarseStage(snap: LeadSnapshot): string {
  if (snap.purchased) return 'buyer';
  if (snap.status === 'checkout_started') return 'cart-abandoner';
  if (snap.status === 'upsell_skipped') return 'buyer-no-upsell';
  if (snap.daysSinceCapture != null && snap.daysSinceCapture >= 14) return 'cold-dormant';
  if (snap.daysSinceCapture != null && snap.daysSinceCapture <= 1) return 'fresh-optin';
  return 'warm-lead';
}
