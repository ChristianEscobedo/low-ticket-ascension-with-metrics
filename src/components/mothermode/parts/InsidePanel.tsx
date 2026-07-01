import React from 'react';
import { Check } from 'lucide-react';
import type { MotherModeOffer } from '@/lib/mothermode/types';
import { formatPrice } from '@/lib/mothermode/format';

/**
 * The "what is inside" card used in the sticky side rails. A running manifest of
 * the pack: every resource with its standalone value, then the value-versus-price
 * reframe, so the full offer is always one glance away as she reads.
 */
export const InsidePanel: React.FC<{ offer: MotherModeOffer }> = ({ offer }) => {
  const { items } = offer.inside;
  return (
    <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white/60 shadow-sm">
      <div className="bg-mode px-5 py-4 text-center">
        <h3 className="font-display text-lg text-bone">Everything you get today</h3>
        <p className="mt-1 text-xs leading-relaxed text-bone/70">
          {items.length} done-for-you resources. Built to use this weekend, not
          filed away.
        </p>
      </div>

      <ul className="divide-y divide-ink/10">
        {items.map((item) => (
          <li key={item.title} className="flex items-start gap-3 px-5 py-3">
            <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-mode/10">
              <Check className="h-3 w-3 text-mode" />
            </span>
            <span className="flex-1 text-sm font-medium leading-snug text-ink/80">
              {item.title}
            </span>
            {item.value && (
              <span className="flex-shrink-0 text-xs font-medium text-brass">
                {item.value}
              </span>
            )}
          </li>
        ))}
      </ul>

      <div className="border-t border-ink/10 bg-bone px-5 py-4 text-center">
        <div className="text-sm text-ink/55">
          <span className="line-through">
            {formatPrice(offer.originalPriceCents)}
          </span>{' '}
          of tools, together for the first time
        </div>
        <div className="mt-1 font-display text-xl text-ink">
          Yours today for {formatPrice(offer.priceCents)}
        </div>
      </div>
    </div>
  );
};
