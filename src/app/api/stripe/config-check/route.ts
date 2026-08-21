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

function describe(key: string | null | undefined): { prefix: string; last4: string | null; length: number; warning: string | null } {
  // Keys resolve through stripeKeyClean (runtime-config), so invisible
  // copy-paste characters are already stripped by the time they reach here.
  const k = (key ?? '').trim();
  const prefix =
    k.startsWith('sk_test_') ? 'sk_test'
    : k.startsWith('sk_live_') ? 'sk_live'
    : k.startsWith('rk_test_') ? 'rk_test'
    : k.startsWith('rk_live_') ? 'rk_live'
    : k.startsWith('pk_test_') ? 'pk_test'
    : k.startsWith('pk_live_') ? 'pk_live'
    : k ? 'unknown-format'
    : 'missing';
  // A restricted key is the silent one-click killer: it can create
  // PaymentIntents but (without paymentMethods:write) can't attach a card,
  // so the one-click falls through to the form. Say so explicitly.
  const warning = k.startsWith('rk_')
    ? 'RESTRICTED key — the one-click bump charge needs the standard Secret key (sk_…). Stripe dashboard → Developers → API keys → copy "Secret key", not "Restricted key", and re-save in /admin/stripe.'
    : null;
  // last4 + length: enough to tell "the key I pasted" from "a different key"
  // without ever returning the key itself.
  return { prefix, last4: k ? k.slice(-4) : null, length: k.length, warning };
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
            : describe(testSecret).prefix === 'rk_test'
              ? 'ERROR: test mode but the test secret is a RESTRICTED key (rk_test_) — save the standard Secret key (sk_test_) in /admin/stripe'
              : 'test keys'
          : 'live keys'
        : 'live keys (no funnel)',
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
