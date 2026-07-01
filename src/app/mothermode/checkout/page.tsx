'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getOffer } from '@/lib/mothermode/offers';
import { ROUTES } from '@/lib/mothermode/brand';
import { MotherModeCheckout } from '@/components/mothermode/checkout/MotherModeCheckout';

/**
 * The MotherMode checkout route. The `offer` query param selects which resource
 * pack is being purchased; `ref` forwards any captured affiliate id. Wrapped in
 * Suspense because useSearchParams requires a boundary in the app router.
 */
function CheckoutResolver() {
  const params = useSearchParams();
  const slug = params.get('offer') ?? '';
  const offer = getOffer(slug);

  if (!offer || !offer.ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bone px-4 text-center font-sans text-ink">
        <h1 className="font-display text-2xl text-mode">Offer not found</h1>
        <p className="max-w-sm text-ink/60">
          We could not find that resource pack. Browse the catalog to pick one.
        </p>
        <Link
          href={`${ROUTES.offerBase}/brain-dump-system`}
          className="rounded-full bg-mode px-6 py-3 text-sm font-semibold text-bone transition-colors hover:bg-mode-deep"
        >
          View The Brain Dump System
        </Link>
      </div>
    );
  }

  return (
    <MotherModeCheckout offer={offer} affiliateRef={params.get('ref') ?? undefined} />
  );
}

export default function MotherModeCheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bone" />}>
      <CheckoutResolver />
    </Suspense>
  );
}
