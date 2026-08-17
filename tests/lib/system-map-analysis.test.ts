/**
 * The System Map analysis engine (src/lib/mothermode/systemMapAnalysis.ts) —
 * the edge conversion rates, the health grading, and the leak detector.
 */
import { describe, it, expect } from 'vitest';
import { analyzeSystemMap } from '@/lib/mothermode/systemMapAnalysis';
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
