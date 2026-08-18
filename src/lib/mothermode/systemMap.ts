/**
 * The System Map (pure): turn the live funnel/email/link/content records into
 * a positioned node/edge graph the `/admin/system-map` canvas renders.
 *
 * The question it answers: "show me the whole money system for an offer — the
 * funnel's pages, the emails each step fires, and the ads/content/videos
 * feeding traffic in — with the metrics on every node."
 *
 * The shape (four lanes, left → right — traffic flows toward the pages):
 *
 *   TRAFFIC          LINKS           PAGES            NURTURE
 *   content/ad/video ──► /go/<link> ──► funnel + steps ──► email kit
 *   (the planner      (click_count)    (views/sales/$)    (the event's
 *    piece)                                              sequence)
 *
 * The connection tissue is already on the records — a utm link carries
 * `funnel_id` + `funnel_page` + `piece_id`, and a funnel carries
 * `emailKits: [{ event, emailKitId }]`. No URL parsing, no guessing.
 *
 * Pure: no server imports, no React. The route maps DB records → the input
 * below; this module builds + LAYS OUT the graph (x/y per node) so the page
 * is a dumb renderer and the geometry is unit-testable.
 */
import type { BlueprintNodeKind, SystemBlueprint } from './blueprint';

// ---------------------------------------------------------------------------
// Input (the route maps DB records into these — small, so tests stay small)
// ---------------------------------------------------------------------------


export interface SystemMapFunnelInput {
  id: string;
  slug: string;
  name: string;
  /** 'published' | 'draft' | 'archived' — the status vocabulary maps off it. */
  status: string;
  kind: 'sales' | 'optin';
  /** Rollup metrics the funnel record already tracks. */
  metrics: {
    views: number;
    leads: number;
    checkouts: number;
    purchases: number;
    revenueCents: number;
  };
  /** The page spine — only the steps that exist for this funnel kind. */
  pages: {
    key: string;
    label: string;
    /** A short metric line for the step ("34 sales"), '' when untracked. */
    metric: string;
    /** The editor href (the funnel editor owns its pages). */
    href: string;
    /** The public page, when the funnel is live. */
    liveHref?: string;
  }[];
  /** Event → email kit bindings (the funnel's `emailKits`). */
  emails: {
    event: string;
    /** The page key this event fires on (the edge lands there). */
    pageKey: string;
    kitId: string;
    kitName: string;
    kitStatus: string;
    /** How many emails are in the sequence (the "34 emails" line). */
    emailCount: number;
    href: string;
  }[];
}

export interface SystemMapLinkInput {
  id: string;
  /** Which funnel it points at (one of the two is set, or neither). */
  funnelId: string | null;
  optinFunnelId: string | null;
  /** The specific page it lands on, when set (a SALES_FUNNEL_STEPS key). */
  funnelPage: string | null;
  /** The content piece carrying it (the feeder), when set. */
  pieceId: string | null;
  label: string;
  shortCode: string | null;
  clicks: number;
  /** utm_source — where the traffic comes from (instagram, tiktok…). */
  source: string;
}

export interface SystemMapContentInput {
  id: string;
  title: string;
  platform: string;
  format: string;
  /** 'paid' marks an ad; anything else is organic content. */
  kind: string;
  href: string;
  /** The catalog piece id + the offer — the peek renders the real post from them. */
  pieceId?: string;
  offerSlug?: string;
}

export interface SystemMapInput {
  funnels: SystemMapFunnelInput[];
  links: SystemMapLinkInput[];
  content: SystemMapContentInput[];
  /**
   * Content→buyer attribution, keyed by piece id: the leads/sales/revenue the
   * piece produced (the leads carry the piece id in `utm_content` +
   * `purchased` + `purchase_amount_cents`). The stickiest number on the map —
   * "this reel made $1,240." Optional; a piece with no attribution stays quiet.
   */
  contentMetrics?: Record<
    string,
    { leads: number; sales: number; revenueCents: number }
  >;
}

// ---------------------------------------------------------------------------
// The graph
// ---------------------------------------------------------------------------

export type SystemMapLane = 'traffic' | 'links' | 'pages' | 'nurture';

