# Deliverables + Buyer Resource Workspaces — Documentation & Port Guide

The system that turns each purchased item into a long-form, brand-styled
document a buyer opens right after checkout, with admin-editable copy and
optional interactive tools that persist the buyer's own data. Part of the suite
described in `MOTHERMODE_CONTENT_SUITE_MASTER_PORT.md`.

---

## 1. Two layers

1. **Deliverable documents** — every purchasable resource (a core "what's
   inside" item or an order bump) resolves to one `DeliverableDoc`: trusted,
   hand-authored brand HTML. Code ships a full default for every resource (this
   is the actual product). An admin can override any single document from
   `/admin/deliverables` **without a deploy**; the override is merged over the
   code default at render time.

2. **Interactive resource workspaces** — some documents embed a live tool
   (Brain Dump, Weekly Reset, Load Map, Delegate Tracker). These persist the
   buyer's entries to Supabase, scoped by a self-reported email, and can keep a
   running history of periods (weeks/months) the buyer pages through and clones
   forward.

---

## 2. File inventory

Deliverables:
- `src/lib/mothermode/deliverables/types.ts` — `DeliverableDoc`
  (`slug`, `key`, `title`, `subtitle`, `html`) and `DeliverableOverrideRow`
  (the DB row for `mothermode_deliverables`).
- `src/lib/mothermode/deliverables/index.ts` — `DELIVERABLE_CATALOG` (all
  code-default docs), `getDeliverableDefault(slug, key)`,
  `listDeliverableDefaults(slug)`. Keyed by `${slug}::${key}`.
- `src/lib/mothermode/deliverables/store.ts` — Supabase read/write for
  admin overrides (service-role).
- `src/lib/mothermode/deliverables/resolve.ts` — merges a published override
  over the code default at render time.
- `src/lib/mothermode/deliverables/kit.ts` — HTML building blocks for authoring
  docs, including `interactiveSlot(id)` which emits a `data-mm-slot` marker.
- `src/lib/mothermode/deliverables/brain-dump/*` — the shipped documents
  (`brain-dump-template`, `sorting-pass`, `delegate-scripts`, `weekly-reset`,
  `load-map`, `printable-editable`, `partner-scripts-plus`, `domain-minipacks`).

Rendering + routing:
- `src/app/mothermode/resource/[slug]/[key]/page.tsx` — the delivery page.
- `src/components/mothermode/parts/ResourceDocument.tsx` — renders the doc HTML
  and mounts a workspace component wherever a `data-mm-slot` marker appears.

Interactive workspaces:
- `src/components/mothermode/parts/workspace/registry.tsx` — `WORKSPACE_REGISTRY`
  maps a `data-mm-slot` id to a React component:
  `brain-dump-workspace`, `weekly-reset-workspace`, `load-map-workspace`,
  `delegate-tracker-workspace`.
- `.../workspace/BrainDumpWorkspace.tsx`, `WeeklyResetWorkspace.tsx`,
  `LoadMapWorkspace.tsx`, `DelegateTrackerWorkspace.tsx`, `ui.tsx` (shared UI).
- `src/hooks/mothermode/useResourceWorkspace.ts` — load/save/period hook.
- `src/hooks/mothermode/useBuyerEmail.ts` — self-reported email
  (`STORAGE.buyerEmail` in `brand.ts`).
- `src/lib/mothermode/period.ts` — period keys/labels (weeks, months).

Persistence:
- `src/lib/mothermode/resourceEntries.ts` — service-role Supabase access
  (`listResourceEntries`, `upsertResourceEntry`) for
  `mothermode_resource_entries`, keyed by `(slug, key, email, periodKey)`.
- `src/app/api/mothermode/resource-entries/route.ts` — the only caller of the
  service-role client (buyer-facing GET/POST).
- `src/app/api/admin/mothermode-deliverables/route.ts` — admin override CRUD.

Admin UI:
- `src/app/admin/deliverables/page.tsx`, `DeliverablesScopePicker.tsx`,
  `DeliverablesEditor.tsx`, plus the `/admin` sidebar entry.

Migrations:
- `supabase/migrations/20260701000000_mothermode_deliverables.sql` — overrides.
- `supabase/migrations/20260705000000_mothermode_resource_entries.sql` — entries.

---

## 3. How a resource resolves at render time

1. The delivery page reads `slug` + `key` from the route.
2. `resolve.ts` looks up the published override in `store.ts`; if present, it
   merges title/subtitle/html over `getDeliverableDefault(slug, key)`; otherwise
   the code default is used verbatim.
3. `ResourceDocument.tsx` renders the (trusted) HTML. Wherever the authored HTML
   contains a `data-mm-slot="..."` marker (emitted by `kit.ts`
   `interactiveSlot`), it mounts the matching component from `WORKSPACE_REGISTRY`
   in that slot.

`key` matches an `InsideItem.resourceKey` or `OfferBump.id` 1:1, so the sales
page and the delivery page always agree on what was bought.

---

## 4. How an interactive workspace persists data

- No buyer auth in this funnel. The buyer types their email once on the resource
  page; it is cached in localStorage under `STORAGE.buyerEmail` and read via
  `useBuyerEmail`.
- `useResourceWorkspace` loads existing periods (`GET /api/mothermode/resource-entries`)
  and saves on change (`POST`), passing `{ slug, key, email, periodKey,
  periodLabel, data }`.
- The API route is the **only** code that touches the service-role client in
  `resourceEntries.ts`. RLS on `mothermode_resource_entries` grants nothing to
  anon/authenticated, so all reads/writes funnel through this route.
- Data is upserted on `(slug, key, email, period_key)` so a resource can hold a
  single ongoing record or a running history the buyer pages through
  (`period.ts` supplies keys/labels) and clones forward.

---

## 5. Adding a resource (authoring)

1. Author a `DeliverableDoc` in the offer folder (e.g. `deliverables/brain-dump/`)
   using `kit.ts` building blocks for brand-consistent HTML.
2. Register it in `DELIVERABLE_CATALOG` in `deliverables/index.ts`.
3. Ensure `key` matches the sales-page `InsideItem.resourceKey` / `OfferBump.id`.
4. To embed a live tool, call `interactiveSlot('some-id')` once in the HTML and
   add `'some-id' -> Component` to `WORKSPACE_REGISTRY`.

---

## 6. Port steps

1. **Migrations**: apply `20260701000000_mothermode_deliverables.sql` and
   `20260705000000_mothermode_resource_entries.sql`. Confirm RLS denies
   anon/authenticated on the entries table (service-role only).
2. **Env**: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (used by
   `resourceEntries.ts` and the deliverables store).
3. **Library**: port `deliverables/types.ts`, `index.ts`, `store.ts`,
   `resolve.ts`, `kit.ts`, and the `brain-dump/*` documents. Port `period.ts`.
4. **Persistence**: port `resourceEntries.ts` + `/api/mothermode/resource-entries`
   and `/api/admin/mothermode-deliverables`.
5. **Rendering**: port `ResourceDocument.tsx`, the `resource/[slug]/[key]` route,
   the workspace components + `registry.tsx`, and the hooks
   (`useResourceWorkspace`, `useBuyerEmail`).
6. **Admin**: port `/admin/deliverables` page + `DeliverablesScopePicker` +
   `DeliverablesEditor` and the sidebar entry.
7. **Verify**: `npx tsc --noEmit`; buy-flow smoke test (open a resource, type an
   email, enter data, reload, confirm persistence; publish an admin override and
   confirm it overrides the code default; a `data-mm-slot` mounts its workspace).

---

## 7. Gotchas

- `DeliverableDoc.html` is **trusted authored markup**, never user input. Keep
  it that way when porting; do not pipe buyer text into it.
- `key` collisions across offers are avoided by the `${slug}::${key}` catalog
  key. Keep both parts unique per offer.
- The self-reported email is intentionally low-friction, not identity. Do not
  build auth assumptions on it; scope data by it only.
- Only the resource-entries API route may import `resourceEntries.ts` (it holds
  the service-role client). Do not import it into client components.
