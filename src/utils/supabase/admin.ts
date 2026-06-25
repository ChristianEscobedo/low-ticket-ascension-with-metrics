import { toDateTime } from '@/utils/helpers';
import { stripe } from '@/utils/stripe/config';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import type { Database, Tables, TablesInsert } from '@/types_db';

type Product = Tables<'products'>;
type Price = Tables<'prices'>;

// Change to control trial period length
const TRIAL_PERIOD_DAYS = 0;

// Note: supabaseAdmin uses the SERVICE_ROLE_KEY which you must only use in a secure server-side context
// as it has admin privileges and overwrites RLS policies!
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const upsertProductRecord = async (product: Stripe.Product) => {
  const productData: Product = {
    id: product.id,
    active: product.active,
    name: product.name,
    description: product.description ?? null,
    image: product.images?.[0] ?? null,
    metadata: product.metadata
  };

  const { error: upsertError } = await supabaseAdmin
    .from('products')
    .upsert([productData]);
  if (upsertError)
    throw new Error(`Product insert/update failed: ${upsertError.message}`);
  console.log(`Product inserted/updated: ${product.id}`);
};

const upsertPriceRecord = async (
  price: Stripe.Price,
  retryCount = 0,
  maxRetries = 3
) => {
  const priceData: Price = {
    id: price.id,
    product_id: typeof price.product === 'string' ? price.product : '',
    active: price.active,
    currency: price.currency,
    type: price.type,
    unit_amount: price.unit_amount ?? null,
    interval: price.recurring?.interval ?? null,
    interval_count: price.recurring?.interval_count ?? null,
    trial_period_days: price.recurring?.trial_period_days ?? TRIAL_PERIOD_DAYS
  };

  const { error: upsertError } = await supabaseAdmin
    .from('prices')
    .upsert([priceData]);

  if (upsertError?.message.includes('foreign key constraint')) {
    if (retryCount < maxRetries) {
      console.log(`Retry attempt ${retryCount + 1} for price ID: ${price.id}`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await upsertPriceRecord(price, retryCount + 1, maxRetries);
    } else {
      throw new Error(
        `Price insert/update failed after ${maxRetries} retries: ${upsertError.message}`
      );
    }
  } else if (upsertError) {
    throw new Error(`Price insert/update failed: ${upsertError.message}`);
  } else {
    console.log(`Price inserted/updated: ${price.id}`);
  }
};

const deleteProductRecord = async (product: Stripe.Product) => {
  const { error: deletionError } = await supabaseAdmin
    .from('products')
    .delete()
    .eq('id', product.id);
  if (deletionError)
    throw new Error(`Product deletion failed: ${deletionError.message}`);
  console.log(`Product deleted: ${product.id}`);
};

const deletePriceRecord = async (price: Stripe.Price) => {
  const { error: deletionError } = await supabaseAdmin
    .from('prices')
    .delete()
    .eq('id', price.id);
  if (deletionError) throw new Error(`Price deletion failed: ${deletionError.message}`);
  console.log(`Price deleted: ${price.id}`);
};

const upsertCustomerToSupabase = async (uuid: string, customerId: string) => {
  const { error: upsertError } = await supabaseAdmin
    .from('customers')
    .upsert([{ id: uuid, stripe_customer_id: customerId }]);

  if (upsertError)
    throw new Error(`Supabase customer record creation failed: ${upsertError.message}`);

  return customerId;
};

const createCustomerInStripe = async (uuid: string, email: string) => {
  const customerData = { metadata: { supabaseUUID: uuid }, email: email };
  const newCustomer = await stripe.customers.create(customerData);
  if (!newCustomer) throw new Error('Stripe customer creation failed.');

  return newCustomer.id;
};

const createOrRetrieveCustomer = async ({
  email,
  uuid
}: {
  email: string;
  uuid: string;
}) => {
  // Check if the customer already exists in Supabase
  const { data: existingSupabaseCustomer, error: queryError } =
    await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('id', uuid)
      .maybeSingle();

  if (queryError) {
    throw new Error(`Supabase customer lookup failed: ${queryError.message}`);
  }

  // Retrieve the Stripe customer ID using the Supabase customer ID, with email fallback
  let stripeCustomerId: string | undefined;
  if (existingSupabaseCustomer?.stripe_customer_id) {
    const existingStripeCustomer = await stripe.customers.retrieve(
      existingSupabaseCustomer.stripe_customer_id
    );
    stripeCustomerId = existingStripeCustomer.id;
  } else {
    // If Stripe ID is missing from Supabase, try to retrieve Stripe customer ID by email
    const stripeCustomers = await stripe.customers.list({ email: email });
    stripeCustomerId =
      stripeCustomers.data.length > 0 ? stripeCustomers.data[0].id : undefined;
  }

  // If still no stripeCustomerId, create a new customer in Stripe
  const stripeIdToInsert = stripeCustomerId
    ? stripeCustomerId
    : await createCustomerInStripe(uuid, email);
  if (!stripeIdToInsert) throw new Error('Stripe customer creation failed.');

  if (existingSupabaseCustomer && stripeCustomerId) {
    // If Supabase has a record but doesn't match Stripe, update Supabase record
    if (existingSupabaseCustomer.stripe_customer_id !== stripeCustomerId) {
      const { error: updateError } = await supabaseAdmin
        .from('customers')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', uuid);

      if (updateError)
        throw new Error(
          `Supabase customer record update failed: ${updateError.message}`
        );
      console.warn(
        `Supabase customer record mismatched Stripe ID. Supabase record updated.`
      );
    }
    // If Supabase has a record and matches Stripe, return Stripe customer ID
    return stripeCustomerId;
  } else {
    console.warn(
      `Supabase customer record was missing. A new record was created.`
    );

    // If Supabase has no record, create a new record and return Stripe customer ID
    const upsertedStripeCustomer = await upsertCustomerToSupabase(
      uuid,
      stripeIdToInsert
    );
    if (!upsertedStripeCustomer)
      throw new Error('Supabase customer record creation failed.');

    return upsertedStripeCustomer;
  }
};

/**
 * Copies the billing details from the payment method to the customer object.
 */
const copyBillingDetailsToCustomer = async (
  uuid: string,
  payment_method: Stripe.PaymentMethod
) => {
  //Todo: check this assertion
  const customer = payment_method.customer as string;
  const { name, phone, address } = payment_method.billing_details;
  if (!name || !phone || !address) return;
  //@ts-ignore
  await stripe.customers.update(customer, { name, phone, address });
  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({
      billing_address: { ...address },
      payment_method: { ...payment_method[payment_method.type] }
    })
    .eq('id', uuid);
  if (updateError) throw new Error(`Customer update failed: ${updateError.message}`);
};

const manageSubscriptionStatusChange = async (
  subscriptionId: string,
  customerId: string,
  createAction = false
) => {
  // Get customer's UUID from mapping table.
  const { data: customerData, error: noCustomerError } = await supabaseAdmin
    .from('customers')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (noCustomerError)
    throw new Error(`Customer lookup failed: ${noCustomerError.message}`);

  const { id: uuid } = customerData!;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['default_payment_method']
  });
  // Upsert the latest status of the subscription object.
  const subscriptionData: TablesInsert<'subscriptions'> = {
    id: subscription.id,
    user_id: uuid,
    metadata: subscription.metadata,
    status: subscription.status,
    price_id: subscription.items.data[0].price.id,
    //TODO check quantity on subscription
    // @ts-ignore
    quantity: subscription.quantity,
    cancel_at_period_end: subscription.cancel_at_period_end,
    cancel_at: subscription.cancel_at
      ? toDateTime(subscription.cancel_at).toISOString()
      : null,
    canceled_at: subscription.canceled_at
      ? toDateTime(subscription.canceled_at).toISOString()
      : null,
    current_period_start: toDateTime(
      subscription.current_period_start
    ).toISOString(),
    current_period_end: toDateTime(
      subscription.current_period_end
    ).toISOString(),
    created: toDateTime(subscription.created).toISOString(),
    ended_at: subscription.ended_at
      ? toDateTime(subscription.ended_at).toISOString()
      : null,
    trial_start: subscription.trial_start
      ? toDateTime(subscription.trial_start).toISOString()
      : null,
    trial_end: subscription.trial_end
      ? toDateTime(subscription.trial_end).toISOString()
      : null
  };

  const { error: upsertError } = await supabaseAdmin
    .from('subscriptions')
    .upsert([subscriptionData]);
  if (upsertError)
    throw new Error(`Subscription insert/update failed: ${upsertError.message}`);
  console.log(
    `Inserted/updated subscription [${subscription.id}] for user [${uuid}]`
  );

  // For a new subscription copy the billing details to the customer object.
  // NOTE: This is a costly operation and should happen at the very end.
  if (createAction && subscription.default_payment_method && uuid)
    //@ts-ignore
    await copyBillingDetailsToCustomer(
      uuid,
      subscription.default_payment_method as Stripe.PaymentMethod
    );
};

