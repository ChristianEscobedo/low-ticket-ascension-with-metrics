import React from 'react';
import { Check } from 'lucide-react';
import type { MotherModeOffer } from '@/lib/mothermode/types';
import { BRAND } from '@/lib/mothermode/brand';
import { CheckoutButton } from './CheckoutButton';
import { InsidePanel } from './InsidePanel';
import { MediaFrame } from './MediaFrame';
import { Sidebar } from './Sidebar';

/** The MotherMode wordmark: a small Mode badge + name. */
const Wordmark: React.FC = () => (
  <div className="mb-8 flex items-center justify-center gap-3">
    <div className="h-px w-10 bg-ink/15" />
    <div className="inline-flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-mode font-display text-base font-semibold text-bone">
        M
      </span>
      <span className="text-sm font-semibold uppercase tracking-[0.28em] text-ink">
        Mother<span className="text-mode">Mode</span>
      </span>
    </div>
    <div className="h-px w-10 bg-ink/15" />
  </div>
);

export const HeroSection: React.FC<{ offer: MotherModeOffer }> = ({ offer }) => {
  const { hero, inside } = offer;
  return (
    <header className="relative overflow-hidden bg-bone">
      <div className="mx-auto max-w-6xl px-4 pb-14 pt-12 sm:pt-16">
        <Wordmark />

        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center rounded-full border border-mode/25 px-4 py-1.5 text-sm font-medium uppercase tracking-[0.16em] text-mode">
            {hero.eyebrow}
          </div>
          <h1 className="font-display text-5xl font-semibold leading-[1.06] tracking-tight text-ink sm:text-6xl lg:text-7xl">
            {hero.headline}{' '}
            <span className="italic text-mode">{hero.headlineEmphasis}</span>{' '}
            {hero.headlineSuffix}
          </h1>
          <p className="mx-auto mt-8 max-w-3xl text-xl leading-relaxed text-ink/70 sm:text-2xl">
            {hero.subheadline}
          </p>
          {hero.audience && (
            <p className="mx-auto mt-7 max-w-2xl border-t border-mode/15 pt-7 font-display text-lg italic leading-relaxed text-mode sm:text-xl">
              {hero.audience}
            </p>
          )}
        </div>

        <div className="mt-12 flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex-1 lg:max-w-[58%]">
            <MediaFrame
              src={offer.media?.vslPoster}
              alt={`Watch: ${offer.name}`}
              label="Walkthrough video (optional)"
              hint="1280 × 720"
              video
              className="mb-6"
            />
            <div className="rounded-2xl border border-ink/10 bg-white/50 p-6 sm:p-8">
              <MediaFrame
                src={offer.media?.mockup}
                alt={`${offer.name} preview`}
                label="Product mockup"
                hint="1200 × 760"
                className="mb-6"
              />
              <div className="text-sm uppercase tracking-[0.2em] text-mode">
                {inside.heading}
              </div>
              <p className="mt-2 text-base text-ink/55">{inside.subheading}</p>
              <ul className="mt-5 space-y-3.5">
                {inside.items.map((item) => (
                  <li key={item.title} className="flex items-start gap-3">
                    <span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-mode/10">
                      <Check className="h-3 w-3 text-mode" />
                    </span>
                    <div className="text-lg leading-relaxed">
                      <span className="font-medium text-ink">{item.title}</span>
                      <span className="text-ink/55"> {item.description}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-7">
                <CheckoutButton slug={offer.slug} label={`Get ${offer.name}`} className="w-full sm:w-auto" />
                <p className="mt-3 text-base text-ink/50">{hero.promise}</p>
              </div>
              <p className="mt-6 border-t border-ink/10 pt-5 text-base italic text-ink/60">
                {BRAND.brandLine} {BRAND.conversionLine}
              </p>
            </div>
          </div>

          <aside className="lg:w-[360px] lg:flex-shrink-0">
            <div className="lg:sticky lg:top-16">
              <Sidebar
                slug={offer.slug}
                name={offer.name}
                category={offer.category}
                priceCents={offer.priceCents}
                originalPriceCents={offer.originalPriceCents}
                insideCount={offer.inside.items.length}
                guaranteeTitle={offer.guarantee.title}
              />

              {/* What is in the offer. Sits under the guarantee and rides the
                  same sticky rail, so it follows the scroll through the hero. */}
              <div className="mt-5">
                <InsidePanel offer={offer} />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </header>
  );
};
