'use client';

import React, { useEffect, useState } from 'react';
import { Timer, Check, ShieldCheck, ArrowRight } from 'lucide-react';
import { OneClickCheckoutModal } from '@/components/checkout/OneClickCheckoutModal';
import { MediaFrame } from '@/components/mothermode/parts/MediaFrame';
import type { AscensionOffer } from '@/lib/mothermode/ascension';
import {
  parsePurchaseQuery,
  readPurchases,
  writePurchases,
  type MotherModePurchases,
} from '@/lib/mothermode/purchases';

interface MotherModeUpsellPageProps {
  offer: AscensionOffer;
  /** Merged into the purchase record when this OTO is accepted. */
  recordOnAccept: Partial<MotherModePurchases>;
  /** Where to send her after accepting. */
  acceptRedirect: string;
  /** Where to send her after declining. */
  declineRedirect: string;
  /** OTO1 only: finalize the front-end pack + bumps from the checkout query. */
  finalizeFrontEnd?: boolean;
  /**
   * OTO4 only: enable the "I need more time" control. Instead of declining
   * outright, the buyer (re)starts this deadline-driven sequence so we hold
   * their seat and email them through the window.
   */
  extendSequenceId?: string;
}

type ExtendState = 'idle' | 'prompt' | 'submitting' | 'done' | 'error';

/**
 * Data-driven Editorial Warm OTO page. Reads one ascension offer and walks the
 * buyer through accept (one-click modal) or decline. Subscription offers return
 * from Stripe Checkout with ?checkout=success, which is recorded on mount.
 */
