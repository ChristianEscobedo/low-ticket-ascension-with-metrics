import { beforeEach, describe, expect, it, vi } from 'vitest';
// vi.mock calls are hoisted above these imports, so the subject under test
// still receives the mocked stores despite the static import order.
import { autobuildSalesEmailKits } from '@/lib/mothermode/sales/emailAutobuild';
import type { SalesFunnelRecord } from '@/lib/mothermode/sales/types';

/**
 * These tests cover the effect layer's promises, not the model output:
 * failures are isolated per event, an already-live kit is never demoted,
 * regeneration reuses the existing kit row, and the funnel is saved once.
 */

const resolveContextRefs = vi.fn();
const getKitById = vi.fn();
const getKitBySlug = vi.fn();
const upsertKit = vi.fn();
const aiGenerateSequence = vi.fn();
const upsertFunnel = vi.fn();

vi.mock('@/lib/mothermode/context/resolve', () => ({
  resolveContextRefs: (...args: unknown[]) => resolveContextRefs(...args),
}));

vi.mock('@/lib/mothermode/email/store', () => ({
  getKitById: (...args: unknown[]) => getKitById(...args),
  getKitBySlug: (...args: unknown[]) => getKitBySlug(...args),
  upsertKit: (...args: unknown[]) => upsertKit(...args),
}));

vi.mock('@/utils/integrations/openai-email', () => ({
  aiGenerateSequence: (...args: unknown[]) => aiGenerateSequence(...args),
}));

vi.mock('@/lib/mothermode/sales/store', () => ({
  upsertFunnel: (...args: unknown[]) => upsertFunnel(...args),
  // Real behaviour, kept tiny: the binding list is the source of truth.
  resolveEmailKitIdForEvent: (funnel: SalesFunnelRecord, event: string) =>
    funnel.emailKits?.find((b) => b.event === event)?.emailKitId ?? null,
}));

function funnel(overrides: Record<string, unknown> = {}): SalesFunnelRecord {
  return {
    id: 'f1',
    slug: 'weekend-reset',
    name: 'Weekend Reset',
    status: 'published',
    offerSlug: 'weekend-reset-offer',
    leadGenSlug: 'weekend-lead-magnet',
    emailKitId: null,
    emailKits: [],
    optin: { headline: 'Get the reset' },
    sales: { name: 'Weekend Reset System', audience: 'founder moms', priceLabel: '$27' },
    checkout: { productName: 'Weekend Reset System', priceLabel: '$27' },
    upsell1: { productName: 'Delegation Vault', priceLabel: '$47' },
    upsell2: {},
    upsell3: {},
    upsell4: {},
    footer: { brandLine: 'MotherMode HQ' },
    ...overrides,
  } as unknown as SalesFunnelRecord;
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveContextRefs.mockResolvedValue([{ id: 'pack-1', title: 'Offer', body: 'text' }]);
  getKitById.mockResolvedValue(null);
  getKitBySlug.mockResolvedValue(null);
  aiGenerateSequence.mockResolvedValue({
    ok: true,
    data: { emails: [{ subject: 'One' }, { subject: 'Two' }] },
  });
  upsertKit.mockImplementation(async (input: Record<string, unknown>) => ({
    id: input.id ?? `kit-${input.slug}`,
    slug: input.slug,
    name: input.name,
    status: input.status,
  }));
  upsertFunnel.mockImplementation(async (input: Record<string, unknown>) => ({
    ...funnel(),
    ...input,
  }));
});

