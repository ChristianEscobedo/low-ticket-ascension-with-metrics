# Email Kit — Trigger Mapping & Editor UI/UX Updates (System Port)

Status: **shipped & verified** — `tsc --noEmit` = 0 errors; email suites = **65
passing** across 5 files (`email-analytics` 18, `email-triggers` 10,
`email-flow` 14, `email-preview` 10, `email-kit` 13).

This doc ports the **trigger→funnel/content mapping** model and the two
**editor UI/UX clarity upgrades** (A/B weight split bar, trigger-mapping wiring
summary) into another codebase. Everything here is additive and back-compat:
every new field is optional and normalizes to `undefined`, so existing kits
serialize byte-identically and render unchanged.

---

## 1. Where this sits

Part of the Email Flow / Testing / Analytics build:

- **Phase 1** — read-only React-flow canvas from existing `EmailMessage` fields.
- **Phase 2** — editable enrollment `trigger` (funnel-event enum) + per-email
  `abTest`.
- **Phase 3** — inbox preview + **trigger→funnel/content mapping** (this doc) +
  editor clarity upgrades (this doc).
- **Phase 4** — analytics.

The pieces ported here live in:

| Concern | File |
| --- | --- |
| Trigger enum, metadata, funnel pages, content stages, mapping config + resolvers | `src/lib/mothermode/email/triggers.ts` |
| Sequence type carrying `trigger` + `triggerConfig` | `src/lib/mothermode/email/types.ts` |
| Editor UI (picker, mapping dropdowns, wiring summary, A/B split bar) | `src/app/admin/email-marketing/EmailKitEditor.tsx` |
| Canvas trigger/split nodes | `src/components/mothermode/email/EmailFlowPanel.tsx` |
| Unit tests | `tests/lib/email-triggers.test.ts` |

---

## 2. The trigger model (`triggers.ts`)

The single source of truth for "what enrolls a subscriber into a sequence." It
is deliberately provider-agnostic; each value maps cleanly to a GHL/ESP workflow
trigger downstream.

### 2.1 Categories

```ts
export const EMAIL_TRIGGER_CATEGORIES = ['funnel', 'content'] as const;
export type EmailTriggerCategory = (typeof EMAIL_TRIGGER_CATEGORIES)[number];
```

- `funnel` — a page / purchase event (opt-in, sales page, checkout, upsell,
  booking, refund, tag).
- `content` — something happened to a content piece (generated → approved →
  scheduled → published, or rejected). These line up 1:1 with the content-hub
  review states.

### 2.2 Funnel pages (WHERE a funnel event fires)

```ts
export const EMAIL_FUNNEL_PAGES = [
  'optin-page', 'sales-page', 'checkout-page', 'upsell-page',
  'thank-you-page', 'booking-page', 'any',
] as const;
```

`any` = not page-specific (a tag applied in the ESP, a refund at the processor).
Each maps onto a standard GHL/ClickFunnels-style funnel page.

### 2.3 Content lifecycle stages (WHICH content action fires it)

```ts
export const EMAIL_CONTENT_STAGES = [
  'generated', 'approved', 'scheduled', 'published', 'rejected',
] as const;
```

### 2.4 Trigger events + metadata

The union preserves the original Phase-2 values first (back-compat) and adds the
rest of the funnel pages and the content lifecycle:

```ts
export const EMAIL_TRIGGER_EVENTS = [
  // funnel
  'optin', 'page_view', 'sales_page_view', 'checkout_start', 'abandon',
  'purchase', 'upsell_purchase', 'booking', 'refund', 'tag_added',
  // content
  'content_generated', 'content_approved', 'content_scheduled',
  'content_published', 'content_rejected',
] as const;

export const DEFAULT_EMAIL_TRIGGER: EmailTriggerEvent = 'optin';
```

Each event carries a descriptor so labels/descriptions never drift:

```ts
export interface EmailTriggerMeta {
  label: string;
  description: string;
  category: EmailTriggerCategory;
  funnelPage?: EmailFunnelPage;   // present on funnel triggers
  contentStage?: EmailContentStage; // present on content triggers
}
export const EMAIL_TRIGGER_META: Record<EmailTriggerEvent, EmailTriggerMeta> = { … };
```

Labels and descriptions are **derived** from the meta map (so they can't fall
out of sync):

```ts
export const EMAIL_TRIGGER_LABELS = Object.fromEntries(
  EMAIL_TRIGGER_EVENTS.map((t) => [t, EMAIL_TRIGGER_META[t].label]),
) as Record<EmailTriggerEvent, string>;
export const EMAIL_TRIGGER_DESCRIPTIONS = /* same shape from .description */;
```

### 2.5 Defensive normalizers (JSONB boundary)

Because the trigger is persisted in untyped JSONB, everything coerces safely and
never throws:

