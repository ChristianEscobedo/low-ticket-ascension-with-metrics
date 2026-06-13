'use client';

import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useProduct } from '@/contexts/ProductContext';
import { useCheckoutNav } from './useCheckout';
import { FALLBACK_PRODUCT, FEATURES } from './constants';

export const MindshiftFeatureSection: React.FC = () => {
  const goToCheckout = useCheckoutNav();
  const { product, formatPrice } = useProduct();
  const price = product?.price_cents ?? FALLBACK_PRODUCT.price_cents;

  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="bg-white/[0.04] border border-amber-200/20 text-amber-200 rounded-full px-6 py-3 text-sm font-bold inline-block mb-6 tracking-[0.15em] uppercase">
            🧠 The Millionaire Mindshift System
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            <span className="text-white">What&rsquo;s Inside </span>
            <span className="bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 bg-clip-text text-transparent">Your Rewire</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Everything you need to surface, clear, and install the identity that holds the income you say you want &mdash; protocol, audios, prompts, and a live group call.
          </p>
        </div>

        {/* Features Grid - 4 columns on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {FEATURES.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <div
                key={index}
                className="bg-white/[0.03] rounded-2xl p-6 border border-amber-200/20 hover:border-amber-200/40 transition-all duration-300 relative overflow-hidden group shadow-[0_0_20px_rgba(251,191,36,0.05)]"
              >
                {/* Icon */}
                <div className="bg-amber-200/[0.06] border border-amber-200/20 rounded-xl h-16 w-16 flex items-center justify-center mb-4">
                  <IconComponent className="w-8 h-8 text-amber-200" />
                </div>

                {/* Title & Subtitle */}
                <div className="mb-3">
                  <span className="text-xs font-bold text-amber-200/80 uppercase tracking-wider">{feature.subtitle}</span>
                  <h3 className="text-lg font-bold text-white mt-1">{feature.title}</h3>
                </div>

                {/* Description */}
                <p className="text-gray-400 text-sm mb-4 leading-relaxed">{feature.description}</p>

                {/* Bullets */}
                <ul className="space-y-2">
                  {feature.bullets.map((bullet, idx) => (
                    <li key={idx} className="flex items-start text-sm text-gray-300">
                      <span className="text-amber-200 mr-2">✓</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="text-center">
          <button
            onClick={goToCheckout}
            className="group relative overflow-hidden bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 text-black text-xl font-bold px-10 py-4 rounded-xl transition-all duration-300 transform hover:scale-[1.03] hover:shadow-[0_0_40px_rgba(251,191,36,0.35)] inline-flex items-center"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
            <span className="relative z-10 flex items-center">UNLOCK THE FULL REWIRE FOR {formatPrice(price)}<ArrowRight className="w-5 h-5 ml-3 group-hover:translate-x-1 transition-transform" /></span>
          </button>
          <p className="text-sm text-gray-400 mt-4">
            ✓ Instant Access • ✓ Lifetime Access • ✓ 14-Day &ldquo;Feel the Shift&rdquo; Guarantee
          </p>
        </div>
      </div>
    </section>
  );
};