// Funnel purchase recording — backs /admin/funnel-stats and gives the webhook
// true cross-instance idempotency via the `stripe_event_id` unique constraint.
// The `funnel_purchases` table is defined in
// supabase/migrations/20260613000000_funnel_purchases.sql. Run
// `pnpm supabase:generate-types` after applying that migration to add the row
// types to types_db.ts; until then we cast through `any` here so the build
// stays green.
export interface FunnelPurchaseInsert {
  stripe_event_id: string;
  payment_intent_id?: string | null;
  checkout_session_id?: string | null;
  product_id?: string | null;
  page_type?: string | null;
  amount_cents: number;
  currency: string;
  customer_email?: string | null;
  customer_name?: string | null;
  status?: string;
  metadata?: Record<string, unknown> | null;
}

const recordFunnelPurchase = async (row: FunnelPurchaseInsert) => {
  const { error } = await (supabaseAdmin as any)
    .from('funnel_purchases')
    .insert(row);
  // Unique-violation on stripe_event_id means this event was already recorded;
  // swallow it so retried webhook deliveries are no-ops.
  if (error && error.code !== '23505') {
    throw new Error(`Funnel purchase insert failed: ${error.message}`);
  }
};

export interface FunnelPurchaseRow extends FunnelPurchaseInsert {
  id: string;
  created_at: string;
}

