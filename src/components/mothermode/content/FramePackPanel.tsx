'use client';

/**
 * Multi-frame pack planner for carousel / story / idea: plan ordered slides
 * (role, copy, prompt, lookback), then render Mode A (N frames with continuity)
 * or Mode B (strip → split). Gallery images bind 1:1 by index.
 */
import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Layers,
  Sparkles,
  Trash2,
  ImagePlus,
  ChevronRight,
  Scissors,
} from 'lucide-react';
import {
  PLATFORM_LABEL,
  FORMAT_LABEL,
  TONE_LABEL,
  AUTO_MODEL,
  IMAGE_MODELS,
  EDIT_IMAGE_MODELS,
  type ContentPiece,
} from '@/lib/mothermode/content';
import type { PieceReview } from '@/lib/mothermode/content/review';
import {
  type FramePack,
  type FramePackAspect,
  type FramePackFrame,
  type FramePackMode,
  clampSlideCount,
  defaultPackAspect,
  emptyFramePack,
  withPlannedFrames,
  withFrameImages,
  patchFrame,
  continuityEditPrompt,
  buildStripPrompt,
  splitStripImage,
  supportsFramePack,
  targetSlideCount,
  MAX_FRAME_PACK,
  MIN_FRAME_PACK,
} from '@/lib/mothermode/content/framePack';
import {
  setReviewFramePack,
  clearReviewFramePack,
  setReviewImages,
} from './reviewClient';
import {
  aiGenerateFramePackPlan,
  aiGenerateImage,
  aiEditImage,
  aiHostImage,
} from './aiClient';
import {
  useAiAction,
  aiBtnSolid,
  aiBtnGhost,
  Spinner,
  AiError,
  InstructionsInput,
} from './AiControls';

const ASPECTS: FramePackAspect[] = ['1:1', '4:5', '9:16'];

function packToText(pack: FramePack): string {
  const lines: string[] = [
    `FRAME PACK · ${pack.format} · ${pack.mode} · ${pack.slideCount} slides · ${pack.aspect}`,
    '',
  ];
  if (pack.systemNotes) {
    lines.push('SYSTEM:', pack.systemNotes, '');
  }
  for (const f of pack.frames) {
    lines.push(`── Frame ${f.index} · ${f.role} ──`);
    if (f.text) lines.push(`Text: ${f.text}`);
    if (f.sub) lines.push(`Sub: ${f.sub}`);
    if (f.visual) lines.push(`Visual: ${f.visual}`);
    if (f.prompt) {
      lines.push('Prompt:');
      lines.push(f.prompt);
    }
    if (f.lookbackSummary) lines.push(`Lookback: ${f.lookbackSummary}`);
    lines.push('');
  }
  return lines.join('\n').trim();
}

