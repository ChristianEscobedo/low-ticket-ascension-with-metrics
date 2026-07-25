/**
 * Flow graph overlay computations (pure, unit-testable, zero deps).
 *
 * Phase 5 expansion. The base `flow.ts` module derives the structural graph
 * (nodes + edges + positions) from a stored sequence. This module enriches
 * that graph with analytics data — subscriber counts, drop-off heat tints,
 * performance colors, and A/B winner badges — so the flow dashboard can
 * render a living canvas without any display math in the component.
 *
 * Every function is pure and zero-safe: empty inputs → empty/neutral
 * overlays. The dashboard degrades to the structural graph when no
 * analytics data exists.
 */
import type { FlowGraph } from './flow';
import type { SequenceStats } from './analytics';
import type { EnrollmentData, EmailDropoff } from './enrollment';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Per-node overlay data for the flow dashboard. */
export interface NodeOverlay {
  /** Node id (matches FlowNode.id). */
  nodeId: string;
  /** Subscribers currently at this email (from enrollment data). */
  activeCount: number;
  /** Subscribers who were sent this email (from stats). */
  sentCount: number;
  /** Open rate [0,1] for this email, or 0 when no data. */
  openRate: number;
  /** CTR [0,1] for this email, or 0 when no data. */
  ctr: number;
  /** Drop-off rate [0,1] for this email, or 0 when no data. */
  dropoffRate: number;
  /** Heat tint: 'good' | 'ok' | 'bad' | 'neutral' based on open rate. */
  heatTint: HeatTint;
  /** Whether this node has any real analytics data. */
  hasData: boolean;
}

/** Heat tint for node coloring. */
export type HeatTint = 'good' | 'ok' | 'bad' | 'neutral';

/** Per-edge overlay data for the flow dashboard. */
export interface EdgeOverlay {
  /** Edge id (matches FlowEdge.id). */
  edgeId: string;
  /** Subscriber volume flowing through this edge (for thickness). */
  volume: number;
  /** Conversion rate [0,1] from source to target, or 0 when no data. */
  conversionRate: number;
  /** Normalized thickness [0,1] relative to the max-volume edge. */
  thickness: number;
}

/** Complete overlay for the flow dashboard. */
export interface FlowOverlay {
  nodes: Map<string, NodeOverlay>;
  edges: Map<string, EdgeOverlay>;
  /** Whether any analytics data exists at all. */
  hasData: boolean;
}

// ---------------------------------------------------------------------------
// Thresholds (tunable)
// ---------------------------------------------------------------------------

/** Open rate thresholds for heat tints. */
export const HEAT_TINT_THRESHOLDS = {
  good: 0.4, // >= 40% open = good (green)
  ok: 0.2, // >= 20% open = ok (amber)
  // < 20% = bad (red)
} as const;

// ---------------------------------------------------------------------------
// Node overlay
// ---------------------------------------------------------------------------

/**
 * Compute per-node overlay data from stats + enrollment data.
 *
 * Pure and zero-safe: empty inputs → empty overlay.
 */
