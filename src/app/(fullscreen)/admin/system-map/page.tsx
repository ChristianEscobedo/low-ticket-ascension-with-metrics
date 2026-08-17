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
} from 'lucide-react';
import {
  buildSystemMap,
  type SystemMap,
  type SystemMapInput,
  type SystemMapNode,
} from '@/lib/mothermode/systemMap';

// ---------------------------------------------------------------------------
// The UI context — the page provides the focus/collapse handlers, the node
// card consumes them (keeps the React Flow node data clean of callbacks).
// ---------------------------------------------------------------------------

const SystemMapUiContext = createContext<{
  collapsed: ReadonlySet<string>;
  toggleCollapse: (funnelId: string) => void;
  focusFunnel: (funnelId: string) => void;
  focusedId: string | null;
}>({
  collapsed: new Set(),
  toggleCollapse: () => {},
  focusFunnel: () => {},
  focusedId: null,
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

function SystemNodeCard({ data }: NodeProps) {
  const node = data as unknown as SystemMapNode;
  const router = useRouter();
  const ui = useContext(SystemMapUiContext);
  // The funnel id rides the node id (`funnel:<id>`) — the chevron + focus
  // buttons only make sense on a funnel node.
  const funnelId = node.kind === 'funnel' ? node.id.slice('funnel:'.length) : null;
  const isCollapsed = funnelId ? ui.collapsed.has(funnelId) : false;
  const isFocused = funnelId != null && ui.focusedId === funnelId;
  return (
    <div
      onClick={() => node.href && router.push(node.href)}
      title={node.href ? `${node.label} — open in its editor` : node.label}
      className={`w-[240px] cursor-pointer rounded-xl border bg-ink/95 px-3 py-2 shadow-lg transition-colors hover:bg-bone/10 ${KIND_ACCENT[node.kind]}`}
    >
      {/* the edges attach left (in) + right (out) — traffic flows left→right */}
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-bone/30" />
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-bone/30" />
      <div className="flex items-center gap-1.5">
        {STATUS_GLYPH[node.status]}
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-bone/90">
          {node.label}
        </span>
        {/* the funnel node's depth + focus controls (the rest of the card
            still clicks through to the editor) */}
        {funnelId && (
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

  // Load the input once; read the initial focus from ?funnel=<id>.
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/system-map', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load the system map');
        setInput(json.input as SystemMapInput);
        try {
          const f = new URL(window.location.href).searchParams.get('funnel');
          if (f && (json.input as SystemMapInput).funnels.some((x) => x.id === f)) {
            setFocusId(f);
          }
        } catch {
          /* malformed URL — the full view */
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load the system map');
      }
    })();
  }, []);

  // The graph builds + lays out CLIENT-SIDE — focus/collapse re-layout
  // instantly, no refetch.
  const map: SystemMap | null = useMemo(
    () =>
      input
        ? buildSystemMap(input, {
            focusFunnelId: focusId ?? undefined,
            collapsed,
          })
        : null,
    [input, focusId, collapsed],
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
    }),
    [collapsed, focusId, router],
  );

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
      edges: map.edges.map((e) => ({
        id: e.id,
        source: e.from,
        target: e.to,
        type: 'smoothstep',
        style: { stroke: 'rgba(235,230,220,0.18)', strokeWidth: 1.5 },
      })),
    };
  }, [map]);

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
              nodesConnectable={false}
              deleteKeyCode={null}
              colorMode="dark"
            >
              <Background gap={24} size={1} color="rgba(235,230,220,0.05)" />
              <Controls showInteractive={false} />
            </ReactFlow>
          )}
        </div>
      </div>
    </SystemMapUiContext.Provider>
  );
}
