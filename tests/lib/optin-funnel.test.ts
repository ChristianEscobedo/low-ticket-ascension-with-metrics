import { describe, expect, it } from 'vitest';
import {
  blankOptinOto,
  blankOptinPage,
  blankOptinThankYou,
  normalizeOptinOto,
  normalizeOptinPage,
  normalizeOptinThankYou,
  optinConversionRate,
  otoTakeRate,
  rowToOptinFunnel,
  rowToOptinLead,
  slugifyOptinName,
  toOptinFunnelStatus,
  type OptinFunnelRow,
  type OptinLeadRow,
} from '@/lib/mothermode/optin/types';

import {
  defaultMotherModeOptin,
  defaultMotherModeOto,
  defaultMotherModeThankYou,
} from '@/lib/mothermode/optin/defaults';
import {
  blankOptinAiIntake,
  normalizeOptinAiIntake,
} from '@/lib/mothermode/optin/aiIntake';


describe('optin funnel types', () => {
  it('slugifyOptinName produces url-safe slugs', () => {
    expect(slugifyOptinName('Brain Dump Starter')).toBe('brain-dump-starter');
    expect(slugifyOptinName("Loni's Free Guide!!!")).toBe('lonis-free-guide');
    expect(slugifyOptinName('  --Hello--  ')).toBe('hello');
  });

  it('toOptinFunnelStatus coerces unknowns to draft', () => {
    expect(toOptinFunnelStatus('published')).toBe('published');
    expect(toOptinFunnelStatus('nope')).toBe('draft');
    expect(toOptinFunnelStatus(null)).toBe('draft');
  });

  it('normalizeOptinPage fills defaults and filters benefits', () => {
    const n = normalizeOptinPage({
      headline: 'Hi',
      benefits: ['a', '', 3, 'b'],
      collectName: false,
    });
    expect(n.headline).toBe('Hi');
    expect(n.benefits).toEqual(['a', 'b']);
    expect(n.collectName).toBe(false);
    expect(n.ctaText).toBe('Send it to me');
  });

  it('normalizeOptinOto and thankyou tolerate empty input', () => {
    const o = normalizeOptinOto(null);
    expect(o.enabled).toBe(true);
    expect(o.ctaYes).toContain('Yes');
    const t = normalizeOptinThankYou(undefined);
    expect(t.headline).toBe('You are in.');
  });

  it('rowToOptinFunnel maps snake_case + JSONB', () => {
    const row: OptinFunnelRow = {
      id: '1',
      slug: 'test',
      name: 'Test',
      status: 'published',
      offer_slug: 'brain-dump',
      lead_gen_slug: null,
      deliverable_slug: null,
      deliverable_key: null,
      email_kit_id: null,
      optin: { headline: 'H', benefits: ['x'] },
      oto: { enabled: false, headline: 'O' },
      thankyou: { headline: 'T' },
      footer: { enabled: true, brandLine: 'MM', disclaimer: 'd', links: [], copyright: 'c' },
      view_count: 3,
      oto_yes_count: 0,
      oto_no_count: 0,

      conversion_count: 1,
      created_at: '2026-01-01',
      updated_at: '2026-01-02',
      updated_by: 'a@b.com',
    };
    const f = rowToOptinFunnel(row);
    expect(f.status).toBe('published');
    expect(f.offerSlug).toBe('brain-dump');
    expect(f.optin.headline).toBe('H');
    expect(f.optin.benefits).toEqual(['x']);
    expect(f.oto.enabled).toBe(false);
    expect(f.thankyou.headline).toBe('T');
    expect(f.viewCount).toBe(3);
  });

  it('rowToOptinLead maps extras', () => {
    const row: OptinLeadRow = {
      id: 'l1',
      funnel_id: 'f1',
      email: 'a@b.com',
      first_name: 'Ada',
      status: 'captured',
      oto_accepted: false,
      utm_source: 'ig',
      utm_medium: null,
      utm_campaign: null,
      referrer: null,
      user_agent: null,
      ip_hash: null,
      metadata: {},
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    };
    const lead = rowToOptinLead(row, { funnelName: 'Starter', funnelSlug: 'starter' });
    expect(lead.email).toBe('a@b.com');
    expect(lead.funnelName).toBe('Starter');
    expect(lead.utmSource).toBe('ig');
  });

  it('blanks and MotherMode defaults are non-empty where expected', () => {
    expect(blankOptinPage().ctaText).toBeTruthy();
    expect(blankOptinOto().enabled).toBe(true);
    expect(blankOptinThankYou().headline).toBeTruthy();
    expect(defaultMotherModeOptin().headline.length).toBeGreaterThan(5);
    expect(defaultMotherModeOto().bullets.length).toBeGreaterThan(0);
    expect(defaultMotherModeThankYou().ctaHref).toContain('/mothermode/');
  });

  it('AI intake normalizer is defensive', () => {
    expect(blankOptinAiIntake().niche).toBe('');
    const n = normalizeOptinAiIntake({ niche: 'Mental load', offerPrice: 27 });
    expect(n.niche).toBe('Mental load');
    expect(n.offerPrice).toBe(''); // non-string coerced away
  });

  it('conversion rate helpers are zero-safe', () => {
    expect(optinConversionRate(0, 5)).toBe(0);
    expect(optinConversionRate(100, 25)).toBe(0.25);
    expect(otoTakeRate(0, 0)).toBe(0);
    expect(otoTakeRate(3, 1)).toBe(0.75);
  });
});



