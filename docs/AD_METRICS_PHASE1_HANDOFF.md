# Ad metrics — Phase 1 (derivation layer) handoff

> **Session 3 update (all four surfaces are live).** Read the sections in reverse:
> **Session 3** (bottom) supersedes Session 2, which supersedes "Next session".
> All four read surfaces now render these numbers — `/admin` and
> `/admin/funnel-stats` server-side, `PieceClickMetrics`/`PieceLinkPanel` and the
> planner **Tracking** tab from the API payload. Phase 2 (ad-spend storage)
> remains the only unbuilt piece.

**Status (session 1, superseded): data layer complete and tested, nothing visible
in the UI.** That was true of session 1 only; the rest of this section describes
it as it was written at the time.


Sibling docs: `PLANNER_LINK_TRACKING_SYSTEM_PORT.md` (the click system),
`CLICK_TRACKING_NOT_COUNTING_FINDING.md` (why clicks read 0 until last session).

---

## What shipped

### 1. `src/lib/offers/planner/adMetrics.ts` (new, no imports)

The one place clicks, leads, revenue and spend become ratios.

| Metric | Meaning | Needs spend? |
| --- | --- | --- |
| `epcCents` | Earnings per click = your break-even CPC | no |
| `eplCents` | Earnings per lead = your break-even CPL, the max bid | no |
| `aovCents` | Average order value | no |
| `optinRate` | clicks → opt-ins (landing page quality) | no |
| `leadToSaleRate` | opt-ins → purchases (offer quality) | no |
| `clickToSaleRate` | clicks → purchases (end to end) | no |
| `cpcCents` / `cplCents` / `cacCents` | what you actually paid | **yes** |
| `roas` | revenue ÷ spend | **yes** |
| `profitCents` | revenue − spend | **yes** |
| `losingMoneyPerLead` | `cpl > epl` — the stop-the-campaign flag | **yes** |

Plus `trafficType()` (paid/organic/unattributed), and the formatters
(`formatCents`, `formatCentsPrecise`, `formatRate`, `formatRoas`,
`breakEvenSummary`) so no two surfaces can word the same value differently.

No imports at all, for the same reason `clickPeople.ts` has none: `links.ts`
builds a Supabase service client at module scope, and two consumers of this
arithmetic are client components.

**Three rules encoded, each because the alternative is actively misleading:**

- **÷0 → `null`, never `Infinity`/`NaN`.** `5/0` is `Infinity` in JS and React
  renders it happily. An infinite ROAS looks like the best campaign you have ever
  run. `null` renders as `n/a`, matching the vocabulary the click surfaces already
  use.
- **Unknown ≠ zero.** No spend recorded means every cost metric reads `n/a`, and
  `profitCents` is `null` rather than `revenue - 0`. Reporting all of revenue as
  profit is the most flattering error available here, so it is the one least
  likely to be questioned.
- **Money stays in integer cents until formatted.** Dividing early accumulates
  float error across thousands of leads.

Note one asymmetry that has its own test: a *recorded* spend of `0` is a fact, so
CPC reads `$0.00` (true — those clicks were free) while ROAS reads `n/a`
(undefined). Each side of the fraction is judged separately.

### 2. `getPieceAttribution()` in `links.ts` — now carries revenue and a medium split

```ts
interface AttributionSlice { optins; purchases; revenueCents }
interface PieceAttribution extends AttributionSlice {
  utmContent: string;
  byTrafficType: Record<'paid'|'organic'|'unattributed', AttributionSlice>;
}
```

- Reads `utm_medium` and `purchase_amount_cents` alongside what it already read.
  Both columns pre-date the planner migration on both lead tables — **no schema
  change, no migration to apply.**
- Revenue is gated on `purchased` even though the column defaults to 0, so a
  future partial-refund or abandoned-checkout amount written there cannot quietly
  start counting money that was never collected.
- **The Map is still keyed by `utmContent`.** The split lives *inside* each entry.
  Re-keying to `content|medium` would have silently changed the meaning of every
  existing caller's lookup — and a boosted post and its organic twin share one
  `utm_content` because they are one piece.

### 3. Tests — `tests/lib/planner-ad-metrics.test.ts`, 31 cases

Weighted toward the ways this module could lie, not its happy path. `tsc --noEmit`
clean; 58/58 across the four planner click/metrics suites.

---

## Two numbers that will not match, by construction

**Attributed revenue ≠ the "Total revenue" card on `/admin/funnel-stats`.**

- That card sums `funnel_purchases`, written by the Stripe webhook. Authoritative
  money — but the table has **no UTM columns**, so it cannot be attributed to a
  piece.
