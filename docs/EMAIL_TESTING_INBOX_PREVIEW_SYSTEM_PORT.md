# Email Sequence Testing — Inbox Preview (System Port · Phase 3)

This doc ports **Phase 3** of the Email Flow / Testing / Analytics build plan
(`docs/EMAIL_FLOW_TESTING_AND_ANALYTICS_HANDOFF.md`). Phases 1 (read-only flow
canvas) and 2 (triggers + A/B) are already shipped and verified. Phase 3 adds an
**email testing surface** — specifically the "**inbox preview (no infra)**" half
that the handoff calls "shippable immediately."

The **send-test** half (POST to a transactional sender) is deliberately **left
as a documented stub**: the handoff flags "confirm which sender the receipt
pipeline uses" as an open decision, and no ESP/queue is wired in this repo. This
port builds everything that does not depend on that decision and marks the seam
where send-test slots in.

Everything here is admin-only, behind the existing admin route guard, and touches
**zero persistence** — the preview renders the in-memory `EmailSequence` the
editor already holds, through the same pure renderers the export/copy buttons use.

---

## What "inbox preview" means

A **Preview** action (per-email and from the sequence toolbar) opens a modal that:

1. Renders the selected email through the **exact same** brand renderer used for
   export (`renderEmailHtml` → `renderEmail` from `src/utils/email/layout.ts`),
   so what the admin previews is what an ESP paste produces.
2. Resolves `{{tokens}}` with sample + custom-token values so the copy reads like
   a real send (e.g. `{{first_name}}` → "Jordan"), while any token the admin has
   not filled stays visible as a literal `{{marker}}` so gaps are obvious.
3. Shows inbox chrome (**From / Subject / preview line**) with the subject and
   preheader token-resolved too.
4. Offers a **desktop / mobile** width toggle and a **token-value form** so the
   admin can override sample values and watch the render update live.
5. Lets the admin step **prev / next** through the whole sequence without closing
   the modal.

The render runs inside a sandboxed `<iframe srcDoc>` so the email's inline CSS
(and `<!doctype>` shell) can't leak into or inherit from the admin page styles.

---

## Files touched / added

| File | Change |
| --- | --- |
| `src/lib/mothermode/email/preview.ts` | **New, pure + unit-testable.** `renderEmailPreview(email, values, opts)` → `{ subject, preview, html, usedTokens, unresolvedTokens }`; `collectEmailTokens` / `collectSequenceTokens`; `SAMPLE_TOKEN_VALUES` + `sampleTokenValues()`; `PREVIEW_WIDTHS` device map. No React, no server imports. |
| `src/lib/mothermode/email/index.ts` | Re-export `./preview` from the browser-safe barrel. |
| `src/components/mothermode/email/EmailPreviewModal.tsx` | **New, client.** The inbox-preview modal: iframe render, device toggle, token-value form, per-email prev/next + dropdown, inbox chrome, and a documented **Send test** stub (disabled with a tooltip explaining it needs a sender). |
| `src/app/admin/email-marketing/EmailKitEditor.tsx` | Adds `previewFor` state, a per-email **Preview** button, a toolbar **Preview** button (next to **View flow**), and renders `<EmailPreviewModal>` seeded with the custom-token defaults it already computes (`tokenValues`). |
| `tests/lib/email-preview.test.ts` | **New.** Proves tokens resolve, unknowns are preserved, the brand shell wraps, and the token collectors find markers across subject/preview/body/CTA. |

No schema changes. No new API routes (send-test is a stub). No changes to any
other kit editor.

---

## 1. Pure preview module — `src/lib/mothermode/email/preview.ts`

Kept pure so the modal is a thin presentational layer and the behavior is
unit-testable without a DOM. It composes two existing pure helpers:

- `renderEmailHtml(email)` (`export.ts`) → brand-styled, inline-CSS HTML with
  `{{tokens}}` still embedded.
- `applyEmailTokens(text, values, opts)` (`tokens.ts`) → substitutes tokens;
  `preserveUnknown: true` keeps unfilled markers literal, `escapeHtml: true`
  escapes substituted values when rendering into HTML.

