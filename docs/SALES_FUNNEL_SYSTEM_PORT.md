# MotherMode Sales Funnel — System Port

Status: **complete** (customized full MotherMode sales funnel builder + optin-style on-page edit).

**Important:** This is a **fully customized, DB-driven clone** of the MotherMode
sales funnel experience. The original MotherMode catalog pages under
`/mothermode/*` are **never modified or deleted** — they remain the reference
product. The builder seeds from them and renders the same layout components
with funnel-owned JSON content.

Companion audit: `docs/FUNNEL_EDITABILITY_AUDIT.md`
Chrome edit handoff (complete): `docs/SALES_FUNNEL_CHROME_EDIT_HANDOFF.md`
Re-run field audit: `node scripts/audit-funnel-editability.cjs`
Chrome structural verify: `node scripts/verify-chrome-final.cjs`

---

## What it is

A complete purchase-path funnel builder in the **Editorial Warm** MotherMode brand
(bone / ink / mode / brass), modeled on the optin funnel architecture but extended
to the full MotherMode sales journey:

```
/funnel/[slug]             -> optin (lead capture)
/funnel/[slug]/sales       -> long-form MotherMode sales page
/funnel/[slug]/vsl         -> video sales letter
/funnel/[slug]/checkout    -> checkout (Stripe-ready)
/funnel/[slug]/upsell      -> OTO1 (MotherMode OS)
/funnel/[slug]/upsell-2    -> OTO2 (Annual upgrade)
/funnel/[slug]/upsell-3    -> OTO3 (Redesign Vault)
/funnel/[slug]/upsell-4    -> OTO4 (Coaching)
/funnel/[slug]/success     -> receipt + delivery cards
/funnel/[slug]/access      -> members delivery + onboarding
```

Admin: `/admin/sales-funnels` (sidebar: **Sales Funnels**).

The existing optin funnel (`/admin/funnels`, `/optin/[slug]/**`) is **not
modified or deleted** — it served as the reference model for builder UX,
inline edit, capture, and email kit wiring.

---

## Files

```
supabase/migrations/20260901000000_mothermode_sales_funnels.sql
supabase/migrations/20260902000000_sales_funnel_email_kits.sql

src/lib/mothermode/sales/
  types.ts              # full content blocks + emailKits + mappers
  defaults.ts           # Load MotherMode defaults (brain-dump + ascension OTOs)
  fromOffer.ts          # MotherModeOffer <-> SalesPageContent (bidirectional)
                        # also maps ctaLabel + pricingEyebrow for on-page edit
  fromAscension.ts      # AscensionOffer -> UpsellContent
  aiIntake.ts
  store.ts              # CRUD, leads, events, email enrollment
  loadFunnelPage.ts
  index.ts

src/utils/integrations/openai-sales.ts
src/app/api/mothermode/sales-ai/route.ts
src/app/api/admin/mothermode-sales/route.ts
src/app/api/funnel/capture/route.ts

src/app/admin/sales-funnels/page.tsx
src/app/admin/sales-funnels/SalesFunnelEditor.tsx   # full field set per step

src/components/mothermode/sales/
  inlineEdit.tsx              # toolbar, popup, Editable, EditableList, save
                              # footer.* root path get/set + save payload
  SalesPageEditContext.tsx    # SalesPageEditProvider + MmEditable (+ onDark)
  FunnelMediaStudio.tsx
  SalesOptinPage.tsx
  SalesPage.tsx               # MotherModeSalesPage + provider + minimizable sheet
  VslPage.tsx
  CheckoutPage.tsx            # provider + timer/brand props + OptinFooter
  UpsellPage.tsx              # MotherModeUpsellPage + provider + minimizable sheet
  SuccessPage.tsx
  AccessPage.tsx

src/components/mothermode/checkout/MotherModeCheckout.tsx
                              # timerLabel + brandLabel MmEditable chrome

src/components/mothermode/optin/
  Wordmark.tsx                # shared OptinWordmark → footer.brandLine (sales edit)
  OptinFooter.tsx             # footer.* hover-edit (brand/disclaimer/links/copyright)

# MotherMode layout sections (optional MmEditable; no-op on catalog pages)
src/components/mothermode/parts/
  HeroSection.tsx             # uses shared OptinWordmark (no local Wordmark)
  NarrativeSections.tsx, InsideSection.tsx,
  ProofSection.tsx, BonusSection.tsx, ClosingSections.tsx,
  CheckoutButton.tsx, UrgencyBar.tsx, ...
src/components/mothermode/upsell/MotherModeUpsellPage.tsx
src/components/mothermode/MotherModeSalesPage.tsx

# Verify chrome wiring
scripts/verify-chrome-final.cjs

src/app/funnel/[slug]/page.tsx
src/app/funnel/[slug]/sales|vsl|checkout|upsell|upsell-2|upsell-3|upsell-4|success|access/page.tsx
```

