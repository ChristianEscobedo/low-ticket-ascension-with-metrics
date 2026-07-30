# Funnel Flow Canvas — Handoff

Replace the ASCII funnel view in the Architecture tab with a real visual canvas,
built the same way as the email flow canvas.

> **Status: all three steps complete.** The canvas renders in the Architecture tab
> with the ASCII kept behind a toggle. See "State at close" at the bottom for what
> was verified and what was not. The body of this doc is left as originally written
> so the plan and the outcome can be compared.

> **Follow-up session — the canvas renders, but it is drawing an incomplete map.**
> Read this before trusting the screenshots. Details below.

## Follow-up: the map reaching the canvas is under-fed

The canvas is wired and correct, but the map it receives is missing whole classes
of node, so they never reach the layout and never appear on screen. This looks
like a canvas bug and is not one.

Correcting this section's earlier wording: the tab does **not** call
`buildFunnelMap` directly, so "the tab under-feeds `buildFunnelMap`" was the
wrong description. It calls `auditIntakeFunnel(intake)` with no options and
renders `audit.map`. `buildFunnelMapFromIntake` is what forwards
`IntakeFunnelMapOptions` (`traffic`, `emails`, `downsellPlacement`) into the map
builder. The distinction matters because it changes the fix: the options plumbing
already exists and is simply never used, except for downsells, where the intake
type cannot express the data in the first place.

Missing from the tab's call:

- **`emails`** — nothing is passed, so the email column is always empty. This was
  the symptom that started the investigation ("why are there no emails?").
- **`traffic`** — no `ad` / `optin` nodes, so the flow starts at the sales page
  rather than at the top of the funnel.
- **`downsells`** — not merely unsupplied: `SalesAiIntake` has **no downsell
  fields at all**, so this is a schema limit, not a missed argument. The adapter
  already reports it as `downsells-not-expressible` and the tab already labels it
  "Intake cannot express downsells", so the system is honest about it — but the
  branch-edge routing in the layout is consequently unexercised in the real UI,
  and `compareDownsellPlacements` (the inline-vs-after AOV comparison the
  elasticity model is built around) is unreachable from a real funnel because
  `downsellPlacement` always defaults to `'none'`.
- **Order bumps are already wired**, contrary to an earlier claim here that no
  rescue branches at all were drawn: `orderBump` is forwarded from the intake's
  bump, with an `extra-order-bumps` note when there are more than the map draws.
- One consequence worth stating plainly: because no emails reach the map,
  `orphanedEmails(audit.map)` can only ever return empty. The orphan check
  displayed in the tab is currently **vacuous rather than passing** — it will
  report "no orphans" for a funnel whose emails are all orphaned.

None of this is layout-side. The layout already handles all three kinds, and
`tests/lib/sales-funnel-layout.test.ts` builds a map with every one of them —
which is why the geometry suite is green while the screen is incomplete.

The fix splits in two, though, and the split is the useful part:

- **`emails` and `traffic` are tab-side and small.** Pass options into
  `auditIntakeFunnel` / `buildFunnelMapFromIntake`. Note the tab currently
  receives only `intake` as a prop, so the email kits have to be threaded down
  from `SalesFunnelEditor` first — that is the actual work, not the map call.
- **`downsells` is schema-side and not small.** It needs new fields on
  `SalesAiIntake` (plus AI-fill and editor UI to populate them) before the map
  can be given anything to draw. Worth doing mainly because it unblocks
  `compareDownsellPlacements`, which is well-tested and currently unreachable.

### Email stacking fix — landed this session

Emails hang off their trigger's row. With more than a couple on one trigger, a
cluster could reach down into the row of the *next* trigger's emails and overlap
it, because the minimum gap was enforced per anchor rather than across the column.
The gap is now a floor for the whole email column.

Two tests were added, both green (suite is now 14):

- Cross-anchor overlap, with an explicit guard that the fixture's two events
  really do resolve to two distinct anchors — otherwise the test would pass
  vacuously if event naming ever drifted, which is exactly how this defect
  survived the first pass.
