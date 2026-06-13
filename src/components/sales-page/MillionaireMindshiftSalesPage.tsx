'use client';

import React, { useEffect } from 'react';
import { ResellerTracking } from '@/components/reseller/ResellerTracking';
import { ProductProvider } from '@/contexts/ProductContext';
import {
  FALLBACK_PRODUCT,
  MindshiftUrgencyBar,
  MindshiftHeroSection,
  MindshiftSidebar,
  MindshiftContentSidebar,
  MindshiftStorySection,
  MindshiftProblemSection,
  MindshiftBeliefRevealSection,
  MindshiftWhyMindsetFailsSection,
  MindshiftOldVsNewSection,
  MindshiftSolutionSection,
  MindshiftCaseStudySection,
  MindshiftWhatIsSection,
  MindshiftFounderLetterSection,
  MindshiftFounderBioSection,
  MindshiftModulesSection,
  MindshiftFeatureSection,
  MindshiftBonusSection,
  MindshiftUrgencySection,
  MindshiftPricingSection,
  MindshiftGuaranteeSection,
  MindshiftFAQSection,
  MindshiftFinalCTASection,
  MindshiftFooter,
} from './mindshift-sections';
import { REF_STORAGE_KEY } from './mindshift-sections/constants';

const MillionaireMindshiftSalesPageContent: React.FC = () => {
  // Capture ?ref= into localStorage so CTAs forward it to checkout
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) localStorage.setItem(REF_STORAGE_KEY, ref);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-amber-200/20 selection:text-amber-100">
      <ResellerTracking resellerId="millionaire-mindshift" pageType="sales" trackingEnabled={true} />

      {/* Sticky urgency bar */}
      <MindshiftUrgencyBar />

      {/* Hero band — centered logo/headline + two-column (VSL+offer / sticky sidebar) */}
      <div className="bg-black text-white relative">
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(251,191,36,0.18) 1px, transparent 0)',
            backgroundSize: '30px 30px',
          }} />
        </div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-amber-200/[0.04] blur-3xl rounded-full pointer-events-none" />

        <div className="relative z-10">
          {/* Eyebrow + Headline */}
          <div className="w-full px-4 text-center pt-10 pb-12">
            {/* Millionaire Mindshift wordmark */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="h-px w-12 bg-gradient-to-r from-transparent to-amber-200/40" />
              <div className="inline-flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full border border-amber-200/40 bg-gradient-to-br from-amber-200/20 via-amber-100/10 to-amber-300/20 flex items-center justify-center">
                  <span className="text-lg font-black bg-gradient-to-br from-amber-100 to-amber-300 bg-clip-text text-transparent">M</span>
                </div>
                <span className="text-sm md:text-base font-black tracking-[0.3em] uppercase text-white">
                  Millionaire <span className="bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 bg-clip-text text-transparent">Mindshift</span>
                </span>
              </div>
              <div className="h-px w-12 bg-gradient-to-l from-transparent to-amber-200/40" />
            </div>
            <div className="inline-flex items-center gap-2 bg-white/[0.03] border border-amber-200/20 text-amber-200 rounded-full px-5 py-2 text-xs md:text-sm font-semibold tracking-[0.15em] uppercase mb-8">
              ✨ The Millionaire Belief Installation Protocol
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-black text-white mb-8 leading-[1.05] tracking-tight max-w-6xl mx-auto">
              Install The Same Subconscious Beliefs Every Self-Made{' '}
              <span className="relative inline-block">
                <span className="absolute inset-0 bg-amber-200/10 rounded-lg -skew-y-1 scale-105"></span>
                <span className="relative bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 bg-clip-text text-transparent">Millionaire &amp; Multi-Millionaire</span>
              </span>{' '}
              Runs &mdash; So Building Wealth Stops Feeling Hard
            </h1>
            <h2 className="text-lg md:text-xl lg:text-2xl mb-2 max-w-5xl mx-auto leading-relaxed text-center">
              <span className="text-amber-200 font-medium">
                &hellip;Without Affirmations, Journals, Or Another Mindset Book That Surfaces The Wound And Never Clears It
              </span>
            </h2>
          </div>

          {/* Two-column: VSL + Offer card / sticky pricing sidebar */}
          <div className="flex flex-col lg:flex-row gap-4 max-w-7xl mx-auto px-4 pb-12">
            <main className="flex-1 lg:max-w-[60%]">
              <MindshiftHeroSection />
            </main>
            <aside className="lg:w-[350px] flex-shrink-0">
              <div className="sticky top-[-56px] z-40">
                <MindshiftSidebar />
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* Sales Letter Content - Two Column */}
      <div className="bg-black text-white relative">
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.04) 1px, transparent 0)',
            backgroundSize: '30px 30px',
          }} />
        </div>
        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row gap-4 max-w-7xl mx-auto px-4 py-20">
            <main className="flex-1 lg:max-w-[60%]">
              <MindshiftWhatIsSection />
              <MindshiftStorySection />
              <MindshiftProblemSection />
              <MindshiftBeliefRevealSection />
              <MindshiftWhyMindsetFailsSection />
              <MindshiftOldVsNewSection />
              <MindshiftSolutionSection />
            </main>
            <aside className="lg:w-[350px] flex-shrink-0 hidden lg:block">
              <div className="sticky top-4 z-40">
                <MindshiftContentSidebar />
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* Case Study */}
      <div className="bg-black text-white relative border-t border-white/5">
        <div className="relative z-10 max-w-5xl mx-auto px-4">
          <MindshiftCaseStudySection />
        </div>
      </div>

      {/* Founder Letter */}
      <div className="bg-black text-white relative border-t border-white/5">
        <div className="relative z-10 max-w-7xl mx-auto px-4">
          <MindshiftFounderLetterSection />
        </div>
      </div>

      {/* Founder Bio — who is Christian Ray Escobedo */}
      <div className="bg-black text-white relative border-t border-white/5">
        <div className="relative z-10 max-w-7xl mx-auto px-4">
          <MindshiftFounderBioSection />
        </div>
      </div>

      {/* Modules */}
      <div className="bg-black text-white relative border-t border-white/5">
        <div className="relative z-10 max-w-6xl mx-auto px-4">
          <MindshiftModulesSection />
        </div>
      </div>

      {/* Feature Grid */}
      <div className="bg-black text-white relative border-t border-white/5 bg-gradient-to-b from-black via-gray-950/40 to-black">
        <div className="relative z-10 max-w-7xl mx-auto px-4">
          <MindshiftFeatureSection />
        </div>
      </div>

      {/* Bonuses */}
      <div className="bg-black text-white relative border-t border-white/5 bg-gradient-to-b from-black via-gray-950/40 to-black">
        <div className="relative z-10 max-w-6xl mx-auto px-4">
          <MindshiftBonusSection />
        </div>
      </div>

      {/* Pricing */}
      <div className="bg-black text-white relative border-t border-white/5">
        <div className="relative z-10 max-w-6xl mx-auto px-4">
          <MindshiftPricingSection />
        </div>
      </div>

      {/* Guarantee */}
      <MindshiftGuaranteeSection />

      {/* Urgency Break */}
      <div className="border-t border-white/5">
        <MindshiftUrgencySection />
      </div>

      {/* FAQ */}
      <div className="bg-black text-white relative border-t border-white/5">
        <div className="relative z-10 max-w-6xl mx-auto px-4">
          <MindshiftFAQSection />
        </div>
      </div>

      {/* Final CTA */}
      <MindshiftFinalCTASection />

      {/* Footer */}
      <MindshiftFooter />
    </div>
  );
};

export const MillionaireMindshiftSalesPage: React.FC = () => {
  return (
    <ProductProvider productId="millionaire_mindshift" fallbackProduct={FALLBACK_PRODUCT}>
      <MillionaireMindshiftSalesPageContent />
    </ProductProvider>
  );
};