```ts
export type PreviewDevice = 'desktop' | 'mobile';

/** iframe render widths per device (px). */
export const PREVIEW_WIDTHS: Record<PreviewDevice, number> = {
  desktop: 640,
  mobile: 390,
};

/**
 * Sample values so the preview reads like a real send. These are ONLY used for
 * preview; export/copy paths still preserve tokens for the ESP to fill.
 */
export const SAMPLE_TOKEN_VALUES: Record<string, string> = {
  first_name: 'Jordan',
  name: 'Jordan Rivera',
  email: 'jordan@example.com',
  sender_name: 'The MotherMode Team',
  brand: 'MotherMode',
  offer_name: 'The Starter Offer',
  cta_url: 'https://example.com/go',
  unsubscribe: '#unsubscribe',
  signoff: 'Talk soon,',
  amount: '$27.00',
  currency: 'USD',
  product: 'starter-offer',
  ref: 'PREVIEW-REF',
};

/** Sample base merged with (and overridden by) caller-supplied values. */
export function sampleTokenValues(
  overrides: Record<string, string> = {},
): Record<string, string> {
  return { ...SAMPLE_TOKEN_VALUES, ...overrides };
}

export interface EmailPreviewResult {
  subject: string;
  preview: string;
  html: string;
  usedTokens: string[];
  unresolvedTokens: string[];
}

export interface RenderPreviewOptions {
  /** Keep unfilled tokens as literal {{markers}} (default true, matches export). */
  preserveUnknown?: boolean;
}

/** Distinct token keys referenced by one email (subject/preview/body/CTA). */
export function collectEmailTokens(email: EmailMessage): string[];
/** Union of tokens across every email in a sequence. */
export function collectSequenceTokens(
  sequence: EmailSequence | null | undefined,
): string[];

/** Render one email to inbox-preview HTML + resolved subject/preheader. */
export function renderEmailPreview(
  email: EmailMessage,
  values?: Record<string, string>,
  opts?: RenderPreviewOptions,
): EmailPreviewResult;
```

### Behavior notes

- `renderEmailPreview` resolves tokens in three places with one values map:
  the rendered **HTML** (escaped), the **subject**, and the **preview** line.
- `usedTokens` = tokens actually referenced by the email; `unresolvedTokens` =
  those `usedTokens` with no value in the supplied map. The modal uses these to
  build the token form and to flag gaps.
- **Backward-compat:** `values` defaults to `{}` and `preserveUnknown` defaults
  to `true`, so calling `renderEmailPreview(email)` returns the branded HTML with
  every token intact — identical to `renderEmailHtml` output, just wrapped with
  the metadata the modal needs.

---

## 2. Modal — `src/components/mothermode/email/EmailPreviewModal.tsx`

A client component mirroring the `EmailFlowPanel` shell (fixed overlay, right
panel, brand tokens). Props:

```ts
interface Props {
  open: boolean;
  onClose: () => void;
  sequence: EmailSequence;
  /** Which email to open first; falls back to the first email. */
  initialEmailId: string | null;
  /** Custom-token defaults (from customTokenValues) to seed the token form. */
  tokenValues?: Record<string, string>;
}
```

State it owns:

- `selectedEmailId` — the email being previewed (prev/next + dropdown update it).
- `device` — `'desktop' | 'mobile'`, drives the iframe width from `PREVIEW_WIDTHS`.
- `overrides` — a `Record<string,string>` of admin edits to token values.

Values precedence for the render:

```
sampleTokenValues({ ...tokenValues /* custom defaults */, ...overrides /* admin edits */ })
```

So sample values are the floor, custom-token defaults win over samples, and the
admin's in-modal edits win over everything. The render is recomputed with
`useMemo` on `[activeEmail, mergedValues]`.

Layout:

- **Left column (controls):** device toggle, email selector (prev/◂ ▸ next +
  a `<select>` of "Email N · subject"), and the **token-value form** — one input
  per `usedTokens` entry, labeled from `EMAIL_MERGE_TOKENS` (falling back to a
  humanized key for custom tokens). Unresolved tokens get a subtle "unfilled"
  hint. A **Send test** row is present but **disabled**, with a tooltip: *"Wire a
  transactional sender to enable test sends."*
