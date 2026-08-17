/**
 * The System Map builder (src/lib/mothermode/systemMap.ts) — the graph shape
 * + the layout geometry, so the canvas page stays a dumb renderer.
 */
import { describe, it, expect } from 'vitest';
import {
  buildSystemMap,
  type SystemMapInput,
} from '@/lib/mothermode/systemMap';

const funnel: SystemMapInput['funnels'][number] = {
  id: 'f1',
  slug: 'mindshift',
  name: 'Mindshift',
  status: 'published',
  kind: 'sales',
  metrics: { views: 1200, leads: 300, checkouts: 40, purchases: 12, revenueCents: 32400 },
  pages: [
    { key: 'optin', label: 'Opt-in', metric: '300 leads', href: '/admin/sales-funnels?funnel=f1', liveHref: '/funnel/mindshift' },
    { key: 'checkout', label: 'Checkout', metric: '40 checkouts', href: '/admin/sales-funnels?funnel=f1', liveHref: '/funnel/mindshift/checkout' },
    { key: 'success', label: 'Success', metric: '12 sales', href: '/admin/sales-funnels?funnel=f1', liveHref: '/funnel/mindshift/success' },
  ],
  emails: [
    { event: 'on opt-in', pageKey: 'optin', kitId: 'k1', kitName: 'Welcome seq', kitStatus: 'active', emailCount: 5, href: '/admin/email-marketing?kit=k1' },
  ],
};

const input: SystemMapInput = {
  funnels: [funnel],
  links: [
    { id: 'l1', funnelId: 'f1', optinFunnelId: null, funnelPage: 'optin', pieceId: 'p1', label: 'Bio link', shortCode: 'abc', clicks: 87, source: 'instagram' },
    { id: 'l2', funnelId: 'f1', optinFunnelId: null, funnelPage: null, pieceId: null, label: 'Story link', shortCode: 'def', clicks: 12, source: 'tiktok' },
    { id: 'l3', funnelId: null, optinFunnelId: null, funnelPage: null, pieceId: null, label: 'Unrelated', shortCode: null, clicks: 0, source: '' },
  ],
  content: [
    { id: 'p1', title: 'The hook reel', platform: 'instagram', format: 'reel', kind: 'paid', href: '/admin/planner' },
  ],
};

const map = buildSystemMap(input);
const node = (id: string) => map.nodes.find((n) => n.id === id);
const edge = (from: string, to: string) =>
  map.edges.find((e) => e.from === from && e.to === to);

describe('buildSystemMap', () => {
  it('builds the funnel + its page spine, with the rollup metrics on the funnel', () => {
    const f = node('funnel:f1');
    expect(f).toBeDefined();
    expect(f!.kind).toBe('funnel');
    expect(f!.status).toBe('built'); // published → built
    expect(f!.metrics).toContain('12 sales');
    expect(f!.metrics).toContain('$324');
    // every page is a node, edged off the funnel
    for (const key of ['optin', 'checkout', 'success']) {
      expect(node(`page:f1:${key}`)).toBeDefined();
      expect(edge('funnel:f1', `page:f1:${key}`)).toBeDefined();
    }
  });

  it('lands the email kit on the page its event fires on', () => {
    const email = node('email:f1:on opt-in');
    expect(email).toBeDefined();
    expect(email!.lane).toBe('nurture');
    expect(email!.metrics).toContain('5 emails');
    // 'on opt-in' fires on the optin page — the edge goes there, not the funnel
    expect(edge('page:f1:optin', 'email:f1:on opt-in')).toBeDefined();
  });

  it('routes a link to its funnel_page, and the content carrying it feeds the link', () => {
    // l1 points at the optin page
    expect(edge('link:l1', 'page:f1:optin')).toBeDefined();
    // l2 names no page → falls to the funnel node
    expect(edge('link:l2', 'funnel:f1')).toBeDefined();
    // the content piece carrying l1 feeds it (traffic → links)
    const piece = node('content:p1');
    expect(piece).toBeDefined();
    expect(piece!.lane).toBe('traffic');
    expect(piece!.metrics).toContain('ad'); // kind 'paid' marks the ad
    expect(edge('content:p1', 'link:l1')).toBeDefined();
    // l3 belongs to no funnel — it never enters the graph
    expect(node('link:l3')).toBeUndefined();
  });

  it('lays the four lanes out left→right with no two nodes sharing a position', () => {
    const laneX = Object.fromEntries(map.lanes.map((l) => [l.key, l.x]));
    expect(laneX.traffic).toBeLessThan(laneX.links);
    expect(laneX.links).toBeLessThan(laneX.pages);
    expect(laneX.pages).toBeLessThan(laneX.nurture);
    // every node sits in its own lane's column
    for (const n of map.nodes) expect(n.x).toBe(laneX[n.lane]);
    // no overlap
    const positions = new Set(map.nodes.map((n) => `${n.x},${n.y}`));
    expect(positions.size).toBe(map.nodes.length);
    // the canvas bounds contain every node
    expect(map.width).toBeGreaterThan(laneX.nurture);
    expect(map.height).toBeGreaterThan(Math.max(...map.nodes.map((n) => n.y)));
  });

  it('focus builds only that funnel\'s subgraph', () => {
    const two: SystemMapInput = {
      ...input,
      funnels: [funnel, { ...funnel, id: 'f2', name: 'Other', pages: [], emails: [] }],
    };
    const focused = buildSystemMap(two, { focusFunnelId: 'f2' });
    // only f2's nodes — f1's spine/links/content never build
    expect(focused.nodes.every((n) => n.id.startsWith('funnel:f2') || n.id.includes(':f2:'))).toBe(true);
    expect(focused.nodes.some((n) => n.id === 'funnel:f2')).toBe(true);
    expect(focused.nodes.some((n) => n.id === 'funnel:f1')).toBe(false);
  });

  it('a collapsed funnel renders only its funnel node, and its edges drop', () => {
    const collapsedMap = buildSystemMap(input, { collapsed: new Set(['f1']) });
    // only the funnel node — no pages, emails, links, or content
    expect(collapsedMap.nodes.map((n) => n.id)).toEqual(['funnel:f1']);
    expect(collapsedMap.edges).toEqual([]);
    // the default (no opts) still builds the full graph — the full view is unchanged
    const full = buildSystemMap(input);
    expect(full.nodes.length).toBeGreaterThan(1);
    expect(full.edges.length).toBeGreaterThan(0);
  });

  it('a content node carries its buyer attribution — "this reel made $1,240 · 3 sales"', () => {
    const withAttr = buildSystemMap({
      ...input,
      contentMetrics: { p1: { leads: 40, sales: 3, revenueCents: 124000 } },
    });
    const piece = withAttr.nodes.find((n) => n.id === 'content:p1');
    expect(piece!.metrics).toContain('$1,240');
    expect(piece!.metrics).toContain('3 sales');
    // a piece with no attribution stays quiet (just its kind chip)
    const quiet = buildSystemMap(input).nodes.find((n) => n.id === 'content:p1');
    expect(quiet!.metrics).toEqual(['ad']);
  });

  it('a draft funnel reads draft, and an unpublished funnel gets no live link', () => {
    const draft = buildSystemMap({
      funnels: [{ ...funnel, id: 'f2', status: 'draft', pages: [], emails: [] }],
      links: [],
      content: [],
    });
    const f = draft.nodes.find((n) => n.id === 'funnel:f2');
    expect(f!.status).toBe('draft');
    expect(f!.liveHref).toBeUndefined();
  });
});
