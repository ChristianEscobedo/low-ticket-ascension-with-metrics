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
          <div className="text-xs uppercase tracking-[0.18em] text-mode">
            In her words
          </div>
          <blockquote className="mt-3 text-sm italic leading-relaxed text-ink/75">
            {firstProof.quote}
          </blockquote>
          <figcaption className="mt-3 border-t border-ink/10 pt-3 text-xs">
            <span className="font-medium text-ink">{firstProof.name}</span>
            <span className="text-ink/45"> · {firstProof.role}</span>
          </figcaption>
        </figure>
      )}

      {/* Quiet price nudge, with the promise and the guarantee restated. */}
      <div className="rounded-2xl border border-brass/30 bg-brass/[0.05] p-5 text-center">
        <div className="text-xs uppercase tracking-[0.18em] text-brass">
          Founding price
        </div>
        <div className="mt-2 flex items-baseline justify-center gap-2">
          <span className="font-display text-3xl text-ink">
            {formatPrice(offer.priceCents)}
          </span>
          <span className="text-sm text-ink/40 line-through">
            {formatPrice(offer.originalPriceCents)}
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-ink/60">
          {offer.hero.promise}
        </p>
        <CheckoutButton
          slug={offer.slug}
          label="Get instant access"
          className="mt-4 w-full"
        />
        <p className="mt-3 text-xs leading-relaxed text-ink/50">
          {offer.guarantee.title}: feel the difference in 14 days, or we refund
          every cent.
        </p>
      </div>
    </div>
  );
};
