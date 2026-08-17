/**
 * The System Blueprint Creator — the drafters (the step→node mapping), the
 * store round-trip, the builder's pending overlay, the materializer, and the
 * gated invariant (nothing writes to a source table before approve).
 */
import { describe, it, expect } from 'vitest';
import {
  blueprintDraftErrors,
  draftFromClone,
  draftFromOptimization,
  draftFromResearch,
  normalizeBlueprintNodes,
  rowToBlueprint,
  type BlueprintNode,
  type SystemBlueprintRow,
} from '@/lib/mothermode/blueprint';
import { buildSystemMap, type SystemMapInput } from '@/lib/mothermode/systemMap';
import { materializeBlueprint } from '@/lib/mothermode/research/skills/blueprint';

const OFFER = {
  name: 'Calm Week',
  audience: 'overwhelmed moms',
  promise: 'A calmer week in one sitting.',
  mechanism: 'The Sunday reset method',
  priceCents: 2700,
  angles: ['the 10-minute reset', 'the mental load dump', 'the Sunday ritual'],
  notes: '',
};

// ---------------------------------------------------------------------------
// The drafters — a source in, a connected subgraph out (pure, no writes)
// ---------------------------------------------------------------------------

describe('draftFromResearch', () => {
  const drafted = draftFromResearch({
    artifactId: 'art-123',
    title: 'Calm Week',
    brief: OFFER,
  });
  const node = (key: string) => drafted.nodes.find((n) => n.key === key);
  const edge = (from: string, to: string) =>
    drafted.nodes.some(
      (n) => n.key === from && n.linksTo.includes(to),
    );

  it('maps the offer brief to the whole system: funnel + pages + email + content + links', () => {
    // The funnel carries create_funnel with the brief.
    const funnel = node('funnel');
    expect(funnel?.kind).toBe('funnel');
    expect(funnel?.skill?.name).toBe('create_funnel');
    expect(funnel?.skill?.input.slug).toContain('calm-week');
    // The page spine is informational (materialized by the funnel's skill).
    for (const key of ['page:optin', 'page:sales', 'page:checkout']) {
      expect(node(key)?.skill).toBeNull();
      expect(edge('funnel', key)).toBe(true);
    }
    // The nurture sequence binds to the opt-in event.
    const email = node('email:nurture');
    expect(email?.skill?.name).toBe('bind_email_sequence');
    expect(email?.skill?.input.event).toBe('optin');
    expect(edge('page:optin', 'email:nurture')).toBe(true);
  });

  it('produces one content card + one tracked link per angle, wired content → link → opt-in', () => {
    // 3 angles → 3 content + 3 link nodes.
    for (let i = 0; i < 3; i++) {
      const content = node(`content:${i}`);
      const link = node(`link:${i}`);
      expect(content?.skill?.name).toBe('create_content_card');
      expect(link?.skill?.name).toBe('create_tracked_link');
      // The link references its content card (pieceKey) and the funnel.
      expect(link?.skill?.input.pieceKey).toBe(`content:${i}`);
      expect(link?.skill?.input.funnelKey).toBe('funnel');
      expect(edge(`content:${i}`, `link:${i}`)).toBe(true);
      expect(edge(`link:${i}`, 'page:optin')).toBe(true);
    }
    // The source records the artifact it was drafted from.
    expect(drafted.source.artifactId).toBe('art-123');
  });

  it('passes validation clean', () => {
    expect(blueprintDraftErrors({ name: drafted.name, mode: 'research', nodes: drafted.nodes })).toEqual([]);
  });
});

