# Lead Gen Kit — Task Spec

Scoped, build-ready spec for a **Lead Gen Kit** generator: an admin tool that,
from a short intake, produces a complete **lead magnet** as a long-form,
brand-styled document, then saves it as an editable, regenerable kit that can be
exported as a styled PDF and published into the buyer-facing **deliverables**
area. Written so it can be handed to a fresh task and built without further
discovery.

It is the **document-producing sibling of the High Ticket Kit / Community Kit** —
same two backbone patterns, same file layout, same editor UX — with one new
capability layered on: it emits **ultra-long-form documents** across many
lead-magnet formats (ebooks, guides, cheat sheets, SOPs, courses / trainings /
mini-courses, templates, checklists, worksheets, swipe files) and renders them
through the existing **deliverables HTML builder** (`deliverables/kit.ts`) so the
output is on-brand and print-ready.

Reuse the just-shipped kits and the deliverables system as reference
implementations rather than inventing anything:
1. **DB-backed admin CRUD** with service-role writes and admin-guarded routes —
   see `HIGH_TICKET_KIT_TASK.md`, `COMMUNITY_KIT_SYSTEM_PORT.md`,
   `HELP_CENTER_SYSTEM_PORT.md`.
2. **Server-only JSON-mode AI generation** behind an action-switch route —
   see `src/utils/integrations/openai-highticket.ts` +
   `src/app/api/mothermode/highticket-ai/route.ts` (base pattern in
   `openai-content.ts` / `CONTENT_GENERATE_SYSTEM_PORT.md`).
3. **Brand-styled document rendering + delivery** — see
   `DELIVERABLES_RESOURCES_SYSTEM_PORT.md`, the block builders in
   `src/lib/mothermode/deliverables/kit.ts` (`doc`, `h1`, `h2`, `lead`, `p`,
   `ul`, `checklist`, `divider`, `pullQuote`, `note`, `nextStep`), the catalog in
   `deliverables/index.ts`, and the override store in `deliverables/store.ts`.

> No code has been written for this yet. This doc is the plan. Register it in
> `MOTHERMODE_CONTENT_SUITE_MASTER_PORT.md` (feature map, PLANNED), with
> `LEAD_GEN_KIT_SYSTEM_PORT.md` to be authored once built.

---

## 1. Goal

An admin fills a short intake, picks a **lead-magnet format**, and the tool
generates a complete, long-form, brand-styled document, then lets them edit and
regenerate any part and ship it:

1. **Format picker** — choose the lead-magnet type (see §3 format library). The
   format determines the document skeleton the generator fills.
2. **Outline** — a titled, ordered list of sections (and, for courses, modules →
   lessons). Editable before expansion so the admin steers scope.
3. **Long-form body** — each outline section expanded into full styled content.
   This must support **ultra-long-form ebooks** (many sections, thousands of
   words) by generating **section-by-section** rather than in one call (§6).
4. **Front / back matter** — cover (title, subtitle, author = FOUNDER), intro /
   hook, table of contents, and a closing **CTA** block that points to the next
   step (book a call / join / buy), reusing the offer's positioning.
5. **Styled HTML render** — the whole document assembled through
   `deliverables/kit.ts` builders into one brand-styled `html` string, previewed
   in the editor and exportable as **PDF** (§7).
6. **Publish to Deliverables** — one action promotes the finished document into
   the deliverables area as a `DeliverableDoc` override (`mothermode_deliverables`
   keyed by `slug` + `key`) so a buyer opens it at
   `/mothermode/resource/[slug]/[key]` (§8). This is the "add into the deliverable
   areas" requirement.

All of it saves to Supabase as one kit record and is fully editable in the admin,
with per-section **Regenerate**, per-section **Copy**, **Expand** (grow a thin
section into more depth), **Preview**, **Export PDF**, and **Publish to
Deliverables**.

