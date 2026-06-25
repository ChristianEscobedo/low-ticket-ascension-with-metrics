import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PurchaseEvent } from '@/utils/integrations/dispatch';
import {
  computeRetentionCutoff,
  DEFAULT_RECEIPT_LOG_RETENTION_DAYS,
  getReceiptLogRetentionDays,
  rollupReceiptLog,
  type ReceiptLogRow
} from '@/utils/email/receipt-log';

const basePayload: PurchaseEvent = {
  stripe_event_id: 'evt_x',
  payment_intent_id: 'pi_x',
  product_id: 'prod_x',
  page_type: 'fe',
  amount_cents: 2700,
  currency: 'usd',
  customer_email: 'buyer@example.com',
  customer_name: 'Jane'
};

function row(over: Partial<ReceiptLogRow>): ReceiptLogRow {
  return {
    id: 'r1',
    stripe_event_id: 'evt_x',
    payment_intent_id: 'pi_x',
    product_id: 'prod_x',
    customer_email: 'a@b.com',
    amount_cents: 100,
    currency: 'usd',
    provider: 'resend',
    status: 'sent',
    http_status: 200,
    message_id: 'msg_1',
    error: null,
    skipped_reason: null,
    created_at: '2026-06-15T00:00:00Z',
    delivery_status: null,
    delivered_at: null,
    bounced_at: null,
    bounce_reason: null,
    complained_at: null,
    last_event_type: null,
    last_event_at: null,
    ...over
  };
}

describe('rollupReceiptLog', () => {
  it('returns zeroes for empty input', () => {
    expect(rollupReceiptLog([])).toEqual({ sent: 0, skipped: 0, failed: 0 });
  });

  it('counts each status bucket independently', () => {
    const totals = rollupReceiptLog([
      row({ status: 'sent' }),
      row({ status: 'sent' }),
      row({ status: 'skipped' }),
      row({ status: 'failed' }),
      row({ status: 'failed' }),
      row({ status: 'failed' })
    ]);
    expect(totals).toEqual({ sent: 2, skipped: 1, failed: 3 });
  });
});

describe('recordReceiptAttempt', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    fetchSpy = vi.spyOn(globalThis, 'fetch' as any) as any;
    fetchSpy.mockResolvedValue(new Response('{}', { status: 200 }) as any);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('no-ops (no fetch) when supabase env is missing', async () => {
    const { recordReceiptAttempt } = await import('@/utils/email/receipt-log');
    await recordReceiptAttempt(basePayload, { sent: true, provider: 'resend' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not throw when the inner insert errors', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc_xxx';
    fetchSpy.mockResolvedValue(
      new Response('{"message":"boom"}', { status: 500 }) as any
    );
    const { recordReceiptAttempt } = await import('@/utils/email/receipt-log');
    await expect(
      recordReceiptAttempt(basePayload, {
        sent: false,
        provider: 'resend',
        error: 'upstream 500'
      })
    ).resolves.toBeUndefined();
  });
});

describe('getReceiptLogRetentionDays', () => {
  const originalEnv = process.env.RECEIPT_LOG_RETENTION_DAYS;
  afterEach(() => {
    if (originalEnv === undefined) delete process.env.RECEIPT_LOG_RETENTION_DAYS;
    else process.env.RECEIPT_LOG_RETENTION_DAYS = originalEnv;
  });

  it('defaults to 90 when unset', () => {
    delete process.env.RECEIPT_LOG_RETENTION_DAYS;
    expect(getReceiptLogRetentionDays()).toBe(DEFAULT_RECEIPT_LOG_RETENTION_DAYS);
  });

  it('respects a positive integer override', () => {
    process.env.RECEIPT_LOG_RETENTION_DAYS = '14';
    expect(getReceiptLogRetentionDays()).toBe(14);
  });

  it('falls back to the default on garbage / non-positive values', () => {
    process.env.RECEIPT_LOG_RETENTION_DAYS = 'banana';
    expect(getReceiptLogRetentionDays()).toBe(
      DEFAULT_RECEIPT_LOG_RETENTION_DAYS
    );
    process.env.RECEIPT_LOG_RETENTION_DAYS = '0';
    expect(getReceiptLogRetentionDays()).toBe(
      DEFAULT_RECEIPT_LOG_RETENTION_DAYS
    );
    process.env.RECEIPT_LOG_RETENTION_DAYS = '-7';
    expect(getReceiptLogRetentionDays()).toBe(
      DEFAULT_RECEIPT_LOG_RETENTION_DAYS
    );
  });
});

describe('computeRetentionCutoff', () => {
  it('produces an ISO timestamp N days before `now`', () => {
    const now = new Date('2026-06-15T12:00:00.000Z');
    expect(computeRetentionCutoff(30, now)).toBe('2026-05-16T12:00:00.000Z');
  });

  it('handles fractional days via millisecond math', () => {
    const now = new Date('2026-06-15T00:00:00.000Z');
    // 0.5 days = 12 hours.
    expect(computeRetentionCutoff(0.5, now)).toBe('2026-06-14T12:00:00.000Z');
  });
});

describe('purgeReceiptLog', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it('returns skipped (no fetch) when supabase env is missing', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any) as any;
    const { purgeReceiptLog } = await import('@/utils/email/receipt-log');
    const result = await purgeReceiptLog(7, new Date('2026-06-15T00:00:00Z'));
    expect(result.ok).toBe(false);
    expect(result.deleted).toBe(0);
    expect(result.skipped).toContain('supabase env');
    expect(result.cutoff).toBe('2026-06-08T00:00:00.000Z');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('getResendWebhookHealth', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it('returns the zero-filled shape when env is missing', async () => {
    const { getResendWebhookHealth } = await import(
      '@/utils/email/receipt-log'
    );
    const h = await getResendWebhookHealth(new Date('2026-06-15T00:00:00Z'));
    expect(h.configured).toBe(false);
    expect(h.sent7d).toBe(0);
    expect(h.bounceRate).toBeNull();
    expect(h.lastEventAt).toBeNull();
  });
});
