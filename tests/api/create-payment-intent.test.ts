import { describe, it, expect, vi, beforeEach } from 'vitest';

const customersList = vi.fn();
const customersCreate = vi.fn();
const paymentMethodsList = vi.fn();
const paymentIntentsCreate = vi.fn();

vi.mock('@/utils/stripe/config', () => ({
  stripe: {
    customers: { list: customersList, create: customersCreate },
    paymentMethods: { list: paymentMethodsList },
    paymentIntents: { create: paymentIntentsCreate },
  },
}));

// Pass a minimal duck-typed request so we don't need to import NextRequest.
const reqWithBody = (body: unknown) =>
  ({ json: async () => body } as unknown as import('next/server').NextRequest);

const validBody = {
  amount: 2700,
  currency: 'usd',
  customer_data: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' },
  product_id: 'millionaire_mindshift',
  metadata: { source: 'fe' },
};

describe('POST /api/create-payment-intent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
    delete process.env.STRIPE_SECRET_KEY_LIVE;
  });

  it('returns 503 when Stripe is not configured', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY_LIVE;
    const { POST } = await import('@/app/api/create-payment-intent/route');
    const res = await POST(reqWithBody(validBody));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/not configured/i);
  });

  it('returns 400 when required fields are missing', async () => {
    const { POST } = await import('@/app/api/create-payment-intent/route');
    const res = await POST(reqWithBody({ amount: 2700, currency: 'usd', customer_data: {} }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/missing required fields/i);
  });

  it('returns 400 when amount is below 50 cents', async () => {
    const { POST } = await import('@/app/api/create-payment-intent/route');
    const res = await POST(reqWithBody({ ...validBody, amount: 10 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid amount/i);
  });

  it('creates a new Stripe customer when none exists and returns client_secret', async () => {
    customersList.mockResolvedValue({ data: [] });
    customersCreate.mockResolvedValue({ id: 'cus_new' });
    paymentIntentsCreate.mockResolvedValue({
      id: 'pi_123',
      client_secret: 'pi_123_secret_abc',
    });

    const { POST } = await import('@/app/api/create-payment-intent/route');
    const res = await POST(reqWithBody(validBody));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      status: 'requires_payment',
      client_secret: 'pi_123_secret_abc',
      payment_intent_id: 'pi_123',
    });
    expect(customersCreate).toHaveBeenCalledOnce();
    expect(paymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2700,
        currency: 'usd',
        customer: 'cus_new',
        setup_future_usage: 'off_session',
        metadata: expect.objectContaining({
          product_id: 'millionaire_mindshift',
          customer_email: 'ada@example.com',
          one_click: 'false',
          source: 'fe',
        }),
      })
    );
  });

  it('reuses existing Stripe customer when one matches the email', async () => {
    customersList.mockResolvedValue({ data: [{ id: 'cus_existing' }] });
    paymentIntentsCreate.mockResolvedValue({ id: 'pi_2', client_secret: 'pi_2_secret' });
    const { POST } = await import('@/app/api/create-payment-intent/route');
    await POST(reqWithBody(validBody));
    expect(customersCreate).not.toHaveBeenCalled();
    expect(paymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_existing' })
    );
  });

  it('one_click with saved card and PI succeeded returns status=succeeded', async () => {
    customersList.mockResolvedValue({ data: [{ id: 'cus_existing' }] });
    paymentMethodsList.mockResolvedValue({ data: [{ id: 'pm_saved' }] });
    paymentIntentsCreate.mockResolvedValue({ id: 'pi_succ', status: 'succeeded' });
    const { POST } = await import('@/app/api/create-payment-intent/route');
    const res = await POST(reqWithBody({ ...validBody, one_click: true }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'succeeded', payment_intent_id: 'pi_succ' });
    expect(paymentIntentsCreate).toHaveBeenCalledOnce();
    expect(paymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ payment_method: 'pm_saved', confirm: true })
    );
  });

  it('one_click with saved card requiring 3DS returns requires_action + client_secret', async () => {
    customersList.mockResolvedValue({ data: [{ id: 'cus_existing' }] });
    paymentMethodsList.mockResolvedValue({ data: [{ id: 'pm_saved' }] });
    paymentIntentsCreate.mockResolvedValue({
      id: 'pi_3ds',
      status: 'requires_action',
      client_secret: 'pi_3ds_secret',
    });
    const { POST } = await import('@/app/api/create-payment-intent/route');
    const res = await POST(reqWithBody({ ...validBody, one_click: true }));
    const body = await res.json();
    expect(body).toEqual({
      status: 'requires_action',
      client_secret: 'pi_3ds_secret',
      payment_intent_id: 'pi_3ds',
    });
  });

  it('one_click without a saved card falls through to PaymentElement flow', async () => {
    customersList.mockResolvedValue({ data: [{ id: 'cus_existing' }] });
    paymentMethodsList.mockResolvedValue({ data: [] });
    paymentIntentsCreate.mockResolvedValue({ id: 'pi_fb', client_secret: 'pi_fb_secret' });
    const { POST } = await import('@/app/api/create-payment-intent/route');
    const res = await POST(reqWithBody({ ...validBody, one_click: true }));
    const body = await res.json();
    expect(body.status).toBe('requires_payment');
    expect(body.client_secret).toBe('pi_fb_secret');
    // Should only call paymentIntents.create once (the fallback), not the one_click path.
    expect(paymentIntentsCreate).toHaveBeenCalledOnce();
    expect(paymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ setup_future_usage: 'off_session' })
    );
  });
});