Non-goals for round 1: multi-language, versioned document history, image
generation inside the document body (cover image optional via existing
`aiGenerateImage`), server-side headless-Chrome PDF (use the print-window path in
§7; a server render is an optional stretch).

---

## 2. Reuse these existing patterns

- **Auth**: every admin route guards with `requireAdminRoute()`. CRUD routes
  return `{ success, admin, items }`; the generation route returns `{ ok, ... }`
  like `/api/mothermode/highticket-ai`.
- **DB access split**: a `store.ts` with a lazy service-role client (admin reads
  + all writes), every function `try/catch` → safe empty. Copy
  `src/lib/mothermode/highticket/store.ts` and rename the table.
- **AI generation**: one server integration module using the same key handling
  and JSON-mode call pattern as `openai-highticket.ts`; the route validates input
  and delegates. Never call the model from the browser.
- **Voice rules** apply to every generated string: no em dashes, no en dashes,
  no NO-list words (mama, thrive, journey, hustle, empower, balance, girlboss,
  etc.), periods over exclamation points, restraint on hype. Reuse `VOICE_RULES`
  from `content/constants.ts` and run the compliance scan (§10).
- **Admin editor UX**: copy `src/app/admin/high-ticket/HighTicketEditor.tsx`
  (intake form, generate wizard, per-section cards with Regenerate/Copy, Copy
  all / Export PDF) and adapt the section list for outline → sections.
- **Styled HTML + delivery**: reuse `deliverables/kit.ts` builders for the render
  and `deliverables/store.ts` (`upsertDeliverable`) for the publish hand-off. Do
  **not** reinvent the brand CSS — `doc()` already wraps content in the branded
  shell used across every shipped resource.
- **Admin nav**: add `{ href: '/admin/lead-gen', label: 'Lead Gen Kit' }` to the
  `NAV` array in `src/app/admin/AdminSidebar.tsx`.

---

## 3. Format library (the lead-magnet skeletons)

Put each format as a typed data module under
`src/lib/mothermode/leadgen/formats/`, aggregated by `formats/index.ts` into a
single `LEAD_MAGNET_FORMATS` record keyed by a `LeadMagnetFormat` enum — exactly
like `community/frameworks/index.ts` / `highticket/frameworks/index.ts`. Each
format describes the **skeleton the generator must follow** (the model fills in
specifics, it does not invent the structure) plus a short authoring-style note.

| Format key | Label | Skeleton the generator fills |
|------------|-------|------------------------------|
| `ebook` | Ebook (ultra-long form) | Cover, intro/hook, 5-12 chapters each with 3-6 subsections, chapter recaps, closing CTA |
| `guide` | Guide / playbook | Intro, problem framing, step-by-step method, examples, pitfalls, CTA |
| `cheatsheet` | Cheat sheet | Tight scannable sections, bullet lists, quick-reference tables, one-page feel |
| `sop` | SOP (standard operating procedure) | Purpose, scope, roles, numbered procedure steps, checkpoints, definitions |
| `course` | Course / training | Modules → lessons; each lesson: objective, teaching body, action step, recap |
| `minicourse` | Mini-course | 3-5 short lessons with a single action each, fast-win framing |
| `template` | Template / fill-in | Instructions + reusable fill-in blocks (labeled placeholders) the buyer edits |
| `checklist` | Checklist | Grouped `checklist()` items with short intros per group |
| `worksheet` | Worksheet | Prompts + fillable slots (reuse `interactiveSlot` where a live widget exists) |
| `swipefile` | Swipe file | Categorized copy examples with usage notes |

Each module exports a plain object (`{ label, hint, skeleton, styleNote }`) the
generator concatenates into the system prompt (like `guides` in
`openai-content.ts`). Keep them **data**, not prose in the route, so they are
easy to tune without touching logic. This is also the natural place for any
owner-supplied lead-magnet frameworks; stub with `// TODO: owner framework`
markers if they are not yet provided so the build compiles.

