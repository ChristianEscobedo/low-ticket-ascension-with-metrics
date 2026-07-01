import React from 'react';
import { ShieldCheck } from 'lucide-react';
import type { MotherModeOffer } from '@/lib/mothermode/types';
import { BRAND } from '@/lib/mothermode/brand';
import { formatPrice } from '@/lib/mothermode/format';
import { CheckoutButton } from './CheckoutButton';

/** Stacked value reckoning + the single price, framed as a decision not a sale. */
export const PricingSection: React.FC<{ offer: MotherModeOffer }> = ({ offer }) => {
  const stackTotal = offer.inside.items
    .map((i) => (i.value ? Number(i.value.replace(/[^0-9.]/g, '')) : 0))
    .reduce((sum, n) => sum + n, 0);
  return (
    <section className="border-t border-ink/10 bg-white/40">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
        <div className="text-center">
          <div className="text-sm uppercase tracking-[0.2em] text-mode">
            What it costs to keep carrying it
          </div>
          <h2 className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
            One page. One sitting. One price.
          </h2>
        </div>

        <div className="mx-auto mt-10 max-w-md rounded-2xl border border-ink/10 bg-bone p-7">
          <ul className="space-y-3">
            {offer.inside.items.map((item) => (
              <li
                key={item.title}
                className="flex items-baseline justify-between gap-4 text-base"
              >
                <span className="text-ink/70">{item.title}</span>
                <span className="text-ink/45">{item.value ?? ''}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-baseline justify-between border-t border-ink/10 pt-5">
            <span className="text-ink/60">Sold separately</span>
            <span className="text-ink/50 line-through">
              {stackTotal > 0 ? `$${stackTotal}` : formatPrice(offer.originalPriceCents)}
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="font-display text-lg text-ink">Today</span>
            <span className="font-display text-4xl text-mode">
              {formatPrice(offer.priceCents)}
            </span>
          </div>
          <div className="mt-7 text-center">
            <CheckoutButton
              slug={offer.slug}
              label="Get instant access"
              className="w-full"
            />
            <p className="mt-3 text-sm text-ink/50">{offer.hero.promise}</p>
          </div>
        </div>
      </div>
    </section>
  );
};

/** The named guarantee, given its own quiet moment of weight. */
export const GuaranteeSection: React.FC<{ offer: MotherModeOffer }> = ({ offer }) => (
  <section className="border-t border-ink/10">
    <div className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
      <div className="rounded-2xl border border-brass/30 bg-brass/[0.05] p-8 text-center sm:p-10">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-brass/40 bg-bone">
          <ShieldCheck className="h-6 w-6 text-brass" />
        </span>
        <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {offer.guarantee.title}
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-xl leading-relaxed text-ink/70">
          {offer.guarantee.body}
        </p>
      </div>
    </div>
  </section>
);

/** FAQ as native accordions. No client JS needed. */
export const FaqSection: React.FC<{ offer: MotherModeOffer }> = ({ offer }) => (
  <section className="border-t border-ink/10 bg-white/40">
    <div className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
      <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
        The questions mothers ask first.
      </h2>
      <div className="mt-8 divide-y divide-ink/10 border-y border-ink/10">
        {offer.faqs.map((faq) => (
          <details key={faq.q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-xl text-ink">
              {faq.q}
              <span className="text-mode transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 text-lg leading-relaxed text-ink/65">{faq.a}</p>
          </details>
        ))}
      </div>
    </div>
  </section>
);

/** Final call. Possibility, not pressure. */
export const FinalCtaSection: React.FC<{ offer: MotherModeOffer }> = ({ offer }) => (
  <section className="border-t border-ink/10 bg-mode text-bone">
    <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:py-24">
      <h2 className="font-display text-5xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
        {offer.finalCta.heading}
      </h2>
      <p className="mx-auto mt-6 max-w-xl text-xl leading-relaxed text-bone/75 sm:text-2xl">
        {offer.finalCta.body}
      </p>
      <div className="mt-9">
        <CheckoutButton
          slug={offer.slug}
          label="Get instant access"
          variant="ghost"
          className="border-bone/30 text-bone hover:border-bone/60 hover:bg-bone/[0.06]"
        />
      </div>
      <p className="mt-8 font-display text-base italic text-bone/60">
        {BRAND.brandLine}
      </p>
    </div>
  </section>
);

/** Slim brand footer. */
export const SalesFooter: React.FC = () => (
  <footer className="bg-bone">
    <div className="mx-auto max-w-6xl px-4 py-10 text-center">
      <div className="text-sm font-semibold uppercase tracking-[0.28em] text-ink">
        Mother<span className="text-mode">Mode</span>
      </div>
      <p className="mt-2 text-xs text-ink/45">
        {BRAND.categoryLine} {BRAND.generationalLine}
      </p>
    </div>
  </footer>
);
