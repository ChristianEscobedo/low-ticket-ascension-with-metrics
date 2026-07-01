import Link from 'next/link';
import { getOverviewStats } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';

const fmt = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export default async function AdminOverviewPage() {
  const stats = await getOverviewStats();

  return (
    <div>
      <div className="text-xs uppercase tracking-[0.25em] text-brass/80 font-semibold mb-2">
        Dashboard
      </div>
      <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">Overview</h1>
      <p className="mt-2 text-bone/60">
        High-level view of revenue, subscriptions, and recent activity.
      </p>

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-8">
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
