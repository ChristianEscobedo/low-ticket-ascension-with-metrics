import { describe, expect, it } from 'vitest';

import { buildFunnelMap, type FunnelMap } from '@/lib/mothermode/sales/funnelMap';
import {
  FUNNEL_NODE_HEIGHT,
  FUNNEL_NODE_WIDTH,
  funnelNodeStage,
  layoutFunnelMap,
} from '@/lib/mothermode/sales/funnelMapLayout';
import type { AscensionRung } from '@/lib/mothermode/sales/ascension';

const rungs: AscensionRung[] = [
  { stage: 'frontEnd', name: 'Book', outcome: 'Lose the weight', price: 37, escalates: [] },
  {
    stage: 'oto1',
    name: 'Keep It Off',
    outcome: 'Keep the weight off',
    price: 97,
    escalates: ['faster'],
    downsell: { name: 'Lite', price: 47 },
  },
  {
    stage: 'oto2',
    name: 'Repair',
    outcome: 'Fix what the loss caused',
    price: 197,
    escalates: ['bigger'],
    downsell: { name: 'Repair Lite', price: 97 },
  },
];

const fullMap = (): FunnelMap =>
  buildFunnelMap({
    frontEndName: 'Book',
    frontEndPrice: 37,
    rungs,
    downsellPlacement: 'inline',
    traffic: { ad: true, optin: true },
    orderBump: { name: 'Fast Start', price: 27 },
    emails: [
      { name: 'Receipt', event: 'funnel.purchase' },
      { name: 'Onboarding', event: 'funnel.purchase', delayHours: 24 },
      { name: 'Webinar reminder', event: 'nothing.fires.this' },
    ],
  });

const byId = (layout: ReturnType<typeof layoutFunnelMap>, id: string) => {
  const node = layout.nodes.find((n) => n.id === id);
  if (!node) throw new Error(`no node ${id} in layout`);
  return node;
};

/**
 * Emails on two different triggers, where one trigger carries enough of them
 * to reach down into the next trigger's row.
 */
const crowdedEmailMap = (emails: { name: string; event: string }[]): FunnelMap =>
  buildFunnelMap({
    frontEndName: 'Book',
    frontEndPrice: 37,
    rungs,
    downsellPlacement: 'inline',
    traffic: { ad: true, optin: true },
    emails,
  });

const CROWDED_EMAILS = [
  { name: 'Lead 1', event: 'optin.captured' },
  { name: 'Lead 2', event: 'optin.captured' },
  { name: 'Lead 3', event: 'optin.captured' },
  { name: 'Lead 4', event: 'optin.captured' },
  { name: 'Receipt', event: 'funnel.purchase' },
];

describe('layoutFunnelMap email stacking', () => {
  it('never overlaps two emails, even across neighbouring triggers', () => {
    const layout = layoutFunnelMap(crowdedEmailMap(CROWDED_EMAILS));
    const emails = layout.nodes.filter((n) => n.kind === 'email');
    expect(emails).toHaveLength(CROWDED_EMAILS.length);

    // Guard against a vacuous pass: if these events stopped resolving to two
    // distinct anchors, the crowding this test exists for would not happen.
    const anchorRows = new Set(
      layout.edges.filter((e) => emails.some((n) => n.id === e.to)).map((e) => e.from),
    );
    expect(anchorRows.size).toBeGreaterThan(1);

    const ys = emails.map((n) => n.y).sort((a, b) => a - b);
    ys.slice(1).forEach((y, i) => {
      expect(y - ys[i]).toBeGreaterThanOrEqual(FUNNEL_NODE_HEIGHT);
    });
  });

  it('does not let input order drag an email away from its trigger', () => {
    // Same emails, listed with the later trigger first. Where a *group* lands is
    // decided by its anchor row, so the shape of the drawing must not change.
    //
    // Order within one trigger is a different matter: that is the send
    // sequence, and it is the operator's to set, so it is expected to follow
    // the input. This asserts group placement only.
    const forward = layoutFunnelMap(crowdedEmailMap(CROWDED_EMAILS));
    const reversed = layoutFunnelMap(crowdedEmailMap([...CROWDED_EMAILS].reverse()));

    const slots = (l: typeof forward) =>
      l.nodes
        .filter((n) => n.kind === 'email')
        .map((n) => n.y)
        .sort((a, b) => a - b);

    expect(slots(reversed)).toEqual(slots(forward));

    // 'Receipt' is the only email on its trigger, so unlike the four that share
    // one, it is not subject to send-order shuffling and must not move at all.
    const receiptY = (l: typeof forward) =>
      l.nodes.find((n) => n.kind === 'email' && n.label?.includes('Receipt'))?.y;

    expect(receiptY(reversed)).toBeDefined();
    expect(receiptY(reversed)).toBe(receiptY(forward));
  });

});

