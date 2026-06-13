import { getFunnelStats } from '@/utils/supabase/admin';
import DownloadCsvButton from './DownloadCsvButton';
import FunnelVisualization from './FunnelVisualization';

export const dynamic = 'force-dynamic';

const fmt = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export default async function FunnelStatsPage() {
  const stats = await getFunnelStats(50);

  return (
    <div>
      <div className="text-xs uppercase tracking-[0.25em] text-amber-200/80 font-semibold mb-2">
        Conversion
      </div>
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Funnel Stats</h1>
      <p className="mt-2 text-white/60">
        Conversions recorded via{' '}
        <code className="text-amber-200/90">payment_intent.succeeded</code> and{' '}
        <code className="text-amber-200/90">
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

      <h2 className="text-2xl font-bold mt-12 mb-4 tracking-tight">Funnel conversion</h2>
      <FunnelVisualization byPageType={stats.byPageType} />

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

      <h2 className="text-2xl font-bold mt-12 mb-4 tracking-tight">Last 30 days</h2>
      <DailyChart series={stats.byDay} />

      <div className="flex items-center justify-between mt-12 mb-4">
        <h2 className="text-2xl font-bold tracking-tight">Recent purchases</h2>
        <DownloadCsvButton rows={stats.recent as any} />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-amber-200/15 bg-gradient-to-br from-gray-900/60 to-gray-950/60 backdrop-blur">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-amber-200/80 uppercase tracking-wider text-xs">
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
                <td colSpan={5} className="px-4 py-6 text-center text-white/40">
                  No purchases yet. Run a checkout to populate.
                </td>
              </tr>
            )}
            {stats.recent.map((r) => (
              <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-2.5 whitespace-nowrap text-white/60">
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2.5">{r.product_id ?? '—'}</td>
                <td className="px-4 py-2.5">{r.page_type ?? '—'}</td>
                <td className="px-4 py-2.5">
                  <div>{r.customer_name ?? '—'}</div>
                  <div className="text-white/40">
                    {r.customer_email ?? '—'}
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-amber-200/15 bg-gradient-to-br from-gray-900/60 to-gray-950/60 backdrop-blur p-5 shadow-[0_0_30px_rgba(251,191,36,0.04)]">
      <div className="text-xs uppercase tracking-wider text-amber-200/70 font-semibold">{label}</div>
      <div className="mt-2 text-3xl font-bold tabular-nums tracking-tight">{value}</div>
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
    <div className="rounded-2xl border border-amber-200/15 bg-gradient-to-br from-gray-900/60 to-gray-950/60 backdrop-blur overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 text-xs uppercase tracking-wider text-amber-200/80 font-semibold">
        {title}
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td className="px-4 py-3 text-white/40" colSpan={3}>
                No data yet.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
              <td className="px-4 py-2">{r.key}</td>
              <td className="px-4 py-2 text-right text-white/60 tabular-nums">
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
    <div className="rounded-2xl border border-amber-200/15 bg-gradient-to-br from-gray-900/60 to-gray-950/60 backdrop-blur p-5 shadow-[0_0_30px_rgba(251,191,36,0.04)]">
      <div className="flex items-baseline justify-between mb-4">
        <div className="text-xs uppercase tracking-wider text-amber-200/70 font-semibold">Daily revenue</div>
        <div className="text-sm text-white/60">
          30-day total{' '}
          <span className="text-white font-semibold tabular-nums">
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
                className="w-full bg-gradient-to-t from-amber-500 to-amber-300 group-hover:from-amber-400 group-hover:to-amber-200 rounded-t transition-colors"
                style={{ height: `${Math.max(heightPct, d.totalCents > 0 ? 4 : 0)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-white/40 tabular-nums">
        <span>{series[0]?.day}</span>
        <span>{series[Math.floor(series.length / 2)]?.day}</span>
        <span>{series[series.length - 1]?.day}</span>
      </div>
    </div>
  );
}
