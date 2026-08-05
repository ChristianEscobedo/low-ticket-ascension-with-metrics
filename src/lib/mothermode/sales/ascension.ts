/**
 * Market-based funnel architecture: the ascension ladder.
 *
 * The rule this module enforces is not "each upsell costs more". It is that
 * each rung must move the buyer forward on the *outcome timeline* of their
 * market. Trade-offs happen on outcomes, never on features or benefits.
 *
 *   Front end -> the problem they have today
 *   OTO 1     -> what happens in the next 30-90 days
 *   OTO 2     -> what happens over the next 1-5 years (permanence / identity)
 *   OTO 3     -> the done-for-you or leverage version of the whole timeline
 *
 * Escalation is expressed on four axes — bigger, faster, stronger, done for
 * you — which are the concrete forms of: maximize output, minimize input,
 * simplify process. A rung that does not move on at least one axis is not an
 * ascension, it is a second front end wearing a higher price.
 */

export type EscalationAxis = 'bigger' | 'faster' | 'stronger' | 'doneForYou';

export const ESCALATION_AXES: readonly EscalationAxis[] = [
  'bigger',
  'faster',
  'stronger',
  'doneForYou',
];

export type AscensionStage = 'frontEnd' | 'oto1' | 'oto2' | 'oto3';

export const ASCENSION_STAGES: readonly AscensionStage[] = [
  'frontEnd',
  'oto1',
  'oto2',
  'oto3',
];

/** Where the buyer sits on their own timeline at each rung. */
export type TimelineHorizon = 'today' | 'next90Days' | 'nextFiveYears' | 'leverage';

export const STAGE_HORIZON: Record<AscensionStage, TimelineHorizon> = {
  frontEnd: 'today',
  oto1: 'next90Days',
  oto2: 'nextFiveYears',
  oto3: 'leverage',
};

export const HORIZON_LABEL: Record<TimelineHorizon, string> = {
  today: 'The problem they have today',
  next90Days: 'What happens in the next 30-90 days',
  nextFiveYears: 'What happens over the next 1-5 years',
  leverage: 'Done for them / automated / leverage',
};

export type MarketArchetype =
  | 'bizop'
  | 'dating'
  | 'weightLoss'
  | 'finance'
  | 'painRelief'
  | 'parenting'
  | 'mlm'
  | 'gameDev'
  | 'saas'
  | 'dogTraining'
  | 'faith'
  | 'productivity'
  | 'consulting'
  | 'language'
  | 'eldercare'
  | 'survival'
  | 'generic';

export type ArchetypeLadder = {
  archetype: MarketArchetype;
  label: string;
  /** Outcome, in the buyer's words, at each rung. Index matches ASCENSION_STAGES. */
  outcomes: [string, string, string, string];
};

/**
 * Reference ladders. These are outcome timelines, not product lists — the
 * deliverable format is chosen later, from the price/format anchors.
 */