export function computeNodeOverlays(
  graph: FlowGraph,
  stats: SequenceStats | null | undefined,
  dropoff: EmailDropoff[] | null | undefined,
  enrollment: EnrollmentData | null | undefined,
): Map<string, NodeOverlay> {
  const overlays = new Map<string, NodeOverlay>();

  // Build lookup maps.
  const dropoffMap = new Map<string, EmailDropoff>();
  if (dropoff) {
    for (const d of dropoff) dropoffMap.set(d.emailId, d);
  }

  // Count active subscribers per email from enrollment data.
  const activeByEmail = new Map<string, number>();
  if (enrollment && Array.isArray(enrollment.enrollments)) {
    for (const e of enrollment.enrollments) {
      if (
        e.emailId &&
        e.status !== 'completed' &&
        e.status !== 'dropped' &&
        e.status !== 'unsubscribed'
      ) {
        activeByEmail.set(e.emailId, (activeByEmail.get(e.emailId) ?? 0) + 1);
      }
    }
  }

  for (const node of graph.nodes) {
    if (node.kind !== 'email') {
      // Trigger and split nodes get a neutral overlay.
      overlays.set(node.id, {
        nodeId: node.id,
        activeCount: 0,
        sentCount: 0,
        openRate: 0,
        ctr: 0,
        dropoffRate: 0,
        heatTint: 'neutral',
        hasData: false,
      });
      continue;
    }

    const emailId = node.emailId;
    const stat = stats?.byEmail?.[emailId];
    const drop = dropoffMap.get(emailId);
    const activeCount = activeByEmail.get(emailId) ?? 0;
    const sentCount = stat?.sent ?? 0;
    const openRate = stat ? (stat.sent > 0 ? stat.opened / stat.sent : 0) : 0;
    const ctr = stat ? (stat.sent > 0 ? stat.clicked / stat.sent : 0) : 0;
    const dropoffRate = drop?.dropoffRate ?? 0;
    const hasData = sentCount > 0;

    overlays.set(node.id, {
      nodeId: node.id,
      activeCount,
      sentCount,
      openRate: clamp01(openRate),
      ctr: clamp01(ctr),
      dropoffRate: clamp01(dropoffRate),
      heatTint: hasData ? heatTintForOpenRate(openRate) : 'neutral',
      hasData,
    });
  }

  return overlays;
}

// ---------------------------------------------------------------------------
// Edge overlay
// ---------------------------------------------------------------------------

/**
 * Compute per-edge overlay data from stats.
 *
 * Edge volume = the sent count of the target email (subscribers who
 * progressed to it). Thickness is normalized to the max volume.
 *
 * Pure and zero-safe: empty inputs → empty overlay.
 */
export function computeEdgeOverlays(
  graph: FlowGraph,
  stats: SequenceStats | null | undefined,
): Map<string, EdgeOverlay> {
  const overlays = new Map<string, EdgeOverlay>();

  // First pass: compute raw volumes.
  const rawVolumes = new Map<string, number>();
  let maxVolume = 0;

  for (const edge of graph.edges) {
    const targetStat = stats?.byEmail?.[edge.target];
    const volume = targetStat?.sent ?? 0;
    rawVolumes.set(edge.id, volume);
    if (volume > maxVolume) maxVolume = volume;
  }

  // Second pass: compute normalized thickness + conversion rate.
  for (const edge of graph.edges) {
    const volume = rawVolumes.get(edge.id) ?? 0;
    const sourceStat = stats?.byEmail?.[edge.source];
    const targetStat = stats?.byEmail?.[edge.target];
    const sourceSent = sourceStat?.sent ?? 0;
    const targetSent = targetStat?.sent ?? 0;
    const conversionRate = sourceSent > 0 ? clamp01(targetSent / sourceSent) : 0;
    const thickness = maxVolume > 0 ? volume / maxVolume : 0;

    overlays.set(edge.id, {
      edgeId: edge.id,
      volume,
      conversionRate,
      thickness: clamp01(thickness),
    });
  }

  return overlays;
}

// ---------------------------------------------------------------------------
// Complete overlay
// ---------------------------------------------------------------------------

/**
 * Compute the complete flow overlay (nodes + edges) from all data sources.
 *
 * Pure and zero-safe: empty inputs → empty overlay with `hasData: false`.
 */
export function computeFlowOverlay(
  graph: FlowGraph,
  stats: SequenceStats | null | undefined,
  dropoff: EmailDropoff[] | null | undefined,
  enrollment: EnrollmentData | null | undefined,
): FlowOverlay {
  const nodes = computeNodeOverlays(graph, stats, dropoff, enrollment);
  const edges = computeEdgeOverlays(graph, stats);

  // Determine if any data exists.
  let hasData = false;
  for (const node of Array.from(nodes.values())) {
    if (node.hasData) {
      hasData = true;
      break;
    }
  }

  return { nodes, edges, hasData };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Determine the heat tint for an open rate. */
export function heatTintForOpenRate(openRate: number): HeatTint {
  if (openRate >= HEAT_TINT_THRESHOLDS.good) return 'good';
  if (openRate >= HEAT_TINT_THRESHOLDS.ok) return 'ok';
  return 'bad';
}

/** Clamp a number to [0, 1]. */
function clamp01(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return n > 1 ? 1 : n;
}