'use client';

/**
 * Measured link performance for one piece — the block shown on the Metrics tab,
 * and the shared cells/rules the Preview tab's `PieceLinkPanel` renders too.
 *
 * WHY THIS SITS NEXT TO THE HAND-TYPED METRICS, BUT LABELLED APART
 * ---------------------------------------------------------------
 * Everything else on the Metrics tab is self-reported: an admin reads likes off
 * Instagram and types them in. These three numbers are the opposite — nobody
 * types them, they come from the redirect table and the lead/purchase joins. Put
 * side by side with no distinction, a typed `views` and a measured `clicks` read
 * as equally trustworthy, and the typed one is the one that silently goes stale
 * the moment somebody forgets to update it. So the measured set is boxed and
 * captioned "measured", and the manual fields keep the tab's normal styling.
 *
 * WHY THE DERIVATION IS A SHARED FUNCTION AND NOT REPEATED IN BOTH COMPONENTS
 * -------------------------------------------------------------------------
 * `pieceMetricValues` is the single place that turns the payload into displayable
 * values. Two surfaces now show the same three numbers from the same fetch, and
 * the rule that matters — a failed read renders `n/a`, a successful read with no
 * row renders `0` — is exactly the kind of rule that gets re-implemented slightly
 * differently on the second surface. If it lived in both files, one of them would
 * eventually collapse `n/a` into `0`, and an unapplied migration would start
 * reading as "this post got no clicks": a false statement an admin acts on by
 * killing a post that was never measured in the first place.
 */

import React from 'react';
import { MousePointerClick, Loader2, AlertCircle } from 'lucide-react';
import type { ContentPiece } from '@/lib/mothermode/content';

import {
  usePieceLinks,
  usePieceMetrics,
  type PieceMetricsPayload
} from './pieceLinks';
import {
  readPeople,
  peopleLabel,
  type PeopleReading
} from '@/lib/mothermode/planner/clickPeople';
import {
  ATTRIBUTED_REVENUE_FLOOR_SHORT,
  bidCeilingSummary,
  blendedRateCaveat,
  formatCents,
  formatCentsPrecise,
  formatRate,
  paidResultsSummary,
  pieceEconomics,
  SPEND_NOT_RECORDED_NOTE,
  type PieceEconomics
} from '@/lib/mothermode/planner/adMetrics';



/** What the two surfaces display, after the availability rules are applied. */
export interface PieceMetricValues {
  /** null means "could not be read" — render `n/a`. 0 means "measured zero". */
  clicks: number | null;
  optins: number | null;
  purchases: number | null;
  /** Clicks landed but nobody opted in: the hook works, the page doesn't. */
  trafficNoConversion: boolean;
  /**
   * How many PEOPLE, over `windowDays` — not over all time like `clicks`.
   *
   * Null when the click read failed. Inside it, `people` can itself be null when
   * clicks arrived with no IP hash to distinguish them (every click on a dev box,
   * for instance), which is why this is a reading and not a number.
   */
  people: PeopleReading | null;
  /** Clicks inside that window — the number `people` is actually a share of. */
  windowClicks: number;
  windowDays: number;
  /** The window was cut short by the log's row cap, so `people` is a floor. */
  windowTruncated: boolean;
  /** Ready-made "3 people" / "at least 3 people" / "not measurable". */
  peopleText: string;
  /**
   * Attributed revenue in cents, or null when the join failed. A FLOOR — see
   * `ATTRIBUTED_REVENUE_FLOOR_SHORT`, which every surface prints beside it.
   */
  revenueCents: number | null;
  /**
   * The ratios, blended and paid-only, from the shared module.
   *
   * Composed here rather than in each component for the same reason
   * `pieceMetricValues` exists at all: the paid side is only a bid ceiling if it
   * was built from paid clicks and paid leads, and a second surface assembling
   * that itself is a second chance to divide by the blended click count.
   */
  economics: PieceEconomics;
}



/**
 * Turn the raw payload into display values for one piece.
 *
 * Keyed by piece id because `utm_content` IS the piece id — that equality is the
 * whole join, so no lookup table is needed. A missing key is a true zero, but
 * *only* when the read succeeded; when it didn't, the value is null so the cell
 * can say `n/a` instead of asserting a measurement that never happened.
 */
