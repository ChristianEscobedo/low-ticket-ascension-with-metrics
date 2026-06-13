'use client';

import React from 'react';
import { Star, ArrowRight } from 'lucide-react';
import { useProduct } from '@/contexts/ProductContext';
import { useCheckoutNav } from './useCheckout';
import { BONUSES, FALLBACK_PRODUCT, TOTAL_BONUS_VALUE } from './constants';

export const MindshiftBonusSection: React.FC = () => {
  const goToCheckout = useCheckoutNav();
  const { product, formatPrice } = useProduct();
  const price = product?.price_cents ?? FALLBACK_PRODUCT.price_cents;
  const originalPrice = product?.original_price_cents ?? FALLBACK_PRODUCT.original_price_cents;

  return (
    <section className="py-12">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12">
          <div className="bg-white/[0.04] border border-amber-200/20 text-amber-200 rounded-full px-6 py-3 text-sm font-bold inline-block mb-4 tracking-[0.15em] uppercase">
            🎁 6 Exclusive Bonuses
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Plus These{' '}
            <span className="bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 bg-clip-text text-transparent">
              ${TOTAL_BONUS_VALUE.toLocaleString()}
            </span>{' '}
            Worth of Bonuses
          </h2>
          <p className="text-lg text-gray-300 max-w-3xl mx-auto">
            Every bonus below is included when you join today &mdash; designed to keep the rewire online between sessions and stress-test it under real-world income pressure.
          </p>
        </div>

        {/* Bonuses Grid - 3 columns on large screens */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {BONUSES.map((bonus) => {
            const IconComponent = bonus.icon;
            return (
              <div
                key={bonus.number}
                className={`bg-white/[0.03] rounded-2xl p-6 border-2 backdrop-blur-sm transition-all duration-300 relative overflow-hidden group ${
                  bonus.featured
                    ? 'border-amber-200/50 shadow-[0_0_30px_rgba(251,191,36,0.18)]'
                    : 'border-amber-200/20 hover:border-amber-200/40 shadow-[0_0_20px_rgba(251,191,36,0.06)]'
                }`}
              >
                {/* Featured ribbon */}
                {bonus.featured && (
                  <div className="absolute -top-3 left-6">
                    <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-200 to-amber-300 text-black text-xs font-black tracking-[0.15em] uppercase px-3 py-1 rounded-full shadow-md">
                      <Star className="w-3 h-3 fill-current" />
                      Featured
                    </div>
                  </div>
                )}

                {/* Bonus image (falls back to stylized gradient + icon placeholder) */}
                {bonus.image ? (
                  <div className="rounded-xl mb-4 overflow-hidden border border-amber-200/15 aspect-[16/10] relative">
                    <img
                      src={bonus.image}
                      alt={bonus.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute bottom-2 left-2 bg-black/60 border border-amber-200/30 text-amber-200/90 text-[10px] font-bold uppercase tracking-[0.2em] px-2 py-0.5 rounded-full backdrop-blur-sm">
                      Bonus #{bonus.number}
                    </div>
                  </div>
                ) : (
                  <div className={`rounded-xl mb-4 overflow-hidden border border-amber-200/15 bg-gradient-to-br ${bonus.gradient} aspect-[16/10] flex items-center justify-center relative`}>
                    <div className="absolute inset-0 opacity-30" style={{
                      backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(251,191,36,0.18) 1px, transparent 0)',
                      backgroundSize: '20px 20px',
                    }} />
                    <div className="relative flex flex-col items-center">
                      <div className="w-14 h-14 rounded-full bg-black/40 border border-amber-200/30 flex items-center justify-center mb-2 backdrop-blur-sm">
                        <IconComponent className="w-7 h-7 text-amber-200" />
                      </div>
                      <div className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200/80">Bonus #{bonus.number}</div>
                    </div>
                  </div>
                )}

                {/* Value Badge */}
                <div className="bg-amber-200/10 border border-amber-200/25 text-amber-200 rounded-full px-3 py-1 text-sm font-bold inline-block mb-3">
                  VALUE: {bonus.value}
                </div>

                {/* Title & Description */}
                <h3 className="text-lg font-bold text-white mb-3">{bonus.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{bonus.description}</p>
              </div>
            );
          })}
        </div>

        {/* Total Value CTA */}
        <div className="bg-white/[0.04] border border-amber-200/20 rounded-3xl p-8 text-center shadow-[0_0_30px_rgba(251,191,36,0.08)]">
          <h3 className="text-2xl font-bold text-white mb-2">
            📦 Total Package Value:{' '}
            <span className="bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 bg-clip-text text-transparent">
              {formatPrice(originalPrice + TOTAL_BONUS_VALUE * 100)}
            </span>
          </h3>
          <p className="text-xl text-gray-300 mb-4">
            (Mini Course + Live Zoom + Audio Pack + Journal Prompts + Memory Map + Community + Tracker)
          </p>
          <div className="text-5xl font-bold text-white mb-6">
            Get Everything For Just {formatPrice(price)}
          </div>
          <button
            onClick={goToCheckout}
            className="group relative overflow-hidden bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 text-black text-xl font-bold px-10 py-4 rounded-xl transition-all duration-300 transform hover:scale-[1.03] hover:shadow-[0_0_40px_rgba(251,191,36,0.4)] inline-flex items-center"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
            <span className="relative z-10 flex items-center">UNLOCK MINDSHIFT + ALL 6 BONUSES FOR {formatPrice(price)}<ArrowRight className="w-5 h-5 ml-3 group-hover:translate-x-1 transition-transform" /></span>
          </button>
          <p className="text-sm text-gray-400 mt-4">
            ✓ Instant Access • ✓ Lifetime Access • ✓ 14-Day &ldquo;Feel the Shift&rdquo; Guarantee
          </p>
        </div>
      </div>
    </section>
  );
};
