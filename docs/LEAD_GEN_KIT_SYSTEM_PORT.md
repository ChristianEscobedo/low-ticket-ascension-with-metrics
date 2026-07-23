# Lead Gen Kit — AI Lead-Magnet Builder (System / Port Guide)

An admin-only production tool that turns a short intake into a complete,
buyer-ready lead magnet in any of ten formats (guide, ebook, checklist,
cheatsheet, worksheet, template, swipe file, SOP, course, mini-course). It
generates a structured document — title, subtitle, hook, N sections of typed
content blocks (and lessons for course formats), and a CTA — then publishes it
as brand-styled, self-contained HTML into the existing Deliverables/Resources
surface at `/mothermode/resource/<slug>/<key>`. This is the shipped version of
the plan in `LEAD_GEN_KIT_TASK.md`.

It fuses the three proven patterns in this codebase:

1. **DB-backed admin CRUD with service-role writes** — the Deliverables / Help
   Center / Community convention: `requireAdminRoute()`-guarded routes returning
   `{ success, admin, items }`, a service-role `store.ts`, `revalidatePath` after
   writes, and an `AdminSidebar` NAV entry.
2. **Server-only JSON-mode AI generation behind an action-switch route** — the
   `openai-highticket.ts` convention: one route, an `action` switch, JSON-mode
   OpenAI calls (Anthropic fallback) that never run on the client, and
   owner-supplied **format specs** injected into the system prompt.
3. **Multi-pass long-form generation** — outline first (skeleton only), then
   expand each section one at a time with the full outline for context, so even
   ultra-long-form ebooks stay coherent without blowing a single context window.

---

## 1. What it does

- **Intake → document**: the admin picks a **format** and enters a short brief
  (topic, audience, goal, transformation, **length**, tone, CTA, offer slug,
  notes). **AI: fill intake** expands a thin brief into a complete one.
- **Two generation modes**:
  - **Generate outline** — title/subtitle/hook + section headings & summaries +
    CTA, with empty bodies (the skeleton).
  - **Generate full document** — outline, then expand every section in order.
- **Per-section expand**: each section has its own **AI: expand** that fills its
  blocks (and lessons for course formats) given the whole outline for context —
  best for ultra-long-form, editing as you go.
- **Length drives two dimensions**:
  - **How many sections** (`sectionTarget`): short = 3–5, standard = 5–8,
    ultra = 8–12.
  - **How deep each section is** (`sectionDepth`): short = 2–4 blocks/~120–220
    words; standard = 4–6 blocks/~280–450 words; ultra = 7–12 blocks/~600–900
    words with subheadings, lists, notes, and worked examples. This is what makes
    `ultra` genuine long-form rather than a longer table of contents.
- **Full block editing**: add/move/remove sections; add/edit/remove typed blocks
  (`lead`, `p`, `h3`, `ul`, `checklist`, `note`, `pullQuote`, `nextStep`,
  `template`).
- **Styled preview**: a **Styled preview** toggle renders the exact buyer-facing
  HTML live inside the editor before publishing.
- **Export / publish**: **Copy text** (pure `docToText`), and **Publish document**
  which renders the doc to self-contained styled HTML and upserts it as a
  Deliverable at a chosen `(slug, key)`.
- **Persistence**: kits are saved/loaded/deleted via the admin CRUD route; the
  whole intake + doc are JSONB columns so shapes can evolve without a migration.

---

## 2. Files

