'use client';

/**
 * The node peek — click a node on the System Map and it opens into a wide
 * right-side sheet showing the REAL thing, not a description of it: a page or
 * funnel renders the live page itself (an iframe), a content node renders the
 * actual social post (the Content Hub's platform preview + the final-cut
 * video), an email node renders the actual email's styled HTML. Below the
 * visual: the node's connections (what feeds it, what it feeds) and its
 * details. The wiring diagram letting you inspect a single part — and see it
 * — without leaving the canvas.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, ExternalLink, Eye, Loader2, ArrowDown, ArrowUp } from 'lucide-react';
import type { SystemMap, SystemMapNode } from '@/lib/mothermode/systemMap';
import { PlanPiecePreview } from '@/components/mothermode/planner/PlanPiecePreview';
import { PlatformIcon } from '@/components/mothermode/content/PlatformIcon';
import {
  canonicalPlatform,
  platformLabel,
} from '@/lib/mothermode/planner/platformGlyph';

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

/** A page/funnel renders the live page itself, scaled to fit the sheet. */
function LivePageFrame({ href, label }: { href: string; label: string }) {
  // Render the page at a DESKTOP width (1280 — above the page's `lg`
  // breakpoint, so the two-column layout holds: headline left, opt-in right),
  // scaled to fit the sheet. The outer box's height is the SCALED height —
  // transform doesn't change the layout box, so without it the box stays the
  // full page height and the page reads as "cut off" with white space below.
  const PAGE_W = 1280;
  const SCALE = 400 / PAGE_W; // fit the sheet's ~400px content width
  // Tall enough to show ~2 folds — the headline AND the opt-in beside it.
  const PAGE_H = 1600;
  return (
    <div className="overflow-hidden rounded-xl border border-bone/15 bg-white shadow-inner">
      <div
        className="relative w-full overflow-hidden"
        style={{ height: `${PAGE_H * SCALE}px` }}
      >
        <div
          className="pointer-events-none absolute left-0 top-0 origin-top-left"
          style={{
            width: `${PAGE_W}px`,
            height: `${PAGE_H}px`,
            transform: `scale(${SCALE})`,
          }}
        >
          <iframe
            src={href}
            title={label}
            className="h-full w-full border-0"
            tabIndex={-1}
          />
        </div>
      </div>
      <p className="bg-ink px-3 py-1.5 text-[9px] text-bone/40">
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
      <p className="rounded-xl border border-bone/10 bg-bone/[0.03] px-3 py-2.5 text-[10px] text-bone/45">
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
    <div className="overflow-hidden rounded-xl border border-bone/15 bg-white shadow-inner">
      <iframe
        srcDoc={html}
        title={node.label}
        sandbox=""
        className="h-[340px] w-full border-0 bg-white"
      />
      <p className="bg-ink px-3 py-1.5 text-[9px] text-bone/40">
        The first email in the sequence, as it lands in an inbox.
      </p>
    </div>
  );
}

/** The real thing, per kind — the peek's star. Never a blank frame. */
function NodeVisual({ node }: { node: SystemMapNode }) {
  // A page or a published funnel renders the live page itself.
  if ((node.kind === 'page' || node.kind === 'funnel') && node.liveHref) {
    return <LivePageFrame href={node.liveHref} label={node.label} />;
  }
  // A content node renders the actual post (the platform preview + the video).
  if (node.kind === 'content' && node.pieceId) {
    return (
      <div className="overflow-hidden rounded-xl border border-bone/15 bg-noir px-1 py-1">
        <PlanPiecePreview pieceId={node.pieceId} offerSlug={node.offerSlug ?? ''} />
      </div>
    );
  }
  // An email node renders the sequence's first email.
  if (node.kind === 'email') {
    return <EmailVisual node={node} />;
  }
  // A draft page/funnel (no live page yet) or a link says so plainly.
  if ((node.kind === 'page' || node.kind === 'funnel') && !node.liveHref) {
    return (
      <p className="rounded-xl border border-bone/10 bg-bone/[0.03] px-3 py-2.5 text-[10px] text-bone/45">
        Not live yet — publish the funnel to see the real page here.
      </p>
    );
  }
  return null;
}