export function pieceMetricValues(
  metrics: PieceMetricsPayload,
  pieceId: string
): PieceMetricValues {
  const clicks = metrics.clicksAvailable
    ? (metrics.clicksByPieceId[pieceId] ?? 0)
    : null;
  const optins = metrics.attributionAvailable
    ? (metrics.optinsByPieceId[pieceId] ?? 0)
    : null;
  const purchases = metrics.attributionAvailable
    ? (metrics.purchasesByPieceId[pieceId] ?? 0)
    : null;

  /*
   * People come from the WINDOW, so they are paired with the window's own click
   * count — never with `clicks` above, which is the all-time counter. That
   * pairing is the entire reason `windowClicksByPieceId` is in the payload:
   * `clicks / people` would divide 90 days of clicks by 30 days of visitors and
   * print a confident, wrong "clicks per person".
   */
  const windowClicks = metrics.windowClicksByPieceId[pieceId] ?? 0;
  const people = metrics.clicksAvailable
    ? readPeople({
        recentClicks: windowClicks,
        uniqueClicks: metrics.uniqueClicksByPieceId[pieceId] ?? 0,
        unattributedClicks: metrics.unattributedClicksByPieceId[pieceId] ?? 0
      })
    : null;

  const revenueCents = metrics.attributionAvailable
    ? (metrics.revenueCentsByPieceId[pieceId] ?? 0)
    : null;

  /*
   * `clicks` here is the ALL-TIME counter, matching all-time attribution — never
   * `windowClicks` above. That pairing is the single most plausible mistake on
   * this surface: 30-day clicks under all-time revenue produces an EPC several
   * times too high, and nothing about the output looks wrong.
   */
  const economics = pieceEconomics({
    clicks,
    clicksByTrafficType: metrics.clickMediumSplitByPieceId[pieceId] ?? null,
    slice:
      revenueCents !== null && optins !== null && purchases !== null
        ? { optins, purchases, revenueCents }
        : null,
    // Absent key = this piece has no leads, so there is no split to speak of;
    // null (not an all-zero split) keeps the paid figures at `n/a` rather than
    // claiming paid traffic converted nobody.
    split: metrics.attributionAvailable
      ? (metrics.trafficSplitByPieceId[pieceId] ?? null)
      : null,
    // Phase 2. Until spend is stored every cost metric reads `n/a`, which is the
    // truthful rendering of "no spend recorded" and not "this traffic was free".
    spendCents: null
  });

  return {
    clicks,
    optins,
    purchases,
    // Floored at 5 clicks so one link-preview-adjacent hit doesn't accuse a
    // brand-new post of failing before it has had a real audience.
    trafficNoConversion:
      clicks !== null && optins !== null && clicks >= 5 && optins === 0,
    people,
    windowClicks,
    windowDays: metrics.clickWindowDays,
    windowTruncated: metrics.clickWindowTruncated,
    peopleText: people ? peopleLabel(people) : 'n/a',
    revenueCents,
    economics
  };
}


/**
 * The people line, shared by both surfaces.
 *
 * Rendered as a SENTENCE rather than a fourth metric cell, deliberately. The
 * three cells are all-time; this is 30 days. Dropping a window-scoped number
 * into the same grid with the same styling is how "Clicks 40 / People 3" gets
 * read as "40 clicks from 3 people" — which is exactly the false statement the
 * payload split was designed to prevent. A sentence has room to say which period
 * it means, and a cell does not.
 */
export const PeopleLine: React.FC<{ values: PieceMetricValues }> = ({
  values
}) => {
  const { people, windowClicks, windowDays, windowTruncated, peopleText } =
    values;

  // Nothing measured in the window: silent. "0 people in 30 days" on a post from
  // last quarter is noise, not information — its all-time clicks are right above.
  if (!people || windowClicks === 0) return null;

  return (
    <p className="mt-3 text-xs text-ink/55">
      In the last {windowDays} days:{' '}
      <strong className="font-semibold text-ink">
        {windowClicks.toLocaleString()}
      </strong>{' '}
      {windowClicks === 1 ? 'click' : 'clicks'} from{' '}
      <strong className="font-semibold text-ink">{peopleText}</strong>.
      {people.people === null &&
        ' Those clicks arrived without an IP to tell them apart, which is normal in local development.'}
      {windowTruncated &&
        ' The click log hit its row cap, so this covers less than the full period.'}
      {people.selfTrafficLikely && (
        <>
          {' '}
          That is a lot of clicks from very few people — most likely you opening
          your own link rather than an audience. Check it against the platform
          before reading it as traction.
        </>
      )}
    </p>
  );
};


