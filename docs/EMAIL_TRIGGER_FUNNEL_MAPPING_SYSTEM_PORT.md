# Email Trigger → Funnel/Content Mapping — System Port

Status: **shipped & verified** — `tsc --noEmit` reports 0 errors; the email
suites pass (`email-flow` + `email-kit` + `email-preview` + `email-analytics` +
`email-triggers` = **65 passing across 5 files**).

This document is the full port record for the work that extends the Phase‑2
enrollment **trigger** enum so every trigger now knows *where* it fires — a
concrete funnel **page/event** or a content **lifecycle stage**. It is the
groundwork the scoped `EMAIL_FUNNEL_EVENT_ASSIGNMENT_HANDOFF.md` calls for,
delivered as a pure, back‑compat data layer plus UI surfacing, with no schema
changes and no dispatch/webhook wiring (that remains future work).

---

## 1. Why

Phase 2 gave a sequence a single `EmailTriggerEvent` (`optin | purchase |
abandon | refund | tag_added`) — enough to render a "Trigger" node and picker,
but the label alone (`"Purchase"`) never told the admin *where* in the funnel
the enrollment happens, and gave downstream ESP/GHL export nothing concrete to
bind a workflow to.

This port makes the trigger enum **self‑describing**:

- Each trigger belongs to a **category** — `funnel` (a page / purchase event) or
  `content` (something happened to a content piece).
- Each **funnel** trigger maps to a concrete **funnel page** (opt‑in, sales,
  checkout, upsell, thank‑you, booking, or "any").
- Each **content** trigger maps to a **content lifecycle stage** that lines up
  1:1 with the content hub review states (generated → approved → scheduled →
  published, or rejected).

The flow canvas and the editor now explain, in plain language, exactly which
page/event or content action drops a subscriber into the sequence.

---

## 2. Design constraints honored

- **Zero schema changes.** The label/category/location info is *derived* from
  the enum at render time via lookup tables — nothing new is persisted for it.
  The one new persisted value, the optional `triggerConfig` mapping (§5.1),
  rides **inside the existing JSONB sequence blob**, so no table/column changes
  are needed.

- **Fully back‑compat.** The enum is purely additive: the original five Phase‑2
  values keep their meaning and position, and the normalizer still coerces any
  unknown/legacy/null value to `optin`. Existing kits render unchanged.
- **Single source of truth.** Everything lives in
  `src/lib/mothermode/email/triggers.ts` and is re‑exported through the email
  barrel (`src/lib/mothermode/email/index.ts`), so the canvas, editor, and any
  future exporter/dispatch agree on the same values.
- **Pure + defensive.** JSONB is untyped at the DB boundary, so every public
  helper tolerates `unknown` input and never throws.

---

## 3. Files touched

| File | Change |
|------|--------|
| `src/lib/mothermode/email/triggers.ts` | Extended enum + categories, funnel‑page and content‑stage taxonomies, per‑trigger `EmailTriggerMeta`, derived label/description maps, grouping/location helpers, **plus the `EmailTriggerConfig` mapping type and `EMAIL_FUNNEL_PAGE_LABELS` map** used by the cascading selectors. |
| `src/lib/mothermode/email/index.ts` | Already re‑exports `./triggers` (`export *`) — no change needed; new symbols flow through automatically. |
| `src/components/mothermode/email/EmailFlowPanel.tsx` | Trigger node picker renders grouped `<optgroup>`s by category, a "fires at" location chip, **and — when editable — the cascading mapping selectors** (page → offer, or content asset, plus an optional note) via the new `onChangeTriggerConfig` / `offerOptions` / `contentOptions` props. Read‑only mode unchanged. |
| `src/app/admin/email-marketing/EmailKitEditor.tsx` | "Enrollment trigger" picker grouped by category; helper line shows the `Fires: <page/stage>` chip; **new "Trigger mapping (optional)" block of cascading `<select>`s** backed by `patchTriggerConfig`, and it feeds `offerOptions`/`contentOptions`/`onChangeTriggerConfig` down to the flow canvas. |
| `tests/lib/email-triggers.test.ts` | New unit suite covering metadata integrity, normalizer, location labels, and grouping. |


---

## 4. The data model (`triggers.ts`)

### Categories
```ts
export const EMAIL_TRIGGER_CATEGORIES = ['funnel', 'content'] as const;
export type EmailTriggerCategory = (typeof EMAIL_TRIGGER_CATEGORIES)[number];
```

### Funnel pages (WHERE a funnel event fires)
`optin-page`, `sales-page`, `checkout-page`, `upsell-page`, `thank-you-page`,
`booking-page`, `any`. `any` covers events not tied to a page (a tag applied in
the ESP, a refund processed by the payment processor). Each maps cleanly onto a
GHL/ClickFunnels‑style page in a standard low‑ticket funnel.

### Content lifecycle stages (WHICH content action fires a content trigger)
`generated`, `approved`, `scheduled`, `published`, `rejected` — aligned with the
content hub review/approval flow (`content/review.ts`).

### Trigger events
Order matters (declaration order drives picker order). The first block is
funnel, the second is content:

```
FUNNEL:  optin · page_view · sales_page_view · checkout_start · abandon ·
         purchase · upsell_purchase · booking · refund · tag_added
CONTENT: content_generated · content_approved · content_scheduled ·
         content_published · content_rejected
```

The original Phase‑2 five (`optin`, `abandon`, `purchase`, `refund`,
`tag_added`) are all retained. `DEFAULT_EMAIL_TRIGGER = 'optin'`.

### Per‑trigger metadata
```ts
export interface EmailTriggerMeta {
  label: string;
  description: string;
  category: EmailTriggerCategory;
  funnelPage?: EmailFunnelPage;    // set on funnel triggers
  contentStage?: EmailContentStage; // set on content triggers
}
```
Exactly one of `funnelPage` / `contentStage` is set per trigger. The
`EMAIL_TRIGGER_LABELS` and `EMAIL_TRIGGER_DESCRIPTIONS` maps are *derived* from
`EMAIL_TRIGGER_META` via `Object.fromEntries`, so labels can never drift from
their metadata.

### Helpers (all tolerate `unknown`)
- `toEmailTriggerEvent(value)` → normalizer, coerces unknowns to `optin`.
- `emailTriggerLabel(value)` / `emailTriggerMeta(value)` / `emailTriggerCategory(value)`.
- `emailTriggerLocationLabel(value)` → the funnel‑page label for funnel triggers,
  or the content‑stage label for content triggers (the "fires at" chip).
- `emailTriggerEventsByCategory(category)` → events for one category, in order.
- `emailTriggerGroups()` → `[{ category, label, events }]`, ready to render as
  `<optgroup>`s.

---

## 5. UI surfacing

**EmailKitEditor — "Enrollment trigger" picker.** The `<select>` maps
`emailTriggerGroups()` to `<optgroup label>` blocks (Funnel & purchase events /
Content events). Below it a helper line shows a brass chip
`Fires: {emailTriggerLocationLabel(sequence.trigger)}` next to the trigger's
description.

**EmailFlowPanel — trigger node.** When the editor passes `onChangeTrigger`, the
canvas trigger node becomes the same grouped picker inline, plus a compact chip
showing the location label and the description. In read‑only mode (no
`onChangeTrigger`), it renders the label/"Subscribers enter here" as before.

### 5.1 Editable trigger mapping — the cascading (waterfall) selectors

The label answers *what* fires the sequence; the **mapping** answers *which
concrete thing* — which funnel page, which offer, which content asset. This is
an **optional, editable** refinement layered on top of the derived label, stored
as one small object on the sequence.

**Persisted shape (`EmailTriggerConfig`, in `triggers.ts`):**
```ts
export interface EmailTriggerConfig {
  funnelPage?: EmailFunnelPage; // override the derived page (funnel triggers)
  offerSlug?: string;           // the offer whose page/purchase fires it
  contentRef?: string;          // the content asset (content triggers)
  note?: string;                // free-text admin note
}
```
It lives on `EmailSequence.triggerConfig?` — **inside the existing JSONB
sequence blob**, so "zero schema changes" still holds (nothing new is added to
any table; it rides along the column the sequence already persists to). Every
field is optional, so legacy sequences with no `triggerConfig` are valid and
render exactly as before.

**Defensive normalizer.** `normalizeTriggerConfig(value: unknown)` coerces
arbitrary JSONB into a clean `EmailTriggerConfig` (trimming strings, dropping
empties) or returns `undefined` when the config is absent/empty — it tolerates
any shape and never throws, matching the rest of the module's DB‑boundary
discipline.

**Resolution helpers.** The label/location helpers now take the config as a
second argument so a stored override wins over the derived default:
`resolveTriggerFunnelPage(trigger, config)` and
`resolveTriggerLocationLabel(trigger, config)` fall back to
`emailTriggerMeta(trigger).funnelPage`/`emailTriggerLocationLabel(trigger)` when
the config is empty.

**The waterfall (why "cascading").** The selectors reveal progressively and the
relevant column depends on the trigger's **category**:

- **Funnel triggers →** *page* select (`EMAIL_FUNNEL_PAGE_LABELS`) → *offer*
  select (`offerSlug`). Pick the page the event lives on, then bind the specific
  offer whose page/checkout fires it.
- **Content triggers →** *content asset* select (`contentRef`). The page/offer
  columns are hidden; a content trigger fires off a content piece, not a page.
- **Both categories →** an optional free‑text **note**.

**Editor state — `patchTriggerConfig`.** The editor owns a single merge‑and‑prune
reducer so the stored object never accumulates empty keys:
```ts
function patchTriggerConfig(patch: Partial<EmailTriggerConfig>) {
  setSequence((prev) => {
    const tc: EmailTriggerConfig = { ...(prev.triggerConfig ?? {}), ...patch };
    (Object.keys(tc) as (keyof EmailTriggerConfig)[]).forEach((k) => {
      if (!tc[k]) delete tc[k]; // clearing a select removes the key entirely
    });
    return { ...prev, triggerConfig: Object.keys(tc).length ? tc : undefined };
  });
}
```
Selecting the empty `<option value="">` clears that dimension; when every field
is cleared the whole `triggerConfig` collapses back to `undefined`, so a fully
default mapping is indistinguishable from a legacy sequence.