export const MotherModeUpsellPage: React.FC<MotherModeUpsellPageProps> = ({
  offer,
  recordOnAccept,
  acceptRedirect,
  declineRedirect,
  finalizeFrontEnd = false,
  extendSequenceId,
}) => {
  const [timeLeft, setTimeLeft] = useState({
    minutes: offer.timerMinutes,
    seconds: 0,
  });
  const [showModal, setShowModal] = useState(false);
  const [extendState, setExtendState] = useState<ExtendState>('idle');
  const [extendEmail, setExtendEmail] = useState('');
  const [extendDeadline, setExtendDeadline] = useState<string | null>(null);
  const [extendError, setExtendError] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { minutes: prev.minutes - 1, seconds: 59 };
        clearInterval(t);
        return prev;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // OTO1: carry the front-end purchase + bumps in from the checkout redirect.
  useEffect(() => {
    if (!finalizeFrontEnd || typeof window === 'undefined') return;
    const incoming = parsePurchaseQuery(window.location.search);
    if (incoming.fe || (incoming.bumps && incoming.bumps.length > 0)) {
      writePurchases(incoming);
    }
  }, [finalizeFrontEnd]);

  // Subscription offers return from Stripe Checkout with ?checkout=success.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      writePurchases(recordOnAccept);
      window.location.href = acceptRedirect;
    }
  }, [recordOnAccept, acceptRedirect]);

  const accept = () => setShowModal(true);
  const decline = () => {
    window.location.href = declineRedirect;
  };
  const onCheckoutSuccess = () => {
    writePurchases(recordOnAccept);
    setShowModal(false);
    window.location.href = acceptRedirect;
  };

  // "I need more time": (re)start the deadline-driven hold sequence. The seat
  // email and name ride along from the stored purchase record when present.
  const submitExtend = async (email: string) => {
    if (!extendSequenceId) return;
    setExtendState('submitting');
    setExtendError(null);
    const saved = readPurchases();
    try {
      const res = await fetch('/api/mothermode/extend-offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name: saved.firstName ?? null,
          sequenceId: extendSequenceId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setExtendError(
          typeof data?.error === 'string'
            ? data.error
            : 'We could not hold your seat. Please try again.',
        );
        setExtendState('error');
        return;
      }
      setExtendDeadline(data.deadlineAt ?? null);
      setExtendState('done');
    } catch {
      setExtendError('We could not reach the server. Please try again.');
      setExtendState('error');
    }
  };

  const onExtendClick = () => {
    const saved = readPurchases();
    if (saved.email) {
      setExtendEmail(saved.email);
      void submitExtend(saved.email);
    } else {
      setExtendState('prompt');
    }
  };

  const formatDeadline = (iso: string | null): string | null => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(d);
  };

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="min-h-screen bg-bone font-sans text-ink antialiased">
      {/* Timer */}
      <div className="bg-mode py-3 text-center text-bone">
        <div className="flex items-center justify-center gap-2 text-sm">
          <Timer className="h-4 w-4 text-brass" />
          <span className="font-medium tabular-nums">
            {offer.timerLabel}. {pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        {/* Hook */}
        <p className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-brass">
          {offer.eyebrow}
        </p>
        <h1 className="mt-5 text-center font-display text-4xl leading-[1.05] text-ink sm:text-5xl md:text-6xl">
          {offer.headline}{' '}
          <span className="italic text-mode">{offer.headlineEmphasis}</span>
        </h1>
        {offer.headlineSuffix && (
          <p className="mt-4 text-center font-display text-xl text-ink/70 sm:text-2xl">
            {offer.headlineSuffix}
          </p>
        )}
        <p className="mx-auto mt-6 max-w-2xl text-center text-lg leading-relaxed text-ink/70">
          {offer.subheadline}
        </p>

        {/* Top video. Shows a walkthrough or an on-brand placeholder slot. */}
        {offer.media?.video && (
          <div className="mx-auto mt-10 max-w-2xl">
            <MediaFrame
              src={offer.media.videoPoster}
              alt={`Watch: ${offer.stackHeading}`}
              label="Walkthrough video"
              hint="1280 × 720"
              video
            />
          </div>
        )}

        <div className="mt-10 flex flex-col items-center">
          <button
            onClick={accept}
            className="inline-flex w-full max-w-md items-center justify-center gap-2 rounded-full bg-mode px-8 py-5 text-lg font-semibold text-bone transition-colors hover:bg-mode-deep"
          >
            <Check className="h-5 w-5 text-brass" />
            {offer.acceptLabel}
          </button>
          <p className="mt-3 text-sm text-ink/45">
            This page closes when the timer runs out. You will not see it again.
          </p>
        </div>

        {/* Letter */}
        <div className="mx-auto mt-16 max-w-2xl space-y-5 text-lg leading-relaxed text-ink/80">
          {offer.letter.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>

        {/* Gallery. Screenshots that show the thing actually working. */}
        {offer.media?.gallery && offer.media.gallery.length > 0 && (
          <div className="mt-16">
            {offer.media.galleryEyebrow && (
              <p className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-brass">
                {offer.media.galleryEyebrow}
              </p>
            )}
            <div
              className={`mt-8 grid gap-5 ${
                offer.media.gallery.length === 2
                  ? 'sm:grid-cols-2'
                  : 'sm:grid-cols-3'
              }`}
            >
              {offer.media.gallery.map((shot) => (
                <figure key={shot.alt}>
                  <MediaFrame
                    src={shot.src}
                    alt={shot.alt}
                    label={shot.alt}
                    hint={shot.hint}
                    aspect={offer.media?.galleryAspect ?? 'aspect-[9/16]'}
                  />
                  {shot.caption && (
                    <figcaption className="mt-3 text-center text-sm leading-relaxed text-ink/60">
                      {shot.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </div>
        )}

        {/* Value stack */}
        <div className="mt-16">
          <p className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-brass">
            {offer.stackEyebrow}
          </p>
          <h2 className="mt-3 text-center font-display text-3xl text-ink sm:text-4xl">
            {offer.stackHeading}
          </h2>
          <div className="mt-8 overflow-hidden rounded-2xl border border-ink/10 bg-white/70 shadow-sm">
            {offer.features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className={`flex items-start justify-between gap-4 border-b border-ink/[0.06] px-5 py-4 last:border-b-0 ${
                    f.core ? 'bg-mode/[0.04]' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Icon
                      className={`mt-0.5 h-5 w-5 flex-shrink-0 ${
                        f.core ? 'text-mode' : 'text-brass'
                      }`}
                    />
                    <div>
                      <div className="font-display text-lg text-ink">
                        {f.title}
                      </div>
                      <div className="text-sm text-ink/60">{f.description}</div>
                    </div>
                  </div>
                  <span className="flex-shrink-0 font-display text-lg text-brass">
                    {f.value}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-right text-sm text-ink/55">
            Total value:{' '}
            <span className="font-display text-base text-ink">
              {offer.totalValueLabel}
            </span>
          </p>
        </div>

        {/* Big idea */}
        <p className="mx-auto mt-16 max-w-2xl text-center font-display text-2xl italic leading-snug text-mode sm:text-3xl">
          {offer.bigIdea}
        </p>

        {/* Pricing + decision */}
        <div className="mt-12 rounded-2xl border border-brass/30 bg-white/70 p-8 text-center shadow-sm sm:p-10">
          <div className="font-display text-2xl text-ink/40 line-through">
            {offer.originalPriceLabel}
          </div>
          <div className="mt-1 font-display text-5xl text-mode sm:text-6xl">
            {offer.priceLabel}
          </div>
          <div className="mt-8 flex flex-col items-center gap-3">
            <button
              onClick={accept}
              className="inline-flex w-full max-w-md items-center justify-center gap-2 rounded-full bg-mode px-8 py-5 text-lg font-semibold text-bone transition-colors hover:bg-mode-deep"
            >
              <Check className="h-5 w-5 text-brass" />
              {offer.acceptLabel}
            </button>
            <button
              onClick={decline}
              className="px-6 py-3 text-sm text-ink/45 transition-colors hover:text-ink/70"
            >
              {offer.declineLabel}
            </button>

            {extendSequenceId && extendState === 'idle' && (
              <button
                onClick={onExtendClick}
                className="px-6 py-2 text-sm font-medium text-mode underline-offset-4 transition-colors hover:underline"
              >
                I need more time to decide
              </button>
            )}

            {extendSequenceId &&
              (extendState === 'prompt' ||
                extendState === 'submitting' ||
                extendState === 'error') && (
                <div className="w-full max-w-md rounded-xl border border-brass/30 bg-mode/[0.03] p-4 text-left">
                  <label
                    htmlFor="extend-email"
                    className="block text-sm text-ink/70"
                  >
                    Where should we send your held-seat details?
                  </label>
                  <input
                    id="extend-email"
                    type="email"
                    value={extendEmail}
                    onChange={(e) => setExtendEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="mt-2 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus:border-mode"
                  />
                  {extendError && (
                    <p className="mt-2 text-sm text-mode">{extendError}</p>
                  )}
                  <button
                    onClick={() => void submitExtend(extendEmail.trim())}
                    disabled={extendState === 'submitting'}
                    className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-mode px-6 py-3 text-sm font-semibold text-bone transition-colors hover:bg-mode-deep disabled:opacity-60"
                  >
                    {extendState === 'submitting'
                      ? 'Holding your seat...'
                      : 'Hold my seat and email me'}
                  </button>
                </div>
              )}

            {extendSequenceId && extendState === 'done' && (
              <div className="w-full max-w-md rounded-xl border border-brass/30 bg-mode/[0.04] p-5 text-center">
                <p className="font-display text-lg text-ink">
                  Your seat is held.
                </p>
                <p className="mt-1 text-sm text-ink/70">
                  {formatDeadline(extendDeadline)
                    ? `We are holding your founding seat until ${formatDeadline(
                        extendDeadline,
                      )}. Check your inbox for the details.`
                    : 'We are holding your founding seat. Check your inbox for the details.'}
                </p>
                <button
                  onClick={decline}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm text-ink/45 transition-colors hover:text-ink/70"
                >
                  Continue
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Guarantee */}
        <div className="mt-10 flex items-start gap-4 rounded-2xl border border-ink/10 bg-mode/[0.03] p-6">
          <ShieldCheck className="mt-0.5 h-8 w-8 flex-shrink-0 text-brass" />
          <div>
            <h3 className="font-display text-lg text-ink">
              {offer.guarantee.title}
            </h3>
            <p className="mt-1 leading-relaxed text-ink/70">
              {offer.guarantee.body}
            </p>
          </div>
        </div>

        <div className="mt-10 flex justify-center">
          <button
            onClick={decline}
            className="inline-flex items-center gap-1.5 text-sm text-ink/40 transition-colors hover:text-ink/60"
          >
            <span>{offer.declineLabel}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <OneClickCheckoutModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        productName={offer.stackHeading}
        productPrice={offer.priceLabel}
        productAmount={offer.priceCents}
        originalPrice={offer.originalPriceLabel}
        billingType={offer.billingType}
        subscriptionInterval={offer.interval}
        productId={offer.productId}
        paymentMetadata={{
          type: offer.metadataType,
          page_type: offer.pageType,
          parent_product: 'mothermode',
        }}
        features={offer.features.map((f) => ({
          name: `${f.title} (${f.value})`,
        }))}
        onSuccess={onCheckoutSuccess}
        colorTheme="mothermode"
      />
    </div>
  );
};
