import Link from 'next/link';
import { getPurchasesList } from '@/utils/supabase/admin';
import DownloadCsvButton from '../funnel-stats/DownloadCsvButton';

export const dynamic = 'force-dynamic';

const fmt = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const PAGE_SIZE = 50;

type SearchParams = {
  page?: string;
  page_type?: string;
  product_id?: string;
  dateFrom?: string;
  dateTo?: string;
};

export default async function PurchasesPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);
  const filters = {
    page_type: searchParams.page_type || undefined,
    product_id: searchParams.product_id || undefined,
    dateFrom: searchParams.dateFrom || undefined,
    dateTo: searchParams.dateTo || undefined
  };

  const { rows, total } = await getPurchasesList(page, PAGE_SIZE, filters);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const buildHref = (overrides: Partial<SearchParams>) => {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, String(v));
    const qs = params.toString();
    return qs ? `/admin/purchases?${qs}` : '/admin/purchases';
  };

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-brass/80 font-semibold mb-2">
            Ledger
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">Purchases</h1>
          <p className="mt-2 text-bone/60">
            {total} total · page {page} of {totalPages}
          </p>
        </div>
        <DownloadCsvButton rows={rows as any} />
      </div>

      <form className="mt-6 grid grid-cols-1 sm:grid-cols-5 gap-3" action="/admin/purchases">
        <Input name="page_type" defaultValue={filters.page_type ?? ''} placeholder="page_type (fe, oto1...)" />
        <Input name="product_id" defaultValue={filters.product_id ?? ''} placeholder="product_id" />
        <Input name="dateFrom" type="date" defaultValue={filters.dateFrom ?? ''} />
        <Input name="dateTo" type="date" defaultValue={filters.dateTo ?? ''} />
        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 rounded-lg bg-brass hover:bg-brass/90 text-ink px-3 py-2 text-sm font-semibold transition-colors"
          >
            Filter
          </button>
          <Link
            href="/admin/purchases"
            className="rounded-lg border border-brass/20 px-3 py-2 text-sm text-bone/70 hover:bg-brass/[0.06] hover:border-brass/40 hover:text-brass transition-colors"
          >
            Clear
          </Link>
        </div>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 backdrop-blur mt-6">
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
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-bone/40">
                  No purchases match these filters.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-bone/5 hover:bg-bone/[0.02] transition-colors">
                <td className="px-4 py-2.5 whitespace-nowrap text-bone/60">
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2.5">{r.product_id ?? '-'}</td>
                <td className="px-4 py-2.5">{r.page_type ?? '-'}</td>
                <td className="px-4 py-2.5">
                  <div>{r.customer_name ?? '-'}</div>
                  <div className="text-bone/40">{r.customer_email ?? '-'}</div>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {fmt(r.amount_cents ?? 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm">
        <Link
          href={buildHref({ page: String(Math.max(1, page - 1)) })}
          aria-disabled={page <= 1}
          className={`px-3 py-1.5 rounded-lg border border-brass/20 ${page <= 1 ? 'pointer-events-none opacity-40' : 'hover:bg-brass/[0.06] hover:border-brass/40 text-brass'}`}
        >
          ← Previous
        </Link>
        <span className="text-bone/40">
          Page {page} of {totalPages}
        </span>
        <Link
          href={buildHref({ page: String(Math.min(totalPages, page + 1)) })}
          aria-disabled={page >= totalPages}
          className={`px-3 py-1.5 rounded-lg border border-brass/20 ${page >= totalPages ? 'pointer-events-none opacity-40' : 'hover:bg-brass/[0.06] hover:border-brass/40 text-brass'}`}
        >
          Next →
        </Link>
      </div>
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="rounded-lg bg-bone/[0.03] border border-bone/10 px-3 py-2 text-sm text-bone placeholder-bone/30 focus:outline-none focus:border-brass/60 focus:bg-bone/[0.05] transition-colors"
    />
  );
}