---

## Funnel steps (feature parity)

| Step | Public route | Layout source | Editable |
|------|--------------|---------------|----------|
| Optin | `/funnel/[slug]` | SalesOptinPage | Admin + hover + Media Studio + placeholders/CTA |
| Sales | `/funnel/[slug]/sales` | **Exact** `MotherModeSalesPage` | Admin + hover (`MmEditable`) + minimizable field sheet + Media Studio |
| VSL | `/funnel/[slug]/vsl` | Centered production VSL | Admin + on-page + Media Studio |
| Checkout | `/funnel/[slug]/checkout` | `MotherModeCheckout` + product image | Admin + hover (`MmEditable`) + timer/brand chrome + field sheet + product image |
| Upsell 1–4 | `/funnel/[slug]/upsell(-N)` | **Exact** MotherMode OTO layout | Admin + hover + minimizable field sheet + Media Studio |
| Success | `/funnel/[slug]/success` | Receipt + delivery cards | Admin + on-page (cards in Admin) |
| Access | `/funnel/[slug]/access` | Members hub + welcome video | Admin + on-page + Media Studio |
| Footer | (shared chrome) | OptinFooter + OptinWordmark | Admin Footer tab + on-page hover (`footer.*`) |

---

## Sales page = full MotherMode layout (congruent)

The funnel sales step is **not** a simplified clone. It renders the real
`MotherModeSalesPage` section-for-section:

```
UrgencyBar
→ Hero
→ two-column narrative
    Problem / Origin / WhatIs / Mechanism / OldVsNew / Method
    + sticky ContentSidebar
→ Inside
→ Proof
→ Pricing
→ Guarantee
→ FAQ
→ Founder letter   ← full letter + founder photo
→ Bonuses
→ Final CTA
→ Footer
```

### Content flow

1. Funnel stores a full `SalesPageContent` JSON block covering **every**
   MotherMode offer field (see schema below).
2. `salesContentToOffer()` maps that JSON → a synthetic `MotherModeOffer`,
   plus funnel-only extras:
   - `ctaLabel` ← `ctaText` (drives CheckoutButton labels)
   - `pricingEyebrow` ← `priceDescription` (pricing section eyebrow)
3. `MotherModeSalesPage` renders it identically to `/mothermode/[slug]`.
4. CTAs route to `/funnel/{slug}/checkout` via `CheckoutHrefProvider` +
   `CheckoutButton` context override (catalog checkout still works when no
   override is set — MotherMode pages are untouched).

### SalesPageContent schema (complete)

**Identity / media**
- `name`, `tagline`, `category`
- `priceCents`, `originalPriceCents`, `priceLabel`, `originalPriceLabel`, `priceDescription`
- `ctaText`, `ctaSubtext`
- `guaranteeTitle`, `guaranteeText`
- `heroImageUrl`, `heroVideoUrl`, **`founderPhotoUrl`**

