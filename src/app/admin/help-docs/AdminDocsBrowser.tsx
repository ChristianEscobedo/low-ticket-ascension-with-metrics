'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BookOpen, Search, X } from 'lucide-react';
import type { KbArticle } from '@/lib/mothermode/help/types';

interface Props {
  articles: KbArticle[];
}

/** Searchable, categorized browser for the admin-audience help docs. Left:
 *  filter + grouped list. Right: the full article rendered read-only.
 *  Preselects an article when the URL carries ?article=<slug>, which is how the
 *  contextual help icons elsewhere in admin deep-link to a guide. */
export default function AdminDocsBrowser({ articles }: Props) {
  const searchParams = useSearchParams();
  const initial = (() => {
    const slug = searchParams.get('article');
    if (slug) {
      const found = articles.find((a) => a.slug === slug);
      if (found) return found.id;
    }
    return articles[0]?.id ?? null;
  })();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(initial);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        (a.excerpt ?? '').toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.body.toLowerCase().includes(q),
    );
  }, [articles, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, KbArticle[]>();
    for (const a of filtered) {
      const list = map.get(a.category) ?? [];
      list.push(a);
      map.set(a.category, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const selected = articles.find((a) => a.id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bone/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the docs..."
            className="w-full bg-ink/40 border border-bone/10 rounded-lg pl-9 pr-8 py-2.5 text-sm text-bone focus:border-brass/50 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-bone/40 hover:text-bone"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {filtered.length === 0 && (
          <p className="text-sm text-bone/50 px-1">No docs match "{query}".</p>
        )}

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {grouped.map(([category, items]) => (
            <div key={category}>
              <div className="text-[11px] uppercase tracking-wider text-bone/40 font-semibold px-1 mb-1 flex items-center gap-1.5">
                <BookOpen className="w-3 h-3 text-brass/70" />
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
                    {item.title}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 p-6 sm:p-8 min-h-[400px]">
        {selected ? (
          <article className="prose max-w-none">
            <p className="text-xs uppercase tracking-[0.2em] text-brass/80 font-semibold mb-2">
              {selected.category}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-bone mb-4">
              {selected.title}
            </h1>
            {/* Trusted, admin-authored body. */}
            {/* eslint-disable-next-line react/no-danger */}
            <div dangerouslySetInnerHTML={{ __html: selected.body }} />
          </article>
        ) : (
          <p className="text-sm text-bone/50">Select a guide on the left to read it.</p>
        )}
      </div>
    </div>
  );
}
