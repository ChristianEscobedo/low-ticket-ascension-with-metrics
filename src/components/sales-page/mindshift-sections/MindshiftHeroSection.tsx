'use client';

import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useProduct } from '@/contexts/ProductContext';
import { useCheckoutNav } from './useCheckout';
import { FALLBACK_PRODUCT, TOTAL_BONUS_VALUE } from './constants';

export const MindshiftHeroSection: React.FC = () => {
  const goToCheckout = useCheckoutNav();
  const { product, formatPrice } = useProduct();
  const price = product?.price_cents ?? FALLBACK_PRODUCT.price_cents;
  const originalPrice = product?.original_price_cents ?? FALLBACK_PRODUCT.original_price_cents;
  const totalValueCents = originalPrice + TOTAL_BONUS_VALUE * 100;

  return (
    <section className="py-2">
      {/* VSL Card */}
      <div className="mb-8">
        <div className="relative p-1 rounded-2xl bg-gradient-to-r from-amber-200/30 via-amber-100/15 to-amber-300/30 shadow-[0_0_40px_rgba(251,191,36,0.15),0_0_80px_rgba(251,191,36,0.08)]">
          <div className="aspect-video rounded-xl bg-gradient-to-br from-black via-gray-950 to-black border border-white/5 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(251,191,36,0.12) 0%, transparent 60%)' }} />
            <div className="relative text-center px-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-200/10 border border-amber-200/30 flex items-center justify-center">
                <div className="w-0 h-0 border-l-[14px] border-l-amber-200 border-y-[10px] border-y-transparent ml-1" />
              </div>
              <p className="text-amber-200/70 text-sm uppercase tracking-[0.2em] font-semibold">Watch the 12-minute Mindshift VSL</p>
            </div>
          </div>
        </div>

        <div className="text-center mt-6">
          <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">
            How The Subconscious Reset Method&trade; Works
          </h3>
          <p className="text-lg text-gray-300 leading-relaxed">
            A 12-minute walkthrough of the 4-step protocol &mdash; how it surfaces a ceiling belief, clears it at the nervous-system level, and installs the new wiring.
          </p>
        </div>
      </div>

      {/* Offer Card */}
      <div className="max-w-3xl mx-auto text-center mb-16 -mt-2">
        <div className="bg-gradient-to-br from-gray-900/60 to-gray-950/60 border-2 border-amber-200/30 rounded-3xl p-8 backdrop-blur-sm shadow-[0_0_30px_rgba(251,191,36,0.08)]">
          <div className="inline-flex items-center gap-2 bg-white/[0.04] border border-amber-200/20 text-amber-200 rounded-full px-4 py-1.5 text-xs font-semibold tracking-[0.15em] uppercase mb-5">
            <Sparkles className="w-3.5 h-3.5" />
            The Millionaire Mindshift Mini Course
          </div>

          <h3 className="text-3xl md:text-4xl font-bold text-white mb-2">
            The Millionaire Mindshift Protocol
          </h3>
          <p className="text-lg text-gray-300 mb-6">
            5 Modules + Live Zoom + Audio Pack + Journal Prompts
          </p>

          <div className="mb-8">
            <div className="relative rounded-2xl overflow-hidden border border-amber-200/20 shadow-[0_0_30px_rgba(251,191,36,0.06)]">
              <img
                src="https://assets.cdn.filesafe.space/FnedsjhvL9EqG9Eyjhep/media/6a2862ba77feef7e78ca7ad3.png"
                alt="The Millionaire Mindshift Protocol &mdash; what&rsquo;s inside"
                className="w-full h-auto block"
                loading="eager"
              />
            </div>
          </div>

          {/* What's Included Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8 text-left">
            <div className="flex items-center text-gray-300">
              <span className="text-amber-200 mr-3">⚡</span>
              <span>The Identity Audit</span>
            </div>
            <div className="flex items-center text-gray-300">
              <span className="text-amber-200 mr-3">🧠</span>
              <span>5-Minute Muscle-Testing Protocol</span>
            </div>
            <div className="flex items-center text-gray-300">
              <span className="text-amber-200 mr-3">✨</span>
              <span>The Clearing Sequence</span>
            </div>
            <div className="flex items-center text-gray-300">
              <span className="text-amber-200 mr-3">🔑</span>
              <span>Installing The Millionaire Belief Stack</span>
            </div>
            <div className="flex items-center text-gray-300">
              <span className="text-amber-200 mr-3">⏱️</span>
              <span>7-Minute Daily Congruence Ritual</span>
            </div>
            <div className="flex items-center text-gray-300">
              <span className="text-amber-200 mr-3">🎙️</span>
              <span>Live &quot;Millionaire Beliefs &amp; Safety&quot; Zoom</span>
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-white/[0.03] border border-amber-200/15 rounded-2xl p-6 mb-6">
            <div className="text-lg text-gray-400 line-through mb-1">
              Total Value: {formatPrice(totalValueCents)}
            </div>
            <div className="text-5xl font-bold text-white mb-2">
              Only {formatPrice(price)}
            </div>
            <div className="text-xl text-amber-200 font-bold mb-3">
              One-Time Payment &middot; Instant Access
            </div>
            <p className="text-gray-400 text-sm">
              No subscriptions. No upsell hostage. The full rewire, today.
            </p>
          </div>

          <button
            onClick={goToCheckout}
            className="group relative w-full overflow-hidden bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 text-black font-bold py-5 px-8 rounded-xl text-2xl transition-all duration-300 transform hover:scale-[1.03] hover:shadow-[0_0_40px_rgba(251,191,36,0.35)] mb-6"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
            <span className="relative z-10 flex items-center justify-center">UNLOCK THE MINDSHIFT &mdash; {formatPrice(price)}<ArrowRight className="w-6 h-6 ml-3 group-hover:translate-x-1 transition-transform" /></span>
          </button>

          <div className="flex flex-col md:flex-row justify-center items-center gap-4 md:gap-6 mb-4 text-sm text-gray-400">
            <div className="flex items-center">
              <span className="text-amber-200 mr-2">✓</span>
              <span>Instant Access</span>
            </div>
            <div className="flex items-center">
              <span className="text-amber-200 mr-2">✓</span>
              <span>14-Day &quot;Feel the Shift&quot; Guarantee</span>
            </div>
            <div className="flex items-center">
              <span className="text-amber-200 mr-2">✓</span>
              <span>Lifetime Access</span>
            </div>
          </div>

          <div className="flex items-center justify-center text-sm text-gray-400">
            <span className="mr-2">🔒</span>
            <span>Secure checkout powered by Stripe</span>
          </div>
        </div>
      </div>
    </section>
  );
};
