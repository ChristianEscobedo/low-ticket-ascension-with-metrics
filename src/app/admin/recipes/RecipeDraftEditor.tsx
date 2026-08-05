'use client';

/**
 * The fork & edit panel (Phase 2: owner-authored plays). Clone any house
 * play — or start blank — reorder the steps, reassign the crew, set gates
 * and handoffs, and save BY SLUG (upsert): a new slug forks, your own
 * slug overwrites your play. The live error line and the API's 400 share
 * `recipeDraftErrors`, so "saveable" means the same thing on both sides.
 */
import { useMemo } from 'react';
import { clsx } from 'clsx';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Loader2,
  Plus,
  X,
} from 'lucide-react';
import {
  recipeDraftErrors,
  type Recipe,
  type RecipeDraftStep,
} from '@/lib/mothermode/research/recipes/types';
import { RESEARCH_ARTIFACT_TYPES } from '@/lib/mothermode/research/types';
import {
  expertDisplayName,
  type ExpertInfo,
} from '@/lib/mothermode/research/recipes/crew';

export interface RecipeStepDraft {
  expert: string;
  instruction: string;
  inputFrom: 'brief' | 'previous' | 'none';
  outputArtifact: string;
  gate: 'auto' | 'approve';
  handoffTarget: string;
  handoffGenerate: boolean;
}

export interface RecipeDraft {
  slug: string;
  name: string;
  description: string;
  budgetEstCents: number;
  /** Phase 4: 'flag' = receipts nudged + noted (v1, default); 'enforce' =
   *  a sweep below the citation floor FAILS the step. */
  citationMode: 'flag' | 'enforce';
  steps: RecipeStepDraft[];
}


export function blankStep(): RecipeStepDraft {
  return {
    expert: '',
    instruction: '',
    inputFrom: 'previous',
    outputArtifact: 'research-brief',
    gate: 'auto',
    handoffTarget: '',
    handoffGenerate: false,
  };
}

export function blankRecipeDraft(): RecipeDraft {
  return {
    slug: 'my-play',
    name: '',
    description: '',
    budgetEstCents: 150,
    citationMode: 'flag',
    steps: [blankStep()],
  };
}


/** Clone a play into the editor. The slug gains '-mine' — a NEW slug is
 *  what makes it a fork instead of an overwrite of the house play. */
export function forkDraftFrom(recipe: Recipe): RecipeDraft {
  return {
    slug: `${recipe.slug}-mine`,
    name: `${recipe.name} (mine)`,
    description: recipe.description,
    budgetEstCents: recipe.budgetEstCents,
    citationMode: recipe.citationMode ?? 'flag',

    steps: recipe.steps.map((s) => ({

      expert: s.expert,
      instruction: s.instruction,
      inputFrom: s.inputFrom,
      outputArtifact: s.outputArtifact,
      gate: s.gate,
      handoffTarget: s.handoff?.target ?? '',
      handoffGenerate: s.handoff?.generate ?? false,
    })),
  };
}

/** The editor's steps -> the API's step shape (handoff only when set). */
export function draftStepsPayload(draft: RecipeDraft): RecipeDraftStep[] {
  return draft.steps.map((s) => ({
    expert: s.expert.trim(),
    instruction: s.instruction.trim(),
    inputFrom: s.inputFrom,
    outputArtifact: s.outputArtifact.trim(),
    gate: s.gate,
    handoff: s.handoffTarget
      ? { target: s.handoffTarget, generate: s.handoffGenerate }
      : null,
  }));
}

const HANDOFF_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'no handoff' },
  { value: 'planner-cards', label: '→ planner cards' },
  { value: 'leadgen-kit', label: '→ lead kit' },
  { value: 'email-kit', label: '→ email kit' },
  { value: 'sales-funnel', label: '→ funnel draft' },
  { value: 'system', label: '→ full system' },
];

