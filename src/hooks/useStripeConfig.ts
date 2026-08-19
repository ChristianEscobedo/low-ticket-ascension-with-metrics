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
  let mode: string | null = null;
  try {
    const url = funnelSlug
      ? `/api/stripe/publishable-key?funnel=${encodeURIComponent(funnelSlug)}`
      : '/api/stripe/publishable-key';
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      key = (data?.publishableKey as string | null) ?? '';
      mode = (data?.mode as string | null) ?? null;
    }
  } catch {
    // Endpoint unreachable; fall back to the build-time env below.
  }
  // A test-mode funnel with no test pk saved must NOT fall back to the live
  // env key — the test-mode PaymentIntent can't confirm against it (the
  // elements/sessions 400). Null here; the charge route errors with the
  // "save the test publishable key" message before any PI exists.
  if (!key && mode !== 'test') key = envKey();
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

/**
 * Load Stripe.js with an explicit publishable key — the key the charge was
 * created with, handed back by /api/create-payment-intent. A test-mode
 * PaymentIntent confirmed against the live pk 400s in Stripe.js
 * ("elements/sessions" fails, the card form never mounts), so the key must
 * follow the charge, not whatever the page loaded first.
 */
export function stripePromiseForKey(key: string): Promise<Stripe | null> {
  const cacheKey = 'explicit:' + key;
  const hit = stripePromiseByKey.get(cacheKey);
  if (hit) return hit;
  const promise = loadStripe(key);
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
