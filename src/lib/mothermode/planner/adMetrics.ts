/**
 * Advertising economics — the one place clicks, leads, revenue and spend become
 * ratios.
 *
 * WHY THIS IS ITS OWN MODULE (same reasoning as clickPeople.ts)
 * ------------------------------------------------------------
 * `links.ts` builds a Supabase service client at module scope, and two of the
 * consumers here are client components. So this file imports NOTHING and holds
 * only arithmetic, letting server and browser share one definition of "EPC".
 *
 * THE ONE RULE THAT MATTERS: DIVIDING BY NOTHING YIELDS null
 * ---------------------------------------------------------
 * Every metric here is a fraction, and in this domain the denominator is
 * routinely zero — a new post has no clicks, an unlaunched campaign has no
 * spend. JavaScript is actively hostile here: `5 / 0` is `Infinity`, which
 * React renders happily as "Infinity", and `0 / 0` is `NaN`, which renders as
 * "NaN". Both look like a broken app; worse, an infinite ROAS looks like the
 * best campaign you have ever run. So division goes through `ratio()` and the
 * answer for "cannot be computed" is `null`, which the display layer renders as
 * `n/a` — matching the rule already established for clicks: a failed or
 * impossible read is never shown as `0`, because `0` is a fact and this is the
 * absence of one.
 *
 * MONEY IS ALWAYS CENTS (integers) UNTIL IT IS FORMATTED
 * -----------------------------------------------------
 * `sales_leads.purchase_amount_cents` and Stripe are both integer cents. Ratios
 * of cents stay in cents (fractional cents allowed — EPC is routinely $0.34) and
 * only `formatCents` divides by 100. Doing it earlier accumulates float error
 * across a sum of thousands of leads.
 */

/* ------------------------------------------------------------------ *
 * Paid vs organic
 * ------------------------------------------------------------------ */

/**
 * Which bucket a `utm_medium` belongs to.
 *
 * `unattributed` is a real third state, not a tidy-up. See `trafficType`.
 */
export type TrafficType = 'paid' | 'organic' | 'unattributed';

/**
 * Mediums that mean money changed hands.
 *
 * An explicit ALLOWLIST, never a denylist. With a denylist, every new medium
 * string an ad platform invents ("paid_social_advantage") silently lands in
 * `organic`, and paid spend starts being reported as free organic success —
 * the single most flattering error this system could make, and therefore the
 * one least likely to be questioned. With an allowlist an unrecognised medium
 * lands in `unattributed`, which is visible and gets fixed.
 *
 * Values are compared against the SLUGIFIED medium, because `buildUtmParams`
 * slugifies source/medium/campaign at mint time (`Paid Social` →
 * `paid_social`). Add new entries in slug form.
 */
export const PAID_MEDIUMS: readonly string[] = [
  'cpc',
  'ppc',
  'paid',
  'paid_social',
  'paidsocial',
  'display',
  'cpm',
  'retargeting',
  'remarketing'
];

/**
 * Classify a lead or link by its `utm_medium`.
 *
 * Empty/missing medium is `unattributed` rather than `organic`. These are
 * genuinely different claims — "this traffic was free" versus "we do not know
 * what this traffic was" — and only one of them justifies leaving a campaign
 * running. A mis-tagged ad link is exactly how a row arrives here with no
 * medium, so defaulting it to organic would credit an ad's leads to organic
 * reach while its cost sat in the paid bucket, inflating both readings at once.
 */
export function trafficType(medium: string | null | undefined): TrafficType {
  const value = (medium || '').trim().toLowerCase();
  if (!value) return 'unattributed';
  if (PAID_MEDIUMS.includes(value)) return 'paid';
  return 'organic';
}

/** Human label for a bucket. One wording, four surfaces. */
export function trafficTypeLabel(type: TrafficType): string {
  if (type === 'paid') return 'Paid';
  if (type === 'organic') return 'Organic';
  return 'Untagged';
}

/* ------------------------------------------------------------------ *
 * Safe division
 * ------------------------------------------------------------------ */

/**
 * `numerator / denominator`, or null when that is not a number worth showing.
 *
 * Guards, each earning its place:
 *  - denominator 0 → null (not Infinity, not NaN)
 *  - either side non-finite (already NaN/Infinity upstream) → null, so one bad
 *    input cannot poison a whole row of otherwise sound metrics
 *  - negative denominator → null; a negative click or lead count is a bug
 *    elsewhere, and quietly returning a negative rate hides it
 */
