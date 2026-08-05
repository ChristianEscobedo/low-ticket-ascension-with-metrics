# Planner Link Tracking (UTM + `/go/`) — System Port

Companion to `PLANNER_FUNNEL_LINKS_UTM_HANDOFF.md` (which is the chronological
record of how this got built, including the migration that blocked it). This doc
is the standing reference: what exists, how to use it, and which decisions are
load-bearing.

Depends on `supabase/migrations/20261005000000_planner_funnel_links_and_utm.sql`.
Applied, verified with `node scripts/verify-utm-migration.cjs`.

Then `supabase/migrations/20261006000000_utm_links_optin_destinations.sql`, which
adds lead-magnet (opt-in funnel) destinations. Ship both or the store selects a
column that does not exist. `build-migration-bundle.cjs` picks both up by their
14-digit prefixes; neither needs registering by hand.

---

## 1. The problem it solves

The content planner could say *what was posted and when*. It could not say
**which post produced a lead**. Everything downstream of a post — the click, the
landing page, the opt-in — was recorded, but nothing tied the three together, so
the only available read on content performance was platform vanity metrics.

The join key is `utm_content = piece_id`. A tracked link carries the planner's
own piece id into the URL; the capture routes write it onto the lead row; the
Tracking tab groups by it. That one convention is the entire mechanism.

---

## 2. What shipped

| Layer | File |
| --- | --- |
| Pure helpers (UTM build/parse, slugify, short codes, UA family) | `src/lib/offers/planner/utm.ts` |
| Store (mint, list, click stats, roll-ups, attribution) | `src/lib/offers/planner/links.ts` |
| Clicks→people rule (no imports, shared server+client) | `src/lib/offers/planner/clickPeople.ts` |
| Public redirect — the only place a click is recorded | `src/app/go/[code]/route.ts` |
| Admin API | `src/app/api/admin/mothermode-links/route.ts` |
| Admin UI (drawer + tab) | `src/app/admin/planner/LinkTracking.tsx` |
| Planner wiring | `src/app/admin/planner/PlannerWorkspace.tsx` |
| Content-hub mint panel (piece sheet → Preview) | `src/components/mothermode/content/PieceLinkPanel.tsx` |
| Content-hub metrics block + shared value derivation | `src/components/mothermode/content/PieceClickMetrics.tsx` |
| Client fetch/cache for both hub surfaces | `src/components/mothermode/content/pieceLinks.ts` |
| Dashboard readers | `src/app/admin/page.tsx`, `src/app/admin/funnel-stats/page.tsx` |
| Lead-side plumbing | both capture routes, both funnel stores, both CSV exports |
| Compatibility shim (temporary) | `src/lib/mothermode/leadUtmContent.ts` |
| Operational scripts | `scripts/inspect-tracked-link-clicks.cjs`, `scripts/repair-localhost-tracked-links.cjs` |


### Tables

- **`mothermode_utm_links`** — the registry. One row per tracked link: base URL,
  the five UTM fields, a materialized `full_url`, an optional `short_code`, and
  `click_count`. Nullable `plan_id` / `funnel_id` links it to a planner card
  and/or a funnel. `optin_funnel_id` (added 20261006000000) points at a lead
  magnet instead; a CHECK keeps it mutually exclusive with `funnel_id`, because
  the two have different step vocabularies and `funnel_page` can only mean one
  of them at a time.
- **`mothermode_link_clicks`** — one row per hit on `/go/<code>`: `clicked_at`,
  `ua_family`, salted `ip_hash`, referrer.

Plan rows also gained `funnel_id`, `funnel_page`, `destination_url`.

### Destination URL builders

`src/lib/offers/planner/utm.ts` — `FUNNEL_PAGES` / `funnelPagePath` /
`funnelPageUrl` for sales funnels, and `OPTIN_PAGES` / `optinPagePath` /
`optinPageUrl` / `optinPageLabel` for lead magnets. Both encode the same
irregularity: **step 1 is the funnel index** (`/funnel/<slug>`, `/optin/<slug>`),
not a named child route. Build these paths anywhere else and they will be wrong
eventually. Covered by `tests/lib/planner-optin-destinations.test.ts` (7 tests).

