# Publish State (Draft vs Scheduled) — System Port

Companion to `SCHEDULE_DRAFT_AND_PLANNER_DETAIL_HANDOFF.md` (the chronological
record of how this got built). This doc is the standing reference: what exists,
how to use it, and which decisions are load-bearing.

Depends on `supabase/migrations/20261007000000_content_plan_publish_state.sql`.
Additive and idempotent (`add column if not exists`), safe against a live table.
`build-migration-bundle.cjs` picks it up by its 14-digit prefix; it does not need
registering by hand.

---

## 1. The problem it solves

The Content Hub could only *schedule* a post — every send became a live schedule
that would fire by itself. There was no way to stage a post as a draft for a
human to approve inside GoHighLevel first.

Worse, once a card reached the Planner, **a scheduled post and a drafted post
looked identical.** Both carry a date, and a calendar draws dates, so the board
showed a confident-looking Tuesday slot whether or not anything would actually
publish on Tuesday. The distinction that matters — *will this go out on its own?*
— was the one thing the UI could not express.

So `publish_state` is **stored on the card and rendered explicitly**, on every
surface, and is never inferred.

---

## 2. What shipped

| Layer | File |
| --- | --- |
| Migration | `supabase/migrations/20261007000000_content_plan_publish_state.sql` |
| Vocabulary + labels + schedule formatting (pure) | `src/lib/mothermode/planner/publishState.ts` |
| Platform name canonicalization (pure) | `src/lib/mothermode/planner/platformGlyph.ts` |
| Shared badges (logo rail + state chip) | `src/components/mothermode/planner/PublishBadges.tsx` |
| Record type, row mapper, account normalizer | `src/lib/mothermode/planner/types.ts` |
| Store (upsert + patch coercion) | `src/lib/mothermode/planner/store.ts` |
| Planner API allow-list | `src/app/api/admin/mothermode-planner/route.ts` |
| GHL scheduler client | `src/utils/integrations/social.ts` |
| Scheduler route | `src/app/api/mothermode/social/route.ts` |
| Content Hub → Schedule tab | `src/components/mothermode/content/SchedulePanel.tsx` |
| Planner cards (calendar, backlog strip, board) | `src/app/admin/planner/PlannerWorkspace.tsx` |
| Planner card detail drawer (`PublishDetail`) | `src/app/admin/planner/LinkTracking.tsx` |
| Tests | `tests/lib/planner-publish-state.test.ts` (18) |

### Columns on `mothermode_content_plan`

| Column | Meaning |
| --- | --- |
| `publish_state` | `''` \| `'draft'` \| `'scheduled'` \| `'published'`. `''` renders as **Planned** — planned here, never sent anywhere. |
| `publish_target` | Which scheduler holds it: `'ghl'`, or `''` when the card only exists in our planner. |
| `publish_ref` | The scheduler's own post id, so a card traces back to the real thing. |
| `publish_accounts` | jsonb array of `{ id, platform, name }` — **a snapshot**, see §4. |
| `publish_synced_at` | When we last heard from the scheduler. Not when the card changed. |

All five are **optional on `ContentPlanRow`** (the raw row type) and **required on
`ContentPlanRecord`** (the mapped domain type). That asymmetry is deliberate: a
deploy running ahead of its migrations degrades to "Planned / no accounts"
instead of throwing on every planner read, while application code and fixtures
can never accidentally leave a field `undefined`.

---

## 3. The vocabulary

`publishState.ts` is dependency-free and shared by server and client.

```ts
PUBLISH_STATES           // ['', 'draft', 'scheduled', 'published']
SENDABLE_PUBLISH_STATES  // ['draft', 'scheduled', 'published'] — for pickers
normalizePublishState(v) // anything unrecognised → '', never a promise
publishStateLabel(v)     // 'Planned' | 'Draft' | 'Scheduled' | 'Published'
publishStateHelp(v)      // the sentence shown under the picker
publishStateTone(v)      // Tailwind classes for the chip
willPublishItself(v)     // true only for 'scheduled'
stageForPublishState(v)  // kanban column to drop the card into
```

