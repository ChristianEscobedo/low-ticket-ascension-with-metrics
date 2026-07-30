import { describe, expect, it } from 'vitest';

import {
  blankSalesAiIntake,
  type OfferStackBump,
  type OfferStackFrontEnd,
  type OfferStackUpsell,
  type SalesAiIntake,
} from '@/lib/mothermode/sales/aiIntake';
import {
  auditIntakeFunnel,
  buildFunnelMapFromIntake,
  funnelMapInputFromIntake,
  inferEscalationAxes,
  intakeToAscension,
  intakeToAscensionRungs,
  parseIntakePrice,
} from '@/lib/mothermode/sales/intakeAscension';

const makeIntake = (
  frontEnd: Partial<OfferStackFrontEnd> = {},
  upsells: Partial<OfferStackUpsell>[] = [],
  bumps: OfferStackBump[] = [],
): SalesAiIntake => {
  const base = blankSalesAiIntake();
  return {
    ...base,
    offerStack: {
      ...base.offerStack,
      frontEnd: {
        ...base.offerStack.frontEnd,
        name: 'Weight Off Book',
        price: '$37',
        promise: 'Lose the weight',
        ...frontEnd,
      },
      bumps,
      // Everything off unless a test turns it on.
      upsells: base.offerStack.upsells.map((u, i) => ({
        ...u,
        enabled: false,
        billingType: 'one_time',
        ...(upsells[i] ?? {}),
      })),
    },
  };
};

/** A stack that should survive the validator untouched. */
const ascendingIntake = (): SalesAiIntake =>
  makeIntake({}, [
    {
      enabled: true,
      name: 'Keep It Off',
      price: '$97',
      promise: 'Keep the weight off permanently',
    },
    {
      enabled: true,
      name: 'Repair',
      price: '$197',
      promise: 'Fix the damage faster with an accelerated protocol',
    },
    {
      enabled: true,
      name: 'Concierge',
      price: '$497',
      promise: 'Hands off meal planning, done for you every week',
    },
  ]);

describe('parseIntakePrice', () => {
  it('reads the number out of a decorated price label', () => {
    expect(parseIntakePrice('$97')).toBe(97);
    expect(parseIntakePrice('1,997')).toBe(1997);
    expect(parseIntakePrice('$1,997.50')).toBe(1997.5);
  });

  it('takes the first payment of a recurring price rather than guessing lifetime value', () => {
    expect(parseIntakePrice('$29/mo')).toBe(29);
  });

  it('returns 0 for anything with no number in it', () => {
    expect(parseIntakePrice('free')).toBe(0);
    expect(parseIntakePrice('')).toBe(0);
    expect(parseIntakePrice(undefined)).toBe(0);
  });
});

describe('inferEscalationAxes', () => {
  it('reads axes out of the promise wording', () => {
    expect(inferEscalationAxes('Keep it off permanently')).toEqual(['stronger']);
    expect(inferEscalationAxes('We build it for you, hands off')).toEqual(['doneForYou']);
    expect(inferEscalationAxes('Scale it faster')).toEqual(['bigger', 'faster']);
  });

  it('claims nothing when the promise names no axis', () => {
    expect(inferEscalationAxes('A really nice programme')).toEqual([]);
    expect(inferEscalationAxes('')).toEqual([]);
  });
});

describe('intakeToAscension', () => {
  it('maps the front end and each enabled upsell onto the outcome timeline in slot order', () => {
    const { rungs } = intakeToAscension(ascendingIntake());
    expect(rungs.map((r) => r.stage)).toEqual(['frontEnd', 'oto1', 'oto2', 'oto3']);
    expect(rungs.map((r) => r.price)).toEqual([37, 97, 197, 497]);
    expect(rungs[1].name).toBe('Keep It Off');
    expect(rungs[1].outcome).toBe('Keep the weight off permanently');
  });

  it('skips upsells that are switched off or unnamed', () => {
    const rungs = intakeToAscensionRungs(
      makeIntake({}, [
        { enabled: false, name: 'Disabled', price: '$97', promise: 'Keep it off' },
        { enabled: true, name: '', price: '$197', promise: 'Unnamed' },
        { enabled: true, name: 'Real', price: '$297', promise: 'Scale it' },
      ]),
    );
    expect(rungs.map((r) => r.stage)).toEqual(['frontEnd', 'oto1']);
    expect(rungs[1].name).toBe('Real');
  });

  it('reports a fourth upsell as having no rung instead of quietly dropping it', () => {
    const intake = ascendingIntake();
    intake.offerStack.upsells[3] = {
      ...intake.offerStack.upsells[3],
      enabled: true,
      name: 'Fourth Thing',
      price: '$997',
      promise: 'Scale it further',
    };
    const { rungs, notes } = intakeToAscension(intake);
    expect(rungs).toHaveLength(4);
    const note = notes.find((n) => n.code === 'upsell-beyond-oto3');
    expect(note?.detail).toContain('Fourth Thing');
    expect(note?.detail).toMatch(/ends at OTO 3/);
  });

  it('marks inferred escalation as inferred rather than stated', () => {
    const { rungs, notes } = intakeToAscension(ascendingIntake());
    expect(rungs[1].escalates).toEqual(['stronger']);
    expect(rungs[3].escalates).toEqual(['doneForYou']);
    const inferred = notes.filter((n) => n.code === 'escalation-inferred');
    expect(inferred).toHaveLength(3);
    expect(inferred[0].detail).toMatch(/inferred from the promise wording, not stated/);
  });

  it('leaves escalation blank when the promise names no axis, so the validator can say so', () => {
    const intake = makeIntake({}, [
      { enabled: true, name: 'Vague', price: '$97', promise: 'A really nice programme' },
    ]);
    const { rungs, notes } = intakeToAscension(intake);
    expect(rungs[1].escalates).toEqual([]);
    expect(notes.map((n) => n.code)).toContain('escalation-unstated');
  });

  it('notes a missing price and a missing promise instead of inventing either', () => {
    const intake = makeIntake({ price: '', promise: '' }, [
      { enabled: true, name: 'No Price', price: '', promise: 'Keep it off' },
    ]);
    const { rungs, notes } = intakeToAscension(intake);
    expect(rungs[0].price).toBe(0);
    expect(rungs[0].outcome).toBe('');
    const priceNotes = notes.filter((n) => n.code === 'price-missing');
    expect(priceNotes.map((n) => n.stage)).toEqual(['frontEnd', 'oto1']);
    expect(notes.find((n) => n.code === 'outcome-missing')?.stage).toBe('frontEnd');
  });

  it('says out loud that a subscription price is only the first payment', () => {
    const intake = makeIntake({}, [
      {
        enabled: true,
        name: 'Membership',
        price: '$29/mo',
        promise: 'Keep it off permanently',
        billingType: 'subscription',
      },
    ]);
    const { rungs, notes } = intakeToAscension(intake);
    expect(rungs[1].price).toBe(29);
    expect(notes.find((n) => n.code === 'recurring-price-as-first-payment')?.stage).toBe(
      'oto1',
    );
  });

  it('records that the intake cannot express a downsell at all', () => {
    const { rungs, notes } = intakeToAscension(ascendingIntake());
    expect(rungs.every((r) => r.downsell === undefined)).toBe(true);
    expect(notes.map((n) => n.code)).toContain('downsells-not-expressible');
  });
});

