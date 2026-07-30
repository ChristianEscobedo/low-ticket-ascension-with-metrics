# Content Hub UTM + Planner Add-Card — Handoff

Four asks came in after `PLANNER_LINK_TRACKING_SYSTEM_PORT.md` shipped:

1. Assign a tracked link to a post from the **Content Hub**.
2. Make the **export** carry that link.
3. **Add a card** on the Content Board.
4. **Add a card** on the Lead Pipeline.

**Session 1: (2) done end-to-end in the library layer; (1), (3), (4) not started.
Session 2: (2) is wired end-to-end through the UI, and the server seams for
(1), (3), (4) are done — what remains is two client surfaces.** Everything below the Session 2 box is the original session-1
text, kept because its reasoning still holds — except where the box corrects it.

> ### Sessions 2–3 update — read this first
>
> The **server seams for all three remaining items now exist and are verified**;
> what is left is genuinely only the client components.
>
> | Seam | Where | Serves |
> | --- | --- | --- |
> | `GET /api/admin/mothermode-links?format=byPiece&offerSlug=…` → `{ origin, linkByPieceId, scheduleByPieceId, funnels }` | `src/app/api/admin/mothermode-links/route.ts` | (1) + (2) |
> | `POST /api/admin/mothermode-planner { action: 'createLead', funnelId, email, ... }` | `src/app/api/admin/mothermode-planner/route.ts` | (4) |
> | `newManualPieceId()` | `src/lib/offers/planner/utm.ts` | (3) |
>
> **(2) is now connected end-to-end — the export actually carries tracked links.**
> `ExportPanel` fetches both maps and passes them to `previewExport`,
> `downloadExportCsv` *and* `buildExportCsv` (the Sheets path), so the preview,
> the file and the spreadsheet cannot disagree. It also states what the CSV will
> carry ("N of M library posts have a tracked link · K planner dates"), because
> the failure mode this replaces is finding out in Metricool.
>
> | Client change | Where |
> | --- | --- |
> | `usePieceLinks` / `fetchPieceLinks` / `refreshPieceLinks` — module-scoped promise cache so both consumers share one request | `src/components/mothermode/content/pieceLinks.ts` |
> | Both maps into all three export call sites + the summary line | `src/components/mothermode/content/ExportPanel.tsx` |
> | The JSX insertion, kept as a re-runnable anchored patch | `scripts/patch-export-panel-links.cjs` |
>
> The cache is module-scoped rather than lifted into `ContentHub` because the
> panel and the sheet are conditionally-mounted siblings; threading props through
> the hub would make it own state neither it nor the cards read. It invalidates
> explicitly (`refreshPieceLinks()` after minting), never on a timer, and a
> rejected fetch is evicted so one flaky request can't disable links for the
> session.
>
> `npx tsc --noEmit` clean. `planner-links`, `planner-board`, `planner-utm`,
> `planner-export-bridge`, `leadUtmContent`, `planner-manual-piece-id` all pass.
>
> ⚠️ `npx vitest run` (everything) shows **39 failures in stripe / receipt /
> review-logic / compliance-pass**. Those are pre-existing and unrelated — none of
> those suites import anything touched here, and they fail on missing Stripe env.
> Don't read them as damage from this work, and don't count them as a green run
> either.
>
> **Correction to this document:** the claim below that (4) is "UI-only because
> `upsertLead` already exists" is **wrong**, and building against it would have
> produced a form that fails at the database.
> `mothermode_lead_pipeline.lead_id` is a PRIMARY KEY *and* a FOREIGN KEY into
> `mothermode_sales_funnel_leads(id)` (see `20261001000000_mothermode_planner.sql`).
> `upsertLead` can only ever decorate a lead that already exists — handed a fresh
> uuid it fails the FK, and `listLeadBoard` reads from the leads table anyway, so
> the card would never render. Creating a lead has to write the lead row first,
> which is why the new `createLead` action calls `captureLead` and *then*
> `upsertLeadPipeline`. (3) really is UI-only; (4) never was.
>
> Two judgement calls baked into `createLead`, so the UI doesn't have to re-decide
> them: it does **not** bump `conversion_count` (the funnel didn't earn a lead an
> admin typed in, and counting it would corrupt the funnel's conversion rate), and
> it tags the lead `utm_source=manual` / `utm_medium=admin_entry` rather than
> leaving attribution blank or guessing a piece id.
>
> ### (1) shipped — where to find it
>
> **Content Hub → click any piece → the sheet's *Preview* tab → "Tracked link".**
> It shows `utm_content = <pieceId>` as read-only fact, the live `/go/<code>` link
> with a copy button once one exists, and a funnel/page picker (or a pasted URL)
> to mint one. `src/components/mothermode/content/PieceLinkPanel.tsx`, mounted by
> `scripts/wire-piece-link-panel.cjs`.
>
> Three decisions worth not re-litigating:
>
> - **`utm_content` is not editable.** It *is* the piece id, and that equality is
>   the whole join (link table ↔ captured lead UTMs ↔ export bridge). A text box
>   there would eventually get typed in, producing a link that looks right and
>   attributes nothing.
> - **No `planId` is sent.** The API takes it as optional, and a hub piece often
>   has no planner card; requiring one would mean you couldn't track a post until
>   you'd scheduled it.
> - **Minting calls `refreshPieceLinks(offerSlug)`**, so the export panel's map is
>   evicted and the next CSV carries the new link without a page reload. This is
>   the reason the cache invalidates explicitly rather than on a TTL.
>
> The content-hub funnel picker lists **sales funnels only** — a UI gap, not a
> schema one. `mothermode_utm_links.optin_funnel_id` exists (migration
> `20261006000000`), the store and `createLink` handle it, and `?format=byPiece`
> returns an `optinFunnels` array. The **planner** destination picker now exposes
> opt-in funnels as a separate dropdown; `PieceLinkPanel` still needs the same
> treatment, so in the content hub you still use the custom-URL field for a lead
> magnet.

>
> Preview tab was chosen over the schedule tab because that's where you decide a
> post is ready to go out, which is the moment you want its link.

> Remaining work, in this order:
>
> 1. ~~**Hub data layer + export wiring**~~ — **DONE** (see above).
>    Original note kept for context: **Hub data layer + export wiring** — fetch `?format=byPiece` once in
>    `ContentHub`, hold `linkByPieceId`, pass it to `ExportPanel`, and forward it
>    (with `scheduleByPieceId`) into `previewExport` / `runExport`. Both maps are
>    already accepted by `RunExportInput`; nothing in the library needs to change.
>    Fetch failure must degrade to "no tracked links", never block an export.
> 2. ~~**Per-post link control**~~ — **DONE** (see "(1) shipped" above). Original plan, which put it on the schedule tab, kept for context: the natural home is the sheet's existing
>    `schedule` tab (`ContentSheet.tsx` ~line 514, beside `SchedulePanel`), since
>    the link is part of publishing the post. Mint via the existing
>    `createLink` action with `pieceId` = the piece's id; the `funnels` list from
>    the same `byPiece` fetch populates the destination picker. Re-read the map
>    after minting so the export picks it up without a page reload.
> 3. **The two add-card forms** in `PlannerWorkspace.tsx` — plan card via
>    `upsertPlan` with `newManualPieceId()` pre-filled and **visible/editable**
>    (so it can be replaced with a real hub piece id); lead card via `createLead`.


---

## What landed

| Change | File |
| --- | --- |
| `linkByPieceId` on `BuildRowsInput`; overrides the CTA link per piece | `src/lib/mothermode/content/export/schedule.ts` |
| `scheduleByPieceId` + `linkByPieceId` on `RunExportInput`, forwarded to both `runExport` and `previewExport` | `src/lib/mothermode/content/export/index.ts` |
| `getLinkUrlByPieceId({ origin })` → `Record<pieceId, url>` | `src/lib/offers/planner/links.ts` |

`npx tsc --noEmit` clean; `content-export` + `planner-export-bridge` = 21 passed.

Note this also closes item 3 of `PLANNER_ADMIN_UI_PORT.md` §6: `RunExportInput`
never accepted `scheduleByPieceId`, so planner calendar dates could not reach a
CSV even though the bridge had been built and tested. Both maps now ride the
same rail.

`getLinkUrlByPieceId` prefers the short `/go/<code>` form when an origin is
known and falls back to the full UTM URL. When a piece has several links the
**newest wins**, because editing a minted link isn't supported and re-minting is
how an admin replaces one.

---

## The finding that changes the plan for (1) and (2)

**`/api/mothermode/content/export` does not build the CSV.** It takes an
already-built CSV string and turns it into a spreadsheet. `runExport` is called
**client-side**, from the hub's export panel.

So there is no server-side seam to drop the link map into. Whatever fetches the
map has to be the client, which means (1) and (2) collapse into one job:

> the Content Hub needs the piece→link map in the browser anyway, so fetch it
> once and use it for both the per-post UI and the export call.

Do **not** add a `linkByPieceId` load to the export route — it would sit in a
function that never touches `runExport` and would look wired without being wired.

### Suggested shape

1. Add `GET /api/admin/mothermode-links?format=byPiece` (or a small
   `/api/admin/mothermode-links/by-piece`) returning
   `{ success, linkByPieceId }` from `getLinkUrlByPieceId({ origin })`. Keep it
   behind `requireAdminRoute()` like the existing route.
2. Hub export panel: fetch it on mount, pass `linkByPieceId` (and
   `scheduleByPieceId`, already supported now) into `runExport` /
   `previewExport`.
3. Per-post UI: on the piece card/drawer show either the existing tracked link
   (copy button) or a **Create tracked link** action that POSTs
   `{ action: 'createLink', pieceId, utmContent: pieceId, baseUrl, ... }` to the
   existing route. The drawer in `src/app/admin/planner/LinkTracking.tsx`
   already does exactly this — extract or reuse rather than writing a second
   minting form, or the two will drift on the `utm_content = piece_id`
   convention that the whole join depends on.

**Watch the preview/export mismatch:** if the panel passes the map to
`runExport` but not `previewExport`, the preview will report different links
than the file. Pass both or neither.

---

## (3) and (4): add a card

**These are UI-only. The API already supports them** —
`src/app/api/admin/mothermode-planner/route.ts` has `upsertPlan` (takes
`pieceId`) and `upsertLead` (takes `leadId`). Nothing new is needed server-side.

In `src/app/admin/planner/PlannerWorkspace.tsx`, add a **+ Add card** control per
column on the Content Board and Lead Pipeline that creates the record with that
column's `stage` pre-set, then merges the returned row into local state the same
way the drag handler does.

Two things to get right:

- **A new plan card needs a `pieceId`.** It's the join key for both the export
  bridge and `utm_content`. A card created with a blank or random id is
  invisible to attribution forever. Either require it, or generate one and show
  it — don't hide it.
- A manually created **lead** should set `stageManual: true`, for the same
  reason a manual drag does: otherwise a replayed webhook drags it straight back
  out of the column someone just put it in.

---

## Why session 1 stopped here

Context was ~90% at this point. (1)/(3)/(4) all touch large client components
(`PlannerWorkspace.tsx`, the hub export panel), and starting three of them at
that level of headroom produces half-wired UI that looks finished — the specific
failure this project has already paid for twice. The library layer was taken to
a genuinely complete, verified state so the next session starts from something
that works rather than something mid-edit.

Start with the `byPiece` endpoint: (1) and (2) both unblock the moment it exists.

## Why session 2 stopped here

The same call, one layer up, and the same reasoning — with one thing learned.

Session 2 built every server seam the three UI items need and stopped before
opening `ContentHub.tsx`, `ContentSheet.tsx` and `PlannerWorkspace.tsx`. That
boundary was chosen because the seams are the part that can be *proved* — a
typecheck and a test run say they work — whereas a client component is only
provably done when someone clicks it. Splitting on "what can be verified before I
run out of room" leaves the next session with no ambiguity about what is real.

The thing learned is the FK correction in the box above. Session 1 asserted (4)
was UI-only after seeing that `upsertLead` existed; it wasn't, because the
constraint that mattered was in the migration, not the store. Confirming a write
path by reading the *schema* rather than the function that fronts it is what
turned a form that would have failed at the database into a seam that works. Two
files were read to establish it — that was the cheapest part of the session and
would have been the most expensive thing to discover from a UI bug report.



---

## Session 3 — lead magnets became linkable

Scope of the ask was four items: generalize the UTM destination beyond sales
funnels, auto-detect the destination at generation, and two add-card UIs. This
session did **one** of them end to end — the destination generalization, for lead
magnets — plus the schema and API it needed. The picker UI and the other three
are untouched and honestly unstarted.

### What shipped

| Layer | Change |
|---|---|
| Migration `20261006000000` | `mothermode_utm_links.optin_funnel_id` (FK → `mothermode_optin_funnels`, ON DELETE CASCADE), CHECK `funnel_id IS NULL OR optin_funnel_id IS NULL`, unique-combo index rebuilt to include it |
| `planner/utm.ts` | `OPTIN_PAGES`, `optinPagePath`, `optinPageUrl`, `optinPageLabel` |
| `planner/links.ts` | `optinFunnelId` through `LINK_COLUMNS`, `UtmLinkRecord`, mapper, `listUtmLinks` filter, `CreateUtmLinkInput`, insert row + a both-destinations guard |
| `api/admin/mothermode-links` | `createLink` resolves an optin step server-side; `?format=byPiece` also returns `optinFunnels`; 400 on two destinations |
| Tests | `tests/lib/planner-optin-destinations.test.ts` — 7 passing |

Typecheck clean. The migration needs no registration: `build-migration-bundle.cjs`
globs any `^\d{14}` filename.

### Two decisions worth not re-litigating

**Why `optin_funnel_id` and not `destination_kind` + `destination_id`.** A
polymorphic id cannot carry a foreign key. The table was built with ON DELETE
CASCADE so retiring a funnel retires its links; polymorphic columns trade that
for live `/go/<code>` links pointing at deleted funnels, discovered by traffic.
One nullable FK per kind is more columns and less silence. Revisit only if the
kinds stop being countable on one hand.

**Why lead magnet steps are a separate list from sales funnel steps.** The
vocabularies are not interchangeable: `checkout`/`upsell1..4` vs `oto`/`thank-you`.
Merging them into one dropdown lets an admin pick a step the destination does not
have, which mints a link to a 404. `byPiece` therefore returns `funnels` and
`optinFunnels` separately, and the UI must key its step list off which one is
selected.

### Finding: resources cannot be tracked destinations yet

Deliberately left out. `mothermode_resource_entries` / `mothermode_deliverables`
have **no public route** — `src/app` has `/funnel` and `/optin` but nothing that
serves a resource to a cold visitor; they live behind purchase. A resource picker
would mint links that 404. They stay on the `destination_url` paste path until a
public resource page exists. That's a product decision, not a missing function.

### Finding: auto-detect has nothing to read

The generator receives **offer context only** (scene, mechanism, old/new way,
outcomes). There is no funnel, lead-magnet, or step context anywhere in
generation, and `src/lib/mothermode/content` has zero references to a
destination. "Auto-detect the destination from generation context" cannot be
built against today's inputs. It splits into:

1. **Make it true forward** — a destination picker in the Generate drawer's
   compose step, persisted on the piece. Needs a column on
   `mothermode_generated_content` (generation currently ships no migration;
   drafts are client-side until save).
2. **Infer for the existing library** — match caption/CTA text against funnel
   names and surface it as a *suggestion*, never auto-applied. A wrong
   auto-assignment is worse than none: it produces confident bad attribution,
   and nobody audits a field that looks filled in.

### Remaining, in dependency order

1. **`PieceLinkPanel` grouped picker** — the only thing between this session's
   work and an admin being able to use it. Destination group (Sales funnels /
   Lead magnets) → step list keyed off the selection → POST `optinFunnelId`
   instead of `funnelId`. Server side is done and typed; this is UI only.
2. ~~**Planner link table picker** for lead magnets (`LinkTracking.tsx`)~~ — **DONE**.
   The planner GET payload now returns `destinations.optinFunnels` alongside
   `destinations.salesFunnels`, and the destination editor in `PlannerWorkspace.tsx`
   lets a card point at an opt-in funnel step (`optin`/`oto`/`thank-you`).
3. **Add-plan-card / add-lead-card UIs** — `upsertPlan` / `upsertLead` already
   exist. A new plan card **must** get a real `pieceId` or it is invisible to
   attribution forever.
4. **Destination at generation** (1 and 2 above under auto-detect).

### Note on this session

Three tool crashes, all on high-context multi-command shell calls. Everything
survived because each change was a single anchored script with an abort-on-miss
guard, run and verified before the next one. The API patch was verified for
*placement* as well as typecheck (`scripts/verify-optin-branch-placement.cjs`):
`String.replace` takes the first match, so an injected branch can land in the
wrong handler and still compile. Worth keeping that habit for anything inserted
by anchor.

---

## Click visibility across surfaces (session 3)

Diagnosed with `node scripts/inspect-tracked-link-clicks.cjs` (read-only). It
separates the three failures that look identical in the admin: the click row not
being written, `click_count` drifting from the rows, and `utm_content` matching
no post.

Verified against live data: clicks **are** recorded — 1 click row, counter in
sync, `ua_family=desktop`. The gap was elsewhere. `utm_content=fb-reel-1` matches
**no plan card**, because the database has zero plan cards. Per-post metrics has
no post to attach the click to. That is the same missing add-card UI listed
earlier in this doc, so build that first — otherwise per-post numbers stay empty
no matter how many surfaces read them.

### Shared seam (built, tested)

`rollupClicks()` (pure) and `getClickRollups()` in `planner/links.ts` return
`totalClicks`, `recentClicks`, `botClicks`, `lastClickAt`, `linkCount`,
`linksWithClicks`, and `byFunnelId` / `byOptinFunnelId` / `byPieceId`.
6 tests in `tests/lib/planner-click-rollups.test.ts`.

One aggregation rather than three ad-hoc sums, because three surfaces each
summing their own way is how you get three different click numbers on three
screens and no way to tell which is right.

**Two numbers on purpose.** `totalClicks` is the all-time `click_count` counter;
`recentClicks` is the click rows, which are windowed *and* row-capped. Never add
them, never substitute one for the other — the total would shrink as the window
slides. Bots stay in their own field because `/go/<code>` logs a bot hit without
incrementing the counter, so counting rows naively puts a larger unexplained
"clicks" figure next to the counter. Per-key breakdowns use the all-time counter
so a funnel number never drops just because clicks aged out.

`byPieceId` keys on `utm_content`, falling back to `piece_id`: the lead row
carries `utm_content`, so it is the only key that can join to attribution.
Zero-click links are omitted from the breakdowns rather than emitted as `0` — an
empty row reads as "measured and failed" instead of "never used".

### Wired

`/admin` overview — a **Tracked link clicks** card (all-time, with 30d, bots
excluded, and links-used underneath) plus a Content Planner quick link. It
degrades to `n/a`, never `0`, and cannot take the revenue dashboard down: the
planner migration may legitimately not be applied on a given database, and `0`
would be a claim that nobody clicked.

### Not wired yet (both small now the seam exists)

1. **Funnel dashboard** — `src/app/admin/funnel-stats/page.tsx` (200 lines,
   server component). Read `getClickRollups()`, index `byFunnelId` by the funnel
   id already in scope, and copy the `safeClickRollups()` degradation from
   `src/app/admin/page.tsx`. Lead magnets use `byOptinFunnelId`.
2. **Per-post metrics** — `PieceLinkPanel.tsx` (client). Add `clicks` to the
   `?format=byPiece` payload in `mothermode-links/route.ts`, keyed by
   `utm_content`, then render it next to the piece’s tracked link. Show
   opt-ins from `getPieceAttribution()` beside it: clicks alone tell you the
   post worked while hiding that the destination did not, which is the exact
   read the amber zero-optin highlight exists to prevent.

---

## Session 3 — add-card UI + clicks on funnel stats

### Built and verified

**1. Planner add-card UI** — `src/app/admin/planner/AddPlanCard.tsx`, rendered
from `PlannerWorkspace` on the Content Board tab.

- Posts the existing `upsertPlan` action; no API or store change was needed.
- The piece id is **pre-filled from `newManualPieceId()` and shown as an
  editable field**, because a card saved with a blank `piece_id` is invisible
  to the export bridge, to `utm_content`, and to click attribution — forever,
  and silently, since "no attribution rows" and "no such piece id" are the
  same empty result. The generated id is stable for the life of the open form
  and re-generated after each save.
- Dates are sent as **noon local**, not midnight: midnight local converted to
  UTC lands on the previous day west of GMT, which would shift every scheduled
  post by one day in both the calendar and the CSV.

**2. Clicks on `/admin/funnel-stats`** — three tiles (all-time, 30d, clicks
per purchase) plus a "Traffic by post" table off `byPieceId`.

- The wrapper that keeps clicks from taking a revenue page down now lives in
  the lib as `getClickRollupsSafe()` (`planner/links.ts`) and is shared by the
  overview and funnel-stats. Previously the overview held a private copy;
  two pages inventing their own fallback is how one screen shows `0` while
  the other shows `n/a` from the identical failure. Failure still renders
  `n/a` — an unapplied migration must not read as "nobody clicked".

### Correction to this document

An earlier section of this handoff said to index `byFunnelId` on funnel-stats
using "the funnel id already in scope". **There is no funnel id in scope on
that page.** Its breakdowns are Stripe `product_id` and `page_type`; no
mothermode funnel record is loaded there. Showing "clicks per funnel" would
have required inventing a join that does not exist, so clicks are surfaced by
*piece* instead, which is the key that actually carries traffic. The tiles
also carry a caveat line: clicks and purchases are not a matched pair, since a
click can convert weeks later and direct traffic buys without one.

### Still not started

- **Per-post clicks inside `PieceLinkPanel`** (content hub). Needs a read path
  to per-piece counts from a client component — the panel has no server props.
- **Add-lead card UI.** `upsertLead` already exists and the drag path already
  calls it; this is a form only.
- **Lead-magnet picker for tracked links.** UI over the existing destination
  fields.

Stopped at ~80% context with these three untouched rather than half-wiring
them. Two failing tests in the suite (`compliance-pass`, `review-logic`) are
pre-existing and unrelated — neither file appears in this session's diff.

## Session 4 — the last three client components

### Built

**1. Per-post clicks in `PieceLinkPanel`.** A Clicks / Opt-ins / Purchases strip
on each hub piece, keyed by piece id — `utm_content` *is* the piece id, so no
join had to be invented. It renders only once a link exists: three zeros sitting
next to "create a tracked link" reads as a bug rather than as an accurate absence
of history.

Clicks and opt-ins are separate reads, so one can show a real number while the
other shows `n/a`, and `n/a` is never collapsed into `0`. "The planner
migration isn't applied" and "this post got no clicks" are opposite facts that an
admin acts on differently, and only one of them is a reason to stop posting. When
clicks >= 5 and opt-ins are 0 the panel says so in words: that pair means the hook
works and the page it lands on doesn't, which is the most actionable signal the
system produces. The floor of 5 keeps a single link-preview hit from accusing a
brand-new post of failing.

**2. Lead-magnet picker** in the same panel. Destination is a three-way
discriminator — sales funnel / lead magnet / custom URL — not one merged funnel
dropdown, because the two funnel types don't share a step vocabulary:
`checkout` and `upsell1` don't exist on an opt-in funnel, and `oto` and
`thank-you` don't exist on a sales funnel. A merged list would happily offer a
step the chosen destination lacks and mint a link that 404s in production only.
Switching kind resets the step to `optin`, the one name both vocabularies share.

**3. `AddLeadCard` on the Lead Pipeline tab.** It posts `createLead`, never
`upsertLead`: the pipeline table's `lead_id` is a foreign key into funnel
leads, so handed a fresh id `upsertLead` fails the constraint — the lead has to
be captured first. Funnel is required because leads are unique per (funnel_id,
email). `utm_content` is optional and labelled "leave it blank unless you know",
because a guessed value is worse than an empty one: it is indistinguishable from a
tracked click and quietly inflates one post's credit. Deal value takes dollars and
stores cents, rounding *after* the multiply so 29.99 lands on 2999 rather than
2998. Follow-up dates post at noon local, matching `AddPlanCard`, so UTC
conversion can't render every task as due a day early. When the server reports
`isNew: false` the UI says "already existed on this funnel — moved onto the
board" instead of "created", so nobody goes looking for a second card.

Both new forms prepend the returned record instead of reloading, which keeps an
in-flight optimistic drag from being dropped. `AddLeadCard` merges the email and
name in from the form because the pipeline record doesn't carry them — they live on
the leads table — and without that the new card would render as a bare uuid until
the next full load.

### The "2 failing tests" line in this document was environment-specific

Full run this session: **39 failed / 722 passed** across 6 files. 37 of the 39 are
one cause — `Error: supabaseUrl is required` — in `create-payment-intent`,
`webhooks`, `receipt` and `receipt-template`, which read Supabase env at
import time; this shell had no env loaded. The remaining two are the already
documented `compliance-pass` and `review-logic` assertion failures. None of the
six files import anything this session touched. Typecheck is clean.

`scripts/summarize-test-failures.cjs` was added to collapse a run log into
per-file failure counts, because after a change the only question that matters is
whether the failure *set* grew, and that was buried in ~300 lines of stacks. It
decodes UTF-16 as well as UTF-8: PowerShell's `>` writes UTF-16LE, and read as
UTF-8 every regex silently matches nothing — which looks exactly like "no
failures" instead of "unreadable file".

### Remaining

Nothing left from the original four asks. The open items are the ones this document
already records as blocked on other systems: resources still aren't valid tracked
destinations, and auto-detect still has nothing to read.
