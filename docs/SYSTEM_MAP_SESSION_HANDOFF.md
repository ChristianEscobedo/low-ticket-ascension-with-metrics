# System Map — session handoff (read first next session)

> The System Map is shipped and committed. This is the continuity note — where
> it stands and what's next. Read `docs/SYSTEM_MAP_STRATEGY.md` for the full
> roadmap and `docs/SYSTEM_MAP_BUILD_TASK.md` for the build plan.

## What's on main (in order)

- `0cf1f5e` — **v1**: the four-lane read-only map at `/admin/system-map`
  (Traffic → Links → Pages → Nurture), entered from the Asset Hub's Systems
  tab. Builder `src/lib/mothermode/systemMap.ts` (pure, lays out the graph),
  API `src/app/api/admin/system-map/route.ts`, canvas
  `src/app/(fullscreen)/admin/system-map/page.tsx` (React Flow /
  `@xyflow/react`, new dep). Port: `docs/SYSTEM_MAP_PORT.md`.
- `dea36de` — the sticky-feature strategy doc.
- `e3190a6` — **focus + expand/collapse**: the API returns the graph's INPUT
  and the page builds client-side via `buildSystemMap(input, { focusFunnelId,
  collapsed })` — so focus/collapse re-layout instantly, no refetch. A funnel
  node's crosshair focuses one system (`?funnel=<id>`, "← All systems" back);
  its chevron collapses it to just the funnel card. 7 builder tests green
  (`tests/lib/system-map.test.ts`), tsc clean.
- `ca3768f` — **the System Blueprint Creator**: "Create a blueprint" drafts a
  whole system (funnel + emails + links + content) as a *pending* subgraph on
  the canvas, from research / an optimization (the leak detector's output) / a
  clone variant. The drafters (`blueprint.ts`) are pure; the skills
  (`research/skills/blueprint.ts`) materialize only on approve — the gated
  pattern. `system_blueprints` table + `blueprintStore.ts` + the
  `/api/admin/system-map/blueprint` route (propose/approve/reject) + the
  builder's `pendingBlueprints` overlay + the create panel. 18 tests green
  (`tests/lib/blueprint.test.ts`). Port: `docs/SYSTEM_BLUEPRINT_CREATOR_PORT.md`.
- `8719ace` — **deep-links + the node peek + the AI chat**: each system on the
  Asset Hub's Systems tab gets a "Map →" button opening its focused subgraph.
  Clicking a node expands it into a detail peek (`NodePeekPanel.tsx`). A
  read-only AI chat docks at the corner (`MapChatDock.tsx` +
  `/api/admin/system-map/chat`), grounded in the live graph (funnels + edge
  rates + leaks), with a "draft the fix" handoff into the blueprint creator.

## Where to pick up (the strategy's §14 order)

Shipped: edge metrics + the leak detector (1), the first write path (3), the
blueprint creator + the AI chat (4, partially), the node peek. **Next:**
step 2 — **live state + a time range** (poll the graph so the numbers tick; a
date-range selector that re-colors the edges by the period). Then step 5 (the
variant tree as a proper canvas) and step 6 (watch triggers reporting into the
map). The analysis engine reads all-time counts today — a period-aware read is
the seam for step 2.

## The architecture to keep

- **The builder is pure and shared** (no server imports) — it runs in the
  browser. The API returns the normalized `SystemMapInput`; the page builds.
  Keep it that way: any new view control (focus, collapse, time range) is a
  builder option + a client-side rebuild, never a refetch.
- **The connection tissue is foreign keys**, not URL parsing: a utm link
  carries `funnel_id` + `funnel_page` + `piece_id`; a funnel carries
  `emailKits: [{ event, emailKitId }]` + the rollup metrics.
- **The node card reads handlers off a React context** (`SystemMapUiContext`)
  so the React Flow node data stays clean of callbacks.

## Next task (the strategy's step 1): the analysis engine

**Edge conversion rates + the leak detector** — the first "it tells me
something" moment, and it's pure computation over data the house already has.

- The metrics that matter live on the **edges**: click→optin on a link→page
  edge, optin→purchase down the spine, open→click on a page→email edge. Join
  the raw events (funnel step counts, link clicks, email opens) into
  conversion rates on edges; color edges green → amber → red.
- **The leak detector**: a pure function over the graph — each edge's rate vs
  its cohort; the biggest negative outlier is the leak. Surface a ranked
  "where you're losing them" list that links to the node.
- **Content→buyer attribution**: links carry `piece_id`, leads carry
  `utm_content` — attribute a purchase back to the reel that caused it
  ("this reel made $1,240" on the content node).
- Run it as a background job on the `agent_jobs` lane (not in the request);
  the map reads the computed result. Store rollups in a
  `system_map_edge_metrics` table (edge id → period → rate) so the map never
  scans raw events.

Then step 2 (live state + time range), step 3 (the first write path — drag a
link onto a page), step 4 (AI chat that sees the map). Full sequencing in the
strategy doc §14.
