/**
 * A visual map of the funnel: pages, the decisions between them, the emails
 * hung off each event, and the attention decay from ad click to upsell path.
 *
 * A funnel is a timeline of decisions. Drawing it is how you see that the
 * number of decisions, not the number of products, is what sets AOV — and
 * where the emails actually attach.
 */

import type { AscensionRung, DownsellPlacement } from './ascension';

export type FunnelNodeKind =
  | 'ad'
  | 'advertorial'
  | 'optin'
  | 'vsl'
  | 'sales'
  | 'checkout'
  | 'orderBump'
  | 'upsell'
  | 'downsell'
  | 'success'
  | 'access'
  | 'email';

export type FunnelNode = {
  id: string;
  kind: FunnelNodeKind;
  label: string;
  /** Price of the decision at this node, when it is a paid step. */
  price?: number;
  /** Projected share of visitors reaching this node, 0-1, when modelled. */
  reach?: number;
  /** Event name other systems (email triggers) can bind to. */
  event?: string;
};

export type FunnelEdge = {
  from: string;
  to: string;
  /** 'yes' / 'no' for decision branches, otherwise a plain flow. */
  branch?: 'yes' | 'no';
  label?: string;
};

export type FunnelMap = {
  nodes: FunnelNode[];
  edges: FunnelEdge[];
};

export type FunnelMapInput = {
  frontEndName: string;
  frontEndPrice: number;
  rungs: AscensionRung[];
  downsellPlacement?: DownsellPlacement;
  /** Traffic shape ahead of the offer. Omit any stage you do not run. */
  traffic?: { ad?: boolean; advertorial?: boolean; optin?: boolean; vsl?: boolean };
  orderBump?: { name: string; price: number };
  /** Emails keyed to the event that fires them. */
  emails?: { name: string; event: string; delayHours?: number }[];
};

const STAGE_ORDER = ['frontEnd', 'oto1', 'oto2', 'oto3'] as const;

const sortRungs = (rungs: AscensionRung[]): AscensionRung[] =>
  [...rungs].sort(
    (a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage),
  );

/**
 * Attention decay along the pre-sale path. These are the rough shares that
 * survive each step; the more attention you hold, the more you can sell.
 */
export const ATTENTION_DECAY: Record<string, number> = {
  ad: 1,
  advertorial: 0.2,
  optin: 0.35,
  vsl: 0.2,
  sales: 0.2,
  checkout: 0.25,
};

