import { describe, expect, it, vi } from 'vitest';

// The dispatcher imports its store at module scope, which builds a Supabase
// client from env. Hoist dummy values so importing the pure builders works in
// tests without a live project.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key';
});

import {
  assignmentToMainAppItem,
  buildMainAppEnvelope,
} from '@/utils/integrations/dispatch';
import {
  assignmentsToDeliveryCards,
  normalizeDeliveryConfig,
  rowToAssignment,
  toAssignmentRole,
  toAssignmentStep,
  toDeliveryType,
  type DeliveryConfig,
  type ProductFunnelAssignment,
} from '@/lib/mothermode/sales/productAssignments';
import { pageTypeForStep } from '@/lib/mothermode/sales/pricing';

function fullDelivery(overrides: Partial<DeliveryConfig> = {}): DeliveryConfig {
  return {
    courseIds: [],
    deliverableSlug: '',
    deliverableKey: '',
    links: [],
    productKey: '',
    license: false,
    seats: 1,
    ...overrides,
  };
}

function makeAssignment(overrides: Partial<ProductFunnelAssignment> = {}): ProductFunnelAssignment {
  return {
    id: 'a1',
    productId: 'prod_os',
    priceId: 'price_os_month',
    funnelSlug: 'brain-dump-sales',
    step: 'upsell1',
    role: 'main',
    deliveryType: 'main_app',
    delivery: fullDelivery({ productKey: 'mothermode-os', license: true, seats: 2 }),
    createdAt: '2026-08-09T00:00:00.000Z',
    updatedAt: '2026-08-09T00:00:00.000Z',
    ...overrides,
  };
}

describe('pageTypeForStep', () => {
  it('maps checkout + upsell steps onto funnel page types', () => {
    expect(pageTypeForStep('checkout')).toBe('fe');
    expect(pageTypeForStep('upsell1')).toBe('oto1');
    expect(pageTypeForStep('upsell2')).toBe('oto2');
    expect(pageTypeForStep('upsell4')).toBe('oto4');
    expect(pageTypeForStep(null)).toBe('fe');
  });
});

describe('assignment enums + delivery normalizer', () => {
  it('coerces unknown step/role/delivery values to safe defaults', () => {
    expect(toAssignmentStep('nope')).toBe('checkout');
    expect(toAssignmentStep('upsell3')).toBe('upsell3');
    expect(toAssignmentRole('nope')).toBe('main');
    expect(toAssignmentRole('bonus')).toBe('bonus');
    expect(toDeliveryType('nope')).toBe('url');
    expect(toDeliveryType('main_app')).toBe('main_app');
  });

  it('defaults to an empty delivery config', () => {
    expect(normalizeDeliveryConfig(undefined)).toEqual(fullDelivery());
  });

  it('keeps licensing fields and filters empty links', () => {
    const d = normalizeDeliveryConfig({
      productKey: ' mothermode-os '.trim(),
      license: true,
      seats: 3,
      links: [
        { label: 'Guide', href: 'https://x.co/g', description: '' },
        { label: '', href: '', description: '' },
      ],
    });
    expect(d.productKey).toBe('mothermode-os');
    expect(d.license).toBe(true);
    expect(d.seats).toBe(3);
    expect(d.links).toHaveLength(1);
  });

  it('clamps seats to at least 1', () => {
    expect(normalizeDeliveryConfig({ seats: 0 }).seats).toBe(1);
  });
});

describe('rowToAssignment', () => {
  it('hydrates a DB row into a typed assignment', () => {
    const a = rowToAssignment({
      id: 'a9',
      product_id: 'prod_x',
      price_id: 'price_x',
      funnel_slug: 'f1',
      step: 'checkout',
      role: 'bonus',
      delivery_type: 'deliverable',
      delivery_config: { deliverableSlug: 'vault', deliverableKey: 'k1' },
      created_at: '2026-08-09T00:00:00.000Z',
      updated_at: '2026-08-09T00:00:00.000Z',
    });
    expect(a.step).toBe('checkout');
    expect(a.role).toBe('bonus');
    expect(a.deliveryType).toBe('deliverable');
    expect(a.delivery.deliverableSlug).toBe('vault');
    expect(a.delivery.deliverableKey).toBe('k1');
  });
});

describe('assignmentToMainAppItem', () => {
  it('maps a licensed main-app assignment into a webhook item', () => {
    const item = assignmentToMainAppItem(makeAssignment());
    expect(item).toMatchObject({
      product_id: 'prod_os',
      price_id: 'price_os_month',
      role: 'main',
      step: 'upsell1',
      delivery: {
        type: 'main_app',
        product_key: 'mothermode-os',
        license: true,
        seats: 2,
      },
    });
  });

  it('omits seats when there is only one', () => {
    const item = assignmentToMainAppItem(
      makeAssignment({ delivery: fullDelivery({ productKey: 'os', license: true, seats: 1 }) }),
    );
    expect(item.delivery.seats).toBeUndefined();
  });
});

