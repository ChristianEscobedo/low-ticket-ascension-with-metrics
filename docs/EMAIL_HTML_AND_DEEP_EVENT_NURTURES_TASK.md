# Email HTML Output + Deep Event Nurtures — Task

Status: **SHIPPED** (2026-07-28). Round 6 of the Email Marketing Kit build
(after round 5, `PROMPT_BANK_EMAIL_ROUND_TASK.md`).

Three asks, all confirmed and shipped:

1. **Make sure there is an HTML output.** Mostly in place — two gaps closed.
2. **Proper rendered formatting.** Bold, buttons, image slots, and
   one-idea-per-block spacing survive into the finished email (§2).
3. **Deeper event nurtures.** Every event nurture blueprint now runs **7–14
   emails** (§3).

---

## 1. HTML output guarantee

`bodyText` is the source of truth and `renderEmailHtml` / `renderSequenceHtml`
(`src/lib/mothermode/email/export.ts`) derive brand-styled HTML from it. That
plumbing already existed, and the CRUD save route re-rendered on every save —
but two paths could still leave a sequence HTML-less:

- The **AI route** (`/api/mothermode/email-ai`) returned generated
  sequences/emails with `bodyHtml: ''`; HTML only appeared after a manual save.
- The **sales-funnel autobuild** writes kits through `upsertKit` directly,
  bypassing the CRUD route — autobuilt kits stored empty `bodyHtml` until
  someone opened and re-saved them in the editor.

Fixes (no migration, no shape changes):

- `src/app/api/mothermode/email-ai/route.ts` — every action that returns copy
  now returns rendered HTML too: `outline` and `generate` respond with
  `renderSequenceHtml(sequence)`; `expand` and `extend` respond with per-email
  `renderEmailHtml(email)`. The editor has usable HTML the moment generation
  lands.
- `src/lib/mothermode/email/store.ts` — `upsertKit` persists
  `renderSequenceHtml(input.sequence)` on **every write**, so no caller
  (editor save route, autobuild, or any future writer) can store an HTML-less
  kit. Idempotent: the CRUD route already rendered, and rendering again from
  the same `bodyText` yields the same HTML.

Already in place and unchanged: the editor's Copy HTML button
(`sequenceToHtml`), the inbox-preview modal (`renderEmailPreview` → the same
renderer), and `{{token}}` preservation for ESP merge fields.

## 2. Rendered formatting (bold, buttons, images, breathing room)

The generator's formatting contract (`FORMATTING_RULES` in `openai-email.ts`)
already demanded the readable style — short paragraphs, bold key phrases,
button + image slots — but the renderer only honored half of it. Tightened
both sides:

**Renderer (`src/lib/mothermode/email/export.ts`).** The plain-text → HTML
pipeline now fully honors the authoring contract instead of leaking notation
into the finished email:

- `*bold*` emphasis markers become real `<strong>` tags (paragraphs and
  bullets), so key phrases render bold as intended.
- A `[BUTTON: label -> URL]` line becomes a real brand button section in the
  layout (or a brand-styled button link inside rich-HTML bodies), never
  literal marker text.
- An `[IMAGE: description]` line renders the next attached image from
  `email.images` in order (alt = the description), or drops out quietly when
  no image is attached. Marker syntax never leaks.
- Blank-line-separated short paragraphs render as separate `<p>` blocks
  (16px gap, 1.7 line-height), so generated emails keep the one-idea-per-block
  rhythm instead of collapsing into walls of text.
- `escapeHtml` now builds its entity strings from a char code
  (`String.fromCharCode(38)`) so intermediate tooling cannot flatten them.

**Prompt contract.** The first formatting rule now reads: most paragraphs are
ONE sentence, two is fine, three is the hard max, every paragraph separated by
a blank line — the exact rhythm of the reference example. The expand passes
inherit it unchanged.

## 3. Deep event nurtures (7–14 emails)

