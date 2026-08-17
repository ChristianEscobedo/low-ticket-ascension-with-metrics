# The System Blueprint Creator — task brief (build this next)

> The second of the two asks (the buyer journey map shipped, `a8c8782`). A
> **blueprint creator**: generate a whole system — the funnel's pages, the
> email sequences, the tracked links, the content — as one connected,
> ready-to-run blueprint, from **research**, an **optimization**, or a **clone
> variant**. This is the strategy's step 4 (the agentic build) made concrete.

## What it is

One action — "Create a blueprint" — that materializes a connected subgraph on
the System Map: not a pile of loose assets, but the wired system. Three entry
modes:

1. **From research** — a research artifact (the Research Lab's) becomes the
   blueprint: the offer, the funnel, the emails, the angles. The Full System
   fan-out already does a version of this (`structured.systemManifest`) — the
   blueprint creator is that, aimed at the map.
2. **From an optimization** — the leak detector's output becomes the blueprint:
   "the checkout leaks → a blueprint that fixes it" (a new checkout variant +
   the cart-abandonment sequence + the re-pointed links).
3. **From a clone variant** — a winning funnel clones into a variant blueprint
   (the `variant-of` edge), ready to A/B.

## The architecture (rides what exists)

- **The generation pipeline is the Research Lab's agent loop + recipes.** A
  blueprint is a *recipe run* whose output is a connected subgraph. The agent
  (`agent/loop.ts` + `toolDefs.ts`) calls the skills (`create_funnel`,
  `bind_email_sequence`, `create_tracked_link`, `clone_funnel`) to
  materialize each node. **The gated pattern, always**: the agent proposes the
  blueprint as a *pending subgraph* on the canvas (the NodeCard
  built/draft/pending vocabulary renders the run's status per node), a human
  approves, the skills execute. Never a silent background act.
- **The map is where it lands.** The blueprint renders on the System Map as a
  pending subgraph (dashed borders, the "pending" status) until approved; on
  approve, the skills write the real records and the subgraph goes live. The
  builder (`systemMap.ts`) gains a `pending` overlay — a blueprint-in-progress
  draws over the existing graph.
- **The blueprint is a persisted record** — a `system_blueprints` table (id,
  the mode, the source [research artifact id / the leak / the parent funnel],
  the proposed subgraph JSON, the status [proposed/approved/materialized],
  the recipe run id). The map reads the proposed ones as the overlay.

## The pieces to build

| Piece | Where | What |
|---|---|---|
| The blueprint recipe | `src/lib/mothermode/research/recipes/` | A recipe whose steps are the system's parts (funnel, emails, links, content), each producing a node. |
| The skills | `src/lib/mothermode/research/skills/` | `create_funnel`, `bind_email_sequence`, `create_tracked_link`, `clone_funnel` — the agent's hands, one per source table. |
| The blueprint store | `src/lib/mothermode/blueprint.ts` + a migration | The `system_blueprints` table + the read/write. |
| The API | `/api/admin/system-map/blueprint` | POST propose (run the recipe → a pending blueprint), POST approve (the skills materialize it). |
| The canvas overlay | `systemMap.ts` + the page | The pending subgraph renders dashed/pending over the graph; approve → it materializes. |

## The honest sequencing within this build

1. The blueprint store + the table (the record).
2. The recipe + the propose path (the agent drafts the blueprint — no writes
   yet, the pending subgraph renders).
3. The skills + the approve path (the materialization).
4. The canvas overlay (the pending subgraph on the map).

Each ships value: even step 2 (the agent drafts a blueprint you review) is
useful before anything materializes.

## Verify

- The recipe's step→node mapping, the blueprint store's round-trip, and the
  builder's pending overlay, unit-tested. tsc clean.
- The gated invariant holds: nothing writes to a source table before approve.

## Read first

`docs/SYSTEM_MAP_STRATEGY.md` §4 (the agentic layer) + §13 (the gated/fenced
risk), `docs/SYSTEM_MAP_SESSION_HANDOFF.md` (the architecture to keep), and
the Research Lab's `recipes/` + `skills/` + `agent/loop.ts` (the machinery
this rides).
