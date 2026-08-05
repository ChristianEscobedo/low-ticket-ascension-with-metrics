import { describe, expect, it } from 'vitest';

import {
  countByField,
  countByStatus,
  filterAssets,
  findGaps,
  flattenBundle,
  recentActivity,
  rollupFunnels,
  searchAssets,
  sumMetric,
  totals,
} from '@/lib/mothermode/assets/metrics';
import { EMPTY_BUNDLE, isAssetTabId } from '@/lib/mothermode/assets/types';
import type { AssetBundle, AssetItem } from '@/lib/mothermode/assets/types';

const item = (over: Partial<AssetItem> & Pick<AssetItem, 'id'>): AssetItem => ({
  kind: 'organic',
  title: `Asset ${over.id}`,
  status: 'published',
  ...over,
});

const bundle = (over: Partial<AssetBundle> = {}): AssetBundle => ({
  ...EMPTY_BUNDLE,
  ...over,
});

describe('asset hub metrics', () => {
  it('sums a metric key and ignores items missing it', () => {
    const items = [
      item({ id: 'a', metrics: { views: 100 } }),
      item({ id: 'b', metrics: { leads: 5 } }),
      item({ id: 'c' }),
    ];
    expect(sumMetric(items, 'views')).toBe(100);
    expect(sumMetric(items, 'leads')).toBe(5);
    expect(sumMetric(items, 'nope')).toBe(0);
  });

  it('counts by status', () => {
    const counts = countByStatus([
      item({ id: 'a', status: 'published' }),
      item({ id: 'b', status: 'published' }),
      item({ id: 'c', status: 'draft' }),
      item({ id: 'd', status: 'planned' }),
    ]);
    expect(counts).toEqual({ published: 2, draft: 1, planned: 1 });
  });

  it('counts by field, skipping empties and sorting by frequency', () => {
    const counts = countByField(
      [
        item({ id: 'a', platform: 'instagram' }),
        item({ id: 'b', platform: 'tiktok' }),
        item({ id: 'c', platform: 'instagram' }),
        item({ id: 'd' }),
      ],
      'platform',
    );
    expect(counts).toEqual([
      { key: 'instagram', count: 2 },
      { key: 'tiktok', count: 1 },
    ]);
  });

  it('rolls up funnel performance with rates and AOV', () => {
    const roll = rollupFunnels([
      item({
        id: 'f1',
        kind: 'sales-funnel',
        status: 'published',
        metrics: {
          views: 1000,
          leads: 200,
          checkouts: 50,
          purchases: 20,
          revenueCents: 14000,
        },
      }),
      item({
        id: 'f2',
        kind: 'sales-funnel',
        status: 'draft',
        metrics: { views: 0, leads: 0 },
      }),
    ]);
    expect(roll.funnels).toBe(2);
    expect(roll.live).toBe(1);
    expect(roll.views).toBe(1000);
    expect(roll.optinRate).toBe(20);
    expect(roll.closeRate).toBe(10);
    expect(roll.aovCents).toBe(700);
  });

  it('never divides by zero', () => {
    const roll = rollupFunnels([item({ id: 'f', metrics: {} })]);
    expect(roll.optinRate).toBe(0);
    expect(roll.closeRate).toBe(0);
    expect(roll.aovCents).toBe(0);
  });

  it('flattens a bundle across every source', () => {
    const flat = flattenBundle(
      bundle({
        salesFunnels: [item({ id: 'sf' })],
        organic: [item({ id: 'o' })],
        catalog: [item({ id: 'c', status: 'planned' })],
      }),
    );
    expect(flat.map((i) => i.id)).toEqual(['sf', 'o', 'c']);
  });

  it('totals live/draft/planned across the whole bundle', () => {
    const t = totals(
      bundle({
        salesFunnels: [item({ id: 'a', kind: 'sales-funnel' })],
        organic: [item({ id: 'b', status: 'draft' })],
        catalog: [
          item({ id: 'c', kind: 'blueprint', status: 'planned' }),
          item({ id: 'd', kind: 'blueprint', status: 'planned' }),
        ],
      }),
    );
    expect(t.total).toBe(4);
    expect(t.live).toBe(1);
    expect(t.draft).toBe(1);
    expect(t.planned).toBe(2);
    expect(t.byKind[0]).toEqual({ key: 'blueprint', count: 2 });
  });

  it('orders recent activity newest first and drops undated items', () => {
    const recent = recentActivity(
      bundle({
        organic: [
          item({ id: 'old', updatedAt: '2026-01-01T00:00:00Z' }),
          item({ id: 'new', updatedAt: '2026-06-01T00:00:00Z' }),
          item({ id: 'undated' }),
        ],
      }),
    );
    expect(recent.map((i) => i.id)).toEqual(['new', 'old']);
  });

  it('respects the recent activity limit', () => {
    const organic = Array.from({ length: 20 }, (_, n) =>
      item({ id: `p${n}`, updatedAt: `2026-01-${String(n + 1).padStart(2, '0')}T00:00:00Z` }),
    );
    expect(recentActivity(bundle({ organic }), 5)).toHaveLength(5);
  });
});

