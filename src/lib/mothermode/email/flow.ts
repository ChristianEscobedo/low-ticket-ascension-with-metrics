/**
 * Email sequence → flow graph derivation (pure, unit-testable, zero deps).
 *
 * The Email Marketing Kit stores a sequence as a flat, ordered `EmailMessage[]`.
 * A branching tree is already *implicit* in that data:
 *
 *   - The TRUNK is every email with `branch === 'always'`, in array order.
 *   - Any email with `branch !== 'always'` is a CONDITIONAL child: it forks from
 *     `parentId` (the earlier email its condition is evaluated against) or, when
 *     `parentId` is null, from the immediately-preceding trunk email.
 *
 * This module turns that implicit tree into an explicit `{ nodes, edges }` graph
 * plus deterministic x/y positions computed by a small layered layout. Keeping
 * layout here (rather than delegating to dagre/elkjs in the view) means the whole
 * derivation is pure and testable without a DOM or an external layout library —
 * the React Flow panel just renders the positions this function produces.
 *
 * Backward-compat: old kits with every email on the linear trunk render as a
 * straight vertical spine; missing/branch fields are treated defensively.
 */
import type {
  EmailBranchCondition,
  EmailMessage,
  EmailRole,
  EmailSequence,
} from './types';
import {
  EMAIL_TRIGGER_LABELS,
  emailTriggerCategory,
  resolveTriggerLocationLabel,
  resolveTriggerBindingLabel,
  toEmailTriggerEvent,
  type EmailTriggerCategory,
  type EmailTriggerEvent,
} from './triggers';



// ---------------------------------------------------------------------------
// Graph shapes
// ---------------------------------------------------------------------------

/**
 * Node kinds:
 *   - 'trigger': the single entry node representing the funnel event that
 *     enrolls a subscriber (Phase 2). Always id 'trigger'.
 *   - 'email':   a stored EmailMessage.
 *   - 'split':   one A/B variant of an email (Phase 2). Emitted only when an
 *     email has an enabled abTest with >= 2 variants.
 */
export type FlowNodeKind = 'trigger' | 'email' | 'split';
export type FlowEdgeKind = 'trunk' | 'branch' | 'trigger' | 'split';

/** The stable id of the single entry-trigger node. */
export const FLOW_TRIGGER_ID = 'trigger';

export interface FlowNode {
  /** Node id — identical to the email id for email nodes. */
  id: string;
  /** Owning email id (empty for the trigger node; the parent email for splits). */
  emailId: string;
  /** Short display label: "role · subject". */
  label: string;
  role: EmailRole;
  subject: string;
  sendOffset: string;
  branch: EmailBranchCondition;
  /** Whether the email carries at least one attached image. */
  hasImages: boolean;
  kind: FlowNodeKind;
  /** For trigger nodes: the funnel event. Undefined otherwise. */
  trigger?: EmailTriggerEvent;
  /** For trigger nodes: the category ('funnel' | 'content') of the trigger. */
  triggerCategory?: EmailTriggerCategory;
  /**
   * For trigger nodes: a short "where it fires" label — the funnel page name
   * (e.g. "Checkout page") or the content stage (e.g. "Content published"),
   * honoring any admin funnel-page override in the sequence's triggerConfig.
   */
  triggerLocation?: string;
  /**
   * For trigger nodes: the concrete BINDING the admin mapped this trigger to —
   * e.g. "Offer: 7-day-challenge" or "Content: launch-reel". Empty when nothing
   * is bound yet.
   */
  triggerBinding?: string;