Resources / deliverables are **not** destination candidates: they have no public
route (nothing under `src/app` serves one to a cold visitor), so they stay on the
pasted-`destination_url` path until such a page exists.

### API

`GET /api/admin/mothermode-links?planId=&funnelId=`
→ `{ success, rows[], funnels[], warnings[] }`. Each row carries the link, its
click stats (`clicks`, `recentClicks`, `botClicks`, `lastClickedAt`,
`uniqueClicks`, `unattributedClicks`) and its attribution (`optins`, `purchases`,
`revenueCents` — all **nullable**, see §4; they null together because one join
produces all three).

Row-level attribution is **per piece, not per link** — see *Money on the client
surfaces* at the end of this doc before you total any of those three columns.

Two extra read shapes, deliberately separate rather than one payload with
optional fields:

- `?format=byPiece` → the piece→link map the **content export** needs. Skips the
  click read and the opt-in join entirely; it is on the export path, where the
  extra queries buy nothing.
- `?format=pieceMetrics` → clicks + opt-ins + **money** per piece id for the two
  content-hub surfaces: `clicksByPieceId`, `windowClicksByPieceId`,
  `uniqueClicksByPieceId`, `unattributedByPieceId`, plus attribution and the three
  economics fields (`revenueCentsByPieceId`, `trafficSplitByPieceId`,
  `clickMediumSplitByPieceId` — table at the end of this doc). Merging this into
  `byPiece` would make the export pay for joins it doesn't read.

`POST /api/admin/mothermode-links`
- `{ action: 'createLink', ..., withShortLink? }` → 200 with the record, or
  **409** if the UTM combination already exists.
- `{ action: 'deleteLink', id }` → 200.

Both verbs go through `requireAdminRoute()`.

**`withShortLink` defaults differ between the two layers, on purpose — and this
is a trap.** The route treats it as opt-*out* (`body.withShortLink !== false`),
so any HTTP caller gets a countable link by default. The store's
`CreateLinkInput.withShortLink` is plain optional, so a **direct store call
without it mints a link with no short code** — which means no `/go/` URL, which
means the click can never be recorded. Callers must pass it explicitly. This is
not hypothetical: it is exactly the bug written up in
`docs/CLICK_TRACKING_NOT_COUNTING_FINDING.md`, and it went unnoticed because the
fallback `full_url` still carries every UTM, so attribution kept working while
the click count sat at a permanent, plausible-looking 0.


---

## 3. How an operator uses it

1. **Content Board tab** → find the card for the piece → click **Tracked links**.
2. In the drawer, pick a **destination**: either a funnel + page, or paste an
   external URL. Click *Save destination* (this writes to the card, not the link).
3. UTM fields pre-fill from the card's platform/format and the funnel's slug.
   Edit if needed; `utm_content` defaults to the piece id and should usually be
   left alone. Add a **label** if you'll mint several links for one piece
   ("bio link", "story swipe-up").
4. **Create tracked link** → copy either the short `/go/<code>` URL or the full
   UTM URL and publish that.
5. **Tracking tab** → clicks and opt-ins per piece, most-clicked first.

**Reading the tab.** The column that matters is opt-ins next to clicks. A row
with clicks and **zero** opt-ins is highlighted amber once it passes 5 clicks:
the content earned attention and the destination wasted it. A row with an
opt-in count of `—` means the join could not run — that is *not* zero, and an
amber banner at the top of the tab explains why.

The `+N🤖` next to the 30-day count is bot and link-preview traffic. It is
recorded but never counted as a click, so the two numbers won't reconcile with a
raw row count of `mothermode_link_clicks` — deliberately.

**There is a second, shorter path, and it is the one used in practice:** content
hub → open a piece → **Preview** tab → mint straight from `PieceLinkPanel`, which
pre-fills everything from the piece and shows that piece's clicks / people /
opt-ins / purchases inline. The **Metrics** tab shows the same numbers plus
clicks-per-purchase. Both read a single `?format=pieceMetrics` fetch through
`pieceLinks.ts`, so they cannot disagree.

### Where the numbers actually appear

