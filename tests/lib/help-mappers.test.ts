import { describe, it, expect } from 'vitest';
import {
  rowToArticle,
  rowToChangelogEntry,
  toChangelogType,
  type KbArticleRow,
  type ChangelogRow,
} from '@/lib/mothermode/help/types';

describe('help center row -> type mappers', () => {
  it('maps a kb article row to camelCase', () => {
    const row: KbArticleRow = {
      id: 'a1',
      slug: 'getting-started',
      title: 'Getting Started',
      category: 'Basics',
      excerpt: 'A quick intro.',
      body: '<p>Hello.</p>',
      published: true,
      sort_order: 3,
      updated_at: '2026-01-01T00:00:00.000Z',
      updated_by: 'admin@example.com',
    };
    expect(rowToArticle(row)).toEqual({
      id: 'a1',
      slug: 'getting-started',
      title: 'Getting Started',
      category: 'Basics',
      excerpt: 'A quick intro.',
      body: '<p>Hello.</p>',
      published: true,
      sortOrder: 3,
      updatedAt: '2026-01-01T00:00:00.000Z',
      updatedBy: 'admin@example.com',
    });
  });

  it('maps a changelog row and normalizes the entry type', () => {
    const row: ChangelogRow = {
      id: 'c1',
      version: '1.4.0',
      released_on: '2026-02-15',
      entry_type: 'added',
      title: 'New export',
      body: '<p>Details.</p>',
      published: false,
      updated_at: null,
      updated_by: null,
    };
    const mapped = rowToChangelogEntry(row);
    expect(mapped.version).toBe('1.4.0');
    expect(mapped.releasedOn).toBe('2026-02-15');
    expect(mapped.entryType).toBe('added');
    expect(mapped.published).toBe(false);
  });

  it('defaults an unknown entry type to improved', () => {
    expect(toChangelogType('added')).toBe('added');
    expect(toChangelogType('fixed')).toBe('fixed');
    expect(toChangelogType('nonsense')).toBe('improved');
    expect(toChangelogType(undefined)).toBe('improved');
    expect(toChangelogType(null)).toBe('improved');
  });
});