- Group placement is independent of input order. Note the deliberate limit here:
  order *within* one trigger follows the input, because that is the send
  sequence and belongs to the operator. Only the placement of a group is
  anchor-driven. An earlier version of this test asserted full order
  independence, failed, and was wrong to.


## Why

`src/app/admin/sales-funnels/parts/ArchitectureTab.tsx` currently renders the
funnel as monospaced text:

```tsx
const ascii = useMemo(() => toAsciiMap(audit.map), [audit.map]);
...
<pre className="overflow-x-auto rounded-lg border border-bone/10 bg-ink/50 p-3 text-[11px] leading-relaxed text-bone/70">
  {ascii}
</pre>
```

There is no diagram. `toMermaid` exists in `funnelMap.ts` and is exported, but
nothing calls it — `FUNNEL_ASCENSION_ARCHITECTURE_PORT.md` already notes "The
Mermaid output is asserted as a string. It has not been rendered."

## The good news: no library needed

`src/components/mothermode/email/EmailFlowDashboard.tsx` is hand-rolled. Verified
by grep — there is no `reactflow` import. It uses:

- **Edges** — `<svg className="pointer-events-none absolute inset-0">` containing
  `<path d={path}>` per edge, with a `<marker id="flow-arrow-dash" viewBox="0 0 10 10" refX="8">`
  holding `<path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />` as the arrowhead.
  Edge colour is set by wrapping each path in `<g style={{ color }}>` so the marker
  inherits via `currentColor`.
- **Nodes** — absolutely positioned divs inside `<div className="absolute inset-0">`,
  styled `absolute flex flex-col justify-center gap-1.5 rounded-xl border bg-[#141a2e] p-3 text-left shadow-lg transition`,
  with a coloured left rail `<span className="absolute bottom-2 top-2 left-0 w-1 rounded-r bg-[#6ea8fe]" />`.
  Branch nodes use `bg-brass`, normal nodes `bg-bone/25`.
- **Pan/zoom** — one wrapper with
  `transform: translate(${pan.x + CANVAS_PADDING}px, ${pan.y + CANVAS_PADDING}px) scale(${scale})`
  and `transformOrigin: '0 0'`.
- **Selection** — a `dimmed` class applied to non-neighbours, plus a detail card
  pinned `absolute bottom-4 right-4 z-30 w-80 rounded-xl border border-bone/20 bg-ink/95 p-4 shadow-2xl backdrop-blur`,
  with `onMouseDown={(e) => e.stopPropagation()}` so dragging the card doesn't pan
  the canvas.
- A/B variant nodes use `border-dashed` — the funnel equivalent is downsells.

All of this is portable. Copy the patterns, don't import the component — it's
bound to email-specific types.

## The gap: the funnel map has no coordinates

