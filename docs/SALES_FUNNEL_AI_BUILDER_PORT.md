# Sales Funnel AI Builder — System Port (Offer Stack, Per-Page Regen, Bulk Images)

Scope: the **admin sales-funnel builder** at `/admin/sales-funnels`
(`src/app/admin/sales-funnels/SalesFunnelEditor.tsx`). The MotherMode catalog
funnel is untouched.

---

## 1. Offer stack (Phase 1) — DONE

**Types / helpers:** `src/lib/mothermode/sales/aiIntake.ts`
- `SalesOfferStack` = `{ frontEnd, bumps[], upsells[], bonuses[] }`, each item
  `{ name, price, promise, ... }`.
- `emptyOfferStack()` / `normalizeOfferStack()` keep stored JSON safe and
  backwards compatible (missing keys fill from defaults, prices coerce to
  numbers, arrays clamp to the supported slot count).
- Covered by `tests/lib/sales-offer-stack.test.ts` (10 tests, passing).

**AI intake:** `src/utils/integrations/openai-sales.ts` +
`src/app/api/mothermode/sales-ai/route.ts`
- `fillIntake` returns the brief **and** a fully populated offer stack
  (front end, order bumps, upsell ladder, bonus stack) from a short prompt.
- `generate` consumes the stack so bumps/bonuses/upsell prices flow into every
  generated page rather than being re-invented per page.

**Admin UI:** Build tab has a stack editor (add/remove/reorder rows, price and
promise inputs) directly above the generate actions. Order:
`1. AI fill brief → 2. Generate full funnel → 3. Generate missing images`.

## 2. Per-page regeneration (Phase 2) — DONE

- API action `regeneratePage` (`/api/mothermode/sales-ai`) takes the funnel
  brief + offer stack + a `page` key and returns only that page's payload.
- Every page tab (optin, sales, VSL, checkout, upsell 1–4, success, access)
  has a **Regenerate this page** button in its tab bar, sharing the
  `busy === 'generatePage'` lock so no two AI writes can overlap.
- Theme + upsell fields are included in the regen payload so a regenerated page
  stays visually consistent with the rest of the funnel.

## 3. Bulk image generation (Phase 3) — DONE

Applied by `scripts/patch-bulk-images.cjs` (idempotent; safe to re-run).

- New Build-tab action **“3. Generate missing images”**
  (`busy === 'generateImages'`).
- `onGenerateImages()` builds a brand-consistent base prompt from the offer
  stack + intake (`niche`, `audience`, warm dark / brass + bone palette, no
  text) and fills **only empty** slots:

  | Slot | Field |
  | --- | --- |
  | Optin cover | `optin.coverImageUrl` |
  | Sales hero | `sales.heroImageUrl` |
  | Founder photo | `sales.founderPhotoUrl` |
  | Checkout product | `checkout.productImageUrl` |
  | Upsell 1–4 product | `upsellN.imageUrl` |

- Uses the existing content-hub image pipeline
  (`aiGenerateImage` → `/api/mothermode/ai`, hosted Storage URL with data-URL
  fallback), so no new integration surface.
- Sequential loop with live progress notices (`Generated 2/5…`), per-slot
  failure collection, and a final notice reminding the admin to **Save** to
  persist. Slots that already have a URL are skipped — clear the URL to
  regenerate.

**Verification:** `npx tsc --noEmit` clean; `npx vitest run
tests/lib/sales-offer-stack.test.ts` → 10/10 passing.

---

## 4. Remaining: lead magnet picker + create-and-link optin (Phase 4)

Not started. Intended shape:

1. In the Build tab, next to the optin fields, add a **Lead magnet** picker that
   lists existing lead-gen kits (`/api/admin/mothermode-leadgen`) plus a
   "Create new" option.
2. On selection, copy the magnet's title/promise/cover into
   `optin.magnetTitle` / `optin.magnetPromise` / `optin.coverImageUrl`, and
   store the kit id on the funnel record so the link survives saves.
3. "Create new" should call the lead-gen AI generate action with the funnel's
   brief + offer stack, save the kit, then link it as above.
4. Keep the standalone optin funnel builder (`/admin/funnels`) as the source of
   truth for hosted optin pages; the sales funnel should only *reference* a
   magnet, never fork its copy.

Do this with a small idempotent `scripts/patch-*.cjs` patch (same pattern as
`patch-bulk-images.cjs`), then re-run `npx tsc --noEmit` and the sales tests.

### Windows / PowerShell notes
- Run patches with `node scripts/<name>.cjs` from the repo root.
- Pipe long output through `Select-Object -First/-Last N`, not `more`
  (`more` blocks the terminal waiting for input).


## Lead magnet linking (Phase 4)