export interface SystemMapNode {
  id: string;
  kind: 'funnel' | 'page' | 'email' | 'link' | 'content';
  lane: SystemMapLane;
  label: string;
  /** The secondary line (the event, the /go/code, the platform). */
  sub: string;
  /** Short metric chips ("1.2K views", "34 sales", "$1.2K"). */
  metrics: string[];
  /** The NodeCard build vocabulary: published/active → built, else draft. */
  status: 'built' | 'draft' | 'pending';
  /** The editor (click-through). */
  href?: string;
  /** The public page (a "view" affordance), when live. */
  liveHref?: string;
  /** The layout, computed by the builder — the page never positions a node. */
  x: number;
  y: number;
  /** Set on a pending-blueprint overlay node: the blueprint it belongs to. */
  blueprintId?: string;
  /** True on the blueprint's anchor node (its funnel) — where approve/reject lives. */
  blueprintAnchor?: boolean;
  /** A content node's catalog piece id + offer — the peek renders the real post. */
  pieceId?: string;
  offerSlug?: string;
  /** A traffic-cluster node ("+N more posts feed this") — the funnel it expands. */
  clusterFunnel?: string;
  clusterCount?: number;
}


export interface SystemMapEdge {
  id: string;
  from: string;
  to: string;
}

export interface SystemMapLaneDef {
  key: SystemMapLane;
  title: string;
  x: number;
}

export interface SystemMap {
  nodes: SystemMapNode[];
  edges: SystemMapEdge[];
  lanes: SystemMapLaneDef[];
  /** The canvas bounds (the page sizes the viewport from these). */
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Layout constants (the geometry the tests pin)
// ---------------------------------------------------------------------------

const LANE_X: Record<SystemMapLane, number> = {
  traffic: 0,
  links: 320,
  pages: 660,
  nurture: 1040,
};
const NODE_W = 240;
const NODE_H = 84;
const NODE_GAP_Y = 22;
const FUNNEL_BAND_GAP = 56;
const LANE_TITLE_Y = 0;
const FIRST_NODE_Y = 56;
/** Many feeders to one page: a funnel shows this many content pieces, then
 *  collapses the overflow into a "+N more" cluster node (expands on click). */
const TRAFFIC_CAP = 3;

const LANE_TITLES: Record<SystemMapLane, string> = {
  traffic: 'Traffic — ads · content · videos',
  links: 'Tracked links',
  pages: 'Pages — the funnel',
  nurture: 'Nurture — email',
};

const money = (cents: number) =>
  cents > 0
    ? (cents / 100).toLocaleString(undefined, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      })
    : '';

const count = (n: number, singular: string, plural = `${singular}s`) =>
  n > 0 ? `${n.toLocaleString()} ${n === 1 ? singular : plural}` : '';

/** The build-status vocabulary: live → built, everything else → draft. */
function statusOf(status: string): SystemMapNode['status'] {
  return status === 'published' || status === 'active' ? 'built' : 'draft';
}

/** The build options — the page drives these client-side (no refetch). */
export interface BuildSystemMapOptions {
  /** When set, only this funnel's subgraph builds (the individual view). */
  focusFunnelId?: string;
  /** A funnel whose id is in the set renders only its funnel node — its
   *  pages/emails/links/content are skipped and the band collapses. Default:
   *  everything expanded (the full view). */
  collapsed?: ReadonlySet<string>;
  /** Pending blueprints to overlay (a blueprint-in-progress), each rendered
   *  as a dashed band below the real systems, materialized only on approve. */
  pendingBlueprints?: SystemBlueprint[];
  /** A funnel whose traffic cluster is expanded (all its content shows, no
   *  "+N more" node). Set when the cluster is clicked. */
  expandTrafficFor?: string;
}

/** A blueprint node's lane, from its kind (the builder owns the lanes). */
function laneForBlueprintKind(kind: BlueprintNodeKind): SystemMapLane {
  if (kind === 'content') return 'traffic';
  if (kind === 'link') return 'links';
  if (kind === 'email') return 'nurture';
  return 'pages'; // funnel + page
}


/**
 * Build + lay out the system map. Funnels each get a horizontal band; within
 * the band the funnel + its pages stack in the Pages lane, its links in
 * Links, the content carrying those links in Traffic, and its email kits in
 * Nurture. Edges: content → link → page, funnel → page, page → email.
 *
 * `opts.focusFunnelId` builds only that funnel's subgraph (the individual
 * view); `opts.collapsed` renders a funnel as just its funnel node.
 */
