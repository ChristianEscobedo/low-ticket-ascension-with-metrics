'use client';

/**
 * The node peek — click a node on the System Map and it opens into a
 * right-side panel showing the REAL thing, not a description of it: a page or
 * funnel renders the live page itself (an iframe), a content node renders the
 * actual social post (the Content Hub's platform preview + the final-cut
 * video), an email node renders the actual email's styled HTML. The wiring
 * diagram letting you inspect a single part — and see it — without leaving
 * the canvas.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, ExternalLink, Eye, Loader2 } from 'lucide-react';
import type { SystemMapNode } from '@/lib/mothermode/systemMap';
import { PlanPiecePreview } from '@/components/mothermode/planner/PlanPiecePreview';

const KIND_LABEL: Record<SystemMapNode['kind'], string> = {
  funnel: 'Funnel',
  page: 'Page',
  email: 'Email sequence',
  link: 'Tracked link',
  content: 'Content',
};

const STATUS_LABEL: Record<SystemMapNode['status'], string> = {
  built: 'Live',
  draft: 'Draft',
  pending: 'Proposed — builds on approve',
};

/** A page/funnel renders the live page itself, scaled to fit the panel. */
function LivePageFrame({ href, label }: { href: string; label: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-bone/15 bg-white">
      <div
        className="pointer-events-none origin-top-left"
        style={{ width: '1000px', height: '560px', transform: 'scale(0.268)' }}
      >
        <iframe
          src={href}
          title={label}
          className="h-full w-full border-0"
          tabIndex={-1}
        />
      </div>
      <p className="bg-ink px-2 py-1 text-[9px] text-bone/40">
        The live page — read-only here; open it to interact.
      </p>
    </div>
  );
}

/** An email node renders the sequence's first email as its real styled HTML. */
function EmailVisual({ node }: { node: SystemMapNode }) {
  const [html, setHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  // The kit id rides the node's href (`/admin/email-marketing?kit=<id>`).
  const kitId = node.href?.match(/[?&]kit=([^&]+)/)?.[1] ?? null;

  useEffect(() => {
    if (!kitId) return;
    let alive = true;
    void (async () => {
      try {
        const res = await fetch('/api/admin/mothermode-email', { cache: 'no-store' });
        const json = await res.json();
        const kit = (json.items ?? []).find((k: { id: string }) => k.id === kitId);
        const first = kit?.sequence?.emails?.[0];
        const body = first?.bodyHtml || first?.bodyText || '';
        if (!alive) return;
        if (body) {
          setHtml(
            first.bodyHtml
              ? body
              : `<div style="font-family:sans-serif;padding:24px;white-space:pre-wrap">${body}</div>`,
          );
        } else {
          setFailed(true);
        }
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [kitId]);

  if (!kitId || failed) {
    return (
      <p className="rounded-lg border border-bone/10 bg-bone/[0.03] px-3 py-2 text-[10px] text-bone/45">
        Open the sequence in Email Marketing to read the emails.
      </p>
    );
  }
  if (!html) {
    return (
      <div className="flex items-center gap-2 py-4 text-[10px] text-bone/40">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading the email…
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-bone/15 bg-white">
      <iframe
        srcDoc={html}
        title={node.label}
        sandbox=""
        className="h-[300px] w-full border-0 bg-white"
      />
      <p className="bg-ink px-2 py-1 text-[9px] text-bone/40">
        The first email in the sequence, as it lands in an inbox.
      </p>
    </div>
  );
}

/** The real thing, per kind — the peek's star. */
function NodeVisual({ node }: { node: SystemMapNode }) {
  // A page or a published funnel renders the live page itself.
  if ((node.kind === 'page' || node.kind === 'funnel') && node.liveHref) {
    return <LivePageFrame href={node.liveHref} label={node.label} />;
  }
  // A content node renders the actual post (the platform preview + the video).
  if (node.kind === 'content' && node.pieceId) {
    return (
      <div className="overflow-hidden rounded-lg border border-bone/15 bg-noir px-1 py-1">
        <PlanPiecePreview pieceId={node.pieceId} offerSlug={node.offerSlug ?? ''} />
      </div>
    );
  }
  // An email node renders the sequence's first email.
  if (node.kind === 'email') {
    return <EmailVisual node={node} />;
  }
  return null;
}

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
    <div className="absolute right-0 top-0 z-20 flex h-full w-[320px] flex-col border-l border-bone/10 bg-ink/98 shadow-2xl">
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
        {/* the real thing — the live page, the actual post, the real email */}
        {!isBlueprint && (
          <div className="mb-3">
            <NodeVisual node={node} />
          </div>
        )}

        {node.sub && (
          <p className="text-[10px] uppercase tracking-wide text-bone/35">
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