export function ratio(
  numerator: number | null | undefined,
  denominator: number | null | undefined
): number | null {
  if (numerator === null || numerator === undefined) return null;
  if (denominator === null || denominator === undefined) return null;
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (denominator <= 0) return null;
  return numerator / denominator;
}

/* ------------------------------------------------------------------ *
 * Inputs
 * ------------------------------------------------------------------ */

export interface FunnelEconomicsInput {
  /**
   * Human clicks. Must come from the same window as everything else here —
   * pairing all-time revenue with 30-day clicks produces an EPC that is simply
   * wrong while looking entirely plausible.
   */
  clicks: number;
  /**
   * Opt-ins attributed to this row, or null when the attribution join failed.
   * Null propagates: an unknown lead count must not yield a confident EPL.
   */
  optins: number | null;
  /** Purchases attributed to this row, or null when unknown. */
  purchases: number | null;
  /** Attributed revenue in cents, or null when unknown. */
  revenueCents: number | null;
  /**
   * Ad spend in cents for the same window, or null when unknown.
   *
   * PHASE 2 FORWARD-DECLARATION, deliberately included now: the ÷0 discipline
   * for ROAS belongs in this module with its siblings and its tests, not bolted
   * on later next to the CSV importer. Until spend is stored, callers pass null
   * and every cost metric below reads `n/a` — which is the truthful rendering
   * of "no spend recorded", and is NOT the same as free traffic.
   */
  spendCents?: number | null;
}

export interface FunnelEconomics {
  /** Earnings per click, cents. Your break-even CPC. */
  epcCents: number | null;
  /** Earnings per lead, cents. Your break-even CPL — the max you can bid. */
  eplCents: number | null;
  /** Average order value, cents. */
  aovCents: number | null;

  /** Clicks → opt-ins. Landing-page quality. */
  optinRate: number | null;
  /** Opt-ins → purchases. Offer / follow-up quality. */
  leadToSaleRate: number | null;
  /** Clicks → purchases. End to end. */
  clickToSaleRate: number | null;

  /** Spend ÷ clicks. Null without spend. */
  cpcCents: number | null;
  /** Spend ÷ opt-ins. Compare against `eplCents`. */
  cplCents: number | null;
  /** Spend ÷ purchases — customer acquisition cost. */
  cacCents: number | null;
  /** Revenue ÷ spend. Null without spend, never Infinity. */
  roas: number | null;
  /** Revenue − spend, cents. Null unless BOTH are known. */
  profitCents: number | null;

  /**
   * True when spend is known and every lead costs more than a lead is worth.
   * Stated explicitly because `cpl > epl` is the actual stop-the-campaign
   * signal, and asking a reader to compare two formatted currency strings in
   * their head is how it gets missed.
   */
  losingMoneyPerLead: boolean;
}

/* ------------------------------------------------------------------ *
 * Derivation
 * ------------------------------------------------------------------ */

/**
 * Turn raw counts into the full economics of one row (a piece, a campaign, or a
 * whole account — the arithmetic does not care about the grain, only that every
 * input covers the same window).
 */
export function deriveFunnelEconomics(input: FunnelEconomicsInput): FunnelEconomics {
  const clicks = Math.max(0, Math.floor(input.clicks || 0));
  const optins = nonNegativeOrNull(input.optins);
  const purchases = nonNegativeOrNull(input.purchases);
  const revenueCents = nonNegativeOrNull(input.revenueCents);
  const spendCents = nonNegativeOrNull(input.spendCents ?? null);

  const epcCents = ratio(revenueCents, clicks);
  const eplCents = ratio(revenueCents, optins);
  const cplCents = ratio(spendCents, optins);

  return {
    epcCents,
    eplCents,
    aovCents: ratio(revenueCents, purchases),

    optinRate: ratio(optins, clicks),
    leadToSaleRate: ratio(purchases, optins),
    clickToSaleRate: ratio(purchases, clicks),

    cpcCents: ratio(spendCents, clicks),
    cplCents,
    cacCents: ratio(spendCents, purchases),
    roas: ratio(revenueCents, spendCents),
    /*
     * Profit needs BOTH sides. With spend unknown, `revenue - 0` would report
     * the whole of revenue as profit — the most dangerous default available
     * here, since it makes an unmeasured campaign look perfectly healthy.
     */
    profitCents:
      revenueCents !== null && spendCents !== null ? revenueCents - spendCents : null,

    losingMoneyPerLead: cplCents !== null && eplCents !== null && cplCents > eplCents
  };
}