export function buildSystemMap(
  input: SystemMapInput,
  opts: BuildSystemMapOptions = {},
): SystemMap {
  const nodes: SystemMapNode[] = [];
  const edges: SystemMapEdge[] = [];
  const contentById = new Map(input.content.map((c) => [c.id, c]));

  // The individual view: only the focused funnel's subgraph builds.
  const funnels = opts.focusFunnelId
    ? input.funnels.filter((f) => f.id === opts.focusFunnelId)
    : input.funnels;

  let bandTop = FIRST_NODE_Y;

  for (const funnel of funnels) {
    // A collapsed funnel renders only its funnel node — the band is one card.
    const isCollapsed = opts.collapsed?.has(funnel.id) ?? false;
    // The per-lane y cursor for THIS funnel's band — each lane stacks
    // independently, and the band is as tall as its fullest lane.
    const laneY: Record<SystemMapLane, number> = {
      traffic: bandTop,
      links: bandTop,
      pages: bandTop,
      nurture: bandTop,
    };
    const place = (lane: SystemMapLane): number => {
      const y = laneY[lane];
      laneY[lane] += NODE_H + NODE_GAP_Y;
      return y;
    };

    // — the funnel node (the band's anchor, top of the Pages lane) —
    const funnelNodeId = `funnel:${funnel.id}`;
    const funnelMetrics = [
      count(funnel.metrics.views, 'view'),
      count(funnel.metrics.leads, 'lead'),
      count(funnel.metrics.purchases, 'sale'),
      money(funnel.metrics.revenueCents),
    ].filter(Boolean);
    nodes.push({
      id: funnelNodeId,
      kind: 'funnel',
      lane: 'pages',
      label: funnel.name || funnel.slug,
      sub: funnel.kind === 'sales' ? 'Sales funnel' : 'Optin funnel',
      metrics: funnelMetrics,
      status: statusOf(funnel.status),
      href:
        funnel.kind === 'sales'
          ? `/admin/sales-funnels?funnel=${funnel.id}`
          : `/admin/funnels?funnel=${funnel.id}`,
      liveHref: funnel.status === 'published' ? `/funnel/${funnel.slug}` : undefined,
      x: LANE_X.pages,
      y: place('pages'),
    });

    // A collapsed funnel stops at its funnel node — the pages/emails/links/
    // content (and their edges) only build when it's expanded.
    if (!isCollapsed) {
    // — the page spine (funnel → each page) —
    const pageNodeId = (key: string) => `page:${funnel.id}:${key}`;
    for (const page of funnel.pages) {
      nodes.push({
        id: pageNodeId(page.key),
        kind: 'page',
        lane: 'pages',
        label: page.label,
        sub: funnel.name || funnel.slug,
        metrics: page.metric ? [page.metric] : [],
        status: statusOf(funnel.status),
        href: page.href,
        liveHref: page.liveHref,
        x: LANE_X.pages,
        y: place('pages'),
      });
      edges.push({
        id: `e:${funnelNodeId}->${pageNodeId(page.key)}`,
        from: funnelNodeId,
        to: pageNodeId(page.key),
      });
    }

    // — the email kits (page → kit, on the event's page) —
    for (const email of funnel.emails) {
      const emailNodeId = `email:${funnel.id}:${email.event}`;
      nodes.push({
        id: emailNodeId,
        kind: 'email',
        lane: 'nurture',
        label: email.kitName || 'Email sequence',
        sub: email.event,
        metrics: [count(email.emailCount, 'email')].filter(Boolean),
        status: statusOf(email.kitStatus),
        href: email.href,
        x: LANE_X.nurture,
        y: place('nurture'),
      });
      // The edge lands on the page the event fires on (or the funnel when the
      // page isn't in the spine).
      const target = funnel.pages.some((p) => p.key === email.pageKey)
        ? pageNodeId(email.pageKey)
        : funnelNodeId;
      edges.push({ id: `e:${target}->${emailNodeId}`, from: target, to: emailNodeId });
    }

    // — the tracked links pointing at this funnel (link → page) —
    const funnelLinks = input.links.filter(
      (l) => l.funnelId === funnel.id || l.optinFunnelId === funnel.id,
    );
    // Many feeders to one page: cap the traffic lane at TRAFFIC_CAP content
    // nodes; the overflow collapses into a "+N more" cluster node (unless this
    // funnel's cluster is expanded).
    let trafficAdded = 0;
    let trafficOverflow = 0;
    for (const link of funnelLinks) {
      const linkNodeId = `link:${link.id}`;
      nodes.push({
        id: linkNodeId,
        kind: 'link',
        lane: 'links',
        label: link.label || (link.shortCode ? `/go/${link.shortCode}` : 'Tracked link'),
        sub: link.source || 'link',
        metrics: [count(link.clicks, 'click')].filter(Boolean),
        status: 'built',
        href: '/admin/planner',
        x: LANE_X.links,
        y: place('links'),
      });
      const target =
        link.funnelPage && funnel.pages.some((p) => p.key === link.funnelPage)
          ? pageNodeId(link.funnelPage)
          : funnelNodeId;
      edges.push({ id: `e:${linkNodeId}->${target}`, from: linkNodeId, to: target });

      // — the content carrying this link (content → link): the feeder —
      if (link.pieceId) {
        const piece = contentById.get(link.pieceId);
        if (piece) {
          const contentNodeId = `content:${piece.id}`;
          const alreadyAdded = nodes.some((n) => n.id === contentNodeId);
          // Past the cap, a NEW piece collapses into the cluster node instead
          // of stacking (unless this funnel's cluster is expanded).
          const capped =
            !alreadyAdded &&
            opts.expandTrafficFor !== funnel.id &&
            trafficAdded >= TRAFFIC_CAP;
          if (capped) {
            trafficOverflow += 1;
          } else {
            // A piece can carry several links — one node, several edges.
            if (!alreadyAdded) {
              trafficAdded += 1;
              // Content→buyer attribution: "this reel made $1,240 · 3 sales" —
              // the stickiest number on the map. Quiet when there's none.
              const attr = input.contentMetrics?.[piece.id];
              nodes.push({
                id: contentNodeId,
                kind: 'content',
                lane: 'traffic',
                label: piece.title || 'Untitled',
                sub: [piece.platform, piece.format].filter(Boolean).join(' · '),
                metrics: [
                  piece.kind === 'paid' ? 'ad' : '',
                  attr && attr.sales > 0 ? money(attr.revenueCents) : '',
                  attr && attr.sales > 0 ? count(attr.sales, 'sale') : '',
                  attr && attr.sales === 0 && attr.leads > 0 ? count(attr.leads, 'lead') : '',
                ].filter(Boolean),
                status: 'built',
                href: piece.href,
                pieceId: piece.pieceId,
                offerSlug: piece.offerSlug,
                x: LANE_X.traffic,
                y: place('traffic'),
              });
            }
            edges.push({
              id: `e:${contentNodeId}->${linkNodeId}`,
              from: contentNodeId,
              to: linkNodeId,
            });
          }
        }
      }
    }

    // The traffic cluster: the overflow collapsed into one "+N more" node.
    // Clicking it expands the funnel's traffic (the page's expandTrafficFor).
    if (trafficOverflow > 0) {
      const clusterId = `cluster:${funnel.id}`;
      nodes.push({
        id: clusterId,
        kind: 'content',
        lane: 'traffic',
        label: `+${trafficOverflow} more`,
        sub: 'posts feed this — click to expand',
        metrics: [],
        status: 'built',
        clusterFunnel: funnel.id,
        clusterCount: trafficOverflow,
        x: LANE_X.traffic,
        y: place('traffic'),
      });
      edges.push({ id: `e:${clusterId}->${funnelNodeId}`, from: clusterId, to: funnelNodeId });
    }
    } // !isCollapsed

    // The next funnel's band starts below this one's fullest lane.
    bandTop =
      Math.max(laneY.traffic, laneY.links, laneY.pages, laneY.nurture) +
      FUNNEL_BAND_GAP;
  }

  // ——— The unlinked content ———
  // Every planner piece maps here, linked or not. A piece no tracked link
  // references yet stands alone in the traffic lane (its peek offers "create
  // a link") — this is what makes the social posts actually show on the map,
  // instead of only the ones already wired in.
  const unlinked = input.content.filter(
    (c) => !nodes.some((n) => n.id === `content:${c.id}`),
  );
  if (unlinked.length > 0) {
    let y = bandTop;
    for (const piece of unlinked) {
      const attr = input.contentMetrics?.[piece.id];
      nodes.push({
        id: `content:${piece.id}`,
        kind: 'content',
        lane: 'traffic',
        label: piece.title || 'Untitled',
        sub: [piece.platform, piece.format].filter(Boolean).join(' · '),
        metrics: [
          piece.kind === 'paid' ? 'ad' : '',
          attr && attr.sales > 0 ? money(attr.revenueCents) : '',
          attr && attr.sales > 0 ? count(attr.sales, 'sale') : '',
          attr && attr.sales === 0 && attr.leads > 0 ? count(attr.leads, 'lead') : '',
          'not linked',
        ].filter(Boolean),
        status: 'built',
        href: piece.href,
        pieceId: piece.pieceId,
        offerSlug: piece.offerSlug,
        x: LANE_X.traffic,
        y,
      });
      y += NODE_H + NODE_GAP_Y;
    }
    bandTop = y + FUNNEL_BAND_GAP;
  }

  // ——— The pending blueprint overlay ———
  // Each proposed blueprint renders as a band below the real systems, its
  // nodes 'pending' (the page draws them dashed) until approve materializes
  // them. A blueprint is a NEW system, so it overlays regardless of the
  // focus/collapse view; the variant-of edge to its parent funnel only draws
  // when the parent is on the canvas.
  for (const bp of opts.pendingBlueprints ?? []) {
    const bpLaneY: Record<SystemMapLane, number> = {
      traffic: bandTop,
      links: bandTop,
      pages: bandTop,
      nurture: bandTop,
    };
    const placeBp = (lane: SystemMapLane): number => {
      const y = bpLaneY[lane];
      bpLaneY[lane] += NODE_H + NODE_GAP_Y;
      return y;
    };
    const bpNodeId = (key: string) => `blueprint:${bp.id}:${key}`;
    // The anchor (the funnel node, else the first) carries approve/reject.
    const anchorKey =
      bp.nodes.find((n) => n.kind === 'funnel')?.key ?? bp.nodes[0]?.key;
    for (const n of bp.nodes) {
      const lane = laneForBlueprintKind(n.kind);
      nodes.push({
        id: bpNodeId(n.key),
        kind: n.kind,
        lane,
        label: n.label,
        sub: n.sub,
        metrics: n.metrics,
        status: 'pending',
        blueprintId: bp.id,
        blueprintAnchor: n.key === anchorKey,
        x: LANE_X[lane],
        y: placeBp(lane),
      });
    }
    for (const n of bp.nodes) {
      for (const to of n.linksTo) {
        edges.push({
          id: `e:${bpNodeId(n.key)}->${bpNodeId(to)}`,
          from: bpNodeId(n.key),
          to: bpNodeId(to),
        });
      }
    }
    // The variant-of edge: a clone/optimization descends from its parent.
    if (bp.source.parentFunnelId && anchorKey) {
      const parentId = `funnel:${bp.source.parentFunnelId}`;
      if (nodes.some((n) => n.id === parentId)) {
        edges.push({
          id: `e:${parentId}->${bpNodeId(anchorKey)}`,
          from: parentId,
          to: bpNodeId(anchorKey),
        });
      }
    }
    bandTop =
      Math.max(bpLaneY.traffic, bpLaneY.links, bpLaneY.pages, bpLaneY.nurture) +
      FUNNEL_BAND_GAP;
  }

  const lanes: SystemMapLaneDef[] = (
    Object.keys(LANE_X) as SystemMapLane[]
  ).map((key) => ({ key, title: LANE_TITLES[key], x: LANE_X[key] }));

  const maxX = Math.max(...lanes.map((l) => l.x)) + NODE_W + 40;
  const maxY =
    nodes.length > 0 ? Math.max(...nodes.map((n) => n.y)) + NODE_H + 40 : 400;

  return { nodes, edges, lanes, width: maxX, height: maxY };
}
