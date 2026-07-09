'use client';

/**
 * The Generate drawer for the content hub. Compose offer-grounded, on-voice
 * pieces with a prompt style and writer model, then review the outputs before
 * anything lands in the library. Brand voice rules are enforced server-side.
 * Review can one-click render each draft's media.prompt (or open Image Studio)
 * and those images ride along into the library on save.
 */
import React, { useMemo, useState } from 'react';
import {
  X as XIcon,
  Sparkles,
  Check,
  ChevronLeft,
  Library,
  Trash2,
  Copy,
  ImagePlus,
  Maximize2,
} from 'lucide-react';
import {
  useAiAction,
  aiBtnSolid,
  aiBtnGhost,
  Spinner,
  AiError,
} from './AiControls';
import { generateBatch, saveGeneratedBatch } from './generatedClient';
import { setReviewImages, loadReviews } from './reviewClient';
import { type PieceReview } from '@/lib/mothermode/content/review';

import { PlatformPreview } from './previews/PlatformPreview';
import { ImageStudioModal } from './ImageStudioModal';
import { aiGenerateImage } from './aiClient';
import { OFFERS } from '@/lib/mothermode/offers';
import {
  PLATFORM_LABEL,
  FORMAT_LABEL,
  KIND_LABEL,
  TONE_LABEL,
  TEXT_MODELS,
  IMAGE_MODELS,
  AUTO_MODEL,
  PLATFORM_FORMATS,
  PROMPT_STYLES,
  AUTO_STYLE,
  stylesFor,
  buildImagePrompt,
  type ContentFormat,
  type ContentKind,
  type ContentPiece,
  type ContentPlatform,
  type ToneRegister,
} from '@/lib/mothermode/content';


const PLATFORMS = Object.keys(PLATFORM_LABEL) as ContentPlatform[];
const KINDS: ContentKind[] = ['organic', 'ad'];
const TONES = Object.keys(TONE_LABEL) as ToneRegister[];

const fieldCls =
  'w-full rounded-lg border border-ink/15 bg-white/70 px-2.5 py-1.5 text-sm text-ink focus:border-mode focus:outline-none';
const labelCls = 'mb-1 block text-xs uppercase tracking-wide text-ink/45';

