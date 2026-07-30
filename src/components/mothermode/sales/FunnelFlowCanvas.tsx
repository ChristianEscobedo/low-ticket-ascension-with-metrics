'use client';

/**
 * The funnel, drawn.
 *
 * This is the renderer half of `funnelMapLayout.ts`. Every coordinate and every
 * path string arrives already computed, so nothing here does geometry: it puts
 * a div at `x`/`y` and stamps `<path d={...} />`. Anything that looks like maths
 * below is presentation (zoom, dimming, bar widths), never layout.
 *
 * Built the same way as `EmailFlowDashboard` — absolutely positioned cards over
 * one SVG layer, a single transformed wrapper for pan/zoom — but deliberately
 * NOT importing it: that component is bound to email types and lives in a
 * full-screen modal. Two differences follow from this one being inline in a tab:
 *
 *   - Wheel zoom requires ctrl/meta. A modal owns the whole viewport and can
 *     swallow the wheel; a panel inside a long scrolling form must not, or the
 *     admin gets stuck unable to scroll past the diagram.
 *   - Reach is drawn as a meter, not as node opacity. Attention decay compounds
 *     (`ATTENTION_DECAY` puts checkout near 5%), so an opacity ramp would have
 *     made the single most important card in the funnel the least readable one.
 *     The bar is linear and sits next to the number, so a sliver means a sliver.
 *
 * What the drawing encodes, beyond position:
 *   branch     edge colour and dash — 'yes' climbs the ladder, 'no' is a rescue
 *   reach      the meter on each card that models it
 *   event      shown in the detail card; these are the names email triggers bind to
 *   issues     an outline plus a badge on the node the verdict is about
 */

import { useCallback, useMemo, useRef, useState, type ComponentType } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  FileText,
  KeyRound,
  Mail,
  Megaphone,
  Newspaper,
  Play,
  Plus,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  UserPlus,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

import type { AscensionIssue, AscensionStage } from '@/lib/mothermode/sales/ascension';
import type { FunnelMap, FunnelNodeKind } from '@/lib/mothermode/sales/funnelMap';
import {
  FUNNEL_NODE_HEIGHT,
  FUNNEL_NODE_WIDTH,
  funnelNodeStage,
  layoutFunnelMap,
} from '@/lib/mothermode/sales/funnelMapLayout';

// ---------------------------------------------------------------------------
// Presentation tables
// ---------------------------------------------------------------------------

type NodeStyle = {
  /** Kicker above the label. */
  kicker: string;
  /** Rail + icon colour. Hex, because it is also handed to SVG. */
  accent: string;
  icon: ComponentType<{ className?: string }>;
  /** Side steps are drawn dashed: they are optional, not part of the spine. */
  dashed?: boolean;
};

const NODE_STYLE: Record<FunnelNodeKind, NodeStyle> = {
  ad: { kicker: 'Traffic', accent: '#6ea8fe', icon: Megaphone },
  advertorial: { kicker: 'Pre-sell', accent: '#6ea8fe', icon: Newspaper },
  optin: { kicker: 'Opt-in', accent: '#6ea8fe', icon: UserPlus },
  vsl: { kicker: 'Video', accent: '#6ea8fe', icon: Play },
  sales: { kicker: 'Front end', accent: '#c9a227', icon: FileText },
  checkout: { kicker: 'Checkout', accent: '#c9a227', icon: CreditCard },
  orderBump: { kicker: 'Order bump', accent: '#c9a227', icon: Plus, dashed: true },
  upsell: { kicker: 'Upsell', accent: '#34d399', icon: TrendingUp },
  downsell: { kicker: 'Downsell', accent: '#f59e0b', icon: TrendingDown, dashed: true },
  success: { kicker: 'Success', accent: '#e6e1d2', icon: CheckCircle2 },
  access: { kicker: 'Delivery', accent: '#e6e1d2', icon: KeyRound },
  email: { kicker: 'Email', accent: '#a78bfa', icon: Mail, dashed: true },
};

const STAGE_LABEL: Record<AscensionStage, string> = {
  frontEnd: 'Front end',
  oto1: 'OTO 1',
  oto2: 'OTO 2',
  oto3: 'OTO 3',
};

const CANVAS_PADDING = 40;
const MIN_SCALE = 0.4;
const MAX_SCALE = 2;
const SPINE_EDGE = 'rgba(230,225,210,0.3)';

const money = (n: number): string => '$' + Math.round(n).toLocaleString('en-US');
const pct = (n: number): string => `${Math.round(n * 1000) / 10}%`;

// ---------------------------------------------------------------------------