/** Clamp to a non-negative number, preserving null/unknown. */
function nonNegativeOrNull(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  return Math.max(0, value);
}

/* ------------------------------------------------------------------ *
 * Formatting — shared so surfaces cannot word the same value differently
 * ------------------------------------------------------------------ */

/**
 * Cents → `$1,234.56`, or `n/a` for null.
 *
 * `n/a` (not `—`, not `$0.00`) is the established vocabulary for "not
 * measurable" across the click surfaces; reusing the exact string keeps a
 * reader from inferring that a dash and an n/a mean different things.
 */
export function formatCents(cents: number | null): string {
  if (cents === null || !Number.isFinite(cents)) return 'n/a';
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

/**
 * Sub-dollar amounts, where two decimals hide the difference that matters.
 *
 * EPC and CPC live between $0.01 and $2.00, and `$0.03` vs `$0.04` is a 33%
 * difference in what you can afford to bid. Three decimals below a dollar.
 */
export function formatCentsPrecise(cents: number | null): string {
  if (cents === null || !Number.isFinite(cents)) return 'n/a';
  const dollars = cents / 100;
  if (Math.abs(dollars) < 1) {
    return `$${dollars.toLocaleString('en-US', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3
    })}`;
  }
  return formatCents(cents);
}

/** A 0..1 rate → `12.5%`, or `n/a`. */
export function formatRate(rate: number | null): string {
  if (rate === null || !Number.isFinite(rate)) return 'n/a';
  return `${(rate * 100).toFixed(1)}%`;
}

/** ROAS → `3.20x`, or `n/a`. */
export function formatRoas(roas: number | null): string {
  if (roas === null || !Number.isFinite(roas)) return 'n/a';
  return `${roas.toFixed(2)}x`;
}

/**
 * The sentence a reader actually needs: what a click and a lead are worth, and
 * therefore the most you can pay for one.
 *
 * Returns null when revenue is unknown rather than inventing a bid ceiling —
 * a made-up "you can pay up to $0.00" would be read as an instruction.
 */
export function breakEvenSummary(economics: FunnelEconomics): string | null {
  if (economics.epcCents === null && economics.eplCents === null) return null;
  const parts: string[] = [];
  if (economics.epcCents !== null) {
    parts.push(`break-even CPC ${formatCentsPrecise(economics.epcCents)}`);
  }
  if (economics.eplCents !== null) {
    parts.push(`break-even CPL ${formatCents(economics.eplCents)}`);
  }
  return parts.join(' · ');
}

/* ------------------------------------------------------------------ *
 * Attributed slices, the traffic mix, and the paid/blended composition
 * ------------------------------------------------------------------ *
 *
 * Everything above answers "given these numbers, what are the ratios". This
 * section answers the question the four display surfaces actually ask: "given a
 * piece's clicks and its leads split by traffic type, WHICH ratios am I allowed
 * to show, and which of them may be read as a bid?"
 *
 * It lives here rather than in each surface because that judgement is the part
 * that differs between screens when it is made four times.
 */

/** One bucket of attributed results. Structurally the store's `AttributionSlice`. */
export interface AttributedSlice {
  optins: number;
  purchases: number;
  revenueCents: number;
}

/** A piece's results split three ways. Keys are exhaustive on `TrafficType`. */
export type TrafficSplit = Record<TrafficType, AttributedSlice>;

export function emptyAttributedSlice(): AttributedSlice {
  return { optins: 0, purchases: 0, revenueCents: 0 };
}

export function emptyTrafficSplit(): TrafficSplit {
  return {
    paid: emptyAttributedSlice(),
    organic: emptyAttributedSlice(),
    unattributed: emptyAttributedSlice()
  };
}

/**
 * Add slices together.
 *
 * Exists so account-level and table-total surfaces do not each write their own
 * three-field reducer — and, more importantly, so the one that forgets
 * `revenueCents` cannot exist.
 */
export function sumAttributedSlices(
  slices: Array<AttributedSlice | null | undefined>
): AttributedSlice {
  return slices.reduce<AttributedSlice>((acc, slice) => {
    if (!slice) return acc;
    return {
      optins: acc.optins + (slice.optins || 0),
      purchases: acc.purchases + (slice.purchases || 0),
      revenueCents: acc.revenueCents + (slice.revenueCents || 0)
    };
  }, emptyAttributedSlice());
}

/** Add two splits bucket-by-bucket. */
export function sumTrafficSplits(
  splits: Array<TrafficSplit | null | undefined>
): TrafficSplit {
  const present = splits.filter(Boolean) as TrafficSplit[];
  return {
    paid: sumAttributedSlices(present.map((s) => s.paid)),
    organic: sumAttributedSlices(present.map((s) => s.organic)),
    unattributed: sumAttributedSlices(present.map((s) => s.unattributed))
  };
}

/** Where a row's leads actually came from, and whether that spoils its rates. */
export interface TrafficMix {
  /** Opt-ins across all three buckets. */
  optins: number;
  /** Share of opt-ins per bucket, 0..1. Null when there are no opt-ins at all. */
  shares: Record<TrafficType, number | null>;
  /**
   * Leads came from BOTH paid and organic.
   *
   * The flag that matters: when it is true, every blended rate on the row is a
   * weighted average whose weight is the BUDGET, so it moves when spend changes
   * even though the page did not — and a break-even CPL read off it is inflated
   * by organic and will authorise a bid that loses money.
   */
  blended: boolean;
  /** Opt-ins whose medium was missing, so the split itself is incomplete. */
  untaggedOptins: number;
  /** `58% paid · 34% organic · 8% untagged`, or null with no opt-ins. */
  label: string | null;
}

/**
 * Describe the mix.
 *
 * Percentages are rounded independently and are NOT forced to sum to 100 — a
 * fudged last bucket would be a number nobody could reproduce from the counts
 * shown next to it.
 */
export function trafficMix(split: TrafficSplit | null | undefined): TrafficMix {
  const paid = split?.paid?.optins ?? 0;
  const organic = split?.organic?.optins ?? 0;
  const untagged = split?.unattributed?.optins ?? 0;
  const optins = paid + organic + untagged;

  const share = (n: number) => ratio(n, optins);
  const parts: string[] = [];
  const order: Array<[TrafficType, number]> = [
    ['paid', paid],
    ['organic', organic],
    ['unattributed', untagged]
  ];
  order
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, n]) => {
      const pct = share(n);
      if (pct === null) return;
      parts.push(`${Math.round(pct * 100)}% ${trafficTypeLabel(type).toLowerCase()}`);
    });

  return {
    optins,
    shares: {
      paid: share(paid),
      organic: share(organic),
      unattributed: share(untagged)
    },
    blended: paid > 0 && organic > 0,
    untaggedOptins: untagged,
    label: parts.length ? parts.join(' · ') : null
  };
}

