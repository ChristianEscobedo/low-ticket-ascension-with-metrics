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
    const secretKey = await getStripeSecretKeyForMode(mode);
    if (!secretKey) {
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

    // A RESTRICTED key (rk_test_ / rk_live_) only has the permissions granted
    // at creation. The one-click path attaches + charges saved cards, which a
    // restricted key without paymentMethods:write silently rejects — the
    // checkout then "works" but falls through to the card form (and Link's
    // OTP). Flag it up front so the fix (save the standard Secret key,
    // sk_…, in /admin/stripe) is visible instead of silent.
    const restrictedKey = secretKey.startsWith('rk_');

    // Test-mode rehearsal attaches Stripe's test Visa when the customer has no
    // card on file. That attach used to fail SILENTLY (`.catch(() =>
    // undefined)`) and the one-click fell through to the PaymentElement form —
    // with Link's saved-card OTP on top. Capture the failure so the one-click
    // paths can return the real reason instead of a mysterious form.
    let testCardAttachError: string | null = null;
    const attachTestVisa = async () => {
      try {
        return await stripe.paymentMethods.attach('pm_card_visa', { customer: customerId });
      } catch (e) {
        testCardAttachError = e instanceof Error ? e.message : String(e);
        return undefined;
      }
    };
    // In test mode the one-click is a rehearsal — there is no real buyer card
    // to collect, so a failed attach must STOP the flow with the reason, not
    // fall through to a card form that can never be the right answer.
    const testAttachFailureResponse = () =>
      NextResponse.json(
        {
          error:
            `One-click rehearsal couldn't attach the test Visa: ${testCardAttachError}. ` +
            (restrictedKey
              ? 'The saved secret key is a RESTRICTED key (rk_…) — it lacks the paymentMethods write permission this needs. In the Stripe dashboard → Developers → API keys, copy the standard "Secret key" (sk_test_…), NOT a "Restricted key", and re-save it in /admin/stripe.'
              : 'Check the test secret key in /admin/stripe — re-copy the standard Secret key (sk_test_…) from the Stripe dashboard (Developers → API keys) with no extra spaces or line breaks.'),
        },
        { status: 500 }
      );

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
      const cards = await stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 1 });
      let savedCard: (typeof cards.data)[number] | undefined = cards.data[0];
      // Test-mode rehearsal: no card on file yet — attach Stripe's test Visa
      // so the one-click path is exercisable without a prior purchase.
      // (Live mode never auto-attaches; a live buyer with no card gets the
      // card form below.)
      if (!savedCard && mode === 'test') {
        savedCard = await attachTestVisa();
        if (!savedCard) return testAttachFailureResponse();
      }
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
          // Card-only on the invoice's PaymentIntent. The default (automatic
          // payment methods) enables Link, and when this PI ever reaches the
          // browser Link hijacks the confirm with its own saved-card OTP.
          payment_settings: { payment_method_types: ['card'] },
          ...(first_period_paid
            ? { trial_period_days: subInterval === 'year' ? 365 : 30 }
            : { payment_behavior: 'default_incomplete' as const, expand: ['latest_invoice.payment_intent'] }),
          metadata: piMetadata,
        });
        if (sub.status === 'active' || sub.status === 'trialing') {
          return NextResponse.json({ status: 'succeeded', subscription_id: sub.id });
        }
        // Stamp the invoice's PI with the funnel metadata so the webhook
        // records the charge (a subscription created this way has no
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
        // default_incomplete does NOT charge the card in the create call —
        // the invoice's PI sits at requires_confirmation. The old code handed
        // its client_secret straight to the browser, which mounted the card
        // form (with Link's OTP on top) — exactly the "form instead of
        // one-click" bug. Confirm it SERVER-SIDE on the saved card instead,
        // the same direct charge the working version makes. Only a card that
        // demands 3DS comes back to the browser, inline and card-only.
        let confirmedPi: { id: string; status: string; client_secret: string | null } | null =
          invoicePi && typeof invoicePi === 'object' ? invoicePi : null;
        if (
          invoicePiId &&
          (!confirmedPi ||
            confirmedPi.status === 'requires_confirmation' ||
            confirmedPi.status === 'requires_payment_method')
        ) {
          const confirmed = await stripe.paymentIntents
            .confirm(invoicePiId, { payment_method: savedCard.id })
            .catch(() => null);
          if (confirmed) confirmedPi = confirmed;
        }
        if (confirmedPi && (confirmedPi.status === 'succeeded' || confirmedPi.status === 'processing')) {
          return NextResponse.json({
            status: 'succeeded',
            subscription_id: sub.id,
            payment_intent_id: confirmedPi.id,
          });
        }
        if (confirmedPi && confirmedPi.status === 'requires_action' && confirmedPi.client_secret) {
          return NextResponse.json({
            status: 'requires_action',
            client_secret: confirmedPi.client_secret,
            payment_intent_id: confirmedPi.id,
            subscription_id: sub.id,
            mode,
            publishableKey: publishableKey ?? null,
          });
        }
        // The saved card couldn't pay the first period — cancel so it never
        // bills, and fall through to the plain PaymentIntent below, which
        // collects a working card (card-only, no Link).
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
      const cards = await stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 1 });
      let savedCard: (typeof cards.data)[number] | undefined = cards.data[0];
      // Same test-mode rehearsal convenience as the subscription path above.
      if (!savedCard && mode === 'test') {
        savedCard = await attachTestVisa();
        if (!savedCard) return testAttachFailureResponse();
      }
      if (savedCard) {
        const pi = await stripe.paymentIntents.create({
          amount,
          currency,
          customer: customerId,
          payment_method: savedCard.id,
          receipt_email: customer_data.email,
          confirm: true,
          off_session: false,
          metadata: piMetadata,
          // Card-only: automatic_payment_methods also enables Link, and Link
          // hijacks the confirm with its own saved-card OTP. The one-click is
          // a saved CARD charge — never a wallet.
          payment_method_types: ['card'],
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
      // Card-only, never Link: with automatic_payment_methods the Payment
      // Element renders Link's "saved card" above the form and the buyer gets
      // a text-message OTP instead of a checkout. The funnel collects cards.
      payment_method_types: ['card'],
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