describe('auditIntakeFunnel', () => {
  it('passes a stack that actually ascends on outcome, price and axis', () => {
    expect(auditIntakeFunnel(ascendingIntake()).issues).toEqual([]);
  });

  it('surfaces the validator on a real intake: flat pricing is caught', () => {
    const intake = makeIntake({}, [
      { enabled: true, name: 'One', price: '$97', promise: 'Keep it off permanently' },
      { enabled: true, name: 'Two', price: '$97', promise: 'Scale it faster' },
    ]);
    const codes = auditIntakeFunnel(intake).issues.map((i) => i.code);
    expect(codes).toContain('price-not-ascending');
  });

  it('catches an upsell that repeats the front-end outcome at a higher price', () => {
    const intake = makeIntake({ promise: 'Lose the weight' }, [
      { enabled: true, name: 'Again', price: '$97', promise: 'lose  the WEIGHT' },
    ]);
    const codes = auditIntakeFunnel(intake).issues.map((i) => i.code);
    expect(codes).toContain('duplicate-outcome');
    expect(codes).toContain('no-escalation');
  });

  it('projects AOV per structure and keeps the simplest one when nothing separates them', () => {
    const audit = auditIntakeFunnel(ascendingIntake());
    expect(audit.placements.none.total).toBe(106.74);
    // No downsells exist in the intake, so moving them cannot add anything.
    expect(audit.placements.after.total).toBe(audit.placements.none.total);
    expect(audit.placements.inline.total).toBeLessThan(audit.placements.none.total);
    expect(audit.bestPlacement).toBe('none');
  });

  it('draws the map for the same ladder it validated', () => {
    const audit = auditIntakeFunnel(ascendingIntake());
    const upsellLabels = audit.map.nodes
      .filter((n) => n.kind === 'upsell')
      .map((n) => n.label);
    expect(upsellLabels).toEqual(['Keep It Off', 'Repair', 'Concierge']);
    expect(audit.map.nodes.find((n) => n.kind === 'checkout')?.price).toBe(37);
  });
});

describe('funnelMapInputFromIntake', () => {
  it('carries the first order bump onto the checkout and reports the rest', () => {
    const bumps: OfferStackBump[] = [
      { id: 'b1', title: 'Meal Plan Pack', price: '$27', description: '', imageUrl: '' },
      { id: 'b2', title: 'Shopping Lists', price: '$17', description: '', imageUrl: '' },
    ];
    const { input, notes } = funnelMapInputFromIntake(makeIntake({}, [], bumps));
    expect(input.orderBump).toEqual({ name: 'Meal Plan Pack', price: 27 });
    expect(notes.find((n) => n.code === 'extra-order-bumps')?.detail).toContain(
      'Meal Plan Pack',
    );
  });

  it('models the traffic the caller declares, with attention decay applied', () => {
    const map = buildFunnelMapFromIntake(ascendingIntake(), {
      traffic: { ad: true, optin: true },
      emails: [{ name: 'Receipt', event: 'funnel.purchase' }],
    });
    expect(map.nodes.slice(0, 3).map((n) => n.id)).toEqual(['ad', 'optin', 'sales']);
    expect(map.nodes.find((n) => n.id === 'optin')?.reach).toBeCloseTo(0.35, 5);
    expect(map.edges).toContainEqual({
      from: 'checkout',
      to: 'email-1',
      label: 'funnel.purchase',
    });
  });
});