export const ARCHETYPE_LADDERS: Record<MarketArchetype, ArchetypeLadder> = {
  bizop: {
    archetype: 'bizop',
    label: 'Business opportunity',
    outcomes: [
      'Learn the skill yourself',
      'Get the templates and assets done with you',
      'Get the speed and execution to actually go where you want',
      'Have the whole engine run without you',
    ],
  },
  dating: {
    archetype: 'dating',
    label: 'Dating',
    outcomes: [
      'Attract and get the person',
      'Keep them',
      'Get them to commit',
      'Never be in the market again',
    ],
  },
  weightLoss: {
    archetype: 'weightLoss',
    label: 'Weight loss',
    outcomes: [
      'Lose the weight',
      'Keep the weight off',
      'Fix what the weight loss caused (skin, face, energy)',
      'A body maintained for you, permanently',
    ],
  },
  finance: {
    archetype: 'finance',
    label: 'Crypto / finance',
    outcomes: [
      'A trading system you run',
      'Done-for-you trades and research reports',
      'Staking and long-horizon investing',
      'Capital managed on your behalf',
    ],
  },
  painRelief: {
    archetype: 'painRelief',
    label: 'Pain relief',
    outcomes: [
      'Get rid of the pain',
      'Fix the damage the pain has already done',
      'Do the things you could not do, and never have it come back',
      'Ongoing care so you never think about it again',
    ],
  },
  parenting: {
    archetype: 'parenting',
    label: 'Parenting',
    outcomes: [
      'The way the kids behave today',
      'How they behave next year',
      'How their behavior shapes them as adults',
      'A family system that runs itself',
    ],
  },
  mlm: {
    archetype: 'mlm',
    label: 'MLM / network marketing',
    outcomes: [
      'Build your downline',
      'Have your downline build your downline',
      'Automate the entire process',
      'Done-for-you recruiting engine',
    ],
  },
  gameDev: {
    archetype: 'gameDev',
    label: 'Game development',
    outcomes: [
      'Become a game developer',
      'Get a job as a game developer',
      'Ship your own game so the game pays you',
      'A studio that ships without you',
    ],
  },
  saas: {
    archetype: 'saas',
    label: 'SaaS',
    outcomes: [
      'Get the solution, monthly',
      'Annual or lifetime upgrade',
      'Pre-loaded done-for-you campaigns',
      'Managed service on top of the software',
    ],
  },
  dogTraining: {
    archetype: 'dogTraining',
    label: 'Dog training',
    outcomes: [
      'Fix the problem the dog has',
      'Teach the dog real skills',
      'Give the dog a long, happy life',
      'Ongoing behavior support for the life of the dog',
    ],
  },
  faith: {
    archetype: 'faith',
    label: 'Faith',
    outcomes: [
      'The pocket bible in your hand',
      'The physical objects of devotion',
      'Daily devotion delivered to you',
      'A guided practice for life',
    ],
  },
  productivity: {
    archetype: 'productivity',
    label: 'Productivity in business',
    outcomes: [
      'Work under 20 hours a week',
      'Automate down to 10 hours',
      'Build a cash-generating freedom business',
      'The business runs while you are absent',
    ],
  },
  consulting: {
    archetype: 'consulting',
    label: 'Consulting',
    outcomes: [
      'Get clients',
      'Get recurring retainers',
      'Get ultra-high-ticket clients',
      'A sales team that closes for you',
    ],
  },
  language: {
    archetype: 'language',
    label: 'Language learning',
    outcomes: [
      'Learn to speak it',
      'Learn to read and write it',
      'Use it to get ahead in business',
      'Full immersion / placement',
    ],
  },
  eldercare: {
    archetype: 'eldercare',
    label: 'Eldercare / Medicaid qualification',
    outcomes: [
      'Qualify for Medicaid',
      'Get more out of retirement',
      'Manage your parents money over the long run',
      'A fiduciary handles all of it',
    ],
  },
  survival: {
    archetype: 'survival',
    label: 'Survival / preparedness',
    outcomes: [
      'What is going on today',
      'What happens in the next 30-90 days',
      'What happens over the next five years',
      'Fully provisioned without lifting a finger',
    ],
  },
  generic: {
    archetype: 'generic',
    label: 'Generic',
    outcomes: [
      'Solve the problem they have today',
      'Hold the result over the next 30-90 days',
      'Make the result permanent over the next few years',
      'Have it done for them entirely',
    ],
  },
};

/** Format anchors. Price follows perceived format, not effort. */
export const FORMAT_PRICE_ANCHORS = [
  { format: 'book', price: 37 },
  { format: 'course', price: 97 },
  { format: 'software', price: 497 },
] as const;

/**
 * Upsell price elasticity is roughly 100x: for every $1 of front-end price,
 * the upsell path can carry about $100 and still convert. Doubling a price
 * costs roughly 28% of conversion while adding 100% of revenue, so the metric
 * that decides is AOV contribution, never conversion rate on its own.
 */
export const UPSELL_ELASTICITY_MULTIPLE = 100;

export type DownsellPlacement = 'none' | 'inline' | 'after';

/**
 * Observed conversion rates by structure. The important asymmetry: an inline
 * downsell (shown immediately after its upsell is declined) earns its own
 * small conversion but depresses every upsell that follows it, because it
 * spends decisions early. Moving the downsells after the upsell path keeps
 * the upsell rates intact and still recovers the decliners.
 */
export const DEFAULT_CONVERSION_RATES: Record<
  DownsellPlacement,
  { upsells: number[]; downsells: number[] }