**Where:** `src/app/admin/sales-funnels/SalesFunnelEditor.tsx` → Build tab, directly under the
1/2/3 build bar ("Fill brief" → "Generate funnel" → "Generate missing images").

**Two paths, one source of truth**

1. **Link existing** — the picker lists every lead-gen kit from
   `GET /api/admin/mothermode-leadgen` (flattened to `{ id, slug, name, status, title, subtitle }`
   by `magnetOptionFromRow`). Selecting one calls `applyLeadMagnet`.
2. **AI create + link** — `onCreateLeadMagnet` maps the funnel brief into a `LeadGenIntake`
   (topic/audience/goal/transformation/tone/cta/offerSlug/notes), calls
   `POST /api/mothermode/leadgen-ai { action: 'generate', format: 'guide' }`, saves the result via
   `POST /api/admin/mothermode-leadgen { action: 'save' }`, then links it.

**What linking writes** (`applyLeadMagnet`):

- `leadGenSlug` (funnel field, persisted on save)
- `intake.leadGenSlug`, `intake.magnetName`, `intake.magnetPromise`
- `optin.magnetTitle`, `optin.magnetDescription`

The kit itself is never copied into the funnel — only its slug and headline identity. Edit the
magnet's content in **Admin → Lead Gen**; the funnel keeps pointing at the same slug.

**Sync behavior:** a `useEffect` on `[leadGenSlug, leadMagnets]` re-selects the picker when an
existing funnel is loaded, so the dropdown reflects the saved link instead of resetting to "none".

**Notes**

- Kit list load failures are non-fatal (the picker just stays empty); AI/save failures surface in
  the editor's error banner.
- New kits are saved as `status: 'draft'` with slug `slugifySalesName(magnetName)`.
- Applied by `scripts/patch-leadmagnet-link.cjs` (idempotent).

## FunnelBrief module (Task B, step 1)

**Status: landed but unwired.** `src/lib/mothermode/sales/funnelBrief.ts` exists
and `tsc --noEmit` exits 0, but nothing imports it and it is deliberately *not*
re-exported from `src/lib/mothermode/sales/index.ts`. It changes no behavior yet.

The brief is the single upstream source of truth that per-page copy, image
prompts and scripts are all meant to read from, so that the six identity fields
(`brandLine`, `conversionLine`, `generationalLine`, `categoryLine`,
`founderName`, `founderRole`) plus `footer.brandLine`/`footer.disclaimer` stop
drifting per page.

| Export | Purpose |
| --- | --- |
| `FunnelBrief` + 6 sub-interfaces | identity / audience / promise / voice / visual / offer |
| `blankFunnelBrief()` | all-empty brief, `version: 1`, `source: 'derived'` |
| `normalizeFunnelBrief(raw)` | unknown → `FunnelBrief`, defensive, mirrors `normalizeSalesFooter` |
| `funnelBriefOfferFromStack(stack)` | denormalizes `OfferStack`; enabled upsells only, sorted by `slot` |
| `funnelBriefFromIntake(intake, opts)` | derives only what `SalesAiIntake` actually knows |
| `formatFunnelBriefForPrompt(brief)` | prompt block; omits empty fields |
| `funnelBriefGaps(brief)` / `isFunnelBriefComplete(brief)` | dotted paths of what is still empty |

### Field provenance

Verified against the real files, not inferred from field names:

- `SalesAiIntake` (`sales/aiIntake.ts`): `niche`, `audience`, `pain`,
  `magnetName`, `magnetPromise`, `leadGenSlug`, `offerName`, `offerPrice`,
  `upsell1..4`, `toneNotes`, `offerStack`.
- `OfferStack`: `frontEnd { name, price, originalPrice, promise, deliverables[] }`,
  `bonuses[]`, `bumps[]`, `upsells[]` (each `slot`, `enabled`, `name`).

The intake carries **no** brand identity. `identity` therefore derives empty and
`funnelBriefFromIntake` takes `brandName` as an explicit opt rather than
inventing one — an invented-but-plausible founder name is the exact failure
`scripts/audit-ai-fill-coverage.cjs` exists to catch.

### Decisions

1. Empty fields are **omitted** from the prompt rather than rendered as
   `(not set)`. A model shown `founderName: (not set)` will fill it in.
2. `funnelBriefGaps` returns dotted paths, so completeness is machine-assertable
   by the coverage audit instead of eyeballed.

### Remaining

- No unit test. `tests/lib/sales-offer-stack.test.ts` is the pattern; cover
  `funnelBriefOfferFromStack` upsell filter/sort and `normalizeFunnelBrief` on
  garbage input.
- Persist (`brief jsonb` + migration + `sales/store.ts` mapper + admin write
  path), then a gap-filling `brief` AI mode, then consume in the per-page
  prompts. Ordered detail in `docs/FUNNEL_BRIEF_HANDOFF.md`.
