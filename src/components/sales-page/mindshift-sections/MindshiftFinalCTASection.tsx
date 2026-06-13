'use client';

import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useProduct } from '@/contexts/ProductContext';
import { useCheckoutNav } from './useCheckout';
import { FALLBACK_PRODUCT } from './constants';

export const MindshiftFinalCTASection: React.FC = () => {
  const goToCheckout = useCheckoutNav();
  const { product, formatPrice } = useProduct();
  const price = product?.price_cents ?? FALLBACK_PRODUCT.price_cents;

  return (
    <section className="relative border-t border-white/5 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-amber-200/[0.04] blur-3xl rounded-full" />
      </div>
      <div className="relative z-10 max-w-3xl mx-auto px-4 py-28 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-200/70 mb-8">One Decision</p>
        <h2 className="text-3xl md:text-5xl lg:text-6xl font-black leading-[1.1] mb-10">
          You&rsquo;ve already done the hard part &mdash;
          <br />
          you built the business.
          <br />
          <span className="bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 bg-clip-text text-transparent">
            The only thing left is the wiring
          </span>
          <br />
          underneath it.
        </h2>

        <p className="text-xl text-gray-400 italic mb-12">Clear the block. Install the new identity. Stop dragging the ceiling with you.</p>

        <button
          onClick={goToCheckout}
          className="group relative inline-flex items-center gap-3 bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 text-black font-black text-lg md:text-xl px-10 py-5 rounded-xl overflow-hidden transition-all hover:scale-[1.02] shadow-[0_10px_40px_rgba(251,191,36,0.2)] hover:shadow-[0_15px_50px_rgba(251,191,36,0.35)]"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
          <span className="relative z-10 flex items-center gap-3">
            Become Congruent &mdash; {formatPrice(price)}
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </span>
        </button>
        <p className="text-xs text-gray-500 mt-5 tracking-wide">14-day &ldquo;Feel the Shift&rdquo; guarantee &middot; Instant access</p>
      </div>
    </section>
  );
};
