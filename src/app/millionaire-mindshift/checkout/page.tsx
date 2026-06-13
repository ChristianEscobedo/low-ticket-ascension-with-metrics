'use client';

import React, { useState, useEffect } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import Link from 'next/link';
import {
  ChevronLeft, Check, Shield, Lock,
  CreditCard, AlertCircle, Timer, Sparkles, Zap,
} from 'lucide-react';
import { StripeCheckoutForm } from '@/components/checkout/StripeCheckoutForm';
import { useStripeConfig } from '@/hooks/useStripeConfig';
import { ProductProvider, useProduct } from '@/contexts/ProductContext';
import {
  BONUSES,
  FALLBACK_PRODUCT,
  TIMER_STORAGE_KEY,
} from '@/components/sales-page/mindshift-sections/constants';
import { buildPurchaseQuery, type MindshiftBumpId } from '@/lib/mindshift/purchases';

const INCLUDED_ITEMS = [
  'The Identity Audit (Module 1)',
  'The Muscle-Testing Protocol (Module 2)',
  'The Clearing Sequence (Module 3)',
  'Installing the New Identity (Module 4)',
  'The Daily Congruence Practice (Module 5)',
  'Lifetime access + all future updates',
  'Private members area + guided audios',
  '14-day "Feel the Shift" guarantee',
];

const PRODUCT_IMAGE = 'https://assets.cdn.filesafe.space/FnedsjhvL9EqG9Eyjhep/media/6a2864cdbcef8d4f9fa5a306.png';

// Discount applied when the visitor adds every one-time offer in one go.
const BUNDLE_DISCOUNT_CENTS = 2000;

const ORDER_BUMPS = [
  {
    id: 'money_blocks_vault',
    title: 'The Subconscious Money Blocks Vault',
    subtitle: '12 Done-For-You Clearings For The Beliefs That Cap Your Income',
    description:
      'The 12 income ceilings we see most \u2014 \u201cvisibility isn\u2019t safe,\u201d \u201cmoney changes people,\u201d \u201cI\u2019ll just lose it anyway\u201d \u2014 each with a ready-to-run clearing you play the moment that block surfaces. Skip the diagnosis: open the vault, run the sequence, and let your body confirm it cleared. Normally $297 \u2014 yours for just $47 when you add it now.',
    price_cents: 4700,
    originalPrice: '$297',
    emoji: '\ud83d\udd13',
    image: '',
  },
  {
    id: 'financial_thermostats_zoom',
    title: 'Live "Raising Financial Thermostats" Zoom Seat',
    subtitle: 'Reset The Income Set-Point Your Nervous System Defends',
    description:
      'Your financial thermostat is the income level your subconscious treats as \u201csafe\u201d \u2014 cross it and your system quietly pulls you back down (overspending, self-sabotage, stalled launches). In this live Zoom we run The Subconscious Reset Method\u2122 on the exact set-point holding your ceiling in place \u2014 and install a higher one your body will actually defend. Normally $297 \u2014 yours for just $47 when you add it now.',
    price_cents: 4700,
    originalPrice: '$297',
    emoji: '\ud83c\udf21\ufe0f',
    image: 'https://assets.cdn.filesafe.space/FnedsjhvL9EqG9Eyjhep/media/6a2a9db60b818c92b33ae206.png',
  },
  {
    id: 'seven_deadly_sins_loa',
    title: 'The Seven Deadly Sins Of The Law Of Attraction',
    subtitle: 'Why You\u2019re Manifesting The Wrong Way \u2014 And How To Fix It',
    description:
      'The 7 conscious-side patterns (envy, greed, pride\u2026) that quietly repel everything you say you want \u2014 plus the 4-session Wealth Archive bundle: Money|Debt \u00b7 Self Love (Unlocking The Inner Genius) \u00b7 Movement Feedback 1 \u00b7 Wealth-Session Movement Feedback 6-23-21. Normally $197 \u2014 yours for just $27.',
    price_cents: 2700,
    originalPrice: '$197',
    emoji: '\u2696\ufe0f',
    image: 'https://assets.cdn.filesafe.space/FnedsjhvL9EqG9Eyjhep/media/6a2a9db6ee57e63b9606893b.png',
  },
];

export default function MillionaireMindshiftCheckoutPage() {
  return (
    <ProductProvider productId="millionaire_mindshift" fallbackProduct={FALLBACK_PRODUCT}>
      <MindshiftCheckoutContent />
    </ProductProvider>
  );
}