describe('buildMainAppEnvelope', () => {
  const purchase = {
    stripe_event_id: 'evt_1',
    payment_intent_id: 'pi_1',
    product_id: 'prod_os',
    page_type: 'oto1',
    amount_cents: 9700,
    currency: 'usd',
    customer_email: 'buyer@x.com',
    customer_name: 'Buyer',
    metadata: { funnel_slug: 'brain-dump-sales', step: 'upsell1', price_id: 'price_os_month' },
  };

  it('builds a purchase envelope with license_request from licensed items', () => {
    const env = buildMainAppEnvelope({
      id: 'evt_1',
      event: 'purchase',
      purchase,
      items: [assignmentToMainAppItem(makeAssignment())],
      now: new Date('2026-08-09T12:00:00.000Z'),
    });
    expect(env.event).toBe('purchase');
    expect(env.data.funnel).toEqual({
      slug: 'brain-dump-sales',
      step: 'upsell1',
      page_type: 'oto1',
    });
    expect(env.data.order.price_id).toBe('price_os_month');
    expect(env.data.order.payment_intent_id).toBe('pi_1');
    expect(env.data.license_request).toEqual({
      product_key: 'mothermode-os',
      seats: 2,
    });
  });

  it('license_request is null without a licensed main_app item', () => {
    const env = buildMainAppEnvelope({
      id: 'evt_2',
      event: 'purchase',
      purchase,
      items: [
        assignmentToMainAppItem(
          makeAssignment({
            deliveryType: 'url',
            delivery: fullDelivery({
              links: [{ label: 'Guide', href: 'https://x.co', description: '' }],
            }),
          }),
        ),
      ],
    });
    expect(env.data.license_request).toBeNull();
    expect(env.data.items[0].delivery.links).toHaveLength(1);
  });

  it('attaches refund + comp blocks only when provided', () => {
    const refund = buildMainAppEnvelope({
      id: 'evt_3',
      event: 'refund',
      purchase,
      refund: { refund_id: 're_1', amount_cents: 9700, refunded_at: '2026-08-09T13:00:00.000Z' },
    });
    expect(refund.data.refund?.refund_id).toBe('re_1');
    expect(refund.data.comp).toBeUndefined();

    const comp = buildMainAppEnvelope({
      id: 'evt_4',
      event: 'comp.granted',
      purchase: {
        stripe_event_id: 'comp_a1',
        amount_cents: 0,
        currency: 'usd',
        customer_email: 'vip@x.com',
      },
      comp: { product_id: 'prod_os', price_id: null, product_name: 'OS', note: 'beta' },
    });
    expect(comp.data.comp?.product_name).toBe('OS');
    expect(comp.data.customer.email).toBe('vip@x.com');
    expect(comp.data.refund).toBeUndefined();
  });
});

describe('assignmentsToDeliveryCards', () => {
  it('turns link deliveries into thank-you cards', () => {
    const cards = assignmentsToDeliveryCards([
      makeAssignment({
        step: 'checkout',
        deliveryType: 'url',
        delivery: fullDelivery({
          links: [{ label: 'The Guide', href: 'https://x.co/guide', description: 'Start here' }],
        }),
      }),
    ]);
    expect(cards).toEqual([
      { title: 'The Guide', description: 'Start here', href: 'https://x.co/guide', icon: 'check' },
    ]);
  });

  it('marks bonuses with a gift icon', () => {
    const cards = assignmentsToDeliveryCards([
      makeAssignment({
        role: 'bonus',
        deliveryType: 'url',
        delivery: fullDelivery({
          links: [{ label: 'Bonus', href: 'https://x.co/b', description: '' }],
        }),
      }),
    ]);
    expect(cards[0].icon).toBe('gift');
  });

  it('main_app deliveries acknowledge delivery without leaking keys', () => {
    const cards = assignmentsToDeliveryCards([makeAssignment()]);
    expect(cards).toHaveLength(1);
    expect(cards[0].href).toBe('');
    expect(cards[0].description).toContain('license key');
  });

  it('deliverable + course deliveries produce their own card shapes', () => {
    const cards = assignmentsToDeliveryCards(
      [
        makeAssignment({
          deliveryType: 'deliverable',
          delivery: fullDelivery({ deliverableSlug: 'vault', deliverableKey: 'k1' }),
        }),
        makeAssignment({
          id: 'a2',
          deliveryType: 'course',
          delivery: fullDelivery({ courseIds: ['course_1'] }),
        }),
      ],
      new Map([['prod_os', 'MotherMode OS']]),
    );
    expect(cards[0].href).toBe('/deliverables/vault?key=k1');
    expect(cards[0].title).toBe('MotherMode OS');
    expect(cards[1].href).toBe('/dashboard');
  });
});