- `revenueCents` here sums `purchase_amount_cents` on the lead row, the only
  revenue figure that knows which content produced it.

Any sale from direct traffic, or via a link minted before `utm_content` shipped,
lands in the Stripe total and not here. **Attributed revenue is a floor.** It must
never be labelled just "revenue" on a surface that also shows the Stripe total,
or the gap reads as a bug and someone will "fix" it by summing both.

---

## Why this stopped here

Phase 1 was scoped as derivation *plus* display. I built the derivation, tested
it, and stopped before touching the four read surfaces, because wiring
`PieceClickMetrics`, `LinkTracking`, `/admin`, and `/admin/funnel-stats` in the
context I had left is precisely how one surface ends up disagreeing with another —
the failure mode the shared helper exists to prevent. Same call as last session on
unique clicks, same reason.

Nothing here is half-wired: `adMetrics.ts` is standalone and fully tested, and the
`getPieceAttribution` change is additive with every existing caller still passing.

---

## Next session

1. **Surface Tier A on `PieceClickMetrics`** (the Metrics tab block). It already
   has `clicks` and attribution in scope. Show EPC, opt-in rate, and
   `breakEvenSummary()`. Derive from `byTrafficType.paid` where a cost comparison
   is implied; use the blend only for totals.
2. **Then the other three surfaces**, reusing the same formatters. Do not
   re-derive locally.
3. **Watch the window mismatch.** `byPieceId` is all-time (from the `click_count`
   counter); `recentByPieceId`/`uniqueByPieceId` are 30-day (from the click log).
   Attribution is all-time. So EPC must pair all-time revenue with **`byPieceId`**,
   never with `recentByPieceId` — mixing them yields a plausible-looking number
   that is simply wrong. The existing field naming in `ClickRollups` was chosen to
   make this hard to get wrong; keep it that way.
4. **Blended rates are unsafe for bidding.** Organic converts several times better
   than paid, so a blended break-even CPL is inflated by organic and will
   authorise a bid that loses money. Any surface that shows a bid ceiling must
   show the paid-only one.

## Session 2 — what got wired, and where it stopped

### Composition layer, `adMetrics.ts` (still imports nothing)

The Phase 1 file answered "given these numbers, what are the ratios". This adds
the layer that answers the question a screen actually asks — *which* ratios am I
allowed to show, and which of them may be read as a bid:

- `sumAttributedSlices` / `sumTrafficSplits` / `emptyTrafficSplit` — so no
  surface writes its own three-field reducer, and the one that forgets
  `revenueCents` cannot exist.
- `trafficMix(split)` → `{ optins, shares, blended, untaggedOptins, label }`.
  `blended` is true only when paid **and** organic both produced leads; untagged
  leads do not set it (they make the split incomplete, which is a different
  warning). Percentages are rounded independently and deliberately not forced to
  sum to 100 — a fudged bucket is a number nobody could reproduce from the counts
  beside it.
- `pieceEconomics(input)` → `{ blended, paid, mix, blendedUnsafeForBidding }`.
  **`spendCents` lands on `paid` only.** Spend buys paid clicks, so dividing it
  into blended revenue credits organic sales against an ad bill; in the test
  fixture that reads 13.75x ROAS on a campaign actually returning 1.25x. Blended
  cost metrics stay null rather than becoming a second, flattering ROAS.
- `bidCeilingSummary(economics)` takes the whole `PieceEconomics`, not a
  `FunnelEconomics` — so a caller physically cannot hand it the blend, which is
  the one mistake this split exists to prevent. Null when paid traffic has earned
  nothing, because an invented "$0.00 max bid" reads as an instruction.
- `blendedRateCaveat(mix)`, `ATTRIBUTED_REVENUE_FLOOR_NOTE`,
  `ATTRIBUTED_REVENUE_FLOOR_SHORT` — one wording each, shared. The floor gap is
  permanent and by construction, and the moment two screens explain it
  differently someone "fixes" it by summing both numbers.

### `links.ts`

- `getPieceAttributionSafe()` — mirrors `getClickRollupsSafe`. Money and clicks
  fail for different reasons (a lead column vs the planner migration); one
  failing must leave the other's numbers on screen.
- `sumPieceAttribution(map)` → totals + `byTrafficType` + `pieces`. Iterating the
  Map's **values** is what makes it safe: entries are already de-duplicated by
  `utm_content`, so a piece with a boosted and an organic link contributes once.
  Summing link rows instead would double-count exactly those pieces. `pieces: 0`
  is how a caller distinguishes "read failed" from "nothing attributed yet".
