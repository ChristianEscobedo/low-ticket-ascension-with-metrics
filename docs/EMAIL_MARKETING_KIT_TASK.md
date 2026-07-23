# Email Marketing Kit — Task Spec

Scoped, build-ready spec for an **Email Marketing Kit** generator: an admin tool
that, from a short intake plus one or more attached **context sources** (an offer,
a generated lead magnet, a high-ticket offer, a community kit), produces a
complete, **outcome-based email sequence** — every email written toward a single
programmatic goal (opt-in nurtured to a low-ticket purchase, cart recovered,
webinar attended, community member activated, etc.). Each email is generated in a
chosen **campaign framework** (Soap Opera, PAS, value-forward long-form, etc.),
rendered as **brand-styled HTML** as well as plain text, saved as an editable,
regenerable kit, and exported to the email/CRM tools already wired into the suite
(GHL, CSV). Written so it can be handed to a fresh task and built without further
discovery.

It is the **campaign-producing sibling of the Lead Gen / High Ticket / Community
kits** — same two backbone patterns, same file layout, same editor UX — with two
new capabilities layered on:
1. It is **sequence-shaped** (an ordered list of emails with send-timing and a
   per-email framework) rather than a single document.
2. It is **context-native**: it is the first kit built directly on the shared
   **Offer ⇄ Kit Context Bridge** (`src/lib/mothermode/context/*`,
   `OFFER_KIT_CONTEXT_BRIDGE_SYSTEM_PORT.md`), so a sequence is generated *around*
   whatever resource(s) the admin attaches.

Reuse the shipped kits and shared systems as reference implementations rather than
inventing anything:
1. **DB-backed admin CRUD** with service-role writes and admin-guarded routes —
   see `LEAD_GEN_KIT_TASK.md`, `HIGH_TICKET_KIT_TASK.md`,
   `COMMUNITY_KIT_SYSTEM_PORT.md`.
2. **Server-only JSON-mode AI generation** behind an action-switch route —
   see `src/utils/integrations/openai-leadgen.ts` +
   `src/app/api/mothermode/leadgen-ai/route.ts` (base pattern in
   `openai-content.ts` / `CONTENT_GENERATE_SYSTEM_PORT.md`).
3. **Context injection** — the shared `ContextRef` → `resolveContextRefs()` →
   `contextPacksToPromptBlock(packs, 'content')` path
   (`OFFER_KIT_CONTEXT_BRIDGE_SYSTEM_PORT.md`). The kit stores `contextRefs`;
   the generator resolves them at generation time.
4. **Exports** — the existing content export layer for GHL / CSV
   (`src/lib/mothermode/content/export/*`, `CONTENT_EXPORT_SYSTEM.md`) and the
   client print-window PDF/HTML path used by the other kit editors.

> No code has been written for this yet. This doc is the plan. Register it in
> `MOTHERMODE_CONTENT_SUITE_MASTER_PORT.md` (feature map, PLANNED), with
> `EMAIL_MARKETING_KIT_SYSTEM_PORT.md` to be authored once built.

---

## 1. Goal

An admin fills a short intake, attaches the resource(s) the campaign is about,
picks a **campaign type** (the outcome) and a **framework** (the writing style),
and the tool generates a complete, outcome-driven email sequence, then lets them
edit and regenerate any part and ship it:

1. **Campaign type picker** — choose the outcome/journey (see §3 campaign
   library). The type determines the **sequence blueprint**: how many emails,
   their roles (e.g. deliver → nurture → soft pitch → hard pitch → last call),
   and default send-timing offsets.
2. **Framework picker** — choose the writing framework applied per email or across
   the sequence (see §4 framework library): Soap Opera, PAS, value-forward
   long-form, story-driven, "quick win" short-form, etc.
3. **Context attach** — attach 0..N `ContextRef`s (an offer, its bonuses, a lead
   magnet, a high-ticket offer, a community kit) so the copy is grounded in that
   resource's promise, audience, mechanism, price, bonuses. This is the core of
   "connect the context of the offers and/or generated lead magnets or high
   ticket".
4. **Sequence outline** — an ordered, editable list of emails, each with a
   `role`, `sendOffset` (e.g. `+0h`, `+1d`, `+2d`), `subjectIdeas`, and a one-line
   `summary`. Editable before body generation so the admin steers arc and pacing.
