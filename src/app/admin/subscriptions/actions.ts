'use server';

import { revalidatePath } from 'next/cache';
import { getStripeClient } from '@/utils/stripe/config';
import { assertAdmin } from '@/app/admin/_shared/assertAdmin';
import {
  insertCompedEntitlement,
  markFunnelPurchaseRefunded,
  revokeCompedEntitlement,
} from '@/utils/supabase/commerce';
import { dispatchLifecycleEvent } from '@/utils/integrations/dispatch';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';

/**
 * Subscription management for /admin/subscriptions:
 *  - compSubscriptionAction  → grant access WITHOUT charging (DB-only comp)
 *  - cancelSubscriptionAction → Stripe cancel (period end or immediately)
 *  - refundLatestSubscriptionPaymentAction → refund the latest invoice charge
 *  - revokeCompAction → pull a comp back
 *
 * Every mutation also fires the main-app lifecycle webhook so delivery in
 * mothermode stays in sync (provision on comp.granted, revoke on
 * comp.revoked / subscription.canceled / refund).
 */

export interface ActionResult {
  ok: boolean;
  message: string;
}

export async function compSubscriptionAction(input: {
  email: string;
  productId?: string | null;
  priceId?: string | null;
  productName?: string | null;
  note?: string | null;
}): Promise<ActionResult> {
  await assertAdmin();
  const email = (input.email ?? '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return { ok: false, message: 'A valid customer email is required.' };
  }
  try {
    const supabase = createClient();
    const user = await getUser(supabase);
    const comp = await insertCompedEntitlement({
      customerEmail: email,
      productId: input.productId || null,
      priceId: input.priceId || null,
      productName: input.productName || null,
      note: input.note || null,
      createdBy: user?.email ?? null,
    });
    await dispatchLifecycleEvent({
      id: `comp_${comp.id}`,
      event: 'comp.granted',
      customerEmail: comp.customer_email,
      comp: {
        product_id: comp.product_id,
        price_id: comp.price_id,
        product_name: comp.product_name,
        note: comp.note,
      },
    });
    revalidatePath('/admin/subscriptions');
    revalidatePath('/admin/customers');
    return { ok: true, message: `Comped access for ${email}.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Comp failed.' };
  }
}

export async function revokeCompAction(id: string): Promise<ActionResult> {
  await assertAdmin();
  if (!id) return { ok: false, message: 'Missing comp id.' };
  try {
    const comp = await revokeCompedEntitlement(id);
    await dispatchLifecycleEvent({
      id: `comp_revoke_${comp.id}`,
      event: 'comp.revoked',
      customerEmail: comp.customer_email,
      comp: {
        product_id: comp.product_id,
        price_id: comp.price_id,
        product_name: comp.product_name,
        note: comp.note,
      },
    });
    revalidatePath('/admin/subscriptions');
    revalidatePath('/admin/customers');
    return { ok: true, message: 'Comp revoked.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Revoke failed.' };
  }
}

export async function cancelSubscriptionAction(input: {
  subscriptionId: string;
  immediately?: boolean;
}): Promise<ActionResult> {
  await assertAdmin();
  const id = (input.subscriptionId ?? '').trim();
  if (!id) return { ok: false, message: 'Missing subscription id.' };
  try {
    const stripe = await getStripeClient();
    const sub = input.immediately
      ? await stripe.subscriptions.cancel(id)
      : await stripe.subscriptions.update(id, { cancel_at_period_end: true });

    // Tell the main app to deprovision. The subscription.updated/deleted
    // Stripe webhook remains the authoritative mirror for the local table.
    const customerObj = sub.customer as { email?: string } | string | null;
    await dispatchLifecycleEvent({
      id: `sub_cancel_${id}_${Date.now()}`,
      event: 'subscription.canceled',
      subscriptionId: id,
      customerEmail:
        customerObj && typeof customerObj === 'object'
          ? (customerObj.email ?? null)
          : null,
    });
    revalidatePath('/admin/subscriptions');
    return {
      ok: true,
      message: input.immediately
        ? 'Subscription canceled immediately.'
        : 'Subscription will cancel at the end of the current period.',
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Cancel failed.' };
  }
}

export async function refundLatestSubscriptionPaymentAction(input: {
  subscriptionId: string;
}): Promise<ActionResult> {
  await assertAdmin();
  const id = (input.subscriptionId ?? '').trim();
  if (!id) return { ok: false, message: 'Missing subscription id.' };
  try {
    const stripe = await getStripeClient();
    const sub = await stripe.subscriptions.retrieve(id, {
      expand: ['latest_invoice.payment_intent'],
    });
    const invoice = sub.latest_invoice as any;
    const paymentIntentId =
      typeof invoice?.payment_intent === 'string'
        ? invoice.payment_intent
        : (invoice?.payment_intent?.id ?? null);
    if (!paymentIntentId) {
      return { ok: false, message: 'No payment found on the latest invoice.' };
    }
    const refund = await stripe.refunds.create({ payment_intent: paymentIntentId });

    // Mirror into funnel_purchases when the checkout.session row exists, and
    // tell the main app to deprovision.
    const row = await markFunnelPurchaseRefunded({
      paymentIntentId,
      refundId: refund.id,
      amountCents: refund.amount ?? null,
    });
    await dispatchLifecycleEvent({
      id: `refund_${refund.id}`,
      event: 'refund',
      purchase: row
        ? {
            stripe_event_id: `refund_${refund.id}`,
            payment_intent_id: paymentIntentId,
            product_id: row.product_id ?? null,
            page_type: row.page_type ?? null,
            amount_cents: refund.amount ?? row.amount_cents ?? 0,
            currency: row.currency ?? 'usd',
            customer_email: row.customer_email ?? null,
            customer_name: row.customer_name ?? null,
            metadata: (row.metadata as Record<string, unknown>) ?? null,
          }
        : null,
      subscriptionId: id,
      refund: {
        refund_id: refund.id,
        amount_cents: refund.amount ?? null,
        refunded_at: new Date().toISOString(),
      },
    });
    revalidatePath('/admin/subscriptions');
    revalidatePath('/admin/purchases');
    return { ok: true, message: 'Latest payment refunded.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Refund failed.' };
  }
}
