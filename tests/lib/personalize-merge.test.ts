import { describe, expect, it } from 'vitest';

import {
  applyNameTemplate,
  mergeOptinFunnelPayload,
  mergeSalesFunnelPayload,
  validAccentColor,
} from '@/lib/mothermode/personalize/merge';
import {
  blankPayload,
  isEmptyPayload,
  normalizePayload,
} from '@/lib/mothermode/personalize/types';
import type { SalesFunnelRecord } from '@/lib/mothermode/sales/types';
import type { OptinFunnelRecord } from '@/lib/mothermode/optin/types';

/**
 * Merge fixtures are intentionally partial records cast to the full type —
 * the merge layer only reads the content blocks under test.
 */
function salesFunnelFixture(): SalesFunnelRecord {
  return {
    id: 'f1',
    slug: 'demo',
    name: 'Demo funnel',
    optin: {
      eyebrow: 'Free guide',
      headline: 'The calm home system',
      subheadline: 'Base sub',
      benefits: ['Base benefit'],
      ctaText: 'Send it',
      badgeText: '',
      magnetTitle: 'Base magnet',
      magnetDescription: 'Base magnet desc',
      audience: '',
      headlineEmphasis: '',
      headlineSuffix: '',
      coverImageUrl: 'https://cdn.example.com/base.png',
      heroVideoUrl: '',
      emailPlaceholder: 'you@email.com',
      namePlaceholder: 'First name',
      collectName: true,
      privacyNote: 'No spam',
    },
    sales: {
      headline: 'Base sales headline',
      subheadline: 'Base sales sub',
      promise: '',
      problemHeading: 'Base problem',
      problemScene: 'Base scene',
      problemPoints: ['p1'],
      ctaText: 'Buy now',
      ctaSubtext: '',
      finalCtaHeading: '',
      finalCtaBody: '',
      priceCents: 2700,
      heroImageUrl: 'https://cdn.example.com/hero.png',
    },
    checkout: {

      headline: 'Base checkout',
      subheadline: '',
      ctaText: 'Complete order',
      bullets: ['b1'],
      priceCents: 2700,
      stripePriceId: 'price_123',
      productId: 'prod_123',
      productName: 'Kit',
    },
    upsell1: { enabled: true, headline: 'Base oto1', subheadline: '', priceCents: 4700, stripePriceId: 'price_o1' },
    upsell2: { enabled: true, headline: 'Base oto2', subheadline: '' },
    upsell3: { enabled: false, headline: 'Base oto3', subheadline: '' },
    upsell4: { enabled: false, headline: 'Base oto4', subheadline: '' },
    vsl: { headline: 'Base vsl', videoUrl: 'https://v.example.com/x' },
    success: { headline: 'Base success' },
    access: { headline: 'Base access' },
  } as unknown as SalesFunnelRecord;
}

function optinFunnelFixture(): OptinFunnelRecord {
  return {
    id: 'o1',
    slug: 'optin-demo',
    optin: {
      eyebrow: '',
      headline: 'Base optin headline',
      headlineEmphasis: '',
      headlineSuffix: '',
      subheadline: '',
      audience: '',
      benefits: [],
      ctaText: 'Send it',
      badgeText: '',
      magnetTitle: '',
      magnetDescription: '',
      coverImageUrl: '',
      heroVideoUrl: '',
      emailPlaceholder: '',
      namePlaceholder: '',
      collectName: true,
      privacyNote: '',
    },
    oto: { enabled: true, eyebrow: '', headline: 'Base oto', subheadline: '', priceLabel: '$27' },
  } as unknown as OptinFunnelRecord;
}

