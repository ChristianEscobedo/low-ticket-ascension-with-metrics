'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ProductFunnelAssignment } from '@/lib/mothermode/sales/productAssignments';

/**
 * Product picker for the funnel builder. Loads the Stripe-synced catalog from
 * /api/admin/funnel-products and, on selection, hands the parent everything
 * the step needs (productId, name, price cents, price id, payment type,
 * interval). When the current funnel + step already has an assignment, it
 * surfaces that too so the tab shows what will actually be charged/delivered.
 */

export interface PickedProduct {
  productId: string;
  productName: string;
  priceCents: number;
  stripePriceId: string;
  paymentType: 'one_time' | 'subscription';
  interval: 'monthly' | 'yearly' | '';
}

interface CatalogPrice {
  id: string;
  product_id?: string;
  unit_amount: number | null;
  currency?: string;
  interval: string | null;
  type?: string;
  active: boolean;
}

interface CatalogProduct {
  id: string;
  name: string;
  active: boolean;
  prices?: CatalogPrice[];
}

interface Props {
  funnelSlug: string;
  step: 'checkout' | 'upsell1' | 'upsell2' | 'upsell3' | 'upsell4';
  /** Currently selected product id on the step content (if any). */
  currentProductId?: string;
  onPick: (picked: PickedProduct) => void;
}

export default function ProductPicker({ funnelSlug, step, currentProductId, onPick }: Props) {
  const [products, setProducts] = useState<CatalogProduct[] | null>(null);
  const [assignments, setAssignments] = useState<ProductFunnelAssignment[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [allRes, assignRes] = await Promise.all([
          fetch('/api/admin/funnel-products', { cache: 'no-store' }),
          fetch(`/api/admin/funnel-products?funnel=${encodeURIComponent(funnelSlug)}`, {
            cache: 'no-store',
          }),
        ]);
        const allJson = await allRes.json();
        const assignJson = await assignRes.json();
        if (cancelled) return;
        if (!allRes.ok || !allJson?.success) throw new Error(allJson?.error || 'Catalog load failed');
        setProducts((allJson.products as CatalogProduct[]) ?? []);
        setAssignments((assignJson?.assignments as ProductFunnelAssignment[]) ?? []);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Catalog load failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [funnelSlug]);

  const stepAssignment = useMemo(
    () => assignments.find((a) => a.step === step && a.role === 'main') ?? null,
    [assignments, step],
  );
  const bonuses = useMemo(
    () => assignments.filter((a) => a.step === step && a.role === 'bonus'),
    [assignments, step],
  );

  function pick(productId: string) {
    setSelected(productId);
    const product = (products ?? []).find((p) => p.id === productId);
    if (!product) return;
    const active = (product.prices ?? []).filter((p) => p.active && p.unit_amount);
    const recurring = active.find((p) => p.interval);
    const price = recurring ?? active[0];
    onPick({
      productId: product.id,
      productName: product.name,
      priceCents: price?.unit_amount ?? 0,
      stripePriceId: price?.id ?? '',
      paymentType: recurring ? 'subscription' : 'one_time',
      interval: recurring?.interval === 'year' ? 'yearly' : recurring ? 'monthly' : '',
    });
  }

  return (
    <div className="rounded-lg border border-brass/20 bg-ink/40 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-brass/70">
          Product from catalog
        </span>
        <select
          className="min-w-0 flex-1 rounded-lg bg-bone/[0.03] border border-bone/10 px-2.5 py-1.5 text-xs text-bone focus:outline-none focus:border-brass/60"
          value={selected || currentProductId || ''}
          onChange={(e) => pick(e.target.value)}
        >
          <option value="">
            {products === null ? 'Loading catalog…' : 'Pick a product to autofill…'}
          </option>
          {(products ?? [])
            .filter((p) => p.active)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.id.slice(-8)}
              </option>
            ))}
        </select>
      </div>
      {loadError && <p className="text-[11px] text-red-300">{loadError}</p>}
      {stepAssignment ? (
        <p className="text-[11px] text-emerald-300/90">
          Assigned on this step: <code>{stepAssignment.productId}</code>
          {stepAssignment.priceId ? ` · price ${stepAssignment.priceId.slice(-8)}` : ''} · delivery:{' '}
          {stepAssignment.deliveryType}
          {stepAssignment.deliveryType === 'main_app' && stepAssignment.delivery.productKey
            ? ` (main app key: ${stepAssignment.delivery.productKey})`
            : ''}
          . Manage in Products → Assign to funnel page.
        </p>
      ) : (
        <p className="text-[11px] text-bone/40">
          No assignment yet — add one in Products → Assign to funnel page to set delivery
          (links, courses, or main-app licensing).
        </p>
      )}
      {bonuses.length > 0 && (
        <p className="text-[11px] text-bone/50">
          Bonuses on this step: {bonuses.map((b) => b.productId).join(', ')}
        </p>
      )}
    </div>
  );
}
