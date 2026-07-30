'use client';

/**
 * The research brief panel ("onboarding"): the seeds the agent searches WITH.
 * Suggest-then-edit in two modes (cheap context draft / web find), chip
 * editors for every list, structured competitor voices, and a link-drop that
 * classifies Amazon products, social profiles, and subreddits on paste.
 */
import { useState } from 'react';
import { clsx } from 'clsx';
import {
  Loader2,
  X,
  Plus,
  Wand2,
  Globe,
  Link2,
  Check,
  BookOpen,
} from 'lucide-react';
import {
  blankIntake,
  classifySeedLink,
  SOCIAL_PLATFORMS,
  type ResearchIntake,
  type ResearchVoice,
} from '@/lib/mothermode/research/intake';
import type { ResearchSession } from '@/lib/mothermode/research/types';
import * as client from './researchClient';

interface OfferOption {
  slug: string;
  name: string;
}

function ChipList({
  label,
  items,
  placeholder,
  onChange,
}: {
  label: string;
  items: string[];
  placeholder: string;
  onChange: (items: string[]) => void;
}) {
  const [text, setText] = useState('');
  const add = () => {
    const v = text.trim();
    if (v && !items.includes(v)) onChange([...items, v]);
    setText('');
  };
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-bone/40">
        {label}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            title={item}
            className="inline-flex max-w-[320px] items-center gap-1 overflow-hidden rounded-full border border-bone/15 bg-bone/[0.05] px-2 py-0.5 text-xs text-bone/80"
          >
            <span className="min-w-0 truncate">{item}</span>
            <button
              type="button"
              onClick={() => onChange(items.filter((i) => i !== item))}
              className="shrink-0 text-bone/40 hover:text-red-300"
              aria-label={`Remove ${item}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="min-w-[140px] flex-1 rounded-md border border-bone/10 bg-transparent px-2 py-0.5 text-xs text-bone outline-none placeholder:text-bone/30 focus:border-brass/40"
        />
      </div>
    </div>
  );
}

export default function IntakePanel({
  session,
  offers,
  sessions,
  onSaved,
}: {
  session: ResearchSession | null;
  offers: OfferOption[];
  /** All sessions, for the "load a previous brief" picker. */
  sessions?: ResearchSession[];
  onSaved: (session: ResearchSession) => void;
}) {
  const [intake, setIntake] = useState<ResearchIntake>(
    session?.intake ?? blankIntake(),
  );
  const [offerSlug, setOfferSlug] = useState(session?.offerSlug ?? '');
  const [busy, setBusy] = useState<
    'suggest' | 'find' | 'save' | 'products' | null
  >(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [linkDrop, setLinkDrop] = useState('');

  const patch = (p: Partial<ResearchIntake>) =>
    setIntake((prev) => ({ ...prev, ...p }));

  const [scope, setScope] = useState<'specific' | 'broad'>('specific');

  const runEngine = async (mode: 'suggest' | 'find') => {
    setBusy(mode);
    setError('');
    setNote('');
    try {
      const res = await client.runIntakeEngine({
        mode,
        sessionId: session?.id,
        offerSlug: offerSlug || undefined,
        goal: intake.goal || undefined,
        scope,
      });
      setIntake((prev) => ({
        ...res.intake,
        // The owner's hand-entered goal always wins over a drafted one.
        goal: prev.goal || res.intake.goal,
        // The research depth is an owner decision about spend, never
        // something a drafting engine gets to change.
        depth: prev.depth,
      }));
      if (mode === 'find') {
        setNote(
          res.sources.length
            ? `Found via web (${res.sources.length} searches). Verify the products and voices before burning paid runs.`
            : 'Web search was unavailable, so this draft came from context only. Verify before paid runs.',
        );
      } else {
        setNote('Drafted from context. Edit anything before saving.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not draft the brief');
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setBusy('save');
    setError('');
    setNote('');
    try {
      const saved = await client.upsertSession({
        id: session?.id,
        offerSlug,
        intake,
      });
      onSaved(saved);
      // Stay open with the confirmation visible — closing silently reads as
      // "didn't save", which is exactly the report that brought this change.
      setNote(
        `Saved. ${saved.intake ? 'The agent uses these seeds on the next message.' : ''}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(null);
    }
  };

  const suggestBooks = async () => {
    setBusy('products');
    setError('');
    setNote('');
    try {
      const res = await client.suggestProducts({
        sessionId: session?.id,
        offerSlug: offerSlug || undefined,
        goal: intake.goal || undefined,
        categoryKeywords: intake.categoryKeywords,
        audience: intake.audience,
      });
      const labels = res.products.map((p) => `${p.title} (${p.link})`);
      const merged = [...intake.competitorProducts];
      for (const label of labels) {
        if (!merged.includes(label)) merged.push(label);
      }
      patch({ competitorProducts: merged });
      setNote(
        `Added ${res.products.length} related product${res.products.length === 1 ? '' : 's'} with Amazon links. Verify them, then save.`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not suggest products',
      );
    } finally {
      setBusy(null);
    }
  };

  const dropLink = () => {
    const url = linkDrop.trim();
    if (!url) return;
    const kind = classifySeedLink(url);
    if (kind.kind === 'amazon-product') {
      // Store the CANONICAL short URL, not the mile-long search-result link
      // the owner pasted (that full URL is what blew out the panel layout).
      const label = kind.asin
        ? `https://amazon.com/dp/${kind.asin} (ASIN ${kind.asin})`
        : url;
      if (!intake.competitorProducts.includes(label)) {
        patch({
          competitorProducts: [...intake.competitorProducts, label],
        });
      }
      setNote(
        kind.asin
          ? `Added as competitor product (ASIN ${kind.asin}).`
          : 'Added as competitor product (no ASIN in that URL, but the link works).',
      );
    } else if (kind.kind === 'social-profile') {
      const voice: ResearchVoice = {
        handle: kind.handle,
        platform: kind.platform,
        url: kind.url,
      };
      if (!intake.competitorVoices.some((v) => v.url === voice.url)) {
        patch({ competitorVoices: [...intake.competitorVoices, voice] });
      }
      setNote(`Added ${kind.platform} voice${kind.handle ? ` @${kind.handle}` : ''}.`);
    } else if (kind.kind === 'subreddit') {
      if (!intake.subreddits.includes(kind.name)) {
        patch({ subreddits: [...intake.subreddits, kind.name] });
      }
      setNote(`Added r/${kind.name}.`);
    } else {
      if (!intake.seedLinks.includes(url)) {
        patch({ seedLinks: [...intake.seedLinks, url] });
      }
      setNote('Added as a seed link.');
    }
    setLinkDrop('');
  };

  const patchVoice = (i: number, p: Partial<ResearchVoice>) =>
    patch({
      competitorVoices: intake.competitorVoices.map((v, idx) =>
        idx === i ? { ...v, ...p } : v,
      ),
    });

  const previousBriefs = (sessions ?? []).filter(
    (s) =>
      s.id !== session?.id &&
      (s.intake.problemKeywords.length > 0 ||
        s.intake.categoryKeywords.length > 0 ||
        s.intake.competitorProducts.length > 0 ||
        s.intake.competitorVoices.length > 0),
  );

  const loadPrevious = (id: string) => {
    const source = previousBriefs.find((s) => s.id === id);
    if (!source) return;
    setIntake(source.intake);
    setOfferSlug((prev) => prev || source.offerSlug);
    setNote(
      `Loaded the brief from "${source.title}". Edit anything, then Save.`,
    );
  };

  return (
    <div className="rounded-xl border border-brass/20 bg-brass/[0.04] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brass/90">
          Research brief
        </span>
        <span className="text-[11px] text-bone/40">
          the seeds the agent searches with, so it never burns runs on the offer name
        </span>
        <div className="ml-auto flex items-center gap-2">
          {previousBriefs.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-bone/15 px-2 py-1">
              <BookOpen className="h-3.5 w-3.5 text-brass/80" />
              <select
                value=""
                onChange={(e) => loadPrevious(e.target.value)}
                className="bg-transparent text-xs text-bone/70 outline-none"
                title="Load a brief from a previous session"
              >
                <option value="">Load previous brief…</option>
                {previousBriefs.map((s) => (
                  <option key={s.id} value={s.id} className="bg-ink">
                    {s.title}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div
            className="flex items-center overflow-hidden rounded-lg border border-bone/15 text-[10px]"
            title="Standard is the everyday toolkit. Deep adds post-performance ranking, per-post comment mining, and influencer deep dives — it spends more per turn. Saved with the brief."
          >
            {(['standard', 'deep'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => patch({ depth: d })}
                className={clsx(
                  'px-2 py-1.5 capitalize',
                  intake.depth === d
                    ? d === 'deep'
                      ? 'bg-brass/20 text-brass'
                      : 'bg-bone/15 text-bone'
                    : 'text-bone/50 hover:text-bone',
                )}
              >
                {d === 'standard' ? 'Standard' : 'Deep'}
              </button>
            ))}
          </div>
          <div
            className="flex items-center overflow-hidden rounded-lg border border-bone/15 text-[10px]"
            title="Specific dig focuses on your goal; broad scan fans out across the niche"
          >
            {(['specific', 'broad'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={clsx(
                  'px-2 py-1.5 capitalize',
                  scope === s
                    ? 'bg-brass/20 text-brass'
                    : 'text-bone/50 hover:text-bone',
                )}
              >
                {s === 'specific' ? 'Specific dig' : 'Broad scan'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => runEngine('suggest')}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-lg border border-bone/15 px-2.5 py-1.5 text-xs text-bone/70 hover:bg-bone/10 disabled:opacity-50"
            title="Draft from offer/context only (fast)"
          >
            {busy === 'suggest' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
            Suggest from offer
          </button>
          <button
            type="button"
            onClick={() => runEngine('find')}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brass/40 px-2.5 py-1.5 text-xs font-medium text-brass hover:bg-brass/10 disabled:opacity-50"
            title="Find products, voices, and communities on the web"
          >
            {busy === 'find' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Globe className="h-3.5 w-3.5" />
            )}
            Find research context
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-bone/40">
            Goal
          </div>
          <input
            value={intake.goal}
            onChange={(e) => patch({ goal: e.target.value })}
            placeholder="e.g. decide the next $17 offer + its lead magnet"
            className="w-full rounded-md border border-bone/10 bg-transparent px-2 py-1.5 text-sm text-bone outline-none placeholder:text-bone/30 focus:border-brass/40"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-bone/40">
              Audience
            </div>
            <input
              value={intake.audience}
              onChange={(e) => patch({ audience: e.target.value })}
              placeholder="overwhelmed moms"
              className="w-full rounded-md border border-bone/10 bg-transparent px-2 py-1.5 text-sm text-bone outline-none placeholder:text-bone/30 focus:border-brass/40"
            />
          </div>
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-bone/40">
              Offer scope
            </div>
            <select
              value={offerSlug}
              onChange={(e) => setOfferSlug(e.target.value)}
              className="w-full rounded-md border border-bone/10 bg-ink px-2 py-1.5 text-sm text-bone/80"
            >
              <option value="">None</option>
              {offers.map((o) => (
                <option key={o.slug} value={o.slug}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3">
        <ChipList
          label="Problem keywords (what the buyer types at 11pm)"
          items={intake.problemKeywords}
          placeholder="mental load, 5pm chaos..."
          onChange={(problemKeywords) => patch({ problemKeywords })}
        />
        <ChipList
          label="Category analogs (phrases that exist on Amazon today)"
          items={intake.categoryKeywords}
          placeholder="mom planner, family command center..."
          onChange={(categoryKeywords) => patch({ categoryKeywords })}
        />
        <div>
          <ChipList
            label="Competitor products (names, links, or ASINs)"
            items={intake.competitorProducts}
            placeholder="The Home Edit Life, Fair Play..."
            onChange={(competitorProducts) => patch({ competitorProducts })}
          />
          <div className="mt-1.5 flex items-center gap-2">
            <button
              type="button"
              onClick={suggestBooks}
              disabled={busy !== null}
              className="inline-flex items-center gap-1 rounded-lg border border-bone/15 px-2 py-1 text-[11px] text-bone/60 hover:bg-bone/10 hover:text-bone disabled:opacity-50"
              title="Name real, related books/products in this niche with working Amazon links (model knowledge, no paid calls)"
            >
              {busy === 'products' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <BookOpen className="h-3 w-3 text-brass/80" />
              )}
              Suggest book links
            </button>
            <span className="text-[10px] text-bone/30">
              auto-finds related books with links; drop your own link below to
              add one manually
            </span>
          </div>
        </div>

        {/* Voices */}
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-bone/40">
            Competitor voices (influencers to watch)
          </div>
          <div className="space-y-1.5">
            {intake.competitorVoices.map((v, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <select
                  value={v.platform}
                  onChange={(e) =>
                    patchVoice(i, {
                      platform: e.target.value as ResearchVoice['platform'],
                    })
                  }
                  className="rounded-md border border-bone/10 bg-ink px-1.5 py-1 text-xs text-bone/80"
                >
                  <option value="">platform</option>
                  {SOCIAL_PLATFORMS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <input
                  value={v.handle}
                  onChange={(e) => patchVoice(i, { handle: e.target.value })}
                  placeholder="handle or name"
                  className="w-36 rounded-md border border-bone/10 bg-transparent px-2 py-1 text-xs text-bone outline-none placeholder:text-bone/30 focus:border-brass/40"
                />
                <input
                  value={v.url}
                  onChange={(e) => patchVoice(i, { url: e.target.value })}
                  placeholder="profile url"
                  className="min-w-0 flex-1 rounded-md border border-bone/10 bg-transparent px-2 py-1 text-xs text-bone outline-none placeholder:text-bone/30 focus:border-brass/40"
                />
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      competitorVoices: intake.competitorVoices.filter(
                        (_, idx) => idx !== i,
                      ),
                    })
                  }
                  className="text-bone/40 hover:text-red-300"
                  aria-label="Remove voice"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                patch({
                  competitorVoices: [
                    ...intake.competitorVoices,
                    { handle: '', platform: '', url: '' },
                  ],
                })
              }
              className="inline-flex items-center gap-1 text-xs text-brass/80 hover:text-brass"
            >
              <Plus className="h-3 w-3" /> Add voice
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <ChipList
            label="Subreddits"
            items={intake.subreddits}
            placeholder="Parenting, workingmoms..."
            onChange={(subreddits) => patch({ subreddits })}
          />
          <ChipList
            label="Seed links"
            items={intake.seedLinks}
            placeholder="any useful url"
            onChange={(seedLinks) => patch({ seedLinks })}
          />
        </div>

        {/* Link drop */}
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 shrink-0 text-brass/70" />
          <input
            value={linkDrop}
            onChange={(e) => setLinkDrop(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                dropLink();
              }
            }}
            placeholder="Drop an Amazon link, influencer profile, or subreddit and it lands in the right list"
            className="min-w-0 flex-1 rounded-md border border-bone/10 bg-transparent px-2 py-1.5 text-xs text-bone outline-none placeholder:text-bone/30 focus:border-brass/40"
          />
          <button
            type="button"
            onClick={dropLink}
            className="rounded-lg border border-bone/15 px-2.5 py-1.5 text-xs text-bone/70 hover:bg-bone/10"
          >
            Add link
          </button>
        </div>
      </div>

      {note && (
        <p className="mt-2 text-xs text-brass/80">{note}</p>
      )}
      {error && (
        <p className="mt-2 text-xs text-red-300">{error}</p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy !== null}
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-lg bg-brass px-3 py-1.5 text-xs font-semibold text-ink hover:bg-brass/90 disabled:opacity-50',
          )}
        >
          {busy === 'save' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Save brief
        </button>
        <span className="text-[11px] text-bone/40">
          Everything here is editable. Drafts are suggestions, the agent quotes
          them but verifies with real runs.
        </span>
      </div>
    </div>
  );
}