5. **Email bodies** — each outline email expanded into full copy: subject line +
   preview text + body, in the chosen framework, with a clear single CTA that
   points to the campaign's goal (opt-in confirm, buy, register, join, book).
6. **Styled HTML + plain text render** — each email assembled into brand-styled,
   email-safe **inline-CSS HTML** (§7) and a plain-text fallback, previewed in the
   editor.
7. **Export / ship** — copy all, export to **GHL** and **CSV** via the existing
   export layer, and export a styled HTML file per email (§8).

All of it saves to Supabase as one kit record and is fully editable in the admin,
with per-email **Regenerate**, per-email **Copy**, **Rewrite in framework X**,
add/remove/reorder emails, retime sends, **Preview**, and **Export**.

Non-goals for round 1: actually sending email (we export to the ESP/CRM), live
A/B test orchestration, deliverability scoring, image generation inside email
bodies (cover/hero image optional via existing `aiGenerateImage`), and real-time
provider sync back.

---

## 2. Reuse these existing patterns

- **Auth**: every admin route guards with `requireAdminRoute()`. CRUD routes
  return `{ success, admin, items }`; the generation route returns `{ ok, ... }`
  like `/api/mothermode/leadgen-ai`.
- **DB access split**: a `store.ts` with a lazy service-role client (admin reads +
  all writes), every function `try/catch` → safe empty. Copy
  `src/lib/mothermode/leadgen/store.ts` and rename the table.
- **AI generation**: one server integration module using the same key handling and
  JSON-mode call pattern as `openai-leadgen.ts`; the route validates input and
  delegates. Never call the model from the browser.
- **Context**: import `resolveContextRefs` from
  `@/lib/mothermode/context/resolve` (server only) and
  `contextPacksToPromptBlock` from `@/lib/mothermode/context/prompt`. Store refs
  with the browser-safe `normalizeContextRefs` from `@/lib/mothermode/context`.
- **Voice rules** apply to every generated string: no em dashes, no en dashes, no
  NO-list words (mama, thrive, journey, hustle, empower, balance, girlboss, etc.),
  periods over exclamation points, restraint on hype. Reuse `VOICE_RULES` from
  `content/constants.ts` and run the compliance scan (§10).
- **Exports**: reuse `src/lib/mothermode/content/export/*` (GHL basic/advanced,
  CSV, text) — email rows map cleanly onto the existing schedule/export shape.
- **Admin editor UX**: copy `src/app/admin/lead-gen/LeadGenEditor.tsx` (intake
  form, generate wizard, per-section cards with Regenerate/Copy, Preview, Export)
  and adapt the section list into an **email list with send-timing**.
- **Admin nav**: add `{ href: '/admin/email', label: 'Email Marketing Kit' }` to
  the `NAV` array in `src/app/admin/AdminSidebar.tsx`.

---

## 3. Campaign library (the sequence blueprints)

Put each campaign type as a typed data module under
`src/lib/mothermode/email/campaigns/`, aggregated by `campaigns/index.ts` into a
single `EMAIL_CAMPAIGNS` record keyed by an `EmailCampaignType` enum — exactly
like `leadgen/formats/index.ts`. Each campaign describes the **sequence blueprint
the generator must follow** (email count range, ordered email roles, default
send-offsets, the outcome/goal statement, and which context kinds it expects) plus
a short strategy note. The model fills specifics; it does not invent the arc.

| Campaign key | Label | Outcome / goal | Blueprint (ordered email roles) |
|--------------|-------|----------------|----------------------------------|
| `leadmag-to-lowticket` | Lead magnet → low-ticket | Opt-in buys the low-ticket offer | Deliver asset, quick win, bridge asset→offer, offer intro, objection/FAQ, soft pitch, last call |
| `nurture-to-offer` | Outcome nurture → offer | Cold/warm list nurtured to an offer | Hook, story, teach, reframe belief, proof, offer, urgency close |
| `cart-abandonment` | Cart abandonment | Recover an abandoned checkout | Reminder, remove friction/FAQ, proof/reassurance, scarcity, final call |
| `pre-post-purchase` | Before & after purchase | Warm buyer, deliver, ascend to next offer | Pre-purchase primer, purchase confirmation, onboarding/quick win, results check-in, next-offer ascension |
| `webinar-event` | Webinar / workshop / event | Register and attend, then convert | Invite, register confirm, value tease, day-before, 1-hour-before, live/now, replay, replay-expiring, post-event offer |
| `community-onboarding` | Community post-join | Activate a new community member to an outcome | Welcome, orient/first action, connect/introduce, first win, habit loop, invite to next step |
| `event-nurture` | Nurture to a live event | Drive registrations to an event | Announce, why-attend, agenda/speakers, social proof, deadline, last chance |
| `reengagement` | Re-engagement / win-back | Wake a cold segment | Pattern interrupt, "still want this?", best-of value, soft reactivation offer |