```
supabase/migrations/20260725000000_mothermode_lead_gen_kits.sql   One table + admin-only RLS
src/lib/mothermode/leadgen/
  types.ts        LeadGenIntake / LeadGenDoc / DocSection / DocBlock / *Record + row types
                  + enums (LEAD_MAGNET_FORMATS, LEAD_GEN_LENGTHS, LEAD_GEN_STATUSES,
                  DOC_BLOCK_KINDS) + pure normalizers/blanks
  store.ts        service-role client + CRUD (listKitsForAdmin, getKitById/BySlug,
                  upsertKit, deleteKit, publish helper)
  export.ts       pure renderers: escapeHtml, docToText, LEAD_GEN_STYLES,
                  docToDeliverableHtml, docToDeliverableDoc
  formats/
    index.ts      formatSpec(format) + formatUsesLessons(format): single source of truth
    guide.ts / ebook.ts / checklist.ts / cheatsheet.ts / worksheet.ts /
    template.ts / swipefile.ts / sop.ts / course.ts / minicourse.ts
                  each: { label, hint, skeleton, styleNote, usesLessons }
src/utils/integrations/openai-leadgen.ts   Server-only generator
                  (aiFillIntake / aiOutline / aiExpandSection / aiGenerateDoc)
src/app/api/mothermode/leadgen-ai/route.ts    Admin-guarded AI route (action switch)
src/app/api/admin/mothermode-leadgen/route.ts Admin CRUD + publish (GET/POST/DELETE)
src/app/admin/lead-gen/
  page.tsx           Server page: loads admin list, renders the editor
  LeadGenEditor.tsx  Client editor (intake, outline/generate, per-section expand,
                     block editing, styled preview, save, publish)
src/app/admin/AdminSidebar.tsx   NAV entry: { /admin/lead-gen, 'Lead Gen Kit' }
```

---

## 3. Where your format specs load in

`src/lib/mothermode/leadgen/formats/*` are typed data modules, one per format,
aggregated by `formats/index.ts`. Each exports `{ label, hint, skeleton,
styleNote, usesLessons }`. The generator injects the chosen spec's `skeleton`
(authoritative structure) and `styleNote` (authoring voice) into every prompt via
`intakeContext()`, exactly like `frameworks` in the Community/High-Ticket kits.
Swapping a format module visibly changes output — how many sections, what they
cover, and whether lessons are produced — **without touching generation logic**.

`formatUsesLessons(format)` returns whether a format uses nested lessons
(course/mini-course). The expand pass returns `lessons: []` for all others.

---

## 4. Data model (`20260725000000_mothermode_lead_gen_kits.sql`)

One table, `mothermode_lead_gen_kits`, with RLS enabled.

- `id uuid pk default gen_random_uuid()`
- `slug text not null unique` — url-safe, stable
- `name text not null default ''` — internal name
- `format text not null default 'guide'` — one of the ten formats
- `status text not null default 'draft'` — `draft | active | archived`
- `intake jsonb not null default '{}'` — the brief
- `doc jsonb not null default '{}'` — the structured document (see §5)
- `published_slug text`, `published_key text` — where it was published, if any
- `created_at`, `updated_at timestamptz not null default now()`, `updated_by text`
- Index on `(status, updated_at desc)`.

**RLS posture — admin-only tool.** A single service-role `FOR ALL` policy; no
anon policies. The published document is stored in the existing **deliverables**
table (which already has its buyer-facing read policy), so this table never needs
a public read path. All reads (including drafts) and writes go through the admin
API with the service role.

---

## 5. Types + normalizers (`leadgen/types.ts`)

- Enums + option arrays: `LEAD_MAGNET_FORMATS` (10 formats), `LEAD_GEN_LENGTHS`
  (`short|standard|ultra`), `LEAD_GEN_STATUSES` (`draft|active|archived`),
  `DOC_BLOCK_KINDS` (the 9 block kinds).
- `LeadGenIntake` — `{ topic, audience, goal, transformation, length, tone, cta,
  offerSlug, notes }` (all strings; `length` is a `LEAD_GEN_LENGTHS` value).
- `LeadGenDoc` — `{ title, subtitle, hook, coverImageUrl, sections: DocSection[],
  cta: { title, body, button } }`.
- `DocSection` — `{ id, heading, summary, blocks: DocBlock[], lessons: Lesson[] }`;
  `Lesson` — `{ title, blocks: DocBlock[] }`.
- `DocBlock` — `{ kind, text?, title?, items? }` where `kind` is one of `lead`,
  `p`, `h3`, `ul`, `checklist`, `note`, `pullQuote`, `nextStep`, `template`.
