'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Timer } from 'lucide-react';
import type { MotherModeOffer } from '@/lib/mothermode/types';
import { ROUTES, STORAGE } from '@/lib/mothermode/brand';
import { parsePriceToCents } from '@/lib/mothermode/format';
import { buildPurchaseQuery } from '@/lib/mothermode/purchases';
import { useStripeConfig } from '@/hooks/useStripeConfig';
import { ContactPaymentCard } from './ContactPaymentCard';
import { OrderBumps } from './OrderBumps';
import { OrderSummary } from './OrderSummary';
import { MmEditable } from '@/components/mothermode/sales/SalesPageEditContext';

interface MotherModeCheckoutProps {
  offer: MotherModeOffer;
  affiliateRef?: string;
  /**
   * Where to send the buyer after successful payment (before query string).
   * Defaults to the original OTO1 path `/mothermode/upsell`.
   * Funnel builder passes `/funnel/{slug}/upsell` so the ladder stays in-builder.
   */
  successPath?: string;
  /** Optional back-link target. Defaults to the catalog offer page. */
  backHref?: string;
  /** Optional back-link label. */
  backLabel?: string;
  /** Top timer bar label. Editable in funnel builder via checkout.timerLabel. */
  timerLabel?: string;
  /** Header brand text. Editable in funnel builder via checkout.brandLabel. */
  brandLabel?: string;
  /** Funnel identity — stamps attribution metadata + enables server-side
   *  price resolution from the step's product assignment. */
  funnelSlug?: string;
  /** Stripe price id for the front-end offer (checkout.stripePriceId). */
  stripePriceId?: string;
}




/**
 * The themed MotherMode checkout. Reads one offer, renders its order bumps as
 * opt-in items, keeps a running total, and drives the Stripe payment-intent
 * flow. The urgency timer persists per visitor via the mothermode_timer key.
 */
export const MotherModeCheckout: React.FC<MotherModeCheckoutProps> = ({
  offer,
  affiliateRef,
  successPath,
  backHref,
  backLabel,
  timerLabel = 'Founding price held for:',
  brandLabel = 'MOTHERMODE',
  funnelSlug,
  stripePriceId,
}) => {



  const { stripePromise } = useStripeConfig();
  const [customerData, setCustomerData] = useState({
    firstName: '',
    lastName: '',
    email: '',
  });
  const [clientSecret, setClientSecret] = useState('');
  const [isPreparing, setIsPreparing] = useState(false);
  const [error, setError] = useState('');
  const [selectedBumps, setSelectedBumps] = useState<Record<string, boolean>>({});
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });

  const activeBumps = useMemo(
    () => offer.bumps.filter((b) => selectedBumps[b.id]),
    [offer.bumps, selectedBumps],
  );
  const totalCents =
    offer.priceCents +
    activeBumps.reduce((sum, b) => sum + parsePriceToCents(b.price), 0);

  const toggleBump = (id: string) =>
    setSelectedBumps((prev) => ({ ...prev, [id]: !prev[id] }));

  useEffect(() => {
    let endTime = localStorage.getItem(STORAGE.timer);
    if (!endTime) {
      endTime = String(Date.now() + 24 * 60 * 60 * 1000);
      localStorage.setItem(STORAGE.timer, endTime);
    }
    const target = parseInt(endTime, 10);
    const tick = () => {
      const diff = Math.max(0, target - Date.now());
      setTimeLeft({
        hours: Math.floor(diff / 3_600_000),
        minutes: Math.floor((diff % 3_600_000) / 60_000),
        seconds: Math.floor((diff % 60_000) / 1000),
      });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  const createPaymentIntent = async () => {
    if (!customerData.firstName || !customerData.lastName || !customerData.email) {
      setError('Please add your name and email first.');
      return;
    }
    setIsPreparing(true);
    setError('');
    try {
      const res = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: totalCents,
          currency: 'usd',
          customer_data: customerData,
          product_id: offer.productId,
          // Funnel identity: the server resolves the authoritative amount from
          // the step's price/assignment and stamps attribution metadata.
          ...(stripePriceId ? { price_id: stripePriceId } : {}),
          ...(funnelSlug ? { funnel_slug: funnelSlug, step: 'checkout' } : {}),
          metadata: {
            type: 'mothermode',
            page_type: 'fe',
            product_name: offer.name,
            offer_slug: offer.slug,
            order_bumps: activeBumps.map((b) => b.id).join(','),
            ...(funnelSlug ? { funnel_slug: funnelSlug } : {}),
            ...(affiliateRef ? { ref: affiliateRef } : {}),
          },
        }),
      });
      const data = await res.json();
      if (data.client_secret) {
        try {
          localStorage.setItem('customerData', JSON.stringify(customerData));
        } catch {}
        setClientSecret(data.client_secret);
      } else {
        setError(data.error || 'Could not start checkout. Please try again.');
      }
    } catch {
      setError('Could not reach the payment server. Please try again.');
    } finally {
      setIsPreparing(false);
    }
  };

  // Land on the first OTO, not the delivery page. The front-end pack + bumps
  // ride along in the query so OTO1 can finalize the purchase record.
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const oto1Path = successPath?.trim() || '/mothermode/upsell';
  const successUrl = `${origin}${oto1Path}${buildPurchaseQuery({
    fe: true,
    feSlug: offer.slug,
    bumps: activeBumps.map((b) => b.id),
    email: customerData.email || undefined,
    firstName: customerData.firstName || undefined,
  })}`;

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="min-h-screen bg-bone font-sans text-ink antialiased">
      <div className="bg-mode px-4 py-2.5 text-center text-bone">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-3 text-sm">
          <Timer className="h-4 w-4" />
          <MmEditable
            field="timerLabel"
            as="span"
            onDark
            value={timerLabel}
            className="font-semibold tracking-wide px-1"
          >
            {timerLabel}
          </MmEditable>
          <span className="font-mono text-base tabular-nums text-brass">
            {pad(timeLeft.hours)}:{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}
          </span>
        </div>
      </div>

      <header className="border-b border-ink/10 bg-bone/80 py-5 text-center backdrop-blur">
        <MmEditable
          field="brandLabel"
          as="span"
          value={brandLabel}
          className="font-display text-lg tracking-[0.2em] text-mode px-1"
        >
          {brandLabel}
        </MmEditable>
      </header>

      <div className="mx-auto max-w-5xl px-4 pt-6">
        <Link
          href={backHref || `${ROUTES.offerBase}/${offer.slug}`}
          className="inline-flex items-center gap-1.5 text-sm text-ink/55 transition-colors hover:text-mode"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>{backLabel || 'Back to offer details'}</span>
        </Link>
      </div>


      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="grid gap-8 lg:grid-cols-5">
          <div className="space-y-6 lg:col-span-3">
            <ContactPaymentCard
              customerData={customerData}
              onCustomerChange={setCustomerData}
              clientSecret={clientSecret}
              isPreparing={isPreparing}
              error={error}
              onContinue={createPaymentIntent}
              stripePromise={stripePromise}
              successUrl={successUrl}
              totalCents={totalCents}
            />
            <OrderBumps
              bumps={offer.bumps}
              selected={selectedBumps}
              onToggle={toggleBump}
            />
          </div>
          <div className="lg:col-span-2">
            <OrderSummary
              offer={offer}
              activeBumps={activeBumps}
              totalCents={totalCents}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