export default function FunnelFlowCanvas({
  map,
  issues = [],
  height = 540,
}: {
  map: FunnelMap;
  /** Ladder verdicts, drawn on the node each one is about. */
  issues?: AscensionIssue[];
  /** Canvas viewport height in px. The drawing pans inside it. */
  height?: number;
}) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isPanning = useRef(false);
  const didDrag = useRef(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const layout = useMemo(() => layoutFunnelMap(map), [map]);

  const kindById = useMemo(() => {
    const m = new Map<string, FunnelNodeKind>();
    layout.nodes.forEach((n) => m.set(n.id, n.kind));
    return m;
  }, [layout]);

  /**
   * Issues, keyed to the node they belong on.
   *
   * `funnelNodeStage` says nothing for downsells and side steps, so those
   * simply never carry a badge — an unmarked node means "no verdict is
   * attributable here", not "this node is fine". The list under the canvas
   * remains the complete record.
   *
   * A front-end verdict lands on both the sales page and checkout, because the
   * map splits one rung across two pages and the issue is about the rung.
   */
  const issuesByNode = useMemo(() => {
    const byNode = new Map<string, AscensionIssue[]>();
    layout.nodes.forEach((node) => {
      const stage = funnelNodeStage(node);
      if (!stage) return;
      const hits = issues.filter((i) => i.stage === stage);
      if (hits.length) byNode.set(node.id, hits);
    });
    return byNode;
  }, [layout, issues]);

  /** Neighbours of the selected node, so everything else can recede. */
  const neighbours = useMemo(() => {
    if (!selectedId) return null;
    const near = new Set<string>([selectedId]);
    layout.edges.forEach((e) => {
      if (e.from === selectedId) near.add(e.to);
      if (e.to === selectedId) near.add(e.from);
    });
    return near;
  }, [layout, selectedId]);

  const selected = useMemo(
    () => layout.nodes.find((n) => n.id === selectedId) ?? null,
    [layout, selectedId],
  );

  // Wheel zoom is opt-in via ctrl/meta so the page can still be scrolled with
  // the pointer over the canvas. See the note at the top of the file.
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((s) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, s + delta)));
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      didDrag.current = false;
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    },
    [pan],
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag.current = true;
    setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
  }, []);

  const endPan = useCallback(() => {
    isPanning.current = false;
    // Cleared a frame late so the click that ends a drag still reads as a drag.
    requestAnimationFrame(() => {
      didDrag.current = false;
    });
  }, []);

  const selectNode = useCallback((id: string) => {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    setSelectedId((current) => (current === id ? null : id));
  }, []);

  const reset = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
    setSelectedId(null);
  }, []);

  if (layout.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-bone/10 bg-ink/50 p-8 text-xs text-bone/40">
        Nothing to draw yet. Fill in the front-end offer on the Offer tab.
      </div>
    );
  }

  const canvasWidth = layout.width + CANVAS_PADDING * 2;
  const canvasHeight = layout.height + CANVAS_PADDING * 2;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-bone/40">
          Drag to pan, ctrl+scroll to zoom, click a step for detail.
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(MIN_SCALE, s - 0.2))}
            className="rounded-lg border border-bone/20 p-1.5 text-bone/70 transition hover:border-brass/50 hover:text-bone"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="w-10 text-center text-[11px] font-medium text-bone/50">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(MAX_SCALE, s + 0.2))}
            className="rounded-lg border border-bone/20 p-1.5 text-bone/70 transition hover:border-brass/50 hover:text-bone"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-bone/20 p-1.5 text-bone/70 transition hover:border-brass/50 hover:text-bone"
            aria-label="Reset view"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div
        className="relative overflow-hidden rounded-lg border border-bone/10 bg-ink/50 [background-image:radial-gradient(circle,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:22px_22px]"
        style={{ height, cursor: isPanning.current ? 'grabbing' : 'grab' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endPan}
        onMouseLeave={endPan}
      >
        <div
          className="relative"
          style={{
            width: canvasWidth,
            height: canvasHeight,
            transform: `translate(${pan.x + CANVAS_PADDING}px, ${pan.y + CANVAS_PADDING}px) scale(${scale})`,
            transformOrigin: '0 0',
          }}
        >
          {/* Edges */}
          <svg
            className="pointer-events-none absolute inset-0"
            width={canvasWidth}
            height={canvasHeight}
          >
            <defs>
              <marker
                id="funnel-flow-arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
              </marker>
            </defs>
            {layout.edges.map((edge) => {
              const toEmail = kindById.get(edge.to) === 'email';
              const isYes = edge.branch === 'yes';
              const isNo = edge.branch === 'no';
              const color = isYes
                ? '#34d399'
                : isNo
                  ? '#f59e0b'
                  : toEmail
                    ? '#a78bfa'
                    : kindById.get(edge.to) === 'orderBump'
                      ? '#c9a227'
                      : SPINE_EDGE;
              // Only the spine is solid. Everything else is a step the buyer
              // may never take, or a message rather than a page.
              const dashed = isNo || toEmail || kindById.get(edge.to) === 'orderBump';
              const faded = neighbours && !(neighbours.has(edge.from) && neighbours.has(edge.to));
              const label = edge.branch ?? edge.label;
              const showLabel = Boolean(edge.branch) && !toEmail;
              return (
                <g key={edge.id} style={{ color }} opacity={faded ? 0.2 : 1}>
                  <path
                    d={edge.d}
                    fill="none"
                    stroke={color}
                    strokeWidth={isYes || !edge.branch ? 1.75 : 1.5}
                    strokeDasharray={dashed ? '5 4' : undefined}
                    markerEnd="url(#funnel-flow-arrow)"
                  />
                  {showLabel && label ? (
                    <foreignObject
                      x={edge.labelX - 40}
                      y={edge.labelY - 11}
                      width={80}
                      height={22}
                    >
                      <div className="flex justify-center">
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                          style={{ color, backgroundColor: `${color}22` }}
                        >
                          {label}
                        </span>
                      </div>
                    </foreignObject>
                  ) : null}
                </g>
              );
            })}
          </svg>

          {/* Nodes */}
          <div className="absolute inset-0">
            {layout.nodes.map((node) => {
              const style = NODE_STYLE[node.kind];
              const Icon = style.icon;
              const nodeIssues = issuesByNode.get(node.id);
              const flagged = Boolean(nodeIssues?.length);
              const isSelected = selectedId === node.id;
              const faded = neighbours && !neighbours.has(node.id);
              return (
                <button
                  key={node.id}
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => selectNode(node.id)}
                  title={node.label}
                  className={`absolute flex flex-col justify-center gap-1 rounded-xl border bg-[#141a2e] p-2.5 pl-3.5 text-left shadow-lg transition ${
                    faded ? 'opacity-40' : 'opacity-100'
                  } ${style.dashed ? 'border-dashed' : ''} ${
                    isSelected
                      ? 'ring-2 ring-brass/40'
                      : flagged
                        ? 'border-red-500/60'
                        : 'border-bone/15 hover:border-bone/35'
                  }`}
                  style={{
                    left: node.x,
                    top: node.y,
                    width: FUNNEL_NODE_WIDTH,
                    height: FUNNEL_NODE_HEIGHT,
                    borderColor: isSelected ? style.accent : undefined,
                  }}
                >
                  <span
                    className="absolute bottom-2 left-0 top-2 w-1 rounded-r"
                    style={{ backgroundColor: style.accent }}
                  />
                  <span className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wide">
                    <Icon className="h-3 w-3" />
                    <span style={{ color: style.accent }}>{style.kicker}</span>
                    {node.price ? (
                      <span className="ml-auto text-bone/50">{money(node.price)}</span>
                    ) : null}
                    {flagged ? (
                      <AlertTriangle className="ml-auto h-3 w-3 text-red-400" />
                    ) : null}
                  </span>
                  <p className="line-clamp-2 text-xs font-semibold leading-snug text-bone">
                    {node.label}
                  </p>
                  {node.reach !== undefined ? (
                    // Linear width on purpose: by checkout this is a sliver,
                    // and the sliver is the finding.
                    <span className="flex items-center gap-1.5">
                      <span className="h-1 flex-1 overflow-hidden rounded-full bg-bone/10">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${Math.max(node.reach * 100, 1)}%`,
                            backgroundColor: style.accent,
                          }}
                        />
                      </span>
                      <span className="text-[9px] tabular-nums text-bone/40">
                        {pct(node.reach)}
                      </span>
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail card */}
        {selected ? (
          <div
            className="absolute bottom-3 right-3 z-30 w-72 rounded-xl border border-bone/20 bg-ink/95 p-3.5 shadow-2xl backdrop-blur"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: NODE_STYLE[selected.kind].accent }}
                >
                  {NODE_STYLE[selected.kind].kicker}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-bone">{selected.label}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="text-[11px] text-bone/40 transition hover:text-bone"
              >
                Close
              </button>
            </div>

            <dl className="mt-2.5 space-y-1 text-[11px]">
              {selected.price ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-bone/40">Price</dt>
                  <dd className="text-bone/80">{money(selected.price)}</dd>
                </div>
              ) : null}
              {selected.reach !== undefined ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-bone/40">Projected reach</dt>
                  <dd className="text-bone/80">{pct(selected.reach)}</dd>
                </div>
              ) : null}
              {funnelNodeStage(selected) ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-bone/40">Ladder rung</dt>
                  <dd className="text-bone/80">{STAGE_LABEL[funnelNodeStage(selected)!]}</dd>
                </div>
              ) : null}
              {selected.event ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-bone/40">Fires event</dt>
                  <dd className="font-mono text-[10px] text-brass/90">{selected.event}</dd>
                </div>
              ) : null}
            </dl>

            {selected.event ? (
              <p className="mt-2 text-[10px] leading-relaxed text-bone/35">
                Email sequences bind to this event name, not to the page.
              </p>
            ) : null}

            {issuesByNode.get(selected.id)?.map((issue, i) => (
              <p
                key={issue.code + i}
                className="mt-2 rounded-lg border border-red-400/25 bg-red-500/[0.07] px-2.5 py-1.5 text-[11px] text-red-200/90"
              >
                {issue.message}
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