export interface FunnelStats {
  totalCents: number;
  totalCount: number;
  uniqueCustomers: number;
  byProduct: Array<{ product_id: string; count: number; totalCents: number }>;
  byPageType: Array<{ page_type: string; count: number; totalCents: number }>;
  byDay: Array<{ day: string; count: number; totalCents: number }>;
  recent: FunnelPurchaseRow[];
}

const groupSum = (
  rows: FunnelPurchaseRow[],
  key: 'product_id' | 'page_type'
) => {
  const map = new Map<string, { count: number; totalCents: number }>();
  for (const r of rows) {
    const k = (r[key] as string | null | undefined) ?? 'unknown';
    const agg = map.get(k) ?? { count: 0, totalCents: 0 };
    agg.count += 1;
    agg.totalCents += r.amount_cents ?? 0;
    map.set(k, agg);
  }
  return Array.from(map.entries())
    .map(([k, v]) => ({ [key]: k, ...v }))
    .sort((a, b) => b.totalCents - a.totalCents) as any[];
};

const buildDailySeries = (
  rows: FunnelPurchaseRow[],
  days = 30
): Array<{ day: string; count: number; totalCents: number }> => {
  // Pre-seed the last N days (UTC) so the chart renders a continuous axis
  // even when some days have zero sales.
  const series = new Map<string, { count: number; totalCents: number }>();
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    d.setUTCDate(d.getUTCDate() - i);
    series.set(d.toISOString().slice(0, 10), { count: 0, totalCents: 0 });
  }
  for (const r of rows) {
    const day = (r.created_at ?? '').slice(0, 10);
    if (!series.has(day)) continue;
    const agg = series.get(day)!;
    agg.count += 1;
    agg.totalCents += r.amount_cents ?? 0;
  }
  return Array.from(series.entries()).map(([day, v]) => ({ day, ...v }));
};

