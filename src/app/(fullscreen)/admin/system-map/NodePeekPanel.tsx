'use client';

/**
 * The node peek — click a node on the System Map and it expands into a
 * right-side detail panel: what the node IS (the post, the email sequence,
 * the page, the video, the link), its live metrics, and the way in (open it
 * in its editor, or view it live). This is the map's "zoom into one node"
 * read — the wiring diagram letting you inspect a single part without leaving
 * the canvas.
 */
import Link from 'next/link';
import { X, ExternalLink, Eye } from 'lucide-react';
import type { SystemMapNode } from '@/lib/mothermode/systemMap';

const KIND_LABEL: Record<SystemMapNode['kind'], string> = {
  funnel: 'Funnel',
  page: 'Page',
  email: 'Email sequence',
  link: 'Tracked link',
  content: 'Content',
};

/** A one-line read on what this node is, per kind. */
const KIND_BLURB: Record<SystemMapNode['kind'], string> = {
  funnel: 'The whole funnel — its pages stack under it, its emails fire off them.',
  page: 'A page in the funnel — one step a visitor moves through.',
  email: 'The sequence that fires on this step — the nurture that follows.',
  link: 'The tracked link — every click through it is counted and attributed.',
  content: 'The post / video / ad feeding traffic into the system.',
};

const STATUS_LABEL: Record<SystemMapNode['status'], string> = {
  built: 'Live',
  draft: 'Draft',
  pending: 'Proposed — builds on approve',
};

export default function NodePeekPanel({
  node,
  onClose,
}: {
  node: SystemMapNode | null;
  onClose: () => void;
}) {
  if (!node) return null;
  const isBlueprint = !!node.blueprintId;
  return (
    <div className="absolute right-0 top-0 z-20 flex h-full w-[300px] flex-col border-l border-bone/10 bg-ink/98 shadow-2xl">
      <div className="flex items-start justify-between gap-2 border-b border-bone/10 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[9px] uppercase tracking-widest text-bone/40">
            {KIND_LABEL[node.kind]}
          </p>
          <h3 className="mt-0.5 truncate text-sm font-semibold text-bone">
            {node.label}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded p-1 text-bone/40 hover:text-bone"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <p className="text-[11px] leading-relaxed text-bone/55">
          {KIND_BLURB[node.kind]}
        </p>

        {node.sub && (
          <p className="mt-3 text-[10px] uppercase tracking-wide text-bone/35">
            {node.sub}
          </p>
        )}

        {/* the live metrics the node carries */}
        {node.metrics.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {node.metrics.map((m) => (
              <span
                key={m}
                className="rounded-md bg-bone/[0.08] px-2 py-1 text-[10px] font-semibold text-bone/80"
              >
                {m}
              </span>
            ))}
          </div>
        )}

        <p className="mt-4 border-t border-bone/10 pt-3 text-[10px] uppercase tracking-wide text-bone/40">
          Status
        </p>
        <p
          className={`mt-1 text-[11px] font-semibold ${
            node.status === 'built'
              ? 'text-emerald-300'
              : node.status === 'draft'
                ? 'text-amber-300'
                : 'text-bone/60'
          }`}
        >
          {STATUS_LABEL[node.status]}
        </p>
        {isBlueprint && (
          <p className="mt-2 rounded-lg border border-bone/15 bg-bone/[0.04] px-2.5 py-1.5 text-[10px] leading-relaxed text-bone/50">
            This is a proposed node in a blueprint — it isn't a real record yet.
            Approve the blueprint (the ✓ on its funnel) to build it.
          </p>
        )}
      </div>

      {/* the way in — open it in its editor, or view it live */}
      {!isBlueprint && (node.href || node.liveHref) && (
        <div className="space-y-2 border-t border-bone/10 px-4 py-3">
          {node.href && (
            <Link
              href={node.href}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-brass/50 bg-brass/15 px-3 py-2 text-xs font-semibold text-brass hover:bg-brass/25"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open in its editor
            </Link>
          )}
          {node.liveHref && (
            <Link
              href={node.liveHref}
              target="_blank"
              className="flex items-center justify-center gap-1.5 rounded-lg border border-bone/15 px-3 py-2 text-xs text-bone/70 hover:bg-bone/10"
            >
              <Eye className="h-3.5 w-3.5" /> View it live
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
