import Stripe from 'stripe';
import { getStripeSecretKey } from '@/utils/integrations/runtime-config';

function buildStripe(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    // https://github.com/stripe/stripe-node#configuration
    // https://stripe.com/docs/api/versioning
    // @ts-ignore
    apiVersion: null,
    // Register this as an official Stripe plugin.
    // https://stripe.com/docs/building-plugins#setappinfo
    appInfo: {
      name: 'Next.js Subscription Starter',
      version: '0.0.0',
      url: 'https://github.com/vercel/nextjs-subscription-payments'
    }
  });
}

// Backwards-compatible env-based singleton. Prefer getStripeClient() in server
// code so the secret key resolves DB-first (enabled `stripe` integration) then
// env. This export stays for any sync callers that have no DB context.
export const stripe = buildStripe(
  process.env.STRIPE_SECRET_KEY_LIVE ?? process.env.STRIPE_SECRET_KEY ?? ''
);

let cached: { key: string; client: Stripe } | null = null;

/**
 * Lazily resolve a Stripe client whose secret key is read DB-first then env.
 * The client is memoised and only rebuilt when the resolved key changes, so an
 * admin can rotate the key in the dashboard without a redeploy.
 */
export async function getStripeClient(): Promise<Stripe> {
  const key = await getStripeSecretKey();
  if (cached && cached.key === key) return cached.client;
  const client = buildStripe(key);
  cached = { key, client };
  return client;
}
