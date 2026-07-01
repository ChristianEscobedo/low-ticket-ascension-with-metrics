import { describe, it, expect } from 'vitest';
import {
  makeSavedVersion,
  scheduleVersion,
  publishVersion,
  unscheduleVersion,
  countByStatus,
  sortVersions,
  versionStatusRank,
  VERSION_STATUS_LABEL,
  type SavedVersion,
} from '@/lib/mothermode/content/versions';
import type { VersionParts } from '@/lib/mothermode/content/compose';

const parts: VersionParts = { hook: 'Hook.', body: ['A.', 'B.'], cta: 'Go.' };
const NOW = '2026-06-30T12:00:00.000Z';

describe('makeSavedVersion', () => {
  it('builds a draft carrying the parts, id, and timestamps', () => {
    const v = makeSavedVersion(parts, 'id-1', NOW);
    expect(v).toMatchObject({
      id: 'id-1',
      hook: 'Hook.',
      body: ['A.', 'B.'],
      cta: 'Go.',
      status: 'draft',
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(v.scheduledFor).toBeUndefined();
  });
});

describe('status transitions', () => {
  const base = makeSavedVersion(parts, 'id-1', NOW);
  const LATER = '2026-07-01T09:00:00.000Z';
  const WHEN = '2026-07-04T15:30:00.000Z';

  it('schedules with a time and bumps updatedAt, keeping createdAt', () => {
    const v = scheduleVersion(base, WHEN, LATER);
    expect(v.status).toBe('scheduled');
    expect(v.scheduledFor).toBe(WHEN);
    expect(v.updatedAt).toBe(LATER);
    expect(v.createdAt).toBe(NOW);
  });

  it('publishing drops any pending schedule', () => {
    const scheduled = scheduleVersion(base, WHEN, LATER);
    const v = publishVersion(scheduled, LATER);
    expect(v.status).toBe('published');
    expect(v.scheduledFor).toBeUndefined();
  });

  it('reset returns to draft and clears the schedule', () => {
    const scheduled = scheduleVersion(base, WHEN, LATER);
    const v = unscheduleVersion(scheduled, LATER);
    expect(v.status).toBe('draft');
    expect(v.scheduledFor).toBeUndefined();
  });

  it('does not mutate the input', () => {
    scheduleVersion(base, WHEN, LATER);
    expect(base.status).toBe('draft');
    expect(base.scheduledFor).toBeUndefined();
  });
});

describe('countByStatus', () => {
  it('tallies each status and zero-fills the rest', () => {
    const list: SavedVersion[] = [
      { ...makeSavedVersion(parts, 'a', NOW), status: 'draft' },
      { ...makeSavedVersion(parts, 'b', NOW), status: 'scheduled' },
      { ...makeSavedVersion(parts, 'c', NOW), status: 'scheduled' },
    ];
    expect(countByStatus(list)).toEqual({ draft: 1, scheduled: 2, published: 0 });
    expect(countByStatus([])).toEqual({ draft: 0, scheduled: 0, published: 0 });
  });
});

describe('sortVersions', () => {
  it('orders scheduled (soonest first), then drafts and published newest-first', () => {
    const list: SavedVersion[] = [
      { ...makeSavedVersion(parts, 'pub', '2026-06-10T00:00:00Z'), status: 'published' },
      { ...makeSavedVersion(parts, 'draft-old', '2026-06-01T00:00:00Z'), status: 'draft' },
      {
        ...makeSavedVersion(parts, 'sch-late', NOW),
        status: 'scheduled',
        scheduledFor: '2026-08-01T00:00:00Z',
      },
      {
        ...makeSavedVersion(parts, 'sch-soon', NOW),
        status: 'scheduled',
        scheduledFor: '2026-07-01T00:00:00Z',
      },
      { ...makeSavedVersion(parts, 'draft-new', '2026-06-20T00:00:00Z'), status: 'draft' },
    ];
    expect(sortVersions(list).map((v) => v.id)).toEqual([
      'sch-soon',
      'sch-late',
      'draft-new',
      'draft-old',
      'pub',
    ]);
  });

  it('is pure: the input array is not reordered', () => {
    const list: SavedVersion[] = [
      { ...makeSavedVersion(parts, 'a', NOW), status: 'published' },
      { ...makeSavedVersion(parts, 'b', NOW), status: 'draft' },
    ];
    const copy = [...list];
    sortVersions(list);
    expect(list).toEqual(copy);
  });
});

describe('status labels and rank', () => {
  it('exposes a label for every status', () => {
    expect(VERSION_STATUS_LABEL).toEqual({
      draft: 'Saved',
      scheduled: 'Scheduled',
      published: 'Published',
    });
  });
  it('ranks scheduled ahead of draft ahead of published', () => {
    expect(versionStatusRank('scheduled')).toBeLessThan(versionStatusRank('draft'));
    expect(versionStatusRank('draft')).toBeLessThan(versionStatusRank('published'));
  });
});
