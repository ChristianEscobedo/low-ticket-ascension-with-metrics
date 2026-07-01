'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search, Sparkles, X as XIcon } from 'lucide-react';
import { ContentCard } from './ContentCard';
import { ContentSheet } from './ContentSheet';
import { BatchPanel } from './BatchPanel';
import { listGenerated, deleteGenerated } from './generatedClient';
import { loadReviews } from './reviewClient';
import { DEFAULT_OFFER_SLUG } from '@/lib/mothermode/offers';
import { PlatformIcon, PLATFORM_BRAND } from './PlatformIcon';
import {
  allContent,
  countByPlatform,
  groupByPlatform,
  searchContent,
  weekOf,
  WEEKS,
  KIND_LABEL,
  PLATFORM_LABEL,
  PLATFORM_ORDER,
  TONE_LABEL,
  type ContentKind,
  type ContentPiece,
  type ContentPlatform,
  type ToneRegister,
} from '@/lib/mothermode/content';

type PlatformOpt = ContentPlatform | 'all';
type KindOpt = ContentKind | 'all';
type ToneOpt = ToneRegister | 'all';
type WeekOpt = number | 'all';

const KINDS: ContentKind[] = ['organic', 'ad'];
const TONES: ToneRegister[] = [
  'wedge',
  'confidante',
  'authority',
  'movement',
  'system',
];

/** Does a piece satisfy the four facet selections ('all' matches anything)? */
function matchesFacets(
  p: ContentPiece,
  opts: { platform: PlatformOpt; kind: KindOpt; tone: ToneOpt; week: WeekOpt },
): boolean {
  return (
    (opts.platform === 'all' || p.platform === opts.platform) &&
    (opts.kind === 'all' || p.kind === opts.kind) &&
    (opts.tone === 'all' || p.tone === opts.tone) &&
    (opts.week === 'all' || weekOf(p) === opts.week)
  );
}

/** Pill button used across the filter rows, with optional icon and live count. */
const FilterChip: React.FC<{
  active: boolean;
  disabled?: boolean;
  count?: number;
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}> = ({ active, disabled = false, count, onClick, icon, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition-colors ${
      active
        ? 'bg-mode text-bone'
        : disabled
          ? 'cursor-not-allowed border border-ink/10 text-ink/25'
          : 'border border-ink/15 text-ink/70 hover:border-ink/30'
    }`}
  >
    {icon}
    <span>{children}</span>
    {typeof count === 'number' && (
      <span
        className={`ml-0.5 rounded-full px-1.5 text-xs ${
          active ? 'bg-bone/20 text-bone' : 'bg-ink/5 text-ink/45'
        }`}
      >
        {count}
      </span>
    )}
  </button>
);

/** Full-width side-nav row: label left, live count right, active fill. */
const NavRow: React.FC<{
  active: boolean;
  count?: number;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, count, onClick, children }) => (
  <button
    onClick={onClick}
    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
      active ? 'bg-mode text-bone' : 'text-ink/70 hover:bg-ink/5'
    }`}
  >
    <span>{children}</span>
    {typeof count === 'number' && (
      <span className={`text-xs ${active ? 'text-bone/70' : 'text-ink/40'}`}>
        {count}
      </span>
    )}
  </button>
);

/**
 * Internal content hub: every organic post, paid ad, and email for the
 * MotherMode funnel. A side nav files pieces by type (organic vs paid) and by
 * calendar week; free-text search plus channel and tone filters refine within.
 * Each piece is copy-ready and opens a platform-accurate sheet for review.
 */
/**
 * Optional offer context. Only serializable primitives are accepted so this
 * client component can be rendered from a server route: offerName retitles the
 * hub and offerUrl reroutes every copied CTA to that offer's sales page;
 * offerSlug scopes the shared review state. The library itself is shared across
 * offers.
 */