export default function RecipeDraftEditor({
  draft,
  experts,
  busy,
  onChange,
  onSave,
  onCancel,
}: {
  draft: RecipeDraft;
  experts: ExpertInfo[];
  busy: boolean;
  onChange: (draft: RecipeDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  /** The shared validator — the same needs-list the API 400s with. */
  const errors = useMemo(
    () =>
      recipeDraftErrors({
        slug: draft.slug,
        name: draft.name,
        steps: draftStepsPayload(draft),
      }),
    [draft],
  );

  const patch = (partial: Partial<RecipeDraft>) =>
    onChange({ ...draft, ...partial });
  const patchStep = (i: number, partial: Partial<RecipeStepDraft>) => {
    const steps = [...draft.steps];
    steps[i] = { ...steps[i], ...partial };
    patch({ steps });
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= draft.steps.length) return;
    const steps = [...draft.steps];
    [steps[i], steps[j]] = [steps[j], steps[i]];
    patch({ steps });
  };
  const remove = (i: number) =>
    patch({ steps: draft.steps.filter((_, j) => j !== i) });

  return (
    <section className="mb-4 rounded-xl border border-brass/30 bg-brass/[0.04] px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brass/80">
          Your play
        </span>
        <span className="text-[10px] text-bone/35">
          saves by slug — a new slug forks, an existing one overwrites
        </span>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_110px_150px]">
        <input
          value={draft.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="Play name"
          className="rounded-lg border border-bone/15 bg-ink px-2 py-1.5 text-xs text-bone/85 outline-none placeholder:text-bone/25 focus:border-brass/40"
        />

        <input
          value={draft.slug}
          onChange={(e) =>
            patch({ slug: e.target.value.trim().toLowerCase() })
          }
          placeholder="slug-like-this"
          className="rounded-lg border border-bone/15 bg-ink px-2 py-1.5 font-mono text-xs text-bone/85 outline-none placeholder:text-bone/25 focus:border-brass/40"
        />
        <input
          value={(draft.budgetEstCents / 100).toString()}
          onChange={(e) => {
            const raw = Number.parseFloat(e.target.value);
            patch({
              budgetEstCents:
                Number.isFinite(raw) && raw > 0
                  ? Math.round(raw * 100)
                  : 150,
            });
          }}
          placeholder="$ cap"
          title="Budget cap in dollars — a run that spends past it fails honestly"
          className="rounded-lg border border-bone/15 bg-ink px-2 py-1.5 text-xs text-bone/85 outline-none placeholder:text-bone/25 focus:border-brass/40"
        />
        <select
          value={draft.citationMode}
          onChange={(e) =>
            patch({
              citationMode: e.target.value === 'enforce' ? 'enforce' : 'flag',
            })
          }
          title="Receipts: flag = a thin sweep gets nudged and lands honestly noted; enforce = a thin sweep FAILS the step"
          className="rounded-lg border border-bone/15 bg-ink px-2 py-1.5 text-xs text-bone/70 outline-none focus:border-brass/40"
        >
          <option value="flag">receipts: flag</option>
          <option value="enforce">receipts: enforce</option>
        </select>
      </div>

      <input
        value={draft.description}
        onChange={(e) => patch({ description: e.target.value })}
        placeholder="what this play does, in one line"
        className="mt-2 w-full rounded-lg border border-bone/15 bg-ink px-2 py-1.5 text-xs text-bone/85 outline-none placeholder:text-bone/25 focus:border-brass/40"
      />

      {/* steps, in order — the crew is a datalist so custom slugs type free */}
      <datalist id="crew-slugs">
        {experts.map((e) => (
          <option key={e.slug} value={e.slug} />
        ))}
      </datalist>
      <div className="mt-2 space-y-2">
        {draft.steps.map((s, i) => (
          <div
            key={i}
            className="rounded-lg border border-bone/10 bg-bone/[0.02] px-2.5 py-2"
          >
            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
              <span className="text-bone/30">{i + 1}.</span>
              <input
                value={s.expert}
                onChange={(e) => patchStep(i, { expert: e.target.value })}
                list="crew-slugs"
                placeholder="expert slug"
                title={experts
                  .map((e) => expertDisplayName(e.slug, experts))
                  .join(' · ')}
                className="w-28 rounded border border-bone/15 bg-ink px-1.5 py-1 text-bone/80 outline-none placeholder:text-bone/25"
              />
              <select
                value={s.outputArtifact}
                onChange={(e) =>
                  patchStep(i, { outputArtifact: e.target.value })
                }
                className="rounded border border-bone/15 bg-ink px-1 py-1 text-bone/70"
              >
                {[...RESEARCH_ARTIFACT_TYPES].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select
                value={s.inputFrom}
                onChange={(e) =>
                  patchStep(i, {
                    inputFrom: e.target.value as RecipeStepDraft['inputFrom'],
                  })
                }
                title="What the step reads: the session brief, the previous step's artifact, or nothing"
                className="rounded border border-bone/15 bg-ink px-1 py-1 text-bone/70"
              >
                <option value="brief">reads brief</option>
                <option value="previous">reads previous</option>
                <option value="none">reads nothing</option>
              </select>
              <select
                value={s.handoffTarget}
                onChange={(e) =>
                  patchStep(i, { handoffTarget: e.target.value })
                }
                className="rounded border border-bone/15 bg-ink px-1 py-1 text-bone/70"
              >
                {HANDOFF_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {s.handoffTarget && s.handoffTarget !== 'system' && (
                <label className="inline-flex items-center gap-1 text-bone/45">
                  <input
                    type="checkbox"
                    checked={s.handoffGenerate}
                    onChange={(e) =>
                      patchStep(i, { handoffGenerate: e.target.checked })
                    }
                  />
                  build
                </label>
              )}
              <label
                className="inline-flex items-center gap-1 text-amber-300/80"
                title="Pause for the owner's approval after this step's artifact lands"
              >
                <input
                  type="checkbox"
                  checked={s.gate === 'approve'}
                  onChange={(e) =>
                    patchStep(i, {
                      gate: e.target.checked ? 'approve' : 'auto',
                    })
                  }
                />
                gate
              </label>
              <span className="ml-auto inline-flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="rounded p-0.5 text-bone/35 hover:text-bone disabled:opacity-30"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === draft.steps.length - 1}
                  className="rounded p-0.5 text-bone/35 hover:text-bone disabled:opacity-30"
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  disabled={draft.steps.length <= 1}
                  className="rounded p-0.5 text-bone/35 hover:text-red-300 disabled:opacity-30"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            </div>
            <textarea
              value={s.instruction}
              onChange={(e) => patchStep(i, { instruction: e.target.value })}
              rows={2}
              placeholder="The instruction this expert runs — {input} is the input envelope's markdown"
              className="mt-1.5 w-full resize-y rounded border border-bone/10 bg-transparent px-1.5 py-1 font-mono text-[11px] leading-relaxed text-bone/80 outline-none placeholder:text-bone/25 focus:border-brass/40"
            />
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => patch({ steps: [...draft.steps, blankStep()] })}
          className="inline-flex items-center gap-1 rounded-lg border border-bone/15 px-2 py-1 text-[11px] text-bone/55 hover:text-bone"
        >
          <Plus className="h-3 w-3" /> add step
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={busy || errors.length > 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brass px-2.5 py-1 text-xs font-semibold text-ink hover:bg-brass/90 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Check className="h-3 w-3" />
          )}
          Save play
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-[11px] text-bone/40 hover:text-bone"
        >
          discard
        </button>
        {errors.length > 0 && (
          <span className="text-[10px] text-red-300/80">
            needs {errors.join(', ')}
          </span>
        )}
      </div>
    </section>
  );
}
