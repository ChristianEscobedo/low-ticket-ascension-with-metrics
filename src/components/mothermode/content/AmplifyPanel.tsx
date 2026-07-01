'use client';

/**
 * The Amplify command box for a content piece. One recipe drives two intents:
 * Refine this piece (tick parts to remake, like swap the hooks but keep the body
 * and CTA) and New posts (multiply across a voice x awareness matrix, same
 * channel or adapted to another). The recipe is sticky (last-used restored, named
 * recipes saved) and the brand voice rules are enforced server-side.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, Save, Trash2 } from 'lucide-react';
import { useAiAction, aiBtnSolid, aiBtnGhost, Spinner, AiError } from './AiControls';
import { aiAmplifyParts } from './aiClient';
import { generateBatch } from './generatedClient';
import {
  Select,
  Stepper,
  Segmented,
  PartChecklist,
  ChipMulti,
  PlanLine,
  labelCls,
  fieldCls,
} from './AmplifyControls';
import { AmplifyPools, partLabel } from './AmplifyPools';
import { AmplifyComposer } from './AmplifyComposer';
import { AmplifyIntro } from './AmplifyIntro';
import {
  loadLastConfig,
  saveLastConfig,
  listRecipes,
  saveRecipe,
  deleteRecipe,
  type AmplifyConfig,
  type SavedRecipe,
} from './amplifyRecipes';
import { OFFERS, getOffer } from '@/lib/mothermode/offers';
import {
  PERSPECTIVES,
  SOPHISTICATIONS,
  PLATFORM_FORMATS,
  PLATFORM_LABEL,
  FORMAT_LABEL,
  TEXT_MODELS,
  AUTO_MODEL,
  activeParts,
  clampPartCount,
  MAX_PART_COUNT,
  type AmplifyTextDimension,
  type ContentFormat,
  type ContentPiece,
  type ContentPlatform,
  type Perspective,
  type Sophistication,
} from '@/lib/mothermode/content';

const PLATFORMS = Object.keys(PLATFORM_LABEL) as ContentPlatform[];

/** Last path segment of the offer URL, used to preselect the grounding offer. */
function slugFromUrl(url?: string): string {
  const seg = url?.split('/').filter(Boolean).pop();
  return seg && getOffer(seg) ? seg : (OFFERS[0]?.slug ?? '');
}

/** The most posts one New-posts run may create, to keep the matrix sane. */
const MAX_POSTS = 40;

/** The starting recipe before any sticky config is restored. */
function defaultConfig(): AmplifyConfig {
  return {
    mode: 'refine',
    partCounts: { hooks: 5 },
    perspective: 'second',
    sophistication: 'solution',
    perspectives: ['second'],
    sophistications: ['solution'],
    postCount: 3,
    target: 'same',
    targetPlatform: 'instagram',
    targetFormat: 'feed',
    model: AUTO_MODEL,
    guides: '',
  };
}

