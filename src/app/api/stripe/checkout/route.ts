import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripeClient } from '@/utils/stripe/config';
import { getStripeSecretKey } from '@/utils/integrations/runtime-config';
import {
  pageTypeForStep,
  resolveStepCharge,
} from '@/lib/mothermode/sales/pricing';
import type { AssignmentStep } from '@/lib/mothermode/sales/productAssignments';


// Hosted Checkout session creator for the funnel's subscription OTOs
// (OTO1 Clearing Room monthly, OTO2 annual upgrade). Mirrors the
// `generic_subscription` branch the funnel components POST. The boilerplate
// also ships `checkoutWithStripe()` in @/utils/stripe/server for its built-in
// pricing page, but that requires an authenticated Supabase user; the funnel
// runs anonymously, so this route handles the unauthenticated path directly.

interface Body {
  type: 'generic_subscription';
  priceId?: string;
  amount?: number;
  interval?: 'month' | 'year';
  productName?: string;
  productId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  returnPath?: string;
  /** Funnel identity for attribution + assignment-based price resolution. */
  funnel_slug?: string;
  step?: string;
  metadata?: Record<string, string>;
}


export async function POST(request: NextRequest) {
  try {
    // Secret key resolves DB-first (enabled `stripe` integration) then env.
    if (!(await getStripeSecretKey())) {
      return NextResponse.json(
        { error: 'Stripe is not configured. Set the secret key in /admin/stripe or STRIPE_SECRET_KEY.' },
        { status: 503 }
      );
    }
    const stripe = await getStripeClient();

    const body = (await request.json()) as Body;
    const { type, amount, interval = 'month', productName = 'Subscription', email, returnPath, metadata = {} } = body;
    const funnelSlug = body.funnel_slug || null;
    const step = body.step || null;

    if (type !== 'generic_subscription') {
      return NextResponse.json({ error: 'Unsupported checkout type' }, { status: 400 });
    }

    // Resolve the charge server-side. An explicit priceId still wins; with a
    // funnel assignment the synced price supplies BOTH the amount and the
    // billing interval, so the posted values are only the legacy fallback.
    const charge = await resolveStepCharge({
      priceId: body.priceId || null,
      funnelSlug,
      step: (step || null) as AssignmentStep | null,
      productId: body.productId || null,
      fallbackAmountCents: amount,
    });
    const productId = body.productId || charge.productId || '';
    const resolvedInterval =
      charge.interval === 'year' ? 'year' : charge.interval === 'month' ? 'month' : interval;

    let lineItem: Stripe.Checkout.SessionCreateParams.LineItem;
    if (charge.priceId) {
      lineItem = { price: charge.priceId, quantity: 1 };
    } else if (charge.amountCents > 0) {
      lineItem = {
        quantity: 1,
        price_data: {
          currency: charge.currency || 'usd',
          unit_amount: charge.amountCents,
          recurring: { interval: resolvedInterval },
          product_data: { name: productName },
        },
      };
    } else {
      return NextResponse.json(
        { error: 'generic_subscription requires either priceId or amount' },
        { status: 400 }
      );
    }


    const origin = request.headers.get('origin') || 'http://localhost:3000';
    const successBase = returnPath ? `${origin}${returnPath}` : origin;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [lineItem],
      customer_email: email,
      success_url: `${successBase}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${successBase}?checkout=canceled`,
      metadata: {
        type: 'generic_subscription',
        product_id: productId || '',
        product_name: productName,
        interval: resolvedInterval,
        // Funnel attribution: page_type drives stats + integration filters.
        page_type: metadata.page_type || pageTypeForStep(step),
        ...(funnelSlug ? { funnel_slug: funnelSlug } : {}),
        ...(step ? { step } : {}),
        ...(charge.priceId ? { price_id: charge.priceId } : {}),
        charge_source: charge.source,
        firstName: body.firstName || '',
        lastName: body.lastName || '',
        ...metadata,
      },
      subscription_data: {
        metadata: {
          type: 'generic_subscription',
          product_id: productId || '',
          page_type: metadata.page_type || pageTypeForStep(step),
          ...(funnelSlug ? { funnel_slug: funnelSlug } : {}),
        },
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('[api/stripe/checkout] error', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Checkout failed' },
      { status: 500 }
    );
  }
}
