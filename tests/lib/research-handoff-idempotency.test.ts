/**
 * Handoff replay-safety (roadmap Phase 1: idempotency keys, extended).
 *
 * The step-sized lane can re-fire a handoff — a resume after a crash, an
 * owner retry, a gate approved twice. Every target must land on the SAME
 * row: planner cards by deterministic piece id (upsert on
 * `piece_id,offer_slug`), kits/funnels by deterministic artifact-suffixed
 * slug resolved to the row id before the write.
 *
 * These tests run runHandoff TWICE against an in-memory store double that
 * enforces UNIQUE(slug) the way Postgres does: a second INSERT on the same
 * slug throws. Before the fix, the second handoff died on that constraint;
 * now it updates the row — and the row count stays 1.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResearchArtifact, ResearchSession } from '@/lib/mothermode/research/types';
import { blankIntake } from '@/lib/mothermode/research/intake';

/* ------------------------------------------------------------------ *
 * In-memory store doubles (UNIQUE(slug) enforced, like the real tables)
 * ------------------------------------------------------------------ */

interface Row {
  id: string;
  slug: string;
  [key: string]: unknown;
}

/** ES5-target-safe Map reads (forEach, not iteration — the house rule). */
function keysOf<K, V>(map: Map<K, V>): K[] {
  const out: K[] = [];
  map.forEach((_, k) => out.push(k));
  return out;
}
function valuesOf<K, V>(map: Map<K, V>): V[] {
  const out: V[] = [];
  map.forEach((v) => out.push(v));
  return out;
}

/** A table double: upsert-on-id, insert-with-fresh-id, 23505 on dupe slug. */
function fakeTable(prefix: string) {
  const rows = new Map<string, Row>();
  let seq = 0;
  const upsert = vi.fn(async (input: Record<string, unknown>) => {
    const slug = String(input.slug ?? '');
    if (input.id) {
      const existing = valuesOf(rows).find((r) => r.id === input.id);
      if (existing) {
        Object.assign(existing, input);
        return existing;
      }
    }
    if (slug && rows.has(slug)) {
      const err = new Error(
        `duplicate key value violates unique constraint "${prefix}_slug_key"`,
      );
      (err as { code?: string }).code = '23505';
      throw err;
    }
    const row: Row = { ...input, id: (input.id as string) ?? `${prefix}-${++seq}`, slug };
    if (slug) rows.set(slug, row);
    return row;
  });
  const getBySlug = vi.fn(async (slug: string) => rows.get(slug) ?? null);
  return { rows, upsert, getBySlug };
}

const leadgen = fakeTable('lead');
const email = fakeTable('email');
const sales = fakeTable('sf');
const optin = fakeTable('opt');

/** The planner board: keyed by piece_id+offer_slug like the real UNIQUE. */
const planRows = new Map<string, Record<string, unknown>>();
const upsertContentPlan = vi.fn(async (input: Record<string, unknown>) => {
  const key = `${input.pieceId}|${input.offerSlug ?? ''}`;
  planRows.set(key, { ...input });
  return input;
});

const getArtifact = vi.fn();
const upsertArtifact = vi.fn(
  async (input: { id: string; handedOffTo?: unknown; status?: string }) => ({
    ...currentArtifact!,
    status: input.status ?? currentArtifact!.status,
    handedOffTo: input.handedOffTo ?? currentArtifact!.handedOffTo,
  }),
);

let currentArtifact: ResearchArtifact | null = null;

