'use client';

// Loads Stripe.js once on the client and returns the promise for <Elements>.
// Mirrors the API surface of the source funnel hook so copied components
// (StripeCheckoutForm, OneClickCheckoutModal, checkout page) destructure
// `stripePromise` directly. The thin version reads the publishable key
// straight from NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY per Prompt C #2.

import { loadStripe, Stripe } from '@stripe/stripe-js';

let globalStripePromise: Promise<Stripe | null> | null = null;

function getOrCreate(): Promise<Stripe | null> {
  if (globalStripePromise) return globalStripePromise;
  const key =
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE ??
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
    '';
  if (!key) {
    globalStripePromise = Promise.resolve(null);
  } else {
    globalStripePromise = loadStripe(key);
  }
  return globalStripePromise;
}

export function useStripeConfig() {
  const stripePromise = typeof window !== 'undefined' ? getOrCreate() : null;
  const configured = !!(
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE ||
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  );
  return {
    stripePromise,
    loading: false,
    error: configured ? null : 'Stripe publishable key not configured',
    configured,
  };
}

export function resetStripeConfig() {
  globalStripePromise = null;
}
