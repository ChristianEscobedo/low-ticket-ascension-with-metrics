# MotherMode Planner — Content Calendar + Content Kanban + Lead Kanban

Status: **data + logic + store + export bridge complete, UI not built yet.**

The planner is the tracking/organization layer that sits on top of two systems
that already exist but currently have nowhere to *manage* work:

- **Content suite** (`src/lib/mothermode/content/**`) generates pieces, media,
  compliance passes and exports — but a piece's state lives scattered across
  review versions, generated-content rows and export schedules.
- **Sales funnels** (`src/lib/mothermode/sales/**`) capture leads and fire
  events — but leads are a flat table with a `status` string.

The planner adds three views over that existing data. Crucially it does **not**
duplicate content bodies or lead identities; it is an overlay.

---

## 1. Why three surfaces, and why they share one table

| Surface | Question it answers | Backed by |
| --- | --- | --- |
| **Content calendar** | "What goes out, and when?" | `mothermode_content_plan.scheduled_at` |
| **Content kanban** | "What state is each piece in?" | `mothermode_content_plan.stage` |
| **Lead kanban** | "Where is each lead in the pipeline?" | `mothermode_lead_pipeline.stage` |

The calendar and the content kanban are **two views of one table**, not two
tables. This matters: dragging a card from `review` → `approved` on the board and
dragging it onto next Tuesday on the calendar are edits to the same row. If they
were separate stores they would drift within a day of real use.

The lead board is separate because it tracks a different noun (a person, not a
post) and has a different automation model (see §4).

---

## 2. Schema

`supabase/migrations/20261001000000_mothermode_planner.sql`

### `mothermode_planner_boards`
Column definitions as JSONB, one default row per `kind` (`content` | `leads`),
enforced by a partial unique index on `(kind) WHERE is_default`.

Columns are **user-editable data, not an enum**. Renaming "Review" to "Legal
Check", adding a "Waiting on Client" column, or deleting a stage should be a
save, not a migration. Consequently `stage` on both card tables is `TEXT` with no
FK — the app is responsible for keeping stages valid (see `coerceStage`).

### `mothermode_content_plan`
One row per planned piece, `UNIQUE (piece_id, offer_slug)`. Planning the same
evergreen piece for two offers is legitimate; planning it twice for one offer is
a bug, so the DB rejects it.

`scheduled_at` is the draggable publish moment and is now the **highest-priority
source of truth for exports** — preferred over `SavedVersion.scheduledFor` and
over the derived `campaignStart + week` maths in
`src/lib/mothermode/content/export/schedule.ts` (see §5). `NULL` = still in the
backlog, and falls through to the older behaviour.

Facets (`platform`, `format`, `kind`, `title`) are denormalized so a board of 200
cards can filter and render without loading 200 content bodies.

Destination fields (`funnel_id`, `optin_funnel_id`, `funnel_page`,
`destination_url`) tell a card where it points. `funnel_id` and `optin_funnel_id`
are mutually exclusive (`mm_content_plan_one_destination` CHECK), and
`funnel_page` holds the step for whichever kind is selected. The opt-in column was
added in migration `20261007000000_planner_content_plan_optin_destination.sql`.

### `mothermode_lead_pipeline`
A **sidecar** keyed on `lead_id`, not extra columns on
`mothermode_sales_funnel_leads`. Two reasons:

1. Lead capture (`/api/funnel/capture`) is a hot, public write path. CRM fields
   (owner, next action, notes, value) are admin-owned and change on a completely
   different rhythm. Keeping them apart means an admin editing notes can never
   contend with or corrupt a capture.
2. Leads with **no** pipeline row still render on the board, seeded from their
   existing `status` / `step_reached` via `seedLeadPipeline`. The board is fully
   populated on day one with zero backfill migration.

All three tables are RLS-enabled with service-role-only policies. There are no
anon policies: the planner is internal admin surface.

---

## 3. Library layer

`src/lib/offers/planner/`

| File | Contents |
| --- | --- |
| `types.ts` | `PlannerColumn`, `ContentPlanRecord`, `LeadPipelineRecord`, row↔record mappers, `toColumnId`, `normalizeColumns`, `coerceStage` |
| `defaults.ts` | `DEFAULT_CONTENT_COLUMNS`, `DEFAULT_LEAD_COLUMNS` (app-side twins of the SQL seed) |
| `board.ts` | All pure logic: stage derivation, event automation, drag maths, calendar bucketing |
| `store.ts` | Supabase I/O: boards, content plan, lead pipeline |
| `index.ts` | Barrel |

`board.ts` deliberately imports nothing but types. Every function is a function
of its arguments, so the same rules run on the server (API routes applying
events) and on the client (optimistic drag updates) with no risk of divergence.

Tests: `tests/lib/planner-board.test.ts` + `tests/lib/planner-export-bridge.test.ts`
— **37 passing** across the planner and export suites.