> = {
  none: { upsells: [0.15, 0.14, 0.13], downsells: [] },
  inline: { upsells: [0.15, 0.08, 0.03], downsells: [0.08, 0.04, 0.01] },
  after: { upsells: [0.15, 0.14, 0.13], downsells: [0.08, 0.05, 0.03] },
};

export type AscensionRung = {
  stage: AscensionStage;
  name: string;
  /** The outcome in buyer language. Not a feature, not a deliverable. */
  outcome: string;
  price: number;
  /** Which axes this rung moves on relative to the rung before it. */
  escalates: EscalationAxis[];
  /** Optional recovery offer for buyers who decline this rung. */
  downsell?: { name: string; price: number };
};

export type AscensionIssueCode =
  | 'price-not-ascending'
  | 'no-escalation'
  | 'duplicate-outcome'
  | 'missing-outcome'
  | 'exceeds-elasticity'
  | 'downsell-not-cheaper'
  | 'stage-out-of-order';

export type AscensionIssue = {
  code: AscensionIssueCode;
  stage: AscensionStage;
  message: string;
};

const stageIndex = (stage: AscensionStage): number => ASCENSION_STAGES.indexOf(stage);

const normalizeOutcome = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Returns every way the ladder fails to be an ascension. An empty array means
 * the ladder escalates on outcome and price, and stays inside elasticity.
 */
export function validateAscension(rungs: AscensionRung[]): AscensionIssue[] {
  const issues: AscensionIssue[] = [];
  if (rungs.length === 0) return issues;

  const ordered = [...rungs].sort((a, b) => stageIndex(a.stage) - stageIndex(b.stage));

  ordered.forEach((rung, i) => {
    if (rung.stage !== rungs[i]?.stage) {
      issues.push({
        code: 'stage-out-of-order',
        stage: rung.stage,
        message: `${rung.stage} is listed out of timeline order.`,
      });
    }
  });

  const seen = new Map<string, AscensionStage>();
  const frontEnd = ordered.find((r) => r.stage === 'frontEnd');

  ordered.forEach((rung, i) => {
    const previous = i > 0 ? ordered[i - 1] : undefined;

    if (!rung.outcome.trim()) {
      issues.push({
        code: 'missing-outcome',
        stage: rung.stage,
        message: `${rung.stage} has no stated outcome. Trade-offs happen on outcomes, so a rung without one cannot be compared to the rung before it.`,
      });
    } else {
      const key = normalizeOutcome(rung.outcome);
      const priorStage = seen.get(key);
      if (priorStage) {
        issues.push({
          code: 'duplicate-outcome',
          stage: rung.stage,
          message: `${rung.stage} promises the same outcome as ${priorStage}. That is a repeat sale, not an ascension.`,
        });
      } else {
        seen.set(key, rung.stage);
      }
    }

    if (previous) {
      if (rung.price <= previous.price) {
        issues.push({
          code: 'price-not-ascending',
          stage: rung.stage,
          message: `${rung.stage} is priced at ${rung.price}, which is not above ${previous.stage} at ${previous.price}.`,
        });
      }
      if (rung.escalates.length === 0) {
        issues.push({
          code: 'no-escalation',
          stage: rung.stage,
          message: `${rung.stage} does not move on any of bigger / faster / stronger / done-for-you. It is a second front end at a higher price.`,
        });
      }
    }

    if (rung.downsell && rung.downsell.price >= rung.price) {
      issues.push({
        code: 'downsell-not-cheaper',
        stage: rung.stage,
        message: `The downsell for ${rung.stage} must be cheaper than the ${rung.price} offer it recovers.`,
      });
    }
  });

  if (frontEnd && frontEnd.price > 0) {
    const ceiling = frontEnd.price * UPSELL_ELASTICITY_MULTIPLE;
    const pathTotal = ordered
      .filter((r) => r.stage !== 'frontEnd')
      .reduce((sum, r) => sum + r.price, 0);
    if (pathTotal > ceiling) {
      const last = ordered[ordered.length - 1];
      issues.push({
        code: 'exceeds-elasticity',
        stage: last.stage,
        message: `The upsell path totals ${pathTotal} against a ${frontEnd.price} front end. Elasticity runs to about ${UPSELL_ELASTICITY_MULTIPLE}x, or ${ceiling}.`,
      });
    }
  }

  return issues;
}

