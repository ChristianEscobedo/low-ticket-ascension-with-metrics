import { describe, expect, it } from 'vitest';
import {
  blankOfferStack,
  blankSalesAiIntake,
  formatOfferStackForPrompt,
  normalizeOfferStack,
  normalizeSalesAiIntake,
  syncIntakeStack,
  type OfferStack,
  type SalesAiIntake,
} from '@/lib/mothermode/sales/aiIntake';

describe('offer stack defaults', () => {
  it('blankOfferStack has 4 upsell slots', () => {
    const s = blankOfferStack();
    expect(s.upsells).toHaveLength(4);
    expect(s.upsells.map((u) => u.slot)).toEqual([1, 2, 3, 4]);
    expect(s.bonuses).toEqual([]);
    expect(s.bumps).toEqual([]);
    expect(s.frontEnd.name).toBe('');
  });

  it('blankSalesAiIntake includes offerStack', () => {
    const i = blankSalesAiIntake();
    expect(i.offerStack).toBeDefined();
    expect(i.offerStack.upsells).toHaveLength(4);
  });
});

describe('normalizeOfferStack', () => {
  it('fills missing upsell slots', () => {
    const s = normalizeOfferStack({
      frontEnd: { name: 'X', price: '$27', originalPrice: '', promise: '', deliverables: ['a'] },
      bonuses: [{ title: 'B', description: 'd', value: '$10' }],
      bumps: [{ id: 'b1', title: 'Bump', price: '$7', description: '', imageUrl: '' }],
      upsells: [{ slot: 1, enabled: true, name: 'U1', price: '$97', promise: 'p', billingType: 'subscription' }],
    });
    expect(s.upsells).toHaveLength(4);
    expect(s.upsells[0].name).toBe('U1');
    expect(s.upsells[0].enabled).toBe(true);
    expect(s.upsells[1].enabled).toBe(false);
    expect(s.bonuses).toHaveLength(1);
    expect(s.bumps[0].id).toBe('b1');
  });

  it('handles null/undefined', () => {
    const s = normalizeOfferStack(null);
    expect(s.upsells).toHaveLength(4);
    expect(s.frontEnd.deliverables).toEqual([]);
  });
});

describe('syncIntakeStack', () => {
  it('mirrors flat offer fields into empty stack front-end', () => {
    const intake: SalesAiIntake = {
      ...blankSalesAiIntake(),
      offerName: 'Brain Dump System',
      offerPrice: '$27',
      upsell1Name: 'Clearing Room',
      upsell1Price: '$97/mo',
      upsell2Name: 'Done With You',
      upsell2Price: '$497',
    };
    const synced = syncIntakeStack(intake);
    expect(synced.offerStack.frontEnd.name).toBe('Brain Dump System');
    expect(synced.offerStack.frontEnd.price).toBe('$27');
    expect(synced.offerStack.upsells[0].name).toBe('Clearing Room');
    expect(synced.offerStack.upsells[0].enabled).toBe(true);
    expect(synced.offerStack.upsells[0].price).toBe('$97/mo');
    expect(synced.offerStack.upsells[1].name).toBe('Done With You');
    expect(synced.offerStack.upsells[2].enabled).toBe(false);
  });

  it('mirrors stack front-end back to flat fields when flat empty', () => {
    const intake = blankSalesAiIntake();
    intake.offerStack = {
      ...blankOfferStack(),
      frontEnd: {
        name: 'Stack Offer',
        price: '$37',
        originalPrice: '$97',
        promise: 'Clear load',
        deliverables: ['A', 'B'],
      },
      upsells: blankOfferStack().upsells.map((u) =>
        u.slot === 1
          ? { ...u, enabled: true, name: 'Room', price: '$97', promise: 'x', billingType: 'subscription' }
          : u,
      ),
    };
    const synced = syncIntakeStack(intake);
    expect(synced.offerName).toBe('Stack Offer');
    expect(synced.offerPrice).toBe('$37');
    expect(synced.upsell1Name).toBe('Room');
    expect(synced.upsell1Price).toBe('$97');
  });

  it('keeps both sides when both already set (fill-empty only)', () => {
    const intake = blankSalesAiIntake();
    intake.offerName = 'Flat Name';
    intake.offerPrice = '$1';
    intake.offerStack = {
      ...blankOfferStack(),
      frontEnd: {
        name: 'Stack Name',
        price: '$99',
        originalPrice: '',
        promise: '',
        deliverables: [],
      },
    };
    const synced = syncIntakeStack(intake);
    // Does not overwrite non-empty fields either direction
    expect(synced.offerStack.frontEnd.name).toBe('Stack Name');
    expect(synced.offerName).toBe('Flat Name');
    expect(synced.offerPrice).toBe('$1');
    expect(synced.offerStack.frontEnd.price).toBe('$99');
  });
});