/** One metric cell. `value === null` renders `n/a`, which is not the same as 0. */
export const Metric: React.FC<{ label: string; value: number | null }> = ({
  label,
  value
}) => (
  <div className="min-w-0">
    <div className="text-lg font-semibold leading-none text-ink">
      {value === null ? (
        <span className="text-ink/35">n/a</span>
      ) : (
        value.toLocaleString()
      )}
    </div>
    <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-ink/45">
      {label}
    </div>
  </div>
);

/**
 * Money and rates for one piece — the block BOTH client surfaces render.
 *
 * A component, not copied JSX, for the reason `pieceMetricValues` is a function:
 * three of these lines are qualifications rather than numbers (the floor note,
 * the paid-only ceiling, the blend caveat), and a qualification that exists on
 * one screen and not the other is worse than none — a reader who saw the caveat
 * once concludes its absence elsewhere means the number is safe to bid on.
 *
 * Silent when there is nothing to say: no attribution at all renders nothing,
 * because an empty money block on a post with no leads is just noise beside the
 * zeros already above it.
 */
export const PieceMoneyLines: React.FC<{ values: PieceMetricValues }> = ({
  values
}) => {
  const { revenueCents, economics } = values;

  /*
   * Paid clicks keep this block alive even with nothing earned yet, and that
   * exception is the point: an ad with 200 paid clicks and no opt-ins is the
   * most urgent thing this component can say. The generic "nothing happened
   * yet" silence below is right for an organic post and wrong for a live ad,
   * because one is waiting and the other is spending.
   */
  const paidClicks = economics.paidClicks ?? 0;

  // Null revenue = the join failed, and that is already stated by the degraded
  // note. Zero revenue with zero opt-ins = nothing has happened yet.
  if (revenueCents === null) return null;
  if (revenueCents === 0 && (values.optins ?? 0) === 0 && paidClicks === 0) {
    return null;
  }

  const ceiling = bidCeilingSummary(economics);
  const caveat = blendedRateCaveat(economics.mix);
  const paidResults = paidResultsSummary(economics);

  return (
    <div className="mt-3.5 border-t border-ink/10 pt-3">
      <div className="grid grid-cols-3 gap-3">
        {/*
          "Attributed", never "Revenue". The number in Stripe is larger and more
          complete; labelling this one "Revenue" invites someone to reconcile the
          two, and the only way to make them agree is to add them — which
          double-counts every tracked sale.
        */}
        <MoneyCell
          label="Attributed"
          value={formatCents(revenueCents)}
          sub={ATTRIBUTED_REVENUE_FLOOR_SHORT}
        />
        {/* Three decimals below a dollar: $0.03 vs $0.04 is a third of a bid. */}
        <MoneyCell
          label="Per click"
          value={formatCentsPrecise(economics.blended.epcCents)}
        />
        <MoneyCell
          label="Opt-in rate"
          value={formatRate(economics.blended.optinRate)}
        />
      </div>

      {economics.mix.label && (
        <p className="mt-2.5 text-xs text-ink/45">
          Leads from {economics.mix.label}.
        </p>
      )}

      {/*
        The bid ceiling comes from `bidCeilingSummary`, which takes the whole
        `PieceEconomics` and reads only its paid side — so this line physically
        cannot be built from the blended figures above it.
      */}
      {ceiling && <p className="mt-1.5 text-xs text-ink/60">{ceiling}</p>}

      {caveat && <p className="mt-1.5 text-xs text-ink/45">{caveat}</p>}

      {/*
        THE PAID BLOCK — only for pieces that actually ran as ads.
        Gated on `paidClicks`, never on the piece's format: an "ads"-sized
        creative that was never boosted has no paid results, and a plain feed
        post that WAS boosted does. The medium on the link is the fact; the
        aspect ratio is an intention.
      */}
      {paidResults && (
        <div className="mt-2.5 border-t border-ink/10 pt-2.5">
          <p className="text-xs font-semibold text-ink/70">Paid traffic</p>
          <p className="mt-1 text-xs text-ink/60">{paidResults}</p>
          {/*
            Says why the cost half of the table is missing. Without it, six
            `n/a` cost cells on a live ad read as broken click tracking rather
            than as an unrecorded budget — and someone debugs the wrong system.
          */}
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink/40">
            {SPEND_NOT_RECORDED_NOTE}
          </p>
        </div>
      )}
    </div>
  );
};

