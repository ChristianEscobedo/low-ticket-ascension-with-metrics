'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, Shield, Play, Lock } from 'lucide-react';
import { OneClickCheckoutModal } from '@/components/checkout/OneClickCheckoutModal';
import { writePurchases } from '@/lib/mindshift/purchases';

// Final OTO. Either path lands on the delivery page; the $500 deposit just
// flags that they secured a build spot so success can render the right card.
const SUCCESS_REDIRECT = '/millionaire-mindshift/success';
const DECLINE_REDIRECT = '/millionaire-mindshift/success';

// What gets built for them, done-for-you, over the 90 days.
const BUILD_INCLUDES = [
  { emoji: '🎯', title: 'Your Offer, Built From Scratch', desc: 'We name it, price it, and stack the bonuses so it sells.' },
  { emoji: '🧭', title: 'Positioning That Sticks', desc: 'We make you the obvious choice, not one more option.' },
  { emoji: '🛠️', title: 'The Full Funnel, Done For You', desc: 'Sales page, checkout, upsells, and thank-you, all wired.' },
  { emoji: '✍️', title: 'All The Copywriting', desc: 'Every word on every page, written by us, in your voice.' },
  { emoji: '📣', title: 'Ads That Bring Buyers', desc: 'We write and set up the ads that fill your funnel.' },
  { emoji: '🧠', title: 'Private Mindset Sessions', desc: 'We clear the blocks that show up the moment money grows.' },
  { emoji: '🔧', title: '90 Days Of Optimizing', desc: 'We watch the numbers and tune the build until it works.' },
];

const STEPS = [
  { n: '01', title: 'Secure Your Spot', desc: 'Put down $500 today. It comes off your first payment.' },
  { n: '02', title: 'Onboarding Call', desc: 'We map your offer, your market, and the full plan.' },
  { n: '03', title: 'We Build It', desc: 'Offer, funnel, copy, and ads, done for you in 90 days.' },
  { n: '04', title: 'We Optimize', desc: 'We tune the build and clear your mindset until it pays.' },
];