**Option sources.** The editor derives both option lists from the same
`sources` array the context bridge already builds, so the dropdowns stay in sync
with whatever offers/content the kit is wired to — no separate fetch:
```tsx
offerOptions={sources
  .filter((s) => s.kind === 'offer' || s.kind === 'offer-bonuses')
  .map((s) => ({ id: s.id, label: s.label }))}
contentOptions={sources
  .filter((s) => s.kind !== 'link' && s.kind !== 'text')
  .map((s) => ({ id: s.id, label: s.label }))}
onChangeTriggerConfig={patchTriggerConfig}
```

**Flow‑canvas parity (`EmailFlowPanel`).** The same waterfall renders inline on
the trigger node, driven by three new optional props:

| Prop | Type | Role |
|------|------|------|
| `offerOptions` | `{ id: string; label: string }[]` | funnel → offer waterfall |
| `contentOptions` | `{ id: string; label: string }[]` | content‑trigger waterfall |
| `onChangeTriggerConfig` | `(patch: Partial<EmailTriggerConfig>) => void` | write‑back |

Crucially these are **only** rendered when `onChangeTriggerConfig` is supplied,
so the read‑only canvas (used anywhere the panel is shown without an editor) is
completely unaffected — same back‑compat guard the `onChangeTrigger` picker uses.

---

## 6. Tests (`tests/lib/email-triggers.test.ts`)


- **Metadata integrity** — every event has a non‑empty label/description and a
  valid category; funnel triggers carry a `funnelPage` (and no `contentStage`),
  content triggers carry a `contentStage` (and no `funnelPage`).
- **Label/description sync** — the derived maps match `EMAIL_TRIGGER_META`.
- **Normalizer** — `undefined`/`null`/garbage/number → `optin`; known values
  pass through; label/meta/category helpers tolerate unknown input.
- **Location labels** — funnel triggers return page labels ("Checkout page",
  "Opt-in page", "Booking / calendar page"); content triggers return stage
  labels ("Content published", "Content rejected").
- **Grouping** — categories partition the enum with no overlap and full
  coverage; `emailTriggerGroups()` yields one non‑empty group per category in
  declaration order.

---

## 7. What is intentionally NOT in this port

Per the funnel‑event‑assignment handoff, the *dispatch* side is out of scope:

- No `mothermode_email_funnel_bindings` table / store / API route.
- No Stripe‑webhook or opt‑in‑handler hook that enrolls recipients.
- No scheduler / `sendOffset` honoring at send time.

This port delivers only the shared, self‑describing trigger vocabulary and its
UI surfacing. When the dispatch work is built, `emailTriggerMeta(...).funnelPage`
gives each binding a concrete page‑event to bind a GHL/ESP workflow to without
re‑deriving anything.

---

## 8. Verify

```
npx tsc --noEmit
npx vitest run tests/lib/email-flow.test.ts tests/lib/email-kit.test.ts \
  tests/lib/email-preview.test.ts tests/lib/email-analytics.test.ts \
  tests/lib/email-triggers.test.ts
```
Expected: tsc 0 errors; 5 files / 65 tests passing.

---

## 9. Round 5 companion: prompt-bank recipe wiring (shipped)

Spec: `PROMPT_BANK_EMAIL_ROUND_TASK.md`. The prompt bank's email ascension
round lands 26 email recipes in the bank (`email-`, `emlf-`, `embuy-`,
`emgoal-` families, spec'd against this trigger taxonomy: purchase →
`embuy-` welcome / first-win / next-offer-seed / deep-nurture-arc /
review-ask, upsell_purchase → `embuy-oto-welcome` / `embuy-oto-ascend`,
refund → `embuy-refund-save`, booking → `emgoal-book-call`, abandon → the
honest closes) and wires them onto kit emails:

- Any `EmailMessage` can carry an optional `frameworkRecipeId` (sequence
  JSONB, normalized present-only; no schema change, same discipline as
  `triggerConfig`). The kit editor's **Bank framework** select orders the
  email-fit recipes with the trigger-matched family first via the pure
  `orderEmailRecipesForTrigger` helper, and `aiExpandEmail` injects the
  recipe's craft block (+ intake-filled `goal` / `offer` inputs) at expand
  time.
- The flow canvas trigger node shows a read-only hint chip naming the
  fitting recipe family (`triggerRecipeFamilyLabel`), next to the
  location/binding lines from §5.
- The Email Kit also ships 6 ascension frameworks
  (`email/frameworks/ascension.ts`) and remaps `pre-post-purchase`
  (welcome → buyer-welcome, bridge → ascension-bridge).

Tests: `tests/lib/email-kit.test.ts` (+3 round-5 cases),
`tests/lib/prompt-bank-actions.test.ts` (+3 trigger-wiring cases). The §7
dispatch work remains the standing non-goal; this wiring is generation-side
only.
