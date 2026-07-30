# Planner — Admin UI Port

**Status: complete.** The planner is visible and interactive at `/admin/planner`, linked from the admin sidebar, and now includes tracked-link creation plus per-card destination editing. This doc covers the UI layer only; the data/logic layer is in `PLANNER_SYSTEM_PORT.md` and the endpoint in `PLANNER_ADMIN_API_PORT.md`.

Cards also carry **platform logos and a publish-state chip** (Planned / Draft / Scheduled / Published) on the calendar, the unscheduled strip and the board, and open to a detail drawer with a Publishing block. That layer is documented separately in `PUBLISH_STATE_SYSTEM_PORT.md` — including why the calendar opens the drawer on double-click rather than a single click.

---

## 1. Why nothing was visible before this session

Worth recording, because it was the honest answer to "are we done?" — no. The previous sessions built, in order: pure board logic (`board.ts`), the schema, the store, the export bridge, and then the write endpoint. Every one of those is correct and tested, and **not one of them renders a pixel.** A feature that only exists below the API line is invisible to the person who asked for it, so "37 tests pass" was true and also not the same thing as "done." This session closes that gap.

## 2. Files

| File | Role |
| --- | --- |
| `src/app/admin/planner/page.tsx` | Route. Thin server component, `force-dynamic`. |
| `src/app/admin/planner/PlannerWorkspace.tsx` | The whole surface: 5 tabs, drag handling, destination editing, fetch/save. |
| `src/app/admin/planner/LinkTracking.tsx` | Tracking tab + per-piece tracked-link drawer. |
| `src/app/admin/AdminSidebar.tsx` | One nav entry added: `{ href: '/admin/planner', label: 'Planner' }`, placed after Funnel Stats so the funnel group stays contiguous. |

## 3. Decisions

**Client component, server-side auth.** Dragging is inherently interactive, so the workspace is `'use client'` and therefore cannot import the service-role store. Authorization is not duplicated in the page — it lives on `/api/admin/mothermode-planner`, which is where the data actually crosses the trust boundary. A non-admin who reaches the URL gets a page that renders and then shows the API's error, not a page that leaks rows.

**Loose local types.** `PlanCard` / `LeadCard` / `Column` are re-declared in the component instead of imported from `src/lib/offers/planner/types.ts`. This is deliberate: the component's real contract is the route's JSON, and keeping it structural means a field added to the store's types doesn't have to ripple into the client before the build passes.

