'use client';

import React from 'react';
import { ArrowRight, Lock, Shield } from 'lucide-react';
import { useProduct } from '@/contexts/ProductContext';
import { useCheckoutNav } from './useCheckout';
import { BONUSES, FALLBACK_PRODUCT, TOTAL_BONUS_VALUE } from './constants';

export const MindshiftPricingSection: React.FC = () => {
  const goToCheckout = useCheckoutNav();
  const { product, formatPrice } = useProduct();
  const price = product?.price_cents ?? FALLBACK_PRODUCT.price_cents;
  const originalPrice = product?.original_price_cents ?? FALLBACK_PRODUCT.original_price_cents;

  return (
    <section id="pricing" className="py-20">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-200/70 mb-6">Here&rsquo;s Everything You Get Today</p>
          <h2 className="text-3xl md:text-5xl font-black leading-[1.15]">
            The full stack.{' '}
            <span className="bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 bg-clip-text text-transparent">One price.</span>
          </h2>
        </div>

        <div className="bg-gradient-to-br from-white/[0.04] to-transparent border border-amber-200/20 rounded-3xl p-8 md:p-12 shadow-[0_0_60px_rgba(251,191,36,0.08)]">
          <ul className="space-y-3 mb-8 font-light">
            <li className="flex justify-between items-baseline border-b border-white/5 pb-3">
              <span className="text-gray-300">Millionaire Mindshift Mini Course</span>
              <span className="text-gray-500 tabular-nums">{formatPrice(originalPrice)}</span>
            </li>
            {BONUSES.map((b) => (
              <li key={b.number} className="flex justify-between items-baseline border-b border-white/5 pb-3 gap-4">
                <span className="text-gray-300">Bonus #{b.number} &mdash; {b.title}</span>
                <span className="text-gray-500 tabular-nums whitespace-nowrap">{b.value}</span>
              </li>
            ))}
          </ul>

          <div className="flex justify-between items-baseline mb-2">
            <span className="text-sm font-bold uppercase tracking-[0.2em] text-amber-200/70">Total Value</span>
            <span className="text-2xl font-black text-white tabular-nums">
              {formatPrice(originalPrice + TOTAL_BONUS_VALUE * 100)}
            </span>
          </div>

          <div className="my-8 h-px bg-gradient-to-r from-transparent via-amber-200/30 to-transparent" />

          <div className="text-center mb-8">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-200/70 mb-3">Today, Just</p>
            <p className="text-6xl md:text-7xl font-black bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 bg-clip-text text-transparent leading-none mb-3">
              {formatPrice(price)}
            </p>
            <p className="text-gray-500 line-through tabular-nums">was {formatPrice(originalPrice)}</p>
          </div>

          <button
            onClick={goToCheckout}
            className="group relative w-full inline-flex items-center justify-center gap-3 bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 text-black font-black text-lg md:text-xl px-8 py-5 rounded-xl overflow-hidden transition-all hover:scale-[1.01] shadow-[0_10px_40px_rgba(251,191,36,0.2)] hover:shadow-[0_15px_50px_rgba(251,191,36,0.35)]"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            <span className="relative z-10 flex items-center gap-3">
              Yes &mdash; Rewire My Identity for {formatPrice(price)}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </span>
          </button>

          <div className="flex items-center justify-center gap-6 mt-6 text-xs text-gray-500 uppercase tracking-[0.15em] font-semibold">
            <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Secure Checkout</span>
            <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> 14-Day Guarantee</span>
          </div>
        </div>
      </div>
    </section>
  );
};
