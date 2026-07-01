'use client';

// Loads Stripe.js once on the client and returns the promise for <Elements>.
// Mirrors the API surface of the source funnel hook so copied components
// (StripeCheckoutForm, OneClickCheckoutModal, checkout page) destructure
// `stripePromise` directly. The publishable key resolves DB-first from
// /api/stripe/publishable-key (so an admin can set it in /admin/stripe without
// a redeploy) and falls back to the NEXT_PUBLIC_* build-time env.

import { loadStripe, Stripe } from '@stripe/stripe-js';

let globalStripePromise: Promise<Stripe | null> | null = null;

function envKey(): string {
  return (
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE ??
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
    ''
  );
}

async function resolveStripe(): Promise<Stripe | null> {
  let key = '';
  try {
    const res = await fetch('/api/stripe/publishable-key', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      key = (data?.publishableKey as string | null) ?? '';
    }
  } catch {
    // Endpoint unreachable; fall back to the build-time env below.
  }
  if (!key) key = envKey();
  if (!key) return null;
  return loadStripe(key);
}

function getOrCreate(): Promise<Stripe | null> {
  if (globalStripePromise) return globalStripePromise;
  globalStripePromise = resolveStripe();
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
