'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Eye,
  ExternalLink,
  Plus,
  Save,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  CHANGELOG_TYPES,
  type ChangelogEntry,
  type ChangelogType,
  type KbArticle,
} from '@/lib/mothermode/help/types';
import {
  HELP_CENTER_SEED_ARTICLES,
  HELP_CENTER_SEED_CHANGELOG,
  type SeedArticle,
  type SeedChangelog,
} from '@/lib/mothermode/help/seedContent';
import { ARTICLE_BODY_STYLES } from '@/lib/mothermode/help/articleStyles';

interface Props {
  initialArticles: KbArticle[];
  initialChangelog: ChangelogEntry[];
}

type Tab = 'articles' | 'changelog';

/** Turn a title into a url-safe slug suggestion. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Two-tab Help Center editor: knowledge base articles and the changelog. */
export default function HelpEditor({ initialArticles, initialChangelog }: Props) {
  const [tab, setTab] = useState<Tab>('articles');

  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b border-bone/10">
        <TabButton active={tab === 'articles'} onClick={() => setTab('articles')}>
          Articles
        </TabButton>
        <TabButton active={tab === 'changelog'} onClick={() => setTab('changelog')}>
          Changelog
        </TabButton>
      </div>

      {tab === 'articles' ? (
        <ArticlesTab initial={initialArticles} />
      ) : (
        <ChangelogTab initial={initialChangelog} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
        active
          ? 'border-brass text-brass'
          : 'border-transparent text-bone/50 hover:text-bone'
      }`}
    >
      {children}
    </button>
  );
}

// ===========================================================================
// Articles
// ===========================================================================

type ArticleDraft = {
  id: string | null;
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  body: string;
  published: boolean;
  sortOrder: number;
  audience: 'admin' | 'buyer';
};

function blankArticle(): ArticleDraft {
  return {
    id: null,
    slug: '',
    title: '',
    category: 'General',
    excerpt: '',
    body: '',
    published: false,
    sortOrder: 0,
    audience: 'admin',
  };
}

function toArticleDraft(a: KbArticle): ArticleDraft {
  return {
    id: a.id,
    slug: a.slug,
    title: a.title,
    category: a.category,
    excerpt: a.excerpt ?? '',
    body: a.body,
    published: a.published,
    sortOrder: a.sortOrder,
    audience: a.audience ?? 'admin',
  };
}

function ArticlesTab({ initial }: { initial: KbArticle[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | 'new' | null>(
    initial[0]?.id ?? null,
  );

  // Only seed the articles whose slug is not already present, so hand edits
  // to existing articles are never clobbered.
  const missingArticles = useMemo(() => {
    const have = new Set(initial.map((a) => a.slug));
    return HELP_CENTER_SEED_ARTICLES.filter((s) => !have.has(s.slug));
  }, [initial]);

  const loadStarter = async () => {
    for (const s of missingArticles as SeedArticle[]) {
      await fetch('/api/admin/mothermode-help', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: null,
          slug: s.slug,
          title: s.title,
          category: s.category,
          excerpt: s.excerpt,
          body: s.body,
          published: s.published,
          sortOrder: s.sortOrder,
          audience: s.audience ?? 'admin',
        }),
      });
    }
    router.refresh();
  };

  const grouped = useMemo(() => {
    const map = new Map<string, KbArticle[]>();
    for (const a of initial) {
      const list = map.get(a.category) ?? [];
      list.push(a);
      map.set(a.category, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [initial]);

  const draft =
    selectedId === 'new'
      ? blankArticle()
      : (() => {
          const found = initial.find((a) => a.id === selectedId);
          return found ? toArticleDraft(found) : null;
        })();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setSelectedId('new')}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-brass/30 bg-brass/[0.08] text-brass text-sm font-semibold hover:bg-brass/[0.14]"
        >
          <Plus className="w-4 h-4" />
          New article
        </button>

        {missingArticles.length > 0 && (
          <SeedButton
            label={`Load ${missingArticles.length} starter article${missingArticles.length === 1 ? '' : 's'}`}
            onRun={loadStarter}
          />
        )}

        {initial.length === 0 && (
          <p className="text-sm text-bone/50">No articles yet. Create one.</p>
        )}

        {grouped.map(([category, items]) => (
          <div key={category}>
            <div className="text-[11px] uppercase tracking-wider text-bone/40 font-semibold px-1 mb-1">
              {category}
            </div>
            <div className="space-y-1">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full text-left rounded-lg px-3 py-2 text-sm border transition-colors ${
                    item.id === selectedId
                      ? 'border-brass/30 bg-brass/[0.1] text-brass font-semibold'
                      : 'border-transparent text-bone/60 hover:text-bone hover:bg-bone/[0.05]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{item.title}</span>
                    <span className="flex items-center gap-1.5">
                      <AudienceBadge audience={item.audience} />
                      <PublishedBadge published={item.published} />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {draft ? (
        <ArticlePanel
          key={selectedId ?? 'none'}
          draft={draft}
          onSaved={() => router.refresh()}
          onDeleted={() => {
            setSelectedId(null);
            router.refresh();
          }}
        />
      ) : (
        <p className="text-sm text-bone/50">Select an article or create a new one.</p>
      )}
    </div>
  );
}

function ArticlePanel({
  draft,
  onSaved,
  onDeleted,
}: {
  draft: ArticleDraft;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [slug, setSlug] = useState(draft.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(draft.slug));
  const [title, setTitle] = useState(draft.title);
  const [category, setCategory] = useState(draft.category);
  const [excerpt, setExcerpt] = useState(draft.excerpt);
  const [body, setBody] = useState(draft.body);
  const [published, setPublished] = useState(draft.published);
  const [sortOrder, setSortOrder] = useState(draft.sortOrder);
  const [audience, setAudience] = useState<'admin' | 'buyer'>(draft.audience ?? 'admin');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const onTitleChange = (value: string) => {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const save = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/mothermode-help', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: draft.id,
          slug,
          title,
          category,
          excerpt,
          body,
          published,
          sortOrder,
          audience,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (res.ok && payload.success) {
        setResult({ ok: true, message: 'Saved.' });
        onSaved();
      } else {
        setResult({ ok: false, message: payload.error ?? `Save failed (HTTP ${res.status})` });
      }
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : 'Network error' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!draft.id) return;
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setDeleting(true);
    setResult(null);
    try {
      const res = await fetch(
        `/api/admin/mothermode-help?id=${encodeURIComponent(draft.id)}`,
        { method: 'DELETE' },
      );
      const payload = await res.json().catch(() => ({}));
      if (res.ok && payload.success) {
        onDeleted();
      } else {
        setResult({ ok: false, message: payload.error ?? `Delete failed (HTTP ${res.status})` });
      }
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : 'Network error' });
    } finally {
      setDeleting(false);
    }
  };

  const previewUrl = `/mothermode/help/${slug}`;

  return (
    <div className="rounded-2xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-bone/50">
        <PublishedBadge published={published} />
        <span className="px-2 py-0.5 rounded-md border border-brass/30 bg-brass/[0.06] text-brass font-semibold uppercase tracking-wider">
          {draft.id ? 'Edit' : 'New'}
        </span>
        {published && slug && (
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-brass hover:text-brass/80"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open live page
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Title" htmlFor="kb-title">
          <input
            id="kb-title"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Slug" htmlFor="kb-slug">
          <input
            id="kb-slug"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            className={inputClass}
          />
        </Field>
        <Field label="Category" htmlFor="kb-category">
          <input
            id="kb-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Sort order (within category)" htmlFor="kb-sort">
          <input
            id="kb-sort"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
            className={inputClass}
          />
        </Field>
        <Field label="Audience" htmlFor="kb-audience">
          <select
            id="kb-audience"
            value={audience}
            onChange={(e) => setAudience(e.target.value === 'buyer' ? 'buyer' : 'admin')}
            className={inputClass}
          >
            <option value="admin">Admin (how to run the app)</option>
            <option value="buyer">Buyer (public help center)</option>
          </select>
        </Field>
      </div>

      <Field label="Excerpt (one-line summary for lists)" htmlFor="kb-excerpt">
        <input
          id="kb-excerpt"
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="Body (HTML)" htmlFor="kb-body">
        <textarea
          id="kb-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={16}
          spellCheck={false}
          className="w-full bg-ink/40 border border-bone/10 rounded-lg px-3 py-2 text-xs font-mono text-bone focus:border-brass/50 focus:outline-none"
        />
      </Field>

      <BodyPreview html={body} />

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <PublishToggle checked={published} onChange={setPublished} />
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brass text-ink text-sm font-bold hover:bg-brass/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {busy ? 'Saving…' : 'Save'}
        </button>
        {draft.id && (
          <button
            type="button"
            onClick={remove}
            disabled={deleting}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-400/30 bg-red-500/[0.06] text-red-200 text-sm font-semibold hover:bg-red-500/[0.12] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        )}
        <ResultNote result={result} />
      </div>
    </div>
  );
}

// ===========================================================================
// Changelog
// ===========================================================================

type ChangelogDraft = {
  id: string | null;
  version: string;
  releasedOn: string;
  entryType: ChangelogType;
  title: string;
  body: string;
  published: boolean;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function blankChangelog(): ChangelogDraft {
  return {
    id: null,
    version: '',
    releasedOn: todayIso(),
    entryType: 'improved',
    title: '',
    body: '',
    published: false,
  };
}

function toChangelogDraft(e: ChangelogEntry): ChangelogDraft {
  return {
    id: e.id,
    version: e.version ?? '',
    releasedOn: e.releasedOn?.slice(0, 10) ?? todayIso(),
    entryType: e.entryType,
    title: e.title,
    body: e.body,
    published: e.published,
  };
}

function ChangelogTab({ initial }: { initial: ChangelogEntry[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | 'new' | null>(
    initial[0]?.id ?? null,
  );

  // Only seed changelog entries whose (releasedOn + title) is not already
  // present, so hand edits to existing entries are never clobbered.
  const missingChangelog = useMemo(() => {
    const have = new Set(initial.map((e) => `${e.releasedOn?.slice(0, 10)}|${e.title}`));
    return HELP_CENTER_SEED_CHANGELOG.filter(
      (s) => !have.has(`${s.releasedOn}|${s.title}`),
    );
  }, [initial]);

  const loadStarter = async () => {
    for (const s of missingChangelog as SeedChangelog[]) {
      await fetch('/api/admin/mothermode-changelog', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: null,
          version: s.version,
          releasedOn: s.releasedOn,
          entryType: s.entryType,
          title: s.title,
          body: s.body,
          published: s.published,
        }),
      });
    }
    router.refresh();
  };

  const draft =
    selectedId === 'new'
      ? blankChangelog()
      : (() => {
          const found = initial.find((e) => e.id === selectedId);
          return found ? toChangelogDraft(found) : null;
        })();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setSelectedId('new')}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-brass/30 bg-brass/[0.08] text-brass text-sm font-semibold hover:bg-brass/[0.14]"
        >
          <Plus className="w-4 h-4" />
          New entry
        </button>

        {missingChangelog.length > 0 && (
          <SeedButton
            label={`Load ${missingChangelog.length} starter ${missingChangelog.length === 1 ? 'entry' : 'entries'}`}
            onRun={loadStarter}
          />
        )}

        {initial.length === 0 && (
          <p className="text-sm text-bone/50">No entries yet. Create one.</p>
        )}

        <div className="space-y-1">
          {initial.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setSelectedId(entry.id)}
              className={`w-full text-left rounded-lg px-3 py-2 text-sm border transition-colors ${
                entry.id === selectedId
                  ? 'border-brass/30 bg-brass/[0.1] text-brass font-semibold'
                  : 'border-transparent text-bone/60 hover:text-bone hover:bg-bone/[0.05]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {entry.version ? `${entry.version} — ` : ''}
                  {entry.title}
                </span>
                <PublishedBadge published={entry.published} />
              </div>
              <div className="flex items-center gap-2 mt-1">
                <ChangelogTypeTag type={entry.entryType} />
                <span className="text-[11px] text-bone/40">{entry.releasedOn?.slice(0, 10)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {draft ? (
        <ChangelogPanel
          key={selectedId ?? 'none'}
          draft={draft}
          onSaved={() => router.refresh()}
          onDeleted={() => {
            setSelectedId(null);
            router.refresh();
          }}
        />
      ) : (
        <p className="text-sm text-bone/50">Select an entry or create a new one.</p>
      )}
    </div>
  );
}

function ChangelogPanel({
  draft,
  onSaved,
  onDeleted,
}: {
  draft: ChangelogDraft;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [version, setVersion] = useState(draft.version);
  const [releasedOn, setReleasedOn] = useState(draft.releasedOn);
  const [entryType, setEntryType] = useState<ChangelogType>(draft.entryType);
  const [title, setTitle] = useState(draft.title);
  const [body, setBody] = useState(draft.body);
  const [published, setPublished] = useState(draft.published);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const save = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/mothermode-changelog', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: draft.id,
          version,
          releasedOn,
          entryType,
          title,
          body,
          published,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (res.ok && payload.success) {
        setResult({ ok: true, message: 'Saved.' });
        onSaved();
      } else {
        setResult({ ok: false, message: payload.error ?? `Save failed (HTTP ${res.status})` });
      }
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : 'Network error' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!draft.id) return;
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setDeleting(true);
    setResult(null);
    try {
      const res = await fetch(
        `/api/admin/mothermode-changelog?id=${encodeURIComponent(draft.id)}`,
        { method: 'DELETE' },
      );
      const payload = await res.json().catch(() => ({}));
      if (res.ok && payload.success) {
        onDeleted();
      } else {
        setResult({ ok: false, message: payload.error ?? `Delete failed (HTTP ${res.status})` });
      }
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : 'Network error' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-bone/50">
        <PublishedBadge published={published} />
        <span className="px-2 py-0.5 rounded-md border border-brass/30 bg-brass/[0.06] text-brass font-semibold uppercase tracking-wider">
          {draft.id ? 'Edit' : 'New'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Version (optional)" htmlFor="cl-version">
          <input
            id="cl-version"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="1.4.0"
            className={inputClass}
          />
        </Field>
        <Field label="Released on" htmlFor="cl-date">
          <input
            id="cl-date"
            type="date"
            value={releasedOn}
            onChange={(e) => setReleasedOn(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Type" htmlFor="cl-type">
          <select
            id="cl-type"
            value={entryType}
            onChange={(e) => setEntryType(e.target.value as ChangelogType)}
            className={inputClass}
          >
            {CHANGELOG_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Title" htmlFor="cl-title">
        <input
          id="cl-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="Body (HTML)" htmlFor="cl-body">
        <textarea
          id="cl-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={12}
          spellCheck={false}
          className="w-full bg-ink/40 border border-bone/10 rounded-lg px-3 py-2 text-xs font-mono text-bone focus:border-brass/50 focus:outline-none"
        />
      </Field>

      <BodyPreview html={body} />

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <PublishToggle checked={published} onChange={setPublished} />
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brass text-ink text-sm font-bold hover:bg-brass/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {busy ? 'Saving…' : 'Save'}
        </button>
        {draft.id && (
          <button
            type="button"
            onClick={remove}
            disabled={deleting}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-400/30 bg-red-500/[0.06] text-red-200 text-sm font-semibold hover:bg-red-500/[0.12] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        )}
        <ResultNote result={result} />
      </div>
    </div>
  );
}

// ===========================================================================
// Shared bits
// ===========================================================================

const inputClass =
  'w-full bg-ink/40 border border-bone/10 rounded-lg px-3 py-2 text-sm text-bone focus:border-brass/50 focus:outline-none';

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="text-[11px] uppercase tracking-wider text-bone/50 font-semibold">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function AudienceBadge({ audience }: { audience?: 'admin' | 'buyer' }) {
  const buyer = audience === 'buyer';
  return (
    <span
      className={`flex-shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${
        buyer
          ? 'border-sky-400/30 bg-sky-400/[0.08] text-sky-200'
          : 'border-brass/30 bg-brass/[0.06] text-brass/80'
      }`}
    >
      {buyer ? 'Buyer' : 'Admin'}
    </span>
  );
}

function PublishedBadge({ published }: { published: boolean }) {
  return (
    <span
      className={`flex-shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${
        published
          ? 'border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-200'
          : 'border-bone/10 bg-bone/[0.03] text-bone/40'
      }`}
    >
      {published ? 'Published' : 'Draft'}
    </span>
  );
}

function ChangelogTypeTag({ type }: { type: ChangelogType }) {
  const styles: Record<ChangelogType, string> = {
    added: 'border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-200',
    improved: 'border-sky-400/30 bg-sky-400/[0.08] text-sky-200',
    fixed: 'border-amber-400/30 bg-amber-400/[0.08] text-amber-200',
    removed: 'border-red-400/30 bg-red-400/[0.08] text-red-200',
  };
  return (
    <span
      className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${styles[type]}`}
    >
      {type}
    </span>
  );
}

function PublishToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-bone/70 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-bone/20 bg-ink/40 text-brass focus:ring-brass/40"
      />
      Published
    </label>
  );
}

function BodyPreview({ html }: { html: string }) {
  const previewDoc = useMemo(
    () =>
      `<!doctype html><html><head><meta charset="utf-8" />` +
      `<script src="https://cdn.tailwindcss.com"></script>` +
      `<style>body{background:#F5F1EB;color:#1A1816;font-family:ui-sans-serif,system-ui,sans-serif;padding:24px;margin:0;}` +
      ARTICLE_BODY_STYLES +
      `</style>` +
      `</head><body><p style="text-transform:uppercase;letter-spacing:.2em;font-size:11px;color:#A88B5C;margin:0 0 12px;">Preview</p><div class="prose">${html}</div></body></html>`,
    [html],
  );

  return (
    <div className="rounded-xl border border-brass/15 bg-ink/30 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-bone/[0.02] border-b border-bone/5 text-[11px] uppercase tracking-wider text-bone/50 font-semibold">
        <Eye className="w-3.5 h-3.5" />
        Live preview
      </div>
      <iframe
        title="Body HTML preview"
        srcDoc={previewDoc}
        sandbox="allow-scripts"
        className="w-full h-[320px] bg-bone"
      />
    </div>
  );
}

/** A secondary button that loads bundled starter content. Shows a busy state
 *  while the batch runs. */
function SeedButton({ label, onRun }: { label: string; onRun: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await onRun();
        } finally {
          setBusy(false);
        }
      }}
      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-bone/15 bg-bone/[0.04] text-bone/60 text-xs font-semibold hover:text-bone hover:bg-bone/[0.08] disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {busy ? 'Loading…' : label}
    </button>
  );
}

function ResultNote({ result }: { result: { ok: boolean; message: string } | null }) {
  if (!result) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${
        result.ok ? 'text-emerald-200' : 'text-red-200'
      }`}
    >
      {result.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
      {result.message}
    </span>
  );
}
