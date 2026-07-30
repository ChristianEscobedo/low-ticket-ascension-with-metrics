/**
 * Geometry for the funnel map.
 *
 * `funnelMap.ts` describes *what* the funnel is — nodes, edges, branches — and
 * says nothing about where any of it sits, because its two renderers (ASCII and
 * Mermaid) both lay themselves out. A canvas cannot: it needs pixels.
 *
 * This module is that missing pass, and it is deliberately pure and
 * dependency-free so it can be tested without a DOM. It takes a `FunnelMap` and
 * returns coordinates plus ready-made SVG path strings, which keeps the
 * renderer dumb: the component positions divs at `x`/`y` and stamps out
 * `<path d={...}>` without doing any maths of its own.
 *
 * The shape it draws:
 *
 *   column 0   the spine — the path a buyer walks if they say yes to nothing
 *              extra: traffic → sales → checkout → upsells → success → access.
 *   column 1   side steps — order bumps (beside the step they attach to) and
 *              downsells (below the upsell they rescue).
 *   column 2   emails — hung off the row of the node whose event fires them.
 *
 * Rows only ever increase down the chain, so the drawing reads top-to-bottom in
 * the same order the buyer experiences it.
 */

import type { AscensionStage } from './ascension';
import type { FunnelEdge, FunnelMap, FunnelNode } from './funnelMap';

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

/** Card size. Exported so the renderer cannot disagree with the layout. */
export const FUNNEL_NODE_WIDTH = 224;
export const FUNNEL_NODE_HEIGHT = 84;
/** Gutters between grid slots. */
export const FUNNEL_COLUMN_GAP = 76;
export const FUNNEL_ROW_GAP = 44;

const COLUMN_PITCH = FUNNEL_NODE_WIDTH + FUNNEL_COLUMN_GAP;
const ROW_PITCH = FUNNEL_NODE_HEIGHT + FUNNEL_ROW_GAP;

/**
 * Minimum vertical gap between any two emails in the email column, in row
 * units. 0.7 of a row is wider than a card is tall, so stacked emails never
 * overlap while still reading as a cluster belonging to one node.
 *
 * This is a floor across the whole column, not per anchor. Anchors sit on
 * consecutive rows, so a cluster of three emails on one node would otherwise
 * run into the first email of the node below it.
 */
const EMAIL_ROW_STEP = 0.7;


const COLUMN_SPINE = 0;
const COLUMN_SIDE = 1;
const COLUMN_EMAIL = 2;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PositionedFunnelNode = FunnelNode & {
  /** Top-left of the card, in canvas pixels. */
  x: number;
  y: number;
  /** Grid slot, kept for tests and for anyone re-flowing the drawing. */
  column: number;
  /** Fractional for stacked emails; whole numbers everywhere else. */
  row: number;
};

export type RoutedFunnelEdge = FunnelEdge & {
  /** Unique per edge — `from`/`to` alone can repeat across placements. */
  id: string;
  /** SVG path data, ready for `<path d={...} />`. */
  d: string;
  /** Where a label for this edge should sit. */
  labelX: number;
  labelY: number;
};

export type FunnelMapLayout = {
  nodes: PositionedFunnelNode[];
  edges: RoutedFunnelEdge[];
  /** Bounds every node, so the canvas can size its scroll area. */
  width: number;
  height: number;
};

// ---------------------------------------------------------------------------
// Stage attribution
// ---------------------------------------------------------------------------

const UPSELL_STAGE_BY_INDEX: readonly AscensionStage[] = ['oto1', 'oto2', 'oto3'];

/**
 * The ladder rung a map node came from, when that can be said honestly.
 *
 * This is what lets an `AscensionIssue` — which is keyed to a stage — be drawn
 * on the node it is about rather than only listed underneath the diagram.
 *
 * Downsells deliberately return `undefined`. `buildFunnelMap` numbers them by
 * their own order, which matches the rung order only for inline placement; for
 * 'after' placement `downsell-1` is the first rung that *has* a downsell, which
 * may be OTO 2. Rather than be right two-thirds of the time, this says nothing.
 */
export function funnelNodeStage(node: FunnelNode): AscensionStage | undefined {
  if (node.kind === 'sales' || node.kind === 'checkout') return 'frontEnd';
  if (node.kind !== 'upsell') return undefined;
  const match = /-(\d+)$/.exec(node.id);
  if (!match) return undefined;
  return UPSELL_STAGE_BY_INDEX[Number(match[1]) - 1];
}

// ---------------------------------------------------------------------------
// Placement
// ---------------------------------------------------------------------------

const columnFor = (node: FunnelNode): number => {
  if (node.kind === 'email') return COLUMN_EMAIL;
  if (node.kind === 'orderBump' || node.kind === 'downsell') return COLUMN_SIDE;
  return COLUMN_SPINE;
};

/** First edge that points at `id`, which is the node's parent in the drawing. */
const parentOf = (edges: FunnelEdge[], id: string): string | undefined =>
  edges.find((e) => e.to === id)?.from;

// ---------------------------------------------------------------------------
// Edge routing
// ---------------------------------------------------------------------------

type Point = { x: number; y: number };

const round = (n: number): number => Math.round(n * 10) / 10;

const path = (from: Point, to: Point, curved: boolean): string => {
  const a = { x: round(from.x), y: round(from.y) };
  const b = { x: round(to.x), y: round(to.y) };
  if (!curved) return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  const midY = round((a.y + b.y) / 2);
  return `M ${a.x} ${a.y} C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${b.y}`;
};