  /** For email nodes with an active A/B test: number of variants (>= 2). */
  abVariantCount?: number;
  /** For split nodes: this variant's recipient weight (0–100). */
  weight?: number;
  /** Layout position (assigned by layoutFlowGraph). */
  x: number;
  y: number;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  /** Branch condition (e.g. "opened") for branch edges; '' for trunk edges. */
  label: string;
  kind: FlowEdgeKind;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

// ---------------------------------------------------------------------------
// Layout constants (exported so the view can size nodes to match)
// ---------------------------------------------------------------------------

export const FLOW_NODE_WIDTH = 240;
export const FLOW_NODE_HEIGHT = 104;
const X_GAP = 56;
const Y_GAP = 64;

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

/** Short node label combining the role and (truncated) subject. */
export function flowNodeLabel(email: Pick<EmailMessage, 'role' | 'subject'>): string {
  const subject = (email.subject || '').trim();
  const shown = subject.length > 48 ? `${subject.slice(0, 47)}…` : subject;
  return shown ? `${email.role} · ${shown}` : email.role;
}

/**
 * Edge label for a conditional branch. Trunk edges have no label. The raw
 * condition is returned (e.g. "opened", "not-purchased") so the value stays
 * deterministic for tests; the view humanizes it for display.
 */
function branchEdgeLabel(branch: EmailBranchCondition): string {
  return branch === 'always' ? '' : branch;
}

// ---------------------------------------------------------------------------
// Derivation
// ---------------------------------------------------------------------------

/**
 * Derive an explicit node/edge graph (with positions) from a stored sequence.
 * Pure: same input always yields the same graph.
 */
export function sequenceToFlowGraph(sequence: EmailSequence | null | undefined): FlowGraph {
  const emails: EmailMessage[] = Array.isArray(sequence?.emails) ? sequence!.emails : [];
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  const ids = new Set(emails.map((e) => e.id));

  // Entry TRIGGER node (Phase 2). Emitted only when the sequence has at least
  // one email, so the canvas reads top-down as "event → first email → …" while
  // an empty sequence stays an empty graph (backward-compat). Defaults to
  // 'optin' via the normalizer.
  const trigger = toEmailTriggerEvent(sequence?.trigger);
  const triggerConfig = sequence?.triggerConfig;
  if (emails.length > 0) {
    const triggerBinding = resolveTriggerBindingLabel(trigger, triggerConfig);
    nodes.push({
      id: FLOW_TRIGGER_ID,
      emailId: '',
      label: `Trigger · ${EMAIL_TRIGGER_LABELS[trigger]}`,
      role: 'welcome',
      subject: '',
      sendOffset: '',
      branch: 'always',
      hasImages: false,
      kind: 'trigger',
      trigger,
      triggerCategory: emailTriggerCategory(trigger),
      triggerLocation: resolveTriggerLocationLabel(trigger, triggerConfig),
      ...(triggerBinding ? { triggerBinding } : {}),
      x: 0,
      y: 0,
    });
  }




  // The last trunk email seen so far — the default parent for a conditional
  // email whose parentId is null (or points at a missing email).
  let lastTrunkId: string | null = null;
  // Whether we've linked the trigger to the sequence's first email yet.
  let linkedTrigger = false;

  for (const email of emails) {
    const activeAb =
      email.abTest && email.abTest.enabled && email.abTest.variants.length >= 2
        ? email.abTest
        : undefined;

    nodes.push({
      id: email.id,
      emailId: email.id,
      label: flowNodeLabel(email),
      role: email.role,
      subject: email.subject || '',
      sendOffset: email.sendOffset || '',
      branch: email.branch,
      hasImages: Array.isArray(email.images) && email.images.length > 0,
      kind: 'email',
      ...(activeAb ? { abVariantCount: activeAb.variants.length } : {}),
      x: 0,
      y: 0,
    });

    if (email.branch === 'always') {
      // Trunk email: chain it after the previous trunk email.
      if (lastTrunkId) {
        edges.push({
          id: `e-${lastTrunkId}-${email.id}`,
          source: lastTrunkId,
          target: email.id,
          label: '',
          kind: 'trunk',
        });
      }
      lastTrunkId = email.id;
    } else {
      // Conditional email: fork from its explicit parent, else the last trunk.
      const parentId =
        email.parentId && ids.has(email.parentId) ? email.parentId : lastTrunkId;
      if (parentId) {
        edges.push({
          id: `e-${parentId}-${email.id}`,
          source: parentId,
          target: email.id,
          label: branchEdgeLabel(email.branch),
          kind: 'branch',
        });
      }
    }

    // Link the trigger to the FIRST email of the sequence (whatever it is).
    if (!linkedTrigger) {
      edges.push({
        id: `e-${FLOW_TRIGGER_ID}-${email.id}`,
        source: FLOW_TRIGGER_ID,
        target: email.id,
        label: '',
        kind: 'trigger',
      });
      linkedTrigger = true;
    }

    // A/B SPLIT: emit one split node per variant, fanning out from the email.
    if (activeAb) {
      activeAb.variants.forEach((variant, i) => {
        const splitId = `${email.id}::${variant.id || `v${i}`}`;
        nodes.push({
          id: splitId,
          emailId: email.id,
          label: `${variant.label || `Variant ${i + 1}`}${
            variant.subject ? ` · ${variant.subject}` : ''
          }`,
          role: email.role,
          subject: variant.subject || '',
          sendOffset: email.sendOffset || '',
          branch: 'always',
          hasImages: false,
          kind: 'split',
          weight: variant.weight,
          x: 0,
          y: 0,
        });
        edges.push({
          id: `e-${email.id}-${splitId}`,
          source: email.id,
          target: splitId,
          label: `${Math.round(variant.weight)}%`,
          kind: 'split',
        });
      });
    }
  }

  return layoutFlowGraph({ nodes, edges });
}


// ---------------------------------------------------------------------------
// Layered layout (pure)
// ---------------------------------------------------------------------------

/**
 * Assign deterministic x/y positions with a simple layered (Sugiyama-lite)
 * layout: a node's RANK is one deeper than its deepest parent (roots at rank 0),
 * so the trunk forms a vertical spine and branches sit beside the sibling they
 * diverge alongside. Nodes sharing a rank are spread horizontally in input
 * order. Cycles (which the editor cannot create, but JSONB might) are guarded.
 */
export function layoutFlowGraph(graph: FlowGraph): FlowGraph {
  const { nodes, edges } = graph;
  if (nodes.length === 0) return { nodes: [], edges };

  const incoming = new Map<string, string[]>();
  for (const n of nodes) incoming.set(n.id, []);
  for (const e of edges) {
    if (incoming.has(e.target)) incoming.get(e.target)!.push(e.source);
  }

  const rankCache = new Map<string, number>();
  const visiting = new Set<string>();
  function rankOf(id: string): number {
    const cached = rankCache.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0; // cycle guard
    visiting.add(id);
    const parents = incoming.get(id) ?? [];
    const rank = parents.length === 0 ? 0 : Math.max(...parents.map(rankOf)) + 1;
    visiting.delete(id);
    rankCache.set(id, rank);
    return rank;
  }

  // Group nodes by rank, preserving input order within each rank.
  const byRank = new Map<number, FlowNode[]>();
  for (const n of nodes) {
    const rank = rankOf(n.id);
    if (!byRank.has(rank)) byRank.set(rank, []);
    byRank.get(rank)!.push(n);
  }

  const positioned = nodes.map((n) => ({ ...n }));
  const posById = new Map(positioned.map((n) => [n.id, n]));
  byRank.forEach((group, rank) => {
    group.forEach((n: FlowNode, i: number) => {
      const node = posById.get(n.id);
      if (!node) return;
      node.x = i * (FLOW_NODE_WIDTH + X_GAP);
      node.y = rank * (FLOW_NODE_HEIGHT + Y_GAP);
    });
  });

  return { nodes: positioned, edges };

}