**Hero**
- `eyebrow`, `headline`, `headlineEmphasis`, `headlineSuffix`
- `subheadline`, `audience`, `promise`

**Problem**
- `problemHeading`, `problemIntro`, `problemScene`, `problemPoints[]`, `problemCost`
- `problemBody` (legacy flat)

**Origin**
- `originEyebrow`, `originHeading`, `originParagraphs[]`

**What is / solution**
- `whatIsHeading`, `whatIsParagraphs[]`
- `solutionHeading`, `solutionBody` (legacy)

**Mechanism**
- `mechanismEyebrow`, `mechanismHeading`, `mechanismLabel`
- `mechanismParagraphs[]`, `mechanismPoints[{title,description}]`

**Inside**
- `insideHeading`, `insideSubheading`, `insideLead`
- `insideItems[{title,description,tag,value,outcome}]`
- `featuresHeading`, `features[]` (legacy)

**Method**
- `methodHeading`, `methodSubheading`
- `methodSteps[{number,title,description,meta,shift}]`
- `methodCloser`

**Old vs new**
- `oldWayHeading`, `oldWayItems[]`
- `newWayHeading`, `newWayItems[]`

**Proof**
- `proof[{name,role,quote,real}]`
- `testimonialsHeading`, `testimonials[]` (legacy)

**Bonuses**
- `bonusesEyebrow`, `bonusesHeading`, `bonusesIntro`
- `bonusesItems[{title,description,value}]`
- `bonusesTotalValue`, `bonusesCloser`

**Founder letter**
- `founderEyebrow`, `founderHeading`, `founderGreeting`
- `founderParagraphs[]`, `founderSignoff`, `founderPs`
- `founderPhotoUrl` (media slot → `offer.media.founderPhoto`)

**FAQ / final / bumps**
- `faqHeading`, `faqs[{question,answer}]`
- `finalCtaHeading`, `finalCtaBody`
- `bumps[{id,title,description,price}]`

### Defaults + AI

- **Load MotherMode defaults** seeds from a real catalog offer:
  `offerToSalesContent(brainDump)` plus ascension OTOs via `fromAscension`.
- AI generate fills the same expanded schema.
- MotherMode catalog under `/mothermode/*` is never modified.

### Admin editing (Sales tab)

Admin → Sales Funnels → **Sales** tab is organized by section:

1. Identity & media (incl. hero image/video + **founder photo**)
2. Hero
3. Problem
4. Origin story
5. What it is / solution
6. Mechanism
7. Inside the offer
8. Method
9. Old way vs new way
10. Proof / testimonials
11. Bonuses
12. **Founder letter** (eyebrow, heading, greeting, paragraphs, signoff, photo, P.S.)
13. Pricing, CTA & guarantee
14. FAQ & order bumps

---

## On-page editing (all funnel pages)

### UX (same as optin)

1. Admin opens a funnel preview → floating **Edit page** toolbar
2. Toggle **Editing…** → live copy gets dashed hover outlines
3. **Click any highlighted field** → popup editor (Apply / Cancel)
4. **Save** posts full funnel JSON via `/api/admin/mothermode-sales`
5. On Sales + Upsell: bottom **field sheet** has **Minimize / Expand fields**
   so you can collapse the inspector and hover-edit the page

### How hover edit works without forking MotherMode

- `SalesPageEditProvider` wraps funnel **Sales**, **Upsell**, and **Checkout**
  (checkout needs it for chrome `MmEditable` on timer/brand)
- Section components use optional `MmEditable` (`onDark` for dark urgency bar)
- Catalog `/mothermode/*` never provides the context → `MmEditable` / wordmark edit are no-ops
- Simple pages (optin, VSL, success, access) use `Editable` /
  `EditableList` directly from `inlineEdit.tsx`
- Shared chrome:
  - **Wordmark** (`OptinWordmark`) edits root `footer.brandLine` (short label ≤ 24 chars)
  - **Footer** (`OptinFooter`) edits `footer.brandLine|disclaimer|links.N.*|copyright`
  - `inlineEdit` get/set special-case `footer` / `footer.*`; Save always posts `footer`

