'use client';

/**
 * Variation Lab compose rail: Brief → Vary → Resize.
 * Used inside ImageStudioModal for creative testing and platform-perfect exports.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Layers,
  Maximize2,
  Minus,
  Plus,
  Sparkles,
  Wand2,
} from 'lucide-react';
import {
  AUTO_MODEL,
  EDIT_IMAGE_MODELS,
  IMAGE_MODELS,
  TEXT_MODELS,
  PLATFORM_SIZE_PACKS,
  PLATFORM_SIZE_PRESETS,
  VARIATION_DIMENSIONS,
  defaultDimensionsForFormat,
  defaultPresetIdsForFormat,
  isMultiFrameFormat,
  parseSizeString,
  resolveTargetSizes,
  type ContentPiece,
  type VariationDimensionId,
} from '@/lib/mothermode/content';
import {
  aiEditImage,
  aiGenerateImage,
  aiSmartResize,
  aiVariationBrief,
  aiVariationPlan,
  type AiVariationFrame,
  type AiVariationPlanItem,
} from './aiClient';
import { AiError, Spinner, aiBtnGhost, aiBtnSolid, useAiAction } from './AiControls';

const labelCls = 'text-[11px] uppercase tracking-[0.16em] text-ink/45';
const chipBase =
  'rounded-full border px-2.5 py-1 text-[11px] transition-colors';
const chipOn = 'border-mode/40 bg-mode/10 font-semibold text-mode';
const chipOff = 'border-ink/15 text-ink/60 hover:border-ink/30 hover:text-ink/80';

type LabStage = 'brief' | 'vary' | 'resize';

export const VariationLabPanel: React.FC<{
  piece: ContentPiece;
  /** Gallery images available as seeds / resize sources. */
  images: string[];
  activeImage?: string | null;
  seed: string | null;
  onSeedChange: (url: string | null) => void;
  onAddImages: (urls: string[]) => void;
}> = ({ piece, images, activeImage, seed, onSeedChange, onAddImages }) => {
  const multi = isMultiFrameFormat(piece.format);
  const [stage, setStage] = useState<LabStage>('brief');
  const { busy, error, run } = useAiAction();

  // —— Brief ——
  const [brief, setBrief] = useState('');
  const [guides, setGuides] = useState('');
  const [altCount, setAltCount] = useState(3);
  const [frameCount, setFrameCount] = useState(multi ? 5 : 0);
  const [textModel, setTextModel] = useState(AUTO_MODEL);
  const [imageModel, setImageModel] = useState(AUTO_MODEL);
  const [masterPrompt, setMasterPrompt] = useState('');
  const [altPrompts, setAltPrompts] = useState<string[]>([]);
  const [frames, setFrames] = useState<AiVariationFrame[]>([]);
  const [selectedPrompts, setSelectedPrompts] = useState<Set<string>>(new Set());

  // —— Vary ——
  const [dimIds, setDimIds] = useState<Set<VariationDimensionId>>(
    () => new Set(defaultDimensionsForFormat(piece.format)),
  );
  const [perDim, setPerDim] = useState(2);
  const [varyGuides, setVaryGuides] = useState('');
  const [editModel, setEditModel] = useState(AUTO_MODEL);
  const [planItems, setPlanItems] = useState<AiVariationPlanItem[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Set<string>>(new Set());

  // —— Resize ——
  const [presetIds, setPresetIds] = useState<Set<string>>(
    () => new Set(defaultPresetIdsForFormat(piece.format)),
  );
  const [customSize, setCustomSize] = useState('');
  const [resizeSources, setResizeSources] = useState<Set<string>>(new Set());
  const [resolution, setResolution] = useState<'1K' | '2K' | '4K'>('1K');
  const [outputFormat, setOutputFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [safety, setSafety] = useState<'1' | '2' | '3' | '4' | '5' | '6'>('4');
  const [numPerSize, setNumPerSize] = useState(1);
  const [resizePrompt, setResizePrompt] = useState('');
  const [resizeSeed, setResizeSeed] = useState('');

  // Prefill brief from piece when format/hook changes.
  useEffect(() => {
    const parts = [
      piece.hook ? `Hook: ${piece.hook}` : '',
      piece.theme ? `Theme: ${piece.theme}` : '',
      piece.visual || piece.media?.prompt || '',
      piece.cta ? `CTA feel: ${piece.cta}` : '',
    ].filter(Boolean);
    if (!brief.trim() && parts.length) setBrief(parts.join('\n'));
    setFrameCount(multi ? Math.max(3, frameCount || 5) : 0);
    setDimIds(new Set(defaultDimensionsForFormat(piece.format)));
    setPresetIds(new Set(defaultPresetIdsForFormat(piece.format)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piece.id, piece.format]);

  // Default resize selection to active / seed / all gallery.
  useEffect(() => {
    if (images.length === 0) {
      setResizeSources(new Set());
      return;
    }
    setResizeSources((prev) => {
      if (prev.size) {
        const next = new Set(Array.from(prev).filter((u) => images.includes(u)));

        if (next.size) return next;
      }
      const pick = activeImage || seed || images[0];
      return pick ? new Set([pick]) : new Set();
    });
  }, [images, activeImage, seed]);

  const targetSizes = useMemo(() => {
    const custom = customSize.trim() ? [customSize.trim()] : [];
    return resolveTargetSizes({
      presetIds: Array.from(presetIds),
      customSizes: custom,
    });

  }, [presetIds, customSize]);

  const toggleDim = (id: VariationDimensionId) =>
    setDimIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const togglePreset = (id: string) =>
    setPresetIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const applyPack = (packId: string) => {
    const pack = PLATFORM_SIZE_PACKS.find((p) => p.id === packId);
    if (!pack) return;
    setPresetIds(new Set(pack.presetIds));
  };

  const togglePrompt = (p: string) =>
    setSelectedPrompts((prev) => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });

  const writeBrief = () =>
    run(async () => {
      if (!brief.trim()) throw new Error('Write a brief first');
      const out = await aiVariationBrief({
        brief: brief.trim(),
        platform: piece.platform,
        format: piece.format,
        hook: piece.hook,
        theme: piece.theme,
        tone: piece.tone,
        altCount,
        frameCount: multi ? frameCount : 0,
        guides: guides.trim() || undefined,
        model: textModel || undefined,
      });
      setMasterPrompt(out.masterPrompt);
      setAltPrompts(out.altPrompts);
      setFrames(out.frames);
      const all = [
        out.masterPrompt,
        ...out.altPrompts,
        ...out.frames.map((f) => f.prompt),
      ].filter(Boolean);
      setSelectedPrompts(new Set(all.slice(0, Math.min(4, all.length))));
    });

  const generateSelected = () =>
    run(async () => {
      const list = Array.from(selectedPrompts).filter((p) => p.trim());

      if (!list.length) throw new Error('Select at least one prompt');
      const urls: string[] = [];
      for (const p of list) {
        const url = await aiGenerateImage(
          p,
          piece.format,
          imageModel || undefined,
        );
        if (url) urls.push(url);
      }
      if (!urls.length) throw new Error('No images were returned');
      onAddImages(urls);
      if (urls[0]) onSeedChange(urls[0]);
    });

  const planVariations = () =>
    run(async () => {
      if (!dimIds.size) throw new Error('Pick at least one dimension');
      const out = await aiVariationPlan({
        dimensions: Array.from(dimIds),

        perDimension: perDim,
        seedDescription:
          piece.visual ||
          piece.media?.prompt ||
          piece.hook ||
          'Seed image in gallery',
        platform: piece.platform,
        format: piece.format,
        hook: piece.hook,
        theme: piece.theme,
        guides: varyGuides.trim() || undefined,
        model: textModel || undefined,
      });
      setPlanItems(out.items);
      setSelectedPlan(new Set(out.items.map((i) => i.id)));
    });

  const runVariations = () =>
    run(async () => {
      const s = seed || activeImage || images[0];
      if (!s) throw new Error('Pick a seed image first');
      const items = planItems.filter((i) => selectedPlan.has(i.id));
      if (!items.length) throw new Error('Select plan items to run');
      const urls: string[] = [];
      // Sequential to avoid provider rate limits on multi-edit.
      for (const it of items) {
        const url = await aiEditImage({
          prompt: it.editPrompt,
          seed: s,
          format: piece.format,
          model: editModel || undefined,
        });
        if (url) urls.push(url);
      }
      if (!urls.length) throw new Error('No variants were returned');
      onAddImages(urls);
    });

  const runResize = () =>
    run(async () => {
      if (!targetSizes.length) {
        throw new Error('Pick at least one target size (or a valid custom WxH)');
      }
      if (customSize.trim() && !parseSizeString(customSize)) {
        throw new Error('Custom size must look like 1080x1350');
      }
      const sources = Array.from(resizeSources);

      if (!sources.length) throw new Error('Select images to resize');
      const seedNum =
        resizeSeed.trim() && Number.isFinite(Number(resizeSeed))
          ? Math.round(Number(resizeSeed))
          : undefined;
      const all: string[] = [];
      for (const src of sources) {
        const out = await aiSmartResize({
          imageUrl: src,
          targetSizes,
          prompt: resizePrompt.trim() || undefined,
          numImagesPerSize: numPerSize,
          resolution,
          outputFormat,
          safetyTolerance: safety,
          seed: seedNum,
        });
        all.push(...out.images);
      }
      if (!all.length) throw new Error('No resized images were returned');
      onAddImages(all);
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="inline-flex w-full overflow-hidden rounded-lg border border-ink/15">
        {(
          [
            { v: 'brief' as const, label: 'Brief', Icon: FileText },
            { v: 'vary' as const, label: 'Vary', Icon: Layers },
            { v: 'resize' as const, label: 'Resize', Icon: Maximize2 },
          ] as const
        ).map(({ v, label, Icon }) => (
          <button
            key={v}
            type="button"
            onClick={() => setStage(v)}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 px-2 py-1.5 text-xs transition-colors ${
              stage === v
                ? 'bg-mode/10 font-semibold text-mode'
                : 'text-ink/55 hover:text-ink/80'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {stage === 'brief' && (
        <>
          <div>
            <span className={labelCls}>Creative brief</span>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={5}
              placeholder="Goal, audience, offer, mood, must-have objects…"
              className="mt-1.5 w-full rounded-xl border border-ink/15 bg-white/70 px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-mode focus:outline-none"
            />
          </div>
          <div>
            <span className={labelCls}>Guides (optional)</span>
            <textarea
              value={guides}
              onChange={(e) => setGuides(e.target.value)}
              rows={2}
              placeholder="e.g. No faces. Kitchen dawn light. Leave space top-third for type."
              className="mt-1.5 w-full rounded-xl border border-ink/15 bg-white/70 px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-mode focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className={labelCls}>Alts</span>
              <button
                type="button"
                onClick={() => setAltCount((c) => Math.max(1, c - 1))}
                className="rounded-full border border-ink/15 p-1 text-ink/70"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="w-5 text-center text-xs font-medium">{altCount}</span>
              <button
                type="button"
                onClick={() => setAltCount((c) => Math.min(6, c + 1))}
                className="rounded-full border border-ink/15 p-1 text-ink/70"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
            {multi && (
              <div className="flex items-center gap-1.5">
                <span className={labelCls}>Frames</span>
                <button
                  type="button"
                  onClick={() => setFrameCount((c) => Math.max(2, c - 1))}
                  className="rounded-full border border-ink/15 p-1 text-ink/70"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-5 text-center text-xs font-medium">
                  {frameCount}
                </span>
                <button
                  type="button"
                  onClick={() => setFrameCount((c) => Math.min(10, c + 1))}
                  className="rounded-full border border-ink/15 p-1 text-ink/70"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            )}
            <select
              value={textModel}
              onChange={(e) => setTextModel(e.target.value)}
              className="rounded-md border border-ink/15 bg-white/70 px-2 py-1 text-xs text-ink"
            >
              {TEXT_MODELS.map((m) => (
                <option key={m.id || 'auto'} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={writeBrief}
            disabled={busy || !brief.trim()}
            className={`${aiBtnSolid} justify-center`}
          >
            {busy ? (
              <>
                <Spinner /> Writing prompts…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" /> Write prompts
              </>
            )}
          </button>

          {(masterPrompt || altPrompts.length > 0 || frames.length > 0) && (
            <div className="space-y-2">
              <span className={labelCls}>Prompts · tap to select</span>
              {masterPrompt && (
                <PromptRow
                  label="Master"
                  text={masterPrompt}
                  selected={selectedPrompts.has(masterPrompt)}
                  onToggle={() => togglePrompt(masterPrompt)}
                  onChange={(t) => {
                    setSelectedPrompts((prev) => {
                      const next = new Set(prev);
                      if (next.has(masterPrompt)) {
                        next.delete(masterPrompt);
                        next.add(t);
                      }
                      return next;
                    });
                    setMasterPrompt(t);
                  }}
                />
              )}
              {altPrompts.map((p, i) => (
                <PromptRow
                  key={`alt-${i}`}
                  label={`Alt ${i + 1}`}
                  text={p}
                  selected={selectedPrompts.has(p)}
                  onToggle={() => togglePrompt(p)}
                  onChange={(t) => {
                    setAltPrompts((prev) => {
                      const next = [...prev];
                      next[i] = t;
                      return next;
                    });
                    setSelectedPrompts((prev) => {
                      const next = new Set(prev);
                      if (next.has(p)) {
                        next.delete(p);
                        next.add(t);
                      }
                      return next;
                    });
                  }}
                />
              ))}
              {frames.map((f, i) => (
                <PromptRow
                  key={`fr-${f.index}`}
                  label={`F${f.index} · ${f.role}`}
                  text={f.prompt}
                  selected={selectedPrompts.has(f.prompt)}
                  onToggle={() => togglePrompt(f.prompt)}
                  onChange={(t) => {
                    setFrames((prev) => {
                      const next = [...prev];
                      next[i] = { ...next[i], prompt: t };
                      return next;
                    });
                    setSelectedPrompts((prev) => {
                      const next = new Set(prev);
                      if (next.has(f.prompt)) {
                        next.delete(f.prompt);
                        next.add(t);
                      }
                      return next;
                    });
                  }}
                />
              ))}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={imageModel}
                  onChange={(e) => setImageModel(e.target.value)}
                  className="rounded-md border border-ink/15 bg-white/70 px-2 py-1 text-xs text-ink"
                >
                  {IMAGE_MODELS.map((m) => (
                    <option key={m.id || 'auto'} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={generateSelected}
                  disabled={busy || selectedPrompts.size === 0}
                  className={`${aiBtnSolid} justify-center`}
                >
                  {busy ? (
                    <>
                      <Spinner /> Generating…
                    </>
                  ) : (
                    `Generate ${selectedPrompts.size || ''}`
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {stage === 'vary' && (
        <>
          <p className="text-xs text-ink/55">
            Seed-based creative tests. Pick dimensions, plan edit instructions,
            then run image edits into the gallery.
          </p>
          <div>
            <span className={labelCls}>Seed</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {images.length === 0 && (
                <span className="text-xs text-ink/45">
                  Generate or upload an image first.
                </span>
              )}
              {images.map((url, i) => (
                <button
                  key={`${url.slice(0, 40)}-${i}`}
                  type="button"
                  onClick={() => onSeedChange(url)}
                  className={`h-12 w-12 overflow-hidden rounded-lg border-2 ${
                    seed === url ? 'border-mode' : 'border-ink/10'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className={labelCls}>Dimensions</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {VARIATION_DIMENSIONS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  title={d.description}
                  onClick={() => toggleDim(d.id)}
                  className={`${chipBase} ${dimIds.has(d.id) ? chipOn : chipOff}`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className={labelCls}>Per dim</span>
              <button
                type="button"
                onClick={() => setPerDim((c) => Math.max(1, c - 1))}
                className="rounded-full border border-ink/15 p-1"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="w-5 text-center text-xs font-medium">{perDim}</span>
              <button
                type="button"
                onClick={() => setPerDim((c) => Math.min(4, c + 1))}
                className="rounded-full border border-ink/15 p-1"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
            <select
              value={textModel}
              onChange={(e) => setTextModel(e.target.value)}
              className="rounded-md border border-ink/15 bg-white/70 px-2 py-1 text-xs"
            >
              {TEXT_MODELS.map((m) => (
                <option key={m.id || 'auto'} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={varyGuides}
            onChange={(e) => setVaryGuides(e.target.value)}
            rows={2}
            placeholder="Optional guides for the variation plan…"
            className="w-full rounded-xl border border-ink/15 bg-white/70 px-3 py-2 text-sm focus:border-mode focus:outline-none"
          />
          <button
            type="button"
            onClick={planVariations}
            disabled={busy || dimIds.size === 0}
            className={`${aiBtnGhost} justify-center`}
          >
            {busy ? (
              <>
                <Spinner /> Planning…
              </>
            ) : (
              <>
                <Wand2 className="h-3.5 w-3.5" /> Plan matrix
              </>
            )}
          </button>
          {planItems.length > 0 && (
            <div className="space-y-2">
              <span className={labelCls}>Plan · tap to include</span>
              {planItems.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() =>
                    setSelectedPlan((prev) => {
                      const next = new Set(prev);
                      next.has(it.id) ? next.delete(it.id) : next.add(it.id);
                      return next;
                    })
                  }
                  className={`w-full rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                    selectedPlan.has(it.id)
                      ? 'border-mode/40 bg-mode/5'
                      : 'border-ink/10 bg-white/50 opacity-70'
                  }`}
                >
                  <div className="font-semibold text-ink/80">{it.label}</div>
                  <div className="mt-0.5 line-clamp-3 text-ink/55">
                    {it.editPrompt}
                  </div>
                </button>
              ))}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={editModel}
                  onChange={(e) => setEditModel(e.target.value)}
                  className="rounded-md border border-ink/15 bg-white/70 px-2 py-1 text-xs"
                >
                  {EDIT_IMAGE_MODELS.map((m) => (
                    <option key={m.id || 'auto'} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={runVariations}
                  disabled={
                    busy || selectedPlan.size === 0 || !(seed || images[0])
                  }
                  className={`${aiBtnSolid} justify-center`}
                >
                  {busy ? (
                    <>
                      <Spinner /> Running…
                    </>
                  ) : (
                    `Run ${selectedPlan.size} edit${selectedPlan.size === 1 ? '' : 's'}`
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {stage === 'resize' && (
        <>
          <p className="text-xs text-ink/55">
            Platform-perfect sizes via fal smart-resize. Works on single images
            or bulk (carousel/story frames).
          </p>
          <div>
            <span className={labelCls}>Images</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {images.map((url, i) => {
                const on = resizeSources.has(url);
                return (
                  <button
                    key={`rz-${i}`}
                    type="button"
                    onClick={() =>
                      setResizeSources((prev) => {
                        const next = new Set(prev);
                        next.has(url) ? next.delete(url) : next.add(url);
                        return next;
                      })
                    }
                    className={`h-12 w-12 overflow-hidden rounded-lg border-2 ${
                      on ? 'border-mode' : 'border-ink/10'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
            {images.length > 1 && (
              <div className="mt-1.5 flex gap-2">
                <button
                  type="button"
                  className="text-[11px] text-mode underline"
                  onClick={() => setResizeSources(new Set(images))}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="text-[11px] text-ink/50 underline"
                  onClick={() => setResizeSources(new Set())}
                >
                  Clear
                </button>
              </div>
            )}
          </div>
          <div>
            <span className={labelCls}>Size packs</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {PLATFORM_SIZE_PACKS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  title={p.description}
                  onClick={() => applyPack(p.id)}
                  className={`${chipBase} ${chipOff}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className={labelCls}>Target sizes</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {PLATFORM_SIZE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePreset(p.id)}
                  className={`${chipBase} ${
                    presetIds.has(p.id) ? chipOn : chipOff
                  }`}
                >
                  {p.label}{' '}
                  <span className="opacity-60">{p.size}</span>
                </button>
              ))}
            </div>
            <input
              value={customSize}
              onChange={(e) => setCustomSize(e.target.value)}
              placeholder="Custom WxH e.g. 1080x1350"
              className="mt-2 w-full rounded-lg border border-ink/15 bg-white/70 px-3 py-1.5 text-xs focus:border-mode focus:outline-none"
            />
            {targetSizes.length > 0 && (
              <p className="mt-1 text-[11px] text-ink/45">
                Will request: {targetSizes.join(', ')}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] text-ink/55">
              Resolution
              <select
                value={resolution}
                onChange={(e) =>
                  setResolution(e.target.value as '1K' | '2K' | '4K')
                }
                className="mt-0.5 w-full rounded-md border border-ink/15 bg-white/70 px-2 py-1 text-xs"
              >
                <option value="1K">1K</option>
                <option value="2K">2K</option>
                <option value="4K">4K</option>
              </select>
            </label>
            <label className="text-[11px] text-ink/55">
              Format
              <select
                value={outputFormat}
                onChange={(e) =>
                  setOutputFormat(e.target.value as 'png' | 'jpeg' | 'webp')
                }
                className="mt-0.5 w-full rounded-md border border-ink/15 bg-white/70 px-2 py-1 text-xs"
              >
                <option value="png">PNG</option>
                <option value="jpeg">JPEG</option>
                <option value="webp">WebP</option>
              </select>
            </label>
            <label className="text-[11px] text-ink/55">
              Safety
              <select
                value={safety}
                onChange={(e) =>
                  setSafety(e.target.value as typeof safety)
                }
                className="mt-0.5 w-full rounded-md border border-ink/15 bg-white/70 px-2 py-1 text-xs"
              >
                {(['1', '2', '3', '4', '5', '6'] as const).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] text-ink/55">
              Per size
              <select
                value={numPerSize}
                onChange={(e) => setNumPerSize(Number(e.target.value))}
                className="mt-0.5 w-full rounded-md border border-ink/15 bg-white/70 px-2 py-1 text-xs"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <input
            value={resizeSeed}
            onChange={(e) => setResizeSeed(e.target.value)}
            placeholder="Optional seed (number)"
            className="w-full rounded-lg border border-ink/15 bg-white/70 px-3 py-1.5 text-xs focus:border-mode focus:outline-none"
          />
          <textarea
            value={resizePrompt}
            onChange={(e) => setResizePrompt(e.target.value)}
            rows={2}
            placeholder="Optional extra resize instruction (empty = preserve content)"
            className="w-full rounded-xl border border-ink/15 bg-white/70 px-3 py-2 text-sm focus:border-mode focus:outline-none"
          />
          <button
            type="button"
            onClick={runResize}
            disabled={
              busy || !targetSizes.length || resizeSources.size === 0
            }
            className={`${aiBtnSolid} justify-center`}
          >
            {busy ? (
              <>
                <Spinner /> Resizing…
              </>
            ) : (
              `Resize ${resizeSources.size} × ${targetSizes.length} size${
                targetSizes.length === 1 ? '' : 's'
              }`
            )}
          </button>
        </>
      )}

      <AiError message={error} />

    </div>
  );
};

const PromptRow: React.FC<{
  label: string;
  text: string;
  selected: boolean;
  onToggle: () => void;
  onChange: (t: string) => void;
}> = ({ label, text, selected, onToggle, onChange }) => (
  <div
    className={`rounded-xl border px-2.5 py-2 ${
      selected ? 'border-mode/40 bg-mode/5' : 'border-ink/10 bg-white/50'
    }`}
  >
    <div className="mb-1 flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={onToggle}
        className={`text-[10px] font-semibold uppercase tracking-wider ${
          selected ? 'text-mode' : 'text-ink/45'
        }`}
      >
        {selected ? '✓ ' : ''}
        {label}
      </button>
    </div>
    <textarea
      value={text}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
      className="w-full resize-y rounded-lg border border-ink/10 bg-white/80 px-2 py-1.5 text-[11px] leading-relaxed text-ink/80 focus:border-mode focus:outline-none"
    />
  </div>
);
