# The System Blueprint Creator — system port

> The second of the two System Map asks (the buyer journey map shipped first).
> One action — **"Create a blueprint"** — materializes a whole system (the
> funnel's pages + the email sequence + the tracked links + the content) as one
> connected, ready-to-run subgraph on the System Map, from three entry modes.
> This is the strategy's step 4 (the agentic build) made concrete. Task brief:
> `docs/SYSTEM_BLUEPRINT_CREATOR_TASK.md`.

## What it is

A blueprint is a **pending subgraph** on the System Map — not a pile of loose
assets, but the wired system. The gated pattern, always: the creator drafts the
subgraph as a *pending* overlay (dashed borders, the NodeCard `pending`
status), a human approves on the canvas, and only then do the skills write the
real records. Never a silent background act.

Three entry modes (`src/lib/mothermode/blueprint.ts`, one drafter each — pure,
no writes):

- **From research** (`draftFromResearch`) — an offer-brief artifact becomes the
  whole system: the sales funnel (pages prefilled from the brief), the nurture
  sequence bound to the opt-in, and one content card + tracked link per angle.
  This is the Full System fan-out (`handoff.ts`'s `runSystemBuild`) aimed at
  the map — the same parts, proposed as a pending subgraph instead of written
  at once.
- **From an optimization** (`draftFromOptimization`) — the leak detector's
  worst edge becomes the fix: the leaky funnel clones into a variant with the
  weak page flagged for rework, a recovery sequence binds to the event that
  fires there (`checkout_start` for a checkout leak), and a fresh tracked link
  drives test traffic.
- **From a clone variant** (`draftFromClone`) — a winning funnel clones into a
  variant (the `variant-of` edge), ready to A/B.

## The pieces

| Piece | Where | What |
|---|---|---|
| The drafters + types | `src/lib/mothermode/blueprint.ts` | Pure: the `SystemBlueprint`/`BlueprintNode` types, the defensive normalizers, `blueprintDraftErrors` (validation), and the three drafters (the step→node mapping). No server imports — the builder + the page import it. |
| The store | `src/lib/mothermode/blueprintStore.ts` + migration `20261204000000_system_blueprints.sql` | The `system_blueprints` table + the read/write. Reads degrade ([] / null), writes throw — the house pattern. |
| The skills | `src/lib/mothermode/research/skills/blueprint.ts` | `create_funnel`, `clone_funnel`, `bind_email_sequence`, `create_tracked_link`, `create_content_card` — the agent's hands, one per source table. `materializeBlueprint` runs them in dependency order (content → funnel → email → link), resolving each node's local `funnelKey`/`pieceKey` ref to the created record. Deps injected for the tests. |
| The API | `src/app/api/admin/system-map/blueprint/route.ts` | `GET` lists (the map reads the `proposed` ones); `POST` `propose` (draft + persist, no source writes), `approve` (the skills materialize), `reject` (discard). |
| The canvas overlay | `systemMap.ts` (`buildSystemMap` gains `pendingBlueprints`) + the page | A proposed blueprint renders as a dashed band below the real systems; the anchor node carries approve/reject; a clone/optimization draws the `variant-of` edge to its parent. |
| The create panel | `system-map/BlueprintCreatePanel.tsx` | The three entry modes, in the header's "Create a blueprint" panel. |
| The recipe | `recipes/seed.ts` → `system-blueprint` | The agentic path: the recipe drafts the source artifacts (offer-brief → email-outline → content-plan) that "From research" then aims at the map. |

## The gated invariant (the load-bearing rule)

**Nothing writes to a source table before approve.** It holds structurally:

- The drafters are pure — a source in, a subgraph out, no store import.
- `propose` only writes the `system_blueprints` row (the overlay), never a
  source record.
- `materializeBlueprint` (the only write path) is called solely by the
  `approve` route, and only when the blueprint is still `proposed`.
- A malformed subgraph never persists (`blueprintDraftErrors` gates the write);
  an unknown skill normalizes to `null` and gets flagged, never silently run.

## Verify

`tests/lib/blueprint.test.ts` — 18 tests: the three drafters' step→node
mapping, the validation, the store round-trip (`rowToBlueprint` intact through
the row shape + the defensive drops), the builder's pending overlay (the band,
the pending status, the variant-of edge, the no-overlap layout), the
materializer's dependency order + ref resolution + loud failure, and the gated
invariant. `tsc --noEmit` clean; the existing system-map / analysis /
buyer-journey tests still pass.

## Notes for the next session

- The deterministic slugs (the drafters bake a source-derived suffix in) make
  an approve **retry-safe**: the stores upsert on slug→id, so a retried
  materialization updates rather than duplicates (the handoff's replay-safety
  pattern).
- A failed approve leaves the blueprint `proposed` (retryable) and surfaces the
  reason — never a half-live system reported as done.
- The blueprint table holds only the *proposal* + its lifecycle — never a
  source record. The graph stays a derived read model rebuilt from the source
  tables (the strategy's §13 rule).