/** A money/rate cell. Pre-formatted, because `n/a` is a string, not a number. */
const MoneyCell: React.FC<{ label: string; value: string; sub?: string }> = ({
  label,
  value,
  sub
}) => (
  <div className="min-w-0">
    <div className="text-base font-semibold leading-none text-ink tabular-nums">
      {value === 'n/a' ? <span className="text-ink/35">n/a</span> : value}
    </div>
    <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-ink/45">
      {label}
    </div>
    {/* Omitted entirely when absent — never rendered as an empty line. */}
    {sub && <div className="mt-0.5 text-[10px] text-ink/35">{sub}</div>}
  </div>
);

/**
 * The Metrics-tab block: measured clicks, opt-ins and purchases for this piece.

 *
 * It reads the link map as well as the roll-ups so it can tell the two zero-cases
 * apart. "No tracked link exists" and "the link exists and nobody clicked" both
 * produce 0 from the roll-up, but they call for opposite actions — mint a link
 * versus change the post — and only the second is a verdict on the content.
 */
export const PieceClickMetrics: React.FC<{
  piece: ContentPiece;
  offerSlug: string;
}> = ({ piece, offerSlug }) => {
  const metrics = usePieceMetrics();
  const { linkByPieceId, ready: linksReady } = usePieceLinks(offerSlug);

  const values = pieceMetricValues(metrics, piece.id);
  const { clicks, optins, purchases, trafficNoConversion } = values;

  const hasLink = Boolean(linkByPieceId[piece.id]);

  const degraded = !metrics.clicksAvailable || !metrics.attributionAvailable;

  // Clicks per purchase, not the reverse: "how much traffic does one sale cost"
  // is the number that sizes the next campaign. Guarded on purchases > 0 because
  // dividing by zero would print Infinity, and 0 sales is the common case.
  const clicksPerPurchase =
    clicks !== null && purchases !== null && purchases > 0
      ? Math.round(clicks / purchases)
      : null;

  return (
    <section className="rounded-xl border border-ink/10 bg-white/60 p-4">
      <div className="flex items-center gap-2">
        <MousePointerClick className="h-4 w-4 text-mode" />
        <h4 className="text-sm font-semibold text-ink">Tracked link results</h4>
        <span className="ml-auto text-[10px] uppercase tracking-[0.16em] text-ink/40">
          Measured
        </span>
      </div>

      <p className="mt-1.5 text-xs text-ink/55">
        Counted server-side from this post&apos;s tracked link — not typed in.
        The fields below are the ones you enter by hand from the platform.
      </p>

      {!metrics.ready ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-ink/45">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading clicks…
        </p>
      ) : (
        <>
          <div className="mt-3.5 grid grid-cols-3 gap-3">
            <Metric label="Clicks" value={clicks} />
            <Metric label="Opt-ins" value={optins} />
            <Metric label="Purchases" value={purchases} />
          </div>

          {/*
            All-time money, so it sits with the all-time grid above it and ABOVE
            the 30-day people line — the ordering keeps the two periods from
            reading as one set of figures.
          */}
          <PieceMoneyLines values={values} />

          {/* Window-scoped, so it sits below the all-time grid, not inside it. */}
          <PeopleLine values={values} />


          {clicksPerPurchase !== null && (

            <p className="mt-3 text-xs text-ink/55">
              About{' '}
              <strong className="font-semibold text-ink">
                {clicksPerPurchase.toLocaleString()}
              </strong>{' '}
              clicks per purchase from this post.
            </p>
          )}

          {trafficNoConversion && (
            <p className="mt-3 rounded-lg bg-mode/10 px-3 py-2 text-xs text-ink/75">
              Clicks are landing but nobody opted in — the hook is working and
              the page it points at isn&apos;t. Change the destination before
              rewriting the post.
            </p>
          )}

          {/*
            Only stated once the link map has actually loaded. Saying "no tracked
            link yet" while the lookup is still in flight would be a guess, and
            the admin would go mint a second link for a piece that already has
            one.
          */}
          {linksReady && !hasLink && clicks === 0 && (
            <p className="mt-3 text-xs text-ink/55">
              This post has no tracked link yet, so these zeros aren&apos;t a
              verdict on it — nothing was being counted. Mint one on the Preview
              tab.
            </p>
          )}

          {degraded && (
            <p className="mt-3 text-xs text-ink/45">
              Showing <code>n/a</code> where numbers couldn&apos;t be read
              {metrics.error ? `: ${metrics.error}` : ''}. Clicks and opt-ins are
              separate reads — one can fail while the other is accurate.
            </p>
          )}
        </>
      )}

      {metrics.ready && metrics.error && !degraded && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-ink/45">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {metrics.error}
        </p>
      )}
    </section>
  );
};
