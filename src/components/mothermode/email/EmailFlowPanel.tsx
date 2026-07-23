'use client';

/**
 * Email Marketing Kit — read-only flow canvas (Phase 1).
 *
 * Renders the branching structure that the stored `EmailSequence` already
 * implies (see `sequenceToFlowGraph`): the linear trunk becomes a vertical
 * spine and any conditional email forks off with a labeled edge. Nodes and
 * edge positions come entirely from the pure derivation in `flow.ts`, so this
 * component is a thin presentational layer — no external layout library.
 *
 * Zero schema changes: it reads what's there. Clicking a node calls
 * `onSelectEmail`, which the editor uses to scroll the matching email card into
 * view. React Flow / dagre can be dropped in later without touching `flow.ts`.
 */
import { useMemo } from 'react';
import {
  X,
  Image as ImageIcon,
  GitBranch,
  Zap,
  FlaskConical,
} from 'lucide-react';
import {
  sequenceToFlowGraph,
  FLOW_NODE_WIDTH,
  FLOW_NODE_HEIGHT,
  hasAnyStats,
  statFor,
  openRate,
  ctr,
  EMAIL_TRIGGER_LABELS,
  EMAIL_TRIGGER_DESCRIPTIONS,
  emailTriggerGroups,
  emailTriggerLocationLabel,
  emailTriggerCategory,
  EMAIL_FUNNEL_PAGE_LABELS,

  type EmailSequence,
  type EmailTriggerEvent,
  type EmailFunnelPage,
  type EmailTriggerConfig,
  type FlowNode,

  type SequenceStats,
} from '@/lib/mothermode/email';


interface Props {
  open: boolean;
  onClose: () => void;
  sequence: EmailSequence;
  /** Called with the clicked email id so the editor can focus its card. */
  onSelectEmail?: (emailId: string) => void;
  /**
   * Optional engagement stats (Phase 4). When present and non-empty, email nodes
   * overlay open%/CTR badges. Omitted/empty → the canvas renders exactly as it
   * did before analytics existed.
   */
  stats?: SequenceStats | null;
  /**
   * When provided, the entry-trigger node becomes an editable picker so the
   * enrollment event (opt-in, purchase, cart abandon, refund, tag added) can be
   * assigned right on the canvas. Omitted → the trigger node is read-only.
   */
  onChangeTrigger?: (trigger: EmailTriggerEvent) => void;
  /** Offer options for the trigger→offer waterfall (funnel triggers). */
  offerOptions?: { id: string; label: string }[];
  /** Content-asset options for the content-trigger waterfall. */
  contentOptions?: { id: string; label: string }[];
  /**
   * When provided alongside offer/content options, the trigger node gains the
   * same cascading (waterfall) mapping dropdowns as the editor so the funnel
   * page + offer (or content asset) can be assigned right on the canvas.
   */
  onChangeTriggerConfig?: (patch: Partial<EmailTriggerConfig>) => void;
}



const CANVAS_PADDING = 48;

/** Format a [0,1] ratio as a compact percentage string ("42%"). */
function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}


/** Humanize a branch condition for the edge label ("opened" → "if opened"). */
function humanizeCondition(condition: string): string {
  return condition ? `if ${condition.replace(/-/g, ' ')}` : '';
}

/** Center-bottom / center-top anchor points for an edge between two nodes. */
function edgeAnchors(source: FlowNode, target: FlowNode) {
  return {
    x1: source.x + FLOW_NODE_WIDTH / 2,
    y1: source.y + FLOW_NODE_HEIGHT,
    x2: target.x + FLOW_NODE_WIDTH / 2,
    y2: target.y,
  };
}

