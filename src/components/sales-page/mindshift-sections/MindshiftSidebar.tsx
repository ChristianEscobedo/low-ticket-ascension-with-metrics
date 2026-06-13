'use client';

import React, { useState, useEffect } from 'react';
import { Clock, Lock, ArrowRight, Shield } from 'lucide-react';
import { useProduct } from '@/contexts/ProductContext';
import { useCheckoutNav } from './useCheckout';
import { FALLBACK_PRODUCT } from './constants';

export const MindshiftSidebar: React.FC = () => {
  const goToCheckout = useCheckoutNav();
  const { product, formatPrice, savingsFormatted } = useProduct();
  const price = product?.price_cents ?? FALLBACK_PRODUCT.price_cents;
  const originalPrice = product?.original_price_cents ?? FALLBACK_PRODUCT.original_price_cents;

  const [email, setEmail] = useState('');
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 23, minutes: 47, seconds: 12 });
  const [showFinalOffer, setShowFinalOffer] = useState(false);

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

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollPercentage = (scrollPosition + windowHeight) / documentHeight;
      setShowFinalOffer(scrollPercentage > 0.8);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (showFinalOffer) {
    return (
      <div className="bg-white/[0.03] border border-amber-200/20 rounded-2xl p-8 backdrop-blur-sm shadow-2xl">
        <div className="text-center mb-6">
          <div className="bg-amber-200/10 border border-amber-200/30 text-amber-200 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
            ✨
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Last Chance</h3>
          <p className="text-gray-400">The founding price closes when the timer hits zero.</p>
        </div>
        <div className="text-center mb-8">
          <div className="text-4xl font-bold text-white mb-3">Only {formatPrice(price)}</div>
          <div className="text-lg text-gray-300 mb-4">
            <span className="font-bold text-amber-200">Save {savingsFormatted} Today</span>
          </div>
          <div className="text-white mb-6">Mini Course + Live Zoom + Audio Pack + Journal Prompts</div>
        </div>
        <button
          onClick={goToCheckout}
          className="group relative w-full overflow-hidden bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 text-black font-bold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.03] hover:shadow-[0_0_40px_rgba(251,191,36,0.35)] inline-flex items-center justify-center mb-6"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
          <span className="relative z-10 flex items-center">GET INSTANT ACCESS<ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" /></span>
        </button>
        <div className="text-center space-y-4">
          <div className="text-sm text-gray-400">🔒 100% secure checkout</div>
          <div className="bg-white/[0.03] border border-amber-200/15 rounded-xl p-4">
            <div className="text-sm font-bold text-amber-200">14-Day &quot;Feel the Shift&quot; Guarantee</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/[0.03] border-2 border-amber-200/30 rounded-2xl p-8 shadow-2xl shadow-amber-500/10">
      {/* Urgency Header */}
      <div className="text-center mb-6">
        <div className="bg-red-500/10 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
          <Clock className="w-6 h-6 text-red-400" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">
          ⚠️ <span className="underline decoration-amber-200 decoration-2 underline-offset-4">Founding Price Closes In:</span>
        </h3>
      </div>

      {/* Countdown */}
      <div className="grid grid-cols-4 gap-2 mb-8">
        {[
          { value: timeLeft.days, label: 'DAYS' },
          { value: timeLeft.hours, label: 'HRS' },
          { value: timeLeft.minutes, label: 'MIN' },
          { value: timeLeft.seconds, label: 'SEC' },
        ].map((item, idx) => (
          <div key={idx} className="text-center">
            <div className="bg-white/[0.04] text-amber-200 rounded-lg p-2 mb-1 border border-amber-200/15">
              <div className="text-lg font-bold tabular-nums">{item.value.toString().padStart(2, '0')}</div>
            </div>
            <div className="text-xs text-gray-400 font-medium">{item.label}</div>
          </div>
        ))}
      </div>

      {/* Preview */}
      <div className="mb-8">
        <div className="relative rounded-xl overflow-hidden border border-amber-200/15 bg-gradient-to-br from-gray-900 to-black p-6 text-center">
          <div className="text-5xl mb-3">🧠</div>
          <div className="text-amber-200 text-lg font-bold mb-1">Millionaire Mindshift</div>
          <div className="text-gray-400 text-sm">Identity Rewire Mini Course</div>
          <div className="text-gray-500 text-xs mt-2">+ Live Zoom · Audios · Journal Prompts</div>
        </div>
      </div>

      {/* Pricing */}
      <div className="text-center mb-8">
        <div className="text-2xl font-bold text-white mb-3">Only {formatPrice(price)} Today</div>
        <div className="text-lg text-gray-200 mb-3">
          <span className="font-bold text-amber-200">(Save {savingsFormatted} today)</span>
        </div>
        <div className="text-gray-200 mb-4">
          Get Everything For <span className="line-through text-gray-500">{formatPrice(originalPrice)}</span> Just <span className="font-bold text-white">{formatPrice(price)}!</span>
        </div>
        <div className="text-sm text-gray-300 mb-4">Instant access. Start rewiring in 5 minutes.</div>
        <div className="text-xl font-bold text-white mb-6">Now Available Instantly</div>
      </div>

      {/* Email Field */}
      <div className="mb-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email address..."
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-amber-200/40 focus:ring-1 focus:ring-amber-200/40 transition-all"
        />
      </div>

      {/* CTA */}
      <button
        onClick={goToCheckout}
        className="group relative w-full overflow-hidden bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 text-black font-bold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.03] hover:shadow-[0_0_40px_rgba(251,191,36,0.35)] inline-flex items-center justify-center mb-4"
      >
        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
        <span className="relative z-10 flex items-center">Go To Secure Checkout<ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" /></span>
      </button>

      {/* Trust */}
      <div className="text-center mb-6">
        <div className="text-sm text-gray-300">Instant digital access. Start in 5 minutes.</div>
      </div>

      <div className="text-center space-y-4">
        <div className="flex items-center justify-center text-sm text-gray-200 bg-white/[0.03] rounded-lg py-2 px-4 border border-white/5">
          <Lock className="w-4 h-4 mr-2 text-amber-200" />
          <span className="font-medium">256-bit SSL encryption protects your data</span>
        </div>
        <div className="bg-white/[0.03] border border-amber-200/15 rounded-xl p-5">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-amber-200" />
            <div className="text-xl font-bold text-amber-200">14-Day &quot;Feel the Shift&quot; Guarantee</div>
          </div>
          <div className="text-gray-400 text-sm">Do the protocol once. If you don&rsquo;t physically feel a shift, full refund. No questions.</div>
        </div>
      </div>
    </div>
  );
};