Schedule formatting lives here too, so no surface invents its own:

```ts
scheduleTimeLabel(iso)      // '2:30 PM' — calendar cells
scheduleDateTimeLabel(iso)  // 'Mar 4, 2026, 2:30 PM' — drawer header
describeSchedule(card)      // 'Scheduled · Mar 4, 2:30 PM' — one-line summary
isoToLocalInput(iso)        // ISO → <input type="datetime-local">
localInputToIso(value)      // back again; '' means unschedule, not an error
```

**`normalizePublishState` collapses unknown input to `''`, never to `'scheduled'`.**
A typo, a renamed state from a future migration, or a garbled webhook must not be
able to make the planner claim a post will publish itself.

**The datetime-local round trip is tested in both directions** because a
half-implemented conversion silently moves posts by the UTC offset — opening the
drawer and pressing Save with no edits would retime the post.

---

## 4. Load-bearing decisions

**`publishState` is not derived from `stage`.** Stage is a user-editable kanban
column: rename it or delete it and `coerceStage` reshuffles every card into the
first surviving column. "GHL is holding this as a draft for Tuesday" is a fact
about the outside world and has to survive someone reorganising their board.

**`publishState` is not derived from `scheduledAt`.** Both draft and scheduled
carry a date. That is the entire problem this system exists to solve.

**`publishAccounts` is snapshotted on the card, not looked up live.** The planner
has to draw logos for a post from six months ago whose account may since have
been disconnected. A live lookup would silently blank out history.

**`PlatformRail` falls back to `card.platform` when `publishAccounts` is empty.**
A card planned in the Hub but never pushed to a scheduler still knows its
channel, so it still gets a logo.

**`canonicalPlatform` returns `null` for unknown platforms** rather than guessing.
The caller then draws a lettered chip from `platformInitial`, so a channel we've
never heard of renders as a readable `T` instead of a broken-image box.

**The Planner opens the drawer on double-click (calendar) and via a Details
button (board), never a plain click.** A `draggable` element still fires `click`
when a drag ends where it started, so a click handler popped the drawer open
every time someone changed their mind mid-drag.

**With no connected accounts the panel degrades to planner-only rather than
locking up.** The submit button used to require at least one selected account,
so with GoHighLevel disconnected there was nothing to select, the button was
permanently disabled, and nothing said why — it read as a broken control. Now the
button becomes "Add to planner", writes the card with `publishTarget: ''`, and
skips the scheduler entirely. Whatever is blocking the button is always named in
a line underneath it, and in this mode the picker's help text is replaced, because
`publishStateHelp` describes what the scheduler will do and there is no scheduler.

**Two response conventions live side by side — check the right one.**
`/api/admin/mothermode-planner` answers `{ success: true, record }`, while
`/api/mothermode/social` answers `{ ok: true, ... }`. `mirrorToPlanner` shipped
checking `json.ok` against the planner route, so **every** write reported "the
planner card could not be saved" while quietly returning 200 and saving it. That
is the worst direction to be wrong in: it tells the user to retry an operation
that already succeeded. `upsertPlan` is keyed on `pieceId`, so the retries
replaced the row instead of duplicating it — luck, not design.

**The drawer's status editor is labelled "Corrects what the planner shows."** It
writes only our row — GHL never hears about it. Calling it "Set status" would
have someone flip a draft to `Scheduled` and expect it to fire.

---

## 5. How to use it

### Sending from the Schedule tab

The tab renders the **same `PlatformPreview` the Preview tab uses**, not a
lookalike, above the editable caption — approving a send meant reading a wall of
plain text with no idea what would actually appear. Two honesty notes hang off it,
because a preview that can lie is worse than none:

- The preview paints from the piece, so once the caption box is edited it no
  longer shows what will be sent. That is stated, with a **Reset it** button back
  to the generated caption.
- Only an absolute `http(s)` image URL can ride along to the scheduler. A local
  or data-URL image renders in the preview but is dropped from `mediaUrls`, so
  the panel says the post will go out without it rather than letting it vanish.

