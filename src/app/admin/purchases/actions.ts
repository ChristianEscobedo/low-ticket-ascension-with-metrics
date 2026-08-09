'use server';

import { revalidatePath } from 'next/cache';
import { getStripeClient } from '@/utils/stripe/config';
import { assertAdmin } from '@/app/admin/_shared/assertAdmin';
import {
  getFunnelPurchaseById,
  markFunnelPurchaseRefunded,
} from '@/utils/supabase/commerce';
import { dispatchLifecycleEvent } from '@/utils/integrations/dispatch';

/**
 * Refund a funnel purchase from /admin/purchases. Full refund by default;
 * pass amountCents for a partial. The row moves to status='refunded' and the
 * main app gets a signed `refund` event so it can deprovision the buyer.
 */
export async function refundPurchaseAction(input: {
  purchaseId: string;
  amountCents?: number | null;
}): Promise<{ ok: boolean; message: string }> {
  await assertAdmin();
  const id = (input.purchaseId ?? '').trim();
  if (!id) return { ok: false, message: 'Missing purchase id.' };

  try {
    const row = await getFunnelPurchaseById(id);
    if (!row) return { ok: false, message: 'Purchase not found.' };
    if (row.status === 'refunded') {
      return { ok: false, message: 'Already refunded.' };
    }
    const paymentIntentId =
      (row.payment_intent_id as string | null) ??
      (typeof row.metadata?.payment_intent_id === 'string'
        ? (row.metadata.payment_intent_id as string)
        : null);
    if (!paymentIntentId) {
      return {
        ok: false,
        message:
          'No payment intent on this row (subscription-mode purchase). Refund it from Subscriptions or Stripe.',
      };
    }

    const amountCents =
      input.amountCents && input.amountCents > 0
        ? Math.min(Math.round(input.amountCents), Number(row.amount_cents ?? 0))
        : null;

    const stripe = await getStripeClient();
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      ...(amountCents ? { amount: amountCents } : {}),
    });

    const updated = await markFunnelPurchaseRefunded({
      purchaseId: id,
      refundId: refund.id,
      amountCents: refund.amount ?? amountCents ?? Number(row.amount_cents ?? 0),
    });

    await dispatchLifecycleEvent({
      id: `refund_${refund.id}`,
      event: 'refund',
      purchase: {
        stripe_event_id: `refund_${refund.id}`,
        payment_intent_id: paymentIntentId,
        product_id: (updated?.product_id as string) ?? (row.product_id as string) ?? null,
        page_type: (updated?.page_type as string) ?? (row.page_type as string) ?? null,
        amount_cents: refund.amount ?? Number(row.amount_cents ?? 0),
        currency: (row.currency as string) ?? 'usd',
        customer_email: (row.customer_email as string) ?? null,
        customer_name: (row.customer_name as string) ?? null,
        metadata: (row.metadata as Record<string, unknown>) ?? null,
      },
      refund: {
        refund_id: refund.id,
        amount_cents: refund.amount ?? null,
        refunded_at: new Date().toISOString(),
      },
    });

    revalidatePath('/admin/purchases');
    revalidatePath('/admin/customers');
    return {
      ok: true,
      message: amountCents
        ? `Partial refund issued (${(refund.amount / 100).toFixed(2)} ${refund.currency.toUpperCase()}).`
        : 'Purchase refunded in full.',
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Refund failed.' };
  }
}