| Want | Go to | Look for |
| --- | --- | --- |
| Account-wide money | `/admin` | **Attributed revenue** and **Earnings per click** cards (row below the two Stripe Revenue cards) |
| Which post earns | `/admin/funnel-stats` | **Traffic by post** table → `Opt-ins`, `Opt-in rate`, `Attributed rev.`, `Per click`. Ranked by revenue, so the earner is on top |
| One post's economics | Content hub → open the piece → **Metrics** tab | `Attributed` / `Per click` / `Opt-in rate`, plus the max-bid line |
| Same, while minting | Content hub → open the piece → **Preview** tab | identical block under the mint panel |
| Per-link clicks | Planner → **Tracking** tab | per-link rows + **Piece $**, and the totals strip reading "over N pieces" |

Everything is `n/a` until tracked links exist and get clicked — this reads only
`/go/` traffic. A max-bid line appears only where **paid** clicks have earned
something, so an all-organic account correctly shows none.

Re-minting for a piece is safe, and is the documented repair for a bad link:
**the newest link per piece wins** in the display map. The old row and its click
history stay put rather than being deleted, so history is never rewritten — with
the trade-off that the old row's clicks keep counting toward all-time totals.


---

## 4. Decisions worth keeping

**Missing attribution is `null`, never `0`.** If the opt-in join throws, the
route pushes a string into `warnings[]` and leaves `optins` null; the tab renders
`—` plus an amber banner. `getPieceAttribution()` throws rather than returning an
empty map for the same reason. A broken join and a genuinely-unconverting piece
look identical to a reader, and the wrong one gets content killed. Do not
"simplify" the null into a zero.

**`utm_content` is never slugified.** The other UTM fields are (`Instagram
Reels` → `instagram_reels`) so reports don't fragment into `ig`/`insta`/
`Instagram`. But `utm_content` is an opaque key that must match the lead row byte
for byte; mangling it would break the join it exists to enable. This is asserted
in `tests/lib/planner-links.test.ts`.

**The two UNIQUE violations are handled differently.** A `short_code` collision
is retried with a new code (up to 5 times, then it gives up rather than
looping). A duplicate UTM *combination* throws `DuplicateUtmLinkError` → 409,
because retrying would mint the row the index just refused and split one piece's
clicks across two rows.

**One registry, two entry points.** Funnel-side links have `plan_id` NULL;
card-side links fill it in. The drawer and the tab read the same table. Splitting
them would put the same link in two places with two click counts.

**Short code alphabet excludes vowels and `0/O/1/l/I`** — no accidental words,
and a code can be read off a screenshot without ambiguity.

### `/go/<code>` invariants (ad compliance)

Also transcribed in the migration header so they survive this file. Breaking any
one turns a legitimate first-party link into a policy violation:

- **No cloaking.** One code → one destination for every visitor. Never branch on
  UA, geo, referrer or time. Bots are *logged but not counted* — a metrics
  decision, not a routing one; the bot still gets the same destination.
- **No open redirect.** Destination comes from the row lookup, never from `?to=`.
- **First-party only**, so the display URL matches the landing domain.
- **302, not 301.** A 301 is browser-cached: clicks flatline after the first hit
  and destination changes can't roll out. Paired with `no-store`.
- **No raw PII** — salted `ip_hash` only.
- The click write is **awaited**; serverless freeze-on-response drops floating
  promises.

---

## 4a. Granularity: per-post yes, per-placement no

The chain that makes a lead traceable to **an individual post** rather than just
a channel, verified link by link:

| Step | Where | Carries |
|---|---|---|
| Mint | `createUtmLink` | `piece_id`, and `utm_content` defaults to it |
| Publish | `full_url` / `/go/<code>` | `utm_content=<pieceId>` in the query |
| Redirect | `src/app/go/[code]/route.ts` | 302 to the stored `full_url`, query intact |
| Land | `OptinPage.tsx`, `SalesOptinPage.tsx` | `sp.get('utm_content')` |
| Capture | both capture routes | `utmContent` onto the lead row |
| Report | `getPieceAttribution()` | groups leads by `utm_content`, splitting `purchases` from `optins` |

So a lead answers "which post produced you", and because `purchased` is read on
the sales lead, so does a sale. Note the join is a **convention, not a foreign
key** — `getPieceAttribution` joins in memory precisely because PostgREST cannot
join two tables with no FK between them, and the lead's value arrives from a
query string it does not control. That's why `utm_content` is never slugified and
never editable in the UI.

