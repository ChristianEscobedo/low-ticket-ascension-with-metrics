'use client';

/**
 * Per-slide text editor for TikTok photo-mode slideshows (and other multi-frame
 * posts): the TikTok text-editing feature. Each slide gets its own overlay
 * recipe (text, font, weight, color, size, position, transform) that can be
 * edited on-canvas, then burned onto the slide image via the shared
 * renderOverlayToDataUrl and hosted back to the review gallery.
 */
import React, { useMemo, useState } from 'react';
import { Type, Wand2, Trash2, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  OVERLAY_COLORS,
  OVERLAY_FONTS,
  OVERLAY_SIZES,
  OVERLAY_TRANSFORMS,
  OVERLAY_WEIGHTS,
  canvasSizeForFormat,
  defaultOverlay,
  freeformCssTransform,
  getOverlayColor,
  getOverlayFont,
  getOverlayWeightCss,
  overlayPrimaryPx,
  overlaySubPx,
  renderOverlayToDataUrl,
  toStoredOverlay,
  type ContentPiece,
  type ImageOverlay,
  type OverlayColor,
  type OverlayFontId,
  type OverlaySize,
  type OverlayTransform,
  type OverlayWeight,
} from '@/lib/mothermode/content';
import {
  clampIndex,
  reviewImages,
  withSlideOverlay,
  withoutSlideOverlay,
  type PieceReview,
  type StoredImageOverlay,
} from '@/lib/mothermode/content/review';
import { saveReview, setReviewImages } from './reviewClient';
import { aiHostImage } from './aiClient';
import { Spinner } from './AiControls';

const labelCls = 'text-[11px] uppercase tracking-[0.16em] text-ink/45';
const chipBase = 'rounded-full border px-2.5 py-1 text-[11px] transition-colors';
const chipOn = 'border-mode/40 bg-mode/10 font-semibold text-mode';
const chipOff = 'border-ink/15 text-ink/60 hover:border-ink/30 hover:text-ink/80';

function asOverlay(raw: StoredImageOverlay | undefined, seed: { text: string; sub?: string }): ImageOverlay {
  const base = defaultOverlay({
    text: seed.text,
    sub: seed.sub ?? '',
    // Photo-mode reads best as bold white text on a scrim.
    styleId: 'scrim',
    size: 'xl',
    weight: 'black',
    color: 'white',
    vAlign: 'middle',
    hAlign: 'center',
    x: 0.5,
    y: 0.5,
  });
  if (!raw) return base;
  return {
    ...base,
    text: raw.text ?? base.text,
    sub: raw.sub ?? base.sub,
    fontId: (OVERLAY_FONTS.some((f) => f.id === raw.fontId) ? raw.fontId : base.fontId) as OverlayFontId,
    size: (OVERLAY_SIZES.some((s) => s.id === raw.size) ? raw.size : base.size) as OverlaySize,
    weight: (OVERLAY_WEIGHTS.some((w) => w.id === raw.weight) ? raw.weight : base.weight) as OverlayWeight,
    color: (OVERLAY_COLORS.some((c) => c.id === raw.color) ? raw.color : base.color) as OverlayColor,
    customHex: raw.customHex,
    transform: (OVERLAY_TRANSFORMS.some((t) => t.id === raw.transform) ? raw.transform : base.transform) as OverlayTransform,
    x: typeof raw.x === 'number' ? raw.x : base.x,
    y: typeof raw.y === 'number' ? raw.y : base.y,
    fontScale: typeof raw.fontScale === 'number' ? raw.fontScale : base.fontScale,
  };
}

