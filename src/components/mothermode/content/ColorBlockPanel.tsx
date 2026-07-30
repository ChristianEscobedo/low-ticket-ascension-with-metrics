'use client';

/**
 * Composer for a Facebook color-block post: pick the brand background, watch
 * the big-text block update live (scaled the way FB scales it natively), then
 * render a shareable square PNG to the review gallery for schedulers that
 * cannot post the native text-only unit.
 */
import React, { useState } from 'react';
import { Check, Download, Palette } from 'lucide-react';
import {
  COLOR_BLOCK_SWATCHES,
  colorBlockBackground,
  colorBlockFontScale,
  colorBlockStyleFor,
  colorBlockTextColor,
  fitsColorBlock,
  renderColorBlockToDataUrl,
  type ColorBlockStyle,
  type ContentPiece,
} from '@/lib/mothermode/content';
import { reviewHooks, type PieceReview } from '@/lib/mothermode/content/review';
import { setReviewImages } from './reviewClient';
import { aiHostImage } from './aiClient';
import { Spinner } from './AiControls';

const labelCls = 'text-[11px] uppercase tracking-[0.16em] text-ink/45';

export const ColorBlockPanel: React.FC<{
  piece: ContentPiece;
  review: PieceReview;
  offerSlug: string;
  /** Active hook text shown on the block (catalog + edits resolved). */
  hook: string;
  onReviewChange: (next: PieceReview) => void;
}> = ({ piece, review, offerSlug, hook, onReviewChange }) => {
  const [style, setStyle] = useState<ColorBlockStyle>(() => colorBlockStyleFor(piece));
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const scale = colorBlockFontScale(hook, style);
  const overLimit = !fitsColorBlock(hook);
  const editedHooks = reviewHooks(review.edits);

  const render = async () => {
    setError(null);
    setDone(false);
    setRendering(true);
    try {
      const dataUrl = await renderColorBlockToDataUrl({ text: hook, style, size: 1080 });
      let finalUrl = dataUrl;
      try {
        finalUrl = await aiHostImage(dataUrl);
      } catch {
        /* keep data URL */
      }
      const merged = setReviewImages(offerSlug, piece.id, [finalUrl], 0);
      onReviewChange(merged);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not render the color block');
    } finally {
      setRendering(false);
    }
  };

  return (
    <div className="space-y-3">
      <span className={labelCls}>
        <Palette className="mr-1 inline h-3.5 w-3.5" /> Color block background
      </span>

      {/* Live block preview (matches the FB surface). */}
      <div
        className="flex aspect-square w-full max-w-[300px] items-center justify-center rounded-lg px-6 text-center"
        style={{ background: colorBlockBackground(style) }}
      >
        <p
          className="font-bold leading-tight"
          style={{ color: colorBlockTextColor(style), fontSize: `${1.4 * scale}rem` }}
        >
          {hook}
        </p>
      </div>

      {overLimit && (
        <p className="text-xs text-amber-700">
          Over ~130 characters, Facebook shows this as a normal text post instead
          of the big-text block. The rendered image still works.
        </p>
      )}

      {/* Swatches */}
      <div className="flex flex-wrap gap-2">
        {COLOR_BLOCK_SWATCHES.map((s) => {
          const active = s.bg === style.bg && (s.gradient?.join() ?? '') === (style.gradient?.join() ?? '');
          return (
            <button
              key={s.id}
              type="button"
              title={s.label}
              onClick={() => setStyle({ bg: s.bg, gradient: s.gradient, fontScale: style.fontScale })}
              className={`h-9 w-9 rounded-full border-2 ${active ? 'border-mode ring-2 ring-mode/30' : 'border-white/70'}`}
              style={{
                background:
                  s.gradient && s.gradient.length >= 2
                    ? `linear-gradient(160deg, ${s.gradient.join(', ')})`
                    : s.bg,
              }}
            />
          );
        })}
      </div>

      <label className="block">
        <span className={labelCls}>Text size · {Math.round((style.fontScale ?? 1) * 100)}%</span>
        <input
          type="range"
          min={80}
          max={140}
          value={Math.round((style.fontScale ?? 1) * 100)}
          onChange={(e) => setStyle({ ...style, fontScale: Number(e.target.value) / 100 })}
          className="mt-1 w-full accent-mode"
        />
      </label>

      {editedHooks.length > 1 && (
        <p className="text-[11px] text-ink/45">
          The block uses the active hook variant. Switch variants above the preview
          to restyle a different opener.
        </p>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="button"
        onClick={render}
        disabled={rendering}
        className="inline-flex items-center gap-1.5 rounded-full bg-mode px-3.5 py-2 text-xs font-semibold text-bone hover:bg-mode-deep disabled:opacity-60"
      >
        {rendering ? <Spinner /> : done ? <Check className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
        {rendering ? 'Rendering…' : done ? 'Added to gallery' : 'Render as image (1080×1080)'}
      </button>
      <p className="text-[11px] leading-snug text-ink/45">
        Facebook posts the native text-only block itself. Render an image when you
        need a version for a scheduler or another platform.
      </p>
    </div>
  );
};
