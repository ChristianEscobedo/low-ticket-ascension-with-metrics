import { NextRequest, NextResponse } from 'next/server';
import { getStripeClientForMode } from '@/utils/stripe/config';
import {
  getStripePublishableKeyForMode,
  getStripeSecretKeyForMode,
} from '@/utils/integrations/runtime-config';
import { getFunnelBySlug } from '@/lib/mothermode/sales/store';
import {
  pageTypeForStep,
  resolveStepCharge,
} from '@/lib/mothermode/sales/pricing';
import type { AssignmentStep } from '@/lib/mothermode/sales/productAssignments';

// Inline PaymentIntents for the funnel's one-time charges (FE $27, OTO3, OTO4
// deposit). When called with one_click: true we try to charge the customer's
// saved card from the prior FE purchase so the upsell collapses to a single
// click. Boilerplate ships hosted Checkout only; this route is the inline-
// payment gap called out in funnel-transfer.md section 12.3.
//
// Amounts resolve server-side: when the caller passes a price_id (or a
// funnel_slug + step with a product assignment) the synced `prices` table is
// the source of truth and the posted amount is ignored.

interface Body {
  amount: number;
  currency: string;
  customer_data: { firstName: string; lastName: string; email: string };
  product_id: string;
  one_click?: boolean;
  /** One-click SUBSCRIPTION: create the sub on the saved card, no redirect. */
  subscription?: boolean;
  interval?: 'month' | 'year';
  /** The first period already paid via the plain-PI fallback — open the
   *  subscription with a trial to the next period so it never double-charges. */
  first_period_paid?: boolean;
  /** Stripe price id for this step — amount is resolved from it when set. */
  price_id?: string;
  /** Funnel identity for attribution + assignment-based price resolution. */
  funnel_slug?: string;
  step?: string;
  metadata?: Record<string, string>;
}


