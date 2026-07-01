import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripeClient } from '@/utils/stripe/config';
import { getStripeSecretKey } from '@/utils/integrations/runtime-config';

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
    const { type, priceId, amount, interval = 'month', productName = 'Subscription', productId, email, returnPath, metadata = {} } = body;

    if (type !== 'generic_subscription') {
      return NextResponse.json({ error: 'Unsupported checkout type' }, { status: 400 });
    }

    let lineItem: Stripe.Checkout.SessionCreateParams.LineItem;
    if (priceId) {
      lineItem = { price: priceId, quantity: 1 };
    } else if (amount && amount > 0) {
      lineItem = {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: amount,
          recurring: { interval },
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
        interval,
        firstName: body.firstName || '',
        lastName: body.lastName || '',
        ...metadata,
      },
      subscription_data: {
        metadata: {
          type: 'generic_subscription',
          product_id: productId || '',
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