- **Right column (preview):** inbox chrome (`From: {sender_name}`, `Subject`,
  preview line) above an `<iframe title="Email preview" srcDoc={preview.html}>`
  sized to the device width. The iframe is `sandbox`-free of scripts (no
  `allow-scripts`) since the content is static admin HTML.

Empty state: if the sequence has no emails, the modal shows the same friendly
"nothing to preview yet" message pattern the flow panel uses.

---

## 3. Editor wiring — `EmailKitEditor.tsx`

The editor already computes `tokenValues` (custom-token defaults) for the copy
buttons; the modal reuses it verbatim.

```tsx
const [previewFor, setPreviewFor] = useState<string | null>(null);
```

Toolbar button (next to **View flow**):

```tsx
<button
  className={btnGhost}
  onClick={() => setPreviewFor(sequence.emails[0]?.id ?? null)}
  disabled={sequence.emails.length === 0}
  title="Preview how each email renders in an inbox."
>
  Preview
</button>
```

Per-email button (in the write-body action row):

```tsx
<button
  type="button"
  className={btnGhost}
  onClick={() => setPreviewFor(email.id)}
  disabled={busy !== null}
>
  Preview
</button>
```

Mount (near the flow panel):

```tsx
<EmailPreviewModal
  open={previewFor !== null}
  onClose={() => setPreviewFor(null)}
  sequence={sequence}
  initialEmailId={previewFor}
  tokenValues={tokenValues}
/>
```

Opening the modal never mutates the sequence; it reads live editor state, so an
admin can tweak a subject, click **Preview**, and see the change immediately.

---

## 4. Send-test (documented stub — future work)

The handoff scopes send-test behind an open decision ("confirm the transactional
sender the receipt pipeline uses"). This port:

- Renders a **disabled** "Send test to…" control in the modal so the surface is
  discoverable, with a tooltip explaining it is not wired.
- Does **not** add an API route. When a sender is chosen, add
  `src/app/api/admin/mothermode-email/test-send/route.ts` that:
  1. `requireAdminRoute()`.
  2. Rebuilds the email HTML via `renderEmailHtml`.
  3. Resolves tokens with `applyEmailTokens(..., { preserveUnknown: false })` and
     injects a **real** `{{unsubscribe}}` URL before sending.
  4. Calls the transactional sender the receipt pipeline uses.

Keeping this a stub means Phase 3's shippable value (inbox preview) lands now with
no infra dependency, exactly as the handoff intends.

---

## 5. Analytics (Phase 4) — still future work

Out of scope here. Phase 4 (`email/analytics.ts` types + `mothermode_email_stats`
table + canvas overlay) remains gated on an ESP integration per the handoff.

---

## Verification

```bash
npx tsc --noEmit
npx vitest run tests/lib/email-preview.test.ts tests/lib/email-flow.test.ts tests/lib/email-kit.test.ts
```

Expected: `tsc` clean; `email-preview` suite green plus the existing
`email-flow` (14) and `email-kit` (13) suites unchanged.

`tests/lib/email-preview.test.ts` covers:

- **Token resolution:** a subject/body with `{{first_name}}` resolves to the
  supplied value; `escapeHtml` escapes substituted HTML-unsafe values.
- **Preserve unknown:** an unsupplied token stays literal `{{marker}}`.
- **Brand shell:** the rendered HTML contains the `<!doctype`, the brand name,
  and the email `<h1>` title (proves it went through `renderEmail`).
- **Token collectors:** `collectEmailTokens` finds markers across subject,
  preview, body, and CTA; `collectSequenceTokens` unions across emails.
- **Unresolved list:** `unresolvedTokens` lists exactly the used tokens with no
  value supplied.

Manual smoke:

- Open the email editor → generate/outline a sequence → click **Preview** (toolbar
  or per-email) → confirm the inbox chrome + iframe render, toggle **desktop/
  mobile**, edit a token value and watch the render update, and step prev/next
  through the sequence.