`FunnelMapNode` carries `kind`, `label`, `reach?` ("Projected share of visitors
reaching this node, 0-1, when modelled") and `event?`. `FunnelMapEdge` carries
`branch?: 'yes' | 'no'` and `label?`. **Neither has `x`/`y`** — ASCII never needed
them. The email graph gets positions from its own layout step; the funnel map has
no equivalent.

Node kinds in play, from `buildFunnelMap`: `optin`, `sales`, `checkout`,
`orderBump`, `upsell`, `downsell`.

## Steps

### 1. `src/lib/mothermode/sales/funnelMapLayout.ts` — DONE

Pure function, `FunnelMap → { nodes: PositionedNode[]; edges: RoutedEdge[]; width: number; height: number }`.

- Main spine down one column, in ladder order: `optin` → `sales` → `checkout` → upsells.
- `no` branches (downsells) offset into a second column to the right of their parent.
- `orderBump` as a side node off `checkout`.
- Emit edge paths as SVG `d` strings so the renderer stays dumb — straight
  vertical for spine edges, a curve or elbow for branch edges.

Keep it pure and dependency-free: it belongs in `tests/lib/` alongside
`sales-ascension.test.ts`. Test that the spine is ordered, that a downsell lands
in a different column from its parent, that no two nodes share a position, and
that `width`/`height` bound every node.

### 2. `src/components/mothermode/sales/FunnelFlowCanvas.tsx` — DONE

`'use client'`. Props: the `FunnelMap` plus the audit issues. Renders the layout
using the patterns above. Encode the data the map already has:

- **`reach`** → node opacity or width, so attention decay is visible down the ladder.
- **`branch`** → edge colour, `yes` vs `no` visually distinct.
- **`event`** → show in the detail card; these are the names email triggers bind to.
- **Audit issues** → outline the offending node in the error colour. This is the
  payoff the email canvas can't offer: `auditIntakeFunnel` already returns issues
  keyed to rungs, so a `no-escalation` or `price-inversion` verdict should be
  visible *on the node it came from*, not just in a list underneath.

### 3. Wire into `ArchitectureTab` — DONE

Swap the `<pre>` for the canvas. **Keep the ASCII behind a "text view" toggle** —
it's genuinely useful for pasting into a doc or a commit message, and
`toAsciiMap` is already tested.

## Testing note

Step 1 is cleanly unit-testable. Step 2 is not, by the current setup: `tests/lib/`
has no render tests anywhere and `@testing-library/react` is not in the project.
Either add it (and a jsdom environment in `vitest.config.ts`) or accept that the
canvas is verified by eye — but say which. Don't claim the canvas is tested
because the layout module is.

**Which was chosen: neither library nor render tests were added.** The canvas has
**no automated test coverage at all**. `@testing-library/react` is still absent and
`vitest.config.ts` is untouched. The 12 layout tests cover `funnelMapLayout.ts`
only — the geometry, not a single line of the component. `tsc --noEmit` proves the
component compiles and that its props line up with the layout and audit types; it
proves nothing about what appears on screen. (The layout suite is now 14 tests,
not 12 — see the follow-up section at the top. The point stands: none of them
touch the component.)

It also has **not yet been looked at in a browser** — not by the session that wrote
it. Nobody has confirmed the diagram actually looks right. That eyeball pass is the
first thing the next person should do, before trusting anything below.

## Scope warning

`EmailFlowDashboard` is a large component and the pan/zoom plus selection logic is
the bulk of it. This is a few hundred lines across two new files, not a patch.
Budget a full session.

## State at close

All three steps are done. What landed:

- `src/lib/mothermode/sales/funnelMapLayout.ts` — pure layout pass, three columns
  (spine / side steps / emails), returns positioned nodes and ready-made SVG `d`
  strings. Also exports `funnelNodeStage`, which deliberately returns `undefined`
  for downsells: `buildFunnelMap` numbers them in a way that only matches rung
  order for inline placement.
- `src/components/mothermode/sales/FunnelFlowCanvas.tsx` — the canvas.
- `ArchitectureTab.tsx` — canvas replaces the `<pre>`; ASCII kept behind a toggle.
- Barrel export added to `src/lib/mothermode/sales/index.ts`.

Verification, precisely:

- `tests/lib/sales-funnel-layout.test.ts` — 12 tests, green. Ladder order, no two
  nodes sharing a position, stacked emails not overlapping, tight bounds, and
  straight-vs-curved edge routing. **Now 14** — a later session added cross-anchor
  email overlap and group-placement stability.
- Sales suites together (layout, ascension, intake-ascension, email-plan): 4 files,
  83 tests, all green.
- `tsc --noEmit` — clean. This was the check the previous session deferred because
  the layout module had no callers; it now has them and still passes.
- Full suite: 6 files / 39 tests fail. **All pre-existing and unrelated** —
  `tests/api/*` (Stripe/webhook/env-dependent), `tests/utils/*`, and
  `tests/lib/mothermode/*`. Confirmed by stashing this work and re-running the
  same subset: identical 4 files / 16 tests failing with and without it. Nothing
  here touches those paths.

Read the **Testing note** above before trusting the canvas — it has no automated
coverage and has not been viewed in a browser.

Still open from `FUNNEL_ASCENSION_ARCHITECTURE_PORT.md`, unchanged by this work:
escalation inference is keyword matching rather than understanding, nothing
persists the audit result, and no publish gate consumes the verdict.