**The limit worth knowing:** clicks are tracked per *link*, attribution per
*piece*. Mint two links for one post ("bio link" and "story swipe-up") and you
get two click rows but a single combined opt-in number, because both links carry
the same `utm_content`. You can see which placement earned the clicks; you cannot
see which one earned the opt-in. Do **not** "fix" this by varying `utm_content`
per link — that breaks the piece-level join outright. Use `label` / `utm_term` to
tell placements apart, and treat per-placement conversion as not built.
Attribution is also **piece-lifetime, not per-post-instance**: re-posting the
same piece reuses its id, so the numbers pool. That's usually what you want for
evergreen content and wrong if you're A/B testing the same piece twice.

## 4b. `NEXT_PUBLIC_SITE_URL` is a hard requirement, not a nicety


**Set it to the real public domain before anyone mints a link.** `base_url` and
`full_url` are *stored*, and `/go/<code>` redirects to the stored `full_url`, so
a link minted while that env var says `http://localhost:3000` keeps pointing at
the minter's own machine forever. Fixing the env afterwards does not repair the
row. Nothing looks wrong in the admin — the code resolves, the click counts, the
redirect 302s — it just lands nowhere for every real visitor.

`.env.example` ships `http://localhost:3000`, which is correct for local dev and
wrong the moment a link is published, so this is easy to hit by accident.

Two guards exist because of it:

- **Minting refuses a loopback destination.** `createUtmLink` throws if the
  destination resolves to `localhost`, `127.0.0.1`, `0.0.0.0`, `::1`, `*.local`
  or `*.localhost` (`isLoopbackUrl`, covered by
  `tests/lib/planner-loopback-guard.test.ts`). The check is in the **store**, not
  the route, so it also catches a hand-pasted localhost URL in the
  custom-destination field. Set `ALLOW_LOCALHOST_TRACKED_LINKS=true` to opt local
  testing back in deliberately.
- **`node scripts/repair-localhost-tracked-links.cjs`** rewrites the origin of
  rows already stored that way, preserving path and query so the UTMs survive.
  Dry-run by default (`--apply` to write), and it refuses to run while
  `NEXT_PUBLIC_SITE_URL` is itself a loopback host rather than rewriting
  localhost to localhost and reporting success. Click history is unaffected —
  `mothermode_link_clicks` references `link_id`, not the URL.

## 5. Verification

Current branch validation:

- `npx tsc --noEmit` ✅
- `npx vitest run` ✅ — **84 test files, 812 tests passed**

Focused coverage that exercised this wave while it landed:

- `tests/lib/offers/planner/utm.test.ts`
- `tests/lib/offers/planner/adMetrics.test.ts`
- `tests/lib/offers/planner/clickPeople.test.ts`
- `tests/lib/offers/planner/links.test.ts`
- `tests/lib/planner-board.test.ts`
- `tests/api/admin-planner-route.test.ts`
- `tests/app/admin/planner-workspace.test.tsx`

Also worth running by hand against a real DB:
`node scripts/inspect-tracked-link-clicks.cjs` prints links, their codes and
their click rows — the fastest way to tell "no clicks recorded" from "no `/go/`
URL exists to click", which is precisely the confusion that hid the counting bug.


---

## 6. Remaining work

- **The planner opt-in destination picker is now shipped.** Content-plan cards
  store `optinFunnelId` alongside `funnelId`, the planner GET payload exposes both
  `destinations.salesFunnels` and `destinations.optinFunnels`, and the destination
  editor keeps the two funnel kinds separate so a sales checkout step cannot be
  chosen for a lead magnet. The new helpers live in `src/lib/offers/planner/utm.ts`
  (`OPTIN_PAGES`, `optinPagePath`, `optinPageUrl`, `optinPageLabel`).
- **Fresh environments still need the four planner/link migrations applied.**
  The bundle is now registered in `supabase/_pending.json` and built into
  `supabase/_bundle_pending.sql` via `scripts/build-migration-bundle.cjs`. Apply
  that bundle, or run the individual migrations in order:
  - `20261001000000_mothermode_planner.sql`
  - `20261005000000_planner_funnel_links_and_utm.sql`
  - `20261006000000_utm_links_optin_destinations.sql`
  - `20261007000000_planner_content_plan_optin_destination.sql`