export const ContentHub: React.FC<{
  offerName?: string;
  offerUrl?: string;
  offerSlug?: string;
}> = ({ offerName, offerUrl, offerSlug }) => {
  // The shared hub (no offer in context) scopes its reviews to the front-end
  // offer so edits, notes, and metrics still have a stable home.
  const reviewSlug = offerSlug ?? DEFAULT_OFFER_SLUG;
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState<PlatformOpt>('all');
  const [kind, setKind] = useState<KindOpt>('all');
  const [tone, setTone] = useState<ToneOpt>('all');
  const [week, setWeek] = useState<WeekOpt>('all');
  const [openPiece, setOpenPiece] = useState<ContentPiece | null>(null);
  const [generated, setGenerated] = useState<ContentPiece[]>([]);
  const [showPanel, setShowPanel] = useState(false);

  // Load the saved AI-generated pieces once, newest first, and merge them ahead
  // of the static catalog so they surface at the top of each channel.
  useEffect(() => {
    listGenerated()
      .then(setGenerated)
      .catch(() => setGenerated([]));
  }, []);

  // Warm the per-offer review cache once so cards and the sheet read it
  // synchronously (the request is deduped across every consumer).
  useEffect(() => {
    void loadReviews(reviewSlug);
  }, [reviewSlug]);

  const basePieces = useMemo(
    () => [...generated, ...allContent],
    [generated],
  );

  const onGenerated = (pieces: ContentPiece[]) =>
    setGenerated((prev) => [...pieces, ...prev]);

  const onDelete = (id: string) => {
    setGenerated((prev) => prev.filter((p) => p.id !== id));
    void deleteGenerated(id).catch(() => undefined);
  };

  const searched = useMemo(
    () => searchContent(query, basePieces),
    [query, basePieces],
  );

  const filtered = useMemo(
    () =>
      searched.filter((p) => matchesFacets(p, { platform, kind, tone, week })),
    [searched, platform, kind, tone, week],
  );

  // Live counts per facet, each respecting the other active facets and the
  // current search, so the numbers reflect what a click would actually return.
  const platformCounts = useMemo(
    () =>
      countByPlatform(
        searched.filter((p) =>
          matchesFacets(p, { platform: 'all', kind, tone, week }),
        ),
      ),
    [searched, kind, tone, week],
  );

  const kindCounts = useMemo(() => {
    const base = searched.filter((p) =>
      matchesFacets(p, { platform, kind: 'all', tone, week }),
    );
    return {
      organic: base.filter((p) => p.kind === 'organic').length,
      ad: base.filter((p) => p.kind === 'ad').length,
    } as Record<ContentKind, number>;
  }, [searched, platform, tone, week]);

  const toneCounts = useMemo(() => {
    const base = searched.filter((p) =>
      matchesFacets(p, { platform, kind, tone: 'all', week }),
    );
    return TONES.reduce(
      (acc, t) => {
        acc[t] = base.filter((p) => p.tone === t).length;
        return acc;
      },
      {} as Record<ToneRegister, number>,
    );
  }, [searched, platform, kind, week]);

  const weekCounts = useMemo(() => {
    const base = searched.filter((p) =>
      matchesFacets(p, { platform, kind, tone, week: 'all' }),
    );
    return WEEKS.reduce(
      (acc, w) => {
        acc[w] = base.filter((p) => weekOf(p) === w).length;
        return acc;
      },
      {} as Record<number, number>,
    );
  }, [searched, platform, kind, tone]);

  const fullCounts = useMemo(
    () => countByPlatform(basePieces),
    [basePieces],
  );
  const groups = useMemo(() => groupByPlatform(filtered), [filtered]);

  const hasFilters =
    query !== '' ||
    platform !== 'all' ||
    kind !== 'all' ||
    tone !== 'all' ||
    week !== 'all';

  const clearAll = () => {
    setQuery('');
    setPlatform('all');
    setKind('all');
    setTone('all');
    setWeek('all');
  };

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <header className="max-w-2xl">
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs uppercase tracking-[0.2em] text-brass">
              Internal content hub
            </p>
            <button
              onClick={() => setShowPanel(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-mode px-4 py-2 text-sm font-semibold text-bone transition-colors hover:bg-mode-deep"
            >
              <Sparkles className="h-4 w-4" />
              Generate
            </button>
          </div>
          <h1 className="mt-3 font-display text-4xl leading-tight text-ink">
            {offerName ? `${offerName} content` : 'MotherMode marketing copy'}
          </h1>
          <p className="mt-3 text-ink/65">
            Every organic post, paid ad, and email, in voice, each routing to{' '}
            {offerName ?? 'the $7 Brain Dump'}. {basePieces.length} pieces across{' '}
            {PLATFORM_ORDER.length} channels. Search or filter, then copy any
            piece straight into your scheduler or ad manager.
          </p>
          {offerName && (
            <p className="mt-3 text-sm text-ink/45">
              This is the shared MotherMode library. Copied CTAs point to{' '}
              {offerName}; offer-specific pieces are still to be written.
            </p>
          )}
        </header>

        <div className="mt-8 flex flex-wrap gap-2">
          {PLATFORM_ORDER.map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white/40 px-3 py-1.5 text-sm text-ink/70"
            >
              <PlatformIcon platform={p} style={{ color: PLATFORM_BRAND[p] }} />
              {PLATFORM_LABEL[p]}
              <span className="text-ink/40">{fullCounts[p]}</span>
            </span>
          ))}
        </div>

        <div className="mt-8 lg:flex lg:gap-8">
          <aside className="lg:w-56 lg:shrink-0">
            <div className="space-y-6 lg:sticky lg:top-6">
              <div>
                <p className="mb-2 px-3 text-xs uppercase tracking-wide text-ink/45">
                  Type
                </p>
                <div className="space-y-0.5">
                  <NavRow active={kind === 'all'} onClick={() => setKind('all')}>
                    All types
                  </NavRow>
                  {KINDS.map((k) => (
                    <NavRow
                      key={k}
                      active={kind === k}
                      count={kindCounts[k]}
                      onClick={() => setKind(k)}
                    >
                      {KIND_LABEL[k]}
                    </NavRow>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 px-3 text-xs uppercase tracking-wide text-ink/45">
                  Week
                </p>
                <div className="space-y-0.5">
                  <NavRow active={week === 'all'} onClick={() => setWeek('all')}>
                    All weeks
                  </NavRow>
                  {WEEKS.map((w) => (
                    <NavRow
                      key={w}
                      active={week === w}
                      count={weekCounts[w]}
                      onClick={() => setWeek(w)}
                    >
                      Week {w}
                    </NavRow>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <div className="mt-8 min-w-0 flex-1 lg:mt-0">
            <div className="sticky top-0 z-10 border-b border-ink/10 bg-bone/90 py-4 backdrop-blur">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search hooks, captions, subjects, hashtags..."
              className="w-full rounded-full border border-ink/15 bg-white/60 py-2.5 pl-10 pr-10 text-sm text-ink placeholder:text-ink/40 focus:border-mode focus:outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink"
              >
                <XIcon className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs uppercase tracking-wide text-ink/45">
                Channel
              </span>
              <FilterChip
                active={platform === 'all'}
                onClick={() => setPlatform('all')}
              >
                All
              </FilterChip>
              {PLATFORM_ORDER.map((p) => (
                <FilterChip
                  key={p}
                  active={platform === p}
                  disabled={platformCounts[p] === 0 && platform !== p}
                  count={platformCounts[p]}
                  onClick={() => setPlatform(p)}
                  icon={
                    <PlatformIcon
                      platform={p}
                      style={
                        platform === p
                          ? undefined
                          : { color: PLATFORM_BRAND[p] }
                      }
                    />
                  }
                >
                  {PLATFORM_LABEL[p]}
                </FilterChip>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs uppercase tracking-wide text-ink/45">
                Tone
              </span>
              <FilterChip active={tone === 'all'} onClick={() => setTone('all')}>
                All
              </FilterChip>
              {TONES.map((t) => (
                <FilterChip
                  key={t}
                  active={tone === t}
                  disabled={toneCounts[t] === 0 && tone !== t}
                  count={toneCounts[t]}
                  onClick={() => setTone(t)}
                >
                  {TONE_LABEL[t]}
                </FilterChip>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-ink/45">
            {filtered.length} {filtered.length === 1 ? 'piece' : 'pieces'}
          </p>
          {hasFilters && (
            <button
              onClick={clearAll}
              className="inline-flex items-center gap-1 text-sm text-ink/55 hover:text-ink"
            >
              <XIcon className="h-3.5 w-3.5" />
              Clear filters
            </button>
          )}
        </div>

        {groups.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-dashed border-ink/15 bg-white/30 px-6 py-16 text-center">
            <p className="text-ink/60">No pieces match these filters.</p>
            <button
              onClick={clearAll}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-mode px-4 py-2 text-sm font-semibold text-bone hover:bg-mode-deep"
            >
              <XIcon className="h-4 w-4" />
              Clear filters
            </button>
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.platform} className="mt-12">
              <h2 className="flex items-center gap-2.5 font-display text-2xl text-ink">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-ink/10 bg-white/50"
                  style={{ color: PLATFORM_BRAND[group.platform] }}
                >
                  <PlatformIcon platform={group.platform} />
                </span>
                {PLATFORM_LABEL[group.platform]}
                <span className="text-base font-normal text-ink/40">
                  {group.pieces.length}
                </span>
              </h2>
              <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {group.pieces.map((piece) => (
                  <ContentCard
                    key={piece.id}
                    piece={piece}
                    offerUrl={offerUrl}
                    offerSlug={reviewSlug}
                    onOpen={() => setOpenPiece(piece)}
                    onDelete={
                      piece.generated ? () => onDelete(piece.id) : undefined
                    }
                  />
                ))}
              </div>
            </section>
          ))
        )}
          </div>
        </div>

        {openPiece && (
          <ContentSheet
            piece={openPiece}
            offerUrl={offerUrl}
            offerSlug={reviewSlug}
            onClose={() => setOpenPiece(null)}
            onGenerated={onGenerated}
          />
        )}

        {showPanel && (
          <BatchPanel
            pieces={basePieces}
            onClose={() => setShowPanel(false)}
            onGenerated={onGenerated}
          />
        )}
      </div>
    </main>
  );
};
