import { NextRequest, NextResponse } from 'next/server';

// Stub product endpoint backing ProductContext. Returns the static
// MILLIONAIRE_MINDSHIFT_PRODUCT shape so the funnel renders the right
// price/copy without a DB. Per funnel-transfer.md section 12.2: rewire this
// to @/utils/supabase/queries.getProducts() once you want DB-backed products.

const MILLIONAIRE_MINDSHIFT_PRODUCT = {
  id: 'millionaire_mindshift',
  name: 'Millionaire Mindshift',
  description:
    'The Subconscious Reset Method\u2122 \u2014 a 4-step protocol (Surface \u2192 Test \u2192 Clear \u2192 Install) that reprograms the 95% of your mind quietly capping your income.',
  price_cents: 2700,
  original_price_cents: 19700,
  has_payment_plan: false,
  features: [
    'The Identity Audit',
    'The Muscle-Testing Protocol',
    'The Clearing Sequence',
    'Installing the New Identity',
    'The Daily Congruence Practice',
  ],
  bonuses: [] as Array<{
    id: string;
    title: string;
    value: string;
    is_featured?: boolean;
    note?: string;
    display_order: number;
  }>,
};

const PRODUCTS: Record<string, typeof MILLIONAIRE_MINDSHIFT_PRODUCT> = {
  millionaire_mindshift: MILLIONAIRE_MINDSHIFT_PRODUCT,
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('product_id');

  if (productId) {
    const product = PRODUCTS[productId];
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, product });
  }

  return NextResponse.json({ success: true, products: Object.values(PRODUCTS) });
}