---

## 4. Data model (new migration)

Create `supabase/migrations/2026XXXXXXXXXX_mothermode_lead_gen_kits.sql`. One
table holds the intake plus the whole structured document as JSONB (mirrors
`mothermode_high_ticket_kits`):

```sql
create table if not exists mothermode_lead_gen_kits (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null default '',            -- document title
  format       text not null default 'guide',        -- LeadMagnetFormat key
  status       text not null default 'draft',         -- draft | active | archived
  intake       jsonb not null default '{}'::jsonb,     -- topic, audience, goal, tone, length, offer/CTA
  doc          jsonb not null default '{}'::jsonb,     -- the generated document (see §5 shape)
  published_slug text,                                 -- deliverable slug when published (§8)
  published_key  text,                                 -- deliverable key when published (§8)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   text
);
create index if not exists idx_lead_gen_kits_status on mothermode_lead_gen_kits (status, updated_at desc);

alter table mothermode_lead_gen_kits enable row level security;
-- Admin-only production tool: no anon policies. Service role bypasses RLS.
-- Buyer delivery happens through mothermode_deliverables (already anon-readable
-- for published overrides), NOT this table, so no anon policy is needed here.
create policy "Service role full access mothermode_lead_gen_kits" on mothermode_lead_gen_kits
  for all to service_role using (true) with check (true);
```

Storing `doc` as JSONB keeps the block structure flexible while formats evolve;
type it in `types.ts` and normalize on write (reuse the High Ticket `normalizeKit`
idea). `published_slug` / `published_key` remember where a kit was pushed so
re-publishing overwrites the same deliverable rather than creating a duplicate.

---

## 5. Types + store + export

`src/lib/mothermode/leadgen/types.ts` — the domain types. Suggested shape
(mirror `highticket/types.ts`: enums + option arrays, pure normalizers, row
mappers):

```ts
export type LeadGenStatus = 'draft' | 'active' | 'archived';
export type LeadMagnetFormat =
  | 'ebook' | 'guide' | 'cheatsheet' | 'sop' | 'course'
  | 'minicourse' | 'template' | 'checklist' | 'worksheet' | 'swipefile';

export interface LeadGenIntake {
  topic: string;
  audience: string;         // who the magnet is for
  goal: string;             // the lead-gen job it does (opt-in, pre-frame, nurture)
  transformation?: string;  // promised outcome
  length?: string;          // e.g. 'short', 'standard', 'ultra' (drives section count)
  tone?: string;
  cta?: string;             // the next step it points to
  offerSlug?: string;       // optional link to an existing offer for positioning
  notes?: string;
}

// One content block within a section. `kind` maps to a deliverables/kit.ts builder.
export interface DocBlock {
  kind: 'lead' | 'p' | 'h3' | 'ul' | 'checklist' | 'note' | 'pullQuote' | 'nextStep' | 'template';
  text?: string;            // for text blocks
  items?: string[];         // for ul / checklist
  title?: string;           // for note / nextStep
}

export interface DocSection {
  id: string;               // stable id for per-section regen
  heading: string;          // rendered as h2
  summary?: string;         // one-line, used in outline + TOC
  blocks: DocBlock[];       // empty until expanded
  // For course/minicourse only: nested lessons render as h3 sub-blocks.
  lessons?: Array<{ title: string; blocks: DocBlock[] }>;
}

export interface LeadGenDoc {
  title: string;
  subtitle: string;
  hook: string;             // intro / lead paragraph
  sections: DocSection[];   // the outline, then expanded
  cta: { title: string; body: string; button?: string };
  coverImageUrl?: string;   // optional, via aiGenerateImage
}

export interface LeadGenKitRecord {
  id: string;
  slug: string;
  name: string;
  format: LeadMagnetFormat;
  status: LeadGenStatus;
  intake: LeadGenIntake;
  doc: LeadGenDoc;
  publishedSlug?: string | null;
  publishedKey?: string | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
}
```

