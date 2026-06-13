import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCustomerById } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';

const fmt = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export default async function CustomerDetailPage({
  params
}: {
  params: { id: string };
}) {
  const detail = await getCustomerById(params.id);
  if (!detail) return notFound();

  const { user, stripe_customer_id, subscriptions, purchases, lifetimeCents } =
    detail;

  return (
    <div>
      <Link
        href="/admin/customers"
        className="text-white/50 hover:text-amber-200 text-sm transition-colors"
      >
        ← Back to customers
      </Link>
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-2">{user.email}</h1>
      <p className="mt-2 text-white/60 text-sm">
        Joined {new Date(user.created_at).toLocaleString()} · user id{' '}
        <code className="text-white/80">{user.id}</code>
      </p>
      {stripe_customer_id && (
        <p className="mt-1 text-sm">
          Stripe customer{' '}
          <a
            href={`https://dashboard.stripe.com/customers/${stripe_customer_id}`}
            target="_blank"
            rel="noreferrer"
            className="text-amber-300 hover:text-amber-200 hover:underline"
          >
            {stripe_customer_id} ↗
          </a>
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
        <StatCard label="Lifetime spend" value={fmt(lifetimeCents)} />
        <StatCard label="Total purchases" value={String(purchases.length)} />
        <StatCard
          label="Subscriptions"
          value={String(subscriptions.length)}
        />
      </div>

      <h2 className="text-2xl font-bold mt-12 mb-4 tracking-tight">Subscriptions</h2>
      <div className="overflow-x-auto rounded-2xl border border-amber-200/15 bg-gradient-to-br from-gray-900/60 to-gray-950/60 backdrop-blur">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-amber-200/80 uppercase tracking-wider text-xs">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Status</th>
              <th className="text-left px-4 py-3 font-semibold">Plan</th>
              <th className="text-left px-4 py-3 font-semibold">Created</th>
              <th className="text-left px-4 py-3 font-semibold">Renews</th>
              <th className="text-left px-4 py-3 font-semibold">Stripe</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-white/40">
                  No subscriptions.
                </td>
              </tr>
            )}
            {subscriptions.map((s: any) => (
              <tr key={s.id} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-2.5">{s.status}</td>
                <td className="px-4 py-2.5">
                  {s.prices?.products?.name ?? '—'}{' '}
                  <span className="text-white/40 text-xs">
                    ({s.prices?.unit_amount ? fmt(s.prices.unit_amount) : '—'}/
                    {s.prices?.interval ?? '?'})
                  </span>
                </td>
                <td className="px-4 py-2.5 text-white/60">
                  {s.created ? new Date(s.created).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-2.5 text-white/60">
                  {s.current_period_end
                    ? new Date(s.current_period_end).toLocaleDateString()
                    : '—'}
                </td>
                <td className="px-4 py-2.5">
                  <a
                    href={`https://dashboard.stripe.com/subscriptions/${s.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-300 hover:text-amber-200 hover:underline"
                  >
                    open ↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-bold mt-12 mb-4 tracking-tight">Purchases</h2>
      <div className="overflow-x-auto rounded-2xl border border-amber-200/15 bg-gradient-to-br from-gray-900/60 to-gray-950/60 backdrop-blur">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-amber-200/80 uppercase tracking-wider text-xs">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">When</th>
              <th className="text-left px-4 py-3 font-semibold">Product</th>
              <th className="text-left px-4 py-3 font-semibold">Page</th>
              <th className="text-right px-4 py-3 font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {purchases.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-white/40">
                  No purchases.
                </td>
              </tr>
            )}
            {purchases.map((p) => (
              <tr key={p.id} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-2.5 text-white/60 whitespace-nowrap">
                  {new Date(p.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2.5">{p.product_id ?? '—'}</td>
                <td className="px-4 py-2.5">{p.page_type ?? '—'}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {fmt(p.amount_cents ?? 0)}
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
