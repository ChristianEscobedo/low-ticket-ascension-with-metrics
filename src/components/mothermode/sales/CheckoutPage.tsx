'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import type { SalesFunnelRecord } from '@/lib/mothermode/sales/types';
import { salesContentToOffer } from '@/lib/mothermode/sales/fromOffer';
import type { MotherModeOffer, OfferBump } from '@/lib/mothermode/types';
import { MotherModeCheckout } from '@/components/mothermode/checkout/MotherModeCheckout';
import {
  Editable,
  EditableList,
  InlineEditPopup,
  SalesEditToolbar,
  useSalesInlineEdit,
} from './inlineEdit';
import {
  FunnelMediaStudio,
  MediaStudioTrigger,
} from './FunnelMediaStudio';
import { SalesPageEditProvider } from './SalesPageEditContext';
import { OptinFooter } from '@/components/mothermode/optin/OptinFooter';

interface Props {
  funnel: SalesFunnelRecord;
  isAdmin?: boolean;
}

function firstUpsellPath(slug: string, funnel: SalesFunnelRecord): string {
  if (funnel.upsell1?.enabled) return `/funnel/${slug}/upsell`;
  if (funnel.upsell2?.enabled) return `/funnel/${slug}/upsell-2`;
  if (funnel.upsell3?.enabled) return `/funnel/${slug}/upsell-3`;
  if (funnel.upsell4?.enabled) return `/funnel/${slug}/upsell-4`;
  return `/funnel/${slug}/success`;
}

/**
 * Build a MotherModeOffer for the production checkout layout.
 * Prefer sales-page content (bumps, inside items, pricing) and overlay
 * checkout-block fields (product name/id, price, guarantee, bullets).
 */
function funnelToCheckoutOffer(
  funnel: SalesFunnelRecord,
  draft: SalesFunnelRecord,
): MotherModeOffer {
  const sales = draft.sales;
  const checkout = draft.checkout;

  const base = salesContentToOffer(sales, {
    slug: funnel.slug,
    productId: checkout.productId || funnel.productId || `funnel_${funnel.slug}`,
  });

  const priceCents =
    checkout.priceCents > 0
      ? checkout.priceCents
      : sales.priceCents || base.priceCents;

  const originalPriceCents =
    sales.originalPriceCents > 0
      ? sales.originalPriceCents
      : base.originalPriceCents || Math.round(priceCents * 4);

  // Checkout bullets become the "resources included" list when present.
  const bulletItems =
    checkout.bullets?.filter(Boolean).map((title) => ({
      title,
      description: '',
      icon: 'Check' as const,
    })) || [];

  const insideItems =
    bulletItems.length > 0
      ? bulletItems
      : base.inside.items.length > 0
        ? base.inside.items
        : [
            {
              title: checkout.productName || sales.name || 'Your order',
              description: '',
              icon: 'Check' as const,
            },
          ];

  const bumps: OfferBump[] = (base.bumps || []).map((b) => ({
    id: b.id,
    title: b.title,
    price: b.price,
    description: b.description,
  }));

  const offer: MotherModeOffer = {
    ...base,
    productId:
      checkout.productId || funnel.productId || base.productId || `funnel_${funnel.slug}`,
    name: checkout.productName || sales.name || base.name,
    tagline: checkout.subheadline || sales.tagline || base.tagline,
    priceCents,
    originalPriceCents,
    media: {
      ...base.media,
      mockup:
        checkout.productImageUrl ||
        sales.heroImageUrl ||
        base.media?.mockup ||
        undefined,
    },
    inside: {
      ...base.inside,
      heading: base.inside.heading || 'What you get',
      subheading: base.inside.subheading || '',
      items: insideItems,
    },
    bumps,
    guarantee: {
      title: sales.guaranteeTitle || base.guarantee?.title || 'Guarantee',
      body:
        checkout.guaranteeText ||
        sales.guaranteeText ||
        base.guarantee?.body ||
        '',
    },
  };

  return offer;
}

/**
 * Editable funnel checkout — renders the EXACT MotherMode checkout layout
 * (timer bar, contact+payment, order bumps, order summary) while driving
 * product/price/bumps from funnel sales + checkout JSON.
 *
 * After Stripe success, lands on the first enabled upsell (or success).
 */
