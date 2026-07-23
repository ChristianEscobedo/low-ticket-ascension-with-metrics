# High Ticket Kit — Task Spec

Scoped, build-ready spec for a **High Ticket Kit** generator: an admin tool that,
from a short intake, produces a complete high-ticket offer and its selling
system, then saves it as an editable, regenerable kit. Written so it can be
handed to a fresh task and built without further discovery.

It is deliberately the **high-ticket sibling of the Community Kit** — same two
patterns, same file layout, same editor UX. Reuse the just-shipped Community Kit
as the reference implementation rather than inventing anything:
1. **DB-backed admin CRUD** with service-role writes and admin-guarded routes —
   see `COMMUNITY_KIT_SYSTEM_PORT.md`, `HELP_CENTER_SYSTEM_PORT.md`, and
   `DELIVERABLES_RESOURCES_SYSTEM_PORT.md`.
2. **Server-only JSON-mode AI generation** behind an action-switch route —
   see `src/utils/integrations/openai-community.ts` +
   `src/app/api/mothermode/community-ai/route.ts` (and the base pattern in
   `openai-content.ts` / `CONTENT_GENERATE_SYSTEM_PORT.md`).

> No code has been written for this yet. This doc is the plan. It is registered
> in `MOTHERMODE_CONTENT_SUITE_MASTER_PORT.md` (feature map row 15, PLANNED),
> with `HIGH_TICKET_KIT_SYSTEM_PORT.md` to be authored once built.

---

## 1. Goal

An admin fills a short intake and the tool generates a complete **High Ticket
Kit**, then lets them edit and regenerate any part:

