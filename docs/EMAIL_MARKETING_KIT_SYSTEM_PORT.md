# Email Marketing Kit — System & Port Guide

Spec: `EMAIL_MARKETING_KIT_TASK.md`. Status: **BUILT**.

The Email Marketing Kit is the campaign-producing sibling of the Lead Gen /
High Ticket / Community kits. From a short intake plus one or more attached
context sources (an offer, a lead magnet, a high-ticket offer, a community kit)
it produces a complete, outcome-driven email **sequence**: an ordered list of
emails, each with a role, a send-offset, a per-email framework, and full copy
rendered as plain text (the source of truth) and brand-styled HTML.

It reuses the two suite patterns wholesale — DB-backed admin CRUD with
service-role writes, and server-only JSON-mode AI behind an action-switch route
— and differs from the document kits in two structural ways:

1. **Sequence-shaped.** The deliverable is an ordered `EmailMessage[]`, not a
   single document.
2. **Context-native.** It stores `ContextRef[]` and resolves them to live packs
   at generation time via the shared Offer↔Kit **context bridge**
   (`OFFER_KIT_CONTEXT_BRIDGE_SYSTEM_PORT.md`), so a sequence can be built
   directly on top of an existing offer or another kit.

---

## 1. File map

```
src/lib/mothermode/email/
  types.ts                 Domain types + pure row<->record mappers + normalizers
  campaigns/index.ts       8 campaign blueprints + timing-style scaling
  frameworks/
    index.ts               EMAIL_FRAMEWORK_SPECS registry + frameworkSpec()
    soap-opera.ts pas.ts value-longform.ts story-lesson.ts quick-win.ts
    founder-note.ts case-study.ts objection-crusher.ts listicle.ts
  export.ts                Pure text / HTML / CSV renderers (no server imports)
  store.ts                 Service-role Supabase CRUD (server-only)
  index.ts                 Browser-safe barrel (types + campaigns + frameworks + export)
src/utils/integrations/openai-email.ts     Server-only generator (4 passes)
src/app/api/mothermode/email-ai/route.ts   Admin AI route (action switch)
src/app/api/admin/mothermode-email/route.ts  Admin CRUD route
src/app/admin/email-marketing/page.tsx     Admin server page
src/app/admin/email-marketing/EmailKitEditor.tsx  Client editor
supabase/migrations/20260730000000_mothermode_email_kits.sql
tests/lib/email-kit.test.ts
```

Same rule as the other kits: `index.ts` re-exports types + catalogs + export
helpers but **never** `store.ts` (which pulls in the service-role client). Server
code imports `store.ts` directly.

---

## 2. Data model

`EmailKitRecord` (camelCase, app-side) ↔ `EmailKitRow` (snake_case, DB):

- `campaignType` — one of 8 `EMAIL_CAMPAIGN_TYPES`.
- `framework` — default per-email writing `EMAIL_FRAMEWORKS` (9), overridable per role.
- `status` — `draft | active | archived`.
- `intake: EmailKitIntake` — audience, goal, senderName, tone, offerSlug,
  `timingStyle` (aggressive|standard|gentle), notes.
- `contextRefs: ContextRef[]` — attached offer/kit sources (shared bridge type).
- `sequence: EmailSequence` — `{ name, goal, emails: EmailMessage[] }`, where each
  `EmailMessage` has `{ id, role, framework, sendOffset, subject, subjectIdeas[],
  preview, bodyText, bodyHtml, cta{label,url}, summary }`.

`intake`, `context_refs`, and `sequence` are stored as JSONB. Every normalizer in
`types.ts` is **defensive** (JSONB is untyped at the DB boundary), so a malformed
row degrades to blanks/defaults rather than throwing.

Migration `20260730000000_mothermode_email_kits.sql` follows the Community /
High Ticket / Lead Gen shape: `id`, unique `slug`, `name`, `campaign_type`,
`framework`, `status`, three JSONB columns, timestamps, `updated_by`, an
`updated_at` trigger, and RLS (service-role full access; no anon read — kits are
authoring artifacts, not buyer-facing rows).

---

## 3. Campaign blueprints (`campaigns/index.ts`)

Each `EmailCampaignSpec` is a **sequence blueprint** kept as data so campaigns can
be tuned without touching generation logic:

- `emailRoles: EmailRole[]` — the ordered arc; its length = how many emails.
- `defaultTiming: string[]` — send-offsets aligned 1:1 with roles (`+0h`, `+1d`, `-3d`…).
- `frameworkByRole?` — per-role framework override for this campaign.
- `expectsContext` — the context kinds the campaign is usually built on.
- `strategyNote` — injected into the outline prompt.

Eight campaigns ship: `leadmag-to-lowticket`, `nurture-to-offer`,
`cart-abandonment`, `pre-post-purchase`, `webinar-event`,
`community-onboarding`, `event-nurture`, `reengagement`.

**Timing-style scaling.** `scaleOffset(offset, style)` scales a single token by a
multiplier (`aggressive 0.5`, `standard 1`, `gentle 2`), preserving sign and unit,
clamping to a floor of 1, and passing `+0h` and unparseable tokens through
unchanged. `scaleTiming` maps a whole plan. This is unit-tested and is how the
intake `timingStyle` reshapes any blueprint.

---

## 4. Frameworks (`frameworks/*`)