/** A content node's action: create the tracked link that wires it into a
    funnel (content → link → page), so its clicks and sales count. Detects
    when it's already linked. */
function ContentActions({
  node,
  map,
  onChanged,
}: {
  node: SystemMapNode;
  map: SystemMap | null;
  onChanged?: () => void;
}) {
  const [funnelId, setFunnelId] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  // The content_plan row id rides the node id (`content:<id>`) — the link's
  // piece_id stores it.
  const pieceRowId = node.id.slice('content:'.length);
  // Detection: a content → link edge means it already has its own link.
  const linkedIds = map
    ? map.edges.filter((e) => e.from === node.id && e.to.startsWith('link:')).map((e) => e.to)
    : [];
  const funnels = map ? map.nodes.filter((n) => n.kind === 'funnel') : [];

  // The post HAS its own link — show the tracked URL it carries, with a copy
  // button. This is the post's link, not a separate thing it connects to.
  if (linkedIds.length > 0) {
    const linkNode = map?.nodes.find((n) => n.id === linkedIds[0]);
    const code = linkNode?.label.match(/\/go\/(\S+)/)?.[1] ?? null;
    const url =
      code && typeof window !== 'undefined'
        ? `${window.location.origin}/go/${code}`
        : null;
    return (
      <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2.5">
        <p className="text-[10px] uppercase tracking-wide text-emerald-300/80">
          This post's tracked link
        </p>
        {url ? (
          <div className="mt-1.5 flex items-center gap-1.5">
            <code className="min-w-0 flex-1 truncate rounded bg-ink px-2 py-1.5 text-[10px] text-emerald-200">
              {url}
            </code>
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(url)}
              className="shrink-0 rounded border border-emerald-400/40 px-2 py-1.5 text-[9px] font-semibold text-emerald-300 hover:bg-emerald-400/20"
            >
              Copy
            </button>
          </div>
        ) : (
          <p className="mt-1 text-[10px] text-emerald-300">
            This post has {linkedIds.length} tracked link{linkedIds.length === 1 ? '' : 's'}.
          </p>
        )}
        <p className="mt-1.5 text-[9px] leading-relaxed text-bone/40">
          Share this URL in the post — everyone who taps it lands on the funnel,
          and the clicks and sales count back to this post.
        </p>
      </div>
    );
  }

  const create = async () => {
    if (!funnelId || busy) return;
    setBusy(true);
    setDone(null);
    try {
      const res = await fetch('/api/admin/mothermode-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createLink',
          pieceId: pieceRowId,
          funnelId,
          label: node.label,
          utmSource: node.sub.split(' · ')[0] || '',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Create failed');
      setDone('Link created — this post now feeds the funnel.');
      onChanged?.();
    } catch (e) {
      setDone(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-bone/10 bg-bone/[0.03] px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-bone/40">
        No link yet
      </p>
      <p className="mt-0.5 text-[10px] leading-relaxed text-bone/45">
        Give this post its own tracked link — the URL you share in it. Everyone
        who taps it lands on the funnel you pick, and the clicks count back to
        this post.
      </p>
      <div className="mt-2 flex items-center gap-1.5">
        <select
          value={funnelId}
          onChange={(e) => setFunnelId(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-bone/15 bg-ink px-2 py-1.5 text-[10px] text-bone/90 outline-none focus:border-brass/50"
        >
          <option value="">Points at…</option>
          {funnels.map((f) => (
            <option key={f.id} value={f.id.slice('funnel:'.length)}>
              {f.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void create()}
          disabled={!funnelId || busy}
          className="shrink-0 rounded-lg border border-brass/50 bg-brass/15 px-2.5 py-1.5 text-[10px] font-semibold text-brass hover:bg-brass/25 disabled:opacity-40"
        >
          {busy ? 'Creating…' : 'Create the link'}
        </button>
      </div>
      {done && <p className="mt-1.5 text-[10px] text-bone/60">{done}</p>}
    </div>
  );
}

/** The node's connections — what feeds it, what it feeds. */
function Connections({
  node,
  map,
}: {
  node: SystemMapNode;
  map: SystemMap | null;
}) {
  if (!map) return null;
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const feeders = map.edges.filter((e) => e.to === node.id).map((e) => byId.get(e.from)).filter(Boolean) as SystemMapNode[];
  const feeds = map.edges.filter((e) => e.from === node.id).map((e) => byId.get(e.to)).filter(Boolean) as SystemMapNode[];
  if (feeders.length === 0 && feeds.length === 0) return null;
  const Row = ({ n, dir }: { n: SystemMapNode; dir: 'in' | 'out' }) => (
    <div className="flex items-center gap-2 py-1 text-[11px] text-bone/70">
      {dir === 'in' ? (
        <ArrowDown className="h-3 w-3 shrink-0 text-emerald-300/70" />
      ) : (
        <ArrowUp className="h-3 w-3 shrink-0 text-sky-300/70" />
      )}
      <span className="truncate">{n.label}</span>
      <span className="ml-auto shrink-0 text-[9px] uppercase tracking-wide text-bone/30">
        {KIND_LABEL[n.kind]}
      </span>
    </div>
  );
  return (
    <div className="mt-4 border-t border-bone/10 pt-3">
      <p className="text-[10px] uppercase tracking-wide text-bone/40">Connections</p>
      {feeders.length > 0 && (
        <p className="mt-2 text-[9px] uppercase tracking-wide text-bone/30">Fed by</p>
      )}
      {feeders.map((n) => (
        <Row key={`in-${n.id}`} n={n} dir="in" />
      ))}
      {feeds.length > 0 && (
        <p className="mt-2 text-[9px] uppercase tracking-wide text-bone/30">Feeds</p>
      )}
      {feeds.map((n) => (
        <Row key={`out-${n.id}`} n={n} dir="out" />
      ))}
    </div>
  );
}

export default function NodePeekPanel({
  node,
  map,
  onClose,
  onChanged,
}: {
  node: SystemMapNode | null;
  /** The map, so the peek can show the node's connections. */
  map?: SystemMap | null;
  onClose: () => void;
  /** Refetch the map after an action writes (a link created). */
  onChanged?: () => void;
}) {
  if (!node) return null;
  const isBlueprint = !!node.blueprintId;
  // The content node's platform → the brand icon (the sub is "platform · format").
  const platform =
    node.kind === 'content' ? canonicalPlatform(node.sub.split(' · ')[0] ?? '') : null;
  return (
    <div className="absolute right-0 top-0 z-20 flex h-full w-[440px] flex-col border-l border-bone/10 bg-ink shadow-2xl">
      <div className="flex items-start justify-between gap-2 border-b border-bone/10 px-5 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {/* the platform brand icon on a content node */}
          {platform && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bone/[0.08]">
              <PlatformIcon platform={platform} className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-widest text-bone/40">
              {KIND_LABEL[node.kind]}
              {platform ? ` · ${platformLabel(node.sub.split(' · ')[0])}` : ''}
            </p>
            <h3 className="mt-0.5 truncate text-sm font-semibold text-bone">
              {node.label}
            </h3>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded p-1 text-bone/40 hover:text-bone"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {/* the real thing — the live page, the actual post, the real email */}
        {!isBlueprint && <NodeVisual node={node} />}

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

        {/* the content node's action — create the tracked link that wires it
            into a funnel (detects when it's already linked) */}
        {!isBlueprint && node.kind === 'content' && (
          <div className="mt-3">
            <ContentActions node={node} map={map ?? null} onChanged={onChanged} />
          </div>
        )}

        {/* the connections — what feeds this node, what it feeds */}
        {!isBlueprint && <Connections node={node} map={map ?? null} />}

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
        <div className="space-y-2 border-t border-bone/10 px-5 py-4">
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
