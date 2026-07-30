import { describe, expect, it } from 'vitest';

import {
  ARCHETYPE_LADDERS,
  compareDownsellPlacements,
  projectAov,
  suggestAscension,
  suggestPriceLadder,
  UPSELL_ELASTICITY_MULTIPLE,
  validateAscension,
  type AscensionRung,
} from '@/lib/mothermode/sales/ascension';
import {
  buildFunnelMap,
  orphanedEmails,
  toAsciiMap,
  toMermaid,
} from '@/lib/mothermode/sales/funnelMap';

const ladder = (over: Partial<AscensionRung>[] = []): AscensionRung[] => {
  const base: AscensionRung[] = [
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
      escalates: ['bigger', 'stronger'],
      downsell: { name: 'Repair Lite', price: 97 },
    },
  ];
  return base.map((r, i) => ({ ...r, ...(over[i] ?? {}) }));
};

describe('validateAscension', () => {
  it('passes a ladder that escalates on outcome and price', () => {
    expect(validateAscension(ladder())).toEqual([]);
  });

  it('rejects a rung priced at or below the one before it', () => {
    const issues = validateAscension(ladder([{}, { price: 37 }]));
    expect(issues.map((i) => i.code)).toContain('price-not-ascending');
  });

  it('rejects a higher price that does not move on any escalation axis', () => {
    const issues = validateAscension(ladder([{}, { escalates: [] }]));
    const issue = issues.find((i) => i.code === 'no-escalation');
    expect(issue?.stage).toBe('oto1');
    expect(issue?.message).toMatch(/second front end/);
  });

  it('catches a rung that repeats an earlier outcome', () => {
    const issues = validateAscension(ladder([{}, { outcome: 'lose  the WEIGHT' }]));
    expect(issues.map((i) => i.code)).toContain('duplicate-outcome');
  });

  it('requires every rung to state an outcome, since trade-offs are on outcomes', () => {
    const issues = validateAscension(ladder([{}, { outcome: '   ' }]));
    expect(issues.map((i) => i.code)).toContain('missing-outcome');
  });

  it('flags an upsell path beyond ~100x the front end', () => {
    const issues = validateAscension(ladder([{ price: 1 }, { price: 97 }, { price: 197 }]));
    const issue = issues.find((i) => i.code === 'exceeds-elasticity');
    expect(issue?.message).toContain(String(UPSELL_ELASTICITY_MULTIPLE));
  });

  it('allows a large path when the front end supports it', () => {
    const codes = validateAscension(ladder()).map((i) => i.code);
    expect(codes).not.toContain('exceeds-elasticity');
  });

  it('requires a downsell to be cheaper than the offer it recovers', () => {
    const issues = validateAscension(ladder([{}, { downsell: { name: 'X', price: 97 } }]));
    expect(issues.map((i) => i.code)).toContain('downsell-not-cheaper');
  });

  it('returns nothing for an empty ladder rather than throwing', () => {
    expect(validateAscension([])).toEqual([]);
  });
});

describe('projectAov', () => {
  it('scores contribution as price times conversion, not conversion alone', () => {
    const p = projectAov(ladder(), 'none');
    expect(p.lines[0]).toMatchObject({ price: 97, conversionRate: 0.15, contribution: 14.55 });
    expect(p.lines[1]).toMatchObject({ price: 197, conversionRate: 0.14 });
    expect(p.total).toBe(42.13);
  });

  it('counts every yes/no as a decision', () => {
    expect(projectAov(ladder(), 'none').decisions).toBe(2);
    expect(projectAov(ladder(), 'inline').decisions).toBe(4);
  });

  it('ignores downsells entirely when the structure has none', () => {
    const p = projectAov(ladder(), 'none');
    expect(p.lines.every((l) => l.kind === 'upsell')).toBe(true);
  });

  it('shows inline downsells depressing the upsells that follow them', () => {
    const inline = projectAov(ladder(), 'inline');
    const after = projectAov(ladder(), 'after');
    const inlineOto2 = inline.lines.find((l) => l.stage === 'oto2' && l.kind === 'upsell');
    const afterOto2 = after.lines.find((l) => l.stage === 'oto2' && l.kind === 'upsell');
    expect(inlineOto2!.conversionRate).toBeLessThan(afterOto2!.conversionRate);
  });

  it('prefers downsells after the path over downsells inline, on total AOV', () => {
    const all = compareDownsellPlacements(ladder());
    expect(all.after.total).toBeGreaterThan(all.inline.total);
    expect(all.after.total).toBeGreaterThan(all.none.total);
  });
});

