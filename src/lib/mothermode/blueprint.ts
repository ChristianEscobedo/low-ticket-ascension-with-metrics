/**
 * The System Blueprint Creator (pure): the types, the normalizers, and the
 * three DRAFTERS that turn a source into a proposed subgraph.
 *
 * A blueprint is a *pending subgraph* on the System Map — not a pile of loose
 * assets, but the wired system: the funnel's pages, the email sequence, the
 * tracked links, the content, connected. It is the gated pattern made
 * concrete:
 *
 *   PROPOSE  a drafter maps a source → BlueprintNode[] (pure, no writes) and
 *            the record persists as 'proposed'. The map renders it dashed.
 *   APPROVE  the skills (research/skills/blueprint.ts) run each node's skill
 *            call and write the real records. The subgraph goes live.
 *
 * Three entry modes, one per drafter:
 *   - research      — a research artifact (the offer brief) becomes the whole
 *                     system. This is the Full System fan-out aimed at the map.
 *   - optimization  — the leak detector's output becomes the fix: a variant
 *                     with the leaky page reworked + the recovery sequence +
 *                     a fresh link to drive test traffic.
 *   - clone         — a winning funnel clones into a variant (the variant-of
 *                     edge), ready to A/B.
 *
 * Pure: no server imports, no React. The store (blueprintStore.ts) and the
 * skills (research/skills/blueprint.ts) are the server halves; the System Map
 * builder (systemMap.ts) renders the pending overlay. Every normalizer is
 * defensive — the nodes JSONB is untyped at the DB boundary.
 */

// ---------------------------------------------------------------------------
// The vocabulary
// ---------------------------------------------------------------------------

export const BLUEPRINT_MODES = ['research', 'optimization', 'clone'] as const;
export type BlueprintMode = (typeof BLUEPRINT_MODES)[number];

export const BLUEPRINT_STATUSES = [
  'proposed',
  'approved',
  'materialized',
  'rejected',
] as const;
export type BlueprintStatus = (typeof BLUEPRINT_STATUSES)[number];

/**
 * The skills a blueprint's nodes can carry — the agent's hands, one per source
 * table. `create_funnel` and `clone_funnel` write the funnels;
 * `bind_email_sequence` writes + binds an email kit; `create_tracked_link`
 * mints a utm link; `create_content_card` writes a planner card. A node with
 * `skill: null` is informational (a page node materialized by its funnel).
 */
export const BLUEPRINT_SKILL_NAMES = [
  'create_funnel',
  'clone_funnel',
  'bind_email_sequence',
  'create_tracked_link',
  'create_content_card',
] as const;
export type BlueprintSkillName = (typeof BLUEPRINT_SKILL_NAMES)[number];

export type BlueprintNodeKind = 'funnel' | 'page' | 'email' | 'link' | 'content';

// ---------------------------------------------------------------------------
// The skill input contracts — the drafter writes these, the skill reads them.
// `funnelKey` / `pieceKey` are LOCAL references the materializer resolves to
// the created record's id (and slug) once the dependency has been written.
// ---------------------------------------------------------------------------

export interface CreateFunnelSkillInput {
  kind: 'sales' | 'optin';
  name: string;
  slug: string;
  offerSlug?: string;
  /** The offer brief the sales pages prefill from (kind 'sales'). */
  brief?: {
    name: string;
    audience: string;
    promise: string;
    mechanism: string;
    priceCents: number;
    angles: string[];
    notes: string;
  };
}

export interface CloneFunnelSkillInput {
  parentFunnelId: string;
  kind: 'sales' | 'optin';
  name: string;
  slug: string;
  /** Optimization mode: the leaky page the variant reworks. */
  reworkPageKey?: string;
}

export interface BindEmailSequenceSkillInput {
  /** Local key of the funnel node — resolved to the created funnel id. */
  funnelKey: string;
  funnelKind: 'sales' | 'optin';
  /** The SalesEmailEvent the sequence binds to ('optin', 'checkout_start'…). */
  event: string;
  kitName: string;
  goal: string;
  campaignType: string;
}

export interface CreateTrackedLinkSkillInput {
  /** Local key of the funnel node — resolved to the created funnel id + slug. */
  funnelKey: string;
  funnelKind: 'sales' | 'optin';
  /** The page the link lands on (a SALES_FUNNEL_STEPS key; '' = the root). */
  funnelPage: string;
  /** Local key of the content node carrying it — resolved to the piece id. */
  pieceKey?: string;
  label: string;
  utmSource: string;
}

