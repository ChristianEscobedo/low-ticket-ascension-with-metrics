# Planner ↔ Funnel Links + UTM — Handoff

> **STATUS 2026-07-26: (a)–(d) complete. Nothing is blocking.**
> The migration is applied (`mothermode_utm_links` and `mothermode_link_clicks`
> both exist and were verified with `node scripts/verify-utm-migration.cjs`), and
> (d) is built: card drawer, Tracking tab, and the clicks→opt-ins join.
>
> Sections below are kept as written, including the "Blocking" one, because the
> reasoning still explains *why* the code looks the way it does. Where a section
> is now historical it says so at the top. The one thing still outstanding is the
> `leadUtmContent.ts` shim — see "Shim deletion" at the end.
>
> Verified after (d): `npx tsc --noEmit` clean; `npx vitest run` → **39 failed /
> 702 passed**. The 39 are the documented pre-existing baseline; passes went from
> 690 to 702 (12 new tests in `tests/lib/planner-links.test.ts`).
>
> **If you just want to know how the system works, read
> `PLANNER_LINK_TRACKING_SYSTEM_PORT.md` instead.** That is the standing
> reference (architecture, operator walkthrough, invariants, remaining work).
> This file is the chronological record of how it got built and why.


**Status: (a)–(d) complete, migration applied.**

Historical note, kept because it was the whole risk of this work: the schema was written before it was run, and nothing failed at compile time, so a clean `npx tsc --noEmit` said nothing about whether it worked.

---

## Blocking: apply the migration — RESOLVED

*(Historical. The migration has been applied and the tables verified. Kept because the failure mode it describes is the one to re-check on any new environment — a fresh preview DB reproduces it exactly.)*


`supabase/migrations/20261005000000_planner_funnel_links_and_utm.sql` is registered in `supabase/_pending.json` and appended to `_bundle_pending.sql`. Registering only queues it.

Until `_bundle_pending.sql` is applied to the target database:

- `/go/<code>` 404s on **every** code — `mothermode_utm_links` doesn't exist, so no code resolves.
- `utm_content` silently records as null on every lead. `src/lib/mothermode/leadUtmContent.ts` catches PostgREST's "column does not exist" and disables the field for the life of the process. That shim is doing its job — lead capture degrades instead of 500ing — but it means **a missing migration looks exactly like no-one-used-a-tracked-link.** There is no error to notice.

Apply it, then confirm the tables are actually there before trusting anything downstream. The `_pending.json` entry should stop reporting `mothermode_utm_links` and `mothermode_link_clicks` as missing.

**Delete `src/lib/mothermode/leadUtmContent.ts`** once the migration is applied everywhere (prod + any preview/branch DBs). It exists only to cover the window where code has deployed and schema hasn't. Left in permanently it becomes a silent-null generator that hides real column problems.

---

## What (a)–(c) did

| Step | Change |
| --- | --- |
| (a) | Migration registered in `_pending.json` + `_bundle_pending.sql`. Both `CREATE TABLE`s and the `utm_content` columns verified present in the bundle. |
| (b) | `src/app/go/[code]/route.ts` — resolve code → stored destination, log click. |
| (c) | `utm_content` plumbed: `readUtm()` in `OptinPage.tsx` / `SalesOptinPage.tsx` → both capture routes → both stores → both lead record mappers → both admin CSV exports. First-touch attribution (a returning lead keeps the piece that originally found them). |

Covered by `tests/leadUtmContent.test.ts` (9 tests) and `tests/lib/planner-utm.test.ts` (36 tests).

### Invariants that must not be "cleaned up"

These are transcribed in the migration header too, deliberately, so they survive independently of this doc. Breaking any one turns a legitimate first-party short link into an ad-policy violation:

- **No cloaking.** One code → one destination for every visitor. Never branch on user-agent, geo, referrer or time. A reviewer must see what a buyer sees. (Bot UAs are *logged but not counted* — that's a metrics decision, not a routing one. The bot still gets the same destination.)
- **No open redirect.** Destination comes from the row by code lookup only. Never from `?to=`.
- **First-party only.** `/go/` is on the funnel's own domain so display URL matches landing domain.
- **302, not 301.** A 301 gets browser-cached: click counts flatline after the first hit and destination changes can't roll out. Paired with `no-store`.
- **No raw PII.** Salted IP hash only, matching the existing `ip_hash` convention.
- The click write is **awaited** — serverless freeze-on-response will drop a floating promise.

---

## (d) — the surface — BUILT

All three steps landed. Files:

| Piece | Where |
| --- | --- |
| Store: mint / list / click stats / attribution | `src/lib/offers/planner/links.ts` |
| Admin API | `src/app/api/admin/mothermode-links/route.ts` (GET, `createLink`, `deleteLink`) |
| Drawer + Tracking tab | `src/app/admin/planner/LinkTracking.tsx` |
| Wiring (tab, "Tracked links" button, destination badge) | `src/app/admin/planner/PlannerWorkspace.tsx` |
| Tests | `tests/lib/planner-links.test.ts` (12) |

1. **Mint links.** Card drawer sets `funnel_id` / `funnel_page` / `destination_url` and mints links. Destinations save through the existing planner `patchPlan` (they're plan-row fields), links through the link route — two stores, one drawer. `patchPlan` did need the three new fields allow-listed; done. UTMs pre-fill from `suggestUtm()` and stop tracking the funnel picker once the admin types.
2. **Tracking tab.** One table, sorted most-clicked first, showing source/medium/campaign, clicks, 30-day clicks, bot hits, opt-ins, CVR, last click, and copy buttons for both `/go/<code>` and the full URL.
3. **Loop closed.** `getPieceAttribution()` joins both lead tables on `utm_content`. Rows with clicks and zero opt-ins (≥5 clicks) are highlighted — that's the cell the tab exists to surface.

**The one thing to preserve here:** an opt-in count of `null` renders as `—`, never `0`, and the route sends a `warnings[]` string the tab shows in an amber banner. A failed join and a genuinely-unconverting piece look identical to a reader, and confusing them would make people bin content that works. `getPieceAttribution()` throws rather than returning empty for the same reason. Don't "simplify" the null into a zero.

Followed the existing planner UI decisions: client component with auth at the route, loose local types, one GET then targeted patches, optimistic-then-reconciled writes.

Not built (deliberate, no one asked): editing a link's UTMs after minting (delete and re-mint — mutating them retroactively rewrites history the clicks were recorded under), date-range filters, and CSV export of the tab.

---

## Test baseline

At handoff the full suite showed **39 failures, all pre-existing** and untouched by this work: Stripe/webhook/receipt suites erroring on a missing `supabaseUrl` env var, plus two MotherMode copy/image assertions. Don't read those as regressions from (d) — get a baseline run before starting.

Confirmed after (d): **39 failed / 702 passed**, same 39, passes up from 690. `npx tsc --noEmit` clean.

One pre-existing test needed a real change, not a workaround: `tests/lib/planner-board.test.ts`'s `plan()` factory builds a complete `ContentPlanRecord`, so adding three required fields to that type broke it at compile time. Fixed by adding the fields to the factory.

---

## Shim deletion

`src/lib/mothermode/leadUtmContent.ts` is **still present and still needed.** The trigger for deleting it is unchanged: the migration applied to *every* database — prod plus any preview/branch DBs — not just the one verified here. Until then it's the only thing keeping lead capture from 500ing against an un-migrated environment.

When you delete it, delete `tests/leadUtmContent.test.ts` with it, and drop the `utmContentSupported()` guards in both capture routes.