export interface PieceEconomicsInput {
  /**
   * All-time human clicks for the row, or null when the click read failed.
   *
   * MUST be the all-time counter (`ClickRollups.byPieceId`) and never the
   * 30-day `recentByPieceId`, because attribution below is all-time. Pairing
   * all-time revenue with a 30-day click count produces an EPC that looks
   * entirely plausible and is simply wrong.
   */
  clicks: number | null;
  /**
   * The same clicks split by the LINK's `utm_medium`, when known.
   *
   * Needed because a paid EPC is a bid ceiling, and a bid ceiling may only be
   * divided by paid clicks. Absent, `paid.epcCents` stays null rather than
   * silently reusing the blended click count.
   */
  clicksByTrafficType?: Partial<Record<TrafficType, number>> | null;
  /** Blended attribution for the row, or null when the join failed. */
  slice: AttributedSlice | null;
  /** The same attribution split by the LEAD's `utm_medium`. */
  split?: TrafficSplit | null;
  /**
   * Ad spend in cents (Phase 2). Applied to the PAID side only — see below.
   */
  spendCents?: number | null;
}

export interface PieceEconomics {
  /**
   * Everything the row produced, paid and organic together.
   *
   * Correct for totals and for "what did this post earn". Its rates are a
   * budget-weighted average, so they are NOT a bid ceiling whenever
   * `mix.blended` is true.
   */
  blended: FunnelEconomics;
  /**
   * Paid traffic only — the side a bid is actually placed against.
   *
   * This is where `spendCents` lands, deliberately: ad spend buys paid clicks,
   * so dividing it into blended revenue would credit organic sales against an
   * ad bill and inflate ROAS. A blended ROAS is a different metric (marketing
   * efficiency) and is not implied by anything on these surfaces.
   */
  paid: FunnelEconomics;
  mix: TrafficMix;
  /** `mix.blended` — restated at the top level because it gates the bid copy. */
  blendedUnsafeForBidding: boolean;
  /**
   * Paid clicks, or null when the medium split was unavailable.
   *
   * Exposed because it is the ONLY honest gate for showing paid figures at all.
   * `paid.epcCents` is null both when a piece has no paid traffic and when paid
   * traffic earned nothing, and a surface cannot tell those apart from the
   * ratios alone — so without this it would either hide a running ad's results
   * or print a paid block on a purely organic post.
   *
   * Null, not 0: "no medium split read" is not "no paid clicks", and the second
   * would wrongly imply this piece was never advertised.
   */
  paidClicks: number | null;
}


