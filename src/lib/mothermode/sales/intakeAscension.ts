/**
 * The adapter between what the admin actually types (`SalesAiIntake` /
 * `OfferStack`) and what the ascension model needs (`AscensionRung[]`).
 *
 * Until this module existed, `validateAscension` was exercised only by its own
 * tests: the intake stores flat `upsellNName` / `upsellNPrice` pairs plus a
 * promise string, and has no `outcome`, no `escalates`, and no downsell. This
 * file is the one place that decides how those gaps are filled, and it is
 * deliberate about the difference between *read*, *inferred*, and *absent*:
 *
 *   read      — name, price, promise come straight off the stack.
 *   inferred  — escalation axes guessed from the promise wording, and only
 *               when a keyword actually matches.
 *   absent    — anything else is left empty so `validateAscension` fires on
 *               it. A blank `escalates` producing `no-escalation` is the
 *               correct outcome, not a bug to paper over: the intake genuinely
 *               does not record how a rung escalates, and the operator is the
 *               one who has to say.
 *
 * Every such decision is reported as an `IntakeAscensionNote`, so the caller
 * can show the operator what the model assumed rather than pretending the
 * intake said it.
 */

import {
  normalizeOfferStack,
  syncIntakeStack,
  type OfferStackUpsell,
  type SalesAiIntake,
} from './aiIntake';
import {
  ASCENSION_STAGES,
  compareDownsellPlacements,
  validateAscension,
  type AovProjection,
  type AscensionIssue,
  type AscensionRung,
  type AscensionStage,
  type DownsellPlacement,
  type EscalationAxis,
} from './ascension';
import {
  buildFunnelMap,
  type FunnelMap,
  type FunnelMapInput,
} from './funnelMap';

/** The rungs an upsell slot can occupy. The front end is not an upsell. */
export const UPSELL_STAGES: readonly AscensionStage[] = ASCENSION_STAGES.filter(
  (s) => s !== 'frontEnd',
);

// ---------------------------------------------------------------------------
// Price
// ---------------------------------------------------------------------------

/**
 * Prices are typed as free text ("$97", "1,997", "$29/mo", "free"), so this
 * takes the first number it finds and ignores the decoration. A recurring
 * price is read as its first payment — the ladder models one purchase moment,
 * not lifetime value — and the caller is told so via a note.
 */