/** Add a value to a list if absent, otherwise remove it. */
function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export const AmplifyPanel: React.FC<{
  piece: ContentPiece;
  offerUrl?: string;
  /** The hub offer this piece is filed under, used to key saved versions. */
  offerSlug: string;
  /** 'sheet' stacks the command box and results in one column (the slide-over);
   *  'studio' splits them into a controls rail and a roomy results canvas. */
  layout?: 'sheet' | 'studio';
  onAppendHooks: (hooks: string[]) => void;
  onUseBody: (body: string) => void;
  onGenerated: (pieces: ContentPiece[]) => void;
}> = ({
  piece,
  offerUrl,
  offerSlug,
  layout = 'sheet',
  onAppendHooks,
  onUseBody,
  onGenerated,
}) => {
  const [cfg, setCfg] = useState<AmplifyConfig>(defaultConfig);
  const [groundOffer, setGroundOffer] = useState(() => slugFromUrl(offerUrl));
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [recipeId, setRecipeId] = useState('');
  const [pools, setPools] = useState<
    Partial<Record<AmplifyTextDimension, string[]>>
  >({});
  const [made, setMade] = useState<number | null>(null);
  const { busy, error, run } = useAiAction();

  // Restore the sticky config and saved recipes on mount (client only, so the
  // server render stays deterministic and hydration matches).
  useEffect(() => {
    const last = loadLastConfig();
    if (last) setCfg(last);
    setRecipes(listRecipes());
  }, []);

  // Persist the recipe as the new default whenever it changes.
  useEffect(() => {
    saveLastConfig(cfg);
  }, [cfg]);

  const context = useMemo(
    () => ({
      theme: piece.theme,
      tone: piece.tone,
      platform: piece.platform,
      format: piece.format,
    }),
    [piece],
  );

  const patch = (p: Partial<AmplifyConfig>) => setCfg((c) => ({ ...c, ...p }));
  const resetResults = () => {
    setPools({});
    setMade(null);
  };

  const setMode = (m: string) => {
    patch({ mode: m as AmplifyConfig['mode'] });
    resetResults();
  };

  const setPart = (dim: AmplifyTextDimension, n: number) => {
    setCfg((c) => ({
      ...c,
      partCounts: { ...c.partCounts, [dim]: clampPartCount(n) },
    }));
    resetResults();
  };

  const changeTargetPlatform = (p: string) => {
    const next = p as ContentPlatform;
    setCfg((c) => ({
      ...c,
      targetPlatform: next,
      targetFormat: PLATFORM_FORMATS[next].includes(c.targetFormat)
        ? c.targetFormat
        : PLATFORM_FORMATS[next][0],
    }));
  };

  // Existing copy for a part, so the server can avoid repeating what is there.
  const existingFor = (dim: AmplifyTextDimension): string[] => {
    switch (dim) {
      case 'hooks':
      case 'angles':
        return piece.hooks?.length
          ? piece.hooks
          : piece.hook
            ? [piece.hook]
            : [];
      case 'ctas':
        return piece.cta ? [piece.cta] : [];
      case 'bodies':
        return piece.body ?? [];
    }
  };

  const hasPools = Object.values(pools).some((arr) => arr && arr.length > 0);
  const parts = activeParts(cfg.partCounts);
  const voices = cfg.perspectives.length ? cfg.perspectives : [cfg.perspective];
  const awares = cfg.sophistications.length
    ? cfg.sophistications
    : [cfg.sophistication];
  const postTotal = voices.length * awares.length * cfg.postCount;

  const planText =
    cfg.mode === 'refine'
      ? parts.length === 0
        ? 'Pick at least one part to make. Unticked parts are kept as they are.'
        : `Make ${parts
            .map((p) => `${p.count} ${partLabel(p.dimension).toLowerCase()}`)
            .join(', ')}. Everything else stays as it is.`
      : `Create ${postTotal} ${postTotal === 1 ? 'post' : 'posts'}: ${cfg.postCount} per combination across ${voices.length} ${voices.length === 1 ? 'voice' : 'voices'} and ${awares.length} awareness ${awares.length === 1 ? 'level' : 'levels'}${cfg.target === 'cross' ? `, adapted for ${PLATFORM_LABEL[cfg.targetPlatform]}` : ''}.`;

  const runRefine = () =>
    run(async () => {
      resetResults();
      if (parts.length === 0) throw new Error('Pick at least one part to make.');
      const result = await aiAmplifyParts({
        parts: parts.map((p) => ({
          dimension: p.dimension,
          count: p.count,
          avoid: existingFor(p.dimension),
        })),
        source: piece,
        perspective: cfg.perspective,
        sophistication: cfg.sophistication,
        guides: cfg.guides.trim() || undefined,
        context,
        model: cfg.model || undefined,
      });
      setPools(result);
    });

  const runPosts = () =>
    run(async () => {
      resetResults();
      if (postTotal === 0)
        throw new Error('Pick at least one voice and one awareness level.');
      if (postTotal > MAX_POSTS)
        throw new Error(
          `That is ${postTotal} posts. Narrow the matrix or lower the count to ${MAX_POSTS} or fewer.`,
        );
      const cross = cfg.target === 'cross';
      const platform = cross ? cfg.targetPlatform : piece.platform;
      const format = cross ? cfg.targetFormat : piece.format;
      const combos = voices.flatMap((perspective) =>
        awares.map((sophistication) => ({ perspective, sophistication })),
      );
      const batches = await Promise.all(
        combos.map(({ perspective, sophistication }) =>
          generateBatch({
            offerSlug: groundOffer,
            mode: 'variations',
            count: cfg.postCount,
            platform,
            format,
            kind: piece.kind,
            tone: piece.tone,
            theme: piece.theme || undefined,
            guides: cfg.guides.trim() || undefined,
            perspective,
            sophistication,
            source: piece,
            model: cfg.model || undefined,
          }),
        ),
      );
      const created = batches.flat();
      onGenerated(created);
      setMade(created.length);
    });

  const applyOne = (dim: AmplifyTextDimension, text: string) => {
    if (dim === 'hooks' || dim === 'angles') onAppendHooks([text]);
    else if (dim === 'bodies') onUseBody(text);
  };
  const applyAll = (dim: AmplifyTextDimension, texts: string[]) => {
    if (dim === 'hooks' || dim === 'angles') onAppendHooks(texts);
  };
  const fixPoolItem = (
    dim: AmplifyTextDimension,
    index: number,
    fixed: string,
  ) =>
    setPools((p) => {
      const list = [...(p[dim] ?? [])];
      if (index < list.length) list[index] = fixed;
      return { ...p, [dim]: list };
    });

  const applyRecipe = (id: string) => {
    setRecipeId(id);
    const r = recipes.find((x) => x.id === id);
    if (r) {
      setCfg(r.config);
      resetResults();
    }
  };
  const onSaveRecipe = () => {
    const name = window.prompt('Name this recipe');
    if (!name) return;
    setRecipes(saveRecipe(name, cfg));
  };
  const onDeleteRecipe = () => {
    if (!recipeId) return;
    setRecipes(deleteRecipe(recipeId));
    setRecipeId('');
  };

  const controls = (
    <div className="space-y-4">
      {/* Recipe bar: pick a saved setup, or save and delete the current one. */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Select label="Recipe" value={recipeId} onChange={applyRecipe}>
            <option value="">Last used</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </div>
        <button type="button" onClick={onSaveRecipe} className={aiBtnGhost}>
          <Save className="h-3.5 w-3.5" />
          Save
        </button>
        <button
          type="button"
          onClick={onDeleteRecipe}
          disabled={!recipeId}
          className={aiBtnGhost}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>

      <Segmented
        value={cfg.mode}
        onChange={setMode}
        options={[
          { value: 'refine', label: 'Refine this piece' },
          { value: 'posts', label: 'New posts' },
        ]}
      />

      {cfg.mode === 'refine' ? (
        <>
          <PartChecklist counts={cfg.partCounts} onChange={setPart} />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Perspective"
              value={cfg.perspective}
              onChange={(v) => patch({ perspective: v as Perspective })}
            >
              {PERSPECTIVES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
            <Select
              label="Sophistication"
              value={cfg.sophistication}
              onChange={(v) => patch({ sophistication: v as Sophistication })}
            >
              {SOPHISTICATIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <ChipMulti
            label="Voices"
            options={PERSPECTIVES}
            selected={cfg.perspectives}
            onToggle={(v) =>
              setCfg((c) => ({ ...c, perspectives: toggle(c.perspectives, v) }))
            }
          />
          <ChipMulti
            label="Awareness levels"
            options={SOPHISTICATIONS}
            selected={cfg.sophistications}
            onToggle={(v) =>
              setCfg((c) => ({
                ...c,
                sophistications: toggle(c.sophistications, v),
              }))
            }
          />
          <Segmented
            value={cfg.target}
            onChange={(v) => patch({ target: v as AmplifyConfig['target'] })}
            options={[
              { value: 'same', label: 'Same channel' },
              { value: 'cross', label: 'Cross-platform' },
            ]}
          />
          {cfg.target === 'cross' && (
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="To channel"
                value={cfg.targetPlatform}
                onChange={changeTargetPlatform}
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {PLATFORM_LABEL[p]}
                  </option>
                ))}
              </Select>
              <Select
                label="As format"
                value={cfg.targetFormat}
                onChange={(v) => patch({ targetFormat: v as ContentFormat })}
              >
                {PLATFORM_FORMATS[cfg.targetPlatform].map((f) => (
                  <option key={f} value={f}>
                    {FORMAT_LABEL[f]}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <Select
            label="Offer (grounds the copy)"
            value={groundOffer}
            onChange={setGroundOffer}
          >
            {OFFERS.map((o) => (
              <option key={o.slug} value={o.slug}>
                {o.name}
              </option>
            ))}
          </Select>
          <div className="flex items-center justify-between">
            <label className={labelCls}>Per combination</label>
            <Stepper
              value={cfg.postCount}
              onChange={(v) => patch({ postCount: v })}
              max={MAX_PART_COUNT}
            />
          </div>
        </div>
      )}

      <Select label="Writer" value={cfg.model} onChange={(v) => patch({ model: v })}>
        <option value={AUTO_MODEL}>Auto (recommended)</option>
        {TEXT_MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
            {m.note ? ` (${m.note})` : ''}
          </option>
        ))}
      </Select>

      <div>
        <label className={labelCls}>Prompt guides (optional)</label>
        <textarea
          value={cfg.guides}
          onChange={(e) => patch({ guides: e.target.value })}
          rows={2}
          placeholder="Steer this run. The brand voice rules are always enforced."
          className={`${fieldCls} resize-none`}
        />
      </div>

      <PlanLine text={planText} />

      <button
        onClick={cfg.mode === 'refine' ? runRefine : runPosts}
        disabled={busy}
        className={`${aiBtnSolid} w-full justify-center py-2.5 text-sm`}
      >
        {busy ? <Spinner /> : <Sparkles className="h-4 w-4" />}
        {busy
          ? 'Working...'
          : cfg.mode === 'refine'
            ? 'Amplify'
            : `Create ${postTotal} ${postTotal === 1 ? 'post' : 'posts'}`}
      </button>
      <AiError message={error} />

      {made !== null && (
        <p className="rounded-lg border border-brass/30 bg-brass/5 px-3 py-2 text-sm text-ink/70">
          Saved {made} new {made === 1 ? 'post' : 'posts'} to the hub.
        </p>
      )}
    </div>
  );

  /** The generated matrix and the version assembler. In 'posts' mode there is
   *  nothing to show here; the run drops finished pieces straight into the hub. */
  const results =
    cfg.mode !== 'refine' ? null : !hasPools ? (
      <AmplifyIntro piece={piece} />
    ) : (
      <div className="space-y-4">
        <AmplifyPools
          pools={pools}
          onApply={applyOne}
          onApplyAll={applyAll}
          onFix={fixPoolItem}
        />
        <AmplifyComposer
          piece={piece}
          offerSlug={offerSlug}
          offerUrl={offerUrl}
          pools={pools}
          onAppendHooks={onAppendHooks}
          onUseBody={onUseBody}
          model={cfg.model || undefined}
          guides={cfg.guides.trim() || undefined}
        />
      </div>
    );

  if (layout === 'studio') {
    return (
      <div className="flex h-full min-h-0 w-full">
        <aside className="w-[22rem] shrink-0 overflow-y-auto border-r border-ink/10 bg-white/50 p-5">
          {controls}
        </aside>
        <div className="min-w-0 flex-1 overflow-y-auto bg-bone p-6">{results}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {controls}
      {results}
    </div>
  );
};
