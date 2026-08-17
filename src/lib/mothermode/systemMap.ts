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
}

export interface SystemMapInput {
  funnels: SystemMapFunnelInput[];
  links: SystemMapLinkInput[];
  content: SystemMapContentInput[];
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
          // A piece can carry several links — one node, several edges.
          if (!nodes.some((n) => n.id === contentNodeId)) {
            nodes.push({
              id: contentNodeId,
              kind: 'content',
              lane: 'traffic',
              label: piece.title || 'Untitled',
              sub: [piece.platform, piece.format].filter(Boolean).join(' · '),
              metrics: [piece.kind === 'paid' ? 'ad' : ''].filter(Boolean),
              status: 'built',
              href: piece.href,
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
    } // !isCollapsed

    // The next funnel's band starts below this one's fullest lane.
    bandTop =
      Math.max(laneY.traffic, laneY.links, laneY.pages, laneY.nurture) +
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