**One GET, then patches.** The workspace loads the entire planner once (both boards' columns, plan cards, lead cards) because `stage` is meaningless without its board's column list. Each drag then fires exactly one `patchPlan` / `upsertLead` — never a full save — so a stale tab can't blank `notes`, `owner` or `externalUrl` it never loaded.

**Optimistic, then reconciled.** A drag updates local state immediately, POSTs, and merges the returned record over the optimistic one; the server stays the authority on stage coercion and sort order. If the POST fails, the error surfaces *and* a reload runs, so the card visibly snaps back rather than lying about being saved.

**Calendar drags preserve time-of-day.** `withDate()` keeps the existing hour/minute and only moves the date, defaulting to 09:00 for a card that had no `scheduledAt`. A month grid is a statement about the *date*; zeroing to midnight would silently retime every post the moment someone tidied the calendar — and since planner `scheduled_at` wins the export bridge's precedence chain, that mistake would land in the exported CSV.

**Column editor is draft-then-save.** Renaming a column is not saved per keystroke, because blank ids get slugged from the label server-side; saving on every character would re-slug mid-word and strand the cards sitting in the old id.

**WIP limits are advisory.** Over-limit columns turn the count amber. The drop is not blocked — the board reflects reality rather than refusing to.

## 4. Surfaces

- **Calendar** — month grid with prev/next, plus an "Unscheduled" tray. Drag either direction; the tray is the only way to see a card the computed `campaignStart + week` fallback would otherwise hide.
- **Content Board** — a column per `boards.content.columns`, drag to change `stage`, blocked cards flagged. Each card can also store a destination (`funnelId`, `funnelPage`, `destinationUrl`) before minting links.
- **Lead Pipeline** — a column per `boards.leads.columns`. A manual drag sets `stageManual: true` (server default), which is what stops a replayed webhook from dragging the lead back; cards carrying that flag say "Manual stage".
- **Columns** — rename / retarget WIP / add / remove, per board.
- **Tracking** — per-link stats, short-link copy, row-level click/attribution rollups, and a creation drawer seeded from the selected content card.

## 5. Verification

Current branch validation:

- `npx tsc --noEmit` ✅
- `npx vitest run` ✅ — **84 test files, 812 tests passed**
- Focused UI/API coverage now includes `tests/app/admin/planner-workspace.test.tsx` (sales + opt-in destination picker) and `tests/api/admin-planner-route.test.ts` (including opt-in destination forwarding)

## 5b. Since this port: link tracking

The planner has gained a fifth tab (**Tracking**) and a per-card **Tracked
links** drawer, both in `src/app/admin/planner/LinkTracking.tsx`. Content cards
also gained a destination editor in `PlannerWorkspace.tsx` for `funnelId`,
`optinFunnelId`, `funnelPage` and `destinationUrl`, and the link drawer seeds
from those values. The destination editor exposes both **sales funnels** and
**opt-in funnels** as separate dropdowns with mutually-exclusive page/step
selectors, so an admin cannot accidentally choose a checkout step on a lead
magnet. These follow the decisions in §3 unchanged. Documented separately in
`PLANNER_LINK_TRACKING_SYSTEM_PORT.md` — read that before touching
`PlannerWorkspace.tsx`, because the card markup now carries a click target that
has to stay a `<button>` rather than a handler on the draggable card itself.

---

## 6. Remaining follow-ups

1. **Environment rollout** — fresh environments still need the four planner/link
   migrations applied. The bundle is now registered in `supabase/_pending.json`
   and built into `supabase/_bundle_pending.sql` via
   `scripts/build-migration-bundle.cjs`. Apply that bundle, or run the individual
   migrations in order:
   - `20261001000000_mothermode_planner.sql`
   - `20261005000000_planner_funnel_links_and_utm.sql`
   - `20261006000000_utm_links_optin_destinations.sql`
   - `20261007000000_content_plan_publish_state.sql`

   This list previously ended with a
   `20261007000000_planner_content_plan_optin_destination.sql` that **does not
   exist and never did** — opt-in destinations landed on `mothermode_utm_links`
   in the `20261006000000` migration, and nothing selects an
   `optin_funnel_id` on `mothermode_content_plan`. It has been replaced with the
   real migration that now owns that timestamp; leaving it would have sent
   someone hunting for a missing file, or worse, had them assume the publish-state
   migration was already applied because the prefix matched.
2. Nice-to-have: a card detail drawer for editing `notes`/`owner`/`externalUrl`, which the API's `patchPlan` already accepts.

## Creating rows from the UI: AddPlanCard and AddLeadCard

Both boards could previously only display rows created elsewhere. Two small
client components close that.

**`AddPlanCard` (Content Board tab)** posts through the existing `upsertPlan`
action. The generated piece id is **shown and editable**, because a blank piece id
silently orphans the card from export, UTM tagging, and attribution permanently —
and nothing later in the pipeline can recover it. Dates post at **noon local**, so
UTC conversion can't shift a post a day earlier than the day it was planned for.

**`AddLeadCard` (Lead Pipeline tab)** posts `createLead`, **never**
`upsertLead`: the pipeline table's `lead_id` is a foreign key into funnel
leads, so handed a fresh id, upsert fails the constraint — the lead has to be
captured first. Funnel is required, because leads are unique per
(funnel_id, email).

- `utm_content` is optional and labelled "leave blank unless you know". A
  guessed value is worse than an empty one: it's indistinguishable from a real
  tracked click and quietly inflates one post's credit.
- Deal value takes **dollars** and stores **cents**, rounding *after* the multiply
  so 29.99 lands on 2999 rather than 2998.
- Follow-up dates post at noon local, matching `AddPlanCard`.
- `isNew: false` from the server renders as "already existed on this funnel —
  moved onto the board", not "created", so nobody hunts for a second card.

Both forms **prepend the returned record** rather than triggering a full reload,
which keeps an in-flight optimistic drag from being dropped. `AddLeadCard` also
merges the email and name in from the form, because the pipeline record doesn't
carry them (they live on the leads table) and without it the new card renders as a
bare uuid until the next full load.