export const FramePackPanel: React.FC<{
  piece: ContentPiece;
  review: PieceReview;
  offerSlug: string;
  model?: string;
  onReviewChange: (next: PieceReview) => void;
  onOpenStudio?: () => void;
}> = ({
  piece,
  review,
  offerSlug,
  model = AUTO_MODEL,
  onReviewChange,
  onOpenStudio,
}) => {
  const existing = review.framePack;
  const [slideCount, setSlideCount] = useState(
    existing?.slideCount ?? targetSlideCount(piece),
  );
  const [mode, setMode] = useState<FramePackMode>(existing?.mode ?? 'frames');
  const [aspect, setAspect] = useState<FramePackAspect>(
    existing?.aspect ?? defaultPackAspect(piece.format),
  );
  const [guides, setGuides] = useState('');
  const [imageModel, setImageModel] = useState(AUTO_MODEL);
  const [expanded, setExpanded] = useState<number | null>(
    existing?.frames?.[0]?.index ?? null,
  );
  const [copied, setCopied] = useState(false);
  const [progress, setProgress] = useState('');
  const plan = useAiAction();
  const render = useAiAction();

  const pack = existing;
  const canUse = supportsFramePack(piece.format);

  const gallery = useMemo(() => {
    if (Array.isArray(review.images) && review.images.length)
      return review.images;
    return review.image ? [review.image] : [];
  }, [review.images, review.image]);

  if (!canUse) return null;

  const persist = (next: FramePack) => {
    onReviewChange(setReviewFramePack(offerSlug, piece.id, next));
  };

  const applyGallery = (urls: string[], active = 0) => {
    onReviewChange(setReviewImages(offerSlug, piece.id, urls, active));
  };

  const generatePlan = () =>
    plan.run(async () => {
      const result = await aiGenerateFramePackPlan({
        piece: {
          hook: piece.hook,
          hooks: piece.hooks,
          caption: piece.caption,
          body: piece.body,
          theme: piece.theme,
          tone: TONE_LABEL[piece.tone],
          platform: PLATFORM_LABEL[piece.platform],
          format: piece.format,
          slides: piece.slides?.map((s) => ({
            text: s.text,
            sub: s.sub,
            visual: s.visual,
          })),
        },
        slideCount: clampSlideCount(slideCount),
        mode,
        aspect,
        guides: guides.trim() || undefined,
        model: model || undefined,
      });
      const base = emptyFramePack(piece, {
        slideCount: result.slideCount,
        mode: result.mode,
        aspect:
          result.aspect === '4:5' ||
          result.aspect === '9:16' ||
          result.aspect === '1:1'
            ? result.aspect
            : aspect,
      });
      const next = withPlannedFrames(
        base,
        result.frames.map((f) => ({
          index: f.index,
          role: f.role,
          text: f.text,
          sub: f.sub,
          visual: f.visual,
          prompt: f.prompt,
          lookbackSummary: f.lookbackSummary,
        })),
        {
          model: result.model,
          systemNotes: result.systemNotes,
          mode: result.mode,
          aspect: base.aspect,
        },
      );
      persist(next);
      setSlideCount(next.slideCount);
      setMode(next.mode);
      setExpanded(next.frames[0]?.index ?? null);
    });

  const clear = () => {
    onReviewChange(clearReviewFramePack(offerSlug, piece.id));
    setExpanded(null);
  };

  const updateFrame = (index: number, patch: Partial<FramePackFrame>) => {
    if (!pack) return;
    persist(patchFrame(pack, index, patch));
  };

  /** Mode A: generate frame 1 from prompt, then edit continuity for 2..N. */
  const buildAllFrames = () =>
    render.run(async () => {
      if (!pack?.frames?.length) throw new Error('Plan a pack first');
      const urls: string[] = [];
      let working = { ...pack, frames: [...pack.frames] };
      for (let i = 0; i < working.frames.length; i++) {
        const frame = working.frames[i];
        setProgress(`Frame ${frame.index} of ${working.frames.length}…`);
        let url: string;
        if (i === 0 || !urls[0]) {
          if (!frame.prompt?.trim()) {
            throw new Error(`Frame ${frame.index} needs a prompt`);
          }
          url = await aiGenerateImage(
            frame.prompt,
            piece.format,
            imageModel || undefined,
          );
        } else {
          const editPrompt = continuityEditPrompt(frame, working);
          url = await aiEditImage({
            prompt: editPrompt,
            seed: urls[0],
            format: piece.format,
            model: imageModel || undefined,
          });
        }
        urls.push(url);
        working = patchFrame(working, frame.index, { imageUrl: url });
      }
      setProgress('');
      const next = withFrameImages(working, urls);
      persist(next);
      applyGallery(urls, 0);
    });

  /** Generate or regenerate a single frame (uses seed when available). */
  const renderOne = (index1: number) =>
    render.run(async () => {
      if (!pack) throw new Error('Plan a pack first');
      const frame = pack.frames.find((f) => f.index === index1);
      if (!frame) throw new Error('Frame not found');
      setProgress(`Rendering frame ${index1}…`);
      const seed = gallery[0] || pack.frames[0]?.imageUrl;
      let url: string;
      if (index1 === 1 || !seed) {
        if (!frame.prompt?.trim()) throw new Error('Frame needs a prompt');
        url = await aiGenerateImage(
          frame.prompt,
          piece.format,
          imageModel || undefined,
        );
      } else {
        url = await aiEditImage({
          prompt: continuityEditPrompt(frame, pack),
          seed,
          format: piece.format,
          model: imageModel || undefined,
        });
      }
      setProgress('');
      const next = patchFrame(pack, index1, { imageUrl: url });
      persist(next);
      // Merge into gallery at the correct index
      const nextGallery = [...gallery];
      while (nextGallery.length < index1) nextGallery.push('');
      nextGallery[index1 - 1] = url;
      const cleaned = nextGallery.map((u, i) => u || gallery[i] || '').filter(Boolean);
      // Prefer full-length array aligned to frames
      const aligned = pack.frames.map((f, i) =>
        f.index === index1 ? url : gallery[i] || f.imageUrl || '',
      );
      const hasAll = aligned.every(Boolean);
      applyGallery(hasAll ? aligned : cleaned.length ? cleaned : [url], index1 - 1);
    });

  /** Mode B: one strip image → split into N panels → gallery. */
  const buildStripAndSplit = () =>
    render.run(async () => {
      if (!pack?.frames?.length) throw new Error('Plan a pack first');
      setProgress('Rendering strip…');
      const prompt = buildStripPrompt(pack);
      const stripUrl = await aiGenerateImage(
        prompt,
        // Use feed-ish square for wide strip; split handles panels
        'feed',
        imageModel || undefined,
      );
      setProgress('Splitting panels…');
      const panels = await splitStripImage(stripUrl, pack.slideCount, {
        direction: 'horizontal',
        gutterPx: 8,
      });
      // Host each panel so gallery stays stable
      const hosted: string[] = [];
      for (let i = 0; i < panels.length; i++) {
        setProgress(`Hosting panel ${i + 1}…`);
        try {
          hosted.push(await aiHostImage(panels[i]));
        } catch {
          hosted.push(panels[i]);
        }
      }
      setProgress('');
      let next: FramePack = {
        ...pack,
        mode: 'strip',
        stripSource: stripUrl,
      };
      next = withFrameImages(next, hosted);
      persist(next);
      applyGallery(hosted, 0);
    });

  const copyPack = async () => {
    if (!pack) return;
    try {
      await navigator.clipboard.writeText(packToText(pack));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const busy = plan.busy || render.busy;
  const err = plan.error || render.error;

  return (
    <div className="space-y-5 rounded-xl border border-ink/10 bg-mushroom/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brass">
            <Layers className="h-3.5 w-3.5" />
            Frame pack
          </p>
          <p className="mt-1 text-xs text-ink/55">
            Ordered slides for this {FORMAT_LABEL[piece.format]}. Plan roles and
            prompts, then build N continuous frames (or a strip you split).
            Gallery index = slide index.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink/45">
            Slides
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              type="number"
              min={MIN_FRAME_PACK}
              max={MAX_FRAME_PACK}
              value={slideCount}
              onChange={(e) =>
                setSlideCount(clampSlideCount(Number(e.target.value)))
              }
              className="w-16 rounded-md border border-ink/15 bg-white/70 px-2 py-1 text-sm"
            />
            <span className="text-[11px] text-ink/40">
              {MIN_FRAME_PACK}–{MAX_FRAME_PACK}
            </span>
          </div>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink/45">
            Aspect
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {ASPECTS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAspect(a)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  aspect === a
                    ? 'bg-mode/15 text-mode ring-1 ring-mode/30'
                    : 'border border-ink/15 text-ink/60'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink/45">
            Mode
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {(
              [
                ['frames', 'Frames'],
                ['strip', 'Strip'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  mode === id
                    ? 'bg-mode/15 text-mode ring-1 ring-mode/30'
                    : 'border border-ink/15 text-ink/60'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <InstructionsInput
        value={guides}
        onChange={setGuides}
        placeholder="Optional production guides (palette, props, type zone)…"
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={generatePlan}
          disabled={busy}
          className={aiBtnSolid}
        >
          {plan.busy ? <Spinner /> : <Sparkles className="h-3.5 w-3.5" />}
          {pack?.frames?.length ? 'Re-plan pack' : 'Plan pack'}
        </button>
        {pack?.frames?.length ? (
          <>
            <button
              type="button"
              onClick={copyPack}
              className={aiBtnGhost}
              title="Copy pack as text"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
            <button type="button" onClick={clear} className={aiBtnGhost}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        ) : null}
      </div>

      {err ? <AiError message={err} /> : null}

      {pack?.frames?.length ? (
        <>
          {pack.systemNotes ? (
            <p className="rounded-lg border border-ink/10 bg-white/50 px-3 py-2 text-[11px] text-ink/60">
              {pack.systemNotes}
            </p>
          ) : null}

          <div className="space-y-2">
            {pack.frames.map((f) => {
              const open = expanded === f.index;
              const thumb = f.imageUrl || gallery[f.index - 1];
              return (
                <div
                  key={f.index}
                  className="rounded-lg border border-ink/10 bg-white/60"
                >
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : f.index)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left"
                  >
                    <ChevronRight
                      className={`h-3.5 w-3.5 shrink-0 text-ink/40 transition-transform ${
                        open ? 'rotate-90' : ''
                      }`}
                    />
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb}
                        alt=""
                        className="h-8 w-8 rounded object-cover"
                      />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded bg-ink/5 text-[10px] text-ink/40">
                        {f.index}
                      </span>
                    )}
                    <span className="text-xs font-semibold text-ink">
                      {f.index}. {f.role}
                    </span>
                    <span className="truncate text-[11px] text-ink/50">
                      {f.text || f.visual || f.prompt?.slice(0, 48) || ''}
                    </span>
                  </button>
                  {open ? (
                    <div className="space-y-2 border-t border-ink/5 px-3 py-3">
                      <label className="block">
                        <span className="text-[10px] uppercase tracking-wide text-ink/40">
                          On-slide text
                        </span>
                        <input
                          value={f.text ?? ''}
                          onChange={(e) =>
                            updateFrame(f.index, { text: e.target.value })
                          }
                          className="mt-1 w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[10px] uppercase tracking-wide text-ink/40">
                          Sub
                        </span>
                        <input
                          value={f.sub ?? ''}
                          onChange={(e) =>
                            updateFrame(f.index, { sub: e.target.value })
                          }
                          className="mt-1 w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[10px] uppercase tracking-wide text-ink/40">
                          Image prompt
                        </span>
                        <textarea
                          value={f.prompt ?? ''}
                          onChange={(e) =>
                            updateFrame(f.index, { prompt: e.target.value })
                          }
                          rows={3}
                          className="mt-1 w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 text-xs leading-relaxed"
                        />
                      </label>
                      {f.lookbackSummary ? (
                        <p className="text-[11px] text-ink/45">
                          Lookback: {f.lookbackSummary}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => renderOne(f.index)}
                        className={`${aiBtnGhost} text-xs`}
                      >
                        {render.busy ? (
                          <Spinner />
                        ) : (
                          <ImagePlus className="h-3.5 w-3.5" />
                        )}
                        {thumb ? 'Regen frame' : 'Render frame'}
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3">
            <label className="flex items-center gap-1.5 text-[11px] text-ink/50">
              Image model
              <select
                value={imageModel}
                onChange={(e) => setImageModel(e.target.value)}
                className="rounded-md border border-ink/15 bg-white px-2 py-1 text-xs"
              >
                <option value={AUTO_MODEL}>Auto</option>
                {[...IMAGE_MODELS, ...EDIT_IMAGE_MODELS]
                  .filter(
                    (m, i, arr) => arr.findIndex((x) => x.id === m.id) === i,
                  )
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
              </select>
            </label>
            {mode === 'frames' || pack.mode === 'frames' ? (
              <button
                type="button"
                disabled={busy}
                onClick={buildAllFrames}
                className={aiBtnSolid}
              >
                {render.busy ? <Spinner /> : <Layers className="h-3.5 w-3.5" />}
                Build all frames
              </button>
            ) : null}
            {(mode === 'strip' || pack.mode === 'strip') &&
            piece.format === 'carousel' ? (
              <button
                type="button"
                disabled={busy}
                onClick={buildStripAndSplit}
                className={aiBtnSolid}
              >
                {render.busy ? (
                  <Spinner />
                ) : (
                  <Scissors className="h-3.5 w-3.5" />
                )}
                Strip → split
              </button>
            ) : null}
            {onOpenStudio ? (
              <button type="button" onClick={onOpenStudio} className={aiBtnGhost}>
                Open studio
              </button>
            ) : null}
          </div>
          {progress ? (
            <p className="text-[11px] text-mode">{progress}</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
};
