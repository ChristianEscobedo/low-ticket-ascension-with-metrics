# Community Kit — AI Launch-Kit Builder (System / Port Guide)

An admin-only production tool that turns a short intake into a complete community
launch kit: name options + a chosen name, a public description, exactly-three
qualifying questions for both paid and free communities, a DM script, a
sales-call script, an ad content style (angle + primary text / headline /
description + image prompt), a Facebook/Meta lead form, and the community's first
pinned post. This is the shipped version of the plan in `COMMUNITY_KIT_TASK.md`.

It deliberately fuses the two proven patterns in this codebase:

1. **DB-backed admin CRUD with service-role writes** — the Deliverables / Help
   Center convention: `requireAdminRoute()`-guarded routes returning
   `{ success, admin, items }`, a `store.ts` split (here it is service-role only),
   `revalidatePath` after writes, and an `AdminSidebar` NAV entry.
2. **Server-only JSON-mode AI generation behind an action-switch route** — the
   `/api/mothermode/ai` + `openai-content.ts` convention: one route, an `action`
   switch, JSON-mode OpenAI calls that never run on the client, and
   owner-supplied **frameworks** injected into the system prompt.

---

## 1. What it does

- **Intake → kit**: the admin enters a short brief (niche, audience, promise,
  platform, goal, next step, price, tone…), optionally clicks **AI fill intake**
  to expand a niche/audience seed into a full brief, then **Generate kit**.
- **Generate wizard**: before generating, a modal lets the admin pick which
  sections to build (defaults to everything valid for the community type). A real
  subset generates only those sections; picking all generates the full kit.
- **Per-section control**: every section renders in its own card with
  **Regenerate** (re-runs just that section, merging a patch into the kit) and
  **Copy** (section text to clipboard).
- **Export**: **Copy all as text** and **Export PDF** (print-to-PDF via a
  print window) from pure renderers in `export.ts`.
- **Community type** drives which sections apply: `paid` and `both` include the
  sales-call script; `free` omits it. `both` produces qualifying questions for
  paid **and** free audiences.
- **Persistence**: kits are saved/loaded/deleted via the admin CRUD route; the
  whole structured kit is one JSONB column so section shapes can evolve.

---

## 2. Files

```
supabase/migrations/20260715000000_mothermode_community_kits.sql   One table + admin-only RLS
src/lib/mothermode/community/
  types.ts        CommunityIntake / CommunityKit / *Record + row types + pure mappers/normalizers
  store.ts        service-role client + CRUD (listKitsForAdmin, getKitById/BySlug, upsertKit, deleteKit)
  export.ts       pure renderers: SECTION_LABELS/HINTS, sectionsForType, sectionToText, kitToText, kitToPrintableHtml
  frameworks/
    index.ts               COMMUNITY_FRAMEWORKS: single source of truth the generator reads
    qualifying-questions.ts free-group→sale AND paid-group→call/workshop/webinar guidance
    dm-scripts.ts          DM outreach guidance
    sales-call.ts          sales-call / strategy-call guidance
    ads-style.ts           ad angle + primary text/headline/description + image prompt guidance
    names-description.ts   naming + public-description guidance
    pinned-post.ts         first-pinned-post guidance
    lead-form.ts           Facebook/Meta lead-form guidance
src/utils/integrations/openai-community.ts   Server-only generator (generate / generateSections / regenerate / fillIntake)
src/app/api/mothermode/community-ai/route.ts Admin-guarded AI route (action switch)
src/app/api/admin/mothermode-community/route.ts  Admin CRUD (GET/POST/DELETE)
src/app/admin/community/
  page.tsx            Server page: loads admin list, renders the editor
  CommunityEditor.tsx Client editor (intake, wizard, per-section regenerate/copy, export)
src/app/admin/AdminSidebar.tsx   NAV entry: { /admin/community, 'Community Kit' }
tests/lib/community-mappers.test.ts   Pure mapper/normalizer unit tests (10)
```

---

## 3. Where your frameworks load in

`src/lib/mothermode/community/frameworks/*` are typed data modules exported as
plain strings, aggregated by `frameworks/index.ts` into `COMMUNITY_FRAMEWORKS`.
The generator concatenates the relevant module into the system prompt for each
section — exactly like `guides` in `openai-content.ts`. Swapping any module here
visibly changes that section's output **without touching generation logic**.

