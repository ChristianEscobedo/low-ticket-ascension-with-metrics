'use client';

/**
 * The shared NodeCard primitive (roadmap UI/UX thread): ONE card + ONE
 * status vocabulary for every "what the run built" surface.
 *
 * THE ONE VOCABULARY — the build lifecycle, not performance:
 *   built   — the pipeline generated its content (emerald)
 *   draft   — created, waiting for its generation pass (amber)
 *   failed  — generation failed; open it and press Generate (red)
 *   pending — not started (bone)
 *
 * The email flow canvas deliberately does NOT use this vocabulary — its
 * cards carry PERFORMANCE health (good/ok/bad from open rates), a
 * different axis. Never mix the two: a green node here means "built",
 * not "doing well".
 *
 * Consumers: the admin funnel map (FunnelMapCard, with editor hrefs) and
 * the public share recap (SharedRunClient, labels only). Both render
 * byte-identical cards through this one component.
 */
import { clsx } from 'clsx';
import {
  CheckCircle2,
  CircleDashed,
  XCircle,
  PauseCircle,
  ExternalLink,
} from 'lucide-react';
import type { FunnelNodeStatus } from '@/lib/mothermode/research/funnelMap';

const STATUS_STYLE: Record<
  FunnelNodeStatus,
  { ring: string; text: string; title: string }
> = {
  built: {
    ring: 'border-emerald-400/40 bg-emerald-400/10',
    text: 'text-emerald-300',
    title: 'Built — the pipeline generated its content',
  },
  draft: {
    ring: 'border-amber-400/40 bg-amber-400/10',
    text: 'text-amber-300',
    title: 'Draft — created, waiting for its generation pass',
  },
  failed: {
    ring: 'border-red-400/40 bg-red-400/10',
    text: 'text-red-300',
    title: 'Generation failed — open it and press Generate',
  },
  pending: {
    ring: 'border-bone/15 bg-bone/[0.04]',
    text: 'text-bone/40',
    title: 'Pending',
  },
};

/** The card's class string for a status (tests pin the vocabulary here). */
export function nodeStatusClasses(status: FunnelNodeStatus): string {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
  return `${s.ring} ${s.text}`;
}

/** The status's hover title (the honest one-liner). */
export function nodeStatusTitle(status: FunnelNodeStatus): string {
  return (STATUS_STYLE[status] ?? STATUS_STYLE.pending).title;
}

export function NodeStatusGlyph({ status }: { status: FunnelNodeStatus }) {
  if (status === 'built') return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (status === 'failed') return <XCircle className="h-3.5 w-3.5" />;
  if (status === 'draft') return <PauseCircle className="h-3.5 w-3.5" />;
  return <CircleDashed className="h-3.5 w-3.5" />;
}

/**
 * The card. `href` renders a link with the external-link affordance
 * (admin editor deep links); without it the card is a plain label
 * (the public recap — read-only by definition).
 */
export default function NodeCard({
  status,
  label,
  href,
  className,
}: {
  status: FunnelNodeStatus;
  label: string;
  href?: string;
  className?: string;
}) {
  const classes = clsx(
    'inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors',
    nodeStatusClasses(status),
    href && 'group hover:brightness-125',
    className,
  );
  const title = nodeStatusTitle(status);
  const body = (
    <>
      <NodeStatusGlyph status={status} />
      <span className="truncate">{label}</span>
      {href && (
        <ExternalLink className="h-3 w-3 shrink-0 opacity-50 group-hover:opacity-90" />
      )}
    </>
  );
  if (href) {
    return (
      <a href={href} title={title} className={classes}>
        {body}
      </a>
    );
  }
  return (
    <span title={title} className={classes}>
      {body}
    </span>
  );
}
