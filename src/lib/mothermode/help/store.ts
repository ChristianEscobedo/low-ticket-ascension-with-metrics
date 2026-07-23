import { createClient } from '@supabase/supabase-js';
import {
  rowToArticle,
  rowToChangelogEntry,
  toChangelogType,
  type KbArticle,
  type KbArticleRow,
  type ChangelogEntry,
  type ChangelogRow,
} from './types';

const ARTICLES_TABLE = 'mothermode_kb_articles';
const CHANGELOG_TABLE = 'mothermode_changelog';

// Anon, cookie-free client for public reads. RLS allows anon SELECT only on
// rows where published = true, so the viewer pages can stay cacheable rather
// than forcing per-request dynamic rendering.
let _anon: ReturnType<typeof createClient> | null = null;
function anonClient() {
  if (_anon) return _anon;
  _anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  );
  return _anon;
}

// Service-role client for admin reads (including drafts) and all writes. Lazy
// so the module never throws on missing env at import time.
let _service: ReturnType<typeof createClient> | null = null;
function serviceClient() {
  if (_service) return _service;
  _service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );
  return _service;
}

const ARTICLE_COLUMNS =
  'id, slug, title, category, excerpt, body, published, sort_order, updated_at, updated_by';
const CHANGELOG_COLUMNS =
  'id, version, released_on, entry_type, title, body, published, updated_at, updated_by';

// ---------------------------------------------------------------------------
// Knowledge base articles
// ---------------------------------------------------------------------------

/** Public read: every published article, ordered by category then sort order.
 *  Returns [] when nothing is published, the table is absent, or Supabase is
 *  not configured. */
export async function listPublishedArticles(): Promise<KbArticle[]> {
  try {
    const { data, error } = await (anonClient() as any)
      .from(ARTICLES_TABLE)
      .select(ARTICLE_COLUMNS)
      .eq('published', true)
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true });
    if (error || !data) return [];
    return (data as KbArticleRow[]).map(rowToArticle);
  } catch {
    return [];
  }
}

/** Public read: a single published article by slug, or null if not found. */
export async function getArticleBySlug(slug: string): Promise<KbArticle | null> {
  try {
    const { data, error } = await (anonClient() as any)
      .from(ARTICLES_TABLE)
      .select(ARTICLE_COLUMNS)
      .eq('slug', slug)
      .eq('published', true)
      .maybeSingle();
    if (error || !data) return null;
    return rowToArticle(data as KbArticleRow);
  } catch {
    return null;
  }
}

/** Admin read: every article (drafts included), ordered for the editor. */
export async function listArticlesForAdmin(): Promise<KbArticle[]> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(ARTICLES_TABLE)
      .select(ARTICLE_COLUMNS)
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true });
    if (error || !data) return [];
    return (data as KbArticleRow[]).map(rowToArticle);
  } catch {
    return [];
  }
}

export interface UpsertArticleInput {
  id?: string | null;
  slug: string;
  title: string;
  category: string;
  excerpt?: string | null;
  body: string;
  published: boolean;
  sortOrder: number;
  updatedBy?: string | null;
}

/** Admin-only upsert. Insert when `id` is absent, update in place otherwise. */
export async function upsertArticle(input: UpsertArticleInput): Promise<void> {
  const row: Record<string, unknown> = {
    slug: input.slug,
    title: input.title,
    category: input.category || 'General',
    excerpt: input.excerpt ?? null,
    body: input.body,
    published: input.published,
    sort_order: input.sortOrder ?? 0,
    updated_by: input.updatedBy ?? null,
    updated_at: new Date().toISOString(),
  };
  if (input.id) row.id = input.id;

  const { error } = await (serviceClient() as any)
    .from(ARTICLES_TABLE)
    .upsert(row, { onConflict: 'id' });
  if (error) {
    throw new Error(`upsertArticle failed: ${error.message}`);
  }
}

/** Admin-only removal by id. */
export async function deleteArticle(id: string): Promise<void> {
  const { error } = await (serviceClient() as any)
    .from(ARTICLES_TABLE)
    .delete()
    .eq('id', id);
  if (error) {
    throw new Error(`deleteArticle failed: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Changelog entries
// ---------------------------------------------------------------------------

/** Public read: every published changelog entry, newest first. */
export async function listPublishedChangelog(): Promise<ChangelogEntry[]> {
  try {
    const { data, error } = await (anonClient() as any)
      .from(CHANGELOG_TABLE)
      .select(CHANGELOG_COLUMNS)
      .eq('published', true)
      .order('released_on', { ascending: false });
    if (error || !data) return [];
    return (data as ChangelogRow[]).map(rowToChangelogEntry);
  } catch {
    return [];
  }
}

/** Admin read: every changelog entry (drafts included), newest first. */
export async function listChangelogForAdmin(): Promise<ChangelogEntry[]> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(CHANGELOG_TABLE)
      .select(CHANGELOG_COLUMNS)
      .order('released_on', { ascending: false });
    if (error || !data) return [];
    return (data as ChangelogRow[]).map(rowToChangelogEntry);
  } catch {
    return [];
  }
}

export interface UpsertChangelogInput {
  id?: string | null;
  version?: string | null;
  releasedOn: string;
  entryType: string;
  title: string;
  body: string;
  published: boolean;
  updatedBy?: string | null;
}

/** Admin-only upsert. Insert when `id` is absent, update in place otherwise. */
export async function upsertChangelogEntry(
  input: UpsertChangelogInput,
): Promise<void> {
  const row: Record<string, unknown> = {
    version: input.version?.trim() ? input.version.trim() : null,
    released_on: input.releasedOn,
    entry_type: toChangelogType(input.entryType),
    title: input.title,
    body: input.body,
    published: input.published,
    updated_by: input.updatedBy ?? null,
    updated_at: new Date().toISOString(),
  };
  if (input.id) row.id = input.id;

  const { error } = await (serviceClient() as any)
    .from(CHANGELOG_TABLE)
    .upsert(row, { onConflict: 'id' });
  if (error) {
    throw new Error(`upsertChangelogEntry failed: ${error.message}`);
  }
}

/** Admin-only removal by id. */
export async function deleteChangelogEntry(id: string): Promise<void> {
  const { error } = await (serviceClient() as any)
    .from(CHANGELOG_TABLE)
    .delete()
    .eq('id', id);
  if (error) {
    throw new Error(`deleteChangelogEntry failed: ${error.message}`);
  }
}
