import Link from 'next/link';
import { getCustomerByEmail } from '@/utils/supabase/commerce';
import RefundButton from '@/app/admin/purchases/RefundButton';

export const dynamic = 'force-dynamic';

const fmt = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

/**
 * One buyer by email — every purchase (with refund control) and every comped
 * entitlement, whether or not they ever created an account.
 */
export default async function CustomerEmailPage({
  params,
}: {
  params: { email: string };
}) {
  const email = decodeURIComponent(params.email);
  const detail = await getCustomerByEmail(email);
  const lifetime = detail.purchases
    .filter((p) => p.status !== 'refunded')
    .reduce((sum, p) => sum + Number(p.amount_cents ?? 0), 0);

  return (
    <div>
      <Link
        href="/admin/customers"
        className="text-sm text-bone/50 hover:text-brass transition-colors"
      >
        ← All customers
      </Link>
      <div className="mt-3 flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-brass/80 font-semibold mb-2">
            Customer
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
            {detail.email}
          </h1>
          <p className="mt-2 text-bone/60">
            {detail.purchases.length} purchases · {fmt(lifetime)} lifetime ·{' '}
            {detail.userId ? 'has account' : 'guest checkout'}
          </p>
        </div>
      </div>

      <h2 className="font-display text-xl font-semibold tracking-tight mt-8 mb-3">
        Purchases
      </h2>
      <div className="overflow-x-auto rounded-2xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 backdrop-blur">
        <table className="w-full text-sm">
          <thead className="bg-bone/[0.03] text-brass/80 uppercase tracking-wider text-xs">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">When</th>
              <th className="text-left px-4 py-3 font-semibold">Product</th>
              <th className="text-left px-4 py-3 font-semibold">Page</th>
              <th className="text-right px-4 py-3 font-semibold">Amount</th>
              <th className="text-right px-4 py-3 font-semibold">Refund</th>
            </tr>
          </thead>
          <tbody>
            {detail.purchases.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-bone/40">
                  No purchases on record for this email.
                </td>
              </tr>
            )}
            {detail.purchases.map((p) => (
              <tr key={p.id} className="border-t border-bone/5">
                <td className="px-4 py-2.5 whitespace-nowrap text-bone/60">
                  {new Date(p.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2.5">{p.product_id ?? '-'}</td>
                <td className="px-4 py-2.5">{p.page_type ?? '-'}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {fmt(Number(p.amount_cents ?? 0))}
                  {p.status === 'refunded' && (
                    <span className="ml-2 text-xs text-red-300/80">refunded</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <RefundButton
                    purchaseId={p.id}
                    amountCents={Number(p.amount_cents ?? 0)}
                    status={p.status ?? 'succeeded'}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="font-display text-xl font-semibold tracking-tight mt-8 mb-3">
        Comped access
      </h2>
      <div className="rounded-2xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 backdrop-blur p-5">
        {detail.comps.length === 0 ? (
          <p className="text-sm text-bone/40">No comped entitlements.</p>
        ) : (
          <ul className="space-y-1.5">
            {detail.comps.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-bone/10 bg-bone/[0.02] px-3 py-2 text-sm"
              >
                <span className="text-bone/80">
                  {c.product_name ?? c.product_id ?? 'any product'}
                </span>
                <span
                  className={`text-xs ${c.status === 'active' ? 'text-emerald-300' : 'text-bone/35'}`}
                >
                  {c.status} · {new Date(c.created_at).toLocaleDateString()}
                  {c.note ? ` · ${c.note}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-bone/40">
          Grant or revoke comped access from{' '}
          <Link href="/admin/subscriptions" className="text-brass hover:underline">
            Subscriptions → Comp access
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