```ts
toEmailTriggerEvent(value): EmailTriggerEvent      // unknown → 'optin'
emailTriggerLabel(value): string
emailTriggerMeta(value): EmailTriggerMeta
emailTriggerCategory(value): 'funnel' | 'content'
emailTriggerLocationLabel(value): string           // "Checkout page" / "Content published"
```

### 2.6 Editable mapping config (`EmailTriggerConfig`)

Where `EmailTriggerMeta` describes the DEFAULT location an event fires, the
**config** lets an admin bind the trigger to a concrete target. It lives on the
sequence (`sequence.triggerConfig`).

```ts
export interface EmailTriggerConfig {
  funnelPage?: EmailFunnelPage; // override the page a funnel event binds to
  offerSlug?:  string;          // which offer/funnel this enrollment is wired to
  contentRef?: string;          // which content piece fires a content trigger
  note?:       string;          // free-form note (e.g. the GHL workflow name)
}
```

Every field is optional. An all-empty config **normalizes to `undefined`** so an
untouched sequence stays identical to a legacy one:

```ts
normalizeTriggerConfig(value: unknown): EmailTriggerConfig | undefined
```

### 2.7 Resolvers (used by editor, canvas, exporters)

```ts
// Effective page: config override → else the trigger's default page → 'any'.
resolveTriggerFunnelPage(trigger, config?): EmailFunnelPage

// Effective "where it fires" label, honoring a config override.
resolveTriggerLocationLabel(trigger, config?): string

// Short "binding" summary — "Offer: {slug}" (funnel) or "Content: {ref}" (content).
resolveTriggerBindingLabel(trigger, config?): string
```

### 2.8 Picker helpers

```ts
emailTriggerEventsByCategory(category): EmailTriggerEvent[]
emailTriggerGroups(): Array<{ category; label; events }>  // ready for <optgroup>
```

---

## 3. Sequence type change

`EmailSequence` gains two optional fields (add to your type + the `blankSequence`
factory defaulting `trigger: 'optin'`, `triggerConfig: undefined`):

```ts
interface EmailSequence {
  // …existing…
  trigger: EmailTriggerEvent;          // default 'optin'
  triggerConfig?: EmailTriggerConfig;  // undefined when unmapped
}
```

Load/normalize path runs `toEmailTriggerEvent(row.trigger)` and
`normalizeTriggerConfig(row.triggerConfig)` so bad/legacy JSONB is coerced.

---

## 4. Editor UI (`EmailKitEditor.tsx`)

### 4.1 Enrollment trigger picker

A single `<select>` grouped by category using `emailTriggerGroups()`:

```tsx
<select value={sequence.trigger}
  onChange={(e) => setSequence((p) => ({ ...p, trigger: e.target.value as EmailTriggerEvent }))}
  title={EMAIL_TRIGGER_DESCRIPTIONS[sequence.trigger]}>
  {emailTriggerGroups().map((group) => (
    <optgroup key={group.category} label={group.label}>
      {group.events.map((t) => (
        <option key={t} value={t}>{EMAIL_TRIGGER_LABELS[t]}</option>
      ))}
    </optgroup>
  ))}
</select>
```

Below it, a "Fires: {location}" badge + the trigger description.

### 4.2 Trigger mapping — cascading (waterfall) dropdowns

A bordered "Trigger mapping (optional)" block. The fields shown **depend on the
trigger's category** (`emailTriggerCategory(sequence.trigger)`):

- **Funnel triggers** → `Funnel page` select (default option shows the trigger's
  own default page via `emailTriggerLocationLabel`) + `Offer` select populated
  from `sources` filtered to `offer` / `offer-bonuses`.
- **Content triggers** → `Content asset` select from non-inline `sources`.
- **Both** → a `Canvas note` select (offers a source label as the note).

No free-text slugs/ids — everything is a dropdown fed by real `ContextSourceOption[]`.
All writes go through one merge helper that self-clears when empty:

```ts
function patchTriggerConfig(patch: Partial<EmailTriggerConfig>) {
  setSequence((prev) => {
    const tc: EmailTriggerConfig = { ...(prev.triggerConfig ?? {}), ...patch };
    (Object.keys(tc) as (keyof EmailTriggerConfig)[]).forEach((k) => {
      if (!tc[k]) delete tc[k];
    });
    const any = tc.funnelPage || tc.offerSlug || tc.contentRef || tc.note;
    return { ...prev, triggerConfig: any ? tc : undefined };
  });
}
```

The same handler is passed to the canvas trigger node
(`onChangeTriggerConfig={patchTriggerConfig}`), so editing on either surface is
consistent.

### 4.3 NEW — plain-language wiring summary (UI/UX update)

At the top of the mapping block, a one-line sentence reads the dropdowns back to
the admin so the wiring is self-verifying without decoding the controls. It
consumes the shared resolvers so it always reflects the live override:

