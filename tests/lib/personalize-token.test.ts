import { describe, expect, it } from 'vitest';

import {
  buildPersonalizedUrl,
  signPersonalizationToken,
  verifyPersonalizationToken,
  MAX_TOKEN_LENGTH,
} from '@/lib/mothermode/personalize/token';
import type { PersonalizationTokenPayload } from '@/lib/mothermode/personalize/types';

import {
  buildEmailImagePath,
  emailImageCampaignKey,
  emailImageSignature,
  parseCampaignKey,
  sanitizeImageText,
  toEmailImageTemplate,
  verifyEmailImageSignature,
  MAX_NAME_LEN,
} from '@/lib/mothermode/personalize/emailImage';
import { toTokenPayload } from '@/lib/mothermode/personalize/types';

const SECRET = 'test-secret-123';

const payload: PersonalizationTokenPayload = {
  v: 1,
  k: 'sales',
  fid: 'funnel-uuid-1',
  em: 'jane@example.com',
  fn: 'Jane',
};

describe('personalization token sign/verify', () => {
  it('round-trips a signed token', () => {
    const token = signPersonalizationToken(payload, SECRET);
    const out = verifyPersonalizationToken(token, SECRET);
    expect(out).not.toBeNull();
    expect(out?.em).toBe('jane@example.com');
    expect(out?.fid).toBe('funnel-uuid-1');
    expect(out?.k).toBe('sales');
    expect(out?.fn).toBe('Jane');
  });

  it('is deterministic per (funnel, email) — the ESP custom-field property', () => {
    expect(signPersonalizationToken(payload, SECRET)).toBe(
      signPersonalizationToken(payload, SECRET),
    );
  });

  it('rejects a tampered payload', () => {
    const token = signPersonalizationToken(payload, SECRET);
    const [body, sig] = token.split('.');
    // Flip one payload byte while keeping valid base64url charset.
    const flipped = (body[0] === 'A' ? 'B' : 'A') + body.slice(1);
    expect(verifyPersonalizationToken(`${flipped}.${sig}`, SECRET)).toBeNull();
  });

  it('rejects a tampered signature', () => {
    const token = signPersonalizationToken(payload, SECRET);
    const [body, sig] = token.split('.');
    const flipped = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1);
    expect(verifyPersonalizationToken(`${body}.${flipped}`, SECRET)).toBeNull();
  });

  it('rejects a token signed with a different secret', () => {
    const token = signPersonalizationToken(payload, 'other-secret');
    expect(verifyPersonalizationToken(token, SECRET)).toBeNull();
  });

  it('rejects malformed input without throwing', () => {
    expect(verifyPersonalizationToken('', SECRET)).toBeNull();
    expect(verifyPersonalizationToken(null, SECRET)).toBeNull();
    expect(verifyPersonalizationToken('no-dot-here', SECRET)).toBeNull();
    expect(verifyPersonalizationToken('.sig', SECRET)).toBeNull();
    expect(verifyPersonalizationToken('body.', SECRET)).toBeNull();
    expect(verifyPersonalizationToken('a'.repeat(MAX_TOKEN_LENGTH + 1), SECRET)).toBeNull();
    expect(verifyPersonalizationToken('!!!.!!!', SECRET)).toBeNull();
  });

  it('rejects an expired token', () => {
    const expired = signPersonalizationToken(
      { ...payload, exp: Math.floor(Date.now() / 1000) - 60 },
      SECRET,
    );
    expect(verifyPersonalizationToken(expired, SECRET)).toBeNull();
  });

  it('accepts a token expiring in the future', () => {
    const ok = signPersonalizationToken(
      { ...payload, exp: Math.floor(Date.now() / 1000) + 3600 },
      SECRET,
    );
    expect(verifyPersonalizationToken(ok, SECRET)).not.toBeNull();
  });
});