export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    const {
      customer_data,
      product_id,
      one_click,
      subscription,
      interval,
      first_period_paid,
      price_id,
      funnel_slug,
      step,
      metadata = {},
    } = body;

    // The per-funnel test/live toggle: read the funnel's mode, pick the key.
    // A test-mode funnel charges the Stripe TEST keys (the 4242 card); the
    // rest charge live. The key resolves DB-first then env, per mode. A
    // test-mode funnel with no test key saved errors out — it must NEVER
    // fall back to the live key (charging live when you meant test is the
    // dangerous surprise).
    const funnel = funnel_slug
      ? await getFunnelBySlug(funnel_slug).catch(() => null)
      : null;
    const mode: 'test' | 'live' = funnel?.testMode ? 'test' : 'live';
    if (!(await getStripeSecretKeyForMode(mode))) {
      return NextResponse.json(
        {
          error:
            mode === 'test'
              ? 'This funnel is in test mode but no Stripe TEST key is saved. Add the test secret key (sk_test_…) in /admin/stripe.'
              : 'Stripe is not configured. Set the secret key in /admin/stripe or STRIPE_SECRET_KEY.',
        },
        { status: 503 }
      );
    }
    const stripe = await getStripeClientForMode(mode);

    // The browser confirms this PaymentIntent with the publishable key for the
    // SAME mode — a test-mode PI confirmed against the live pk 400s in
    // Stripe.js ("elements/sessions" fails) and the card form never mounts.
    // Resolve it here and hand it back so the client loads Stripe.js with the
    // right key even when its own /api/stripe/publishable-key read raced or
    // cached the live one.
    const publishableKey = await getStripePublishableKeyForMode(mode);

    // Never create a PaymentIntent the browser can't confirm. In test mode a
    // missing test publishable key used to fall back to the LIVE pk — the PI
    // got created with the test secret, then Stripe.js 400'd on
    // elements/sessions and the form never mounted. Fail BEFORE the PI exists,
    // with the fix spelled out.
    if (mode === 'test' && !publishableKey) {
      return NextResponse.json(
        {
          error:
            'This funnel is in test mode but no Stripe TEST publishable key is saved. Add the test publishable key (pk_test_…) in /admin/stripe — the card form needs it to confirm the test charge.',
        },
        { status: 503 }
      );
    }

    if (!customer_data?.email) {
      return NextResponse.json(
        { error: 'Missing required field: customer_data.email' },
        { status: 400 }
      );
    }

    // The server decides the amount. Explicit price_id first, then the
    // (funnel_slug, step) product assignment, then the posted amount as the
    // legacy fallback.
    const charge = await resolveStepCharge({
      priceId: price_id || null,
      funnelSlug: funnel_slug || null,
      step: (step || null) as AssignmentStep | null,
      productId: product_id || null,
      fallbackAmountCents: body.amount,
    });
    const amount = charge.amountCents;
    const currency = charge.currency || body.currency || 'usd';
    const subInterval: 'month' | 'year' =
      charge.interval === 'year'
        ? 'year'
        : charge.interval === 'month'
          ? 'month'
          : interval === 'year'
            ? 'year'
            : 'month';

    if (typeof amount !== 'number' || amount < 50 || amount > 99999999) {
      return NextResponse.json(
        { error: 'Could not resolve a valid charge amount for this step' },
        { status: 400 }
      );
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

    const piMetadata: Record<string, string> = {
      product_id: charge.productId || product_id || '',
      customer_email: customer_data.email,
      customer_name: `${customer_data.firstName} ${customer_data.lastName}`.trim(),
      one_click: one_click ? 'true' : 'false',
      // Funnel attribution: page_type drives /admin/funnel-stats + integration
      // filters; funnel_slug ties the charge back to the exact funnel.
      page_type: metadata.page_type || pageTypeForStep(step),
      ...(funnel_slug ? { funnel_slug } : {}),
      ...(step ? { step } : {}),
      ...(charge.priceId ? { price_id: charge.priceId } : {}),
      charge_source: charge.source,
      ...metadata,
    };

    // One-click SUBSCRIPTION path: the saved card bills inline — no
    // hosted-Checkout redirect, ever. A mode-local Price (never the synced
    // live price id) keeps it mode-safe. When the modal signals the first
    // period already paid (the no-card fallback below collected it), the
    // subscription opens with a trial carrying it to the next period — no
    // double charge.
    if (one_click && subscription) {
      const methods = await stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 1 });
      const savedCard = methods.data[0];
      if (savedCard) {
        // Subscription items need a Price object — create it in THIS mode's
        // account (a synced live price id doesn't exist in the test one).
        const subPrice = await stripe.prices.create({
          currency,
          unit_amount: amount,
          recurring: { interval: subInterval },
          product_data: { name: metadata.product_name || 'Subscription' },
        });
        const sub = await stripe.subscriptions.create({
          customer: customerId,
          items: [{ price: subPrice.id }],
          default_payment_method: savedCard.id,
          ...(first_period_paid
            ? { trial_period_days: subInterval === 'year' ? 365 : 30 }
            : { payment_behavior: 'default_incomplete' as const, expand: ['latest_invoice.payment_intent'] }),
          metadata: piMetadata,
        });
        if (sub.status === 'active' || sub.status === 'trialing') {
          return NextResponse.json({ status: 'succeeded', subscription_id: sub.id });
        }
        // 3DS on the saved card — confirm the first invoice inline. Stamp
        // the invoice's PI with the funnel metadata so the webhook records
        // the charge (a subscription created this way has no
        // checkout.session).
        const invoice = sub.latest_invoice as {
          payment_intent?: { id: string; status: string; client_secret: string | null } | string | null;
        } | null;
        const invoicePi = invoice?.payment_intent ?? null;
        const invoicePiId = typeof invoicePi === 'string' ? invoicePi : invoicePi?.id;
        if (invoicePiId) {
          await stripe.paymentIntents
            .update(invoicePiId, { metadata: piMetadata, setup_future_usage: 'off_session' })
            .catch(() => {});
        }
        if (invoicePi && typeof invoicePi === 'object' && invoicePi.client_secret) {
          return NextResponse.json({
            status: invoicePi.status === 'requires_action' ? 'requires_action' : 'requires_payment',
            client_secret: invoicePi.client_secret,
            payment_intent_id: invoicePi.id,
            subscription_id: sub.id,
            mode,
            publishableKey: publishableKey ?? null,
          });
        }
        // No way to confirm inline — cancel so it never bills, and fall
        // through to the plain PaymentIntent below.
        await stripe.subscriptions.cancel(sub.id).catch(() => {});
      }
      // No saved card (or the sub couldn't confirm): the plain PaymentIntent
      // below records the first period through the proven webhook path AND
      // saves the card (setup_future_usage). The modal's follow-up call then
      // opens the subscription on the saved card with the trial carrying it
      // to the next period — no double charge, no redirect.
    }

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
      // The client loads Stripe.js with the publishable key for THIS mode —
      // a test-mode PaymentIntent can't confirm against the live pk.
      mode,
      publishableKey: publishableKey ?? null,
    });
  } catch (err) {
    console.error('[create-payment-intent] error', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create payment intent' },
      { status: 500 }
    );
  }
}