### Hover / on-page coverage by step

| Step | On-page hover / edit | Media Studio | Nested arrays |
|------|----------------------|--------------|---------------|
| **Optin** | Headline parts, sub, audience, benefits, badge, magnet, **CTA**, **placeholders**, collectName, privacy | Cover image, hero video | — |
| **Sales** | Hero (**wordmark** → `footer.brandLine`), problem, origin, what-is, mechanism, old/new, method headings, inside headings/lead, founder letter, guarantee, final CTA, bonuses intro/total/closer, pricing eyebrow + tagline, **CTA buttons** (`ctaText`) | Hero image, hero video, founder photo | insideItems, methodSteps, FAQs, proof, bumps, bonusesItems → **Admin** |
| **VSL** | Eyebrow, headline, sub, bullets, CTA, video URL, reveal seconds | Video | sticky/autoplay → Admin |
| **Checkout** | Eyebrow, headline, sub, product name, price label, bullets, **CTA**, **timerLabel** (urgency bar), **brandLabel** (header), priceCents / stripe / productId / paymentType / trialDays | Product image | — |
| **Upsell** | Hook, letter, stack, CTAs, timer, guarantee (+ expanded field sheet) | Image, video, poster | features[], gallery[] → **Admin** |
| **Success** | Headline, sub, summary, CTA, support, secondary note | — | deliveryCards[] → **Admin** |
| **Access** | Headline, sub, welcome video, community, support | Welcome video | onboarding/links → **Admin** |
| **Footer** | **brandLine**, disclaimer, link labels/hrefs, copyright (hover) + Admin Footer tab | — | links[] (add/remove in Admin) |

### Field sheet (Sales + Upsell)

- Fixed bottom panel while **Editing…**
- **Minimize** → thin bar (“hover page text to edit”)
- **Expand fields** → full media triggers + scalar field grid
- Nested multi-row objects stay in Admin step tabs (or AI / Load defaults)

### LIST / PARA field parsing (`inlineEdit.tsx`)

- List fields (newline-split): `benefits`, `bullets`, `features`, `problemPoints`,
  `oldWayItems`, `newWayItems`, `letter`, …
- Paragraph fields (blank-line-split): `originParagraphs`, `whatIsParagraphs`,
  `mechanismParagraphs`, `founderParagraphs`

---

## Multi email kit bindings (events)

Funnels support **per-event email kit enrollment** via `emailKits[]`.

### Events (`SalesEmailEvent`)

| Event | When enrolled |
|-------|----------------|
| `optin` | Lead captured on optin form |
| `checkout_start` | Checkout started |
| `purchase` | Purchase completed |
| `upsell1_yes` / `upsell1_no` | OTO1 accept/decline |
| `upsell2_yes` / `upsell2_no` | OTO2 accept/decline |
| `upsell3_yes` / `upsell3_no` | OTO3 accept/decline |
| `upsell4_yes` / `upsell4_no` | OTO4 accept/decline |
| `success` | Success page |
| `access` | Access page |

### Storage

- Column: `email_kits` JSONB (`[{ event, emailKitId }]`)
- Legacy: `email_kit_id` still synced as the optin kit for back-compat
- Mapper: empty `email_kits` + legacy id → `[{ event: 'optin', emailKitId }]`

### Admin UI

Setup tab shows a kit picker **per event** (all `SALES_EMAIL_EVENTS`).
Save writes both `emailKitId` (optin) and full `emailKits` map.

### Capture API (`POST /api/funnel/capture`)

| Action | Behavior |
|--------|----------|
| default (optin) | Capture lead, honeypot, rate limit, enroll `optin` kit |
| `checkout_start` | Mark lead, increment checkout, enroll `checkout_start` kit |
| `upsell` | Track yes/no, enroll `upsellN_yes` / `upsellN_no` kit |
| `purchase` | Mark purchased, enroll `purchase` kit |