Each module exports a plain object
(`{ label, goal, expectsContext: EmailContextKind[], emailRoles: EmailRole[], defaultTiming: string[], strategyNote }`).
Keep them **data**, not prose in the route, so they are easy to tune without
touching logic. Stub any owner-supplied campaign playbooks with
`// TODO: owner playbook` markers if not yet provided so the build compiles.

---

## 4. Framework library (the per-email writing styles)

Put each framework as a typed data module under
`src/lib/mothermode/email/frameworks/`, aggregated by `frameworks/index.ts` into
`EMAIL_FRAMEWORKS` keyed by an `EmailFramework` enum. Each describes the
**writing structure** the model applies to a single email plus a length target.

| Framework key | Label | Structure the generator follows | Length |
|---------------|-------|----------------------------------|--------|
| `soap-opera` | Soap opera | Open loop, backstory, drama/tension, epiphany, cliffhanger into next email | medium |
| `pas` | PAS | Problem, agitate, solve → CTA | short/medium |
| `value-longform` | Value-forward long-form | Teach a complete idea/framework, then soft CTA | long |
| `story-lesson` | Story → lesson | Personal/customer story, extract the lesson, tie to offer | medium |
| `quick-win` | Quick win | One tip + one action + one CTA, scannable | short |
| `founder-note` | Founder note | Plain, personal, direct note from FOUNDER | short/medium |
| `case-study` | Case study / proof | Before, intervention, after, "you can too" CTA | medium |
| `objection-crusher` | Objection crusher | Name the objection, reframe, evidence, CTA | medium |
| `listicle` | Listicle | Numbered value points, each with micro-CTA, close | medium |

A campaign may set a **default framework per email role** and allow the admin to
override any single email's framework. Each module exports
`{ label, structure, lengthTarget, styleNote }` for prompt injection.

---

## 5. Data model (new migration)

Create `supabase/migrations/2026XXXXXXXXXX_mothermode_email_kits.sql`. One table
holds the intake, attached context refs, and the whole sequence as JSONB (mirrors
`mothermode_lead_gen_kits`):

```sql
create table if not exists mothermode_email_kits (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null default '',            -- campaign name
  campaign_type text not null default 'nurture-to-offer', -- EmailCampaignType key
  framework     text not null default 'story-lesson',      -- default EmailFramework
  status        text not null default 'draft',              -- draft | active | archived
  intake        jsonb not null default '{}'::jsonb,          -- audience, goal, tone, sender, timing prefs
  context_refs  jsonb not null default '[]'::jsonb,          -- ContextRef[] (offers/kits attached)
  sequence      jsonb not null default '{}'::jsonb,          -- the generated EmailSequence (see §6 shape)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    text
);
create index if not exists idx_email_kits_status on mothermode_email_kits (status, updated_at desc);

alter table mothermode_email_kits enable row level security;
-- Admin-only production tool: no anon policies. Service role bypasses RLS.
create policy "Service role full access mothermode_email_kits" on mothermode_email_kits
  for all to service_role using (true) with check (true);
```

Store `context_refs` as **references, not resolved packs**, so the sequence always
reflects the current offer/kit at generation time and cannot be spoofed (per the
context-bridge design). Store `sequence` as JSONB so the shape can evolve.

---

## 6. Types + store + export

`src/lib/mothermode/email/types.ts` — the domain types. Suggested shape (mirror
`leadgen/types.ts`: enums + option arrays, pure normalizers, row mappers):