vi.mock('@/lib/mothermode/research/store', () => ({
  getArtifact: (id: string) => getArtifact(id),
  upsertArtifact: (input: unknown) => upsertArtifact(input as never),
}));
vi.mock('@/lib/mothermode/planner/store', () => ({
  upsertContentPlan: (input: Record<string, unknown>) => upsertContentPlan(input),
}));
vi.mock('@/lib/mothermode/leadgen/store', () => ({
  upsertKit: (input: Record<string, unknown>) => leadgen.upsert(input),
  getKitBySlug: (slug: string) => leadgen.getBySlug(slug),
}));
vi.mock('@/lib/mothermode/email/store', () => ({
  upsertKit: (input: Record<string, unknown>) => email.upsert(input),
  getKitBySlug: (slug: string) => email.getBySlug(slug),
}));
vi.mock('@/lib/mothermode/sales/store', () => ({
  upsertFunnel: (input: Record<string, unknown>) => sales.upsert(input),
  getFunnelBySlug: (slug: string) => sales.getBySlug(slug),
}));
vi.mock('@/lib/mothermode/optin/store', () => ({
  upsertFunnel: (input: Record<string, unknown>) => optin.upsert(input),
  getFunnelBySlug: (slug: string) => optin.getBySlug(slug),
}));
vi.mock('@/utils/integrations/openai-leadgen', () => ({
  aiGenerateDoc: vi.fn(async () => ({ ok: true, data: {} })),
}));
vi.mock('@/utils/integrations/openai-email', () => ({
  aiGenerateSequence: vi.fn(async () => ({ ok: true, data: {} })),
}));
vi.mock('@/utils/integrations/openai-sales', () => ({
  aiGenerateSalesFunnel: vi.fn(async () => ({ ok: false, error: 'not exercised' })),
}));
vi.mock('@/lib/mothermode/context/resolve', () => ({
  resolveContextRefs: vi.fn(async () => []),
}));

// Imported AFTER the mocks are declared (vi.mock hoists).
import { runHandoff } from '@/lib/mothermode/research/handoff';

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */

const SESSION: ResearchSession = {
  id: 'sess-1',
  title: 'Offload Map research',
  offerSlug: 'offload-map',
  contextRefs: [],
  intake: blankIntake(),
  status: 'active',
  createdAt: null,
  updatedAt: null,
  updatedBy: null,
};

function artifact(partial: Partial<ResearchArtifact>): ResearchArtifact {
  return {
    id: 'abcd1234-5678-4abc-8abc-abcd12345678', // suffix abcd1234
    sessionId: SESSION.id,
    type: 'notes',
    title: 'Test artifact',
    markdown: '',
    structured: {},
    status: 'final',
    handedOffTo: null,
    version: 1,
    parentId: '',
    createdBy: 'agent',
    createdAt: null,
    updatedAt: null,
    ...partial,
  };
}

const OFFER_STRUCTURED = {
  name: 'Offload Map',
  audience: 'burnt-out moms',
  promise: 'A calmer week.',
  mechanism: 'The 3-list offload.',
  priceCents: 2700,
  angles: ['time scarcity', 'mental load'],
  notes: '',
};

beforeEach(() => {
  leadgen.rows.clear();
  email.rows.clear();
  sales.rows.clear();
  optin.rows.clear();
  planRows.clear();
  vi.clearAllMocks();
  getArtifact.mockImplementation(async () => currentArtifact);
});

/* ------------------------------------------------------------------ *
 * The proofs
 * ------------------------------------------------------------------ */