The campaign blueprint (`emailRoles` + `defaultTiming`) is authoritative — the
model never decides how many emails to write — so depth is a data change in
`src/lib/mothermode/email/campaigns/index.ts`:

- **`event-nurture`: 6 → 12 emails.** A four-week pre-event runway
  (`-25d` → `-1d`): nurture → teach → story → teach → story → proof → teach →
  nurture → proof → bridge → invite → reminder. No two consecutive emails do
  the same job; the runway closes bridge → invite → reminder so the ask lands
  as the natural next step. New `reminder: 'founder-note'` framework default.
- **`webinar-event`: 6 → 10 emails.** The full event arc (`-7d` → `+3d`):
  invite → teach → story → proof → three reminders (incl. live day `+0h`) →
  replay → proof → offer. New `story: 'story-lesson'` and
  `proof: 'case-study'` framework defaults. Strategy notes for both rewritten
  to match the longer arcs.

Every role used by either arc carries a `frameworkByRole` default. Timing-style
scaling (`aggressive 0.5×` / `gentle 2×`) applies unchanged, so a gentle
`event-nurture` becomes a ~7-week runway and an aggressive one ~2 weeks.

**Deliberately unchanged:** the transactional arcs (`cart-abandonment`,
`pre-post-purchase`, `community-onboarding`, `reengagement`,
`leadmag-to-lowticket`, `nurture-to-offer`) stay short — depth is for events,
not receipts. `aiExtendSequence` (up to 12 new emails per pass, deep-nurture /
continue / reengage modes) remains the way to stretch any sequence further.

Because the sales-funnel autobuild generates from these same blueprints, any
funnel event mapped to an event campaign inherits the deeper arcs with no
plumbing changes.

---

## Files touched

| File | Change |
| --- | --- |
| `src/lib/mothermode/email/campaigns/index.ts` | `event-nurture` 6→12, `webinar-event` 6→10; framework defaults + strategy notes |
| `src/app/api/mothermode/email-ai/route.ts` | HTML rendered into `outline` / `generate` / `expand` / `extend` responses |
| `src/lib/mothermode/email/store.ts` | `upsertKit` renders `bodyHtml` on every write |
| `src/lib/mothermode/email/export.ts` | `*bold*` → `<strong>`, `[BUTTON:]` → real buttons, `[IMAGE:]` → attached images or dropped, `escapeHtml` hardened, `email.images` wired in |
| `src/utils/integrations/openai-email.ts` | Formatting rule tightened to one-idea-per-block |
| `tests/lib/email-kit.test.ts` | +11 tests (deep-event-nurture shape pins, HTML output guarantee, body formatting) — 27 total |
| `docs/EMAIL_MARKETING_KIT_SYSTEM_PORT.md` | Round-6 status, §3 deep-event-nurture paragraph, §6/§7 HTML guarantee + formatting pipeline, verification counts |

## Verification

- `npx tsc --noEmit` — clean.
- `npx vitest run tests/lib/email-kit.test.ts` — **27/27 green** (16 prior + 11
  new: 7–14 length pins, arc-shape pins, framework-default coverage,
  `renderSequenceHtml` populating `bodyHtml`, empty-body shell, and the five
  formatting cases: `*bold*`, paragraph spacing, `[BUTTON:]`, `[IMAGE:]`
  attach/drop, rich-HTML marker conversion).
- `npx vitest run tests/lib/sales-email-plan.test.ts tests/lib/sales-email-autobuild.test.ts`
  — 29/29 green (autobuild unaffected; store is mocked there).
- Full `npx vitest run` — 920 passed / 39 failed; the 39 failures are
  pre-existing environment issues (Stripe/Supabase env absent: receipt +
  payment suites, plus two mothermode review/compliance assertions already
  failing on main). No email-suite regressions.

## Follow-ups

- If a third event flavor ever ships (e.g. `challenge-event`), keep the 7–14
  rule — the tests pin the two current blueprints, not the rule itself.
- The editor could surface a "download .html" button per email; today HTML
  leaves via Copy HTML / inbox preview / stored `bodyHtml`.