- Not built, deliberately: editing UTMs after minting (delete and re-mint —
  retroactive edits rewrite the history the clicks were recorded under),
  date-range filtering, CSV export of the tab, and any per-click drill-down.

## Click visibility: every surface that reads the roll-ups

Five surfaces now read click data. They all go through one seam so they cannot
disagree with each other:

| Surface | Keyed by | Shows |
| --- | --- | --- |
| `/admin` overview | — | all-time clicks, 30d, people behind the 30d |
| `/admin/funnel-stats` | piece id | all-time, 30d + people, clicks-per-purchase, traffic-by-post table |
| Content hub → piece sheet → **Preview** (`PieceLinkPanel`) | piece id | clicks / people / opt-ins / purchases for that post |
| Content hub → piece sheet → **Metrics** (`PieceClickMetrics`) | piece id | the same four, plus clicks-per-purchase |
| Planner → **Tracking** tab (`LinkTracking`) | link row, money per piece | per-link clicks, per-piece opt-ins and "Piece $", and a totals strip summed over distinct pieces |

Every one of them also shows money now — attributed revenue and EPC on the two
`/admin` pages, the shared `PieceMoneyLines` block on the two hub surfaces, the
"Piece $" column on the tab. That last row is the exception to "keyed by piece
id": it is the only surface whose **rows** are per link while its **money** is per
piece, so its totals row is deliberately *not* the column sum. See *Money on the
client surfaces* below before touching it.


**Clicks vs people.** The roll-up carries both: `totalClicks`/`recentClicks`
(hits) and `uniqueClicks`/`unattributedClicks` (distinct `ip_hash` in the same
window, plus the clicks that had no hash to count). Turning those into a
human-readable "3 people" is `src/lib/offers/planner/clickPeople.ts` —
`readPeople()` and `peopleLabel()`, imported by every surface that names a person.
Port it as one module, not per-screen: it decides when a unique count is unknowable
(`null`, not `0`), when it is only a floor (`atLeast`), and when the clicks/people
ratio means the admin is clicking their own link. Those calls are why the surfaces
agree.
It deliberately imports nothing, because two of its consumers are client
components and `links.ts` holds a service-role client. Rules and rationale:
`tests/lib/planner-click-people.test.ts`; full write-up in
`docs/CLICK_TRACKING_NOT_COUNTING_FINDING.md`.

**Pair the windows.** Uniques are windowed (`uniqueWindowDays`); `totalClicks` is
all-time. Only ever read uniques against `recentClicks`. "40 clicks from 3
people" built from an all-time total and a 30-day unique count is arithmetic
nonsense that reads as insight.

**The seam.** `getClickRollupsSafe()` in the lib is the only degradation
wrapper. It exists because the overview and funnel-stats were about to grow two
independent try/catches, and two independent wrappers around the same failure
drift: one starts rendering `0` where the other renders `n/a`, from the exact
same unapplied migration. On the client, `pieceMetricValues()` in
`PieceClickMetrics.tsx` plays the same role for the two sheet surfaces.

**The rule that must survive the port.** A failed read renders `n/a`; a
successful read with no matching row renders `0`. These are opposite facts —
"nothing was measured" versus "this post was measured and got nothing" — and an
admin acts on them in opposite ways. Collapsing the first into the second is the
single most damaging simplification available in this system, because it looks
like data.

Clicks and attribution are **separate reads with separate availability flags**.
One can be accurate while the other has failed, and the UI says so rather than
failing both together.

**Why keyed by piece id and not by funnel.** `utm_content` *is* the piece id.
That equality is the entire join — planner link rows, captured lead UTMs, and the
export bridge all find each other through it, with no lookup table. Note that
`/admin/funnel-stats` has **no funnel id in scope** (it's built from Stripe
products and page types), which is why its traffic table is per piece; a
`byFunnelId` view there would require inventing a join that doesn't exist.

---

## Money on the client surfaces: per-piece economics and the Tracking-tab trap

Phase 1 put attributed revenue, EPC and opt-in rate on the two **server**
surfaces (`/admin`, `/admin/funnel-stats`). This section covers the two **client**
surfaces, which cannot read the store and so had to be fed by the API.

