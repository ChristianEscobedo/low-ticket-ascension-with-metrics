'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Lock, Shield, Sparkles, Play } from 'lucide-react';
import { ProductProvider, useProduct } from '@/contexts/ProductContext';
import { ResellerTracking } from '@/components/reseller/ResellerTracking';
import { FALLBACK_PRODUCT, REF_STORAGE_KEY, TOTAL_BONUS_VALUE } from './mindshift-sections/constants';
import { useCheckoutNav } from './mindshift-sections/useCheckout';

// Drop the finished VSL render here (MP4/HLS). Until then the player shows a styled placeholder.
const VSL_VIDEO_SRC = '';
const VSL_POSTER =
  'https://assets.cdn.filesafe.space/FnedsjhvL9EqG9Eyjhep/media/6a2862ba77feef7e78ca7ad3.png';
// The offer reveals at the 2:38 beat in the script (158s of runtime).
const CTA_REVEAL_SECONDS = 158;

const OFFER_INCLUDES = [
  'The Identity Audit',
  'The 5-Minute Muscle-Testing Protocol',
  'The Clearing Sequence',
  'Installing The Millionaire Belief Stack',
  '30 Daily Congruence Audios',
];

const VSLContent: React.FC = () => {
  const goToCheckout = useCheckoutNav();
  const { product, formatPrice } = useProduct();
  const price = product?.price_cents ?? FALLBACK_PRODUCT.price_cents;
  const originalPrice = product?.original_price_cents ?? FALLBACK_PRODUCT.original_price_cents;
  const totalValueCents = originalPrice + TOTAL_BONUS_VALUE * 100;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const offerRef = useRef<HTMLDivElement | null>(null);
  const [started, setStarted] = useState(false);
  const [ctaUnlocked, setCtaUnlocked] = useState(false);

  // Capture ?ref= so the CTA forwards it to checkout (mirrors the sales page).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) localStorage.setItem(REF_STORAGE_KEY, ref);
  }, []);

  // Start the reveal countdown the moment the VSL begins playing.
  const handleStart = useCallback(() => {
    if (started) return;
    setStarted(true);
    if (videoRef.current && VSL_VIDEO_SRC) {
      void videoRef.current.play().catch(() => {});
    }
  }, [started]);

  useEffect(() => {
    if (!started || ctaUnlocked) return;
    const t = setTimeout(() => setCtaUnlocked(true), CTA_REVEAL_SECONDS * 1000);
    return () => clearTimeout(t);
  }, [started, ctaUnlocked]);

  useEffect(() => {
    if (ctaUnlocked && offerRef.current) {
      offerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [ctaUnlocked]);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-amber-200/20 selection:text-amber-100">
      <ResellerTracking resellerId="millionaire-mindshift" pageType="sales" trackingEnabled={true} />

      {/* Ambient gold glow */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-40"
        style={{ background: 'radial-gradient(60% 50% at 50% 0%, rgba(251,191,36,0.10), transparent 70%)' }} />

      <div className="relative z-10 max-w-4xl mx-auto px-4 pt-12 pb-24">
        {/* Eyebrow + headline */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-white/[0.04] border border-amber-200/20 text-amber-200 rounded-full px-4 py-1.5 text-xs font-semibold tracking-[0.18em] uppercase mb-5">
            <Sparkles className="w-3.5 h-3.5" />
            The Subconscious Reset Method&trade;
          </div>
          <h1 className="text-3xl md:text-5xl font-black leading-tight text-white mb-4">
            If You Keep Hitting The Same Income Ceiling,{' '}
            <span className="bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 bg-clip-text text-transparent">
              Something Older Is Voting Against You
            </span>
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Watch this short walkthrough. It shows the one reason your income keeps stalling &mdash; and the
            4-step method that clears it at the nervous-system level.
          </p>
        </div>

        {/* Sticky video player */}
        <div className="lg:sticky lg:top-4 z-20 mb-8">
          <div className="relative rounded-2xl overflow-hidden border-2 border-amber-200/30 shadow-[0_0_50px_rgba(251,191,36,0.12)] bg-gray-950 aspect-video">
            {VSL_VIDEO_SRC ? (
              <video
                ref={videoRef}
                src={VSL_VIDEO_SRC}
                poster={VSL_POSTER}
                controls={started}
                playsInline
                onPlay={handleStart}
                className="w-full h-full object-cover"
              />
            ) : (
              <img src={VSL_POSTER} alt="Millionaire Mindshift VSL" className="w-full h-full object-cover opacity-60" />
            )}

            {!started && (
              <button
                onClick={handleStart}
                className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/55 backdrop-blur-[2px] transition-colors hover:bg-black/45"
              >
                <span className="flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-amber-200 to-amber-400 text-black shadow-[0_0_40px_rgba(251,191,36,0.45)] transition-transform group-hover:scale-105">
                  <Play className="w-9 h-9 ml-1" fill="currentColor" />
                </span>
                <span className="text-amber-100/90 text-sm uppercase tracking-[0.2em] font-semibold">
                  Click To Play
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Locked notice (before reveal) */}
        {started && !ctaUnlocked && (
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 text-amber-200/70 text-sm">
              <Lock className="w-4 h-4" />
              Keep watching &mdash; your offer unlocks during the video.
            </div>
          </div>
        )}

        {/* Offer card (revealed at the 2:38 beat) */}
        <div
          ref={offerRef}
          className={`transition-all duration-700 ${ctaUnlocked ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6 pointer-events-none h-0 overflow-hidden'}`}
        >
          {ctaUnlocked && (
            <OfferCard
              price={price}
              originalPrice={originalPrice}
              totalValueCents={totalValueCents}
              formatPrice={formatPrice}
              goToCheckout={goToCheckout}
            />
          )}
        </div>
      </div>
    </div>
  );
};

interface OfferCardProps {
  price: number;
  originalPrice: number;
  totalValueCents: number;
  formatPrice: (cents: number) => string;
  goToCheckout: () => void;
}

const OfferCard: React.FC<OfferCardProps> = ({
  price,
  originalPrice,
  totalValueCents,
  formatPrice,
  goToCheckout,
}) => (
  <div className="bg-gradient-to-br from-gray-900/70 to-gray-950/70 border-2 border-amber-200/30 rounded-3xl p-8 backdrop-blur-sm shadow-[0_0_40px_rgba(251,191,36,0.10)]">
    <div className="text-center mb-6">
      <p className="text-amber-200/80 text-xs uppercase tracking-[0.18em] font-semibold mb-2">
        Start The Reset Today
      </p>
      <h2 className="text-2xl md:text-3xl font-bold text-white mb-1">The Millionaire Mindshift Protocol</h2>
      <p className="text-gray-400 text-sm">The full 4-step method, plus 30 daily congruence audios.</p>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-7">
      {OFFER_INCLUDES.map((item) => (
        <div key={item} className="flex items-center text-gray-300">
          <span className="text-amber-200 mr-3">&#10003;</span>
          <span>{item}</span>
        </div>
      ))}
    </div>

    <div className="text-center mb-6">
      <p className="text-gray-500 text-sm line-through">{formatPrice(totalValueCents)} total value</p>
      <div className="flex items-center justify-center gap-3 mt-1">
        <span className="text-gray-500 text-2xl line-through">{formatPrice(originalPrice)}</span>
        <span className="text-5xl font-black bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 bg-clip-text text-transparent">
          {formatPrice(price)}
        </span>
      </div>
      <p className="text-amber-200/70 text-xs uppercase tracking-[0.15em] mt-2">One-Time &middot; Instant Access</p>
    </div>

    <button
      onClick={goToCheckout}
      className="group relative w-full overflow-hidden bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 text-black font-black text-lg md:text-xl px-10 py-5 rounded-xl transition-all hover:scale-[1.02] shadow-[0_10px_40px_rgba(251,191,36,0.2)] hover:shadow-[0_15px_50px_rgba(251,191,36,0.35)] inline-flex items-center justify-center"
    >
      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
      <span className="relative z-10 flex items-center gap-3">
        That&rsquo;s Me &mdash; Start The Reset For {formatPrice(price)}
        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
      </span>
    </button>

    <div className="flex items-center justify-center gap-2 mt-5 text-gray-400 text-sm">
      <Shield className="w-4 h-4 text-amber-200/80" />
      14-day no-questions guarantee &middot; Secure checkout
    </div>
  </div>
);

export const MillionaireMindshiftVSLPage: React.FC = () => (
  <ProductProvider productId="millionaire_mindshift" fallbackProduct={FALLBACK_PRODUCT}>
    <VSLContent />
  </ProductProvider>
);