- `LeadGenKitRow` (snake_case DB shape) and `LeadGenKitRecord` (camelCase).
- Pure functions (no Supabase import → unit-testable): `normalizeIntake`,
  `normalizeDoc`, `normalizeSection`, `blankIntake`, `blankDoc`, `blankSection`,
  `blankBlock`, `rowToLeadGenKit`. Malformed model output degrades to blanks
  rather than throwing.

---

## 6. Store (`leadgen/store.ts`)

Service-role only (admin tool). One lazy client so the module never throws on
missing env at import time. Admin reads swallow errors and return `[]` / `null`.

Functions: `listKitsForAdmin()`, `getKitById(id)`, `getKitBySlug(slug)`,
`upsertKit(input)` (insert when `id` absent, else update via `onConflict: 'id'`;
stamps `updated_at`), `deleteKit(id)`, and a publish path that writes the rendered
`DeliverableDoc` (from `docToDeliverableDoc`) into the deliverables store and
records `published_slug/published_key` on the kit row.

---

## 7. Generator (`utils/integrations/openai-leadgen.ts`)

Server-only. JSON-mode OpenAI with Anthropic fallback (mirrors
`openai-highticket.ts`); the key is resolved server-side and never reaches the
client. Each function returns a discriminated result (`{ ok: true, data }` or
`{ ok: false, error, status }`). All output is coerced through the type
normalizers.

- `aiFillIntake(intake, format)` — expand a thin brief into a full
  `LeadGenIntake` (preserves owner-supplied values over blanks).
- `aiOutline(intake, format)` — title/subtitle/hook + section headings/summaries
  + CTA, with fresh ids and **empty** blocks (skeleton). Honors
  `sectionTarget(length)`.
- `aiExpandSection(intake, format, section, allSections)` — fill one section's
  blocks (and lessons where the format uses them), given the full outline for
  context. Honors `sectionDepth(length)` so depth scales with the length knob.
- `aiGenerateDoc(intake, format)` — outline, then expand each section in order;
  short-circuits on the first failing pass.

Prompt context (`intakeContext`) always injects the format label, skeleton,
style note, and the full intake brief. `VOICE_RULES` enforces calm authority, no
hype, no income/medical claims, and no em/en dashes.

---

## 8. Routes

**`/api/mothermode/leadgen-ai`** (admin-guarded, action switch):
- `{ action: 'fillIntake', intake, format }` → `{ success, intake }`.
- `{ action: 'outline', intake, format }` → `{ success, doc }`.
- `{ action: 'generate', intake, format }` → `{ success, doc }`.
- `{ action: 'expand', intake, format, section, sections }` → `{ success, section }`.
- Unknown action → 400. Every handler starts with `requireAdminRoute()`.

**`/api/admin/mothermode-leadgen`** (admin CRUD + publish):
- `GET` → `{ success, admin, items }` (all kits, newest first).
- `POST { action: 'save', … }` → validates, `upsertKit`, revalidate, `{ success, item }`.
- `POST { action: 'publish', id, publishedSlug, publishedKey }` → renders the
  saved doc to a `DeliverableDoc`, upserts it into deliverables, records the
  publish target on the kit, revalidate, `{ success }`.
- `DELETE ?id=…` → `deleteKit`, revalidate, `{ success }`.

---

## 9. Rendering + styled HTML (`leadgen/export.ts`)

Pure, deterministic string builders (no React, no DB) so they are unit-testable
and reused by the editor (copy/preview), and the publish path.

- `docToText(doc)` — plain-text export for **Copy text**.
- `LEAD_GEN_STYLES` — a scoped stylesheet; **every selector is namespaced under
  `.lead-gen-doc`**, so it styles the document without leaking into (or being
  overridden by) the host page. Includes a `@media print` block.