### Store posture

`store.ts` mirrors `sales/store.ts`: service-role client, and **graceful
degradation** — an unconfigured Supabase or an unapplied migration returns the
seeded defaults from `defaults.ts` and empty card lists rather than throwing, so
the planner renders empty boards instead of a 500.

`applyFunnelEventToPipeline` is the server-side wrapper around the pure
`applyLeadEvent`: it loads the row (seeding from the lead's existing `status`
when no pipeline row exists), runs the rules, and **skips the write on an
identity match**. A replayed webhook therefore costs one read and no write.

### Invariants worth knowing

**Columns can be deleted, so cards can be orphaned.** `coerceStage` snaps any
unknown stage to the board's first column. `groupByStage` pre-seeds a bucket for
every column (so empty columns still render as drop targets) and funnels orphans
into the first one. A deleted column can never hide a card.

**`deriveContentStage` degrades, it doesn't guess wildly.** It reads the most
advanced signal available (published version → scheduled → approved/compliance
clean → compliance run → media exists → edits exist → idea). If the board lacks
the ideal column it falls back to the closest earlier one. A piece is only
`published` if something recorded it published, and only `approved` if a human or
compliance approved it — the planner never optimistically claims work is done.

**Sort order uses midpoint insertion** (`SORT_STEP = 100`). A drop writes one
row instead of renumbering the column. When the gap collapses,
`sortOrderForDrop` returns the lower bound as a signal and the caller renumbers
with `normalizeSortOrders`.

**Rescheduling preserves time-of-day.** Dropping a card on a calendar day keeps
its existing hour/minute (defaulting to 09:00 for a card that had no date). A
carefully chosen 7pm posting slot is not silently reset to midnight by a drag.

---

## 4. Lead automation: auto-advance, with a human override

Funnel events already exist (`mothermode_sales_funnel_events.event_type`).
Columns opt into them via `autoEvents`:

```
optin_submit              → New
sales_view / vsl_view     → Engaged
checkout_start            → Checkout Started
purchase                  → Customer
upsell_yes                → Upsell Taken
```

`applyLeadEvent` enforces three rules in order:

1. **`stage_manual` wins.** Once an admin drags a card, automation stops touching
   it. Automation must never undo human judgement.
2. **Unclaimed events are ignored.** No column claims it → no change.
3. **Forward only.** A replayed or late `optin_submit` can never drag a Customer
   back to New. Webhook retries are therefore harmless.

Nurturing, Call Booked, Closed Won and Closed Lost have **no** `autoEvents` by
design: nothing in the funnel can know a call was booked or a deal was lost.
Those are human-only columns.

`applyLeadEvent` returns the *same object reference* when nothing changed, so
callers can skip the DB write with an identity check.

---

## 5. Export bridge (done)

`buildExportRows` now resolves a piece's publish time by precedence:

```
planner calendar (scheduled_at)  →  SavedVersion.scheduledFor  →  campaignStart + week
```

The caller passes `scheduleByPieceId` (from `getScheduleByPieceId`), so the pure
export layer stays dependency-free and testable — the store lookup happens in the
route, not inside the builder. The computed `campaignStart + week` fallback still
runs for every piece, so a piece that was never dragged onto the calendar exports
exactly as it did before: this is additive, not a behaviour change.

The planner date is parsed with the existing `parseScheduledFor`, which returns
`null` on invalid ISO — so a corrupt `scheduled_at` degrades to the next
precedence level instead of producing an `Invalid Date` row. Range filtering and
the final ascending sort both operate on the resolved time, meaning a card
dragged into next month leaves the current month's export by itself.

---

## 6. What's left to build

1. **API** — `src/app/api/admin/mothermode-planner/route.ts` (boards + cards CRUD,
   admin-gated) and a hook in the funnel event write path calling
   `applyLeadEvent`.
2. **UI**:
   - `src/app/admin/planner/page.tsx` with three tabs (Calendar / Content Board /
     Leads Board), following the `admin/sales-funnels` tab-parts pattern.
   - `ContentCalendar.tsx` — month grid + backlog rail, `groupByDay` /
     `rescheduleToDay`.
   - `KanbanBoard.tsx` — one generic component driven by `PlannerColumn[]`,
     rendered twice (content cards vs lead cards). Column config editor
     (rename/reorder/add/remove, colour, WIP limit) lives here.
3. **Wire the bridge into the export route** — `getScheduleByPieceId` exists and
   `buildExportRows` consumes it; `/api/mothermode/content/export` still needs to
   pass it through.
4. **Migration bundle** — the new migration needs registering via
   `scripts/build-migration-bundle.cjs` / `supabase/_pending.json` before deploy.

WIP limits are intentionally **soft** (`isOverWipLimit` returns a boolean for a
warning chip). Blocking a drag because a column is full is the fastest way to
make a solo operator abandon a board.