Enrollment uses `resolveEmailKitIdForEvent()` → `enrollLeadInEmailKit()`
(same enrollment store as email marketing kits).

---

## Funnel Media Studio

Shared AI/upload media picker wired into:

| Page | slots |
|------|-------|
| Optin | Cover image, hero video |
| Sales | Hero image, hero video, **founder photo** |
| VSL | Video |
| Checkout | Product image |
| Upsell | Product image, upsell video, video poster |
| Access | Welcome video |

Capabilities:
- AI image generate / edit
- Image upload → Storage
- Video upload → Storage
- Paste YouTube / Vimeo / MP4 URL

---

## Upsells (MotherMode OTO parity)

Each upsell block mirrors `AscensionOffer`:

- Identity / pricing / Stripe
- Timer
- Media gallery + video poster
- Letter paragraphs
- Value stack features
- CTAs yes/no + guarantee

Defaults load from:
1. MotherMode OS
2. OS Annual upgrade
3. Redesign Vault
4. MotherMode Coaching

Public pages reuse production OTO layout (`MotherModeUpsellPage`) with
`upsellContentToAscension()` + hover edit via `SalesPageEditProvider`.

---

## Lead capture & analytics counters

- Honeypot + rate limit on optin
- Lead statuses: `captured` → `checkout_started` → `purchased` / `upsell_skipped`
- Funnel counters: views, conversions, checkout, purchase, upsell yes/no × 4, revenue
- Event log via `recordSalesEvent`

---

## How to use

1. Apply migrations:
   - `20260901000000_mothermode_sales_funnels.sql`
   - `20260902000000_sales_funnel_email_kits.sql`
2. Open `/admin/sales-funnels`
3. **AI build** or **Load MotherMode defaults** (seeds Brain Dump sales + 4 OTOs)
4. Fill Setup: slug, status, offer/product links, **email kits per event**
5. Walk each step tab (Optin → Sales → VSL → Checkout → Upsells → Success → Access → Footer)
6. On Sales tab: set founder letter + founder photo + all long-form sections
7. Save → publish (or keep draft for admin preview)
8. Open preview as admin:
   - **Edit page** → hover/click copy
   - **Minimize** field sheet on Sales/Upsell for full-page editing
   - Media Studio for images/video
9. Optin captures enroll into linked kits; checkout/upsell/purchase events enroll their kits

---

## Congruence checklist (MotherMode sales page)

- [x] Hero (eyebrow / headline / emphasis / suffix / sub / audience / promise)
- [x] Problem (intro / scene / points / cost)
- [x] Origin story
- [x] What is
- [x] Mechanism (label + points)
- [x] Inside items (tag / value / outcome)
- [x] Method steps (meta / shift)
- [x] Old way vs new way
- [x] Proof / testimonials
- [x] Pricing + guarantee
- [x] FAQ
- [x] **Founder letter** (eyebrow, heading, greeting, paragraphs, signoff, P.S.)
- [x] **Founder photo** (media studio + admin field → `media.founderPhoto`)
- [x] Bonuses (eyebrow, items, total value, closer)
- [x] Final CTA
- [x] Order bumps
- [x] Hero image + hero video media slots
- [x] Checkout href override (funnel checkout, not catalog)
- [x] Multi email kit event bindings
- [x] Upsell yes/no + checkout_start + purchase enrollment
- [x] MotherMode catalog pages untouched
- [x] Optin-style hover-to-edit on live Sales + Upsell layouts (`MmEditable`)
- [x] Minimizable field sheet on Sales + Upsell
- [x] CTA labels driven by funnel `ctaText` via `ctaLabel`
- [x] Full editability audit documented (`FUNNEL_EDITABILITY_AUDIT.md`)
- [x] **Checkout chrome** — `timerLabel` + `brandLabel` (types/defaults/normalize + MmEditable + admin Checkout tab)
- [x] **Shared wordmark** — `OptinWordmark` → `footer.brandLine`; Hero uses shared component
- [x] **On-page footer edit** — OptinFooter hover paths + admin Footer seed (`defaultMotherModeSalesFooter`)
- [x] Store upsert/duplicate preserve `footer`; chrome verify script `verify-chrome-final.cjs`