```tsx
<p className="rounded-md bg-ink/50 px-2.5 py-1.5 text-[11px] leading-relaxed text-bone/60">
  When <span className="font-semibold text-brass/90">{emailTriggerLabel(sequence.trigger)}</span>{' '}
  fires on <span className="font-semibold text-bone/80">
    {resolveTriggerLocationLabel(sequence.trigger, sequence.triggerConfig)}
  </span>
  {(() => {
    const binding = resolveTriggerBindingLabel(sequence.trigger, sequence.triggerConfig);
    return binding ? <> (<span className="font-semibold text-bone/80">{binding}</span>)</> : null;
  })()}
  , enroll the subscriber into this sequence.
</p>
```

New imports required from `@/lib/mothermode/email`:
`emailTriggerLabel`, `resolveTriggerLocationLabel`, `resolveTriggerBindingLabel`.

Renders e.g.:

> When **Purchase** fires on **Checkout page** (**Offer: starter-kit**), enroll
> the subscriber into this sequence.

### 4.4 NEW — A/B split "weight bar" (UI/UX update)

Above the per-variant rows in the A/B editor, a stacked bar visualizes each
variant's share of the total weight, with a running total that flags when
weights don't sum to 100% and a one-click **"Balance evenly"** button. It's
purely presentational and writes weights back through `patchEmail`; the stored
`abTest` shape is unchanged.

```tsx
{(() => {
  const variants = email.abTest!.variants;
  const total = variants.reduce((s, x) => s + (x.weight ?? 0), 0);
  const colors = ['bg-brass','bg-emerald-500','bg-sky-500','bg-fuchsia-500','bg-amber-500'];
  return (
    <div className="space-y-1">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-ink/60">
        {variants.map((x, i) => (
          <div key={x.id} className={colors[i % colors.length]}
            style={{ width: `${total > 0 ? ((x.weight ?? 0) / total) * 100 : 100 / variants.length}%` }}
            title={`${x.label || `V${i + 1}`}: ${x.weight ?? 0}%`} />
        ))}
      </div>
      <div className="flex items-center justify-between text-[10px] text-bone/40">
        <span>Total {total}% {total !== 100 && <span className="text-amber-400">(should be 100%)</span>}</span>
        <button type="button" className="text-brass hover:text-brass/80"
          onClick={() => {
            const n = variants.length, base = Math.floor(100 / n);
            const balanced = variants.map((x, i) => ({ ...x, weight: i === n - 1 ? 100 - base * (n - 1) : base }));
            patchEmail(email.id, { abTest: { ...email.abTest!, variants: balanced } });
          }}>
          Balance evenly
        </button>
      </div>
    </div>
  );
})()}
```

Notes:
- Widths use the running `total` (not a hardcoded 100) so the bar is always
  proportional even mid-edit.
- "Balance evenly" gives the last variant the remainder so the split always
  sums to exactly 100 with integer weights.

---

## 5. Canvas integration (`EmailFlowPanel.tsx`)

The flow panel renders a **trigger node** (label + resolved location + binding +
optional note) and **split nodes** for A/B emails. It receives the same edit
callbacks as the editor:

```tsx
<EmailFlowPanel
  sequence={sequence}
  onSelectEmail={focusEmailCard}
  onChangeTrigger={(trigger) => setSequence((p) => ({ ...p, trigger }))}
  onChangeTriggerConfig={patchTriggerConfig}
  offerOptions={/* offer + offer-bonuses sources */}
  contentOptions={/* non-inline sources */}
/>
```

---

## 6. Porting checklist

1. Copy `triggers.ts` (enum, meta, pages, stages, config, normalizers,
   resolvers, picker helpers). Re-export from your email `index.ts`.
2. Add `trigger` + `triggerConfig?` to the sequence type; default in the blank
   factory; coerce on the DB read path (`toEmailTriggerEvent` /
   `normalizeTriggerConfig`). No migration needed if the sequence is stored as
   JSONB.
3. In the editor: add the grouped picker, the category-aware mapping dropdowns,
   the `patchTriggerConfig` merge helper, the **wiring summary** sentence, and
   the **A/B split bar**. Wire the same callbacks into the canvas.
4. Confirm exporters/canvas call `resolveTriggerLocationLabel` /
   `resolveTriggerBindingLabel` rather than reading raw fields.
5. Run `tsc --noEmit` and the trigger/kit/flow tests.

## 7. Back-compat guarantees

- Unknown/absent trigger → `'optin'`; empty config → `undefined`.
- All new fields optional; untouched kits serialize identically.
- Labels/descriptions derive from `EMAIL_TRIGGER_META`, so adding a trigger is a
  one-line change with no UI edits.
- The two UI/UX additions are presentational — they change no stored shape
  beyond the already-existing `abTest.variants[].weight` and `triggerConfig`.