describe('autobuildSalesEmailKits', () => {
  it('generates a kit per event, writes it as a draft, and binds it to the funnel', async () => {
    const out = await autobuildSalesEmailKits(funnel(), { events: ['optin'] });

    expect(out.built).toBe(1);
    expect(out.failed).toBe(0);
    expect(out.results[0]).toMatchObject({ event: 'optin', ok: true, emailCount: 2 });

    // A generated sequence has not been read by a human yet.
    expect(upsertKit.mock.calls[0][0].status).toBe('draft');

    const saved = upsertFunnel.mock.calls[0][0];
    expect(saved.emailKits).toEqual([{ event: 'optin', emailKitId: 'kit-weekend-reset-optin' }]);
    // emailKitId is the legacy single-kit column and means "optin".
    expect(saved.emailKitId).toBe('kit-weekend-reset-optin');
  });

  it('passes resolved packs to the generator, not raw refs', async () => {
    await autobuildSalesEmailKits(funnel(), { events: ['optin'] });

    const packs = aiGenerateSequence.mock.calls[0][3];
    expect(packs).toEqual([{ id: 'pack-1', title: 'Offer', body: 'text' }]);
  });

  it('keeps a live kit live when regenerating over it', async () => {
    getKitById.mockResolvedValue({ id: 'kit-existing', slug: 'custom-slug', status: 'active' });
    const withBinding = funnel({
      emailKits: [{ event: 'optin', emailKitId: 'kit-existing' }],
    });

    await autobuildSalesEmailKits(withBinding, { events: ['optin'] });

    const input = upsertKit.mock.calls[0][0];
    // Reuse the row the funnel is bound to instead of inserting a duplicate slug,
    // and do not silently take a live sequence offline.
    expect(input.id).toBe('kit-existing');
    expect(input.slug).toBe('custom-slug');
    expect(input.status).toBe('active');
  });

  it('reuses an orphaned kit found by planned slug', async () => {
    getKitBySlug.mockResolvedValue({
      id: 'kit-orphan',
      slug: 'weekend-reset-optin',
      status: 'draft',
    });

    await autobuildSalesEmailKits(funnel(), { events: ['optin'] });

    expect(upsertKit.mock.calls[0][0].id).toBe('kit-orphan');
  });

  it('isolates a failing event and still saves the kits that worked', async () => {
    aiGenerateSequence
      .mockResolvedValueOnce({ ok: false, error: 'rate limited' })
      .mockResolvedValueOnce({ ok: true, data: { emails: [{ subject: 'One' }] } });

    const out = await autobuildSalesEmailKits(funnel(), {
      events: ['optin', 'purchase'],
    });

    expect(out.built).toBe(1);
    expect(out.failed).toBe(1);
    expect(out.results[0]).toMatchObject({ ok: false, error: 'rate limited' });
    expect(out.results[1].ok).toBe(true);

    // One write at the end, carrying only the binding that succeeded.
    expect(upsertFunnel).toHaveBeenCalledTimes(1);
    expect(upsertFunnel.mock.calls[0][0].emailKits).toEqual([
      { event: 'purchase', emailKitId: 'kit-weekend-reset-purchase' },
    ]);
  });

  it('reports a thrown error as a failed event instead of rejecting', async () => {
    aiGenerateSequence.mockRejectedValue(new Error('network down'));

    const out = await autobuildSalesEmailKits(funnel(), { events: ['optin'] });

    expect(out.built).toBe(0);
    expect(out.results[0]).toMatchObject({ ok: false, error: 'network down' });
    expect(upsertFunnel).not.toHaveBeenCalled();
  });

  it('does not touch the funnel when nothing generated', async () => {
    aiGenerateSequence.mockResolvedValue({ ok: false, error: 'bad json' });

    const out = await autobuildSalesEmailKits(funnel(), { events: ['optin'] });

    expect(upsertFunnel).not.toHaveBeenCalled();
    expect(out.funnel.id).toBe('f1');
  });

  it('preserves bindings for events outside this run', async () => {
    const withBinding = funnel({
      emailKits: [{ event: 'purchase', emailKitId: 'kit-purchase-old' }],
    });

    await autobuildSalesEmailKits(withBinding, { events: ['optin'] });

    expect(upsertFunnel.mock.calls[0][0].emailKits).toEqual([
      { event: 'purchase', emailKitId: 'kit-purchase-old' },
      { event: 'optin', emailKitId: 'kit-weekend-reset-optin' },
    ]);
  });

  it('skips events that already have a kit when onlyMissing is set', async () => {
    const withBinding = funnel({
      emailKits: [{ event: 'optin', emailKitId: 'kit-existing' }],
    });

    const out = await autobuildSalesEmailKits(withBinding, {
      events: ['optin'],
      onlyMissing: true,
    });

    expect(aiGenerateSequence).not.toHaveBeenCalled();
    expect(out.results).toEqual([]);
    expect(upsertFunnel).not.toHaveBeenCalled();
  });
});
