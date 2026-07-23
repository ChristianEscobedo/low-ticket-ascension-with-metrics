/**
 * Types for the MotherMode Help Center: a database-backed, in-app-editable
 * knowledge base plus a release changelog. An admin authors and publishes both
 * through /admin/help without a deploy; published rows are readable by anon so
 * the public viewer pages can stay cacheable (RLS gates drafts server-side).
 *
 * `body`/`excerpt` are trusted, hand-authored admin content (like
 * DeliverableDoc.html), never buyer input.
 */

/** One knowledge base / help article. Grouped by `category`, ordered within a
 *  category by `sortOrder`, addressed publicly by its stable `slug`. */
export interface KbArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
  excerpt?: string | null;
  body: string;
  published: boolean;
  sortOrder: number;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

/** The kind of change a changelog entry describes. */
export type ChangelogType = 'added' | 'improved' | 'fixed' | 'removed';

/** One dated, optionally versioned release note. */
export interface ChangelogEntry {
  id: string;
  version?: string | null;
  releasedOn: string; // ISO date (YYYY-MM-DD)
  entryType: ChangelogType;
  title: string;
  body: string;
  published: boolean;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

/** Row shape for `mothermode_kb_articles` (snake_case as stored). */
export interface KbArticleRow {
  id: string;
  slug: string;
  title: string;
  category: string;
  excerpt: string | null;
  body: string;
  published: boolean;
  sort_order: number;
  updated_at: string | null;
  updated_by: string | null;
}

/** Row shape for `mothermode_changelog` (snake_case as stored). */
export interface ChangelogRow {
  id: string;
  version: string | null;
  released_on: string;
  entry_type: string;
  title: string;
  body: string;
  published: boolean;
  updated_at: string | null;
  updated_by: string | null;
}

/** The four allowed changelog entry types. */
export const CHANGELOG_TYPES: ChangelogType[] = ['added', 'improved', 'fixed', 'removed'];

/** Coerce an arbitrary string to a valid ChangelogType, defaulting to 'improved'. */
export function toChangelogType(value: unknown): ChangelogType {
  return CHANGELOG_TYPES.includes(value as ChangelogType)
    ? (value as ChangelogType)
    : 'improved';
}

/** Map a DB row to the app-facing KbArticle type. */
export function rowToArticle(row: KbArticleRow): KbArticle {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    excerpt: row.excerpt,
    body: row.body,
    published: row.published,
    sortOrder: row.sort_order,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

/** Map a DB row to the app-facing ChangelogEntry type. */
export function rowToChangelogEntry(row: ChangelogRow): ChangelogEntry {
  return {
    id: row.id,
    version: row.version,
    releasedOn: row.released_on,
    entryType: toChangelogType(row.entry_type),
    title: row.title,
    body: row.body,
    published: row.published,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}