Add pure normalizers (`normalizeIntake`, `normalizeDoc`, `toLeadGenStatus`,
`toLeadMagnetFormat`, `blankIntake`, `blankDoc`) and a `rowToLeadGenKit(row)`
mapper (snake_case ↔ camelCase, JSONB guard). Unit-test them
(`tests/lib/lead-gen-mappers.test.ts`), matching
`tests/lib/high-ticket-mappers.test.ts`.

`src/lib/mothermode/leadgen/store.ts` (copy `highticket/store.ts`):
- `listKitsForAdmin()`, `getKitById(id)`, `getKitBySlug(slug)`,
  `upsertKit(input)`, `deleteKit(id)` — service-role, `try/catch` → `[]`/`null`,
  `updated_at` stamped on write, `onConflict: 'id'`.

`src/lib/mothermode/leadgen/export.ts` — two renderers:
- **`docToText(doc)` / `sectionToText`** — plain markdown for clipboard copy and
  the mapper tests (pure, DOM-free), mirroring `highticket/export.ts`.
- **`docToDeliverableHtml(doc, format)`** — the important one: walk the
  `LeadGenDoc` and emit **brand-styled HTML by composing `deliverables/kit.ts`
  builders** (`doc(eyebrow(...), h1(title), lead(hook), ...sections..., nextStep(cta))`).
  Map each `DocBlock.kind` to its builder. This returns exactly the `html` shape a
  `DeliverableDoc` expects, so the same render feeds both the PDF export (§7) and
  the deliverables publish (§8). Add a `docToDeliverableDoc(kit)` helper that
  returns a full `DeliverableDoc { slug, key, title, subtitle, html }`.

---

## 6. AI generation (server) + route

Long documents cannot be produced in a single call. Generate in **stages** so
ultra-long-form ebooks stay coherent and within token limits:

`src/utils/integrations/openai-leadgen.ts` — mirror `openai-highticket.ts` (same
key resolution, JSON-mode request, `{ ok, data | error, status }` return).
Export:
- `fillLeadGenIntake(seed)` → expands a topic/audience/goal seed into a full
  `LeadGenIntake` for review before generation.
- `generateOutline(intake, format)` → returns `{ title, subtitle, hook, cta,
  sections: DocSection[] }` where each section has `heading` + `summary` but
  **empty `blocks`** (the skeleton is driven by the §3 format module).
- `expandSection(intake, format, section, priorHeadings)` → fills one section's
  `blocks` (and `lessons` for course formats) with full long-form content.
  `priorHeadings` is passed for continuity so sections do not repeat.
- `regenerateSection(intake, format, section)` → re-expand a single section,
  returning a patch to merge by `section.id`.
- `expandAll(intake, format, doc)` → convenience that loops `expandSection` over
  every section server-side (sequential, bounded) for a one-click full build.

Inject the §3 format skeleton, the offer positioning (if `offerSlug` given), and
`VOICE_RULES` into every system prompt. The outline prompt must respect the
requested `length` (map `short|standard|ultra` to target section counts). The
expand prompt must produce blocks that map cleanly to the allowed `DocBlock.kind`
set so the renderer never sees an unknown block.

Route `src/app/api/mothermode/leadgen-ai/route.ts` (admin-guarded, `runtime =
'nodejs'`, `dynamic = 'force-dynamic'`) with an action switch:
- `action: 'fillIntake'` → `{ ok, intake }`.
- `action: 'outline'` → `{ ok, doc }` (title/subtitle/hook/cta + empty sections).
- `action: 'expandSection'` → `{ ok, section }` (one filled section).
- `action: 'expandAll'` → `{ ok, doc }` (all sections filled).
- `action: 'regenerate'` → `{ ok, section }`.

Because `expandAll` can be slow, the editor may prefer to call `expandSection`
per card with progress; keep both. Keep the same 400/500 JSON error shapes used
across existing routes.

