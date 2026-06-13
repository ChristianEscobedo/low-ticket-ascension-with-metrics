import Link from 'next/link';
import { getSubscriptionsList } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

const fmt = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-amber-500/10 text-amber-300 border border-amber-500/30',
  trialing: 'bg-sky-500/10 text-sky-300 border border-sky-500/30',
  past_due: 'bg-orange-500/10 text-orange-300 border border-orange-500/30',
  canceled: 'bg-white/[0.04] text-white/50 border border-white/10',
  unpaid: 'bg-red-500/10 text-red-300 border border-red-500/30',
  incomplete: 'bg-white/[0.04] text-white/50 border border-white/10',
  incomplete_expired: 'bg-white/[0.04] text-white/50 border border-white/10',
  paused: 'bg-white/[0.04] text-white/50 border border-white/10'
};

const stripeSubUrl = (id: string) => `https://dashboard.stripe.com/subscriptions/${id}`;

export default async function SubscriptionsPage({
  searchParams
}: {
  searchParams: { page?: string };
}) {
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);
  const { rows, total } = await getSubscriptionsList(page, PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="text-xs uppercase tracking-[0.25em] text-amber-200/80 font-semibold mb-2">
        Recurring
      </div>
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Subscriptions</h1>
      <p className="mt-2 text-white/60">
        {total} total · page {page} of {totalPages}
      </p>

      <div className="overflow-x-auto rounded-2xl border border-amber-200/15 bg-gradient-to-br from-gray-900/60 to-gray-950/60 backdrop-blur mt-6">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-amber-200/80 uppercase tracking-wider text-xs">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Status</th>
              <th className="text-left px-4 py-3 font-semibold">Customer</th>
              <th className="text-left px-4 py-3 font-semibold">Plan</th>
              <th className="text-right px-4 py-3 font-semibold">MRR</th>
              <th className="text-left px-4 py-3 font-semibold">Renews</th>
              <th className="text-left px-4 py-3 font-semibold">Stripe</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-white/40">
                  No subscriptions yet.
                </td>
              </tr>
            )}
            {rows.map((s: any) => {
              const price = s.prices;
              const product = price?.products;
              const interval = price?.interval;
              const cents = price?.unit_amount ?? 0;
              const mrr =
                interval === 'year'
                  ? cents / 12
                  : interval === 'week'
                  ? cents * 4.345
                  : interval === 'day'
                  ? cents * 30
                  : cents;
              return (
                <tr key={s.id} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[s.status] ?? 'bg-white/[0.04] text-white/50 border border-white/10'}`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">{s.customer_email ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <div>{product?.name ?? '—'}</div>
                    <div className="text-white/40 text-xs">
                      {cents > 0 ? `${fmt(cents)} / ${interval}` : '—'}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {mrr > 0 ? fmt(mrr) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-white/60">
                    {s.current_period_end
                      ? new Date(s.current_period_end).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <a
                      href={stripeSubUrl(s.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-amber-300 hover:text-amber-200 hover:underline"
                    >
                      open ↗
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm">
        <Link
          href={`/admin/subscriptions?page=${Math.max(1, page - 1)}`}
          aria-disabled={page <= 1}
          className={`px-3 py-1.5 rounded-lg border border-amber-200/20 ${page <= 1 ? 'pointer-events-none opacity-40' : 'hover:bg-amber-200/[0.06] hover:border-amber-200/40 text-amber-200'}`}
        >
          ← Previous
        </Link>
        <span className="text-white/40">
          Page {page} of {totalPages}
        </span>
        <Link
          href={`/admin/subscriptions?page=${Math.min(totalPages, page + 1)}`}
          aria-disabled={page >= totalPages}
          className={`px-3 py-1.5 rounded-lg border border-amber-200/20 ${page >= totalPages ? 'pointer-events-none opacity-40' : 'hover:bg-amber-200/[0.06] hover:border-amber-200/40 text-amber-200'}`}
        >
          Next →
        </Link>
      </div>
    </div>
  );
}
