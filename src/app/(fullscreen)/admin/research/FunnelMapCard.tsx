'use client';

/**
 * The Funnel Map card: the interactive diagram of everything a piece of
 * research became — the root artifact up top (with its parent brief and
 * price), then the asset lanes (Lead path / Nurture / Sales path /
 * Traffic), every node carrying its status glyph and its editor link.
 *
 * A dumb renderer for buildFunnelMap's model — zero deps, plain divs, the
 * house bone/brass language. Rendered inline in the chat feed under the
 * handoff-completed beat, and in the artifact drawer's handed-off area.
 */
import { clsx } from 'clsx';
import { ChevronRight, Map as MapIcon } from 'lucide-react';
import type {
  FunnelMap,
  FunnelMapNode,
} from '@/lib/mothermode/research/funnelMap';
import NodeCard from '@/components/mothermode/NodeCard';

/** The admin build-map node: the shared primitive with its editor link. */
function Node({ node }: { node: FunnelMapNode }) {
  return <NodeCard status={node.status} label={node.label} href={node.href} />;
}


export default function FunnelMapCard({ map }: { map: FunnelMap }) {
  return (
    <div className="rounded-xl border border-brass/25 bg-brass/[0.05] px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-brass/80">
        <MapIcon className="h-3.5 w-3.5" />
        The build map
      </div>

      {/* the root: research brief -> this artifact */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {map.root.parentTitle && (
          <>
            <span className="max-w-[180px] truncate rounded-md border border-bone/15 bg-bone/[0.04] px-2 py-1 text-[11px] text-bone/50">
              {map.root.parentTitle}
            </span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-brass/60" />
          </>
        )}
        <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-brass/40 bg-brass/15 px-2 py-1 text-[11px] font-semibold text-brass">
          <span className="truncate">{map.root.title}</span>
          <span className="shrink-0 text-[9px] font-medium uppercase tracking-wider opacity-70">
            {map.root.typeLabel}
            {map.root.priceLabel ? ` · ${map.root.priceLabel}` : ''}
          </span>
        </span>
      </div>

      {/* the asset lanes */}
      <div className="mt-2.5 space-y-1.5 border-l-2 border-brass/20 pl-3">
        {map.lanes.map((lane) => (
          <div key={lane.key} className="flex flex-wrap items-center gap-1.5">
            <span className="w-[72px] shrink-0 text-[9px] font-semibold uppercase tracking-wider text-bone/35">
              {lane.title}
            </span>
            {lane.nodes.map((node, i) => (
              <span key={`${node.id}-${i}`} className="inline-flex items-center gap-1">
                {i > 0 && (
                  <ChevronRight className="h-3 w-3 shrink-0 text-brass/50" />
                )}
                <Node node={node} />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
