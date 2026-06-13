import { describe, it, expect, vi, beforeEach } from 'vitest';

const constructEvent = vi.fn();
const recordFunnelPurchase = vi.fn();
const manageSubscriptionStatusChange = vi.fn();

vi.mock('@/utils/stripe/config', () => ({
  stripe: { webhooks: { constructEvent } },
}));

vi.mock('@/utils/supabase/admin', () => ({
  upsertProductRecord: vi.fn(),
  upsertPriceRecord: vi.fn(),
  deleteProductRecord: vi.fn(),
  deletePriceRecord: vi.fn(),
  manageSubscriptionStatusChange,
  recordFunnelPurchase,
}));

vi.mock('@/utils/integrations/dispatch', () => ({
  dispatchPurchase: vi.fn(),
}));

const reqWithEvent = () =>
  ({
    text: async () => 'raw-body',
    headers: { get: (k: string) => (k === 'stripe-signature' ? 'sig' : null) },
  } as unknown as Request);

describe('POST /api/webhooks — funnel branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    vi.resetModules();
  });

  it('records a funnel purchase on payment_intent.succeeded', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_pi_1',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_abc',
          amount: 2700,
          currency: 'usd',
          receipt_email: 'ada@example.com',
          metadata: {
            product_id: 'millionaire_mindshift',
            page_type: 'fe',
            customer_email: 'ada@example.com',
            customer_name: 'Ada Lovelace',
            one_click: 'false',
          },
        },
      },
    });

    const { POST } = await import('@/app/api/webhooks/route');
    const res = await POST(reqWithEvent());

    expect(res.status).toBe(200);
    expect(recordFunnelPurchase).toHaveBeenCalledWith({
      stripe_event_id: 'evt_pi_1',
      payment_intent_id: 'pi_abc',
      product_id: 'millionaire_mindshift',
      page_type: 'fe',
      amount_cents: 2700,
      currency: 'usd',
      customer_email: 'ada@example.com',
      customer_name: 'Ada Lovelace',
      metadata: expect.objectContaining({ product_id: 'millionaire_mindshift' }),
    });
  });

  it('records a funnel purchase on checkout.session.completed mode=payment', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_cs_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_xyz',
          mode: 'payment',
          payment_intent: 'pi_from_session',
          amount_total: 1900,
          currency: 'usd',
          customer_email: null,
          customer_details: { email: 'bob@example.com', name: 'Bob Hope' },
          metadata: { product_id: 'prod_oto3', page_type: 'oto3' },
        },
      },
    });

    const { POST } = await import('@/app/api/webhooks/route');
    await POST(reqWithEvent());

    expect(recordFunnelPurchase).toHaveBeenCalledWith({
      stripe_event_id: 'evt_cs_1',
      checkout_session_id: 'cs_xyz',
      payment_intent_id: 'pi_from_session',
      product_id: 'prod_oto3',
      page_type: 'oto3',
      amount_cents: 1900,
      currency: 'usd',
      customer_email: 'bob@example.com',
      customer_name: 'Bob Hope',
      metadata: expect.objectContaining({ product_id: 'prod_oto3' }),
    });
    expect(manageSubscriptionStatusChange).not.toHaveBeenCalled();
  });

  it('routes checkout.session.completed mode=subscription to manageSubscriptionStatusChange AND records the initial conversion in funnel_purchases', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_cs_sub',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_sub',
          mode: 'subscription',
          subscription: 'sub_1',
          customer: 'cus_1',
          amount_total: 9700,
          currency: 'usd',
          customer_email: 'sub@example.com',
          customer_details: { email: 'sub@example.com', name: 'Sub User' },
          metadata: { product_id: 'prod_oto1', page_type: 'oto1' },
        },
      },
    });

    const { POST } = await import('@/app/api/webhooks/route');
    await POST(reqWithEvent());

    expect(manageSubscriptionStatusChange).toHaveBeenCalledWith(
      'sub_1',
      'cus_1',
      true
    );
    expect(recordFunnelPurchase).toHaveBeenCalledWith({
      stripe_event_id: 'evt_cs_sub',
      checkout_session_id: 'cs_sub',
      product_id: 'prod_oto1',
      page_type: 'oto1',
      amount_cents: 9700,
      currency: 'usd',
      customer_email: 'sub@example.com',
      customer_name: 'Sub User',
      metadata: expect.objectContaining({ page_type: 'oto1' }),
    });
  });

  it('deduplicates a repeated event id within the same warm instance', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_dup',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_dup',
          amount: 100,
          currency: 'usd',
          metadata: {},
        },
      },
    });

    const { POST } = await import('@/app/api/webhooks/route');
    const first = await POST(reqWithEvent());
    const second = await POST(reqWithEvent());

    expect(recordFunnelPurchase).toHaveBeenCalledTimes(1);
    const firstBody = await first.json();
    const secondBody = await second.json();
    expect(firstBody).toEqual({ received: true });
    expect(secondBody).toEqual({ received: true, duplicate: true });
  });

  it('returns 400 for an unsupported event type', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_irrelevant',
      type: 'invoice.created',
      data: { object: {} },
    });

    const { POST } = await import('@/app/api/webhooks/route');
    const res = await POST(reqWithEvent());

    expect(res.status).toBe(400);
    expect(recordFunnelPurchase).not.toHaveBeenCalled();
  });

  it('returns 400 when the stripe-signature header is missing', async () => {
    const req = {
      text: async () => 'raw',
      headers: { get: () => null },
    } as unknown as Request;
    const { POST } = await import('@/app/api/webhooks/route');
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
