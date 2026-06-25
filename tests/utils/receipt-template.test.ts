import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PurchaseEvent } from '@/utils/integrations/dispatch';

const basePayload: PurchaseEvent = {
  stripe_event_id: 'evt_1',
  payment_intent_id: 'pi_123',
  product_id: 'prod_fe27',
  page_type: 'fe',
  amount_cents: 2700,
  currency: 'usd',
  customer_email: 'buyer@example.com',
  customer_name: 'Jane Buyer'
};

const getReceiptTemplate = vi.fn();

vi.mock('@/utils/email/templates', async (orig) => {
  const real = await orig<typeof import('@/utils/email/templates')>();
  return {
    ...real,
    getReceiptTemplate: (...args: unknown[]) => getReceiptTemplate(...args)
  };
});

let fetchSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetModules();
  getReceiptTemplate.mockReset();
  process.env.RESEND_API_KEY = 're_x';
  process.env.RECEIPT_FROM_EMAIL = 'noreply@x.com';
  delete process.env.RECEIPT_PROVIDER;
  delete process.env.POSTMARK_API_TOKEN;
  delete process.env.RECEIPT_BRAND_NAME;
  delete process.env.RECEIPT_SUBJECT_PREFIX;
  delete process.env.RECEIPT_REPLY_TO;
  fetchSpy = vi.spyOn(globalThis, 'fetch' as any) as any;
  fetchSpy.mockResolvedValue(new Response('{"id":"em_1"}', { status: 200 }) as any);
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  fetchSpy.mockRestore();
  errorSpy.mockRestore();
});

describe('sendPurchaseReceipt template substitution', () => {
  it('uses the stored template subject + bodies when present', async () => {
    getReceiptTemplate.mockResolvedValueOnce({
      id: 'default',
      subject: 'Hi {{name}} — receipt for {{amount}}',
      body_html: '<p>{{brand}} thanks you, {{name}}. Ref: {{ref}}.</p>',
      body_text: '{{brand}} | {{amount}} | {{product}}'
    });
    process.env.RECEIPT_BRAND_NAME = 'Mindshift';
    const { sendPurchaseReceipt } = await import('@/utils/email/receipt');
    const result = await sendPurchaseReceipt(basePayload);
    expect(result.sent).toBe(true);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(body.subject).toBe('Hi Jane — receipt for $27.00');
    expect(body.html).toBe(
      '<p>Mindshift thanks you, Jane. Ref: pi_123.</p>'
    );
    expect(body.text).toBe('Mindshift | $27.00 | prod_fe27');
  });

  it('still respects RECEIPT_SUBJECT_PREFIX when using a stored template', async () => {
    getReceiptTemplate.mockResolvedValueOnce({
      id: 'default',
      subject: 'Receipt {{amount}}',
      body_html: 'h',
      body_text: 't'
    });
    process.env.RECEIPT_SUBJECT_PREFIX = '[Mindshift]';
    const { sendPurchaseReceipt } = await import('@/utils/email/receipt');
    await sendPurchaseReceipt(basePayload);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(body.subject).toBe('[Mindshift] Receipt $27.00');
  });

  it('HTML-escapes substituted values to defeat injection', async () => {
    getReceiptTemplate.mockResolvedValueOnce({
      id: 'default',
      subject: 'Receipt',
      body_html: '<p>Hi {{name}}</p>',
      body_text: 'Hi {{name}}'
    });
    const { sendPurchaseReceipt } = await import('@/utils/email/receipt');
    await sendPurchaseReceipt({
      ...basePayload,
      customer_name: '<script>alert(1)</script>'
    });
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(body.html).not.toContain('<script>');
    expect(body.html).toContain('&lt;script&gt;');
    // plaintext does NOT escape
    expect(body.text).toContain('<script>');
  });

  it('falls back to hardcoded copy when template fetch returns null', async () => {
    getReceiptTemplate.mockResolvedValueOnce(null);
    const { sendPurchaseReceipt } = await import('@/utils/email/receipt');
    await sendPurchaseReceipt(basePayload);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(body.subject).toContain('$27.00');
    expect(body.html).toContain('Payment received');
  });
});