describe('normalizeSalesAiIntake', () => {
  it('accepts legacy intake without offerStack', () => {
    const raw = {
      niche: 'mental load',
      audience: 'moms',
      pain: 'overwhelm',
      magnetName: 'Starter',
      magnetPromise: 'dump',
      offerName: 'System',
      offerPrice: '$27',
      upsell1Name: 'Room',
      upsell1Price: '$97',
    };
    const n = normalizeSalesAiIntake(raw);
    expect(n.niche).toBe('mental load');
    expect(n.offerStack.frontEnd.name).toBe('System');
    expect(n.offerStack.upsells[0].name).toBe('Room');
    expect(n.offerStack.upsells[0].enabled).toBe(true);
  });

  it('preserves nested stack from AI fill', () => {
    const stack: OfferStack = {
      frontEnd: {
        name: 'FE',
        price: '$27',
        originalPrice: '$97',
        promise: 'p',
        deliverables: ['one'],
      },
      bonuses: [{ title: 'Bonus', description: 'd', value: '$47' }],
      bumps: [{ id: 'bump_a', title: 'A', price: '$17', description: 'x', imageUrl: '' }],
      upsells: [
        { slot: 1, enabled: true, name: 'U1', price: '$97', promise: 'p1', billingType: 'subscription' },
        { slot: 2, enabled: true, name: 'U2', price: '$297', promise: 'p2', billingType: 'one_time' },
        { slot: 3, enabled: false, name: '', price: '', promise: '', billingType: 'one_time' },
        { slot: 4, enabled: false, name: '', price: '', promise: '', billingType: 'one_time' },
      ],
    };
    const n = normalizeSalesAiIntake({ niche: 'n', offerStack: stack });
    expect(n.offerStack.bonuses).toHaveLength(1);
    expect(n.offerStack.bumps[0].id).toBe('bump_a');
    expect(n.offerName).toBe('FE');
    expect(n.upsell1Name).toBe('U1');
    expect(n.upsell2Name).toBe('U2');
  });
});

describe('formatOfferStackForPrompt', () => {
  it('includes front-end, bonuses, bumps, upsells', () => {
    const text = formatOfferStackForPrompt({
      frontEnd: {
        name: 'Brain Dump',
        price: '$27',
        originalPrice: '$97',
        promise: 'Clear your head',
        deliverables: ['Template', 'Scripts'],
      },
      bonuses: [{ title: 'Partner Pack', description: 'Talk scripts', value: '$47' }],
      bumps: [{ id: 'bump_vault', title: 'Vault', price: '$17', description: 'Extra', imageUrl: '' }],
      upsells: [
        { slot: 1, enabled: true, name: 'Room', price: '$97/mo', promise: 'Community', billingType: 'subscription' },
        { slot: 2, enabled: false, name: '', price: '', promise: '', billingType: 'one_time' },
        { slot: 3, enabled: false, name: '', price: '', promise: '', billingType: 'one_time' },
        { slot: 4, enabled: false, name: '', price: '', promise: '', billingType: 'one_time' },
      ],
    });
    expect(text).toContain('FRONT-END OFFER');
    expect(text).toContain('Brain Dump');
    expect(text).toContain('Partner Pack');
    expect(text).toContain('bump_vault');
    expect(text).toContain('Upsell 1');
    expect(text).toContain('DISABLED');
  });
});