export default function EmailFlowPanel({
  open,
  onClose,
  sequence,
  onSelectEmail,
  stats,
  onChangeTrigger,
  offerOptions,
  contentOptions,
  onChangeTriggerConfig,
}: Props) {


  const graph = useMemo(() => sequenceToFlowGraph(sequence), [sequence]);

  // Only overlay engagement when there's real volume; otherwise the canvas
  // renders exactly as it did before analytics existed (empty-state note below).
  const showStats = useMemo(() => hasAnyStats(stats), [stats]);


  // 1-based position of each email in the stored order, for a stable label.
  const orderById = useMemo(() => {
    const map = new Map<string, number>();
    (sequence?.emails ?? []).forEach((e, i) => map.set(e.id, i + 1));
    return map;
  }, [sequence]);

  const nodeById = useMemo(() => {
    const map = new Map<string, FlowNode>();
    graph.nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [graph]);

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

  if (!open) return null;

  const hasEmails = emailCount > 0;


  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close flow view"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      {/* Panel */}
      <div className="relative ml-auto flex h-full w-full max-w-2xl flex-col border-l border-bone/15 bg-ink shadow-2xl">

        <header className="flex items-center justify-between gap-3 border-b border-bone/10 px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg text-bone">
              <GitBranch className="h-4 w-4 text-brass" />
              Sequence flow
            </h2>
            <p className="text-xs text-bone/40">
              Map of your trigger, trunk, branches, and A/B splits. Click a node
              to jump to its email.
            </p>

          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-bone/20 p-2 text-bone/70 transition hover:border-brass/50 hover:text-bone"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="relative flex-1 overflow-auto bg-ink/60 [background-image:radial-gradient(circle,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:22px_22px]">
          {!hasEmails ? (
            <div className="flex h-full items-center justify-center p-10 text-center text-sm text-bone/40">
              No emails yet. Generate a sequence or an outline, then reopen the
              flow view.
            </div>
          ) : (
            <div
              className="relative"
              style={{ width, height, minWidth: '100%', minHeight: '100%' }}
            >
              {/* Edges */}
              <svg
                className="pointer-events-none absolute inset-0"
                width={width}
                height={height}
              >
                <defs>
                  <marker
                    id="flow-arrow"
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
                <g transform={`translate(${CANVAS_PADDING}, ${CANVAS_PADDING})`}>
                  {graph.edges.map((edge) => {
                    const source = nodeById.get(edge.source);
                    const target = nodeById.get(edge.target);
                    if (!source || !target) return null;
                    const { x1, y1, x2, y2 } = edgeAnchors(source, target);
                    const midY = (y1 + y2) / 2;
                    const isBranch = edge.kind === 'branch';
                    const isSplit = edge.kind === 'split';
                    const isTrigger = edge.kind === 'trigger';
                    const color = isBranch
                      ? '#c9a227'
                      : isSplit
                        ? '#6ea8fe'
                        : isTrigger
                          ? 'rgba(110,168,254,0.55)'
                          : 'rgba(230,225,210,0.35)';
                    const dashed = isBranch || isSplit;
                    // Vertical-ish cubic bezier so branch/split edges bow outward.
                    const path = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
                    // Branch labels read "if opened"; split labels are raw ("60%").
                    const labelText = isBranch
                      ? humanizeCondition(edge.label)
                      : edge.label;
                    const labelClass = isSplit
                      ? 'bg-[#6ea8fe]/20 text-[#9cc2ff]'
                      : 'bg-brass/20 text-brass';
                    return (
                      <g key={edge.id} style={{ color }}>
                        <path
                          d={path}
                          fill="none"
                          stroke={color}
                          strokeWidth={dashed ? 2 : 1.5}
                          strokeDasharray={dashed ? '5 4' : undefined}
                          markerEnd="url(#flow-arrow)"
                        />
                        {edge.label ? (
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
                              </span>
                            </div>
                          </foreignObject>
                        ) : null}
                      </g>
                    );

                  })}
                </g>
              </svg>

              {/* Nodes */}
              <div
                className="absolute inset-0"
                style={{
                  transform: `translate(${CANVAS_PADDING}px, ${CANVAS_PADDING}px)`,
                }}
              >
                {graph.nodes.map((node) => {
                  // TRIGGER — the entry event. Read-only by default; when the
                  // editor passes onChangeTrigger it becomes an inline picker so
                  // the enrollment event can be assigned right on the canvas.
                  if (node.kind === 'trigger') {
                    return (
                      <div
                        key={node.id}
                        className={`absolute flex flex-col gap-2 rounded-xl border border-[#6ea8fe]/60 bg-[#141a2e] p-3 text-left shadow-lg ${
                          onChangeTrigger ? "" : "justify-center"
                        }`}
                        style={{
                          left: node.x,
                          top: node.y,
                          width: onChangeTrigger
                            ? FLOW_NODE_WIDTH + 72
                            : FLOW_NODE_WIDTH,
                          ...(onChangeTrigger
                            ? { minHeight: FLOW_NODE_HEIGHT, zIndex: 20 }
                            : { height: FLOW_NODE_HEIGHT }),
                        }}
                      >
                        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#9cc2ff]">
                          <Zap className="h-3 w-3" /> Enrollment trigger
                        </span>
                        {onChangeTrigger ? (
                          <>
                            <select
                              value={node.trigger ?? 'optin'}
                              onChange={(e) =>
                                onChangeTrigger(
                                  e.target.value as EmailTriggerEvent,
                                )
                              }
                              title={
                                EMAIL_TRIGGER_DESCRIPTIONS[
                                  node.trigger ?? 'optin'
                                ]
                              }
                              className="w-full rounded-lg border border-[#6ea8fe]/50 bg-ink px-2.5 py-1.5 text-sm font-semibold text-bone outline-none transition focus:border-[#6ea8fe]"
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
                            <div className="flex flex-col gap-1 text-[10px] leading-snug text-bone/60">
                              <span className="w-fit rounded bg-[#6ea8fe]/20 px-1.5 py-0.5 font-semibold text-[#9cc2ff]">
                                {node.triggerLocation ||
                                  emailTriggerLocationLabel(node.trigger ?? 'optin')}
                              </span>
                              <span className="line-clamp-2">
                                {EMAIL_TRIGGER_DESCRIPTIONS[node.trigger ?? 'optin']}
                              </span>
                            </div>
                            {node.triggerBinding ? (
                              <span className="line-clamp-1 w-fit rounded bg-brass/20 px-1.5 py-0.5 text-[10px] font-medium text-brass">
                                {node.triggerBinding}
                              </span>
                            ) : null}
                            {/* Waterfall mapping — same cascade as the editor:
                                funnel triggers → page + offer; content triggers
                                → content asset. Only shown when the editor wires
                                onChangeTriggerConfig so the read-only canvas is
                                unaffected. */}
                            {onChangeTriggerConfig ? (
                              <div className="flex flex-col gap-1.5 rounded-lg border border-[#6ea8fe]/25 bg-ink/50 p-2">
                                <span className="text-[9px] font-semibold uppercase tracking-wide text-bone/45">
                                  Where it fires
                                </span>
                                {emailTriggerCategory(node.trigger ?? 'optin') ===
                                'funnel' ? (
                                  <>
                                    <label className="flex flex-col gap-0.5">
                                      <span className="text-[9px] font-medium text-bone/45">
                                        Funnel page
                                      </span>
                                      <select
                                        value={
                                          sequence.triggerConfig?.funnelPage ?? ''
                                        }
                                        onChange={(e) =>
                                          onChangeTriggerConfig({
                                            funnelPage:
                                              (e.target.value || undefined) as
                                                | EmailFunnelPage
                                                | undefined,
                                          })
                                        }
                                        className="w-full rounded-md border border-[#6ea8fe]/40 bg-ink px-2 py-1 text-[11px] text-bone outline-none focus:border-[#6ea8fe]"
                                      >
                                        <option value="">Page · default</option>
                                        {(
                                          Object.entries(
                                            EMAIL_FUNNEL_PAGE_LABELS,
                                          ) as [EmailFunnelPage, string][]
                                        ).map(([page, label]) => (
                                          <option key={page} value={page}>
                                            {label}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    <label className="flex flex-col gap-0.5">
                                      <span className="text-[9px] font-medium text-bone/45">
                                        Offer
                                      </span>
                                      <select
                                        value={
                                          sequence.triggerConfig?.offerSlug ?? ''
                                        }
                                        onChange={(e) =>
                                          onChangeTriggerConfig({
                                            offerSlug: e.target.value || undefined,
                                          })
                                        }
                                        className="w-full rounded-md border border-[#6ea8fe]/40 bg-ink px-2 py-1 text-[11px] text-bone outline-none focus:border-[#6ea8fe]"
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
                                  <label className="flex flex-col gap-0.5">
                                    <span className="text-[9px] font-medium text-bone/45">
                                      Content asset
                                    </span>
                                    <select
                                      value={
                                        sequence.triggerConfig?.contentRef ?? ''
                                      }
                                      onChange={(e) =>
                                        onChangeTriggerConfig({
                                          contentRef: e.target.value || undefined,
                                        })
                                      }
                                      className="w-full rounded-md border border-[#6ea8fe]/40 bg-ink px-2 py-1 text-[11px] text-bone outline-none focus:border-[#6ea8fe]"
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

                          <>
                            <p className="text-sm font-medium text-bone/90">
                              {node.label.replace(/^Trigger · /, '')}
                            </p>
                            {node.triggerBinding ? (
                              <span className="line-clamp-1 rounded bg-brass/15 px-1.5 py-0.5 text-[10px] font-medium text-brass">
                                {node.triggerBinding}
                              </span>
                            ) : null}
                            <span className="text-[10px] text-bone/40">
                              {node.triggerLocation
                                ? `Enters at · ${node.triggerLocation}`
                                : 'Subscribers enter here'}
                            </span>
                          </>
                        )}

                      </div>
                    );
                  }


                  // SPLIT — one A/B variant; clicking focuses the parent email.
                  if (node.kind === 'split') {
                    return (
                      <button
                        key={node.id}
                        type="button"
                        onClick={() => onSelectEmail?.(node.emailId)}
                        title="Jump to the email being split-tested"
                        className="absolute flex flex-col gap-1 rounded-xl border border-[#6ea8fe]/40 bg-ink/90 p-3 text-left shadow-lg transition hover:-translate-y-0.5 hover:border-[#6ea8fe] hover:shadow-xl"
                        style={{
                          left: node.x,
                          top: node.y,
                          width: FLOW_NODE_WIDTH,
                          height: FLOW_NODE_HEIGHT,
                        }}
                      >
                        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#9cc2ff]">
                          <FlaskConical className="h-3 w-3" /> A/B variant
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

                  // EMAIL — the default node.
                  const isBranch = node.branch !== 'always';
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => onSelectEmail?.(node.emailId)}
                      title="Jump to this email"
                      className={`absolute flex flex-col gap-1 rounded-xl border bg-ink/90 p-3 text-left shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl ${
                        isBranch
                          ? 'border-brass/50 hover:border-brass'
                          : 'border-bone/15 hover:border-bone/40'
                      }`}
                      style={{
                        left: node.x,
                        top: node.y,
                        width: FLOW_NODE_WIDTH,
                        height: FLOW_NODE_HEIGHT,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-bone/10 px-1.5 py-0.5 text-[10px] font-semibold text-brass">
                          #{orderById.get(node.id) ?? '?'}
                        </span>
                        <span className="rounded bg-bone/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-bone/60">
                          {node.role}
                        </span>
                        {node.sendOffset ? (
                          <span className="text-[10px] text-bone/40">
                            {node.sendOffset}
                          </span>
                        ) : null}
                        {node.hasImages ? (
                          <ImageIcon className="h-3 w-3 text-bone/40" />
                        ) : null}
                        {typeof node.abVariantCount === 'number' ? (
                          <span className="ml-auto inline-flex items-center gap-1 rounded bg-[#6ea8fe]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#9cc2ff]">
                            <FlaskConical className="h-2.5 w-2.5" />
                            {node.abVariantCount}
                          </span>
                        ) : null}
                      </div>
                      <p className="line-clamp-2 text-xs font-medium text-bone/90">
                        {node.subject || (
                          <span className="italic text-bone/40">
                            (no subject yet)
                          </span>
                        )}
                      </p>
                      {showStats
                        ? (() => {
                            const stat = statFor(stats, node.emailId);
                            if (stat.sent <= 0) return null;
                            return (
                              <span className="mt-auto flex items-center gap-1.5 text-[10px] font-semibold text-bone/70">
                                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300">
                                  {pct(openRate(stat))} open
                                </span>
                                <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-sky-300">
                                  {pct(ctr(stat))} CTR
                                </span>
                              </span>
                            );
                          })()
                        : null}
                      {isBranch ? (
                        <span className="mt-auto inline-flex w-fit items-center gap-1 rounded-full bg-brass/15 px-2 py-0.5 text-[10px] font-semibold text-brass">
                          <GitBranch className="h-2.5 w-2.5" />
                          {humanizeCondition(node.branch)}
                        </span>
                      ) : null}
                    </button>
                  );
                })}


              </div>
            </div>
          )}
        </div>

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
            <FlaskConical className="h-3 w-3 text-[#9cc2ff]" /> A/B split
          </span>
          <span className="ml-auto">
            {emailCount} email{emailCount === 1 ? '' : 's'} · {branchCount} branch
            {branchCount === 1 ? '' : 'es'}
            {splitCount ? ` · ${splitCount} A/B` : ''}
          </span>
        </footer>

      </div>
    </div>
  );
}
