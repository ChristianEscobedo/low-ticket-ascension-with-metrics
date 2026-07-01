'use client';

import React from 'react';
import { Check, ShieldCheck } from 'lucide-react';
import type { MotherModeOffer, OfferBump } from '@/lib/mothermode/types';
import { formatPrice } from '@/lib/mothermode/format';

interface OrderSummaryProps {
  offer: MotherModeOffer;
  activeBumps: OfferBump[];
  totalCents: number;
}

/**
 * The sticky checkout summary: the pack, an itemized base + bumps line, the
 * running total with original-price strike, the included resources, and the
 * guarantee. Mirrors the sales page's value framing in Editorial Warm.
 */
export const OrderSummary: React.FC<OrderSummaryProps> = ({
  offer,
  activeBumps,
  totalCents,
}) => {
  const savingsPercent = Math.round(
    ((offer.originalPriceCents - offer.priceCents) / offer.originalPriceCents) *
      100,
  );

  return (
    <div className="sticky top-6 space-y-4">
      <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white/70 shadow-sm">
        <div className="bg-mode px-6 py-5 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-bone/70">
            {offer.category}
          </p>
          <h2 className="mt-1 font-display text-2xl leading-tight text-bone">
            {offer.name}
          </h2>
        </div>

        <div className="p-6">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-ink/70">{offer.name}</span>
              <span className="font-medium text-ink">
                {formatPrice(offer.priceCents)}
              </span>
            </div>
            {activeBumps.map((bump) => (
              <div key={bump.id} className="flex items-center justify-between">
                <span className="text-ink/70">{bump.title}</span>
                <span className="font-medium text-ink">{bump.price}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-baseline justify-between border-t border-ink/10 pt-4">
            <span className="font-display text-lg text-ink">Total</span>
            <div className="flex items-baseline gap-2">
              <span className="text-sm text-ink/45 line-through">
                {formatPrice(offer.originalPriceCents)}
              </span>
              <span className="font-display text-3xl text-mode">
                {formatPrice(totalCents)}
              </span>
            </div>
          </div>
          <div className="mt-2 text-right">
            <span className="inline-block rounded-full border border-brass/40 bg-brass/10 px-3 py-1 text-xs font-semibold text-brass">
              You save {savingsPercent}% today
            </span>
          </div>

          <div className="mt-6 border-t border-ink/10 pt-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">
              {offer.inside.items.length} resources included
            </h3>
            <ul className="space-y-2">
              {offer.inside.items.map((item) => (
                <li
                  key={item.title}
                  className="flex items-start gap-2.5 text-sm text-ink/75"
                >
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-mode" />
                  <span>{item.title}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-brass/30 bg-bone p-5 text-center">
        <ShieldCheck className="mx-auto mb-2 h-7 w-7 text-mode" />
        <p className="font-display text-base text-ink">{offer.guarantee.title}</p>
        <p className="mt-1 text-xs leading-relaxed text-ink/60">
          {offer.guarantee.body}
        </p>
      </div>
    </div>
  );
};
