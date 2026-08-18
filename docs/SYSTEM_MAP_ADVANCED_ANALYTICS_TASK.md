# Task: System Map advanced analytics — by-source conversion, trends, comparison

**Status:** designed, ready to build. **Build it fresh off this brief** (after the
Outstand SchedulePanel wiring — see `docs/OUTSTAND_PUBLISHING_TASK.md`).

## The goal

The System Map already computes the conversion % on every edge, the leak
detector, per-node metrics, and content→buyer attribution. This takes it from
"a diagram with numbers" to **advanced analytics**: the three gaps.

## The three gaps (in priority order)

**1. Conversion by traffic source** — the highest-value one. The % split by
*where the traffic came from* — which platform, which post, which link — not
just the aggregate. The attribution data already exists (the content→buyer link
via `utm_content` = the piece id); the by-source view is the gap.
- A per-funnel "by source" breakdown: each feeding post/link/platform with its
  own clicks → leads → sales → conversion %, ranked. "The 'brain dump' reel:
  412 clicks → 38 leads → 6 sales (15.8% lead→sale)" — so you see which of the
  twelve posts is actually worth it.
- Rides `systemMapAnalysis` + the planner links' `utm_content` attribution. A
  new analysis function (`bySource`) + a per-funnel breakdown view (a panel on
  the funnel node's peek, or a section under the funnel).

**2. Trends over time** — the metrics *moving*. Delta badges (▲/▼ vs. the prior
period) on each node, and a time scrubber ("this week vs. last").
- **The prerequisite:** a metrics-history table. The rollups are cumulative
  (view_count, purchase_count, revenue_cents), so there's no "last week" to
  replay. Add a daily snapshot (a `system_map_metrics_daily` table, written by
  a cron / on each map load, storing each node's counts for the day). Until
  there's history, the delta is honest about only having "since we started."
- Then: the delta badge on each node (today vs. yesterday) + the scrubber.

**3. Funnel comparison** — two funnels side by side. A compare mode: pick two
funnels, see their per-edge conversion + revenue next to each other. The
lowest-lift of the three (the analysis engine already computes per-funnel
rates; the compare view juxtaposes two).

## The sequencing (each ships value on its own)

1. **By-source conversion** — the analysis function + the per-funnel breakdown.
   No new table; rides the existing attribution. The one to build first.
2. **The metrics-history table** — start the clock (the daily snapshot). Ships
   nothing visible yet, but the trends need the history.
3. **The trends UI** — the delta badges + the scrubber, once there's history.
4. **The funnel comparison** — the compare mode.

## The honest edges

- **By-source needs the links to carry the source.** The content→buyer
  attribution is first-touch via `utm_content` (the piece id). A sale traces to
  the post; the post's platform is the source. Posts without a tracked link
  don't attribute — the by-source view is honest about "unattributed" traffic.
- **The history table is a slow burn.** Day one has one snapshot; the trends
  get meaningful over days. Start it early, ship the trends UI when there's
  enough to show.
- **Small samples lie.** A by-source % on 3 clicks is noise — gate the
  breakdown to sources with a minimum volume (the same gate the leak detector
  uses).

## The files

- `src/lib/mothermode/systemMapAnalysis.ts` — the `bySource` analysis (per
  funnel: each source's clicks → leads → sales → %).
- The funnel node's peek (`NodePeekPanel.tsx`) — the "by source" breakdown.
- A migration — the `system_map_metrics_daily` snapshot table + the writer.
- The map page — the delta badges + the time scrubber + the compare mode.