export const SlideTextPanel: React.FC<{
  piece: ContentPiece;
  review: PieceReview;
  offerSlug: string;
  onReviewChange: (next: PieceReview) => void;
}> = ({ piece, review, offerSlug, onReviewChange }) => {
  const images = reviewImages(review);
  const slides = piece.slides ?? [];
  const frameCount = Math.max(images.length, slides.length, 1);
  const [slideIndex, setSlideIndex] = useState(0);
  const idx = clampIndex(slideIndex, frameCount);
  const [burning, setBurning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const slide = slides[idx];
  const baseImage = images[idx] ?? images[images.length - 1];
  const stored = review.slideOverlays?.[idx];
  const overlay = useMemo(
    () => asOverlay(stored, { text: slide?.text ?? piece.hook, sub: slide?.sub }),
    [stored, slide?.text, slide?.sub, piece.hook],
  );

  const { width, height } = canvasSizeForFormat(piece.format);
  const previewH = 420;
  const previewW = Math.round((previewH * width) / height);
  const primaryPx = overlayPrimaryPx(height, overlay.size, overlay.fontScale ?? 1);
  const subPx = overlaySubPx(primaryPx);
  const scale = previewH / height;
  const font = getOverlayFont(overlay.fontId);
  const fillHex = getOverlayColor(overlay);

  const patch = (p: Partial<ImageOverlay>) => {
    const next = { ...overlay, ...p };
    onReviewChange(
      withSlideOverlay(review, idx, toStoredOverlay(next) as StoredImageOverlay),
    );
  };

  const clearSlide = () => {
    onReviewChange(withoutSlideOverlay(review, idx));
  };

  const burn = async () => {
    setError(null);
    setDone(false);
    if (!baseImage) {
      setError('Add a slide image first (Edit tab or render one), then burn text onto it.');
      return;
    }
    if (!overlay.text.trim() && !overlay.sub?.trim()) {
      setError('Add some text for this slide first.');
      return;
    }
    setBurning(true);
    try {
      const dataUrl = await renderOverlayToDataUrl({
        baseImage,
        overlay,
        width,
        height,
      });
      let finalUrl = dataUrl;
      try {
        finalUrl = await aiHostImage(dataUrl);
      } catch {
        /* keep data URL */
      }
      // Replace this slide's gallery image with the burned version.
      const cur = reviewImages(review);
      const next = [...cur];
      if (idx < next.length) next[idx] = finalUrl;
      else next.push(finalUrl);
      const merged = setReviewImages(offerSlug, piece.id, next, idx);
      // Persist the recipe against the burned slide.
      const withOverlay = withSlideOverlay(merged, idx, {
        ...toStoredOverlay({ ...overlay, baseImage, renderedUrl: finalUrl }),
      } as StoredImageOverlay);
      onReviewChange(saveReview(offerSlug, piece.id, withOverlay));
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not burn text onto this slide');
    } finally {
      setBurning(false);
    }
  };

  if (frameCount < 1) {
    return (
      <p className="text-sm text-ink/55">
        This piece has no slides to put text on yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className={labelCls}>
          <Type className="mr-1 inline h-3.5 w-3.5" /> Slide text · {idx + 1} of {frameCount}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous slide"
            onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="rounded-full border border-ink/15 p-1 text-ink/60 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => setSlideIndex((i) => Math.min(frameCount - 1, i + 1))}
            disabled={idx >= frameCount - 1}
            className="rounded-full border border-ink/15 p-1 text-ink/60 disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* On-canvas preview */}
      <div
        className="relative mx-auto overflow-hidden rounded-lg bg-black"
        style={{ width: previewW, height: previewH }}
      >
        {baseImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={baseImage} alt={slide?.text ?? 'slide'} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-white/40">
            No image on this slide yet
          </div>
        )}
        {overlay.enabled !== false && (overlay.text.trim() || overlay.sub?.trim()) && (
          <div
            className="absolute"
            style={{
              left: `${(overlay.x ?? 0.5) * 100}%`,
              top: `${(overlay.y ?? 0.5) * 100}%`,
              transform: freeformCssTransform(),
              maxWidth: `${(overlay.maxWidthPct ?? 0.88) * 100}%`,
              textAlign: overlay.hAlign,
            }}
          >
            <p
              style={{
                fontFamily: font.family,
                fontWeight: getOverlayWeightCss(overlay.weight),
                fontSize: Math.max(10, Math.round(primaryPx * scale)),
                lineHeight: 1.2,
                color: fillHex,
                textShadow: '0 1px 8px rgba(0,0,0,0.5)',
              }}
            >
              {overlay.text}
            </p>
            {overlay.sub?.trim() && (
              <p
                className="mt-1"
                style={{
                  fontFamily: font.family,
                  fontWeight: 400,
                  fontSize: Math.max(9, Math.round(subPx * scale)),
                  lineHeight: 1.25,
                  color: fillHex,
                  opacity: 0.9,
                  textShadow: '0 1px 6px rgba(0,0,0,0.5)',
                }}
              >
                {overlay.sub}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Text fields */}
      <label className="block">
        <span className={labelCls}>Slide text</span>
        <textarea
          rows={2}
          value={overlay.text}
          onChange={(e) => patch({ text: e.target.value })}
          className="mt-1 w-full rounded-lg border border-ink/15 bg-white/70 p-2.5 text-sm text-ink focus:border-mode focus:outline-none"
        />
      </label>
      <label className="block">
        <span className={labelCls}>Supporting line (optional)</span>
        <input
          value={overlay.sub ?? ''}
          onChange={(e) => patch({ sub: e.target.value })}
          className="mt-1 w-full rounded-lg border border-ink/15 bg-white/70 p-2.5 text-sm text-ink focus:border-mode focus:outline-none"
        />
      </label>

      {/* Style rail */}
      <div>
        <span className={labelCls}>Font</span>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {OVERLAY_FONTS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => patch({ fontId: f.id })}
              className={`${chipBase} ${overlay.fontId === f.id ? chipOn : chipOff}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className={labelCls}>Weight</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {OVERLAY_WEIGHTS.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => patch({ weight: w.id })}
                className={`${chipBase} ${overlay.weight === w.id ? chipOn : chipOff}`}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className={labelCls}>Size</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {OVERLAY_SIZES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => patch({ size: s.id })}
                className={`${chipBase} ${overlay.size === s.id ? chipOn : chipOff}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div>
        <span className={labelCls}>Color</span>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {OVERLAY_COLORS.filter((c) => c.id !== 'custom').map((c) => (
            <button
              key={c.id}
              type="button"
              title={c.label}
              onClick={() => patch({ color: c.id })}
              className={`h-6 w-6 rounded-full border-2 ${overlay.color === c.id ? 'border-mode' : 'border-white/60'}`}
              style={{ background: c.hex }}
            />
          ))}
        </div>
      </div>
      <div>
        <span className={labelCls}>Case</span>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {OVERLAY_TRANSFORMS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => patch({ transform: t.id })}
              className={`${chipBase} ${overlay.transform === t.id ? chipOn : chipOff}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Position */}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>Horizontal · {Math.round((overlay.x ?? 0.5) * 100)}%</span>
          <input
            type="range"
            min={5}
            max={95}
            value={Math.round((overlay.x ?? 0.5) * 100)}
            onChange={(e) => patch({ x: Number(e.target.value) / 100 })}
            className="mt-1 w-full accent-mode"
          />
        </label>
        <label className="block">
          <span className={labelCls}>Vertical · {Math.round((overlay.y ?? 0.5) * 100)}%</span>
          <input
            type="range"
            min={8}
            max={92}
            value={Math.round((overlay.y ?? 0.5) * 100)}
            onChange={(e) => patch({ y: Number(e.target.value) / 100 })}
            className="mt-1 w-full accent-mode"
          />
        </label>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={burn}
          disabled={burning}
          className="inline-flex items-center gap-1.5 rounded-full bg-mode px-3.5 py-2 text-xs font-semibold text-bone hover:bg-mode-deep disabled:opacity-60"
        >
          {burning ? <Spinner /> : done ? <Check className="h-3.5 w-3.5" /> : <Wand2 className="h-3.5 w-3.5" />}
          {burning ? 'Burning…' : done ? 'Burned to slide' : 'Burn text onto slide'}
        </button>
        {stored && (
          <button
            type="button"
            onClick={clearSlide}
            className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-3 py-2 text-xs text-ink/60 hover:border-red-300 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" /> Reset
          </button>
        )}
      </div>
      <p className="text-[11px] leading-snug text-ink/45">
        Edits save per slide and preview live. Burn bakes the text onto this
        slide's image so it posts with the styled text baked in.
      </p>
    </div>
  );
};
