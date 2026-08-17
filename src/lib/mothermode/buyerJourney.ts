/**
 * The Buyer Journey map (pure): turn the sales leads into the path buyers
 * actually traveled — the aggregate journey (how many reached each step, where
 * they came from, how it ended) and the individual journeys (one buyer's path).
 *
 * A lead IS a buyer journey: it carries the funnel, the furthest step it
 * reached (`step_reached`), the outcome (`purchased` + `purchase_amount_cents`),
 * where it came from (`utm_source` / `utm_content` — the content piece), and
 * when (`created_at`). No event log needed for v1 — the lead's furthest step
 * is the journey.
 *
 * Pure: no server imports, no React — the page is a dumb renderer.
 */

/** The sales funnel's steps in journey order (the path a buyer walks). */
export const JOURNEY_STEPS = [
  'optin',
  'sales',
  'vsl',
  'checkout',
  'upsell1',
  'upsell2',
  'upsell3',
  'upsell4',
  'success',
  'access',
] as const;

export const JOURNEY_STEP_LABEL: Record<string, string> = {
  optin: 'Opted in',
  sales: 'Sales page',
  vsl: 'Watched the VSL',
  checkout: 'Reached checkout',
  upsell1: 'Upsell 1',
  upsell2: 'Upsell 2',
  upsell3: 'Upsell 3',
  upsell4: 'Upsell 4',
  success: 'Purchased',
  access: 'Entered access',
};

// ---------------------------------------------------------------------------
// Input (the route maps the lead rows into these)
// ---------------------------------------------------------------------------

export interface BuyerJourneyLead {
  id: string;
  funnelId: string;
  /** The buyer's display handle (the first name or the email). */
  name: string;
  email: string;
  /** The furthest step reached (a JOURNEY_STEPS key). */
  stepReached: string;
  purchased: boolean;
  purchaseAmountCents: number;
  /** Where they came from (utm_source — instagram, tiktok…). */
  source: string;
  /** The content piece that produced them (utm_content — the piece id). */
  pieceId: string;
  createdAt: string;
}

export interface BuyerJourneyInput {
  leads: BuyerJourneyLead[];
  /** The funnels, for names: id → name. */
  funnels: { id: string; name: string }[];
}

// ---------------------------------------------------------------------------
// The result
// ---------------------------------------------------------------------------

/** One step in the aggregate journey — how many buyers reached it. */
export interface JourneyStepCount {
  step: string;
  label: string;
  /** How many buyers reached AT LEAST this step (the cumulative path). */
  reached: number;
  /** How many buyers STOPPED here (their furthest step) — the drop-off. */
  stoppedHere: number;
}

export interface BuyerJourneyAggregate {
  funnelId: string;
  funnelName: string;
  totalBuyers: number;
  /** The path, in order — the count passing through each step. */
  steps: JourneyStepCount[];
  /** Where the buyers came from: utm_source → count, most-first. */
  sources: { source: string; count: number }[];
  /** How it ended. */
  purchased: number;
  revenueCents: number;
  /** Buyers who haven't purchased (yet) — the still-in-progress. */
  inProgress: number;
}

export interface BuyerJourney {
  /** One aggregate per funnel that has buyers. */
  aggregates: BuyerJourneyAggregate[];
  /** The individual journeys (the buyer picker), newest-first. */
  buyers: BuyerJourneyLead[];
}

const stepIndex = (step: string): number => {
  const i = (JOURNEY_STEPS as readonly string[]).indexOf(step);
  return i === -1 ? 0 : i; // an unknown step reads as the start, not a crash
};

/**
 * Build the buyer journey. For each funnel with buyers: the count passing
 * through each step (cumulative) + the count stopping at each (the drop-off),
 * the source split, and the outcome. The buyers list rides along for the
 * individual picker.
 */
export function buildBuyerJourney(input: BuyerJourneyInput): BuyerJourney {
  const funnelName = new Map(input.funnels.map((f) => [f.id, f.name]));
  const byFunnel = new Map<string, BuyerJourneyLead[]>();
  for (const lead of input.leads) {
    if (!byFunnel.has(lead.funnelId)) byFunnel.set(lead.funnelId, []);
    byFunnel.get(lead.funnelId)!.push(lead);
  }

  const aggregates: BuyerJourneyAggregate[] = [];
  byFunnel.forEach((leads, funnelId) => {
    // The path: for each step, how many reached at least it (cumulative) and
    // how many stopped exactly there (the drop-off).
    const steps: JourneyStepCount[] = JOURNEY_STEPS.map((step, i) => ({
      step,
      label: JOURNEY_STEP_LABEL[step] ?? step,
      reached: leads.filter((l) => stepIndex(l.stepReached) >= i).length,
      stoppedHere: leads.filter((l) => stepIndex(l.stepReached) === i).length,
    })).filter((s) => s.reached > 0); // a step nobody reached clutters the path

    // The source split, most-first.
    const sourceCount = new Map<string, number>();
    for (const l of leads) {
      const s = l.source || 'direct';
      sourceCount.set(s, (sourceCount.get(s) ?? 0) + 1);
    }
    const sources = Array.from(sourceCount.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);

    const purchased = leads.filter((l) => l.purchased);
    aggregates.push({
      funnelId,
      funnelName: funnelName.get(funnelId) ?? 'Funnel',
      totalBuyers: leads.length,
      steps,
      sources,
      purchased: purchased.length,
      revenueCents: purchased.reduce((s, l) => s + l.purchaseAmountCents, 0),
      inProgress: leads.length - purchased.length,
    });
  });

  // Most-active funnel first; the buyers newest-first for the picker.
  aggregates.sort((a, b) => b.totalBuyers - a.totalBuyers);
  const buyers = [...input.leads].sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || ''),
  );

  return { aggregates, buyers };
}
