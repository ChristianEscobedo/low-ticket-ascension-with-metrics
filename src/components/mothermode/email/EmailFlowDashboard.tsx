'use client';

/**
 * Email Marketing Kit — interactive flow canvas.
 *
 * Zoom/pan graph of trigger → trunk → branches → A/B splits, with optional
 * live analytics overlays. Single-click selects a node and opens an inspector
 * (stats for emails, programming for the trigger). Jump-to-editor is an
 * explicit action so it never competes with the canvas.
 */
import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  X,
  GitBranch,
  Zap,
  FlaskConical,
  Image as ImageIcon,
  Users,
  TrendingUp,
  AlertTriangle,
  Activity,
  ZoomIn,
  ZoomOut,
  ExternalLink,
  Settings2,
} from 'lucide-react';
import {
  sequenceToFlowGraph,
  FLOW_NODE_WIDTH,
  FLOW_NODE_HEIGHT,
  hasAnyStats,
  openRate as statOpenRate,
  ctr as statCtr,
  EMAIL_TRIGGER_LABELS,
  EMAIL_TRIGGER_DESCRIPTIONS,
  emailTriggerGroups,
  emailTriggerLocationLabel,
  emailTriggerCategory,
  emailTriggerLabel,
  resolveTriggerLocationLabel,
  resolveTriggerBindingLabel,
  EMAIL_FUNNEL_PAGE_LABELS,
  type EmailSequence,
  type EmailTriggerEvent,
  type EmailFunnelPage,
  type EmailTriggerConfig,
  type SequenceStats,
} from '@/lib/mothermode/email';
import {
  computeFlowOverlay,
  type FlowOverlay,
} from '@/lib/mothermode/email/flowOverlay';
import { triggerRecipeFamilyLabel } from '@/lib/mothermode/content/promptBankActions';
import {
  dropoffByEmail,
  activeSubscribers,
  totalEnrolled,
  hasEnrollments,
  type EnrollmentData,
} from '@/lib/mothermode/email/enrollment';

interface Props {
  open: boolean;
  onClose: () => void;
  sequence: EmailSequence;
  /** Jump to the email card in the editor (explicit action only). */
  onSelectEmail?: (emailId: string) => void;
  stats?: SequenceStats | null;
  enrollment?: EnrollmentData | null;
  onChangeTrigger?: (trigger: EmailTriggerEvent) => void;
  offerOptions?: { id: string; label: string }[];
  contentOptions?: { id: string; label: string }[];
  onChangeTriggerConfig?: (patch: Partial<EmailTriggerConfig>) => void;
}

const CANVAS_PADDING = 48;
const MIN_SCALE = 0.4;
const MAX_SCALE = 2.5;

function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

function humanizeCondition(condition: string): string {
  return condition ? `if ${condition.replace(/-/g, ' ')}` : '';
}

function edgeAnchors(
  source: { x: number; y: number },
  target: { x: number; y: number },
) {
  return {
    x1: source.x + FLOW_NODE_WIDTH / 2,
    y1: source.y + FLOW_NODE_HEIGHT,
    x2: target.x + FLOW_NODE_WIDTH / 2,
    y2: target.y,
  };
}

function heatTintClasses(tint: string): string {
  switch (tint) {
    case 'good':
      return 'border-emerald-500/50 shadow-[0_0_0_1px_rgba(16,185,129,0.15)]';
    case 'ok':
      return 'border-amber-500/50 shadow-[0_0_0_1px_rgba(245,158,11,0.12)]';
    case 'bad':
      return 'border-red-500/50 shadow-[0_0_0_1px_rgba(239,68,68,0.15)]';
    default:
      return 'border-bone/15';
  }
}

function compactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function EmailFlowDashboard({
  open,
  onClose,
  sequence,
  onSelectEmail,
  stats,
  enrollment,
  onChangeTrigger,
  offerOptions,
  contentOptions,
  onChangeTriggerConfig,
}: Props) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [heatMapOn, setHeatMapOn] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [triggerInspectorOpen, setTriggerInspectorOpen] = useState(false);
  const didDrag = useRef(false);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const graph = useMemo(() => sequenceToFlowGraph(sequence), [sequence]);
  const showStats = useMemo(() => hasAnyStats(stats), [stats]);
  const showEnrollment = useMemo(
    () => hasEnrollments(enrollment),
    [enrollment],
  );

  const dropoff = useMemo(
    () => dropoffByEmail(sequence, stats, enrollment),
    [sequence, stats, enrollment],
  );

  const overlay: FlowOverlay = useMemo(
    () => computeFlowOverlay(graph, stats, dropoff, enrollment),
    [graph, stats, dropoff, enrollment],
  );

  const nodeById = useMemo(() => {
    const map = new Map<string, (typeof graph.nodes)[number]>();
    graph.nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [graph]);

  const orderById = useMemo(() => {
    const map = new Map<string, number>();
    (sequence?.emails ?? []).forEach((e, i) => map.set(e.id, i + 1));
    return map;
  }, [sequence]);

  const { width, height } = useMemo(() => {
    let w = 0;
    let h = 0;
    for (const n of graph.nodes) {
      w = Math.max(w, n.x + FLOW_NODE_WIDTH);
      h = Math.max(h, n.y + FLOW_NODE_HEIGHT);
    }
    return {
      width: w + CANVAS_PADDING * 2,
      height: h + CANVAS_PADDING * 2,
    };
  }, [graph]);

  const emailCount = graph.nodes.filter((n) => n.kind === 'email').length;
  const branchCount = graph.edges.filter((e) => e.kind === 'branch').length;
  const splitCount = graph.nodes.filter((n) => n.kind === 'split').length;

  const activeCount = useMemo(
    () => activeSubscribers(enrollment),
    [enrollment],
  );
  const totalEnrolledCount = useMemo(
    () => totalEnrolled(enrollment),
    [enrollment],
  );

  // Reset selection when the panel closes.
  useEffect(() => {
    if (!open) {
      setSelectedNodeId(null);
      setTriggerInspectorOpen(false);
    }
  }, [open]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((s) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, s + delta)));
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only pan from primary button on the canvas chrome, not on controls.
      if (e.button !== 0) return;
      didDrag.current = false;
      isPanning.current = true;
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
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

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
    // Defer clearing didDrag so the click that ends a drag still sees it as a drag.
    requestAnimationFrame(() => {
      didDrag.current = false;
    });
  }, []);

  /** Single-click: select node + show inspector. Does NOT jump to editor. */
  const selectNode = useCallback((nodeId: string) => {
    // Ignore the mouseup-click that finishes a canvas pan.
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    setSelectedNodeId(nodeId);
    // Always open the trigger inspector when the trigger is selected — even
    // read-only — so the admin can see the wiring. Editable controls appear
    // only when onChangeTrigger is provided.
    setTriggerInspectorOpen(nodeId === 'trigger');
  }, []);

  const jumpToEmail = useCallback(
    (emailId: string) => {
      onSelectEmail?.(emailId);
    },
    [onSelectEmail],
  );

  if (!open) return null;

  const hasEmails = emailCount > 0;
  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) : null;
  const selectedOverlay = selectedNodeId
    ? overlay.nodes.get(selectedNodeId)
    : null;

  const triggerEvent = (sequence.trigger ?? 'optin') as EmailTriggerEvent;
  const canProgramTrigger = Boolean(onChangeTrigger);
  const locationLine =
    resolveTriggerLocationLabel(triggerEvent, sequence.triggerConfig) ||
    emailTriggerLocationLabel(triggerEvent);
  const bindingLine = resolveTriggerBindingLabel(
    triggerEvent,
    sequence.triggerConfig,
  );

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close flow"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      <div className="relative ml-auto flex h-full w-full max-w-5xl flex-col border-l border-bone/15 bg-ink shadow-2xl">
        {/* Header */}
        <header className="flex items-center justify-between gap-3 border-b border-bone/10 px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg text-bone">
              <GitBranch className="h-4 w-4 text-brass" />
              Sequence flow
            </h2>
            <p className="text-xs text-bone/40">
              Click a node for details. Use “Open in editor” to jump to an email.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHeatMapOn((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                heatMapOn
                  ? 'border-brass/50 bg-brass/15 text-brass'
                  : 'border-bone/20 text-bone/60 hover:border-bone/40'
              }`}
              title="Toggle heat map coloring by open rate"
            >
              <Activity className="h-3.5 w-3.5" />
              Heat map
            </button>
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(MIN_SCALE, s - 0.2))}
              className="rounded-lg border border-bone/20 p-1.5 text-bone/70 transition hover:border-brass/50 hover:text-bone"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="w-10 text-center text-xs font-medium text-bone/50">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(MAX_SCALE, s + 0.2))}
              className="rounded-lg border border-bone/20 p-1.5 text-bone/70 transition hover:border-brass/50 hover:text-bone"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-bone/20 p-2 text-bone/70 transition hover:border-brass/50 hover:text-bone"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {showEnrollment && (
          <div className="flex items-center gap-4 border-b border-bone/10 px-5 py-2.5 text-xs">
            <span className="flex items-center gap-1.5 text-bone/70">
              <Users className="h-3.5 w-3.5 text-[#9cc2ff]" />
              <span className="font-semibold text-bone">
                {totalEnrolledCount}
              </span>{' '}
              enrolled
            </span>
            <span className="flex items-center gap-1.5 text-bone/70">
              <Activity className="h-3.5 w-3.5 text-emerald-400" />
              <span className="font-semibold text-bone">{activeCount}</span>{' '}
              active
            </span>
            {showStats && (
              <span className="flex items-center gap-1.5 text-bone/70">
                <TrendingUp className="h-3.5 w-3.5 text-brass" />
                Analytics live
              </span>
            )}
          </div>
        )}

        {/* Canvas */}
        <div
          className="relative flex-1 overflow-hidden bg-ink/60 [background-image:radial-gradient(circle,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:22px_22px]"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: isPanning.current ? 'grabbing' : 'grab' }}
        >
          {!hasEmails ? (
            <div className="flex h-full items-center justify-center p-10 text-center text-sm text-bone/40">
              No emails yet. Generate a sequence or an outline, then reopen Flow.
            </div>
          ) : (
            <div
              className="relative"
              style={{
                width,
                height,
                minWidth: '100%',
                minHeight: '100%',
                transform: `translate(${pan.x + CANVAS_PADDING}px, ${pan.y + CANVAS_PADDING}px) scale(${scale})`,
                transformOrigin: '0 0',
              }}
            >
              {/* Edges */}
              <svg
                className="pointer-events-none absolute inset-0"
                width={width}
                height={height}
              >
                <defs>
                  <marker
                    id="flow-arrow-dash"
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
                {graph.edges.map((edge) => {
                  const source = nodeById.get(edge.source);
                  const target = nodeById.get(edge.target);
                  if (!source || !target) return null;
                  const { x1, y1, x2, y2 } = edgeAnchors(source, target);
                  const midY = (y1 + y2) / 2;
                  const isBranch = edge.kind === 'branch';
                  const isSplit = edge.kind === 'split';
                  const isTrigger = edge.kind === 'trigger';
                  const edgeOverlay = overlay.edges.get(edge.id);
                  const thickness = edgeOverlay?.thickness ?? 0;
                  const strokeWidth = 1.5 + thickness * 3;
                  const color = isBranch
                    ? '#c9a227'
                    : isSplit
                      ? '#6ea8fe'
                      : isTrigger
                        ? 'rgba(110,168,254,0.55)'
                        : 'rgba(230,225,210,0.28)';
                  const dashed = isBranch || isSplit;
                  const path = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
                  const labelText = isBranch
                    ? humanizeCondition(edge.label)
                    : edge.label;
                  const labelClass = isSplit
                    ? 'bg-[#6ea8fe]/20 text-[#9cc2ff]'
                    : 'bg-brass/20 text-brass';
                  // Only label branch/split edges — trunk stays clean.
                  const showLabel =
                    Boolean(edge.label) && (isBranch || isSplit);
                  return (
                    <g key={edge.id} style={{ color }}>
                      <path
                        d={path}
                        fill="none"
                        stroke={color}
                        strokeWidth={strokeWidth}
                        strokeDasharray={dashed ? '5 4' : undefined}
                        markerEnd="url(#flow-arrow-dash)"
                        opacity={0.45 + thickness * 0.55}
                      />
                      {showLabel ? (
                        <foreignObject
                          x={(x1 + x2) / 2 - 60}
                          y={midY - 12}
                          width={120}
                          height={24}
                        >
                          <div className="flex justify-center">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${labelClass}`}
                            >
                              {labelText}
                              {edgeOverlay && edgeOverlay.conversionRate > 0 ? (
                                <span className="ml-1 text-bone/40">
                                  {pct(edgeOverlay.conversionRate)}
                                </span>
                              ) : null}
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
                {graph.nodes.map((node) => {
                  const nodeOverlay = overlay.nodes.get(node.id);
                  const isSelected = selectedNodeId === node.id;
                  const dimmed =
                    selectedNodeId !== null && !isSelected
                      ? 'opacity-55'
                      : 'opacity-100';

                  // ── TRIGGER (always compact) ──────────────────────────
                  if (node.kind === 'trigger') {
                    return (
                      <button
                        key={node.id}
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={() => selectNode(node.id)}
                        title={
                          canProgramTrigger
                            ? 'Click to program enrollment trigger'
                            : 'Enrollment trigger'
                        }
                        className={`absolute flex flex-col justify-center gap-1.5 rounded-xl border bg-[#141a2e] p-3 text-left shadow-lg transition ${dimmed} ${
                          isSelected
                            ? 'border-[#6ea8fe] ring-2 ring-[#6ea8fe]/40'
                            : 'border-[#6ea8fe]/50 hover:border-[#6ea8fe]'
                        }`}
                        style={{
                          left: node.x,
                          top: node.y,
                          width: FLOW_NODE_WIDTH,
                          height: FLOW_NODE_HEIGHT,
                        }}
                      >
                        <span className="absolute bottom-2 top-2 left-0 w-1 rounded-r bg-[#6ea8fe]" />
                        <span className="flex items-center gap-1.5 pl-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#9cc2ff]">
                          <Zap className="h-3 w-3" /> Trigger
                          {canProgramTrigger ? (
                            <Settings2 className="ml-auto h-3 w-3 text-[#9cc2ff]/70" />
                          ) : null}
                        </span>
                        <p className="line-clamp-1 pl-1.5 text-sm font-semibold text-bone">
                          {EMAIL_TRIGGER_LABELS[node.trigger ?? 'optin'] ||
                            node.label.replace(/^Trigger · /, '')}
                        </p>
                        <p className="line-clamp-1 pl-1.5 text-[10px] text-bone/50">
                          {node.triggerLocation || locationLine
                            ? `Fires on · ${node.triggerLocation || locationLine}`
                            : 'Subscribers enter here'}
                          {node.triggerBinding || bindingLine
                            ? ` · ${node.triggerBinding || bindingLine}`
                            : ''}
                        </p>
                        {triggerRecipeFamilyLabel(triggerEvent) ? (
                          <p className="line-clamp-1 pl-1.5 text-[10px] text-brass/70">
                            {triggerRecipeFamilyLabel(triggerEvent)}
                          </p>
                        ) : null}
                      </button>
                    );
                  }

                  // ── SPLIT ─────────────────────────────────────────────
                  if (node.kind === 'split') {
                    return (
                      <button
                        key={node.id}
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={() => selectNode(node.id)}
                        onDoubleClick={() => jumpToEmail(node.emailId)}
                        title="A/B variant — double-click to open parent email"
                        className={`absolute flex flex-col gap-1 rounded-xl border border-dashed bg-ink/90 p-3 text-left shadow-lg transition ${dimmed} ${
                          isSelected
                            ? 'border-[#6ea8fe] ring-2 ring-[#6ea8fe]/35'
                            : 'border-[#6ea8fe]/40 hover:border-[#6ea8fe]'
                        }`}
                        style={{
                          left: node.x,
                          top: node.y,
                          width: FLOW_NODE_WIDTH,
                          height: FLOW_NODE_HEIGHT,
                        }}
                      >
                        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#9cc2ff]">
                          <FlaskConical className="h-3 w-3" /> A/B
                          {typeof node.weight === 'number' ? (
                            <span className="ml-auto rounded bg-[#6ea8fe]/15 px-1.5 py-0.5 text-[#9cc2ff]">
                              {Math.round(node.weight)}%
                            </span>
                          ) : null}
                        </span>
                        <p className="line-clamp-2 text-xs font-medium text-bone/90">
                          {node.subject || (
                            <span className="italic text-bone/40">
                              (no subject yet)
                            </span>
                          )}
                        </p>
                      </button>
                    );
                  }

                  // ── EMAIL ─────────────────────────────────────────────
                  const isBranchNode = node.branch !== 'always';
                  // Prefer live stats row; fall back to overlay. Always show a
                  // stats cluster when either source has numbers so cards never
                  // look "empty" when analytics exist.
                  const emailStat = stats?.byEmail?.[node.emailId];
                  const cardOpen = emailStat
                    ? statOpenRate(emailStat)
                    : (nodeOverlay?.openRate ?? 0);
                  const cardCtr = emailStat
                    ? statCtr(emailStat)
                    : (nodeOverlay?.ctr ?? 0);
                  const cardSent =
                    emailStat?.sent ?? nodeOverlay?.sentCount ?? 0;
                  const cardDrop = nodeOverlay?.dropoffRate ?? 0;
                  const cardActive = nodeOverlay?.activeCount ?? 0;
                  const showCardStats =
                    Boolean(emailStat) ||
                    Boolean(nodeOverlay?.hasData) ||
                    cardSent > 0 ||
                    cardActive > 0;
                  const heatTint =
                    heatMapOn && (nodeOverlay?.hasData || Boolean(emailStat))
                      ? nodeOverlay?.heatTint ?? 'neutral'
                      : 'neutral';
                  const heatClasses = heatMapOn
                    ? heatTintClasses(heatTint)
                    : '';

                  return (
                    <button
                      key={node.id}
                      type="button"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => selectNode(node.id)}
                      onDoubleClick={() => jumpToEmail(node.emailId)}
                      title="Click for details · double-click to open in editor"
                      className={`absolute flex flex-col rounded-xl border bg-ink/95 p-3 text-left shadow-lg transition ${dimmed} ${
                        isSelected
                          ? 'border-brass ring-2 ring-brass/40 shadow-brass/10'
                          : isBranchNode
                            ? 'border-brass/40 hover:border-brass/70'
                            : heatClasses ||
                              'border-bone/15 hover:border-bone/35'
                      }`}
                      style={{
                        left: node.x,
                        top: node.y,
                        width: FLOW_NODE_WIDTH,
                        height: FLOW_NODE_HEIGHT,
                      }}
                    >
                      {/* Kind accent */}
                      <span
                        className={`absolute bottom-2 top-2 left-0 w-1 rounded-r ${
                          isBranchNode ? 'bg-brass' : 'bg-bone/25'
                        }`}
                      />

                      {/* Top meta */}
                      <div className="mb-1 flex items-center gap-1.5 pl-1.5">
                        <span className="rounded bg-brass/15 px-1.5 py-0.5 text-[10px] font-bold text-brass">
                          #{orderById.get(node.id) ?? '?'}
                        </span>
                        <span className="rounded bg-bone/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-bone/55">
                          {node.role}
                        </span>
                        {typeof node.abVariantCount === 'number' ? (
                          <span className="ml-auto inline-flex items-center gap-0.5 rounded bg-[#6ea8fe]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#9cc2ff]">
                            <FlaskConical className="h-2.5 w-2.5" />
                            {node.abVariantCount}
                          </span>
                        ) : null}
                        {node.hasImages &&
                        typeof node.abVariantCount !== 'number' ? (
                          <ImageIcon className="ml-auto h-3 w-3 text-bone/35" />
                        ) : node.hasImages ? (
                          <ImageIcon className="h-3 w-3 text-bone/35" />
                        ) : null}
                      </div>

                      {/* Subject */}
                      <p className="line-clamp-2 flex-1 pl-1.5 text-[13px] font-semibold leading-snug text-bone">
                        {node.subject || (
                          <span className="italic font-normal text-bone/40">
                            (no subject yet)
                          </span>
                        )}
                      </p>

                      {/* Footer: offset + compact stats */}
                      <div className="mt-1.5 flex items-center gap-1.5 pl-1.5 text-[10px]">
                        {node.sendOffset ? (
                          <span className="text-bone/40">{node.sendOffset}</span>
                        ) : null}
                        {isBranchNode ? (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-brass/15 px-1.5 py-0.5 font-semibold text-brass">
                            <GitBranch className="h-2.5 w-2.5" />
                            {humanizeCondition(node.branch)}
                          </span>
                        ) : null}
                        {showCardStats ? (
                          <span className="ml-auto flex items-center gap-1 font-semibold tabular-nums text-bone/65">
                            <span className="text-emerald-300">
                              {pct(cardOpen)}
                            </span>
                            <span className="text-bone/25">·</span>
                            <span className="text-sky-300">{pct(cardCtr)}</span>
                            <span className="text-bone/25">·</span>
                            <span className="text-bone/45">
                              {compactCount(cardSent)}
                            </span>
                            {cardActive > 0 ? (
                              <>
                                <span className="text-bone/25">·</span>
                                <span className="text-[#9cc2ff]">
                                  {compactCount(cardActive)} live
                                </span>
                              </>
                            ) : null}
                            {cardDrop > 0.1 ? (
                              <span className="ml-0.5 inline-flex items-center gap-0.5 text-red-300">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                {pct(cardDrop)}
                              </span>
                            ) : null}
                          </span>
                        ) : showStats ? (
                          <span className="ml-auto text-bone/30">—</span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Email / split detail inspector ─────────────────────────── */}
          {selectedNode &&
            (selectedNode.kind === 'email' || selectedNode.kind === 'split') &&
            (() => {
              const selStat = stats?.byEmail?.[selectedNode.emailId];
              const inspSent =
                selStat?.sent ?? selectedOverlay?.sentCount ?? 0;
              const inspActive = selectedOverlay?.activeCount ?? 0;
              const inspOpen = selStat
                ? statOpenRate(selStat)
                : (selectedOverlay?.openRate ?? 0);
              const inspCtr = selStat
                ? statCtr(selStat)
                : (selectedOverlay?.ctr ?? 0);
              const inspDrop = selectedOverlay?.dropoffRate ?? 0;
              const inspHas =
                Boolean(selStat) ||
                Boolean(selectedOverlay?.hasData) ||
                inspSent > 0 ||
                inspActive > 0;
              return (
                <div
                  className="absolute bottom-4 right-4 z-30 w-80 rounded-xl border border-bone/20 bg-ink/95 p-4 shadow-2xl backdrop-blur"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-bone/45">
                        {selectedNode.kind === 'split'
                          ? 'A/B variant'
                          : `Email #${orderById.get(selectedNode.id) ?? '?'} · ${selectedNode.role}`}
                      </span>
                      <p className="mt-0.5 line-clamp-2 text-sm font-semibold text-bone">
                        {selectedNode.subject || '(no subject)'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedNodeId(null)}
                      className="shrink-0 text-bone/40 hover:text-bone"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {inspHas ? (
                    <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-bone/5 p-2">
                        <p className="text-bone/40">Sent</p>
                        <p className="font-semibold text-bone">{inspSent}</p>
                      </div>
                      <div className="rounded-lg bg-bone/5 p-2">
                        <p className="text-bone/40">Active here</p>
                        <p className="font-semibold text-bone">{inspActive}</p>
                      </div>
                      <div className="rounded-lg bg-emerald-500/10 p-2">
                        <p className="text-bone/40">Open rate</p>
                        <p className="font-semibold text-emerald-300">
                          {pct(inspOpen)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-sky-500/10 p-2">
                        <p className="text-bone/40">CTR</p>
                        <p className="font-semibold text-sky-300">
                          {pct(inspCtr)}
                        </p>
                      </div>
                      {inspDrop > 0 ? (
                        <div className="col-span-2 rounded-lg bg-red-500/10 p-2">
                          <p className="text-bone/40">Drop-off</p>
                          <p className="font-semibold text-red-300">
                            {pct(inspDrop)}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mb-3 text-xs text-bone/40">
                      No engagement data yet for this email.
                    </p>
                  )}

                  {onSelectEmail ? (
                    <button
                      type="button"
                      onClick={() => jumpToEmail(selectedNode.emailId)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-brass/40 bg-brass/10 px-3 py-2 text-xs font-semibold text-brass transition hover:bg-brass/20"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open in editor
                    </button>
                  ) : null}
                </div>
              );
            })()}

          {/* ── Trigger inspector (always when trigger selected) ───────── */}
          {triggerInspectorOpen && selectedNode?.kind === 'trigger' && (
            <div
              className="absolute bottom-4 right-4 z-30 w-[22rem] rounded-xl border border-[#6ea8fe]/35 bg-ink/95 p-4 shadow-2xl backdrop-blur"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#9cc2ff]">
                  <Zap className="h-3.5 w-3.5" />{' '}
                  {canProgramTrigger ? 'Program trigger' : 'Enrollment trigger'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setTriggerInspectorOpen(false);
                    setSelectedNodeId(null);
                  }}
                  className="text-bone/40 hover:text-bone"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Live wiring sentence — always visible */}
              <p className="mb-3 rounded-lg bg-[#6ea8fe]/10 px-2.5 py-2 text-[11px] leading-relaxed text-bone/70">
                When{' '}
                <span className="font-semibold text-[#9cc2ff]">
                  {emailTriggerLabel(triggerEvent)}
                </span>{' '}
                fires on{' '}
                <span className="font-semibold text-bone/90">
                  {locationLine}
                </span>
                {bindingLine ? (
                  <>
                    {' '}
                    (
                    <span className="font-semibold text-brass">
                      {bindingLine}
                    </span>
                    )
                  </>
                ) : null}
                , enroll into this sequence.
              </p>

              {canProgramTrigger && onChangeTrigger ? (
                <>
                  <label className="mb-3 flex flex-col gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-bone/45">
                      Enrollment event
                    </span>
                    <select
                      value={triggerEvent}
                      onChange={(e) =>
                        onChangeTrigger(e.target.value as EmailTriggerEvent)
                      }
                      title={EMAIL_TRIGGER_DESCRIPTIONS[triggerEvent]}
                      className="w-full rounded-lg border border-[#6ea8fe]/40 bg-ink px-2.5 py-2 text-sm font-semibold text-bone outline-none focus:border-[#6ea8fe]"
                    >
                      {emailTriggerGroups().map((group) => (
                        <optgroup key={group.category} label={group.label}>
                          {group.events.map((t) => (
                            <option key={t} value={t}>
                              {EMAIL_TRIGGER_LABELS[t]}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <span className="text-[10px] leading-snug text-bone/45">
                      {EMAIL_TRIGGER_DESCRIPTIONS[triggerEvent]}
                    </span>
                  </label>

                  {onChangeTriggerConfig ? (
                    <div className="space-y-2.5 rounded-lg border border-[#6ea8fe]/20 bg-ink/40 p-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-bone/45">
                        Where it fires
                      </span>
                      {emailTriggerCategory(triggerEvent) === 'funnel' ? (
                        <>
                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] font-medium text-bone/55">
                              1 · Funnel page
                            </span>
                            <select
                              value={sequence.triggerConfig?.funnelPage ?? ''}
                              onChange={(e) =>
                                onChangeTriggerConfig({
                                  funnelPage: (e.target.value ||
                                    undefined) as EmailFunnelPage | undefined,
                                })
                              }
                              className="w-full rounded-md border border-[#6ea8fe]/35 bg-ink px-2.5 py-1.5 text-xs text-bone outline-none focus:border-[#6ea8fe]"
                            >
                              <option value="">Page · default</option>
                              {(
                                Object.entries(EMAIL_FUNNEL_PAGE_LABELS) as [
                                  EmailFunnelPage,
                                  string,
                                ][]
                              ).map(([page, label]) => (
                                <option key={page} value={page}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] font-medium text-bone/55">
                              2 · Offer
                            </span>
                            <select
                              value={sequence.triggerConfig?.offerSlug ?? ''}
                              onChange={(e) =>
                                onChangeTriggerConfig({
                                  offerSlug: e.target.value || undefined,
                                })
                              }
                              className="w-full rounded-md border border-[#6ea8fe]/35 bg-ink px-2.5 py-1.5 text-xs text-bone outline-none focus:border-[#6ea8fe]"
                            >
                              <option value="">No specific offer</option>
                              {(offerOptions ?? []).map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </>
                      ) : (
                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-medium text-bone/55">
                            1 · Content asset
                          </span>
                          <select
                            value={sequence.triggerConfig?.contentRef ?? ''}
                            onChange={(e) =>
                              onChangeTriggerConfig({
                                contentRef: e.target.value || undefined,
                              })
                            }
                            className="w-full rounded-md border border-[#6ea8fe]/35 bg-ink px-2.5 py-1.5 text-xs text-bone outline-none focus:border-[#6ea8fe]"
                          >
                            <option value="">No specific asset</option>
                            {(contentOptions ?? []).map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-[11px] text-bone/45">
                  {EMAIL_TRIGGER_DESCRIPTIONS[triggerEvent]}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="flex items-center gap-4 border-t border-bone/10 px-5 py-3 text-[11px] text-bone/40">
          <span className="flex items-center gap-1.5">
            <Zap className="h-3 w-3 text-[#9cc2ff]" /> trigger
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-5 bg-bone/40" /> trunk
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-5 border-t-2 border-dashed border-brass" />{' '}
            branch
          </span>
          <span className="flex items-center gap-1.5">
            <FlaskConical className="h-3 w-3 text-[#9cc2ff]" /> A/B
          </span>
          {heatMapOn && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />{' '}
              good
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />{' '}
              ok
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" />{' '}
              bad
            </span>
          )}
          <span className="ml-auto">
            {emailCount} email{emailCount === 1 ? '' : 's'} · {branchCount}{' '}
            branch{branchCount === 1 ? '' : 'es'}
            {splitCount ? ` · ${splitCount} A/B` : ''}
            {showEnrollment ? ` · ${totalEnrolledCount} enrolled` : ''}
          </span>
        </footer>
      </div>
    </div>
  );
}