describe('asset hub gap analysis', () => {
  const funnel = (over: Partial<AssetItem>): AssetItem =>
    item({ id: 'f1', kind: 'sales-funnel', title: 'Brain Dump', ...over });

  it('flags a funnel with no email sequence attached', () => {
    const gaps = findGaps(
      bundle({ salesFunnels: [funnel({ metrics: { sequences: 0 } })] }),
    );
    expect(gaps.some((g) => g.id === 'no-sequence:f1')).toBe(true);
  });

  it('does not flag a funnel that already has a sequence', () => {
    const gaps = findGaps(
      bundle({ salesFunnels: [funnel({ metrics: { sequences: 2 } })] }),
    );
    expect(gaps.some((g) => g.id === 'no-sequence:f1')).toBe(false);
  });

  it('flags traffic with zero opt-ins only past the noise threshold', () => {
    const noisy = findGaps(
      bundle({
        salesFunnels: [funnel({ metrics: { sequences: 1, views: 5, leads: 0 } })],
      }),
    );
    expect(noisy.some((g) => g.id === 'no-conversion:f1')).toBe(false);

    const real = findGaps(
      bundle({
        salesFunnels: [
          funnel({ metrics: { sequences: 1, views: 500, leads: 0 } }),
        ],
      }),
    );
    expect(real.some((g) => g.id === 'no-conversion:f1')).toBe(true);
  });

  it('flags unpublished drafts', () => {
    const gaps = findGaps(
      bundle({
        salesFunnels: [funnel({ status: 'draft', metrics: { sequences: 1 } })],
      }),
    );
    expect(gaps.some((g) => g.id === 'draft:f1')).toBe(true);
  });

  it('ignores child page rows so gaps are reported once per funnel', () => {
    const gaps = findGaps(
      bundle({
        salesFunnels: [
          funnel({ metrics: { sequences: 1 } }),
          item({
            id: 'f1:sales',
            kind: 'sales-page',
            parentId: 'f1',
            status: 'draft',
          }),
        ],
      }),
    );
    expect(gaps.some((g) => g.id === 'draft:f1:sales')).toBe(false);
  });

  it('sorts gaps high severity first', () => {
    const gaps = findGaps(
      bundle({ salesFunnels: [funnel({ status: 'draft' })] }),
    );
    expect(gaps[0].severity).toBe('high');
    expect(gaps[gaps.length - 1].severity).toBe('low');
  });
});

describe('asset hub search and filters', () => {
  const items = [
    item({ id: 'a', title: 'Instagram Reel Hook', platform: 'instagram' }),
    item({ id: 'b', title: 'TikTok Story', platform: 'tiktok', status: 'draft' }),
    item({ id: 'c', title: 'Welcome Email', offerSlug: 'brain-dump-system' }),
  ];

  it('searches case-insensitively across title and metadata', () => {
    expect(searchAssets(items, 'REEL').map((i) => i.id)).toEqual(['a']);
    expect(searchAssets(items, 'tiktok').map((i) => i.id)).toEqual(['b']);
    expect(searchAssets(items, 'brain-dump').map((i) => i.id)).toEqual(['c']);
  });

  it('returns everything for an empty query', () => {
    expect(searchAssets(items, '   ')).toHaveLength(3);
  });

  it('filters by status, platform, and offer, treating "all" as no filter', () => {
    expect(filterAssets(items, { status: 'draft' }).map((i) => i.id)).toEqual([
      'b',
    ]);
    expect(
      filterAssets(items, { platform: 'instagram' }).map((i) => i.id),
    ).toEqual(['a']);
    expect(filterAssets(items, { status: 'all', platform: 'all' })).toHaveLength(
      3,
    );
  });
});

describe('asset tab guard', () => {
  it('accepts known tabs and rejects anything else', () => {
    expect(isAssetTabId('organic')).toBe(true);
    expect(isAssetTabId('ads')).toBe(true);
    expect(isAssetTabId('nope')).toBe(false);
    expect(isAssetTabId(undefined)).toBe(false);
  });
});