describe('layoutFunnelMap', () => {
  it('runs the spine down one column in ladder order', () => {

    const layout = layoutFunnelMap(fullMap());
    const spine = ['ad', 'optin', 'sales', 'checkout', 'upsell-1', 'upsell-2', 'success', 'access'];

    const rows = spine.map((id) => byId(layout, id).row);
    expect(rows).toEqual([...rows].sort((a, b) => a - b));
    expect(new Set(rows).size).toBe(rows.length);

    // One column means one x, so the drawing reads as a single path.
    const columns = new Set(spine.map((id) => byId(layout, id).column));
    expect(columns).toEqual(new Set([0]));
  });

  it('offsets a downsell into a different column from the upsell it rescues', () => {
    const layout = layoutFunnelMap(fullMap());
    const upsell = byId(layout, 'upsell-1');
    const downsell = byId(layout, 'downsell-1');

    expect(downsell.column).not.toBe(upsell.column);
    expect(downsell.x).toBeGreaterThan(upsell.x);
    // It is a step the buyer takes after the upsell, so it sits below it too.
    expect(downsell.row).toBeGreaterThan(upsell.row);
  });

  it('hangs the order bump beside checkout rather than after it', () => {
    const layout = layoutFunnelMap(fullMap());
    const checkout = byId(layout, 'checkout');
    const bump = byId(layout, 'bump');

    expect(bump.row).toBe(checkout.row);
    expect(bump.column).not.toBe(checkout.column);
  });

  it('never puts two nodes in the same place', () => {
    const layout = layoutFunnelMap(fullMap());
    const seen = layout.nodes.map((n) => `${n.x}:${n.y}`);
    expect(new Set(seen).size).toBe(layout.nodes.length);
  });

  it('stacks emails that fire on the same event without overlapping', () => {
    const layout = layoutFunnelMap(fullMap());
    const first = byId(layout, 'email-1');
    const second = byId(layout, 'email-2');

    expect(first.column).toBe(second.column);
    expect(Math.abs(second.y - first.y)).toBeGreaterThanOrEqual(FUNNEL_NODE_HEIGHT);
  });

  it('bounds every node inside the reported width and height', () => {
    const layout = layoutFunnelMap(fullMap());
    layout.nodes.forEach((n) => {
      expect(n.x + FUNNEL_NODE_WIDTH).toBeLessThanOrEqual(layout.width);
      expect(n.y + FUNNEL_NODE_HEIGHT).toBeLessThanOrEqual(layout.height);
    });
    // And the bounds are tight — some node reaches each edge.
    expect(layout.nodes.some((n) => n.x + FUNNEL_NODE_WIDTH === layout.width)).toBe(true);
    expect(layout.nodes.some((n) => n.y + FUNNEL_NODE_HEIGHT === layout.height)).toBe(true);
  });

  it('routes every edge to a drawable path with a unique id', () => {
    const layout = layoutFunnelMap(fullMap());
    const map = fullMap();
    const drawableEdges = map.edges.filter(
      (e) =>
        map.nodes.some((n) => n.id === e.from) && map.nodes.some((n) => n.id === e.to),
    );

    expect(layout.edges).toHaveLength(drawableEdges.length);
    expect(new Set(layout.edges.map((e) => e.id)).size).toBe(layout.edges.length);
    layout.edges.forEach((e) => {
      expect(e.d).toMatch(/^M -?[\d.]+ -?[\d.]+ [LC]/);
      expect(Number.isFinite(e.labelX)).toBe(true);
      expect(Number.isFinite(e.labelY)).toBe(true);
    });
  });

  it('draws spine edges straight and branch edges curved', () => {
    const layout = layoutFunnelMap(fullMap());
    const spineEdge = layout.edges.find((e) => e.from === 'sales' && e.to === 'checkout');
    const branchEdge = layout.edges.find((e) => e.from === 'upsell-1' && e.to === 'downsell-1');
    const bumpEdge = layout.edges.find((e) => e.from === 'checkout' && e.to === 'bump');

    expect(spineEdge?.d).toContain(' L ');
    expect(branchEdge?.d).toContain(' C ');
    // The bump is level with checkout, so its edge is a straight hop sideways.
    expect(bumpEdge?.d).toContain(' L ');
  });

  it('survives an empty map', () => {
    const layout = layoutFunnelMap({ nodes: [], edges: [] });
    expect(layout).toEqual({ nodes: [], edges: [], width: 0, height: 0 });
  });
});

describe('funnelNodeStage', () => {
  it('attributes the sales page and checkout to the front end', () => {
    const layout = layoutFunnelMap(fullMap());
    expect(funnelNodeStage(byId(layout, 'sales'))).toBe('frontEnd');
    expect(funnelNodeStage(byId(layout, 'checkout'))).toBe('frontEnd');
  });

  it('attributes each upsell to its OTO rung', () => {
    const layout = layoutFunnelMap(fullMap());
    expect(funnelNodeStage(byId(layout, 'upsell-1'))).toBe('oto1');
    expect(funnelNodeStage(byId(layout, 'upsell-2'))).toBe('oto2');
  });

  it('claims no stage for nodes that are not a rung', () => {
    const layout = layoutFunnelMap(fullMap());
    expect(funnelNodeStage(byId(layout, 'optin'))).toBeUndefined();
    expect(funnelNodeStage(byId(layout, 'bump'))).toBeUndefined();
    expect(funnelNodeStage(byId(layout, 'email-1'))).toBeUndefined();
    // Downsell numbering does not track rung order under 'after' placement, so
    // it is left unattributed rather than guessed.
    expect(funnelNodeStage(byId(layout, 'downsell-1'))).toBeUndefined();
  });
});