/**
 * Compose one row's economics: the blend for totals, paid-only for bidding.
 *
 * Null-in stays null-out. A failed attribution join yields null revenue rather
 * than 0, so every derived figure reads `n/a` instead of asserting that a post
 * earned nothing.
 */
export function pieceEconomics(input: PieceEconomicsInput): PieceEconomics {
  const known = input.slice !== null && input.slice !== undefined;
  const clicksKnown = input.clicks !== null && input.clicks !== undefined;

  const blended = deriveFunnelEconomics({
    clicks: clicksKnown ? (input.clicks as number) : 0,
    optins: known ? input.slice!.optins : null,
    purchases: known ? input.slice!.purchases : null,
    revenueCents: known ? input.slice!.revenueCents : null,
    /*
     * Never the blend. Spend against blended revenue reports organic sales as a
     * return on ad spend — the flattering direction, so the one that survives
     * review.
     */
    spendCents: null
  });

  const paidSlice = input.split ? input.split.paid : null;
  const paidClicks = input.clicksByTrafficType?.paid;

  const paid = deriveFunnelEconomics({
    // 0 when the paid click count is unknown, which makes `epcCents` null via
    // `ratio`'s zero-denominator rule rather than borrowing the blended count.
    clicks: typeof paidClicks === 'number' ? paidClicks : 0,
    optins: paidSlice ? paidSlice.optins : null,
    purchases: paidSlice ? paidSlice.purchases : null,
    revenueCents: paidSlice ? paidSlice.revenueCents : null,
    spendCents: input.spendCents ?? null
  });

  const mix = trafficMix(input.split ?? null);

  return {
    blended,
    paid,
    mix,
    blendedUnsafeForBidding: mix.blended,
    // Preserved as null when the split was unreadable — see the field's comment.
    paidClicks: typeof paidClicks === 'number' ? paidClicks : null
  };
}

/**
 * The most you can pay, from PAID results only.
 *
 * Takes `PieceEconomics` rather than a `FunnelEconomics` so a caller cannot
 * hand it the blend by mistake — the single error this whole split exists to
 * prevent. Null when paid traffic has produced nothing to reason from, because
 * an invented ceiling would be read as permission to spend.
 */
export function bidCeilingSummary(economics: PieceEconomics): string | null {
  const summary = breakEvenSummary(economics.paid);
  if (!summary) return null;
  return `Paid traffic only — ${summary}`;
}

/**
 * Why the blended rates above are not the bid ceiling. Null when they are.
 *
 * One wording, so no surface can imply the opposite of another.
 */
export function blendedRateCaveat(mix: TrafficMix): string | null {
  if (!mix.blended) return null;
  return (
    'These rates blend paid and organic traffic. Organic converts better, ' +
    'so the blended break-even is higher than what an ad can safely bid — ' +
    'use the paid-only figure for that.'
  );
}