CRUD route `src/app/api/admin/mothermode-lead-gen/route.ts`:
- `GET` → `{ success, admin, items }` (all kits for the admin list).
- `POST` → validate + `upsertKit`, `updatedBy` from the guard identity,
  `revalidatePath('/admin/lead-gen')`, return `{ success, item }`.
- `DELETE ?id=…` → `deleteKit`, revalidate, `{ success }`.
- `POST ?action=publish` (or a dedicated `mothermode-lead-gen/publish` route) →
  render `docToDeliverableDoc(kit)`, call `upsertDeliverable(...)` from
  `deliverables/store.ts`, persist `published_slug` / `published_key` back on the
  kit, `revalidatePath('/mothermode/resource/[slug]/[key]')`, return
  `{ success, slug, key }`. See §8.

---

## 7. Styled PDF export

Reuse the client print-window path already used by the kit editors, but feed it
the **brand-styled deliverable HTML** (`docToDeliverableHtml`) instead of the
minimal markdown-to-HTML converter:
- In the editor, an **Export PDF** button opens a print window
  (`window.open`), writes the full styled HTML document (the `doc()` shell
  already includes the brand `<style>` / classes), waits for load, then calls
  `window.print()`. The user's browser "Save as PDF" produces the file. This is
  the same mechanism as `kitToPrintableHtml` in `community/export.ts`, just with
  richer, on-brand markup.
- Ensure the exported HTML is **self-contained**: inline the brand CSS in a
  `<style>` block (or ship a print stylesheet the print window links). Add
  `@media print` rules for page margins and page-break-inside avoidance on
  headings and `note`/`nextStep` blocks so long ebooks paginate cleanly.
- Optional stretch (call out, do not build round 1): a server route that renders
  the same HTML to a real PDF via a headless browser for a download link. Not
  required — the print-window path satisfies "styled html export as pdfs".

---

## 8. Publish into the Deliverables area (the hand-off)

This is the "add into the deliverable areas" requirement and the main new wiring
beyond the kit pattern.

- The deliverables system serves any `DeliverableDoc` keyed by `(slug, key)`. A
  code-catalog default (`deliverables/index.ts`) OR a DB override
  (`mothermode_deliverables`, written via `upsertDeliverable`) both resolve
  through `resolveDeliverable(slug, key)` at
  `/mothermode/resource/[slug]/[key]`.
- **Publish flow**: the editor's **Publish to Deliverables** action lets the
  admin choose the target `slug` (an existing offer slug, e.g.
  `brain-dump-system`) and a `key` (defaults to the kit slug). The publish route
  renders `docToDeliverableDoc(kit)` → `{ slug, key, title, subtitle, html }`,
  calls `upsertDeliverable`, and stores `published_slug` / `published_key` on the
  kit record so status shows "Published" and re-publishing overwrites in place.
- Because `mothermode_deliverables` already allows anon SELECT for published
  overrides, the buyer immediately sees the document at
  `/mothermode/resource/{slug}/{key}` with no further work. No new delivery
  surface is built — we ride the existing one.
- **Guardrail**: only publish keys the admin explicitly targets; do not silently
  overwrite an existing shipped resource. Show the current `title`/`customized`
  state (the deliverables `GET` already returns `customized`) before confirming.
- Optional: also expose the kit's raw markdown via the editor's Copy so an admin
  can paste into other tools.

---

## 9. Admin UI (`/admin/lead-gen`)

Add the `AdminSidebar` NAV entry, then:
- `src/app/admin/lead-gen/page.tsx` — server wrapper (`force-dynamic`,
  admin-gated) loading `listKitsForAdmin()`.
