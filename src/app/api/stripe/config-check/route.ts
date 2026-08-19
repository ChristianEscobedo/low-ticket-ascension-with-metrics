import { NextRequest, NextResponse } from 'next/server';
import {
  getStripePublishableKeyForMode,
  getStripeSecretKeyForMode,
} from '@/utils/integrations/runtime-config';
import { getFunnelBySlug } from '@/lib/mothermode/sales/store';

// Public diagnostic: which Stripe keys a funnel's charges actually resolve to.
// Keys are never returned — only the prefix (sk_test / sk_live / pk_test /
// pk_live) and the source (database / environment / missing). The point: when
// a test-mode funnel says "no TEST key is saved" but the admin saved one, this
// shows whether the deploy is reading the same database row the admin wrote.
export const dynamic = 'force-dynamic';

function describe(key: string | null | undefined): { prefix: string } {
  const k = (key ?? '').trim();
  const prefix =
    k.startsWith('sk_test_') ? 'sk_test'
    : k.startsWith('sk_live_') ? 'sk_live'
    : k.startsWith('pk_test_') ? 'pk_test'
    : k.startsWith('pk_live_') ? 'pk_live'
    : k ? 'unknown-format'
    : 'missing';
  return { prefix };
}

export async function GET(request: NextRequest) {
  const funnelSlug = request.nextUrl.searchParams.get('funnel');
  let funnelMode: 'test' | 'live' | null = null;
  let funnelFound = false;
  if (funnelSlug) {
    const funnel = await getFunnelBySlug(funnelSlug).catch(() => null);
    funnelFound = Boolean(funnel);
    funnelMode = funnel ? (funnel.testMode ? 'test' : 'live') : null;
  }

  const [testSecret, liveSecret, testPk, livePk] = await Promise.all([
    getStripeSecretKeyForMode('test'),
    getStripeSecretKeyForMode('live'),
    getStripePublishableKeyForMode('test'),
    getStripePublishableKeyForMode('live'),
  ]);

  return NextResponse.json(
    {
      funnel: funnelSlug
        ? { slug: funnelSlug, found: funnelFound, mode: funnelMode }
        : null,
      keys: {
        secret_test: describe(testSecret),
        secret_live: describe(liveSecret),
        publishable_test: describe(testPk),
        publishable_live: describe(livePk),
      },
      // What a charge on this funnel would use right now.
      chargeWouldUse: funnelMode
        ? funnelMode === 'test'
          ? describe(testSecret).prefix === 'missing'
            ? 'ERROR: test mode but no test secret key resolves'
            : 'test keys'
          : 'live keys'
        : 'live keys (no funnel)',
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
