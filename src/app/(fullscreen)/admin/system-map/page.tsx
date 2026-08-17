'use client';

/**
 * /admin/system-map — the whole money system as a pannable node graph.
 *
 * Entered from the Asset Hub's Systems tab ("System map →"). Reads
 * `/api/admin/system-map` — the positioned node/edge graph built by
 * `@/lib/mothermode/systemMap` from the live funnel/email/link/content
 * records — and renders it on a React Flow canvas:
 *
 *   Traffic (ads/content/videos) → Tracked links → Pages (the funnel) → Nurture (email)
 *
 * Every node carries its metrics and opens in its proper editor on click.
 * v1 is read-only + click-through; rewiring connections on the canvas is the
 * follow-up, not this pass.
 */
import { useEffect, useMemo, useState } from 'react';
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
} from 'lucide-react';
import type { SystemMap, SystemMapNode } from '@/lib/mothermode/systemMap';

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
        {node.href && (
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
  const [map, setMap] = useState<SystemMap | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/system-map', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load the system map');
        setMap(json.map as SystemMap);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load the system map');
      }
    })();
  }, []);

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

  return (
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
        <span className="text-[10px] text-bone/35">
          traffic → links → pages → nurture · click a node to open it in its editor
        </span>
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
          <>
            {/* the lane titles ride above the canvas (they don't pan) */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex px-4 pt-2">
              {map.lanes.map((l) => (
                <span
                  key={l.key}
                  className="text-[9px] font-semibold uppercase tracking-wider text-bone/30"
                  style={{ marginLeft: l.key === 'traffic' ? 0 : undefined, width: 0 }}
                />
              ))}
            </div>
            <ReactFlow
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
          </>
        )}
      </div>
    </div>
  );
}
