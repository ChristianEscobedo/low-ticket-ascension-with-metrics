'use client';

/**
 * The Thumbnail Lab sheet — per-variant thumbnails using the SAME text overlay
 * editing system as the Content Hub's image studio text tab (imageOverlay.ts).
 *
 * One background (video frame / library image / upload) + ONE ImageOverlay
 * recipe (primary line + sub line) with the full control set: font, style,
 * size, weight, color, tracking, leading, transform, shadow, bg opacity, and
 * drag-to-move freeform placement. Export burns the overlay to JPEG and ingests
 * it into the media library.
 */
import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { Copy, ImagePlus, Loader2, Sparkles, Wand2 } from 'lucide-react';
import {
  defaultOverlay,
  layoutOverlay,
  getOverlayFont,
  getOverlayWeightCss,
  getOverlayColor,
  applyOverlayTransform,
  snapPosition,
  OVERLAY_FONTS,
  OVERLAY_STYLES,
  OVERLAY_SIZES,
  OVERLAY_WEIGHTS,
  OVERLAY_COLORS,
  OVERLAY_TRANSFORMS,
  type ImageOverlay,
} from '@/lib/mothermode/content/imageOverlay';
import { aiGenerateImage, aiEditImage } from '@/components/mothermode/content/aiClient';
import type { MediaAsset } from '@/lib/mothermode/reel/mediaLibrary';

/** Canvas dims per orientation — vertical is for video thumbnails (9:16). */
const DIMS = {
  wide: { w: 1280, h: 720 },
  vertical: { w: 720, h: 1280 },
} as const;

/** Text style templates — one click fills the overlay recipe. */
const TEXT_TEMPLATES: { id: string; label: string; hint: string; recipe: Partial<ImageOverlay> }[] = [
  {
    id: 'bold-hook',
    label: 'Bold hook',
    hint: 'Huge black caps, shadow, low-left',
    recipe: { styleId: 'shadow', size: 'xl', weight: 'black', color: 'white', transform: 'uppercase', fontId: 'sans', ...snapPosition('bottom', 'left') },
  },
  {
    id: 'center-stat',
    label: 'Center stat',
    hint: 'One big line dead center, yellow on vignette',
    recipe: { styleId: 'glow', size: 'xl', weight: 'black', color: 'custom', customHex: '#ffd400', transform: 'uppercase', fontId: 'sans', ...snapPosition('middle', 'center') },
  },
  {
    id: 'question',
    label: 'Question',
    hint: 'Question top, sub-line low, scrim bands',
    recipe: { styleId: 'scrim', size: 'l', weight: 'bold', color: 'white', transform: 'none', fontId: 'serif', ...snapPosition('top', 'center') },
  },
  {
    id: 'episode',
    label: 'Episode',
    hint: 'Pill box, ink on bone, centered low',
    recipe: { styleId: 'pill', size: 'l', weight: 'black', color: 'white', transform: 'uppercase', fontId: 'rounded', ...snapPosition('bottom', 'center') },
  },
  {
    id: 'neon-pop',
    label: 'Neon pop',
    hint: 'Glow halo, condensed caps, brass accent',
    recipe: { styleId: 'glow', size: 'l', weight: 'black', color: 'brass', transform: 'uppercase', fontId: 'condensed', tracking: 0.12, ...snapPosition('middle', 'center') },
  },
  {
    id: 'minimal',
    label: 'Minimal',
    hint: 'Clean white line, no effects, low-center',
    recipe: { styleId: 'none', size: 'm', weight: 'medium', color: 'soft-white', transform: 'none', fontId: 'sans', ...snapPosition('bottom', 'center') },
  },
  {
    id: 'brass-rule',
    label: 'Brass rule',
    hint: 'Display serif with the brass underline',
    recipe: { styleId: 'brass-line', size: 'l', weight: 'bold', color: 'bone', transform: 'none', fontId: 'display', ...snapPosition('middle', 'center') },
  },
];

function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  if (!Number.isFinite(n)) return `rgba(255,255,255,${alpha})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.min(1, Math.max(0, alpha))})`;
}

