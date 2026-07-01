import { loadStripe, Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null>;

// Publishable key resolves DB-first from /api/stripe/publishable-key (so an
// admin can set it in /admin/stripe without a redeploy) and falls back to the
// NEXT_PUBLIC_* build-time env.
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
  if (!key) {
    key =
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE ??
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
      '';
  }
  if (!key) return null;
  return loadStripe(key);
}

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = resolveStripe();
  }

  return stripePromise;
};
