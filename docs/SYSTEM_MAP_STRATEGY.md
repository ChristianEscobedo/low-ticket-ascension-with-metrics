# The System Map — the sticky-feature strategy

> The question: how does the System Map become the **go-to, industry-reference
> surface** for building, analyzing, and cloning a whole marketing + sales
> system — the thing an operator opens every morning. This is the strategy:
> what to build, in what order, why it sticks, and what can go wrong.

---

## 0 · The north star — why it sticks

Every competitor (ClickFunnels, Kajabi, GoHighLevel, HubSpot) shows you a
**list** of your funnels. Nobody shows you the **system** — the living graph of
how traffic becomes money, with the numbers on the connections. The map is
sticky for three reasons:

1. **It's the morning surface.** A list answers "what do I have"; the map
   answers "what's working and what's leaking" — the question an operator
   actually starts the day with. The tool that owns the morning check-in owns
   the account.
2. **It's the system of record.** Once the map is where you *see* the truth,
   it's where you *act* on it. Viewing → analyzing → building is one surface,
   not three tools.
3. **It compounds.** Every reel, email, ad, and link you attach makes the map
   more complete and harder to leave. The moat is the accumulated graph + the
   learning loop on top of it (see §6).

The trap to avoid: a pretty diagram that's read-only forever. A picture you
can't act on is a screenshot feature — visited once, shared once, abandoned.
The map must become an **editor** (§3) and then an **operator** (§4).

---

## 1 · Viewing — the map as the home surface

The v1 map (four lanes, click-through) is the floor. What makes it the home:

- **Live state, not a snapshot.** The nodes breathe: a link's click count ticks
  up, a page's conversion moves, an email sequence shows its open rate. Poll
  the graph on an interval (or stream it) so the map is *alive* — a static
  diagram is a report, a live one is a dashboard.
- **Time as a dimension.** A date-range selector that re-colors every edge by
  the period's numbers (this week vs last). "What changed" is the first
  analytical question; the map should answer it without leaving the canvas.
