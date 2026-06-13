'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, Shield, Lock } from 'lucide-react';
import { OneClickCheckoutModal } from '@/components/checkout/OneClickCheckoutModal';
import { writePurchases } from '@/lib/mindshift/purchases';

// Whether they take the annual upgrade or not, the next step is the library offer.
const NEXT_REDIRECT = '/millionaire-mindshift/upsell-3';

export const MillionaireMindshiftUpsell2Page: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState({ minutes: 15, seconds: 0 });
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { minutes: prev.minutes - 1, seconds: 59 };
        clearInterval(timer);
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // The annual plan redirects to Stripe Checkout and returns with ?checkout=success
  // — record the upgrade to 'annual' and continue to the library offer.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      writePurchases({ clearingRoom: true, clearingRoomInterval: 'annual' });
      window.location.href = NEXT_REDIRECT;
    }
  }, []);

  const handleAcceptOffer = () => setShowCheckoutModal(true);
  const handleDeclineOffer = () => { window.location.href = NEXT_REDIRECT; };
  const handleCheckoutSuccess = () => {
    writePurchases({ clearingRoom: true, clearingRoomInterval: 'annual' });
    setShowCheckoutModal(false);
    window.location.href = NEXT_REDIRECT;
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Timer Header */}
      <div className="bg-gradient-to-r from-amber-600 to-amber-500 text-center py-4 text-black">
        <div className="flex items-center justify-center space-x-2">
          <Clock className="w-5 h-5" />
          <span className="font-bold tabular-nums">
            UPGRADE EXPIRES IN {String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
          </span>
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-0 opacity-[0.04]">
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(251,191,36,0.22) 1px, transparent 0)', backgroundSize: '25px 25px' }}></div>
        </div>

        <div className="relative z-10 max-w-3xl mx-auto px-4 py-8">
          {/* Confirmation banner */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-4 mb-10 flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-amber-300 flex-shrink-0" />
            <p className="text-amber-100 font-semibold text-sm md:text-base">
              You&apos;re in The Clearing Room — your founding seat is confirmed. One quick decision before your first call…
            </p>
          </div>

          {/* Headline */}
          <div className="text-center mb-12">
            <p className="text-amber-300 font-bold text-sm md:text-base mb-6 uppercase tracking-[0.25em]">
              ⚡ ONE-CLICK UPGRADE — MAKE IT PERMANENT ⚡
            </p>
            <h1 className="text-5xl md:text-7xl font-black mb-8 leading-[0.95] tracking-tight">
              <span className="block text-white">Lock Your Founding</span>
              <span className="block bg-gradient-to-r from-amber-300 via-amber-400 to-amber-200 bg-clip-text text-transparent">
                Rate For Life
              </span>
            </h1>
            <p className="text-2xl md:text-3xl font-bold text-white mb-4">
              Switch to annual and save <span className="text-amber-300">over 50%</span>.
            </p>
            <h2 className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed font-medium">
              You just joined at the founding monthly rate. Make it annual today for <span className="text-amber-300 font-bold">half off — and your founding rate never moves again</span>, even when the room raises the price for everyone else.
            </h2>
          </div>

          {/* The math — monthly vs annual */}
          <div className="mb-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Monthly */}
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-7 text-center">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-[0.2em] mb-3">Staying Monthly</p>
                <div className="text-4xl font-black text-gray-300 mb-1">$97<span className="text-xl text-gray-500">/mo</span></div>
                <p className="text-sm text-gray-500 mb-4">= $1,164 over 12 months</p>
                <ul className="text-sm text-gray-500 space-y-2 text-left">
                  <li className="flex items-start gap-2"><span className="text-gray-600 mt-0.5">•</span> Founding rate held — while you stay subscribed</li>
                  <li className="flex items-start gap-2"><span className="text-gray-600 mt-0.5">•</span> Billed every month</li>
                </ul>
              </div>

              {/* Annual — highlighted */}
              <div className="relative bg-amber-500/[0.06] border-2 border-amber-500/50 rounded-2xl p-7 text-center shadow-[0_0_40px_rgba(251,191,36,0.15)]">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-amber-500 text-black text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full">Best Value · Over 50% Off</span>
                <p className="text-xs text-amber-300 font-bold uppercase tracking-[0.2em] mb-3">Going Annual</p>
                <div className="text-4xl font-black bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent mb-1">$597<span className="text-xl text-amber-300/70">/yr</span></div>
                <p className="text-sm text-amber-200/80 mb-4">= just $50/mo · save $567</p>
                <ul className="text-sm text-gray-300 space-y-2 text-left">
                  <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-amber-300 mt-0.5 flex-shrink-0" /> Founding rate locked <span className="font-bold text-white">forever</span></li>
                  <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-amber-300 mt-0.5 flex-shrink-0" /> Over 50% off vs. paying monthly</li>
                  <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-amber-300 mt-0.5 flex-shrink-0" /> A full year in the room — no re-deciding monthly</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Annual-only bonus */}
          <div className="mb-12 bg-gradient-to-br from-amber-500/[0.07] to-transparent border border-amber-500/30 rounded-2xl p-7">
            <p className="text-xs text-amber-300 font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <Lock className="w-4 h-4" /> Annual Members Only
            </p>
            <h3 className="text-2xl md:text-3xl font-black text-white mb-4">
              Plus a Private 1:1 Custom Block Clearing Session ($500 value)
            </h3>
            <p className="text-gray-400 leading-relaxed">
              Lock in annual today and you get a private session where we run the full Subconscious Reset Method™
              on your single biggest block — live, 1:1 — so it&apos;s cleared and rewired before your very first room.
              Annual members only. It never comes with monthly.
            </p>
          </div>

          {/* Pricing + CTA */}
          <div className="text-center mb-10">
            <p className="text-gray-400 text-sm mb-2">Today only — your one-click upgrade</p>
            <div className="text-5xl md:text-6xl font-black mb-2">
              <span className="bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">$597</span>
              <span className="text-2xl text-gray-500">/yr</span>
            </div>
            <p className="text-amber-200/80 text-sm mb-8">Founding rate locked forever · Over 50% off · Cancel anytime</p>

            <button
              onClick={handleAcceptOffer}
              className="w-full md:w-auto inline-flex items-center justify-center gap-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black font-black text-lg md:text-xl px-10 py-5 rounded-2xl shadow-[0_0_40px_rgba(251,191,36,0.3)] transition-all hover:scale-[1.02]"
            >
              <Lock className="w-6 h-6" /> Yes — Lock My Founding Rate For Life
            </button>

            <div className="mt-6">
              <button
                onClick={handleDeclineOffer}
                className="text-gray-500 hover:text-gray-300 text-sm underline underline-offset-4 transition-colors"
              >
                No thanks — keep my monthly plan at $97/mo
              </button>
            </div>
          </div>

          {/* Guarantee */}
          <div className="max-w-xl mx-auto bg-white/[0.03] border border-white/10 rounded-2xl p-6 flex items-start gap-4">
            <Shield className="w-8 h-8 text-amber-300 flex-shrink-0" />
            <div>
              <p className="text-white font-bold mb-1">14-Day “Love The Room” Guarantee</p>
              <p className="text-gray-400 text-sm leading-relaxed">
                Come to the room, run the protocol, and use your private clearing session. If the annual plan isn&apos;t
                right for you within 14 days, we&apos;ll switch you back to monthly or refund the difference — just ask.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* One-Click Checkout Modal */}
      <OneClickCheckoutModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        productName="The Clearing Room — Annual Founding Membership"
        productPrice="$597"
        productAmount={59700}
        originalPrice="$1,164"
        guaranteeDays={14}
        billingType="subscription"
        subscriptionInterval="yearly"
        productId="mindshift_clearing_room_annual"
        paymentMetadata={{ type: 'mindshift_upsell_2', page_type: 'oto2', parent_product: 'millionaire_mindshift', plan: 'clearing_room_annual' }}
        features={[
          { name: 'Everything In The Clearing Room — For A Full Year' },
          { name: 'Founding Rate Locked Forever (never increases)' },
          { name: 'Save Over 50% vs. Paying Monthly' },
          { name: 'Private 1:1 Custom Block Clearing Session ($500 value)' },
        ]}
        onSuccess={handleCheckoutSuccess}
        colorTheme="amber"
        subtitle="Billed annually · Founding rate locked for life · Cancel anytime"
      />
    </div>
  );
};