describe('draftFromOptimization', () => {
  const drafted = draftFromOptimization({
    parentFunnelId: 'f1',
    parentName: 'Mindshift',
    parentSlug: 'mindshift',
    kind: 'sales',
    leakPageKey: 'checkout',
    leakLabel: 'Checkout rate',
    leakEdgeId: 'e:funnel:f1->page:f1:checkout',
  });
  const node = (key: string) => drafted.nodes.find((n) => n.key === key);

  it('drafts the fix: a variant with the leaky page reworked + the recovery sequence + a test link', () => {
    // The variant clones the parent, reworking the leaky page.
    const funnel = node('funnel');
    expect(funnel?.skill?.name).toBe('clone_funnel');
    expect(funnel?.skill?.input.parentFunnelId).toBe('f1');
    expect(funnel?.skill?.input.reworkPageKey).toBe('checkout');
    // The recovery sequence binds to checkout_start (the event that fires there).
    const email = node('email:recovery');
    expect(email?.skill?.input.event).toBe('checkout_start');
    expect(email?.skill?.input.campaignType).toBe('cart-abandonment');
    // The test link points at the reworked page.
    expect(node('link:0')?.skill?.input.funnelPage).toBe('checkout');
    // The variant-of lineage is on the source (the builder draws the edge).
    expect(drafted.source.parentFunnelId).toBe('f1');
    expect(drafted.source.leakEdgeId).toBe('e:funnel:f1->page:f1:checkout');
  });
});

describe('draftFromClone', () => {
  const drafted = draftFromClone({
    parentFunnelId: 'f1',
    parentName: 'Mindshift',
    parentSlug: 'mindshift',
    kind: 'sales',
    pageKeys: ['optin', 'sales', 'checkout'],
  });
  const node = (key: string) => drafted.nodes.find((n) => n.key === key);

  it('clones the winner into a variant with its pages + a test link', () => {
    const funnel = node('funnel');
    expect(funnel?.skill?.name).toBe('clone_funnel');
    expect(funnel?.skill?.input.slug).toContain('variant');
    // The parent's pages ride along as informational nodes.
    for (const key of ['page:optin', 'page:sales', 'page:checkout']) {
      expect(node(key)?.skill).toBeNull();
    }
    // A fresh link drives the test traffic at the first page.
    expect(node('link:0')?.skill?.input.funnelPage).toBe('optin');
    expect(drafted.source.parentFunnelId).toBe('f1');
  });
});

// ---------------------------------------------------------------------------
// Validation — a malformed subgraph never reaches the canvas
// ---------------------------------------------------------------------------

describe('blueprintDraftErrors', () => {
  it('flags a missing name, an empty subgraph, and a dangling edge', () => {
    expect(blueprintDraftErrors({}).join(' ')).toContain('a name');
    expect(
      blueprintDraftErrors({ name: 'X', nodes: [] }).join(' '),
    ).toContain('at least one node');
    const dangling: BlueprintNode[] = [
      {
        key: 'funnel',
        kind: 'funnel',
        label: 'F',
        sub: '',
        metrics: [],
        skill: { name: 'create_funnel', input: {} },
        linksTo: ['page:nowhere'],
      },
    ];
    expect(
      blueprintDraftErrors({ name: 'X', nodes: dangling }).join(' '),
    ).toContain('isn\'t a node');
  });

  it('flags a non-page node with no skill (only pages are informational)', () => {
    const nodes: BlueprintNode[] = [
      {
        key: 'email:x',
        kind: 'email',
        label: 'E',
        sub: '',
        metrics: [],
        skill: null,
        linksTo: [],
      },
    ];
    expect(
      blueprintDraftErrors({ name: 'X', nodes }).join(' '),
    ).toContain('no skill');
  });
});

// ---------------------------------------------------------------------------
// The store round-trip — a blueprint survives row → record intact
// ---------------------------------------------------------------------------

