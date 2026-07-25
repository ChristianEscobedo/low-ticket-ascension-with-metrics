import { describe, expect, it } from 'vitest';
import {
  SALES_EVENT_CAMPAIGN_MAP,
  boundSalesEmailEvents,
  buildSalesEmailPlan,
  planSalesEmailKit,
} from '@/lib/mothermode/sales/emailPlan';
import { SALES_EMAIL_EVENTS, type SalesFunnelRecord } from '@/lib/mothermode/sales/types';

/**
 * A funnel fixture with only the fields the planner reads. Cast rather than
 * fully populated so this test stays readable and does not break every time an
 * unrelated content field is added to the record.
 */
function funnel(overrides: Record<string, unknown> = {}): SalesFunnelRecord {
  return {
    id: 'f1',
    slug: 'weekend-reset',
    name: 'Weekend Reset',
    offerSlug: 'weekend-reset-offer',
    leadGenSlug: 'weekend-lead-magnet',
    emailKitId: null,
    emailKits: [],
    optin: { headline: 'Get the reset' },
    sales: {
      name: 'Weekend Reset System',
      audience: 'overwhelmed founder moms',
      promise: 'a calm Monday',
      tagline: 'warm, direct, no hype',
      priceLabel: '$27',
      guaranteeText: '30-day refund',
    },
    checkout: { productName: 'Weekend Reset System', priceLabel: '$27', brandLabel: 'MotherMode' },
    upsell1: { productName: 'Delegation Vault', priceLabel: '$47' },
    upsell2: {},
    upsell3: {},
    upsell4: {},
    footer: { brandLine: 'MotherMode HQ' },
    ...overrides,
  } as unknown as SalesFunnelRecord;
}

describe('SALES_EVENT_CAMPAIGN_MAP', () => {
  it('covers every funnel event', () => {
    for (const event of SALES_EMAIL_EVENTS) {
      expect(SALES_EVENT_CAMPAIGN_MAP[event]).toBeTruthy();
    }
  });

  it('routes opt-in to the lead magnet arc and checkout abandon to recovery', () => {
    expect(SALES_EVENT_CAMPAIGN_MAP.optin).toBe('leadmag-to-lowticket');
    expect(SALES_EVENT_CAMPAIGN_MAP.checkout_start).toBe('cart-abandonment');
  });

  it('treats a declined upsell as nurture, not as an abandoned cart', () => {
    // A buyer who said no already paid once; nagging them like a cart abandon is
    // the wrong arc. This is the single most important mapping decision here.
    expect(SALES_EVENT_CAMPAIGN_MAP.upsell1_no).toBe('nurture-to-offer');
    expect(SALES_EVENT_CAMPAIGN_MAP.upsell1_yes).toBe('pre-post-purchase');
  });
});