const getFunnelStats = async (recentLimit = 50): Promise<FunnelStats> => {
  // Pull all rows for aggregates (table is small for now; swap for a SQL
  // aggregate view if it grows beyond a few tens of thousands of rows).
  const { data: allRows, error: aggErr } = await (supabaseAdmin as any)
    .from('funnel_purchases')
    .select('amount_cents, product_id, page_type, customer_email, created_at');
  if (aggErr) throw new Error(`Funnel stats failed: ${aggErr.message}`);

  const { data: recent, error: recentErr } = await (supabaseAdmin as any)
    .from('funnel_purchases')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(recentLimit);
  if (recentErr) throw new Error(`Funnel recent failed: ${recentErr.message}`);

  const rows = (allRows ?? []) as FunnelPurchaseRow[];
  const totalCents = rows.reduce((s, r) => s + (r.amount_cents ?? 0), 0);
  const uniqueCustomers = new Set(
    rows.map((r) => r.customer_email).filter(Boolean)
  ).size;

  return {
    totalCents,
    totalCount: rows.length,
    uniqueCustomers,
    byProduct: groupSum(rows, 'product_id'),
    byPageType: groupSum(rows, 'page_type'),
    byDay: buildDailySeries(rows, 30),
    recent: (recent ?? []) as FunnelPurchaseRow[]
  };
};

// ===========================================================================
// Admin dashboard helpers
// ===========================================================================

export interface OverviewStats {
  totalRevenueCents: number;
  revenue30dCents: number;
  totalPurchases: number;
  purchases30d: number;
  activeSubscriptions: number;
  recentPurchases: FunnelPurchaseRow[];
}

const getOverviewStats = async (): Promise<OverviewStats> => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: allRows }, { data: recent }, { count: activeSubs }] =
    await Promise.all([
      (supabaseAdmin as any)
        .from('funnel_purchases')
        .select('amount_cents, created_at'),
      (supabaseAdmin as any)
        .from('funnel_purchases')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10),
      supabaseAdmin
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .in('status', ['trialing', 'active'])
    ]);

  const rows = (allRows ?? []) as Array<{
    amount_cents: number;
    created_at: string;
  }>;
  const totalRevenueCents = rows.reduce((s, r) => s + (r.amount_cents ?? 0), 0);
  const recent30 = rows.filter((r) => r.created_at >= since);
  const revenue30dCents = recent30.reduce(
    (s, r) => s + (r.amount_cents ?? 0),
    0
  );

  return {
    totalRevenueCents,
    revenue30dCents,
    totalPurchases: rows.length,
    purchases30d: recent30.length,
    activeSubscriptions: activeSubs ?? 0,
    recentPurchases: (recent ?? []) as FunnelPurchaseRow[]
  };
};

export interface PurchasesFilters {
  page_type?: string;
  product_id?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface PurchasesPage {
  rows: FunnelPurchaseRow[];
  total: number;
  page: number;
  pageSize: number;
}

const getPurchasesList = async (
  page = 1,
  pageSize = 50,
  filters: PurchasesFilters = {}
): Promise<PurchasesPage> => {
  let query = (supabaseAdmin as any)
    .from('funnel_purchases')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filters.page_type) query = query.eq('page_type', filters.page_type);
  if (filters.product_id) query = query.eq('product_id', filters.product_id);
  if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
  if (filters.dateTo) query = query.lte('created_at', filters.dateTo);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error(`Purchases list failed: ${error.message}`);

  return {
    rows: (data ?? []) as FunnelPurchaseRow[],
    total: count ?? 0,
    page,
    pageSize
  };
};

export interface CustomerSummary {
  id: string;
  email: string;
  created_at: string;
  stripe_customer_id: string | null;
  lifetimeCents: number;
  purchaseCount: number;
  activeSubscription: boolean;
}