- `docToDeliverableHtml(doc)` — the buyer-facing body. Emits a `<style>` block
  (LEAD_GEN_STYLES) followed by semantic markup (`doc-header`, `doc-hook`,
  `doc-section`, `pull-quote`, `checklist`, `note`, `next-step`, `template-block`,
  `doc-cta`, …). Because the CSS travels with the body, a published magnet renders
  as a polished, print-ready document **anywhere the HTML is injected** — no
  dependency on host-page CSS. No `<html>/<head>` wrapper; the resource page
  supplies the shell.
- `docToDeliverableDoc(doc, slug, key)` — wraps the HTML into the `DeliverableDoc`
  shape (`slug, key, title, subtitle, html`) the deliverables store persists.

---

## 10. Admin editor (`/admin/lead-gen`)

- `page.tsx` is a server component (`dynamic = 'force-dynamic'`) that loads the
  admin list and passes it to `LeadGenEditor`.
- `LeadGenEditor.tsx` (client): a saved-kits sidebar + `+ New kit`; a meta card
  (internal name, slug, format with hint, status); an **Intake** card (topic,
  audience, goal, transformation, **Length**, tone, CTA, offer slug, notes) with
  **AI: fill intake**, **Generate outline**, and **Generate full document**; a
  **Document** card (title, subtitle, hook, cover image URL) with per-**Section**
  cards (move ↑/↓, **AI: expand**, remove, heading/summary, typed **BlockEditor**s,
  add block/section) and a CTA card; an **Actions** row (**Save kit**, **Copy
  text**, **Styled preview** toggle, **Delete**) and a **Publish to Deliverables**
  card (offer slug + resource key → **Publish document**). The **Styled preview**
  panel renders `docToDeliverableHtml(doc)` on a white surface — exactly what a
  buyer sees.

---

## 11. Port order

1. Apply the migration; verify the table + the admin-only (service-role) RLS.
2. Port `leadgen/types.ts`, then `leadgen/store.ts` and `leadgen/export.ts`.
3. Add `leadgen/formats/*` and `formats/index.ts` (label/hint/skeleton/styleNote
   per format; set `usesLessons` for course/mini-course).
4. Add `utils/integrations/openai-leadgen.ts`; confirm the JSON-mode helper, key
   resolution, and Anthropic fallback match `openai-highticket.ts` in the target.
5. Add `/api/mothermode/leadgen-ai` and `/api/admin/mothermode-leadgen`; confirm
   `requireAdminRoute()` returns the same shape, and that publish reuses the
   deliverables store.
6. Add `/admin/lead-gen` (`page.tsx` + `LeadGenEditor.tsx`) and the `AdminSidebar`
   NAV entry.
7. Verify: `npx tsc --noEmit`.

### Verification checklist
- `npx tsc --noEmit` exits 0.
- **AI: fill intake** expands a thin brief into a full intake.
- **Generate outline** produces `sectionTarget(length)` sections with empty bodies.
- **Generate full document** fills every section; **AI: expand** fills one.
- Changing **Length** to `ultra` yields more *and* deeper sections; `short` yields
  fewer, tighter ones.
- **Styled preview** renders the buyer-facing HTML; it looks styled with no
  host-page CSS.
- **Publish document** creates a Deliverable at `/mothermode/resource/<slug>/<key>`
  that renders identically to the preview.
- Save → appears in the sidebar and reloads with all fields intact; Delete removes it.

---

## 12. Notes

- Reuses the patterns from `DELIVERABLES_RESOURCES_SYSTEM_PORT.md` (CRUD +
  resource rendering) and `HIGH_TICKET_KIT_TASK.md` / `CONTENT_GENERATE_SYSTEM_PORT.md`
  (JSON-mode AI + injected specs); read those first if a convention is unclear.
- No new environment variables: reuses the Supabase URL + service-role key and the
  OpenAI/Anthropic keys already required by the base template.
- Storing intake + doc as JSONB is deliberate — it lets format specs, block kinds,
  and section shapes evolve without a migration.
- The self-contained `<style>` block means published magnets are portable: they
  render correctly even outside the resource page (e.g. print-to-PDF, email, or a
  standalone host) because no styling is assumed from the surrounding page.
