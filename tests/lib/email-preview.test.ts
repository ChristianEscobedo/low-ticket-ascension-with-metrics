import { describe, it, expect } from 'vitest';
import { normalizeEmail, type EmailMessage } from '@/lib/mothermode/email/types';
import {
  renderEmailPreview,
  sampleTokenValues,
  collectEmailTokens,
  collectSequenceTokens,
  SAMPLE_TOKEN_VALUES,
  PREVIEW_WIDTHS,
} from '@/lib/mothermode/email/preview';

/** Build a normalized email from partial input. */
function email(patch: Record<string, unknown>): EmailMessage {
  return normalizeEmail(patch);
}

describe('collectEmailTokens', () => {
  it('collects distinct tokens across subject / preview / body / cta', () => {
    const e = email({
      subject: 'Hey {{first_name}}',
      preview: '{{brand}} has news',
      bodyText: '<p>Hi {{first_name}}, see {{offer_name}}</p>',
      cta: { label: 'Go {{first_name}}', url: '{{cta_url}}' },
    });
    const tokens = collectEmailTokens(e).sort();
    expect(tokens).toEqual(
      ['brand', 'cta_url', 'first_name', 'offer_name'].sort(),
    );
  });

  it('returns [] for an email with no tokens', () => {
    expect(collectEmailTokens(email({ subject: 'Plain', bodyText: 'No markers' }))).toEqual(
      [],
    );
  });
});

describe('collectSequenceTokens', () => {
  it('unions tokens across all emails and tolerates empty/nullish', () => {
    const seq = {
      emails: [
        email({ subject: '{{first_name}}' }),
        email({ bodyText: '<p>{{offer_name}}</p>' }),
      ],
    } as never;
    expect(collectSequenceTokens(seq).sort()).toEqual(
      ['first_name', 'offer_name'].sort(),
    );
    expect(collectSequenceTokens(null)).toEqual([]);
    expect(collectSequenceTokens(undefined)).toEqual([]);
  });
});

describe('sampleTokenValues', () => {
  it('returns the sample base when no overrides given', () => {
    expect(sampleTokenValues()).toEqual(SAMPLE_TOKEN_VALUES);
  });

  it('lets overrides win over the sample base', () => {
    const v = sampleTokenValues({ first_name: 'Sam', custom_key: 'X' });
    expect(v.first_name).toBe('Sam');
    expect(v.custom_key).toBe('X');
    expect(v.brand).toBe(SAMPLE_TOKEN_VALUES.brand);
  });
});

describe('renderEmailPreview', () => {
  it('resolves tokens in subject / preview and reports used tokens', () => {
    const e = email({
      subject: 'Hey {{first_name}}',
      preview: 'From {{brand}}',
      bodyText: '<p>Welcome, {{first_name}}.</p>',
      cta: { label: 'Start', url: '{{cta_url}}' },
    });
    const r = renderEmailPreview(e, sampleTokenValues());
    expect(r.subject).toBe('Hey Jordan');
    expect(r.preview).toBe('From MotherMode');
    expect(r.usedTokens.sort()).toEqual(
      ['brand', 'cta_url', 'first_name'].sort(),
    );
    expect(r.unresolvedTokens).toEqual([]);
    expect(r.html).toContain('Jordan');
    expect(typeof r.html).toBe('string');
  });

  it('flags tokens with no value as unresolved and preserves them by default', () => {
    const e = email({
      subject: 'Hi {{first_name}}',
      bodyText: '<p>{{missing_token}}</p>',
    });
    // Only provide first_name; missing_token has no value.
    const r = renderEmailPreview(e, { first_name: 'Ada' });
    expect(r.subject).toBe('Hi Ada');
    expect(r.unresolvedTokens).toContain('missing_token');
    // Preserved literal marker in the rendered HTML.
    expect(r.html).toContain('{{missing_token}}');
  });

  it('collapses unknown tokens to empty when preserveUnknown is false', () => {
    const e = email({ subject: 'Hi {{missing}}', bodyText: '<p>x</p>' });
    const r = renderEmailPreview(e, {}, { preserveUnknown: false });
    expect(r.subject).toBe('Hi ');
    expect(r.html).not.toContain('{{missing}}');
  });

  it('is pure — identical inputs yield identical output', () => {
    const e = email({ subject: 'Hey {{first_name}}', bodyText: '<p>Hi</p>' });
    const a = renderEmailPreview(e, sampleTokenValues());
    const b = renderEmailPreview(e, sampleTokenValues());
    expect(a).toEqual(b);
  });
});

describe('PREVIEW_WIDTHS', () => {
  it('exposes desktop and mobile widths', () => {
    expect(PREVIEW_WIDTHS.desktop).toBeGreaterThan(PREVIEW_WIDTHS.mobile);
    expect(PREVIEW_WIDTHS.mobile).toBeGreaterThan(0);
  });
});
