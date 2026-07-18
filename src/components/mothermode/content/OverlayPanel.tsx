'use client';

/**
 * Text-on-image overlay compose rail for Image Studio.
 * Edit text, font, style, position → live CSS preview → burn-in PNG to gallery.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Type, Sparkles, Download } from 'lucide-react';
import {
  OVERLAY_COLORS,
  OVERLAY_FONTS,
  OVERLAY_SIZES,
  OVERLAY_STYLES,
  canvasSizeForFormat,
  defaultOverlay,
  getOverlayFont,
  renderOverlayToDataUrl,
  suggestOverlayText,
  type ContentPiece,
  type ImageOverlay,
  type OverlayColor,
  type OverlayFontId,
  type OverlayHAlign,
  type OverlaySize,
  type OverlayStyleId,
  type OverlayVAlign,
  type OverlayWeight,
} from '@/lib/mothermode/content';
import type { PieceReview } from '@/lib/mothermode/content/review';
import { AiError, Spinner, aiBtnGhost, aiBtnSolid } from './AiControls';

/** Match Image Studio crop classes without importing the modal (cycle). */
function formatAspect(format: string): string {
  if (['story', 'reel', 'idea', 'short'].includes(format)) return 'aspect-[9/16]';
  if (format === 'pin') return 'aspect-[2/3]';
  if (['blog', 'article', 'answer'].includes(format)) return 'aspect-[16/9]';
  return 'aspect-square';
}

const labelCls = 'text-[11px] uppercase tracking-[0.16em] text-ink/45';
const chipBase =
  'rounded-full border px-2.5 py-1 text-[11px] transition-colors';
const chipOn = 'border-mode/40 bg-mode/10 font-semibold text-mode';
const chipOff = 'border-ink/15 text-ink/60 hover:border-ink/30 hover:text-ink/80';

function asOverlay(raw: PieceReview['overlay'] | undefined): ImageOverlay {
  if (!raw) return defaultOverlay();
  return defaultOverlay({
    text: raw.text ?? '',
    sub: raw.sub ?? '',
    fontId: (raw.fontId as OverlayFontId) || 'sans',
    styleId: (raw.styleId as OverlayStyleId) || 'shadow',
    size: (raw.size as OverlaySize) || 'l',
    weight: (raw.weight as OverlayWeight) || 'bold',
    color: (raw.color as OverlayColor) || 'white',
    vAlign: (raw.vAlign as OverlayVAlign) || 'bottom',
    hAlign: (raw.hAlign as OverlayHAlign) || 'center',
    baseImage: raw.baseImage,
    renderedUrl: raw.renderedUrl,
    updatedAt: raw.updatedAt,
  });
}

const POSITIONS: { v: OverlayVAlign; h: OverlayHAlign; label: string }[] = [
  { v: 'top', h: 'left', label: '↖' },
  { v: 'top', h: 'center', label: '↑' },
  { v: 'top', h: 'right', label: '↗' },
  { v: 'middle', h: 'left', label: '←' },
  { v: 'middle', h: 'center', label: '·' },
  { v: 'middle', h: 'right', label: '→' },
  { v: 'bottom', h: 'left', label: '↙' },
  { v: 'bottom', h: 'center', label: '↓' },
  { v: 'bottom', h: 'right', label: '↘' },
];