export function parseIntakePrice(label: string | undefined | null): number {
  if (!label) return 0;
  const match = String(label).match(/\d[\d,]*(?:\.\d+)?/);
  if (!match) return 0;
  const n = Number(match[0].replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

// ---------------------------------------------------------------------------
// Escalation inference
// ---------------------------------------------------------------------------

/**
 * Wording that stands in for each axis. Conservative on purpose: a wrong axis
 * is worse than a missing one, because a missing one is caught by the
 * validator and a wrong one silently passes.
 *
 * Matched on word boundaries, not as substrings — "breakfast" is not an offer
 * that gets you there faster. Generic intensifiers ("every", "better") are
 * deliberately absent: "done for you every week" moves on one axis, not two.
 */
export const ESCALATION_KEYWORDS: Record<EscalationAxis, readonly string[]> = {
  bigger: [
    'more',
    'bigger',
    'scale',
    'scaling',
    'grow',
    'growth',
    'expand',
    'double',
    '10x',
    'unlimited',
    'advanced',
  ],
  faster: [
    'faster',
    'fast',
    'speed',
    'quick',
    'quicker',
    'accelerate',
    'shortcut',
    'overnight',
    'in days',
    'in a weekend',
    'instantly',
    'same day',
  ],
  stronger: [
    'permanent',
    'permanently',
    'forever',
    'keep',
    'lock in',
    'locked in',
    'never again',
    'sustain',
    'maintain',
    'for life',
    'lifetime',
    'master',
    'certified',
  ],
  doneForYou: [
    'done for you',
    'done-for-you',
    'dfy',
    'we build',
    'we do it',
    'we run',
    'built for you',
    'hands off',
    'hands-off',
    'without you',
    'on your behalf',
    'automate',
    'automated',
    'automation',
    'concierge',
    'managed',
  ],
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const matchesKeyword = (haystack: string, keyword: string): boolean =>
  new RegExp(`\\b${escapeRegExp(keyword)}\\b`).test(haystack);

/**
 * Guesses which axes a promise moves on. Returns an empty array when nothing
 * matches, which is the signal that the operator has not said.
 */
export function inferEscalationAxes(text: string | undefined): EscalationAxis[] {
  const haystack = (text ?? '').toLowerCase();
  if (!haystack.trim()) return [];
  const axes: EscalationAxis[] = [];
  (Object.keys(ESCALATION_KEYWORDS) as EscalationAxis[]).forEach((axis) => {
    if (ESCALATION_KEYWORDS[axis].some((kw) => matchesKeyword(haystack, kw))) {
      axes.push(axis);
    }
  });
  return axes;
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export type IntakeAscensionNoteCode =
  /** The intake has no price for this rung, so it entered the ladder at 0. */
  | 'price-missing'
  /** No promise text, so the rung has no outcome to be compared on. */
  | 'outcome-missing'
  /** Axes were guessed from the promise wording, not stated by the operator. */
  | 'escalation-inferred'
  /** Nothing in the promise named an axis; left blank for the validator. */
  | 'escalation-unstated'
  /** A subscription price was read as its first payment. */
  | 'recurring-price-as-first-payment'
  /** Slot 4 exists in the intake but the ladder stops at OTO 3. */
  | 'upsell-beyond-oto3'
  /** The intake cannot express a downsell, so placement cannot be compared. */
  | 'downsells-not-expressible'
  /** More order bumps than the map draws. */
  | 'extra-order-bumps';

export type IntakeAscensionNote = {
  code: IntakeAscensionNoteCode;
  stage?: AscensionStage;
  detail: string;
};

export type IntakeAscension = {
  rungs: AscensionRung[];
  notes: IntakeAscensionNote[];
};

// ---------------------------------------------------------------------------
// Intake -> ladder
// ---------------------------------------------------------------------------

const activeUpsells = (upsells: OfferStackUpsell[]): OfferStackUpsell[] =>
  upsells
    .filter((u) => u.enabled && u.name.trim())
    .sort((a, b) => a.slot - b.slot);

/**
 * Maps the intake's money path onto the outcome timeline: the front-end offer
 * becomes the `frontEnd` rung, and each enabled, named upsell takes the next
 * free OTO slot in slot order. Nothing is invented — an upsell with no promise
 * arrives with an empty outcome and is caught downstream.
 */
export function intakeToAscension(intake: SalesAiIntake): IntakeAscension {
  const synced = syncIntakeStack(intake);
  const stack = normalizeOfferStack(synced.offerStack);
  const notes: IntakeAscensionNote[] = [];

  const note = (
    code: IntakeAscensionNoteCode,
    detail: string,
    stage?: AscensionStage,
  ) => {
    notes.push(stage ? { code, stage, detail } : { code, detail });
  };

  // --- front end -----------------------------------------------------------
  const feName = stack.frontEnd.name || synced.offerName || '';
  const feOutcome = stack.frontEnd.promise.trim();
  const fePriceLabel = stack.frontEnd.price || synced.offerPrice || '';
  const fePrice = parseIntakePrice(fePriceLabel);

  if (!fePrice) {
    note(
      'price-missing',
      'The front-end offer has no readable price, so elasticity cannot be checked against it.',
      'frontEnd',
    );
  }
  if (!feOutcome) {
    note(
      'outcome-missing',
      'The front-end offer has no promise, so there is nothing for OTO 1 to escalate against.',
      'frontEnd',
    );
  }

  const rungs: AscensionRung[] = [
    {
      stage: 'frontEnd',
      name: feName,
      outcome: feOutcome,
      price: fePrice,
      escalates: [],
    },
  ];

  // --- upsells -------------------------------------------------------------
  const upsells = activeUpsells(stack.upsells);

  upsells.forEach((upsell, i) => {
    const stage = UPSELL_STAGES[i];
    if (!stage) {
      note(
        'upsell-beyond-oto3',
        `Upsell slot ${upsell.slot} ("${upsell.name}") has no rung: the outcome timeline ends at OTO 3. Fold it into an earlier rung or drop it.`,
      );
      return;
    }

    const price = parseIntakePrice(upsell.price);
    const outcome = upsell.promise.trim();
    const escalates = inferEscalationAxes(upsell.promise);

    if (!price) {
      note('price-missing', `Upsell slot ${upsell.slot} has no readable price.`, stage);
    }
    if (!outcome) {
      note(
        'outcome-missing',
        `Upsell slot ${upsell.slot} has no promise, so its outcome is blank.`,
        stage,
      );
    }
    if (upsell.billingType === 'subscription' && price) {
      note(
        'recurring-price-as-first-payment',
        `Upsell slot ${upsell.slot} is a subscription; ${price} is read as the first payment, not lifetime value.`,
        stage,
      );
    }
    if (escalates.length) {
      note(
        'escalation-inferred',
        `Escalation axes for ${stage} (${escalates.join(', ')}) were inferred from the promise wording, not stated.`,
        stage,
      );
    } else if (outcome) {
      note(
        'escalation-unstated',
        `Nothing in the promise for ${stage} names bigger / faster / stronger / done-for-you, so no axis was assumed.`,
        stage,
      );
    }

    rungs.push({
      stage,
      name: upsell.name,
      outcome,
      price,
      escalates,
    });
  });

  if (upsells.length) {
    note(
      'downsells-not-expressible',
      'The intake has no downsell fields, so every rung is modelled without one and placement comparison has nothing to move.',
    );
  }

  return { rungs, notes };
}

/** Convenience wrapper for callers that only want the ladder. */
export function intakeToAscensionRungs(intake: SalesAiIntake): AscensionRung[] {
  return intakeToAscension(intake).rungs;
}

// ---------------------------------------------------------------------------
// Intake -> map
// ---------------------------------------------------------------------------

export type IntakeFunnelMapOptions = {
  traffic?: FunnelMapInput['traffic'];
  emails?: FunnelMapInput['emails'];
  downsellPlacement?: DownsellPlacement;
};

/**
 * The map input the intake can honestly support. `funnelMap` draws a single
 * order bump; the stack allows several, so extras are reported rather than
 * silently dropped.
 */
export function funnelMapInputFromIntake(
  intake: SalesAiIntake,
  options: IntakeFunnelMapOptions = {},
): { input: FunnelMapInput; notes: IntakeAscensionNote[] } {
  const { rungs, notes } = intakeToAscension(intake);
  const stack = normalizeOfferStack(syncIntakeStack(intake).offerStack);
  const frontEnd = rungs.find((r) => r.stage === 'frontEnd');
  const extra = [...notes];

  const bump = stack.bumps[0];
  if (stack.bumps.length > 1) {
    extra.push({
      code: 'extra-order-bumps',
      detail: `${stack.bumps.length} order bumps in the stack; the map draws the first ("${bump.title}") only.`,
    });
  }

  const input: FunnelMapInput = {
    frontEndName: frontEnd?.name ?? '',
    frontEndPrice: frontEnd?.price ?? 0,
    rungs,
    downsellPlacement: options.downsellPlacement ?? 'none',
    traffic: options.traffic,
    ...(bump
      ? { orderBump: { name: bump.title, price: parseIntakePrice(bump.price) } }
      : {}),
    ...(options.emails ? { emails: options.emails } : {}),
  };

  return { input, notes: extra };
}

export function buildFunnelMapFromIntake(
  intake: SalesAiIntake,
  options: IntakeFunnelMapOptions = {},
): FunnelMap {
  return buildFunnelMap(funnelMapInputFromIntake(intake, options).input);
}

// ---------------------------------------------------------------------------
// One call for the admin surface
// ---------------------------------------------------------------------------

export type IntakeFunnelAudit = {
  rungs: AscensionRung[];
  /** What the adapter had to assume or could not read. */
  notes: IntakeAscensionNote[];
  /** What is wrong with the ladder itself. */
  issues: AscensionIssue[];
  placements: Record<DownsellPlacement, AovProjection>;
  /**
   * Highest projected AOV. Ties go to the simplest structure, because equal
   * money for fewer decisions is the better funnel.
   */
  bestPlacement: DownsellPlacement;
  map: FunnelMap;
};

const PLACEMENT_PREFERENCE: readonly DownsellPlacement[] = ['none', 'inline', 'after'];

/**
 * Everything the editor needs about one intake's money path: the ladder it
 * implies, what had to be assumed to get there, what the validator says about
 * it, the AOV of each structure, and the drawn map.
 */
export function auditIntakeFunnel(
  intake: SalesAiIntake,
  options: IntakeFunnelMapOptions = {},
): IntakeFunnelAudit {
  const { input, notes } = funnelMapInputFromIntake(intake, options);
  const placements = compareDownsellPlacements(input.rungs);

  let bestPlacement: DownsellPlacement = 'none';
  PLACEMENT_PREFERENCE.forEach((p) => {
    if (placements[p].total > placements[bestPlacement].total) bestPlacement = p;
  });

  return {
    rungs: input.rungs,
    notes,
    issues: validateAscension(input.rungs),
    placements,
    bestPlacement,
    map: buildFunnelMap(input),
  };
}
