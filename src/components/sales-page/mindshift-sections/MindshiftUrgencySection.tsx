'use client';

import React, { useState, useEffect } from 'react';
import { Clock, ArrowRight, AlertTriangle } from 'lucide-react';
import { useProduct } from '@/contexts/ProductContext';
import { useCheckoutNav } from './useCheckout';
import { FALLBACK_PRODUCT } from './constants';

export const MindshiftUrgencySection: React.FC = () => {
  const goToCheckout = useCheckoutNav();
  const { product, formatPrice } = useProduct();
  const price = product?.price_cents ?? FALLBACK_PRODUCT.price_cents;
  const originalPrice = product?.original_price_cents ?? FALLBACK_PRODUCT.original_price_cents;

  const [timeLeft, setTimeLeft] = useState({ days: 2, hours: 14, minutes: 37, seconds: 22 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        if (prev.hours > 0) return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        if (prev.days > 0) return { ...prev, days: prev.days - 1, hours: 23, minutes: 59, seconds: 59 };
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="py-20 bg-black text-white">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center bg-red-500/10 border border-red-500/30 rounded-full px-5 py-2 mb-6">
            <AlertTriangle className="w-4 h-4 text-red-400 mr-2" />
            <span className="text-red-400 font-bold text-sm tracking-wide">THIS FOUNDING PRICE EXPIRES SOON</span>
          </div>

          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 bg-clip-text text-transparent">The {formatPrice(price)} Price</span>
            <span className="text-white"> Is Going Away</span>
          </h2>

          <p className="text-lg text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Once this founding window closes, the price goes to {formatPrice(originalPrice)} and the live Zoom bonus gets removed. If you&rsquo;re on this page right now, you still have time to rewire at the founding rate.
          </p>
        </div>

        {/* Countdown Timer Card */}
        <div className="bg-white/[0.04] border-2 border-amber-200/40 rounded-2xl p-8 mb-10 shadow-[0_0_30px_rgba(251,191,36,0.12)]">
          <div className="text-center mb-6">
            <Clock className="w-8 h-8 text-amber-200 mx-auto mb-2" />
            <h3 className="text-lg font-bold text-gray-300">Founding Price Expires In:</h3>
          </div>

          <div className="grid grid-cols-4 gap-3 max-w-md mx-auto mb-6">
            {[
              { value: timeLeft.days, label: 'Days' },
              { value: timeLeft.hours, label: 'Hours' },
              { value: timeLeft.minutes, label: 'Min' },
              { value: timeLeft.seconds, label: 'Sec' },
            ].map((item, idx) => (
              <div key={idx} className="text-center">
                <div className="bg-gradient-to-b from-white/10 to-white/5 border border-amber-200/30 text-amber-200 rounded-xl p-3 mb-1">
                  <div className="text-3xl font-bold font-mono tabular-nums">{item.value.toString().padStart(2, '0')}</div>
                </div>
                <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">{item.label}</div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <span className="line-through text-gray-500 text-lg">{formatPrice(originalPrice)}</span>
            <span className="text-4xl font-bold text-white ml-3">{formatPrice(price)}</span>
          </div>
        </div>

        {/* What You're Getting Reminder */}
        <div className="bg-white/[0.03] border border-amber-200/15 rounded-2xl p-6 mb-10">
          <p className="text-center text-gray-300 text-lg leading-relaxed">
            <span className="text-white font-semibold">Mini Course + Live Zoom + Audio Pack + Journal Prompts + Memory Map + Community + Tracker</span>
            <br />
            <span className="text-gray-400 text-base">Everything you need to surface, clear, and install the identity behind your next-level income &mdash; for less than a dinner out.</span>
          </p>
        </div>

        {/* CTA */}
        <div className="text-center">
          <button
            onClick={goToCheckout}
            className="group relative overflow-hidden bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 text-black text-xl font-bold px-12 py-5 rounded-xl transition-all duration-300 transform hover:scale-[1.03] hover:shadow-[0_0_40px_rgba(251,191,36,0.4)] inline-flex items-center"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
            <span className="relative z-10 flex items-center">GET INSTANT ACCESS FOR {formatPrice(price)}<ArrowRight className="w-6 h-6 ml-3 group-hover:translate-x-1 transition-transform" /></span>
          </button>
          <p className="text-gray-500 mt-4 text-sm">Instant access • 14-Day &ldquo;Feel the Shift&rdquo; guarantee • Secure checkout</p>
        </div>
      </div>
    </section>
  );
};