describe('toTokenPayload', () => {
  it('normalizes email case and trims', () => {
    const out = toTokenPayload({ v: 1, k: 'optin', fid: 'f', em: '  Jane@Example.COM ' });
    expect(out?.em).toBe('jane@example.com');
  });

  it('rejects wrong version / kind / missing email', () => {
    expect(toTokenPayload({ v: 2, k: 'sales', fid: 'f', em: 'a@b.co' })).toBeNull();
    expect(toTokenPayload({ v: 1, k: 'webinar', fid: 'f', em: 'a@b.co' })).toBeNull();
    expect(toTokenPayload({ v: 1, k: 'sales', fid: 'f', em: 'not-an-email' })).toBeNull();
    expect(toTokenPayload({ v: 1, k: 'sales', fid: '', em: 'a@b.co' })).toBeNull();
    expect(toTokenPayload(null)).toBeNull();
    expect(toTokenPayload('x')).toBeNull();
  });
});

describe('buildPersonalizedUrl', () => {
  it('appends ?pp= and preserves existing params', () => {
    const url = buildPersonalizedUrl(
      'https://example.com/funnel/x?utm_source=email',
      payload,
      SECRET,
    );
    const parsed = new URL(url);
    expect(parsed.searchParams.get('utm_source')).toBe('email');
    const pp = parsed.searchParams.get('pp');
    expect(pp).toBeTruthy();
    expect(verifyPersonalizationToken(pp, SECRET)?.em).toBe('jane@example.com');
  });

  it('keeps root-relative URLs relative', () => {
    const url = buildPersonalizedUrl('/funnel/x', payload, SECRET);
    expect(url.startsWith('/funnel/x?pp=')).toBe(true);
  });

  it('returns unparseable input unchanged', () => {
    // `new URL` throws on a scheme with no host; the builder must fall back
    // to the raw input rather than crash an admin flow.
    expect(buildPersonalizedUrl('http://', payload, SECRET)).toBe('http://');
  });

});

describe('email image helpers', () => {
  it('campaign key round-trips', () => {
    const key = emailImageCampaignKey('sales', 'abc-123');
    expect(parseCampaignKey(key)).toEqual({ kind: 'sales', funnelId: 'abc-123' });
    expect(parseCampaignKey('webinar:abc')).toBeNull();
    expect(parseCampaignKey('')).toBeNull();
    expect(parseCampaignKey(null)).toBeNull();
  });

  it('template validation', () => {
    expect(toEmailImageTemplate('name-card')).toBe('name-card');
    expect(toEmailImageTemplate('evil')).toBeNull();
  });

  it('signature verifies and rejects tampering', () => {
    const sig = emailImageSignature('sales:f1', 'name-card', SECRET);
    expect(verifyEmailImageSignature('sales:f1', 'name-card', sig, SECRET)).toBe(true);
    expect(verifyEmailImageSignature('sales:f2', 'name-card', sig, SECRET)).toBe(false);
    expect(verifyEmailImageSignature('sales:f1', 'note-card', sig, SECRET)).toBe(false);
    expect(verifyEmailImageSignature('sales:f1', 'name-card', 'zzzz', SECRET)).toBe(false);
    expect(verifyEmailImageSignature('sales:f1', 'name-card', null, SECRET)).toBe(false);
  });

  it('built path verifies against its own signature', () => {
    const path = buildEmailImagePath(
      { campaignKey: 'sales:f1', template: 'name-card', name: '{{contact.first_name}}' },
      SECRET,
    );
    expect(path.startsWith('/api/personalize/email-image?')).toBe(true);
    const params = new URL(path, 'https://x.test').searchParams;
    expect(
      verifyEmailImageSignature(
        params.get('c') || '',
        toEmailImageTemplate(params.get('tpl')) || 'name-card',
        params.get('sig'),
        SECRET,
      ),
    ).toBe(true);
    // The merge marker survives intact for the ESP to fill.
    expect(params.get('name')).toBe('{{contact.first_name}}');
  });
});

describe('sanitizeImageText', () => {
  it('caps length, strips markup-ish chars and collapses whitespace', () => {
    expect(sanitizeImageText('  Jane   Doe  ', MAX_NAME_LEN)).toBe('Jane Doe');
    expect(sanitizeImageText('<script>alert(1)</script>', 100)).not.toContain('<');
    expect(sanitizeImageText('x'.repeat(500), MAX_NAME_LEN).length).toBe(MAX_NAME_LEN);
    expect(sanitizeImageText(null, 10)).toBe('');
  });

  it('treats an unfilled ESP merge marker as empty, never literal text', () => {
    expect(sanitizeImageText('{{contact.first_name}}', MAX_NAME_LEN)).toBe('');
  });
});
