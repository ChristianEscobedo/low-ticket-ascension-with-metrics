
Date: 2026-07-24  
Status: audited + high-impact gaps fixed; nested structures remain admin-primary

## Method

Compared each content-block field in `src/lib/mothermode/sales/types.ts` against:

1. On-page `Editable` / `MmEditable` / field-sheet refs
2. Admin editor mentions in `SalesFunnelEditor.tsx`
3. Hardcoded copy in MotherMode section components

Script: `scripts/audit-funnel-editability.cjs`  
Raw output: `scripts/funnel-editability-audit.txt`

---

## Page-by-page status

### Optin (`SalesOptinPage`) — strong

| Area | Status |
|------|--------|
| Headline / emphasis / suffix / sub / audience | On-page hover |
| Benefits list | On-page list editor |
| Badge, magnet title/description | On-page |
| CTA text | On-page (fixed this pass) |
| Name/email placeholders + collectName | On-page edit mode (fixed this pass) |
| Cover image / hero video | Media Studio |
| Privacy note | On-page |
| Footer | Rendered; edit via Admin Footer tab |

### Sales (`SalesPage` + MotherMode layout) — strong for copy

| Area | Status |
|------|--------|
| Hero, problem, origin, what-is, mechanism | Hover `MmEditable` |
| Old/new, method headings, inside headings/lead | Hover |
| Founder letter, guarantee, final CTA, bonuses intro | Hover |
| Pricing eyebrow (`priceDescription`) + tagline | Hover (fixed this pass) |
| CTA buttons (`ctaText` via CheckoutButton) | Hover (fixed this pass) |
| Media (hero image/video, founder photo) | Media Studio |
| Field sheet | Expandable/minimizable; many scalar fields |
| Nested: insideItems, methodSteps, faqs, proof, bumps, bonusesItems | **Admin Sales tab** (structured JSON) |

### VSL (`VslPage`) — strong

| Area | Status |
|------|--------|
| Eyebrow, headline, sub, bullets, CTA, video URL | On-page |
| CTA href + reveal seconds | Field sheet |
| Sticky / autoplay | Admin VSL tab |

### Checkout (`CheckoutPage`) — strong

| Area | Status |
|------|--------|
| Eyebrow, headline, sub, product name, price label, bullets | On-page |
| CTA text | On-page (fixed this pass) |
| Product image | Media Studio |
| priceCents, stripePriceId, productId, paymentType, trialDays | On-page edit mode (fixed this pass) |

### Upsell 1–4 (`UpsellPage` + MotherMode OTO) — strong

| Area | Status |
|------|--------|
| Hook (eyebrow/headline/emphasis/suffix/sub), letter, stack headings | Hover |
| Features title/description/value | Hover nested paths |
| Prices, CTAs, timer, guarantee, big idea | Hover |
| Gallery eyebrow + captions | Hover; empty gallery shows 3 placeholder slots in edit mode |
| Gallery shot images | Media Studio via MediaFrame (`gallery.N.src`) |
| Field sheet: letter, features rows, gallery captions/alts, media triggers | Expandable sheet |
| Media image/video/poster + gallery shots 1–3 | Media Studio |
| Full structured features/gallery/letter | **Admin Upsell tab** (expanded) |


### Success (`SuccessPage`) — strong

| Area | Status |
|------|--------|
| Headline, sub, purchase summary, inbox note, section headings | On-page hover |
| Next step (eyebrow/heading/body), CTA text + href, support, secondary note | On-page |
| deliveryCards[] title/description/href/icon | On-page nested path edit |
| Admin Success tab | Still available for bulk paste |

### Access (`AccessPage`) — strong

| Area | Status |
|------|--------|
| Badge, headline, sub, onboarding headings, library headings | On-page hover |
| Welcome video | Media Studio |
| Community + support blocks | On-page |
| onboardingItems[] title/description/href | On-page nested path edit |
| deliveryLinks[] label/description/href | On-page nested path edit |
| Admin Access tab | Still available for bulk paste |

### Footer (`SalesFooterContent`) — admin

| Area | Status |
|------|--------|
| brandLine, disclaimer, links, copyright, enabled | **Admin Footer tab** |
| Rendered on optin/vsl/checkout/success/access | Yes |

---

## Fixes applied this pass

1. Optin: CTA + placeholders + collectName editable in edit mode  
2. Checkout: CTA + Stripe/price/product/trial fields in edit mode  
3. Pricing section: hardcoded headings → `MmEditable` (`priceDescription`, `tagline`)  
4. CheckoutButton: label wraps `MmEditable field="ctaText"`  
5. Hero / Pricing / Final CTA: use funnel `ctaText` via `ctaLabel` on synthetic offer  
6. `salesContentToOffer` maps `ctaLabel` + `pricingEyebrow` from funnel JSON  

Typecheck: clean.

---

## Remaining by design (admin / structured)

These are multi-row objects. Most now support on-page nested path edit; Admin remains the bulk editor:

- Sales: `insideItems`, `methodSteps`, `mechanismPoints`, `faqs`, `proof`/`testimonials`, `bonusesItems`, `bumps` (on-page path edit + Admin)
- Upsell: `features[]`, `gallery[]` (on-page + Admin)
- Success: `deliveryCards[]` (on-page nested path edit + Admin)
- Access: `onboardingItems[]`, `deliveryLinks[]` (on-page nested path edit + Admin)
- Footer: all fields (shared chrome — Admin Footer tab)

Optional next: add/remove row controls on-page (currently edit existing rows; empty placeholder row appears in edit mode when list is empty).

---

## How to re-run the audit

```bash
node scripts/audit-funnel-editability.cjs
```
