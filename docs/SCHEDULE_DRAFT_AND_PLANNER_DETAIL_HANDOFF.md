# Schedule-as-Draft + Planner Card Detail — Handoff

**Goal:** the Content Hub's Schedule tab can push a piece out as a **draft** as
well as a live schedule; the admin Planner shows that distinction with correct
labels and platform logos, and a card opens to a detail view.

> **Shipped.** For the standing reference — the API surface, the columns, and the
> decisions that must not be undone — see `PUBLISH_STATE_SYSTEM_PORT.md`. This
> doc stays as the chronological record of how it got built.

---

## The idea this is all built around

A scheduled post and a drafted post both have a date. The only difference between
them is **whether it will publish itself**, and that difference is invisible on a
calendar that only draws dates. So the state is stored explicitly and rendered
explicitly, everywhere, rather than inferred.

Three things were deliberately *not* done, and should stay not done:

1. **`publishState` is not derived from `stage`.** Stage is a user-editable
   kanban column. Rename it, delete it, and `coerceStage` reshuffles the cards.
   "GHL is holding this as a draft for Tuesday" has to survive someone
   reorganising their board.
2. **`publishState` is not derived from `scheduledAt`.** Both states carry a
   date. That's the whole problem.
3. **`publishAccounts` is snapshotted on the card, not looked up live.** The
   planner has to draw logos for a post from six months ago, whose account may
   since have been disconnected. A live lookup would silently blank history.

---

## Done (session 5)

| Layer | File | Notes |
|---|---|---|
| Migration | `supabase/migrations/20261007000000_content_plan_publish_state.sql` | `publish_state`, `publish_target`, `publish_ref`, `publish_accounts` (jsonb), `publish_synced_at` on `mothermode_content_plan`. Additive; **needs applying**. |
| Vocabulary | `src/lib/mothermode/planner/publishState.ts` | `PublishState` = `'' \| 'draft' \| 'scheduled' \| 'published'`. `normalizePublishState`, `publishStateLabel/Help/Tone`, `willPublishItself`, `describeSchedule`, `scheduleTimeLabel`, `scheduleDateTimeLabel`, `localInputToIso`, `isoToLocalInput`, `stageForPublishState`. |
| Logos | `src/lib/mothermode/planner/platformGlyph.ts` | `canonicalPlatform` (returns `null` when unknown), `platformLabel`, `platformInitial`. Maps `twitter`→`x`, `ig`→`instagram`, `yt`→`youtube`, etc. |
| Tests | `tests/lib/planner-publish-state.test.ts` | 18 passing. |
| Types | `src/lib/mothermode/planner/types.ts` | `PublishAccount`, the five fields on `ContentPlanRecord`, optional row fields, `normalizePublishAccounts`, mapper wiring. |
| Store | `src/lib/mothermode/planner/store.ts` | `PLAN_COLUMNS` extended; upsert + patch accept and coerce all five. |
| API | `src/app/api/admin/mothermode-planner/route.ts` | `upsertPlan` and `patchPlan` allow-list the five fields. |
| Shared UI | `src/components/mothermode/planner/PublishBadges.tsx` | `PlatformGlyph`, `PlatformRail`, `PublishChip`. Inline SVG, `currentColor`, lettered fallback for unknown channels. |

Row fields are **optional** in `ContentPlanRow` on purpose: a checkout running
ahead of its migrations degrades to "Planned / no accounts" instead of throwing
on every planner read.

---

## Done (session 6) — the feature is complete end to end

| Layer | File | Notes |
|---|---|---|
| Scheduler | `src/utils/integrations/social.ts` | `createSocialPost` takes an explicit status; `'draft'` is passed through to GHL instead of being coerced to a live schedule. |
| Scheduler API | `src/app/api/mothermode/social/route.ts` | Accepts and validates the status, defaulting to `'scheduled'` so existing callers are unchanged. |
| Schedule tab | `src/components/mothermode/content/SchedulePanel.tsx` | **Draft / Scheduled / Publish now** picker with `publishStateHelp` under it. Writes the card back to the planner with all five publish fields and `stageForPublishState(state)`. |
| Planner cards | `src/app/admin/planner/PlannerWorkspace.tsx` | `PlatformRail` + `PublishChip` on calendar cells, the unscheduled strip and the board cards. |
| Detail drawer | `src/app/admin/planner/LinkTracking.tsx` (`PublishDetail`) | Publishing block above Destination: chip, `scheduleDateTimeLabel`, per-account logo + name, last-synced line, and an editable status + datetime that saves via `patchPlan`. |

Two decisions worth not undoing:

- **The calendar opens the drawer on double-click, the board on a "Details"
  button.** A card that is `draggable` still fires a click when a drag ends where
  it started, so a plain click handler popped the drawer open every time someone
  changed their mind mid-drag.
- **The drawer's status editor says "Corrects what the planner shows."** It only
  writes our row; GHL never hears about it. Labelling it "Set status" would have
  someone mark a draft `Scheduled` and expect it to fire.

Editing `stage` and `notes` from the drawer is still not wired — the board's drag
covers stage, and notes have no reader yet. `publishRef` is stored and shown via
the last-synced line but is not yet a deep link into GHL.

### Verification

- `npx tsc --noEmit` — clean.
- `npx vitest run tests/lib/planner-publish-state.test.ts tests/lib/planner-board.test.ts tests/lib/planner-links.test.ts` — 46 passing.
- The full suite still has 39 pre-existing failures in
  `tests/api/create-payment-intent`, `tests/api/webhooks`,
  `tests/lib/mothermode/compliance-pass` and `review-logic`. None are planner
  files and none were touched here.
- `tests/lib/planner-board.test.ts`'s record factory gained the five publish
  fields; `ContentPlanRecord` requires them, so a fixture missing them is a type
  error rather than a card that silently reads as `undefined`.

### Still open

- A render test for the cards and the drawer (needs a DOM environment; the
  planner suites are all pure-logic today).
- Fold the summary into `docs/PLANNER_ADMIN_UI_PORT.md` and
  `docs/CONTENT_EXPORT_SYSTEM.md`.

---

## Applying the migration

```
node scripts/verify-utm-migration.cjs   # pattern to copy for a checker
```

`20261007000000_content_plan_publish_state.sql` is additive and idempotent
(`add column if not exists`), safe to run against a live table.
