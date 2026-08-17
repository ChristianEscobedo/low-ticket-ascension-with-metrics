# System Map — System Port

> **2026-08-17 — the system map (the whole money system as a node graph).** A
> new fullscreen canvas at `/admin/system-map`, entered from the Asset Hub's
> Systems tab ("System map →", top of `SystemsPanel.tsx`). It answers "show me
> the whole system for an offer — the funnel's pages, the emails each step
> fires, and the ads/content/videos feeding traffic in — with the metrics on
> every node."

## The shape

Four lanes, left → right (traffic flows toward the pages):

```
TRAFFIC            LINKS            PAGES             NURTURE
content/ad/video ──► /go/<link> ──► funnel + steps ──► email kit
(planner piece)     (click_count)   (views/sales/$)    (the event's sequence)
```

Edges: `content → link → page`, `funnel → page` (the spine), `page → email`
(the kit bound to that step's event). Every node carries its metrics and opens
in its proper editor on click. v1 is read-only + click-through — rewiring
connections on the canvas is the follow-up.

## The connection tissue is already on the records

No URL parsing, no guessing:

- a utm link (`mothermode_utm_links`) carries `funnel_id` + `funnel_page` +
  `piece_id` — which funnel, which page, which content piece feeds it;
- a funnel carries `emailKits: [{ event, emailKitId }]` (+ the legacy
  `emailKitId` optin kit) — which sequence each step fires;
- the funnel record carries the rollup metrics (`viewCount`,
  `conversionCount`, `checkoutCount`, `purchaseCount`, `upsellNYes/No`,
  `revenueCents`).

## Pieces

| Piece | Where | What |
|---|---|---|
| The builder | `src/lib/mothermode/systemMap.ts` | `buildSystemMap(input)` — pure, no server imports. Maps the small input → the positioned node/edge graph AND lays it out (x/y per node, the four lane columns, a y-band per funnel), so the page is a dumb renderer and the geometry is unit-testable. |
| The API | `src/app/api/admin/system-map/route.ts` | GET (requireAdminRoute). Loads sales + optin funnels, email kits, utm links, and the planner's content pieces in parallel; maps records → the builder's input (the thin mapping lives here); returns the graph. |
| The canvas | `src/app/(fullscreen)/admin/system-map/page.tsx` | Client page on a **React Flow** (`@xyflow/react`, new dep) canvas — pan/zoom, `smoothstep` edges, a custom `SystemNodeCard` (the house dark palette + the NodeCard status vocabulary: published/active → built, else draft). "← Asset Hub" top-left. |
| The entry | `src/app/admin/assets/SystemsPanel.tsx` | A "System map →" card at the top of the Systems tab. |

## Editor hrefs (the click-through)

- funnel / its pages → `/admin/sales-funnels?funnel=<id>` (sales) or
  `/admin/funnels?funnel=<id>` (optin) — the funnel editor owns its pages;
- email kit → `/admin/email-marketing?kit=<id>`;
- link / content piece → `/admin/planner` (cards + link tracking live there);
- a published funnel also carries `liveHref` (`/funnel/<slug>[/step]`) for a
  "view" affordance.

## Verify

- `npx vitest run tests/lib/system-map.test.ts` — 5 passing: the spine + the
  funnel's rollup metrics; the email kit lands on the page its event fires on;
  a link routes to its `funnel_page` (or the funnel when unset) and the content
  carrying it feeds the link (a link on no funnel never enters the graph); the
  four lanes lay out left→right with no two nodes sharing a position and the
  canvas bounds containing everything; a draft funnel reads draft + gets no
  live link.
- `npx tsc --noEmit` — clean.

## The analysis engine (the strategy's step 1, shipped)

`src/lib/mothermode/systemMapAnalysis.ts` — `analyzeSystemMap(input)` turns the
funnel records' step counts into a **conversion rate per edge** (the metrics
that matter live on the connections, not the nodes): opt-in (leads/views),
checkout (checkouts/leads), purchase (purchases/checkouts), each riding the
builder's `funnel→page` edge id so the page can color it. Each edge grades on
the **performance axis** (good/ok/bad, per-step thresholds) — never the node
cards' build axis. The **leak detector** finds each funnel's worst
underperforming edge (enough volume to be meaningful, never crying wolf on a
healthy funnel) and ranks them worst-first; the header's "Biggest leak" badge
focuses that funnel on click. Pure, no new queries (it reads the same
`SystemMapInput`), unit-tested (`tests/lib/system-map-analysis.test.ts`, 4
passing). The page colors a graded edge by its health and leaves an ungraded
one the quiet default.

## Notes / follow-ups

- **`@xyflow/react` is a new dependency** (the user named React Flow; a
  pannable map is its use case). The house's two earlier canvases (the funnel
  flow + the email flow) predate it and are custom — this is the first
  React Flow surface.
- **The first write path shipped: drag a link onto a page to re-point it.**
  React Flow's `onConnect` (gated by `isValidConnection` — only a
  link → page/funnel connection is meaningful) → `PATCH /api/admin/system-map`
  → `updateUtmLinkTarget` (the links store's new function — sets `funnel_id` +
  `funnel_page`, clears `optin_funnel_id` per the DB CHECK, and throws on
  failure per the admin half's policy) → the page updates the input locally
  and the map rebuilds (no refetch), with a transient note confirming the
  re-point. The map is a tool now, not just a report. The next write paths
  (drag content onto a link, a kit onto a step) follow the same shape — one
  mutation endpoint per source table.
- The content node's editor href is `/admin/planner` for every piece in v1
  (the planner board owns the cards); a reel deep-link (`/admin/reel-studio?reel=<id>`)
  is the refinement when a piece is a video.