const getCustomersList = async (
  page = 1,
  pageSize = 50
): Promise<{ rows: CustomerSummary[]; total: number; page: number; pageSize: number }> => {
  const {
    data: { users },
    error
  } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: pageSize });
  if (error) throw new Error(`Customers list failed: ${error.message}`);

  const emails = users.map((u) => u.email).filter(Boolean) as string[];
  const ids = users.map((u) => u.id);

  const [{ data: customerRows }, { data: subRows }, { data: purchaseRows }] =
    await Promise.all([
      supabaseAdmin.from('customers').select('id, stripe_customer_id').in('id', ids),
      supabaseAdmin
        .from('subscriptions')
        .select('user_id, status')
        .in('user_id', ids)
        .in('status', ['trialing', 'active']),
      (supabaseAdmin as any)
        .from('funnel_purchases')
        .select('customer_email, amount_cents')
        .in('customer_email', emails)
    ]);

  const customerMap = new Map(
    (customerRows ?? []).map((c: any) => [c.id, c.stripe_customer_id])
  );
  const activeSubSet = new Set((subRows ?? []).map((s: any) => s.user_id));
  const purchaseAgg = new Map<string, { count: number; cents: number }>();
  for (const p of (purchaseRows ?? []) as any[]) {
    const k = p.customer_email as string;
    const agg = purchaseAgg.get(k) ?? { count: 0, cents: 0 };
    agg.count += 1;
    agg.cents += p.amount_cents ?? 0;
    purchaseAgg.set(k, agg);
  }

  const rows: CustomerSummary[] = users.map((u) => {
    const agg = purchaseAgg.get(u.email ?? '') ?? { count: 0, cents: 0 };
    return {
      id: u.id,
      email: u.email ?? '',
      created_at: u.created_at,
      stripe_customer_id: customerMap.get(u.id) ?? null,
      lifetimeCents: agg.cents,
      purchaseCount: agg.count,
      activeSubscription: activeSubSet.has(u.id)
    };
  });

  // listUsers doesn't return a total reliably; estimate via the count of
  // returned users (caller can keep paging until it gets back < pageSize).
  return { rows, total: rows.length < pageSize ? (page - 1) * pageSize + rows.length : -1, page, pageSize };
};

export interface CustomerDetail {
  user: { id: string; email: string; created_at: string };
  stripe_customer_id: string | null;
  subscriptions: any[];
  purchases: FunnelPurchaseRow[];
  lifetimeCents: number;
}

const getCustomerById = async (id: string): Promise<CustomerDetail | null> => {
  const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(id);
  if (error || !user) return null;

  const [{ data: customer }, { data: subs }, { data: purchases }] = await Promise.all([
    supabaseAdmin.from('customers').select('stripe_customer_id').eq('id', id).maybeSingle(),
    supabaseAdmin
      .from('subscriptions')
      .select('*, prices(*, products(*))')
      .eq('user_id', id)
      .order('created', { ascending: false }),
    (supabaseAdmin as any)
      .from('funnel_purchases')
      .select('*')
      .eq('customer_email', user.email ?? '')
      .order('created_at', { ascending: false })
  ]);

  const purchaseRows = (purchases ?? []) as FunnelPurchaseRow[];
  const lifetimeCents = purchaseRows.reduce(
    (s, r) => s + (r.amount_cents ?? 0),
    0
  );

  return {
    user: { id: user.id, email: user.email ?? '', created_at: user.created_at },
    stripe_customer_id: (customer as any)?.stripe_customer_id ?? null,
    subscriptions: subs ?? [],
    purchases: purchaseRows,
    lifetimeCents
  };
};

export interface CustomerReceiptLogEntry {
  id: string;
  created_at: string;
  status: string;
  provider: string | null;
  amount_cents: number | null;
  currency: string | null;
  payment_intent_id: string | null;
  message_id: string | null;
  delivery_status: string | null;
  bounce_reason: string | null;
  error: string | null;
  skipped_reason: string | null;
}

export interface CustomerCtaClickEntry {
  id: string;
  created_at: string;
  lesson_id: string;
  cta_id: string;
  lesson_title: string | null;
  course_id: string | null;
  course_title: string | null;
}

export interface CustomerLessonProgressEntry {
  lesson_id: string;
  lesson_title: string | null;
  course_id: string | null;
  course_title: string | null;
  progress_seconds: number;
  is_completed: boolean;
  completed_at: string | null;
  last_watched_at: string | null;
}

