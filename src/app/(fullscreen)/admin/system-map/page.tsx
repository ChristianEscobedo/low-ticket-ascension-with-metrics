'use client';

/**
 * /admin/system-map — the whole money system as a pannable node graph.
 *
 * Entered from the Asset Hub's Systems tab ("System map →"). The API returns
 * the graph's INPUT (`/api/admin/system-map` → the normalized records); the
 * page builds + lays out the graph CLIENT-SIDE via `buildSystemMap` (the
 * builder is pure, no server imports) — so the two focus/depth controls are
 * instant and refetch-free:
 *
 *   - **Focus** — `?funnel=<id>` (or a funnel node's focus button) opens just
 *     that system on the canvas; "← All systems" returns to the full view.
 *   - **Expand / collapse** — a funnel node's chevron collapses it to just the
 *     funnel card, or expands it to reveal its pages, emails, links, and the
 *     content feeding it. Default: everything expanded (the full view).
 *
 * Every node carries its metrics and opens in its proper editor on click.
 * v1 is read-only + click-through; rewiring connections on the canvas is the
 * follow-up, not this pass.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type NodeProps,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ArrowLeftCircle,
  Loader2,
  ExternalLink,
  CheckCircle2,
  PauseCircle,
  CircleDashed,
  ChevronDown,
  ChevronRight,
  Crosshair,
  Plus,
  Check,
  X,
  Layers,
  FileText,
  Mail,
  Link2,
  Clapperboard,
} from 'lucide-react';
import {
  buildSystemMap,
  type SystemMap,
  type SystemMapInput,
  type SystemMapNode,
} from '@/lib/mothermode/systemMap';
import {
  analyzeSystemMap,
  EDGE_HEALTH_COLOR,
  type SystemMapAnalysis,
} from '@/lib/mothermode/systemMapAnalysis';
import type { SystemBlueprint } from '@/lib/mothermode/blueprint';
import type { SystemMapLeak } from '@/lib/mothermode/systemMapAnalysis';
import BlueprintCreatePanel from './BlueprintCreatePanel';
import NodePeekPanel from './NodePeekPanel';
import MapChatDock from './MapChatDock';
import { PlatformIcon } from '@/components/mothermode/content/PlatformIcon';
import { canonicalPlatform } from '@/lib/mothermode/planner/platformGlyph';

// ---------------------------------------------------------------------------
// The UI context — the page provides the focus/collapse + blueprint + inspect
// handlers, the node card consumes them (keeps the React Flow node data clean
// of callbacks).
// ---------------------------------------------------------------------------

const SystemMapUiContext = createContext<{
  collapsed: ReadonlySet<string>;
  toggleCollapse: (funnelId: string) => void;
  focusFunnel: (funnelId: string) => void;
  focusedId: string | null;
  /** Approve / reject a pending blueprint (the gated materialization). */
  approveBlueprint: (blueprintId: string) => void;
  rejectBlueprint: (blueprintId: string) => void;
  /** True while a blueprint approve/reject is in flight. */
  blueprintBusy: boolean;
  /** Open a node's peek panel (the "expand to see it" read). */
  inspectNode: (node: SystemMapNode) => void;
  /** Expand a funnel's traffic cluster (the "+N more" node clicked). */
  expandTraffic: (funnelId: string) => void;
}>({
  collapsed: new Set(),
  toggleCollapse: () => {},
  focusFunnel: () => {},
  focusedId: null,
  approveBlueprint: () => {},
  rejectBlueprint: () => {},
  blueprintBusy: false,
  inspectNode: () => {},
  expandTraffic: () => {},
});



// ---------------------------------------------------------------------------
// The node card — the house dark palette + the NodeCard status vocabulary
// ---------------------------------------------------------------------------

const KIND_ACCENT: Record<SystemMapNode['kind'], string> = {
  funnel: 'border-brass/60',
  page: 'border-bone/25',
  email: 'border-violet-400/40',
  link: 'border-sky-400/40',
  content: 'border-emerald-400/40',
};

const STATUS_GLYPH = {
  built: <CheckCircle2 className="h-3 w-3 text-emerald-300" />,
  draft: <PauseCircle className="h-3 w-3 text-amber-300" />,
  pending: <CircleDashed className="h-3 w-3 text-bone/40" />,
} as const;

