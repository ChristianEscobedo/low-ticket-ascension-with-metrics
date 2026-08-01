/**
 * The Funnel Map (pure): turn an artifact's persisted handoff state into a
 * small node/lane model the chat feed and the artifact drawer render as an
 * interactive funnel diagram — every asset the research produced, with its
 * status and its editor link.
 *
 * Data sources (both already persisted):
 *   - structured.systemManifest  the Full System fan-out's parts
 *                                (leadgen-kit, optin-funnel, email-kit,
 *                                sales-funnel, planner-cards)
 *   - handedOffTo                a single-target handoff (mini map)
 *
 * Pure: no server imports, no React — the component is a dumb renderer.
 */
import {
  ARTIFACT_TYPE_LABELS,
  type HandedOffRef,
  type ResearchArtifact,
} from './types';

export type FunnelNodeStatus = 'built' | 'draft' | 'failed' | 'pending';

export interface FunnelMapNode {
  /** Stable key within the map. */
  id: string;
  kind: string;
  label: string;
  status: FunnelNodeStatus;
  href: string;
}

export interface FunnelMapLane {
  key: string;
  title: string;
  nodes: FunnelMapNode[];
}

export interface FunnelMap {
  /** The map's center: the artifact everything descends from. */
  root: {
    title: string;
    typeLabel: string;
    /** The parent artifact's title (the research brief), when resolvable. */
    parentTitle: string;
    priceLabel: string;
  };
  lanes: FunnelMapLane[];
}

/** The manifest part shape (structured.systemManifest, JSONB-defended). */
interface ManifestPart {
  kind: string;
  id: string;
  label: string;
  href: string;
}

function manifestOf(artifact: ResearchArtifact): ManifestPart[] {
  const raw = artifact.structured?.systemManifest;
  if (!Array.isArray(raw)) return [];
  const out: ManifestPart[] = [];
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue;
    const rec = p as Record<string, unknown>;
    if (typeof rec.label !== 'string' || !rec.label) continue;
    out.push({
      kind: typeof rec.kind === 'string' ? rec.kind : '',
      id: typeof rec.id === 'string' ? rec.id : '',
      label: rec.label,
      href: typeof rec.href === 'string' && rec.href ? rec.href : '/admin',
    });
  }
  return out;
}

/** Status honesty: the persisted label says exactly how the part landed. */
function statusOfPart(part: ManifestPart): FunnelNodeStatus {
  const label = part.label.toLowerCase();
  if (label.includes('generation failed')) return 'failed';
  if (label.includes('(drafted)')) return 'built';
  // Planner cards exist the moment they're written; kits/funnels are drafts.
  return part.kind === 'planner-cards' ? 'built' : 'draft';
}

/** Where a single-target handoff links (the built row when we know its id). */
function handoffHref(h: HandedOffRef): string {
  if (h.kind === 'leadgen-kit' && h.id) return `/admin/lead-gen?kit=${h.id}`;
  if (h.kind === 'email-kit' && h.id)
    return `/admin/email-marketing?kit=${h.id}`;
  if (h.kind === 'sales-funnel') return '/admin/sales-funnels';
  if (h.kind === 'planner-cards') return '/admin/planner';
  return '/admin';
}

const LANE_TITLES: Record<string, string> = {
  'leadgen-kit': 'Lead path',
  'optin-funnel': 'Lead path',
  'email-kit': 'Nurture',
  'sales-funnel': 'Sales path',
  'planner-cards': 'Traffic',
};
const LANE_ORDER = ['Lead path', 'Nurture', 'Sales path', 'Traffic'];

function priceLabel(artifact: ResearchArtifact): string {
  const cents = artifact.structured?.priceCents;
  if (typeof cents !== 'number' || !Number.isFinite(cents) || cents <= 0) {
    return '';
  }
  return cents % 100 === 0
    ? `$${Math.round(cents / 100)}`
    : `$${(cents / 100).toFixed(2)}`;
}

/**
 * Build the map for one artifact, or null when it has no handoff state to
 * draw (nothing handed off yet). `artifacts` resolves the parent brief's
 * title for the root lane (pass [] when unknown — the root still renders).
 */
export function buildFunnelMap(input: {
  artifact: ResearchArtifact;
  artifacts?: Array<Pick<ResearchArtifact, 'id' | 'title' | 'type'>>;
}): FunnelMap | null {
  const { artifact } = input;
  const parent = artifact.parentId
    ? (input.artifacts ?? []).find((a) => a.id === artifact.parentId)
    : undefined;
  const root: FunnelMap['root'] = {
    title: artifact.title || 'Untitled',
    typeLabel: ARTIFACT_TYPE_LABELS[artifact.type] ?? artifact.type,
    parentTitle: parent?.title ?? '',
    priceLabel: priceLabel(artifact),
  };

  const manifest = manifestOf(artifact);
  if (manifest.length > 0) {
    const lanes = new Map<string, FunnelMapLane>();
    for (const part of manifest) {
      const title = LANE_TITLES[part.kind] ?? 'Assets';
      if (!lanes.has(title)) lanes.set(title, { key: title, title, nodes: [] });
      lanes.get(title)!.nodes.push({
        id: part.id || part.kind,
        kind: part.kind,
        // Strip the state suffix — the status glyph says it instead.
        label: part.label.replace(/\s*\((drafted|draft, generation failed)\)\s*$/, ''),
        status: statusOfPart(part),
        href: part.href,
      });
    }
    const ordered = Array.from(lanes.values()).sort(
      (a, b) => LANE_ORDER.indexOf(a.title) - LANE_ORDER.indexOf(b.title),
    );
    return { root, lanes: ordered };
  }

  const h = artifact.handedOffTo;
  if (h) {
    const title = LANE_TITLES[h.kind] ?? 'Assets';
    return {
      root,
      lanes: [
        {
          key: title,
          title,
          nodes: [
            {
              id: h.id || h.kind,
              kind: h.kind,
              label: h.label.replace(/\s*\((drafted|built)\)\s*$/, ''),
              status:
                h.kind === 'planner-cards' || /\(drafted\)|\(built\)/.test(h.label)
                  ? 'built'
                  : 'draft',
              href: handoffHref(h),
            },
          ],
        },
      ],
    };
  }

  return null;
}