export default function CheckoutPage({ funnel, isAdmin = false }: Props) {
  const edit = useSalesInlineEdit(funnel, 'checkout', isAdmin);
  const c = edit.draft.checkout;
  const [imageStudioOpen, setImageStudioOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(true);

  // Fire checkout_start once per visit (lead tracking).
  useEffect(() => {
    let leadId = '';
    try {
      leadId = sessionStorage.getItem(`sales_lead_${funnel.slug}`) || '';
    } catch {
      /* ignore */
    }
    if (!leadId) return;
    void fetch('/api/funnel/capture', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'checkout_start',
        leadId,
        slug: funnel.slug,
      }),
    }).catch(() => null);
  }, [funnel.slug]);

  const offer = useMemo(
    () => funnelToCheckoutOffer(funnel, edit.draft),
    [funnel, edit.draft],
  );

  const successPath = firstUpsellPath(funnel.slug, edit.draft);
  const backHref = `/funnel/${funnel.slug}/sales`;
  const backLabel = 'Back to offer details';

  return (
    <SalesPageEditProvider
      edit={edit}
      openMediaStudio={() => setImageStudioOpen(true)}
    >
      <div className="relative">
        <MotherModeCheckout
          offer={offer}
          successPath={successPath}
          backHref={backHref}
          backLabel={backLabel}
          timerLabel={c.timerLabel || 'Founding price held for:'}
          brandLabel={c.brandLabel || 'MOTHERMODE'}
        />
        <OptinFooter footer={edit.draft.footer as any} edit={edit as any} />

        {isAdmin && (
          <>
            <SalesEditToolbar edit={edit} />
            <InlineEditPopup edit={edit} />

            {edit.isEditMode && (
              <div
                className={`fixed inset-x-0 bottom-0 z-50 border-t border-ink/10 bg-bone/95 text-ink shadow-2xl backdrop-blur ${
                  sheetOpen ? 'max-h-[45vh] overflow-y-auto p-4' : 'p-2'
                }`}
              >
                <div className="mx-auto mb-2 flex max-w-6xl items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-ink/50">
                    Checkout fields{' '}
                    {sheetOpen
                      ? ''
                      : '· minimized — production layout above'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSheetOpen((v) => !v)}
                    className="rounded-full border border-ink/15 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink/70 hover:border-mode/40 hover:text-mode"
                  >
                    {sheetOpen ? 'Minimize' : 'Expand fields'}
                  </button>
                </div>

                {sheetOpen && (
                  <>
                    <div className="mx-auto mb-4 flex max-w-6xl flex-wrap items-center gap-2">
                      <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-ink/50">
                        Media
                      </span>
                      <MediaStudioTrigger
                        kind="image"
                        label="Product image"
                        onClick={() => setImageStudioOpen(true)}
                      />
                      {c.productImageUrl && (
                        <span className="text-[11px] text-ink/45">
                          image set
                        </span>
                      )}
                    </div>

                    <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <Field
                        edit={edit}
                        field="timerLabel"
                        label="Timer label"
                        value={c.timerLabel}
                      />
                      <Field
                        edit={edit}
                        field="brandLabel"
                        label="Header brand"
                        value={c.brandLabel}
                      />
                      <Field
                        edit={edit}
                        field="eyebrow"
                        label="Eyebrow"
                        value={c.eyebrow}
                      />
                      <Field
                        edit={edit}
                        field="headline"
                        label="Headline"
                        value={c.headline}
                      />
                      <Field
                        edit={edit}
                        field="subheadline"
                        label="Subheadline"
                        value={c.subheadline}
                        multiline
                      />
                      <Field
                        edit={edit}
                        field="productName"
                        label="Product name"
                        value={c.productName}
                      />
                      <Field
                        edit={edit}
                        field="productId"
                        label="Product ID"
                        value={c.productId}
                      />
                      <Field
                        edit={edit}
                        field="priceLabel"
                        label="Price label"
                        value={c.priceLabel}
                      />
                      <label className="block space-y-1 text-xs">
                        <span className="font-medium text-ink/70">
                          Price (cents)
                        </span>
                        <input
                          type="number"
                          className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink"
                          value={c.priceCents || 0}
                          onChange={(e) =>
                            edit.setField(
                              'priceCents',
                              Number(e.target.value) || 0,
                            )
                          }
                        />
                      </label>
                      <Field
                        edit={edit}
                        field="ctaText"
                        label="CTA text"
                        value={c.ctaText}
                      />
                      <Field
                        edit={edit}
                        field="guaranteeText"
                        label="Guarantee"
                        value={c.guaranteeText}
                        multiline
                      />
                      <Field
                        edit={edit}
                        field="paymentType"
                        label="Payment type"
                        value={c.paymentType}
                      />
                      <Field
                        edit={edit}
                        field="stripePriceId"
                        label="Stripe price ID"
                        value={c.stripePriceId}
                      />
                    </div>

                    <div className="mx-auto mt-4 max-w-6xl">
                      <span className="mb-2 block text-xs font-medium text-ink/70">
                        Order bullets (resources included)
                      </span>
                      <EditableList
                        edit={edit}
                        field="bullets"
                        className="space-y-1 rounded-lg border border-ink/10 bg-white p-3"
                        itemClassName="text-sm text-ink"
                        renderItem={(item) => (
                          <span className="flex items-start gap-2">
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mode" />
                            {item}
                          </span>
                        )}
                      />
                    </div>

                    <p className="mx-auto mt-3 max-w-6xl text-xs text-ink/50">
                      Production checkout layout (MotherModeCheckout). Order
                      bumps come from the Sales page content. After payment,
                      buyers land on the first enabled upsell. Save when done.
                    </p>
                  </>
                )}
              </div>
            )}

            {imageStudioOpen && (
              <FunnelMediaStudio
                open
                onClose={() => setImageStudioOpen(false)}
                kind="image"
                value={c.productImageUrl || ''}
                label="Checkout product image"
                hook={c.productName || c.headline || funnel.name}
                onApply={(url) => {
                  edit.setField('productImageUrl', url);
                  setImageStudioOpen(false);
                }}
              />
            )}
          </>
        )}
      </div>
    </SalesPageEditProvider>
  );
}

function Field({
  edit,
  field,
  label,
  value,
  multiline,
}: {
  edit: ReturnType<typeof useSalesInlineEdit>;
  field: string;
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <label className="block text-xs text-ink">
      <span className="mb-1 block font-semibold uppercase tracking-wide text-ink/60">
        {label}
      </span>
      {multiline ? (
        <textarea
          className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-mode focus:ring-2 focus:ring-mode/15"
          rows={3}
          value={value || ''}
          onChange={(e) => edit.setField(field as any, e.target.value)}
        />
      ) : (
        <input
          className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-mode focus:ring-2 focus:ring-mode/15"
          value={value || ''}
          onChange={(e) => edit.setField(field as any, e.target.value)}
        />
      )}
    </label>
  );
}
