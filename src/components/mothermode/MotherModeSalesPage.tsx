import React from 'react';
import type { MotherModeOffer } from '@/lib/mothermode/types';
import { UrgencyBar } from './parts/UrgencyBar';
import { HeroSection } from './parts/HeroSection';
import {
  ProblemSection,
  OriginSection,
  WhatIsSection,
  MechanismSection,
  OldVsNewSection,
  MethodSection,
} from './parts/NarrativeSections';
import { InsideSection } from './parts/InsideSection';
import { ProofSection, FounderLetter } from './parts/ProofSection';
import { BonusSection } from './parts/BonusSection';
import { ContentSidebar } from './parts/ContentSidebar';
import {
  PricingSection,
  GuaranteeSection,
  FaqSection,
  FinalCtaSection,
  SalesFooter,
} from './parts/ClosingSections';

/**
 * The MotherMode sales page. One offer in, a full Editorial Warm sales page out.
 * Every section reads from the offer catalog, so a single dynamic route renders
 * all eight resource packs. Structure mirrors the original long-form funnel: a
 * hero band with a sticky offer card, then a two-column sales letter (narrative
 * left, sticky content rail right), then full-width detail sections.
 */
export const MotherModeSalesPage: React.FC<{ offer: MotherModeOffer }> = ({
  offer,
}) => (
  <div className="min-h-screen bg-bone font-sans text-ink antialiased">
    <UrgencyBar category={offer.category} />
    <HeroSection offer={offer} />

    {/* Two-column sales letter: narrative runs down the left, the content rail
        stays in view on the right. */}
    <section className="border-t border-ink/10">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16 sm:py-20 lg:flex-row lg:gap-12">
        <main className="flex-1 space-y-14 lg:max-w-[60%]">
          <ProblemSection offer={offer} />
          <OriginSection offer={offer} />
          <WhatIsSection offer={offer} />
          <MechanismSection offer={offer} />
          <OldVsNewSection offer={offer} />
          <MethodSection offer={offer} />
        </main>
        <aside className="lg:w-[340px] lg:flex-shrink-0">
          <div className="lg:sticky lg:top-16">
            <ContentSidebar offer={offer} />
          </div>
        </aside>
      </div>
    </section>

    <InsideSection offer={offer} />
    <ProofSection offer={offer} />
    <PricingSection offer={offer} />
    <GuaranteeSection offer={offer} />
    <FaqSection offer={offer} />
    <FounderLetter offer={offer} />
    <BonusSection offer={offer} />
    <FinalCtaSection offer={offer} />
    <SalesFooter />
  </div>
);

export default MotherModeSalesPage;