describe('rowToBlueprint', () => {
  it('round-trips the nodes + source + status through the row shape', () => {
    const drafted = draftFromResearch({ artifactId: 'a1', title: 'T', brief: OFFER });
    const row: SystemBlueprintRow = {
      id: 'bp1',
      name: drafted.name,
      mode: 'research',
      source: drafted.source,
      nodes: drafted.nodes,
      status: 'proposed',
      recipe_run_id: 'run-9',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    };
    const bp = rowToBlueprint(row);
    expect(bp.id).toBe('bp1');
    expect(bp.mode).toBe('research');
    expect(bp.status).toBe('proposed');
    expect(bp.recipeRunId).toBe('run-9');
    expect(bp.source.artifactId).toBe('a1');
    // The nodes survive intact — every skill call + edge round-trips.
    expect(bp.nodes.length).toBe(drafted.nodes.length);
    const funnel = bp.nodes.find((n) => n.key === 'funnel');
    expect(funnel?.skill?.name).toBe('create_funnel');
    expect(funnel?.linksTo).toContain('page:optin');
  });

  it('defends the boundary: malformed nodes drop, unknown status/mode fall back', () => {
    const bp = rowToBlueprint({
      id: 'bp2',
      name: null,
      mode: 'weird',
      source: 'not-an-object',
      nodes: [{ key: 'x', kind: 'not-a-kind' }, { nope: true }, null],
      status: 'whatever',
      recipe_run_id: null,
      created_at: null,
      updated_at: null,
    });
    expect(bp.mode).toBe('research'); // unknown → research
    expect(bp.status).toBe('proposed'); // unknown → proposed
    expect(bp.nodes).toEqual([]); // malformed nodes dropped
    expect(bp.source.summary).toBe('');
  });
});

// ---------------------------------------------------------------------------
// The builder's pending overlay — a proposed blueprint renders dashed/pending
// ---------------------------------------------------------------------------

describe('buildSystemMap pending overlay', () => {
  const funnel: SystemMapInput['funnels'][number] = {
    id: 'f1',
    slug: 'mindshift',
    name: 'Mindshift',
    status: 'published',
    kind: 'sales',
    metrics: { views: 100, leads: 20, checkouts: 5, purchases: 2, revenueCents: 5400 },
    pages: [{ key: 'optin', label: 'Opt-in', metric: '', href: '/x' }],
    emails: [],
  };
  const input: SystemMapInput = { funnels: [funnel], links: [], content: [] };

  const drafted = draftFromClone({
    parentFunnelId: 'f1',
    parentName: 'Mindshift',
    parentSlug: 'mindshift',
    kind: 'sales',
    pageKeys: ['optin'],
  });
  const blueprint = {
    id: 'bp1',
    name: drafted.name,
    mode: 'clone' as const,
    source: drafted.source,
    nodes: drafted.nodes,
    status: 'proposed' as const,
    recipeRunId: null,
    createdAt: null,
    updatedAt: null,
  };

  it('renders the pending blueprint as a band of pending nodes below the real systems', () => {
    const map = buildSystemMap(input, { pendingBlueprints: [blueprint] });
    const bpNodes = map.nodes.filter((n) => n.blueprintId === 'bp1');
    expect(bpNodes.length).toBe(drafted.nodes.length);
    // Every blueprint node is pending + carries its blueprint id.
    for (const n of bpNodes) {
      expect(n.status).toBe('pending');
      expect(n.blueprintId).toBe('bp1');
    }
    // The anchor (the funnel node) is marked for approve/reject.
    const anchor = bpNodes.find((n) => n.kind === 'funnel');
    expect(anchor?.blueprintAnchor).toBe(true);
    // The blueprint's nodes sit below the real funnel's nodes.
    const realMaxY = Math.max(
      ...map.nodes.filter((n) => !n.blueprintId).map((n) => n.y),
    );
    for (const n of bpNodes) expect(n.y).toBeGreaterThan(realMaxY);
  });

  it('draws the variant-of edge from the parent funnel to the clone', () => {
    const map = buildSystemMap(input, { pendingBlueprints: [blueprint] });
    const variantEdge = map.edges.find(
      (e) => e.from === 'funnel:f1' && e.to === 'blueprint:bp1:funnel',
    );
    expect(variantEdge).toBeDefined();
  });

  it('lays the blueprint nodes into their lanes with no two sharing a position', () => {
    const map = buildSystemMap(input, { pendingBlueprints: [blueprint] });
    const positions = new Set(map.nodes.map((n) => `${n.x},${n.y}`));
    expect(positions.size).toBe(map.nodes.length);
    // The clone's link lands in the links lane, its page in pages.
    expect(map.nodes.find((n) => n.id === 'blueprint:bp1:link:0')?.lane).toBe('links');
    expect(map.nodes.find((n) => n.id === 'blueprint:bp1:page:optin')?.lane).toBe('pages');
  });
});