describe('suggestAscension', () => {
  it('uses the market outcome timeline, not a generic one', () => {
    const rungs = suggestAscension('dogTraining', 37);
    expect(rungs.map((r) => r.outcome)).toEqual(ARCHETYPE_LADDERS.dogTraining.outcomes);
  });

  it('falls back to the generic timeline for an unknown market', () => {
    const rungs = suggestAscension('generic', 37);
    expect(rungs[0].outcome).toBe(ARCHETYPE_LADDERS.generic.outcomes[0]);
  });

  it('produces a ladder that passes its own validator', () => {
    const rungs = suggestAscension('consulting', 37).map((r) => ({ ...r, name: r.outcome }));
    expect(validateAscension(rungs)).toEqual([]);
  });

  it('keeps suggested prices inside elasticity for a cheap front end', () => {
    const l = suggestPriceLadder(1);
    expect(l.oto1 + l.oto2 + l.oto3).toBeLessThanOrEqual(1 * UPSELL_ELASTICITY_MULTIPLE);
  });

  it('ascends monotonically', () => {
    const l = suggestPriceLadder(97);
    expect(l.oto1).toBeLessThan(l.oto2);
    expect(l.oto2).toBeLessThan(l.oto3);
  });
});

describe('buildFunnelMap', () => {
  const input = {
    frontEndName: 'The Book',
    frontEndPrice: 37,
    rungs: ladder(),
    traffic: { ad: true, advertorial: true, vsl: true },
    emails: [
      { name: 'Receipt', event: 'funnel.purchase', delayHours: 0 },
      { name: 'Upsell nudge', event: 'funnel.upsell1.purchase', delayHours: 24 },
    ],
  };

  it('lays out the whole path from ad to access', () => {
    const map = buildFunnelMap(input);
    const kinds = map.nodes.filter((n) => n.kind !== 'email').map((n) => n.kind);
    expect(kinds).toEqual([
      'ad',
      'advertorial',
      'vsl',
      'sales',
      'checkout',
      'upsell',
      'upsell',
      'success',
      'access',
    ]);
  });

  it('models attention decay so reach falls at every step', () => {
    const map = buildFunnelMap(input);
    const reaches = map.nodes.filter((n) => n.reach !== undefined).map((n) => n.reach!);
    for (let i = 1; i < reaches.length; i += 1) {
      expect(reaches[i]).toBeLessThan(reaches[i - 1]);
    }
  });

  it('omits pre-sale steps the funnel does not run', () => {
    const map = buildFunnelMap({ ...input, traffic: {} });
    expect(map.nodes.some((n) => n.kind === 'ad')).toBe(false);
    expect(map.nodes[0].kind).toBe('sales');
  });

  it('branches inline downsells off a declined upsell', () => {
    const map = buildFunnelMap({ ...input, downsellPlacement: 'inline' });
    const edge = map.edges.find((e) => e.to === 'downsell-1');
    expect(edge).toMatchObject({ from: 'upsell-1', branch: 'no' });
  });

  it('defers downsells to the end when placement is after', () => {
    const map = buildFunnelMap({ ...input, downsellPlacement: 'after' });
    const ids = map.nodes.map((n) => n.id);
    expect(ids.indexOf('downsell-1')).toBeGreaterThan(ids.indexOf('upsell-2'));
  });

  it('hangs each email off the event that fires it', () => {
    const map = buildFunnelMap(input);
    expect(map.edges).toContainEqual({
      from: 'checkout',
      to: 'email-1',
      label: 'funnel.purchase',
    });
  });

  it('reports emails bound to an event no page emits', () => {
    const map = buildFunnelMap({
      ...input,
      emails: [{ name: 'Ghost', event: 'funnel.nonexistent' }],
    });
    expect(orphanedEmails(map).map((n) => n.label)).toEqual(['Ghost']);
  });

  it('adds the order bump as a branch off checkout', () => {
    const map = buildFunnelMap({ ...input, orderBump: { name: 'Audio', price: 27 } });
    expect(map.edges).toContainEqual({ from: 'checkout', to: 'bump', label: 'order bump' });
  });
});

describe('map rendering', () => {
  const map = buildFunnelMap({
    frontEndName: 'The Book',
    frontEndPrice: 37,
    rungs: ladder(),
    emails: [{ name: 'Receipt', event: 'funnel.purchase' }],
  });

  it('emits mermaid with a node per node and an edge per edge', () => {
    const src = toMermaid(map);
    expect(src.startsWith('flowchart TD')).toBe(true);
    expect(src.split('\n')).toHaveLength(1 + map.nodes.length + map.edges.length);
  });

  it('renders prices and decision shapes', () => {
    const src = toMermaid(map);
    expect(src).toContain('checkout[("Checkout $37")]');
    expect(src).toContain('{{"Keep It Off $97"}}');
  });

  it('labels yes/no branches', () => {
    expect(toMermaid(map)).toContain('-->|yes|');
  });

  it('renders an ascii map with emails nested under their page', () => {
    const ascii = toAsciiMap(map);
    expect(ascii).toContain('✉ Receipt');
    expect(ascii).not.toContain('email       Receipt');
  });
});