function MindshiftCheckoutContent() {
  const { stripePromise } = useStripeConfig();
  const { product, formatPrice } = useProduct();

  const [customerData, setCustomerData] = useState({ firstName: '', lastName: '', email: '' });
  const [clientSecret, setClientSecret] = useState('');
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [selectedBumps, setSelectedBumps] = useState<Record<string, boolean>>({});

  const basePrice = product?.price_cents || FALLBACK_PRODUCT.price_cents;
  const originalPrice = product?.original_price_cents || FALLBACK_PRODUCT.original_price_cents;
  const bumpsTotal = ORDER_BUMPS.reduce(
    (sum, bump) => (selectedBumps[bump.id] ? sum + bump.price_cents : sum),
    0,
  );
  const allBumpsSelected =
    ORDER_BUMPS.length > 1 && ORDER_BUMPS.every((bump) => selectedBumps[bump.id]);
  const bundleDiscount = allBumpsSelected ? BUNDLE_DISCOUNT_CENTS : 0;
  const totalPrice = basePrice + bumpsTotal - bundleDiscount;
  const displayPrice = formatPrice(totalPrice);
  const baseDisplayPrice = formatPrice(basePrice);
  const savingsPercent = Math.round(((originalPrice - basePrice) / originalPrice) * 100);

  const toggleBump = (bumpId: string) => {
    setSelectedBumps((prev) => ({ ...prev, [bumpId]: !prev[bumpId] }));
  };

  const toggleAllBumps = () => {
    const next = !allBumpsSelected;
    setSelectedBumps(
      ORDER_BUMPS.reduce(
        (acc, bump) => ({ ...acc, [bump.id]: next }),
        {} as Record<string, boolean>,
      ),
    );
  };

  useEffect(() => {
    let endTime = localStorage.getItem(TIMER_STORAGE_KEY);
    if (!endTime) {
      const end = Date.now() + 24 * 60 * 60 * 1000;
      localStorage.setItem(TIMER_STORAGE_KEY, end.toString());
      endTime = end.toString();
    }
    const targetTime = parseInt(endTime);
    const updateTimer = () => {
      const diff = Math.max(0, targetTime - Date.now());
      setTimeLeft({
        hours: Math.floor(diff / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  const createPaymentIntent = async () => {
    if (!customerData.firstName || !customerData.lastName || !customerData.email) {
      setPaymentError('Please fill in all required fields');
      return;
    }
    setIsLoadingPayment(true);
    setPaymentError('');

    try {
      const activeBumps = ORDER_BUMPS.filter((b) => selectedBumps[b.id]).map((b) => b.id);
      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: totalPrice,
          currency: 'usd',
          customer_data: customerData,
          product_id: 'millionaire_mindshift',
          metadata: {
            type: 'millionaire_mindshift',
            page_type: 'fe',
            product_name: 'Millionaire Mindshift',
            order_bumps: activeBumps.join(','),
          },
        }),
      });
      const data = await response.json();
      if (data.client_secret) {
        try { localStorage.setItem('customerData', JSON.stringify(customerData)); } catch {}
        setClientSecret(data.client_secret);
      } else {
        setPaymentError(data.error || 'Failed to initialize payment');
      }
    } catch {
      setPaymentError('Failed to connect to payment server');
    } finally {
      setIsLoadingPayment(false);
    }
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const activeBumpIds = ORDER_BUMPS
    .filter((b) => selectedBumps[b.id])
    .map((b) => b.id as MindshiftBumpId);
  const successUrl = `${origin}/millionaire-mindshift/upsell${buildPurchaseQuery({
    fe: true,
    bumps: activeBumpIds,
    email: customerData.email || undefined,
    firstName: customerData.firstName || undefined,
  })}`;

  return (
    <div className="min-h-screen bg-black text-white relative">
      {/* Background pattern */}
      <div className="fixed inset-0 opacity-5 pointer-events-none">
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(251,191,36,0.18) 1px, transparent 0)', backgroundSize: '20px 20px' }}></div>
      </div>

      {/* Urgency bar */}
      <div className="relative z-10 bg-gradient-to-r from-amber-400/25 via-amber-300/30 to-amber-400/25 py-2.5 px-4 border-b border-amber-300/25">
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-4 flex-wrap text-sm">
          <div className="flex items-center gap-2 text-amber-100">
            <Timer className="w-4 h-4 animate-pulse" />
            <span className="font-bold tracking-wide">FOUNDING-MEMBER PRICE EXPIRES IN:</span>
          </div>
          <div className="flex items-center gap-1 bg-black/70 px-4 py-1.5 rounded-lg font-mono font-bold text-lg text-amber-200 tabular-nums">
            <span>{String(timeLeft.hours).padStart(2, '0')}</span>:
            <span>{String(timeLeft.minutes).padStart(2, '0')}</span>:
            <span>{String(timeLeft.seconds).padStart(2, '0')}</span>
          </div>
        </div>
      </div>

      {/* Wordmark */}
      <div className="relative z-10 bg-black/80 backdrop-blur-sm py-5 text-center border-b border-amber-300/10">
        <div className="inline-flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-200 to-amber-400 flex items-center justify-center text-black font-black text-lg">M</div>
          <span className="text-amber-100 font-bold tracking-[0.35em] text-sm uppercase">Millionaire Mindshift</span>
        </div>
      </div>

      {/* Back link */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 pt-6">
        <Link href="/millionaire-mindshift" className="inline-flex items-center gap-2 text-gray-400 hover:text-amber-200 transition-colors text-sm">
          <ChevronLeft className="w-4 h-4" />
          <span>Back to offer details</span>
        </Link>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Form column */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 backdrop-blur border-2 border-amber-300/30 rounded-2xl p-6 md:p-8 shadow-[0_0_30px_rgba(252,211,77,0.06)]">
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 bg-amber-300/10 border border-amber-300/20 text-amber-200 rounded-full px-4 py-1.5 text-sm mb-4">
                  <Lock className="w-4 h-4" />
                  <span>Secure Checkout</span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Complete Your Order</h2>
                <p className="text-sm text-gray-400">Fill in your details below to get instant access to the rewire.</p>
              </div>

              <div className="space-y-6">
                {/* Step 1 — contact */}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-amber-200 to-amber-400 flex items-center justify-center text-sm font-black text-black">1</div>
                    <h3 className="text-xl font-bold text-white">Contact Information</h3>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">First Name *</label>
                      <input
                        type="text" required
                        value={customerData.firstName}
                        onChange={(e) => setCustomerData(prev => ({ ...prev, firstName: e.target.value }))}
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 outline-none transition-all focus:ring-2 focus:ring-amber-300/20 focus:border-amber-300"
                        placeholder="First name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Last Name *</label>
                      <input
                        type="text" required
                        value={customerData.lastName}
                        onChange={(e) => setCustomerData(prev => ({ ...prev, lastName: e.target.value }))}
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 outline-none transition-all focus:ring-2 focus:ring-amber-300/20 focus:border-amber-300"
                        placeholder="V."
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-400 mb-2">Email Address *</label>
                    <input
                      type="email" required
                      value={customerData.email}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 outline-none transition-all focus:ring-2 focus:ring-amber-300/20 focus:border-amber-300"
                      placeholder="you@example.com"
                    />
                    <p className="text-xs text-gray-500 mt-2">Your login credentials will be sent here</p>
                  </div>
                </div>

                <div className="border-t border-white/10"></div>

                {/* Step 2 — payment */}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${clientSecret ? 'bg-gradient-to-r from-amber-200 to-amber-400 text-black' : 'bg-gray-700 text-white'}`}>2</div>
                    <h3 className="text-xl font-bold text-white">Payment Details</h3>
                  </div>

                  {paymentError && (
                    <div className="mb-4 p-3 bg-red-900/30 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-300 text-sm">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{paymentError}</span>
                    </div>
                  )}

                  {!clientSecret ? (
                    <button
                      onClick={createPaymentIntent}
                      disabled={isLoadingPayment || !customerData.firstName || !customerData.lastName || !customerData.email}
                      className="group relative w-full overflow-hidden bg-gradient-to-r from-amber-200 via-amber-300 to-amber-400 disabled:from-gray-700 disabled:via-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-black disabled:text-gray-400 font-black py-4 px-6 rounded-xl text-lg transition-all duration-300 transform hover:scale-[1.02] disabled:scale-100 hover:shadow-[0_0_40px_rgba(252,211,77,0.3)] flex items-center justify-center gap-2"
                    >
                      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
                      {isLoadingPayment ? (
                        <span className="relative z-10 flex items-center gap-2">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
                          Preparing Secure Checkout...
                        </span>
                      ) : (
                        <span className="relative z-10 flex items-center gap-2">
                          <Lock className="w-5 h-5" />
                          Continue to Payment — {displayPrice}
                        </span>
                      )}
                    </button>
                  ) : (
                    <Elements
                      stripe={stripePromise}
                      options={{
                        clientSecret,
                        appearance: {
                          theme: 'night',
                          variables: {
                            colorPrimary: '#fcd34d',
                            colorBackground: '#0a0a0a',
                            colorText: '#ffffff',
                            colorDanger: '#ef4444',
                            fontFamily: 'system-ui, sans-serif',
                            borderRadius: '12px',
                          },
                        },
                      }}
                    >
                      <StripeCheckoutForm
                        customerData={customerData}
                        successUrl={successUrl}
                        amount={totalPrice}
                        buttonText={`Complete Purchase — ${displayPrice}`}
                        accentColor="amber"
                      />
                    </Elements>
                  )}
                </div>
              </div>

              {/* Trust elements */}
              <div className="mt-8 pt-6 border-t border-white/10">
                <div className="flex items-center justify-center gap-6 text-sm text-gray-400">
                  <div className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-amber-200" /><span>256-bit SSL</span></div>
                  <div className="flex items-center gap-1.5"><Lock className="w-4 h-4 text-amber-200" /><span>Secure Payment</span></div>
                  <div className="flex items-center gap-1.5"><CreditCard className="w-4 h-4 text-amber-200" /><span>Stripe Protected</span></div>
                </div>
              </div>
            </div>

            {/* Bundle-all upgrade CTA */}
            {ORDER_BUMPS.length > 1 && (
              <button
                type="button"
                onClick={toggleAllBumps}
                className={`w-full rounded-2xl border-2 px-5 py-4 flex items-center justify-between gap-3 transition-all duration-300 ${
                  allBumpsSelected
                    ? 'border-amber-200/70 bg-gradient-to-r from-amber-300/20 to-amber-200/10 shadow-[0_0_40px_rgba(252,211,77,0.18)]'
                    : 'border-amber-300/30 bg-gradient-to-r from-amber-300/10 to-amber-200/5 hover:border-amber-200/50'
                }`}
              >
                <div className="flex items-center gap-3 text-left">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    allBumpsSelected ? 'bg-gradient-to-r from-amber-200 to-amber-400 border-amber-200' : 'border-gray-500 bg-transparent'
                  }`}>
                    {allBumpsSelected && <Check className="w-3.5 h-3.5 text-black" />}
                  </div>
                  <div>
                    <div className="font-black text-white text-sm uppercase tracking-wide">Add All Upgrades &amp; Save</div>
                    <div className="text-xs text-amber-200/80 mt-0.5">Take every one-time offer below and knock {formatPrice(BUNDLE_DISCOUNT_CENTS)} off the total.</div>
                  </div>
                </div>
                <span className="text-sm font-black bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent whitespace-nowrap">
                  Save {formatPrice(BUNDLE_DISCOUNT_CENTS)}
                </span>
              </button>
            )}

            {/* Order bumps */}
            {ORDER_BUMPS.map((bump) => (
              <div
                key={bump.id}
                onClick={() => toggleBump(bump.id)}
                className={`relative cursor-pointer rounded-2xl overflow-hidden transition-all duration-300 ${
                  selectedBumps[bump.id]
                    ? 'border-2 border-amber-200/70 shadow-[0_0_40px_rgba(252,211,77,0.18)]'
                    : 'border-2 border-amber-300/30 shadow-[0_0_20px_rgba(252,211,77,0.06)] hover:border-amber-200/50'
                }`}
              >
                <div className={`px-5 py-3 flex items-center gap-3 ${
                  selectedBumps[bump.id]
                    ? 'bg-gradient-to-r from-amber-300/20 to-amber-200/10'
                    : 'bg-gradient-to-r from-amber-300/10 to-amber-200/5'
                }`}>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    selectedBumps[bump.id]
                      ? 'bg-gradient-to-r from-amber-200 to-amber-400 border-amber-200'
                      : 'border-gray-500 bg-transparent'
                  }`}>
                    {selectedBumps[bump.id] && <Check className="w-3.5 h-3.5 text-black" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-200" />
                    <span className="font-bold text-white text-sm uppercase tracking-wide">One-Time Offer — Add To Your Order</span>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 p-5">
                  {bump.image && (
                    <div className="rounded-xl mb-4 overflow-hidden border border-amber-200/15 bg-black/30">
                      <img src={bump.image} alt={bump.title} className="w-full h-auto block" loading="lazy" />
                    </div>
                  )}
                  <div className="flex items-start gap-4">
                    <div className="text-3xl flex-shrink-0">{bump.emoji}</div>
                    <div className="flex-1">
                      <h4 className="text-lg font-black text-white mb-1">{bump.title}</h4>
                      <p className="text-sm text-amber-200 font-semibold mb-2">{bump.subtitle}</p>
                      <p className="text-sm text-gray-300 leading-relaxed mb-3">{bump.description}</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-black bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent">{formatPrice(bump.price_cents)}</span>
                        <span className="text-sm text-gray-500 line-through">{bump.originalPrice}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary column */}
          <div className="lg:col-span-2">
            <div className="sticky top-4 space-y-4">
              <div className="relative rounded-2xl overflow-hidden border-2 border-amber-300/30 shadow-[0_0_20px_rgba(252,211,77,0.06)] bg-gradient-to-br from-amber-200/10 via-black to-amber-300/10">
                {PRODUCT_IMAGE ? (
                  <div className="overflow-hidden border-b border-amber-300/20 bg-black/30">
                    <img src={PRODUCT_IMAGE} alt="Millionaire Mindshift" className="w-full h-auto block" loading="lazy" />
                  </div>
                ) : null}
                <div className="p-10 text-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-200 to-amber-400 flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(252,211,77,0.25)]">
                    <Sparkles className="w-10 h-10 text-black" />
                  </div>
                  <div className="text-lg font-bold text-white">Millionaire Mindshift</div>
                  <div className="text-sm text-amber-200/80 mt-1">The Identity Rewire Protocol</div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 backdrop-blur border-2 border-amber-300/30 rounded-2xl p-6 shadow-[0_0_20px_rgba(252,211,77,0.06)]">
                <div className="text-center mb-6">
                  <div className="flex items-baseline justify-center gap-2 mb-1">
                    <span className="text-4xl font-black text-white">{displayPrice}</span>
                    <span className="text-lg text-gray-500 line-through">{formatPrice(originalPrice)}</span>
                  </div>
                  <div className="inline-block bg-gradient-to-r from-amber-300/15 to-amber-200/15 border border-amber-300/25 rounded-full px-4 py-1 mb-4">
                    <span className="text-sm font-bold bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent">SAVE {savingsPercent}%</span>
                  </div>
                  <div className="border-t border-white/10 pt-4">
                    <h3 className="text-lg font-bold text-white">Millionaire Mindshift</h3>
                    <p className="text-sm text-gray-400">Complete Identity Rewire Package</p>
                  </div>

                  {bumpsTotal > 0 && (
                    <div className="mt-4 pt-3 border-t border-white/10 text-left space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Base: Millionaire Mindshift</span>
                        <span className="text-white font-medium">{baseDisplayPrice}</span>
                      </div>
                      {ORDER_BUMPS.filter(b => selectedBumps[b.id]).map(bump => (
                        <div key={bump.id} className="flex items-center justify-between text-sm">
                          <span className="text-amber-200">{bump.emoji} {bump.title}</span>
                          <span className="text-white font-medium">{formatPrice(bump.price_cents)}</span>
                        </div>
                      ))}
                      {bundleDiscount > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-amber-300">Bundle discount</span>
                          <span className="text-amber-300 font-medium">&minus;{formatPrice(bundleDiscount)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-sm font-bold pt-2 border-t border-white/10">
                        <span className="text-white">Total</span>
                        <span className="bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent text-lg">{displayPrice}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mb-5">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">What&apos;s Included</h4>
                  <div className="space-y-1.5">
                    {INCLUDED_ITEMS.map((item, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-gray-300">
                        <Check className="w-3.5 h-3.5 text-amber-200 mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mb-5 pt-4 border-t border-white/10">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{BONUSES.length} Free Bonuses</h4>
                  <div className="space-y-1.5">
                    {BONUSES.map((bonus) => (
                      <div key={bonus.number} className="flex items-center justify-between text-sm">
                        <span className="text-gray-300">{bonus.title}</span>
                        <span className="text-amber-200 font-medium text-xs">{bonus.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white/[0.03] border-2 border-amber-300/25 rounded-xl p-4 text-center">
                  <Shield className="w-6 h-6 text-amber-200 mx-auto mb-1.5" />
                  <p className="text-sm font-bold text-white mb-0.5">14-Day &ldquo;Feel the Shift&rdquo; Guarantee</p>
                  <p className="text-xs text-gray-500">Run the protocol once. If you don&apos;t physically feel a shift, full refund.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