Nine per-email writing structures, each an `EmailFrameworkSpec`
(`label`, `structure`, `lengthTarget`, `styleNote`): `soap-opera`, `pas`,
`value-longform`, `story-lesson`, `quick-win`, `founder-note`, `case-study`,
`objection-crusher`, `listicle`. `frameworkSpec()` resolves one with a safe
`story-lesson` fallback. The generator injects the chosen framework's structure +
length + style into the per-email expand prompt.

---

## 5. Generator (`openai-email.ts`, server-only)

The blueprint is authoritative and built **deterministically in code** — the model
never decides how many emails to write or what each is for. Four passes, all
JSON-mode with an Anthropic fallback and the shared `VOICE_RULES`:

- `buildSkeleton(campaign, framework, timingStyle)` — one `EmailMessage` per role,
  in order, with scaled offsets and the resolved per-role framework; copy empty.
- `aiFillIntake` — flesh a thin brief into a complete intake (keeps owner values,
  only fills/sharpens blanks via `pruneEmpty`).
- `aiOutline` — write routing copy only (subject, preview, one-line summary) for
  the fixed skeleton; merged back by id with positional fallback.
- `aiExpandEmail` — write one email's body (plain text: blank-line paragraphs,
  `- ` bullets), subject ideas, and CTA, given the whole outline so emails don't
  repeat each other.
- `aiGenerateSequence` — outline, then expand every email sequentially so later
  emails see the full outline. Short-circuits on the first failing pass.

Context packs are resolved **server-side** from `contextRefs` (never trusted from
the client) via `resolveContextRefs` and injected with
`contextPacksToPromptBlock(packs, 'content')`.

---

## 6. Export (`export.ts`, pure)

`bodyText` is the source of truth; HTML is derived from it so the two never drift.

- `sequenceToText` / `emailToText` — copy-paste plain-text bundle.
- `renderEmailHtml` / `sequenceToHtml` — inline-styled, escaped HTML for pasting
  into an ESP (blank lines → `<p>`, `- ` runs → `<ul>`, CTA → styled `<a>`).
- `renderSequenceHtml` — repopulates every `bodyHtml` from its `bodyText`; the CRUD
  route calls this on **every save** so stored HTML never drifts.
- `sequenceToRows` — one flat row per email for a scheduler/ESP CSV import.
- `campaignArcSummary` — human one-liner of a campaign's arc for editor headers.

All escaping is centralized in `escapeHtml`; the test suite asserts `<script>` in a
body is neutralized.

---

## 7. Routes

**AI** — `POST /api/mothermode/email-ai` (admin-only): action switch over
`fillIntake` → `{intake}`, `outline` → `{sequence}`, `expand` → `{email}`,
`generate` → `{sequence}`. Resolves `contextRefs` to packs for the last three.

**CRUD** — `/api/admin/mothermode-email` (admin-only): `GET` lists all kits
(`{success, admin, items}`), `POST` upserts (re-renders sequence HTML from text,
returns `{success, item}`, friendly duplicate-slug message), `DELETE ?id=`
removes. Both revalidate `/admin/email-marketing`.

Admin nav: an "Email Marketing Kit" link in `AdminSidebar.tsx` between Lead Gen
and Funnel Stats.

---

## 8. Port order

1. Ensure the **context bridge** is present first
   (`OFFER_KIT_CONTEXT_BRIDGE_SYSTEM_PORT.md`) — the kit depends on `ContextRef`,
   `resolveContextRefs`, and `contextPacksToPromptBlock`.
2. Apply migration `20260730000000_mothermode_email_kits.sql`.
3. Port `email/types.ts` → `campaigns/index.ts` → `frameworks/*` → `export.ts`
   (all pure), then `store.ts`, then the `index.ts` barrel.
4. Port `openai-email.ts`, then the two routes, then the admin page + editor, then
   the sidebar link.
5. Bring `tests/lib/email-kit.test.ts` and run it plus `tsc --noEmit`.

### Verification
- `npx tsc --noEmit` exits 0.
- `npx vitest run tests/lib/email-kit.test.ts` — 13 green (normalizers,
  campaign/framework fallbacks, timing scaling, text/HTML/CSV renderers incl.
  HTML escaping).
- Generate produces on-voice sequences; save round-trips HTML from text; the
  plain-text and CSV exports open cleanly in the target ESP/scheduler.

---

## 9. Advanced editor features (companion guide)

After the base kit shipped, six capabilities were layered onto the editor and
generator. They are documented in full in **`EMAIL_KIT_ADVANCED_FEATURES_PORT.md`**;
summary:

1. **Rich-text (TipTap) bodies** — `KitRichTextField` emits HTML; `richtext.ts`
   (`htmlToPromptText`) + `clampPack()` flatten it at the prompt/export boundaries.
2. **Body format + length controls** — `bodyFormat` (`text|html`) and `bodyLength`
   (`default|short|long`), global + per-email, threaded through every AI call.
3. **Branching** — `branch: EmailBranchCondition` + `parentId` on each email;
   default `always`/`null` keeps linear sequences valid.
4. **Sequence extension / deep-nurture** — `aiExtendSequence` + route
   `action:'extend'`; plus "add one email" with full look-back.
5. **Per-email Image Studio** — `EmailImageStudio.tsx` + `images: string[]`;
   reuses the shared `/api/mothermode/ai` image actions (no migration).
6. **P.S. selling frameworks** — `EMAIL_PS_FRAMEWORKS` + `psFramework` per email;
   soft-sell P.S. bolt-on driven by generator guidance blocks.

None require a migration — every field rides in the existing `sequence` JSONB.


