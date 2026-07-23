# Community Kit — Task Spec

Scoped, build-ready spec for a **Community Kit** generator: an admin tool that,
from a short intake, produces every launch resource for a paid or free
community and saves it as an editable, regenerable kit. Written so it can be
handed to a fresh task and built without further discovery.

It fuses two patterns already in this codebase, so reuse them rather than
inventing anything:
1. **DB-backed admin CRUD** with service-role writes and admin-guarded routes —
   see `DELIVERABLES_RESOURCES_SYSTEM_PORT.md` and the just-shipped
   `HELP_CENTER_SYSTEM_PORT.md`.
2. **Server-only JSON-mode AI generation** behind an action-switch route —
   see `src/app/api/mothermode/ai/route.ts` + `src/utils/integrations/openai-content.ts`
   (`CONTENT_GENERATE_SYSTEM_PORT.md`).

> No code has been written for this yet. This doc is the plan. It is registered
> in `MOTHERMODE_CONTENT_SUITE_MASTER_PORT.md` (feature map row 14, PLANNED).

---

## 1. Goal

An admin fills a short intake and the tool generates a complete **Community
Kit**, then lets them edit and regenerate any part:

1. **Name** — several on-voice name options + the chosen one.
2. **Description** — the community's public description / promise.
3. **Qualifying questions** — exactly **3 for a paid** community and **3 for a
   free** community (join-screen questions), built from the owner's framework.
4. **DM script creator** — a set of outreach/onboarding DMs (welcome, qualify,
   invite/close, re-engage) built from the owner's DM framework.
5. **Sales call script creator** — a structured call script built from the
   owner's sales-call framework (paid communities).
6. **Ads content style** — a content angle + ad copy (primary text, headline,
   description) + an image prompt for ads that drive people to the community,
   built from the owner's ads style.
7. **First pinned post** — the community's first pinned welcome post (rules,
   start-here, what to do first), on-voice.

All of it saves to Supabase as one kit record and is fully editable in the
admin, with a per-section **Regenerate** button.

Non-goals for round 1: multi-language, versioned kit history, buyer-facing
publishing (the kit is an admin production tool). A public/share surface is
optional and called out in §8.

---

## 2. Reuse these existing patterns

- **Auth**: every admin route guards with `requireAdminRoute()` from
  `@/utils/courses/admin-route-guard`. CRUD routes return
  `{ success, admin, items }`; the generation route returns `{ ok, ... }` like
  `/api/mothermode/ai`.
- **DB access split**: a `store.ts` with a lazy service-role client (admin
  reads + all writes) and, only if a public surface is added, an anon
  published-only read client. Every function `try/catch` → safe empty. Model on
  `src/lib/mothermode/help/store.ts`.
- **AI generation**: one server integration module using the same key handling
  and JSON-mode call pattern as `openai-content.ts`; the route validates input
  and delegates. Never call the model from the browser.
- **Voice rules** apply to every generated string: no em dashes, no en dashes,
  no NO-list words (mama, thrive, journey, hustle, empower, balance, girlboss,
  etc.), periods over exclamation points, soft $7-style CTA restraint. Reuse
  `VOICE_RULES` from `constants.ts` and run the compliance scan (§9).
- **Admin editor UX**: model on `src/app/admin/deliverables/DeliverablesEditor.tsx`
  (save state, dirty tracking, error surface) and the Help Center two-tab editor.
- **Admin nav**: add `{ href: '/admin/community', label: 'Community Kit' }` to
  the `NAV` array in `src/app/admin/AdminSidebar.tsx`.

---

## 3. Owner-supplied frameworks (AWAITING — load before build)

The owner has proven frameworks and will drop them into the codebase. Put each
as a typed prompt/data module under `src/lib/mothermode/community/frameworks/`
so the generator injects them as authoritative guidance (the model fills in the
specifics, it does not invent the structure):

| File | Holds | Feeds |
|------|-------|-------|
| `qualifying-questions.ts` | The framework/criteria for join questions (paid + free) | question generation |
| `dm-scripts.ts` | DM script framework(s): stages, intent, do/don't | DM script generation |
| `sales-call.ts` | Sales call script framework (phases, objection turns) | sales script generation |
| `ads-style.ts` | The ads **content style** that drives people to the community (angle, hook patterns, offer framing, visual direction) | ad concept + copy + image prompt |