describe('mergeSalesFunnelPayload', () => {
  it('overrides whitelisted copy fields only', () => {
    const p = blankPayload();
    p.optin.headline = 'A headline just for you';
    p.optin.benefits = ['New b1', 'New b2'];
    p.sales.headline = 'Personal sales headline';
    p.checkout.ctaText = 'Yes, reserve mine';

    const merged = mergeSalesFunnelPayload(salesFunnelFixture(), p);
    expect(merged.optin.headline).toBe('A headline just for you');
    expect(merged.optin.benefits).toEqual(['New b1', 'New b2']);
    expect(merged.sales.headline).toBe('Personal sales headline');
    expect(merged.checkout.ctaText).toBe('Yes, reserve mine');
    // Untouched fields stay.
    expect(merged.optin.subheadline).toBe('Base sub');
    expect(merged.vsl.headline).toBe('Base vsl');
    expect(merged.success.headline).toBe('Base success');
  });

  it('can NEVER touch price, Stripe ids, product ids or media (the money invariant)', () => {
    const hostile = normalizePayload({
      optin: { headline: 'ok', coverImageUrl: 'https://evil.example.com/x.png' },
      sales: { headline: 'ok', priceCents: 1, stripePriceId: 'price_evil', heroImageUrl: 'https://evil.example.com/h.png' },
      checkout: { priceCents: 1, stripePriceId: 'price_evil', productId: 'prod_evil', productName: 'Evil' },
    });
    const merged = mergeSalesFunnelPayload(salesFunnelFixture(), hostile);
    expect(merged.sales.priceCents).toBe(2700);
    expect(merged.sales.heroImageUrl).toBe('https://cdn.example.com/hero.png');

    expect(merged.checkout.priceCents).toBe(2700);
    expect(merged.checkout.stripePriceId).toBe('price_123');
    expect(merged.checkout.productId).toBe('prod_123');
    expect(merged.optin.coverImageUrl).toBe('https://cdn.example.com/base.png');
  });

  it('broadcasts upsell overrides to all four blocks', () => {
    const p = blankPayload();
    p.upsell.headline = 'Your next step, {name}';
    const merged = mergeSalesFunnelPayload(salesFunnelFixture(), p, { firstName: 'Jane' });
    expect(merged.upsell1.headline).toBe('Your next step, Jane');
    expect(merged.upsell2.headline).toBe('Your next step, Jane');
    expect(merged.upsell3.headline).toBe('Your next step, Jane');
    expect(merged.upsell4.headline).toBe('Your next step, Jane');
  });

  it('empty overrides are a strict no-op (input not mutated, output equal)', () => {
    const base = salesFunnelFixture();
    const merged = mergeSalesFunnelPayload(base, blankPayload());
    expect(merged.optin.headline).toBe(base.optin.headline);
    expect(merged.sales.headline).toBe(base.sales.headline);
    expect(base.optin.headline).toBe('The calm home system'); // unmutated
  });

  it('{name} templating resolves and degrades to "there"', () => {
    const p = blankPayload();
    p.optin.headline = 'For {name}: the calm home system';
    const withName = mergeSalesFunnelPayload(salesFunnelFixture(), p, { firstName: 'Jane' });
    expect(withName.optin.headline).toBe('For Jane: the calm home system');
    const noName = mergeSalesFunnelPayload(salesFunnelFixture(), p, {});
    expect(noName.optin.headline).toBe('For there: the calm home system');
  });
});

describe('mergeOptinFunnelPayload', () => {
  it('overlays optin + oto copy', () => {
    const p = blankPayload();
    p.optin.headline = 'Made for you, {name}';
    p.upsell.headline = 'A personal oto';
    const merged = mergeOptinFunnelPayload(optinFunnelFixture(), p, { firstName: 'Sam' });
    expect(merged.optin.headline).toBe('Made for you, Sam');
    expect(merged.oto.headline).toBe('A personal oto');
    expect(merged.oto.priceLabel).toBe('$27'); // money untouched
  });
});

describe('payload hygiene', () => {
  it('normalizePayload coerces garbage to safe blanks', () => {
    const p = normalizePayload('garbage');
    expect(isEmptyPayload(p)).toBe(true);
    const p2 = normalizePayload({ optin: 'nope', sales: { benefits: { not: 'array' } } });
    expect(isEmptyPayload(p2)).toBe(true);
  });

  it('normalizePayload caps absurd strings and arrays', () => {
    const p = normalizePayload({
      optin: { headline: 'x'.repeat(900), benefits: Array(50).fill('b') },
    });
    expect(p.optin.headline.length).toBeLessThanOrEqual(200);
    expect(p.optin.benefits.length).toBeLessThanOrEqual(8);
  });

  it('applyNameTemplate leaves strings without the marker alone', () => {
    expect(applyNameTemplate('Hello', 'Jane')).toBe('Hello');
    expect(applyNameTemplate('Hi {NAME}', 'Jane')).toBe('Hi Jane');
  });

  it('validAccentColor accepts hex only', () => {
    expect(validAccentColor('#532B3C')).toBe('#532B3C');
    expect(validAccentColor('#abc')).toBe('#abc');
    expect(validAccentColor('red')).toBe('');
    expect(validAccentColor('url(javascript:x)')).toBe('');
    expect(validAccentColor('')).toBe('');
  });
});
