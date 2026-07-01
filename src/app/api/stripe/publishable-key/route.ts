import { NextResponse } from 'next/server';
import { getStripePublishableKey } from '@/utils/integrations/runtime-config';

// Public endpoint: the Stripe publishable key is safe to expose. The client
// reads it here so an admin can configure it in /admin/stripe (DB-first) without
// a redeploy; falls back to the NEXT_PUBLIC_* build-time env on the client.
export const dynamic = 'force-dynamic';

export async function GET() {
  const publishableKey = await getStripePublishableKey();
  return NextResponse.json(
    { publishableKey: publishableKey ?? null },
    { headers: { 'cache-control': 'no-store' } }
  );
}
