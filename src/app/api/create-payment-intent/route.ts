import { NextRequest, NextResponse } from 'next/server';
import { getStripeClient } from '@/utils/stripe/config';
import { getStripeSecretKey } from '@/utils/integrations/runtime-config';

// Inline PaymentIntents for the funnel's one-time charges (FE $27, OTO3, OTO4
// deposit). When called with one_click: true we try to charge the customer's
// saved card from the prior FE purchase so the upsell collapses to a single
// click. Boilerplate ships hosted Checkout only; this route is the inline-
// payment gap called out in funnel-transfer.md section 12.3.

interface Body {
  amount: number;
  currency: string;
  customer_data: { firstName: string; lastName: string; email: string };
  product_id: string;
  one_click?: boolean;
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
    const { amount, currency, customer_data, product_id, one_click, metadata = {} } = body;

    if (!amount || !currency || !customer_data?.email) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, currency, customer_data.email' },
        { status: 400 }
      );
    }
    if (typeof amount !== 'number' || amount < 50 || amount > 99999999) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Retrieve or create the Stripe customer by email.
    const existing = await stripe.customers.list({ email: customer_data.email, limit: 1 });
    const customerId = existing.data[0]
      ? existing.data[0].id
      : (
          await stripe.customers.create({
            email: customer_data.email,
            name: `${customer_data.firstName} ${customer_data.lastName}`.trim(),
            metadata: {
              firstName: customer_data.firstName || '',
              lastName: customer_data.lastName || '',
            },
          })
        ).id;

    const piMetadata = {
      product_id,
      customer_email: customer_data.email,
      customer_name: `${customer_data.firstName} ${customer_data.lastName}`.trim(),
      one_click: one_click ? 'true' : 'false',
      ...metadata,
    };

    // One-click upsell path: try to charge the saved card off-session-style
    // (still on_session, so 3DS prompts inline) without re-collecting a card.
    if (one_click) {
      const methods = await stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 1 });
      if (methods.data[0]) {
        const pi = await stripe.paymentIntents.create({
          amount,
          currency,
          customer: customerId,
          payment_method: methods.data[0].id,
          receipt_email: customer_data.email,
          confirm: true,
          off_session: false,
          metadata: piMetadata,
          automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        });
        if (pi.status === 'succeeded') {
          return NextResponse.json({ status: 'succeeded', payment_intent_id: pi.id });
        }
        if (pi.status === 'requires_action') {
          return NextResponse.json({
            status: 'requires_action',
            client_secret: pi.client_secret,
            payment_intent_id: pi.id,
          });
        }
        // Any other state falls through to a normal PaymentElement flow.
      }
    }

    const pi = await stripe.paymentIntents.create({
      amount,
      currency,
      customer: customerId,
      receipt_email: customer_data.email,
      metadata: piMetadata,
      automatic_payment_methods: { enabled: true },
      setup_future_usage: 'off_session',
    });

    return NextResponse.json({
      status: 'requires_payment',
      client_secret: pi.client_secret,
      payment_intent_id: pi.id,
    });
  } catch (err) {
    console.error('[create-payment-intent] error', err);
    return NextResponse.json({ error: 'Failed to create payment intent' }, { status: 500 });
  }
}
