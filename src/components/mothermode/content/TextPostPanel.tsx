'use client';

/**
 * Composer for a text overlay post: pick the brand background and surface
 * aspect (vertical for reel/slide/story, square for feed), watch the big-text
 * block update live with the native auto-scale, then render a shareable PNG
 * to the review gallery.
 */
import React, { useState } from 'react';
import { Check, Download, Type } from 'lucide-react';
import {
  COLOR_BLOCK_SWATCHES,
  DEFAULT_TWEET_HANDLE,
  TEXT_POST_MAX_CHARS,
  fitsTextPost,
  renderTextPostToDataUrl,
  textPostBackground,
  textPostFontScale,
  textPostStyleFor,
  textPostTextColor,
  type ContentPiece,
  type TextPostStyle,
} from '@/lib/mothermode/content';
import { setReviewImages } from './reviewClient';
import { aiHostImage } from './aiClient';
import { Spinner } from './AiControls';
import type { PieceReview } from '@/lib/mothermode/content/review';

const labelCls = 'text-[11px] uppercase tracking-[0.16em] text-ink/45';

export const TextPostPanel: React.FC<{
  piece: ContentPiece;
  review: PieceReview;
  offerSlug: string;
  /** Active hook text shown on the block (catalog + edits resolved). */
  hook: string;
  onReviewChange: (next: PieceReview) => void;
}> = ({ piece, review, offerSlug, hook, onReviewChange }) => {
  const [style, setStyle] = useState<TextPostStyle>(() => textPostStyleFor(piece));
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const scale = textPostFontScale(hook, style);
  const overLimit = !fitsTextPost(hook);
  const vertical = (style.aspect ?? '1:1') === '9:16';

  const render = async () => {
    setError(null);
    setDone(false);
    setRendering(true);
    try {
      const dataUrl = await renderTextPostToDataUrl({ text: hook, style });
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
      setError(e instanceof Error ? e.message : 'Could not render the overlay');
    } finally {
      setRendering(false);
    }
  };

  return (
    <div className="space-y-3">
      <span className={labelCls}>
        <Type className="mr-1 inline h-3.5 w-3.5" /> Text overlay background
      </span>

      {/* Live block preview (matches the native surface). */}
      <div
        className={`flex w-full items-center justify-center rounded-lg px-6 text-center ${
          vertical ? 'aspect-[9/16] max-w-[200px]' : 'aspect-square max-w-[300px]'
        }`}
        style={{ background: textPostBackground(style) }}
      >
        <p
          className="font-extrabold leading-tight"
          style={{ color: textPostTextColor(style), fontSize: `${1.4 * scale}rem` }}
        >
          {hook}
        </p>
      </div>

      {overLimit && (
        <p className="text-xs text-amber-700">
          Over ~{TEXT_POST_MAX_CHARS} characters the overlay reads long. The rendered
          image still works; the caption can carry the rest.
        </p>
      )}

      {/* Swatches */}
      <div className="flex flex-wrap gap-2">
        {COLOR_BLOCK_SWATCHES.map((s) => {
          const active =
            s.bg === style.bg && (s.gradient?.join() ?? '') === (style.gradient?.join() ?? '');
          return (
            <button
              key={s.id}
              type="button"
              title={s.label}
              onClick={() => setStyle({ ...style, bg: s.bg, gradient: s.gradient })}
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

      <div className="flex flex-wrap items-center gap-3">
        <label className="block">
          <span className={labelCls}>Surface</span>
          <select
            value={style.aspect ?? '1:1'}
            onChange={(e) =>
              setStyle({ ...style, aspect: e.target.value as '9:16' | '1:1' })
            }
            className="mt-1 rounded-md border border-ink/15 bg-white px-2 py-1 text-xs"
          >
            <option value="1:1">Feed square (1:1)</option>
            <option value="9:16">Reel / slide / story (9:16)</option>
          </select>
        </label>

        <label className="mt-4 flex items-center gap-1.5 text-xs text-ink/60">
          <input
            type="checkbox"
            checked={style.showHandle !== false}
            onChange={(e) => setStyle({ ...style, showHandle: e.target.checked })}
            className="accent-mode"
          />
          {DEFAULT_TWEET_HANDLE} watermark
        </label>
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

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="button"
        onClick={render}
        disabled={rendering}
        className="inline-flex items-center gap-1.5 rounded-full bg-mode px-3.5 py-2 text-xs font-semibold text-bone hover:bg-mode-deep disabled:opacity-60"
      >
        {rendering ? <Spinner /> : done ? <Check className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
        {rendering
          ? 'Rendering…'
          : done
            ? 'Added to gallery'
            : `Render as image (${vertical ? '1080×1920' : '1080×1080'})`}
      </button>
      <p className="text-[11px] leading-snug text-ink/45">
        The overlay renders natively, no image model needed. Render the PNG for
        schedulers, or let it stand as the post itself.
      </p>
    </div>
  );
};