/** Draw background + treatment + the overlay text block (mirrors renderOverlayToDataUrl). */
function drawAll(
  ctx: CanvasRenderingContext2D,
  bg: HTMLImageElement | null,
  overlay: ImageOverlay,
  treatment: 'none' | 'darken' | 'vignette',
  W: number,
  H: number,
) {
  ctx.clearRect(0, 0, W, H);
  // background cover-fit
  if (bg) {
    const iw = bg.naturalWidth || bg.width;
    const ih = bg.naturalHeight || bg.height;
    const scale = Math.max(W / iw, H / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(bg, (W - dw) / 2, (H - dh) / 2, dw, dh);
  } else {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#1c1a17');
    grad.addColorStop(1, '#0d0c0b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
  if (treatment === 'darken') {
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.fillRect(0, 0, W, H);
  } else if (treatment === 'vignette') {
    const g = ctx.createRadialGradient(W / 2, H / 2, H / 4, W / 2, H / 2, W * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.72)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  if (overlay.enabled === false || (!overlay.text.trim() && !overlay.sub?.trim())) return;

  const layout = layoutOverlay(ctx, overlay, W, H);
  const font = getOverlayFont(overlay.fontId);
  const weight = getOverlayWeightCss(overlay.weight);
  const fillHex = getOverlayColor(overlay);
  const textOpacity = Math.min(1, Math.max(0.15, overlay.textOpacity ?? 1));
  const bgOpacity = Math.min(1, Math.max(0.1, overlay.bgOpacity ?? 0.92));
  const shadowStrength = Math.min(1, Math.max(0, overlay.shadowStrength ?? 0.55));
  const boxed = overlay.styleId === 'pill' || overlay.styleId === 'box';

  // scrim band
  if (overlay.styleId === 'scrim') {
    const bandPad = Math.round(layout.primaryPx * 0.8);
    const top = Math.max(0, layout.blockTop - bandPad);
    const bot = Math.min(H, layout.blockTop + layout.blockHeight + bandPad);
    const grd = ctx.createLinearGradient(0, top, 0, bot);
    const bandCenter = (layout.blockTop + layout.blockHeight / 2) / H;
    if (bandCenter < 0.35) {
      grd.addColorStop(0, 'rgba(0,0,0,0.72)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
    } else if (bandCenter > 0.65) {
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(1, 'rgba(0,0,0,0.75)');
    } else {
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(0.5, 'rgba(0,0,0,0.65)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
    }
    ctx.fillStyle = grd;
    ctx.fillRect(0, top, W, bot - top);
  }
  // pill / box background
  if (boxed && (layout.primaryLines.length || layout.subLines.length)) {
    const r =
      overlay.styleId === 'pill'
        ? Math.min(24, Math.round(layout.primaryPx * 0.45))
        : Math.min(8, Math.round(layout.primaryPx * 0.12));
    ctx.fillStyle = hexToRgba('#F4F0E8', bgOpacity);
    ctx.beginPath();
    ctx.roundRect(layout.blockLeft, layout.blockTop, layout.blockWidth, layout.blockHeight, r);
    ctx.fill();
  }
  // left accent bar
  if (overlay.styleId === 'bar' && (layout.primaryLines.length || layout.subLines.length)) {
    const barW = Math.max(4, Math.round(layout.primaryPx * 0.12));
    ctx.fillStyle = '#B08D57';
    ctx.fillRect(layout.blockLeft, layout.blockTop, barW, layout.blockHeight);
  }

  ctx.textAlign = layout.align;
  ctx.textBaseline = 'top';
  let y = layout.blockTop + (boxed ? Math.round(layout.primaryPx * 0.35) : 0);
  const forceInkOnBox =
    boxed && (overlay.color === 'white' || overlay.color === 'soft-white' || overlay.color === 'bone');
  const primaryFill = forceInkOnBox ? '#1C1917' : fillHex;

  // shadow / glow
  if (overlay.styleId === 'shadow' || overlay.styleId === 'glow') {
    ctx.shadowColor =
      overlay.styleId === 'glow'
        ? hexToRgba(fillHex, 0.65 * shadowStrength)
        : `rgba(0,0,0,${0.55 * shadowStrength})`;
    ctx.shadowBlur =
      overlay.styleId === 'glow'
        ? Math.round(layout.primaryPx * 0.55 * shadowStrength)
        : Math.round(layout.primaryPx * 0.35 * shadowStrength);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = overlay.styleId === 'glow' ? 0 : Math.round(layout.primaryPx * 0.08);
  } else {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }
  if (overlay.styleId === 'outline') {
    ctx.lineWidth = Math.max(2, Math.round(layout.primaryPx * 0.08));
    ctx.strokeStyle = hexToRgba('#0a0a0a', Math.min(1, textOpacity + 0.1));
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
  }

  // primary lines
  ctx.font = `${weight} ${layout.primaryPx}px ${font.family}`;
  for (const line of layout.primaryLines) {
    if (overlay.styleId === 'outline') ctx.strokeText(line, layout.textX, y);
    ctx.fillStyle = hexToRgba(primaryFill, textOpacity);
    ctx.fillText(line, layout.textX, y);
    y += layout.lineHeight;
  }
  if (layout.primaryLines.length && layout.subLines.length) y += Math.round(layout.primaryPx * 0.35);
  // sub lines
  if (layout.subLines.length) {
    ctx.font = `400 ${layout.subPx}px ${font.family}`;
    ctx.fillStyle = hexToRgba(forceInkOnBox ? '#44403C' : fillHex, Math.min(1, textOpacity + 0.05));
    if (overlay.styleId === 'outline') ctx.lineWidth = Math.max(1.5, Math.round(layout.subPx * 0.08));
    for (const line of layout.subLines) {
      if (overlay.styleId === 'outline') ctx.strokeText(line, layout.textX, y);
      ctx.fillText(line, layout.textX, y);
      y += layout.subLineHeight;
    }
  }
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // brass underline
  if (overlay.styleId === 'brass-line' && layout.primaryLines.length) {
    ctx.fillStyle = '#B08D57';
    const lineW = Math.min(layout.blockWidth * 0.4, 220);
    ctx.fillRect(layout.textX - (layout.align === 'center' ? lineW / 2 : 0), y + 6, lineW, Math.max(3, Math.round(layout.primaryPx * 0.07)));
  }
}

export default function ThumbnailLabSheet({
  hook,
  frameUrl,
  onSaved,
  onClose,
}: {
  /** The variant's hook text (stamped onto the layout). */
  hook: string;
  /** A frame/thumbnail URL to seed the background (from the video). */
  frameUrl: string;
  /** Called with the exported thumbnail's public URL after it lands in the library. */
  onSaved: (url: string) => void;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [bgImg, setBgImg] = useState<HTMLImageElement | null>(null);
  const [bgUrl, setBgUrl] = useState(frameUrl);
  const [treatment, setTreatment] = useState<'none' | 'darken' | 'vignette'>('darken');
  const [overlay, setOverlay] = useState<ImageOverlay>(() =>
    defaultOverlay({
      text: hook,
      sub: '',
      styleId: 'shadow',
      size: 'xl',
      weight: 'black',
      transform: 'uppercase',
      ...snapPosition('bottom', 'center'),
    }),
  );
  const [library, setLibrary] = useState<MediaAsset[]>([]);
  const [libOpen, setLibOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /** Orientation: wide (16:9 feed) vs vertical (9:16 video). */
  const [vertical, setVertical] = useState(false);
  /** AI image mode: create a fresh background or edit the current one (seed + references). */
  const [aiMode, setAiMode] = useState<'create' | 'edit'>('create');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiRefs, setAiRefs] = useState<string[]>([]);
  const W = vertical ? DIMS.vertical.w : DIMS.wide.w;
  const H = vertical ? DIMS.vertical.h : DIMS.wide.h;

  // Load the background image.
  useEffect(() => {
    if (!bgUrl) {
      setBgImg(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setBgImg(img);
    img.onerror = () => setBgImg(null);
    img.src = bgUrl;
  }, [bgUrl]);

  // Load library images for the seed picker.
  useEffect(() => {
    void fetch('/api/admin/media-library?kind=image')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setLibrary(j.assets as MediaAsset[]);
      })
      .catch(() => {});
  }, []);

  // Redraw on any change.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    drawAll(ctx, bgImg, overlay, treatment, W, H);
  }, [bgImg, overlay, treatment, W, H]);

  function patch(p: Partial<ImageOverlay>) {
    setOverlay((o) => ({ ...o, ...p }));
  }

  /** AI image: generate a fresh background, or edit the current one with a seed + references. */
  async function runAiImage() {
    const prompt = aiPrompt.trim();
    if (!prompt) return;
    setAiBusy(true);
    setErr(null);
    try {
      const format = vertical ? 'reel' : 'thumbnail';
      const url =
        aiMode === 'create'
          ? await aiGenerateImage(prompt, format)
          : await aiEditImage({ prompt, seed: bgUrl, references: aiRefs.length ? aiRefs : undefined, format });
      setBgUrl(url);
      // ingest the render into the library
      void fetch('/api/admin/media-library', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'ingest',
          name: `${prompt.slice(0, 60)} (AI ${aiMode})`,
          url,
          kind: 'image',
          source: 'generated',
          tags: ['ai-image', aiMode],
        }),
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'AI image failed');
    } finally {
      setAiBusy(false);
    }
  }

  async function exportAndSave() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);
    setErr(null);
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92),
      );
      if (!blob) throw new Error('Could not render the thumbnail.');
      const mint = await fetch('/api/admin/reel-upload-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ext: 'jpg', contentType: 'image/jpeg', kind: 'image' }),
      });
      const mintJson = await mint.json();
      if (!mintJson.success) throw new Error(mintJson.error || 'Could not mint an upload URL');
      const put = await fetch(mintJson.signedUrl, {
        method: 'PUT',
        headers: { 'content-type': 'image/jpeg' },
        body: blob,
      });
      if (!put.ok) throw new Error(`Upload rejected (${put.status})`);
      const url = String(mintJson.publicUrl || '');
      if (!url) throw new Error('Upload returned no public URL');
      await fetch('/api/admin/media-library', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'ingest',
          name: `${hook.slice(0, 60) || 'Thumbnail'} (thumbnail)`,
          url,
          kind: 'image',
          source: 'thumbnail-lab',
          tags: ['thumbnail', 'variant'],
        }),
      });
      onSaved(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  }

  const colorHex = (id: string) => OVERLAY_COLORS.find((c) => c.id === id)?.hex ?? '#FFFFFF';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4" onClick={onClose}>
      <div
        className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-bone/15 bg-ink shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-bone/10 px-5 py-3">
          <ImagePlus className="h-4 w-4 text-brass" />
          <span className="text-sm font-semibold text-bone">Thumbnail Lab</span>
          <span className="truncate text-[10px] text-bone/35">{hook.slice(0, 80)}</span>
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 text-bone/40 hover:bg-bone/10 hover:text-bone">
            ✕
          </button>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-[1fr_300px]">
          {/* canvas column */}
          <div className="flex min-h-0 flex-col items-center justify-center gap-2 overflow-y-auto bg-black/60 p-5">
            {/* orientation toggle — 16:9 feed thumbnail vs 9:16 video thumbnail */}
            <div className="flex items-center gap-1 rounded-full bg-white/[0.05] p-1 ring-1 ring-inset ring-white/10">
              <button
                onClick={() => setVertical(false)}
                className={clsx(
                  'rounded-full px-3 py-1 text-[10px] font-semibold',
                  !vertical ? 'bg-brass text-ink' : 'text-bone/50 hover:text-bone/85',
                )}
              >
                16:9 feed
              </button>
              <button
                onClick={() => setVertical(true)}
                className={clsx(
                  'rounded-full px-3 py-1 text-[10px] font-semibold',
                  vertical ? 'bg-brass text-ink' : 'text-bone/50 hover:text-bone/85',
                )}
              >
                9:16 video
              </button>
            </div>
            <div className={clsx('relative w-full', vertical ? 'max-w-[420px]' : 'max-w-[760px]')}>
              <canvas
                ref={canvasRef}
                width={W}
                height={H}
                className="w-full cursor-move rounded-xl border border-bone/15 shadow-xl"
                onPointerDown={(e) => {
                  const canvas = e.currentTarget;
                  canvas.setPointerCapture(e.pointerId);
                  const move = (ev: PointerEvent) => {
                    const r = canvas.getBoundingClientRect();
                    patch({
                      x: Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)),
                      y: Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)),
                    });
                  };
                  const up = () => {
                    canvas.removeEventListener('pointermove', move);
                    canvas.removeEventListener('pointerup', up);
                  };
                  canvas.addEventListener('pointermove', move);
                  canvas.addEventListener('pointerup', up);
                }}
                title="Drag the text block"
              />
              <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-black/70 px-2 py-0.5 text-[10px] text-white/80">
                drag the text block anywhere
              </p>
            </div>
          </div>

          {/* controls column — the Content Hub text overlay system */}
          <div className="min-h-0 space-y-2.5 overflow-y-auto border-l border-bone/10 p-4">
            {/* text style templates — one click fills the recipe */}
            <div>
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-bone/40">Text templates</p>
              <div className="grid grid-cols-4 gap-1">
                {TEXT_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => patch(t.recipe)}
                    title={t.hint}
                    className="rounded-lg border border-bone/15 px-1.5 py-1.5 text-left text-[8px] font-semibold leading-3 text-bone/70 hover:border-brass/40 hover:bg-brass/5"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            {/* text */}
            <div>
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-bone/40">Text</p>
              <textarea
                value={overlay.text}
                onChange={(e) => patch({ text: e.target.value })}
                rows={2}
                placeholder="Primary line"
                className="w-full rounded-lg border border-bone/15 bg-ink px-2.5 py-1.5 text-[11px] font-semibold text-bone/90 outline-none placeholder:text-bone/25"
              />
              <input
                value={overlay.sub ?? ''}
                onChange={(e) => patch({ sub: e.target.value })}
                placeholder="Sub line (optional)"
                className="mt-1 w-full rounded-lg border border-bone/15 bg-ink px-2.5 py-1.5 text-[10px] text-bone/80 outline-none placeholder:text-bone/25"
              />
            </div>

            {/* AI image — create a fresh background or edit the current one (seed + references) */}
            <div className="rounded-xl border border-brass/25 bg-brass/[0.04] p-2">
              <p className="mb-1 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-brass/80">
                <Wand2 className="h-3 w-3" /> AI background
              </p>
              <div className="mb-1.5 flex gap-1">
                {(['create', 'edit'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setAiMode(m)}
                    className={clsx(
                      'flex-1 rounded px-1.5 py-1 text-[9px] font-semibold',
                      aiMode === m ? 'bg-brass text-ink' : 'text-bone/45 hover:bg-bone/10',
                    )}
                  >
                    {m === 'create' ? '✦ create' : '✎ edit this bg'}
                  </button>
                ))}
              </div>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                rows={2}
                placeholder={
                  aiMode === 'create'
                    ? 'Describe the background to generate…'
                    : 'Describe the edit (e.g. "blur the background more, add a warm glow")…'
                }
                className="w-full rounded-lg border border-bone/15 bg-ink px-2 py-1.5 text-[10px] text-bone/80 outline-none placeholder:text-bone/25"
              />
              {aiMode === 'edit' && library.length > 0 && (
                <div className="mt-1.5 space-y-1.5">
                  {/* SEED picker — which library image the edit starts from (sets the canvas background) */}
                  <div>
                    <p className="mb-1 text-[8px] text-bone/35">
                      edit seed — the library image the AI edits (becomes the background)
                    </p>
                    <div className="grid max-h-20 grid-cols-5 gap-1 overflow-y-auto">
                      {library.slice(0, 15).map((a) => {
                        const isSeed = bgUrl === a.url;
                        return (
                          <button
                            key={a.id}
                            onClick={() => setBgUrl(a.url)}
                            title={`${a.name} — use as the edit seed`}
                            className={clsx(
                              'overflow-hidden rounded border',
                              isSeed ? 'border-brass ring-2 ring-brass' : 'border-bone/15 hover:border-bone/40',
                            )}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={a.url} alt={a.name} className="h-8 w-full object-cover" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <p className="mb-1 text-[8px] text-bone/35">
                    reference images ({aiRefs.length} picked) — style/character seeds for the edit
                  </p>
                  <div className="grid max-h-20 grid-cols-5 gap-1 overflow-y-auto">
                    {library.slice(0, 15).map((a) => {
                      const picked = aiRefs.includes(a.url);
                      return (
                        <button
                          key={a.id}
                          onClick={() =>
                            setAiRefs((r) => (picked ? r.filter((u) => u !== a.url) : [...r, a.url].slice(0, 4))
                            )
                          }
                          title={a.name}
                          className={clsx(
                            'overflow-hidden rounded border',
                            picked ? 'border-brass ring-1 ring-brass' : 'border-bone/15 hover:border-bone/40',
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={a.url} alt={a.name} className="h-8 w-full object-cover" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <button
                onClick={() => void runAiImage()}
                disabled={aiBusy || !aiPrompt.trim() || (aiMode === 'edit' && !bgUrl)}
                className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg bg-brass px-2 py-1.5 text-[10px] font-bold text-ink hover:bg-brass/90 disabled:opacity-40"
              >
                {aiBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                {aiBusy ? 'Generating…' : aiMode === 'create' ? 'Generate background' : 'Edit background'}
              </button>
            </div>

            {/* background */}
            <div>
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-bone/40">Background</p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setLibOpen((v) => !v)}
                  className="flex-1 rounded-lg border border-bone/15 px-2 py-1.5 text-[10px] font-semibold text-bone/60 hover:bg-bone/10"
                >
                  library ({library.length})
                </button>
                <button
                  onClick={() => fileInput.current?.click()}
                  className="flex-1 rounded-lg border border-bone/15 px-2 py-1.5 text-[10px] font-semibold text-bone/60 hover:bg-bone/10"
                >
                  upload
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) setBgUrl(URL.createObjectURL(f));
                  }}
                />
              </div>
              {libOpen && (
                <div className="mt-1.5 grid max-h-32 grid-cols-3 gap-1 overflow-y-auto rounded-lg border border-bone/10 bg-ink/60 p-1.5">
                  {library.length === 0 ? (
                    <p className="col-span-3 px-1 py-2 text-[9px] text-bone/30">
                      No images in the library yet — Thumbnail Lab exports land here.
                    </p>
                  ) : (
                    library.slice(0, 30).map((a) => (
                      <button
                        key={a.id}
                        onClick={() => {
                          setBgUrl(a.url);
                          setLibOpen(false);
                        }}
                        title={a.name}
                        className="overflow-hidden rounded border border-bone/15 hover:border-brass"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a.url} alt={a.name} className="h-10 w-full object-cover" />
                      </button>
                    ))
                  )}
                </div>
              )}
              <div className="mt-1.5 flex gap-1">
                {(['none', 'darken', 'vignette'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTreatment(t)}
                    className={clsx(
                      'flex-1 rounded px-1.5 py-1 text-[9px] font-semibold',
                      treatment === t ? 'bg-brass text-ink' : 'text-bone/45 hover:bg-bone/10',
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* style + font */}
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-bone/40">Style</p>
                <select
                  value={overlay.styleId}
                  onChange={(e) => patch({ styleId: e.target.value as ImageOverlay['styleId'] })}
                  className="w-full rounded-lg border border-bone/15 bg-ink px-2 py-1.5 text-[10px] text-bone/80"
                >
                  {OVERLAY_STYLES.map((s) => (
                    <option key={s.id} value={s.id} title={s.hint}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-bone/40">Font</p>
                <select
                  value={overlay.fontId}
                  onChange={(e) => patch({ fontId: e.target.value as ImageOverlay['fontId'] })}
                  className="w-full rounded-lg border border-bone/15 bg-ink px-2 py-1.5 text-[10px] text-bone/80"
                >
                  {OVERLAY_FONTS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* size + weight + transform */}
            <div>
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-bone/40">Size · weight · case</p>
              <div className="flex gap-1">
                {OVERLAY_SIZES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => patch({ size: s.id })}
                    className={clsx(
                      'flex-1 rounded px-1.5 py-1 text-[10px] font-bold',
                      overlay.size === s.id ? 'bg-brass text-ink' : 'text-bone/45 hover:bg-bone/10',
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="mt-1 flex gap-1">
                {OVERLAY_WEIGHTS.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => patch({ weight: w.id })}
                    className={clsx(
                      'flex-1 rounded px-1 py-1 text-[9px]',
                      overlay.weight === w.id ? 'bg-brass text-ink' : 'text-bone/45 hover:bg-bone/10',
                    )}
                    style={{ fontWeight: w.css }}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
              <div className="mt-1 flex gap-1">
                {OVERLAY_TRANSFORMS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => patch({ transform: t.id })}
                    className={clsx(
                      'flex-1 rounded px-1.5 py-1 text-[10px] font-semibold',
                      overlay.transform === t.id ? 'bg-brass text-ink' : 'text-bone/45 hover:bg-bone/10',
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* color */}
            <div>
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-bone/40">Color</p>
              <div className="flex flex-wrap gap-1">
                {OVERLAY_COLORS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => patch({ color: c.id })}
                    title={c.label}
                    className={clsx(
                      'h-6 w-6 rounded-md border',
                      overlay.color === c.id ? 'border-brass ring-1 ring-brass' : 'border-bone/20 hover:border-bone/50',
                    )}
                    style={{ backgroundColor: colorHex(c.id) }}
                  />
                ))}
                <input
                  type="color"
                  value={overlay.customHex ?? '#ffffff'}
                  onChange={(e) => patch({ color: 'custom', customHex: e.target.value })}
                  className="h-6 w-8 cursor-pointer rounded-md border border-bone/20 bg-transparent"
                  title="Custom color"
                />
              </div>
            </div>

            {/* snap + sliders */}
            <div>
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-bone/40">Position (snap or drag)</p>
              <div className="grid grid-cols-3 gap-1">
                {(['top', 'middle', 'bottom'] as const).map((v) =>
                  (['left', 'center', 'right'] as const).map((h) => (
                    <button
                      key={`${v}-${h}`}
                      onClick={() => patch(snapPosition(v, h))}
                      className="rounded border border-bone/15 px-1 py-1 text-[8px] font-semibold text-bone/50 hover:border-brass/40 hover:bg-brass/5"
                    >
                      {v.slice(0, 1).toUpperCase()}
                      {h.slice(0, 1).toUpperCase()}
                    </button>
                  )),
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-[9px] text-bone/45">
                scale
                <input
                  type="range"
                  min={0.7}
                  max={1.4}
                  step={0.05}
                  value={overlay.fontScale ?? 1}
                  onChange={(e) => patch({ fontScale: Number(e.target.value) })}
                  className="min-w-0 flex-1 accent-brass"
                />
                <span className="w-8 text-right">{(overlay.fontScale ?? 1).toFixed(2)}×</span>
              </label>
              <label className="flex items-center gap-2 text-[9px] text-bone/45">
                tracking
                <input
                  type="range"
                  min={-0.05}
                  max={0.2}
                  step={0.01}
                  value={overlay.tracking ?? 0}
                  onChange={(e) => patch({ tracking: Number(e.target.value) })}
                  className="min-w-0 flex-1 accent-brass"
                />
                <span className="w-8 text-right">{(overlay.tracking ?? 0).toFixed(2)}</span>
              </label>
              <label className="flex items-center gap-2 text-[9px] text-bone/45">
                leading
                <input
                  type="range"
                  min={1.0}
                  max={1.6}
                  step={0.05}
                  value={overlay.leading ?? 1.2}
                  onChange={(e) => patch({ leading: Number(e.target.value) })}
                  className="min-w-0 flex-1 accent-brass"
                />
                <span className="w-8 text-right">{(overlay.leading ?? 1.2).toFixed(2)}</span>
              </label>
              <label className="flex items-center gap-2 text-[9px] text-bone/45">
                max width
                <input
                  type="range"
                  min={0.4}
                  max={0.94}
                  step={0.02}
                  value={overlay.maxWidthPct ?? 0.88}
                  onChange={(e) => patch({ maxWidthPct: Number(e.target.value) })}
                  className="min-w-0 flex-1 accent-brass"
                />
                <span className="w-8 text-right">{Math.round((overlay.maxWidthPct ?? 0.88) * 100)}%</span>
              </label>
              <label className="flex items-center gap-2 text-[9px] text-bone/45">
                shadow
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={overlay.shadowStrength ?? 0.55}
                  onChange={(e) => patch({ shadowStrength: Number(e.target.value) })}
                  className="min-w-0 flex-1 accent-brass"
                />
                <span className="w-8 text-right">{Math.round((overlay.shadowStrength ?? 0.55) * 100)}%</span>
              </label>
            </div>

            {err && <p className="text-[10px] text-red-300">{err}</p>}
            <button
              onClick={() => void exportAndSave()}
              disabled={busy}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brass px-3 py-2.5 text-xs font-bold text-ink hover:bg-brass/90 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {busy ? 'Exporting…' : 'Export to library + use it'}
            </button>
            <button
              onClick={() => {
                canvasRef.current?.toBlob((b) => {
                  if (!b) return;
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(b);
                  a.download = `${hook.slice(0, 40).replace(/\W+/g, '-') || 'thumbnail'}.jpg`;
                  a.click();
                }, 'image/jpeg', 0.92);
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-bone/15 px-3 py-2 text-[10px] font-semibold text-bone/60 hover:bg-bone/10"
            >
              <Copy className="h-3 w-3" /> Download JPEG
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
