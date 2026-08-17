# The System Map — the comprehensive build (task brief)

> **Read first:** `docs/SYSTEM_MAP_PORT.md` (v1 — the four-lane read-only map)
> and `docs/SYSTEM_MAP_STRATEGY.md` (the sticky-feature strategy: view →
> analyze → edit → operate → learn). This doc is the build plan that turns v1
> into the product.

## What this pass adds (the two asks)

1. **Open an individual system.** The full view stays the default (the look
   that landed). Clicking a funnel's **focus** affordance opens just that
   system on the canvas — `/admin/system-map?funnel=<id>` — with a "← All
   systems" way back. One system, full detail, no noise from the others.
2. **Expand / collapse per system, on the canvas.** The default stays simple —
   but each funnel node carries a chevron that collapses it to just the funnel
   card, or expands it to reveal its pages, emails, links, and the
   content/videos feeding it, right there on the canvas. Simplicity by
   default, depth on demand.

## The architecture move that makes both cheap

**The API returns the graph's INPUT; the page builds the graph client-side.**
The builder (`src/lib/mothermode/systemMap.ts`) is already pure with no server
imports, so it runs in the browser. The route stops returning a built map and
returns the normalized `SystemMapInput` instead; the page runs
`buildSystemMap(input, opts)` in a `useMemo`. That one move makes expand,
collapse, and focus **instant and refetch-free** — the page re-lays-out
locally, no round-trip.

- `buildSystemMap(input, { focusFunnelId })` — only that funnel's subgraph
  builds (the individual view).
- `buildSystemMap(input, { collapsed })` — a funnel whose id is in the set
  renders only its funnel node (its pages/emails/links/content are skipped);
  the band collapses. Default: everything expanded (the current full view).

## The pieces

| Piece | Where | Change |
|---|---|---|
| The builder | `src/lib/mothermode/systemMap.ts` | `buildSystemMap(input, opts?: { focusFunnelId?: string; collapsed?: ReadonlySet<string> })`. Focus filters to one funnel's subgraph; a collapsed funnel renders only its funnel node. |
| The API | `src/app/api/admin/system-map/route.ts` | Returns `{ success, input }` (the normalized records), not a built map — the page builds. |
| The canvas | `src/app/(fullscreen)/admin/system-map/page.tsx` | Builds the graph client-side (`useMemo` over the input + the opts). Holds `collapsed` in state; reads `?funnel=` for the initial focus. A funnel node gets a collapse chevron + a focus affordance; a focused view gets "← All systems". |
| The node card | same file | The funnel node gains the chevron (collapse/expand) + a focus button; the rest of the card still clicks through to the editor. The toggles ride a small React context the page provides. |

## Verify

- `tests/lib/system-map.test.ts` — the existing 5 stay green, plus: a focused
  build contains only that funnel's nodes; a collapsed funnel renders only its
  funnel node (no pages/emails/links/content) and the edges to it drop with
  them; the default (no opts) is byte-identical to v1's full build.
- `npx tsc --noEmit` — clean.

## After this pass (the strategy, in order)

The strategy doc's sequencing, unchanged — this pass is the *viewing* layer
getting its focus/depth controls. Next is **§2 the analysis engine** (edge
conversion rates + the leak detector — the first "it tells me something"
moment), then **§3 the first write path** (drag a link onto a page — the map
becomes a tool), then **§4 the agentic layer** (AI chat that sees the map).