### What `/api/admin/mothermode-links` now returns

Three additions, all derived server-side so no client divides anything itself:

| Field | Shape | Meaning |
| --- | --- | --- |
| `pieceMetrics.revenueCentsByPieceId` | `Record<string, number>` | Attributed revenue per piece. Sparse: an absent key is a true zero. |
| `pieceMetrics.trafficSplitByPieceId` | `Record<string, TrafficSplit>` | Leads/money split paid / organic / unattributed. Only present for pieces that actually have leads. |
| `pieceMetrics.clickMediumSplitByPieceId` | `Record<string, Record<TrafficType, number>>` | **Clicks** by link medium — the denominator that makes a paid EPC possible at all. |
| `rows[].revenueCents` | `number \| null` | Piece-level revenue stamped onto each link row. Null tracks `optins`: one join produces both, so they fail together. |

`trafficSplitByPieceId` is **nested** rather than three flat `*ByPieceId` maps
because of a homonym already living in this payload:
`unattributedClicksByPieceId` means *no IP hash* — we don't know **who** clicked.
The new `unattributed` bucket means *no `utm_medium`* — we don't know **where
from**. Two flat sibling maps with "unattributed" in both names would be read as
the same measurement within a week.

### The shared render block

`PieceMoneyLines` (in `PieceClickMetrics.tsx`) is rendered by **both** client
surfaces — the Metrics tab and the Preview tab's `PieceLinkPanel` — and
`pieceMetricValues` composes the `PieceEconomics` once for both.

This is a component and not copied JSX because three of its lines are
*qualifications*, not numbers: the attributed-revenue floor note, the paid-only
bid ceiling, and the blended-rate caveat. A qualification that appears on one
screen and not the other is worse than none — a reader who saw the caveat once
concludes its absence elsewhere means the number is safe to bid on. Placement is
also load-bearing: money sits directly under the **all-time** grid and **above**
the 30-day people line, so the two periods never read as one set of figures.

### The Tracking tab's totals row is not the column sum

**The trap.** The tab's rows are per **link**; opt-ins and revenue are per
**`utm_content`**. The route therefore stamps the same piece-level money onto
every link that shares a piece — so the obvious totals row (reduce over rows, add
the column) reports more revenue than the account has, two clicks away from
`/admin`'s total, which sums the same money once.

`summarizeLinkRows` encodes the asymmetry:

- **clicks add over rows** — a click belongs to exactly one link;
- **money adds over distinct `utm_content`** — the first row seen for a piece
  contributes its lead figures, later rows contribute only their clicks.

Consequences visible on screen:

- The column header is **"Piece $"**, not "Revenue". Two rows for one piece show
  the same amount, and a column called "Revenue" makes that look like a
  duplication bug instead of the join it is.
- Repeated cells are **dimmed**, using `duplicatedPieceKeys` — the same helper the
  totals derive from, so the explanation and the arithmetic cannot drift apart.
- The strip states **"over N pieces"**, which is smaller than the link count
  whenever a piece has more than one link. That is the sentence that tells a
  reader why the totals aren't the sums they'd compute by hand.
- EPC goes through `pieceEconomics`, never `totals.revenueCents / totals.clicks`
  inline. This is the one surface where the tempting denominator (row clicks) is
  right and the tempting numerator (row revenue) is wrong.
- A link with no `utm_content` contributes its **clicks** and never any leads
  (`untaggedLinks`). Dropping its clicks would understate every rate's
  denominator; crediting it with 0 opt-ins would assert a measurement.
- If **any** row's attribution is null the whole money total is null, not a
  partial sum. The route nulls every row together when the join fails, and a
  partial total understates revenue while looking authoritative.
- The tab passes `split: null` and `clicksByTrafficType: null`, so its **paid**
  figures read `n/a` rather than silently reusing the blend as a bid ceiling.
  `/admin` is where the medium split lives.

### Coverage

`tests/lib/planner-link-row-totals.test.ts` — 12 tests over `summarizeLinkRows`
and `duplicatedPieceKeys`, including the two-link piece that would otherwise
double, the untagged link, the null-attribution row, and an agreement check that
the dimmed cells are exactly the rows the totals collapsed.