/**
 * Where an edge leaves one card and enters the next.
 *
 * Same column — straight down the spine. Same row — straight across, which is
 * what an order bump wants: it is not a step forward, it is a tick box on the
 * step it sits beside. Anything else leaves the bottom and curves into the top,
 * so a branch reads as a departure from the spine rather than a detour on it.
 */
function route(source: PositionedFunnelNode, target: PositionedFunnelNode) {
  const sameColumn = source.column === target.column;
  const sameRow = source.row === target.row;

  if (sameColumn) {
    const from = { x: source.x + FUNNEL_NODE_WIDTH / 2, y: source.y + FUNNEL_NODE_HEIGHT };
    const to = { x: target.x + FUNNEL_NODE_WIDTH / 2, y: target.y };
    return { from, to, curved: false };
  }

  if (sameRow) {
    const rightward = target.x > source.x;
    const from = {
      x: rightward ? source.x + FUNNEL_NODE_WIDTH : source.x,
      y: source.y + FUNNEL_NODE_HEIGHT / 2,
    };
    const to = {
      x: rightward ? target.x : target.x + FUNNEL_NODE_WIDTH,
      y: target.y + FUNNEL_NODE_HEIGHT / 2,
    };
    return { from, to, curved: false };
  }

  const from = { x: source.x + FUNNEL_NODE_WIDTH / 2, y: source.y + FUNNEL_NODE_HEIGHT };
  const to = { x: target.x + FUNNEL_NODE_WIDTH / 2, y: target.y };
  return { from, to, curved: true };
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/**
 * Positions every node and routes every edge.
 *
 * Node order is taken as given: `buildFunnelMap` pushes nodes in the order a
 * buyer meets them, so walking the array is the flow order and no topological
 * sort is needed. Edges whose endpoints are missing are dropped rather than
 * drawn to nowhere.
 */
export function layoutFunnelMap(map: FunnelMap): FunnelMapLayout {
  const positioned = new Map<string, PositionedFunnelNode>();
  let nextSpineRow = 0;

  const place = (node: FunnelNode, column: number, row: number) => {
    positioned.set(node.id, {
      ...node,
      column,
      row,
      x: column * COLUMN_PITCH,
      y: row * ROW_PITCH,
    });
  };

  // Pass 1: the funnel itself. Emails are skipped because they borrow the row
  // of the node that fires them, which has to exist before it can be borrowed.
  map.nodes.forEach((node) => {
    if (node.kind === 'email') return;

    let row: number;
    if (node.kind === 'orderBump') {
      const anchorId = parentOf(map.edges, node.id);
      const anchor = anchorId ? positioned.get(anchorId) : undefined;
      row = anchor ? anchor.row : nextSpineRow++;
    } else {
      // Downsells take a row of their own even though they sit in the side
      // column: the buyer sees them after the upsell, not beside it.
      row = nextSpineRow++;
    }
    place(node, columnFor(node), row);
  });

  // Pass 2: emails, walked in anchor order rather than input order.
  //
  // Input order is the operator's, and says nothing about where the trigger
  // sits — an email on `funnel.access` can be listed before one on
  // `optin.captured`. Sorting by anchor row first means the cursor below only
  // ever has to push a card *down*, so an email never drifts far from the
  // event it belongs to.
  const emails = map.nodes
    .filter((n) => n.kind === 'email')
    .map((node, i) => {
      const anchorId = parentOf(map.edges, node.id);
      const anchor = anchorId ? positioned.get(anchorId) : undefined;
      return { node, i, anchorRow: anchor?.row };
    })
    .sort((a, b) => {
      // Orphans sort last: with no anchor there is no row to sit beside.
      const ar = a.anchorRow ?? Number.POSITIVE_INFINITY;
      const br = b.anchorRow ?? Number.POSITIVE_INFINITY;
      return ar === br ? a.i - b.i : ar - br;
    });

  let lastEmailRow: number | undefined;
  emails.forEach(({ node, anchorRow }) => {
    // An orphaned email has no anchor row to borrow, so it takes a row of its
    // own past the end of the funnel, where it is visibly attached to nothing
    // — which is exactly what `orphanedEmails` is reporting.
    const preferred = anchorRow ?? nextSpineRow++;
    const row =
      lastEmailRow === undefined
        ? preferred
        : Math.max(preferred, lastEmailRow + EMAIL_ROW_STEP);
    lastEmailRow = row;
    place(node, COLUMN_EMAIL, row);
  });


  const nodes = map.nodes
    .map((n) => positioned.get(n.id))
    .filter((n): n is PositionedFunnelNode => Boolean(n));

  const edges: RoutedFunnelEdge[] = [];
  map.edges.forEach((edge, i) => {
    const source = positioned.get(edge.from);
    const target = positioned.get(edge.to);
    if (!source || !target) return;
    const { from, to, curved } = route(source, target);
    edges.push({
      ...edge,
      id: `${edge.from}->${edge.to}-${i}`,
      d: path(from, to, curved),
      labelX: round((from.x + to.x) / 2),
      labelY: round((from.y + to.y) / 2),
    });
  });

  let width = 0;
  let height = 0;
  nodes.forEach((n) => {
    width = Math.max(width, n.x + FUNNEL_NODE_WIDTH);
    height = Math.max(height, n.y + FUNNEL_NODE_HEIGHT);
  });

  return { nodes, edges, width, height };
}
