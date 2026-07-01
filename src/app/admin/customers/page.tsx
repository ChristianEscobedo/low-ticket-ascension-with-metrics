import Link from 'next/link';
import { getCustomersList } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

const fmt = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export default async function CustomersPage({
  searchParams
}: {
  searchParams: { page?: string };
}) {
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);
  const { rows } = await getCustomersList(page, PAGE_SIZE);

  return (
    <div>
      <div className="text-xs uppercase tracking-[0.25em] text-brass/80 font-semibold mb-2">
        Directory
      </div>
      <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">Customers</h1>
      <p className="mt-2 text-bone/60">
        Auth users joined to Stripe customer ids, active subscriptions, and
        lifetime spend from funnel purchases.
      </p>

      <div className="overflow-x-auto rounded-2xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 backdrop-blur mt-6">
        <table className="w-full text-sm">
          <thead className="bg-bone/[0.03] text-brass/80 uppercase tracking-wider text-xs">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Email</th>
              <th className="text-left px-4 py-3 font-semibold">Joined</th>
              <th className="text-left px-4 py-3 font-semibold">Sub</th>
              <th className="text-right px-4 py-3 font-semibold">Purchases</th>
              <th className="text-right px-4 py-3 font-semibold">Lifetime</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-bone/40">
                  No customers yet.
                </td>
              </tr>
            )}
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-bone/5 hover:bg-bone/[0.02] transition-colors">
                <td className="px-4 py-2.5">
                  <Link
                    href={`/admin/customers/${c.id}`}
                    className="text-brass hover:text-brass/80 hover:underline"
                  >
                    {c.email || '(no email)'}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-bone/60">
                  {new Date(c.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2.5">
                  {c.activeSubscription ? (
                    <span className="inline-block rounded bg-brass/10 text-brass border border-brass/30 px-2 py-0.5 text-xs font-medium">
                      active
                    </span>
                  ) : (
                    <span className="text-bone/30">-</span>
                  )}
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

      <div className="flex items-center justify-between mt-4 text-sm">
        <Link
          href={`/admin/customers?page=${Math.max(1, page - 1)}`}
          aria-disabled={page <= 1}
          className={`px-3 py-1.5 rounded-lg border border-brass/20 ${page <= 1 ? 'pointer-events-none opacity-40' : 'hover:bg-brass/[0.06] hover:border-brass/40 text-brass'}`}
        >
          ← Previous
        </Link>
        <span className="text-bone/40">Page {page}</span>
        <Link
          href={`/admin/customers?page=${page + 1}`}
          aria-disabled={rows.length < PAGE_SIZE}
          className={`px-3 py-1.5 rounded-lg border border-brass/20 ${rows.length < PAGE_SIZE ? 'pointer-events-none opacity-40' : 'hover:bg-brass/[0.06] hover:border-brass/40 text-brass'}`}
        >
          Next →
        </Link>
      </div>
    </div>
  );
}
