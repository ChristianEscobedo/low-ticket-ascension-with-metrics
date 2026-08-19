'use client';

// Loads Stripe.js once on the client and returns the promise for <Elements>.
// Mirrors the API surface of the source funnel hook so copied components
// (StripeCheckoutForm, OneClickCheckoutModal, checkout page) destructure
// `stripePromise` directly. The publishable key resolves DB-first from
// /api/stripe/publishable-key (so an admin can set it in /admin/stripe without
// a redeploy) and falls back to the NEXT_PUBLIC_* build-time env.

import { loadStripe, Stripe } from '@stripe/stripe-js';

// The Stripe.js instance is cached PER KEY, not globally — a test-mode funnel
// resolves the test publishable key (?funnel=<slug> on the endpoint), and a
// live funnel on the same page session must not reuse it.
const stripePromiseByKey = new Map<string, Promise<Stripe | null>>();

function envKey(): string {
  return (
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE ??
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
    ''
  );
}

async function resolveStripe(funnelSlug?: string): Promise<Stripe | null> {
  let key = '';
  try {
    const url = funnelSlug
      ? `/api/stripe/publishable-key?funnel=${encodeURIComponent(funnelSlug)}`
      : '/api/stripe/publishable-key';
    const res = await fetch(url, { cache: 'no-store' });
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

function getOrCreate(funnelSlug?: string): Promise<Stripe | null> {
  const cacheKey = funnelSlug ?? '';
  const hit = stripePromiseByKey.get(cacheKey);
  if (hit) return hit;
  const promise = resolveStripe(funnelSlug);
  stripePromiseByKey.set(cacheKey, promise);
  return promise;
}

export function useStripeConfig(funnelSlug?: string) {
  const stripePromise = typeof window !== 'undefined' ? getOrCreate(funnelSlug) : null;
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
  stripePromiseByKey.clear();
}