export interface CustomerActivity {
  receiptLog: CustomerReceiptLogEntry[];
  ctaClicks: CustomerCtaClickEntry[];
  lessonProgress: CustomerLessonProgressEntry[];
}

const getCustomerActivity = async (
  userId: string,
  email: string | null
): Promise<CustomerActivity> => {
  const [receiptRes, clickRes, progressRes] = await Promise.all([
    email
      ? (supabaseAdmin as any)
          .from('receipt_log')
          .select(
            'id, created_at, status, provider, amount_cents, currency, payment_intent_id, message_id, delivery_status, bounce_reason, error, skipped_reason'
          )
          .eq('customer_email', email)
          .order('created_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] }),
    (supabaseAdmin as any)
      .from('cta_click_events')
      .select('id, created_at, lesson_id, cta_id, lessons(title, course_id, courses(title))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
    (supabaseAdmin as any)
      .from('user_lesson_progress')
      .select(
        'lesson_id, progress_seconds, is_completed, completed_at, last_watched_at, lessons(title, course_id, courses(title))'
      )
      .eq('user_id', userId)
      .order('last_watched_at', { ascending: false })
      .limit(100)
  ]);

  const receiptLog = (receiptRes?.data ?? []) as CustomerReceiptLogEntry[];

  const ctaClicks: CustomerCtaClickEntry[] = (clickRes?.data ?? []).map(
    (r: any) => ({
      id: r.id,
      created_at: r.created_at,
      lesson_id: r.lesson_id,
      cta_id: r.cta_id,
      lesson_title: r.lessons?.title ?? null,
      course_id: r.lessons?.course_id ?? null,
      course_title: r.lessons?.courses?.title ?? null
    })
  );

  const lessonProgress: CustomerLessonProgressEntry[] = (
    progressRes?.data ?? []
  ).map((r: any) => ({
    lesson_id: r.lesson_id,
    lesson_title: r.lessons?.title ?? null,
    course_id: r.lessons?.course_id ?? null,
    course_title: r.lessons?.courses?.title ?? null,
    progress_seconds: r.progress_seconds ?? 0,
    is_completed: !!r.is_completed,
    completed_at: r.completed_at ?? null,
    last_watched_at: r.last_watched_at ?? null
  }));

  return { receiptLog, ctaClicks, lessonProgress };
};

const getSubscriptionsList = async (page = 1, pageSize = 50) => {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, count, error } = await supabaseAdmin
    .from('subscriptions')
    .select('*, prices(*, products(*))', { count: 'exact' })
    .order('created', { ascending: false })
    .range(from, to);
  if (error) throw new Error(`Subscriptions list failed: ${error.message}`);

  const userIds = (data ?? []).map((s: any) => s.user_id);
  const emailMap = new Map<string, string>();
  if (userIds.length) {
    // listUsers returns at most perPage users. For the boilerplate's expected
    // scale this is fine; swap for a single SQL call if you grow past it.
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({
      perPage: Math.max(pageSize, 100)
    });
    for (const u of users) if (u.email) emailMap.set(u.id, u.email);
  }

  return {
    rows: (data ?? []).map((s: any) => ({
      ...s,
      customer_email: emailMap.get(s.user_id) ?? null
    })),
    total: count ?? 0,
    page,
    pageSize
  };
};

const getProductsWithPrices = async () => {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('*, prices(*)')
    .order('name');
  if (error) throw new Error(`Products list failed: ${error.message}`);
  return data ?? [];
};

const syncProductsFromStripe = async () => {
  let products = 0;
  let prices = 0;
  for await (const product of stripe.products.list({ limit: 100 })) {
    await upsertProductRecord(product);
    products += 1;
  }
  for await (const price of stripe.prices.list({ limit: 100 })) {
    await upsertPriceRecord(price);
    prices += 1;
  }
  return { products, prices };
};

// Timestamp of the most recent funnel_purchases row. Used by the Stripe
// admin panel as a "last webhook seen" health indicator.
const getLastWebhookEventAt = async (): Promise<string | null> => {
  const { data, error } = await (supabaseAdmin as any)
    .from('funnel_purchases')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data?.created_at as string | null) ?? null;
};