// The kind icon tile — each node type gets a distinct icon in a tinted tile,
// so the map reads at a glance (funnel / page / email / link / content).
const KIND_ICON: Record<SystemMapNode['kind'], React.ReactNode> = {
  funnel: <Layers className="h-3.5 w-3.5" />,
  page: <FileText className="h-3.5 w-3.5" />,
  email: <Mail className="h-3.5 w-3.5" />,
  link: <Link2 className="h-3.5 w-3.5" />,
  content: <Clapperboard className="h-3.5 w-3.5" />,
};

const KIND_TILE: Record<SystemMapNode['kind'], string> = {
  funnel: 'bg-brass/20 text-brass',
  page: 'bg-bone/15 text-bone/70',
  email: 'bg-violet-400/20 text-violet-300',
  link: 'bg-sky-400/20 text-sky-300',
  content: 'bg-emerald-400/20 text-emerald-300',
};

function SystemNodeCard({ data }: NodeProps) {
  const node = data as unknown as SystemMapNode;
  const router = useRouter();
  const ui = useContext(SystemMapUiContext);
  // A pending-blueprint node isn't a real record yet — no click-through, a
  // dashed border, and (on the anchor) the approve/reject decision.
  const isBlueprint = !!node.blueprintId;
  // The funnel id rides the node id (`funnel:<id>`) — the chevron + focus
  // buttons only make sense on a funnel node.
  const funnelId = node.kind === 'funnel' ? node.id.slice('funnel:'.length) : null;
  const isCollapsed = funnelId ? ui.collapsed.has(funnelId) : false;
  const isFocused = funnelId != null && ui.focusedId === funnelId;
  // A content node shows its platform's brand mark (Instagram, TikTok…) when
  // the platform is known — the sub is "platform · format".
  const contentPlatform =
    node.kind === 'content' ? canonicalPlatform(node.sub.split(' · ')[0] ?? '') : null;
  return (
    <div
      onClick={() =>
        node.clusterFunnel
          ? ui.expandTraffic(node.clusterFunnel)
          : ui.inspectNode(node)
      }
      title={
        isBlueprint
          ? `${node.label} — a proposed node, built on approve`
          : node.clusterFunnel
            ? `${node.label} — click to expand`
            : `${node.label} — click to inspect`
      }
      className={`w-[240px] cursor-pointer rounded-xl border bg-ink/95 px-3 py-2 shadow-lg transition-colors ${KIND_ACCENT[node.kind]} ${
        isBlueprint
          ? 'border-dashed opacity-90 hover:bg-bone/[0.06]'
          : 'hover:bg-bone/10'
      }`}
    >
      {/* the edges attach left (in) + right (out) — traffic flows left→right */}
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-bone/30" />
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-bone/30" />
      <div className="flex items-center gap-2">
        {/* the kind icon tile — a content node shows its platform's brand
            mark (Instagram, TikTok…); the rest show the kind icon */}
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${KIND_TILE[node.kind]}`}
        >
          {contentPlatform ? (
            <PlatformIcon platform={contentPlatform} className="h-4 w-4" />
          ) : (
            KIND_ICON[node.kind]
          )}
        </span>
        {STATUS_GLYPH[node.status]}
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-bone/90">
          {node.label}
        </span>
        {/* the blueprint anchor's decision: approve materializes the whole
            subgraph (the gated write); reject discards the proposal */}
        {isBlueprint && node.blueprintAnchor && (
          <span className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              disabled={ui.blueprintBusy}
              onClick={(e) => {
                e.stopPropagation();
                ui.approveBlueprint(node.blueprintId!);
              }}
              title="Approve — build this system for real"
              className="rounded p-0.5 text-emerald-300 hover:bg-emerald-400/15 disabled:opacity-40"
            >
              <Check className="h-3 w-3" />
            </button>
            <button
              type="button"
              disabled={ui.blueprintBusy}
              onClick={(e) => {
                e.stopPropagation();
                ui.rejectBlueprint(node.blueprintId!);
              }}
              title="Discard this proposal"
              className="rounded p-0.5 text-red-300/80 hover:bg-red-400/15 disabled:opacity-40"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        )}
        {/* the funnel node's depth + focus controls (the rest of the card
            still clicks through to the editor) */}
        {funnelId && !isBlueprint && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                ui.focusFunnel(funnelId);
              }}
              title={isFocused ? 'Viewing just this system' : 'Open just this system'}
              className={`shrink-0 rounded p-0.5 ${
                isFocused ? 'text-brass' : 'text-bone/30 hover:text-brass'
              }`}
            >
              <Crosshair className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                ui.toggleCollapse(funnelId);
              }}
              title={isCollapsed ? 'Expand — show its pages, emails, and traffic' : 'Collapse to just this system'}
              className="shrink-0 rounded p-0.5 text-bone/30 hover:text-bone"
            >
              {isCollapsed ? (
                <ChevronRight className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
          </>
        )}
        {node.href && !funnelId && (
          <ExternalLink className="h-3 w-3 shrink-0 text-bone/30" />
        )}
      </div>
      {node.sub && (
        <p className="mt-0.5 truncate text-[9px] uppercase tracking-wide text-bone/35">
          {node.sub}
        </p>
      )}
      {node.metrics.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {node.metrics.map((m) => (
            <span
              key={m}
              className="rounded bg-bone/[0.08] px-1.5 py-0.5 text-[9px] font-semibold text-bone/70"
            >
              {m}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const nodeTypes = { systemNode: SystemNodeCard };

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

export default function SystemMapPage() {
  const router = useRouter();
  const [input, setInput] = useState<SystemMapInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The depth control: which funnels are collapsed to just their card. */
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  /** The focus control: the one system on the canvas (null = the full view). */
  const [focusId, setFocusId] = useState<string | null>(null);
  /** A transient note after a write ("Link re-pointed → Checkout"). */
  const [notice, setNotice] = useState<string | null>(null);
  /** True while a re-point PATCH is in flight. */
  const [saving, setSaving] = useState(false);
  /** The pending blueprints — the map's overlay (a blueprint-in-progress). */
  const [blueprints, setBlueprints] = useState<SystemBlueprint[]>([]);
  /** The "Create a blueprint" panel. */
  const [createOpen, setCreateOpen] = useState(false);
  /** True while a blueprint approve/reject is in flight. */
  const [blueprintBusy, setBlueprintBusy] = useState(false);
  /** The node being inspected (the peek panel). null = closed. */
  const [selectedNode, setSelectedNode] = useState<SystemMapNode | null>(null);
  /** The "Ask the map" sheet (the right edge). Mutually exclusive with the peek. */
  const [chatOpen, setChatOpen] = useState(false);
  /** Live state: poll the graph so the numbers tick (a dashboard, not a diagram). */
  const [live, setLive] = useState(false);
  /** A funnel whose traffic cluster is expanded (all its content shows). */
  const [expandTrafficFor, setExpandTrafficFor] = useState<string | null>(null);

  // The input loader — the graph's data. Reused by the mount, the live poll,
  // and the blueprint approve refetch.
  const loadInput = async (): Promise<SystemMapInput | null> => {
    try {
      const res = await fetch('/api/admin/system-map', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load the system map');
      setInput(json.input as SystemMapInput);
      return json.input as SystemMapInput;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load the system map');
      return null;
    }
  };

  // Load the input once; read the initial focus from ?funnel=<id>.
  useEffect(() => {
    void (async () => {
      const loaded = await loadInput();
      if (!loaded) return;
      try {
        const f = new URL(window.location.href).searchParams.get('funnel');
        if (f && loaded.funnels.some((x) => x.id === f)) setFocusId(f);
      } catch {
        /* malformed URL — the full view */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The live poll — when on, refetch every 30s. The builder is pure + instant,
  // so a rebuild is cheap; the metrics + edge colors tick with the real numbers.
  useEffect(() => {
    if (!live) return;
    const t = window.setInterval(() => void loadInput(), 30_000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  // Load the pending blueprints (the overlay). Re-run after a propose /
  // approve / reject so the canvas reflects the blueprint's lifecycle.
  const loadBlueprints = async () => {
    try {
      const res = await fetch('/api/admin/system-map/blueprint?status=proposed', {
        cache: 'no-store',
      });
      const json = await res.json();
      if (json.success) setBlueprints(json.blueprints as SystemBlueprint[]);
    } catch {
      /* a dead blueprint table never takes the map down */
    }
  };
  useEffect(() => {
    void loadBlueprints();
  }, []);

  // The gated materialization: approve runs the skills (the map refetches —
  // the new real nodes appear and the blueprint leaves the pending set);
  // reject discards the proposal.
  const decideBlueprint = async (
    blueprintId: string,
    action: 'approve' | 'reject',
  ) => {
    if (blueprintBusy) return;
    setBlueprintBusy(true);
    try {
      const res = await fetch('/api/admin/system-map/blueprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, blueprintId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `${action} failed`);
      if (action === 'approve') {
        // The skills wrote real records — refetch the graph so they appear.
        const mapRes = await fetch('/api/admin/system-map', { cache: 'no-store' });
        const mapJson = await mapRes.json();
        if (mapRes.ok && mapJson.success) setInput(mapJson.input as SystemMapInput);
        setNotice('Blueprint approved — the system is live on the map.');
      } else {
        setNotice('Blueprint discarded.');
      }
      await loadBlueprints();
      window.setTimeout(() => setNotice(null), 5000);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : `${action} failed`);
      window.setTimeout(() => setNotice(null), 6000);
    } finally {
      setBlueprintBusy(false);
    }
  };


  // The analysis engine — the edge conversion rates + the leak detector, over
  // the same input (pure, no refetch). The edges color by PERFORMANCE health
  // (good/ok/bad) — never the node cards' build axis.
  const analysis: SystemMapAnalysis | null = useMemo(
    () => (input ? analyzeSystemMap(input) : null),
    [input],
  );
  const edgeHealth = useMemo(
    () => new Map((analysis?.edgeRates ?? []).map((e) => [e.edgeId, e.health])),
    [analysis],
  );

  // The graph builds + lays out CLIENT-SIDE — focus/collapse re-layout
  // instantly, no refetch.
  const map: SystemMap | null = useMemo(
    () =>
      input
        ? buildSystemMap(input, {
            focusFunnelId: focusId ?? undefined,
            collapsed,
            pendingBlueprints: blueprints,
            expandTrafficFor: expandTrafficFor ?? undefined,
          })
        : null,
    [input, focusId, collapsed, blueprints, expandTrafficFor],
  );

  const ui = useMemo(
    () => ({
      collapsed,
      focusedId: focusId,
      toggleCollapse: (funnelId: string) =>
        setCollapsed((prev) => {
          const next = new Set(prev);
          if (next.has(funnelId)) next.delete(funnelId);
          else next.add(funnelId);
          return next;
        }),
      focusFunnel: (funnelId: string) => {
        setFocusId(funnelId);
        // Keep the URL honest so a focus is shareable/bookmarkable.
        router.replace(`/admin/system-map?funnel=${funnelId}`, { scroll: false });
      },
      approveBlueprint: (blueprintId: string) =>
        void decideBlueprint(blueprintId, 'approve'),
      rejectBlueprint: (blueprintId: string) =>
        void decideBlueprint(blueprintId, 'reject'),
      blueprintBusy,
      // Inspecting a node takes the right edge — close the chat sheet.
      inspectNode: (node: SystemMapNode) => {
        setSelectedNode(node);
        setChatOpen(false);
      },
      expandTraffic: (funnelId: string) => setExpandTrafficFor(funnelId),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [collapsed, focusId, router, blueprintBusy],
  );

  // The chat's "Draft the fix" — hand the worst leak to the blueprint creator
  // (the optimization mode), then refresh the pending overlay.
  const onDraftFix = async (leak: SystemMapLeak) => {
    const funnel = input?.funnels.find((f) => f.id === leak.funnelId);
    const pageKey = leak.nodeId.split(':').pop() || 'checkout';
    try {
      const res = await fetch('/api/admin/system-map/blueprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'propose',
          mode: 'optimization',
          parentFunnelId: leak.funnelId,
          kind: funnel?.kind ?? 'sales',
          leakPageKey: pageKey,
          leakLabel: leak.label,
          leakEdgeId: leak.edgeId,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Propose failed');
      setNotice('Fix drafted — review the pending blueprint on the canvas and approve to build.');
      await loadBlueprints();
      window.setTimeout(() => setNotice(null), 6000);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Propose failed');
      window.setTimeout(() => setNotice(null), 6000);
    }
  };


  const { nodes, edges } = useMemo(() => {
    if (!map) return { nodes: [], edges: [] };
    return {
      nodes: map.nodes.map(
        (n): Node => ({
          id: n.id,
          type: 'systemNode',
          position: { x: n.x, y: n.y },
          // React Flow's data is a Record<string, unknown>; the node card
          // reads it back as a SystemMapNode.
          data: n as unknown as Record<string, unknown>,
          draggable: true,
        }),
      ),
      edges: map.edges.map((e) => {
        const health = edgeHealth.get(e.id);
        return {
          id: e.id,
          source: e.from,
          target: e.to,
          type: 'smoothstep',
          // A graded edge colors by its conversion health; an ungraded one
          // stays the quiet default.
          style: health
            ? { stroke: EDGE_HEALTH_COLOR[health], strokeWidth: 2 }
            : { stroke: 'rgba(235,230,220,0.18)', strokeWidth: 1.5 },
        };
      }),
    };
  }, [map, edgeHealth]);

  // ——— The first write path: drag a link onto a page to re-point it ———
  // Only a link → page/funnel connection is meaningful; anything else is
  // rejected by isValidConnection. On connect: PATCH, then update the input
  // locally (the map rebuilds from it — no refetch).
  // React Flow passes an Edge | Connection; the structural type accepts both.
  const isValidConnection = (conn: {
    source?: string | null;
    target?: string | null;
  }): boolean =>
    (conn.source?.startsWith('link:') ?? false) &&
    ((conn.target?.startsWith('page:') ?? false) ||
      (conn.target?.startsWith('funnel:') ?? false));

  const onConnect = async (conn: Connection) => {
    if (!input || saving || !conn.source || !conn.target) return;
    const linkId = conn.source.slice('link:'.length);
    // The target node id carries the funnel + page: page:<funnelId>:<pageKey>
    // or funnel:<funnelId> (the root).
    let funnelId = '';
    let funnelPage: string | null = null;
    if (conn.target.startsWith('page:')) {
      const rest = conn.target.slice('page:'.length);
      const cut = rest.indexOf(':');
      funnelId = rest.slice(0, cut);
      funnelPage = rest.slice(cut + 1);
    } else if (conn.target.startsWith('funnel:')) {
      funnelId = conn.target.slice('funnel:'.length);
      funnelPage = null;
    } else {
      return;
    }
    const link = input.links.find((l) => l.id === linkId);
    const targetLabel = funnelPage ?? 'the funnel root';
    setSaving(true);
    try {
      const res = await fetch('/api/admin/system-map', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkId, funnelId, funnelPage }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Re-point failed');
      // Optimistic: update the input, the map rebuilds from it.
      setInput((prev) =>
        prev
          ? {
              ...prev,
              links: prev.links.map((l) =>
                l.id === linkId ? { ...l, funnelId, optinFunnelId: null, funnelPage } : l,
              ),
            }
          : prev,
      );
      setNotice(`"${link?.label ?? 'Link'}" → ${targetLabel}`);
      window.setTimeout(() => setNotice(null), 4000);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Re-point failed');
      window.setTimeout(() => setNotice(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  // The headline: the worst leak across every system (the operator's morning
  // answer). Clicking it focuses that funnel.
  const topLeak = analysis?.leaks[0] ?? null;

  const focusedFunnel = focusId
    ? input?.funnels.find((f) => f.id === focusId)
    : null;

  return (
    <SystemMapUiContext.Provider value={ui}>
      <div className="flex h-full flex-col bg-noir">
        {/* header — back to the Asset Hub, top-left */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-bone/10 px-4">
          <Link
            href="/admin/assets"
            className="inline-flex items-center gap-1.5 rounded-lg border border-bone/15 px-2.5 py-1.5 text-xs text-bone/60 hover:bg-bone/10"
          >
            <ArrowLeftCircle className="h-3.5 w-3.5" /> Asset Hub
          </Link>
          <h1 className="font-display text-lg font-semibold text-bone">System map</h1>
          <Link
            href="/admin/buyer-journey"
            className="inline-flex items-center gap-1.5 rounded-lg border border-bone/15 px-2.5 py-1.5 text-xs text-bone/60 hover:bg-bone/10"
          >
            Buyer journeys →
          </Link>
          {/* The Blueprint Creator: draft a whole system as a pending overlay. */}
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brass/50 bg-brass/15 px-2.5 py-1.5 text-xs font-semibold text-brass hover:bg-brass/25"
          >
            <Plus className="h-3.5 w-3.5" /> Create a blueprint
          </button>
          {blueprints.length > 0 && (
            <span
              title={`${blueprints.length} blueprint${blueprints.length === 1 ? '' : 's'} awaiting approval on the canvas`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-bone/20 bg-bone/[0.06] px-2.5 py-1.5 text-[10px] font-semibold text-bone/70"
            >
              <CircleDashed className="h-3 w-3 text-bone/50" />
              {blueprints.length} pending
            </span>
          )}
          {focusedFunnel ? (
            <button
              type="button"
              onClick={() => {
                setFocusId(null);
                router.replace('/admin/system-map', { scroll: false });
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brass/40 px-2.5 py-1.5 text-xs font-semibold text-brass hover:bg-brass/10"
            >
              ← All systems
            </button>
          ) : (
            <span className="text-[10px] text-bone/35">
              traffic → links → pages → nurture · click a node to open it in its editor
            </span>
          )}
          {focusedFunnel && (
            <span className="text-[10px] text-bone/50">
              viewing <span className="font-semibold text-brass/90">{focusedFunnel.name}</span>
            </span>
          )}
          {/* The headline: the biggest leak across every system — the
              operator's morning answer. Clicking it focuses that funnel. */}
          {topLeak && (
            <button
              type="button"
              onClick={() => ui.focusFunnel(topLeak.funnelId)}
              title={`${topLeak.funnelName} — ${topLeak.label} is the weakest connection. Open that system.`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/40 bg-red-400/10 px-2.5 py-1.5 text-[10px] font-semibold text-red-300 hover:bg-red-400/20"
            >
              Biggest leak: {topLeak.funnelName} · {topLeak.label}{' '}
              {Math.round(topLeak.rate * 100)}%
            </button>
          )}
          {/* Live state — poll the graph so the numbers tick. A dashboard,
              not a diagram. */}
          <button
            type="button"
            onClick={() => setLive((v) => !v)}
            title={live ? 'Live — refreshing every 30s. Click to pause.' : 'Go live — refresh the numbers every 30s.'}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold ${
              live
                ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-300'
                : 'border-bone/15 text-bone/50 hover:bg-bone/10'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                live ? 'animate-pulse bg-emerald-400' : 'bg-bone/30'
              }`}
            />
            {live ? 'Live' : 'Go live'}
          </button>
          {map && (
            <span className="ml-auto text-[10px] text-bone/30">
              {map.nodes.length} nodes · {map.edges.length} connections
            </span>
          )}
        </header>

        {/* the canvas */}
        <div className="relative min-h-0 flex-1">
          {error ? (
            <div className="flex h-full items-center justify-center p-8 text-center text-sm text-red-300">
              {error}
            </div>
          ) : !map ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-bone/40" />
            </div>
          ) : map.nodes.length === 0 ? (
            <div className="flex h-full items-center justify-center p-8 text-center text-sm text-bone/40">
              No funnels yet — build one, and its pages, emails, and traffic sources map here.
            </div>
          ) : (
            <ReactFlow
              // Re-frame whenever the graph's shape changes (focus/collapse).
              key={`${focusId ?? 'all'}:${nodes.length}`}
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              fitView
              minZoom={0.2}
              maxZoom={1.6}
              proOptions={{ hideAttribution: true }}
              nodesConnectable={true}
              isValidConnection={isValidConnection}
              onConnect={onConnect}
              deleteKeyCode={null}
              colorMode="dark"
            >
              <Background gap={24} size={1} color="rgba(235,230,220,0.05)" />
              <Controls showInteractive={false} />
            </ReactFlow>
          )}
          {/* the write-path feedback — a transient note after a re-point */}
          {notice && (
            <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-lg border border-brass/40 bg-ink/95 px-3 py-1.5 text-[11px] font-semibold text-bone/90 shadow-lg">
              {saving ? 'Saving…' : notice}
            </div>
          )}
          {/* the Blueprint Creator — the three entry modes into a pending
              subgraph. A proposal lands on the canvas for approval. */}
          <BlueprintCreatePanel
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            funnels={input?.funnels ?? []}
            leaks={analysis?.leaks ?? []}
            onProposed={(message) => {
              setNotice(message);
              void loadBlueprints();
              window.setTimeout(() => setNotice(null), 6000);
            }}
          />
          {/* the node peek — click a node and it expands into the detail
              panel (what it is, its metrics, the way in). It shares the right
              edge with the chat sheet — the chat hides it while open. */}
          <NodePeekPanel
            node={chatOpen ? null : selectedNode}
            map={map}
            onClose={() => setSelectedNode(null)}
            onChanged={() => void loadInput()}
          />
          {/* the AI chat that sees the map — a full-height sheet on the right
              edge. Read-only Q&A, with a "draft the fix" handoff into the
              blueprint creator when there's a leak. */}
          <MapChatDock
            input={input}
            analysis={analysis}
            open={chatOpen}
            onToggle={(open) => {
              setChatOpen(open);
              if (open) setSelectedNode(null);
            }}
            onDraftFix={(leak) => void onDraftFix(leak)}
          />
        </div>
      </div>
    </SystemMapUiContext.Provider>
  );
}