export const OverlayPanel: React.FC<{
  piece: ContentPiece;
  review: PieceReview;
  images: string[];
  activeImage?: string | null;
  seed: string | null;
  onSeedChange: (url: string | null) => void;
  onAddImages: (urls: string[]) => void;
  onReviewChange?: (next: PieceReview) => void;
}> = ({
  piece,
  review,
  images,
  activeImage,
  seed,
  onSeedChange,
  onAddImages,
  onReviewChange,
}) => {
  const [overlay, setOverlay] = useState<ImageOverlay>(() =>
    asOverlay(review.overlay),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base =
    seed ||
    activeImage ||
    images[0] ||
    overlay.baseImage ||
    null;
  const aspect = formatAspect(piece.format);
  const exportSize = useMemo(
    () => canvasSizeForFormat(piece.format),
    [piece.format],
  );
  const font = getOverlayFont(overlay.fontId);

  // Hydrate from saved recipe when piece/review changes; prefill text if empty.
  useEffect(() => {
    const saved = asOverlay(review.overlay);
    if (saved.text.trim() || saved.sub?.trim()) {
      setOverlay(saved);
      if (saved.baseImage) onSeedChange(saved.baseImage);
      return;
    }
    const sug = suggestOverlayText(piece, review);
    setOverlay(
      defaultOverlay({
        ...saved,
        text: sug.text,
        sub: sug.sub,
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piece.id]);

  // Default seed to active gallery image when opening Text tab.
  useEffect(() => {
    if (!seed && (activeImage || images[0])) {
      onSeedChange(activeImage || images[0] || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeImage, images.length]);

  function patch(p: Partial<ImageOverlay>) {
    setOverlay((o) => ({ ...o, ...p }));
    setError(null);
  }

  function prefill() {
    const sug = suggestOverlayText(piece, review);
    patch({ text: sug.text, sub: sug.sub });
  }

  function persistRecipe(next: ImageOverlay) {
    if (!onReviewChange) return;
    onReviewChange({
      ...review,
      overlay: {
        text: next.text,
        sub: next.sub,
        fontId: next.fontId,
        styleId: next.styleId,
        size: next.size,
        weight: next.weight,
        color: next.color,
        vAlign: next.vAlign,
        hAlign: next.hAlign,
        baseImage: next.baseImage,
        renderedUrl: next.renderedUrl,
        updatedAt: next.updatedAt,
      },
    });
  }

  async function render() {
    if (!base) {
      setError('Pick a base image from the gallery first');
      return;
    }
    if (!overlay.text.trim() && !overlay.sub?.trim()) {
      setError('Add primary or sub text');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await renderOverlayToDataUrl({
        baseImage: base,
        overlay,
        width: exportSize.width,
        height: exportSize.height,
      });
      const next: ImageOverlay = {
        ...overlay,
        baseImage: base,
        renderedUrl: dataUrl,
        updatedAt: new Date().toISOString(),
      };
      setOverlay(next);
      onAddImages([dataUrl]);
      persistRecipe(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Render failed');
    } finally {
      setBusy(false);
    }
  }

  const previewColor =
    overlay.styleId === 'pill' && overlay.color === 'white'
      ? '#1C1917'
      : OVERLAY_COLORS.find((c) => c.id === overlay.color)?.hex ?? '#fff';

  const previewAlign =
    overlay.hAlign === 'left'
      ? 'left'
      : overlay.hAlign === 'right'
        ? 'right'
        : 'center';

  const previewJustify =
    overlay.vAlign === 'top'
      ? 'flex-start'
      : overlay.vAlign === 'middle'
        ? 'center'
        : 'flex-end';

  return (
    <div className="flex flex-col gap-3">
      <div>
        <span className={labelCls}>Base image</span>
        {images.length === 0 ? (
          <p className="mt-1.5 text-xs text-ink/50">
            Generate or upload an image first, then come back to Text.
          </p>
        ) : (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {images.slice(0, 8).map((src, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSeedChange(src)}
                className={`h-12 w-12 overflow-hidden rounded-lg border-2 ${
                  base === src ? 'border-mode' : 'border-ink/15'
                }`}
                title={`Use image ${i + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <span className={labelCls}>Primary text</span>
          <button
            type="button"
            onClick={prefill}
            className="inline-flex items-center gap-1 text-[11px] text-mode hover:underline"
          >
            <Sparkles className="h-3 w-3" /> Prefill
          </button>
        </div>
        <textarea
          rows={3}
          value={overlay.text}
          onChange={(e) => patch({ text: e.target.value })}
          placeholder="On-screen line…"
          className="mt-1.5 w-full rounded-lg border border-ink/15 bg-white/70 p-2.5 text-sm text-ink placeholder:text-ink/35 focus:border-mode focus:outline-none"
        />
      </div>

      <div>
        <span className={labelCls}>Sub text (optional)</span>
        <input
          type="text"
          value={overlay.sub ?? ''}
          onChange={(e) => patch({ sub: e.target.value })}
          placeholder="Smaller second line"
          className="mt-1.5 w-full rounded-lg border border-ink/15 bg-white/70 px-2.5 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-mode focus:outline-none"
        />
      </div>

      <div>
        <span className={labelCls}>Font</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {OVERLAY_FONTS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => patch({ fontId: f.id })}
              className={`${chipBase} ${overlay.fontId === f.id ? chipOn : chipOff}`}
              style={{ fontFamily: f.family }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className={labelCls}>Weight</span>
        <div className="flex gap-1">
          {(['regular', 'bold'] as OverlayWeight[]).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => patch({ weight: w })}
              className={`${chipBase} ${overlay.weight === w ? chipOn : chipOff}`}
            >
              {w === 'bold' ? 'Bold' : 'Regular'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className={labelCls}>Size</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
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

      <div>
        <span className={labelCls}>Style</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {OVERLAY_STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => patch({ styleId: s.id })}
              title={s.hint}
              className={`${chipBase} ${overlay.styleId === s.id ? chipOn : chipOff}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className={labelCls}>Color</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {OVERLAY_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => patch({ color: c.id })}
              className={`flex items-center gap-1.5 ${chipBase} ${
                overlay.color === c.id ? chipOn : chipOff
              }`}
            >
              <span
                className="h-3 w-3 rounded-full border border-ink/20"
                style={{ background: c.hex }}
              />
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className={labelCls}>Position</span>
        <div className="mt-1.5 grid grid-cols-3 gap-1">
          {POSITIONS.map((p) => {
            const on = overlay.vAlign === p.v && overlay.hAlign === p.h;
            return (
              <button
                key={`${p.v}-${p.h}`}
                type="button"
                onClick={() => patch({ vAlign: p.v, hAlign: p.h })}
                className={`rounded-md border py-1.5 text-sm ${
                  on
                    ? 'border-mode bg-mode/10 font-semibold text-mode'
                    : 'border-ink/15 text-ink/55 hover:border-ink/30'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Live CSS preview (approximate; final burn-in uses canvas) */}
      <div>
        <span className={labelCls}>Preview</span>
        <div
          className={`relative mt-1.5 w-full overflow-hidden rounded-xl border border-ink/15 bg-ink ${aspect}`}
        >
          {base ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={base}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-bone/40">
              No base image
            </div>
          )}
          {overlay.styleId === 'scrim' && (
            <div
              className="pointer-events-none absolute inset-x-0"
              style={{
                top:
                  overlay.vAlign === 'middle'
                    ? '30%'
                    : overlay.vAlign === 'top'
                      ? 0
                      : undefined,
                bottom: overlay.vAlign === 'bottom' ? 0 : undefined,
                height: overlay.vAlign === 'middle' ? '40%' : '38%',
                background:
                  overlay.vAlign === 'top'
                    ? 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)'
                    : overlay.vAlign === 'middle'
                      ? 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.65), transparent)'
                      : 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)',
              }}
            />
          )}
          <div
            className="absolute inset-0 flex p-[6%]"
            style={{
              alignItems: previewJustify,
              justifyContent:
                overlay.hAlign === 'left'
                  ? 'flex-start'
                  : overlay.hAlign === 'right'
                    ? 'flex-end'
                    : 'center',
            }}
          >
            <div
              className="max-w-full"
              style={{
                textAlign: previewAlign,
                fontFamily: font.family,
                fontWeight: overlay.weight === 'bold' ? 700 : 400,
                color: previewColor,
                textShadow:
                  overlay.styleId === 'shadow'
                    ? '0 2px 8px rgba(0,0,0,0.55)'
                    : undefined,
                background:
                  overlay.styleId === 'pill'
                    ? 'rgba(244, 240, 232, 0.92)'
                    : undefined,
                borderRadius: overlay.styleId === 'pill' ? 12 : undefined,
                padding: overlay.styleId === 'pill' ? '10px 14px' : undefined,
              }}
            >
              {overlay.text ? (
                <div
                  className="text-[13px] leading-snug sm:text-sm"
                  style={{
                    fontSize:
                      overlay.size === 's'
                        ? 11
                        : overlay.size === 'm'
                          ? 13
                          : overlay.size === 'xl'
                            ? 17
                            : 15,
                  }}
                >
                  {overlay.text}
                </div>
              ) : null}
              {overlay.styleId === 'brass-line' && overlay.text ? (
                <div
                  className="mx-auto mt-1 h-0.5 w-10 rounded-full"
                  style={{
                    background: '#B08D57',
                    marginLeft:
                      overlay.hAlign === 'left'
                        ? 0
                        : overlay.hAlign === 'right'
                          ? 'auto'
                          : undefined,
                    marginRight:
                      overlay.hAlign === 'right'
                        ? 0
                        : overlay.hAlign === 'left'
                          ? 'auto'
                          : undefined,
                  }}
                />
              ) : null}
              {overlay.sub ? (
                <div
                  className="mt-1 text-[10px] leading-snug opacity-90 sm:text-[11px]"
                  style={{
                    fontWeight: 400,
                    color:
                      overlay.styleId === 'pill'
                        ? 'rgba(28,25,23,0.75)'
                        : previewColor,
                  }}
                >
                  {overlay.sub}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <p className="mt-1 text-[10px] text-ink/40">
          Export {exportSize.width}×{exportSize.height} · approximate live
          preview
        </p>
      </div>

      <button
        type="button"
        onClick={() => void render()}
        disabled={busy || !base}
        className={`${aiBtnSolid} justify-center`}
      >
        {busy ? <Spinner /> : <Type className="h-3.5 w-3.5" />}
        {busy ? 'Rendering…' : 'Render to gallery'}
      </button>
      <button
        type="button"
        onClick={() => persistRecipe(overlay)}
        disabled={!onReviewChange}
        className={`${aiBtnGhost} justify-center`}
      >
        Save recipe
      </button>
      {overlay.renderedUrl ? (
        <a
          href={overlay.renderedUrl}
          download="overlay.png"
          className={`${aiBtnGhost} justify-center`}
        >
          <Download className="h-3.5 w-3.5" /> Download last render
        </a>
      ) : null}
      <p className="-mt-1 text-[11px] text-ink/40">
        Burns text onto the image as PNG. Recipe stays editable.
      </p>
      <AiError message={error} />
    </div>
  );
};