```ts
export type EmailKitStatus = 'draft' | 'active' | 'archived';

export type EmailCampaignType =
  | 'leadmag-to-lowticket' | 'nurture-to-offer' | 'cart-abandonment'
  | 'pre-post-purchase' | 'webinar-event' | 'community-onboarding'
  | 'event-nurture' | 'reengagement';

export type EmailFramework =
  | 'soap-opera' | 'pas' | 'value-longform' | 'story-lesson'
  | 'quick-win' | 'founder-note' | 'case-study' | 'objection-crusher' | 'listicle';

export type EmailRole =
  | 'deliver' | 'nurture' | 'teach' | 'story' | 'proof' | 'bridge'
  | 'offer' | 'objection' | 'urgency' | 'last-call' | 'welcome'
  | 'onboard' | 'reminder' | 'invite' | 'replay' | 'reengage';

export interface EmailKitIntake {
  audience: string;          // who receives it
  goal: string;              // the programmatic outcome (buy, register, activate)
  senderName?: string;       // defaults to FOUNDER
  tone?: string;
  offerSlug?: string;        // convenience; also expressible as a ContextRef
  timingStyle?: 'aggressive' | 'standard' | 'gentle'; // scales send-offsets
  notes?: string;
}

export interface EmailMessage {
  id: string;                // stable id for per-email regen
  role: EmailRole;
  framework: EmailFramework; // per-email (defaults to kit framework)
  sendOffset: string;        // e.g. '+0h', '+1d', '+2d'
  subject: string;
  subjectIdeas?: string[];   // alt subject lines
  preview: string;           // inbox preview text
  bodyText: string;          // plain-text body (source of truth)
  bodyHtml?: string;         // rendered styled HTML (§7), regenerated from bodyText
  cta: { label: string; url?: string };
  summary?: string;          // one-line, used in outline
}

export interface EmailSequence {
  name: string;
  goal: string;
  emails: EmailMessage[];    // outline first (empty bodies), then expanded
}

export interface EmailKitRecord {
  id: string;
  slug: string;
  name: string;
  campaignType: EmailCampaignType;
  framework: EmailFramework;
  status: EmailKitStatus;
  intake: EmailKitIntake;
  contextRefs: ContextRef[]; // from @/lib/mothermode/context
  sequence: EmailSequence;
  updatedAt?: string | null;
  updatedBy?: string | null;
}
```

Add pure normalizers (`normalizeIntake`, `normalizeSequence`, `toEmailKitStatus`,
`toEmailCampaignType`, `toEmailFramework`, `blankIntake`, `blankSequence`) and a
`rowToEmailKit(row)` mapper (snake_case ↔ camelCase, JSONB guard, run
`normalizeContextRefs` on `context_refs`). Unit-test them
(`tests/lib/email-mappers.test.ts`), matching `tests/lib/lead-gen-mappers.test.ts`.

`src/lib/mothermode/email/store.ts` (copy `leadgen/store.ts`):
- `listKitsForAdmin()`, `getKitById(id)`, `getKitBySlug(slug)`, `upsertKit(input)`,
  `deleteKit(id)` — service-role, `try/catch` → `[]`/`null`, `updated_at` stamped
  on write, `onConflict: 'id'`.

`src/lib/mothermode/email/export.ts` — renderers (all pure, DOM-free where noted):
- **`sequenceToText(sequence)` / `emailToText(email)`** — markdown for clipboard
  and the mapper tests.
- **`emailToStyledHtml(email, brand)`** — brand-styled, **email-safe inline-CSS**
  HTML for one email (§7). Not the deliverables `doc()` shell (that is page CSS,
  not inbox-safe) — build a small table-based, inline-styled email template.
- **`sequenceToExportRows(kit)`** — map each `EmailMessage` to the row shape the
  existing content export layer consumes (subject, body, send-offset → schedule),
  so **GHL** and **CSV** exports reuse `content/export/*` with no new plumbing.
  Confirm the GHL exporter's expected columns in `content/export/ghl-*.ts` and map
  onto them.

---

## 7. Styled HTML emails

Email HTML is **not** web-page HTML: many clients strip `<style>` blocks and
external CSS. So build a dedicated, minimal, **inline-styled, table-based**
template rather than reusing `deliverables/kit.ts`:
- One `emailToStyledHtml(email, brand)` helper produces a self-contained document:
  a centered container table, brand colors/fonts inlined on each element, a hero
  (optional image via `aiGenerateImage`), the body rendered from `bodyText`
  (paragraphs, lists, a single prominent CTA button styled inline), and a footer
  (sender, unsubscribe placeholder token the ESP fills).
