'use client';

import { iconFor } from '@/components/mothermode/parts/iconRegistry';
import React from 'react';
import { Gift, Check } from 'lucide-react';
import type { MotherModeOffer } from '@/lib/mothermode/types';
import { MmEditable } from '@/components/mothermode/sales/SalesPageEditContext';

/** A small brass value tag, e.g. "$19 value". */
const ValueTag: React.FC<{ value: string }> = ({ value }) => (
  <span className="inline-flex flex-shrink-0 items-center rounded-full border border-brass/30 bg-brass/[0.07] px-3 py-1 text-sm font-medium text-brass">
    {value} value
  </span>
);

/**
 * The bonus stack. Free fast-action extras rendered near the bottom of the page,
 * right before the final ask, to lift perceived value at the moment of decision.
 * Reads from the offer's `bonuses` block and renders nothing when unset.
 */
export const BonusSection: React.FC<{ offer: MotherModeOffer }> = ({ offer }) => {
  const bonuses = offer.bonuses;
  if (!bonuses || bonuses.items.length === 0) return null;

  return (
    <section className="border-t border-ink/10 bg-mode/[0.04]">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2.5 text-sm uppercase tracking-[0.2em] text-mode">
              <Gift className="h-4 w-4" />
              <MmEditable field="bonusesEyebrow" as="span">{bonuses.eyebrow}</MmEditable>
            </div>
            <MmEditable field="bonusesHeading" as="h2" className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
              {bonuses.heading}
            </MmEditable>
            {bonuses.intro && (
              <MmEditable field="bonusesIntro" multiline as="p" className="mt-5 text-xl leading-relaxed text-ink/65">
                {bonuses.intro}
              </MmEditable>
            )}
          </div>
          {bonuses.totalValue && (
            <div className="flex-shrink-0 rounded-2xl border border-brass/30 bg-bone px-6 py-5 text-center">
              <div className="text-xs uppercase tracking-[0.18em] text-ink/45">
                Bonus stack
              </div>
              <div className="mt-1 font-display text-4xl text-brass">
                <MmEditable field="bonusesTotalValue" as="span">{bonuses.totalValue}</MmEditable>
              </div>
              <div className="text-xs uppercase tracking-[0.18em] text-ink/45">
                value, free
              </div>
            </div>
          )}
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {bonuses.items.map((bonus, i) => {
            const Icon = iconFor(bonus.icon);
            const n = (i + 1).toString().padStart(2, '0');
            return (
              <article
                key={bonus.title + i}
                className="group relative flex flex-col overflow-hidden rounded-3xl border border-ink/10 bg-white/70 p-7 transition hover:border-mode/30 hover:shadow-sm"
              >
                <span className="pointer-events-none absolute -right-2 -top-6 select-none font-display text-8xl leading-none text-mode/[0.05]">
                  {n}
                </span>
                <div className="relative flex items-center justify-between gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-mode/20 bg-bone">
                    <Icon className="h-5 w-5 text-mode" />
                  </span>
                  <MmEditable field={`bonusesItems.${i}.value`} as="span">
                    <ValueTag value={bonus.value} />
                  </MmEditable>
                </div>
                {bonus.tag && (
                  <MmEditable
                    field={`bonusesItems.${i}.tag`}
                    as="div"
                    className="relative mt-6 text-xs uppercase tracking-[0.18em] text-brass"
                  >
                    {bonus.tag}
                  </MmEditable>
                )}
                <MmEditable
                  field={`bonusesItems.${i}.title`}
                  as="h3"
                  className="relative mt-1.5 font-display text-2xl text-ink"
                >
                  {bonus.title}
                </MmEditable>
                <MmEditable
                  field={`bonusesItems.${i}.description`}
                  multiline
                  as="p"
                  className="relative mt-2.5 flex-1 text-lg leading-relaxed text-ink/65"
                >
                  {bonus.description}
                </MmEditable>
              </article>
            );
          })}
        </div>


        {bonuses.closer && (
          <div className="mt-8 flex items-center justify-center gap-2 text-base text-ink/60">
            <Check className="h-4 w-4 flex-shrink-0 text-mode" />
            <span><MmEditable field="bonusesCloser" multiline as="span">{bonuses.closer}</MmEditable></span>
          </div>
        )}
      </div>
    </section>
  );
};