// ---------------------------------------------------------------------------
// The materializer — the ONLY write path, run on approve. Deps injected.
// ---------------------------------------------------------------------------

describe('materializeBlueprint', () => {
  /** In-memory fake deps recording every write, in order. */
  function fakeDeps() {
    const calls: string[] = [];
    const salesFunnel = {
      id: 'sf-new',
      slug: 'calm-week-abc',
      emailKits: [] as Array<{ event: string; emailKitId: string }>,
      emailKitId: null,
      optin: {},
      sales: {},
      vsl: {},
      checkout: {},
      upsell1: {},
      upsell2: {},
      upsell3: {},
      upsell4: {},
      success: {},
      access: {},
      footer: {},
      offerSlug: null,
      leadGenSlug: null,
      name: 'Calm Week',
      status: 'draft',
    };
    return {
      calls,
      salesFunnel,
      deps: {
        upsertSalesFunnel: async (input: Record<string, unknown>) => {
          calls.push(`upsertSalesFunnel:${input.slug}`);
          return { id: salesFunnel.id, slug: salesFunnel.slug };
        },
        upsertOptinFunnel: async (input: Record<string, unknown>) => {
          calls.push(`upsertOptinFunnel:${input.slug}`);
          return { id: 'of-new', slug: String(input.slug) };
        },
        getSalesFunnelById: async () => salesFunnel,
        getOptinFunnelById: async () => null,
        upsertEmailKit: async (input: Record<string, unknown>) => {
          calls.push(`upsertEmailKit:${input.name}`);
          return { id: 'kit-new' };
        },
        createUtmLink: async (input: Record<string, unknown>) => {
          calls.push(`createUtmLink:${input.label}:${input.baseUrl}`);
          return { id: `link-${calls.length}` };
        },
        upsertContentPlan: async (input: Record<string, unknown>) => {
          calls.push(`upsertContentPlan:${input.pieceId}`);
          return { id: input.pieceId };
        },
      },
    };
  }

  it('materializes a research blueprint in dependency order, resolving the local refs', async () => {
    const { deps, calls } = fakeDeps();
    const drafted = draftFromResearch({ artifactId: 'a1', title: 'Calm Week', brief: OFFER });
    const { created } = await materializeBlueprint(
      { nodes: drafted.nodes },
      { deps },
    );

    // Every materializable node produced a record (pages are informational).
    const keys = created.map((c) => c.key);
    expect(keys).toContain('funnel');
    expect(keys).toContain('email:nurture');
    for (let i = 0; i < 3; i++) {
      expect(keys).toContain(`content:${i}`);
      expect(keys).toContain(`link:${i}`);
    }
    expect(keys).not.toContain('page:optin'); // informational, never written

    // Dependency order: the funnel is written before the email binds to it and
    // before the links point at it.
    const funnelAt = calls.findIndex((c) => c.startsWith('upsertSalesFunnel'));
    const emailAt = calls.findIndex((c) => c.startsWith('upsertEmailKit'));
    const firstLinkAt = calls.findIndex((c) => c.startsWith('createUtmLink'));
    expect(funnelAt).toBeGreaterThanOrEqual(0);
    expect(emailAt).toBeGreaterThan(funnelAt);
    expect(firstLinkAt).toBeGreaterThan(funnelAt);

    // The links resolve the funnel's slug into their destination URL.
    const linkCall = calls.find((c) => c.startsWith('createUtmLink'));
    expect(linkCall).toContain('/funnel/calm-week-abc');
  });

  it('binds the email sequence to the funnel it just created (the local funnelKey ref)', async () => {
    const { deps, calls } = fakeDeps();
    const drafted = draftFromResearch({ artifactId: 'a1', title: 'Calm Week', brief: OFFER });
    await materializeBlueprint({ nodes: drafted.nodes }, { deps });
    // The kit was created, then the funnel was re-read and re-upserted with the
    // binding — the bind is a SECOND sales-funnel write after the create.
    expect(calls.some((c) => c.startsWith('upsertEmailKit:Calm Week nurture'))).toBe(true);
    const salesWrites = calls.filter((c) => c.startsWith('upsertSalesFunnel'));
    expect(salesWrites.length).toBe(2); // create + the bind re-upsert
  });

  it('materializes a clone via clone_funnel against the parent', async () => {
    const { deps, calls } = fakeDeps();
    const drafted = draftFromClone({
      parentFunnelId: 'f1',
      parentName: 'Mindshift',
      parentSlug: 'mindshift',
      kind: 'sales',
      pageKeys: ['optin'],
    });
    const { created } = await materializeBlueprint({ nodes: drafted.nodes }, { deps });
    // The variant funnel + its test link materialized; the page is informational.
    expect(created.map((c) => c.key)).toEqual(
      expect.arrayContaining(['funnel', 'link:0']),
    );
    expect(calls.some((c) => c.startsWith('upsertSalesFunnel'))).toBe(true);
    expect(calls.some((c) => c.startsWith('createUtmLink'))).toBe(true);
  });

  it('fails loudly when a link references a funnel that was never created', async () => {
    const { deps } = fakeDeps();
    const orphan: BlueprintNode[] = [
      {
        key: 'link:0',
        kind: 'link',
        label: 'L',
        sub: '',
        metrics: [],
        skill: {
          name: 'create_tracked_link',
          input: { funnelKey: 'funnel', funnelKind: 'sales', funnelPage: 'optin', label: 'L', utmSource: 'x' },
        },
        linksTo: [],
      },
    ];
    await expect(
      materializeBlueprint({ nodes: orphan }, { deps }),
    ).rejects.toThrow(/hasn't been created/);
  });
});

// ---------------------------------------------------------------------------
// The gated invariant — the drafters only PROPOSE; nothing writes before
// approve. The drafters are pure (they return data, import no store), and the
// only write path is materializeBlueprint, which the approve route alone calls.
// ---------------------------------------------------------------------------

describe('the gated invariant', () => {
  it('the drafters produce a plan without touching a store (pure data in, data out)', () => {
    // Calling every drafter performs no write — each returns a plain object.
    // (If a drafter ever imported a store, this module's import graph would
    // drag the service-role client into the test — it doesn't.)
    const research = draftFromResearch({ artifactId: 'a', title: 'T', brief: OFFER });
    const opt = draftFromOptimization({
      parentFunnelId: 'f', parentName: 'N', parentSlug: 'n', kind: 'sales',
      leakPageKey: 'checkout', leakLabel: 'Checkout rate',
    });
    const clone = draftFromClone({
      parentFunnelId: 'f', parentName: 'N', parentSlug: 'n', kind: 'sales',
    });
    // Each is a serializable plan (the proposal), not a side effect.
    for (const d of [research, opt, clone]) {
      expect(() => JSON.stringify(d.nodes)).not.toThrow();
      expect(d.nodes.length).toBeGreaterThan(0);
    }
  });

  it('normalizeBlueprintNodes drops a node whose skill is unknown (never a silent write)', () => {
    const nodes = normalizeBlueprintNodes([
      { key: 'funnel', kind: 'funnel', label: 'F', skill: { name: 'drop_table', input: {} } },
      { key: 'page:x', kind: 'page', label: 'P', skill: null },
    ]);
    // The unknown skill normalizes to null — but the funnel is not a page, so
    // validation would flag it. The page (informational) survives clean.
    expect(nodes.find((n) => n.key === 'funnel')?.skill).toBeNull();
    expect(nodes.find((n) => n.key === 'page:x')).toBeDefined();
    // And validation catches that the funnel lost its skill.
    expect(blueprintDraftErrors({ name: 'X', nodes }).join(' ')).toContain('no skill');
  });
});
