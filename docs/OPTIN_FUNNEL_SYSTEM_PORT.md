# MotherMode Optin Funnel — Phase 1 Port

Status: **shipped** (manual path + Phase 1b AI self-build). Sales funnel
builder is Phase 2.


## What it is

A DB-driven lead-capture funnel in the **Editorial Warm** MotherMode brand
(bone / ink / mode / brass), not a blind copy of storyflow’s glass templates.

```
/optin/[slug]            → capture email
/optin/[slug]/oto        → optional one-time offer (display + link; no Stripe yet)
/optin/[slug]/thank-you  → confirmation + next step
```

Admin: `/admin/funnels` (sidebar: **Funnels**).

## Files

```
supabase/migrations/20260825000000_mothermode_optin_funnels.sql
src/lib/mothermode/optin/
  types.ts      OptinPageContent / Oto / ThankYou + row mappers
  defaults.ts   MotherMode starter copy (Brain Dump–flavored)
  aiIntake.ts   client-safe AI brief types
  store.ts      service-role CRUD + captureLead + listLeads
  index.ts
src/utils/integrations/openai-optin.ts        server-only generator
src/app/api/mothermode/optin-ai/route.ts      admin AI: action=generate
src/app/api/admin/mothermode-optin/route.ts   GET/POST/DELETE (+ ?leads=1)
src/app/api/optin/capture/route.ts            public capture + oto mark

src/app/admin/funnels/page.tsx
src/app/admin/funnels/OptinFunnelEditor.tsx
src/app/optin/[slug]/page.tsx
src/app/optin/[slug]/oto/page.tsx
src/app/optin/[slug]/thank-you/page.tsx
src/components/mothermode/optin/
  Wordmark.tsx
  OptinPage.tsx
  OptinOtoPage.tsx
  OptinThankYouPage.tsx
tests/lib/optin-funnel.test.ts
```

## Schema

- `mothermode_optin_funnels` — identity, status, JSONB `optin` / `oto` / `thankyou`,
  optional offer/lead-gen/deliverable links, view/conversion counts.
- `mothermode_optin_leads` — unique `(funnel_id, email)`, UTM, oto flags.
- RLS: service_role only. Public traffic goes through Next.js APIs.

## How to use

1. Apply migration `20260825000000_mothermode_optin_funnels.sql`.
2. Open `/admin/funnels` → **AI build** tab → fill niche/audience/magnet/offer →
   **AI: generate full funnel** (or Load MotherMode defaults).
3. Review Optin / OTO / Thank you tabs → set status to **published** → Save.
4. Open `/optin/{slug}` → submit a test email → OTO → thank-you.
5. Leads tab shows captures.

Draft funnels are previewable by signed-in admins only.

## On-page inline edit

Admins who open any optin page (optin / OTO / thank-you) see a floating
**Edit page** toolbar. Click any copy field to patch it inline; Save writes
the merged funnel row back through `/api/admin/mothermode-optin`. Buyers see
nothing. Draft funnels are also previewable by admins.

## Not in this port yet

- Stripe charge on OTO (link-only for now)
- Full sales-page builder (Phase 2)
- Mindshift skin



## Design notes

- Content is JSONB blocks (MotherMode kit style), not 100 flat columns.
- Visual language matches `MotherModeSalesPage` / `HeroSection` wordmark.
- Capture upserts by email; only first capture bumps `conversion_count`.