- Keep width ~600px, use `<table role="presentation">` layout, inline every style,
  and avoid unsupported CSS. Provide light spacing and a bulletproof button.
- The editor **Preview** renders this HTML in an iframe. **Export HTML** downloads
  one `.html` per email (or a zip); the styled HTML also rides along in the GHL
  export where the field supports HTML bodies.
- `bodyText` remains the source of truth; `bodyHtml` is derived, so editing text
  and re-rendering is deterministic and testable.

---

## 8. AI generation (server) + routes

Sequences generate in **stages** so long value-forward emails stay coherent and
within token limits, exactly like the lead-gen staged approach.

`src/utils/integrations/openai-email.ts` — mirror `openai-leadgen.ts` (same key
resolution, JSON-mode request, `{ ok, data | error, status }` return). Export:
- `fillEmailIntake(seed)` → expand an audience/goal seed into a full
  `EmailKitIntake` for review.
- `generateSequenceOutline(intake, campaignType, framework, contextBlock)` →
  returns an `EmailSequence` whose emails have `role`, `sendOffset`,
  `subjectIdeas`, `summary`, and **empty bodies**, following the §3 blueprint and
  scaling timing by `intake.timingStyle`.
- `expandEmail(intake, framework, email, priorSummaries, contextBlock)` → fills one
  email's `subject`, `preview`, `bodyText`, `cta` in the chosen framework.
  `priorSummaries` gives continuity so open loops (soap opera) pay off and emails
  do not repeat.
- `expandAll(intake, sequence, contextBlock)` → sequential, bounded loop over
  `expandEmail` for a one-click full build.
- `regenerateEmail(intake, framework, email, contextBlock)` → re-expand one email,
  returning a patch merged by `email.id`.
- `rewriteEmailInFramework(email, framework, contextBlock)` → restyle an existing
  email into a different framework, preserving its role and CTA.

**Context injection**: every prompt receives `contextBlock` =
`contextPacksToPromptBlock(await resolveContextRefs(kit.contextRefs), 'content')`,
plus the §3 campaign blueprint, the §4 framework structure, and `VOICE_RULES`. The
route resolves refs (server only); the generator stays pure over the block string
so it is unit-testable.

