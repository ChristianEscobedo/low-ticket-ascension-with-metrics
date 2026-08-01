import Link from 'next/link';
import { getOverviewStats } from '@/utils/supabase/admin';
import MissionControl from './MissionControl';
import {
  getClickRollupsSafe,
  getPieceAttributionSafe,
  sumPieceAttribution
} from '@/lib/mothermode/planner/links';
import { peopleLabel, readPeople } from '@/lib/mothermode/planner/clickPeople';
import {
  ATTRIBUTED_REVENUE_FLOOR_NOTE,
  ATTRIBUTED_REVENUE_FLOOR_SHORT,
  bidCeilingSummary,
  blendedRateCaveat,
  formatCents,
  formatCentsPrecise,
  pieceEconomics
} from '@/lib/mothermode/planner/adMetrics';

export const dynamic = 'force-dynamic';



const fmt = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export default async function AdminOverviewPage() {
  const [stats, clicks, attribution] = await Promise.all([
    getOverviewStats(),
    getClickRollupsSafe(),
    /*
     * Third read, independently fallible. Attribution can fail while clicks
     * succeed (different tables, different migrations), and this page's job is
     * revenue — a lead-join failure must not blank the Stripe cards above.
     */
    getPieceAttributionSafe(),
  ]);

  /*
   * Derived here rather than inside the JSX because the roll-up can be null —
   * `getClickRollupsSafe` returns null when the planner migration isn't applied,
   * and the whole card already renders `n/a` in that case. Reading people off a
   * null would be the one place this dashboard could crash on a fresh database.
   */
  const peopleReading = clicks ? readPeople(clicks) : null;
  const peopleSuffix =
    peopleReading && peopleReading.people !== null && clicks?.recentClicks
      ? peopleLabel(peopleReading)
      : '';

  /*
   * Account-level economics.
   *
   * Both inputs are ALL-TIME on purpose: `totalClicks` is the counter, and
   * attribution has no window at all. The 30-day `recentClicks` sitting two
   * lines above is the tempting denominator and the wrong one — dividing
   * all-time revenue by a month of clicks would inflate EPC by however long
   * this account has been running, and the result looks entirely plausible.
   */
  const attributed = sumPieceAttribution(attribution);
  const economics = pieceEconomics({
    clicks: clicks ? clicks.totalClicks : null,
    clicksByTrafficType: clicks ? clicks.clicksByTrafficType : null,
    // null, not the zeroed total, when the read failed: `n/a` rather than $0.00.
    slice: attribution ? attributed : null,
    split: attribution ? attributed.byTrafficType : null,
  });
  const bidCeiling = bidCeilingSummary(economics);
  const blendWarning = blendedRateCaveat(economics.mix);



  return (
    <div>
      <div className="text-xs uppercase tracking-[0.25em] text-brass/80 font-semibold mb-2">
        Dashboard
      </div>
      <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">Overview</h1>
      <p className="mt-2 text-bone/60">
        High-level view of revenue, subscriptions, and recent activity.
      </p>

      {/* the loop as the home screen: what the crew is doing right now,
          what it spent today, and what's waiting on your yes */}
      <MissionControl />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        <StatCard
          label="Revenue (30d)"
          value={fmt(stats.revenue30dCents)}
          sub={`${stats.purchases30d} sales`}
        />
        <StatCard
          label="Revenue (all-time)"
          value={fmt(stats.totalRevenueCents)}
          sub={`${stats.totalPurchases} sales`}
        />
        <StatCard
          label="Active subscriptions"
          value={String(stats.activeSubscriptions)}
        />
        <StatCard
          label="Avg order value"
          value={
            stats.totalPurchases === 0
              ? 'n/a'
              : fmt(stats.totalRevenueCents / stats.totalPurchases)
          }
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        <StatCard
          label="Tracked link clicks"
          value={clicks ? String(clicks.totalClicks) : 'n/a'}
          sub={
            clicks
              ? `${clicks.recentClicks} in 30d` +
                // People, not just hits. On the dashboard this is the difference
                // between "the campaign is working" and "I have refreshed my own
                // link forty times", and the totals alone cannot tell them apart.
                (peopleSuffix ? ` from ${peopleSuffix}` : '') +
                (clicks.botClicks ? ` · ${clicks.botClicks} bots excluded` : '') +

              ` · ${clicks.linksWithClicks}/${clicks.linkCount} links used`
              : 'planner link tracking unavailable'
          }
        />
        {/*
          Labelled "Attributed revenue", never "Revenue" — the two Revenue cards
          one row up come from Stripe and are always the larger, more complete
          number. This one answers a different question (which POST earned it)
          and can only ever be a subset.
        */}
        <StatCard
          label="Attributed revenue"
          value={attribution ? formatCents(attributed.revenueCents) : 'n/a'}
          sub={
            attribution
              ? `${attributed.optins} opt-ins · ${attributed.purchases} sales · ` +
                ATTRIBUTED_REVENUE_FLOOR_SHORT
              : 'lead attribution unavailable'
          }
        />
        <StatCard
          label="Earnings per click"
          value={formatCentsPrecise(economics.blended.epcCents)}
          sub={
            economics.mix.label
              ? `leads: ${economics.mix.label}`
              : 'no attributed leads yet'
          }
        />
      </div>
      {(attribution || clicks) && (
        <div className="mt-2 space-y-1 text-xs text-bone/40">
          <p>{ATTRIBUTED_REVENUE_FLOOR_NOTE}</p>
          {/*
            Only rendered when paid AND organic both produced leads, which is the
            only case where the EPC above is a budget-weighted average. The
            paid-only ceiling is printed next to the warning rather than as its
            own card: read apart from the caveat it is just another number, and
            it is the one someone would actually bid.
          */}
          {blendWarning && <p className="text-brass/60">{blendWarning}</p>}
          {bidCeiling && <p className="text-brass/60">{bidCeiling}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        <QuickLink href="/admin/planner" label="Content Planner" />
        <QuickLink href="/admin/funnel-stats" label="Funnel Stats" />
        <QuickLink href="/admin/purchases" label="All purchases" />

        <QuickLink href="/admin/subscriptions" label="Subscriptions" />
      </div>

      <h2 className="font-display text-2xl font-semibold mt-12 mb-4 tracking-tight">Recent activity</h2>
      <div className="overflow-x-auto rounded-2xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 backdrop-blur">
        <table className="w-full text-sm">
          <thead className="bg-bone/[0.03] text-brass/80 uppercase tracking-wider text-xs">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">When</th>
              <th className="text-left px-4 py-3 font-semibold">Page</th>
              <th className="text-left px-4 py-3 font-semibold">Customer</th>
              <th className="text-right px-4 py-3 font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {stats.recentPurchases.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-bone/40">
                  No activity yet.
                </td>
              </tr>
            )}
            {stats.recentPurchases.map((r) => (
              <tr key={r.id} className="border-t border-bone/5 hover:bg-bone/[0.02] transition-colors">
                <td className="px-4 py-2.5 whitespace-nowrap text-bone/60">
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2.5">{r.page_type ?? '-'}</td>
                <td className="px-4 py-2.5">{r.customer_email ?? '-'}</td>
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

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 backdrop-blur p-4 hover:border-brass/40 hover:shadow-[0_0_30px_rgba(168,139,92,0.12)] transition-all flex items-center justify-between group"
    >
      <span className="font-semibold">{label}</span>
      <span className="text-brass/60 group-hover:text-brass group-hover:translate-x-1 transition-all">→</span>
    </Link>
  );
}
