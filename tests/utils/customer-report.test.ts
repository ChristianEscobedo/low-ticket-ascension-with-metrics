import { describe, expect, it } from 'vitest';
import { buildCustomerReportCsv } from '@/utils/admin/customer-report';
import type {
  CustomerActivity,
  CustomerDetail
} from '@/utils/supabase/admin';

const detail: CustomerDetail = {
  user: {
    id: 'usr_1',
    email: 'buyer@example.com',
    created_at: '2026-01-02T03:04:05.000Z'
  },
  stripe_customer_id: 'cus_abc',
  subscriptions: [
    {
      id: 'sub_1',
      status: 'active',
      created: '2026-01-10T00:00:00.000Z',
      current_period_end: '2026-02-10T00:00:00.000Z',
      prices: {
        unit_amount: 4900,
        interval: 'month',
        products: { name: 'Pro Plan' }
      }
    }
  ],
  purchases: [
    {
      id: 'p1',
      created_at: '2026-01-15T00:00:00.000Z',
      customer_email: 'buyer@example.com',
      product_id: 'prod_x',
      page_type: 'upsell',
      amount_cents: 12300,
      currency: 'usd'
    } as any
  ],
  lifetimeCents: 12300
};

const activity: CustomerActivity = {
  receiptLog: [
    {
      id: 'r1',
      created_at: '2026-01-15T00:00:01.000Z',
      status: 'sent',
      provider: 'resend',
      amount_cents: 12300,
      currency: 'usd',
      payment_intent_id: 'pi_1',
      message_id: 'msg_1',
      delivery_status: 'delivered',
      bounce_reason: null,
      error: null,
      skipped_reason: null
    }
  ],
  ctaClicks: [
    {
      id: 'c1',
      created_at: '2026-01-20T00:00:00.000Z',
      lesson_id: 'les_1',
      cta_id: 'buy_now',
      lesson_title: 'Intro, with a "quote"',
      course_id: 'crs_1',
      course_title: 'Mindshift 101'
    }
  ],
  lessonProgress: [
    {
      lesson_id: 'les_1',
      lesson_title: 'Intro',
      course_id: 'crs_1',
      course_title: 'Mindshift 101',
      progress_seconds: 125,
      is_completed: true,
      completed_at: '2026-01-22T00:00:00.000Z',
      last_watched_at: '2026-01-22T00:00:00.000Z'
    }
  ]
};

describe('buildCustomerReportCsv', () => {
  const csv = buildCustomerReportCsv(detail, activity);

  it('emits a section header and data for every panel', () => {
    expect(csv).toContain('# Customer');
    expect(csv).toContain('# Subscriptions');
    expect(csv).toContain('# Purchases');
    expect(csv).toContain('# Receipt deliveries');
    expect(csv).toContain('# CTA clicks');
    expect(csv).toContain('# Lesson progress');
  });

  it('formats cents as 2-decimal USD without symbols', () => {
    expect(csv).toContain('123.00');
    expect(csv).toContain('49.00');
  });

  it('serializes booleans as true/false', () => {
    expect(csv).toContain(',true,');
  });

  it('quotes fields containing commas or quotes per RFC 4180', () => {
    expect(csv).toContain('"Intro, with a ""quote"""');
  });

  it('terminates with CRLF', () => {
    expect(csv.endsWith('\r\n')).toBe(true);
  });
});