/** A labelled <select> kept compact for the two-column grid. */
const Select: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}> = ({ label, value, onChange, children }) => (
  <div>
    <label className={labelCls}>{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={fieldCls}
    >
      {children}
    </select>
  </div>
);

/** Compact summary of a draft piece for the review list. */
function pieceBlurb(p: ContentPiece): string {
  if (p.script?.length) {
    const vo = p.script
      .map((b) => b.voiceover)
      .filter(Boolean)
      .slice(0, 3)
      .join(' ');
    return vo || p.hook;
  }
  if (p.body?.length) return p.body.slice(0, 2).join(' ');
  if (p.caption) return p.caption;
  if (p.tweets?.length) return p.tweets.slice(0, 2).join(' ');
  return p.hook;
}

/** Full image prompt for a visual piece (scene + hook), ready to copy. */
function fullImagePrompt(p: ContentPiece): string | undefined {
  const scene = p.media?.prompt ?? p.visual;
  if (!scene) return undefined;
  return buildImagePrompt(scene, p.hook);
}

export const BatchPanel: React.FC<{
  pieces: ContentPiece[];
  onClose: () => void;
  onGenerated: (pieces: ContentPiece[]) => void;
}> = ({ pieces, onClose, onGenerated }) => {
  const [offerSlug, setOfferSlug] = useState(OFFERS[0]?.slug ?? '');
  const [mode, setMode] = useState<'batch' | 'variations'>('batch');
  const [platform, setPlatform] = useState<ContentPlatform>('instagram');
  const [format, setFormat] = useState<ContentFormat>('feed');
  const [kind, setKind] = useState<ContentKind>('organic');
  const [tone, setTone] = useState<ToneRegister>('confidante');
  const [count, setCount] = useState(5);
  const [theme, setTheme] = useState('');
  const [guides, setGuides] = useState('');
  const [model, setModel] = useState(AUTO_MODEL);
  const [style, setStyle] = useState(AUTO_STYLE);
  const [sourceId, setSourceId] = useState('');

  // Review phase: drafts live here until the user saves selected ones.
  const [phase, setPhase] = useState<'compose' | 'review'>('compose');
  const [drafts, setDrafts] = useState<ContentPiece[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  // Local image galleries for drafts (not in the library yet). Keyed by piece id.
  const [draftImages, setDraftImages] = useState<Record<string, string[]>>({});
  const [draftImageIndex, setDraftImageIndex] = useState<Record<string, number>>(
    {},
  );
  const [imgModel, setImgModel] = useState(AUTO_MODEL);
  const [imgCount, setImgCount] = useState(1);
  const [studioOpen, setStudioOpen] = useState(false);
  const [imgBusyId, setImgBusyId] = useState<string | null>(null);
  const [imgError, setImgError] = useState<string | null>(null);

  const { busy, error, run } = useAiAction();

  const formats = PLATFORM_FORMATS[platform];
  const availableStyles = useMemo(
    () => stylesFor(platform, format),
    [platform, format],
  );
  // Always show full catalog, but lead with strong fits for this channel.
  const styleOptions = useMemo(() => {
    const fitIds = new Set(availableStyles.map((s) => s.id));
    const rest = PROMPT_STYLES.filter((s) => !fitIds.has(s.id));
    return [...availableStyles, ...rest];
  }, [availableStyles]);

  const changePlatform = (p: string) => {
    const next = p as ContentPlatform;
    setPlatform(next);
    const nextFormats = PLATFORM_FORMATS[next];
    const nextFormat = nextFormats.includes(format) ? format : nextFormats[0];
    setFormat(nextFormat);
    // Prefer short-form script when landing on video/reel.
    if (nextFormat === 'video' || nextFormat === 'reel') {
      setStyle('short-form-script');
    }
  };

  const changeFormat = (v: string) => {
    const next = v as ContentFormat;
    setFormat(next);
    if (next === 'video' || next === 'reel') setStyle('short-form-script');
    else if (next === 'email') setStyle('email-confidante');
    else if (next === 'carousel' || next === 'idea') setStyle('carousel-truth');
  };

  const sources = useMemo(
    () => pieces.filter((p) => p.platform === platform),
    [pieces, platform],
  );

  const selectedCount = selected.size;
  const focused = focusId
    ? drafts.find((d) => d.id === focusId) ?? null
    : null;

  /** Synthetic review so PlatformPreview / Image Studio see draft images. */
  const reviewFor = (id: string): PieceReview => {
    const images = draftImages[id] ?? [];
    if (images.length === 0) return {};
    return {
      images,
      imageIndex: draftImageIndex[id] ?? 0,
    };
  };

  const focusedReview = focused ? reviewFor(focused.id) : {};
  const focusedPrompt = focused ? fullImagePrompt(focused) : undefined;
  const focusedHasPrompt = Boolean(focusedPrompt);

  const addImagesFor = (id: string, urls: string[]) => {
    if (!urls.length) return;
    setDraftImages((prev) => {
      const cur = prev[id] ?? [];
      const next = [...cur];
      for (const u of urls) if (u && !next.includes(u)) next.push(u);
      return { ...prev, [id]: next };
    });
    setDraftImageIndex((prev) => {
      const curLen = (draftImages[id] ?? []).length;
      // Prefer the first newly added frame as primary when gallery was empty.
      if (curLen === 0) return { ...prev, [id]: 0 };
      return prev;
    });
  };

  const removeImageFor = (id: string, index: number) => {
    setDraftImages((prev) => {
      const cur = prev[id] ?? [];
      const next = cur.filter((_, i) => i !== index);
      return { ...prev, [id]: next };
    });
    setDraftImageIndex((prev) => {
      const cur = draftImages[id] ?? [];
      const nextLen = Math.max(0, cur.length - 1);
      const active = prev[id] ?? 0;
      const nextIdx =
        nextLen === 0 ? 0 : active >= nextLen ? nextLen - 1 : active;
      return { ...prev, [id]: nextIdx };
    });
  };

  const onUploadFor = (id: string, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      if (dataUrl) addImagesFor(id, [dataUrl]);
    };
    reader.readAsDataURL(file);
  };

  /** One-click render from the draft's media.prompt (hook-anchored). */
  const renderImage = (piece: ContentPiece) => {
    const prompt = fullImagePrompt(piece);
    if (!prompt) {
      setImgError('This draft has no image prompt to render.');
      return;
    }
    if (imgBusyId) return;
    setImgBusyId(piece.id);
    setImgError(null);
    void (async () => {
      try {
        const n = Math.max(1, Math.min(4, imgCount));
        const urls: string[] = [];
        for (let i = 0; i < n; i++) {
          const url = await aiGenerateImage(
            prompt,
            piece.format,
            imgModel || undefined,
          );
          if (url) urls.push(url);
        }
        if (!urls.length) throw new Error('No image was returned');
        addImagesFor(piece.id, urls);
      } catch (e) {
        setImgError(e instanceof Error ? e.message : 'Image generation failed');
      } finally {
        setImgBusyId(null);
      }
    })();
  };

  const generate = () =>
    run(async () => {
      const source =
        mode === 'variations' && sourceId
          ? pieces.find((p) => p.id === sourceId)
          : undefined;
      const created = await generateBatch({
        offerSlug,
        mode,
        count,
        platform,
        format,
        kind,
        tone,
        theme: theme.trim() || undefined,
        guides: guides.trim() || undefined,
        model: model || undefined,
        style: style || undefined,
        source,
        persist: false,
      });
      if (created.length === 0) throw new Error('No pieces were returned');
      setDrafts(created);
      setSelected(new Set(created.map((p) => p.id)));
      setFocusId(created[0]?.id ?? null);
      setDraftImages({});
      setDraftImageIndex({});
      setImgError(null);
      setStudioOpen(false);
      setPhase('review');
    });

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectAll = () => setSelected(new Set(drafts.map((d) => d.id)));
  const selectNone = () => setSelected(new Set());

  const discardAll = () => {
    setDrafts([]);
    setSelected(new Set());
    setFocusId(null);
    setDraftImages({});
    setDraftImageIndex({});
    setImgError(null);
    setStudioOpen(false);
    setPhase('compose');
  };

  const saveSelected = () =>
    run(async () => {
      const chosen = drafts.filter((d) => selected.has(d.id));
      if (chosen.length === 0) throw new Error('Select at least one piece to save');
      const saved = await saveGeneratedBatch({
        pieces: chosen,
        offerSlug,
        guides: guides.trim() || undefined,
        model: model || undefined,
        sourcePieceId:
          mode === 'variations' && sourceId ? sourceId : undefined,
      });
      const finalPieces = saved.length ? saved : chosen;
      // Attach any images rendered during review to each piece's gallery so
      // they show in the hub and can post to GoHighLevel.
      await loadReviews(offerSlug);
      for (const p of finalPieces) {
        const local =
          chosen.find((c) => c.id === p.id) ??
          chosen.find((c) => c.title === p.title);
        const localId = local?.id ?? p.id;
        const imgs = draftImages[localId] ?? [];
        if (imgs.length > 0) {
          setReviewImages(
            offerSlug,
            p.id,
            imgs,
            draftImageIndex[localId] ?? 0,
          );
        }
      }
      onGenerated(finalPieces);
      onClose();
    });


  const reviewing = phase === 'review';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/30 backdrop-blur-sm">
      <div
        className={`flex h-full w-full flex-col bg-bone shadow-xl transition-[max-width] ${
          reviewing ? 'max-w-3xl' : 'max-w-md'
        }`}
      >
        <div className="flex items-center justify-between border-b border-ink/10 px-6 py-4">
          <h2 className="flex items-center gap-2 font-display text-2xl text-ink">
            <Sparkles className="h-5 w-5 text-brass" />
            {reviewing ? 'Review drafts' : 'Generate content'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-ink/40 hover:text-ink"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {!reviewing ? (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <p className="text-sm text-ink/60">
              Ultra long-form, value-forward pieces with hook variants and image
              prompts. Grounded in the offer page and MotherMode voice. Review
              before they enter the library.
            </p>


            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Select
                  label="Offer"
                  value={offerSlug}
                  onChange={setOfferSlug}
                >
                  {OFFERS.map((o) => (
                    <option key={o.slug} value={o.slug}>
                      {o.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Mode</label>
                <div className="flex gap-2">
                  {(['batch', 'variations'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`flex-1 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                        mode === m
                          ? 'bg-mode text-bone'
                          : 'border border-ink/15 text-ink/70'
                      }`}
                    >
                      {m === 'batch' ? 'Distinct posts' : 'Variations'}
                    </button>
                  ))}
                </div>
              </div>
              {mode === 'variations' && (
                <div className="col-span-2">
                  <Select
                    label="Base on (optional)"
                    value={sourceId}
                    onChange={setSourceId}
                  >
                    <option value="">Write fresh variations</option>
                    {sources.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              <Select
                label="Channel"
                value={platform}
                onChange={changePlatform}
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {PLATFORM_LABEL[p]}
                  </option>
                ))}
              </Select>
              <Select
                label="Format"
                value={format}
                onChange={changeFormat}
              >
                {formats.map((f) => (
                  <option key={f} value={f}>
                    {FORMAT_LABEL[f]}
                  </option>
                ))}
              </Select>
              <Select
                label="Type"
                value={kind}
                onChange={(v) => setKind(v as ContentKind)}
              >
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </Select>
              <Select
                label="Tone"
                value={tone}
                onChange={(v) => setTone(v as ToneRegister)}
              >
                {TONES.map((t) => (
                  <option key={t} value={t}>
                    {TONE_LABEL[t]}
                  </option>
                ))}
              </Select>

              <div className="col-span-2">
                <label className={labelCls}>Prompt style</label>
                <div className="flex flex-wrap gap-1.5">
                  {styleOptions.map((s) => {
                    const active = style === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        title={s.hint}
                        onClick={() => setStyle(s.id)}
                        className={`rounded-full border px-2.5 py-1 text-left text-xs transition-colors ${
                          active
                            ? 'border-mode bg-mode/10 font-semibold text-mode'
                            : 'border-ink/15 text-ink/65 hover:border-ink/30'
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[11px] text-ink/45">
                  {PROMPT_STYLES.find((s) => s.id === style)?.hint ??
                    'Best fit for this channel'}
                </p>
              </div>

              <div className="col-span-2">
                <Select label="Writer model" value={model} onChange={setModel}>
                  <option value={AUTO_MODEL}>Auto (recommended)</option>
                  {TEXT_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                      {m.note ? ` · ${m.note}` : ''}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="col-span-2">
                <label className={labelCls}>How many: {count}</label>
                <input
                  type="range"
                  min={3}
                  max={10}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="w-full accent-mode"
                />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Theme / angle (optional)</label>
                <input
                  type="text"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  placeholder="e.g. the 5 pm witching hour"
                  className={fieldCls}
                />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Prompt guides (optional)</label>
                <textarea
                  value={guides}
                  onChange={(e) => setGuides(e.target.value)}
                  rows={3}
                  placeholder="Steer the batch. Style + brand voice always win."
                  className={`${fieldCls} resize-none`}
                />
              </div>
            </div>

            <button
              onClick={generate}
              disabled={busy}
              className={`${aiBtnSolid} mt-5 w-full justify-center py-2.5 text-sm`}
            >
              {busy ? <Spinner /> : <Sparkles className="h-4 w-4" />}
              {busy ? `Writing ${count} pieces...` : `Generate ${count} pieces`}
            </button>
            <AiError message={error} />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-2 border-b border-ink/10 px-6 py-3">
              <button
                type="button"
                onClick={() => setPhase('compose')}
                className={`${aiBtnGhost} gap-1`}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </button>
              <p className="text-sm text-ink/60">
                {drafts.length} draft{drafts.length === 1 ? '' : 's'} ·{' '}
                {selectedCount} selected
              </p>
              <div className="ml-auto flex gap-2">
                <button type="button" onClick={selectAll} className={aiBtnGhost}>
                  All
                </button>
                <button type="button" onClick={selectNone} className={aiBtnGhost}>
                  None
                </button>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 md:grid-cols-2">
              <div className="overflow-y-auto border-b border-ink/10 p-4 md:border-b-0 md:border-r">
                <ul className="space-y-2">
                  {drafts.map((d, i) => {
                    const on = selected.has(d.id);
                    const isFocus = focusId === d.id;
                    return (
                      <li key={d.id}>
                        <div
                          className={`rounded-xl border p-3 transition-colors ${
                            isFocus
                              ? 'border-mode bg-mode/5'
                              : 'border-ink/10 bg-white/50 hover:border-ink/20'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <button
                              type="button"
                              onClick={() => toggle(d.id)}
                              aria-label={on ? 'Deselect' : 'Select'}
                              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                                on
                                  ? 'border-mode bg-mode text-bone'
                                  : 'border-ink/25 bg-white'
                              }`}
                            >
                              {on && <Check className="h-3 w-3" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => setFocusId(d.id)}
                              className="min-w-0 flex-1 text-left"
                            >
                              <p className="text-[11px] uppercase tracking-[0.14em] text-brass">
                                {i + 1}. {PLATFORM_LABEL[d.platform]} ·{' '}
                                {FORMAT_LABEL[d.format]}
                              </p>
                              <p className="mt-0.5 font-semibold text-ink">
                                {d.title}
                              </p>
                              <p className="mt-1 line-clamp-4 text-xs text-ink/65">
                                {pieceBlurb(d)}
                              </p>
                              <p className="mt-1.5 text-[10px] uppercase tracking-[0.12em] text-ink/40">
                                {(d.hooks?.length ?? 1)} hooks
                                {d.media?.prompt || d.visual
                                  ? ' · image prompt'
                                  : ''}
                                {(draftImages[d.id]?.length ?? 0) > 0
                                  ? ` · ${draftImages[d.id].length} image${
                                      draftImages[d.id].length === 1 ? '' : 's'
                                    }`
                                  : ''}
                                {d.body?.length
                                  ? ` · ${d.body.length} paras`
                                  : ''}
                                {d.script?.length
                                  ? ` · ${d.script.length} beats`
                                  : ''}
                              </p>

                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="overflow-y-auto p-4">
                {focused ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-ink/45">
                        Preview
                      </p>
                      <h3 className="font-display text-lg text-ink">
                        {focused.title}
                      </h3>
                      <p className="mt-1 text-sm font-medium text-ink/80">
                        {focused.hook}
                      </p>
                    </div>

                    {(focused.hooks?.length ?? 0) > 0 && (
                      <div className="rounded-lg border border-ink/10 bg-white/60 p-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-ink/45">
                          Hook variants · {focused.hooks!.length}
                        </p>
                        <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs text-ink/75">
                          {focused.hooks!.map((h, i) => (
                            <li
                              key={i}
                              className={
                                i === 0 ? 'font-semibold text-ink' : undefined
                              }
                            >
                              {h}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    <div className="flex justify-center">
                      <PlatformPreview piece={focused} review={focusedReview} />
                    </div>

                    {/* Image bridge: one-click render from media.prompt + studio */}
                    {(focusedHasPrompt ||
                      (draftImages[focused.id]?.length ?? 0) > 0) && (
                      <div className="rounded-lg border border-mode/20 bg-mode/5 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-ink/45">
                            Visual
                            {(draftImages[focused.id]?.length ?? 0) > 0
                              ? ` · ${draftImages[focused.id].length}`
                              : ''}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <select
                              value={imgModel}
                              onChange={(e) => setImgModel(e.target.value)}
                              className="rounded-md border border-ink/15 bg-white/70 px-2 py-1 text-[11px] text-ink focus:border-mode focus:outline-none"
                              aria-label="Image model"
                            >
                              <option value={AUTO_MODEL}>Auto</option>
                              {IMAGE_MODELS.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.label}
                                </option>
                              ))}
                            </select>
                            <select
                              value={imgCount}
                              onChange={(e) =>
                                setImgCount(Number(e.target.value))
                              }
                              className="rounded-md border border-ink/15 bg-white/70 px-2 py-1 text-[11px] text-ink focus:border-mode focus:outline-none"
                              aria-label="Variant count"
                            >
                              {[1, 2, 3, 4].map((n) => (
                                <option key={n} value={n}>
                                  {n}×
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={
                              !focusedHasPrompt ||
                              imgBusyId === focused.id ||
                              busy
                            }
                            onClick={() => renderImage(focused)}
                            className={`${aiBtnSolid} gap-1.5`}
                          >
                            {imgBusyId === focused.id ? (
                              <Spinner />
                            ) : (
                              <ImagePlus className="h-3.5 w-3.5" />
                            )}
                            {imgBusyId === focused.id
                              ? 'Creating image...'
                              : imgCount > 1
                                ? `Create ${imgCount} images`
                                : 'Create image'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setStudioOpen(true)}
                            className={`${aiBtnGhost} gap-1.5`}
                          >
                            <Maximize2 className="h-3.5 w-3.5" />
                            Image studio
                          </button>
                        </div>
                        <p className="mt-1.5 text-[11px] text-ink/45">
                          Renders the hook-anchored prompt below. On-brand
                          styling is added server-side.
                        </p>
                        <AiError message={imgError} />
                      </div>
                    )}

                    {focused.body && focused.body.length > 0 && (

                      <div className="rounded-lg border border-ink/10 bg-white/60 p-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-ink/45">
                          Body · {focused.body.length} paragraphs
                        </p>
                        <div className="mt-2 space-y-2 text-xs leading-relaxed text-ink/75">
                          {focused.body.map((para, i) => (
                            <p key={i}>{para}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    {focused.script && focused.script.length > 0 && (
                      <div className="rounded-lg border border-ink/10 bg-white/60 p-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-ink/45">
                          Script · {focused.script.length} beats
                        </p>
                        <ol className="mt-2 space-y-2 text-xs text-ink/75">
                          {focused.script.map((b, i) => (
                            <li key={i}>
                              <span className="font-semibold text-ink">
                                {b.at}
                              </span>
                              {b.onScreen && (
                                <p className="text-ink/55">
                                  On screen: {b.onScreen}
                                </p>
                              )}
                              {b.voiceover && <p>{b.voiceover}</p>}
                              {b.visual && (
                                <p className="text-ink/45 italic">
                                  Visual: {b.visual}
                                </p>
                              )}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {focusedPrompt && (
                      <div className="rounded-lg border border-brass/25 bg-brass/5 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-ink/45">
                            Image prompt
                          </p>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className={`${aiBtnGhost} gap-1 py-1`}
                              onClick={() => {
                                if (focusedPrompt)
                                  void navigator.clipboard.writeText(
                                    focusedPrompt,
                                  );
                              }}
                            >
                              <Copy className="h-3 w-3" />
                              Copy
                            </button>
                            <button
                              type="button"
                              disabled={
                                imgBusyId === focused.id || busy
                              }
                              className={`${aiBtnSolid} gap-1 py-1`}
                              onClick={() => renderImage(focused)}
                            >
                              {imgBusyId === focused.id ? (
                                <Spinner />
                              ) : (
                                <ImagePlus className="h-3 w-3" />
                              )}
                              Create
                            </button>
                          </div>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-ink/70">
                          {focusedPrompt}
                        </p>
                      </div>
                    )}

                    {focused.cta && (
                      <p className="text-xs text-ink/55">
                        <span className="font-semibold text-ink/70">CTA: </span>
                        {focused.cta}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-ink/50">
                    Select a draft to preview.
                  </p>
                )}
              </div>

            </div>

            {focused && (
              <ImageStudioModal
                open={studioOpen}
                onClose={() => setStudioOpen(false)}
                piece={focused}
                review={focusedReview}
                onUpload={(file) => onUploadFor(focused.id, file)}
                onAddImages={(urls) => addImagesFor(focused.id, urls)}
                onRemove={(index) => removeImageFor(focused.id, index)}
                onSetIndex={(index) =>
                  setDraftImageIndex((prev) => ({
                    ...prev,
                    [focused.id]: index,
                  }))
                }
              />
            )}


            <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 px-6 py-4">
              <button
                type="button"
                onClick={discardAll}
                disabled={busy}
                className={`${aiBtnGhost} gap-1.5`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Discard all
              </button>
              <button
                type="button"
                onClick={saveSelected}
                disabled={busy || selectedCount === 0}
                className={`${aiBtnSolid} ml-auto gap-1.5 px-4 py-2`}
              >
                {busy ? <Spinner /> : <Library className="h-4 w-4" />}
                {busy
                  ? 'Saving...'
                  : `Save ${selectedCount} to library`}
              </button>
              <AiError message={error} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
