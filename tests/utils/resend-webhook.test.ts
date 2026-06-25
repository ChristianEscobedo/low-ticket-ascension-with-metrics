import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  projectResendEvent,
  verifyResendWebhook
} from '@/utils/email/resend-webhook';

function signFixture(opts: {
  secret: string;
  svixId: string;
  svixTimestamp: string;
  rawBody: string;
}) {
  const keyMaterial = opts.secret.startsWith('whsec_')
    ? opts.secret.slice(6)
    : opts.secret;
  const keyBytes = Buffer.from(keyMaterial, 'base64');
  const signed = `${opts.svixId}.${opts.svixTimestamp}.${opts.rawBody}`;
  const sig = crypto
    .createHmac('sha256', keyBytes)
    .update(signed)
    .digest('base64');
  return `v1,${sig}`;
}

const RAW_SECRET = Buffer.from('the-quick-brown-fox-jumps-over-the-lazy').toString(
  'base64'
);
const SECRET = `whsec_${RAW_SECRET}`;

describe('verifyResendWebhook', () => {
  const ts = '1750000000';
  const now = 1750000010;
  const body = '{"type":"email.delivered","data":{"email_id":"em_1"}}';
  const id = 'msg_abc';

  it('accepts a correctly signed payload within tolerance', () => {
    const sig = signFixture({
      secret: SECRET,
      svixId: id,
      svixTimestamp: ts,
      rawBody: body
    });
    const result = verifyResendWebhook({
      secret: SECRET,
      svixId: id,
      svixTimestamp: ts,
      svixSignature: sig,
      rawBody: body,
      now
    });
    expect(result.ok).toBe(true);
  });

  it('rejects when the signature does not match', () => {
    const result = verifyResendWebhook({
      secret: SECRET,
      svixId: id,
      svixTimestamp: ts,
      svixSignature: 'v1,bogus==',
      rawBody: body,
      now
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/no matching/);
  });

  it('rejects timestamps outside the tolerance window', () => {
    const sig = signFixture({
      secret: SECRET,
      svixId: id,
      svixTimestamp: ts,
      rawBody: body
    });
    const result = verifyResendWebhook({
      secret: SECRET,
      svixId: id,
      svixTimestamp: ts,
      svixSignature: sig,
      rawBody: body,
      now: now + 3600 // 1h drift
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/tolerance/);
  });

  it('rejects when svix headers are missing', () => {
    const result = verifyResendWebhook({
      secret: SECRET,
      svixId: null,
      svixTimestamp: null,
      svixSignature: null,
      rawBody: body,
      now
    });
    expect(result.ok).toBe(false);
  });

  it('rejects when secret is empty', () => {
    const result = verifyResendWebhook({
      secret: '',
      svixId: id,
      svixTimestamp: ts,
      svixSignature: 'v1,whatever',
      rawBody: body,
      now
    });
    expect(result.ok).toBe(false);
  });
});

describe('projectResendEvent', () => {
  it('maps delivered → delivery_status delivered + delivered_at', () => {
    const p = projectResendEvent({
      type: 'email.delivered',
      created_at: '2026-06-15T10:00:00.000Z',
      data: { email_id: 'em_1' }
    });
    expect(p).toEqual({
      delivery_status: 'delivered',
      delivered_at: '2026-06-15T10:00:00.000Z',
      last_event_type: 'email.delivered',
      last_event_at: '2026-06-15T10:00:00.000Z'
    });
  });

  it('captures bounce reason from data.bounce.message', () => {
    const p = projectResendEvent({
      type: 'email.bounced',
      created_at: '2026-06-15T10:00:00.000Z',
      data: { email_id: 'em_1', bounce: { message: 'mailbox full' } }
    });
    expect(p?.delivery_status).toBe('bounced');
    expect(p?.bounce_reason).toBe('mailbox full');
    expect(p?.bounced_at).toBe('2026-06-15T10:00:00.000Z');
  });

  it('returns null for untracked event types', () => {
    expect(projectResendEvent({ type: 'email.unknown' as any })).toBeNull();
  });
});