1. **Offer name** — several on-voice offer/program name options + the chosen one.
2. **The high-ticket offer** — the full offer architecture: core promise /
   outcome, the unique mechanism (why it works), what's included (deliverables /
   modules / access), the timeline, the price + payment options, the risk
   reversal / guarantee, bonuses, and the positioning statement ("who it's for /
   who it's not for"). This is the centerpiece.
3. **Value resource** — a give-away asset (lead magnet / diagnostic / guide) that
   attracts and pre-frames high-ticket leads, built from the owner's supplied
   resource (see §3). Output is structured enough to hand to the deliverables
   pipeline or export as a document.
4. **15-minute triage script** — a short qualification/triage call script
   (frame, 3-5 qualifying questions, disqualify-politely branch, book-the-call
   or decline branch), built from the owner's triage framework.
5. **Sales call script** — a full closing-call script (frame, discovery, gap,
   present offer, price delivery, objection turns, close), built from the owner's
   sales-call framework.
6. **Ads / outreach angle** (optional, round 1 stretch) — a content angle + copy
   + image prompt that drives applications to the triage call, reusing the
   Community Kit `ads-style` pattern.

All of it saves to Supabase as one kit record and is fully editable in the
admin, with a per-section **Regenerate** button, per-section **Copy**, and a
**Copy all / Export PDF** — identical to the Community Kit editor.

Non-goals for round 1: multi-language, versioned kit history, buyer-facing
publishing (the kit is an admin production tool). A public/share surface is
optional and called out in §8.

---

## 2. Reuse these existing patterns

- **Auth**: every admin route guards with `requireAdminRoute()`. CRUD routes
  return `{ success, admin, items }`; the generation route returns `{ ok, ... }`
  like `/api/mothermode/community-ai`.
- **DB access split**: a `store.ts` with a lazy service-role client (admin reads
  + all writes). Every function `try/catch` → safe empty. Copy
  `src/lib/mothermode/community/store.ts` and rename the table.
- **AI generation**: one server integration module using the same key handling
  and JSON-mode call pattern as `openai-community.ts`; the route validates input
  and delegates. Never call the model from the browser.
- **Voice rules** apply to every generated string: no em dashes, no en dashes,
  no NO-list words (mama, thrive, journey, hustle, empower, balance, girlboss,
  etc.), periods over exclamation points, restraint on hype. Reuse `VOICE_RULES`
  from `constants.ts` and run the compliance scan (§9).
- **Admin editor UX**: copy `src/app/admin/community/CommunityEditor.tsx`
  (intake form, generate wizard, per-section cards with Regenerate/Copy, Copy
  all / Export PDF) and adapt the section list.
- **Export helpers**: mirror `src/lib/mothermode/community/export.ts`
  (`SECTION_LABELS`/`SECTION_HINTS`, `sectionToText`, `kitToText`,
  `kitToPrintableHtml`).
- **Admin nav**: add `{ href: '/admin/high-ticket', label: 'High Ticket Kit' }`
  to the `NAV` array in `src/app/admin/AdminSidebar.tsx`.

---

## 3. Owner-supplied frameworks + resource (AWAITING — load before build)

The owner has proven frameworks and a give-away resource, and will drop them into
the codebase. Put each as a typed prompt/data module under
`src/lib/mothermode/highticket/frameworks/` so the generator injects them as
authoritative guidance (the model fills in the specifics, it does not invent the
structure), aggregated by a `frameworks/index.ts` into a single
`HIGH_TICKET_FRAMEWORKS` object exactly like `community/frameworks/index.ts`:

| File | Holds | Feeds |
|------|-------|-------|
| `offer.ts` | The high-ticket offer framework: promise/mechanism/stack/pricing/guarantee/positioning structure | offer generation |
| `value-resource.ts` | The owner's give-away resource (the actual asset content + how to frame/position it as a lead magnet) | value-resource generation |
| `triage-script.ts` | The 15-min triage/qualification call framework (frame, qualify, disqualify, book) | triage script generation |
| `sales-call.ts` | The closing sales-call framework (phases, objection turns, price delivery, close) | sales script generation |
| `names.ts` | Naming + positioning guidance for the offer/program name | name generation |
| `ads-style.ts` (optional) | The ads/outreach content style that drives applications | ad concept + copy + image prompt |

Source material the owner is providing (stage under `supabase/migrations/` or
`docs/` like the Community Kit did): a **give-away resource**, a **15-minute
triage script**, and **sales-call script(s)**. Existing staged references that
may seed these: `docs/high-ticket-call-scripts.txt`, `docs/demo-salescall-script.txt`.

Each module exports a plain string (or small typed object) the generator
concatenates into the system prompt (like `guides` in `openai-content.ts`). Keep
them **data**, not prose in the route, so they are easy to tune without touching
logic. Until they land, stub with short placeholders and a
`// TODO: owner framework` marker so the build compiles and can be swapped in
cleanly.

---

## 4. Data model (new migration)

Create `supabase/migrations/2026XXXXXXXXXX_mothermode_high_ticket_kits.sql`. One
table holds the intake plus the whole structured kit as JSONB (mirrors
`mothermode_community_kits`):

```sql
create table if not exists mothermode_high_ticket_kits (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null default '',            -- chosen offer/program name
  status       text not null default 'draft',        -- draft | active | archived
  intake       jsonb not null default '{}'::jsonb,    -- niche, audience, transformation, price band, proof, tone
  kit          jsonb not null default '{}'::jsonb,    -- the generated resources (see §5 shape)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   text
);
create index if not exists idx_high_ticket_kits_status on mothermode_high_ticket_kits (status, updated_at desc);

alter table mothermode_high_ticket_kits enable row level security;
-- Admin-only tool: no anon policies. Service role bypasses RLS for all access.
-- (If a public share surface is added in §8, add a published flag + an anon
--  select policy scoped to that flag, exactly like the Help Center.)
create policy "Service role full access mothermode_high_ticket_kits" on mothermode_high_ticket_kits
  for all to service_role using (true) with check (true);
```

Note there is no `community_type` column — high-ticket has one flavor. Storing
`kit` as JSONB keeps section shapes flexible while frameworks evolve; type it in
`types.ts` and normalize on write (reuse the Community Kit `normalizeKit` idea).

---

## 5. Types + store

`src/lib/mothermode/highticket/types.ts` — the domain types. Suggested shape
(mirror `community/types.ts`: enums + option arrays, pure normalizers, row
mappers):

```ts
export type HighTicketStatus = 'draft' | 'active' | 'archived';

export interface HighTicketIntake {
  niche: string;
  audience: string;          // who the offer is for
  transformation: string;    // the outcome / promise
  mechanism?: string;        // the unique method, if known
  priceBand?: string;        // e.g. 3k-5k, 10k+
  proof?: string;            // results / credibility to weave in
  timeline?: string;         // program length
  tone?: string;
  notes?: string;
}

export interface HighTicketOffer {
  promise: string;
  mechanism: string;
  includes: string[];        // stack / deliverables / access
  timeline: string;
  price: string;
  paymentOptions: string[];
  guarantee: string;
  bonuses: string[];
  positioning: string;       // who it's for / not for
}

export interface ScriptSection { label: string; body: string; }

export interface ValueResource {
  title: string;
  format: string;            // guide, checklist, diagnostic, etc.
  summary: string;
  sections: ScriptSection[]; // the actual content blocks
  cta: string;               // how it points to the triage call
}

export interface HighTicketKit {
  nameOptions: string[];
  chosenName: string;
  offer: HighTicketOffer;
  valueResource: ValueResource;
  triageScript: { phases: ScriptSection[] };     // 15-min qualification call
  salesCallScript: { phases: ScriptSection[] };  // closing call
  ad?: { concept: string; primaryText: string; headline: string; description: string; imagePrompt: string };
}

export interface HighTicketKitRecord {
  id: string;
  slug: string;
  name: string;
  status: HighTicketStatus;
  intake: HighTicketIntake;
  kit: HighTicketKit;
  updatedAt?: string | null;
  updatedBy?: string | null;
}
```

Add pure normalizers (`normalizeIntake`, `normalizeKit`, `toHighTicketStatus`,
`blankIntake`, `blankKit`) and a `rowToHighTicketKit(row)` mapper (snake_case ↔
camelCase, JSONB guard). Unit-test them
(`tests/lib/high-ticket-mappers.test.ts`), matching
`tests/lib/community-mappers.test.ts`.

`src/lib/mothermode/highticket/store.ts` (copy `community/store.ts`):
- `listKitsForAdmin()`, `getKitById(id)`, `getKitBySlug(slug)`,
  `upsertKit(input)`, `deleteKit(id)` — service-role, `try/catch` → `[]`/`null`,
  `updated_at` stamped on write, `onConflict: 'id'`.

`src/lib/mothermode/highticket/export.ts` — copy `community/export.ts` and adapt
the section labels/hints and renderers to the high-ticket sections.

---

## 6. AI generation (server) + route

`src/utils/integrations/openai-highticket.ts` — mirror `openai-community.ts`:
same key resolution, same JSON-mode request, same `{ ok, data | error, status }`
return. Export:
- `generateHighTicketKit(intake)` → full `HighTicketKit`.
- `generateHighTicketKitSections(intake, sections)` → a subset; returns a partial
  kit the route/client merges over the current kit.
- `regenerateKitSection(section, intake, currentKit?)` → one section
  (`'name' | 'offer' | 'valueResource' | 'triageScript' | 'salesCallScript' |
  'ad'`) returning a patch to merge.
- `fillHighTicketIntake(seed)` → expands a niche/audience/transformation seed into
  a full `HighTicketIntake` for review before generation.

Inject the §3 framework modules and `VOICE_RULES` into every system prompt. The
offer prompt must produce a coherent stack (price, payment, guarantee, bonuses
all consistent); the triage prompt must keep it to a **~15-minute** structure
with a clear disqualify branch.

Route `src/app/api/mothermode/high-ticket-ai/route.ts` (admin-guarded, `runtime
= 'nodejs'`, `dynamic = 'force-dynamic'`) with an action switch like the
community-ai route:
- `action: 'fillIntake'` → `{ ok, intake }`.
- `action: 'generate'` (optional `sections`) → `{ ok, kit }` (subset uses
  `generateHighTicketKitSections`; otherwise full).
- `action: 'regenerate'` → `{ ok, section, patch }`.

CRUD route `src/app/api/admin/mothermode-high-ticket/route.ts`:
- `GET` → `{ success, admin, items }` (all kits for the admin list).
- `POST` → validate + `upsertKit`, `updatedBy` from the guard identity,
  `revalidatePath('/admin/high-ticket')`, return `{ success, item }`.
- `DELETE ?id=…` → `deleteKit`, revalidate, `{ success }`.

Keep the same 400/500 JSON error shapes used across the existing routes.

---

## 7. Admin UI (`/admin/high-ticket`)

Add the `AdminSidebar` NAV entry, then:
- `src/app/admin/high-ticket/page.tsx` — server wrapper (`force-dynamic`,
  admin-gated) loading `listKitsForAdmin()`.
- `src/app/admin/high-ticket/HighTicketEditor.tsx` — client, copied from
  `CommunityEditor.tsx`. Left: kit list (name + status). Right: master/detail
  with:
  - **Intake form** (niche, audience, transformation, mechanism, price band,
    proof, timeline, tone) + **AI fill intake** + **Generate kit** → generate
    wizard (pick sections).
  - **Section cards** for name options (pick one → sets `name`), the offer
    (structured fields: promise, mechanism, includes, timeline, price, payment,
    guarantee, bonuses, positioning), value resource, 15-min triage script,
    sales call script, and optional ad. Each card is editable and has
    **Regenerate** + **Copy**.
  - **Copy all / Export PDF**, status select, save (CRUD `POST`), delete. Reuse
    the save/dirty scaffolding already in `CommunityEditor.tsx`.
- Optional: render the ad `imagePrompt` through the existing `aiGenerateImage`
  client action so the admin can preview an ad visual (reuses the content-hub
  image pipeline; no new integration).
- Optional: push the generated **value resource** into the deliverables pipeline
  so it can be handed to buyers (reuse `DELIVERABLES_RESOURCES_SYSTEM_PORT.md`).

---

## 8. Optional public / share surface (decide with owner)

Round 1 can stay admin-only. If a shareable read is wanted later (e.g. a public
offer page or a hosted value resource), add a `published boolean` + slug route
(`/mothermode/high-ticket/[slug]`) and an anon published-only RLS policy, exactly
like the Help Center viewer. Not required to ship the generator.

---

## 9. Verification

- `npx tsc --noEmit` exits 0.
- Migration applies; admin (service role) can CRUD; no anon access (until §8).
- Generate round trip: intake → full kit with a complete, internally-consistent
  offer stack, a value resource, a ~15-min triage script, and a full sales-call
  script; save → reload shows the same kit.
- Generate with a subset produces only the chosen sections; regenerate one
  section leaves the others untouched.
- Voice-rule / compliance scan over every generated string (no em/en dashes, no
  exclamation points, no NO-list words). Reuse the compliance scan used for the
  content catalogs.
- Framework injection works: swapping a `frameworks/*` module (especially
  `offer.ts` / `triage-script.ts` / `sales-call.ts`) visibly changes the matching
  section's output.
- Mapper unit test green (`tests/lib/high-ticket-mappers.test.ts`).

---

## 10. Build order (for the fresh task)

1. Land the owner frameworks + give-away resource (§3) or stub them with TODO
   markers.
2. Migration + RLS (§4).
3. `highticket/types.ts` + normalizers + mappers (+ test), `highticket/store.ts`,
   `highticket/export.ts`.
4. `highticket/frameworks/*` (+ `index.ts`).
5. `openai-highticket.ts` generator (`generate`, `generateSections`,
   `regenerateKitSection`, `fillHighTicketIntake`) with framework + `VOICE_RULES`
   injection.
6. Generation route `/api/mothermode/high-ticket-ai` + CRUD route
   `/api/admin/mothermode-high-ticket`.
7. `AdminSidebar` NAV + `/admin/high-ticket` editor (intake + wizard + section
   cards + regenerate/copy + copy-all/PDF + save).
8. Optional: ad image preview via existing `aiGenerateImage`; optional
   deliverables hand-off; optional public surface (§8).
9. Verify per §9.

---

## 11. Port-doc follow-up

When built, author `docs/HIGH_TICKET_KIT_SYSTEM_PORT.md` (mirror
`COMMUNITY_KIT_SYSTEM_PORT.md`) and flip this feature's row in
`MOTHERMODE_CONTENT_SUITE_MASTER_PORT.md` from PLANNED to built, listing the
migration name, the framework modules, the two routes, the generator, the editor,
and the env note (no new keys beyond `OPENAI_API_KEY` +
`SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_*`).
