import React from 'react';
import { Check } from 'lucide-react';
import type { MotherModeOffer } from '@/lib/mothermode/types';
import { formatPrice } from '@/lib/mothermode/format';

/** A small brass value tag, e.g. "$27 value". */
const ValueTag: React.FC<{ value?: string }> = ({ value }) =>
  value ? (
    <span className="inline-flex flex-shrink-0 items-center rounded-full border border-brass/30 bg-brass/[0.07] px-3 py-1 text-sm font-medium text-brass">
      {value} value
    </span>
  ) : null;

/**
 * The "what is inside" section. An editorial index of the pack: a featured lead
 * resource, then a clean grid of the rest. Each resource reads as a real object,
 * with a number, an icon, what it is, and what it is worth. No empty image boxes,
 * so it looks finished before a single asset is added.
 */
export const InsideSection: React.FC<{ offer: MotherModeOffer }> = ({ offer }) => {
  const items = offer.inside.items;
  const [lead, ...rest] = items;
  const LeadIcon = lead.icon;
  return (
    <section className="border-t border-ink/10">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="text-sm uppercase tracking-[0.2em] text-mode">
              Everything in the pack
            </div>
            <h2 className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
              {offer.inside.heading}
            </h2>
            <p className="mt-5 text-xl leading-relaxed text-ink/65">
              {offer.inside.subheading}
            </p>
          </div>
          <div className="flex-shrink-0 rounded-2xl border border-ink/10 bg-white/60 px-6 py-5 text-center">
            <div className="font-display text-4xl text-ink">{items.length}</div>
            <div className="text-xs uppercase tracking-[0.18em] text-ink/45">
              resources
            </div>
            <div className="mt-3 border-t border-ink/10 pt-3 text-sm text-ink/55">
              <span className="font-medium text-ink/75">
                {formatPrice(offer.originalPriceCents)}
              </span>{' '}
              value
            </div>
          </div>
        </div>

        {/* Mechanism-forward lead: how the pieces relate before the list. */}
        {offer.inside.lead && (
          <p className="mt-10 max-w-3xl border-l-2 border-mode/40 pl-5 font-display text-2xl leading-relaxed text-ink">
            {offer.inside.lead}
          </p>
        )}

        {/* The featured lead resource. */}
        <article className="group relative mt-12 overflow-hidden rounded-3xl border border-ink/10 bg-white/60 p-8 transition hover:border-mode/30 sm:p-10">
          <span className="pointer-events-none absolute -right-3 -top-10 select-none font-display text-[9rem] leading-none text-mode/[0.05] sm:text-[12rem]">
            01
          </span>
          <div className="relative flex flex-col gap-7 sm:flex-row sm:items-start">
            <span className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl border border-mode/20 bg-bone">
              <LeadIcon className="h-7 w-7 text-mode" />
            </span>
            <div className="flex-1">
              {lead.tag && (
                <div className="text-xs uppercase tracking-[0.18em] text-brass">
                  {lead.tag}
                </div>
              )}
              <h3 className="mt-1.5 font-display text-3xl text-ink">{lead.title}</h3>
              <p className="mt-3 text-xl leading-relaxed text-ink/70">
                {lead.description}
              </p>
              {lead.outcome && (
                <p className="mt-4 flex items-start gap-2.5 text-lg leading-relaxed text-mode">
                  <Check className="mt-1.5 h-4 w-4 flex-shrink-0" />
                  <span>{lead.outcome}</span>
                </p>
              )}
              <div className="mt-6">
                <ValueTag value={lead.value} />
              </div>
            </div>
          </div>
        </article>

        {/* The rest of the pack. */}
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {rest.map((item, i) => {
            const Icon = item.icon;
            const n = (i + 2).toString().padStart(2, '0');
            return (
              <article
                key={item.title}
                className="group relative flex flex-col overflow-hidden rounded-3xl border border-ink/10 bg-white/55 p-7 transition hover:border-mode/30 hover:shadow-sm sm:p-8"
              >
                <span className="pointer-events-none absolute -right-2 -top-6 select-none font-display text-8xl leading-none text-mode/[0.05]">
                  {n}
                </span>
                <div className="relative flex items-center justify-between gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-mode/20 bg-bone">
                    <Icon className="h-5 w-5 text-mode" />
                  </span>
                  <ValueTag value={item.value} />
                </div>
                {item.tag && (
                  <div className="relative mt-6 text-xs uppercase tracking-[0.18em] text-brass">
                    {item.tag}
                  </div>
                )}
                <h3 className="relative mt-1.5 font-display text-2xl text-ink">
                  {item.title}
                </h3>
                <p className="relative mt-2.5 text-lg leading-relaxed text-ink/65">
                  {item.description}
                </p>
                {item.outcome && (
                  <p className="relative mt-4 flex flex-1 items-start gap-2.5 border-t border-ink/10 pt-4 text-base leading-relaxed text-mode">
                    <Check className="mt-1 h-4 w-4 flex-shrink-0" />
                    <span>{item.outcome}</span>
                  </p>
                )}
              </article>
            );
          })}
        </div>

        {/* Everything-included reassurance. */}
        <div className="mt-8 flex items-center justify-center gap-2 text-base text-ink/55">
          <Check className="h-4 w-4 flex-shrink-0 text-mode" />
          <span>All {items.length} resources are yours the moment you join.</span>
        </div>
      </div>
    </section>
  );
};