export interface CreateContentCardSkillInput {
  pieceId: string;
  title: string;
  platform: string;
  format: string;
  kind: string;
  offerSlug?: string;
  notes?: string;
}

export interface BlueprintSkillCall {
  name: BlueprintSkillName;
  input: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// The subgraph
// ---------------------------------------------------------------------------

export interface BlueprintNode {
  /** Local id within the blueprint ('funnel', 'page:checkout', 'link:0'…). */
  key: string;
  kind: BlueprintNodeKind;
  label: string;
  /** The secondary line (the event, the /go/code, the platform). */
  sub: string;
  /** Short metric chips (usually empty on a proposal — nothing's measured). */
  metrics: string[];
  /** The materialization instruction; null = informational (a funnel's page). */
  skill: BlueprintSkillCall | null;
  /** Edges out, by target key. */
  linksTo: string[];
}

export interface BlueprintSource {
  /** A one-line human summary of what this blueprint was drafted from. */
  summary: string;
  /** research mode: the artifact the blueprint was drafted from. */
  artifactId?: string;
  /** optimization mode: the leaky edge the blueprint fixes. */
  leakEdgeId?: string;
  /** clone/optimization mode: the parent funnel the variant descends from. */
  parentFunnelId?: string;
}

export interface SystemBlueprint {
  id: string;
  name: string;
  mode: BlueprintMode;
  source: BlueprintSource;
  nodes: BlueprintNode[];
  status: BlueprintStatus;
  recipeRunId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SystemBlueprintRow {
  id: string;
  name: string | null;
  mode: string | null;
  source: unknown;
  nodes: unknown;
  status: string | null;
  recipe_run_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// ---------------------------------------------------------------------------
// Defensive normalizers (the nodes/source JSONB is untyped at the boundary)
// ---------------------------------------------------------------------------

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function strList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter((x) => x.length > 0);
}

export function toBlueprintMode(v: unknown): BlueprintMode {
  return v === 'optimization' || v === 'clone' ? v : 'research';
}

export function toBlueprintStatus(v: unknown): BlueprintStatus {
  return v === 'approved' || v === 'materialized' || v === 'rejected'
    ? v
    : 'proposed';
}

function toSkillName(v: unknown): BlueprintSkillName | null {
  return (BLUEPRINT_SKILL_NAMES as readonly string[]).includes(str(v))
    ? (str(v) as BlueprintSkillName)
    : null;
}

function normalizeSkillCall(value: unknown): BlueprintSkillCall | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;
  const name = toSkillName(rec.name);
  if (!name) return null;
  const input =
    rec.input && typeof rec.input === 'object' && !Array.isArray(rec.input)
      ? (rec.input as Record<string, unknown>)
      : {};
  return { name, input };
}

const NODE_KINDS: readonly string[] = ['funnel', 'page', 'email', 'link', 'content'];

/** Defensive normalize of the nodes JSONB. Malformed nodes are dropped. */
export function normalizeBlueprintNodes(value: unknown): BlueprintNode[] {
  if (!Array.isArray(value)) return [];
  const out: BlueprintNode[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const rec = raw as Record<string, unknown>;
    const key = str(rec.key);
    const kind = str(rec.kind);
    if (!key || !NODE_KINDS.includes(kind) || seen.has(key)) continue;
    seen.add(key);
    out.push({
      key,
      kind: kind as BlueprintNodeKind,
      label: str(rec.label),
      sub: str(rec.sub),
      metrics: strList(rec.metrics),
      skill: normalizeSkillCall(rec.skill),
      linksTo: strList(rec.linksTo),
    });
  }
  return out;
}

export function normalizeBlueprintSource(value: unknown): BlueprintSource {
  const rec =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const out: BlueprintSource = { summary: str(rec.summary) };
  const artifactId = str(rec.artifactId);
  const leakEdgeId = str(rec.leakEdgeId);
  const parentFunnelId = str(rec.parentFunnelId);
  if (artifactId) out.artifactId = artifactId;
  if (leakEdgeId) out.leakEdgeId = leakEdgeId;
  if (parentFunnelId) out.parentFunnelId = parentFunnelId;
  return out;
}

export function rowToBlueprint(row: SystemBlueprintRow): SystemBlueprint {
  return {
    id: row.id,
    name: str(row.name),
    mode: toBlueprintMode(row.mode),
    source: normalizeBlueprintSource(row.source),
    nodes: normalizeBlueprintNodes(row.nodes),
    status: toBlueprintStatus(row.status),
    recipeRunId: row.recipe_run_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Validation — what a blueprint still needs before it can be proposed. The
// gated invariant's first line: a malformed subgraph never reaches the canvas.
// ---------------------------------------------------------------------------

export function blueprintDraftErrors(draft: {
  name?: string;
  mode?: string;
  nodes?: unknown;
}): string[] {
  const errors: string[] = [];
  if (!str(draft.name)) errors.push('a name');
  if (
    draft.mode !== undefined &&
    !(BLUEPRINT_MODES as readonly string[]).includes(str(draft.mode))
  ) {
    errors.push('a known mode (research, optimization, or clone)');
  }
  const nodes = normalizeBlueprintNodes(draft.nodes);
  if (nodes.length === 0) {
    errors.push('at least one node');
    return errors;
  }
  // Every node needs a label; every materializable node needs a known skill.
  nodes.forEach((n, i) => {
    const at = n.label || `node ${i + 1} (${n.key})`;
    if (!n.label) errors.push(`${at} needs a label`);
    if (n.skill === null && n.kind !== 'page') {
      errors.push(`${at} has no skill — only page nodes are informational`);
    }
  });
  // Every edge must land on a node that exists.
  const keys = new Set(nodes.map((n) => n.key));
  for (const n of nodes) {
    for (const to of n.linksTo) {
      if (!keys.has(to)) {
        errors.push(`"${n.key}" links to "${to}", which isn't a node`);
      }
    }
  }
  // A funnel-bearing blueprint needs exactly one funnel node to anchor on.
  const funnels = nodes.filter((n) => n.kind === 'funnel');
  if (funnels.length > 1) errors.push('only one funnel node per blueprint');
  return errors;
}

// ---------------------------------------------------------------------------
// The drafters — the step→node mapping. Pure: a source in, a subgraph out.
// These NEVER write; they only propose. The skills materialize on approve.
// ---------------------------------------------------------------------------

/** Unique-per-source slug suffix so a re-proposed blueprint never collides. */
function suffixOf(seed: string): string {
  return seed.replace(/-/g, '').slice(0, 8) || 'x';
}

function slugify(text: string, fallback: string): string {
  const s = text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return s || fallback;
}

/** The public path a sales-funnel step lives at (the link's destination). */
const SALES_STEP_PATH: Record<string, string> = {
  optin: '',
  sales: '/sales',
  vsl: '/vsl',
  checkout: '/checkout',
  upsell1: '/upsell',
  upsell2: '/upsell-2',
  upsell3: '/upsell-3',
  upsell4: '/upsell-4',
  success: '/success',
  access: '/access',
};

/** The page spine a fresh sales funnel carries (the informational nodes). */
const SALES_BLUEPRINT_PAGES: Array<{ key: string; label: string }> = [
  { key: 'optin', label: 'Opt-in' },
  { key: 'sales', label: 'Sales page' },
  { key: 'checkout', label: 'Checkout' },
];

export interface DraftedBlueprint {
  name: string;
  source: BlueprintSource;
  nodes: BlueprintNode[];
}

/**
 * FROM RESEARCH: an offer-brief artifact becomes the whole system — the sales
 * funnel (its pages prefill from the brief), the nurture sequence bound to the
 * opt-in, and one content card + tracked link per angle feeding it. This is
 * the Full System fan-out (handoff.ts's runSystemBuild) aimed at the map: the
 * same parts, but proposed as a pending subgraph instead of written at once.
 */
export function draftFromResearch(input: {
  artifactId: string;
  title: string;
  /** The offer brief's structured payload (normalized upstream or here). */
  brief: {
    name: string;
    audience: string;
    promise: string;
    mechanism: string;
    priceCents: number;
    angles: string[];
    notes: string;
  };
  offerSlug?: string;
}): DraftedBlueprint {
  const brief = input.brief;
  const name = brief.name || input.title || 'Untitled offer';
  const suffix = suffixOf(input.artifactId);
  const slug = `${slugify(name, 'offer')}-${suffix}`;
  const promise = brief.promise || brief.mechanism || `A calmer week with ${name}.`;

  const nodes: BlueprintNode[] = [];

  // The funnel (the band's anchor) — create_funnel writes it + its pages.
  nodes.push({
    key: 'funnel',
    kind: 'funnel',
    label: name,
    sub: 'Sales funnel',
    metrics: [],
    skill: {
      name: 'create_funnel',
      input: {
        kind: 'sales',
        name,
        slug,
        ...(input.offerSlug ? { offerSlug: input.offerSlug } : {}),
        brief: {
          name,
          audience: brief.audience,
          promise: brief.promise,
          mechanism: brief.mechanism,
          priceCents: brief.priceCents,
          angles: brief.angles,
          notes: brief.notes,
        },
      } satisfies CreateFunnelSkillInput,
    },
    linksTo: SALES_BLUEPRINT_PAGES.map((p) => `page:${p.key}`),
  });

  // The page spine — informational (materialized by the funnel's skill).
  for (const page of SALES_BLUEPRINT_PAGES) {
    nodes.push({
      key: `page:${page.key}`,
      kind: 'page',
      label: page.label,
      sub: name,
      metrics: [],
      skill: null,
      // The opt-in page fires the nurture sequence.
      linksTo: page.key === 'optin' ? ['email:nurture'] : [],
    });
  }

  // The nurture sequence, bound to the opt-in event.
  nodes.push({
    key: 'email:nurture',
    kind: 'email',
    label: `${name} nurture`,
    sub: 'on opt-in',
    metrics: [],
    skill: {
      name: 'bind_email_sequence',
      input: {
        funnelKey: 'funnel',
        funnelKind: 'sales',
        event: 'optin',
        kitName: `${name} nurture`,
        goal: `Sell ${name}: ${promise}`,
        campaignType: 'nurture-to-offer',
      } satisfies BindEmailSequenceSkillInput,
    },
    linksTo: [],
  });

  // One content card + one tracked link per angle (cap 4), feeding the opt-in.
  const angles = brief.angles.filter(Boolean).slice(0, 4);
  angles.forEach((angle, i) => {
    const contentKey = `content:${i}`;
    const linkKey = `link:${i}`;
    const pieceId = `blueprint_${suffix}_${i + 1}`;
    nodes.push({
      key: contentKey,
      kind: 'content',
      label: `${name}: ${angle.slice(0, 60)}`,
      sub: 'instagram · feed',
      metrics: [],
      skill: {
        name: 'create_content_card',
        input: {
          pieceId,
          title: `${name}: ${angle.slice(0, 60)}`,
          platform: 'instagram',
          format: 'feed',
          kind: 'organic',
          ...(input.offerSlug ? { offerSlug: input.offerSlug } : {}),
          notes: angle,
        } satisfies CreateContentCardSkillInput,
      },
      linksTo: [linkKey],
    });
    nodes.push({
      key: linkKey,
      kind: 'link',
      label: `${name} link ${i + 1}`,
      sub: 'instagram',
      metrics: [],
      skill: {
        name: 'create_tracked_link',
        input: {
          funnelKey: 'funnel',
          funnelKind: 'sales',
          funnelPage: 'optin',
          pieceKey: contentKey,
          label: `${name} link ${i + 1}`,
          utmSource: 'instagram',
        } satisfies CreateTrackedLinkSkillInput,
      },
      linksTo: ['page:optin'],
    });
  });

  return {
    name: `${name} — full system`,
    source: {
      summary: `From the research artifact "${input.title || name}".`,
      artifactId: input.artifactId,
    },
    nodes,
  };
}

/**
 * FROM AN OPTIMIZATION: the leak detector's output becomes the fix. The leaky
 * funnel clones into a variant with the weak page reworked, a recovery
 * sequence binds to the event that fires there, and a fresh tracked link
 * points at the reworked page to drive test traffic. The variant-of edge (the
 * builder draws it from source.parentFunnelId) keeps the family visible.
 */
export function draftFromOptimization(input: {
  parentFunnelId: string;
  parentName: string;
  parentSlug: string;
  kind: 'sales' | 'optin';
  /** The leaky page (the analysis's pageKey: 'checkout', 'optin'…). */
  leakPageKey: string;
  /** The leak's label ("Checkout rate") for the summary. */
  leakLabel: string;
  leakEdgeId?: string;
}): DraftedBlueprint {
  const suffix = suffixOf(input.parentFunnelId + input.leakPageKey);
  const variantName = `${input.parentName} — ${input.leakPageKey} fix`;
  const slug = `${slugify(input.parentSlug || input.parentName, 'funnel')}-fix-${suffix}`;
  // The event the recovery sequence binds to: the step the leak is AT.
  const event = input.leakPageKey === 'checkout' ? 'checkout_start' : 'optin';

  const nodes: BlueprintNode[] = [
    {
      key: 'funnel',
      kind: 'funnel',
      label: variantName,
      sub: `Variant · fixes ${input.leakLabel.toLowerCase()}`,
      metrics: [],
      skill: {
        name: 'clone_funnel',
        input: {
          parentFunnelId: input.parentFunnelId,
          kind: input.kind,
          name: variantName,
          slug,
          reworkPageKey: input.leakPageKey,
        } satisfies CloneFunnelSkillInput,
      },
      linksTo: [`page:${input.leakPageKey}`],
    },
    {
      key: `page:${input.leakPageKey}`,
      kind: 'page',
      label: `${input.leakLabel} (reworked)`,
      sub: variantName,
      metrics: [],
      skill: null,
      linksTo: ['email:recovery'],
    },
    {
      key: 'email:recovery',
      kind: 'email',
      label: `${input.parentName} recovery`,
      sub: event === 'checkout_start' ? 'on checkout start' : 'on opt-in',
      metrics: [],
      skill: {
        name: 'bind_email_sequence',
        input: {
          funnelKey: 'funnel',
          funnelKind: input.kind,
          event,
          kitName: `${input.parentName} ${input.leakPageKey} recovery`,
          goal: `Recover the ${input.leakLabel.toLowerCase()} drop-off for ${input.parentName}.`,
          campaignType: 'cart-abandonment',
        } satisfies BindEmailSequenceSkillInput,
      },
      linksTo: [],
    },
    {
      key: 'link:0',
      kind: 'link',
      label: `${variantName} test link`,
      sub: 'direct',
      metrics: [],
      skill: {
        name: 'create_tracked_link',
        input: {
          funnelKey: 'funnel',
          funnelKind: input.kind,
          funnelPage: input.leakPageKey,
          label: `${variantName} test link`,
          utmSource: 'direct',
        } satisfies CreateTrackedLinkSkillInput,
      },
      linksTo: [`page:${input.leakPageKey}`],
    },
  ];

  return {
    name: variantName,
    source: {
      summary: `Fixes the ${input.leakLabel.toLowerCase()} leak on "${input.parentName}".`,
      ...(input.leakEdgeId ? { leakEdgeId: input.leakEdgeId } : {}),
      parentFunnelId: input.parentFunnelId,
    },
    nodes,
  };
}

/**
 * FROM A CLONE VARIANT: a winning funnel clones into a variant blueprint (the
 * variant-of edge), ready to A/B. The clone carries the parent's pages
 * (informational — the clone's skill writes them) and gets a fresh tracked
 * link so the test has its own traffic.
 */
export function draftFromClone(input: {
  parentFunnelId: string;
  parentName: string;
  parentSlug: string;
  kind: 'sales' | 'optin';
  /** The parent's page keys (the clone's informational page nodes). */
  pageKeys?: string[];
}): DraftedBlueprint {
  const suffix = suffixOf(input.parentFunnelId);
  const variantName = `${input.parentName} (variant)`;
  const slug = `${slugify(input.parentSlug || input.parentName, 'funnel')}-variant-${suffix}`;
  const pageKeys = (input.pageKeys ?? []).filter(Boolean);
  const firstPage = pageKeys[0] ?? 'optin';

  const nodes: BlueprintNode[] = [
    {
      key: 'funnel',
      kind: 'funnel',
      label: variantName,
      sub: `Variant of ${input.parentName}`,
      metrics: [],
      skill: {
        name: 'clone_funnel',
        input: {
          parentFunnelId: input.parentFunnelId,
          kind: input.kind,
          name: variantName,
          slug,
        } satisfies CloneFunnelSkillInput,
      },
      linksTo: pageKeys.map((k) => `page:${k}`),
    },
    // The parent's pages, informational (the clone's skill carries them).
    ...pageKeys.map(
      (k): BlueprintNode => ({
        key: `page:${k}`,
        kind: 'page',
        label: k,
        sub: variantName,
        metrics: [],
        skill: null,
        linksTo: [],
      }),
    ),
    {
      key: 'link:0',
      kind: 'link',
      label: `${variantName} test link`,
      sub: 'direct',
      metrics: [],
      skill: {
        name: 'create_tracked_link',
        input: {
          funnelKey: 'funnel',
          funnelKind: input.kind,
          funnelPage: firstPage,
          label: `${variantName} test link`,
          utmSource: 'direct',
        } satisfies CreateTrackedLinkSkillInput,
      },
      linksTo: [`page:${firstPage}`],
    },
  ];

  return {
    name: variantName,
    source: {
      summary: `Clones "${input.parentName}" into a variant to A/B.`,
      parentFunnelId: input.parentFunnelId,
    },
    nodes,
  };
}

/** The sales step's public path — the materializer reads it for a link's
 *  destination. Re-exported so the skills module shares the one map. */
export function salesStepPath(pageKey: string): string {
  return SALES_STEP_PATH[pageKey] ?? '';
}