## Paid traffic on a piece (the Metrics tab's paid block)

A piece's Metrics tab shows a **Paid traffic** block under the money grid,
built by `paidResultsSummary(economics)`: paid clicks, paid opt-in rate, and
earnings per PAID click.

**Gated on `economics.paidClicks`, not on the piece's format.** The content hub
has ad-shaped sizes (`platformSizes` group `'ads'`), and it would be natural to
key the block off that instead. It would also be wrong in both directions: an
ad-sized creative that was never boosted has no paid results, and a plain feed
post that WAS boosted does. The `utm_medium` on the link is a fact about what
happened; the aspect ratio is an intention.

`paidClicks` is deliberately `number | null`:

| Value | Means | Block |
| --- | --- | --- |
| `null` | the medium split could not be read | hidden — absence of a reading, not a reading of zero |
| `0` | split read, this piece had no paid clicks | hidden — correctly, it is organic |
| `> 0` | this piece ran as an ad | shown |

The block also **survives the "nothing happened yet" early return** in
`PieceMoneyLines`. A post with no clicks and no leads renders nothing, but an ad
with 200 paid clicks and zero opt-ins renders the block — one is waiting, the
other is spending, and only the second is urgent. In that state the paid EPC
prints `$0.000`, which is a measured fact; `n/a` would falsely imply the ad was
never tracked. When the attribution join actually fails, the rate and per-click
parts are omitted entirely rather than shown as zero.

### Why there are no CPC / CPL / ROAS / profit cells here

Every cost metric is gated on `spendCents`, which has no storage yet. Rendering
them now would put six `n/a` cells on a live ad, and `n/a` means "not measured"
everywhere else in this system — so a reader would conclude the click pipeline is
broken and debug the wrong thing. Instead the block prints
`SPEND_NOT_RECORDED_NOTE`, which says the missing input is the budget, not the
measurement.

### Spend is campaign-grain. Do not put a spend field on a piece.

The tempting next step is a spend box on the ad's content sheet. It must not be
built. Ad platforms do not reliably export per-creative spend, so a per-piece
figure would be an admin splitting a campaign budget across posts by guess — and
the resulting per-piece ROAS would look authoritative while being invented. Spend
belongs at `(utm_campaign, date)`, which is the grain that can be reconciled
against a platform's own reporting.

### Known data caveat: historical thread links are mis-tagged as paid

`mediumForFormat` classified the `thread` format as `paid_social` (the test was
`f.includes('ad')` — thre**ad**), so organic X threads were counted as paid
traffic. The code is fixed and pinned by
`tests/lib/planner-medium-for-format.test.ts`, but **links minted before the fix
still carry the wrong `utm_medium`**, so any paid EPC covering that period is
inflated — and organic converts better than paid, so it is inflated in the
direction that raises a bid ceiling.

Repair predicate and the two cautions that make a blanket UPDATE wrong:
[docs/THREAD_TAGGED_AS_PAID_FINDING.md](./THREAD_TAGGED_AS_PAID_FINDING.md).

### How a piece becomes "paid"

Nothing marks a piece as an ad directly. The chain is:

```
piece.format → mediumForFormat() → utm_medium on the link → trafficType() → paid | organic | untagged
```

So the *format string* decides whether clicks land in the paid bucket, and
therefore whether the paid block renders and what the bid ceiling is built from.

**Match whole words, not substrings.** `mediumForFormat` originally tested
`f.includes('ad')`, which classified the `thread` format as `paid_social`
(thre**ad**) along with `lead magnet`, `roadmap` and `download`. Short markers
(`ad`, `ads`, `dm`) are now matched as whole words after splitting the slug;
only long, unambiguous markers (`paid`, `newsletter`, `article`) remain
substring tests. `tests/lib/planner-medium-for-format.test.ts` asserts both
directions and sweeps every key of `FORMAT_LABEL`, so a new hub format that lands
in the paid bucket fails there rather than on a dashboard.

If a genuinely paid format is ever added, declare it in that test's
`KNOWN_PAID_FORMATS` — the sweep is meant to force the decision, not to be
deleted.

**Remaining work on this system:** [docs/AD_METRICS_NEXT_TASKS.md](./AD_METRICS_NEXT_TASKS.md).