`SchedulePanel` shows a three-way picker built from `SENDABLE_PUBLISH_STATES`
with `publishStateHelp(state)` printed underneath — the user is told in words that
Scheduled fires by itself and Draft does not. On submit it:

1. POSTs to `/api/mothermode/social` with the chosen status (the route validates
   it and defaults to `'scheduled'`, so older callers are unchanged);
2. POSTs `action: 'upsertPlan'` to the planner with all five publish fields plus
   `stage: stageForPublishState(state)`, so "Publish now" lands in the terminal
   column and a draft does not.

When `accounts.length === 0` step 1 is skipped and step 2 runs with
`publishTarget: ''`. `mirrorToPlanner` takes that target as its third argument
and swaps its failure message accordingly — "sent to GoHighLevel, but the planner
card failed" is a dangerous thing to say when nothing was sent, since it invites
a second send.

### The drawer's preview, link and click block

`PlanPiecePreview` (`src/components/mothermode/planner/PlanPiecePreview.tsx`)
renders the real `PlatformPreview` inside the card drawer. It cannot take the
preview from the card, because **`ContentPlanRecord` stores no copy at all** —
no hook, body, caption or image. It resolves the post in two halves:

1. `getPiece(pieceId)` — synchronous, the catalog is bundled;
2. `GET /api/mothermode/content/review?offer=<offerSlug>` for the edits and the
   replacement image, keyed by piece id.

Both halves are needed for the preview to be *true*. The catalog copy is the
original, and most pieces are edited before they ship, so the review is not a
nice-to-have — showing catalog copy as the finished post would be showing a post
that was never sent. Hence `offerSlug` on `DrawerCard`, and hence the two states
that refuse to fake it:

- **Piece not in the catalog** (any `gen_*` piece, whose copy lives with the
  batch that produced it) → an explicit "nothing to preview here" note.
- **Review fetch failed, or no `offerSlug`** → the original copy *is* rendered,
  under a line saying it may not be what went out. A missing `offerSlug` returns
  `failed` rather than `return`ing early, which would have left the spinner
  running forever.

An absent review entry is **not** a failure — it means the piece was never
edited, and `{}` is exactly what "no edits" looks like.

The links block under it now carries what a card needs weeks later: 30-day
clicks, the people count behind them (from the shared `readPeople`, with the
"likely you" flag), the last click date, and the full destination URL — a short
code hides where the link actually goes. Opt-ins render `—` when the join
failed, never `0`: this drawer is where someone decides a piece flopped, and `0`
is a verdict where a broken join is an unknown.

### Rendering a card anywhere

```tsx
<PlatformRail accounts={card.publishAccounts} fallbackPlatform={card.platform} />
<PublishChip state={card.publishState} detail={scheduleTimeLabel(card.scheduledAt)} />
```

`PlatformRail` caps at `max` accounts and then shows `+N`, so a nine-account post
can't bury the card's title. `PlatformGlyph` uses inline SVG with `currentColor`
— no network request, and the logos inherit the surrounding text colour.

### Correcting a state

`patchPlan` accepts the same five fields, so the drawer's editor, a future webhook
handler, and a drag all write through one path.

---

## 6. Verification

```
npx tsc --noEmit
npx vitest run tests/lib/planner-publish-state.test.ts tests/lib/planner-board.test.ts
```

18 + 16 passing. The full suite has 39 **pre-existing, unrelated** failures in
`tests/api/create-payment-intent`, `tests/api/webhooks`,
`tests/lib/mothermode/compliance-pass` and `review-logic`.

---

## 7. Known gaps

- **No render test** for the cards or the drawer; the planner suites are all
  pure-logic and there's no DOM environment configured for them yet.
- **`publishRef` is stored and surfaced but is not a deep link** into GHL.
- **Nothing reconciles state back from the scheduler.** If someone approves a
  draft inside GHL, our card stays `draft` until a human corrects it in the
  drawer. `publish_synced_at` and `publish_ref` exist so a webhook or poller can
  be added without another migration.
- **Stage and notes are not editable from the drawer** — the board's drag covers
  stage, and notes have no reader yet.