Generation route `src/app/api/mothermode/email-ai/route.ts` (admin-guarded,
`runtime = 'nodejs'`, `dynamic = 'force-dynamic'`) with an action switch:
- `action: 'fillIntake'` → `{ ok, intake }`.
- `action: 'outline'` → `{ ok, sequence }` (roles/timing/subjects, empty bodies).
- `action: 'expandEmail'` → `{ ok, email }`.
- `action: 'expandAll'` → `{ ok, sequence }`.
- `action: 'regenerate'` → `{ ok, email }`.
- `action: 'rewrite'` → `{ ok, email }` (framework restyle).
Resolve `body.contextRefs` (or the saved kit's refs) once per request and thread
the block into every action. Keep the 400/500 JSON error shapes used elsewhere.

CRUD route `src/app/api/admin/mothermode-email/route.ts`:
- `GET` → `{ success, admin, items }`.
- `POST` → validate + `upsertKit`, `updatedBy` from the guard identity,
  `revalidatePath('/admin/email')`, return `{ success, item }`.
- `DELETE ?id=…` → `deleteKit`, revalidate, `{ success }`.

---

## 9. Admin UI (`/admin/email`)

Add the `AdminSidebar` NAV entry, then:
- `src/app/admin/email/page.tsx` — server wrapper (`force-dynamic`, admin-gated)
  loading `listKitsForAdmin()`.
- `src/app/admin/email/EmailEditor.tsx` — client, copied from `LeadGenEditor.tsx`.
  Left: kit list (name + campaign type + status). Right: master/detail with:
  - **Intake form** (audience, goal, sender, tone, timing style, notes) +
    **campaign type picker** + **framework picker** + **AI fill intake**.
  - **Context attach** panel: a picker that lists offers (+ their bonuses), lead
    magnets, high-ticket offers, and community kits, adding each as a `ContextRef`
    chip (kind + label). Reuse the browser-safe adapters/labels; store refs on the
    kit. This is the "connect the context" surface.
  - **Generate Outline** → editable email list (add/remove/reorder emails, edit
    role, send-offset, subject ideas, summary). The pacing/arc control step.
  - **Expand** per email (`expandEmail`) and **Expand all** (`expandAll`) with
    progress; each email card shows subject + preview + body editable inline, plus
    **Regenerate**, **Copy**, **Rewrite in framework…**, and a per-email framework
    override.
  - **Preview** (render `emailToStyledHtml` into an iframe), **Export** (Copy all,
    GHL, CSV, download styled HTML), status select, save (CRUD `POST`), delete.
    Reuse the save/dirty scaffolding already in `LeadGenEditor.tsx`.

---

## 10. Verification

- `npx tsc --noEmit` exits 0.
- Migration applies; admin (service role) can CRUD; no anon access to
  `mothermode_email_kits`.
- Generate round trip: intake + campaign type + framework + attached context →
  outline → expand → a coherent, on-goal sequence where every email drives the
  campaign's single outcome; save → reload shows the same sequence.
- **Context grounding**: attach an offer (or lead magnet / high-ticket) and the
  copy reflects that resource's promise/price/bonuses and never contradicts it;
  removing the ref and regenerating removes its influence; deleting a referenced
  kit degrades gracefully (ref dropped).
- **Campaign coverage**: each §3 type produces its expected email roles and timing
  (cart abandonment recovers a checkout; webinar covers invite→replay→post-event;
  community-onboarding activates toward an outcome; pre/post-purchase ascends).
- **Framework coverage**: switching a single email's framework visibly changes its
  structure (soap-opera opens/pays off a loop; PAS is problem-agitate-solve;
  value-longform teaches a full idea).
- **Styled HTML**: `emailToStyledHtml` renders on-brand in Preview and is
  inline-styled/table-based (inbox-safe); text and HTML stay in sync.
- **Export**: GHL and CSV exports produce valid rows via `content/export/*`;
  send-offsets map to the schedule; styled HTML downloads per email.
- Regenerate one email leaves the others untouched; Rewrite preserves role + CTA.
- Voice-rule / compliance scan over every generated string (no em/en dashes, no
  exclamation points, no NO-list words). Reuse the content compliance scan.
- Mapper unit test green (`tests/lib/email-mappers.test.ts`), incl.
  `normalizeContextRefs` on load.

---

## 11. Build order (for the fresh task)

1. `campaigns/*` (+ `campaigns/index.ts`) and `frameworks/*` (+ index) data
   modules with the §3/§4 blueprints (stub owner playbooks with TODO markers).
2. Migration + RLS (§5).
3. `email/types.ts` + normalizers + mappers (+ test), `email/store.ts`,
   `email/export.ts` (`sequenceToText`, `emailToStyledHtml`,
   `sequenceToExportRows`).
4. `openai-email.ts` generator (`fillEmailIntake`, `generateSequenceOutline`,
   `expandEmail`, `expandAll`, `regenerateEmail`, `rewriteEmailInFramework`) with
   campaign + framework + context + `VOICE_RULES` injection and staged generation.
5. Generation route `/api/mothermode/email-ai` (resolves context refs) + CRUD route
   `/api/admin/mothermode-email`.
6. `AdminSidebar` NAV + `/admin/email` editor (intake + campaign + framework +
   context attach + outline + expand + email cards + regenerate/copy/rewrite +
   preview + export).
7. Wire exports through `content/export/*` (GHL, CSV) and the styled-HTML download.
8. Optional: hero image via `aiGenerateImage`; optional per-sequence PDF proof.
9. Verify per §10.

---

## 12. Port-doc follow-up

When built, author `docs/EMAIL_MARKETING_KIT_SYSTEM_PORT.md` (mirror
`LEAD_GEN_KIT_SYSTEM_PORT.md`) and add this feature's row in
`MOTHERMODE_CONTENT_SUITE_MASTER_PORT.md` as built, listing the migration name, the
campaign + framework modules, the two routes, the staged context-aware generator,
the editor, the export hand-off (GHL/CSV/HTML), and the env note (no new keys
beyond `OPENAI_API_KEY` + `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_*`).
Cross-link from `OFFER_KIT_CONTEXT_BRIDGE_SYSTEM_PORT.md` (this is its first
first-class consumer) and `CONTENT_EXPORT_SYSTEM.md`.
