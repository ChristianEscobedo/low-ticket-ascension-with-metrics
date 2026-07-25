'use client';

import React from 'react';
import { ShieldCheck } from 'lucide-react';
import type { MotherModeOffer } from '@/lib/mothermode/types';
import { BRAND } from '@/lib/mothermode/brand';
import { formatPrice } from '@/lib/mothermode/format';
import { CheckoutButton } from './CheckoutButton';
import { MmEditable } from '@/components/mothermode/sales/SalesPageEditContext';

/** Stacked value reckoning + the single price, framed as a decision not a sale. */
export const PricingSection: React.FC<{ offer: MotherModeOffer }> = ({ offer }) => {
  const stackTotal = offer.inside.items
    .map((i) => (i.value ? Number(i.value.replace(/[^0-9.]/g, '')) : 0))
    .reduce((sum, n) => sum + n, 0);
  return (
    <section className="border-t border-ink/10 bg-white/40">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
        <div className="text-center">
          <MmEditable
            field="priceDescription"
            as="div"
            className="text-sm uppercase tracking-[0.2em] text-mode"
          >
            {(offer as { pricingEyebrow?: string }).pricingEyebrow ||
              'What it costs to keep carrying it'}
          </MmEditable>
          <MmEditable
            field="tagline"
            as="h2"
            className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl"
          >
            {offer.tagline || 'One page. One sitting. One price.'}
          </MmEditable>



        </div>

        <div className="mx-auto mt-10 max-w-md rounded-2xl border border-ink/10 bg-bone p-7">
          <ul className="space-y-3">
            {offer.inside.items.map((item, ii) => (
              <li
                key={item.title + ii}
                className="flex items-baseline justify-between gap-4 text-base"
              >
                <MmEditable field={`insideItems.${ii}.title`} as="span" className="text-ink/70">
                  {item.title}
                </MmEditable>
                <MmEditable field={`insideItems.${ii}.value`} as="span" className="text-ink/45">
                  {item.value ?? ''}
                </MmEditable>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-baseline justify-between border-t border-ink/10 pt-5">
            <MmEditable field="soldSeparatelyLabel" as="span" className="text-ink/60">
              {(offer as { soldSeparatelyLabel?: string }).soldSeparatelyLabel ||
                'Sold separately'}
            </MmEditable>
            <MmEditable
              field="originalPriceLabel"
              as="span"
              className="text-ink/50 line-through"
              value={
                (offer as { originalPriceLabel?: string }).originalPriceLabel ||
                (stackTotal > 0
                  ? `${stackTotal}`
                  : formatPrice(offer.originalPriceCents))
              }
            >
              {(offer as { originalPriceLabel?: string }).originalPriceLabel ||
                (stackTotal > 0
                  ? `${stackTotal}`
                  : formatPrice(offer.originalPriceCents))}
            </MmEditable>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <MmEditable field="todayLabel" as="span" className="font-display text-lg text-ink">
              {(offer as { todayLabel?: string }).todayLabel || 'Today'}
            </MmEditable>
            <MmEditable
              field="priceLabel"
              as="span"
              className="font-display text-4xl text-mode"
              value={
                (offer as { priceLabel?: string }).priceLabel ||
                formatPrice(offer.priceCents)
              }
            >
              {(offer as { priceLabel?: string }).priceLabel ||
                formatPrice(offer.priceCents)}
            </MmEditable>
          </div>
          <div className="mt-7 text-center">
            <CheckoutButton
              slug={offer.slug}
              label={
                (offer as { ctaLabel?: string }).ctaLabel ||
                `Get ${offer.name}`
              }
              className="w-full"
            />

            <MmEditable field="promise" as="p" className="mt-3 text-sm text-ink/50">
              {offer.hero.promise}
            </MmEditable>
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
        <MmEditable
          field="guaranteeTitle"
          as="h2"
          className="mt-5 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl"
        >
          {offer.guarantee.title}
        </MmEditable>
        <MmEditable
          field="guaranteeText"
          multiline
          as="p"
          className="mx-auto mt-5 max-w-xl text-xl leading-relaxed text-ink/70"
        >
          {offer.guarantee.body}
        </MmEditable>
      </div>
    </div>
  </section>
);

/** FAQ as native accordions. No client JS needed. */
export const FaqSection: React.FC<{ offer: MotherModeOffer }> = ({ offer }) => {
  const faqHeading =
    (offer as { faqHeading?: string }).faqHeading ||
    'The questions mothers ask first.';
  return (
  <section className="border-t border-ink/10 bg-white/40">
    <div className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
      <MmEditable
        field="faqHeading"
        as="h2"
        className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl"
      >
        {faqHeading}
      </MmEditable>
      <div className="mt-8 divide-y divide-ink/10 border-y border-ink/10">
        {offer.faqs.map((faq, fi) => (
          <details key={faq.q + fi} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-xl text-ink">
              <MmEditable field={`faqs.${fi}.question`} as="span">
                {faq.q}
              </MmEditable>
              <span className="text-mode transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <MmEditable field={`faqs.${fi}.answer`} multiline as="p" className="mt-3 text-lg leading-relaxed text-ink/65">
              {faq.a}
            </MmEditable>
          </details>
        ))}
      </div>
    </div>
  </section>
  );
};

/** Final call. Possibility, not pressure. */
export const FinalCtaSection: React.FC<{ offer: MotherModeOffer }> = ({ offer }) => (
  <section className="border-t border-ink/10 bg-mode text-bone">
    <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:py-24">
      <MmEditable
        field="finalCtaHeading"
        as="h2"
        className="font-display text-4xl font-semibold leading-tight tracking-tight text-bone sm:text-5xl"
      >
        {offer.finalCta.heading}
      </MmEditable>
      <MmEditable
        field="finalCtaBody"
        multiline
        as="p"
        className="mx-auto mt-5 max-w-2xl text-xl leading-relaxed text-bone/75"
      >
        {offer.finalCta.body}
      </MmEditable>

      <div className="mt-9">
        <CheckoutButton
          slug={offer.slug}
          label={
            (offer as { ctaLabel?: string }).ctaLabel || `Get ${offer.name}`
          }
          variant="ghost"
          className="border-bone/30 text-bone hover:border-bone/60 hover:bg-bone/[0.06]"
        />

      </div>
      <MmEditable
        field="brandLine"
        as="p"
        className="mt-8 font-display text-base italic text-bone/60"
      >
        {(offer as { brandLine?: string }).brandLine || BRAND.brandLine}
      </MmEditable>
    </div>
  </section>
);

/** Slim brand footer. */
export const SalesFooter: React.FC<{ offer?: MotherModeOffer }> = ({ offer }) => {
  const o = offer as
    | {
        categoryLine?: string;
        generationalLine?: string;
        brandName?: string;
      }
    | undefined;
  return (
  <footer className="bg-bone">
    <div className="mx-auto max-w-6xl px-4 py-10 text-center">
      <div className="text-sm font-semibold uppercase tracking-[0.28em] text-ink">
        Mother<span className="text-mode">Mode</span>
      </div>
      <p className="mt-2 text-xs text-ink/45">
        <MmEditable field="categoryLine" as="span">
          {o?.categoryLine || BRAND.categoryLine}
        </MmEditable>{' '}
        <MmEditable field="generationalLine" as="span">
          {o?.generationalLine || BRAND.generationalLine}
        </MmEditable>
      </p>
    </div>
  </footer>
  );
};