- `rollupClicks` now also returns `mediumSplitByPieceId` and
  `clicksByTrafficType`, all-time, classified by the **link's** `utm_medium`.
  This is the denominator that makes a paid EPC possible at all.
  **Naming trap, already live:** `unattributedClicks` / `unattributedByPieceId`
  mean "no IP hash" (we don't know *who*); `unattributed` inside the new split
  means "no utm_medium" (we don't know *where from*). Two unrelated unknowns —
  which is why the medium split is nested rather than a flat
  `unattributedMediumByPieceId` sitting next to its homonym.

### Surfaces wired (both server components, no payload change needed)

- **`/admin`** — "Attributed revenue" and "Earnings per click" cards. Labelled
  *attributed*, never *revenue*: the two Stripe revenue cards one row up are
  always larger and more complete. EPC pairs all-time revenue with the all-time
  counter; the 30-day `recentClicks` on the same row is the tempting denominator
  and would inflate EPC by however long the account has been running.
- **`/admin/funnel-stats`** — "Traffic by post" grew Opt-ins, Opt-in rate,
  Attributed rev. and Per click. Rows are the **union** of pieces with clicks and
  pieces with leads (a piece with leads and no clicks means the link was shared
  untracked — filtering to the click map hides it and its revenue), sorted by
  revenue then clicks, because ranking by clicks puts a viral post that sold
  nothing above the quiet one paying for the ads. The floor note sits directly
  under the table, on the one page where a reader can see it disagree with
  Stripe's "Total revenue" card.

Tests: `tests/lib/planner-ad-metrics-surfaces.test.ts`, 24 cases, each one a way
a plausible screen would authorise spending. 61/61 across the three ad-metrics /
rollup suites, every planner suite green, `tsc --noEmit` clean. (Two failures
elsewhere in `tests/lib` — `compliance-pass` `effectiveCopy` shape and
`review-logic` `withImages` — are pre-existing and untouched by this work.)

### Where it stopped, and why

The two **client** surfaces — `PieceClickMetrics` (content sheet Metrics tab, +
the same block reused by `PieceLinkPanel`) and the planner **Tracking** tab — are
not wired. They cannot read the store directly, so they need
`/api/admin/mothermode-links` to ship three new fields
(`revenueCentsByPieceId`, `trafficSplitByPieceId`, `clickMediumSplitByPieceId`),
and that is a payload change plus a shared render block plus a real trap:

- **The Tracking tab's rows are per LINK, but attribution is per `utm_content`.**
  Two links on one piece will each show the piece's whole lead figure — already
  true of the opt-in column today, and it matters more with money on the row.
  Its totals row must sum over **distinct `utm_content`**, not over rows, or the
  table's own total will exceed the account total on `/admin`.
- Row-level `optins`/`revenue` should stay blended and be labelled per-piece.
  Slicing each row by its own link medium looks more precise but silently drops
  leads captured before mediums were set.

That is one session's work with one boundary, and it is the step where one
surface starts disagreeing with another — same reason the last session stopped
before this one.

## Session 3 — the two client surfaces, and the totals-row trap

Session 2 ended deliberately at the server/client boundary. This session crossed
it. Nothing in `adMetrics.ts` gained an import; everything new is either a pure
helper there or a payload field.

### `adMetrics.ts` — link-row totals

`summarizeLinkRows(rows)` and `duplicatedPieceKeys(rows)`, plus `LinkRowLike` /
`LinkRowTotals`.

The whole reason these exist: the Tracking tab's rows are per **link**, but
opt-ins and revenue are per **`utm_content`**. The route stamps the same
piece-level money onto every link sharing a piece, so `rows.reduce(+revenue)` —
the totals row anyone would write — reports more revenue than the account has,
one navigation away from `/admin` reporting it correctly. `summarizeLinkRows`
adds **clicks over rows** and **money over distinct pieces**, and returns
`pieces`, `duplicatedPieces` and `untaggedLinks` so the table can *say* that on
screen instead of leaving the discrepancy to be discovered.

It also returns `slice`, shaped for `pieceEconomics`, so the summary strip derives
EPC through the shared helper rather than dividing two of its own columns. This is
the one surface where the tempting denominator is right and the tempting numerator
is wrong, so the correct division is not left available to be re-typed.

Null propagation matches the rest of the module: if **any** row's attribution is
null the money totals are null, not a partial sum — the route nulls every row
together when the join fails, and a partial total understates revenue while
looking authoritative. Clicks come from a different read and survive it.

`pieceResultSummary(economics)` is the one-line sentence both client surfaces
print, for the same reason the caveat constants are shared: two hand-written
versions diverge, and the one that loses the word "attributed" is the one someone
quotes.

### `/api/admin/mothermode-links` — three fields

`?format=pieceMetrics` now also returns `revenueCentsByPieceId`,
`trafficSplitByPieceId` and `clickMediumSplitByPieceId`; each `rows[]` entry gains
`revenueCents`, nulling in lockstep with `optins` because one join produces both.

The split is **nested**, not three flat `*ByPieceId` maps, because of the homonym
already in this payload: `unattributedClicksByPieceId` means *no IP hash* (we
don't know **who**), while the new `unattributed` bucket means *no `utm_medium`*
(we don't know **where from**). Flattened into sibling keys they read as the same
measurement.

### Client surfaces

`pieceMetricValues()` in `PieceClickMetrics.tsx` composes the `PieceEconomics`
once, and `PieceMoneyLines` renders it for **both** the Metrics tab and
`PieceLinkPanel` on the Preview tab. A component rather than copied JSX because
three of its lines are qualifications — the revenue floor, the paid-only ceiling,
the blended-rate caveat — and a qualification present on one screen and absent on
the other is worse than one that appears nowhere.

Placement is load-bearing on both: money sits under the **all-time** grid and
above the 30-day people line. Uniques are windowed; revenue is not.

`LinkTracking.tsx` gained a **"Piece $"** column (not "Revenue" — two rows for one
piece show the same figure, and a column called Revenue makes the join look like a
duplication bug), dimmed repeat cells via `duplicatedPieceKeys`, and a summary
strip that says "over N pieces" so the arithmetic explains itself. The tab passes
`split: null` / `clicksByTrafficType: null`, so its paid figures read `n/a` rather
than reusing the blend as a bid ceiling — `/admin` is where the medium split
lives.

### Verification

- `tests/lib/planner-link-row-totals.test.ts` — 12 new tests. Ad-metrics + rollup
  suites: **73/73**.
- `npx tsc --noEmit` — clean.
- Full `tests/lib`: **667 passed / 2 failed (669)**. The two are the pre-existing
  `compliance-pass` `effectiveCopy` and `review-logic` `withImages` failures,
  untouched by this work.

### Left for later

Standing summary is in `PLANNER_LINK_TRACKING_SYSTEM_PORT.md` → *Money on the
client surfaces*. Still open: per-placement conversion remains impossible by
design (one `utm_content` per piece), and the Tracking tab has no date-range
filter, so its money column is all-time while the amber "clicks but no opt-ins"
rule still reads the 30-day count.

## Phase 2 (not started)


Ad spend has no storage yet. `deriveFunnelEconomics` already accepts
`spendCents` and every cost metric is implemented and tested behind it, so Phase 2
is a storage + import problem, not an arithmetic one — the ÷0 discipline for ROAS
is already in this module with its siblings and its tests rather than waiting to
be bolted onto a CSV importer later.

Likely shape: a `mothermode_ad_spend` table keyed by
`(utm_campaign, date)` — campaign-grain, because that is the grain ad platforms
actually export. Piece-grain spend would need per-ad tagging that Meta does not
reliably give you.

## Paid traffic on a piece — shipped, and the one thing Phase 2 must not undo

`PieceEconomics` now carries `paidClicks: number | null`, and the Metrics tab
renders a paid block whenever it is `> 0` (`paidResultsSummary`). Null vs 0 is
load-bearing: null is "no medium split read", 0 is "not boosted", and only the
first must never be printed as the second. See the port doc for the full table.

**`SPEND_NOT_RECORDED_NOTE` is the placeholder for every cost metric.** When
spend storage lands, that constant is what gets replaced — not added to. Leaving
it up beside real CPC/ROAS numbers would tell a reader the figures are unusable
at the moment they finally are.

**The trap for Phase 2:** spend is `(utm_campaign, date)`-grain. A per-piece
spend field is easy to add here — `pieceEconomics` already accepts `spendCents`
and applies it to the paid side only — and it would immediately produce
convincing per-post ROAS numbers derived from a human guess at how a campaign
budget divided across creatives. Ad platforms do not export that split. Store
spend per campaign, and let a piece show cost metrics only when it is the sole
creative in one, or not at all.

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

### Outstanding work

The decisions still open — historical row repair (blocking accurate paid
figures), campaign-grain spend storage, untagged-link visibility — are written up
with their blockers in
[docs/AD_METRICS_NEXT_TASKS.md](./AD_METRICS_NEXT_TASKS.md), including the
non-goals, so a later session doesn't rebuild something that was declined on
purpose.