export function buildFunnelMap(input: FunnelMapInput): FunnelMap {
  const nodes: FunnelNode[] = [];
  const edges: FunnelEdge[] = [];
  const traffic = input.traffic ?? {};
  const placement = input.downsellPlacement ?? 'none';

  let previousId: string | null = null;
  let reach = 1;

  const push = (node: FunnelNode) => {
    nodes.push(node);
    if (previousId) edges.push({ from: previousId, to: node.id });
    previousId = node.id;
  };

  if (traffic.ad) {
    push({ id: 'ad', kind: 'ad', label: 'Ad click', reach: 1 });
  }
  if (traffic.advertorial) {
    reach *= ATTENTION_DECAY.advertorial;
    push({ id: 'advertorial', kind: 'advertorial', label: 'Advertorial', reach });
  }
  if (traffic.optin) {
    reach *= ATTENTION_DECAY.optin;
    push({
      id: 'optin',
      kind: 'optin',
      label: 'Opt-in',
      reach,
      event: 'optin.captured',
    });
  }
  if (traffic.vsl) {
    reach *= ATTENTION_DECAY.vsl;
    push({ id: 'vsl', kind: 'vsl', label: 'VSL', reach });
  }

  reach *= ATTENTION_DECAY.sales;
  push({
    id: 'sales',
    kind: 'sales',
    label: input.frontEndName || 'Sales page',
    price: input.frontEndPrice,
    reach,
  });

  reach *= ATTENTION_DECAY.checkout;
  push({
    id: 'checkout',
    kind: 'checkout',
    label: 'Checkout',
    price: input.frontEndPrice,
    reach,
    event: 'funnel.purchase',
  });

  if (input.orderBump) {
    nodes.push({
      id: 'bump',
      kind: 'orderBump',
      label: input.orderBump.name,
      price: input.orderBump.price,
    });
    edges.push({ from: 'checkout', to: 'bump', label: 'order bump' });
  }

  const upsells = sortRungs(input.rungs).filter((r) => r.stage !== 'frontEnd');
  const deferred: { id: string; rung: AscensionRung }[] = [];

  upsells.forEach((rung, i) => {
    const id = `upsell-${i + 1}`;
    nodes.push({
      id,
      kind: 'upsell',
      label: rung.name || rung.outcome,
      price: rung.price,
      event: `funnel.upsell${i + 1}.purchase`,
    });
    if (previousId) edges.push({ from: previousId, to: id, branch: 'yes' });
    previousId = id;

    if (rung.downsell && placement === 'inline') {
      const dsId = `downsell-${i + 1}`;
      nodes.push({
        id: dsId,
        kind: 'downsell',
        label: rung.downsell.name,
        price: rung.downsell.price,
        event: `funnel.downsell${i + 1}.purchase`,
      });
      edges.push({ from: id, to: dsId, branch: 'no' });
      previousId = dsId;
    } else if (rung.downsell && placement === 'after') {
      deferred.push({ id, rung });
    }
  });

  deferred.forEach(({ rung }, i) => {
    const dsId = `downsell-${i + 1}`;
    nodes.push({
      id: dsId,
      kind: 'downsell',
      label: rung.downsell!.name,
      price: rung.downsell!.price,
      event: `funnel.downsell${i + 1}.purchase`,
    });
    if (previousId) edges.push({ from: previousId, to: dsId, branch: 'no' });
    previousId = dsId;
  });

  push({ id: 'success', kind: 'success', label: 'Success', event: 'funnel.success' });
  push({ id: 'access', kind: 'access', label: 'Access / delivery', event: 'funnel.access' });

  // Emails hang off events rather than off pages, so a page can be renamed or
  // reordered without orphaning its sequence.
  const byEvent = new Map<string, string>();
  nodes.forEach((n) => {
    if (n.event) byEvent.set(n.event, n.id);
  });

  (input.emails ?? []).forEach((email, i) => {
    const id = `email-${i + 1}`;
    const delay = email.delayHours ? ` (+${email.delayHours}h)` : '';
    nodes.push({ id, kind: 'email', label: `${email.name}${delay}`, event: email.event });
    const anchor = byEvent.get(email.event);
    if (anchor) edges.push({ from: anchor, to: id, label: email.event });
  });

  return { nodes, edges };
}

/** Emails whose trigger event does not exist anywhere in the map. */
export function orphanedEmails(map: FunnelMap): FunnelNode[] {
  const pageEvents = new Set(
    map.nodes.filter((n) => n.kind !== 'email' && n.event).map((n) => n.event as string),
  );
  return map.nodes.filter((n) => n.kind === 'email' && !pageEvents.has(n.event ?? ''));
}

const MERMAID_SHAPE: Partial<Record<FunnelNodeKind, [string, string]>> = {
  upsell: ['{{', '}}'],
  downsell: ['{{', '}}'],
  email: ['[/', '/]'],
  checkout: ['[(', ')]'],
};

const escapeLabel = (value: string): string => value.replace(/["\n]/g, ' ').trim();

/** Mermaid flowchart source. Renders in GitHub, Notion, and most doc tools. */
export function toMermaid(map: FunnelMap): string {
  const lines = ['flowchart TD'];
  map.nodes.forEach((node) => {
    const [open, close] = MERMAID_SHAPE[node.kind] ?? ['[', ']'];
    const price = node.price ? ` $${node.price}` : '';
    lines.push(`  ${node.id}${open}"${escapeLabel(node.label)}${price}"${close}`);
  });
  map.edges.forEach((edge) => {
    const label = edge.branch ?? edge.label;
    lines.push(
      label
        ? `  ${edge.from} -->|${escapeLabel(label)}| ${edge.to}`
        : `  ${edge.from} --> ${edge.to}`,
    );
  });
  return lines.join('\n');
}

/** Plain-text map, for terminals and for docs that cannot render Mermaid. */
export function toAsciiMap(map: FunnelMap): string {
  const emails = map.nodes.filter((n) => n.kind === 'email');
  const pages = map.nodes.filter((n) => n.kind !== 'email');
  return pages
    .map((node) => {
      const price = node.price ? ` — $${node.price}` : '';
      const reach =
        node.reach !== undefined ? ` [${Math.round(node.reach * 1000) / 10}%]` : '';
      const hung = emails
        .filter((e) => e.event === node.event)
        .map((e) => `\n      ✉ ${e.label}`)
        .join('');
      return `  ${node.kind.padEnd(11)} ${node.label}${price}${reach}${hung}`;
    })
    .join('\n    |\n');
}


