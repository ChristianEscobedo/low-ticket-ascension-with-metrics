import { getProductsWithPrices } from '@/utils/supabase/admin';
import SyncButton from './SyncButton';
import CreateProductForm from './CreateProductForm';
import StageEditor from './StageEditor';

export const dynamic = 'force-dynamic';

const fmt = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export default async function ProductsPage() {
  const products = (await getProductsWithPrices()) as any[];

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-amber-200/80 font-semibold mb-2">
            Catalog
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Products</h1>
          <p className="mt-2 text-white/60 max-w-2xl">
            Create products directly in Stripe, tag each one with its funnel
            stage (FE, OTO1, …), and re-sync if you set anything up outside
            this UI.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SyncButton />
        </div>
      </div>

      <div className="mt-6">
        <CreateProductForm />
      </div>

      <div className="space-y-4 mt-8">
        {products.length === 0 && (
          <div className="rounded-2xl border border-amber-200/15 bg-gradient-to-br from-gray-900/60 to-gray-950/60 backdrop-blur p-8 text-center text-white/50">
            No products synced. Create products in Stripe and click
            “Sync from Stripe”.
          </div>
        )}
        {products.map((p) => (
          <div
            key={p.id}
            className="rounded-2xl border border-amber-200/15 bg-gradient-to-br from-gray-900/60 to-gray-950/60 backdrop-blur p-5 shadow-[0_0_30px_rgba(251,191,36,0.04)] hover:border-amber-200/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg truncate tracking-tight">{p.name}</h3>
                  {!p.active && (
                    <span className="text-xs rounded bg-white/[0.06] text-white/50 border border-white/10 px-2 py-0.5">
                      inactive
                    </span>
                  )}
                </div>
                {p.description && (
                  <p className="text-sm text-white/60 mt-1">{p.description}</p>
                )}
                <p className="text-xs text-white/40 mt-1">
                  <code>{p.id}</code>
                </p>
                <div className="mt-2">
                  <StageEditor
                    productId={p.id}
                    initialPageType={
                      (p.metadata?.page_type as string | undefined) ?? null
                    }
                  />
                </div>
              </div>
              <a
                href={`https://dashboard.stripe.com/products/${p.id}`}
                target="_blank"
                rel="noreferrer"
                className="text-amber-300 text-sm hover:text-amber-200 hover:underline whitespace-nowrap"
              >
                Stripe ↗
              </a>
            </div>
            <div className="mt-4 border-t border-white/10 pt-3">
              <div className="text-xs text-amber-200/70 uppercase tracking-wider font-semibold mb-2">
                Prices
              </div>
              {(p.prices ?? []).length === 0 ? (
                <div className="text-sm text-white/40">No prices.</div>
              ) : (
                <ul className="space-y-1">
                  {(p.prices ?? []).map((pr: any) => (
                    <li
                      key={pr.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="tabular-nums">
                        {pr.unit_amount != null ? fmt(pr.unit_amount) : '—'}
                        {pr.interval ? ` / ${pr.interval}` : ''}
                        {pr.type === 'one_time' && (
                          <span className="ml-2 text-white/40 text-xs">
                            one-time
                          </span>
                        )}
                        {!pr.active && (
                          <span className="ml-2 text-amber-300/80 text-xs">
                            inactive
                          </span>
                        )}
                      </span>
                      <code className="text-xs text-white/40">{pr.id}</code>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