---

## Editability model (summary)

| Layer | Role |
|-------|------|
| **Hover (`MmEditable` / `Editable`)** | Scalar copy on the live page |
| **Field sheet** | Bulk scalars + media triggers; minimizable |
| **Media Studio** | Image/video AI + upload + URL |
| **Admin step tabs** | Full schema including nested arrays |
| **AI / Load defaults** | Seed or regenerate whole blocks |
| **Chrome (root footer + checkout labels)** | Wordmark, footer legal, checkout timer/brand |

### Nested path hover-edit (Sales page)

`getField` / `setField` support dotted paths so list-item copy is hover-editable
on the live page:

| Path pattern | UI |
|--------------|-----|
| `methodSteps.{i}.title\|description\|meta\|shift` | Method steps |
| `mechanismPoints.{i}.title\|description` | Mechanism cards |
| `insideItems.{i}.title\|description\|tag\|value\|outcome` | Inside pack + hero list + pricing stack + side panel |
| `proof.{i}.quote\|name\|role` | Testimonials + content sidebar |
| `faqs.{i}.question\|answer` | FAQ accordions |

Catalog `/mothermode/*` still no-ops (`MmEditable` without provider).

Still admin-primary (add/remove rows, reorder): bumps, upsell features/gallery,
success delivery cards, access onboarding lists.

### Chrome editability (complete)

Funnel chrome is fully editable without touching the MotherMode catalog.

| Surface | Field path | UI |
|---------|------------|-----|
| Checkout urgency bar | block field `timerLabel` | `MmEditable` + `onDark` on dark bar |
| Checkout header brand | block field `brandLabel` | `MmEditable` in sticky header |
| Hero / page wordmark | `footer.brandLine` | Shared `OptinWordmark` (client); short brand |
| Footer brand line | `footer.brandLine` | `OptinFooter` hover |
| Footer disclaimer | `footer.disclaimer` | multiline hover |
| Footer links | `footer.links.{i}.label\|href` | hover; add/remove in Admin |
| Footer copyright | `footer.copyright` | hover |

**Data model**

- `CheckoutContent.timerLabel` / `brandLabel` — types, `normalizeCheckout`, `defaultMotherModeCheckout`
- `SalesFooterContent` (same shape as optin footer) — `defaultMotherModeSalesFooter()`, `normalizeSalesFooter`
- Admin **Checkout** tab: Timer label + Brand label inputs
- Admin **Footer** tab: seeded on new funnel via `useState(defaultMotherModeSalesFooter())`
- Store: upsert normalizes footer; duplicate copies `footer: src.footer`

**Wiring**

- `CheckoutPage` → `SalesPageEditProvider` + passes `timerLabel` / `brandLabel` into `MotherModeCheckout`
- Checkout field sheet includes timer/brand scalars
- `HeroSection` imports `OptinWordmark` (local Wordmark removed)
- Save payload always includes `footer: draft.footer`

Verify: `node scripts/verify-chrome-final.cjs` → ALL PASS.
Detail: `docs/SALES_FUNNEL_CHROME_EDIT_HANDOFF.md`

**Field sheet contrast (post-chrome UX fix)**

Bottom edit sheets must use real form controls — not bare `<Editable>` hover targets — or labels/values wash out on `bg-bone`.