Each module should export a plain string or a small typed object that the
generator concatenates into the system prompt (like `guides` is threaded through
`openai-content.ts`). Keep them **data**, not prose in the route, so they are
easy to tune without touching logic. Until these land, stub them with short
placeholders and a `// TODO: owner framework` marker so the build compiles and
can be swapped in cleanly.

---

## 4. Data model (new migration)

Create `supabase/migrations/2026XXXXXXXXXX_mothermode_community_kits.sql`. One
table holds the intake plus the whole structured kit as JSONB (mirrors how the
generated-content library stores structured payloads):

```sql
create table if not exists mothermode_community_kits (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name           text not null default '',
  community_type text not null default 'paid',   -- paid | free | both
  status         text not null default 'draft',   -- draft | active | archived
  intake         jsonb not null default '{}'::jsonb, -- niche, audience, promise, platform, price, tone
  kit            jsonb not null default '{}'::jsonb, -- the generated resources (see §5 shape)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     text
);
create index if not exists idx_community_kits_status on mothermode_community_kits (status, updated_at desc);

alter table mothermode_community_kits enable row level security;
-- Admin-only tool: no anon policies. Service role bypasses RLS for all access.
-- (If a public share surface is added in §8, add a published flag + an anon
--  select policy scoped to that flag, exactly like the Help Center.)
```

Storing `kit` as JSONB keeps section shapes flexible while frameworks evolve;
type it in `types.ts` and validate on write.

---

## 5. Types + store

`src/lib/mothermode/community/types.ts` — the domain types. Suggested shape:

```ts
export type CommunityType = 'paid' | 'free' | 'both';

export interface CommunityIntake {
  niche: string;
  audience: string;
  promise: string;         // the transformation
  platform?: string;       // Skool, Facebook Group, Circle, etc.
  price?: string;          // for paid
  tone?: string;
}

export interface DmScript { id: string; stage: string; label: string; body: string; }

export interface CommunityKit {
  nameOptions: string[];
  description: string;
  qualifying: { paid: string[]; free: string[] };  // 3 each
  dmScripts: DmScript[];
  salesCallScript: string;      // structured, framework-based
  ad: { concept: string; primaryText: string; headline: string; description: string; imagePrompt: string };
  pinnedPost: string;
}

export interface CommunityKitRecord {
  id: string;
  slug: string;
  name: string;
  communityType: CommunityType;
  status: 'draft' | 'active' | 'archived';
  intake: CommunityIntake;
  kit: CommunityKit;
  updatedAt?: string | null;
  updatedBy?: string | null;
}
```

Add pure `rowToKit(row)` / `kitToRow(input)` mappers (snake_case ↔ camelCase,
JSONB parse/guard) and unit-test them (`tests/lib/community-mappers.test.ts`),
matching the Help Center mapper test.

`src/lib/mothermode/community/store.ts` (mirror `help/store.ts`):
- `listKitsForAdmin()`, `getKitById(id)`, `upsertKit(input)`, `deleteKit(id)` —
  service-role, `try/catch` → `[]`/`null`, `updated_at` stamped on write,
  `onConflict: 'id'`.

---

## 6. AI generation (server) + route

`src/utils/integrations/openai-community.ts` — mirror `openai-content.ts`:
same key resolution (`getOpenAiKey` / overrides), same JSON-mode request, same
`{ ok, data | error, status }` return. Export:
- `generateCommunityKit({ intake, communityType, frameworks, model })` → full
  `CommunityKit`.
- `regenerateKitSection({ section, intake, kit, frameworks, model })` → just the
  requested section (`'name' | 'description' | 'qualifying' | 'dmScripts' |
  'salesCallScript' | 'ad' | 'pinnedPost'`), so the editor can re-roll one part
  without touching the rest.

Inject the §3 framework modules and `VOICE_RULES` into every system prompt.
Enforce **exactly 3** questions per audience in the qualifying prompt and
validate the count server-side.

