import { NextRequest, NextResponse } from 'next/server';
import {
  getStripePublishableKey,
  getStripePublishableKeyForMode,
} from '@/utils/integrations/runtime-config';
import { getFunnelBySlug } from '@/lib/mothermode/sales/store';

// Public endpoint: the Stripe publishable key is safe to expose. The client
// reads it here so an admin can configure it in /admin/stripe (DB-first) without
// a redeploy; falls back to the NEXT_PUBLIC_* build-time env on the client.
//
// ?funnel=<slug> resolves the key for the funnel's mode: a test-mode funnel
// gets the TEST publishable key (publishable_key_test), so the PaymentIntent
// the test secret key created can actually confirm in the browser. A live
// funnel (or no funnel) gets the live key, unchanged.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const funnelSlug = request.nextUrl.searchParams.get('funnel');
  let mode: 'test' | 'live' = 'live';
  if (funnelSlug) {
    const funnel = await getFunnelBySlug(funnelSlug).catch(() => null);
    mode = funnel?.testMode ? 'test' : 'live';
  }
  const publishableKey =
    mode === 'test'
      ? await getStripePublishableKeyForMode('test')
      : await getStripePublishableKey();
  return NextResponse.json(
    { publishableKey: publishableKey ?? null, mode },
    { headers: { 'cache-control': 'no-store' } }
  );
}
