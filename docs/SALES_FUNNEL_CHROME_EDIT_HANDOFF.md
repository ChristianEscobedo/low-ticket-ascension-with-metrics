# Sales Funnel Chrome Editability — COMPLETE

> **Status: COMPLETE** — chrome editability wired and verified (`node scripts/verify-chrome-final.cjs` → ALL PASS). `blankCheckout()` includes `timerLabel` + `brandLabel`.

**Status:** Done (verified 2026-07-24)  
**Scope:** Funnel chrome only (header wordmark, checkout timer/brand, shared footer).  
**Do not touch:** MotherMode catalog funnel (`/mothermode/*`).

---

## Definition of done (all met)

| Item | Status | Evidence |
|------|--------|----------|
| Checkout timer label editable | ✅ | `MotherModeCheckout` `MmEditable field="timerLabel" onDark` + admin Checkout tab |
| Checkout brand label editable | ✅ | `MotherModeCheckout` `MmEditable field="brandLabel"` + admin Checkout tab |
| Types + normalize + defaults | ✅ | `CheckoutContent.timerLabel` / `brandLabel` in types, normalize, defaults |
| CheckoutPage wires props | ✅ | `timerLabel={c.timerLabel…}` / `brandLabel={c.brandLabel…}` + sheet fields |
| Shared wordmark editable | ✅ | `OptinWordmark` client component → `footer.brandLine` via `useSalesPageEdit` |
| Hero uses shared wordmark | ✅ | `HeroSection` imports `OptinWordmark` (no local Wordmark) |
| Footer root paths | ✅ | `inlineEdit` get/set `footer.*`; save posts `footer: draft.footer` |
| OptinFooter hover-edit | ✅ | `footer.brandLine`, disclaimer, links, copyright |
| Admin footer seed | ✅ | `useState(defaultMotherModeSalesFooter())` + Footer tab |
| Store upsert/duplicate footer | ✅ | `normalizeSalesFooter` on upsert; `footer: src.footer` on duplicate |

Verify anytime: `node scripts/verify-chrome-final.cjs` → **ALL PASS**

---

## System map (unchanged)

### Public routes (`/funnel/[slug]/…`)
| Path | Component |
|------|-----------|
| `/` (optin) | `SalesOptinPage` |
| `/vsl` | `VslPage` |
| `/sales` | `SalesPage` → layout parts |
| `/checkout` | `CheckoutPage` → `MotherModeCheckout` |
| `/upsell` … `/upsell-4` | `UpsellPage` |
| `/success` | `SuccessPage` |
| `/access` | `AccessPage` |

### Admin
- `/admin/sales-funnels` → `SalesFunnelEditor`
- Tabs include **Checkout** (`timerLabel`, `brandLabel`) and **Footer**

### APIs
- `POST /api/admin/mothermode-sales` — save/duplicate/delete
- `POST /api/funnel/capture` — lead capture

### Key files
```
src/lib/mothermode/sales/types.ts          # CheckoutContent + SalesFooterContent
src/lib/mothermode/sales/defaults.ts       # defaultMotherModeCheckout + SalesFooter
src/lib/mothermode/sales/store.ts          # upsert/duplicate include footer
src/lib/mothermode/sales/inlineEdit.tsx    # footer.* path get/set + save payload
src/components/mothermode/sales/SalesPageEditContext.tsx  # MmEditable (+ onDark)
src/components/mothermode/checkout/MotherModeCheckout.tsx # timer + brand MmEditable
src/components/mothermode/sales/CheckoutPage.tsx          # props + provider + footer
src/components/mothermode/optin/Wordmark.tsx               # shared editable wordmark
src/components/mothermode/optin/OptinFooter.tsx            # footer.* hover edit
src/components/mothermode/parts/HeroSection.tsx            # OptinWordmark
src/app/admin/sales-funnels/SalesFunnelEditor.tsx          # Checkout + Footer tabs
```

---

## How chrome editing works

1. **Page block fields** (e.g. `timerLabel`, `brandLabel`)  
   - Live on the active block (`checkout`, `sales`, …).  
   - `MmEditable` / `Editable` → `openEdit` → `setField` → Save posts full funnel.

2. **Root footer fields** (`footer.brandLine`, `footer.disclaimer`, `footer.links.N.*`, `footer.copyright`)  
   - `inlineEdit.getField` / `setField` special-case `footer` / `footer.*` via `setPathValue`.  
   - Wordmark + OptinFooter both write these paths.  
   - Save always includes `footer: draft.footer`.

3. **Catalog safety**  
   - No `SalesPageEditProvider` on `/mothermode/*` → `MmEditable` / wordmark edit chrome are no-ops.

---

## Manual QA checklist

1. Admin → Sales Funnels → open a funnel → **Checkout** tab: edit Timer label + Brand label → Save.  
2. Open `/funnel/{slug}/checkout` as admin → **Edit page** → hover timer bar + header brand → Apply → Save. Reload: values stick.  
3. On sales/optin/checkout: hover wordmark → edit brand → Save. Footer brand line + wordmark stay in sync (wordmark uses short `footer.brandLine` ≤ 24 chars).  
4. Footer: edit disclaimer / link labels / copyright inline → Save.  
5. New funnel in admin: Footer tab already seeded (enabled, MotherMode brand, Privacy/Terms/Contact, copyright year).  
6. Catalog `/mothermode/*`: no edit outlines, static MotherMode wordmark.

---

## Scripts (historical / verify)

| Script | Role |
|--------|------|
| `scripts/verify-chrome-final.cjs` | **Use this** — structural ALL PASS |
| `scripts/wire-header-edit.cjs` | Applied earlier (wordmark + hero) |
| `scripts/wire-footer-edit.cjs` | Applied earlier (OptinFooter paths) |
| `scripts/wire-chrome-edit.cjs` / `apply-chrome-edit.cjs` / `finish-chrome-edit.cjs` | One-shot patchers; already reflected in source |

---

## Out of scope / next work (not chrome)

- MotherMode catalog funnel copy  
- Payment / Stripe behavior  
- New funnel page types  
- Email kit / enrollment changes  

Core sales funnel builder + chrome editability are complete.


### Post-verify fix
- `blankCheckout()` in `types.ts` returns `timerLabel` + `brandLabel` (empty strings) so `CheckoutContent` is complete.
- Port doc updated: `docs/SALES_FUNNEL_SYSTEM_PORT.md` — chrome section + checklist.
- Verify: `node scripts/verify-chrome-final.cjs` → ALL PASS.


### Field sheet contrast (UX fix)

**Problem:** Sheet `Field` helpers used bare `<Editable>` (on-page hover chrome). On `bg-bone` sheets, text washed out / looked unreadable.

**Fix:**
- `Field` on `SalesPage`, `CheckoutPage`, `UpsellPage`, `VslPage` → real `<input>` / `<textarea>` with `bg-white text-ink`
- Sheet shell: `bg-bone/95 text-ink` so labels never inherit light page color
- Script: `scripts/fix-sheet-field-contrast.cjs`

**Rule for future pages:** on-page hover = `<Editable>` / `<MmEditable>`; bottom sheet scalars = native inputs with dark-on-light classes.
