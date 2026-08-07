'use client';

/**
 * /admin/experts (roadmap 1.5): the crew editor. Cards for every expert on
 * the left, the config form on the right — persona, model, tool policy,
 * artifact contract, handoff manners. Saves through
 * /api/admin/mothermode-experts (upsert by slug).
 */
import { useCallback, useEffect, useState } from 'react';
import { clsx } from 'clsx';
import {
  FlaskConical,
  Compass,
  Pen,
  Bot,
  Plus,
  Loader2,
  Check,
  Archive,
} from 'lucide-react';
import { TEXT_MODELS, AUTO_MODEL } from '@/lib/mothermode/content/models';
import { RESEARCH_ARTIFACT_TYPES } from '@/lib/mothermode/research/types';
import type { ResearchExpert } from '@/lib/mothermode/research/experts/types';
import { buildResearchToolDefs } from '@/lib/mothermode/research/agent/toolDefs';
import {
  scorecardSummary,
  type ExpertScorecard,
} from '@/lib/mothermode/research/scorecards';
import ExpertBuilder from './ExpertBuilder';


const API = '/api/admin/mothermode-experts';
const SCORECARDS_API = '/api/admin/mothermode-recipes?scorecards=1';
const ALL_TOOLS = buildResearchToolDefs({ deep: true }).map((d) => d.name);
const GLYPHS: Record<string, typeof FlaskConical> = {
  flask: FlaskConical,
  compass: Compass,
  pen: Pen,
};

type Draft = {
  id: string | null;
  slug: string;
  name: string;
  tagline: string;
  glyph: string;
  persona: string;
  model: string;
  tools: string[];
  artifactTypes: string[];
  accepts: string[];
  emits: string[];
  status: 'active' | 'archived';
  sortOrder: number;
};

function blankDraft(): Draft {
  return {
    id: null,
    slug: '',
    name: '',
    tagline: '',
    glyph: 'bot',
    persona: '',
    model: AUTO_MODEL,
    tools: [],
    artifactTypes: [],
    accepts: [],
    emits: [],
    status: 'active',
    sortOrder: 0,
  };
}

function toDraft(e: ResearchExpert): Draft {
  return {
    id: e.id,
    slug: e.slug,
    name: e.name,
    tagline: e.tagline,
    glyph: e.glyph,
    persona: e.persona,
    model: e.model || AUTO_MODEL,
    tools: e.tools,
    artifactTypes: e.artifactTypes,
    accepts: e.accepts,
    emits: e.emits,
    status: e.status,
    sortOrder: e.sortOrder,
  };
}