Route `src/app/api/mothermode/community/route.ts` (admin-guarded, `runtime
= 'nodejs'`, `dynamic = 'force-dynamic'`) with an action switch like the AI
route:
- `action: 'generateKit'` → validate intake → `generateCommunityKit` → return
  `{ ok, kit }`.
- `action: 'regenerateSection'` → validate `section` + current `kit` → return
  `{ ok, section, value }`.

CRUD route `src/app/api/admin/mothermode-community/route.ts`:
- `GET` → `{ success, admin, items }` (all kits for the admin list).
- `POST` → validate + `upsertKit`, `updatedBy: guard.email`, return
  `{ success: true }`.
- `DELETE` → by `id`, return `{ success: true }`.

Keep the same 400/500 JSON error shapes used across the existing routes.

---

## 7. Admin UI (`/admin/community`)

Add the `AdminSidebar` NAV entry, then:
- `src/app/admin/community/page.tsx` — server wrapper (admin-gated) loading
  `listKitsForAdmin()`.
- `src/app/admin/community/CommunityKitEditor.tsx` — client. Left: kit list
  (name + type + status). Right: a master/detail with:
  - **Intake form** (niche, audience, promise, platform, price, tone) + a
    **Generate kit** button (calls `generateKit`).
  - **Section cards** for name options (pick one → sets `name`), description,
    qualifying questions (paid + free, 3 each), DM scripts, sales call script,
    ad concept + copy + image prompt, and pinned post. Each card is editable and
    has a **Regenerate** button (calls `regenerateSection`).
  - Save (calls the CRUD `POST`), status select, delete. Reuse the save/dirty
    scaffolding from `DeliverablesEditor.tsx`.
- Optional: a **Copy** button per section and a **Copy full kit** action for
  fast hand-off into Skool/Facebook.
- Optional: render the ad `imagePrompt` through the existing `aiGenerateImage`
  client action so the admin can preview an ad visual (reuses the content-hub
  image pipeline; no new integration).

---

## 8. Optional public / share surface (decide with owner)

Round 1 can stay admin-only. If a shareable read is wanted later, add a
`published boolean` + slug route (`/mothermode/community/[slug]`) and an anon
published-only RLS policy, exactly like the Help Center viewer. Not required to
ship the generator.

---

## 9. Verification

- `npx tsc --noEmit` exits 0.
- Migration applies; admin (service role) can CRUD; no anon access (until §8).
- Generate round trip: intake → full kit with **exactly 3** paid and 3 free
  questions, all sections populated; save → reload shows the same kit.
- Regenerate one section leaves the others untouched.
- Voice-rule / compliance scan over every generated string (no em/en dashes, no
  exclamation points, no NO-list words). Reuse the compliance scan used for the
  content catalogs.
- Framework injection works: swapping a `frameworks/*` module visibly changes
  the matching section's output.
- Mapper unit test green.

---

## 10. Build order (for the fresh task)

1. Land the owner frameworks (§3) or stub them with TODO markers.
2. Migration + RLS (§4).
3. `community/types.ts` + mappers (+ test) + `community/store.ts`.
4. `openai-community.ts` generator (`generateCommunityKit`,
   `regenerateKitSection`) with framework + `VOICE_RULES` injection.
5. Generation route `/api/mothermode/community` + CRUD route
   `/api/admin/mothermode-community`.
6. `AdminSidebar` NAV + `/admin/community` editor (intake + section cards +
   regenerate + save).
7. Optional: ad image preview via existing `aiGenerateImage`; optional public
   surface (§8).
8. Verify per §9.

---

## 11. Port-doc follow-up

When built, author `docs/COMMUNITY_KIT_SYSTEM_PORT.md` (mirror
`HELP_CENTER_SYSTEM_PORT.md` / `DELIVERABLES_RESOURCES_SYSTEM_PORT.md`) and flip
this feature's row in `MOTHERMODE_CONTENT_SUITE_MASTER_PORT.md` from PLANNED to
built, listing the migration name, the framework modules, the two routes, the
generator, the editor, and the env note (no new keys beyond `OPENAI_API_KEY` +
`SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_*`).
