/**
 * The System Map analysis engine (src/lib/mothermode/systemMapAnalysis.ts) —
 * the edge conversion rates, the health grading, and the leak detector.
 */
import { describe, it, expect } from 'vitest';
import { analyzeSystemMap, bySource } from '@/lib/mothermode/systemMapAnalysis';
import type { SystemMapInput } from '@/lib/mothermode/systemMap';

const pages = ['optin', 'checkout', 'success'].map((key) => ({
  key,
  label: key,
  metric: '',
  href: '/admin/sales-funnels?funnel=f1',
}));

// views 1000 → leads 300 (optin 0.30, good) → checkouts 40 (0.133, ok) →
// purchases 4 (0.10, bad). The purchase edge is the leak.
const input: SystemMapInput = {
  funnels: [
    {
      id: 'f1',
      slug: 'mindshift',
      name: 'Mindshift',
      status: 'published',
      kind: 'sales',
      metrics: { views: 1000, leads: 300, checkouts: 40, purchases: 4, revenueCents: 0 },
      pages,
      emails: [],
    },
  ],
  links: [],
  content: [],
};

const analysis = analyzeSystemMap(input);
const rate = (pageKey: string) => analysis.edgeRates.find((e) => e.pageKey === pageKey);

describe('analyzeSystemMap', () => {
  it('computes a conversion rate per money-spine edge, riding the builder edge id', () => {
    expect(rate('optin')!.rate).toBeCloseTo(0.3);
    expect(rate('checkout')!.rate).toBeCloseTo(40 / 300);
    expect(rate('success')!.rate).toBeCloseTo(0.1);
    // the rate joins onto the builder's funnel→page edge so the page can color it
    expect(rate('checkout')!.edgeId).toBe('e:funnel:f1->page:f1:checkout');
  });

  it('grades each edge on the performance axis (per-step thresholds)', () => {
    expect(rate('optin')!.health).toBe('good'); // 0.30 ≥ 0.25
    expect(rate('checkout')!.health).toBe('ok'); // 0.133 ≥ 0.08
    expect(rate('success')!.health).toBe('bad'); // 0.10 < 0.15
  });

  it('flags the leak — the worst underperforming edge, linked to its node', () => {
    expect(analysis.leaks).toHaveLength(1);
    const leak = analysis.leaks[0];
    expect(leak.label).toBe('Purchase rate');
    expect(leak.edgeId).toBe('e:funnel:f1->page:f1:success');
    expect(leak.nodeId).toBe('page:f1:success');
    expect(leak.rate).toBeCloseTo(0.1);
  });

  it('never cries wolf — a healthy funnel has no leak, and thin volume is ungraded', () => {
    const healthy = analyzeSystemMap({
      funnels: [
        { ...input.funnels[0], id: 'f2', metrics: { views: 1000, leads: 400, checkouts: 120, purchases: 48, revenueCents: 0 } },
      ],
      links: [],
      content: [],
    });
    expect(healthy.leaks).toEqual([]); // all edges good
    // thin volume: a funnel under MIN_VOLUME on every step grades nothing
    const thin = analyzeSystemMap({
      funnels: [{ ...input.funnels[0], id: 'f3', metrics: { views: 5, leads: 1, checkouts: 0, purchases: 0, revenueCents: 0 } }],
      links: [],
      content: [],
    });
    expect(thin.edgeRates).toEqual([]);
    expect(thin.leaks).toEqual([]);
  });
});

describe('bySource', () => {
  // A funnel fed by two posts: Reel A (100 clicks, 5 sales) + Reel B (200
  // clicks, 2 sales). The content→buyer attribution carries the leads/sales.
  const bySourceInput: SystemMapInput = {
    funnels: [input.funnels[0]],
    links: [
      { id: 'l1', funnelId: 'f1', optinFunnelId: null, funnelPage: null, pieceId: 'p1', label: 'link-a', shortCode: 'a', clicks: 100, source: 'instagram' },
      { id: 'l2', funnelId: 'f1', optinFunnelId: null, funnelPage: null, pieceId: 'p2', label: 'link-b', shortCode: 'b', clicks: 200, source: 'tiktok' },
    ],
    content: [
      { id: 'p1', title: 'Reel A', platform: 'instagram', format: 'reel', kind: 'organic', href: '/admin/content' },
      { id: 'p2', title: 'Reel B', platform: 'tiktok', format: 'reel', kind: 'organic', href: '/admin/content' },
    ],
    contentMetrics: {
      p1: { leads: 20, sales: 5, revenueCents: 50000 },
      p2: { leads: 10, sales: 2, revenueCents: 20000 },
    },
  };
  const sources = bySource(bySourceInput)['f1'];

  it('breaks a funnel\'s traffic down by source, with each source\'s own funnel', () => {
    expect(sources).toHaveLength(2);
    const a = sources.find((s) => s.pieceId === 'p1')!;
    expect(a.label).toBe('Reel A');
    expect(a.platform).toBe('instagram');
    expect(a.clicks).toBe(100);
    expect(a.leads).toBe(20);
    expect(a.sales).toBe(5);
    expect(a.revenueCents).toBe(50000);
    expect(a.conversionRate).toBeCloseTo(5 / 100);
  });

  it('ranks the sources best-first (sales, then clicks)', () => {
    // Reel A (5 sales) outranks Reel B (2 sales) even though B has more clicks.
    expect(sources[0].pieceId).toBe('p1');
    expect(sources[1].pieceId).toBe('p2');
  });

  it('a link with no attributed piece shows its clicks and zero leads/sales', () => {
    const noPiece = bySource({
      ...bySourceInput,
      links: [{ id: 'l3', funnelId: 'f1', optinFunnelId: null, funnelPage: null, pieceId: null, label: 'a bare link', shortCode: 'c', clicks: 50, source: 'x' }],
    });
    const bare = noPiece['f1'][0];
    expect(bare.label).toBe('a bare link');
    expect(bare.platform).toBe('x');
    expect(bare.clicks).toBe(50);
    expect(bare.leads).toBe(0);
    expect(bare.sales).toBe(0);
    expect(bare.conversionRate).toBe(0);
  });
});