function ChipList({
  label,
  items,
  options,
  onToggle,
}: {
  label: string;
  items: string[];
  options: string[];
  onToggle: (name: string) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-bone/40">
        {label}
      </div>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => {
          const on = items.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
              className={clsx(
                'rounded-full border px-2 py-0.5 text-[11px]',
                on
                  ? 'border-brass/40 bg-brass/15 text-brass'
                  : 'border-bone/15 text-bone/45 hover:text-bone',
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TagInput({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-bone/40">
        {label}
      </div>
      <input
        value={values.join(', ')}
        onChange={(e) =>
          onChange(
            e.target.value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          )
        }
        placeholder="research-brief, offer-brief"
        className="w-full rounded-md border border-bone/10 bg-transparent px-2 py-1.5 text-sm text-bone outline-none placeholder:text-bone/25 focus:border-brass/40"
      />
    </div>
  );
}

export default function ExpertsPage() {
  const [experts, setExperts] = useState<ResearchExpert[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  /** The Phase 2 scorecard per slug (null = still loading / unavailable —
   *  the cards just omit the line). */
  const [scorecards, setScorecards] = useState<ExpertScorecard[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`${API}?archived`, { cache: 'no-store' });
    const json = await res.json();
    setExperts(json.experts ?? []);
  }, []);

  useEffect(() => {
    load().catch(() => setExperts([]));
    // Lazy, once: the run-history read stays out of the editor's hot path.
    fetch(SCORECARDS_API, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setScorecards((j.scorecards ?? []) as ExpertScorecard[]))
      .catch(() => setScorecards([]));
  }, [load]);

  const toggle = (field: 'tools' | 'artifactTypes', name: string) => {
    if (!draft) return;
    const list = draft[field];
    setDraft({
      ...draft,
      [field]: list.includes(name)
        ? list.filter((t) => t !== name)
        : [...list, name],
    });
  };

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setError('');
    setNote('');
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          model: draft.model === AUTO_MODEL ? '' : draft.model,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Save failed');
      await load();
      setDraft(toDraft(json.expert));
      setNote(`Saved ${json.expert.name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5 flex items-center gap-3">
        <Bot className="h-6 w-6 text-brass" />
        <div>
          <h1 className="font-display text-2xl font-semibold text-bone">
            Experts
          </h1>
          <p className="text-sm text-bone/45">
            The crew: persona, model, tool policy, and artifact contract per
            expert. One loop runs them all.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ExpertBuilder
            onSaved={(e) => {
              load().catch(() => {});
              setDraft(toDraft(e));
              setNote(`Saved ${e.name} to the crew.`);
            }}
          />
          <button
            type="button"
            onClick={() => setDraft(blankDraft())}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brass/30 px-3 py-1.5 text-sm font-medium text-brass hover:bg-brass/10"
          >
            <Plus className="h-4 w-4" /> New expert
          </button>
        </div>

      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Crew list */}
        <div className="space-y-2">
          {experts === null ? (
            <Loader2 className="h-4 w-4 animate-spin text-bone/40" />
          ) : experts.length === 0 ? (
            <p className="rounded-lg border border-bone/10 px-3 py-3 text-xs text-bone/40">
              No experts seeded yet. Run{' '}
              <code className="text-brass/80">
                node scripts/seed-research-experts.cjs
              </code>{' '}
              or create one.
            </p>
          ) : (
            experts.map((e) => {
              const Glyph = GLYPHS[e.glyph] ?? Bot;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setDraft(toDraft(e))}
                  className={clsx(
                    'flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left',
                    draft?.id === e.id
                      ? 'border-brass/40 bg-brass/10'
                      : 'border-bone/10 bg-bone/[0.03] hover:border-brass/25',
                  )}
                >
                  <Glyph className="mt-0.5 h-4 w-4 shrink-0 text-brass/80" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-medium text-bone/90">
                      {e.name}
                      <span className="text-[10px] uppercase tracking-wider text-bone/30">
                        {e.slug}
                      </span>
                      {e.status === 'archived' && (
                        <Archive className="h-3 w-3 text-bone/30" />
                      )}
                    </span>
                    <span className="block truncate text-xs text-bone/45">
                      {e.tagline || 'no tagline'}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-bone/30">
                      {e.tools.length === 0
                        ? 'full tool lane'
                        : `${e.tools.length} tools`}{' '}
                      ·{' '}
                      {e.artifactTypes.length === 0
                        ? 'all artifact types'
                        : e.artifactTypes.join(', ')}
                    </span>
                    {/* the scorecard line: what the run history says about
                        this expert (acceptance = handed-off share of known
                        artifact fates; cost is step-share allocated) */}
                    {(() => {
                      const card = scorecards?.find((c) => c.slug === e.slug);
                      if (!card) return null;
                      const line = scorecardSummary(card);
                      if (!line) return null;
                      return (
                        <span
                          className="mt-0.5 block text-[10px] font-medium text-brass/70"
                          title={`${card.runs} runs · ${card.done} done · ${card.failed} failed · ${card.handedOff}/${card.artifacts} artifacts handed off${card.fatesKnown ? '' : ' · fates unreadable right now'} · cost is allocated by step share, not measured`}
                        >
                          {line}
                        </span>
                      );
                    })()}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Editor */}
        {draft ? (
          <div className="space-y-3 rounded-xl border border-bone/10 bg-bone/[0.02] p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-bone/40">
                  Slug
                </div>
                <input
                  value={draft.slug}
                  onChange={(e) =>
                    setDraft({ ...draft, slug: e.target.value.trim() })
                  }
                  disabled={draft.id !== null}
                  placeholder="strategist"
                  className="w-full rounded-md border border-bone/10 bg-transparent px-2 py-1.5 text-sm text-bone outline-none placeholder:text-bone/25 focus:border-brass/40 disabled:opacity-50"
                />
              </div>
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-bone/40">
                  Name
                </div>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Atlas"
                  className="w-full rounded-md border border-bone/10 bg-transparent px-2 py-1.5 text-sm text-bone outline-none placeholder:text-bone/25 focus:border-brass/40"
                />
              </div>
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-bone/40">
                  Model
                </div>
                <select
                  value={draft.model}
                  onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                  className="w-full rounded-md border border-bone/10 bg-ink px-2 py-1.5 text-sm text-bone/80"
                >
                  <option value={AUTO_MODEL}>Auto</option>
                  {TEXT_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <TagInput
                label="Tagline"
                values={[draft.tagline]}
                onChange={([v]) => setDraft({ ...draft, tagline: v ?? '' })}
              />
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-bone/40">
                  Glyph + sort
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={draft.glyph}
                    onChange={(e) =>
                      setDraft({ ...draft, glyph: e.target.value })
                    }
                    className="rounded-md border border-bone/10 bg-ink px-2 py-1.5 text-sm text-bone/80"
                  >
                    {['flask', 'compass', 'pen', 'bot'].map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={draft.sortOrder}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        sortOrder: Number.parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-20 rounded-md border border-bone/10 bg-transparent px-2 py-1.5 text-sm text-bone outline-none focus:border-brass/40"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-bone/40">
                Persona ('' = the built-in research prompt)
              </div>
              <textarea
                value={draft.persona}
                onChange={(e) => setDraft({ ...draft, persona: e.target.value })}
                rows={8}
                placeholder="You are Atlas, the MotherMode strategist. Your lane: ..."
                className="w-full resize-y rounded-md border border-bone/10 bg-transparent px-2 py-1.5 font-mono text-xs leading-relaxed text-bone outline-none placeholder:text-bone/25 focus:border-brass/40"
              />
            </div>

            <ChipList
              label="Tool policy (empty = the full lane)"
              items={draft.tools}
              options={ALL_TOOLS}
              onToggle={(t) => toggle('tools', t)}
            />
            <ChipList
              label="Artifact contract (empty = all types)"
              items={draft.artifactTypes}
              options={[...RESEARCH_ARTIFACT_TYPES]}
              onToggle={(t) => toggle('artifactTypes', t)}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <TagInput
                label="Accepts (advisory)"
                values={draft.accepts}
                onChange={(values) => setDraft({ ...draft, accepts: values })}
              />
              <TagInput
                label="Emits (advisory)"
                values={draft.emits}
                onChange={(values) => setDraft({ ...draft, emits: values })}
              />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={save}
                disabled={busy || !draft.slug}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brass px-3 py-1.5 text-sm font-semibold text-bone hover:bg-brass/90 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Save expert
              </button>
              <button
                type="button"
                onClick={() =>
                  setDraft({ ...draft, status: draft.status === 'active' ? 'archived' : 'active' })
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-bone/15 px-2.5 py-1.5 text-xs text-bone/60 hover:bg-bone/10"
              >
                <Archive className="h-3.5 w-3.5" />
                {draft.status === 'active' ? 'Archive' : 'Unarchive'}
              </button>
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="text-xs text-bone/40 hover:text-bone"
              >
                Close
              </button>
              {note && <span className="text-xs text-brass/80">{note}</span>}
              {error && <span className="text-xs text-red-300">{error}</span>}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-bone/10 p-10 text-sm text-bone/35">
            Pick an expert to edit, or create a new one.
          </div>
        )}
      </div>
    </div>
  );
}