/**
 * Why attributed revenue is lower than Stripe's, in one place.
 *
 * A shared constant rather than per-surface prose: the gap is permanent and by
 * construction (`funnel_purchases` has no UTM columns), and the moment two
 * screens explain it differently someone will "fix" it by summing both numbers.
 */
export const ATTRIBUTED_REVENUE_FLOOR_NOTE =
  'Attributed revenue counts only sales that arrived through a tracked link, ' +
  'so it is a floor — direct traffic and links minted before UTM tagging show ' +
  'up in Stripe totals but cannot be traced to a post. Never add the two.';

/** Short form of the same caveat, for a stat card sub-line. */
export const ATTRIBUTED_REVENUE_FLOOR_SHORT = 'tracked links only — a floor';

/**
 * Why an ad shows earnings but no CPC, ROAS or profit.
 *
 * Every cost metric is gated on `spendCents`, which has no storage until Phase
 * 2. Without this sentence a running ad displays `n/a` in those cells, and `n/a`
 * means "not measured" everywhere else in this system — so a reader would
 * reasonably conclude the TRACKING is broken and go looking for a bug in the
 * click pipeline. The missing input is the budget, not the measurement, and only
 * the surface can say so.
 *
 * The wording deliberately does not promise a date. What it does promise is the
 * grain, because that is the decision a reader would otherwise get wrong: spend
 * is entered per CAMPAIGN, so a per-piece ROAS is not merely unbuilt, it is not
 * derivable from what ad platforms export.
 */
export const SPEND_NOT_RECORDED_NOTE =
  'Cost metrics (CPC, CPL, ROAS, profit) need ad spend, which is not recorded ' +
  'yet — the figures above are earnings only, not a return. Spend is tracked ' +
  'per campaign rather than per post, because that is the grain ad platforms ' +
  'export.';

/**
 * Paid results as a sentence, for a piece that has paid clicks.
 *
 * Separate from `bidCeilingSummary` (which is the ceiling itself) because this
 * one has to be printable when paid traffic has earned NOTHING — an ad with 200
 * clicks and no opt-ins is the single most important thing this block can say,
 * and the ceiling function correctly returns null in exactly that case.
 */
export function paidResultsSummary(economics: PieceEconomics): string | null {
  const clicks = economics.paidClicks;
  if (clicks === null || clicks <= 0) return null;

  const optins = economics.paid.optinRate;
  const parts = [`${clicks.toLocaleString()} paid ${clicks === 1 ? 'click' : 'clicks'}`];
  if (optins !== null) parts.push(`${formatRate(optins)} opted in`);
  if (economics.paid.epcCents !== null) {
    parts.push(`${formatCentsPrecise(economics.paid.epcCents)} per paid click`);
  }
  return parts.join(' · ');
}

/* ------------------------------------------------------------------ *
 * Link-row totals — the per-LINK table's one arithmetic trap
 * ------------------------------------------------------------------ *
 *
 * The planner's Tracking tab lists one row per LINK, but attribution is per
 * `utm_content` (per PIECE). A boosted post and its organic twin are two links
 * with one `utm_content`, so both rows carry the SAME piece-level opt-in and
 * revenue figures — already true of the opt-in column, and it matters far more
 * now that money is on the row.
 *
 * Summing that column down the table therefore counts those pieces twice, and
 * the table's own total would come out ABOVE the account total on /admin. Since
 * the two screens are one click apart, that discrepancy reads as a bug in the
 * smaller number and gets "fixed" in the wrong direction.
 *
 * So the totals live here, next to `sumPieceAttribution` in spirit: clicks sum
 * over rows (a click belongs to exactly one link), while leads and money sum
 * over DISTINCT `utm_content`.
 */

/** The only fields the totals need. Structurally a subset of the route's row. */
export interface LinkRowLike {
  /** The attribution key. Empty means this link cannot be joined to leads. */
  utmContent: string;
  /** All-time clicks on THIS link, from the counter. */
  clicks: number;
  /** Piece-level opt-ins, or null when the attribution join failed. */
  optins: number | null;
  /** Piece-level purchases, or null when unknown. */
  purchases?: number | null;
  /** Piece-level attributed revenue in cents, or null when unknown. */
  revenueCents?: number | null;
}