- `src/app/admin/lead-gen/LeadGenEditor.tsx` — client, copied from
  `HighTicketEditor.tsx`. Left: kit list (name + format + status). Right:
  master/detail with:
  - **Intake form** (topic, audience, goal, transformation, length, tone, CTA,
    optional offer link) + **format picker** + **AI fill intake**.
  - **Generate Outline** → editable outline list (add / remove / reorder
    sections, edit heading + summary). This is the scope-control step.
  - **Expand** per section (calls `expandSection`) and **Expand all**
    (`expandAll`) with progress; each section card shows its blocks editable
    inline, with **Regenerate**, **Copy**, and **Expand more** (grow depth).
  - **Front/back matter** fields (title, subtitle, hook, CTA block) and optional
    **cover image** via the existing `aiGenerateImage` client action.
  - **Preview** (render `docToDeliverableHtml` into an iframe/preview pane),
    **Export PDF** (§7), **Publish to Deliverables** (§8), status select, save
    (CRUD `POST`), delete. Reuse the save/dirty scaffolding already in
    `HighTicketEditor.tsx`.

---

## 10. Verification

- `npx tsc --noEmit` exits 0.
- Migration applies; admin (service role) can CRUD; no anon access to
  `mothermode_lead_gen_kits`.
- Generate round trip: intake + format → outline → expand → a coherent,
  format-appropriate long-form document; save → reload shows the same doc.
- **Ultra-long-form** check: an `ebook` at `length: 'ultra'` produces many
  sections and expands each without truncation or cross-section repetition
  (staged generation working).
- Regenerate one section leaves the others untouched; Expand grows a thin section.
- Styled render: `docToDeliverableHtml` output opens on-brand in Preview and
  prints to a clean, paginated PDF.
- Publish: **Publish to Deliverables** writes an override and the document is
  visible at `/mothermode/resource/{slug}/{key}`; re-publish overwrites the same
  `(slug, key)`; `published_slug`/`published_key` persist on the kit.
- Voice-rule / compliance scan over every generated string (no em/en dashes, no
  exclamation points, no NO-list words). Reuse the content compliance scan.
- Format injection works: swapping a `formats/*` module visibly changes the
  matching document's skeleton.
- Mapper unit test green (`tests/lib/lead-gen-mappers.test.ts`).

---

## 11. Build order (for the fresh task)

1. `formats/*` modules (+ `formats/index.ts`) with the §3 skeletons (stub owner
   frameworks with TODO markers if not supplied).
2. Migration + RLS (§4).
3. `leadgen/types.ts` + normalizers + mappers (+ test), `leadgen/store.ts`,
   `leadgen/export.ts` (`docToText`, `docToDeliverableHtml`,
   `docToDeliverableDoc`).
4. `openai-leadgen.ts` generator (`fillIntake`, `generateOutline`,
   `expandSection`, `expandAll`, `regenerateSection`) with format + `VOICE_RULES`
   injection and staged long-form generation.
5. Generation route `/api/mothermode/leadgen-ai` + CRUD route
   `/api/admin/mothermode-lead-gen` (incl. the publish action, §8).
6. `AdminSidebar` NAV + `/admin/lead-gen` editor (intake + format + outline +
   expand + section cards + regenerate/copy + preview + export PDF + publish +
   save).
7. Wire **Publish to Deliverables** through `deliverables/store.upsertDeliverable`
   and verify buyer delivery at `/mothermode/resource/[slug]/[key]`.
8. Optional: cover image via `aiGenerateImage`; optional server-side PDF render.
9. Verify per §10.

---

## 12. Port-doc follow-up

When built, author `docs/LEAD_GEN_KIT_SYSTEM_PORT.md` (mirror
`COMMUNITY_KIT_SYSTEM_PORT.md` / the high-ticket port) and add this feature's row
in `MOTHERMODE_CONTENT_SUITE_MASTER_PORT.md` as built, listing the migration
name, the format modules, the two routes (+ publish), the staged generator, the
editor, the deliverables hand-off, and the env note (no new keys beyond
`OPENAI_API_KEY` + `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_*`).
