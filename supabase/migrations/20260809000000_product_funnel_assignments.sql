/**
 * PRODUCT_FUNNEL_ASSIGNMENTS
 * Wires a Stripe product/price into a specific sales-funnel step and declares
 * how the buyer receives it after payment. This is what lets the funnel
 * builder offer a product picker instead of hand-typed ids, and what the
 * success/access pages + the main-app webhook read to know what to deliver.
 *
 * Roles:
 *   main  — the product being sold on that step (checkout FE, upsell1-4)
 *   bump  — order bump attached to the checkout step
 *   bonus — free bonus delivered alongside the purchase
 *
 * Delivery types:
 *   course      — grant courses here (also mirrored in product_course_assignments)
 *   deliverable — link to an in-app deliverable (deliverable_slug/key)
 *   url         — one or more external/hosted links shown on the thank-you page
 *   main_app    — delivered by the main app; the purchase webhook tells it what
 *                 to provision (delivery_config.product_key matches its product builder)
 */
create table product_funnel_assignments (
  id uuid primary key default gen_random_uuid(),
  -- Stripe product id (prod_...) this row wires into a funnel step.
  product_id text not null,
  -- Stripe price id (price_...) selected for charging. Nullable: when blank the
  -- runtime resolves the product's first active price.
  price_id text,
  -- Sales funnel slug (mothermode_sales_funnels.slug).
  funnel_slug text not null,
  -- Funnel step this product sells on: checkout | upsell1 | upsell2 | upsell3 | upsell4
  step text not null check (step in ('checkout', 'upsell1', 'upsell2', 'upsell3', 'upsell4')),
  -- main = sold on that step; bump = order bump; bonus = delivered free with purchase.
  role text not null default 'main' check (role in ('main', 'bump', 'bonus')),
  -- How the buyer receives it after payment.
  delivery_type text not null default 'url' check (delivery_type in ('course', 'deliverable', 'url', 'main_app')),
  -- Delivery payload by type:
  --   course:      { "courseIds": string[] }
  --   deliverable: { "deliverableSlug": string, "deliverableKey": string }
  --   url:         { "links": [{ "label": string, "href": string, "description": string }] }
  --   main_app:    { "productKey": string, "license": boolean, "seats": number }
  delivery_config jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now()),
  unique (product_id, funnel_slug, step, role)
);

create index product_funnel_assignments_funnel_idx
  on product_funnel_assignments (funnel_slug, step);
create index product_funnel_assignments_product_idx
  on product_funnel_assignments (product_id);

-- Service-role only, same posture as funnel_purchases.
alter table product_funnel_assignments enable row level security;