export interface LinkRowTotals {
  /** Rows counted. */
  links: number;
  /** Distinct non-empty `utm_content` values — what the money is summed over. */
  pieces: number;
  /** Clicks summed over ROWS, which is correct: a click belongs to one link. */
  clicks: number;
  /**
   * Pieces reached by more than one link.
   *
   * Surfaced so the table can say why two rows show identical lead numbers,
   * instead of leaving a reader to conclude one of them is wrong.
   */
  duplicatedPieces: number;
  /** Links with no `utm_content`: their clicks can never be attributed. */
  untaggedLinks: number;

  /**
   * Leads/money over distinct pieces, or null when attribution was unavailable.
   *
   * Null if ANY row is null rather than summing the rest: the route nulls every
   * row together when the join fails, and a partial sum presented as a total
   * understates revenue while looking authoritative.
   */
  optins: number | null;
  purchases: number | null;
  revenueCents: number | null;
  /**
   * The same three numbers shaped for `pieceEconomics`, or null when unknown —
   * so the table's summary strip derives EPC through the shared helper instead
   * of dividing two of its own columns.
   */
  slice: AttributedSlice | null;
}

/**
 * Total a per-link table without double-counting the pieces behind it.
 *
 * The first row seen for a `utm_content` contributes its lead figures; later
 * rows for the same piece contribute only their clicks. That asymmetry IS the
 * function — see the section comment above.
 */
export function summarizeLinkRows(
  rows: Array<LinkRowLike | null | undefined>
): LinkRowTotals {
  const present = rows.filter(Boolean) as LinkRowLike[];

  const seen = new Set<string>();
  const duplicated = new Set<string>();
  let clicks = 0;
  let untaggedLinks = 0;
  let attributionKnown = true;

  const pieceSlices: AttributedSlice[] = [];

  for (const row of present) {
    clicks += Math.max(0, Math.floor(row.clicks || 0));

    const key = (row.utmContent || '').trim();
    if (!key) {
      // No join key at all. Its clicks are real and counted; its leads can never
      // be known, which is a different statement from "it has none".
      untaggedLinks += 1;
      continue;
    }

    if (seen.has(key)) {
      duplicated.add(key);
      continue;
    }
    seen.add(key);

    if (row.optins === null || row.optins === undefined) {
      attributionKnown = false;
      continue;
    }

    pieceSlices.push({
      optins: row.optins,
      purchases: row.purchases ?? 0,
      revenueCents: row.revenueCents ?? 0
    });
  }

  const totals = attributionKnown ? sumAttributedSlices(pieceSlices) : null;

  return {
    links: present.length,
    pieces: seen.size,
    clicks,
    duplicatedPieces: duplicated.size,
    untaggedLinks,
    optins: totals ? totals.optins : null,
    purchases: totals ? totals.purchases : null,
    revenueCents: totals ? totals.revenueCents : null,
    slice: totals
  };
}

/**
 * Which `utm_content` values appear on more than one row.
 *
 * The table uses this to mark the rows whose lead numbers are shared, because
 * the alternative — two rows showing the same 12 opt-ins with no explanation —
 * is read as a duplication bug and "corrected" by whoever notices it next.
 */
export function duplicatedPieceKeys(
  rows: Array<LinkRowLike | null | undefined>
): Set<string> {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  (rows.filter(Boolean) as LinkRowLike[]).forEach((row) => {
    const key = (row.utmContent || '').trim();
    if (!key) return;
    if (seen.has(key)) dupes.add(key);
    else seen.add(key);
  });
  return dupes;
}

/**
 * The per-piece sentence both client surfaces print under the numbers.
 *
 * One function rather than JSX in two components: the Metrics tab and the
 * Preview tab's link panel show the same block, and the moment the wording is
 * written twice one of them stops saying "attributed".
 */
export function pieceResultSummary(economics: PieceEconomics): string | null {
  const parts: string[] = [];
  if (economics.blended.optinRate !== null) {
    parts.push(`${formatRate(economics.blended.optinRate)} of clicks opted in`);
  }
  if (economics.blended.epcCents !== null) {
    parts.push(`${formatCentsPrecise(economics.blended.epcCents)} per click`);
  }
  if (economics.blended.aovCents !== null) {
    parts.push(`${formatCents(economics.blended.aovCents)} per sale`);
  }
  return parts.length ? parts.join(' · ') : null;
}


