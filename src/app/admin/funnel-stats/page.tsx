import { getFunnelStats } from '@/utils/supabase/admin';
import {
  getClickRollupsSafe,
  getPieceAttributionSafe,
  sumPieceAttribution
} from '@/lib/mothermode/planner/links';
import { peopleLabel, readPeople } from '@/lib/mothermode/planner/clickPeople';
import {
  ATTRIBUTED_REVENUE_FLOOR_NOTE,
  bidCeilingSummary,
  blendedRateCaveat,
  formatCents,
  formatCentsPrecise,
  formatRate,
  pieceEconomics
} from '@/lib/mothermode/planner/adMetrics';


import DownloadCsvButton from './DownloadCsvButton';
import FunnelVisualization from './FunnelVisualization';

export const dynamic = 'force-dynamic';

const fmt = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export default async function FunnelStatsPage() {
  const [stats, clicks, attribution] = await Promise.all([
    getFunnelStats(50),
    getClickRollupsSafe(),
    getPieceAttributionSafe(),
  ]);

  /*
   * Clicks sit at the TOP of this funnel, keyed by piece, not by funnel.
   *
   * This page's breakdowns are Stripe products and page types — there is no
   * mothermode funnel id in scope to index `byFunnelId` with, so pretending to
   * show "clicks per funnel" here would mean inventing a join that doesn't
   * exist. What IS available and useful is which *posts* sent the traffic.

   */
  /*
   * Rows are the UNION of pieces with clicks and pieces with leads, not just the
   * click map.
   *
   * The two can diverge in both directions and each divergence is a finding: a
   * piece with clicks and no opt-ins is a landing-page problem, and a piece with
   * opt-ins but no clicks means its link was shared untracked (or the click read
   * failed) — filtering to the click map would hide the second case entirely,
   * along with whatever revenue it earned.
   */
  const pieceKeys = new Set<string>(Object.keys(clicks?.byPieceId || {}));
  attribution?.forEach((_value, key) => pieceKeys.add(key));

  const topPieces = Array.from(pieceKeys)
    .map((piece) => {
      const pieceClicks = clicks ? clicks.byPieceId[piece] ?? 0 : null;
      const slice = attribution?.get(piece) ?? null;
      return {
        piece,
        clicks: pieceClicks,
        slice,
        economics: pieceEconomics({
          clicks: pieceClicks,
          clicksByTrafficType: clicks?.mediumSplitByPieceId[piece] ?? null,
          // A piece present in the click map but absent from attribution has
          // genuinely earned nothing yet — a zeroed slice, not an unknown one.
          slice: attribution ? slice ?? { optins: 0, purchases: 0, revenueCents: 0 } : null,
          split: slice ? slice.byTrafficType : null,
        }),
      };
    })
    /*
     * Sorted by attributed revenue first, clicks second.
     *
     * Clicks were the only available ranking before; now that money is on the
     * row, ordering by clicks would put a viral post that sold nothing above the
     * quiet one paying for the ads.
     */
    .sort(
      (a, b) =>
        (b.slice?.revenueCents ?? 0) - (a.slice?.revenueCents ?? 0) ||
        (b.clicks ?? 0) - (a.clicks ?? 0)
    )
    .slice(0, 8);

  // Account-wide, for the caveats under the table. Deliberately not rendered as
  // a stat card next to Stripe's "Total revenue" — see the note below the table.
  const attributed = sumPieceAttribution(attribution);
  const accountEconomics = pieceEconomics({
    clicks: clicks ? clicks.totalClicks : null,
    clicksByTrafficType: clicks ? clicks.clicksByTrafficType : null,
    slice: attribution ? attributed : null,
    split: attribution ? attributed.byTrafficType : null,
  });

  /*
   * "…from 3 people" under the 30d click count.
   *
   * Undefined (not an empty string) when there is nothing honest to say, so the
   * card renders exactly as it did before rather than growing a blank sub-line.
   * `readPeople` returns people: null when every click lacked an IP hash, which
   * on a dev box is the normal case — printing "from 0 people" next to 40 clicks
   * would be the most alarming and least true thing on the page.
   */
  const peopleReading = clicks ? readPeople(clicks) : null;
  const peopleSub =
    peopleReading && peopleReading.people !== null && clicks?.recentClicks
      ? `from ${peopleLabel(peopleReading)}` +
        (peopleReading.selfTrafficLikely ? ' — likely mostly you' : '')
      : undefined;



  return (
    <div>
      <div className="text-xs uppercase tracking-[0.25em] text-brass/80 font-semibold mb-2">
        Conversion
      </div>
      <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">Funnel Stats</h1>
      <p className="mt-2 text-bone/60">
        Conversions recorded via{' '}
        <code className="text-brass/90">payment_intent.succeeded</code> and{' '}
        <code className="text-brass/90">
          checkout.session.completed
        </code>
        .
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
        <StatCard label="Total revenue" value={fmt(stats.totalCents)} />
        <StatCard label="Purchases" value={String(stats.totalCount)} />
        <StatCard
          label="Unique customers"
          value={String(stats.uniqueCustomers)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
        <StatCard
          label="Tracked clicks (all-time)"
          value={clicks ? String(clicks.totalClicks) : 'n/a'}
        />
        {/*
          The 30d card carries the people count as its own sub-line rather than a
          fourth card. `Unique customers` is already on this page two rows up, and
          two separately-defined "unique" numbers side by side invite the reader to
          compare them — but one counts Stripe customers all-time and the other
          counts distinct IPs over 30 days, so the comparison is meaningless.
        */}
        <StatCard
          label="Tracked clicks (30d)"
          value={clicks ? String(clicks.recentClicks) : 'n/a'}
          sub={peopleSub}
        />

        <StatCard
          label="Clicks per purchase"
          value={
            !clicks || stats.totalCount === 0
              ? 'n/a'
              : (clicks.totalClicks / stats.totalCount).toFixed(1)
          }
        />
      </div>
      <p className="mt-2 text-xs text-bone/40">
        {clicks
          ? 'Clicks come from tracked planner links; purchases come from Stripe. They are not a matched pair — a click can convert weeks later, and direct traffic buys without one.'
          : 'Planner link tracking unavailable — these read n/a rather than 0 so an unapplied migration is not mistaken for no traffic.'}
      </p>

      <h2 className="font-display text-2xl font-semibold mt-12 mb-4 tracking-tight">Funnel conversion</h2>
      <FunnelVisualization byPageType={stats.byPageType} />

      <h2 className="font-display text-2xl font-semibold mt-12 mb-4 tracking-tight">
        Traffic by post
      </h2>
      <div className="rounded-2xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 backdrop-blur overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bone/[0.03] text-brass/80 uppercase tracking-wider text-xs">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Piece (utm_content)</th>
              <th className="text-right px-4 py-3 font-semibold">Clicks</th>
              <th className="text-right px-4 py-3 font-semibold">Opt-ins</th>
              <th className="text-right px-4 py-3 font-semibold">Opt-in rate</th>
              {/* "Attributed", not "Revenue" — this column is a floor. */}
              <th className="text-right px-4 py-3 font-semibold">Attributed rev.</th>
              <th className="text-right px-4 py-3 font-semibold">Per click</th>
            </tr>
          </thead>
          <tbody>
            {topPieces.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-bone/40">
                  {clicks
                    ? 'No tracked link has been clicked yet. Mint a link on a planner card and share it.'
                    : 'Planner link tracking unavailable.'}
                </td>
              </tr>
            )}
            {topPieces.map((row) => (
              <tr
                key={row.piece}
                className="border-t border-bone/5 hover:bg-bone/[0.02] transition-colors"
              >
                <td className="px-4 py-2 font-mono text-xs">{row.piece}</td>
                {/* n/a, not 0: this piece has leads, so its clicks are unknown
                    rather than absent. */}
                <td className="px-4 py-2 text-right tabular-nums">
                  {row.clicks === null ? 'n/a' : row.clicks}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {attribution ? row.slice?.optins ?? 0 : 'n/a'}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-bone/60">
                  {formatRate(row.economics.blended.optinRate)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {attribution ? formatCents(row.slice?.revenueCents ?? 0) : 'n/a'}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-bone/60">
                  {formatCentsPrecise(row.economics.blended.epcCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 space-y-1 text-xs text-bone/40">
        {/*
          THE GAP THAT MUST NOT BE "FIXED".
          Attributed revenue will always be below the Total revenue card at the
          top of this page, and adding the two would double-count every tracked
          sale. Stated on the same screen as both numbers, because this is the one
          page where a reader can see them disagree.
        */}
        <p>{ATTRIBUTED_REVENUE_FLOOR_NOTE}</p>
        <p>
          Top 8 by attributed revenue, so this column does not sum to any total
          above. Rates here are per piece and all-time — the same window as the
          click counter, and not the 30-day numbers in the cards above.
        </p>
        {blendedRateCaveat(accountEconomics.mix) && (
          <p className="text-brass/60">{blendedRateCaveat(accountEconomics.mix)}</p>
        )}
        {bidCeilingSummary(accountEconomics) && (
          <p className="text-brass/60">
            Account-wide: {bidCeilingSummary(accountEconomics)}
          </p>
        )}
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-10">
        <BreakdownTable
          title="By product"
          rows={stats.byProduct.map((r) => ({
            key: r.product_id,
            count: r.count,
            totalCents: r.totalCents
          }))}
        />
        <BreakdownTable
          title="By page type"
          rows={stats.byPageType.map((r) => ({
            key: r.page_type,
            count: r.count,
            totalCents: r.totalCents
          }))}
        />
      </div>

      <h2 className="font-display text-2xl font-semibold mt-12 mb-4 tracking-tight">Last 30 days</h2>
      <DailyChart series={stats.byDay} />

      <div className="flex items-center justify-between mt-12 mb-4">
        <h2 className="font-display text-2xl font-semibold tracking-tight">Recent purchases</h2>
        <DownloadCsvButton rows={stats.recent as any} />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 backdrop-blur">
        <table className="w-full text-sm">
          <thead className="bg-bone/[0.03] text-brass/80 uppercase tracking-wider text-xs">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">When</th>
              <th className="text-left px-4 py-3 font-semibold">Product</th>
              <th className="text-left px-4 py-3 font-semibold">Page</th>
              <th className="text-left px-4 py-3 font-semibold">Customer</th>
              <th className="text-right px-4 py-3 font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {stats.recent.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-bone/40">
                  No purchases yet. Run a checkout to populate.
                </td>
              </tr>
            )}
            {stats.recent.map((r) => (
              <tr key={r.id} className="border-t border-bone/5 hover:bg-bone/[0.02] transition-colors">
                <td className="px-4 py-2.5 whitespace-nowrap text-bone/60">
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2.5">{r.product_id ?? '-'}</td>
                <td className="px-4 py-2.5">{r.page_type ?? '-'}</td>
                <td className="px-4 py-2.5">
                  <div>{r.customer_name ?? '-'}</div>
                  <div className="text-bone/40">
                    {r.customer_email ?? '-'}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {fmt(r.amount_cents ?? 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub
}: {
  label: string;
  value: string;
  /** Optional qualifier. Omitted entirely when absent — never rendered empty. */
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 backdrop-blur p-5 shadow-[0_0_30px_rgba(168,139,92,0.06)]">
      <div className="text-xs uppercase tracking-wider text-brass/70 font-semibold">{label}</div>
      <div className="mt-2 text-3xl font-bold tabular-nums tracking-tight">{value}</div>
      {sub && <div className="text-xs text-bone/40 mt-1">{sub}</div>}
    </div>
  );
}


function BreakdownTable({
  title,
  rows
}: {
  title: string;
  rows: Array<{ key: string; count: number; totalCents: number }>;
}) {
  return (
    <div className="rounded-2xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 backdrop-blur overflow-hidden">
      <div className="px-4 py-3 border-b border-bone/10 text-xs uppercase tracking-wider text-brass/80 font-semibold">
        {title}
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td className="px-4 py-3 text-bone/40" colSpan={3}>
                No data yet.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-bone/5 hover:bg-bone/[0.02] transition-colors">
              <td className="px-4 py-2">{r.key}</td>
              <td className="px-4 py-2 text-right text-bone/60 tabular-nums">
                {r.count}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {fmt(r.totalCents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DailyChart({
  series
}: {
  series: Array<{ day: string; count: number; totalCents: number }>;
}) {
  const max = Math.max(1, ...series.map((s) => s.totalCents));
  const totalCents = series.reduce((s, d) => s + d.totalCents, 0);
  return (
    <div className="rounded-2xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 backdrop-blur p-5 shadow-[0_0_30px_rgba(168,139,92,0.06)]">
      <div className="flex items-baseline justify-between mb-4">
        <div className="text-xs uppercase tracking-wider text-brass/70 font-semibold">Daily revenue</div>
        <div className="text-sm text-bone/60">
          30-day total{' '}
          <span className="text-bone font-semibold tabular-nums">
            {fmt(totalCents)}
          </span>
        </div>
      </div>
      <div className="flex items-end gap-1 h-40">
        {series.map((d) => {
          const heightPct = (d.totalCents / max) * 100;
          return (
            <div
              key={d.day}
              className="flex-1 flex flex-col items-center group"
              title={`${d.day}: ${fmt(d.totalCents)} (${d.count} sale${d.count === 1 ? '' : 's'})`}
            >
              <div
                className="w-full bg-gradient-to-t from-brass to-brass/60 group-hover:from-brass/90 group-hover:to-brass/50 rounded-t transition-colors"
                style={{ height: `${Math.max(heightPct, d.totalCents > 0 ? 4 : 0)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-bone/40 tabular-nums">
        <span>{series[0]?.day}</span>
        <span>{series[Math.floor(series.length / 2)]?.day}</span>
        <span>{series[series.length - 1]?.day}</span>
      </div>
    </div>
  );
}