- **Zoom levels of detail.** Zoomed out: one card per funnel with the health
  rollup (revenue, the leak). Zoom in: the full spine + feeders. Semantic zoom
  (the card's content changes with the zoom level), not just scale.
- **The leak is the headline.** The single most valuable thing the map can do
  is find the weakest connection automatically — the page where the funnel
  hemorrhages, the link with traffic but no conversions, the sequence nobody
  opens. A "biggest leak" badge that floats to the top. (See §2 — this is the
  analysis engine's job.)
- **Saved views + share links.** "The Q3 launch system," "the evergreen
  funnel." A read-only share link (the house already has the shared-run
  pattern — `share/run/[token]`) so an operator can hand a client the map
  without handing over the keys.

## 2 · Metrics — the analysis engine

The map's nodes already carry rollup metrics. The sticky layer is what the
engine *computes across* them:

- **Edge metrics, not just node metrics.** The number that matters lives on
  the *connection*: the click→optin rate on a link→page edge, the
  optin→purchase rate down the spine, the open→click rate on a page→email
  edge. The house already tracks the raw events (funnel step counts, link
  clicks, email opens) — the engine joins them into **conversion rates on
  edges** and colors the edges by health (green → amber → red).
- **The leak detector.** A pure function over the graph: for each edge, the
  conversion rate vs its cohort; the biggest negative outlier is the leak.
  Surface it as a ranked "where you're losing them" list that *links to the
  node*. This is the feature people screenshot and share.
- **Cohort + attribution.** Which content piece / ad / video produced the
  *buyers*, not just the clicks. The links carry `piece_id` and the leads
  carry `utm_content` — the engine can already attribute a purchase back to
  the reel that caused it. "This reel made $1,240" on the content node is the
  stickiest single number in the product.
- **Anomaly watch.** A edge that suddenly underperforms its own baseline (a
  link whose CTR fell off, a sequence whose open rate dropped) gets a quiet
  flag — the map tells you something broke before you go looking.

## 3 · Building — the map becomes the editor

This is the retention cliff and the answer to it. Read-only is a demo;
**editing on the canvas** is the product.

- **Drag to wire.** Drag from a content node onto a link node → that piece now
  carries that link (writes the `piece_id`). Drag a link onto a different page
  → it re-points (writes the `funnel_page`). Drag an email kit onto a step →
  it binds to that step's event. Each is one mutation endpoint per source
  table (the reason the Systems panel reads-and-routes today) — build the
  write path and the map becomes the fastest way to assemble a system.
- **Add on the canvas.** A `+` on a lane drops a new node inline (a new link,
  a new page, a new sequence) and opens its editor focused. The map is the
  creation entry point, not just the report.
- **Templates as stamps.** A proven system (a whole funnel + its emails + its
  links) stamps onto the canvas as a connected subgraph, not a pile of loose
  assets. This is where the recipes come in (§4).
- **Undo at the graph level.** Every canvas mutation is one reversible write;
  a single undo stack for the map (the house already has the 50-deep pattern
  in the reel studio).

## 4 · The agentic layer — recipes, experts, skills, and AI chat that builds

This is where the map stops being a dashboard and becomes an **operator** —
and it's the house's existing Research Lab machinery pointed at the graph:

- **AI chat on the canvas.** A chat docked beside the map that can *see* it
  (the graph is the context) and *act* on it. "Why is the checkout leaking?"
  → the agent reads the edge metrics, answers with the leak, and offers the
  fix as a one-click action. "Clone the evergreen funnel for the new offer" →
  it drafts the clone as a *pending subgraph* on the canvas for you to approve
  (the gated-recipe pattern — never a silent background act).
- **Recipes as graph operations.** A recipe (the house's `recipes` system) is
  a parameterized play — "launch a low-ticket ascension," "re-engage a cold
  list." On the map, running a recipe *materializes a connected subgraph*:
  the pages, the sequence, the links, wired. The recipe's steps become nodes
  with their run status on them (the NodeCard built/draft/failed vocabulary
  already exists for exactly this).
- **Experts as lenses.** An expert (the house's `experts` system — a persona
  with a knowledge base) looks at the map through its specialty: the CRO
  expert flags the leaky checkout, the deliverability expert flags the
  unopened sequence, the media buyer expert flags the ad with spend but no
  attributed sales. "Ask the CRO expert" on a node = a targeted review.
- **Skills as the agent's hands.** A skill (the house's `skills` system — a
  reusable capability the agent can call) is what lets the chat *do* things:
  `create_tracked_link`, `bind_email_sequence`, `clone_funnel`,
  `run_leak_analysis`. Each skill is a tool the agent loop (the existing
  `agent/loop.ts` + `toolDefs.ts`) can invoke against the graph. The map is
  the agent's workspace; skills are how it edits.
- **Agents that watch.** The house's watchlists + triggers (the Research
  Lab's) pointed at the graph: "watch the checkout edge; if conversion drops
  below 2%, open a task." The map becomes the place agents *report into*.

## 5 · Cloning with variants — the loop on the graph

The house already has the variant loop (spin → compose → post → measure →
crown a winner → spin descendants). On the map:

- **Clone as a visible subgraph.** Cloning a funnel stamps a sibling subgraph
  with a `variant-of` edge to the parent — you *see* the family. The gene
  tree (the house's `genes.ts` + the gene strip) renders as a proper tree on
  the canvas.
- **Variants share the spine, differ on a node.** A/B on the map = two page
  nodes sharing the funnel, traffic split on the edge, the winner's edge
  turning green as the numbers come in. The map is where you *watch the test
  run*.
- **The winner promotes.** One click promotes the winning variant's node into
  the main spine (the loop's `pickWinner` already exists — this is its UI).

## 6 · The moat — the learning loop on the graph

The thing no competitor can copy quickly: the map that **learns**.

- Every edge's conversion rate, across every user's system, anonymized, becomes
  a benchmark. "Your checkout converts at 1.8%; the cohort median is 3.1%" is
  a sentence only a network of systems can say.
- The house's `learnings.ts` + `distill.ts` (the Research Lab's) pointed at the
  graph: the system distills "what worked" into reusable patterns, and the
  recipes get *smarter* the more systems run them.
- This is the compounding moat: more maps → better benchmarks → smarter
  recipes → better outcomes → more maps.

## 7 · UI/UX + design

- **Performance is a feature.** The map must stay at 60fps with hundreds of
  nodes — virtualize edges, memoize node cards, keep the layout computation
  out of the render path (the builder already pre-computes positions; keep it
  that way). A laggy map is abandoned; a fluid one is lived in.
- **The house dark palette, one accent per lane.** Traffic emerald, links sky,
  pages brass, nurture violet — the lane color is the wayfinding. The
  NodeCard status vocabulary (built/draft/failed/pending) stays the *build*
  axis; the edge health (green/amber/red) is the *performance* axis. Never
  mix the two on the same element (the NodeCard doc already warns about
  exactly this).
- **Empty states that teach.** A new user's empty map shows a ghosted example
  system with "this is what a healthy system looks like" — the map is the
  onboarding.
- **Keyboard + command palette.** The house has the CommandPalette; the map
  joins it ("go to the leaky checkout").

## 8 · Performance (the engineering kind)

- **One graph query, not N.** The API already loads the five record sets in
  parallel and builds server-side. As the graph grows, paginate by funnel and
  lazy-load a funnel's feeders on expand — never load every click event, only
  the rollups.
- **Cache the built graph.** The graph rebuilds on an interval or on a
  mutation event, not on every page load. A short server cache + an
  invalidation on write.
- **The analysis engine is a background job.** Edge conversion rates + the
  leak detector run on the house's `agent_jobs` lane, not in the request —
  the map reads the computed result.

## 9 · Security

- **Read-only by default, write through the guard.** Every canvas mutation
  goes through `requireAdminRoute` + a per-table mutation endpoint — the same
  reason the Systems panel deliberately reads-and-routes today. No client-side
  writes to the graph.
- **Share links are capability tokens.** The read-only share view rides the
  existing `share/run/[token]` pattern — an unguessable token, a redacted
  read model (the house's `redact.ts`), no account data, revocable.
- **The agent is fenced.** The agent loop's existing fencing (`fencing.ts`) +
  budget (`budget.ts`) apply to graph edits — an agent proposes, a human
  approves (the gated pattern), and every agent write is logged
  (`agent_call_log`).
- **Metrics are sensitive.** Revenue and conversion numbers are
  business-confidential — the share view redacts absolute numbers to
  percentages/indexes by default.

## 10 · Database

- **The graph is a read model, not a new source of truth.** The nodes and
  edges derive from the existing tables (funnels, links, content, email kits)
  — no duplicated mutable state to drift. A `system_map_snapshots` table only
  if you want saved views / time-travel.
- **Edge metrics are computed, stored as rollups.** A
  `system_map_edge_metrics` rollup table (edge id → period → rate) written by
  the background job, so the map never scans raw events.
- **Variant lineage is a column, not a table.** `variant_of` on the funnel
  record renders the family tree (the house's `variantLinks.ts` already
  models this).

## 11 · AI

- **The graph is the agent's context.** The single biggest lever: the agent
  sees the *whole system* (every edge metric, every leak) instead of a
  chat-window fragment. Ground every answer in the live graph.
- **Structured output, gated execution.** The agent returns a *plan* (a set of
  graph operations), the canvas renders it as a pending subgraph, a human
  approves, the skills execute. Never a silent write.
- **Cost discipline.** The model cascade (`modelCascade.ts`) + the cost tracker
  (`cost.ts`) already exist — the map's agent uses the cheap model for reads,
  the strong one for plans.

## 12 · What the brief missed (the moat pieces)

- **The benchmark network** (§6) — the reason to never leave.
- **Time-travel / snapshots** — "the system on launch day vs today" is a
  feature no list-view competitor has.
- **The public share view** — agencies will show clients the map; that's the
  viral loop that markets itself.
- **Notifications into the map** — a watch trigger fires, the map lights the
  node. The map is where alerts *land*, not an inbox.

---

## 13 · Risks + mitigations

| Risk | Mitigation |
|---|---|
| **Read-only forever** — a pretty diagram that's a screenshot feature, visited once and abandoned | Ship the write path early (§3) — even one drag-to-wire mutation makes it a tool, not a report. The map must edit before it impresses. |
| **Performance collapse at scale** — hundreds of nodes + edges lag the canvas into unusability | Pre-computed layout (already done), virtualized edges, lazy feeder loading, the analysis on a background job. Budget 60fps as a hard requirement. |
| **Data ambiguity** — "0 clicks" that means "the query failed" vs "nobody clicked" | The house's two-error-policy pattern (the links store already does this): the admin half throws, never a silent zero. Every metric carries its provenance. |
| **The agent writes something wrong** — an autonomous edit breaks a live funnel | The gated pattern, always: the agent proposes a pending subgraph, a human approves, the skills execute, every write is logged. Fencing + budget on the loop. |
| **Scope creep into a second builder** — the map tries to *be* the funnel editor + the email editor + the reel studio | The map edits *connections*, never content. Click-through to the proper editor for content. The map is the wiring diagram, not the factory. |
| **A new source of truth drifts from the real tables** | The graph is a derived read model rebuilt from the source tables — never a separately-edited copy. Mutations write to the source table and re-derive. |
| **Benchmark privacy** — users won't share revenue for the network effect | Anonymized, opt-in, and reported as indexes/percentages, never absolutes. The value exchange (better recipes) is the incentive. |
| **React Flow at the edge of its comfort** — very large graphs hit the library's limits | The layout is already computed outside React Flow (the builder), so a swap to a custom canvas later is a renderer change, not a data change. Keep the graph model library-agnostic. |

---

## 14 · The sequencing (what to build in what order)

1. **Edge metrics + the leak detector** (§2) — the first "wow, it tells me
   something" moment, and it's pure computation over data the house already
   has. Cheapest, most shareable.
2. **Live state + time range** (§1) — makes it a dashboard, not a diagram.
3. **The first write path** (§3) — drag a link onto a page. One mutation
   endpoint, and the map is a tool.
4. **AI chat that sees the map** (§4) — the agent reads the graph, answers
   "why is this leaking," proposes the fix as a pending subgraph.
5. **Clone-as-subgraph + the variant tree** (§5) — the loop gets its canvas.
6. **Watch triggers + notifications into the map** (§4/§12) — the map becomes
   the place the system reports into.
7. **The benchmark network** (§6) — last, because it needs the fleet. The moat.

Each step ships value on its own and compounds into the next. The through-line:
**view → analyze → edit → operate → learn.**
