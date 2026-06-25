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

let fetchSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetModules();
  delete process.env.RESEND_API_KEY;
  delete process.env.POSTMARK_API_TOKEN;
  delete process.env.RECEIPT_PROVIDER;
  delete process.env.RECEIPT_FROM_EMAIL;
  delete process.env.RECEIPT_BRAND_NAME;
  delete process.env.RECEIPT_SUBJECT_PREFIX;
  delete process.env.RECEIPT_REPLY_TO;
  delete process.env.RECEIPT_BCC;
  delete process.env.RECEIPT_POSTMARK_STREAM;
  // Force getReceiptTemplate to short-circuit (no DB template) so these
  // tests cover the hardcoded fallback path only.
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  fetchSpy = vi.spyOn(globalThis, 'fetch' as any) as any;
  fetchSpy.mockResolvedValue(
    new Response('{"id":"em_1"}', { status: 200 }) as any
  );
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  fetchSpy.mockRestore();
  errorSpy.mockRestore();
});

describe('sendPurchaseReceipt', () => {
  it('no-ops when RESEND_API_KEY is missing', async () => {
    process.env.RECEIPT_FROM_EMAIL = 'Brand <noreply@x.com>';
    const { sendPurchaseReceipt } = await import('@/utils/email/receipt');
    await sendPurchaseReceipt(basePayload);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('no-ops when RECEIPT_FROM_EMAIL is missing', async () => {
    process.env.RESEND_API_KEY = 're_x';
    const { sendPurchaseReceipt } = await import('@/utils/email/receipt');
    await sendPurchaseReceipt(basePayload);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('no-ops when customer_email is missing', async () => {
    process.env.RESEND_API_KEY = 're_x';
    process.env.RECEIPT_FROM_EMAIL = 'noreply@x.com';
    const { sendPurchaseReceipt } = await import('@/utils/email/receipt');
    await sendPurchaseReceipt({ ...basePayload, customer_email: null });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts a properly-shaped payload to resend on the happy path', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.RECEIPT_FROM_EMAIL = 'Brand <noreply@x.com>';
    const { sendPurchaseReceipt } = await import('@/utils/email/receipt');
    await sendPurchaseReceipt(basePayload);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer re_test_key');
    expect(headers['content-type']).toBe('application/json');
    const body = JSON.parse(init.body as string);
    expect(body.from).toBe('Brand <noreply@x.com>');
    expect(body.to).toEqual(['buyer@example.com']);
    expect(body.subject).toContain('$27.00');
    expect(body.html).toContain('prod_fe27');
    expect(body.html).toContain('Jane'); // first name only
    expect(body.text).toContain('pi_123');
  });

  it('falls back to checkout_session_id when no payment_intent_id', async () => {
    process.env.RESEND_API_KEY = 're_x';
    process.env.RECEIPT_FROM_EMAIL = 'noreply@x.com';
    const { sendPurchaseReceipt } = await import('@/utils/email/receipt');
    await sendPurchaseReceipt({
      ...basePayload,
      payment_intent_id: null,
      checkout_session_id: 'cs_999'
    });
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(body.text).toContain('cs_999');
  });

  it('swallows non-2xx responses without throwing', async () => {
    process.env.RESEND_API_KEY = 're_x';
    process.env.RECEIPT_FROM_EMAIL = 'noreply@x.com';
    fetchSpy.mockResolvedValueOnce(
      new Response('{"error":"invalid"}', { status: 422 }) as any
    );
    const { sendPurchaseReceipt } = await import('@/utils/email/receipt');
    const result = await sendPurchaseReceipt(basePayload);
    expect(result.sent).toBe(false);
    expect(result.status).toBe(422);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('swallows fetch rejections without throwing', async () => {
    process.env.RESEND_API_KEY = 're_x';
    process.env.RECEIPT_FROM_EMAIL = 'noreply@x.com';
    fetchSpy.mockRejectedValueOnce(new Error('network down'));
    const { sendPurchaseReceipt } = await import('@/utils/email/receipt');
    const result = await sendPurchaseReceipt(basePayload);
    expect(result.sent).toBe(false);
    expect(result.error).toContain('network down');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('escapes HTML-special characters in product and customer name', async () => {
    process.env.RESEND_API_KEY = 're_x';
    process.env.RECEIPT_FROM_EMAIL = 'noreply@x.com';
    const { sendPurchaseReceipt } = await import('@/utils/email/receipt');
    await sendPurchaseReceipt({
      ...basePayload,
      product_id: 'prod_<script>',
      customer_name: '"><img>'
    });
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(body.html).not.toContain('<script>');
    expect(body.html).toContain('&lt;script&gt;');
    expect(body.html).toContain('&quot;');
  });

  it('includes RECEIPT_BRAND_NAME in subject, HTML eyebrow, and signoff', async () => {
    process.env.RESEND_API_KEY = 're_x';
    process.env.RECEIPT_FROM_EMAIL = 'noreply@x.com';
    process.env.RECEIPT_BRAND_NAME = 'Mindshift';
    const { sendPurchaseReceipt } = await import('@/utils/email/receipt');
    await sendPurchaseReceipt(basePayload);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(body.subject).toContain('Your Mindshift receipt');
    expect(body.html).toContain('Mindshift');
    expect(body.text).toContain('— The Mindshift team');
  });

  it('prepends RECEIPT_SUBJECT_PREFIX to the subject line', async () => {
    process.env.RESEND_API_KEY = 're_x';
    process.env.RECEIPT_FROM_EMAIL = 'noreply@x.com';
    process.env.RECEIPT_SUBJECT_PREFIX = '[Mindshift]';
    const { sendPurchaseReceipt } = await import('@/utils/email/receipt');
    await sendPurchaseReceipt(basePayload);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(body.subject.startsWith('[Mindshift] ')).toBe(true);
  });

  it('attaches reply_to when RECEIPT_REPLY_TO is set', async () => {
    process.env.RESEND_API_KEY = 're_x';
    process.env.RECEIPT_FROM_EMAIL = 'noreply@x.com';
    process.env.RECEIPT_REPLY_TO = 'support@mindshift.com';
    const { sendPurchaseReceipt } = await import('@/utils/email/receipt');
    await sendPurchaseReceipt(basePayload);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(body.reply_to).toBe('support@mindshift.com');
  });

  it('omits reply_to entirely when RECEIPT_REPLY_TO is unset', async () => {
    process.env.RESEND_API_KEY = 're_x';
    process.env.RECEIPT_FROM_EMAIL = 'noreply@x.com';
    const { sendPurchaseReceipt } = await import('@/utils/email/receipt');
    await sendPurchaseReceipt(basePayload);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(body).not.toHaveProperty('reply_to');
  });

  it('routes through Postmark when RECEIPT_PROVIDER=postmark', async () => {
    process.env.RECEIPT_PROVIDER = 'postmark';
    process.env.POSTMARK_API_TOKEN = 'pm_token_123';
    process.env.RECEIPT_FROM_EMAIL = 'noreply@x.com';
    process.env.RECEIPT_REPLY_TO = 'support@x.com';
    const { sendPurchaseReceipt } = await import('@/utils/email/receipt');
    await sendPurchaseReceipt(basePayload);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.postmarkapp.com/email');
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Postmark-Server-Token']).toBe('pm_token_123');
    const body = JSON.parse(init.body as string);
    expect(body.From).toBe('noreply@x.com');
    expect(body.To).toBe('buyer@example.com');
    expect(body.MessageStream).toBe('outbound');
    expect(body.ReplyTo).toBe('support@x.com');
    expect(body.Subject).toContain('$27.00');
  });

  it('no-ops when RECEIPT_PROVIDER=postmark but POSTMARK_API_TOKEN missing', async () => {
    process.env.RECEIPT_PROVIDER = 'postmark';
    process.env.RECEIPT_FROM_EMAIL = 'noreply@x.com';
    const { sendPurchaseReceipt } = await import('@/utils/email/receipt');
    await sendPurchaseReceipt(basePayload);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('honors RECEIPT_POSTMARK_STREAM override on the Postmark payload', async () => {
    process.env.RECEIPT_PROVIDER = 'postmark';
    process.env.POSTMARK_API_TOKEN = 'pm_token_123';
    process.env.RECEIPT_FROM_EMAIL = 'noreply@x.com';
    process.env.RECEIPT_POSTMARK_STREAM = 'receipts-stream';
    const { sendPurchaseReceipt } = await import('@/utils/email/receipt');
    await sendPurchaseReceipt(basePayload);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(body.MessageStream).toBe('receipts-stream');
  });

  it('attaches RECEIPT_BCC (csv) to the Resend payload', async () => {
    process.env.RESEND_API_KEY = 're_x';
    process.env.RECEIPT_FROM_EMAIL = 'noreply@x.com';
    process.env.RECEIPT_BCC = 'archive@x.com, ghl-ingest@x.com';
    const { sendPurchaseReceipt } = await import('@/utils/email/receipt');
    await sendPurchaseReceipt(basePayload);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(body.bcc).toEqual(['archive@x.com', 'ghl-ingest@x.com']);
  });

  it('attaches RECEIPT_BCC (csv) joined as Bcc on the Postmark payload', async () => {
    process.env.RECEIPT_PROVIDER = 'postmark';
    process.env.POSTMARK_API_TOKEN = 'pm_token_123';
    process.env.RECEIPT_FROM_EMAIL = 'noreply@x.com';
    process.env.RECEIPT_BCC = 'archive@x.com,ghl-ingest@x.com';
    const { sendPurchaseReceipt } = await import('@/utils/email/receipt');
    await sendPurchaseReceipt(basePayload);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(body.Bcc).toBe('archive@x.com,ghl-ingest@x.com');
  });

  it('omits bcc / Bcc entirely when RECEIPT_BCC is unset or whitespace', async () => {
    process.env.RESEND_API_KEY = 're_x';
    process.env.RECEIPT_FROM_EMAIL = 'noreply@x.com';
    process.env.RECEIPT_BCC = ' , , ';
    const { sendPurchaseReceipt } = await import('@/utils/email/receipt');
    await sendPurchaseReceipt(basePayload);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(body).not.toHaveProperty('bcc');
    expect(body).not.toHaveProperty('Bcc');
  });

  it('uses overrideTemplate (with token substitution) instead of any stored template', async () => {
    process.env.RESEND_API_KEY = 're_x';
    process.env.RECEIPT_FROM_EMAIL = 'noreply@x.com';
    process.env.RECEIPT_BRAND_NAME = 'Mindshift';
    const { sendPurchaseReceipt } = await import('@/utils/email/receipt');
    await sendPurchaseReceipt(basePayload, {
      overrideTemplate: {
        subject: 'DRAFT — {{brand}} — {{amount}}',
        body_html: '<p>Hi {{name}}, thanks for {{product}}.</p>',
        body_text: 'Hi {{name}}, thanks for {{product}}.'
      }
    });
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(body.subject).toBe('DRAFT — Mindshift — $27.00');
    expect(body.html).toContain('Hi Jane, thanks for prod_fe27.');
    expect(body.text).toContain('Hi Jane, thanks for prod_fe27.');
  });
});
