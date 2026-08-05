# Planner Admin API — System Port

Session scope: the planner's **write surface**. The data/logic layer
(`types` / `defaults` / `board`), the store, and the export bridge landed in
earlier sessions and are documented in `docs/PLANNER_SYSTEM_PORT.md`. This doc
covers the one thing that was blocking every UI surface: a guarded endpoint the
client can actually call.

---

## 1. What shipped

**`src/app/api/admin/mothermode-planner/route.ts`** — one route, two verbs.

### GET `?offerSlug=&funnelId=`

Returns the entire planner in a single payload:

```json
{
  "success": true,
  "admin": true,
  "boards": { "content": { "columns": [...] }, "leads": { "columns": [...] } },
  "destinations": { "salesFunnels": [...], "optinFunnels": [...] },
  "plan":  [ /* ContentPlanRecord[] */ ],
  "leads": [ /* LeadBoardCard[]    */ ]
}
```

Both query params are optional. `offerSlug` scopes the content plan (the same
evergreen piece can be planned once per offer); `funnelId` scopes the lead
board. Omitting them means "all".

Each content-plan row now carries planner destination fields (`funnelId`,
`optinFunnelId`, `funnelPage`, `destinationUrl`). The GET payload includes both
`destinations.salesFunnels` and `destinations.optinFunnels` so the UI can render
the destination modal without a second round trip.

**Why one payload instead of three endpoints.** Every planned surface —
calendar, content kanban, lead kanban, column editor — needs the same three
nouns, and each of them needs the *columns* before it can render a card, because
`stage` is only meaningful relative to the board's column list. Three endpoints
would mean three admin guards, three error shapes, and a client that
orchestrates a fan-out just to paint one screen. One GET, one round of joins.

### POST `{ action, ... }`

| action        | body                          | store call            |
| ------------- | ----------------------------- | --------------------- |
| `saveColumns` | `kind, name?, columns`        | `saveBoardColumns`    |
| `upsertPlan`  | `pieceId, …`                  | `upsertContentPlan`   |
| `patchPlan`   | `id, patch`                   | `patchContentPlan`    |
| `deletePlan`  | `id`                          | `deleteContentPlan`   |
| `upsertLead`  | `leadId, …`                   | `upsertLeadPipeline`  |

Unknown or missing `action` → `400` with the offending value echoed, never a
silent no-op.

`upsertPlan` and `patchPlan` now both accept and forward the destination fields
(`funnelId`, `optinFunnelId`, `funnelPage`, `destinationUrl`). The tracked-link
CRUD itself lives next door on `src/app/api/admin/mothermode-links/route.ts`.

---

## 2. Decisions worth keeping

**A drag is `patchPlan`, not `upsertPlan`.** The kanban and the calendar only
ever know three fields (`stage`, `scheduledAt`, `sortOrder`), and a card the
user hasn't opened may carry `notes`, `owner`, `externalUrl` the client never
loaded. Routing drags through an upsert would let a stale board blank those
columns on every move. `patchPlan` forwards only keys that are actually present
and correctly typed, so a partial body is a partial write.

**`scheduledAt: null` is a real value, `undefined` is not.** In `patchPlan` the
guard is `typeof … === 'string' || … === null`, which is what lets the calendar
express "drag this card back off the schedule" while an omitted key still means
"leave it alone". This is the field the export bridge reads first, so a
mistaken blanket-`null` here would silently drop every piece back to its
computed `campaignStart + week` fallback.

**Columns are normalized server-side.** `saveColumns` runs the payload through
`normalizeColumns(body.columns, defaultColumns(kind))` before it touches the
database. Malformed entries are dropped and blank ids are re-slugged, so a
hand-edited request can't persist a column with no `id` — which would orphan
every card that later coerced to it. An empty result is rejected with `400`
rather than saved as a board with nowhere to put a card.

**`upsertLead` defaults `stageManual` to `true`.** Any lead write arriving on
the admin route came from a human dragging a card. Defaulting the flag on means
that move survives the next replayed funnel webhook —
`applyFunnelEventToPipeline` respects the freeze. Callers can still pass
`stageManual: false` explicitly to hand a lead back to automation.

**`boardId` is stamped from the server's board, not the client's.** The client
never has to know a board's uuid, and can't accidentally file a content card
against the lead board.

**GET can't 500 on a fresh clone.** The store already degrades gracefully
(unconfigured Supabase or an unapplied migration returns seeded defaults and
empty card lists), so the route inherits that: a developer who has never run
`20261001000000_mothermode_planner.sql` sees an empty board with correct
columns, not an error page.

---

## 3. Verification

- `npx tsc --noEmit` ✅
- `npx vitest run` ✅ — **84 test files, 812 tests passed**
- Focused route/UI coverage now includes `tests/api/admin-planner-route.test.ts`
  (including sales and opt-in destination-field forwarding) and
  `tests/app/admin/planner-workspace.test.tsx`

---

## 4. Remaining work

1. **Environment rollout** — fresh environments still need the four planner/link
   migrations applied. The bundle is now registered in `supabase/_pending.json`
   and built into `supabase/_bundle_pending.sql` via
   `scripts/build-migration-bundle.cjs`. Apply that bundle, or run the individual
   migrations in order:
   - `20261001000000_mothermode_planner.sql`
   - `20261005000000_planner_funnel_links_and_utm.sql`
   - `20261006000000_utm_links_optin_destinations.sql`
   - `20261007000000_planner_content_plan_optin_destination.sql`
