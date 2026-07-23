# Email Sequence Flow Canvas, Triggers, A/B & Analytics — Handoff / Build Plan

Status: **not started** — scoped handoff to be executed in a fresh session.

This doc plans a visual **sequence-programming side panel** (React Flow) for the
Email Marketing Kit, plus trigger assignment, A/B split nodes, an email
**testing** surface, and an **analytics** shape. It is deliberately phased so
Phase 1 ships value with **zero schema changes** and later phases layer on.

---

## Why this is low-risk (what already exists)

The domain graph is already implicit in the stored data — the canvas is mostly a
*view* over it:

- `EmailMessage` (`src/lib/mothermode/email/types.ts`) already carries:
  - `id`, `role`, `framework`, `sendOffset` (`'+0h' | '+1d' …`)
  - `branch: EmailBranchCondition` (`always | opened | not-opened | clicked |
    not-clicked | purchased | not-purchased`)
  - `parentId: string | null` (the email the branch condition evaluates against;
    `null` = the immediately-preceding trunk email)
  - `images`, `psFramework`, `subject`, `cta`, etc.
- `EmailSequence = { name, goal, emails: EmailMessage[] }` — a flat, ordered list.
- `EmailKitRecord.sequence` round-trips through the store as JSONB
  (`normalizeSequence` / `normalizeEmail` are defensive), so **adding optional
  fields is backward-compatible** — old rows normalize fine.
- Editor: `src/app/admin/email-marketing/EmailKitEditor.tsx` is the single
  source-of-truth form; it already patches emails via a `patchEmail(id, partial)`
  pattern.
- Funnel triggers already have a scoped handoff:
  `docs/EMAIL_FUNNEL_EVENT_ASSIGNMENT_HANDOFF.md` (event types: `optin |
  purchase | abandon | refund | tag_added`). **Reuse that enum** — do not invent
  a second trigger vocabulary.
- Brand render + preview already exist: `sequenceToHtml` / `renderEmail`
  (`src/lib/mothermode/email/export.ts`, `src/utils/email/layout.ts`) — the basis
  for the "testing" preview.

**Graph derivation rule (Phase 1):** the trunk is every email with
`branch === 'always'` in array order; any email with `branch !== 'always'` is a
conditional child edge from `parentId` (or the previous trunk email if
`parentId` is null). This is enough to draw the whole tree from existing data.

---

## Dependencies to add