describe('handoff replay-safety', () => {
  it('planner-cards: a replay upserts the same deterministic piece ids', async () => {
    currentArtifact = artifact({
      type: 'content-plan',
      structured: {
        items: [
          { title: 'Post one', hook: 'h1', platform: 'instagram', format: 'feed', kind: 'organic', date: '', notes: '' },
          { title: 'Post two', hook: 'h2', platform: 'tiktok', format: 'video', kind: 'paid', date: '', notes: '' },
        ],
      },
    });

    const first = await runHandoff({ artifactId: currentArtifact.id, target: 'planner-cards', session: SESSION });
    const second = await runHandoff({ artifactId: currentArtifact.id, target: 'planner-cards', session: SESSION });

    expect(first.ok && second.ok).toBe(true);
    expect(planRows.size).toBe(2); // not 4 — the replay UPDATED both cards
    expect(keysOf(planRows)).toEqual([
      'research_abcd1234_1|offload-map',
      'research_abcd1234_2|offload-map',
    ]);
    // 4 writes, 2 rows: every write past the first two was an update.
    expect(upsertContentPlan).toHaveBeenCalledTimes(4);
  });

  it('leadgen-kit: the second handoff updates the row instead of 23505', async () => {
    currentArtifact = artifact({
      type: 'lead-magnet',
      structured: {
        title: 'Offload Map Guide',
        format: 'guide',
        promise: 'A calmer week.',
        audience: 'moms',
        outline: ['step 1'],
        cta: 'Get it.',
        notes: '',
      },
    });

    const first = await runHandoff({ artifactId: currentArtifact.id, target: 'leadgen-kit', session: SESSION });
    const second = await runHandoff({ artifactId: currentArtifact.id, target: 'leadgen-kit', session: SESSION });

    expect(first.ok && second.ok).toBe(true);
    expect(leadgen.rows.size).toBe(1);
    const row = valuesOf(leadgen.rows)[0];
    expect(row.slug).toBe('offload-map-guide-abcd1234');
    // The replay resolved the slug to the row's id — the write was an UPDATE.
    expect(leadgen.upsert.mock.calls[1][0].id).toBe(row.id);
    if (first.ok && second.ok) {
      expect(second.handedOffTo.id).toBe(first.handedOffTo.id);
    }
  });

  it('sales-funnel: the second handoff updates the row instead of 23505', async () => {
    currentArtifact = artifact({
      type: 'offer-brief',
      structured: OFFER_STRUCTURED,
    });

    const first = await runHandoff({ artifactId: currentArtifact.id, target: 'sales-funnel', session: SESSION });
    const second = await runHandoff({ artifactId: currentArtifact.id, target: 'sales-funnel', session: SESSION });

    expect(first.ok && second.ok).toBe(true);
    expect(sales.rows.size).toBe(1);
    const row = valuesOf(sales.rows)[0];
    expect(row.slug).toBe('offload-map-abcd1234');
    expect(sales.upsert.mock.calls[1][0].id).toBe(row.id);
  });

  it('system fan-out: a full replay rebuilds every part in place', async () => {
    currentArtifact = artifact({
      type: 'offer-brief',
      structured: OFFER_STRUCTURED,
    });

    const first = await runHandoff({ artifactId: currentArtifact.id, target: 'system', session: SESSION });
    const second = await runHandoff({ artifactId: currentArtifact.id, target: 'system', session: SESSION });

    expect(first.ok && second.ok).toBe(true);
    // One row per part, still — no duplicates from the replay.
    expect(leadgen.rows.size).toBe(1);
    expect(optin.rows.size).toBe(1);
    expect(email.rows.size).toBe(1);
    expect(sales.rows.size).toBe(1);
    expect(planRows.size).toBe(2); // one card per angle
    expect(keysOf(planRows)).toEqual([
      'research_system_abcd1234_1|offload-map',
      'research_system_abcd1234_2|offload-map',
    ]);
    // The manifest parts keep the SAME ids across the replay.
    if (first.ok && second.ok) {
      const partsOf = (a: ResearchArtifact) =>
        (a.structured.systemManifest as Array<{ kind: string; id: string }>) ?? [];
      expect(partsOf(second.artifact)).toEqual(partsOf(first.artifact));
    }
  });

  it('a failed slug lookup degrades to insert-first behavior (loud, never silent-dupe)', async () => {
    currentArtifact = artifact({
      type: 'lead-magnet',
      structured: { title: 'Guide', format: 'guide', promise: '', audience: '', outline: [], cta: '', notes: '' },
    });
    // Lookup throws (transient DB hiccup) — the write proceeds as an insert,
    // and a REAL collision would surface as the constraint error, not a dupe.
    leadgen.getBySlug.mockRejectedValueOnce(new Error('connection reset'));

    const first = await runHandoff({ artifactId: currentArtifact.id, target: 'leadgen-kit', session: SESSION });
    expect(first.ok).toBe(true);
    expect(leadgen.rows.size).toBe(1);
    expect(leadgen.upsert.mock.calls[0][0].id).toBeNull();
  });
});
