/**
 * The Buyer Journey builder (src/lib/mothermode/buyerJourney.ts) — the
 * aggregate path, the source split, the outcome, and the individual picker.
 */
import { describe, it, expect } from 'vitest';
import { buildBuyerJourney, type BuyerJourneyInput } from '@/lib/mothermode/buyerJourney';

const lead = (
  id: string,
  stepReached: string,
  over: Partial<Record<string, unknown>> = {},
): BuyerJourneyInput['leads'][number] => ({
  id,
  funnelId: 'f1',
  name: id,
  email: `${id}@x.com`,
  stepReached,
  purchased: false,
  purchaseAmountCents: 0,
  source: 'instagram',
  pieceId: '',
  createdAt: `2026-08-1${id}T00:00:00Z`,
  ...(over as object),
});

const input: BuyerJourneyInput = {
  leads: [
    lead('1', 'success', { purchased: true, purchaseAmountCents: 2700 }),
    lead('2', 'checkout'),
    lead('3', 'optin'),
    lead('4', 'success', { purchased: true, purchaseAmountCents: 2700, source: 'tiktok' }),
  ],
  funnels: [{ id: 'f1', name: 'Mindshift' }],
};

const journey = buildBuyerJourney(input);
const agg = journey.aggregates[0];
const step = (key: string) => agg.steps.find((s) => s.step === key);

describe('buildBuyerJourney', () => {
  it('builds the aggregate path — cumulative reached + the drop-off per step', () => {
    // all 4 opted in; 3 reached the sales page… wait, the leads stop at
    // optin/checkout/success — the cumulative count is per the step order.
    expect(step('optin')!.reached).toBe(4); // everyone
    expect(step('checkout')!.reached).toBe(3); // the checkout + the 2 who purchased
    expect(step('success')!.reached).toBe(2); // the 2 buyers
    // the drop-off: 1 stopped at optin, 1 at checkout
    expect(step('optin')!.stoppedHere).toBe(1);
    expect(step('checkout')!.stoppedHere).toBe(1);
    // a step nobody reached is omitted from the path (the buyers stop at
    // success — nobody reaches access)
    expect(step('access')).toBeUndefined();
    // …but a step buyers pass THROUGH on the way further is counted (the
    // checkout buyer + the 2 who purchased all passed the vsl)
    expect(step('vsl')!.reached).toBe(3);
  });

  it('splits the sources and the outcome', () => {
    expect(agg.sources[0]).toEqual({ source: 'instagram', count: 3 });
    expect(agg.sources[1]).toEqual({ source: 'tiktok', count: 1 });
    expect(agg.purchased).toBe(2);
    expect(agg.revenueCents).toBe(5400);
    expect(agg.inProgress).toBe(2);
    expect(agg.totalBuyers).toBe(4);
  });

  it('keeps the buyers newest-first for the individual picker', () => {
    expect(journey.buyers[0].id).toBe('4'); // the latest createdAt
    expect(journey.buyers[journey.buyers.length - 1].id).toBe('1');
  });
});