| Rule | Detail |
|------|--------|
| Sheet container | `bg-bone/95 text-ink shadow-2xl backdrop-blur` (explicit `text-ink`) |
| Sheet `Field` helper | `<input>` / `<textarea>` with `bg-white text-ink border-ink/15` |
| Do **not** | Wrap sheet fields in `<Editable>` (that is for on-page hover only) |
| Pages fixed | `SalesPage`, `CheckoutPage`, `UpsellPage`, `VslPage` |
| Script | `scripts/fix-sheet-field-contrast.cjs` |



---

## Still optional next

- Real Stripe Checkout Session charge flow (price IDs already stored)
- Unit tests for sales mappers / capture / emailKits normalize
- Row editors on field sheet for nested arrays (inside/method/FAQ/proof/bumps)
- Media studio on upsell gallery shots
- Success/access event enrollment triggers from page view (types ready; wire if needed)

---

## Reference: optin funnel (unchanged)

| Concern | Optin | Sales funnel |
|---------|-------|--------------|
| Admin | `/admin/funnels` | `/admin/sales-funnels` |
| Public | `/optin/[slug]/**` | `/funnel/[slug]/**` |
| Capture | `/api/optin/capture` | `/api/funnel/capture` |
| Email kits | single + events (optin model) | multi `emailKits` per sales event |
| Layout brand | Editorial Warm | Editorial Warm + full MotherMode sales/OTO components |
| On-page edit | `Editable` + toolbar | Same + `MmEditable` on MotherMode sections + minimizable sheet + **chrome** (wordmark / footer / checkout timer+brand) |

---

## Related: Email kit autobuild

Per-event email kits for a sales funnel are generated and bound by the autobuild system —
see `docs/SALES_FUNNEL_EMAIL_AUTOBUILD_SYSTEM_PORT.md`
(`src/lib/mothermode/sales/emailPlan.ts`, `emailAutobuild.ts`,
`/api/mothermode/sales-email-kits`, and the `EmailKitAutobuildPanel` mounted in
`SalesFunnelEditor`'s "Email kits by funnel event" block).

## 2026-07-25 — Visual direction: the brief finally has a writer

**What shipped**

`SalesAiIntake` gained six flat art-direction fields — `visualSubject`,
`visualPalette`, `visualStyleKeywords`, `visualLighting`, `visualComposition`,
`visualAvoid` — and `funnelBriefFromIntake` now maps them onto
`FunnelBrief.visual`. Before this, nothing in `src/` wrote a single `visual.*`
field: the mapper spread `blankFunnelBrief()` and set only identity, audience,
promise, voice and offer. Every funnel's 16 image slots therefore rendered the
neutral fallback and `assumedVisualFields` returned all five names. The slots
agreed with each other; they did not agree with any brand.

Flat string fields, not a nested block, on purpose: the intake already stores
flat `upsell1Name`/`upsell1Price` pairs, the admin setter is
`setIntakeField(key, value)` keyed on `keyof SalesAiIntake`, and the AI-fill
merge copies an allowlist of scalar keys. A nested object would have needed all
three changed; flat fields ride plumbing that already exists and is already
tested. The list-ish fields are comma separated and split in exactly one place,
`splitVisualList`.


**Porting notes**

- Schema: none required. The six fields live inside the existing `ai_intake`
  JSON column on the sales funnel row; `normalizeSalesAiIntake` defaults them to
  `''`, so older rows load unchanged.
- Files touched: `src/lib/mothermode/sales/aiIntake.ts` (fields, blank,
  normalize, `splitVisualList`, `missingIntakeVisualFields`,
  `formatIntakeVisualForPrompt`), `src/lib/mothermode/sales/funnelBrief.ts`
  (the mapping), `src/utils/integrations/openai-sales.ts` (fill schema,
  guidance, allowlist, two prompt blocks),
  `src/app/admin/sales-funnels/parts/OfferTab.tsx` (six inputs plus the
  pre-flight warning), `tests/lib/sales-visual-direction.test.ts` (new).
- Applied by `scripts/wire-visual-direction.cjs`, which asserts each anchor
  matches exactly once, is idempotent, and preserves each file's existing line
  endings.
