import Stripe from 'stripe';
import { getStripeClient } from '@/utils/stripe/config';
import { getStripeWebhookSecret } from '@/utils/integrations/runtime-config';
import {
  upsertProductRecord,
  upsertPriceRecord,
  manageSubscriptionStatusChange,
  deleteProductRecord,
  deletePriceRecord,
  recordFunnelPurchase
} from '@/utils/supabase/admin';
import { getFunnelBySlug } from '@/lib/mothermode/sales/store';
import { fireFunnelWebhooks } from '@/lib/mothermode/sales/webhooks';

// Fire the funnel's outbound webhooks (the main app, GHL, Zapier) on a
// purchase. Fire-and-forget — a dead webhook never blocks the purchase.
async function firePurchaseWebhooks(p: {
  funnel_slug?: string | null;
  customer_email?: string | null;
  amount_cents?: number | null;
  product_id?: string | null;
  page_type?: string | null;
}) {
  const slug = p.funnel_slug;
  if (!slug) return;
  const funnel = await getFunnelBySlug(slug).catch(() => null);
  if (!funnel || (funnel.webhooks ?? []).length === 0) return;
  await fireFunnelWebhooks(funnel, {
    email: p.customer_email ?? null,
    productId: p.product_id ?? null,
    amountCents: p.amount_cents ?? 0,
    step: p.page_type ?? null,
  });
}
import { dispatchPurchase, dispatchLifecycleEvent } from '@/utils/integrations/dispatch';
import { sendPurchaseReceipt } from '@/utils/email/receipt';
import { enrollOnPurchase } from '@/utils/email/sequences/engine';
import { grantCoursesForPurchase } from '@/utils/courses/grant';
import { markFunnelPurchaseRefunded } from '@/utils/supabase/commerce';

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
  'payment_intent.succeeded',
  'charge.refunded'
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
  // Webhook secret resolves DB-first (enabled `stripe` integration) then env.
  const webhookSecret = await getStripeWebhookSecret();
  let event: Stripe.Event;

  try {
    if (!sig || !webhookSecret)
      return new Response('Webhook secret not found.', { status: 400 });
    const stripe = await getStripeClient();
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
          // Keep the main app's entitlements in sync. Created → provision,
          // deleted → revoke. Updates ride the next created/deleted event.
          if (event.type !== 'customer.subscription.updated') {
            const subMeta = subscription.metadata as Record<string, string>;
            await dispatchLifecycleEvent({
              id: `${event.id}`,
              event:
                event.type === 'customer.subscription.created'
                  ? 'subscription.created'
                  : 'subscription.canceled',
              subscriptionId: subscription.id,
              purchase: {
                stripe_event_id: event.id,
                product_id: subMeta?.product_id ?? null,
                page_type: subMeta?.page_type ?? null,
                amount_cents: 0,
                currency: subscription.currency ?? 'usd',
                customer_email: null,
                customer_name: null,
                metadata: subMeta ?? null
              }
            });
          }
          break;
        case 'charge.refunded':
          // Covers refunds issued in the Stripe dashboard directly (admin
          // refunds from /admin/purchases already marked + dispatched).
          const charge = event.data.object as Stripe.Charge;
          const chargePiId =
            typeof charge.payment_intent === 'string'
              ? charge.payment_intent
              : (charge.payment_intent?.id ?? null);
          const latestRefund = charge.refunds?.data?.[0];
          const refundedRow = await markFunnelPurchaseRefunded({
            paymentIntentId: chargePiId,
            refundId: latestRefund?.id ?? `evt_${event.id}`,
            amountCents: charge.amount_refunded ?? null
          });
          await dispatchLifecycleEvent({
            id: event.id,
            event: 'refund',
            purchase: refundedRow
              ? {
                  stripe_event_id: event.id,
                  payment_intent_id: chargePiId,
                  product_id: (refundedRow.product_id as string) ?? null,
                  page_type: (refundedRow.page_type as string) ?? null,
                  amount_cents:
                    charge.amount_refunded ?? (refundedRow.amount_cents as number) ?? 0,
                  currency: (refundedRow.currency as string) ?? charge.currency ?? 'usd',
                  customer_email: (refundedRow.customer_email as string) ?? null,
                  customer_name: (refundedRow.customer_name as string) ?? null,
                  metadata: (refundedRow.metadata as Record<string, unknown>) ?? null
                }
              : null,
            refund: {
              refund_id: latestRefund?.id ?? null,
              amount_cents: charge.amount_refunded ?? null,
              refunded_at: new Date().toISOString()
            }
          });
          break;
        case 'checkout.session.completed':
          const checkoutSession = event.data.object as Stripe.Checkout.Session;
          // Only this app's checkouts: the checkout route stamps product_id /
          // page_type. A session with neither is another app on the account.
          if (
            !checkoutSession.metadata?.product_id &&
            !checkoutSession.metadata?.page_type
          ) {
            break;
          }
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
              metadata: {
                ...(checkoutSession.metadata as Record<string, unknown> | null),
                subscription_id:
                  typeof checkoutSession.subscription === 'string'
                    ? checkoutSession.subscription
                    : (checkoutSession.subscription?.id ?? null)
              }
            };
            await recordFunnelPurchase(subPurchase);
            await dispatchPurchase(subPurchase);
            await firePurchaseWebhooks(subPurchase);
            await sendPurchaseReceipt(subPurchase);
            await enrollOnPurchase(subPurchase);
            await grantCoursesForPurchase({
              productId: subPurchase.product_id,
              customerEmail: subPurchase.customer_email,
              accessType: 'subscription'
            });
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
            await firePurchaseWebhooks(sessionPurchase);
            await sendPurchaseReceipt(sessionPurchase);
            await enrollOnPurchase(sessionPurchase);
            await grantCoursesForPurchase({
              productId: sessionPurchase.product_id,
              customerEmail: sessionPurchase.customer_email,
              accessType: 'purchase'
            });
          }
          break;
        case 'payment_intent.succeeded':
          // Inline funnel charges: FE $27, OTO3, OTO4 deposit, one-click
          // upsells. /api/create-payment-intent stamps product_id,
          // customer_email, customer_name, one_click + any caller metadata.
          // Insert is idempotent on stripe_event_id.
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          // Only this app's charges: /api/create-payment-intent stamps
          // product_id / page_type in the metadata. A payment intent with
          // neither is another app on the same Stripe account — skip it (no
          // purchase record, no receipt, no outbound webhook).
          if (
            !paymentIntent.metadata?.product_id &&
            !paymentIntent.metadata?.page_type
          ) {
            break;
          }
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
          await firePurchaseWebhooks(piPurchase);
          await sendPurchaseReceipt(piPurchase);
          await enrollOnPurchase(piPurchase);
          await grantCoursesForPurchase({
            productId: piPurchase.product_id,
            customerEmail: piPurchase.customer_email,
            accessType: 'purchase'
          });
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