Currently authoritative frameworks:
- **qualifying-questions.ts** — encodes both proven flows: free group → sale, and
  paid group → strategy call / workshop / webinar (free and paid). This is the
  file that produces the exactly-three questions per audience.
- **names-description.ts**, **dm-scripts.ts**, **sales-call.ts**,
  **ads-style.ts**, **pinned-post.ts**, **lead-form.ts** — currently seeded with
  working guidance/stubs. Drop refined owner copy (e.g. the finalized DM script
  and call script) straight into `dm-scripts.ts` / `sales-call.ts` (and the
  pinned post into `pinned-post.ts`) to upgrade output; no structural change
  required.

Source material staged for these frameworks lives under `supabase/migrations/`
and `docs/` (e.g. `DM-VSL-DMscript.txt`, `high-ticket-call-scripts.txt`,
`demo-salescall-script.txt`, `pub-post-2.0-scripts.txt`, `lead-form-ads-setup.txt`).

---

## 4. Data model (`20260715000000_mothermode_community_kits.sql`)

One table, `mothermode_community_kits`, with RLS enabled.

- `id uuid pk default gen_random_uuid()`
- `slug text not null unique` — url-safe, stable
- `name text not null default ''` — chosen community name
- `community_type text not null default 'paid'` — `paid | free | both`
- `status text not null default 'draft'` — `draft | active | archived`
- `intake jsonb not null default '{}'` — the brief
- `kit jsonb not null default '{}'` — the structured kit (see §5)
- `created_at`, `updated_at timestamptz not null default now()`, `updated_by text`
- Index on `(status, updated_at desc)`.

**RLS posture — admin-only tool.** A single service-role `FOR ALL` policy; no
anon policies. All reads (including drafts) and every write go through the admin
API with the service role, which bypasses RLS. If a public share surface is added
later, add a `published` flag plus an anon `SELECT` policy scoped to that flag,
exactly like `mothermode_kb_articles`.

---

## 5. Types + mappers (`community/types.ts`)

- Enums + option arrays: `COMMUNITY_TYPES` (`paid|free|both`),
  `COMMUNITY_STATUSES` (`draft|active|archived`), `COMMUNITY_PLATFORMS`
  (datalist suggestions), and `KIT_SECTIONS` (the section keys the wizard,
  route, and regenerate all share).
- `CommunityIntake` — the brief (niche, audience, promise, unexpectedWay, pains,
  platform, goal, nextStep, price, freebie, tone, notes).
- `CommunityKit` — the structured output: `nameOptions[]`, `chosenName`,
  `description`, `qualifyingQuestions { paid: Q[]; free: Q[] }`,
  `dmScript { stages }`, `salesCallScript { phases }`,
  `ad { concept, primaryText, headline, description, imagePrompt }`,
  `leadForm { headline, description, questions[], completionHeadline,
  callToAction, completionDescription, groupUrl }`, and `pinnedPost`.
  A `QualifyingQuestion` is `{ prompt, type: multiple_choice|short_text|email,
  required, options? }`.
- `CommunityKitRow` (snake_case DB shape) and `CommunityKitRecord` (camelCase
  domain record).
- Pure functions (no Supabase import → unit-testable):
  `toCommunityType` / `toCommunityStatus` (normalize to a valid enum),
  `normalizeIntake`, `normalizeKit` (fill a full, safe shape from partial/null
  input; coerce question types and drop options for non-choice types),
  `blankIntake`, `blankKit`, and `rowToCommunityKit`.

Covered by `tests/lib/community-mappers.test.ts` (10 tests).

---

## 6. Store (`community/store.ts`)

Service-role only (admin tool). One lazy client so the module never throws on
missing env at import time. Admin reads swallow errors and return `[]` / `null`.

Functions: `listKitsForAdmin()`, `getKitById(id)`, `getKitBySlug(slug)`,
`upsertKit(UpsertKitInput)` (insert when `id` absent, update in place via
`onConflict: 'id'`; stamps `updated_at`), `deleteKit(id)`.

---

## 7. Generator (`utils/integrations/openai-community.ts`)

Server-only. Reuses the JSON-mode OpenAI helper pattern; the API key is resolved
server-side and never reaches the client. Each function returns a discriminated
result (`{ ok: true, data }` or `{ ok: false, error, status }`).

- `generateCommunityKit(intake, communityType)` — full kit.
- `generateCommunityKitSections(intake, communityType, sections)` — a subset;
  returns a partial kit the route/client merges over the current kit.