export const MillionaireMindshiftUpsell4Page: React.FC = () => {
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

  const handleAcceptOffer = () => setShowCheckoutModal(true);
  const handleDeclineOffer = () => { window.location.href = DECLINE_REDIRECT; };
  const handleCheckoutSuccess = () => {
    writePurchases({ buildDeposit: true });
    setShowCheckoutModal(false);
    window.location.href = SUCCESS_REDIRECT;
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Timer Header */}
      <div className="bg-gradient-to-r from-amber-600 to-amber-500 text-center py-4 text-black">
        <div className="flex items-center justify-center space-x-2">
          <Clock className="w-5 h-5" />
          <span className="font-bold tabular-nums">
            ONLY A FEW BUILD SPOTS OPEN: {String(timeLeft.minutes).padStart(2, '0')}:
            {String(timeLeft.seconds).padStart(2, '0')} Remaining
          </span>
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-0 opacity-[0.04]">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(251,191,36,0.18) 1px, transparent 0)`,
            backgroundSize: '25px 25px'
          }}></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
          {/* Headline */}
          <div className="text-center mb-14">
            <p className="text-amber-300 font-bold text-sm md:text-base mb-6 uppercase tracking-[0.25em]">
              ⚡ ONE LAST THING, AND IT IS THE BIG ONE ⚡
            </p>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black mb-8 leading-[0.95] tracking-tight">
              <span className="block text-white">Let Us Build Your</span>
              <span className="block bg-gradient-to-r from-amber-300 via-amber-400 to-amber-200 bg-clip-text text-transparent">
                Whole Money Machine
              </span>
              <span className="block text-white">For You</span>
            </h1>
            <p className="text-2xl md:text-3xl font-bold text-white mb-4">
              The same kind of offer you just bought, built for your business, by us.
            </p>
            <h2 className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto leading-relaxed font-medium">
              You fixed the mind. Now let us build the machine that turns it into money. Your offer, your funnel, your ads, your copy, done for you in <span className="text-amber-300 font-bold">90 days</span>.
            </h2>
          </div>

          {/* Video */}
          <div className="mb-8">
            <div className="bg-white/5 border-2 border-amber-500/40 shadow-[0_0_20px_rgba(251,191,36,0.1)] rounded-2xl p-2">
              <div className="aspect-video bg-gradient-to-br from-gray-900 to-black rounded-xl flex items-center justify-center cursor-pointer group">
                <div className="text-center text-gray-400">
                  <div className="w-20 h-20 mx-auto mb-4 bg-amber-500/20 rounded-full flex items-center justify-center group-hover:bg-amber-500/30 transition-colors">
                    <Play className="w-10 h-10 text-amber-300 ml-1" />
                  </div>
                  <div className="text-lg font-semibold mb-2 text-white">Watch: What We Build For You</div>
                  <div className="text-sm">A 3-minute look at the full done-for-you build</div>
                </div>
              </div>
            </div>
          </div>

          {/* CTA after video */}
          <div className="text-center mb-14">
            <button
              onClick={handleAcceptOffer}
              className="group relative bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:via-amber-400 hover:to-amber-500 text-black font-black py-5 px-10 rounded-xl text-xl md:text-2xl transition-all duration-300 transform hover:scale-105 shadow-[0_0_30px_rgba(251,191,36,0.35)] hover:shadow-[0_0_50px_rgba(251,191,36,0.5)] flex items-center justify-center mx-auto overflow-hidden"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
              <Lock className="w-7 h-7 mr-3" />
              Secure My Spot - $500 Today
            </button>
            <p className="text-sm text-amber-300/90 mt-4 font-semibold tracking-wide">
              Your $500 comes off your first payment. Spots are limited on purpose.
            </p>
          </div>

          {/* Personal Letter */}
          <div className="mb-14 max-w-3xl mx-auto">
            <div className="text-left space-y-6 text-lg md:text-xl leading-relaxed">
              <p className="text-white text-2xl font-bold">Here is the honest truth.</p>
              <p className="text-gray-300">
                You just did the hard part. You cleared the blocks that kept you stuck. But a clear mind with no machine to sell through still leaves money on the table.
              </p>
              <p className="text-gray-300">
                Most people now spend a year trying to figure out offers, funnels, ads, and copy on their own. They guess, they stall, and the new wiring slowly fades because nothing is making money yet.
              </p>
              <p className="text-gray-300">
                So here is what we want to do instead. <span className="font-bold text-amber-300">We build the whole thing for you.</span> The same kind of offer and funnel you just bought, built for your business, by the people who built this one.
              </p>
              <p className="text-gray-300">
                You bring your skill. We bring the offer, the positioning, the funnel, the ads, and every word of copy. And while we build, we keep clearing the money blocks that always show up the moment things start to grow.
              </p>
            </div>
          </div>

          {/* What We Build */}
          <div className="mb-14 max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-amber-300 font-bold text-sm uppercase tracking-[0.25em] mb-3">EVERYTHING DONE FOR YOU</p>
              <h2 className="text-3xl md:text-5xl font-black text-white">What We Build In 90 Days</h2>
            </div>
            <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(251,191,36,0.08)]">
              {BUILD_INCLUDES.map((item, index) => (
                <div key={index} className={`flex items-center gap-4 px-6 py-5 ${index < BUILD_INCLUDES.length - 1 ? 'border-b border-white/[0.06]' : ''} hover:bg-white/[0.02] transition-colors`}>
                  <span className="text-2xl flex-shrink-0">{item.emoji}</span>
                  <div className="min-w-0">
                    <div className="font-bold text-white text-base md:text-lg">{item.title}</div>
                    <div className="text-sm text-gray-500">{item.desc}</div>
                  </div>
                  <CheckCircle className="w-5 h-5 text-amber-300 ml-auto flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>

          {/* How It Works */}
          <div className="mb-14 max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-black text-center mb-8 text-white">How It Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {STEPS.map((step, index) => (
                <div key={index} className="bg-white/5 border border-amber-500/20 rounded-xl p-6 hover:border-amber-500/40 transition-colors">
                  <div className="text-amber-300 font-black text-2xl mb-2">{step.n}</div>
                  <div className="font-bold text-white mb-1">{step.title}</div>
                  <div className="text-sm text-gray-400">{step.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing */}
          <div className="text-center mb-14">
            <div className="bg-white/5 border-2 border-amber-500/40 shadow-[0_0_40px_rgba(251,191,36,0.15)] rounded-2xl p-10">
              <p className="text-sm text-amber-300 font-bold uppercase tracking-[0.2em] mb-6">
                The Done-For-You Build
              </p>
              <div className="text-lg text-gray-400 mb-1">
                Normal price: <span className="font-bold text-red-400 line-through">$12,000</span>
              </div>
              <div className="text-lg text-gray-400 mb-6">Join right now and save $2,000:</div>
              <div className="text-7xl md:text-8xl font-black bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent mb-3">$10,000</div>
              <p className="text-lg text-white font-semibold mb-2">
                Paid in two simple parts: <span className="text-amber-300">$5,000 to begin, $5,000 after you see results.</span>
              </p>
              <p className="text-base text-gray-400 mb-8">
                Today you only put down <span className="text-white font-bold">$500 to secure your spot</span>. That $500 comes off your first payment, so it is not an extra cost. We sort out the rest on your onboarding call.
              </p>

              <div className="space-y-4 max-w-md mx-auto">
                <button
                  onClick={handleAcceptOffer}
                  className="group relative w-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:via-amber-400 hover:to-amber-500 text-black font-black py-6 px-8 rounded-xl text-xl md:text-2xl transition-all duration-300 transform hover:scale-[1.02] shadow-[0_0_30px_rgba(251,191,36,0.35)] hover:shadow-[0_0_50px_rgba(251,191,36,0.5)] flex items-center justify-center overflow-hidden"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
                  <Lock className="w-7 h-7 mr-3" />
                  Secure My Spot - $500
                </button>
                <button
                  onClick={handleDeclineOffer}
                  className="w-full text-gray-600 hover:text-gray-400 text-sm py-4 px-6 transition-all duration-300"
                >
                  No thanks, I will build it all myself
                </button>
              </div>
            </div>
          </div>

          {/* Guarantee */}
          <div className="text-center mb-8">
            <div className="bg-white/5 border border-amber-500/30 rounded-xl p-8">
              <Shield className="w-14 h-14 text-amber-300 mx-auto mb-4" />
              <h4 className="text-2xl font-bold mb-3">Your Deposit Is Fully Refundable</h4>
              <p className="text-gray-400 max-w-lg mx-auto">
                Get on the onboarding call. If it is not a clear fit for your business, just say so and we refund your $500 in full. No pressure, no risk to claim your spot.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* One-Click Checkout Modal */}
      <OneClickCheckoutModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        productName="Done-For-You Build - Spot Deposit"
        productPrice="$500"
        productAmount={50000}
        guaranteeDays={14}
        productId="mindshift_dfy_build_deposit"
        paymentMetadata={{ type: 'mindshift_upsell_4', page_type: 'oto4', parent_product: 'millionaire_mindshift', plan: 'dfy_build_deposit' }}
        features={[
          { name: 'Locks your Done-For-You Build spot' },
          { name: 'Comes off your first payment (not an extra cost)' },
          { name: 'Books your onboarding call' },
          { name: '$2,000 join-now discount held for you' },
        ]}
        onSuccess={handleCheckoutSuccess}
        colorTheme="amber"
        subtitle="A $500 deposit to secure your spot · Applied to your first payment"
      />
    </div>
  );
};
