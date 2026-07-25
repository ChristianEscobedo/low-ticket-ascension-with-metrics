'use client';

import { MmEditable } from '@/components/mothermode/sales/SalesPageEditContext';
import React from 'react';

import type { MotherModeOffer } from '@/lib/mothermode/types';
import { formatPrice } from '@/lib/mothermode/format';
import { CheckoutButton } from './CheckoutButton';
import { InsidePanel } from './InsidePanel';

/**
 * The sticky content rail that runs alongside the long sales letter. Mirrors the
 * original funnel structure: a running manifest of what is inside, a line of
 * proof, and a quiet price nudge, so the offer is always one glance away.
 */
export const ContentSidebar: React.FC<{ offer: MotherModeOffer }> = ({ offer }) => {
  const firstProof = offer.proof[0];
  return (
    <div className="space-y-5">
      <div className="h-1 rounded-full bg-gradient-to-r from-brass/40 via-brass to-brass/40" />

      <InsidePanel offer={offer} />

      {/* A line of proof, in her own words. */}
      {firstProof && (
        <figure className="rounded-2xl border border-ink/10 bg-bone p-5">
          <MmEditable
            field="proofEyebrow"
            as="div"
            className="text-xs uppercase tracking-[0.18em] text-mode"
          >
            {(offer as { proofEyebrow?: string }).proofEyebrow || 'In her words'}
          </MmEditable>
          <blockquote className="mt-3 text-sm italic leading-relaxed text-ink/75">
            <MmEditable field="proof.0.quote" multiline as="span">{firstProof.quote}</MmEditable>
          </blockquote>
          <figcaption className="mt-3 border-t border-ink/10 pt-3 text-xs">
            <span className="font-medium text-ink"><MmEditable field="proof.0.name" as="span">{firstProof.name}</MmEditable></span>
            <span className="text-ink/45">
              {' '}
              ·{' '}
              <MmEditable field="proof.0.role" as="span">
                {firstProof.role}
              </MmEditable>
            </span>

          </figcaption>
        </figure>
      )}

      {/* Quiet price nudge, with the promise and the guarantee restated. */}
      <div className="rounded-2xl border border-brass/30 bg-brass/[0.05] p-5 text-center">
        <MmEditable
          field="foundingPriceLabel"
          as="div"
          className="text-xs uppercase tracking-[0.18em] text-brass"
        >
          {(offer as { foundingPriceLabel?: string }).foundingPriceLabel ||
            'Founding price'}
        </MmEditable>
        <div className="mt-2 flex items-baseline justify-center gap-2">
          <MmEditable
            field="priceLabel"
            as="span"
            className="font-display text-3xl text-ink"
            value={
              (offer as { priceLabel?: string }).priceLabel ||
              formatPrice(offer.priceCents)
            }
          >
            {(offer as { priceLabel?: string }).priceLabel ||
              formatPrice(offer.priceCents)}
          </MmEditable>
          <MmEditable
            field="originalPriceLabel"
            as="span"
            className="text-sm text-ink/40 line-through"
            value={
              (offer as { originalPriceLabel?: string }).originalPriceLabel ||
              formatPrice(offer.originalPriceCents)
            }
          >
            {(offer as { originalPriceLabel?: string }).originalPriceLabel ||
              formatPrice(offer.originalPriceCents)}
          </MmEditable>
        </div>
        <MmEditable
          field="promise"
          multiline
          as="p"
          className="mt-2 text-sm leading-relaxed text-ink/60"
        >
          {offer.hero.promise}
        </MmEditable>
        <CheckoutButton
          slug={offer.slug}
          label={
            (offer as { ctaLabel?: string }).ctaLabel || `Get ${offer.name}`
          }
          className="mt-4 w-full"
        />
        <p className="mt-3 text-xs leading-relaxed text-ink/50">
          <MmEditable field="guaranteeTitle" as="span">
            {offer.guarantee.title}
          </MmEditable>
          {offer.guarantee.body ? (
            <>
              :{' '}
              <MmEditable field="guaranteeText" as="span">
                {offer.guarantee.body}
              </MmEditable>
            </>
          ) : null}
        </p>


      </div>
    </div>
  );
};
