import Stripe from 'stripe';
import { stripe } from '@/utils/stripe/config';
import {
  upsertProductRecord,
  upsertPriceRecord,
  manageSubscriptionStatusChange,
  deleteProductRecord,
  deletePriceRecord,
  recordFunnelPurchase
} from '@/utils/supabase/admin';
import { dispatchPurchase } from '@/utils/integrations/dispatch';

const relevantEvents = new Set([
  'product.created',
  'product.updated',
  'product.deleted',
  'price.created',
  'price.updated',
  'price.deleted',
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'payment_intent.succeeded'
]);

// In-memory event-id dedupe to short-circuit redundant work inside a warm
// lambda. Cross-instance idempotency for one-time payments is enforced by the
// unique constraint on funnel_purchases.stripe_event_id (see
// recordFunnelPurchase in @/utils/supabase/admin); subscription handlers are
// already idempotent via upsert.
const processedEventIds = new Set<string>();

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature') as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event: Stripe.Event;

  try {
    if (!sig || !webhookSecret)
      return new Response('Webhook secret not found.', { status: 400 });
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    console.log(`🔔  Webhook received: ${event.type}`);
  } catch (err: any) {
    console.log(`❌ Error message: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (relevantEvents.has(event.type)) {
    if (processedEventIds.has(event.id)) {
      return new Response(JSON.stringify({ received: true, duplicate: true }));
    }
    try {
      switch (event.type) {
        case 'product.created':
        case 'product.updated':
          await upsertProductRecord(event.data.object as Stripe.Product);
          break;
        case 'price.created':
        case 'price.updated':
          await upsertPriceRecord(event.data.object as Stripe.Price);
          break;
        case 'price.deleted':
          await deletePriceRecord(event.data.object as Stripe.Price);
          break;
        case 'product.deleted':
          await deleteProductRecord(event.data.object as Stripe.Product);
          break;
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          const subscription = event.data.object as Stripe.Subscription;
          await manageSubscriptionStatusChange(
            subscription.id,
            subscription.customer as string,
            event.type === 'customer.subscription.created'
          );
          break;
        case 'checkout.session.completed':
          const checkoutSession = event.data.object as Stripe.Checkout.Session;
          if (checkoutSession.mode === 'subscription') {
            const subscriptionId = checkoutSession.subscription;
            await manageSubscriptionStatusChange(
              subscriptionId as string,
              checkoutSession.customer as string,
              true
            );
            // Also record the initial subscription conversion as a funnel
            // purchase so OTO1/OTO2 show up in /admin/funnel-stats next to the
            // one-time stages. Recurring invoices are intentionally NOT
            // recorded — this is a funnel-conversion view, not a billing view.
            const subPurchase = {
              stripe_event_id: event.id,
              checkout_session_id: checkoutSession.id,
              product_id: checkoutSession.metadata?.product_id ?? null,
              page_type: checkoutSession.metadata?.page_type ?? null,
              amount_cents: checkoutSession.amount_total ?? 0,
              currency: checkoutSession.currency ?? 'usd',
              customer_email:
                checkoutSession.customer_details?.email ??
                checkoutSession.customer_email ??
                null,
              customer_name: checkoutSession.customer_details?.name ?? null,
              metadata: checkoutSession.metadata as Record<string, unknown> | null
            };
            await recordFunnelPurchase(subPurchase);
            await dispatchPurchase(subPurchase);
          } else if (checkoutSession.mode === 'payment') {
            // One-time hosted Checkout. Record into funnel_purchases so it
            // shows up in /admin/funnel-stats alongside inline charges.
            const sessionPurchase = {
              stripe_event_id: event.id,
              checkout_session_id: checkoutSession.id,
              payment_intent_id:
                typeof checkoutSession.payment_intent === 'string'
                  ? checkoutSession.payment_intent
                  : checkoutSession.payment_intent?.id ?? null,
              product_id: checkoutSession.metadata?.product_id ?? null,
              page_type: checkoutSession.metadata?.page_type ?? null,
              amount_cents: checkoutSession.amount_total ?? 0,
              currency: checkoutSession.currency ?? 'usd',
              customer_email:
                checkoutSession.customer_details?.email ??
                checkoutSession.customer_email ??
                null,
              customer_name: checkoutSession.customer_details?.name ?? null,
              metadata: checkoutSession.metadata as Record<string, unknown> | null
            };
            await recordFunnelPurchase(sessionPurchase);
            await dispatchPurchase(sessionPurchase);
          }
          break;
        case 'payment_intent.succeeded':
          // Inline funnel charges: FE $27, OTO3, OTO4 deposit, one-click
          // upsells. /api/create-payment-intent stamps product_id,
          // customer_email, customer_name, one_click + any caller metadata.
          // Insert is idempotent on stripe_event_id.
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          const piPurchase = {
            stripe_event_id: event.id,
            payment_intent_id: paymentIntent.id,
            product_id: paymentIntent.metadata?.product_id ?? null,
            page_type: paymentIntent.metadata?.page_type ?? null,
            amount_cents: paymentIntent.amount,
            currency: paymentIntent.currency,
            customer_email:
              paymentIntent.metadata?.customer_email ??
              paymentIntent.receipt_email ??
              null,
            customer_name: paymentIntent.metadata?.customer_name ?? null,
            metadata: paymentIntent.metadata as Record<string, unknown> | null
          };
          await recordFunnelPurchase(piPurchase);
          await dispatchPurchase(piPurchase);
          break;
        default:
          throw new Error('Unhandled relevant event!');
      }
      processedEventIds.add(event.id);
    } catch (error) {
      console.log(error);
      return new Response(
        'Webhook handler failed. View your Next.js function logs.',
        {
          status: 400
        }
      );
    }
  } else {
    return new Response(`Unsupported event type: ${event.type}`, {
      status: 400
    });
  }
  return new Response(JSON.stringify({ received: true }));
}
