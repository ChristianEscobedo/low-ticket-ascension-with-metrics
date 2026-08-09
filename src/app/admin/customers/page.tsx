import Link from 'next/link';
import { listEmailCustomers } from '@/utils/supabase/commerce';

export const dynamic = 'force-dynamic';

const fmt = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

/**
 * Every buyer, keyed by email: auth-account customers AND checkout-only
 * funnel buyers (no account) in one list. Purchase counts + lifetime spend
 * come from funnel_purchases; account status from auth users.
 */
export default async function CustomersPage() {
  const rows = await listEmailCustomers({ limit: 500 });

  return (
    <div>
      <div className="text-xs uppercase tracking-[0.25em] text-brass/80 font-semibold mb-2">
        Directory
      </div>
      <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">Customers</h1>
      <p className="mt-2 text-bone/60">
        Everyone who has bought — with or without an account. {rows.length} customers.
      </p>

      <div className="overflow-x-auto rounded-2xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 backdrop-blur mt-6">
        <table className="w-full text-sm">
          <thead className="bg-bone/[0.03] text-brass/80 uppercase tracking-wider text-xs">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Customer</th>
              <th className="text-left px-4 py-3 font-semibold">Account</th>
              <th className="text-left px-4 py-3 font-semibold">First seen</th>
              <th className="text-left px-4 py-3 font-semibold">Last purchase</th>
              <th className="text-right px-4 py-3 font-semibold">Purchases</th>
              <th className="text-right px-4 py-3 font-semibold">Lifetime</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-bone/40">
                  No customers yet.
                </td>
              </tr>
            )}
            {rows.map((c) => (
              <tr key={c.email} className="border-t border-bone/5 hover:bg-bone/[0.02] transition-colors">
                <td className="px-4 py-2.5">
                  <Link
                    href={`/admin/customers/email/${encodeURIComponent(c.email)}`}
                    className="text-brass hover:text-brass/80 hover:underline"
                  >
                    {c.email}
                  </Link>
                  {c.name && <div className="text-bone/40 text-xs">{c.name}</div>}
                </td>
                <td className="px-4 py-2.5">
                  {c.hasAccount ? (
                    <span className="inline-block rounded bg-brass/10 text-brass border border-brass/30 px-2 py-0.5 text-xs font-medium">
                      account
                    </span>
                  ) : (
                    <span className="text-bone/35 text-xs">guest</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-bone/60">
                  {c.firstPurchaseAt ? new Date(c.firstPurchaseAt).toLocaleDateString() : '-'}
                </td>
                <td className="px-4 py-2.5 text-bone/60">
                  {c.lastPurchaseAt ? new Date(c.lastPurchaseAt).toLocaleDateString() : '-'}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {c.purchaseCount}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {fmt(c.lifetimeCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