describe('planSalesEmailKit', () => {
  it('names and slugs the kit per funnel + event', () => {
    const plan = planSalesEmailKit(funnel(), 'checkout_start');
    expect(plan.name).toContain('Weekend Reset');
    expect(plan.slug).toBe('weekend-reset-checkout-start');
    expect(plan.campaignType).toBe('cart-abandonment');
  });

  it('seeds intake audience with the funnel audience plus the funnel stage', () => {
    const plan = planSalesEmailKit(funnel(), 'checkout_start');
    expect(plan.intake.audience).toContain('overwhelmed founder moms');
    expect(plan.intake.audience).toContain('did not pay');
  });

  it('falls back to the promise when no explicit audience is set', () => {
    const plan = planSalesEmailKit(
      funnel({ sales: { promise: 'a calm Monday' } }),
      'optin',
    );
    expect(plan.intake.audience).toContain('a calm Monday');
  });

  it('carries product, price and guarantee facts into notes', () => {
    const plan = planSalesEmailKit(funnel(), 'purchase');
    expect(plan.intake.notes).toContain('Product: Weekend Reset System');
    expect(plan.intake.notes).toContain('Price: $27');
    expect(plan.intake.notes).toContain('Guarantee: 30-day refund');
  });

  it('names the specific upgrade for upsell events only', () => {
    const upsellPlan = planSalesEmailKit(funnel(), 'upsell1_no');
    expect(upsellPlan.intake.notes).toContain('Upgrade in question: Delegation Vault');
    expect(upsellPlan.intake.notes).toContain('Upgrade price: $47');

    const purchasePlan = planSalesEmailKit(funnel(), 'purchase');
    expect(purchasePlan.intake.notes).not.toContain('Upgrade in question');
  });

  it('omits blank fields instead of emitting empty labels', () => {
    // "Price: " with nothing after it invites the model to invent a number.
    const plan = planSalesEmailKit(
      funnel({ sales: {}, checkout: {}, footer: {} }),
      'purchase',
    );
    expect(plan.intake.notes).not.toContain('Price:');
    expect(plan.intake.notes).not.toContain('Guarantee:');
  });

  it('attaches the offer to every event and the lead magnet only to opt-in', () => {
    const optin = planSalesEmailKit(funnel(), 'optin');
    expect(optin.contextRefs).toEqual([
      { kind: 'offer', id: 'weekend-reset-offer', label: 'weekend-reset-offer' },
      { kind: 'lead-gen-kit', id: 'weekend-lead-magnet', label: 'weekend-lead-magnet' },
    ]);

    const purchase = planSalesEmailKit(funnel(), 'purchase');
    expect(purchase.contextRefs.map((r) => r.kind)).toEqual(['offer']);
  });

  it('uses the footer brand line as the sender name', () => {
    expect(planSalesEmailKit(funnel(), 'purchase').intake.senderName).toBe('MotherMode HQ');
  });
});

describe('boundSalesEmailEvents', () => {
  it('reads multi-event bindings', () => {
    const bound = boundSalesEmailEvents(
      funnel({ emailKits: [{ event: 'purchase', emailKitId: 'kit-1' }] }),
    );
    expect(bound.has('purchase')).toBe(true);
    expect(bound.has('optin')).toBe(false);
  });

  it('ignores bindings with no kit attached', () => {
    const bound = boundSalesEmailEvents(
      funnel({ emailKits: [{ event: 'purchase', emailKitId: null }] }),
    );
    expect(bound.size).toBe(0);
  });

  it('treats the legacy emailKitId field as the opt-in binding', () => {
    const bound = boundSalesEmailEvents(funnel({ emailKitId: 'legacy-kit' }));
    expect(bound.has('optin')).toBe(true);
  });
});

describe('buildSalesEmailPlan', () => {
  it('plans every event by default', () => {
    expect(buildSalesEmailPlan(funnel())).toHaveLength(SALES_EMAIL_EVENTS.length);
  });

  it('can be scoped to specific events', () => {
    const plans = buildSalesEmailPlan(funnel(), { events: ['optin', 'purchase'] });
    expect(plans.map((p) => p.event)).toEqual(['optin', 'purchase']);
  });

  it('drops unknown events instead of emitting a broken plan', () => {
    const plans = buildSalesEmailPlan(funnel(), {
      events: ['optin', 'not_a_real_event' as never],
    });
    expect(plans.map((p) => p.event)).toEqual(['optin']);
  });

  it('onlyMissing skips events that already have a kit so edits are never clobbered', () => {
    const record = funnel({ emailKits: [{ event: 'purchase', emailKitId: 'kit-1' }] });
    const plans = buildSalesEmailPlan(record, { onlyMissing: true });
    expect(plans.some((p) => p.event === 'purchase')).toBe(false);
    expect(plans).toHaveLength(SALES_EMAIL_EVENTS.length - 1);
  });

  it('marks bound events when not filtering', () => {
    const record = funnel({ emailKits: [{ event: 'purchase', emailKitId: 'kit-1' }] });
    const purchase = buildSalesEmailPlan(record).find((p) => p.event === 'purchase');
    expect(purchase?.alreadyBound).toBe(true);
  });

  it('produces a unique slug per event', () => {
    const slugs = buildSalesEmailPlan(funnel()).map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
