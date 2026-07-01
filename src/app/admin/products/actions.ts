'use server';

import { revalidatePath } from 'next/cache';
import { getStripeClient } from '@/utils/stripe/config';
import {
  syncProductsFromStripe,
  upsertProductRecord,
  upsertPriceRecord
} from '@/utils/supabase/admin';
import { assertAdmin } from '@/app/admin/_shared/assertAdmin';
import { PAGE_TYPES } from '@/utils/integrations/types';

export async function syncProductsAction() {
  await assertAdmin();
  const result = await syncProductsFromStripe();
  revalidatePath('/admin/products');
  return result;
}

export interface CreateProductInput {
  name: string;
  description?: string;
  page_type?: string;
  funnel?: string;
  unit_amount_cents: number;
  currency?: string;
  interval?: 'one_time' | 'month' | 'year';
}

export async function createProductAction(input: CreateProductInput) {
  await assertAdmin();
  if (!input.name?.trim()) throw new Error('Product name is required.');
  const cents = Math.round(Number(input.unit_amount_cents));
  if (!Number.isFinite(cents) || cents <= 0) {
    throw new Error('Price must be a positive amount in cents.');
  }
  if (input.page_type && !PAGE_TYPES.includes(input.page_type as any)) {
    throw new Error(`Invalid page_type: ${input.page_type}`);
  }

  const metadata: Record<string, string> = {};
  if (input.page_type) metadata.page_type = input.page_type;
  if (input.funnel) metadata.funnel = input.funnel;

  const stripe = await getStripeClient();
  const product = await stripe.products.create({
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    metadata
  });

  const recurring =
    input.interval && input.interval !== 'one_time'
      ? { interval: input.interval }
      : undefined;

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: cents,
    currency: input.currency?.toLowerCase() || 'usd',
    recurring
  });

  // Mirror into Supabase immediately so the new row appears without
  // waiting for the product.created / price.created webhooks.
  await upsertProductRecord(product);
  await upsertPriceRecord(price);

  revalidatePath('/admin/products');
  return { product_id: product.id, price_id: price.id };
}

export async function updateProductStageAction(input: {
  product_id: string;
  page_type: string | null;
  funnel?: string | null;
}) {
  await assertAdmin();
  if (input.page_type && !PAGE_TYPES.includes(input.page_type as any)) {
    throw new Error(`Invalid page_type: ${input.page_type}`);
  }
  const stripe = await getStripeClient();
  const current = await stripe.products.retrieve(input.product_id);
  const metadata: Record<string, string> = { ...(current.metadata ?? {}) };
  if (input.page_type) metadata.page_type = input.page_type;
  else delete metadata.page_type;
  if (input.funnel !== undefined) {
    if (input.funnel) metadata.funnel = input.funnel;
    else delete metadata.funnel;
  }
  const updated = await stripe.products.update(input.product_id, { metadata });
  await upsertProductRecord(updated);
  revalidatePath('/admin/products');
}