- `reactflow` (canvas, nodes, edges, minimap, controls). Client-only component.
- `dagre` **or** `elkjs` for auto-layout (compute `x/y` from the derived graph so
  we don't persist positions in Phase 1). `dagre` is lighter; prefer it unless
  A/B branching layouts get gnarly.

Both are self-contained and fit the existing client-component pattern (e.g.
`StoryboardPanel.tsx`, `ContentSheet.tsx`). Lazy-load the panel
(`next/dynamic`, `ssr:false`) so React Flow never runs on the server.

---

## Phase 1 — Read-only flow canvas in a Sheet (no schema changes)

**Goal:** a "View flow" button on `EmailKitEditor` opens a Sheet/side panel that
auto-lays-out the sequence as a node graph. Selecting a node focuses that
email's card in the form. Pure visualization.

Files:
- `src/lib/mothermode/email/flow.ts` (**new, pure + unit-testable**)
  - `sequenceToFlowGraph(sequence): { nodes: FlowNode[]; edges: FlowEdge[] }`
  - `FlowNode` = `{ id, emailId, label (role + subject), sendOffset, branch,
    kind: 'email' }`
  - `FlowEdge` = `{ id, source, target, label (branch condition or ''),
    kind: 'trunk' | 'branch' }`
  - Derivation rule above; no positions (layout lib assigns them in the view).
- `src/components/mothermode/email/EmailFlowPanel.tsx` (**new, client**)
  - Sheet wrapper + `<ReactFlow>` with `dagre` layout, minimap, controls,
    read-only (`nodesDraggable={false}`, `nodesConnectable={false}`).
  - Custom `EmailNode` renderer: role pill, subject, `sendOffset`, branch badge,
    a little image/📎 indicator. Click → `onSelectEmail(emailId)`.
- `EmailKitEditor.tsx`: add a **"View flow"** button; pass `sequence` +
  `onSelectEmail` (scroll/focus the matching email card).

Tests: `tests/lib/email-flow.test.ts` — `sequenceToFlowGraph` for
(a) linear sequence → N nodes, N-1 trunk edges; (b) a branch email → a labeled
branch edge from its `parentId`; (c) `parentId:null` branch → edge from prior
trunk email; (d) empty sequence → empty graph.

Verify: `npx tsc --noEmit` + `npx vitest run tests/lib/email-flow.test.ts
tests/lib/email-kit.test.ts`.

**Ship gate:** this phase alone is genuinely useful and touches no persistence.

---

## Phase 2 — Triggers + A/B split (editable, writes back)

### 2a. Triggers (entry events)

Reuse the funnel-event vocabulary. Two options — pick per the funnel handoff's
open decision:

- **Preferred:** implement `EMAIL_FUNNEL_EVENT_ASSIGNMENT_HANDOFF.md` first
  (`mothermode_email_funnel_bindings` table + store + API). Then the flow canvas
  renders a **Trigger node** at the top of the graph from
  `listBindings(kitId)` and lets the admin add/remove bindings inline.
- **Lightweight fallback (no dispatch):** add an optional
  `sequence.trigger?: { event: FunnelEventType; offerSlug?: string }` to the
  sequence JSON (backward-compatible via `normalizeSequence`) purely for
  visualization/planning, deferring real dispatch to the funnel handoff.

Add a typed catalog `EMAIL_TRIGGER_EVENTS` (mirror the funnel enum:
`optin | purchase | abandon | refund | tag_added`) with labels, in a new
`src/lib/mothermode/email/triggers.ts`, so both the canvas and the funnel
bindings share one source of truth.

### 2b. A/B split nodes

A/B is **distinct from conditional branching** and should be modeled explicitly
so exports can carry it. Add optional fields to `EmailMessage` (all optional →
backward-compatible; extend `normalizeEmail`):

```ts
/** When set, this email is one variant of an A/B split keyed by splitId. */
abTest?: {
  splitId: string;      // groups sibling variants
  variant: string;      // 'A' | 'B' | 'C' …
  weight: number;       // 0–100 split percentage
} | null;
```

Graph: a split renders as a diamond **Split node** (one per `splitId`) with one
outgoing edge per variant, edge label = `variant weight%`. `flow.ts` groups
emails by `abTest.splitId`.

### 2c. Editing on the canvas

Make the canvas editable behind a mode toggle:
- Drag an email onto another → set `parentId` + prompt for a `branch` condition.
- "Add branch" / "Add A/B split" node actions → append `EmailMessage`(s) via the
  existing `patchEmail` / add-email flow, then re-derive the graph.
- All mutations go through the editor's existing state, saved by the normal
  `/api/admin/mothermode-email` save payload — **no new write path**.

Keep `flow.ts` pure: the panel computes a new `sequence` and calls back
`onChangeSequence(next)`; the editor owns persistence.

Tests: extend `email-flow.test.ts` for A/B grouping + a `reparent(seq, childId,
parentId, branch)` helper (pure) round-trip.

---

## Phase 3 — Email testing surface

**Goal:** preview + (optionally) send a test.

- **Inbox preview (no infra):** a "Preview" action per node/email opens a modal
  rendering `renderEmail(email, tokenValues)` / `sequenceToHtml` in an iframe,
  with a desktop/mobile width toggle and a token-value form (reuse
  `customTokenValues` + `applyEmailTokens`). This is shippable immediately.
- **Send test (needs a sender):** a "Send test to…" field that POSTs to a new
  `/api/admin/mothermode-email/test-send` route calling the transactional sender
  the receipt pipeline uses (confirm which — see funnel handoff open decision on
  the queue/sender). Resolve tokens with `{ preserveUnknown: false }` and inject
  a real `{{unsubscribe}}` before any send.

Tests: render snapshot proving tokens resolve + brand shell wraps (mirror the
funnel handoff's planned render test).

---

## Phase 4 — Analytics (gated on external data)

We currently **generate/export** copy; we do **not** ingest sends/opens/clicks.
So analytics is designed now, wired when an ESP integration exists.

- **Types (build now):** `src/lib/mothermode/email/analytics.ts`
  ```ts
  export interface EmailStat {
    emailId: string;
    sent: number; delivered: number; opened: number;
    clicked: number; unsubscribed: number; bounced: number;
    revenue?: number;
  }
  export interface SequenceStats { kitId: string; byEmail: Record<string, EmailStat>; updatedAt: string | null; }
  ```
  Pure derivations: `openRate`, `ctr`, `conversionRate` per email; roll-ups for
  A/B variants (compare variants under a `splitId`).
- **Storage (build now, populate later):** migration
  `mothermode_email_stats` (`kit_id`, `email_id`, counters, `period`,
  `updated_at`), service-role RLS like the other mothermode tables.
- **Canvas overlay:** when stats exist, each node shows open%/CTR badges and a
  subtle heat tint; A/B split nodes show the winning variant. When absent, show a
  clean **"Connect your ESP to see analytics"** empty state.
- **Ingestion (later, external):** an ESP webhook/API route (SendGrid/Postmark/
  Resend/GHL) upserts `mothermode_email_stats`. Out of scope until an ESP is
  chosen; leave a stub route + doc note.

Tests: `tests/lib/email-analytics.test.ts` — rate math, zero-safe division, A/B
winner selection.

---

## Suggested build order & scope for the new task

1. **Phase 1** (flow.ts + EmailFlowPanel + editor button + tests). Zero schema.
2. **Phase 2a triggers** — ideally by first executing the funnel-event handoff so
   triggers are real, not cosmetic.
3. **Phase 2b/2c** — A/B fields + editable canvas.
4. **Phase 3** — preview modal now; send-test when a sender is confirmed.
5. **Phase 4** — analytics types + table now; ESP ingestion when integrated.

## Backward-compatibility checklist

- All new `EmailMessage` fields are **optional**; extend `normalizeEmail` with
  defensive defaults (`abTest: null`) so existing JSONB rows normalize cleanly.
- New sequence-level `trigger?` also optional in `normalizeSequence`.
- `flow.ts` must treat missing fields as the linear-trunk default so old kits
  render as a straight line.

## Verify (each phase)

```bash
npx tsc --noEmit
npx vitest run tests/lib/email-flow.test.ts tests/lib/email-kit.test.ts
# Phase 3/4 add: tests/lib/email-analytics.test.ts
```

## Open decisions for the next session

- **Layout lib:** `dagre` (lighter) vs `elkjs` (better complex branching). Start
  with `dagre`.
- **Trigger dispatch:** implement the funnel-binding table now, or ship a
  cosmetic `sequence.trigger` first? Depends on whether a sender/queue exists.
- **Sender for test-send:** confirm the transactional sender the receipt pipeline
  uses before wiring "Send test".
- **ESP for analytics:** which provider's webhook schema to normalize into
  `mothermode_email_stats`.