export type AovLine = {
  stage: AscensionStage;
  kind: 'upsell' | 'downsell';
  name: string;
  price: number;
  conversionRate: number;
  contribution: number;
};

export type AovProjection = {
  placement: DownsellPlacement;
  lines: AovLine[];
  /** Number of yes/no decisions the buyer is asked to make after checkout. */
  decisions: number;
  total: number;
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Projects AOV contribution per rung. Contribution, not conversion rate, is
 * the number that decides a price: a lower rate on a higher price routinely
 * wins.
 */
export function projectAov(
  rungs: AscensionRung[],
  placement: DownsellPlacement = 'none',
  rates = DEFAULT_CONVERSION_RATES[placement],
): AovProjection {
  const upsells = rungs
    .filter((r) => r.stage !== 'frontEnd')
    .sort((a, b) => stageIndex(a.stage) - stageIndex(b.stage));

  const lines: AovLine[] = [];

  upsells.forEach((rung, i) => {
    const cvr = rates.upsells[i] ?? 0;
    lines.push({
      stage: rung.stage,
      kind: 'upsell',
      name: rung.name,
      price: rung.price,
      conversionRate: cvr,
      contribution: round2(rung.price * cvr),
    });
  });

  if (placement !== 'none') {
    upsells.forEach((rung, i) => {
      if (!rung.downsell) return;
      const cvr = rates.downsells[i] ?? 0;
      lines.push({
        stage: rung.stage,
        kind: 'downsell',
        name: rung.downsell.name,
        price: rung.downsell.price,
        conversionRate: cvr,
        contribution: round2(rung.downsell.price * cvr),
      });
    });
  }

  return {
    placement,
    lines,
    decisions: lines.length,
    total: round2(lines.reduce((sum, l) => sum + l.contribution, 0)),
  };
}

/**
 * Compares the three structures against the same ladder so the choice is made
 * on projected AOV rather than on how many offers it feels like.
 */
export function compareDownsellPlacements(
  rungs: AscensionRung[],
): Record<DownsellPlacement, AovProjection> {
  return {
    none: projectAov(rungs, 'none'),
    inline: projectAov(rungs, 'inline'),
    after: projectAov(rungs, 'after'),
  };
}

/**
 * Suggests a price ladder from the front-end price using the format anchors,
 * clamped to elasticity. Returned prices are starting points to test, not
 * truth.
 */
export function suggestPriceLadder(frontEndPrice: number): Record<AscensionStage, number> {
  const fe = Math.max(0, frontEndPrice);
  const ladder: Record<AscensionStage, number> = {
    frontEnd: fe,
    oto1: Math.max(97, Math.round(fe * 3)),
    oto2: Math.max(197, Math.round(fe * 6)),
    oto3: Math.max(497, Math.round(fe * 12)),
  };
  const ceiling = fe * UPSELL_ELASTICITY_MULTIPLE;
  const pathTotal = ladder.oto1 + ladder.oto2 + ladder.oto3;
  if (fe > 0 && pathTotal > ceiling) {
    const scale = ceiling / pathTotal;
    ladder.oto1 = Math.round(ladder.oto1 * scale);
    ladder.oto2 = Math.round(ladder.oto2 * scale);
    ladder.oto3 = Math.round(ladder.oto3 * scale);
  }
  return ladder;
}

/**
 * Builds a starting ladder for a market: the outcome timeline from the
 * archetype, priced from the front end. Names are left to the operator —
 * this states what each rung must accomplish, not what to call it.
 */
export function suggestAscension(
  archetype: MarketArchetype,
  frontEndPrice: number,
): AscensionRung[] {
  const ladder = ARCHETYPE_LADDERS[archetype] ?? ARCHETYPE_LADDERS.generic;
  const prices = suggestPriceLadder(frontEndPrice);
  const escalation: Record<AscensionStage, EscalationAxis[]> = {
    frontEnd: [],
    oto1: ['faster'],
    oto2: ['bigger', 'stronger'],
    oto3: ['doneForYou'],
  };
  return ASCENSION_STAGES.map((stage, i) => ({
    stage,
    name: '',
    outcome: ladder.outcomes[i],
    price: prices[stage],
    escalates: escalation[stage],
  }));
}
