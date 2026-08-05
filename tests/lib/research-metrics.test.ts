import { describe, it, expect } from 'vitest';

import {
  aggregateMetrics,
  metricsSummaryToText,
} from '@/lib/mothermode/research/metrics';

/**
 * The agent quotes these numbers back at the owner, so the coverage targets
 * the ways the aggregation could lie: paid/organic misclassification, campaign
 * joins that leak across pieces, and failed reads presenting as confident
 * zeros.
 */

const links = [
  {
    utm_source: 'instagram',
    utm_medium: 'social',
    utm_campaign: 'reset_launch',
    utm_content: 'piece_a',
    click_count: 100,
  },
  {
    utm_source: 'tiktok',
    utm_medium: 'paid_social',
    utm_campaign: 'reset_launch',
    utm_content: 'piece_a',
    click_count: 40,
  },
  {
    utm_source: 'pinterest',
    utm_medium: 'social',
    utm_campaign: 'evergreen',
    utm_content: 'piece_b',
    click_count: 60,
  },
  // Untagged link: clicks count, leads never join.
  {
    utm_source: 'instagram',
    utm_medium: 'social',
    utm_campaign: 'reset_launch',
    utm_content: null,
    click_count: 10,
  },
];

const salesLeads = [
  { utm_content: 'piece_a', utm_medium: 'social', purchased: true, purchase_amount_cents: 1700 },
  { utm_content: 'piece_a', utm_medium: 'paid_social', purchased: false, purchase_amount_cents: null },
  { utm_content: 'piece_b', utm_medium: 'social', purchased: true, purchase_amount_cents: 700 },
];

const optinLeads = [
  { utm_content: 'piece_a', utm_medium: 'social' },
  { utm_content: 'piece_b', utm_medium: 'paid_social' },
];

describe('aggregateMetrics', () => {
  it('sums clicks over links and joins leads to pieces', () => {
    const s = aggregateMetrics({ links, salesLeads, optinLeads });
    expect(s.totals.clicks).toBe(210);
    expect(s.totals.links).toBe(4);
    expect(s.totals.optins).toBe(5);
    expect(s.totals.purchases).toBe(2);
    expect(s.totals.revenueCents).toBe(2400);
  });

  it('attributes per piece with paid/organic split', () => {
    const s = aggregateMetrics({ links, salesLeads, optinLeads });
    const a = s.topPieces.find((p) => p.key === 'piece_a')!;
    expect(a.clicks).toBe(140);
    expect(a.optins).toBe(3);
    expect(a.purchases).toBe(1);
    expect(a.revenueCents).toBe(1700);
    expect(a.paidOptins).toBe(1);
    expect(a.organicOptins).toBe(2);
    expect(a.campaigns).toContain('reset_launch');
  });

  it('sorts top pieces by clicks and joins campaigns through the link table', () => {
    const s = aggregateMetrics({ links, salesLeads, optinLeads });
    expect(s.topPieces[0].key).toBe('piece_a');
    const launch = s.topCampaigns.find((c) => c.campaign === 'reset_launch')!;
    expect(launch.clicks).toBe(150); // 100 + 40 + 10 untagged
    // piece_a's 3 opt-ins join reset_launch through utm_content -> campaign.
    expect(launch.optins).toBe(3);
    expect(launch.revenueCents).toBe(1700);
  });

  it('drops leads with no utm_content instead of inventing a bucket', () => {
    const s = aggregateMetrics({
      links,
      salesLeads: [
        { utm_content: null, utm_medium: 'social', purchased: true, purchase_amount_cents: 9900 },
      ],
      optinLeads: [],
    });
    expect(s.totals.purchases).toBe(0);
    expect(s.totals.revenueCents).toBe(0);
  });
});

describe('metricsSummaryToText', () => {
  it('renders totals and piece lines without Infinity/NaN', () => {
    const s = aggregateMetrics({ links, salesLeads, optinLeads });
    const text = metricsSummaryToText(s);
    expect(text).toContain('TOTALS: 4 tracked links, 210 clicks');
    expect(text).not.toContain('Infinity');
    expect(text).not.toContain('NaN');
    expect(text).toContain('piece_a: 140 clicks, 3 opt-ins');
  });

  it('filters to a campaign substring', () => {
    const s = aggregateMetrics({ links, salesLeads, optinLeads });
    const text = metricsSummaryToText(s, 'evergreen');
    expect(text).toContain('piece_b');
    expect(text).not.toContain('piece_a:');
  });

  it('says so when nothing matches', () => {
    const s = aggregateMetrics({ links, salesLeads, optinLeads });
    expect(metricsSummaryToText(s, 'zzz')).toContain('No pieces or campaigns matched');
  });
});