export interface CtaClickerRow {
  user_id: string | null;
  email: string | null;
  clicks: number;
  first_click_at: string;
  last_click_at: string;
}

const CTA_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Per-user click breakdown for a single (lesson, CTA) pair, ordered by click
 * count. Anonymous clicks are aggregated into a single row with user_id null.
 * Returns [] when env vars are missing or the query fails.
 */
const getCtaClickers = async (
  lessonId: string,
  ctaId: string,
  opts: {
    startDate?: string | null;
    endDate?: string | null;
    limit?: number;
  } = {}
): Promise<CtaClickerRow[]> => {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return [];
  }
  const endBound = opts.endDate
    ? CTA_DATE_RE.test(opts.endDate)
      ? `${opts.endDate}T23:59:59.999Z`
      : opts.endDate
    : null;
  let q = (supabaseAdmin as any)
    .from('cta_click_events')
    .select('user_id, created_at')
    .eq('lesson_id', lessonId)
    .eq('cta_id', ctaId)
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 5000);
  if (opts.startDate) q = q.gte('created_at', opts.startDate);
  if (endBound) q = q.lte('created_at', endBound);
  const { data, error } = await q;
  if (error) return [];

  type Row = { user_id: string | null; created_at: string };
  const agg = new Map<
    string,
    { user_id: string | null; clicks: number; first: string; last: string }
  >();
  for (const e of (data ?? []) as Row[]) {
    const key = e.user_id ?? '__anon__';
    const cur =
      agg.get(key) ??
      { user_id: e.user_id, clicks: 0, first: e.created_at, last: e.created_at };
    cur.clicks += 1;
    if (e.created_at < cur.first) cur.first = e.created_at;
    if (e.created_at > cur.last) cur.last = e.created_at;
    agg.set(key, cur);
  }

  const userIds = Array.from(agg.values())
    .map((v) => v.user_id)
    .filter((id): id is string => !!id);
  const emailMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000
    });
    for (const u of users) if (u.email) emailMap.set(u.id, u.email);
  }

  return Array.from(agg.values())
    .map((v) => ({
      user_id: v.user_id,
      email: v.user_id ? emailMap.get(v.user_id) ?? null : null,
      clicks: v.clicks,
      first_click_at: v.first,
      last_click_at: v.last
    }))
    .sort((a, b) => b.clicks - a.clicks);
};

export interface CtaContextInfo {
  lessonId: string;
  ctaId: string;
  lessonTitle: string | null;
  courseId: string | null;
  courseTitle: string | null;
  ctaTitle: string | null;
  ctaButtonText: string | null;
  ctaLink: string | null;
}

/** Hydrate (lesson, cta) metadata for the clickers page header. */
const getCtaContext = async (
  lessonId: string,
  ctaId: string
): Promise<CtaContextInfo | null> => {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return null;
  }
  const { data: lesson } = await (supabaseAdmin as any)
    .from('lessons')
    .select('id, title, course_id, ctas, courses(title)')
    .eq('id', lessonId)
    .maybeSingle();
  if (!lesson) return null;
  const ctaList = Array.isArray(lesson.ctas) ? (lesson.ctas as any[]) : [];
  const cta = ctaList.find((c) => c?.id === ctaId);
  return {
    lessonId,
    ctaId,
    lessonTitle: lesson.title ?? null,
    courseId: lesson.course_id ?? null,
    courseTitle: (lesson.courses as any)?.title ?? null,
    ctaTitle: cta?.title ?? null,
    ctaButtonText: cta?.buttonText ?? null,
    ctaLink: cta?.link ?? null
  };
};

export {
  upsertProductRecord,
  upsertPriceRecord,
  deleteProductRecord,
  deletePriceRecord,
  createOrRetrieveCustomer,
  manageSubscriptionStatusChange,
  recordFunnelPurchase,
  getFunnelStats,
  getOverviewStats,
  getPurchasesList,
  getCustomersList,
  getCustomerById,
  getCustomerActivity,
  getCtaClickers,
  getCtaContext,
  getSubscriptionsList,
  getProductsWithPrices,
  syncProductsFromStripe,
  getLastWebhookEventAt
};
