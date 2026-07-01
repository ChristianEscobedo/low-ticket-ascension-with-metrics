'use client';

import React from 'react';
import { Check } from 'lucide-react';
import type { OfferBump } from '@/lib/mothermode/types';

interface OrderBumpsProps {
  bumps: OfferBump[];
  selected: Record<string, boolean>;
  onToggle: (id: string) => void;
}

/**
 * The checkout order bumps for an offer, rendered as opt-in cards. Each toggles
 * its inclusion in the running total. Editorial Warm: dashed brass frame when
 * unselected, solid mode fill when added.
 */
export const OrderBumps: React.FC<OrderBumpsProps> = ({
  bumps,
  selected,
  onToggle,
}) => {
  if (!bumps.length) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-ink/10" />
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">
          Add to your order
        </span>
        <span className="h-px flex-1 bg-ink/10" />
      </div>

      {bumps.map((bump) => {
        const isOn = !!selected[bump.id];
        return (
          <button
            key={bump.id}
            type="button"
            onClick={() => onToggle(bump.id)}
            className={`flex w-full items-start gap-4 rounded-2xl border p-5 text-left transition-all ${
              isOn
                ? 'border-mode bg-mode/[0.04] shadow-sm'
                : 'border-dashed border-brass/50 bg-white/60 hover:border-mode/50'
            }`}
          >
            <span
              className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                isOn
                  ? 'border-mode bg-mode text-bone'
                  : 'border-ink/25 text-transparent'
              }`}
            >
              <Check className="h-4 w-4" />
            </span>
            <div className="flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-display text-lg leading-tight text-ink">
                  {bump.title}
                </span>
                <span className="flex-shrink-0 font-semibold text-brass">
                  {bump.price}
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-ink/65">
                {bump.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
};