- `regenerateKitSection(section, intake, communityType, currentKit?)` — one
  section; returns a patch (`Partial<CommunityKit>`) to merge.
- `fillCommunityIntake(seed, communityType)` — expands a niche/audience seed into
  a full `CommunityIntake` for review before generation.

Each call injects the matching `COMMUNITY_FRAMEWORKS` string(s) as authoritative
guidance and asks for strict JSON matching the `CommunityKit` shape.

---

## 8. Routes

**`/api/mothermode/community-ai`** (admin-guarded, action switch):
- `{ action: 'fillIntake', intake, communityType }` → `{ success, intake }`.
- `{ action: 'generate', intake, communityType, sections? }` → `{ success, kit }`.
  When `sections` is a real subset of `KIT_SECTIONS`, it calls
  `generateCommunityKitSections`; otherwise the full `generateCommunityKit`.
- `{ action: 'regenerate', section, intake, communityType, kit }` →
  `{ success, section, patch }`.
- Unknown action → 400. Every handler starts with `requireAdminRoute()`.

**`/api/admin/mothermode-community`** (admin CRUD):
- `GET` → `{ success, admin, items }` (all kits, newest first).
- `POST` → validates, `upsertKit`, `revalidatePath('/admin/community')`, returns
  `{ success, item }`. `updatedBy` comes from the resolved admin identity.
- `DELETE ?id=…` → `deleteKit`, revalidate, `{ success }`.

---

## 9. Admin editor (`/admin/community`)

- `page.tsx` is a server component (`dynamic = 'force-dynamic'`) that loads the
  admin list and passes it to `CommunityEditor`.
- `CommunityEditor.tsx` (client): a saved-kits sidebar + `+ New kit`, a meta card
  (name, slug, community type, status), an **Intake** card (with a platform
  datalist, **AI fill intake**, and **Generate kit** → opens the wizard), the
  **GenerateWizard** modal (pick sections, with per-section labels + hints), an
  **export toolbar** (Copy all / Export PDF), and one **SectionCard** per kit
  section with **Copy** + **Regenerate**. Qualifying questions render per audience
  (`paid`/`free`) with a `QuestionEditor`; the sales-call card is hidden for
  `free` communities.
- Save/delete call the CRUD route; the request/refresh loop mirrors
  `DeliverablesEditor` / `HelpEditor`.

---

## 10. Port order

1. Apply the migration; verify the table + the admin-only (service-role) RLS.
2. Port `community/types.ts` (+ the mapper test), then `community/store.ts` and
   `community/export.ts`.
3. Add `community/frameworks/*` (start with the stubs; drop in owner copy later).
4. Add `utils/integrations/openai-community.ts`; confirm the OpenAI JSON-mode
   helper and key resolution match `openai-content.ts` in the target.
5. Add `/api/mothermode/community-ai` and `/api/admin/mothermode-community`;
   confirm `requireAdminRoute()` returns the same `{ ok, response, admin }` shape.
6. Add `/admin/community` (`page.tsx` + `CommunityEditor.tsx`) and the
   `AdminSidebar` NAV entry.
7. Verify: `npx tsc --noEmit` and
   `npx vitest run tests/lib/community-mappers.test.ts`.

### Verification checklist
- `npx tsc --noEmit` exits 0.
- `npx vitest run tests/lib/community-mappers.test.ts` green (10/10).
- **AI fill intake** expands a niche/audience seed into a full brief.
- **Generate kit** with a subset produces only the chosen sections; the full run
  produces all valid sections for the type.
- `free` omits the sales-call card; `both` produces paid **and** free qualifying
  questions.
- **Regenerate** on a section replaces only that section.
- **Copy all** and **Export PDF** produce the full kit; per-section **Copy** works.
- Save → appears in the sidebar and reloads with all fields intact; Delete removes
  it.

---

## 11. Notes

- Reuses the exact patterns from `DELIVERABLES_RESOURCES_SYSTEM_PORT.md` (CRUD)
  and `CONTENT_GENERATE_SYSTEM_PORT.md` (JSON-mode AI + frameworks); read those
  first if a convention here is unclear.
- No new environment variables: reuses the Supabase URL + service-role key and
  the OpenAI key already required by the base template.
- Storing the whole kit as one JSONB column is deliberate — it lets section
  shapes and frameworks evolve without a migration. Add columns only if you need
  to query inside a section.
