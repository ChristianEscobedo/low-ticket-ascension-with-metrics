'use client';

/**
 * /admin/reel-studio — fullscreen light video editor (no admin chrome; see
 * (fullscreen)/layout.tsx).
 *
 * Layout follows the simple-editor pattern the user pointed at:
 *   left  → tool tabs: Clips (the scenes list), Audio, B-roll
 *   right — big preview player with the proportional timeline strip under it
 * The strip is the clipping surface: drag blocks to reorder, drag a block's
 * right edge to cut, the preview scrubs to the exact cut frame live.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { clsx } from 'clsx';

// The TRUE render preview — the same ReelComposition + buildRenderPlan the
// Remotion Lambda renderer uses. Browser-only, so load it client-side.
const RemotionPreview = dynamic(() => import('./RemotionPreview'), { ssr: false });

// The SAME font resolver the render plan uses. Two resolvers = two things that
// drift, which is exactly how the burned MP4 ended up on a different typeface
// than this preview. See docs/CAPTION_FONT_MISSING_IN_RENDER_FINDING.md.
import { captionFontsFor } from '@/lib/mothermode/reel/captionFonts';

// THE caption layer — the same component the render worker draws the MP4 with.
// The stage renders this, not a look-alike. See StageCaptions below.
import {
  CaptionLayerFrame,
  type CaptionPlanLike,
} from '@/lib/mothermode/reel/render/captionLayer';
import { DEFAULT_FPS } from '@/lib/mothermode/reel/render/plan';


import {
  ArrowLeft,
  ArrowLeftCircle,
  ArrowRight,
  Check,
  Clapperboard,
  Copy,
  Film,
  FileText,
  GitFork,
  Layers,
  Library,
  LayoutList,
  Loader2,

  Mic,
  Music,
  Pause,
  Play,
  Plus,
  Scissors,
  SkipBack,
  SkipForward,
  Sparkles,
  Trash2,
  Trophy,
  Undo2,
  Redo2,
  Upload,
  VolumeX,
  Zap,
} from 'lucide-react';

import type {
  ReelProject,
  ReelClip,
  ReelAudioTrack,
  ReelWord,
  CaptionPreset,
} from '@/lib/mothermode/reel/types';
import { scoreHook } from '@/lib/mothermode/reel/hookScore';
import {
  findSilenceGaps,
  gapTotalSec,
  keptSegments,
  remapWordsForSegment,
} from '@/lib/mothermode/reel/silence';
import {
  CAPTION_PRESETS,
  CAPTION_SIZE_DEFAULT,
  CAPTION_STYLE_DEFS,
  captionAnimCss,
  captionAnimKeyframes,
  captionCssFor,
  captionDefFor,
  captionLayoutFor,
  captionRows,
  emojiFor,
  isPowerWord,
  resolveCaptionStyle,
  type CaptionOverrides,
  type CaptionStyleDef,
} from '@/lib/mothermode/reel/captions';
import { spriteCellStyle } from '@/lib/mothermode/reel/sceneCuts';
import { CaptionGallery } from './CaptionGallery';
import { SubtitlePanel } from './SubtitlePanel';
import ScriptLabPanel from './ScriptLabPanel';
import { transcriptForProject } from '@/lib/mothermode/reel/scriptLab';
import { useCaptionEdit, timelineStartOf } from './useCaptionEdit';
import { CaptionEditSurface, CaptionWordContextMenu } from './CaptionEditSurface';
import ThumbnailLabSheet from './ThumbnailLabSheet';
import RenderPanel from './RenderPanel';
import RenderButton from './RenderButton';
import { useRenderJob, keepWorkerWarm, type RenderJob } from './useRenderJob';

import type { ContentPiece } from '@/lib/mothermode/content/types';
import { RichTextField } from '@/components/mothermode/content/RichTextField';
import { aiRewriteText, aiAmplify, aiGenerateImage } from '@/components/mothermode/content/aiClient';
import { listGenerated } from '@/components/mothermode/content/generatedClient';
import {
  applyBookends,
  insertHookAt,
  winStars,
  type VaultAsset,
  type VaultKind,
} from '@/lib/mothermode/reel/vault';

import { PersonStanding, Wand2 } from 'lucide-react';
import ClonePanel from './ClonePanel';
import {
  cloneLibraryEntries,
  isTwinReel,
  type CloneBeat,
  type ClonePlan,
} from '@/lib/mothermode/reel/clone';
import { cloneSceneName } from '@/lib/mothermode/reel/cloneGenerate';
import type { GiphySticker } from '@/utils/integrations/giphy';
import type { PexelsClip } from '@/utils/integrations/pexels';


import {
  clipAtTime,
  effectiveClipDuration,
  fitAspect,
  reelDurationSec,
  splitClipAt,
  timelineErrors,
  transitionOverlapSec,
} from '@/lib/mothermode/reel/timeline';
import { makeClipId, WORD_FONTS, REEL_TRANSITIONS, type ReelMediaCue, type ReelOverlayClip, type ReelTransition, type ReelTransitionType } from '@/lib/mothermode/reel/types';
import { suggestCuesForWords } from '@/lib/mothermode/reel/cueSuggest';
import { parseGeneTags } from '@/lib/mothermode/reel/genes';
import {
  ALL_VEED_PRESETS,
  VEED_BASIC_PRESETS,
  VEED_DYNAMIC_PRESETS,
  VEED_EXAMPLE_VIDEO_URL,
  veedCostEstimate,
  veedCostMultiplier,
} from '@/lib/mothermode/reel/veedPresets';
import { newManualPieceId, suggestUtm, FUNNEL_PAGES, OPTIN_PAGES, funnelPageLabel, optinPageLabel } from '@/lib/mothermode/planner/utm';
import { usePieceLinks } from '@/components/mothermode/content/pieceLinks';
import { refreshPieceLinks } from '@/components/mothermode/content/pieceLinks';
import {
  REEL_PLATFORMS,
  allChecksPass,
  aspectFor,
  defaultPostType,
  platformFor,
  platformTypeLabel,
  postTypeLabel,
  similarPlatforms,
  utmForReel,
  validateScheduleSettings,
  type ScheduleCheck,
} from '@/lib/mothermode/reel/schedule';
import { peaksFor } from '@/lib/mothermode/reel/waveform';
import {
  MOTION_PRESETS,
  detectPreset,
  motionCssTransform,
  presetKeys,
  sampleMotion,
} from '@/lib/mothermode/reel/motion';

const API = '/api/admin/mothermode-reel';
const UPLOAD_API = '/api/admin/reel-upload-url';

interface ShotSuggestion {
  index: number;
  camera: string;
  sceneNotes: string;
  motion: string;
}

function fmtSec(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.round((s - m * 60) * 10) / 10;
  return m > 0 ? `${m}:${String(Math.round(r)).padStart(2, '0')}` : `${r}s`;
}

/** R14 centisecond timecode for the timeline toolbar: "00:12.88". */
function fmtCs(s: number): string {
  const v = Math.max(0, s);
  const m = Math.floor(v / 60);
  const sec = Math.floor(v - m * 60);
  const cs = Math.round((v - Math.floor(v)) * 100);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/** Probe a video's runtime client-side via a detached element. */
function probeDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    const done = (n: number) => {
      v.removeAttribute('src');
      v.load();
      resolve(n);
    };
    v.onloadedmetadata = () =>
      done(Number.isFinite(v.duration) && v.duration > 0 ? Math.round(v.duration * 10) / 10 : 0);
    v.onerror = () => done(0);
    v.src = url;
  });
}

/** Probe a local File before upload so we never fall back to 5s on a 3-min clip. */
function probeFileDuration(file: File): Promise<number> {
  const blobUrl = URL.createObjectURL(file);
  return probeDuration(blobUrl).finally(() => URL.revokeObjectURL(blobUrl));
}

function putWithProgress(
  url: string,
  file: File,
  headers: Record<string, string>,
  onPct: (n: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && ev.total > 0) {
        onPct(Math.min(99, Math.round((ev.loaded / ev.total) * 100)));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload rejected (${xhr.status}): ${String(xhr.responseText || '').slice(0, 160)}`));
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.onabort = () => reject(new Error('Upload aborted'));
    xhr.send(file);
  });
}

function waitUntilPlayable(url: string, timeoutMs = 20000): Promise<boolean> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    const done = (ok: boolean) => {
      window.clearTimeout(timer);
      v.onloadedmetadata = null;
      v.onerror = null;
      v.removeAttribute('src');
      v.load();
      resolve(ok);
    };
    const timer = window.setTimeout(() => done(false), timeoutMs);
    v.onloadedmetadata = () => done(Number.isFinite(v.duration) && v.duration > 0);
    v.onerror = () => done(false);
    v.src = url;
  });
}

/** The REAL platform logos as inline SVGs — brand color when selected, grayscale idle. */
function BrandLogo({ id, active }: { id: string; active: boolean }) {
  const color: Record<string, string> = {
    youtube: '#FF0000',
    tiktok: '#ffffff',
    instagram: '#E1306C',
    facebook: '#1877F2',
    x: '#ffffff',
    linkedin: '#0A66C2',
  };
  const paths: Record<string, React.ReactNode> = {
    youtube: (
      <>
        <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8Z" />
        <path fill="#0f0f0f" d="m9.6 15.6 6.3-3.6-6.3-3.6v7.2Z" />
      </>
    ),
    tiktok: (
      <path d="M16.6 1.7c.9 2.6 2.7 4.4 5.4 4.7v3.4c-2-.1-3.8-.7-5.4-1.7v7.3A6.6 6.6 0 1 1 9.9 9.6c.3 0 .7 0 1 .1v3.6a3 3 0 1 0 2.6 3V1.7h3.1Z" />
    ),
    instagram: (
      <>
        <rect x="2" y="2" width="20" height="20" rx="5.5" fill="none" strokeWidth="2.2" stroke={active ? color[id] : 'currentColor'} />
        <circle cx="12" cy="12" r="4.2" fill="none" strokeWidth="2.2" stroke={active ? color[id] : 'currentColor'} />
        <circle cx="17.4" cy="6.6" r="1.5" />
      </>
    ),
    facebook: (
      <path d="M22.7 0H1.3C.6 0 0 .6 0 1.3v21.4C0 23.4.6 24 1.3 24h11.5v-9.3H9.7v-3.6h3.1V8.4c0-3.1 1.9-4.8 4.6-4.8 1.3 0 2.5.1 2.8.1v3.3h-1.9c-1.5 0-1.8.7-1.8 1.8v2.3h3.7l-.5 3.6h-3.2V24H22.7c.7 0 1.3-.6 1.3-1.3V1.3C24 .6 23.4 0 22.7 0Z" />
    ),
    x: (
      <path d="M18.9 1.2h3.7l-8.1 9.3L24 22.8h-7.5l-5.9-7.7-6.7 7.7H.2l8.7-9.9L0 1.2h7.7l5.3 7 5.9-7Z" />
    ),
    linkedin: (
      <path d="M20.4 20.5h-3.6v-5.6c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9v5.7H9.2V9h3.4v1.6h.1c.5-.9 1.7-1.9 3.4-1.9 3.6 0 4.3 2.4 4.3 5.5v6.3ZM5.3 7.4a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2Zm1.8 13.1H3.5V9h3.6v11.5Z" />
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      className={clsx('h-[18px] w-[18px] transition-all', !active && 'opacity-35 grayscale hover:opacity-70')}
      fill={id === 'instagram' ? color[id] : active ? color[id] : 'currentColor'}
      style={id === 'instagram' && !active ? { color: 'currentColor' } : undefined}
    >
      {paths[id]}
    </svg>
  );
}



/** The thumbnail URL for a frame — shared by the memoized Thumb and the strip prefetcher. */
function thumbUrl(url: string, t: number): string {
  return `/api/admin/reel-thumbnail?url=${encodeURIComponent(url)}&t=${Math.max(0, t).toFixed(1)}`;
}

/**
 * CLIENT-side frame capture — the fallback when the server ffmpeg binary
 * isn't available (Vercel ENOENT). Seeks a hidden video element to `t` and
 * draws the frame to a canvas — data URL. One per (url, t) so it caches in a
 * module-level map and the strip never re-captures.
 */
/** The cue image's real aspect (h/w), cached per URL — the above/below chips
 *  seat the cue's EDGE against the caption block's edge, which needs the true
 *  shape (a portrait card is ~2× taller than a landscape one at the same
 *  widthPct, and flat offsets were landing on top of the text). 1 until the
 *  probe lands; the chip reads the cache at click time, so no state churn. */
const cueAspectCache = new Map<string, number>();
function cueAspectFor(url: string): number {
  const hit = cueAspectCache.get(url);
  if (hit) return hit;
  if (typeof Image !== 'undefined') {
    cueAspectCache.set(url, 1); // guards duplicate probes while one is in flight
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0) cueAspectCache.set(url, img.naturalHeight / img.naturalWidth);
    };
    img.src = url;
  }
  return cueAspectCache.get(url) ?? 1;
}

const clientThumbCache = new Map<string, Promise<string>>();
function clientThumb(url: string, t: number): Promise<string> {
  const key = `${url}#${t.toFixed(1)}`;
  let p = clientThumbCache.get(key);
  if (p) return p;
  p = new Promise((resolve) => {
    try {
      const v = document.createElement('video');
      v.crossOrigin = 'anonymous';
      v.muted = true;
      v.preload = 'auto';
      v.src = url;
      const bail = () => resolve('');
      v.onerror = bail;
      const capture = () => {
        try {
          const cv = document.createElement('canvas');
          cv.width = 160;
          cv.height = Math.max(90, Math.round((160 * (v.videoHeight || 9)) / (v.videoWidth || 16)));
          const ctx = cv.getContext('2d');
          if (!ctx) return bail();
          ctx.drawImage(v, 0, 0, cv.width, cv.height);
          resolve(cv.toDataURL('image/jpeg', 0.7));
        } catch {
          bail();
        }
      };
      v.onloadedmetadata = () => {
        try {
          v.currentTime = Math.max(0, Math.min(t, (v.duration || t) - 0.05));
        } catch {
          capture();
        }
      };
      v.onseeked = capture;
      // hard timeout — never leave the strip hanging
      setTimeout(bail, 8000);
    } catch {
      resolve('');
    }
  });
  clientThumbCache.set(key, p);
  return p;
}

/** Server-side strip thumbnail (edge-cached JPEG) with a CLIENT-side fallback
 *  when the server ffmpeg binary isn't available. Memoized so timeline
 *  re-renders never re-fetch. */
const Thumb = memo(function Thumb({ url, t, className }: { url: string; t: number; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    // Keep Railway worker warm while studio is open (avoids multi-minute cold starts).
    return keepWorkerWarm(process.env.NEXT_PUBLIC_RENDER_WORKER_URL);
  }, []);

  useEffect(() => {
    let alive = true;
    // Try the server first (edge-cached); fall back to the client on any error.
    const img = new Image();
    img.onload = () => alive && setSrc(thumbUrl(url, t));
    img.onerror = () => {
      void clientThumb(url, t).then((data) => {
        if (!alive) return;
        if (data) setSrc(data);
        else setBroken(true);
      });
    };
    img.src = thumbUrl(url, t);
    return () => {
      alive = false;
    };
  }, [url, t]);
  // Graceful degrade: no thumbnail at all — a soft gradient cell.
  if (broken) {
    return <div className={clsx('bg-gradient-to-br from-white/[0.07] to-white/[0.02]', className)} />;
  }
  if (!src) {
    return <div className={clsx('animate-pulse bg-white/[0.04]', className)} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" loading="lazy" draggable={false} className={className} />
  );
});

/** R4: the 4-frame sprite tile URL for a clip — ONE request instead of four. */
function spriteUrl(url: string, durSec: number, frames = 4): string {
  return `/api/admin/reel-sprite?url=${encodeURIComponent(url)}&dur=${Math.max(0.3, durSec).toFixed(1)}&frames=${frames}`;
}

/** R4 filmstrip frames: one tiled JPEG sliced by CSS; falls back to per-frame thumbs on error. */
function SpriteStrip({ url, durSec, className }: { url: string; durSec: number; className?: string }) {
  const [broken, setBroken] = useState(false);
  const src = spriteUrl(url, durSec);
  if (broken) {
    const frames = [
      0.5,
      Math.max(0.5, durSec / 3),
      Math.max(0.5, (2 * durSec) / 3),
      Math.max(0.5, durSec - 1),
    ];
    return (
      <>
        {frames.map((t, k) => (
          <Thumb key={k} url={url} t={t} className={className} />
        ))}
      </>
    );
  }
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={className}
          style={{
            backgroundImage: `url("${src}")`,
            backgroundRepeat: 'no-repeat',
            ...spriteCellStyle(i),
          }}
        />
      ))}
      {/* hidden probe: swaps to per-frame thumbs when the sprite errors */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="hidden" onError={() => setBroken(true)} />
    </>
  );
}



// ---------------------------------------------------------------------------
// Timeline strip
// ---------------------------------------------------------------------------

/** Seam glyphs on the strip: crossfade ◐, whip ≫, zoom ◎ (the top-left dot). */
const TRANSITION_GLYPH: Record<ReelTransitionType, string> = {
  crossfade: '◐',
  whip: '≫',
  zoom: '◎',
};

function TimelineStrip({
  clips,
  selectedId,
  onSelect,
  onTrim,
  onReorder,
  onScrub,
  onScrubIn,
  onLeftTrim,
  onKeyMove,
  onTransition,
  pxPerSec,
}: {

  clips: ReelClip[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onTrim: (id: string, trimEndSec: number) => void;
  onReorder: (id: string, toIndex: number) => void;
  onScrub: (clip: ReelClip, trimEndSec: number) => void;
  /** Left-edge in-point drag: live preview seek to the new first frame. */
  onScrubIn?: (clip: ReelClip, inSec: number) => void;
  /** Left-edge release: the server cuts the head off (in-point trim). */
  onLeftTrim?: (clip: ReelClip, inSec: number) => void;
  /** R15: drag a keyframe diamond to re-time it. */
  onKeyMove?: (clip: ReelClip, keyIndex: number, tSec: number) => void;
  /** Scene transitions: set/clear the transition INTO a clip (the seam before it). */
  onTransition?: (id: string, transitionIn: ReelTransition | null) => void;
  /** R12: fixed px/sec so trimming one scene never re-lays-out the others. */
  pxPerSec: number;
}) {

  const total = reelDurationSec(clips);
  const [liveTrim, setLiveTrim] = useState<{ id: string; trim: number } | null>(null);
  const dragIndex = useRef<number | null>(null);
  if (total <= 0) return null;

  return (
    <div className="flex h-32 w-full gap-1 overflow-hidden rounded-xl border border-white/10 bg-ink/50 p-1.5">

      {clips.map((c, i) => {
        const eff = effectiveClipDuration(c);
        const live = liveTrim?.id === c.id ? liveTrim.trim : null;
        const shownDur = live != null ? Math.max(0.1, c.durationSec - live) : eff;
        const selected = c.id === selectedId;
        return (
          <div
            key={c.id}
            draggable
            onDragStart={() => {
              dragIndex.current = i;
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex.current != null && dragIndex.current !== i) {
                onReorder(clips[dragIndex.current].id, i);
              }
              dragIndex.current = null;
            }}
            onClick={() => onSelect(c.id)}
            className={clsx(
              'group relative h-full shrink-0 cursor-pointer overflow-hidden rounded-lg border shadow-sm transition-colors',
              selected
                ? 'z-10 border-brass/70 bg-brass/90 ring-1 ring-brass/70 shadow-[0_0_14px_rgba(168,139,92,0.28)]'
                : 'border-white/10 hover:border-white/25 bg-neutral-900/60',
            )}

            style={{
              // PERCENTAGE of total time — the strip is ALWAYS exactly page-width.
              // The old `Math.max(52, eff * pxPerSec)` PIXEL width is why a long
              // clip blew the timeline thousands of px past the right edge of the
              // screen and shoved the preview off with it. Now each scene takes its
              // share of the 100%-wide strip (eff / total), so a 3-min video just
              // crams more scenes into the SAME page-width — the timeline never
              // grows. (The trim/keyframe drag handlers read the block's real
              // rendered px width at drag time, so they still resolve seconds
              // correctly.) minWidth keeps a sliver visible for a tiny scene.
              width: `${(eff / Math.max(total, 0.001)) * 100}%`,
              minWidth: 40,
            }}
            title={`${c.name} — ${fmtSec(eff)}`}
          >
            {/* Scene transition seam: the top-left dot edits the transition INTO
                this scene. Click cycles off → crossfade → whip → zoom → off;
                right-click cycles the duration 0.3 → 0.5 → 0.8s. The plan
                overlaps the two scenes by that many frames and the composition
                blends them frame-exactly (preview and MP4 agree). */}
            {i > 0 && onTransition && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!c.transitionIn) {
                    onTransition(c.id, { type: REEL_TRANSITIONS[0], durationSec: 0.4 });
                    return;
                  }
                  const idx = REEL_TRANSITIONS.indexOf(c.transitionIn.type);
                  if (idx < 0 || idx === REEL_TRANSITIONS.length - 1) {
                    onTransition(c.id, null); // past the last style → back to a hard cut
                  } else {
                    onTransition(c.id, { ...c.transitionIn, type: REEL_TRANSITIONS[idx + 1] });
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!c.transitionIn) return;
                  const d = c.transitionIn.durationSec;
                  onTransition(c.id, {
                    ...c.transitionIn,
                    durationSec: d >= 0.8 ? 0.3 : d >= 0.5 ? 0.8 : 0.5,
                  });
                }}
                className={clsx(
                  'absolute left-0.5 top-0.5 z-40 flex h-4 w-4 items-center justify-center rounded-full border text-[8px] font-bold leading-none shadow transition-opacity',
                  c.transitionIn
                    ? 'border-brass bg-brass text-ink'
                    : 'border-white/30 bg-black/70 text-white/60 opacity-0 group-hover:opacity-100',
                )}
                title={
                  c.transitionIn
                    ? `${c.transitionIn.type} · ${c.transitionIn.durationSec}s — click: next style · right-click: duration · (past zoom: off)`
                    : 'Scene transition — click: crossfade · whip · zoom · right-click: duration'
                }
              >
                {c.transitionIn ? TRANSITION_GLYPH[c.transitionIn.type] : '⇄'}
              </button>
            )}
            {/* R14 live drag bubble: exact seconds while trimming */}
            {live != null && (
              <div className="pointer-events-none absolute inset-x-0 top-0 z-30 whitespace-nowrap bg-brass px-1.5 py-0.5 text-center text-[9px] font-bold text-ink">
                {fmtCs(c.durationSec)} — {fmtCs(shownDur)}{' '}
                {live > 0 && <span>(≈{fmtCs(live)})</span>}
              </div>
            )}
            <div className="pointer-events-none flex h-full w-full opacity-75 transition-opacity duration-150 group-hover:opacity-100">
              <SpriteStrip url={c.url} durSec={c.durationSec} className="h-full w-1/4 object-cover" />
            </div>

            {/* R15 keyframe diamonds — DRAGGABLE: drag a — to move the keyframe in time */}
            {c.motion && c.motion.length >= 2 && (
              <>
                {c.motion.map((k, ki) => (
                  <span
                    key={ki}
                    onPointerDown={(e) => {
                      if (!onKeyMove) return;
                      e.stopPropagation();
                      e.preventDefault();
                      const el = e.currentTarget as HTMLElement;
                      const block = el.parentElement as HTMLElement;
                      const startX = e.clientX;
                      const startT = k.t;
                      el.setPointerCapture(e.pointerId);
                      const move = (ev: PointerEvent) => {
                        const pxPerSec = block.getBoundingClientRect().width / Math.max(eff, 0.01);
                        const t = Math.round(
                          Math.max(0, Math.min(startT + (ev.clientX - startX) / pxPerSec, eff)) * 100,
                        ) / 100;
                        onKeyMove(c, ki, t);
                      };
                      const up = () => {
                        el.removeEventListener('pointermove', move);
                        el.removeEventListener('pointerup', up);
                      };
                      el.addEventListener('pointermove', move);
                      el.addEventListener('pointerup', up);
                    }}
                    className={clsx(
                      'absolute top-0.5 z-20 flex h-4 w-4 -translate-x-1/2 items-center justify-center text-[10px] font-bold leading-none drop-shadow',
                      // brass-on-brass fix: the SELECTED block is brass-filled, so its diamonds go ink
                      selected ? 'text-ink' : 'text-brass',
                      onKeyMove ? 'cursor-ew-resize hover:scale-125' : 'pointer-events-none',
                    )}
                    style={{ left: `${Math.min(97, (k.t / Math.max(eff, 0.01)) * 100)}%` }}
                    title={`key @ ${k.t.toFixed(2)}s — drag to re-time`}
                  >
                    —
                  </span>
                ))}
              </>
            )}
            {/* floating info chips — the modern filmstrip look */}
            <div className="pointer-events-none absolute bottom-1.5 left-1.5 flex max-w-[68%] items-center gap-1 rounded-md bg-black/75 px-1.5 py-0.5 backdrop-blur-[2px]">
              <span className="text-[9px] font-bold text-brass">{i + 1}</span>
              <span className="truncate text-[9px] text-white/85">{c.name}</span>
            </div>
            <span
              className={clsx(
                'pointer-events-none absolute bottom-1.5 right-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-semibold backdrop-blur-[2px]',
                live != null && live > 0 ? 'bg-brass text-ink' : 'bg-black/75 text-white/60',
              )}
            >
              {fmtSec(shownDur)}
            </span>

            {/* left-edge in-point handle (server round-trip on release) */}
            <div
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                const el = e.currentTarget as HTMLElement;
                const block = el.parentElement as HTMLElement;
                const pxPerSec = block.getBoundingClientRect().width / eff;
                const startX = e.clientX;
                let inSec = 0;
                el.setPointerCapture(e.pointerId);
                const move = (ev: PointerEvent) => {
                  const deltaSec = (ev.clientX - startX) / pxPerSec;
                  inSec =
                    Math.round(Math.max(0, Math.min(deltaSec, c.durationSec - 0.5)) * 10) / 10;
                  onScrubIn?.(c, inSec);
                };
                const up = () => {
                  el.removeEventListener('pointermove', move);
                  el.removeEventListener('pointerup', up);
                  if (inSec > 0.05) onLeftTrim?.(c, inSec);
                };
                el.addEventListener('pointermove', move);
                el.addEventListener('pointerup', up);
              }}
              className="absolute left-0 top-0 z-20 flex h-full w-4 cursor-ew-resize items-center justify-center border-l-2 border-transparent transition-colors hover:border-brass hover:bg-brass/30"
              title="Drag to cut the head"
            >
              <span className="pointer-events-none h-6 w-1 rounded-full bg-bone/30 group-hover:bg-brass/70" />
            </div>
            {/* right-edge trim handle */}
            <div

              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                const el = e.currentTarget as HTMLElement;
                const block = el.parentElement as HTMLElement;
                const pxPerSec = block.getBoundingClientRect().width / eff;
                const startX = e.clientX;
                const startTrim = c.trimEndSec;
                let trim = startTrim;
                el.setPointerCapture(e.pointerId);
                const move = (ev: PointerEvent) => {
                  const deltaSec = (ev.clientX - startX) / pxPerSec;
                  trim =
                    Math.round(
                      Math.max(0, Math.min(startTrim - deltaSec, c.durationSec - 0.1)) * 10,
                    ) / 10;
                  setLiveTrim({ id: c.id, trim });
                  onScrub(c, trim);
                };
                const up = () => {
                  el.removeEventListener('pointermove', move);
                  el.removeEventListener('pointerup', up);
                  setLiveTrim(null);
                  onTrim(c.id, trim);
                };
                el.addEventListener('pointermove', move);
                el.addEventListener('pointerup', up);
              }}
              className="absolute right-0 top-0 z-20 flex h-full w-4 cursor-ew-resize items-center justify-center border-r-2 border-transparent transition-colors hover:border-brass hover:bg-brass/30"
              title="Drag to cut the tail"
            >
              <span className="pointer-events-none h-6 w-1 rounded-full bg-bone/30 group-hover:bg-brass/70" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** The scrub ruler above the strip: zoom-aware ticks + clip-boundary notches + click/drag to seek. */
function TimeRuler({
  totalSec,
  clips,
  zoom,
  onScrub,
  wordMarks = [],
}: {
  totalSec: number;
  clips: ReelClip[];
  zoom: number;
  onScrub: (timelineSec: number) => void;
  wordMarks?: { t: number; label: string }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const base = totalSec <= 45 ? 5 : totalSec <= 120 ? 10 : totalSec <= 300 ? 30 : 60;
  const NICE = zoom >= 4 ? [0.5, 1, 2, 5, 10, 30, 60] : zoom >= 2 ? [1, 2, 5, 10, 15, 30, 60, 120, 300] : [1, 2, 5, 10, 15, 30, 60, 120, 300];
  const step = NICE.find((s) => s * Math.max(1, zoom) >= base) ?? 300;
  const ticks: number[] = [];
  for (let t = 0; t <= totalSec; t += step) ticks.push(t);


  function scrubFromEvent(clientX: number) {
    const el = ref.current;
    if (!el || totalSec <= 0) return;
    const rect = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onScrub(Math.round(frac * totalSec * 10) / 10);
  }

  return (
    <div
      ref={ref}
      className="relative h-6 w-full cursor-ew-resize select-none rounded-t-lg border border-b-0 border-bone/15 bg-ink/80"
      onPointerDown={(e) => {
        const el = e.currentTarget;
        el.setPointerCapture(e.pointerId);
        scrubFromEvent(e.clientX);
        const move = (ev: PointerEvent) => scrubFromEvent(ev.clientX);
        const up = () => {
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerup', up);
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
      }}
    >
      {ticks.map((t) => (
        <div
          key={t}
          className="absolute top-0 h-full border-l border-bone/15 pl-1 text-[9px] leading-6 text-bone/35"
          style={{ left: `${(t / Math.max(totalSec, 0.001)) * 100}%` }}
        >
          {fmtSec(t)}
        </div>
      ))}
      {wordMarks.slice(0, 400).map((w, i) => (
        <div
          key={`wm-${i}-${w.t}`}
          data-word-tick
          title={w.label}
          className="pointer-events-none absolute bottom-0 h-2 w-px bg-brass/50"
          style={{ left: `${(w.t / Math.max(totalSec, 0.001)) * 100}%` }}
        />
      ))}
      {/* clip-boundary notches: which scene owns each stretch of the ruler */}
      {clips.map((c, i) => (
        <div
          key={c.id}
          className="pointer-events-none absolute bottom-0 border-l-2 border-brass/60 pl-0.5 text-[8px] font-semibold leading-3 text-brass/80"
          style={{ left: `${(timelineStartOf(clips, i) / Math.max(totalSec, 0.001)) * 100}%` }}
        >
          {i + 1}
        </div>
      ))}
    </div>
  );
}


/** R14 waveform lane: canvas bars behind the audio bed block (peaks cached client-side). */
function WaveformLane({ url }: { url: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let alive = true;
    void peaksFor(url, 600).then((peaks) => {
      if (!alive || !peaks) return;
      const cv = ref.current;
      const ctx = cv?.getContext('2d');
      if (!cv || !ctx) return;
      const w = (cv.width = cv.offsetWidth * 2);
      const h = (cv.height = cv.offsetHeight * 2);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(168,139,92,0.55)';
      const step = w / peaks.length;
      for (let i = 0; i < peaks.length; i += 1) {
        const bh = Math.max(2, peaks[i] * h * 0.92);
        ctx.fillRect(i * step, (h - bh) / 2, Math.max(1, step * 0.72), bh);
      }
    });
    return () => {
      alive = false;
    };
  }, [url]);
  return (
    <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full opacity-70" />
  );
}

/**
 * R17: load the Google fonts a preset needs (one <link> per family, deduped).
 *
 * R31: the URLs now come from `captionFontsFor()` — the same helper the render
 * plan ships to the worker. This hook used to build its own css2 URL, which is
 * how the preview could look right while the MP4 burned a fallback face: two
 * resolvers, one of them wrong. It also unconditionally requested
 * `wght@400;600;700;800;900`, and css2 returns HTTP 400 for a weight a family
 * doesn't publish (Anton ships 400 only) — so the "load the font" link could
 * itself be the reason no font loaded. captionFontsFor only asks for axes a
 * family actually has.
 */
function useCaptionFonts(
  def: { font?: string; fontUrl?: string },
  extraFamilies: string[] = [],
) {
  const fonts = useMemo(() => {
    const base = captionFontsFor(def);
    const seen = new Set(base.map((f) => f.family));
    const out = [...base];
    for (const fam of extraFamilies) {
      if (!fam || seen.has(fam)) continue;
      seen.add(fam);
      out.push(
        ...captionFontsFor({ font: fam } as Parameters<typeof captionFontsFor>[0]),
      );
    }
    return out;
  }, [def.font, def.fontUrl, extraFamilies.join('|')]);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    for (const f of fonts) {
      const id = `gf-${f.family.replace(/\s+/g, '-').toLowerCase()}`;
      if (document.getElementById(id)) continue;
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = f.cssUrl;
      document.head.appendChild(link);
    }
  }, [fonts]);
}

/**
 * Karaoke caption block for the PLATFORM MOCK SWATCHES ONLY.
 *
 * ⚠️ This is NOT the stage and NOT the render. It is a decorative, scaled-down
 * caption drawn inside the fake TikTok/Reels phone frames, where the box is a
 * `w-max` chip rather than a video frame.
 *
 * It USED to draw the editor stage as well, and that is the third copy that made
 * "the render doesn't match the preview" survive two rounds of fixes to the
 * Remotion layers. It differs from the real layer in ways that change both the
 * look and the line breaks:
 *
 *   - `fontSize: layout.sizePx` RAW — no `/ CAPTION_STAGE_W * frameWidth` scale,
 *     so the type size bears no relation to the exported size;
 *   - no 86%-wide centred block, so text wraps at a different width (or not at
 *     all) and the rows break across different words;
 *   - active word chosen from CLIP-LOCAL source seconds and held forever;
 *   - inactive rows dimmed with `opacity-70`, which the render never does.
 *
 * The stage now renders <StageCaptions>, which is the SAME component the MP4 is
 * drawn with. Do not reintroduce this on a video frame.
 */
function KaraokeLine({

  words,
  timeSec,
  preset = 'karaoke',
  overrides,
}: {
  words: ReelWord[];
  timeSec: number;
  preset?: CaptionPreset;
  overrides?: import('@/lib/mothermode/reel/captions').CaptionOverrides;
}) {
  const def = resolveCaptionStyle(captionDefFor(preset), overrides);
  const style = captionCssFor(def);
  useCaptionFonts(def);
  const layout = captionLayoutFor(def, overrides);
  // The ACTIVE word = the one whose [start, end] window CONTAINS the playhead.
  // Each word must play its full span before the highlight moves on (the old
  // "last word that started" flipped early, so words blinked past). In the gap
  // between two words we HOLD the last spoken word so the line never blanks.
  let idx = -1;
  for (let i = 0; i < words.length; i += 1) {
    if (timeSec < words[i].start) break; // not reached this word yet
    if (timeSec <= words[i].end) {
      idx = i; // currently being spoken
      break;
    }
    idx = i; // past it — hold it until the next word starts
  }
  if (idx < 0) idx = 0;
  const rowSlices = captionRows(words.length, idx, layout.wordsPerRow, layout.rows);
  const anim = def.anim ?? 'pop';
  const animCss = captionAnimCss(anim);
  const keyframes = captionAnimKeyframes(anim);
  return (
    <div style={{ fontSize: layout.sizePx }}>
      {/* The active word's ENTER animation (pop/fade/slide/flip/spin by preset) re-fires
          each time it changes — so the highlight sweeps + animates like the subtitle panel. */}
      {keyframes ? <style>{keyframes}</style> : null}
      {rowSlices.map((slice, ri) => (
        // Dim the rows that DON'T hold the spoken word. This used to be `ri > 0`,
        // which was only correct while row 0 always contained the active word.
        <p
          key={ri}
          style={style.line}
          className={idx >= slice.from && idx < slice.to ? undefined : 'opacity-70'}
        >
          {words.slice(slice.from, slice.to).map((w, k) => {
            const wi = slice.from + k;
            // No `ri === 0` gate: with page-based rows the active word can sit on
            // any row, and that gate was what pinned the highlight to the top row.
            const isActive = wi === idx;

            // POWER WORDS glow in the active style even when they're idle.
            const isPower = !isActive && isPowerWord(w.word, overrides?.powerWords);
            const text = style.upper ? w.word.toUpperCase() : w.word;
            const emoji = (isActive || isPower) && def.emoji ? emojiFor(w.word) : '';
            return (
              <span
                key={isActive ? `a-${idx}` : k}
                style={{
                  ...(isActive || isPower ? style.active : style.word),
                  ...(isPower ? { transform: 'scale(1.12)', display: 'inline-block' } : undefined),
                  ...(isActive && animCss ? { animation: animCss } : undefined),
                }}
              >
                {text}
                {emoji ? ` ${emoji}` : ''}{' '}
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
}

/**
 * The stage's captions — THE render component, on the editor canvas.
 *
 * This is the fix for "the render and the preview show two totally different
 * captions". The Edit-mode stage used to draw <KaraokeLine>, a third caption
 * implementation that shared only `captionCssFor` with the MP4. It sized type in
 * raw stage px, wrapped inside a `w-max` chip, dimmed idle rows, and picked the
 * active word off clip-local seconds. Every one of those changes where the lines
 * break and where the block sits, so the two surfaces genuinely could not agree.
 *
 * Now both stages and the worker render <CaptionLayerFrame>:
 *
 *   Remotion stage → remotion-project/CaptionLayer.tsx → CaptionLayerFrame
 *   Edit stage     → this component                    → CaptionLayerFrame
 *   MP4            → render-worker/.../CaptionLayer.tsx → CaptionLayerFrame
 *
 * `stageW` is the stage's CSS pixel width, standing in for the render's
 * `plan.width`. The layer scales `sizePx / CAPTION_STAGE_W * width`, so passing
 * the real box width makes the caption occupy the SAME FRACTION of the frame as
 * it will at 1080 — which is what makes the wrap points match.
 */
function StageCaptions({
  words,
  timeSec,
  stageW,
  fps = DEFAULT_FPS,
  preset = 'karaoke',
  overrides,
  freePlaceEdit = false,
  showAllWords = false,
}: {
  /** The clip's words, in CLIP-LOCAL source seconds (what project.captions holds). */
  words: ReelWord[];
  /** Playhead in the same clip-local seconds. */
  timeSec: number;
  stageW: number;
  fps?: number;
  preset?: CaptionPreset;
  overrides?: CaptionOverrides;
  /** Edit mode: show every free-placed word (not just the spoken one). */
  freePlaceEdit?: boolean;
  /** Edit mode opt-in: show EVERY card word (off = just the on-screen page). */
  showAllWords?: boolean;
}) {
  const def = resolveCaptionStyle(captionDefFor(preset), overrides);
  const layout = captionLayoutFor(def, overrides);
  const markFonts = useMemo(() => {
    const set = new Set<string>();
    for (const w of words) {
      if (w.mark?.font) set.add(w.mark.font);
    }
    return Array.from(set);
  }, [words]);
  useCaptionFonts(def, markFonts);

  // The layer thinks in FRAMES (so it matches the renderer exactly); the stage
  // thinks in seconds. Convert here, once, rather than teaching the layer a
  // second time model.
  const plan: CaptionPlanLike & { freePlaceEdit?: boolean } = useMemo(
    () => ({
      fps,
      width: Math.max(1, stageW),
      words: words.map((w) => ({
        text: w.word,
        fromFrame: Math.round(w.start * fps),
        toFrame: Math.round(w.end * fps),
        ...(w.mark ? { mark: w.mark } : {}),
      })),
      captionStyle: def,
      captionLayout: layout,
      powerWords: overrides?.powerWords ?? [],
      freePlaceEdit,
      showAllWords,
    }),
    [words, fps, stageW, def, layout, overrides?.powerWords, freePlaceEdit, showAllWords],
  );

  return <CaptionLayerFrame plan={plan} frame={Math.round(timeSec * fps)} />;
}

/** R7 platform target labels for the canvas chip. */
const PLATFORM_LABEL: Record<string, string> = {

  youtube: 'YouTube Shorts',
  tiktok: 'TikTok',
  instagram: 'Reels',
  facebook: 'FB Reels',
  x: 'X',
  linkedin: 'LinkedIn',
};

/** R8 post target: ONE object drives aspect, lens chrome, story guides, and Publish view. */
interface PostTarget {
  brand: string;
  type: string;
}
/**
 * R26: every post type carries its platform length budget — `targetSec` is the
 * sweet spot the timeline measures against (adjustable per reel), `maxSec` is
 * the hard platform cap (0 = no meaningful cap). Sweet spots: Shorts qualify
 * for the shelf at 15–60s (3min max), TikTok/IG/FB reels reward ≈60–90s,
 * stories are 15s cards, X caps at 140s.
 */
const TARGET_GROUPS: {
  brand: string;
  label: string;
  types: { id: string; label: string; aspect: '9:16' | '16:9'; targetSec: number; maxSec: number }[];
}[] = [
  {
    brand: 'youtube',
    label: 'YouTube',
    types: [
      { id: 'shorts', label: 'Shorts', aspect: '9:16', targetSec: 60, maxSec: 180 },
      { id: 'ytfeed', label: 'Feed', aspect: '16:9', targetSec: 180, maxSec: 0 },
      { id: 'youtube', label: 'Watch', aspect: '16:9', targetSec: 480, maxSec: 0 },
    ],
  },
  {
    brand: 'tiktok',
    label: 'TikTok',
    types: [{ id: 'tiktok', label: 'For You', aspect: '9:16', targetSec: 60, maxSec: 600 }],
  },
  {
    brand: 'instagram',
    label: 'Instagram',
    types: [{ id: 'reels', label: 'Reels', aspect: '9:16', targetSec: 90, maxSec: 90 }],
  },
  {
    brand: 'facebook',
    label: 'Facebook',
    types: [
      { id: 'fbreels', label: 'Reels', aspect: '9:16', targetSec: 90, maxSec: 90 },
      { id: 'fbstory', label: 'Story · 15s cards', aspect: '9:16', targetSec: 15, maxSec: 15 },
      { id: 'fbfeed', label: 'Feed', aspect: '16:9', targetSec: 120, maxSec: 240 },
    ],
  },
  {
    brand: 'x',
    label: 'X',
    types: [{ id: 'x', label: 'Feed', aspect: '16:9', targetSec: 140, maxSec: 140 }],
  },
  {
    brand: 'linkedin',
    label: 'LinkedIn',
    types: [
      { id: 'linkedin', label: 'Feed', aspect: '16:9', targetSec: 120, maxSec: 600 },
      { id: 'listory', label: 'Story · 15s cards', aspect: '9:16', targetSec: 15, maxSec: 15 },
    ],
  },
];
/** R26: the length budget for a post target. */
function targetLengthFor(t: PostTarget): { target: number; max: number } {
  const ty = TARGET_GROUPS.find((g) => g.brand === t.brand)?.types.find(
    (x) => x.id === t.type,
  );
  return { target: ty?.targetSec ?? 60, max: ty?.maxSec ?? 0 };
}
function targetAspect(t: PostTarget): '9:16' | '16:9' {
  return (
    TARGET_GROUPS.find((g) => g.brand === t.brand)?.types.find((x) => x.id === t.type)?.aspect ??
    '9:16'
  );
}
function targetTypeLabel(t: PostTarget): string {
  return (
    TARGET_GROUPS.find((g) => g.brand === t.brand)?.types.find((x) => x.id === t.type)?.label ??
    t.type
  );
}
function isStoryTarget(t: PostTarget): boolean {
  return t.type === 'fbstory' || t.type === 'listory';
}

/** R7: the canvas dressed as the target platform — rail + caption chrome on the stage. */
function PlatformLensOverlay({
  brand,
  title,
  caption,
}: {
  brand: string;
  title: string;
  caption: string;
}) {
  const rail = (items: [string, string][]) => (
    <div className="pointer-events-none absolute bottom-24 right-2 z-20 flex flex-col items-center gap-3 text-white">
      {items.map(([glyph, count]) => (
        <div key={glyph + count} className="flex flex-col items-center gap-0.5">
          <span className="text-xl leading-none drop-shadow-md">{glyph}</span>
          {count && <span className="text-[9px] font-semibold drop-shadow-md">{count}</span>}
        </div>
      ))}
    </div>
  );
  // R27: anchored to the frame's bottom edge with a TALL fade — the old strip
  // floated at bottom-14 with a short gradient, which read as a weird shadow
  // mid-frame on tall players.
  const bottom = (handle: string, text: string) => (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pb-2 pr-14 pt-10">
      <p className="text-[11px] font-bold text-white drop-shadow">{handle}</p>
      <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-white/90 drop-shadow">{text}</p>
    </div>
  );
  if (brand === 'youtube') {
    return (
      <>
        <div className="pointer-events-none absolute left-2.5 top-2.5 z-20 flex items-center gap-1.5">
          <svg viewBox="0 0 24 24" className="h-5 w-5 drop-shadow-md" fill="#FF0000">
            <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8Z" />
            <path fill="#fff" d="m9.6 15.6 6.3-3.6-6.3-3.6v7.2Z" />
          </svg>
          <span className="text-[11px] font-bold text-white drop-shadow-md">Shorts</span>
        </div>
        {rail([['❤️', '24K'], ['💬', ''], ['🔖', '812'], ['↪', 'Share']])}
        {bottom('@yourchannel', title)}
      </>
    );
  }
  if (brand === 'tiktok') {
    return (
      <>
        <div className="pointer-events-none absolute inset-x-0 top-2.5 z-20 flex justify-center gap-3 text-[11px] font-semibold text-white/70">
          <span>Following</span>
          <span className="text-white underline underline-offset-4">For You</span>
        </div>
        {rail([['♥', '128K'], ['💬', '2,041'], ['↻', '8,512'], ['↪', 'Share']])}
        {bottom('@youraccount', caption)}
      </>
    );
  }
  if (brand === 'instagram') {
    return (
      <>
        {rail([['♥', '45.2K'], ['💬', '986'], ['↻', ''], ['↪', '']])}
        {bottom('youraccount', caption)}
      </>
    );
  }
  // facebook / x / linkedin: honest label chip only (their chrome isn't vertical-native).
  return (
    <div className="pointer-events-none absolute left-2.5 top-2.5 z-20 rounded-md bg-black/70 px-2 py-1 text-[10px] font-semibold text-white/85">
      posting to {PLATFORM_LABEL[brand] ?? brand}
    </div>
  );
}

/** R7 gene tree: base reel — spun variants with their gene diffs + CTR badges. */
function GeneTreeOverlay({
  baseName,
  rows,
  winnerId,
  onOpen,
  onClose,
}: {
  baseName: string;
  rows: LoopRow[];
  winnerId: string | null;
  onOpen: (projectId: string) => void;
  onClose: () => void;
}) {
  const tags = (name: string) => {
    const m = (k: string) => {
      const hit = name.match(new RegExp(`\\(${k}:([^)]+)\\)`));
      return hit ? hit[1] : null;
    };
    return { hook: m('H'), body: m('B'), outro: m('O') };
  };
  const chip = (label: string, value: string | null, color: string) =>
    value ? (
      <span className={clsx('rounded px-1.5 py-0.5 text-[9px] font-semibold', color)}>
        {label}:{value}
      </span>
    ) : null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-bone/15 bg-ink shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-bone/10 px-5 py-3">
          <Trophy className="h-4 w-4 text-brass" />
          <span className="text-sm font-semibold text-bone">Variant gene tree</span>
          <span className="text-[10px] text-bone/35">
            how this reel's descendants recombine hook/body/outro genes
          </span>
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 text-bone/40 hover:bg-bone/10 hover:text-bone">
            —
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {/* base node */}
          <div className="mx-auto w-64 rounded-xl border border-brass/40 bg-brass/[0.07] p-3 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-brass/70">base reel</p>
            <p className="mt-0.5 truncate text-xs font-semibold text-bone/90">{baseName}</p>
          </div>
          <div className="mx-auto h-5 w-px bg-bone/20" />
          {rows.length === 0 ? (
            <p className="mx-auto max-w-sm text-center text-[11px] leading-relaxed text-bone/35">
              No descendants yet — hit <strong className="text-brass/80">spin</strong> on the
              Scoreboard to recombine this reel with Vault genes, then compose + post the variants.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {rows.map((r) => {
                const t = tags(r.projectName);
                const isWinner = winnerId === r.variant.id;
                const ctr = r.impressions > 0 ? r.clicks / r.impressions : null;
                return (
                  <button
                    key={r.variant.id}
                    onClick={() => onOpen(r.variant.id)}
                    className={clsx(
                      'rounded-xl border p-3 text-left transition-colors',
                      isWinner
                        ? 'border-brass/60 bg-brass/[0.08] ring-1 ring-brass/40'
                        : 'border-bone/10 bg-bone/[0.03] hover:border-bone/25',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Thumb url={r.variant.composedUrl} t={0.5} className="h-10 w-14 shrink-0 rounded bg-black object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-semibold text-bone/85">
                          {isWinner && <span className="mr-1 text-brass">★</span>}
                          {r.projectName}
                        </p>
                        <p className="text-[9px] text-bone/40">
                          {ctr != null
                            ? `${(ctr * 100).toFixed(1)}% CTR · ${r.impressions.toLocaleString()} imp`
                            : 'not posted yet'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {chip('H', t.hook, 'bg-brass/15 text-brass')}
                      {chip('B', t.body, 'border border-bone/20 text-bone/60')}
                      {chip('O', t.outro, 'bg-violet-500/15 text-violet-300')}
                      {!t.hook && !t.body && !t.outro && (
                        <span className="text-[9px] text-bone/30">legacy variant (pre-gene tags)</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The shared platform mock — the SAME pixel-faithful previews the Publish view
 * renders, extracted so the Schedule sheet shows the exact same thing (playable
 * video, karaoke captions, per-platform chrome) instead of a dead static frame.
 */
function PlatformMockView({
  platform,
  videoUrl,
  title,
  caption,
  desc,
  captionWords = [],
  captionPreset = 'karaoke',
  captionOverrides,
}: {
  platform: string;
  videoUrl: string;
  title: string;
  caption: string;
  desc: string;
  captionWords?: ReelWord[];
  captionPreset?: CaptionPreset;
  captionOverrides?: CaptionOverrides;
}) {
  const T = title;
  const C = caption;
  const D = desc;

  const avatar = (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brass/25 text-sm font-bold text-brass">
      Y
    </span>
  );

  /** The mock's video WITH the karaoke captions burned in (live, word-synced) — click to play. */
  const MockVideo = ({ className }: { className?: string }) => {
    const [t, setT] = useState(0);
    return (
      <>
        <video
          src={videoUrl}
          playsInline
          className={className}
          onClick={(e) => {
            const v = e.currentTarget;
            if (v.paused) void v.play().catch(() => {});
            else v.pause();
          }}
          onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
        />
        {captionWords.length > 0 && (
          <div
            className="pointer-events-none absolute inset-x-0 z-10 flex justify-center px-3"
            style={{ bottom: `${Math.max(24, (captionOverrides?.positionPct ?? 12) + 14)}%` }}
          >
            <div style={{ transform: 'scale(0.55)', transformOrigin: 'bottom center' }}>
              <KaraokeLine
                words={captionWords}
                timeSec={t}
                preset={captionPreset}
                overrides={captionOverrides}
              />
            </div>
          </div>
        )}
      </>
    );
  };

  /**
   * Phone-frame vertical mock (story/reel/short surfaces).
   *
   * The frame is 9:16 — the ACTUAL delivery ratio for Shorts / TikTok / IG+FB
   * Reels — not a taller phone-body ratio. A 9:19 frame letterboxes the video
   * inside the mock, so the preview stops matching what the platform shows.
   */
  const VerticalFrame = ({ children }: { children: React.ReactNode }) => (
    <div
      className="relative w-full max-w-[300px] overflow-hidden rounded-[1.6rem] bg-black shadow-2xl ring-1 ring-white/10"
      style={{ aspectRatio: '9/16' }}
    >
      <MockVideo className="absolute inset-0 block h-full w-full object-cover" />
      {children}
    </div>
  );


  /** Right-side action rail used by short-form surfaces. */
  const ActionRail = ({ items, className }: { items: [string, string][]; className?: string }) => (
    <div className={clsx('flex flex-col items-center gap-4 text-white', className)}>
      {items.map(([glyph, count]) => (
        <div key={glyph + count} className="flex flex-col items-center gap-0.5">
          <span className="text-[26px] leading-none drop-shadow-md">{glyph}</span>
          {count && <span className="text-[10px] font-semibold drop-shadow-md">{count}</span>}
        </div>
      ))}
    </div>
  );

  return (
    <>
      {platform === 'shorts' && (
        <VerticalFrame>
          <div className="absolute left-3 top-3 flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="h-7 w-7 drop-shadow-md" fill="#FF0000">
              <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8Z" />
              <path fill="#fff" d="m9.6 15.6 6.3-3.6-6.3-3.6v7.2Z" />
            </svg>
            <span className="text-sm font-bold text-white drop-shadow-md">Shorts</span>
          </div>
          <ActionRail
            className="absolute bottom-24 right-2.5"
            items={[['❤️', '24K'], ['💬', ''], ['🔖', '812'], ['↪', 'Share'], ['⋯', '']]}
          />
          <div className="absolute inset-x-0 bottom-9 bg-gradient-to-t from-black/90 to-transparent p-3 pb-4 pr-16">
            <div className="flex items-center gap-2">
              {avatar}
              <p className="text-sm font-semibold text-white">@yourchannel</p>
              <button className="ml-1 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-black">
                Subscribe
              </button>
            </div>
            <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-white/95">{T}</p>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-white/75">
              <Music className="h-3 w-3" /> original audio
            </p>
          </div>
        </VerticalFrame>
      )}

      {platform === 'ytfeed' && (
        <div className="w-full max-w-2xl rounded-xl bg-[#0f0f0f] p-4 text-white shadow-2xl">
          <div className="flex gap-3">
            <div className="relative w-[320px] shrink-0 overflow-hidden rounded-xl" style={{ aspectRatio: '16/9' }}>
              <Thumb url={videoUrl} t={1.5} className="h-full w-full object-cover" />
              <span className="absolute bottom-1.5 right-1.5 rounded bg-black/85 px-1.5 py-0.5 text-[11px] font-semibold">
                0:45
              </span>
            </div>
            <div className="min-w-0 pt-0.5">
              <h3 className="line-clamp-2 text-base font-semibold leading-snug">{T}</h3>
              <p className="mt-1.5 text-xs text-neutral-400">Your Channel</p>
              <p className="text-xs text-neutral-400">1 view · 1 minute ago</p>
            </div>
          </div>
          <div className="mt-3 flex items-start gap-3 border-t border-neutral-800 pt-3">
            {avatar}
            <p className="text-xs leading-relaxed text-neutral-300 line-clamp-2">{D}</p>
          </div>
        </div>
      )}

      {platform === 'fbreels' && (
        <VerticalFrame>
          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
            <span className="text-sm font-bold text-white drop-shadow">Reels</span>
            <span className="text-white/80">🔖</span>
          </div>
          <ActionRail
            className="absolute bottom-24 right-2.5"
            items={[['❤️', '3.4K'], ['💬', '210'], ['↻', '96'], ['↪', '']]}
          />
          <div className="absolute inset-x-0 bottom-9 bg-gradient-to-t from-black/90 to-transparent p-3 pb-4 pr-16">
            <div className="flex items-center gap-2">
              {avatar}
              <p className="text-sm font-semibold text-white">Your Page</p>
              <button className="ml-1 rounded bg-[#1877f2] px-2.5 py-1 text-[11px] font-semibold text-white">
                Follow
              </button>
            </div>
            <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-white/90">{C}</p>
          </div>
        </VerticalFrame>
      )}

      {platform === 'fbstory' && (
        <VerticalFrame>
          <div className="absolute inset-x-0 top-0 flex gap-1 p-2.5">
            {[1, 2, 3].map((n) => (
              <span key={n} className={clsx('h-0.5 flex-1 rounded-full', n === 1 ? 'bg-white' : 'bg-white/40')} />
            ))}
          </div>
          <div className="absolute inset-x-0 top-5 flex items-center gap-2 px-3">
            {avatar}
            <div>
              <p className="text-[11px] font-semibold text-white drop-shadow">Your Page</p>
              <p className="text-[10px] text-white/70">2h</p>
            </div>
            <span className="ml-auto text-white/80">⋯</span>
          </div>
          <div className="absolute inset-x-0 bottom-9 bg-gradient-to-t from-black/80 to-transparent p-3 pb-4">
            <p className="mb-2 line-clamp-2 text-xs leading-snug text-white/95 drop-shadow">{C}</p>
            <div className="flex items-center gap-2">
              <span className="flex-1 rounded-full border border-white/60 px-3 py-1.5 text-[11px] text-white/80">
                Send message
              </span>
              <span className="text-xl">👍👏</span>
              <span className="text-xl">💬</span>
            </div>
          </div>
        </VerticalFrame>
      )}

      {platform === 'fbfeed' && (
        <div className="w-full max-w-xl rounded-lg bg-white text-neutral-900 shadow-2xl">
          <div className="flex items-start gap-2.5 p-3 pb-2">
            {avatar}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#1877f2]">Your Page</p>
              <p className="text-xs text-neutral-500">Just now · 🌍</p>
            </div>
            <span className="text-neutral-500">⋯</span>
          </div>
          <p className="whitespace-pre-wrap px-3 pb-2.5 text-sm leading-normal">{C}</p>
          <video src={videoUrl} controls playsInline className="w-full object-contain" />
          <div className="flex items-center justify-between border-t border-neutral-200 px-3 py-2 text-[13px] font-semibold text-neutral-600">
            <span>👍 Like</span>
            <span>💬 Comment</span>
            <span>↪ Share</span>
          </div>
          <div className="flex items-center gap-2 border-t border-neutral-200 px-3 py-2">
            <span className="h-7 w-7 rounded-full bg-neutral-200" />
            <span className="flex-1 rounded-full bg-neutral-100 px-3 py-1.5 text-[13px] text-neutral-500">
              Write a comment…
            </span>
          </div>
        </div>
      )}

      {platform === 'listory' && (
        <VerticalFrame>
          <div className="absolute inset-x-0 top-0 flex gap-1 p-2.5">
            {[1, 2].map((n) => (
              <span key={n} className={clsx('h-0.5 flex-1 rounded-full', n === 1 ? 'bg-[#0a66c2]' : 'bg-white/50')} />
            ))}
          </div>
          <div className="absolute inset-x-0 top-5 flex items-center gap-2 px-3">
            {avatar}
            <div>
              <p className="text-[11px] font-semibold text-white drop-shadow">Your Name</p>
              <p className="text-[10px] text-white/70">Founder · 1h</p>
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-9 bg-gradient-to-t from-black/85 to-transparent p-3 pb-4">
            <p className="mb-2 line-clamp-3 text-xs leading-snug text-white/95 drop-shadow">{D}</p>
            <span className="block w-full rounded-full bg-white px-3 py-2 text-center text-[12px] font-semibold text-[#0a66c2]">
              Reply to Your Name
            </span>
          </div>
        </VerticalFrame>
      )}

      {platform === 'youtube' && (
        <div className="w-full max-w-3xl rounded-xl bg-[#0f0f0f] p-4 text-white shadow-2xl">
          <div className="relative overflow-hidden rounded-xl bg-black" style={{ aspectRatio: '16/9' }}>
            <video src={videoUrl} controls playsInline className="h-full w-full object-contain" />
          </div>
          <h2 className="mt-3 text-xl font-semibold leading-snug">{T}</h2>
          <div className="mt-3 flex items-center gap-3">
            {avatar}
            <div className="min-w-0">
              <p className="text-sm font-semibold">Your Channel</p>
              <p className="text-xs text-neutral-400">12.4K subscribers</p>
            </div>
            <button className="ml-auto rounded-full bg-white px-4 py-2 text-sm font-semibold text-black">
              Subscribe
            </button>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-neutral-800 px-4 py-2 text-sm">👍 1.2K</span>
              <span className="rounded-full bg-neutral-800 px-4 py-2 text-sm">↪ Share</span>
            </div>
          </div>
          <div className="mt-3 rounded-xl bg-neutral-800/70 p-3 text-sm leading-relaxed text-neutral-200">
            <p className="mb-1 font-semibold">1 view · 1 minute ago</p>
            <p className="whitespace-pre-wrap">{D}</p>
          </div>
        </div>
      )}

      {platform === 'tiktok' && (
        <div
          className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-black shadow-2xl"
          style={{ aspectRatio: '9/16' }}
        >
          <MockVideo className="h-full w-full object-cover" />
          <div className="absolute inset-x-0 top-0 flex justify-center gap-4 pt-3 text-sm font-semibold text-white/60">
            <span>Following</span>
            <span className="text-white underline underline-offset-4">For You</span>
          </div>
          <div className="absolute bottom-20 right-2 flex flex-col items-center gap-4 text-white">
            {[['♥', '128K'], ['💬', '2,041'], ['↻', '8,512'], ['↪', 'Share']].map(([glyph, count]) => (
              <div key={count as string} className="flex flex-col items-center gap-0.5">
                <span className="text-2xl drop-shadow">{glyph}</span>
                <span className="text-[10px] font-semibold drop-shadow">{count}</span>
              </div>
            ))}
          </div>
          <div className="absolute inset-x-0 bottom-9 bg-gradient-to-t from-black/90 to-transparent p-3 pb-4">
            <p className="text-sm font-bold text-white">@youraccount</p>
            <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-white/90">{C}</p>
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-white/80">
              <Music className="h-3 w-3" /> original sound — youraccount
            </p>
          </div>
        </div>
      )}

      {platform === 'reels' && (
        <div
          className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-black shadow-2xl"
          style={{ aspectRatio: '9/16' }}
        >
          <MockVideo className="h-full w-full object-cover" />
          <div className="absolute bottom-24 right-2 flex flex-col items-center gap-4 text-white">
            {[['♥', '45.2K'], ['💬', '986'], ['↻', ''], ['↪', '']].map(([glyph, count]) => (
              <div key={glyph as string} className="flex flex-col items-center gap-0.5">
                <span className="text-2xl drop-shadow">{glyph}</span>
                {count && <span className="text-[10px] font-semibold drop-shadow">{count}</span>}
              </div>
            ))}
          </div>
          <div className="absolute inset-x-0 bottom-9 bg-gradient-to-t from-black/90 to-transparent p-3 pb-4">
            <div className="flex items-center gap-2">
              <span className="h-7 w-7 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-fuchsia-500 p-[2px]">
                <span className="flex h-full w-full items-center justify-center rounded-full bg-ink text-[10px] font-bold text-brass">
                  Y
                </span>
              </span>
              <p className="text-sm font-semibold text-white">youraccount</p>
              <button className="ml-1 rounded-md border border-white/60 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                Follow
              </button>
            </div>
            <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-white/90">{C}</p>
            <p className="mt-1 text-[10px] text-white/60">Liked by follower_one and 2,314 others</p>
          </div>
        </div>
      )}

      {platform === 'x' && (
        <div className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-black p-4 text-white shadow-2xl">
          <div className="flex gap-3">
            {avatar}
            <div className="min-w-0 flex-1">
              <p className="text-[15px]">
                <span className="font-bold">Your Name</span>{' '}
                <span className="inline-block h-4 w-4 rounded-full bg-sky-500 align-middle text-center text-[10px] font-bold leading-4 text-white">
                  ⋯
                </span>{' '}
                <span className="text-neutral-500">@youraccount · 1m</span>
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[15px] leading-normal">{C}</p>
              <div className="mt-3 overflow-hidden rounded-2xl border border-neutral-800">
                <video src={videoUrl} controls playsInline className="w-full object-contain" />
              </div>
              <div className="mt-3 flex items-center justify-between text-[13px] text-neutral-500">
                <span>🔁 214</span>
                <span>❤️ 1,892</span>
                <span>♥ 12.4K</span>
                <span>▶ 1.2M</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {platform === 'linkedin' && (
        <div className="w-full max-w-xl rounded-lg border border-neutral-300 bg-white text-neutral-900 shadow-2xl">
          <div className="flex items-start gap-3 p-4 pb-2">
            {avatar}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Your Name <span className="font-normal text-neutral-500">· 1st</span></p>
              <p className="text-xs text-neutral-500">Founder · helping builders ship</p>
              <p className="text-xs text-neutral-500">1m · 🌍</p>
            </div>
            <button className="rounded-full border border-[#0a66c2] px-3 py-1 text-sm font-semibold text-[#0a66c2]">
              + Follow
            </button>
          </div>
          <p className="whitespace-pre-wrap px-4 pb-3 text-sm leading-normal">{D}</p>
          <video src={videoUrl} controls playsInline className="w-full object-contain" />
          <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-500">
            <span>👍 Like</span>
            <span>💬 Comment</span>
            <span>🔁 Repost</span>
            <span>✉ Send</span>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * The pre-publish sheet — pixel-faithful platform mocks. Editable copy feeds
 * the mocks LIVE: type the title, watch the YouTube page update. Left = the
 * platform, right = your copy + copy-to-clipboard.
 */
function PublishSheet({
  name,
  videoUrl,
  transcript,
  onClose,
  initialBrand,
  initialPlatform,
  copy,
  onCopyChange,
  onSchedule,
  captionWords = [],
  captionPreset = 'karaoke',
  captionOverrides,
  renderJob,
}: {
  name: string;
  videoUrl: string;
  /** Whisper words from the timeline — the AI's grounding for copy. */
  transcript?: string;
  onClose: () => void;
  /** The canvas's platform lens target — Publish view opens where the canvas is pointed. */
  initialBrand?: string;
  initialPlatform?: string;
  /** The shared copy pool (canvas lens reads it too — one pool, two surfaces). */
  copy?: { title: string; caption: string; desc: string; tags: string };
  onCopyChange?: (next: { title: string; caption: string; desc: string; tags: string }) => void;
  /** R13: opens the Schedule sheet over the Publish view. Passes the current platform context. */
  onSchedule?: (brand: string, typeId: string) => void;
  /** Timeline-merged Whisper words — the karaoke captions ride the mock LIVE. */
  captionWords?: ReelWord[];
  captionPreset?: CaptionPreset;
  captionOverrides?: CaptionOverrides;
  /** The page's ONE render job — the same one the header and Post panel drive. */
  renderJob?: RenderJob;
}) {
  const [brand, setBrand] = useState(initialBrand ?? 'youtube');
  const [platform, setPlatform] = useState(initialPlatform ?? 'shorts');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [hookVariants, setHookVariants] = useState<string[] | null>(null);



  const [title, setTitle] = useState(copy?.title ?? (name || 'Untitled reel'));
  const [desc, setDesc] = useState(
    copy?.desc ?? `${name || 'Untitled reel'}\n\nMade with the cutting room.\n#shorts #reels`,
  );
  const [tags, setTags] = useState(
    copy?.tags ??
      (name || 'reel')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 2)
        .slice(0, 6)
        .join(', '),
  );
  const [caption, setCaption] = useState(copy?.caption ?? `${name || 'Untitled reel'} — watch to the end.`);
  /** Same-content-everywhere toggle (default ON) + per-platform overrides when OFF. */
  const [synced, setSynced] = useState(true);
  const [ov, setOv] = useState<Record<string, Partial<Record<'title' | 'caption' | 'desc' | 'tags', string>>>>({});

  /** Which fields each surface actually has — the rail shows only these. */
  const FIELDS: Record<string, ('title' | 'caption' | 'desc' | 'tags')[]> = {
    shorts: ['title', 'desc', 'tags'],
    ytfeed: ['title', 'desc', 'tags'],
    youtube: ['title', 'desc', 'tags'],
    tiktok: ['caption'],
    reels: ['caption'],
    fbreels: ['caption'],
    fbstory: ['caption'],
    fbfeed: ['caption'],
    x: ['caption'],
    linkedin: ['desc'],
    listory: ['caption'],
  };

  /** The value for a field on the CURRENT surface: shared pool, or its override when unsynced. */
  function val(key: 'title' | 'caption' | 'desc' | 'tags'): string {
    const pool = key === 'title' ? title : key === 'caption' ? caption : key === 'desc' ? desc : tags;
    if (synced) return pool;
    return ov[platform]?.[key] ?? pool;
  }

  /** Write a field: the shared pool when synced, otherwise this surface's override. */
  function setVal(key: 'title' | 'caption' | 'desc' | 'tags', v: string) {
    if (synced) {
      if (key === 'title') setTitle(v);
      else if (key === 'caption') setCaption(v);
      else if (key === 'desc') setDesc(v);
      else setTags(v);
      // Mirror into the shared pool — the canvas lens reads the same words.
      onCopyChange?.({
        title: key === 'title' ? v : title,
        caption: key === 'caption' ? v : caption,
        desc: key === 'desc' ? v : desc,
        tags: key === 'tags' ? v : tags,
      });
      return;
    }
    setOv((o) => ({ ...o, [platform]: { ...(o[platform] ?? {}), [key]: v } }));
  }

  const T = val('title');
  const C = val('caption');
  const D = val('desc');

  function copyAll() {
    const text = `TITLE:\n${T}\n\nDESCRIPTION:\n${D}\n\nTAGS:\n${val('tags')}\n\nCAPTION:\n${C}\n\nVIDEO:\n${videoUrl}`;
    void navigator.clipboard?.writeText(text);
  }


  /** AI context shared by every copy call — reel name, platform, and the transcript. */
  const aiCtx = {
    platform: 'tiktok',
    format: 'reel',
    theme: name,
    guides: transcript?.trim()
      ? `The reel's spoken transcript (ground the copy in what is actually said):\n${transcript.slice(0, 1800)}`
      : undefined,
  };

  /** Synthetic piece for amplify calls (hook variants). */
  const aiSource = {
    id: 'reel-copy',
    platform: 'tiktok',
    format: 'reel',
    kind: 'organic',
    tone: 'raw',
    theme: name,
    hook: title,
  } as unknown as ContentPiece;

  async function runAi(job: () => Promise<void>) {
    setAiBusy(true);
    setAiError(null);
    try {
      await job();
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI failed');
    } finally {
      setAiBusy(false);
    }
  }

  const rewrite = (field: 'hook' | 'caption' | 'body', set: (v: string) => void) =>
    runAi(async () => {
      const current = field === 'hook' ? title : field === 'caption' ? caption : desc;
      const text = await aiRewriteText({ field, text: current, context: aiCtx });
      set(text);
    });

  const variants = () =>
    runAi(async () => {
      const items = await aiAmplify({ dimension: 'hooks', count: 4, source: aiSource, guides: aiCtx.guides });
      setHookVariants(items);
    });

  const generateAll = () =>
    runAi(async () => {
      const [t, c, d] = await Promise.all([
        aiRewriteText({ field: 'hook', text: title, context: aiCtx }),
        aiRewriteText({ field: 'caption', text: caption, context: aiCtx }),
        aiRewriteText({ field: 'body', text: desc, context: aiCtx }),
      ]);
      setTitle(t);
      setCaption(c);
      setDesc(d);
    });


  /** Platforms with their post-type selector entries (mock id — label). */
  const PLATFORMS: { id: string; label: string; types: [string, string][] }[] = [
    { id: 'youtube', label: 'YouTube', types: [['shorts', 'Shorts'], ['ytfeed', 'Feed'], ['youtube', 'Watch']] },
    { id: 'tiktok', label: 'TikTok', types: [['tiktok', 'For You']] },
    { id: 'instagram', label: 'Instagram', types: [['reels', 'Reels']] },
    { id: 'facebook', label: 'Facebook', types: [['fbreels', 'Reels'], ['fbstory', 'Story'], ['fbfeed', 'Feed']] },
    { id: 'x', label: 'X', types: [['x', 'Feed']] },
    { id: 'linkedin', label: 'LinkedIn', types: [['linkedin', 'Feed'], ['listory', 'Story']] },
  ];


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={onClose}>
      <div
        className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-bone/15 bg-ink shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-bone/10 px-5 py-3">
          <Film className="h-4 w-4 text-brass" />
          <span className="text-sm font-semibold text-bone">Publish view</span>
          <span className="text-[10px] text-bone/35">edit on the right — the mock updates live</span>
          <div className="ml-auto flex items-center gap-1.5">
            {/* platform logos */}
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setBrand(p.id);
                  setPlatform(p.types[0][0]);
                }}
                title={p.label}
                className="rounded-md"
              >
                <BrandLogo id={p.id} active={brand === p.id} />
              </button>
            ))}
            <span className="mx-1 h-5 w-px bg-bone/15" />
            {/* post-type segmented control — 3 FIXED slots so the header never shifts */}
            <div className="flex items-center gap-0.5 rounded-full bg-white/[0.05] p-1 ring-1 ring-inset ring-white/10">
              {(() => {
                const types = PLATFORMS.find((p) => p.id === brand)?.types ?? [];
                return [0, 1, 2].map((slot) => {
                  const t = types[slot];
                  if (!t) {
                    return <span key={slot} className="w-[68px]" aria-hidden />;
                  }
                  const [id, label] = t;
                  return (
                    <button
                      key={id}
                      onClick={() => setPlatform(id)}
                      className={clsx(
                        'w-[68px] rounded-full py-1 text-center text-[10px] font-semibold transition-all',
                        platform === id
                          ? 'bg-brass text-ink shadow-sm'
                          : 'text-bone/50 hover:text-bone/85',
                      )}
                    >
                      {label}
                    </button>
                  );
                });
              })()}
            </div>

          </div>

          <button onClick={onClose} className="rounded-lg p-1.5 text-bone/40 hover:bg-bone/10 hover:text-bone">
            —
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[1fr_320px]">
          {/* LEFT: the platform mock (the shared, pixel-faithful one) */}
          <div className="flex min-h-0 flex-col items-center justify-center gap-3 overflow-y-auto bg-black/60 p-6">
            <PlatformMockView
              platform={platform}
              videoUrl={videoUrl}
              title={T}
              caption={C}
              desc={D}
              captionWords={captionWords}
              captionPreset={captionPreset}
              captionOverrides={captionOverrides}
            />
            {/* Render from where you're judging the result. This is the same job
                as the header's and the Post panel's — start it anywhere, watch
                it anywhere. */}
            {renderJob ? <RenderButton job={renderJob} label="Render this MP4" /> : null}
          </div>

          {/* RIGHT: copy rail — TipTap fields + AI wands, grounded in the transcript */}
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto border-l border-bone/10 p-4">
            <button
              onClick={() => void generateAll()}
              disabled={aiBusy}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-brass/40 px-3 py-2 text-xs font-semibold text-brass hover:bg-brass/10 disabled:opacity-40"
            >
              {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              {aiBusy ? 'Generating…' : 'Generate all with AI'}
            </button>
            {transcript?.trim() && (
              <p className="-mt-1 text-[9px] text-bone/30">grounded in the reel's transcript</p>
            )}
            {aiError && <p className="text-[10px] text-red-300">{aiError}</p>}

            {/* same-content-everywhere toggle — OFF lets each platform have its own copy */}
            <button
              onClick={() => setSynced((v) => !v)}
              className={clsx(
                'flex items-center justify-between rounded-lg border px-3 py-2 text-[10px] font-semibold',
                synced ? 'border-brass/40 bg-brass/[0.08] text-brass' : 'border-bone/15 text-bone/55 hover:bg-bone/10',
              )}
            >
              <span>{synced ? 'Same content everywhere' : 'Custom per platform'}</span>
              <span
                className={clsx(
                  'relative h-4 w-7 rounded-full transition-colors',
                  synced ? 'bg-brass' : 'bg-bone/25',
                )}
              >
                <span
                  className={clsx(
                    'absolute top-0.5 h-3 w-3 rounded-full bg-ink transition-all',
                    synced ? 'left-3.5' : 'left-0.5',
                  )}
                />
              </span>
            </button>
            {!synced && ov[platform] && (
              <button
                onClick={() => setOv((o) => ({ ...o, [platform]: undefined as never }))}
                className="-mt-1 text-left text-[9px] text-bone/35 hover:text-brass"
              >
                → reset this platform to the shared copy
              </button>
            )}

            {(FIELDS[platform] ?? ['caption']).includes('title') && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-bone/40">Title</span>
                  <span className="flex gap-1">
                    <button
                      onClick={() => void variants()}
                      disabled={aiBusy}
                      title="Hook variants"
                      className="rounded px-1.5 py-0.5 text-[9px] font-semibold text-brass/80 hover:bg-brass/10 disabled:opacity-40"
                    >
                      variants
                    </button>
                    <button
                      onClick={() => void rewrite('hook', (v) => setVal('title', v))}
                      disabled={aiBusy}
                      title="AI rewrite"
                      className="rounded p-1 text-bone/45 hover:bg-bone/10 hover:text-brass disabled:opacity-40"
                    >
                      <Wand2 className="h-3 w-3" />
                    </button>
                  </span>
                </div>
                <input
                  value={T}
                  onChange={(e) => setVal('title', e.target.value)}
                  className="w-full rounded-lg border border-bone/15 bg-ink px-2.5 py-2 text-xs font-semibold text-bone/90"
                />
                {hookVariants && hookVariants.length > 0 && (
                  <div className="mt-1.5 space-y-1 rounded-lg border border-brass/25 bg-brass/[0.05] p-1.5">
                    {hookVariants.map((v, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setVal('title', v);
                          setHookVariants(null);
                        }}
                        className="block w-full rounded px-2 py-1.5 text-left text-[10px] leading-snug text-bone/75 hover:bg-brass/10 hover:text-bone"
                      >
                        {v}
                      </button>
                    ))}
                    <button
                      onClick={() => setHookVariants(null)}
                      className="block w-full px-2 py-1 text-left text-[9px] text-bone/30 hover:text-bone/60"
                    >
                      dismiss
                    </button>
                  </div>
                )}
              </div>
            )}

            {(FIELDS[platform] ?? ['caption']).includes('caption') && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-bone/40">
                    Caption
                  </span>
                  <button
                    onClick={() => void rewrite('caption', (v) => setVal('caption', v))}
                    disabled={aiBusy}
                    title="AI rewrite"
                    className="rounded p-1 text-bone/45 hover:bg-bone/10 hover:text-brass disabled:opacity-40"
                  >
                    <Wand2 className="h-3 w-3" />
                  </button>
                </div>
                <div className="[&_.tiptap]:!text-bone/90 [&_.tiptap]:caret-brass [&_.tiptap]:text-[11px] [&>div]:!border-bone/15 [&>div]:!bg-ink/60 [&>div]:!rounded-lg [&>div]:focus-within:!border-brass/50 [&_button]:!text-bone/45 [&_button:hover]:!bg-bone/10 [&_button:hover]:!text-bone [&_button[aria-pressed='true']]:!bg-brass/20 [&_button[aria-pressed='true']]:!text-brass [&_svg]:!h-3.5 [&_svg]:!w-3.5">
                  <RichTextField
                    value={C}
                    placeholder="The caption — hook lives on line one"
                    minHeight="4.5rem"
                    onChange={(v) => setVal('caption', v.slice(0, 280))}
                  />
                </div>
              </div>
            )}

            {(FIELDS[platform] ?? ['caption']).includes('desc') && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-bone/40">
                    Description / intro
                  </span>
                  <button
                    onClick={() => void rewrite('body', (v) => setVal('desc', v))}
                    disabled={aiBusy}
                    title="AI rewrite"
                    className="rounded p-1 text-bone/45 hover:bg-bone/10 hover:text-brass disabled:opacity-40"
                  >
                    <Wand2 className="h-3 w-3" />
                  </button>
                </div>
                <div className="[&_.tiptap]:!text-bone/90 [&_.tiptap]:caret-brass [&_.tiptap]:text-[11px] [&>div]:!border-bone/15 [&>div]:!bg-ink/60 [&>div]:!rounded-lg [&>div]:focus-within:!border-brass/50 [&_button]:!text-bone/45 [&_button:hover]:!bg-bone/10 [&_button:hover]:!text-bone [&_button[aria-pressed='true']]:!bg-brass/20 [&_button[aria-pressed='true']]:!text-brass [&_svg]:!h-3.5 [&_svg]:!w-3.5">
                  <RichTextField
                    value={D}
                    placeholder="YouTube description / LinkedIn intro"
                    minHeight="8rem"
                    onChange={(v) => setVal('desc', v)}
                  />
                </div>
              </div>
            )}

            {(FIELDS[platform] ?? ['caption']).includes('tags') && (
              <div>
                <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-bone/40">
                  Tags (comma separated)
                </div>
                <input
                  value={val('tags')}
                  onChange={(e) => setVal('tags', e.target.value)}
                  className="w-full rounded-lg border border-bone/15 bg-ink px-2.5 py-2 text-[11px] text-bone/80"
                />
              </div>
            )}


            <button
              onClick={copyAll}
              className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-brass px-3 py-2.5 text-xs font-semibold text-ink hover:bg-brass/90"
            >
              <Copy className="h-3.5 w-3.5" /> Copy everything + video link
            </button>
            {onSchedule && (
              <button
                onClick={() => onSchedule?.(brand, platform)}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-brass/40 px-3 py-2.5 text-xs font-semibold text-brass hover:bg-brass/10"
                title="Render the final MP4 and schedule this post to the planner"
              >
                <Film className="h-3.5 w-3.5" /> Schedule to the planner…
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}


/**
 * R14: batch-schedule several variants in one sheet. Each row gets its own
 * settings checklist (aspect + length fit) so you can see at a glance which
 * variants are ready and which need a fix before they go out.
 */
function BulkScheduleSheet({
  rows,
  onDone,
  onClose,
}: {
  rows: LoopRow[];
  onDone: (message: string) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(() => {
    const d = new Date(Date.now() + 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [time, setTime] = useState('12:00');
  const [utm, setUtm] = useState(true);
  const [dest, setDest] = useState('');
  const [phase, setPhase] = useState<'form' | 'scheduling'>('form');
  const [err, setErr] = useState<string | null>(null);
  /** Per-variant checklist: which variants pass the settings check for their platform. */
  const rowsWithChecks = useMemo(
    () =>
      rows.map((r) => {
        const status = null as { platform: string | null; format: string | null } | null;
        const brand = status?.platform ?? 'youtube';
        const typeId = status?.format ?? 'shorts';
        const checks = validateScheduleSettings({
          platform: brand,
          typeId,
          durationSec: 45, // variant durations aren't in the loop payload; use a neutral estimate
          aspect: '9:16',
        });
        return { ...r, brand, typeId, checks, ok: allChecksPass(checks) };
      }),
    [rows],
  );
  const allOk = rowsWithChecks.every((r) => r.ok);

  async function submit() {
    setErr(null);
    setPhase('scheduling');
    try {
      let scheduled = 0;
      let linked = 0;
      for (const r of rowsWithChecks) {
        const pieceId = newManualPieceId();
        const plan = await fetch('/api/admin/mothermode-planner', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'upsertPlan',
            pieceId,
            title: `${r.projectName} — ${platformTypeLabel(r.brand, r.typeId)}`,
            platform: r.brand,
            format: r.typeId,
            stage: 'Scheduled',
            scheduledAt: new Date(`${date}T${time}`).toISOString(),
          }),
        });
        const planJson = await plan.json();
        if (!planJson.success && !planJson.record) {
          throw new Error(`Failed to schedule "${r.projectName}": ${planJson.error || 'unknown error'}`);
        }
        scheduled += 1;
        if (utm) {
          const utmParams = utmForReel({ platform: r.brand, typeId: r.typeId, pieceId });
          const mint = await fetch('/api/admin/mothermode-links', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              action: 'upsertLink',
              destinationUrl: dest.trim() || `${window.location.origin}/`,
              utmSource: utmParams.source,
              utmMedium: utmParams.medium,
              utmCampaign: utmParams.campaign,
              utmContent: utmParams.content,
              withShortLink: true,
            }),
          });
          const mintJson = await mint.json();
          const code = mintJson.link?.code || mintJson.code;
          if (mintJson.success && code) {
            await fetch('/api/admin/reel-loop', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ action: 'link-variant', variantId: r.variant.id, link: code }),
            });
            linked += 1;
          }
        }
      }
      onDone(
        `Batch scheduled ${scheduled} variant(s) for ${date} ${time}` +
          (utm && linked > 0 ? `, ${linked} tracked link(s) wired.` : '.'),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Batch schedule failed');
      setPhase('form');
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-bone/15 bg-ink p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-bone">Bulk schedule {rows.length} variant(s)</h2>
          <button onClick={onClose} className="text-bone/40 hover:text-bone">
            —
          </button>
        </div>
        {/* per-variant settings checklist */}
        <div className="mb-3 max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-bone/10 bg-bone/[0.02] p-2">
          {rowsWithChecks.map((r) => (
            <div key={r.variant.id} className="rounded-lg border border-bone/10 p-2">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold text-bone/80">
                <span
                  className={clsx(
                    'inline-block h-1.5 w-1.5 rounded-full',
                    r.ok ? 'bg-emerald-400' : 'bg-amber-400',
                  )}
                />
                {r.projectName}
              </p>
              <p className="mt-0.5 text-[9px] text-bone/45">
                {platformTypeLabel(r.brand, r.typeId)}
              </p>
              {!r.ok &&
                r.checks
                  .filter((c) => !c.ok)
                  .map((c, i) => (
                    <p key={i} className="mt-0.5 text-[9px] text-amber-300/90">
                      → {c.label}: {c.detail}
                    </p>
                  ))}
            </div>
          ))}
        </div>
        {!allOk && (
          <p className="mb-3 text-[9px] text-amber-300/80">
            → Some variants fail the settings check — they'll still schedule, but the aspect/length
            may need a fix before posting.
          </p>
        )}
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 rounded-lg border border-bone/15 bg-ink px-2.5 py-2 text-[11px] text-bone/80"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-24 rounded-lg border border-bone/15 bg-ink px-2.5 py-2 text-[11px] text-bone/80"
            />
          </div>
          <label className="flex items-center justify-between rounded-lg border border-bone/15 px-2.5 py-2 text-[10px] font-semibold text-bone/60">
            <span>Tracked links (UTM — clicks roll up automatically)</span>
            <input
              type="checkbox"
              checked={utm}
              onChange={(e) => setUtm(e.target.checked)}
              className="accent-brass"
            />
          </label>
          {utm && (
            <input
              value={dest}
              onChange={(e) => setDest(e.target.value)}
              placeholder="Destination URL (default: your site root)"
              className="w-full rounded-lg border border-bone/15 bg-ink px-2.5 py-2 text-[11px] text-bone/80 outline-none placeholder:text-bone/25"
            />
          )}
          {err && <p className="text-[10px] text-red-300">{err}</p>}
          <button
            onClick={() => void submit()}
            disabled={phase !== 'form' || rows.length === 0}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brass px-3 py-2.5 text-xs font-bold text-ink hover:bg-brass/90 disabled:opacity-40"
          >
            {phase === 'scheduling' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {phase === 'scheduling' ? 'Scheduling…' : `Schedule ${rows.length} variant(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * R13 THE Schedule sheet — one flow everywhere (Post tab, Publish view, Scoreboard).
 * If there's no composed MP4 yet, it RUNS THE RENDER (fal/ffmpeg compose) first,
 * then creates the planner card, and when UTM is on it mints the tracked link
 * (utm_content = the card's piece id) and wires it to the variant when there is one.
 */
function ScheduleSheet({
  name,
  videoUrl,
  variantId,
  brand,
  typeId,
  targetLabel,
  durationSec,
  aspect,
  onRender,
  onDone,
  onClose,
  /** The current cover frame time (seconds) — the thumbnail the platform will use. */
  thumbT,
  /** The video's total duration (for candidate thumbnail frames). */
  videoDurationSec,
  /** The offer slug the reel belongs to (for the funnel/lead magnet link pickers). */
  offerSlug = '',
}: {
  name: string;
  /** Null when the reel has never been composed — the sheet renders first. */
  videoUrl: string | null;
  /** Scoreboard variants pass theirs so clicks roll up onto that variant. */
  variantId?: string;
  brand: string;
  /** The post type id (e.g. 'shorts', 'reels') — the planner card's format. */
  typeId: string;
  targetLabel: string;
  /** The reel's actual duration, for settings validation. */
  durationSec?: number;
  /** The reel's actual aspect, for settings validation. */
  aspect?: '9:16' | '16:9';
  /** Renders the final MP4 (ffmpeg compose). Returns the hosted URL. */
  onRender?: () => Promise<string>;
  onDone: (message: string) => void;
  onClose: () => void;
  /** The current cover frame time (seconds) — the thumbnail the platform will use. */
  thumbT?: number;
  /** The video's total duration (for candidate thumbnail frames). */
  videoDurationSec?: number;
  /** The offer slug the reel belongs to (for the funnel/lead magnet link pickers). */
  offerSlug?: string;
}) {
  const [date, setDate] = useState(() => {
    const d = new Date(Date.now() + 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [time, setTime] = useState('12:00');
  const [utm, setUtm] = useState(true);
  const [phase, setPhase] = useState<'form' | 'rendering' | 'scheduling' | 'done'>('form');
  const [err, setErr] = useState<string | null>(null);
  /** The minted link from the scheduling flow — shown in the "done" phase with a copy button. */
  const [mintedLink, setMintedLink] = useState<{ code: string; url: string } | null>(null);
  /** The picked platform + type — defaults to the variant's own platform. */
  const [pickBrand, setPickBrand] = useState(brand);
  const [pickType, setPickType] = useState(typeId);
  /** The picked cover frame (seconds) — the thumbnail the platform will use. */
  const [pickThumbT, setPickThumbT] = useState(thumbT ?? 0.5);
  /** Post assets — title, description, tags, caption (like the PublishSheet's copy rail). */
  const [title, setTitle] = useState(name);
  const [description, setDescription] = useState(`${name}\n\nMade with the cutting room.\n#shorts #reels`);
  const [tags, setTags] = useState(
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 6)
      .join(', '),
  );
  const [caption, setCaption] = useState(`${name} — watch to the end.`);
  /** The Content Hub's link creation flow: funnel / lead magnet / custom URL. */
  const [destKind, setDestKind] = useState<'funnel' | 'optin' | 'url'>('url');
  const [funnelId, setFunnelId] = useState('');
  const [optinFunnelId, setOptinFunnelId] = useState('');
  const [funnelPage, setFunnelPage] = useState('optin');
  const [customUrl, setCustomUrl] = useState('');
  /** The Content Hub's funnels + optin funnels (for the link pickers). */
  const { funnels, optinFunnels } = usePieceLinks(offerSlug);
  /** The campaign slug for the picked destination (drives utm_campaign). */
  const campaignSlug =
    destKind === 'funnel'
      ? (funnels.find((f) => f.id === funnelId)?.slug ?? null)
      : destKind === 'optin'
        ? (optinFunnels.find((f) => f.id === optinFunnelId)?.slug ?? null)
        : null;
  /** Settings checklist for the current pick — aspect + length fit. */
  const checks: ScheduleCheck[] =
    durationSec != null
      ? validateScheduleSettings({
          platform: pickBrand,
          typeId: pickType,
          durationSec,
          aspect: aspect ?? aspectFor(pickType),
        })
      : [];
  const allOk = allChecksPass(checks);
  /** Candidate thumbnail frames — 4 evenly spaced picks + the current one. */
  const thumbCandidates = useMemo(() => {
    if (!videoDurationSec || videoDurationSec <= 0) return [0.5];
    const dur = videoDurationSec;
    return [
      pickThumbT,
      Math.max(0.5, dur / 4),
      Math.max(0.5, dur / 2),
      Math.max(0.5, (3 * dur) / 4),
    ]
      .map((t) => Math.round(t * 10) / 10)
      .filter((t, i, arr) => arr.indexOf(t) === i)
      .sort((a, b) => a - b);
  }, [videoDurationSec, pickThumbT]);

  async function submit() {
    setErr(null);
    try {
      // 1 — the final MP4 (run the render when the reel isn't composed yet)
      let url = videoUrl;
      if (!url) {
        if (!onRender) throw new Error('No render path for this target.');
        setPhase('rendering');
        url = await onRender();
      }
      if (!url) throw new Error('The render came back empty.');

      // 2 — the planner card (format = the POST TYPE, not 'reel')
      setPhase('scheduling');
      const pieceId = newManualPieceId();
      const plan = await fetch('/api/admin/mothermode-planner', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'upsertPlan',
          pieceId,
          title: `${name} — ${platformTypeLabel(pickBrand, pickType)}`,
          platform: pickBrand,
          format: pickType,
          stage: 'Scheduled',
          scheduledAt: new Date(`${date}T${time}`).toISOString(),
        }),
      });
      const planJson = await plan.json();
      if (!planJson.success && !planJson.record) {
        throw new Error(planJson.error || 'Planner save failed');
      }

      // 3 — the tracked link (+ variant wiring), UTM derived from the picked platform
      if (utm) {
        const utmParams = utmForReel({
          platform: pickBrand,
          typeId: pickType,
          pieceId,
        });
        // The Content Hub's link creation flow: funnel / lead magnet / custom URL
        const mint = await fetch('/api/admin/mothermode-links', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'createLink',
            pieceId,
            label: `${name} — ${platformTypeLabel(pickBrand, pickType)}`,
            funnelId: destKind === 'funnel' ? funnelId : '',
            optinFunnelId: destKind === 'optin' ? optinFunnelId : '',
            funnelPage: destKind === 'url' ? '' : funnelPage,
            destinationUrl: destKind === 'url' ? customUrl.trim() || `${window.location.origin}/` : '',
            utmSource: utmParams.source,
            utmMedium: utmParams.medium,
            utmCampaign: utmParams.campaign,
            utmContent: utmParams.content,
            withShortLink: true,
          }),
        });
        const mintJson = await mint.json();
        const code = mintJson.link?.code || mintJson.code;
        if (mintJson.success && code) {
          if (variantId) {
            await fetch('/api/admin/reel-loop', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ action: 'link-variant', variantId, link: code }),
            });
          }
          // Capture the minted link for the "done" phase (copy button)
          setMintedLink({ code, url: `${window.location.origin}/go/${code}` });
          setPhase('done');
          return;
        }
      }
      setPhase('done');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Schedule failed');
      setPhase('form');
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4" onClick={onClose}>
      <div
        className="flex h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-bone/15 bg-ink shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-bone/10 px-5 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-bone">Schedule to the planner</h2>
            <span className="truncate text-[10px] text-bone/40">
              {name} · {targetLabel}
            </span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-bone/40 hover:bg-bone/10 hover:text-bone">
            —
          </button>
        </div>
        {phase === 'done' ? (
          /* — done phase: the minted link with a copy button — */
          <div className="mx-auto my-auto w-full max-w-sm space-y-2 p-5">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] p-3 text-center">
              <p className="text-[10px] font-semibold text-emerald-300/90">✓ Scheduled</p>
              <p className="mt-0.5 text-[10px] text-bone/60">
                {platformTypeLabel(pickBrand, pickType)} — the card is on the planner board.
              </p>
              {mintedLink && (
                <div className="mt-2 space-y-1.5">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-bone/40">
                    Tracked link
                  </p>
                  <div className="flex items-center gap-1.5">
                    <code className="min-w-0 flex-1 truncate rounded-lg border border-bone/15 bg-ink px-2.5 py-1.5 text-left text-[10px] font-mono text-bone/80">
                      /go/{mintedLink.code}
                    </code>
                    <button
                      onClick={() => {
                        void navigator.clipboard?.writeText(mintedLink.url);
                      }}
                      className="shrink-0 rounded-lg border border-brass/40 px-2 py-1.5 text-[9px] font-semibold text-brass hover:bg-brass/10"
                      title="Copy the tracked link"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-[9px] text-bone/35">
                    Clicks roll up onto this variant automatically.
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="flex w-full items-center justify-center rounded-lg bg-brass px-3 py-2.5 text-xs font-bold text-ink hover:bg-brass/90"
            >
              Done
            </button>
          </div>
        ) : (
          /* — the FULL two-column sheet: the Publish-view mock on the left,
               the schedule form on the right — the mock updates LIVE as you edit — */
          <div className="grid min-h-0 flex-1 grid-cols-[1fr_300px]">
            {/* LEFT: the pixel-faithful platform mock (the SAME one as the Publish view) */}
            <div className="flex min-h-0 items-center justify-center overflow-y-auto bg-black/60 p-6">
              {videoUrl ? (
                <PlatformMockView
                  platform={pickType}
                  videoUrl={videoUrl}
                  title={title}
                  caption={caption}
                  desc={description}
                />
              ) : (
                <div className="max-w-xs rounded-lg border border-dashed border-brass/30 bg-brass/[0.05] px-3 py-2.5 text-[10px] leading-relaxed text-brass/80">
                  No composed MP4 yet — scheduling runs the <strong>render</strong> (ffmpeg
                  compose) first, then schedules the finished video.
                </div>
              )}
            </div>
            {/* RIGHT: the schedule form */}
            <div className="min-h-0 space-y-2 overflow-y-auto border-l border-bone/10 p-4">
              {/* post assets — feed the mock LIVE */}
              <div className="space-y-1.5 rounded-xl border border-bone/15 bg-bone/[0.02] p-2">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-bone/40">
                  Post assets
                </p>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Title"
                  className="w-full rounded-lg border border-bone/15 bg-ink px-2 py-1.5 text-[11px] font-semibold text-bone/90 outline-none placeholder:text-bone/25"
                />
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={2}
                  placeholder="Caption"
                  className="w-full rounded-lg border border-bone/15 bg-ink px-2 py-1.5 text-[10px] text-bone/80 outline-none placeholder:text-bone/25"
                />
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Description (YouTube / LinkedIn)"
                  className="w-full rounded-lg border border-bone/15 bg-ink px-2 py-1.5 text-[10px] text-bone/80 outline-none placeholder:text-bone/25"
                />
                <input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="Tags, comma separated"
                  className="w-full rounded-lg border border-bone/15 bg-ink px-2 py-1.5 text-[10px] text-bone/80 outline-none placeholder:text-bone/25"
                />
              </div>
              <div className="space-y-2">
          {/* Platform picker — ALL six platforms, not just similar ones */}
          <div className="rounded-xl border border-bone/15 bg-bone/[0.03] p-2">
            <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wide text-bone/40">
              Post as
            </p>
            <div className="flex flex-wrap gap-1">
              {REEL_PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setPickBrand(p.id);
                    setPickType(defaultPostType(p.id));
                  }}
                  className={clsx(
                    'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold',
                    pickBrand === p.id
                      ? 'border-brass/60 bg-brass/10 text-brass'
                      : 'border-bone/15 text-bone/60 hover:bg-bone/10',
                  )}
                  title={`Post to ${p.label}`}
                >
                  <BrandLogo id={p.id} active={pickBrand === p.id} />
                  {p.label}
                </button>
              ))}
            </div>
            {/* post type selector for the picked platform */}
            <div className="mt-1.5 flex flex-wrap gap-1">
              {platformFor(pickBrand)?.types.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setPickType(t.id)}
                  className={clsx(
                    'rounded px-1.5 py-0.5 text-[9px] font-semibold',
                    pickType === t.id
                      ? 'bg-brass text-ink'
                      : 'text-bone/45 hover:bg-bone/10',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] font-semibold text-bone/70">
              {platformTypeLabel(pickBrand, pickType)}
            </p>
          </div>
          {/* Settings checklist — aspect + length fit for the chosen platform */}
          {checks.length > 0 && (
            <div className="space-y-1 rounded-xl border border-bone/10 bg-bone/[0.02] p-2">
              {checks.map((c, i) => (
                <p
                  key={i}
                  className={clsx(
                    'flex items-center gap-1.5 text-[10px]',
                    c.ok ? 'text-emerald-300/80' : 'text-amber-300/90',
                  )}
                >
                  <span className="shrink-0">
                    {c.ok ? '✓' : '✕'}
                  </span>
                  <span className="min-w-0">
                    <span className="font-semibold">{c.label}:</span> {c.detail}
                  </span>
                </p>
              ))}
              {!allOk && (
                <p className="pt-0.5 text-[9px] text-bone/40">
                  The reel may be letterboxed/cropped — you can still schedule, but this is worth a check.
                </p>
              )}
            </div>
          )}
          {/* Thumbnail picker — YouTube and any video that needs one */}
          {videoUrl && videoDurationSec != null && videoDurationSec > 0 && (
            <div className="rounded-xl border border-bone/15 bg-bone/[0.03] p-2">
              <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wide text-bone/40">
                Cover frame (thumbnail)
              </p>
              <div className="grid grid-cols-4 gap-1">
                {thumbCandidates.map((t) => (
                  <button
                    key={t}
                    onClick={() => setPickThumbT(t)}
                    className={clsx(
                      'overflow-hidden rounded border',
                      Math.abs(pickThumbT - t) < 0.05
                        ? 'border-brass'
                        : 'border-bone/15 hover:border-bone/35',
                    )}
                    title={`Use frame at ${fmtSec(t)} as the thumbnail`}
                  >
                    <Thumb url={videoUrl} t={t} className="h-12 w-full object-cover" />
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[9px] text-bone/35">
                {platformTypeLabel(pickBrand, pickType)} will use frame at {fmtSec(pickThumbT)} as the cover.
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 rounded-lg border border-bone/15 bg-ink px-2.5 py-2 text-[11px] text-bone/80"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-24 rounded-lg border border-bone/15 bg-ink px-2.5 py-2 text-[11px] text-bone/80"
            />
          </div>
          <label className="flex items-center justify-between rounded-lg border border-bone/15 px-2.5 py-2 text-[10px] font-semibold text-bone/60">
            <span>Tracked link (UTM — clicks roll up automatically)</span>
            <input
              type="checkbox"
              checked={utm}
              onChange={(e) => setUtm(e.target.checked)}
              className="accent-brass"
            />
          </label>
          {utm && (
            <div className="space-y-1.5 rounded-xl border border-bone/15 bg-bone/[0.02] p-2">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-bone/40">
                Destination
              </p>
              <div className="flex gap-1">
                {(
                  [
                    ['funnel', 'Funnel'],
                    ['optin', 'Lead magnet'],
                    ['url', 'Custom URL'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => {
                      setDestKind(id);
                      setFunnelPage('optin');
                    }}
                    className={clsx(
                      'rounded px-2 py-1 text-[9px] font-semibold',
                      destKind === id
                        ? 'bg-brass text-ink'
                        : 'text-bone/45 hover:bg-bone/10',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {destKind === 'funnel' && (
                <>
                  <select
                    value={funnelId}
                    onChange={(e) => setFunnelId(e.target.value)}
                    className="w-full rounded-lg border border-bone/15 bg-ink px-2.5 py-1.5 text-[10px] text-bone/80"
                  >
                    <option value="">— pick a funnel —</option>
                    {funnels.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={funnelPage}
                    onChange={(e) => setFunnelPage(e.target.value)}
                    className="w-full rounded-lg border border-bone/15 bg-ink px-2.5 py-1.5 text-[10px] text-bone/80"
                  >
                    {FUNNEL_PAGES.map((p) => (
                      <option key={p} value={p}>
                        {funnelPageLabel(p)}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {destKind === 'optin' && (
                <>
                  <select
                    value={optinFunnelId}
                    onChange={(e) => setOptinFunnelId(e.target.value)}
                    className="w-full rounded-lg border border-bone/15 bg-ink px-2.5 py-1.5 text-[10px] text-bone/80"
                  >
                    <option value="">— pick a lead magnet —</option>
                    {optinFunnels.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={funnelPage}
                    onChange={(e) => setFunnelPage(e.target.value)}
                    className="w-full rounded-lg border border-bone/15 bg-ink px-2.5 py-1.5 text-[10px] text-bone/80"
                  >
                    {OPTIN_PAGES.map((p) => (
                      <option key={p} value={p}>
                        {optinPageLabel(p)}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {destKind === 'url' && (
                <input
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://… custom destination (default: your site root)"
                  className="w-full rounded-lg border border-bone/15 bg-ink px-2.5 py-1.5 text-[10px] text-bone/80 outline-none placeholder:text-bone/25"
                />
              )}
              {campaignSlug && (
                <p className="text-[9px] text-bone/35">
                  Campaign: {campaignSlug}
                </p>
              )}
            </div>
          )}
          {err && <p className="text-[10px] text-red-300">{err}</p>}
          <button
            onClick={() => void submit()}
            disabled={phase !== 'form'}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brass px-3 py-2.5 text-xs font-bold text-ink hover:bg-brass/90 disabled:opacity-40"
          >
            {phase === 'rendering' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {phase === 'scheduling' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {phase === 'rendering'
              ? 'Rendering the MP4…'
              : phase === 'scheduling'
                ? 'Scheduling…'
                : videoUrl
                  ? 'Schedule it'
                  : 'Render & schedule'}
          </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Tab = 'clips' | 'captions' | 'scripts' | 'board' | 'director' | 'scoreboard' | 'vault' | 'post' | 'genes' | 'clone';

/** R6a Board shot: one line of the story — prompt + footage, in order. */
interface BoardShot {
  id: string;
  label: string;
  prompt: string;
  durSec: number;
  url: string;
}


interface LoopRow {
  variant: { id: string; label: string; composedUrl: string; createdAt: string | null; projectId: string };
  projectName: string;
  impressions: number;
  clicks: number;
}

interface LoopWinner {
  variant: LoopRow['variant'];
  projectName: string;
  ctr: number;
}

interface DirectorAction {
  type: string;
  index?: number;
  trimEndSec?: number;
  from?: number;
  to?: number;
}

interface DirectorMessage {
  role: 'user' | 'director';
  text: string;
  applied?: string[];
}

export default function ReelStudioPage() {
  const [projects, setProjects] = useState<ReelProject[] | null>(null);
  const [project, setProject] = useState<ReelProject | null>(null);
  const [tab, setTab] = useState<Tab>('clips');
  const [busy, setBusy] = useState(false);
  const [uploadJob, setUploadJob] = useState<{
    name: string;
    pct: number;
    phase: string;
    blobUrl: string | null;
  } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [addUrl, setAddUrl] = useState('');
  const [voText, setVoText] = useState('');
  const [brollTopic, setBrollTopic] = useState('');
  /** R6a the Board (storyboard mode): shots with prompt + footage, persisted per reel. */
  const [boardShots, setBoardShots] = useState<BoardShot[]>([]);
  /** Which shot the Hub picker is feeding (null = the picker belongs to add-scene). */
  const [hubShotId, setHubShotId] = useState<string | null>(null);
  const [storyLine, setStoryLine] = useState('');
  const [directorMessages, setDirectorMessages] = useState<DirectorMessage[]>([]);
  const [directorInput, setDirectorInput] = useState('');
  const [loopRows, setLoopRows] = useState<LoopRow[] | null>(null);
  const [loopWinner, setLoopWinner] = useState<LoopWinner | null>(null);
  /** R14: variant schedule statuses for the Scoreboard chips ("Scheduled · platform"). */
  const [loopStatuses, setLoopStatuses] = useState<
    Record<
      string,
      {
        scheduled: boolean;
        platform: string | null;
        format: string | null;
        publishState: string | null;
        linkCode?: string | null;
        linkClicks?: number;
      }
    >
  >({});
  /** R6c: which hook GENE leads across variants ("question-hooks beat stat-hooks"). */
  const [geneLeaderLine, setGeneLeaderLine] = useState<string | null>(null);
  const [batchResults, setBatchResults] = useState<{ name: string; status: string }[] | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);

  /**
   * ONE render job for all three surfaces: the header button, the Post panel,
   * and the Publish view. Called exactly once, here, and passed down — see
   * useRenderJob.ts for why that's a prop and not a context.
   *
   * `getReelId` is a thunk on purpose: it's read at click time, so it doesn't
   * matter that `project` is declared further down this file.
   */
  const renderJob = useRenderJob({
    getReelId: () => project?.id ?? null,
    // Hand the render the timeline as it stands RIGHT NOW. Without this the
    // server rebuilt the plan from the saved row, so a split (or trim, or
    // reorder, or caption restyle) made since the last save never reached the
    // MP4 — the export came back as the reel from before the edit.
    getProject: () => project ?? null,
    onRendered: (url) => {
      patch({ composedUrl: url });
      setNote('Render done — captions and animations are burned in. Save to keep the link.');
    },
  });
  /** The `?` keyboard-shortcut overlay. */
  const [helpOpen, setHelpOpen] = useState(false);
  /**
   * Media cues (word-triggered image fly-ins): cue mode turns subtitle word
   * clicks into "attach an image here". The picker lists Media Library images.
   */
  const [cueMode, setCueMode] = useState(false);
  const [cuePickerWord, setCuePickerWord] = useState<number | null>(null);
  const [cueAssets, setCueAssets] = useState<{ url: string; name: string; tags: string[] }[] | null>(null);
  /** Cue picker sources: upload rides the signed-URL flow, AI rides the content
   *  image pipeline — both land in the Media Library AND attach in one step. */
  const [cueUploadBusy, setCueUploadBusy] = useState(false);
  const [cueAiPrompt, setCueAiPrompt] = useState('');
  const [cueAiBusy, setCueAiBusy] = useState(false);
  const cueImageInput = useRef<HTMLInputElement>(null);
  /** GIPHY sticker source for the cue picker: search → a transparent sticker
   *  attaches as the cue's image (the <img>/<Gif> render). */
  const [stickerQuery, setStickerQuery] = useState('');
  const [stickerResults, setStickerResults] = useState<GiphySticker[] | null>(null);
  const [stickerBusy, setStickerBusy] = useState(false);
  /** Which attached cue's style editor is open (by cue id; null = closed). */
const [cueStyleEditId, setCueStyleEditId] = useState<string | null>(null);
// Live drag state for the cue being styled — LOCAL only while dragging
// (onMove), persisted once on release (onCommit). The same split the caption
// puck uses, so a drag never hammers the API.
const [cueDragLocal, setCueDragLocal] = useState<{
  xPct: number;
  yPct: number;
  widthPct: number;
} | null>(null);
  const [autoTranscribeOnImport, setAutoTranscribeOnImport] = useState(true);
  // ccOn lives up here (not mid-file) so the caption-edit hook can read it —
  // the hook call sits above the JSX that toggles it.
  const [ccOn, setCcOn] = useState(true);
  /** Media Library audio (kind 'audio') for cue + word SFX pickers. */
  const [sfxAssets, setSfxAssets] = useState<{ url: string; name: string }[] | null>(null);
  const cueSfxInput = useRef<HTMLInputElement>(null);
  const wordSfxInput = useRef<HTMLInputElement>(null);
  /** The Reel Cue Autopilot run (the gated recipe) starting up. */
  const [cueAutopilotBusy, setCueAutopilotBusy] = useState(false);
  /** Caption-behind-the-speaker: a card's background removal is in flight. */
  const [behindBusy, setBehindBusy] = useState(false);
  /** Content Hub generated-video picker state (the bridge in). */
  const [hubOpen, setHubOpen] = useState(false);
  const [hubPieces, setHubPieces] = useState<ContentPiece[] | null>(null);
  /** The Vault: intro/outro/reaction hook library (win-rate ranked). */
  const [vaultAssets, setVaultAssets] = useState<VaultAsset[] | null>(null);
  const [vaultKindFilter, setVaultKindFilter] = useState<VaultKind | 'all'>('all');
  const [vaultIntroId, setVaultIntroId] = useState<string | null>(null);
  const [vaultOutroId, setVaultOutroId] = useState<string | null>(null);
  const [vaultTags, setVaultTags] = useState('');
  const [vaultUploadKind, setVaultUploadKind] = useState<VaultKind>('reaction');
  const vaultFileInput = useRef<HTMLInputElement>(null);



  const [aspect, setAspect] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [fit, setFit] = useState<'contain' | 'cover'>('contain');
  const [zoom, setZoom] = useState(1);
  /** R8 post target: one object drives aspect, lens, story guides, and Publish view. */
  const [postTarget, setPostTarget] = useState<PostTarget>({ brand: 'youtube', type: 'shorts' });
  const [targetOpen, setTargetOpen] = useState(false);
  const [lensMode, setLensMode] = useState<'clean' | 'platform'>('clean');
  /** R10: the persistent variant gene strip beside the canvas (show/hide). */
  const [geneStrip, setGeneStrip] = useState(true);
  /** R7 shared copy pool (title/caption/desc/tags/thumb) — canvas lens + Publish view share it. */
  const [copyPool, setCopyPool] = useState<{
    title: string;
    caption: string;
    desc: string;
    tags: string;
    thumbT?: number;
  } | null>(null);
  const [playing, setPlaying] = useState(false);
  /** Set when the stage <video> fires onError — the file can't decode in the
   *  browser (HEVC/ProRes/.mov). Shown ON the stage so "uploads but shows
   *  nothing" stops being a silent black box. */
  const [stageVideoError, setStageVideoError] = useState<string | null>(null);
  /** R26: per-reel target-length override (null = the post type's platform default). */
  const [targetOverride, setTargetOverride] = useState<number | null>(null);
  const stripScrollRef = useRef<HTMLDivElement>(null);

  /** R15: the stage is measured — the canvas is sized in pixels, never cut off. */
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      setStageSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setStageSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
    // re-arm when a project mounts — the stage doesn't exist on the empty state,
    // so the observer must attach AFTER project selection or the canvas never gets sized
  }, [project?.id]);
  /** R28: the strip is measured too — the timeline ALWAYS fills the canvas width. */
  const [stripWidth, setStripWidth] = useState(0);
  useEffect(() => {
    const el = stripScrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setStripWidth(el.clientWidth));
    ro.observe(el);
    setStripWidth(el.clientWidth);
    return () => ro.disconnect();
    // re-arm when the strip mounts (it only exists once a reel has scenes)
  }, [project?.id, project?.clips.length]);

  const stageBox = useMemo(() => {
    const [aw, ah] = aspect === '9:16' ? [9, 16] : aspect === '1:1' ? [1, 1] : [16, 9];
    // the variant gene strip eats w-40 + mr-3 of the stage when it's showing
    const availW = stageSize.w - (geneStrip ? 172 : 0);
    const w = Math.min(availW, aspect === '16:9' ? 768 : availW);
    const measured = fitAspect(w, stageSize.h, aw, ah);
    // NEVER hand the preview a 0×0 box. Until the ResizeObserver has measured
    // the stage (first paint, or the moment a draft project mounts it), w/h are
    // 0 and fitAspect returns {0,0} — and the preview branches style themselves
    // with `width: stageBox.w || undefined`, i.e. they COLLAPSE to nothing:
    // "the whole preview area is blank — no video, no upload bar, nothing".
    // Fall back to a sensible default for the aspect so the player always has
    // real dimensions; the observer overwrites it the moment it measures.
    if (measured.w > 0 && measured.h > 0) return measured;
    return fitAspect(aw === 16 ? 768 : 360, ah === 16 ? 432 : 480, aw, ah);
  }, [stageSize, aspect, geneStrip]);

  /** R15 keyframe editing: patch one key, add at the playhead, remove — undo-safe. */
  function setMotionKey(
    clip: ReelClip,
    idx: number,
    partial: Partial<import('@/lib/mothermode/reel/motion').MotionKey>,
  ) {
    patchClip(clip.id, {
      motion: (clip.motion ?? []).map((k, i) => (i === idx ? { ...k, ...partial } : k)),
    });
  }
  function addMotionKey(clip: ReelClip) {
    const t = Math.round(Math.max(0, Math.min(previewTime, effectiveClipDuration(clip))) * 100) / 100;
    const sampled = sampleMotion(clip.motion, t);
    patchClip(clip.id, {
      motion: [...(clip.motion ?? []), { ...sampled, t }].sort((a, b) => a.t - b.t),
    });
  }
  function removeMotionKey(clip: ReelClip, idx: number) {
    const keys = (clip.motion ?? []).filter((_, i) => i !== idx);
    patchClip(clip.id, { motion: keys.length >= 2 ? keys : undefined });
  }

  const fileInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const [playheadSec, setPlayheadSec] = useState(0);
  const pendingSeekRef = useRef<number | null>(null);
  /**
   * R25 THE PLAYBACK CLOCK — the single source of truth for time.
   *
   * The old model let each clip's <video> free-run and tried to FENCE it at
   * the trim — three patches later it still leaked (state/element races, NaN
   * ends, swap gaps). The clock inverts the relationship: a rAF loop owns the
   * timeline second, and the video element is a dumb frame server that gets
   * HARD-SYNCED to the clock every frame (drift > 0.12s = seek). Overrun is
   * impossible because the element never decides anything.
   */
  const clockRef = useRef({ t: 0, playing: false, lastTs: 0, raf: 0 });
  /**
   * R25b: LIVE mirror for the clock loop. The rAF chain re-schedules the SAME
   * closure every frame, so anything it reads from render scope (project,
   * total) FROZE at play-press — trimming mid-play used to leave the clock
   * running to the OLD total. The loop reads through this ref, never a closure.
   */
  const clockStateRef = useRef<{ project: ReelProject | null; total: number }>({
    project: null,
    total: 0,
  });
  /** Set while a src swap is in flight so the swap's pause event isn't read as a user pause. */
  const swappingRef = useRef(false);
  /** R25 overlay (b-roll) layer element + its pending seek. */
  const overlayRef = useRef<HTMLVideoElement>(null);
  const pendingOvSeekRef = useRef<number | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);

  /**
   * Automatic audio syncing (the easy-peasy-ease trick): the audio bed rides a
   * hidden <audio> that follows the preview. It starts when the playhead
   * crosses the bed's offset, pauses when the preview pauses, re-seeks when
   * drift exceeds ~0.35s, and — the point of a bed — keeps rolling across
   * scene boundaries while the preview auto-advances.
   */
  function syncAudioAt(tSec: number, play: boolean) {
    const a = audioRef.current;
    const bed = clockStateRef.current.project?.audio;
    if (!a || !bed) return;
    const t = tSec - bed.offsetSec;
    if (play && t >= 0) {
      if (Math.abs(a.currentTime - t) > 0.35) {
        try {
          a.currentTime = t;
        } catch {
          /* metadata pending */
        }
      }
      if (a.paused) void a.play().catch(() => {});
    } else if (!play) {
      a.pause();
    } else {
      a.pause();
      try {
        a.currentTime = 0;
      } catch {
        /* metadata pending */
      }
    }
  }

  /** Drive the preview to the exact cut frame while trimming (the CLOCK seeks). */
  function scrubToCut(clip: ReelClip, trimEndSec: number) {
    if (!project) return;
    const idx = project.clips.findIndex((c) => c.id === clip.id);
    if (idx < 0) return;
    const eff = Math.max(0.1, clip.durationSec - (clip.trimStartSec ?? 0) - trimEndSec);
    seekTimeline(timelineStartOf(project.clips, idx) + Math.max(0, eff - 0.05));
  }

  /** Drive the preview to the new FIRST frame while dragging the left edge. */
  function scrubToIn(clip: ReelClip, inSec: number) {
    if (!project) return;
    const idx = project.clips.findIndex((c) => c.id === clip.id);
    if (idx < 0) return;
    const local = Math.max(0, inSec - (clip.trimStartSec ?? 0)) + 0.05;
    seekTimeline(timelineStartOf(project.clips, idx) + local);
  }


  const load = useCallback(async () => {
    try {
      const res = await fetch(API, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) setProjects(json.projects);
    } catch {
      /* keep last good list */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Warm the filmstrip: prefetch every scene's sprite tile once per project so
  // dragging/scrubbing never waits on the thumbnail network (R4: 4× fewer calls).
  useEffect(() => {
    if (!project) return;
    for (const c of project.clips) {
      const img = new Image();
      img.src = spriteUrl(c.url, c.durationSec);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, project?.clips.length]);

  // Warm the cue images on project load (same pattern as the sprite prefetch
  // above) — after a refresh the first attach's plan rebuild would re-fetch
  // them cold, and a cold <Img>/<Gif> mount delayRenders the Player (the
  // stage blanks until it resolves).
  useEffect(() => {
    if (!project) return;
    for (const c of project.mediaCues ?? []) {
      const img = new Image();
      img.src = c.url;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, project?.mediaCues?.length]);


  // Deep-link bridge: /admin/reel-studio?reel=<id> opens that reel on the
  // Clone tab (the twins page's "New video" lands here).
  const reelLinkHandledRef = useRef(false);
  useEffect(() => {
    if (projects === null || reelLinkHandledRef.current) return;
    reelLinkHandledRef.current = true;
    try {
      const id = new URL(window.location.href).searchParams.get('reel');
      if (!id) return;
      const p = projects.find((x) => x.id === id);
      if (!p) return;
      window.history.replaceState(null, '', window.location.pathname);
      setProject(p);
      setSelectedClip(null);
      setTab('clone');
    } catch {
      /* malformed URL — ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  // Deep-link bridge: /admin/reel-studio?import=<video-url> auto-builds a reel
  // from a Content Hub render. Runs once the project list has loaded.
  const importHandledRef = useRef(false);
  useEffect(() => {
    if (projects === null || importHandledRef.current) return;
    importHandledRef.current = true;
    try {
      const url = new URL(window.location.href).searchParams.get('import');
      if (!url || !/^https?:\/\//i.test(url)) return;
      window.history.replaceState(null, '', window.location.pathname);
      void (async () => {
        const dur = await probeDuration(url);
        const name = decodeURIComponent(url).split('/').pop()?.split('?')[0]?.slice(0, 60) || 'Hub render';
        const clip = { id: makeClipId(), name, url, durationSec: dur || 5, trimEndSec: 0 };
        const json = await post({ action: 'save', project: { name: `Hub: ${name}`.slice(0, 150), clips: [clip], audio: null } });
        if (json?.project) {
          setProject(json.project as ReelProject);
          setSelectedClip(clip.id);
          setNote('Imported from the Content Hub — it is a scene on your timeline.');
          void load();
        }
      })();
    } catch {
      /* malformed URL — ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  /** Open the Hub picker: every generated piece with a video media URL. */
  async function openHubPicker() {
    setHubOpen((v) => !v);
    if (hubPieces !== null) return;
    try {
      const pieces = await listGenerated();
      setHubPieces(
        pieces.filter(
          (p) => p.media?.type === 'video' && typeof p.media?.src === 'string' && /^https?:\/\//i.test(p.media.src),
        ),
      );
    } catch {
      setHubPieces([]);
    }
  }

  /** One click: a Hub render becomes a scene on the timeline. */
  async function importHubPiece(p: ContentPiece) {
    const url = p.media?.src as string;
    const dur = await probeDuration(url);
    const clip = {
      id: makeClipId(),
      name: (p.hook || 'Hub render').slice(0, 60),
      url,
      durationSec: dur || 5,
      trimEndSec: 0,
    };
    insertClipAtPlayhead(clip);
    setSelectedClip(clip.id);
    if (autoTranscribeOnImport) {
      window.setTimeout(() => { void transcribeCurrentClip(); }, 400);
    }
    setTab('clips');
    setHubOpen(false);
    setNote('Hub render added to the timeline.');
  }


  async function post(body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Action failed');
      return json;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
      return null;
    } finally {
      setBusy(false);
    }
  }

  /** Undo history: a 50-deep stack. Name-only patches don't record (text undo lives in the inputs). */
  const historyRef = useRef<{ past: ReelProject[]; future: ReelProject[] }>({
    past: [],
    future: [],
  });
  const [, setHistTick] = useState(0);
  const bumpHist = () => setHistTick((t) => t + 1);

  function recordHistory() {
    if (!project) return;
    historyRef.current.past.push(project);
    if (historyRef.current.past.length > 50) historyRef.current.past.shift();
    historyRef.current.future = [];
    bumpHist();
  }

  function undoEdit() {
    const prev = historyRef.current.past.pop();
    if (!prev || !project) return;
    historyRef.current.future.push(project);
    setProject(prev);
    bumpHist();
  }

  function redoEdit() {
    const next = historyRef.current.future.pop();
    if (!next || !project) return;
    historyRef.current.past.push(project);
    setProject(next);
    bumpHist();
  }

  // A different reel = a different story: reset history on project switch.
  useEffect(() => {
    historyRef.current = { past: [], future: [] };
    bumpHist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  function patch(partial: Partial<ReelProject>) {
    if (!project) return;
    const keys = Object.keys(partial);
    if (!(keys.length === 1 && keys[0] === 'name')) recordHistory();
    setProject({ ...project, ...partial });
  }


  function patchClip(id: string, partial: Partial<ReelClip>) {
    if (!project) return;
    patch({ clips: project.clips.map((c) => (c.id === id ? { ...c, ...partial } : c)) });
  }

  /**
   * Patch a clip through the STATE UPDATER, not the render-scope `project`.
   *
   * Upload callbacks (duration probe, "storage is ready" swap) resolve seconds
   * to minutes after `addUpload` was called, by which time the `project` those
   * closures captured is ancient — it predates the clip we just inserted. The
   * plain `patchClip` then wrote that stale timeline back, which DELETED the
   * new scene the instant the upload finished: "Uploaded … (152.9s)" with an
   * empty player. Reading the live project inside the updater can't go stale.
   */
  function patchClipLive(id: string, partial: Partial<ReelClip>) {
    setProject((p) =>
      p ? { ...p, clips: p.clips.map((c) => (c.id === id ? { ...c, ...partial } : c)) } : p,
    );
  }

  /** R25 overlay (b-roll) layers: patch one, or add one at the playhead. */
  function patchOverlay(id: string, partial: Partial<ReelOverlayClip>) {
    if (!project) return;
    patch({
      overlays: (project.overlays ?? []).map((o) => (o.id === id ? { ...o, ...partial } : o)),
    });
  }

  const [overlayUrl, setOverlayUrl] = useState('');
  /** Pexels b-roll source for the overlay lane: search → a stock clip attaches
   *  as an overlay at the playhead (no Seedance render, no upload). */
  const [brollQuery, setBrollQuery] = useState('');
  const [brollResults, setBrollResults] = useState<PexelsClip[] | null>(null);
  const [brollBusy, setBrollBusy] = useState(false);

  async function addOverlayByUrl() {
    const url = overlayUrl.trim();
    if (!/^https?:\/\//i.test(url) || !project) return;
    const dur = await probeDuration(url);
    if (!dur) {
      setError('Could not read that video URL — it must be a direct, public MP4/WebM link.');
      return;
    }
    const o: ReelOverlayClip = {
      id: makeClipId(),
      name: url.split('/').pop()?.split('?')[0]?.slice(0, 60) || 'Overlay',
      url,
      durationSec: dur,
      trimEndSec: 0,
      offsetSec: Math.round(clockRef.current.t * 10) / 10,
    };
    patch({ overlays: [...(project.overlays ?? []), o] });
    setOverlayUrl('');
    setNote(`Overlay layer added at ${fmtSec(o.offsetSec)} — drag it on the violet lane.`);
  }

  /** Pexels b-roll: search → a stock clip attaches as an overlay at the playhead. */
  async function searchBroll() {
    const q = brollQuery.trim();
    if (!q || brollBusy) return;
    setBrollBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reel-broll?q=${encodeURIComponent(q)}`);
      const j = (await res.json()) as { success?: boolean; clips?: PexelsClip[]; error?: string };
      if (!res.ok || !j.success) {
        setError(j.error || 'B-roll search failed.');
        setBrollResults([]);
        return;
      }
      setBrollResults(j.clips ?? []);
    } catch {
      setBrollResults([]);
    } finally {
      setBrollBusy(false);
    }
  }

  /** A picked Pexels clip becomes an overlay at the playhead (the violet lane). */
  function addBrollOverlay(c: PexelsClip) {
    if (!project) return;
    const o: ReelOverlayClip = {
      id: makeClipId(),
      name: (brollQuery.trim() || 'B-roll').slice(0, 60),
      url: c.videoUrl,
      durationSec: c.durationSec || 5,
      trimEndSec: 0,
      offsetSec: Math.round(clockRef.current.t * 10) / 10,
    };
    patch({ overlays: [...(project.overlays ?? []), o] });
    setNote(`B-roll added at ${fmtSec(o.offsetSec)} — drag it on the violet lane.`);
  }

  async function save(): Promise<ReelProject | null> {
    if (!project) return null;
    const json = await post({ action: 'save', project });
    if (json?.project) {
      setProject(json.project as ReelProject);
      setNote('Saved.');
      void load();
      return json.project as ReelProject;
    }
    return null;
  }

  async function newProject() {
    const json = await post({
      action: 'save',
      project: { name: 'Untitled reel', clips: [], audio: null },
    });
    if (json?.project) {
      setProject(json.project as ReelProject);
      setSelectedClip(null);
      void load();
    }
  }

  async function addClipByUrl() {
    const url = addUrl.trim();
    if (!/^https?:\/\//i.test(url) || !project) return;
    const dur = await probeDuration(url);
    if (!dur) {
      setError('Could not read that video URL — it must be a direct, public MP4/WebM link.');
      return;
    }
    const name = url.split('/').pop()?.split('?')[0]?.slice(0, 60) || 'Clip';
    const clip = { id: makeClipId(), name, url, durationSec: dur, trimEndSec: 0 };
    insertClipAtPlayhead(clip);
    setSelectedClip(clip.id);
    setAddUrl('');
  }


  async function addUpload(file: File, kind: 'video' | 'audio') {
    setBusy(true);
    setError(null);
    const localBlob = kind === 'video' ? URL.createObjectURL(file) : null;
    setUploadJob({
      name: file.name,
      pct: 2,
      phase: 'Reading file…',
      blobUrl: localBlob,
    });
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || (kind === 'audio' ? 'mp3' : 'mp4');
      // Drop the clip on the timeline NOW so the player never goes blank.
      // Probe duration in the background — a 3-min file can take a while.
      let clipId: string | null = null;
      let localDur = 0;
      if (kind === 'video' && localBlob) {
        const clip = {
          id: makeClipId(),
          name: file.name.slice(0, 60),
          url: localBlob,
          durationSec: 5,
          trimEndSec: 0,
        };
        clipId = clip.id;
        insertClipAtPlayhead(clip);
        setSelectedClip(clip.id);
        setTab('clips');
        void probeDuration(localBlob).then((dur) => {
          if (dur > 0 && clipId) {
            localDur = dur;
            patchClipLive(clipId, { durationSec: dur });
          }
        });
      }
      setUploadJob((j) => (j ? { ...j, pct: 8, phase: 'Requesting upload slot…' } : j));
      const mint = await fetch(UPLOAD_API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ext, contentType: file.type || undefined, kind }),
      });
      const mintJson = await mint.json();
      if (!mintJson.success) throw new Error(mintJson.error || 'Could not mint an upload URL');

      const putHeaders: Record<string, string> = {
        'content-type': file.type || 'application/octet-stream',
        'x-upsert': 'false',
      };
      if (mintJson.token) putHeaders.authorization = `Bearer ${mintJson.token}`;
      setUploadJob((j) => (j ? { ...j, pct: 10, phase: `Uploading ${file.name}…` } : j));
      await putWithProgress(mintJson.signedUrl, file, putHeaders, (pct) => {
        setUploadJob((j) => (j ? { ...j, pct: 10 + Math.round(pct * 0.8), phase: `Uploading ${pct}%` } : j));
      });

      const url = String(mintJson.publicUrl || '');
      if (!url) throw new Error('Upload returned no public URL');
      setUploadJob((j) => (j ? { ...j, pct: 92, phase: 'Confirming the file is playable…' } : j));

      if (kind === 'video' && clipId) {
        const ready = await waitUntilPlayable(url);
        if (ready) {
          // Warm the browser cache BEFORE we swap the <video> src. Without this the
          // player briefly has no decoded frame and the canvas goes black/blank.
          try {
            await fetch(url, { headers: { range: 'bytes=0-262143' }, cache: 'force-cache' });
          } catch {
            /* warming is best-effort */
          }
        }
        patchClipLive(clipId, { url: ready ? url : localBlob!, durationSec: localDur || 5 });
        setNote(
          ready
            ? `Uploaded ${file.name} (${(localDur || 0).toFixed(1)}s).`
            : `Uploaded ${file.name} (${(localDur || 0).toFixed(1)}s). Storage is still catching up — preview is using the local file.`,
        );
        // NOTE: we deliberately do NOT revoke localBlob here. The player may still be
        // holding it for a frame or two during the swap, and revoking mid-swap is what
        // made the video vanish the instant the upload finished. It is released on unload.
      } else {

        setProject((p) =>
          p
            ? { ...p, audio: { url, name: file.name.slice(0, 60), offsetSec: 0, durationSec: null } }
            : p,
        );
        setTab('clips');
        setNote(`Uploaded ${file.name} (audio).`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      if (localBlob) URL.revokeObjectURL(localBlob);
    } finally {
      setUploadJob(null);
      setBusy(false);
    }
  }

  async function generateVoiceover() {
    const text = voText.trim();
    if (!text || !project) return;
    const json = await post({ action: 'voiceover', text });
    const url = typeof json?.url === 'string' ? (json.url as string) : '';
    if (url) {
      patch({ audio: { url, name: 'ElevenLabs voiceover', offsetSec: 0, durationSec: null } });
      setNote('Voiceover generated and attached.');
    }
  }

  /**
   * R25: fal compose can't do in-points, so every clip with a `trimStartSec`
   * gets materialized first — the ffmpeg worker re-cuts the head off for real
   * (the same path the silence chain uses), leaving a clean 0-start source.
   */
  async function materializeInPoints(): Promise<boolean> {
    if (!project) return false;
    for (const c of project.clips) {
      const ts = c.trimStartSec ?? 0;
      if (ts <= 0.05) continue;
      setNote(`Materializing the in-point on "${c.name}" (ffmpeg head-cut)…`);
      const saved = await save();
      if (!saved) return false;
      const json = await post({
        action: 'split',
        id: saved.id,
        clipId: c.id,
        atSec: Math.round(ts * 10) / 10,
        sourceSeconds: true, // cut AT the in-point, in source seconds
      });
      if (!json?.project) return false;
      const p = json.project as ReelProject;
      const next: ReelProject = { ...p, clips: p.clips.filter((x) => x.id !== c.id) };
      setProject(next);
      await post({ action: 'save', project: next });
    }
    return true;
  }

  async function compose() {
    // THE SIMPLE RENDER — the local ffmpeg compose honors in-points natively,
    // so there's NO in-point materialization pre-step anymore. Save and compose.
    const saved = await save();
    if (!saved) return;
    const json = await post({ action: 'compose', id: saved.id });
    if (json?.videoUrl) {
      setProject(json.project as ReelProject);
      setNote(`Reel composed (${json.path === 'fal' ? 'fal' : 'local ffmpeg'}) — the final MP4 is ready below.`);
      void load();
    }
  }

  /** R18: burn the karaoke captions INTO the MP4 (frame-accurate with the stage). */
  async function burnCaptions() {
    const saved = await save();
    if (!saved) return;
    setBusy(true);
    setNote('Burning captions into the MP4 (word-accurate)…');
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'burn-captions', id: saved.id }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Burn-in failed');
      setNote(`Captioned MP4 ready — ${json.words} words burned in.`);
      void navigator.clipboard?.writeText(String(json.url));
      window.open(String(json.url), '_blank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Burn-in failed');
    } finally {
      setBusy(false);
    }
  }

  /** AI suggestion fills the Board (the old b-roll Director flow, now native). */
  async function suggestBoard() {
    const topic = brollTopic.trim() || project?.name || '';
    if (!topic) return;
    const json = await post({
      action: 'suggest-broll',
      topic,
      clipNames: project?.clips.map((c) => c.name) ?? [],
    });
    if (json?.shots) {
      const suggestions = json.shots as ShotSuggestion[];
      setBoardShots(
        suggestions.map((s) => ({
          id: makeClipId(),
          label: `shot ${s.index}`,
          prompt: `${s.camera}. ${s.sceneNotes}${s.motion ? ` Motion: ${s.motion}` : ''}`,
          durSec: 3,
          url: '',
        })),
      );
      const story = json.story as { hook?: string; coreEmotion?: string } | undefined;
      setStoryLine(story?.hook || story?.coreEmotion || '');
    }
  }

  function patchShot(id: string, partial: Partial<BoardShot>) {
    setBoardShots((s) => s.map((x) => (x.id === id ? { ...x, ...partial } : x)));
  }

  function addBoardShot() {
    setBoardShots((s) => [
      ...s,
      { id: makeClipId(), label: `shot ${s.length + 1}`, prompt: '', durSec: 3, url: '' },
    ]);
  }

  function removeBoardShot(id: string) {
    setBoardShots((s) => s.filter((x) => x.id !== id));
  }

  function moveBoardShot(id: string, dir: -1 | 1) {
    setBoardShots((s) => {
      const i = s.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= s.length) return s;
      const next = s.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  /** The Hub picker drops a render's URL into THIS shot's slot. */
  function pickHubForShot(p: ContentPiece) {
    if (!hubShotId) return;
    patchShot(hubShotId, { url: String(p.media?.src || '') });
    setHubShotId(null);
    setHubOpen(false);
  }

  /** The Board becomes scenes, in board order (undo-safe via patch). */
  async function assembleBoard() {
    if (!project) return;
    const clips: ReelClip[] = [];
    for (const s of boardShots) {
      const url = s.url.trim();
      if (!/^https?:\/\//i.test(url)) continue;
      const dur = await probeDuration(url);
      clips.push({
        id: makeClipId(),
        name: s.label.slice(0, 60) || 'Board shot',
        url,
        durationSec: dur || s.durSec || 3,
        trimEndSec: 0,
      });
    }
    if (!clips.length) {
      setError('Give at least one shot a video URL (paste one or pick from the Hub).');
      return;
    }
    patch({ clips: [...project.clips, ...clips] });
    setNote(`Board assembled — ${clips.length} scene(s) added to the timeline.`);
    setTab('clips');
  }

  // The Board persists per reel, client-side (it's a worksheet, not timeline state).
  useEffect(() => {
    try {
      const raw = project?.id ? localStorage.getItem(`reel-studio:board:${project.id}`) : null;
      setBoardShots(raw ? (JSON.parse(raw) as BoardShot[]) : []);
    } catch {
      setBoardShots([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);
  useEffect(() => {
    if (!project?.id) return;
    try {
      localStorage.setItem(`reel-studio:board:${project.id}`, JSON.stringify(boardShots));
    } catch {
      /* private mode */
    }
  }, [boardShots, project?.id]);

  /** R6b Variant Lab: spin vault hook × body shape × vault outro into descendants. */
  async function spinVariantsLab() {
    if (!project) return;
    setError(null);
    setNote('Spinning gene variants…');
    try {
      const res = await fetch('/api/admin/reel-loop', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'spin-variants', id: project.id }),
      });
      const json = await res.json();
      if (json.success) {
        setNote(
          json.created.length > 0
            ? `Variant Lab spun ${json.created.length} descendant(s) with vault genes — compose them with the queue.`
            : 'Nothing new to spin — the Vault is empty (upload a hook/outro clip there first).',
        );
        void load();
      } else {
        setError(json.error || 'Spin failed');
      }
    } catch (err) {
      setError(err instanceof Error ? `Spin failed: ${err.message}` : 'Spin failed');
    }
  }

  /** Vault: load assets (win-rate ranked). */
  async function loadVault() {
    try {
      const res = await fetch('/api/admin/clipping-vault', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) setVaultAssets(json.assets as VaultAsset[]);
    } catch {
      /* keep last good list */
    }
  }

  /** Bookends: pin an intro at scene 0 and/or an outro as the last scene (idempotent). */
  function setBookend(kind: 'intro' | 'outro', assetId: string | null) {
    if (!project) return;
    const introId = kind === 'intro' ? assetId : vaultIntroId;
    const outroId = kind === 'outro' ? assetId : vaultOutroId;
    const intro = (vaultAssets ?? []).find((a) => a.id === introId) ?? null;
    const outro = (vaultAssets ?? []).find((a) => a.id === outroId) ?? null;
    if (kind === 'intro') setVaultIntroId(assetId);
    else setVaultOutroId(assetId);
    patch({ clips: applyBookends(project.clips, intro, outro) });
  }

  /** Pattern interrupt: drop a reaction hook right after the current scene. */
  function insertVaultHook(a: VaultAsset) {
    if (!project) return;
    const idx = currentClip ? project.clips.findIndex((c) => c.id === currentClip.id) : -1;
    patch({ clips: insertHookAt(project.clips, a, idx) });
    setNote(`Hook inserted: ${a.name}`);
    void fetch('/api/admin/clipping-vault', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'touch', id: a.id }),
    }).catch(() => {});
  }

  /** R4 split-screen: the current scene on top, the reaction asset on the bottom third. */
  async function reactSplitScreen(a: VaultAsset) {
    if (!project || !currentClip) return;
    setBusy(true);
    setError(null);
    setNote(`Split-screen rendering — ${currentClip.name} over ${a.name}…`);
    try {
      const res = await fetch('/api/admin/reel-splitscreen', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mainUrl: currentClip.url, reactionUrl: a.url }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Split-screen failed');
      const url = String(json.url);
      const dur = await probeDuration(url);
      const clip = {
        id: makeClipId(),
        name: `${currentClip.name} + ${a.name}`.slice(0, 60),
        url,
        durationSec: dur || effectiveClipDuration(currentClip),
        trimEndSec: 0,
      };
      insertClipAtPlayhead(clip);
      setSelectedClip(clip.id);
      setNote(`Split-screen scene added: ${clip.name}`);
      void fetch('/api/admin/clipping-vault', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'touch', id: a.id }),
      }).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Split-screen failed');
    } finally {
      setBusy(false);
    }
  }


  /** Upload a reaction/intro/outro clip into the Vault (signed URL — probe — save). */
  async function uploadToVault(file: File) {
    setBusy(true);
    setError(null);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
      const mint = await fetch(UPLOAD_API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ext, contentType: file.type || undefined, kind: 'video' }),
      });
      const mintJson = await mint.json();
      if (!mintJson.success) throw new Error(mintJson.error || 'Could not mint an upload URL');
      const put = await fetch(mintJson.signedUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!put.ok) throw new Error(`Upload rejected (${put.status})`);
      const url = String(mintJson.publicUrl || '');
      if (!url) throw new Error('Upload returned no public URL');
      const dur = await probeDuration(url);
      const res = await fetch('/api/admin/clipping-vault', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          kind: vaultUploadKind,
          name: file.name.replace(/\.[^.]+$/, '').slice(0, 80),
          url,
          durationSec: dur || 2.5,
          tags: vaultTags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Vault save failed');
      setNote(`In the Vault: ${file.name}`);
      setVaultTags('');
      void loadVault();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vault upload failed');
    } finally {
      setBusy(false);
    }
  }


  const total = useMemo(() => reelDurationSec(project?.clips ?? []), [project?.clips]);
  // R25b: the clock loop reads LIVE values through this ref (never a stale closure).
  clockStateRef.current = { project, total };
  /**
   * R28 px/sec: never below the fit-to-width zoom. A 27s reel and a 3min reel
   * both fill the exact same strip width — the ZOOM absorbs the length
   * difference, not the layout. The zoom slider only zooms IN from fit
   * (past fit the track overflows and scrolls, as before).
   */
  const pxPerSec = useMemo(() => {
    // FIT-TO-SCREEN: the timeline fills the visible strip width, never wider.
    // The old `Math.max(36 * zoom, stripWidth / total)` had a 36px/sec FLOOR —
    // a 152s clip forced ≥5472px, blowing the strip (and the whole stage column)
    // thousands of px past the right edge of the screen. Now the strip is exactly
    // screen-width at zoom 1 (stripWidth / total), and the zoom slider only zooms
    // IN from fit (past 1 the track overflows and scrolls, as intended).
    if (total <= 0 || stripWidth <= 0) return 36 * zoom;
    return (stripWidth / total) * zoom;
  }, [zoom, total, stripWidth]);
  const errors = useMemo(() => (project ? timelineErrors(project) : []), [project]);
  const selected = project?.clips.find((c) => c.id === selectedClip) ?? null;
  const currentClip = selected ?? project?.clips[0] ?? null;

  // R25: the STAGE shows the clip under the CLOCK (not the inspector selection).
  const clockHit = useMemo(
    () => (project ? clipAtTime(project.clips, playheadSec) : null),
    [project, playheadSec],
  );
  const stageClip = clockHit?.clip ?? null;

  /**
   * The caption-edit surface's state + handlers (extracted — Task 3). The
   * destructure keeps the SAME names the JSX always used, so the body below
   * is untouched: pure extraction, no behavior change.
   */
  const captionEdit = useCaptionEdit({
    project,
    setProject,
    currentClip,
    stageClip,
    playheadSec,
    ccOn,
    post,
    setNote,
    setSelectedClip,
  });
  const {
    wordPlaceLocal,
    setWordPlaceLocal,
    wordScaleLocal,
    setWordScaleLocal,
    stackEditMode,
    setStackEditMode,
    showAllCardWords,
    setShowAllCardWords,
    wordCtxMenu,
    setWordCtxMenu,
    fxMode,
    setFxMode,
    fxWords,
    setFxWords,
    fxScope,
    setFxScope,
    fxTarget,
    setFxTarget,
    applyWordMark,
    applyWordMarks,
    clearWordFx,
    toggleFxWord,
    freePlaceWord,
    removeWordPlace,
    toggleWordBehind,
    resetCaptionWords,
    exitStackEdit,
    onCaptionWordPointerDown,
    onCaptionWordContextMenu,
  } = captionEdit;

  /* edit-mode auto-pause — only when ENTERING edit, never on first mount. */
  const prevEditRef = useRef(false);
  useEffect(() => {
    const entered = stackEditMode && !prevEditRef.current;
    prevEditRef.current = stackEditMode;
    if (!entered) return;
    const c = clockRef.current;
    if (!c?.playing) return;
    c.playing = false;
    cancelAnimationFrame(c.raf);
    setPlaying(false);
    const v = previewRef.current;
    if (v && !v.paused) v.pause();
    const ov = overlayRef.current;
    if (ov && !ov.paused) ov.pause();
  }, [stackEditMode]);

/** Live free-place drag: merge local x/y into caption marks so Remotion
   *  paints the moved word with FULL theme styles (not just the hit target). */
  // The preview uses the BASE project — NEVER a live-merged one. Merging the
  // in-flight drag offsets (wordPlaceLocal/wordScaleLocal) into the project
  // rebuilt the ENTIRE render plan on every pointermove (60×/sec): the "screen
  // jumps", the "words get smaller and change", and the jank. The hit box
  // already glides with the pointer via the surface's dragWords merge; the
  // painted word snaps to the committed position on release (applyWordMark →
  // ONE rebuild). This is the smooth + performant path.
  const projectWithWordPlace = project;

  const previewSrc =
    stageClip?.url || project?.clips?.[0]?.url || project?.composedUrl || '';

  /**
   * Remotion's <OffthreadVideo> CANNOT decode a blob: URL — it extracts frames
   * with an offscreen/ffmpeg-style fetch that needs a real http(s) source. An
   * upload lands on the timeline as a blob: URL (the local file) and only
   * becomes a storage URL seconds later, so the whole time it's a blob the
   * Remotion preview paints BLACK: "the video does not mount after upload".
   *
   * While the stage clip is a blob we bail to the plain <video> edit-stage,
   * which plays a blob: URL natively. As soon as the storage URL lands the
   * flag clears and the true Remotion preview takes back over.
   */
  const stageIsBlob =
    typeof previewSrc === 'string' && previewSrc.startsWith('blob:');

  /**
   * PAINT THE STAGE WHEN THE SOURCE CHANGES.
   *
   * The <video> has no src prop on purpose - the clock owns it. But the clock
   * only runs while PLAYING, so a clip that lands while playback is parked
   * (every upload, every project load) never got a source and the player sat
   * black. This effect does the one thing the clock cannot: swap + seek the
   * element the instant the stage URL changes, so an uploaded clip shows up
   * immediately - and swaps cleanly again when the blob becomes a storage URL.
   */
  useEffect(() => {
    const v = previewRef.current;
    if (!v || !previewSrc) return;
    if (v.dataset.clipUrl === previewSrc) return;
    swappingRef.current = true;
    v.dataset.clipUrl = previewSrc;
    pendingSeekRef.current =
      (stageClip?.trimStartSec ?? 0) + (clockHit?.local ?? 0);
    v.src = previewSrc;
    try {
      v.load();
    } catch {
      /* Safari can throw on a same-tick load - the swap still lands */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewSrc, stageClip?.id]);

  // DIAGNOSTIC: after the stage settles, dump the video element's real state.
  // "Uploads but shows nothing" with no onError means the element mounted and
  // the blob loaded — so the question becomes WHERE it is and whether it has
  // size. This logs the bounding box + readyState + dimensions so we stop
  // guessing. Remove once the blank-stage cause is confirmed.
  useEffect(() => {
    if (!previewSrc) return;
    const t = window.setTimeout(() => {
      const v = previewRef.current;
      const box = v?.getBoundingClientRect();
      // eslint-disable-next-line no-console
      console.log('[reel-stage]', {
        src: previewSrc.slice(0, 40),
        isBlob: previewSrc.startsWith('blob:'),
        stageBox: { w: stageBox.w, h: stageBox.h },
        videoMounted: !!v,
        videoBox: box ? { w: Math.round(box.width), h: Math.round(box.height), x: Math.round(box.x), y: Math.round(box.y) } : null,
        readyState: v?.readyState,
        videoSize: v ? { w: v.videoWidth, h: v.videoHeight } : null,
        error: v?.error ? v.error.code : null,
        paused: v?.paused,
        currentTime: v?.currentTime,
      });
    }, 800);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewSrc, stageBox.w, stageBox.h]);

  /** R25: the overlay (b-roll) layer currently under the clock, if any. */
  const overlayHit = useMemo(() => {
    for (const o of project?.overlays ?? []) {
      if (playheadSec >= o.offsetSec && playheadSec < o.offsetSec + effectiveClipDuration(o)) {
        return o;
      }
    }
    return null;
  }, [project?.overlays, playheadSec]);

  /** R26: the effective length budget (per-reel override or the platform default). */
  const targetLen = targetLengthFor(postTarget);
  const targetSec = targetOverride ?? targetLen.target;

  /** R3 Hook Score: recomputed on any timeline/caption/vault change — the Compose badge. */
  const hook = useMemo(
    () =>
      project && project.clips.length
        ? scoreHook({
            clips: project.clips,
            captions: project.captions,
            vaultWinRateByUrl: new Map((vaultAssets ?? []).map((a) => [a.url, a.winRate])),
          })
        : null,
    [project, vaultAssets],
  );

  // The badge and the Vault tab share the asset list — warm it once a reel is open.
  useEffect(() => {
    if (project && vaultAssets === null) void loadVault();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  // ------------------------------------------------------------------
  // R25 playback clock (the ONE authority for time)
  // ------------------------------------------------------------------

  /**
   * Hard-sync the video element(s) to timeline-second `t`: swap the source
   * when the clock crossed into another scene, seek when drift exceeds a
   * frame or two, and keep the overlay layer on the same beat.
   */
  function syncVideoToClock(t: number) {
    const proj = clockStateRef.current.project;
    if (!proj) return;
    const hit = clipAtTime(proj.clips, t);
    if (!hit) return;
    const srcLocal = (hit.clip.trimStartSec ?? 0) + hit.local;
    setPreviewTime(hit.local);
    const v = previewRef.current;
    if (v) {
      if (v.dataset.clipUrl !== hit.clip.url) {
        swappingRef.current = true;
        v.dataset.clipUrl = hit.clip.url;
        pendingSeekRef.current = srcLocal;
        v.src = hit.clip.url;
      } else if (Math.abs(v.currentTime - srcLocal) > 0.12) {
        try {
          v.currentTime = srcLocal;
        } catch {
          /* metadata pending */
        }
      }
      if (clockRef.current.playing && v.paused && !swappingRef.current) {
        void v.play().catch(() => {});
      }
    }
    // The overlay layer rides the same clock.
    const ov = overlayRef.current;
    if (ov) {
      const o = (proj.overlays ?? []).find(
        (x) => t >= x.offsetSec && t < x.offsetSec + effectiveClipDuration(x),
      );
      if (o) {
        const ovLocal = (o.trimStartSec ?? 0) + (t - o.offsetSec);
        if (ov.dataset.clipUrl !== o.url) {
          ov.dataset.clipUrl = o.url;
          pendingOvSeekRef.current = ovLocal;
          ov.src = o.url;
        } else if (Math.abs(ov.currentTime - ovLocal) > 0.15) {
          try {
            ov.currentTime = ovLocal;
          } catch {
            /* metadata pending */
          }
        }
        if (clockRef.current.playing && ov.paused) void ov.play().catch(() => {});
      } else if (!ov.paused) {
        ov.pause();
      }
    }
  }

  /** The rAF heartbeat: advance the clock, clamp at the end, sync everything. */
  function clockTick(ts: number) {
    const c = clockRef.current;
    const tot = clockStateRef.current.total;
    if (!c.playing || !clockStateRef.current.project) return;
    const dt = Math.min(0.1, Math.max(0, (ts - c.lastTs) / 1000)); // tab-switch guard
    c.lastTs = ts;
    const t = c.t + dt;
    if (t >= tot) {
      c.t = tot;
      setPlayheadSec(tot);
      stopClock();
      return;
    }
    c.t = t;
    setPlayheadSec(t);
    syncVideoToClock(t);
    syncAudioAt(t, true);
    c.raf = requestAnimationFrame(clockTick);
  }

  function startClock() {
    const c = clockRef.current;
    const proj = clockStateRef.current.project;
    const tot = clockStateRef.current.total;
    if (!proj || proj.clips.length === 0 || c.playing) return;
    if (c.t >= tot - 0.01) c.t = 0; // replay from the top when at the end
    swappingRef.current = false; // leftover swap must not block play()
    c.playing = true;
    c.lastTs = performance.now();
    setPlaying(true);
    syncVideoToClock(c.t);
    const v = previewRef.current;
    if (v && v.paused && !swappingRef.current) void v.play().catch(() => {});
    syncAudioAt(c.t, true);
    cancelAnimationFrame(c.raf);
    c.raf = requestAnimationFrame(clockTick);
  }

  function stopClock() {
    const c = clockRef.current;
    c.playing = false;
    cancelAnimationFrame(c.raf);
    setPlaying(false);
    const v = previewRef.current;
    if (v && !v.paused) v.pause();
    const ov = overlayRef.current;
    if (ov && !ov.paused) ov.pause();
    syncAudioAt(c.t, false);
  }

  /** Play / pause the stage (the transport button + Space share this). */
  function togglePlay() {
    if (clockRef.current.playing) stopClock();
    else startClock();
  }

  /** Step to the previous / next scene (the clock jumps to its first frame). */
  function goToScene(delta: -1 | 1) {
    if (!project) return;
    const hit = clipAtTime(project.clips, clockRef.current.t);
    if (!hit) return;
    const next = hit.index + delta;
    if (next < 0 || next >= project.clips.length) return;
    setSelectedClip(project.clips[next].id);
    seekTimeline(timelineStartOf(project.clips, next) + 0.001);
  }

  // The stage follows the clock: any clip-list change (add/trim/reorder/split)
  // re-syncs the element to the clock position — the two can never drift apart.
  useEffect(() => {
    if (!project) return;
    if (clockRef.current.t > total) clockRef.current.t = total;
    syncVideoToClock(clockRef.current.t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.clips, project?.id, total]);

  /**
   * CUT TAIL (non-destructive): the scene now ENDS at the playhead. This is the
   * fast "cut" — no server round-trip, instant on the strip, Ctrl+Z undoes it.
   */
  function cutTailAtPlayhead() {
    if (!project) return;
    const hit = clipAtTime(project.clips, clockRef.current.t);
    if (!hit) return;
    const local = Math.round(hit.local * 10) / 10;
    if (!(local > 0.2 && local < effectiveClipDuration(hit.clip))) {
      setError('Move the playhead inside the scene first, then cut.');
      return;
    }
    const cutAt = (hit.clip.trimStartSec ?? 0) + local;
    patchClip(hit.clip.id, {
      trimEndSec: Math.round((hit.clip.durationSec - cutAt) * 10) / 10,
    });
    setNote(`Tail cut — the scene now ends at ${fmtCs(local)}.`);
  }

  /** Seek the whole timeline to a timeline-second (the CLOCK jumps + re-syncs). */
  function seekTimeline(tSec: number) {
    if (!project || project.clips.length === 0) return;
    const clamped = Math.max(0, Math.min(tSec, total));
    clockRef.current.t = clamped;
    setPlayheadSec(clamped);
    const hit = clipAtTime(project.clips, clamped);
    if (hit) setSelectedClip(hit.clip.id);
    syncVideoToClock(clamped);
    syncAudioAt(clamped, clockRef.current.playing);
  }


  const [previewTime, setPreviewTime] = useState(0);
  /**
   * THE preview engine. 'remotion' = the TRUE render (the same ReelComposition
   * + buildRenderPlan the Lambda renderer uses — what you see IS what exports).
   * 'edit' = the legacy scrub/trim canvas (the playback clock) for frame-level
   * cutting. Default to 'remotion' so the preview always matches the export.
   */
  const [previewMode, setPreviewMode] = useState<'remotion' | 'edit'>('remotion');

  /** R27 fancy subtitles (veed) — the settings the burn runs with. */
  const [fancy, setFancy] = useState<{
    subtitleType: 'word' | 'line';
    position: 'top' | 'center' | 'bottom';
    fontSize: number;
    fontColor: string;
    backgroundColor: string;
    backgroundOpacity: number;
    outlineColor: string;
    outlineWidth: number;
    preset: string;
    resolution: '1080p' | '4k';
    translationLanguage: string;
    customVocabulary: string;
  }>({
    subtitleType: 'word',
    position: 'bottom',
    fontSize: 28,
    fontColor: '#ffffff',
    backgroundColor: '#000000',
    backgroundOpacity: 0,
    outlineColor: '#000000',
    outlineWidth: 3,
    preset: 'simple',
    resolution: '1080p',
    translationLanguage: '',
    customVocabulary: '',
  });
  const [fancyBusy, setFancyBusy] = useState(false);
  /** Which preset tier tab is showing in the fancy subtitles panel. */
  const [presetTier, setPresetTier] = useState<'basic' | 'dynamic'>('basic');
  /** The example video preview (what each VEED preset looks like). */
  const [exampleOpen, setExampleOpen] = useState(false);

  /** R27: burn fancy subtitles into the COMPOSED mp4 via veed, then open + copy it. */
  async function renderFancyCaptions() {
    if (!project) return;
    if (!project.composedUrl) {
      setError('Compose first — fancy subtitles burn into the composed MP4 (one flat video).');
      return;
    }
    setFancyBusy(true);
    setError(null);
    setNote('Fancy subtitles rendering via veed (word-timed — can take a minute)…');
    try {
      const res = await fetch('/api/admin/reel-fancy-captions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ videoUrl: project.composedUrl, settings: fancy }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Render failed');
      setNote('Fancy subtitles ready — link copied.');
      void navigator.clipboard?.writeText(String(json.url));
      window.open(String(json.url), '_blank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Render failed');
    } finally {
      setFancyBusy(false);
    }
  }

  /**
   * R25 INSTANT split at the playhead (S key) — NO server round-trip. Part A
   * keeps the id with the tail cut; part B rides the SAME source with an
   * in-point (`trimStartSec`). Undo-safe, works with the worker down. Compose
   * materializes the in-point via the worker at render time.
   */
  function splitAtPlayhead() {
    if (!project) return;
    const hit = clipAtTime(project.clips, clockRef.current.t);
    if (!hit) return;
    const eff = effectiveClipDuration(hit.clip);
    if (!(hit.local > 0.05 && hit.local < eff - 0.05)) {
      setError('Move the playhead inside the clip first, then split (S).');
      return;
    }
    const [a, b] = splitClipAt(hit.clip, hit.local);
    const clips = project.clips.slice();
    clips.splice(hit.index, 1, a, b);
    patch({ clips });
    setSelectedClip(b.id);
    setNote(`Split at ${fmtCs(hit.local)} — one scene became two (instant, Ctrl+Z undoes it).`);
  }

  /** R25 left-edge in-point trim: INSTANT (rides trimStartSec, no server). */
  function leftTrimAt(clip: ReelClip, inSec: number) {
    if (!project || !(inSec > 0.05 && inSec < clip.durationSec - 0.5)) return;
    patchClip(clip.id, { trimStartSec: Math.round(inSec * 10) / 10 });
    setNote(`Cut ${fmtSec(inSec)} off the head of ${clip.name} (instant, Ctrl+Z undoes it).`);
  }

  /** Load Media Library images once (the cue picker + auto-proposal read them). */
  async function loadCueAssets(): Promise<{ url: string; name: string; tags: string[] }[]> {
    if (cueAssets) return cueAssets;
    try {
      const res = await fetch('/api/admin/media-library', { cache: 'no-store' });
      const json = await res.json();
      const assets = (json.assets ?? json.records ?? []) as {
        url?: string; name?: string; kind?: string; tags?: string[];
      }[];
      const images = assets
        .filter((a) => a.url && /^https?:\/\//i.test(a.url) && (a.kind === 'image' || !a.kind))
        .map((a) => ({ url: a.url as string, name: a.name ?? '', tags: a.tags ?? [] }));
      setCueAssets(images);
      return images;
    } catch {
      setCueAssets([]);
      return [];
    }
  }

  /** Persist a mediaCues change (same save path as caption word edits). */
  async function saveMediaCues(next: ReelMediaCue[]) {
    if (!project) return;
    const updated: ReelProject = { ...project, mediaCues: next.length ? next : undefined };
    setProject(updated);
    await post({ action: 'save', project: updated });
  }

  /** Persist the clone manifest (same save path as media cues). */
  async function saveClonePlan(next: ClonePlan) {
    if (!project) return;
    const updated: ReelProject = { ...project, clonePlan: next };
    setProject(updated);
    await post({ action: 'save', project: updated });
  }

  /** Clone beats land on the timeline as scenes, in manifest order (step 6). */
  async function assembleCloneBeats(beats: CloneBeat[]) {
    if (!project) return;
    const scenes = [];
    for (let i = 0; i < beats.length; i++) {
      const b = beats[i];
      if (!b.videoUrl) continue;
      const dur = (await probeDuration(b.videoUrl)) || b.durationSec;
      scenes.push({
        id: makeClipId(),
        name: cloneSceneName(b, i),
        url: b.videoUrl,
        durationSec: dur,
        trimEndSec: 0,
      });
    }
    if (!scenes.length) return;
    const updated: ReelProject = { ...project, clips: [...project.clips, ...scenes] };
    setProject(updated);
    await post({ action: 'save', project: updated });
    setTab('clips');
  }

  /** Cue mode word click: open the image picker for that word. */
  function beginCueAttach(wordIndex: number) {
    setCuePickerWord(wordIndex);
    void loadCueAssets();
  }

  /**
   * The Remotion Player's frame, written back into the studio clock. The
   * Player has its own transport (controls), so without this it free-runs
   * while it plays and playheadSec goes stale — the cue drag box's on-screen
   * gate (cueOnScreen) stuck ON after the image flew out. The seek effect in
   * RemotionPreview never fights this: the reported frame IS the seek target.
   */
  const onPlayerFrame = useCallback((sec: number) => {
    setPlayheadSec(sec);
  }, []);

  /** Picker pick: attach the image to the pending word. One cue per word (re-pick replaces).
   *  `animated` marks a GIF sticker — the cue renders through Remotion's
   *  frame-driven <Gif> (preview === render) instead of the static <Img>. */
  async function attachCue(url: string, opts?: { animated?: boolean }) {
    if (!project || !currentClip || cuePickerWord == null) return;
    // Warm the browser cache BEFORE the plan rebuild mounts the <Img>/<Gif> —
    // after a refresh the file isn't fetched yet (the sticker tile previews the
    // WebP, not the GIF), and a cold mount delayRenders the Player, which
    // blanks the whole stage until it resolves. Best-effort and capped — a
    // slow or failed warm never blocks the attach.
    try {
      const img = new Image();
      img.src = url;
      await Promise.race([
        img.decode().catch(() => {}),
        new Promise((r) => setTimeout(r, 1500)),
      ]);
    } catch {
      /* the cue still attaches */
    }
    const rest = (project.mediaCues ?? []).filter(
      (c) => !(c.clipId === currentClip.id && c.wordIndex === cuePickerWord),
    );
    await saveMediaCues([
      ...rest,
      {
        id: makeClipId(),
        clipId: currentClip.id,
        wordIndex: cuePickerWord,
        url,
        ...(opts?.animated ? { animated: true } : {}),
      },
    ]);
    setCuePickerWord(null);
    setNote(
      opts?.animated
        ? 'Animated sticker attached — it plays in the Remotion preview and burns into the MP4.'
        : 'Image fly-in attached — it renders in the Remotion preview and the MP4.',
    );
  }

  /** Cue source: GIPHY stickers — search → a transparent sticker attaches as
   *  the fly-in's image. The pick attaches the GIF with `animated` set, so the
   *  cue renders through the frame-driven <Gif> branch (preview === render). */
  async function searchStickers() {
    const q = stickerQuery.trim();
    if (!q || stickerBusy) return;
    setStickerBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reel-stickers?q=${encodeURIComponent(q)}`);
      const j = (await res.json()) as {
        success?: boolean;
        stickers?: GiphySticker[];
        error?: string;
      };
      if (!res.ok || !j.success) {
        setError(j.error || 'Sticker search failed.');
        setStickerResults([]);
        return;
      }
      setStickerResults(j.stickers ?? []);
    } catch {
      setStickerResults([]);
    } finally {
      setStickerBusy(false);
    }
  }

  /** Auto-proposal: match strong transcript words to library images. */
  async function autoCues() {
    if (!project || !currentClip) return;
    const words = project.captions[currentClip.id] ?? [];
    if (!words.length) return;
    const images = await loadCueAssets();
    const proposals = suggestCuesForWords(words, images);
    if (!proposals.length) {
      setNote('No matches — name or tag library images after the words you say (e.g. "money", "rocket").');
      return;
    }
    const keep = (project.mediaCues ?? []).filter((c) => c.clipId !== currentClip.id);
    await saveMediaCues([
      ...keep,
      ...proposals.map((p) => ({
        id: makeClipId(),
        clipId: currentClip.id,
        wordIndex: p.wordIndex,
        url: p.url,
      })),
    ]);
    setNote(`Auto-attached ${proposals.length} image fly-in(s) on "${currentClip.name}".`);
  }

  /**
   * Ingest a fresh cue image into the Media Library AND the picker's list.
   * The cue itself never changes shape ({clipId, wordIndex, url}) — WHERE the
   * image came from is a picker concern, not a data-model concern.
   */
  async function ingestCueAsset(input: {
    name: string;
    url: string;
    source: 'upload' | 'generated';
    tags: string[];
  }) {
    try {
      await fetch('/api/admin/media-library', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'ingest',
          name: input.name.slice(0, 150),
          url: input.url,
          kind: 'image',
          source: input.source,
          tags: input.tags,
        }),
      });
    } catch {
      /* the library entry is a convenience — the cue still attaches */
    }
    const entry = { url: input.url, name: input.name, tags: input.tags };
    setCueAssets((prev) => (prev ? [entry, ...prev.filter((a) => a.url !== entry.url)] : prev));
  }

  /** Cue source: upload an image — signed-URL flow → the library → attach, one step. */
  async function uploadCueImage(file: File) {
    if (cuePickerWord == null) return;
    setCueUploadBusy(true);
    setError(null);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const mint = await fetch(UPLOAD_API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ext, contentType: file.type || undefined, kind: 'image' }),
      });
      const mintJson = await mint.json();
      if (!mintJson.success) throw new Error(mintJson.error || 'Could not mint an upload URL');
      const put = await fetch(mintJson.signedUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!put.ok) throw new Error(`Upload rejected (${put.status})`);
      const url = String(mintJson.publicUrl || '');
      if (!url) throw new Error('Upload returned no public URL');
      await ingestCueAsset({
        name: file.name.replace(/\.[^.]+$/, '').slice(0, 80) || 'Cue image',
        url,
        source: 'upload',
        tags: ['cue'],
      });
      await attachCue(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setCueUploadBusy(false);
    }
  }

  /** Cue source: AI-generate the image — the content image pipeline hosts it,
   *  the library keeps it, and it attaches to the pending word in one step. */
  async function generateCueImage() {
    const prompt = cueAiPrompt.trim();
    if (!prompt || cuePickerWord == null) return;
    setCueAiBusy(true);
    setError(null);
    try {
      const url = await aiGenerateImage(prompt, 'reel');
      await ingestCueAsset({
        name: `${prompt.slice(0, 60)} (AI cue)`,
        url,
        source: 'generated',
        tags: ['ai-image', 'cue'],
      });
      setCueAiPrompt('');
      await attachCue(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI image failed');
    } finally {
      setCueAiBusy(false);
    }
  }

  /** The cue's render window in seconds: its word's span + the hold (the cue's
   *  own holdSec when set, else the house 1s — the same math shiftMediaCues
   *  resolves it to). Motion presets expand over it. */
  function cueWindowSec(cue: ReelMediaCue): number {
    const w = project?.captions[cue.clipId]?.[cue.wordIndex];
    return Math.max(0.5, (w ? w.end - w.start : 0.4) + (cue.holdSec ?? 1.0));
  }

  /** Is the cue's image actually ON SCREEN at the playhead? The drag box shows
   *  only then (it used to pin to the selected cue forever). Window = the
   *  trigger word's span + the hold, in timeline seconds. */
  function cueOnScreen(cue: ReelMediaCue): boolean {
    if (!project) return false;
    const clipIdx = project.clips.findIndex((c) => c.id === cue.clipId);
    if (clipIdx < 0) return false;
    const w = project.captions[cue.clipId]?.[cue.wordIndex];
    if (!w) return false;
    const clipStart = timelineStartOf(project.clips, clipIdx);
    const trimStart = project.clips[clipIdx].trimStartSec ?? 0;
    const from = clipStart + Math.max(0, w.start - trimStart);
    const to = clipStart + Math.max(0.1, w.end - trimStart) + (cue.holdSec ?? 1.0);
    return playheadSec >= from - 0.05 && playheadSec <= to;
  }

  /** Patch one cue's fields and persist (the same save path as attach). */
  async function patchCue(id: string, partial: Partial<ReelMediaCue>) {
    if (!project) return;
    await saveMediaCues(
      (project.mediaCues ?? []).map((c) => (c.id === id ? { ...c, ...partial } : c)),
    );
  }

  /** Patch one cue's STYLE (merge). A border width of 0 drops the border keys. */
  async function patchCueStyle(
    id: string,
    partial: Partial<NonNullable<ReelMediaCue['style']>>,
  ) {
    if (!project) return;
    const cue = (project.mediaCues ?? []).find((c) => c.id === id);
    if (!cue) return;
    const style = { ...(cue.style ?? {}), ...partial };
    if (style.borderPx === 0) {
      delete style.borderPx;
      delete style.borderColor;
    }
    await patchCue(id, { style });
  }

  /**
   * Right-click a caption word ON THE CANVAS (Preview mode — Edit mode's
   * WordDragLayer owns right-click there). The caption glyphs carry
   * data-caption-word; the menu offers Free-place / Remove placement /
   * Behind the subject + the full style editor (the shared WordContextMenu).
   */
  /**
   * THE free-place drag — press any caption word on the canvas and move it.
   * Always available (Preview AND Edit), no mode toggle needed. It drives off
   * the SAME hit-resolution as the right-click menu (closest + elementsFromPoint
   * + clipWordIndexFromPlanIndex), NOT the drag layer's measured boxes — so it
   * works even when those boxes don't render. The drag is RELATIVE to where you
   * grabbed the word, so it never jumps to your pointer.
   */
  /**
   * Reset the current scene's caption words to the clean theme — strips EVERY
   * per-word mark (free-place x/y, fx, color, scale, anim, ambient, font, hide,
   * behind, card). The reel's preset + captionOverrides are untouched; this is
   * the "undo all my fp edits" escape hatch.
   */
  /** Media Library audio, once (the cue + word SFX pickers read it). */
  async function loadSfxAssets(): Promise<{ url: string; name: string }[]> {
    if (sfxAssets) return sfxAssets;
    try {
      const res = await fetch('/api/admin/media-library', { cache: 'no-store' });
      const json = await res.json();
      const rows = (json.assets ?? json.records ?? []) as {
        url?: string;
        name?: string;
        kind?: string;
      }[];
      const audio = rows
        .filter((a) => a.url && /^https?:\/\//i.test(a.url) && a.kind === 'audio')
        .map((a) => ({ url: a.url as string, name: a.name ?? '' }));
      setSfxAssets(audio);
      return audio;
    } catch {
      setSfxAssets([]);
      return [];
    }
  }

  /** Upload a sound: signed-URL flow → the library (kind audio, tag sfx) → the
   *  entry, so it attaches AND is reusable by the next beat. */
  async function uploadSfx(file: File): Promise<{ url: string; name: string } | null> {
    setError(null);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'mp3';
      const mint = await fetch(UPLOAD_API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ext, contentType: file.type || undefined, kind: 'audio' }),
      });
      const mintJson = await mint.json();
      if (!mintJson.success) throw new Error(mintJson.error || 'Could not mint an upload URL');
      const put = await fetch(mintJson.signedUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!put.ok) throw new Error(`Upload rejected (${put.status})`);
      const url = String(mintJson.publicUrl || '');
      if (!url) throw new Error('Upload returned no public URL');
      const name = file.name.replace(/\.[^.]+$/, '').slice(0, 80) || 'SFX';
      try {
        await fetch('/api/admin/media-library', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'ingest',
            name,
            url,
            kind: 'audio',
            source: 'upload',
            tags: ['sfx'],
          }),
        });
      } catch {
        /* the library entry is a convenience — the attach still happens */
      }
      const entry = { url, name };
      setSfxAssets((prev) => (prev ? [entry, ...prev.filter((a) => a.url !== url)] : [entry]));
      return entry;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SFX upload failed');
      return null;
    }
  }

  /**
   * The full-auto pipeline, as the GATED recipe (never a silent background
   * act): package this reel's transcripts, start 'reel-cue-autopilot' on the
   * background lane, and hand the owner the run page — the gate (approve/edit
   * the beat list) is where the images get matched or generated and the cues
   * attach. Cost tracking rides the run like every other play.
   */
  async function runCueAutopilot() {
    if (!project) return;
    setCueAutopilotBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/reel-cue-autopilot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId: project.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Autopilot failed to start');
      setNote(
        'Cue Autopilot is running — approve the beat list when it lands, and the cues attach themselves (library matches are free; only the rest generate).',
      );
      window.open(String(json.runUrl || `/admin/recipes/${json.runId}`), '_blank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Autopilot failed');
    } finally {
      setCueAutopilotBusy(false);
    }
  }

  /** Whisper the current clip and store word timings for the karaoke layer. */

  /**
   * Caption behind the speaker, for a WINDOW (a caption card's timing — the
   * bria model caps at 60s, so the card's span, not the whole clip, is what
   * gets processed). The route trims [fromSec, toSec] of the source clip
   * (ffmpeg worker), removes the background (fal, default bria = cheapest),
   * and the result lands as a REAL LAYER on the overlay lane — a duplicate of
   * the scene with the background removed, on top. You see it on the
   * timeline, drag to re-time it, × to remove it.
   *
   * The z-stack (the composition): clip → a `behind`-marked word (z 5) → THE
   * CUTOUT (z 6) → the caption block (z 10) → front free-placed words (z 11).
   * So a word goes UNDER the subject when you right-click it → Behind, and
   * every other word stays in front.
   *
   * fromSec/toSec arrive in the clip's SOURCE seconds (the SubtitlePanel's
   * word timings). The layer's timeline window = the clip's timeline start +
   * (source window − the clip's in-point).
   */
  async function captionBehindSpeaker(fromSec: number, toSec: number, model?: string) {
    const clip = currentClip;
    if (!project || !clip || behindBusy) return;
    setBehindBusy(true);
    setNote('Removing the background for this line — trimming the window, then the subject…');
    try {
      const res = await fetch('/api/admin/reel-bg-remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: clip.url,
          fromSec,
          toSec,
          autoZoom: true,
          ...(model ? { model } : {}),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok || !json?.success || typeof json.url !== 'string') {
        throw new Error(typeof json?.error === 'string' ? json.error : `Background removal failed (${res.status})`);
      }
      // The layer's TIMELINE window: the clip's start + (source window − in-point).
      const clipStart = project.clips
        .slice(0, project.clips.findIndex((c) => c.id === clip.id))
        .reduce((s, c) => s + Math.max(0, c.durationSec - (c.trimEndSec ?? 0) - (c.trimStartSec ?? 0)), 0);
      const trimStart = clip.trimStartSec ?? 0;
      const winFrom = clipStart + Math.max(0, fromSec - trimStart);
      const winTo = clipStart + Math.max(0.1, toSec - trimStart);
      // A REAL overlay-lane entry (isCutout) — visible on the timeline's
      // violet lane, re-timeable (drag), removable (×). It replaces the
      // invisible cutouts[] window, which nothing could re-time or remove.
      const overlay: ReelOverlayClip = {
        id: makeClipId(),
        name: `Cutout · ${clip.name}`.slice(0, 60),
        url: json.url,
        durationSec: Math.max(0.1, Math.round((winTo - winFrom) * 10) / 10),
        trimEndSec: 0,
        offsetSec: Math.round(winFrom * 10) / 10,
        isCutout: true,
      };
      const updated: ReelProject = {
        ...project,
        overlays: [...(project.overlays ?? []), overlay],
      };
      setProject(updated);
      await post({ action: 'save', project: updated });
      setNote(
        'Cutout layer added on the violet lane (drag to re-time, × to remove). Now right-click a caption word on the canvas → Behind the subject.',
      );
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Background removal failed');
    } finally {
      setBehindBusy(false);
    }
  }

  async function transcribeCurrentClip() {
    const clip = currentClip;
    if (!clip || !project) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/reel-captions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: clip.url }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Transcription failed');
      const updated: ReelProject = {
        ...project,
        captions: { ...project.captions, [clip.id]: json.words as ReelWord[] },
      };
      setProject(updated);
      setCcOn(true);
      setNote(`Transcribed ${json.words.length} words — karaoke captions on.`);
      await post({ action: 'save', project: updated });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transcription failed');
    } finally {
      setBusy(false);
    }
  }

  /** R3: caption preset — a view setting, not an edit (no undo entry, saved straight through). */
  async function setCaptionStyle(preset: CaptionPreset) {
    if (!project || project.captionStyle === preset) return;
    const updated: ReelProject = { ...project, captionStyle: preset };
    setProject(updated);
    setNote(`Caption style: ${preset}.`);
    await post({ action: 'save', project: updated });
  }

  /** Merge overrides into a clean object (drops empty color wells). */
  function mergeCaptionOv(patchOv: Partial<CaptionOverrides>): CaptionOverrides {
    const merged: CaptionOverrides = { ...(project?.captionOverrides ?? {}), ...patchOv };
    // Explicit null deletes a key (reset one dial without wiping the rest).
    for (const [k, v] of Object.entries(patchOv)) {
      if (v === null) delete (merged as Record<string, unknown>)[k];
    }
    if (merged.colors && merged.colors.every((c) => !c)) delete merged.colors;
    return merged;
  }

  /** R17c: override change that PERSISTS (slider release / well pick / drag end). */
  async function setCaptionOverrides(patchOv: Partial<CaptionOverrides>) {
    if (!project) return;
    const updated: ReelProject = { ...project, captionOverrides: mergeCaptionOv(patchOv) };
    setProject(updated);
    await post({ action: 'save', project: updated });
  }

  /**
   * R20 drag-to-move: LOCAL-ONLY during the drag (no network — buttery smooth),
   * then ONE save on pointer-up. Previously every pointermove POSTed the whole
   * reel — the page flashed + felt clunky mid-drag.
   */
  function setCaptionOverridesLocal(patchOv: Partial<CaptionOverrides>) {
    if (!project) return;
    setProject({ ...project, captionOverrides: mergeCaptionOv(patchOv) });
  }

  /** Raw split call for the silence chain — owns no busy state (the chain does). */
  async function splitCall(projectId: string, clipId: string, atSec: number) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'split',
        id: projectId,
        clipId,
        atSec: Math.round(atSec * 10) / 10,
      }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Split failed');
    return json as { project: ReelProject; partBId: string };
  }

  /**
   * R3 auto-cut-silence: Whisper words — gap plan — the existing split worker
   * does the cuts (first-to-last, each split in the current tail's local
   * seconds). Leading air = one split + drop the silent head; mid gaps =
   * split, split, drop the middle; trailing air = a plain tail trim (no
   * worker). Karaoke words are re-timed onto the kept segments at the end.
   */
  async function cutSilenceFromCurrentClip() {
    const clip = currentClip;
    if (!project || !clip) return;
    setBusy(true);
    setError(null);
    try {
      // 1 — words (transcribe on demand; silence detection rides them)
      let words = project.captions[clip.id] ?? [];
      if (!words.length) {
        setNote('Transcribing the scene first — silence detection rides the Whisper words…');
        const res = await fetch('/api/admin/reel-captions', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url: clip.url }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Transcription failed');
        words = json.words as ReelWord[];
      }

      // 2 — the plan (against the EFFECTIVE end, so an existing tail trim is honored)
      const effDur = effectiveClipDuration(clip);
      const gaps = findSilenceGaps(words, effDur);
      if (!gaps.length) {
        setNote('No silent gaps — 0.6s in this scene — already tight.');
        return;
      }
      const removed = gapTotalSec(gaps);
      const ok = window.confirm(
        `Cut ${gaps.length} silent gap${gaps.length > 1 ? 's' : ''} (${removed.toFixed(1)}s) from "${clip.name}"?\n` +
          'The scene becomes speech-tight clips and the karaoke re-times. Ctrl+Z restores it.',
      );
      if (!ok) return;

      // 3 — undo checkpoint, then save so the server's timeline matches ours
      recordHistory();
      const saved = await save();
      if (!saved) return;
      setBusy(true); // save() clears busy in its finally — the chain still runs

      let proj: ReelProject = { ...saved, captions: { ...saved.captions, [clip.id]: words } };
      const keptSegs = keptSegments(gaps, effDur);
      const keptIds: string[] = gaps[0].start <= 0.05 ? [] : [clip.id];

      let tailId = clip.id;
      let offset = 0; // source seconds where the current tail clip starts
      let cutCount = 0;

      for (const gap of gaps) {
        if (gap.start <= 0.05) {
          // leading air: split at the gap end, drop the silent head (part A)
          const json = await splitCall(proj.id, tailId, gap.end - offset);
          proj = { ...json.project, clips: json.project.clips.filter((c) => c.id !== tailId) };
          tailId = json.partBId;
          offset = gap.end;
          keptIds.push(tailId);
        } else if (gap.end >= effDur - 0.05) {
          // trailing air: pure tail trim — no worker call
          const localStart = gap.start - offset;
          proj = {
            ...proj,
            clips: proj.clips.map((c) =>
              c.id === tailId
                ? {
                    ...c,
                    trimEndSec: Math.max(0, Math.round((c.durationSec - localStart) * 10) / 10),
                  }
                : c,
            ),
          };
        } else {
          // mid gap: split at the start (speech head keeps the id), split the new
          // tail at the gap end, drop the silent middle
          const first = await splitCall(proj.id, tailId, gap.start - offset);
          const second = await splitCall(first.project.id, first.partBId, gap.end - gap.start);
          proj = {
            ...second.project,
            clips: second.project.clips.filter((c) => c.id !== first.partBId),
          };
          tailId = second.partBId;
          offset = gap.end;
          keptIds.push(tailId);
        }
        cutCount += 1;
        setNote(`Cutting silence… ${cutCount}/${gaps.length}`);
      }

      // 4 — karaoke re-timed onto the kept segments, then one final save
      const nextCaptions = { ...proj.captions };
      delete nextCaptions[clip.id];
      keptSegs.forEach((seg, i) => {
        const id = keptIds[i];
        if (!id) return;
        const remapped = remapWordsForSegment(words, seg.start, seg.end);
        if (remapped.length) nextCaptions[id] = remapped;
      });
      proj = { ...proj, captions: nextCaptions };
      setProject(proj);
      setSelectedClip(keptIds[0] ?? null);
      setNote(
        `Silence cut — ${cutCount} gap${cutCount > 1 ? 's' : ''}, ${removed.toFixed(1)}s saved. Karaoke re-timed.`,
      );
      await post({ action: 'save', project: proj });
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cut silence failed');
    } finally {
      setBusy(false);
    }
  }


  /**
   * Execute the Director's action list against the live timeline. Every action
   * is validated and clamped here — the Director can only trim/remove/move,
   * and never below 0.5s of a scene remaining. Returns human-readable
   * summaries of what actually happened.
   */
  function applyDirectorActions(actions: DirectorAction[]): string[] {
    const applied: string[] = [];
    if (!project) return applied;
    const clips = project.clips.slice();
    for (const a of actions) {
      if (a.type === 'trim' && a.index != null && clips[a.index] && a.trimEndSec != null) {
        const c = clips[a.index];
        const maxTrim = Math.max(0, c.durationSec - 0.5);
        const trim = Math.round(Math.max(0, Math.min(a.trimEndSec, maxTrim)) * 10) / 10;
        if (trim === c.trimEndSec) continue;
        clips[a.index] = { ...c, trimEndSec: trim };
        applied.push(`Trimmed scene ${a.index + 1} (${c.name}) to ${fmtSec(c.durationSec - trim)}`);
      } else if (a.type === 'remove' && a.index != null && clips[a.index]) {
        const [gone] = clips.splice(a.index, 1);
        applied.push(`Removed scene ${a.index + 1} (${gone.name})`);
      } else if (
        a.type === 'move' &&
        a.from != null &&
        a.to != null &&
        clips[a.from] &&
        a.to >= 0 &&
        a.to < clips.length
      ) {
        const [item] = clips.splice(a.from, 1);
        clips.splice(a.to, 0, item);
        applied.push(`Moved ${item.name} to position ${a.to + 1}`);
      }
    }
    if (applied.length) patch({ clips });
    return applied;
  }

  /** Talk to the Director. The reply renders; the actions EXECUTE on the timeline. */
  async function sendDirector(text?: string) {
    const message = (text ?? directorInput).trim();
    if (!message || !project) return;
    setDirectorMessages((m) => [...m, { role: 'user', text: message }]);
    setDirectorInput('');
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/reel-director', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message,
          clips: project.clips.map((c) => ({
            name: c.name,
            durationSec: c.durationSec,
            trimEndSec: c.trimEndSec,
          })),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Director failed');
      const applied = applyDirectorActions(
        Array.isArray(json.actions) ? (json.actions as DirectorAction[]) : [],
      );
      setDirectorMessages((m) => [
        ...m,
        { role: 'director', text: json.reply || '(no comment)', applied },
      ]);
    } catch (err) {
      setDirectorMessages((m) => [
        ...m,
        {
          role: 'director',
          text: err instanceof Error ? `Couldn't reach the booth: ${err.message}` : 'Failed',
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  /** Cutdown Agent: one long video URL in — self-contained reels out, in the list. */
  async function runCutdown() {
    const url = window.prompt(
      'Paste a public URL of a LONG video (≤25MB) — the Cutdown Agent finds the reels inside it:',
    );
    if (!url || !/^https?:\/\//i.test(url.trim())) return;
    setBusy(true);
    setError(null);
    setNote('Cutdown running — transcribing, picking, and cutting segments (can take a minute)…');
    try {
      const res = await fetch('/api/admin/reel-cutdown', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Cutdown failed');
      const names = Array.isArray(json.segments)
        ? json.segments.map((s: { title: string }) => `“${s.title}”`).join(', ')
        : '';
      setNote(`Cutdown made ${json.projects.length} reel(s): ${names} — they're in the reel list.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cutdown failed');
    } finally {
      setBusy(false);
    }
  }

  /** The loop: variants + metrics + winner, batch compose, weekly regenerate. */
  async function loadLoop() {
    try {
      const res = await fetch('/api/admin/reel-loop', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setLoopRows(json.rows);
        setLoopWinner(json.winner ?? null);
        const leader = json.geneLeaders?.hook as
          | { gene: string; avgCtr: number; variants: number }
          | undefined;
        setGeneLeaderLine(
          leader
            ? `★ hook gene: ${leader.gene} — ${(leader.avgCtr * 100).toFixed(1)}% avg CTR across ${leader.variants} variant(s)`
            : null,
        );
      }
      // Variant schedule statuses (scoreboard chips)
      const schedRes = await fetch('/api/admin/reel-loop', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'variant-schedules' }),
      });
      const schedJson = await schedRes.json();
      if (schedJson.success) {
        const map: Record<string, { scheduled: boolean; platform: string | null; format: string | null; publishState: string | null; linkCode?: string | null; linkClicks?: number }> = {};
        for (const s of (schedJson.statuses ?? []) as { variantId: string; scheduled: boolean; platform: string | null; format: string | null; publishState: string | null; linkCode?: string | null; linkClicks?: number }[]) {
          map[s.variantId] = { scheduled: s.scheduled, platform: s.platform, format: s.format, publishState: s.publishState, linkCode: s.linkCode, linkClicks: s.linkClicks };
        }
        setLoopStatuses(map);
      }
    } catch {
      /* keep last good rows */
    }
  }

  async function composeBatch() {
    setBusy(true);
    setError(null);
    setNote('Batch composing every reel with scenes (unchanged timelines reuse the cache)…');
    try {
      const res = await fetch('/api/admin/reel-loop', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'compose-batch' }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Batch failed');
      setBatchResults(json.results);
      setNote(
        `Batch done — ${json.results.filter((r: { status: string }) => r.status === 'composed').length} composed, ` +
          `${json.results.filter((r: { status: string }) => r.status === 'cached').length} cached, ` +
          `${json.results.filter((r: { status: string }) => r.status === 'failed').length} failed.`,
      );
      void loadLoop();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Batch failed');
    } finally {
      setBusy(false);
    }
  }

  /** Queue the batch as a job and poll it — the page stays editable while it runs. */
  async function queueBatch() {
    setNote('Batch queued — it runs in the background; results land here when done.');
    try {
      const res = await fetch('/api/admin/reel-loop', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'queue-batch' }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Queue failed');
      const jobId = String(json.jobId);
      for (let i = 0; i < 90; i += 1) {
        await new Promise((r) => setTimeout(r, 4000));
        const st = await fetch('/api/admin/reel-loop', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'job-status', jobId }),
        });
        const sj = await st.json();
        if (!sj.success) throw new Error(sj.error || 'Job status failed');
        if (sj.status === 'done') {
          const results = (sj.progress?.results ?? []) as { name: string; status: string }[];
          setBatchResults(results);
          setNote(
            `Queued batch done — ${results.filter((r) => r.status === 'composed').length} composed, ` +
              `${results.filter((r) => r.status === 'cached').length} cached, ` +
              `${results.filter((r) => r.status === 'failed').length} failed.`,
          );
          void loadLoop();
          return;
        }
        if (sj.status === 'failed') throw new Error(sj.error || 'Batch failed');
      }
      setNote('Batch is still running — check the board in a minute.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Queue failed');
    }
  }

  /** Roll link clicks onto variants (the nightly cron does this too). */
  async function rollupMetrics() {
    try {
      const res = await fetch('/api/admin/reel-loop', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'rollup-metrics' }),
      });
      const json = await res.json();
      if (json.success) {
        setNote(
          json.updated > 0
            ? `Rolled ${json.clicksTotal.toLocaleString()} clicks onto ${json.updated} variant(s) from their tracked links.`
            : 'No variant links yet — attach one with the + link button on a variant row.',
        );
      }
      void loadLoop();
    } catch {
      /* keep last rows */
    }
  }

  /** Attach a variant to a tracked link so its clicks roll up automatically. */
  async function linkVariant(variantId: string) {
    const raw = window.prompt(
      "Paste the tracked link for this variant's post (code, go/ URL, or link id):",
    );
    if (!raw?.trim()) return;
    const res = await fetch('/api/admin/reel-loop', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'link-variant', variantId, link: raw.trim() }),
    });
    const json = await res.json();
    if (json.ok || json.success) {
      setNote('Linked — clicks roll up nightly, or hit "rollup" now.');
      void rollupMetrics();
    } else {
      setError(json.error || 'Link failed');
    }
  }

  /** R13: the ONE Schedule sheet — a Scoreboard row (variant) or the current reel. */
  const [schedRow, setSchedRow] = useState<LoopRow | null>(null);
  const [schedOpen, setSchedOpen] = useState(false);
  /** Thumbnail Lab: which variant/reel is being thumbnailed (null = closed). */
  const [thumbLabRow, setThumbLabRow] = useState<LoopRow | null>(null);
  const [thumbLabReel, setThumbLabReel] = useState(false);
  /** The exported thumbnail URL per variant id — shows on the Scoreboard row after export. */
  const [thumbByVariant, setThumbByVariant] = useState<Record<string, string>>({});
  /** R14: bulk mode on the Scoreboard — pick variants, batch-schedule with settings check. */
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  /** Render the current reel's final MP4 (the ffmpeg compose) and return its URL. */
  async function renderCurrent(): Promise<string> {
    const saved = await save();
    if (!saved) throw new Error('Save failed — the timeline did not reach the server.');
    const json = await post({ action: 'compose', id: saved.id });
    const url = typeof json?.videoUrl === 'string' ? (json.videoUrl as string) : '';
    if (!url) throw new Error('Compose returned no video URL.');
    setProject(json?.project as ReelProject);
    void load();
    return url;
  }

  async function recordMetric(variantId: string) {
    const raw = window.prompt('Result for this variant — "impressions clicks" (e.g. 1200 87):');
    if (!raw) return;
    const [imps, clicks] = raw.trim().split(/\s+/).map(Number);
    if (!(imps > 0) || !(clicks >= 0)) return;
    await fetch('/api/admin/reel-loop', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'record-metrics',
        variantId,
        impressions: imps,
        clicks,
      }),
    });
    void loadLoop();
  }

  async function runWeeklyLoop() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/reel-loop', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'weekly-loop' }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Loop failed');
      setNote(
        `The loop turned. Winner: “${json.winner.name}” (${(json.winner.ctr * 100).toFixed(1)}% CTR) — ` +
          `${json.created.length} descendant drafts in your reel list.`,
      );
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Loop failed');
    } finally {
      setBusy(false);
    }
  }

  /** Duplicate this reel as an A/B variant ("… (B)") in the project list. */
  async function duplicateAsVariant() {


    if (!project) return;
    const json = await post({
      action: 'save',
      project: {
        ...project,
        id: undefined,
        name: `${project.name || 'Untitled reel'} (B)`.slice(0, 150),
      },
    });
    if (json?.project) {
      setNote(`Variant saved — "${(json.project as ReelProject).name}" is in the reel list.`);
      void load();
    }
  }

  /** Insert position for new scenes: right after the current clip (or at the end). */
  function insertClipAtPlayhead(clip: ReelClip) {
    if (!project) {
      // First clip of a brand-new session — stand up a local draft so the
      // player never waits on a server round-trip.
      setProject({
        id: `draft-${Date.now().toString(36)}`,
        name: clip.name.slice(0, 48) || 'Untitled reel',
        clips: [clip],
        audio: null,
      } as ReelProject);
      return;
    }
    const at = currentClip
      ? project.clips.findIndex((c) => c.id === currentClip.id) + 1
      : project.clips.length;
    const next = project.clips.slice();
    next.splice(Math.max(0, at), 0, clip);
    patch({ clips: next });
  }

  // Stage settings persist across reloads (aspect/fit/zoom).
  useEffect(() => {
    try {
      const a = localStorage.getItem('reel-studio:aspect');
      if (a === '9:16' || a === '16:9' || a === '1:1') setAspect(a);
      const f = localStorage.getItem('reel-studio:fit');
      if (f === 'contain' || f === 'cover') setFit(f);
      const z = Number(localStorage.getItem('reel-studio:zoom'));
      if (Number.isFinite(z) && z >= 1) setZoom(Math.min(8, Math.max(1, z)));
    } catch {
      /* private mode */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('reel-studio:aspect', aspect);
      localStorage.setItem('reel-studio:fit', fit);
      localStorage.setItem('reel-studio:zoom', String(zoom));
      localStorage.setItem('reel-studio:postTarget', JSON.stringify(postTarget));
      localStorage.setItem('reel-studio:lensMode', lensMode);
    } catch {
      /* private mode */
    }
  }, [aspect, fit, zoom, postTarget, lensMode]);

  // R8 cascade: the post target drives the canvas aspect (user can still override after).
  useEffect(() => {
    setAspect(targetAspect(postTarget));
    setTargetOverride(null); // R26: a new target = its own default length budget
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postTarget]);

  // The copy pool persists per reel — Publish view edits, the canvas lens reads.
  useEffect(() => {
    try {
      const raw = project?.id ? localStorage.getItem(`reel-studio:copy:${project.id}`) : null;
      setCopyPool(raw ? JSON.parse(raw) : null);
    } catch {
      setCopyPool(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);
  useEffect(() => {
    if (!project?.id || !copyPool) return;
    try {
      localStorage.setItem(`reel-studio:copy:${project.id}`, JSON.stringify(copyPool));
    } catch {
      /* private mode */
    }
  }, [copyPool, project?.id]);

  // The post target + lens mode load once (default: YouTube Shorts, lens on).
  useEffect(() => {
    try {
      const raw = localStorage.getItem('reel-studio:postTarget');
      if (raw) {
        const t = JSON.parse(raw) as PostTarget;
        if (TARGET_GROUPS.some((g) => g.brand === t.brand && g.types.some((x) => x.id === t.type))) {
          setPostTarget(t);
        }
      }
      const m = localStorage.getItem('reel-studio:lensMode');
      if (m === 'clean' || m === 'platform') setLensMode(m);
    } catch {
      /* private mode */
    }
  }, []);

  // While playing, keep the playhead scrolled into view on the (zoomed) strip.
  useEffect(() => {
    if (!playing) return;
    const el = stripScrollRef.current;
    if (!el || total <= 0) return;
    const x = (playheadSec / Math.max(total, 0.001)) * el.scrollWidth;
    const view = el.clientWidth;
    if (x < el.scrollLeft + 40 || x > el.scrollLeft + view - 80) {
      el.scrollLeft = Math.max(0, x - view / 2);
    }
  }, [playheadSec, playing, total]);

  // Keyboard: Space = play/pause, S = cut at playhead, Delete = remove selected scene.
  useEffect(() => {

    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) redoEdit();
        else undoEdit();
        return;
      }
      if (e.key === '?') {
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }
      if (e.code === 'Space' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        stopClock();
        seekTimeline(clockRef.current.t - (e.shiftKey ? 5 : 1));
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        stopClock();
        seekTimeline(clockRef.current.t + (e.shiftKey ? 5 : 1));
      } else if (e.key === 's' || e.key === 'S') {
        splitAtPlayhead();
      } else if (e.key === 'c' || e.key === 'C') {
        // C = CUT the tail at the playhead (instant, undo-safe)
        e.preventDefault();
        cutTailAtPlayhead();
      } else if (e.key === ',' || e.key === '.') {
        // , / . = frame-step (1/30s) — the precision nudge before a cut
        e.preventDefault();
        stopClock();
        seekTimeline(clockRef.current.t + (e.key === ',' ? -1 : 1) / 30);
      } else if (
        (e.key === 'ArrowLeft' || e.key === 'ArrowRight') &&
        !stackEditMode
      ) {
        // In Place, WordDragLayer owns arrows as a 0.5% nudge.
        e.preventDefault();
        const step = (e.shiftKey ? 5 : 1) * (e.key === 'ArrowLeft' ? -1 : 1);
        seekTimeline(clockRef.current.t + step);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClip && project && !stackEditMode) {

        patch({ clips: project.clips.filter((c) => c.id !== selectedClip) });
        setSelectedClip(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, selectedClip, total, stackEditMode]);


  return (
    <div className="flex h-full flex-col">
      {/* Caption words are hit-testable so right-click opens the word menu.
          The Remotion composition root is pointer-events-none and the placed
          words carry pointerEvents:'none' inline — without this a right-click
          on a caption falls through to the <video> and the browser pops its
          save-video menu. (The Edit-mode WordDragLayer's hit boxes sit above
          the words at z-30, so they still win there.) */}
      <style>{`[data-caption-word]{pointer-events:auto!important}`}</style>
      {/* top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-bone/10 px-4">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 rounded-lg border border-bone/15 px-2.5 py-1.5 text-xs text-bone/60 hover:bg-bone/10"
        >
          <ArrowLeftCircle className="h-3.5 w-3.5" /> Admin
        </Link>
        <Clapperboard className="h-5 w-5 text-brass" />
        <h1 className="font-display text-lg font-semibold text-bone">Clipping Studio</h1>


        <select
          value={project?.id ?? ''}
          onChange={(e) => {
            const p = (projects ?? []).find((x) => x.id === e.target.value);
            setProject(p ?? null);
            setSelectedClip(null);
          }}
          className="ml-3 rounded-lg border border-bone/15 bg-ink px-2 py-1.5 text-xs text-bone/80"
        >
          <option value="">— pick a reel —</option>
          {(projects ?? [])
            // Roster records (`Twin: …`) are twin storage, not edits — they
            // never show in the studio's picker.
            .filter((p) => !isTwinReel(p.name))
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || 'Untitled reel'} ({p.clips.length})
              </option>
            ))}
        </select>
        <button
          onClick={() => void newProject()}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-lg border border-brass/30 px-2.5 py-1.5 text-xs font-medium text-brass hover:bg-brass/10 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" /> New
        </button>
        <button
          onClick={() => void runCutdown()}
          disabled={busy}
          title="Cutdown Agent — one long video in, self-contained reels out"
          className="inline-flex items-center gap-1 rounded-lg border border-bone/15 px-2.5 py-1.5 text-xs font-medium text-bone/60 hover:bg-bone/10 disabled:opacity-50"
        >
          <Scissors className="h-3.5 w-3.5" /> Cutdown
        </button>


        {project && (
          <>
            <input
              value={project.name}
              onChange={(e) => patch({ name: e.target.value })}
              className="ml-2 min-w-0 flex-1 rounded-lg border border-bone/15 bg-ink px-2.5 py-1.5 text-sm text-bone/85 outline-none focus:border-brass/40"
            />
            <span className="shrink-0 text-xs text-bone/40">
              {project.clips.length} clips · {fmtSec(total)}
            </span>
            <button
              onClick={() => void save()}
              disabled={busy}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brass px-3 py-1.5 text-xs font-semibold text-ink hover:bg-brass/90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save
            </button>
            {hook && (
              <span
                className={clsx(
                  'inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold',
                  hook.band === 'hot'
                    ? 'border-brass/50 bg-brass/10 text-brass'
                    : hook.band === 'warm'
                      ? 'border-bone/20 text-bone/60'
                      : 'border-red-500/30 text-red-300/80',
                )}
                title={`Hook score ${hook.score}/100${hook.verified ? '' : ' (unverified — transcribe scene 1)'}\n${hook.reasons.join('\n')}`}
              >
                <Zap className="h-3 w-3" /> {hook.score}
              </span>
            )}
            <button
              onClick={() => void compose()}
              disabled={busy || errors.length > 0}
              title={errors.join(' ') || 'Compose the final MP4'}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-brass/40 px-3 py-1.5 text-xs font-semibold text-brass hover:bg-brass/10 disabled:opacity-40"
            >
              <Film className="h-3.5 w-3.5" /> Compose
            </button>
            {/* THE export. `Caption MP4` used to sit here — an ffmpeg pass that
                burned captions onto an existing compose. It's gone: it drew the
                same captions a second, worse way (no per-word motion, its own
                font resolution), so it was a permanent source of "why doesn't
                the MP4 match the preview?". Remotion renders the real caption
                components frame by frame; one export path, one answer. */}
            <RenderButton job={renderJob} />
            <button
              onClick={() => void duplicateAsVariant()}
              disabled={busy}
              title="Duplicate this reel as an A/B variant"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-bone/15 px-3 py-1.5 text-xs font-semibold text-bone/60 hover:bg-bone/10 disabled:opacity-40"
            >
              <Copy className="h-3.5 w-3.5" /> Variant
            </button>
            <button
              onClick={() => setPublishOpen(true)}
              disabled={!previewSrc}
              title="How this reel looks on every platform"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-brass/30 px-3 py-1.5 text-xs font-semibold text-brass/90 hover:bg-brass/10 disabled:opacity-40"
            >
              <Film className="h-3.5 w-3.5" /> Publish view
            </button>


            <button
              onClick={async () => {
                const json = await post({ action: 'delete', id: project.id });
                if (json) {
                  setProject(null);
                  void load();
                }
              }}
              disabled={busy}
              className="inline-flex shrink-0 items-center rounded-lg border border-red-500/25 px-2 py-1.5 text-red-300/70 hover:bg-red-500/10 disabled:opacity-40"
              title="Delete reel"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </header>

      {/* The note/error banner is a FLOATING toast — never in the flow. In the
          flow it pushed the player down and shrank the preview every time a
          note landed ("the preview got smaller after mounting"). Now it floats
          over the top and the player never budges. */}
      {(note || error) && (
        <div className="pointer-events-none fixed left-1/2 top-16 z-[70] -translate-x-1/2 px-4">
          {note && (
            <p className="rounded-lg border border-brass/30 bg-ink/95 px-3 py-1.5 text-xs text-brass/90 shadow-lg backdrop-blur">{note}</p>
          )}
          {error && (
            <p className="mt-1 rounded-lg border border-red-500/30 bg-ink/95 px-3 py-1.5 text-xs text-red-200 shadow-lg backdrop-blur">
              {error}
            </p>
          )}
        </div>
      )}

      {/* body */}
      {!project ? (
        <div className="flex flex-1 items-center justify-center p-8">
          {projects === null ? (
            <Loader2 className="h-5 w-5 animate-spin text-bone/40" />
          ) : (
            <div className="w-full max-w-md rounded-2xl border border-bone/10 bg-bone/[0.03] p-8 text-center">
              <Clapperboard className="mx-auto h-10 w-10 text-brass/70" />
              <h2 className="mt-3 font-display text-xl font-semibold text-bone">The cutting room</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-bone/45">
                Find the reels inside any long video, tighten them with the Director, caption them
                with karaoke, and let the loop learn what your audience rewards.
              </p>
              <div className="mt-5 flex items-center justify-center gap-2">
                <button
                  onClick={() => void newProject()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brass px-4 py-2 text-xs font-semibold text-ink hover:bg-brass/90"
                >
                  <Plus className="h-3.5 w-3.5" /> New reel
                </button>
                <button
                  onClick={() => void runCutdown()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-bone/15 px-4 py-2 text-xs font-semibold text-bone/70 hover:bg-bone/10"
                >
                  <Scissors className="h-3.5 w-3.5" /> Cutdown a long video
                </button>
              </div>
              {(projects ?? []).length > 0 && (
                <p className="mt-4 text-[10px] text-bone/30">
                  …or pick one of your {projects.length} reel(s) from the dropdown above.
                </p>
              )}
            </div>
          )}
        </div>
      ) : (

        <div className="flex min-h-0 flex-1">
          {/* left tools */}
          <aside className="flex shrink-0 border-r border-bone/10">
            {/* the tool rail — tools go down the side vertically, never cramped */}
            <nav className="flex w-16 shrink-0 flex-col gap-1 border-r border-bone/10 p-1.5">
              {(
                [
                  ['post', 'Post', Layers],
                  ['clone', 'Clone', PersonStanding],
                  ['clips', 'Scenes', Film],
                  ['captions', 'Captions', Mic],
                  ['scripts', 'Scripts', FileText],
                  ['board', 'Board', LayoutList],
                  ['director', 'Director', Clapperboard],
                  ['scoreboard', 'Board', Trophy],
                  ['genes', 'Genes', GitFork],
                  ['vault', 'Vault', Library],
                ] as [Tab, string, typeof Film][]
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  onClick={() => {
                    setTab(id);
                    if (id === 'vault' && vaultAssets === null) void loadVault();
                    if (id === 'scoreboard' && loopRows === null) void loadLoop();
                  }}
                  title={label}
                  className={clsx(
                    'flex flex-col items-center gap-1 rounded-lg border-l-2 px-1 py-2.5 text-[9px] font-semibold',
                    tab === id
                      ? 'border-brass bg-brass/10 text-brass'
                      : 'border-transparent text-bone/45 hover:bg-bone/5 hover:text-bone/75',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </nav>

            {/* the open tool panel */}
            <div className="flex w-[330px] shrink-0 flex-col">
              <div className="flex h-10 shrink-0 items-center justify-between border-b border-bone/10 px-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-bone/50">
                  {tab === 'post' && 'Post assets'}
                  {tab === 'clone' && 'AI Clone'}
                  {tab === 'clips' && 'Scenes'}
                  {tab === 'captions' && 'Captions'}
                  {tab === 'scripts' && 'Script Lab'}
                  {tab === 'board' && 'The Board'}
                  {tab === 'director' && 'Director'}
                  {tab === 'scoreboard' && 'Scoreboard'}
                  {tab === 'genes' && 'Genes'}
                  {tab === 'vault' && 'The Vault'}
                </span>
                <span className="text-[10px] text-bone/30">
                  {tab === 'clips' && `${project.clips.length} scenes · ${fmtSec(total)}`}
                  {tab === 'director' && 'cuts execute live'}
                </span>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {tab === 'clone' && (
                <ClonePanel
                  project={project}
                  onSavePlan={saveClonePlan}
                  onAssemble={assembleCloneBeats}
                  onNote={setNote}
                  library={cloneLibraryEntries(projects ?? [], project.id)}
                />
              )}
              {tab === 'clips' && (
                <div className="space-y-2">
                  {/* add scene — new material enters at the TOP of the panel */}
                  <div className="space-y-1.5 rounded-xl border border-bone/10 bg-bone/[0.04] p-2">
                    <div className="flex items-center gap-1.5">
                      <input
                        value={addUrl}
                        onChange={(e) => setAddUrl(e.target.value)}
                        placeholder="https://… direct MP4/WebM"
                        className="min-w-0 flex-1 rounded-lg border border-bone/15 bg-ink px-2 py-1.5 text-[11px] text-bone/80 outline-none placeholder:text-bone/25"
                      />
                      <button
                        onClick={() => void addClipByUrl()}
                        disabled={!addUrl.trim()}
                        className="rounded-lg bg-brass px-2.5 py-1.5 text-[10px] font-semibold text-ink disabled:opacity-40"
                      >
                        add
                      </button>
                      <button
                        onClick={() => fileInput.current?.click()}
                        className="inline-flex items-center gap-1 rounded-lg border border-bone/15 px-2 py-1.5 text-[10px] text-bone/60 hover:bg-bone/10"
                      >
                        <Upload className="h-3 w-3" /> upload
                      </button>
                      <input
                        ref={fileInput}
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void addUpload(f, 'video');
                          e.target.value = '';
                        }}
                      />
                    </div>
                    <button
                      onClick={() => void openHubPicker()}
                      className={clsx(
                        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold',
                        hubOpen
                          ? 'bg-brass/15 text-brass'
                          : 'text-bone/45 hover:bg-bone/10 hover:text-bone/70',
                      )}
                      title="Import a render from the Content Hub"
                    >
                      <Sparkles className="h-3 w-3" /> from Hub
                    </button>
                    {hubOpen && (
                      <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-bone/10 bg-ink/60 p-1.5">
                        {hubPieces === null ? (
                          <p className="flex items-center gap-1.5 px-2 py-2 text-[10px] text-bone/40">
                            <Loader2 className="h-3 w-3 animate-spin" /> Loading Hub renders…
                          </p>
                        ) : hubPieces.length === 0 ? (
                          <p className="px-2 py-2 text-[10px] text-bone/30">
                            No video renders in the Content Hub yet — generate one there, it lands here.
                          </p>
                        ) : (
                          hubPieces.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => void importHubPiece(p)}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-brass/10"
                            >
                              <Thumb
                                url={p.media?.src as string}
                                t={0.5}
                                className="h-8 w-11 shrink-0 rounded bg-black object-cover"
                              />
                              <span className="min-w-0 flex-1 truncate text-[10px] text-bone/75">
                                {p.hook || 'Hub render'}
                              </span>
                              <Plus className="h-3 w-3 shrink-0 text-brass" />
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  {project.clips.length === 0 && (
                    <p className="rounded-lg border border-dashed border-bone/10 px-3 py-4 text-xs text-bone/35">
                      No scenes yet — add one above, or cut down a long video from the top bar.
                    </p>
                  )}
                  {project.clips.map((clip, i) => (
                    <div
                      key={clip.id}
                      onClick={() => setSelectedClip(clip.id)}
                      className={clsx(
                        'cursor-pointer rounded-xl border p-2.5',
                        selectedClip === clip.id
                          ? 'border-brass/50 bg-brass/[0.07]'
                          : 'border-bone/10 bg-bone/[0.03] hover:border-bone/25',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Thumb
                          url={clip.url}
                          t={0.5}
                          className="h-10 w-14 shrink-0 rounded bg-black object-cover"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-medium text-bone/90">
                            {i + 1}. {clip.name}
                          </div>
                          <div className="text-[10px] text-bone/40">
                            {fmtSec(effectiveClipDuration(clip))}
                            {clip.trimEndSec > 0 && (
                              <span className="text-brass/70"> (−{fmtSec(clip.trimEndSec)})</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (i === 0) return;
                            const next = project.clips.slice();
                            [next[i - 1], next[i]] = [next[i], next[i - 1]];
                            patch({ clips: next });
                          }}
                          disabled={i === 0}
                          className="text-bone/40 hover:text-bone disabled:opacity-20"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (i === project.clips.length - 1) return;
                            const next = project.clips.slice();
                            [next[i], next[i + 1]] = [next[i + 1], next[i]];
                            patch({ clips: next });
                          }}
                          disabled={i === project.clips.length - 1}
                          className="text-bone/40 hover:text-bone disabled:opacity-20"
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            patch({ clips: project.clips.filter((c) => c.id !== clip.id) });
                          }}
                          className="text-bone/30 hover:text-red-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div
                        className="mt-2 flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Scissors className="h-3 w-3 shrink-0 text-bone/35" />
                        <input
                          type="range"
                          min={0}
                          max={Math.max(0, clip.durationSec - 0.1)}
                          step={0.1}
                          value={clip.trimEndSec}
                          onChange={(e) => {
                            const trim = Number(e.target.value);
                            patchClip(clip.id, { trimEndSec: trim });
                            setSelectedClip(clip.id);
                            scrubToCut(clip, trim);
                          }}
                          className="min-w-0 flex-1 accent-brass"
                        />
                        <input
                          type="number"
                          min={0}
                          max={Math.max(0, clip.durationSec - 0.1)}
                          step={0.1}
                          value={clip.trimEndSec}
                          onChange={(e) => patchClip(clip.id, { trimEndSec: Number(e.target.value) })}
                          className="w-14 rounded border border-bone/15 bg-ink px-1 py-0.5 text-[10px] text-bone/80"
                        />
                      </div>
                      {/* R15 Motion Lab: preset chips on the SELECTED scene — live CSS preview */}
                      {selectedClip === clip.id && (
                        <div
                          className="mt-2 flex flex-wrap items-center gap-1 border-t border-bone/10 pt-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-[8px] font-bold uppercase tracking-wide text-bone/30">
                            motion
                          </span>
                          <button
                            onClick={() => patchClip(clip.id, { motion: undefined })}
                            className={clsx(
                              'rounded px-1.5 py-0.5 text-[9px] font-semibold',
                              !clip.motion ? 'bg-brass text-ink' : 'text-bone/40 hover:bg-bone/10',
                            )}
                          >
                            none
                          </button>
                          {MOTION_PRESETS.map((p) => (
                            <button
                              key={p.id}
                              onClick={() =>
                                patchClip(clip.id, {
                                  motion: presetKeys(p.id, effectiveClipDuration(clip)),
                                })
                              }
                              title={p.hint}
                              className={clsx(
                                'rounded px-1.5 py-0.5 text-[9px] font-semibold',
                                detectPreset(clip.motion, effectiveClipDuration(clip)) === p.id
                                  ? 'bg-brass text-ink'
                                  : 'text-bone/50 hover:bg-bone/10',
                              )}
                            >
                              {p.label}
                            </button>
                          ))}
                          {/* per-key editor — SLIDERS, not number boxes: — time + a zoom slider per key */}
                          {clip.motion && clip.motion.length >= 2 && (
                            <div className="mt-1.5 w-full space-y-1.5 rounded-lg border border-brass/25 bg-brass/[0.04] p-2">
                              {clip.motion.map((k, ki) => (
                                <div key={ki}>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] text-brass">★</span>
                                    <input
                                      type="number"
                                      step={0.05}
                                      min={0}
                                      max={effectiveClipDuration(clip)}
                                      value={k.t}
                                      onChange={(e) => setMotionKey(clip, ki, { t: Number(e.target.value) })}
                                      title="key time (s) — or drag the — on the timeline"
                                      className="w-14 rounded border border-bone/15 bg-ink px-1.5 py-0.5 text-[10px] text-bone/80"
                                    />
                                    <input
                                      type="range"
                                      min={0.6}
                                      max={2}
                                      step={0.01}
                                      value={k.scale}
                                      onChange={(e) => setMotionKey(clip, ki, { scale: Number(e.target.value) })}
                                      title={`zoom ${k.scale.toFixed(2)}×`}
                                      className="min-w-0 flex-1 accent-brass"
                                    />
                                    <span className="w-10 text-right text-[9px] font-semibold text-brass/80">
                                      {k.scale.toFixed(2)}×
                                    </span>
                                    <button
                                      onClick={() => removeMotionKey(clip, ki)}
                                      className="text-bone/30 hover:text-red-300"
                                      title="Delete this key"
                                    >
                                      —
                                    </button>
                                  </div>
                                  {/* fine controls only when the key actually pans/rolls */}
                                  {(Math.abs(k.panX) > 0.05 ||
                                    Math.abs(k.panY) > 0.05 ||
                                    Math.abs(k.rotateDeg) > 0.05) && (
                                    <div className="ml-5 mt-0.5 flex items-center gap-1 text-[8px] text-bone/35">
                                      {(
                                        [
                                          ['panX', 'x'],
                                          ['panY', 'y'],
                                          ['rotateDeg', 'rot'],
                                        ] as const
                                      ).map(([field, label]) => (
                                        <label key={field} className="flex items-center gap-0.5">
                                          {label}
                                          <input
                                            type="number"
                                            step={field === 'rotateDeg' ? 0.25 : 0.5}
                                            value={Math.round(k[field] * 100) / 100}
                                            onChange={(e) =>
                                              setMotionKey(clip, ki, { [field]: Number(e.target.value) })
                                            }
                                            className="w-12 rounded border border-bone/15 bg-ink px-1 py-0.5 text-[9px] text-bone/80"
                                          />
                                        </label>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                              <button
                                onClick={() => addMotionKey(clip)}
                                className="w-full rounded border border-dashed border-brass/30 px-1 py-0.5 text-[8px] font-semibold text-brass/80 hover:bg-brass/10"
                                title="Add a keyframe at the playhead's position in this scene"
                              >
                                + key at playhead
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* audio bed — folded into Scenes (the timeline re-times it by dragging) */}
                  <div className="rounded-xl border border-bone/10 bg-bone/[0.04] p-2.5">
                    <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-bone/40">
                      <Music className="h-3 w-3" /> Audio bed
                    </div>
                    {project.audio ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-xs text-bone/85">
                            {project.audio.name}
                          </span>
                          <button
                            onClick={() => patch({ audio: null })}
                            className="text-bone/30 hover:text-red-300"
                            title="Remove the audio bed"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <audio src={project.audio.url} controls className="mt-2 h-7 w-full" />
                        <p className="mt-1.5 text-[9px] text-bone/30">
                          Drag the bed block on the timeline to re-time it.
                        </p>
                      </>
                    ) : (
                      <div className="space-y-1.5">
                        <textarea
                          value={voText}
                          onChange={(e) => setVoText(e.target.value)}
                          rows={2}
                          placeholder="Voiceover script — one or two sentences, spoken word"
                          className="w-full rounded-lg border border-bone/15 bg-ink px-2 py-1.5 text-[11px] text-bone/80 outline-none placeholder:text-bone/25"
                        />
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => void generateVoiceover()}
                            disabled={busy || !voText.trim()}
                            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-brass px-2 py-1.5 text-[10px] font-semibold text-ink disabled:opacity-40"
                          >
                            <Mic className="h-3 w-3" /> Voiceover
                          </button>
                          <button
                            onClick={() => audioInput.current?.click()}
                            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-bone/15 px-2 py-1.5 text-[10px] text-bone/60 hover:bg-bone/10"
                          >
                            <Upload className="h-3 w-3" /> Upload
                          </button>
                        </div>
                        <input
                          ref={audioInput}
                          type="file"
                          accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void addUpload(f, 'audio');
                            e.target.value = '';
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* R25 overlay (b-roll) layers — add a clip ON TOP at the playhead */}
                  <div className="rounded-xl border border-violet-500/25 bg-violet-500/[0.05] p-2.5">
                    <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-violet-300/80">
                      <Layers className="h-3 w-3" /> Overlay layers
                      <span className="ml-auto text-[9px] font-normal normal-case text-violet-300/50">
                        {(project.overlays ?? []).length} on the lane
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        value={overlayUrl}
                        onChange={(e) => setOverlayUrl(e.target.value)}
                        placeholder="https://… b-roll MP4/WebM"
                        className="min-w-0 flex-1 rounded-lg border border-violet-500/25 bg-ink px-2 py-1.5 text-[11px] text-bone/80 outline-none placeholder:text-bone/25"
                      />
                      <button
                        onClick={() => void addOverlayByUrl()}
                        disabled={!overlayUrl.trim()}
                        className="shrink-0 rounded-lg bg-violet-500 px-2.5 py-1.5 text-[10px] font-semibold text-white hover:bg-violet-500/90 disabled:opacity-40"
                        title="Add this clip as an overlay layer at the playhead"
                      >
                        + layer
                      </button>
                    </div>
                    {/* Pexels b-roll: search → a stock clip attaches as an
                        overlay at the playhead (no Seedance render, no upload). */}
                    <div className="mt-1.5 flex items-center gap-1">
                      <input
                        value={brollQuery}
                        onChange={(e) => setBrollQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void searchBroll();
                        }}
                        placeholder="or search Pexels b-roll (city, money, gym…)"
                        className="min-w-0 flex-1 rounded-lg border border-violet-500/25 bg-ink px-2 py-1.5 text-[11px] text-bone/80 outline-none placeholder:text-bone/25"
                      />
                      <button
                        onClick={() => void searchBroll()}
                        disabled={brollBusy || !brollQuery.trim()}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-violet-500/40 px-2 py-1.5 text-[10px] font-semibold text-violet-200 hover:bg-violet-500/15 disabled:opacity-40"
                        title="Search Pexels stock videos — a clip attaches as an overlay at the playhead"
                      >
                        {brollBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                        search
                      </button>
                    </div>
                    {brollResults && brollResults.length > 0 && (
                      <div className="mt-1.5 grid max-h-32 grid-cols-3 gap-1 overflow-y-auto">
                        {brollResults.slice(0, 12).map((c) => (
                          <button
                            key={c.id}
                            onClick={() => addBrollOverlay(c)}
                            title={`${fmtSec(c.durationSec)} — add as an overlay at the playhead`}
                            className="group relative overflow-hidden rounded border border-violet-400/20 hover:border-violet-400"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={c.thumbUrl} alt="" className="h-14 w-full object-cover" loading="lazy" />
                            <span className="absolute bottom-0.5 right-0.5 rounded bg-black/80 px-1 text-[8px] font-semibold text-white/90">
                              {fmtSec(c.durationSec)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="mt-1 text-[9px] leading-relaxed text-violet-200/40">
                      Plays picture-in-picture over the main track at the playhead. Drag it on the
                      violet lane to re-time. (Compose burn-in for layers lands next round.)
                    </p>
                  </div>
                </div>
              )}

              {tab === 'scripts' && (
                <ScriptLabPanel
                  transcript={transcriptForProject(project)}
                  theme={project.name}
                  transcribing={busy}
                  onTranscribe={() => void transcribeCurrentClip()}
                  onUseAsVoiceover={(text) => {
                    setVoText(text);
                    setTab('clips');
                    setNote('Script loaded into the voiceover box — hit Voiceover to generate it.');
                  }}
                  onNote={setNote}
                />
              )}

              {tab === 'captions' && (
                <div className="flex h-full min-h-0 flex-col gap-2">
                  {/* R20: the subtitle word track as a FIRST-CLASS editor.
                      The wrapper gives it a FLOOR. SubtitlePanel is already
                      `flex-1`, but flex-1 only hands out what's LEFT OVER — and
                      the gallery (46% cap) plus the tall fancy-subtitles block
                      below claimed nearly all of it, so the word list collapsed
                      to a couple of scrolling lines. A min-height means the
                      thing you actually edit in can't be crowded out. */}
                  <div className="flex min-h-[240px] flex-[2] flex-col overflow-hidden">
                  <SubtitlePanel
                    words={currentClip ? (project.captions[currentClip.id] ?? []) : []}
                    clipName={currentClip?.name ?? ''}
                    playheadSec={
                      currentClip
                        ? Math.max(
                            0,
                            playheadSec -
                              timelineStartOf(
                                project.clips,
                                Math.max(
                                  0,
                                  project.clips.findIndex((c) => c.id === currentClip.id),
                                ),
                              ),
                          )
                        : 0
                    }
                    transcribing={busy}
                    onTranscribe={() => void transcribeCurrentClip()}
                    onSeek={(clipSec) => {
                      if (!currentClip) return;
                      const idx = Math.max(
                        0,
                        project.clips.findIndex((c) => c.id === currentClip.id),
                      );
                      seekTimeline(timelineStartOf(project.clips, idx) + clipSec);
                    }}
                    onEdit={(nextWords) => {
                      if (!currentClip) return;
                      const updated: ReelProject = {
                        ...project,
                        captions: { ...project.captions, [currentClip.id]: nextWords },
                      };
                      setProject(updated);
                      void post({ action: 'save', project: updated });
                    }}
                    cueMode={cueMode}
                    onCueWord={(i) => beginCueAttach(i)}
                    cuedWordIndexes={
                      new Set(
                        (project.mediaCues ?? [])
                          .filter((c) => c.clipId === currentClip?.id)
                          .map((c) => c.wordIndex),
                      )
                    }
                    fxMode={fxMode}
                    onFxWord={(i) => toggleFxWord(i)}
                    fxWordIndexes={
                      fxScope === 'individual'
                        ? new Set(fxTarget != null ? [fxTarget] : [])
                        : fxWords
                    }
                    onBehind={(fromSec, toSec) => void captionBehindSpeaker(fromSec, toSec)}
                    behindBusy={behindBusy}
                  />
                  </div>
                  {/* MEDIA CUES — image fly-ins keyed to spoken words (the
                      Submagic/Opus b-roll beat). Cue mode turns word clicks into
                      attaches; auto matches strong words to library images. */}
                  <div className="shrink-0 space-y-1.5 rounded-xl border border-violet-500/25 bg-violet-500/[0.05] p-2">
                    <div className="flex items-center gap-1.5">
                      <Layers className="h-3 w-3 text-violet-300/80" />
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-300/80">
                        Image fly-ins
                      </span>
                      <button
                        onClick={() => {
                          setCueMode((v) => !v);
                          setCuePickerWord(null);
                        }}
                        disabled={!currentClip || !(project.captions[currentClip.id]?.length ?? 0)}
                        className={clsx(
                          'ml-auto rounded px-2 py-0.5 text-[9px] font-semibold disabled:opacity-40',
                          cueMode ? 'bg-violet-500 text-white' : 'text-violet-300/80 hover:bg-violet-500/15',
                        )}
                        title="Cue mode: click a word in the subtitle list to attach an image fly-in"
                      >
                        {cueMode ? 'cue mode ON' : 'cue word'}
                      </button>
                      <button
                        onClick={() => void autoCues()}
                        disabled={!currentClip || !(project.captions[currentClip.id]?.length ?? 0)}
                        className="rounded border border-violet-400/40 px-2 py-0.5 text-[9px] font-semibold text-violet-300/90 hover:bg-violet-500/15 disabled:opacity-40"
                        title="Match strong words to Media Library images automatically"
                      >
                        auto
                      </button>
                      <button
                        onClick={() => void runCueAutopilot()}
                        disabled={
                          cueAutopilotBusy ||
                          !currentClip ||
                          !(project.captions[currentClip.id]?.length ?? 0)
                        }
                        className="inline-flex items-center gap-1 rounded border border-violet-400/60 bg-violet-500/15 px-2 py-0.5 text-[9px] font-semibold text-violet-200 hover:bg-violet-500/25 disabled:opacity-40"
                        title="The gated recipe: AI proposes fly-in beats from the transcript → you approve the list → images match (free) or generate → cues attach"
                      >
                        {cueAutopilotBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                        autopilot
                      </button>
                    </div>
                    {/* the picker: open while a word waits for its image */}
                    {cuePickerWord != null && (
                      <div className="rounded-lg border border-violet-400/30 bg-ink/60 p-1.5">
                        <p className="mb-1 flex items-center justify-between text-[9px] text-violet-200/70">
                          <span>
                            pick an image for "{project.captions[currentClip?.id ?? '']?.[cuePickerWord]?.word}"
                          </span>
                          <button onClick={() => setCuePickerWord(null)} className="text-bone/40 hover:text-bone">
                            ✕
                          </button>
                        </p>
                        {/* the sources: upload or AI-generate — either lands in the
                            Media Library AND attaches to this word in one step */}
                        <div className="mb-1.5 flex items-center gap-1">
                          <button
                            onClick={() => cueImageInput.current?.click()}
                            disabled={cueUploadBusy || cueAiBusy}
                            className="inline-flex shrink-0 items-center gap-1 rounded border border-violet-400/40 px-1.5 py-1 text-[9px] font-semibold text-violet-200/90 hover:bg-violet-500/15 disabled:opacity-40"
                            title="Upload an image — saves to the Media Library and attaches to this word"
                          >
                            {cueUploadBusy ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Upload className="h-3 w-3" />
                            )}
                            upload
                          </button>
                          <input
                            ref={cueImageInput}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void uploadCueImage(f);
                              e.target.value = '';
                            }}
                          />
                          <input
                            value={cueAiPrompt}
                            onChange={(e) => setCueAiPrompt(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void generateCueImage();
                            }}
                            placeholder="or describe it — AI generates + attaches"
                            className="min-w-0 flex-1 rounded border border-violet-400/25 bg-ink px-1.5 py-1 text-[9px] text-bone/80 outline-none placeholder:text-bone/25"
                          />
                          <button
                            onClick={() => void generateCueImage()}
                            disabled={cueAiBusy || cueUploadBusy || !cueAiPrompt.trim()}
                            className="inline-flex shrink-0 items-center gap-1 rounded bg-violet-500 px-1.5 py-1 text-[9px] font-semibold text-white hover:bg-violet-500/90 disabled:opacity-40"
                            title="Generate the image with AI — saves to the Media Library and attaches to this word"
                          >
                            {cueAiBusy ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Sparkles className="h-3 w-3" />
                            )}
                            generate
                          </button>
                        </div>
                        {/* the GIPHY sticker source — search → a transparent
                            sticker attaches as the fly-in's image. The pick
                            attaches the GIF with `animated`, so the cue plays
                            through the frame-driven <Gif> branch (preview ===
                            render); the tile previews the animated WebP. */}
                        <div className="mb-1.5 flex items-center gap-1">
                          <input
                            value={stickerQuery}
                            onChange={(e) => setStickerQuery(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void searchStickers();
                            }}
                            placeholder="or search GIPHY stickers (fire, arrow, 100…)"
                            className="min-w-0 flex-1 rounded border border-violet-400/25 bg-ink px-1.5 py-1 text-[9px] text-bone/80 outline-none placeholder:text-bone/25"
                          />
                          <button
                            onClick={() => void searchStickers()}
                            disabled={stickerBusy || !stickerQuery.trim()}
                            className="inline-flex shrink-0 items-center gap-1 rounded border border-violet-400/40 px-1.5 py-1 text-[9px] font-semibold text-violet-200/90 hover:bg-violet-500/15 disabled:opacity-40"
                            title="Search GIPHY stickers — transparent glyphs that attach as the fly-in"
                          >
                            {stickerBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                            stickers
                          </button>
                        </div>
                        {stickerResults && stickerResults.length > 0 && (
                          <div className="mb-1.5 grid max-h-28 grid-cols-4 gap-1 overflow-y-auto">
                            {stickerResults.slice(0, 24).map((s) => (
                              <button
                                key={s.id}
                                onClick={() => void attachCue(s.gifUrl, { animated: true })}
                                title={`${s.title} — animated sticker`}
                                className="overflow-hidden rounded border border-violet-400/20 bg-[repeating-conic-gradient(#1c1c1c_0%_25%,#262626_0%_50%)] bg-[length:12px_12px] hover:border-violet-400"
                              >
                                {/* the animated WebP plays in the tile, so the
                                    pick shows the motion it will render with */}
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={s.webpUrl} alt={s.title} className="h-12 w-full object-contain" loading="lazy" />
                              </button>
                            ))}
                          </div>
                        )}
                        {cueAssets === null ? (
                          <p className="flex items-center gap-1.5 px-1 py-2 text-[10px] text-bone/40">
                            <Loader2 className="h-3 w-3 animate-spin" /> Loading library…
                          </p>
                        ) : cueAssets.length === 0 ? (
                          <p className="px-1 py-2 text-[10px] text-bone/35">
                            No images in the Media Library yet — upload one there first.
                          </p>
                        ) : (
                          <div className="grid max-h-28 grid-cols-4 gap-1 overflow-y-auto">
                            {cueAssets.slice(0, 24).map((a) => (
                              <button
                                key={a.url}
                                onClick={() => void attachCue(a.url)}
                                title={a.name || a.url}
                                className="overflow-hidden rounded border border-violet-400/20 hover:border-violet-400"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={a.url} alt={a.name} className="h-12 w-full object-cover" loading="lazy" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {/* existing cues on this clip — each opens a style/motion editor */}
                    {currentClip && (project.mediaCues ?? []).some((c) => c.clipId === currentClip.id) && (
                      <div className="space-y-1">
                        <div className="flex flex-wrap gap-1">
                          {(project.mediaCues ?? [])
                            .filter((c) => c.clipId === currentClip.id)
                            .map((c) => (
                              <span
                                key={c.id}
                                className="inline-flex items-center gap-1 rounded bg-violet-500/15 px-1.5 py-0.5 text-[9px] text-violet-200"
                              >
                                🖼 "{project.captions[c.clipId]?.[c.wordIndex]?.word ?? c.wordIndex}"
                                <button
                                  onClick={() => {
                                    const opening = cueStyleEditId !== c.id;
                                    setCueStyleEditId(opening ? c.id : null);
                                    if (opening) {
                                      // Seek to the cue's word so the image (and
                                      // its drag box) appear on the canvas.
                                      const w = project.captions[c.clipId]?.[c.wordIndex];
                                      const clipIdx = project.clips.findIndex((x) => x.id === c.clipId);
                                      if (w && clipIdx >= 0) {
                                        const trimStart = project.clips[clipIdx].trimStartSec ?? 0;
                                        seekTimeline(
                                          timelineStartOf(project.clips, clipIdx) +
                                            Math.max(0, w.start - trimStart) +
                                            0.01,
                                        );
                                      }
                                    }
                                  }}
                                  className={clsx(
                                    'text-violet-300/60 hover:text-violet-100',
                                    (c.style || c.motion) && 'text-violet-300',
                                  )}
                                  title="Style + motion for this fly-in (seeks to it on the canvas)"
                                >
                                  ⚙
                                </button>
                                <button
                                  onClick={() =>
                                    void saveMediaCues((project.mediaCues ?? []).filter((x) => x.id !== c.id))
                                  }
                                  className="text-violet-300/60 hover:text-red-300"
                                  title="Remove this fly-in"
                                >
                                  ✕
                                </button>
                              </span>
                            ))}
                        </div>
                        {/* the per-cue style + keyframed motion editor — ALWAYS
                            on screen when a cue exists (the ⚙ on a chip just
                            picks WHICH cue it edits). Hiding it behind the
                            toggle is what made the settings feel "gone". */}
                        {(() => {
                          const clipCues = (project.mediaCues ?? []).filter(
                            (x) => x.clipId === currentClip.id,
                          );
                          const cue =
                            clipCues.find((x) => x.id === cueStyleEditId) ?? clipCues[0];
                          if (!cue) return null;
                          const windowSec = cueWindowSec(cue);
                          const cueWord = project.captions[cue.clipId]?.[cue.wordIndex];
                          const wordSpanSec = cueWord ? cueWord.end - cueWord.start : 0;
                          // Edge math, not flat offsets: the caption block's height
                          // from rows × sizePx (the layer's own scale: sizePx/360 ×
                          // frameW, 1.15em lines) and the cue's height from its
                          // widthPct × the image's REAL aspect — so "above" seats
                          // the cue's BOTTOM edge over the block's TOP edge,
                          // whatever the image's shape (flat offsets were landing
                          // on top of the text).
                          const captionPct = project.captionOverrides?.positionPct ?? 12;
                          const wh = aspect === '16:9' ? 16 / 9 : aspect === '1:1' ? 1 : 9 / 16;
                          const capBlockPct =
                            (project.captionOverrides?.rows ?? 1) *
                            (project.captionOverrides?.sizePx ?? CAPTION_SIZE_DEFAULT) *
                            wh * 1.15 / 3.6;
                          const capTopPct = 100 - captionPct - capBlockPct;
                          const capBottomPct = 100 - captionPct;
                          const cueHPct =
                            (cue.style?.widthPct ?? 34) * cueAspectFor(cue.url) * wh;
                          const aboveYPct = Math.max(2, Math.round(capTopPct - cueHPct - 3));
                          const belowYPct = Math.min(90, Math.round(capBottomPct + 3));
                          return (
                            <div className="space-y-1 rounded-lg border border-violet-400/25 bg-ink/70 p-1.5">
                              <p className="flex items-center justify-between text-[8px] font-semibold uppercase tracking-wide text-violet-300/60">
                                <span>
                                  fly-in style — "{project.captions[cue.clipId]?.[cue.wordIndex]?.word ?? ''}"
                                </span>
                                <button
                                  onClick={() =>
                                    void patchCue(cue.id, {
                                      style: undefined,
                                      motion: undefined,
                                      holdSec: undefined,
                                    })
                                  }
                                  className="normal-case text-bone/35 hover:text-bone"
                                  title="Back to the default card (top-right, rise+scale entrance, 1s hold)"
                                >
                                  reset
                                </button>
                              </p>
                              {(
                                [
                                  ['size', 'widthPct', 15, 80, 34],
                                  ['x', 'xPct', 0, 90, 60],
                                  ['y', 'yPct', 0, 90, 16],
                                  ['corner', 'radiusPx', 0, 60, 16],
                                ] as const
                              ).map(([label, key, min, max, dflt]) => (
                                <label
                                  key={key}
                                  className="flex items-center gap-1.5 text-[8px] text-violet-200/50"
                                >
                                  <span className="w-8 shrink-0">{label}</span>
                                  <input
                                    type="range"
                                    min={min}
                                    max={max}
                                    step={1}
                                    value={cue.style?.[key] ?? dflt}
                                    onChange={(e) =>
                                      void patchCueStyle(cue.id, {
                                        [key]: Number(e.target.value),
                                      } as Partial<NonNullable<ReelMediaCue['style']>>)
                                    }
                                    className="min-w-0 flex-1 accent-violet-400"
                                  />
                                  <span className="w-6 shrink-0 text-right text-violet-200/60">
                                    {cue.style?.[key] ?? dflt}
                                  </span>
                                </label>
                              ))}
                              {/* time on screen — the word's span + the hold after it
                                  (the plan clamps the window to the clip either way) */}
                              <label className="flex items-center gap-1.5 text-[8px] text-violet-200/50">
                                <span className="w-8 shrink-0">on screen</span>
                                <input
                                  type="range"
                                  min={0.3}
                                  max={6}
                                  step={0.1}
                                  value={cue.holdSec ?? 1}
                                  onChange={(e) =>
                                    void patchCue(cue.id, { holdSec: Number(e.target.value) })
                                  }
                                  className="min-w-0 flex-1 accent-violet-400"
                                  title="How long the image holds after its trigger word ends"
                                />
                                <span className="w-9 shrink-0 text-right text-violet-200/60">
                                  {(wordSpanSec + (cue.holdSec ?? 1)).toFixed(1)}s
                                </span>
                              </label>
                              <div className="flex items-center gap-1.5 text-[8px] text-violet-200/50">
                                <span className="w-8 shrink-0">border</span>
                                <input
                                  type="color"
                                  value={cue.style?.borderColor ?? '#a78bfa'}
                                  onChange={(e) =>
                                    void patchCueStyle(cue.id, {
                                      borderColor: e.target.value,
                                      borderPx: cue.style?.borderPx ?? 2,
                                    })
                                  }
                                  className="h-4 w-5 shrink-0 cursor-pointer rounded border border-violet-400/25 bg-transparent"
                                />
                                <input
                                  type="range"
                                  min={0}
                                  max={12}
                                  step={1}
                                  value={cue.style?.borderPx ?? 0}
                                  onChange={(e) =>
                                    void patchCueStyle(cue.id, {
                                      borderPx: Number(e.target.value),
                                      ...(Number(e.target.value) > 0
                                        ? { borderColor: cue.style?.borderColor ?? '#a78bfa' }
                                        : {}),
                                    })
                                  }
                                  className="w-12 accent-violet-400"
                                  title="Border width (0 = none)"
                                />
                                <label className="ml-auto flex items-center gap-1">
                                  shadow
                                  <input
                                    type="checkbox"
                                    checked={cue.style?.shadow !== false}
                                    onChange={(e) =>
                                      void patchCueStyle(cue.id, { shadow: e.target.checked })
                                    }
                                    className="accent-violet-400"
                                  />
                                </label>
                              </div>
                              {/* ambient feel + quick placement: float/wiggle ride on
                                  top of the entrance (and any motion track); above/below
                                  snap yPct relative to the caption block — the dashed
                                  drag box on the preview is the precise path */}
                              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                <span className="text-[8px] font-bold uppercase tracking-wide text-violet-300/50">
                                  feel
                                </span>
                                <button
                                  onClick={() => void patchCueStyle(cue.id, { ambient: undefined })}
                                  className={clsx(
                                    'rounded px-1.5 py-0.5 text-[8px] font-semibold',
                                    !cue.style?.ambient
                                      ? 'bg-violet-500 text-white'
                                      : 'text-violet-200/60 hover:bg-violet-500/15',
                                  )}
                                  title="No ambient motion"
                                >
                                  still
                                </button>
                                {(['float', 'wiggle'] as const).map((a) => (
                                  <button
                                    key={a}
                                    onClick={() => void patchCueStyle(cue.id, { ambient: a })}
                                    className={clsx(
                                      'rounded px-1.5 py-0.5 text-[8px] font-semibold',
                                      cue.style?.ambient === a
                                        ? 'bg-violet-500 text-white'
                                        : 'text-violet-200/60 hover:bg-violet-500/15',
                                    )}
                                    title={
                                      a === 'float'
                                        ? 'A gentle vertical bob while the image is on screen'
                                        : 'A soft rotational sway while the image is on screen'
                                    }
                                  >
                                    {a}
                                  </button>
                                ))}
                                <span className="mx-0.5 h-3 w-px bg-violet-400/20" />
                                <button
                                  onClick={() =>
                                    void patchCueStyle(cue.id, { z: 'above', yPct: aboveYPct })
                                  }
                                  className={clsx(
                                    'rounded px-1.5 py-0.5 text-[8px] font-semibold',
                                    cue.style?.z === 'above'
                                      ? 'bg-violet-500 text-white'
                                      : 'text-violet-200/60 hover:bg-violet-500/15',
                                  )}
                                  title="LAYER: the image paints ON TOP of the caption text (and snaps over the block)"
                                >
                                  ↑ over text
                                </button>
                                <button
                                  onClick={() =>
                                    void patchCueStyle(cue.id, { z: 'below', yPct: belowYPct })
                                  }
                                  className={clsx(
                                    'rounded px-1.5 py-0.5 text-[8px] font-semibold',
                                    (cue.style?.z ?? 'below') === 'below'
                                      ? 'bg-violet-500 text-white'
                                      : 'text-violet-200/60 hover:bg-violet-500/15',
                                  )}
                                  title="LAYER: the image paints UNDER the caption text — the house default (and snaps under the block)"
                                >
                                  ↓ under text
                                </button>
                                <span className="w-full text-[7px] leading-3 text-violet-200/35">
                                  tip: while this editor is open, the dashed box on the preview
                                  drags to move · its right edge scales
                                </span>
                              </div>
                              {/* sfx — a one-shot whoosh as the image flies in.
                                  Pick from library audio or upload one (it lands
                                  in the library tagged sfx). Renders as an <Audio>
                                  at the cue's first frame — preview and MP4 agree. */}
                              <div className="flex items-center gap-1.5 pt-0.5 text-[8px] text-violet-200/50">
                                <span className="w-8 shrink-0">sfx</span>
                                <select
                                  value={cue.sfx?.url ?? ''}
                                  onFocus={() => void loadSfxAssets()}
                                  onChange={(e) => {
                                    const url = e.target.value;
                                    void patchCue(cue.id, {
                                      sfx: url ? { url, volume: cue.sfx?.volume ?? 0.9 } : undefined,
                                    });
                                  }}
                                  className="min-w-0 flex-1 rounded border border-violet-400/25 bg-ink px-1 py-0.5 text-[8px] text-bone/80"
                                  title="A sound as the fly-in lands (library audio)"
                                >
                                  <option value="">none</option>
                                  {(sfxAssets ?? []).map((a) => (
                                    <option key={a.url} value={a.url}>
                                      {a.name || a.url.split('/').pop()}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => cueSfxInput.current?.click()}
                                  className="shrink-0 rounded border border-violet-400/40 px-1.5 py-0.5 text-[8px] font-semibold text-violet-200/80 hover:bg-violet-500/15"
                                  title="Upload a sound — saves to the library and attaches"
                                >
                                  <Upload className="h-2.5 w-2.5" />
                                </button>
                                <input
                                  ref={cueSfxInput}
                                  type="file"
                                  accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/m4a"
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) {
                                      void uploadSfx(f).then((entry) => {
                                        if (entry) void patchCue(cue.id, { sfx: { url: entry.url, volume: 0.9 } });
                                      });
                                    }
                                    e.target.value = '';
                                  }}
                                />
                              </div>
                              {/* motion — the SAME preset chips scenes use, expanded
                                  over the cue's window (word span + the hold) */}
                              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                <span className="text-[8px] font-bold uppercase tracking-wide text-violet-300/50">
                                  motion
                                </span>
                                <button
                                  onClick={() => void patchCue(cue.id, { motion: undefined })}
                                  className={clsx(
                                    'rounded px-1.5 py-0.5 text-[8px] font-semibold',
                                    !cue.motion
                                      ? 'bg-violet-500 text-white'
                                      : 'text-violet-200/60 hover:bg-violet-500/15',
                                  )}
                                  title="The default rise+scale entrance"
                                >
                                  default
                                </button>
                                {MOTION_PRESETS.map((p) => (
                                  <button
                                    key={p.id}
                                    onClick={() =>
                                      void patchCue(cue.id, { motion: presetKeys(p.id, windowSec) })
                                    }
                                    title={p.hint}
                                    className={clsx(
                                      'rounded px-1.5 py-0.5 text-[8px] font-semibold',
                                      detectPreset(cue.motion, windowSec) === p.id
                                        ? 'bg-violet-500 text-white'
                                        : 'text-violet-200/60 hover:bg-violet-500/15',
                                    )}
                                  >
                                    {p.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                  {/* WORD FX — per-word effects, the cue flow's sibling: toggle
                      fx mode, click words in the subtitle list, then an effect
                      chip applies to every picked word. Marks ride the words
                      array (the existing slot), so save/render/preview agree. */}
                  <div className="shrink-0 space-y-1.5 rounded-xl border border-amber-400/25 bg-amber-400/[0.05] p-2">
                    <div className="flex items-center gap-1.5">
                      <Zap className="h-3 w-3 text-amber-300/80" />
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-300/80">
                        Word FX
                      </span>
                      <button
                        onClick={() => {
                          setFxMode((v) => !v);
                          setFxWords(new Set());
                        }}
                        disabled={!currentClip || !(project.captions[currentClip.id]?.length ?? 0)}
                        className={clsx(
                          'ml-auto rounded px-2 py-0.5 text-[9px] font-semibold disabled:opacity-40',
                          fxMode ? 'bg-amber-400 text-ink' : 'text-amber-300/80 hover:bg-amber-400/15',
                        )}
                        title="FX mode: click words in the subtitle list to pick them, then apply an effect below"
                      >
                        {fxMode
                          ? `fx mode ON (${fxScope === 'individual' ? (fxTarget != null ? 1 : 0) : fxWords.size})`
                          : 'fx word'}
                      </button>
                      {fxMode && fxScope === 'global' && fxWords.size > 0 && (
                        <button
                          onClick={() => setFxWords(new Set())}
                          className="text-[8px] text-bone/35 hover:text-bone/70"
                          title="Unpick all words"
                        >
                          un-pick
                        </button>
                      )}
                    </div>
                    {/* block feel — the caption BLOCK's ambient motion (rides
                        captionOverrides.blockMotion → resolveCaptionStyle) */}
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[8px] font-bold uppercase tracking-wide text-amber-300/50">
                        block feel
                      </span>
                      {(['still', 'float', 'wiggle'] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => void setCaptionOverrides({ blockMotion: m })}
                          className={clsx(
                            'rounded px-1.5 py-0.5 text-[8px] font-semibold',
                            (project.captionOverrides?.blockMotion ?? 'still') === m
                              ? 'bg-amber-400 text-ink'
                              : 'text-amber-200/60 hover:bg-amber-400/15',
                          )}
                          title={
                            m === 'still'
                              ? 'No block motion'
                              : m === 'float'
                                ? 'The whole caption block bobs gently'
                                : 'The whole caption block sways softly'
                          }
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                    {/* the effects — global applies to every picked word;
                        individual applies to the ONE target word, seeded from
                        its current mark (hover a word to read its effects) */}
                    {fxMode &&
                      (fxScope === 'individual' ? fxTarget != null : fxWords.size > 0) &&
                      (() => {
                        const tm =
                          fxScope === 'individual' && fxTarget != null
                            ? ((project.captions[currentClip?.id ?? '']?.[fxTarget]?.mark ?? {}) as Record<
                                string,
                                unknown
                              >)
                            : {};
                        return (
                      <div
                        key={`${fxScope}-${fxScope === 'individual' ? fxTarget : 'all'}`}
                        className="space-y-1.5"
                      >
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-[8px] font-bold uppercase tracking-wide text-amber-300/50">
                            scope
                          </span>
                          {(['global', 'individual'] as const).map((s) => (
                            <button
                              key={s}
                              onClick={() => setFxScope(s)}
                              className={clsx(
                                'rounded px-1.5 py-0.5 text-[8px] font-semibold',
                                fxScope === s
                                  ? 'bg-amber-400 text-ink'
                                  : 'text-amber-200/60 hover:bg-amber-400/15',
                              )}
                              title={
                                s === 'global'
                                  ? 'Settings apply to every picked word (bulk)'
                                  : 'Settings apply to ONE word, loaded from its current effects'
                              }
                            >
                              {s === 'global' ? 'all picked' : 'one word'}
                            </button>
                          ))}
                          {fxScope === 'individual' && fxTarget != null && (
                            <span className="text-[8px] text-amber-200/60">
                              → "{project.captions[currentClip?.id ?? '']?.[fxTarget]?.word}"
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-[8px] font-bold uppercase tracking-wide text-amber-300/50">
                            word feel
                          </span>
                          {(['float', 'wiggle'] as const).map((a) => (
                            <button
                              key={a}
                              onClick={() => void applyWordMarks({ ambient: a })}
                              className="rounded px-1.5 py-0.5 text-[8px] font-semibold text-amber-200/70 hover:bg-amber-400/15"
                              title={`${a} the picked words while they're on screen`}
                            >
                              {a}
                            </button>
                          ))}
                          <button
                            onClick={() => void clearWordFx()}
                            className="rounded px-1.5 py-0.5 text-[8px] font-semibold text-red-300/70 hover:bg-red-500/10"
                            title="Strip effect + feel + sfx off the picked words"
                          >
                            clear
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-[8px] font-bold uppercase tracking-wide text-amber-300/50">
                            effect
                          </span>
                          {(
                            [
                              ['glow', 'a pulsing neon halo'],
                              ['gradient', 'a color gradient through the glyphs'],
                              ['shine', 'a light band sweeping the word'],
                              ['pulse', 'a scale breathing beat'],
                              ['underline', 'a rule that draws itself under the word'],
                              ['marker', 'a highlighter swipe behind the word'],
                            ] as const
                          ).map(([fx, hint]) => (
                            <button
                              key={fx}
                              onClick={() => void applyWordMarks({ fx })}
                              className="rounded px-1.5 py-0.5 text-[8px] font-semibold text-amber-200/70 hover:bg-amber-400/15"
                              title={hint}
                            >
                              {fx}
                            </button>
                          ))}
                          <input
                            type="color"
                            defaultValue={(tm.fxColor as string) ?? '#ffd400'}
                            onChange={(e) => void applyWordMarks({ fxColor: e.target.value })}
                            className="h-4 w-5 cursor-pointer rounded border border-amber-400/25 bg-transparent"
                            title="The fx color (glow halo / underline / marker / gradient anchor) — click to apply"
                          />
                          <input
                            type="color"
                            defaultValue={(tm.fxColor2 as string) ?? '#ffffff'}
                            onChange={(e) => void applyWordMarks({ fxColor2: e.target.value })}
                            className="h-4 w-5 cursor-pointer rounded border border-amber-400/25 bg-transparent"
                            title="The SECOND color — the gradient's end and the shine band's light — click to apply"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          {(
                            [
                              ['tilt', 'a static lean'],
                              ['outline', 'a colored stroke around the glyphs'],
                              ['strike', 'a line that wipes through the word'],
                              ['blink', 'a steady flashing beat'],
                              ['jelly', 'a continuous squash-and-stretch'],
                            ] as const
                          ).map(([fx, hint]) => (
                            <button
                              key={fx}
                              onClick={() => void applyWordMarks({ fx })}
                              className="rounded px-1.5 py-0.5 text-[8px] font-semibold text-amber-200/70 hover:bg-amber-400/15"
                              title={hint}
                            >
                              {fx}
                            </button>
                          ))}
                        </div>
                        {/* the settings — one intensity dial + the per-word font,
                            applied to every picked word */}
                        <div className="flex items-center gap-1.5">
                          <span className="w-10 shrink-0 text-[8px] font-bold uppercase tracking-wide text-amber-300/50">
                            amount
                          </span>
                          <input
                            type="range"
                            min={0.2}
                            max={3}
                            step={0.1}
                            defaultValue={1}
                            onChange={(e) => void applyWordMarks({ fxAmount: Number(e.target.value) })}
                            className="min-w-0 flex-1 accent-amber-400"
                            title="Effect intensity (0.2–3×): glow radius, pulse amplitude, marker opacity, underline thickness, shine band, jelly squash"
                          />
                          <span className="w-6 shrink-0 text-right text-[8px] text-amber-200/60">×</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-10 shrink-0 text-[8px] font-bold uppercase tracking-wide text-amber-300/50">
                            font
                          </span>
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              const f = e.target.value;
                              void applyWordMarks(f ? { font: f } : { font: undefined as never });
                            }}
                            className="min-w-0 flex-1 rounded border border-amber-400/25 bg-ink px-1 py-0.5 text-[8px] text-bone/80"
                            title="A different font for the picked words (loaded in preview AND the MP4)"
                          >
                            <option value="">— preset font —</option>
                            {WORD_FONTS.map((f) => (
                              <option key={f} value={f} style={{ fontFamily: f }}>
                                {f}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="w-10 shrink-0 text-[8px] font-bold uppercase tracking-wide text-amber-300/50">
                            sfx
                          </span>
                          <select
                            value=""
                            onFocus={() => void loadSfxAssets()}
                            onChange={(e) => {
                              const url = e.target.value;
                              if (url) void applyWordMarks({ sfx: { url, volume: 0.9 } });
                            }}
                            className="min-w-0 flex-1 rounded border border-amber-400/25 bg-ink px-1 py-0.5 text-[8px] text-bone/80"
                            title="A one-shot sound when the picked words start (library audio)"
                          >
                            <option value="">— pick a sound —</option>
                            {(sfxAssets ?? []).map((a) => (
                              <option key={a.url} value={a.url}>
                                {a.name || a.url.split('/').pop()}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => wordSfxInput.current?.click()}
                            className="shrink-0 rounded border border-amber-400/40 px-1.5 py-0.5 text-[8px] font-semibold text-amber-200/80 hover:bg-amber-400/15"
                            title="Upload a sound — saves to the library and applies to the picked words"
                          >
                            <Upload className="h-2.5 w-2.5" />
                          </button>
                          <input
                            ref={wordSfxInput}
                            type="file"
                            accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/m4a"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) {
                                void uploadSfx(f).then((entry) => {
                                  if (entry) void applyWordMarks({ sfx: { url: entry.url, volume: 0.9 } });
                                });
                              }
                              e.target.value = '';
                            }}
                          />
                        </div>
                      </div>
                        );
                      })()}
                    <p className="text-[7px] leading-3 text-amber-200/35">
                      {fxMode
                        ? 'click words in the subtitle list — amber-underlined ones are picked'
                        : 'fx word = pick words, then apply glow / gradient / shine / pulse / underline / marker, a bob or sway, and a sound'}
                    </p>
                  </div>
                  {/* the preset gallery + customizer */}
                  <div className="max-h-[32%] shrink-0 overflow-y-auto rounded-xl border border-bone/10 bg-bone/[0.02] p-2">
                    <CaptionGallery
                      currentPreset={project.captionStyle}
                      overrides={project.captionOverrides}
                      onPick={(def) => void setCaptionStyle(def.id as CaptionPreset)}
                      onCustomize={(patchOv) => void setCaptionOverrides(patchOv)}
                      onApplyTransition={(type) => {
                        // A creator pack's seam transition: set it on EVERY
                        // boundary (null = hard cuts). The first scene has no
                        // seam before it, so it never carries one.
                        patch({
                          clips: project.clips.map((c, i) => {
                            if (i === 0) return c;
                            if (!type) {
                              const next = { ...c };
                              delete next.transitionIn;
                              return next;
                            }
                            return { ...c, transitionIn: { type, durationSec: 0.4 } };
                          }),
                        });
                        setNote(
                          type
                            ? `${type} on every seam — adjust any boundary on the timeline.`
                            : 'Hard cuts on every seam.',
                        );
                      }}
                    onResetOverrides={() => {
                      void (async () => {
                        if (!project) return;
                        const updated = { ...project, captionOverrides: {} };
                        setProject(updated);
                        await post({ action: 'save', project: updated });
                      })();
                    }}
                    />
                  </div>
                  {/* R27 FANCY SUBTITLES (veed) — word-timed burn-in via fal */}
                  <div className="shrink-0 space-y-2 rounded-xl border border-brass/25 bg-brass/[0.04] p-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-brass/80">
                      <Sparkles className="h-3 w-3" /> Fancy subtitles
                      <span className="ml-auto text-[8px] font-normal normal-case text-bone/30">
                        veed burn-in
                      </span>
                    </div>
                    {/* the VEED preset catalog — Basic (1×) and Dynamic (2×) tiers */}
                    <div>
                      <div className="mb-1 flex items-center gap-1">
                        {(['basic', 'dynamic'] as const).map((t) => (
                          <button
                            key={t}
                            onClick={() => setPresetTier(t)}
                            className={clsx(
                              'rounded px-2 py-0.5 text-[9px] font-semibold',
                              presetTier === t ? 'bg-brass text-ink' : 'text-bone/45 hover:bg-bone/10',
                            )}
                          >
                            {t === 'basic' ? 'Basic · 1×' : 'Dynamic · 2×'}
                          </button>
                        ))}
                        <button
                          onClick={() => setExampleOpen((v) => !v)}
                          className="ml-auto text-[8px] font-semibold text-brass/70 hover:underline"
                          title="Watch the official VEED preset compilation — what each style looks like"
                        >
                          {exampleOpen ? 'hide example ↑' : 'see styles ↓'}
                        </button>
                      </div>
                      {exampleOpen && (
                        <video
                          src={VEED_EXAMPLE_VIDEO_URL}
                          controls
                          playsInline
                          className="mb-1.5 w-full rounded-lg border border-bone/15"
                        />
                      )}
                      <div className="grid max-h-28 grid-cols-4 gap-1 overflow-y-auto pr-0.5">
                        {(presetTier === 'basic' ? VEED_BASIC_PRESETS : VEED_DYNAMIC_PRESETS).map((p) => (
                          <button
                            key={p.id}
                            onClick={() => setFancy((f) => ({ ...f, preset: p.id }))}
                            title={p.hint}
                            className={clsx(
                              'rounded border px-1 py-1 text-[8px] font-semibold leading-3',
                              fancy.preset === p.id
                                ? 'border-brass bg-brass/15 text-brass'
                                : 'border-bone/15 text-bone/55 hover:border-bone/40 hover:bg-bone/10',
                            )}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                      {/* the cost readout — multiplier × base rate, never a surprise bill */}
                      <p className="mt-1 flex items-center justify-between text-[8px] text-bone/35">
                        <span>
                          {veedCostMultiplier(fancy.preset, fancy.resolution)}× base rate
                        </span>
                        <span>
                          → ${veedCostEstimate({ presetId: fancy.preset, resolution: fancy.resolution, durationSec: total }).toFixed(2)} for this reel
                        </span>
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <select
                        value={fancy.resolution}
                        onChange={(e) => setFancy((f) => ({ ...f, resolution: e.target.value as '1080p' | '4k' }))}
                        className="rounded-lg border border-bone/15 bg-ink px-1.5 py-1 text-[9px] text-bone/80"
                        title="Output resolution — 4K is 2× the base rate"
                      >
                        <option value="1080p">1080p · 1×</option>
                        <option value="4k">4K · 2×</option>
                      </select>
                      <input
                        value={fancy.translationLanguage}
                        onChange={(e) => setFancy((f) => ({ ...f, translationLanguage: e.target.value }))}
                        placeholder="translate to (e.g. es)"
                        className="rounded-lg border border-bone/15 bg-ink px-1.5 py-1 text-[9px] text-bone/80 outline-none placeholder:text-bone/25"
                        title="Translate the subtitles into a BCP-47 language (es, fr, pt, de…) — leave empty for the source language"
                      />
                    </div>
                    <input
                      value={fancy.customVocabulary}
                      onChange={(e) => setFancy((f) => ({ ...f, customVocabulary: e.target.value }))}
                      placeholder="custom vocabulary (brand names, jargon — comma separated)"
                      className="w-full rounded-lg border border-bone/15 bg-ink px-1.5 py-1 text-[9px] text-bone/80 outline-none placeholder:text-bone/25"
                      title="Words ASR should never mishear — your brand name, product names, jargon. Up to 100, whole-word case-insensitive."
                    />
                    <div className="grid grid-cols-2 gap-1.5">
                      <select
                        value={fancy.subtitleType}
                        onChange={(e) =>
                          setFancy((f) => ({ ...f, subtitleType: e.target.value as 'word' | 'line' }))
                        }
                        className="rounded-lg border border-bone/15 bg-ink px-1.5 py-1 text-[9px] text-bone/80"
                        title="Karaoke word-by-word vs full caption lines"
                      >
                        <option value="word">karaoke (word-by-word)</option>
                        <option value="line">full lines</option>
                      </select>
                      <select
                        value={fancy.position}
                        onChange={(e) =>
                          setFancy((f) => ({ ...f, position: e.target.value as 'top' | 'center' | 'bottom' }))
                        }
                        className="rounded-lg border border-bone/15 bg-ink px-1.5 py-1 text-[9px] text-bone/80"
                        title="Where the captions sit"
                      >
                        <option value="bottom">bottom</option>
                        <option value="center">center</option>
                        <option value="top">top</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[8px] text-bone/35">size</span>
                      <input
                        type="range"
                        min={16}
                        max={56}
                        value={fancy.fontSize}
                        onChange={(e) => setFancy((f) => ({ ...f, fontSize: Number(e.target.value) }))}
                        className="min-w-0 flex-1 accent-brass"
                      />
                      <span className="w-6 text-right text-[9px] text-bone/50">{fancy.fontSize}</span>
                      <span className="text-[8px] text-bone/35">bg</span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={fancy.backgroundOpacity}
                        onChange={(e) =>
                          setFancy((f) => ({ ...f, backgroundOpacity: Number(e.target.value) }))
                        }
                        className="w-10 accent-brass"
                        title="Caption block opacity"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-[8px] text-bone/40">
                      <label className="flex items-center gap-1">
                        text
                        <input
                          type="color"
                          value={fancy.fontColor}
                          onChange={(e) => setFancy((f) => ({ ...f, fontColor: e.target.value }))}
                          className="h-5 w-6 cursor-pointer rounded border border-bone/20 bg-transparent"
                        />
                      </label>
                      <label className="flex items-center gap-1">
                        block
                        <input
                          type="color"
                          value={fancy.backgroundColor}
                          onChange={(e) => setFancy((f) => ({ ...f, backgroundColor: e.target.value }))}
                          className="h-5 w-6 cursor-pointer rounded border border-bone/20 bg-transparent"
                        />
                      </label>
                      <label className="flex items-center gap-1">
                        outline
                        <input
                          type="color"
                          value={fancy.outlineColor}
                          onChange={(e) => setFancy((f) => ({ ...f, outlineColor: e.target.value }))}
                          className="h-5 w-6 cursor-pointer rounded border border-bone/20 bg-transparent"
                        />
                      </label>
                    </div>
                    <button
                      onClick={() => void renderFancyCaptions()}
                      disabled={fancyBusy || !project.composedUrl}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brass px-2.5 py-2 text-[10px] font-bold text-ink hover:bg-brass/90 disabled:opacity-40"
                      title={project.composedUrl ? 'Burn fancy subtitles into the composed MP4' : 'Compose the reel first'}
                    >
                      {fancyBusy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      {fancyBusy
                        ? 'Rendering…'
                        : project.composedUrl
                          ? 'Burn fancy subtitles'
                          : 'Compose first to burn'}
                    </button>
                  </div>
                </div>
              )}

              {tab === 'director' && (
                <div className="flex h-full flex-col gap-2">
                  <div className="rounded-xl border border-brass/25 bg-brass/[0.06] px-2.5 py-2">
                    <p className="text-[10px] font-semibold text-brass/90">
                      The Director sees your timeline — and its cuts EXECUTE on it.
                    </p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-bone/45">
                      {project.clips.length} scenes · {fmtSec(total)} loaded. Ask it to tighten,
                      reorder, or cut scenes — Ctrl+Z undoes anything it does.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {['Tighten the middle scenes', 'Give me 3 punchier hooks', 'What should I cut?'].map(
                      (chip) => (
                        <button
                          key={chip}
                          onClick={() => void sendDirector(chip)}
                          disabled={busy || project.clips.length === 0}
                          className="rounded-full border border-bone/15 px-2.5 py-1 text-[10px] text-bone/55 hover:bg-bone/10 disabled:opacity-40"
                        >
                          {chip}
                        </button>
                      ),
                    )}
                  </div>
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-xl border border-bone/10 bg-ink/60 p-2.5">
                    {directorMessages.length === 0 && (
                      <p className="text-[11px] text-bone/30">
                        The booth is quiet. Ask it to tighten something.
                      </p>
                    )}
                    {directorMessages.map((m, i) => (
                      <div
                        key={i}
                        className={clsx(
                          'rounded-lg px-2.5 py-2 text-[11px] leading-relaxed whitespace-pre-wrap',
                          m.role === 'user'
                            ? 'ml-6 bg-brass/15 text-bone/90'
                            : 'mr-6 bg-bone/[0.06] text-bone/75',
                        )}
                      >
                        {m.role === 'director' && (
                          <span className="mb-0.5 block text-[9px] font-semibold uppercase tracking-wide text-brass/70">
                            Director
                          </span>
                        )}
                        {m.text}
                        {m.applied && m.applied.length > 0 && (
                          <ul className="mt-1.5 space-y-0.5 border-t border-bone/10 pt-1.5">
                            {m.applied.map((a, k) => (
                              <li key={k} className="flex items-center gap-1.5 text-[10px] text-brass/90">
                                <Check className="h-3 w-3 shrink-0" /> {a}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                    {busy && <Loader2 className="h-4 w-4 animate-spin text-bone/40" />}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <input
                      value={directorInput}
                      onChange={(e) => setDirectorInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void sendDirector();
                      }}
                      placeholder="Cut the slow parts…"
                      className="min-w-0 flex-1 rounded-lg border border-bone/15 bg-ink px-2.5 py-2 text-[11px] text-bone/80 outline-none placeholder:text-bone/25"
                    />
                    <button
                      onClick={() => void sendDirector()}
                      disabled={busy || !directorInput.trim()}
                      className="rounded-lg bg-brass px-3 py-2 text-[10px] font-semibold text-ink disabled:opacity-40"
                    >
                      send
                    </button>
                  </div>
                </div>
              )}

              {tab === 'scoreboard' && (
                <div className="flex h-full flex-col gap-2">
                  <p className="rounded-xl border border-bone/10 bg-bone/[0.03] px-2.5 py-2 text-[10px] leading-relaxed text-bone/45">
                    Post your composed MP4s anywhere, then record impressions + clicks here. The
                    board ranks variants by CTR, crowns the winner, and spins descendant drafts
                    from it.
                    <span className="mt-1 block text-bone/35">
                      spin = swap hook/body/outro genes from the Vault into new variants · queue =
                      compose in the background · rollup = pull clicks from your tracked links ·
                      run the loop = crown a winner and spin descendants from it
                    </span>
                  </p>
                  {/* action rows — row 1: the three mains; row 2: utilities */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => void composeBatch()}
                      disabled={busy}
                      className="inline-flex items-center gap-1 rounded-lg bg-brass px-2.5 py-1.5 text-[10px] font-semibold text-ink disabled:opacity-40"
                    >
                      <Film className="h-3 w-3" /> Compose batch
                    </button>
                    <button
                      onClick={() => void runWeeklyLoop()}
                      disabled={busy}
                      title="Winner — three descendant drafts"
                      className="inline-flex items-center gap-1 rounded-lg border border-brass/40 px-2.5 py-1.5 text-[10px] font-semibold text-brass hover:bg-brass/10 disabled:opacity-40"
                    >
                      <Sparkles className="h-3 w-3" /> Run the loop
                    </button>
                    <button
                      onClick={() => void spinVariantsLab()}
                      disabled={project.clips.length === 0}
                      title="Spin: swap hook/body/outro genes from the Vault into descendant variants of THIS reel"
                      className="inline-flex items-center gap-1 rounded-lg border border-brass/40 px-2.5 py-1.5 text-[10px] font-semibold text-brass/90 hover:bg-brass/10 disabled:opacity-40"
                    >
                      spin
                    </button>
                    <button
                      onClick={() => {
                        setTab('genes');
                        if (loopRows === null) void loadLoop();
                      }}
                      title="Gene view: see how this reel's variants recombine hook/body/outro genes"
                      className="inline-flex items-center gap-1 rounded-lg border border-bone/15 px-2.5 py-1.5 text-[10px] font-semibold text-bone/60 hover:bg-bone/10"
                    >
                      genes
                    </button>
                    <button
                      onClick={() => void loadLoop()}
                      className="ml-auto text-[10px] text-bone/40 hover:underline"
                    >
                      refresh
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => void queueBatch()}
                      title="Compose in the background (agent_jobs) — the page stays editable"
                      className="inline-flex items-center gap-1 rounded-lg border border-bone/15 px-2.5 py-1.5 text-[10px] font-semibold text-bone/60 hover:bg-bone/10"
                    >
                      queue batch
                    </button>
                    <button
                      onClick={() => void rollupMetrics()}
                      title="Roll tracked-link clicks onto variants now (the nightly cron also does this)"
                      className="inline-flex items-center gap-1 rounded-lg border border-bone/15 px-2.5 py-1.5 text-[10px] font-semibold text-bone/60 hover:bg-bone/10"
                    >
                      rollup clicks
                    </button>
                    {/* R14 bulk mode: pick variants, batch-schedule with settings check */}
                    <button
                      onClick={() => {
                        setBulkMode((v) => !v);
                        setBulkSelected(new Set());
                      }}
                      className={clsx(
                        'ml-auto inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold',
                        bulkMode
                          ? 'border-brass/40 text-brass'
                          : 'border-bone/15 text-bone/60 hover:bg-bone/10',
                      )}
                      title={bulkMode ? 'Exit bulk mode' : 'Bulk schedule: pick variants and schedule them together'}
                    >
                      {bulkMode ? `bulk (${bulkSelected.size})` : 'bulk'}
                    </button>
                    {/* Bulk schedule button — only when variants are picked in bulk mode */}
                    {bulkMode && bulkSelected.size > 0 && (
                      <button
                        onClick={() => setBulkOpen(true)}
                        className="inline-flex items-center gap-1 rounded-lg bg-brass px-2.5 py-1.5 text-[10px] font-bold text-ink hover:bg-brass/90"
                        title={`Bulk schedule ${bulkSelected.size} variant(s) with settings check`}
                      >
                        <Film className="h-3 w-3" /> Bulk schedule {bulkSelected.size}
                      </button>
                    )}
                  </div>
                  {batchResults && (
                    <div className="space-y-0.5 rounded-lg border border-bone/10 bg-bone/[0.03] p-2">
                      {batchResults.map((r, i) => (
                        <p key={i} className="text-[10px] text-bone/55">
                          <span
                            className={clsx(
                              'font-semibold',
                              r.status === 'composed'
                                ? 'text-brass'
                                : r.status === 'cached'
                                  ? 'text-bone/70'
                                  : 'text-red-300/80',
                            )}
                          >
                            {r.status}
                          </span>{' '}
                          {r.name}
                        </p>
                      ))}
                    </div>
                  )}
                  {loopWinner && (
                    <p className="rounded-lg border border-brass/30 bg-brass/10 px-2.5 py-1.5 text-[10px] text-brass/90">
                      Winner: <strong>{loopWinner.projectName}</strong> —{' '}
                      {(loopWinner.ctr * 100).toFixed(1)}% CTR
                    </p>
                  )}
                  {geneLeaderLine && (
                    <p className="rounded-lg border border-bone/15 bg-bone/[0.04] px-2.5 py-1.5 text-[10px] text-bone/60">
                      {geneLeaderLine}
                    </p>
                  )}
                  <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
                    {loopRows === null ? (
                      <button
                        onClick={() => void loadLoop()}
                        className="text-[11px] text-bone/40 hover:underline"
                      >
                        Load variants…
                      </button>
                    ) : loopRows.length === 0 ? (
                      <p className="text-[11px] text-bone/30">
                        No variants yet — compose a batch, post the MP4s, record the results here.
                      </p>
                    ) : (
                      loopRows.map((r) => {
                        const isWinner = loopWinner?.variant.id === r.variant.id;
                        const ctr = r.impressions > 0 ? r.clicks / r.impressions : 0;
                        return (
                          <div
                            key={r.variant.id}
                            className={clsx(
                              'flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xl border p-2',
                              isWinner ? 'border-brass/50 bg-brass/[0.07]' : 'border-bone/10 bg-bone/[0.03]',
                            )}
                          >
                            <Thumb
                              url={r.variant.composedUrl}
                              t={0.5}
                              className="h-10 w-14 shrink-0 rounded bg-black object-cover"
                            />

                            {/* R14 bulk checkbox (bulk mode only) */}
                            {bulkMode && (
                              <input
                                type="checkbox"
                                checked={bulkSelected.has(r.variant.id)}
                                onChange={(e) => {
                                  const next = new Set(bulkSelected);
                                  if (e.target.checked) next.add(r.variant.id);
                                  else next.delete(r.variant.id);
                                  setBulkSelected(next);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="h-3.5 w-3.5 shrink-0 accent-brass"
                                title={`Select ${r.projectName} for bulk scheduling`}
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[11px] font-medium text-bone/85">
                                {isWinner && <span className="mr-1 text-brass">★</span>}
                                {r.projectName}
                              </div>
                              <div className="text-[10px] text-bone/40">
                                {r.impressions.toLocaleString()} imp · {r.clicks.toLocaleString()} clicks
                                {r.impressions > 0 && ` · ${(ctr * 100).toFixed(1)}%`}
                              </div>
                              {/* R14 schedule chip: "Scheduled · YouTube Shorts" when the variant is on the planner */}
                              {loopStatuses[r.variant.id]?.scheduled && (
                                <p className="mt-0.5 flex items-center gap-1 text-[9px] font-semibold text-emerald-300/80">
                                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                  {loopStatuses[r.variant.id]?.publishState === 'published' ? 'Published' : 'Scheduled'}
                                  {loopStatuses[r.variant.id]?.platform
                                    ? ` · ${platformFor(loopStatuses[r.variant.id]!.platform!)?.label ?? loopStatuses[r.variant.id]!.platform}`
                                    : ''}
                                  {loopStatuses[r.variant.id]?.format
                                    ? ` ${postTypeLabel(loopStatuses[r.variant.id]!.format!)}`
                                    : ''}
                                </p>
                              )}
                              {/* R14 link chip: "linked · /go/abc · 42 clicks" when a tracked link is attached */}
                              {loopStatuses[r.variant.id]?.linkCode && (
                                <p className="mt-0.5 flex items-center gap-1 text-[9px] font-semibold text-sky-300/80">
                                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-400" />
                                  linked · /go/{loopStatuses[r.variant.id]!.linkCode}
                                  {(loopStatuses[r.variant.id]!.linkClicks ?? 0) > 0 &&
                                    ` · ${loopStatuses[r.variant.id]!.linkClicks!.toLocaleString()} clicks`}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() =>
                                setSchedRow(schedRow?.variant.id === r.variant.id ? null : r)
                              }
                              className="shrink-0 rounded border border-brass/40 px-1.5 py-1 text-[9px] font-semibold text-brass hover:bg-brass/10"
                              title="Schedule this variant to the planner board (optional tracked link)"
                            >
                              schedule
                            </button>
                            <button
                              onClick={() => setThumbLabRow(r)}
                              className="shrink-0 rounded border border-violet-400/40 px-1.5 py-1 text-[9px] font-semibold text-violet-300/90 hover:bg-violet-400/10"
                              title="Open the Thumbnail Lab for this variant"
                            >
                              thumb
                            </button>
                            <button
                              onClick={() => void linkVariant(r.variant.id)}
                              className={clsx(
                                'shrink-0 rounded border px-1.5 py-1 text-[9px]',
                                loopStatuses[r.variant.id]?.linkCode
                                  ? 'border-sky-400/40 text-sky-300/80 hover:bg-sky-400/10'
                                  : 'border-brass/30 text-brass/80 hover:bg-brass/10',
                              )}
                              title={
                                loopStatuses[r.variant.id]?.linkCode
                                  ? `Linked to /go/${loopStatuses[r.variant.id]!.linkCode} — click to update`
                                  : 'Attach a tracked link — clicks roll up automatically'
                              }
                            >
                              {loopStatuses[r.variant.id]?.linkCode ? 'update link' : '+ link'}
                            </button>
                            <button
                              onClick={() => void recordMetric(r.variant.id)}
                              className="shrink-0 rounded border border-bone/15 px-1.5 py-1 text-[9px] text-bone/50 hover:bg-bone/10"
                              title={`Record impressions/clicks — current: ${r.impressions.toLocaleString()} imp, ${r.clicks.toLocaleString()} clicks`}
                            >
                              + result
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {tab === 'vault' && (
                <div className="flex h-full flex-col gap-2">
                  {/* bookend pickers */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <select
                      value={vaultIntroId ?? ''}
                      onChange={(e) => setBookend('intro', e.target.value || null)}
                      className="rounded-lg border border-bone/15 bg-ink px-2 py-1.5 text-[10px] text-bone/80"
                      title="Pinned intro (scene 0)"
                    >
                      <option value="">Intro: none</option>
                      {(vaultAssets ?? [])
                        .filter((a) => a.kind === 'intro' || a.kind === 'reaction')
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            → {a.name}
                          </option>
                        ))}
                    </select>
                    <select
                      value={vaultOutroId ?? ''}
                      onChange={(e) => setBookend('outro', e.target.value || null)}
                      className="rounded-lg border border-bone/15 bg-ink px-2 py-1.5 text-[10px] text-bone/80"
                      title="Pinned outro (last scene)"
                    >
                      <option value="">Outro: none</option>
                      {(vaultAssets ?? [])
                        .filter((a) => a.kind === 'outro' || a.kind === 'reaction')
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            → {a.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* kind filter + upload */}
                  <div className="flex items-center gap-1">
                    {(['all', 'intro', 'outro', 'reaction'] as const).map((k) => (
                      <button
                        key={k}
                        onClick={() => setVaultKindFilter(k)}
                        className={clsx(
                          'rounded-full px-2 py-1 text-[9px] font-semibold',
                          vaultKindFilter === k ? 'bg-brass text-ink' : 'text-bone/45 hover:bg-bone/10',
                        )}
                      >
                        {k}
                      </button>
                    ))}
                    <button
                      onClick={async () => {
                        const res = await fetch('/api/admin/clipping-vault', {
                          method: 'POST',
                          headers: { 'content-type': 'application/json' },
                          body: JSON.stringify({ action: 'sync-win-rates' }),
                        });
                        const json = await res.json();
                        if (json.success)
                          setNote(`Win rates synced across ${json.updated} asset(s).`);
                        void loadVault();
                      }}
                      className="ml-auto text-[9px] font-semibold text-brass/70 hover:underline"
                      title="Recompute — win rates from the loop's recorded metrics"
                    >
                      sync …
                    </button>
                    <button
                      onClick={() => void loadVault()}
                      className="text-[9px] text-bone/40 hover:underline"
                    >
                      refresh
                    </button>

                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg border border-dashed border-brass/30 bg-brass/[0.05] p-2">
                    <select
                      value={vaultUploadKind}
                      onChange={(e) => setVaultUploadKind(e.target.value as VaultKind)}
                      className="rounded border border-bone/15 bg-ink px-1.5 py-1 text-[9px] text-bone/80"
                    >
                      <option value="reaction">reaction</option>
                      <option value="intro">intro</option>
                      <option value="outro">outro</option>
                    </select>
                    <input
                      value={vaultTags}
                      onChange={(e) => setVaultTags(e.target.value)}
                      placeholder="tags: shock, money"
                      className="min-w-0 flex-1 rounded border border-bone/15 bg-ink px-1.5 py-1 text-[9px] text-bone/80 outline-none placeholder:text-bone/25"
                    />
                    <button
                      onClick={() => vaultFileInput.current?.click()}
                      disabled={busy}
                      className="inline-flex items-center gap-1 rounded bg-brass px-2 py-1 text-[9px] font-semibold text-ink disabled:opacity-40"
                    >
                      <Upload className="h-3 w-3" /> clip
                    </button>
                    <input
                      ref={vaultFileInput}
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void uploadToVault(f);
                        e.target.value = '';
                      }}
                    />
                  </div>

                  {/* the grid */}
                  <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
                    {vaultAssets === null ? (
                      <p className="flex items-center gap-1.5 px-1 py-2 text-[10px] text-bone/40">
                        <Loader2 className="h-3 w-3 animate-spin" /> Opening the Vault…
                      </p>
                    ) : vaultAssets.filter((a) => vaultKindFilter === 'all' || a.kind === vaultKindFilter)
                        .length === 0 ? (
                      <p className="rounded-lg border border-dashed border-bone/10 px-3 py-4 text-[10px] leading-relaxed text-bone/35">
                        The Vault is empty — upload your first reaction clip above. Intros pin to
                        scene 0, outros pin to the end, reactions drop in anywhere as pattern
                        interrupts. Every clip earns a — win rate as the loop records results.
                      </p>
                    ) : (
                      vaultAssets
                        .filter((a) => vaultKindFilter === 'all' || a.kind === vaultKindFilter)
                        .map((a) => {
                          const stars = winStars(a.winRate);
                          return (
                            <div
                              key={a.id}
                              className="flex items-center gap-2 rounded-xl border border-bone/10 bg-bone/[0.03] p-2"
                            >
                              <Thumb
                                url={a.url}
                                t={0.5}
                                className="h-10 w-14 shrink-0 rounded bg-black object-cover"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[11px] font-medium text-bone/85">
                                  {stars > 0 && (
                                    <span className="mr-1 text-brass">{'★'.repeat(stars)}</span>
                                  )}
                                  {a.name}
                                </div>
                                <div className="text-[9px] text-bone/40">
                                  {a.kind} · {fmtSec(a.durationSec)}
                                  {a.tags.length > 0 && ` · ${a.tags.slice(0, 3).join(', ')}`}
                                  {a.winRate != null && ` · ${(a.winRate * 100).toFixed(1)}%`}
                                </div>
                              </div>
                              {a.kind === 'reaction' && (
                                <button
                                  onClick={() => void reactSplitScreen(a)}
                                  disabled={busy || !currentClip}
                                  className="shrink-0 rounded border border-bone/20 px-1.5 py-1 text-[9px] font-semibold text-bone/60 hover:bg-bone/10 disabled:opacity-40"
                                  title="Split-screen: current scene on top, this reaction on the bottom third"
                                >
                                  → react
                                </button>
                              )}
                              <button
                                onClick={() => insertVaultHook(a)}
                                className="shrink-0 rounded border border-brass/40 px-1.5 py-1 text-[9px] font-semibold text-brass hover:bg-brass/10"
                                title="Insert after the current scene"
                              >
                                + hook
                              </button>
                              <button
                                onClick={async () => {
                                  await fetch('/api/admin/clipping-vault', {
                                    method: 'POST',
                                    headers: { 'content-type': 'application/json' },
                                    body: JSON.stringify({ action: 'delete', id: a.id }),
                                  });
                                  void loadVault();
                                }}
                                className="shrink-0 text-bone/30 hover:text-red-300"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              )}

              {tab === 'post' && (
                <div className="space-y-2">
                  <p className="rounded-xl border border-bone/10 bg-bone/[0.03] px-2.5 py-2 text-[10px] leading-relaxed text-bone/45">
                    The post's assets for the current target — thumbnail, title, caption. These
                    feed the canvas lens and Publish view (one shared copy pool).
                  </p>
                  {currentClip && (
                    <div>
                      <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-bone/35">
                        cover frame
                      </p>
                      <div className="grid grid-cols-4 gap-1">
                        {[0.5, currentClip.durationSec / 3, (2 * currentClip.durationSec) / 3, Math.max(0.5, currentClip.durationSec - 0.5)].map(
                          (raw, k) => {
                            const t = Math.max(0.1, Math.round(raw * 10) / 10);
                            const active =
                              copyPool?.thumbT != null && Math.abs(copyPool.thumbT - t) < 0.05;
                            return (
                              <button
                                key={k}
                                onClick={() =>
                                  setCopyPool((p) => ({
                                    title: p?.title ?? project.name,
                                    caption: p?.caption ?? '',
                                    desc: p?.desc ?? '',
                                    tags: p?.tags ?? '',
                                    thumbT: t,
                                  }))
                                }
                                className={clsx(
                                  'overflow-hidden rounded border',
                                  active ? 'border-brass' : 'border-bone/15 hover:border-bone/35',
                                )}
                                title={`Use frame at ${fmtSec(t)} as the thumbnail`}
                              >
                                <Thumb url={currentClip.url} t={t} className="h-10 w-full object-cover" />
                              </button>
                            );
                          },
                        )}
                      </div>
                      {copyPool?.thumbT != null && (
                        <p className="mt-1 text-[9px] text-bone/35">
                          cover: frame at {fmtSec(copyPool.thumbT)} (feed surfaces use it)
                        </p>
                      )}
                    </div>
                  )}
                  <div>
                    <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-bone/35">
                      title
                    </p>
                    <input
                      value={copyPool?.title ?? project.name}
                      onChange={(e) =>
                        setCopyPool((p) => ({
                          title: e.target.value,
                          caption: p?.caption ?? '',
                          desc: p?.desc ?? '',
                          tags: p?.tags ?? '',
                          thumbT: p?.thumbT,
                        }))
                      }
                      className="w-full max-w-[240px] rounded-lg border border-bone/15 bg-ink px-2.5 py-2 text-[11px] font-semibold text-bone/90 outline-none"
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-bone/35">
                      caption
                    </p>
                    <textarea
                      value={copyPool?.caption ?? ''}
                      onChange={(e) =>
                        setCopyPool((p) => ({
                          title: p?.title ?? project.name,
                          caption: e.target.value,
                          desc: p?.desc ?? '',
                          tags: p?.tags ?? '',
                          thumbT: p?.thumbT,
                        }))
                      }
                      rows={3}
                      placeholder="The caption — hook lives on line one"
                      className="w-full rounded-lg border border-bone/15 bg-ink px-2.5 py-2 text-[11px] text-bone/80 outline-none placeholder:text-bone/25"
                    />
                  </div>
                  {/* THE render: Remotion renders the real React/CSS caption
                      components frame by frame, so the MP4 matches the stage.
                      It starts a Lambda render and polls — never blocks. */}
                  <RenderPanel job={renderJob} />
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setPublishOpen(true)}
                      className="flex-1 rounded-lg border border-brass/30 px-2.5 py-2 text-[10px] font-semibold text-brass/90 hover:bg-brass/10"
                    >
                      Publish view
                    </button>

                    <button
                      onClick={() => setSchedOpen(true)}
                      disabled={project.clips.length === 0}
                      className="flex-1 rounded-lg bg-brass px-2.5 py-2 text-[10px] font-bold text-ink hover:bg-brass/90 disabled:opacity-40"
                      title="Render the final MP4 and schedule it to the planner"
                    >
                      Schedule…
                    </button>
                  </div>
                </div>
              )}

              {tab === 'genes' && (
                <div className="space-y-2">
                  {/* R11 Spin Lab — the mechanic, visible: HOOK × BODY × OUTRO recombine */}
                  <div className="rounded-xl border border-brass/25 bg-brass/[0.04] p-2.5">
                    <p className="mb-2 text-[10px] leading-relaxed text-bone/50">
                      <strong className="text-brass/90">Spin = stitch a new variant.</strong> A hook
                      becomes scene 1, the body the middle, an outro the last scene. These are the
                      genes in play (from the Vault):
                    </p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {/* HOOK pool */}
                      <div>
                        <p className="mb-1 text-center text-[9px] font-bold uppercase tracking-wide text-brass">
                          hook
                        </p>
                        <div className="space-y-1">
                          {(vaultAssets ?? [])
                            .filter((a) => a.kind === 'intro' || a.kind === 'reaction')
                            .slice(0, 2)
                            .map((a) => (
                              <div key={a.id} className="rounded-lg border border-brass/30 bg-ink/60 p-1">
                                <Thumb url={a.url} t={0.5} className="h-10 w-full rounded object-cover" />
                                <p className="mt-0.5 truncate text-[8px] font-semibold leading-3 text-bone/70">
                                  {a.name}
                                </p>
                              </div>
                            ))}
                          {(vaultAssets ?? []).filter(
                            (a) => a.kind === 'intro' || a.kind === 'reaction',
                          ).length === 0 && (
                            <p className="rounded-lg border border-dashed border-bone/15 p-2 text-center text-[8px] leading-3 text-bone/30">
                              upload an intro in the Vault
                            </p>
                          )}
                        </div>
                      </div>
                      {/* BODY pool */}
                      <div>
                        <p className="mb-1 text-center text-[9px] font-bold uppercase tracking-wide text-bone/60">
                          body
                        </p>
                        <div className="space-y-1">
                          <div className="rounded-lg border border-bone/20 bg-ink/60 p-1.5">
                            <p className="text-[9px] font-semibold text-bone/75">full</p>
                            <p className="text-[8px] leading-3 text-bone/40">middle scenes as-is</p>
                          </div>
                          <div className="rounded-lg border border-bone/20 bg-ink/60 p-1.5">
                            <p className="text-[9px] font-semibold text-bone/75">tight</p>
                            <p className="text-[8px] leading-3 text-bone/40">middle capped at 5s</p>
                          </div>
                        </div>
                      </div>
                      {/* OUTRO pool */}
                      <div>
                        <p className="mb-1 text-center text-[9px] font-bold uppercase tracking-wide text-violet-300">
                          outro
                        </p>
                        <div className="space-y-1">
                          {(vaultAssets ?? [])
                            .filter((a) => a.kind === 'outro')
                            .slice(0, 2)
                            .map((a) => (
                              <div key={a.id} className="rounded-lg border border-violet-500/30 bg-ink/60 p-1">
                                <Thumb url={a.url} t={0.5} className="h-10 w-full rounded object-cover" />
                                <p className="mt-0.5 truncate text-[8px] font-semibold leading-3 text-bone/70">
                                  {a.name}
                                </p>
                              </div>
                            ))}
                          {(vaultAssets ?? []).filter((a) => a.kind === 'outro').length === 0 && (
                            <p className="rounded-lg border border-dashed border-bone/15 p-2 text-center text-[8px] leading-3 text-bone/30">
                              optional — upload a CTA outro
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => void spinVariantsLab()}
                      disabled={busy || project.clips.length === 0}
                      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-brass px-3 py-2 text-[11px] font-bold text-ink hover:bg-brass/90 disabled:opacity-40"
                      title="Stitch every hook × body × outro into new descendant reels"
                    >
                      <Sparkles className="h-3.5 w-3.5" /> Spin variants
                    </button>
                  </div>
                  <p className="rounded-xl border border-bone/10 bg-bone/[0.03] px-2.5 py-2 text-[10px] leading-relaxed text-bone/45">
                    The gene view: this reel and its descendants. Pick a variant to play and edit
                    it on the timeline.
                  </p>
                  <div className="rounded-xl border border-brass/40 bg-brass/[0.07] p-2.5 text-center">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-brass/70">
                      base reel
                    </p>
                    <p className="mt-0.5 truncate text-[11px] font-semibold text-bone/90">
                      {project.name}
                    </p>
                  </div>
                  {loopRows === null ? (
                    <button
                      onClick={() => void loadLoop()}
                      className="text-[11px] text-bone/40 hover:underline"
                    >
                      Load variants…
                    </button>
                  ) : (
                    (() => {
                      const base = project.name.split(' (')[0];
                      const rows = (loopRows ?? []).filter(
                        (r) =>
                          r.projectName === project.name ||
                          r.projectName.startsWith(`${project.name} (`) ||
                          r.projectName.startsWith(`${base} (`),
                      );
                      if (rows.length === 0) {
                        return (
                          <p className="rounded-lg border border-dashed border-bone/10 px-3 py-4 text-[10px] leading-relaxed text-bone/30">
                            No descendants yet — hit <strong className="text-brass/80">spin</strong>{' '}
                            on the Scoreboard to recombine this reel with Vault genes.
                          </p>
                        );
                      }
                      return rows.map((r) => {
                        const t = parseGeneTags(r.projectName);
                        const isWinner = loopWinner?.variant.id === r.variant.id;
                        const ctr = r.impressions > 0 ? r.clicks / r.impressions : null;
                        const variantProject = (projects ?? []).find(
                          (p) => p.id === r.variant.projectId,
                        );
                        return (
                          <button
                            key={r.variant.id}
                            onClick={() => {
                              if (!variantProject) {
                                setNote('That variant is not in the reel list (renamed or deleted).');
                                return;
                              }
                              setProject(variantProject);
                              setSelectedClip(null);
                              setTab('clips');
                            }}
                            className={clsx(
                              'w-full rounded-xl border p-2 text-left transition-colors',
                              isWinner
                                ? 'border-brass/60 bg-brass/[0.08] ring-1 ring-brass/40'
                                : 'border-bone/10 bg-bone/[0.03] hover:border-bone/25',
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <Thumb
                                url={r.variant.composedUrl}
                                t={0.5}
                                className="h-10 w-14 shrink-0 rounded bg-black object-cover"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[11px] font-semibold text-bone/85">
                                  {isWinner && <span className="mr-1 text-brass">★</span>}
                                  {r.projectName}
                                </p>
                                <p className="text-[9px] text-bone/40">
                                  {ctr != null
                                    ? `${(ctr * 100).toFixed(1)}% CTR · ${r.impressions.toLocaleString()} imp`
                                    : 'not posted yet — click to edit it'}
                                </p>
                              </div>
                            </div>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {t.hook && (
                                <span className="rounded bg-brass/15 px-1.5 py-0.5 text-[9px] font-semibold text-brass">
                                  H:{t.hook}
                                </span>
                              )}
                              {t.body && (
                                <span className="rounded border border-bone/20 px-1.5 py-0.5 text-[9px] font-semibold text-bone/60">
                                  B:{t.body}
                                </span>
                              )}
                              {t.outro && (
                                <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-violet-300">
                                  O:{t.outro}
                                </span>
                              )}
                              {!t.hook && !t.body && !t.outro && (
                                <span className="text-[9px] text-bone/30">legacy variant</span>
                              )}
                            </div>
                          </button>
                        );
                      });
                    })()
                  )}
                </div>
              )}

              {tab === 'board' && (
                <div className="space-y-2">
                  <p className="rounded-xl border border-bone/10 bg-bone/[0.03] px-2.5 py-2 text-[10px] leading-relaxed text-bone/45">
                    The Board: story first. Shots in order, each with its Seedance prompt and its
                    footage — Assemble lays them on the timeline as scenes.
                  </p>
                  <div className="flex items-center gap-1.5">
                    <input
                      value={brollTopic}
                      onChange={(e) => setBrollTopic(e.target.value)}
                      placeholder="What is this reel about?"
                      className="min-w-0 flex-1 rounded-lg border border-bone/15 bg-ink px-2 py-1.5 text-[11px] text-bone/80 outline-none placeholder:text-bone/25"
                    />
                    <button
                      onClick={() => void suggestBoard()}
                      disabled={busy}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-brass/40 px-2 py-1.5 text-[10px] font-semibold text-brass hover:bg-brass/10 disabled:opacity-40"
                    >
                      <Sparkles className="h-3 w-3" /> Suggest
                    </button>
                  </div>
                  {storyLine && <p className="text-[10px] italic text-bone/45">“{storyLine}”</p>}
                  {boardShots.map((s, i) => (
                    <div key={s.id} className="space-y-1.5 rounded-xl border border-bone/10 bg-bone/[0.03] p-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-brass/80">{i + 1}</span>
                        <input
                          value={s.label}
                          onChange={(e) => patchShot(s.id, { label: e.target.value })}
                          className="min-w-0 flex-1 rounded border border-bone/15 bg-ink px-1.5 py-1 text-[10px] font-semibold text-bone/85"
                        />
                        <input
                          type="number"
                          min={0.5}
                          step={0.5}
                          value={s.durSec}
                          onChange={(e) => patchShot(s.id, { durSec: Number(e.target.value) })}
                          title="seconds"
                          className="w-12 rounded border border-bone/15 bg-ink px-1 py-1 text-[10px] text-bone/80"
                        />
                        <button
                          onClick={() => moveBoardShot(s.id, -1)}
                          disabled={i === 0}
                          className="text-bone/40 hover:text-bone disabled:opacity-20"
                        >
                          —
                        </button>
                        <button
                          onClick={() => moveBoardShot(s.id, 1)}
                          disabled={i === boardShots.length - 1}
                          className="text-bone/40 hover:text-bone disabled:opacity-20"
                        >
                          —
                        </button>
                        <button
                          onClick={() => removeBoardShot(s.id)}
                          className="text-bone/30 hover:text-red-300"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <textarea
                        value={s.prompt}
                        onChange={(e) => patchShot(s.id, { prompt: e.target.value })}
                        rows={2}
                        placeholder="Seedance prompt for this shot"
                        className="w-full rounded-lg border border-bone/15 bg-ink px-2 py-1.5 text-[10px] text-bone/75 outline-none placeholder:text-bone/25"
                      />
                      <div className="flex items-center gap-1.5">
                        <input
                          value={s.url}
                          onChange={(e) => patchShot(s.id, { url: e.target.value })}
                          placeholder="https://… footage for this shot"
                          className="min-w-0 flex-1 rounded border border-bone/15 bg-ink px-1.5 py-1 text-[10px] text-bone/80 outline-none placeholder:text-bone/25"
                        />
                        <button
                          onClick={() => {
                            setHubShotId(s.id);
                            void openHubPicker();
                          }}
                          title="Pick a Hub render for this shot"
                          className="shrink-0 rounded border border-bone/15 px-1.5 py-1 text-[9px] text-bone/50 hover:bg-bone/10"
                        >
                          Hub
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-1.5">
                    <button
                      onClick={addBoardShot}
                      className="flex-1 rounded-lg border border-dashed border-bone/15 px-2 py-1.5 text-[10px] text-bone/50 hover:bg-bone/10"
                    >
                      + shot
                    </button>
                    <button
                      onClick={() => void assembleBoard()}
                      disabled={busy || !boardShots.some((s) => s.url.trim())}
                      className="flex-1 rounded-lg bg-brass px-2 py-1.5 text-[10px] font-semibold text-ink disabled:opacity-40"
                    >
                      Assemble →
                    </button>
                  </div>
                  {hubOpen && hubShotId && (
                    <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-bone/10 bg-ink/60 p-1.5">
                      {hubPieces === null ? (
                        <p className="flex items-center gap-1.5 px-2 py-2 text-[10px] text-bone/40">
                          <Loader2 className="h-3 w-3 animate-spin" /> Loading Hub renders…
                        </p>
                      ) : hubPieces.length === 0 ? (
                        <p className="px-2 py-2 text-[10px] text-bone/30">
                          No video renders in the Content Hub yet.
                        </p>
                      ) : (
                        hubPieces.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => pickHubForShot(p)}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-brass/10"
                          >
                            <Thumb
                              url={p.media?.src as string}
                              t={0.5}
                              className="h-8 w-11 shrink-0 rounded bg-black object-cover"
                            />
                            <span className="min-w-0 flex-1 truncate text-[10px] text-bone/75">
                              {p.hook || 'Hub render'}
                            </span>
                            <Plus className="h-3 w-3 shrink-0 text-brass" />
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </aside>

          {/* right: preview + timeline */}
          <main className="flex min-w-0 flex-1 flex-col">
            {errors.length > 0 && (
              <p className="shrink-0 px-4 pt-2 text-xs text-amber-200">
                {errors.join(' ')}
              </p>
            )}
            <div className="flex min-h-0 flex-1">
              {/* stage column: target strip on top, preview + timeline */}
              {/* overflow-hidden + min-w-0: the timeline strip below can be
                  thousands of px wide (total * pxPerSec). Without a hard clip on
                  the column, that width bleeds UP into the flex-centered stage and
                  shoves the video off the right edge of the screen (the "blank"
                  stage — the video was loaded fine, just at x≈3000). Clip the
                  column so the stage centers within the VISIBLE width. */}
              <div className="grid min-w-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-4 pr-2">
              <div className="mb-2 flex shrink-0 items-center justify-center gap-2">
                <button
                  onClick={() => setGeneStrip((v) => !v)}
                  className={clsx(
                    'rounded-md border px-2 py-1 text-[9px] font-semibold',
                    geneStrip ? 'border-brass/40 text-brass' : 'border-bone/15 text-bone/40',
                  )}
                  title={geneStrip ? 'Hide the variant gene strip' : 'Show the variant gene strip'}
                >
                  {geneStrip ? '↑ genes' : 'genes ↓'}
                </button>
                <button
                  onClick={() => setPreviewMode((m) => (m === 'remotion' ? 'edit' : 'remotion'))}
                  className={clsx(
                    'rounded-md border px-2 py-1 text-[9px] font-semibold',
                    previewMode === 'remotion' ? 'border-brass/50 bg-brass/10 text-brass' : 'border-bone/15 text-bone/40',
                  )}
                  title={previewMode === 'remotion' ? 'TRUE render preview (what you see IS what exports)' : 'Edit mode (scrub/trim canvas)'}
                >
                  {previewMode === 'remotion' ? 'Remotion' : 'Edit'}
                </button>

                <span className="text-[9px] font-semibold uppercase tracking-wide text-bone/30">
                  target
                </span>
                <div className="relative">
                  <button
                    onClick={() => setTargetOpen((v) => !v)}
                    className="flex items-center gap-1.5 rounded-md border border-brass/40 px-2.5 py-1 text-[10px] font-semibold text-brass"
                    title="Change the post target — the whole studio follows"
                  >
                    <BrandLogo id={postTarget.brand} active /> {targetTypeLabel(postTarget)} ▾
                  </button>
                  {targetOpen && (
                    <div className="absolute left-1/2 top-8 z-40 max-h-72 w-52 -translate-x-1/2 overflow-y-auto rounded-xl border border-bone/15 bg-ink p-1.5 shadow-2xl">
                      {TARGET_GROUPS.map((g) => (
                        <div key={g.brand} className="mb-1">
                          <p className="flex items-center gap-1.5 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-bone/35">
                            <BrandLogo id={g.brand} active={false} /> {g.label}
                          </p>
                          {g.types.map((t) => (
                            <button
                              key={t.id}
                              onClick={() => {
                                setPostTarget({ brand: g.brand, type: t.id });
                                setTargetOpen(false);
                              }}
                              className={clsx(
                                'block w-full rounded-md px-2.5 py-1.5 text-left text-[11px]',
                                postTarget.brand === g.brand && postTarget.type === t.id
                                  ? 'bg-brass/15 font-semibold text-brass'
                                  : 'text-bone/70 hover:bg-bone/10',
                              )}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {/* relative + flex centering: the video is centered INSIDE a box that
                  is itself capped to the column's visible width. The timeline strip
                  below can be thousands of px wide (total * pxPerSec) and was
                  inflating the column, dragging the flex-centered video off the
                  right edge (x≈3000 = the "blank" stage). w-full + min-w-0 +
                  overflow-hidden pin the stage to the VISIBLE width so the video
                  always centers where you can see it. */}
              <div ref={stageRef} className="flex min-h-0 w-full min-w-0 items-center justify-center overflow-hidden">

                {/* R10 variant gene strip — the gene flow, always beside the canvas (hideable) */}
                {geneStrip && (
                  <div className="mr-3 flex w-40 shrink-0 flex-col gap-2 self-stretch overflow-y-auto border-r border-bone/10 pr-3">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-bone/30">
                      variants
                    </p>
                    {/* the BASE card — one click back to the reel you're cutting */}
                    <button
                      onClick={() => setSelectedClip(null)}
                      className="rounded-xl border border-brass/40 bg-brass/[0.06] p-1.5 text-left"
                      title={project.name}
                    >
                      <p className="truncate text-[10px] font-bold leading-4 text-brass">
                        → {project.name.split(' (')[0]}
                      </p>
                      <p className="mt-0.5 text-[8px] leading-3 text-bone/40">base reel — now editing</p>
                    </button>
                    {(() => {
                      const base = project.name.split(' (')[0];
                      const rows = (loopRows ?? []).filter(
                        (r) =>
                          r.projectName !== project.name &&
                          (r.projectName.startsWith(`${project.name} (`) ||
                            r.projectName.startsWith(`${base} (`)),
                      );
                      if (rows.length === 0) {
                        return (
                          <button
                            onClick={() => void spinVariantsLab()}
                            className="rounded-xl border border-dashed border-brass/30 px-2 py-3 text-center text-[9px] font-semibold leading-4 text-brass/70 hover:bg-brass/10"
                            title="Spin variants from this reel with Vault genes"
                          >
                            + spin
                            <br />
                            variants
                          </button>
                        );
                      }
                      return rows.map((r) => {
                        const t = parseGeneTags(r.projectName);
                        const isWinner = loopWinner?.variant.id === r.variant.id;
                        const ctr = r.impressions > 0 ? r.clicks / r.impressions : null;
                        const variantProject = (projects ?? []).find(
                          (p) => p.id === r.variant.projectId,
                        );
                        return (
                          <button
                            key={r.variant.id}
                            onClick={() => {
                              if (!variantProject) return;
                              setProject(variantProject);
                              setSelectedClip(null);
                            }}
                            className={clsx(
                              'rounded-xl border p-1.5 text-left transition-colors',
                              isWinner
                                ? 'border-brass/60 bg-brass/[0.08] ring-1 ring-brass/30'
                                : 'border-bone/10 bg-bone/[0.03] hover:border-brass/35',
                            )}
                            title={`${r.projectName} — click to edit it`}
                          >
                            <Thumb
                              url={r.variant.composedUrl}
                              t={0.5}
                              className="h-20 w-full rounded-lg object-cover"
                            />
                            <p className="mt-1.5 truncate text-[9px] font-semibold leading-4 text-bone/80">
                              {isWinner && <span className="mr-1 text-brass">★</span>}
                              {r.projectName.replace(`${base} `, '')}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {t.hook && (
                                <span className="rounded bg-brass/15 px-1.5 py-0.5 text-[8px] font-bold leading-3 text-brass">
                                  H:{t.hook}
                                </span>
                              )}
                              {t.body && (
                                <span className="rounded border border-bone/20 px-1.5 py-0.5 text-[8px] font-bold leading-3 text-bone/55">
                                  B:{t.body}
                                </span>
                              )}
                              {t.outro && (
                                <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[8px] font-bold leading-3 text-violet-300">
                                  O:{t.outro}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-[8px] leading-3 text-bone/35">
                              {ctr != null
                                ? `${(ctr * 100).toFixed(1)}% CTR · ${r.impressions.toLocaleString()} imp`
                                : 'not posted yet'}
                            </p>
                          </button>
                        );
                      });
                    })()}
                  </div>
                )}
                {/* Remotion preview — UNLESS the stage clip is still a blob: URL.
                    OffthreadVideo can't decode a blob (it fetches frames offscreen
                    and needs http(s)), so an upload paints black until the storage
                    URL lands. While it's a blob we fall through to the plain
                    <video> edit-stage below, which plays a blob natively. */}
                {previewMode === 'remotion' && project.clips.length > 0 && !stageIsBlob ? (
                  <div
                    className="relative shrink-0 overflow-hidden rounded-xl bg-black shadow-2xl ring-1 ring-bone/10"
                    style={{ width: stageBox.w || undefined, height: stageBox.h || undefined }}
                    onContextMenu={(e) => onCaptionWordContextMenu(e, 'remotion')}
                    onPointerDown={(e) => onCaptionWordPointerDown(e, 'remotion')}
                  >
                    {(!project || project.clips.length === 0) && (
                      <div
                        data-empty-start
                        className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/70 px-6 text-center"
                      >
                        <p className="text-sm font-semibold text-bone">Start a reel</p>
                        <p className="max-w-[240px] text-[11px] text-bone/50">
                          Upload a video or pull one from the media library. Captions can transcribe automatically.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => fileInput.current?.click()}
                            className="rounded-md bg-brass px-3 py-1.5 text-[11px] font-semibold text-ink"
                          >
                            Upload video
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const tabBtn = document.querySelector('[data-tab="clips"]') as HTMLButtonElement | null;
                              tabBtn?.click();
                            }}
                            className="rounded-md border border-bone/20 px-3 py-1.5 text-[11px] font-semibold text-bone/80 hover:bg-white/5"
                          >
                            From library
                          </button>
                        </div>
                        <label className="flex items-center gap-2 text-[10px] text-bone/55">
                          <input
                            type="checkbox"
                            checked={autoTranscribeOnImport}
                            onChange={(e) => setAutoTranscribeOnImport(e.target.checked)}
                          />
                          Auto-transcribe on import
                        </label>
                      </div>
                    )}
                    <RemotionPreview
                        project={projectWithWordPlace ?? project}
                        aspect={aspect === '9:16' ? 'vertical' : aspect === '16:9' ? 'landscape' : 'square'}
                        playheadSec={playheadSec}
                        onFrameSec={onPlayerFrame}
                        freePlaceEdit={stackEditMode}
                        showAllWords={stackEditMode && showAllCardWords}
                      />
                    {uploadJob && (
                      <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-10">
                        <p className="mb-1.5 text-[11px] font-semibold text-bone">
                          {uploadJob.phase}
                        </p>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                          <div
                            className="h-full rounded-full bg-brass transition-[width] duration-150"
                            style={{ width: `${Math.max(4, uploadJob.pct)}%` }}
                          />
                        </div>
                        <p className="mt-1 text-[10px] text-bone/50">
                          {uploadJob.name} · {uploadJob.pct}%
                        </p>
                      </div>
                    )}

                    <CaptionEditSurface
                      surface="remotion"
                      project={project}
                      currentClip={currentClip}
                      playheadSec={playheadSec}
                      ccOn={ccOn}
                      edit={captionEdit}
                      setCaptionOverrides={setCaptionOverrides}
                      setCaptionOverridesLocal={setCaptionOverridesLocal}
                      cueStyleEditId={cueStyleEditId}
                      setCueStyleEditId={setCueStyleEditId}
                      cueDragLocal={cueDragLocal}
                      setCueDragLocal={setCueDragLocal}
                      patchCueStyle={patchCueStyle}
                      cueOnScreen={cueOnScreen}
                    />
                  </div>
                ) : previewSrc ? (
                  <div
                    className="relative shrink-0 overflow-hidden rounded-xl bg-black shadow-2xl ring-1 ring-bone/10"
                    style={{ width: stageBox.w || undefined, height: stageBox.h || undefined }}
                    onContextMenu={(e) => onCaptionWordContextMenu(e, 'stage')}
                    onPointerDown={(e) => onCaptionWordPointerDown(e, 'stage')}
                  >

                    {/* Upload feedback lives ON the stage - the sidebar is not where
                        the eye is while a file is climbing. */}
                    {uploadJob && (
                      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-black/85 via-black/50 to-transparent px-3 pb-6 pt-2.5">
                        <p className="text-[11px] font-semibold text-bone">
                          {uploadJob.phase}
                        </p>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-bone/20">
                          <div
                            className="h-full rounded-full bg-emerald-400 transition-[width] duration-200"
                            style={{ width: `${Math.max(4, uploadJob.pct)}%` }}
                          />
                        </div>
                        <p className="mt-1 truncate text-[10px] text-bone/60">
                          {uploadJob.name} {uploadJob.pct}%
                        </p>
                      </div>
                    )}

                    {/* R25: ONE element, driven 100% by the playback clock for SEEKING.
                        The src IS set on mount (src={previewSrc}) so the element is BORN
                        with a source — the paint effect only fires when previewSrc CHANGES,
                        so a video that mounts fresh (e.g. the branch just flipped from
                        Remotion to edit because the upload is still a blob) would otherwise
                        be born with NO src and sit black. The clock still owns drift/seek
                        during playback; this just guarantees a first frame. */}
                    <video

                      ref={previewRef}
                      src={previewSrc || undefined}
                      data-clip-url=""
                      preload="auto"
                      onClick={togglePlay}
                      style={{
                        transform: stageClip?.motion
                          ? motionCssTransform(sampleMotion(stageClip.motion, previewTime))
                          : undefined,
                        transformOrigin: 'center',
                      }}
                      className={clsx(
                        'h-full w-full',
                        fit === 'cover' || stageClip?.motion?.length
                          ? 'object-cover'
                          : 'object-contain',
                      )}
                      onPlay={() => {
                        if (!clockRef.current.playing) startClock();
                      }}
                      onPause={() => {
                        if (swappingRef.current) return; // a src swap, not a user pause
                        if (clockRef.current.playing && !swappingRef.current) stopClock();
                      }}
                      onError={(e) => {
                        // A blob <video> that can't decode the file (HEVC/ProRes/.mov
                        // Chrome can't play) lands here with a MEDIA_ERR — this is the
                        // "uploads but shows nothing" case. Surface it on the stage.
                        const err = e.currentTarget.error;
                        setStageVideoError(
                          err
                            ? `This file can't play in the browser (code ${err.code}). Re-export it as H.264 MP4.`
                            : 'This file cannot play in the browser.',
                        );
                      }}
                      onLoadedMetadata={(e) => {
                        setStageVideoError(null);
                        swappingRef.current = false;
                        const el = e.currentTarget;
                        const pending = pendingSeekRef.current;
                        if (pending != null) {
                          pendingSeekRef.current = null;
                          try {
                            e.currentTarget.currentTime = pending;
                          } catch {
                            /* harmless */
                          }
                        }
                        if (clockRef.current.playing && e.currentTarget.paused) {
                          void e.currentTarget.play().catch(() => {});
                        }
                      }}
                    />
                    {/* The codec failure, ON the stage. A blob <video> that can't
                        decode the file (HEVC/ProRes/.mov Chrome can't play) fires
                        onError and renders black — this turns that silent black
                        into a readable message. */}
                    {stageVideoError && (
                      <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-2 bg-black/85 p-6 text-center">
                        <p className="text-[12px] font-semibold text-red-300">
                          This video can't play in the browser
                        </p>
                        <p className="max-w-[280px] text-[10px] leading-relaxed text-bone/60">
                          {stageVideoError}
                        </p>
                        <p className="text-[9px] text-bone/35">
                          Re-export it as H.264 MP4 (the universal web codec) and upload again.
                        </p>
                      </div>
                    )}
                    {/* R25 overlay (b-roll) layer — picture-in-picture, clock-synced, muted. */}
                    {overlayHit && (
                      <video
                        ref={overlayRef}
                        data-clip-url=""
                        muted
                        playsInline
                        className={
                          overlayHit.isCutout
                            ? 'absolute inset-0 z-[6] h-full w-full object-cover'
                            : 'absolute bottom-3 right-3 z-10 w-[30%] rounded-lg border border-white/25 object-cover shadow-xl'
                        }
                        style={overlayHit.isCutout ? undefined : { aspectRatio: '16/9' }}
                        onLoadedMetadata={(e) => {
                          const p = pendingOvSeekRef.current;
                          if (p != null) {
                            pendingOvSeekRef.current = null;
                            try {
                              e.currentTarget.currentTime = p;
                            } catch {
                              /* harmless */
                            }
                          }
                          if (clockRef.current.playing && e.currentTarget.paused) {
                            void e.currentTarget.play().catch(() => {});
                          }
                        }}
                      />
                    )}
                    {/* Karaoke captions on the EDIT stage — the SAME layer the MP4
                        is drawn with (StageCaptions → CaptionLayerFrame), positioned
                        by the layer itself from xPct/positionPct.

                        This used to be a hand-rolled overlay wrapping <KaraokeLine>
                        in a `w-max` box, i.e. a THIRD caption implementation with its
                        own type scale, its own wrap width, and its own idea of the
                        active word. That is why the MP4 still showed different
                        captions after both Remotion layers were unified: the surface
                        being compared against was never one of them. */}
                    {ccOn &&
                      stageClip &&
                      (project.captions[stageClip.id]?.length ?? 0) > 0 && (
                        <>
                          {/* No z on this wrapper — it used to pin z-20, which
                              trapped the caption layer's inner z's (behind z 5 /
                              block z 10 / front z 11) inside its own stacking
                              context, so a behind word could never duck under
                              the cutout video (z 6) on this stage. Bare wrapper
                              = the layer's z's join the global stack, same as
                              the Remotion composition. */}
                          <div className="pointer-events-none absolute inset-0">
                            <StageCaptions
                              words={(projectWithWordPlace ?? project).captions[stageClip.id] ?? []}
                              timeSec={previewTime + (stageClip.trimStartSec ?? 0)}
                              stageW={stageBox.w}
                              preset={project.captionStyle}
                              overrides={project.captionOverrides}
                            />
                          </div>
                    <CaptionEditSurface
                      surface="stage"
                      project={project}
                      currentClip={currentClip}
                      stageClip={stageClip}
                      playheadSec={playheadSec}
                      ccOn={ccOn}
                      edit={captionEdit}
                      setCaptionOverrides={setCaptionOverrides}
                      setCaptionOverridesLocal={setCaptionOverridesLocal}
                      cueStyleEditId={cueStyleEditId}
                      setCueStyleEditId={setCueStyleEditId}
                      cueDragLocal={cueDragLocal}
                      setCueDragLocal={setCueDragLocal}
                      patchCueStyle={patchCueStyle}
                      cueOnScreen={cueOnScreen}
                    />
                        </>
                      )}

                    {/* R8 platform lens chrome (9:16 canvas only — vertical surfaces) */}
                    {lensMode === 'platform' && aspect === '9:16' && (
                      <PlatformLensOverlay
                        brand={postTarget.brand}
                        title={copyPool?.title ?? project.name}
                        caption={copyPool?.caption ?? project.name}
                      />
                    )}
                  </div>

                ) : (
                <div
                  data-empty-start
                  className="relative flex shrink-0 flex-col items-center justify-center gap-4 rounded-xl bg-black px-6 py-16 text-center shadow-2xl ring-1 ring-bone/10"
                  style={{ width: stageBox.w || 360, minHeight: stageBox.h || 480 }}
                >
                  {uploadJob?.blobUrl && (
                    <video
                      src={uploadJob.blobUrl}
                      muted
                      playsInline
                      preload="metadata"
                      className="absolute inset-0 h-full w-full object-contain opacity-40"
                    />
                  )}
                  {uploadJob && (
                    <div className="absolute inset-x-6 bottom-6 z-10">
                      <p className="mb-1.5 text-[11px] font-semibold text-bone">{uploadJob.phase}</p>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                        <div
                          className="h-full rounded-full bg-brass"
                          style={{ width: `${Math.max(4, uploadJob.pct)}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <p className="text-sm font-semibold text-bone">Start a reel</p>
                  <p className="max-w-[240px] text-[11px] text-bone/50">
                    Upload a video or pull one from the media library. Captions can transcribe automatically.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      className="rounded-md bg-brass px-3 py-1.5 text-[11px] font-semibold text-ink"
                    >
                      Upload video
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const tabBtn = document.querySelector('[data-tab="clips"]') as HTMLButtonElement | null;
                        tabBtn?.click();
                      }}
                      className="rounded-md border border-bone/20 px-3 py-1.5 text-[11px] font-semibold text-bone/80 hover:bg-white/5"
                    >
                      Media library
                    </button>
                  </div>
                </div>
              )}
            </div>
            {/* the hidden synced audio bed (preview playback drives it) */}
            {project.audio && (
              <audio ref={audioRef} src={project.audio.url} preload="auto" className="hidden" />
            )}
            <div className="shrink-0 px-4 pb-4">

              {/* timeline toolbar — row 1: actions; row 2: hints + zoom */}
              <div className="mb-1.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <button
                      onClick={undoEdit}
                      disabled={historyRef.current.past.length === 0}
                      className="inline-flex items-center gap-1 rounded border border-bone/20 px-2 py-0.5 text-[10px] font-semibold text-bone/60 hover:bg-bone/10 disabled:opacity-40"
                      title="Undo (Ctrl/Cmd+Z)"
                    >
                      <Undo2 className="h-3 w-3" />
                    </button>
                    <button
                      onClick={redoEdit}
                      disabled={historyRef.current.future.length === 0}
                      className="inline-flex items-center gap-1 rounded border border-bone/20 px-2 py-0.5 text-[10px] font-semibold text-bone/60 hover:bg-bone/10 disabled:opacity-40"
                      title="Redo (Ctrl/Cmd+Shift+Z)"
                    >
                      <Redo2 className="h-3 w-3" />
                    </button>
                    <span className="mx-0.5 h-3.5 w-px bg-bone/15" />
                    {/* R21 TRANSPORT: play/pause + step by scene, right where the cuts are */}
                    <button
                      onClick={() => goToScene(-1)}
                      disabled={!currentClip || project.clips.length < 2}
                      className="inline-flex items-center rounded border border-bone/20 px-1.5 py-0.5 text-bone/60 hover:bg-bone/10 disabled:opacity-40"
                      title="Previous scene"
                    >
                      <SkipBack className="h-3 w-3" />
                    </button>
                    <button
                      onClick={togglePlay}
                      disabled={!previewSrc}
                      className="inline-flex items-center rounded border border-brass/50 bg-brass/10 px-2 py-0.5 text-brass hover:bg-brass/20 disabled:opacity-40"
                      title={playing ? 'Pause (Space)' : 'Play (Space)'}
                    >
                      {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    </button>
                    <button
                      onClick={() => goToScene(1)}
                      disabled={!currentClip || project.clips.length < 2}
                      className="inline-flex items-center rounded border border-bone/20 px-1.5 py-0.5 text-bone/60 hover:bg-bone/10 disabled:opacity-40"
                      title="Next scene"
                    >
                      <SkipForward className="h-3 w-3" />
                    </button>
                    <span className="mx-0.5 h-3.5 w-px bg-bone/15" />
                    <button
                      onClick={cutTailAtPlayhead}
                      disabled={!currentClip}
                      className="inline-flex items-center gap-1 rounded border border-brass/40 px-2 py-0.5 text-[10px] font-semibold text-brass hover:bg-brass/10 disabled:opacity-40"
                      title="Cut (C) — the scene ENDS at the playhead (instant, Ctrl+Z undoes it)"
                    >
                      <Scissors className="h-3 w-3" /> Cut
                    </button>
                    <button
                      onClick={() => void splitAtPlayhead()}
                      disabled={!currentClip || busy}
                      className="inline-flex items-center gap-1 rounded border border-brass/40 px-2 py-0.5 text-[10px] font-semibold text-brass hover:bg-brass/10 disabled:opacity-40"
                      title="TRUE split at the playhead (S) — one scene becomes two"
                    >
                      <Scissors className="h-3 w-3" /> Split
                    </button>
                    <button
                      onClick={() => void transcribeCurrentClip()}
                      disabled={!currentClip || busy}
                      className="inline-flex items-center gap-1 rounded border border-bone/20 px-2 py-0.5 text-[10px] font-semibold text-bone/60 hover:bg-bone/10 disabled:opacity-40"
                      title="Whisper the current scene into word-timed karaoke captions"
                    >
                      <Mic className="h-3 w-3" /> CC
                    </button>
                    <button
                      onClick={() => void cutSilenceFromCurrentClip()}
                      disabled={!currentClip || busy}
                      className="inline-flex items-center gap-1 rounded border border-bone/20 px-2 py-0.5 text-[10px] font-semibold text-bone/60 hover:bg-bone/10 disabled:opacity-40"
                      title="Auto-cut silent gaps in the current scene (Whisper words + the split worker)"
                    >
                      <VolumeX className="h-3 w-3" /> Cut silence
                    </button>
                  </span>
                  <span className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-bone/40">
                    {selected && (
                      <span className="normal-case text-brass/60">
                        scene {project.clips.findIndex((c) => c.id === selected.id) + 1}/
                        {project.clips.length} · cut frame{' '}
                        {fmtSec(Math.max(0, selected.durationSec - selected.trimEndSec))}
                      </span>
                    )}
                    <span>
                      {fmtSec(Math.min(playheadSec, total))} / {fmtSec(total)}
                    </span>
                    {/* R26: the platform length budget — adjustable per reel */}
                    <span
                      className={clsx(
                        'flex items-center gap-0.5 normal-case',
                        targetLen.max > 0 && total > targetLen.max
                          ? 'font-bold text-red-300'
                          : total > targetSec
                            ? 'text-amber-300/90'
                            : 'text-bone/40',
                      )}
                      title={`${targetTypeLabel(postTarget)} sweet spot: ${fmtSec(targetLen.target)}${targetLen.max ? ` · hard max ${fmtSec(targetLen.max)}` : ''} — adjust with −/+`}
                    >
                      −
                      <button
                        onClick={() => setTargetOverride(Math.max(15, targetSec - 15))}
                        className="rounded px-0.5 hover:bg-bone/10"
                        title="Shorter target"
                      >
                        +
                      </button>
                      {fmtSec(targetSec)}
                      <button
                        onClick={() => setTargetOverride(targetSec + 15)}
                        className="rounded px-0.5 hover:bg-bone/10"
                        title="Longer target"
                      >
                        +
                      </button>
                      {targetOverride != null && (
                        <button
                          onClick={() => setTargetOverride(null)}
                          className="text-brass hover:underline"
                          title="Reset to the platform default"
                        >
                          ▾
                        </button>
                      )}
                      {targetLen.max > 0 && total > targetLen.max && (
                        <span>over the {fmtSec(targetLen.max)} max</span>
                      )}
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-[9px] text-bone/30">
                  <span>
                    drag scenes to reorder · drag an edge to trim · C cuts the tail at the playhead ·
                    S splits into two · Space plays · , / . step a frame · Ctrl+Z undoes
                  </span>
                  <label className="flex items-center gap-1.5 normal-case text-bone/40">
                    zoom
                    <input
                      type="range"
                      min={1}
                      max={8}
                      step={0.5}
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="w-20 accent-brass"
                    />
                    {zoom > 1 && (
                      <button onClick={() => setZoom(1)} className="text-brass hover:underline">
                        fit
                      </button>
                    )}
                  </label>
                </div>
              </div>
              {project.clips.length > 0 ? (
                <div ref={stripScrollRef} className="w-full min-w-0 max-w-full overflow-x-auto pb-1">
                  {/* R25b: EXACT px width — NO min-w-full. When the container is
                      wider than the track, %-positioned things (playhead, ruler)
                      used to stretch to the full container while px-sized blocks
                      stayed at scale: the playhead sat PAST the trimmed block.
                      Now both use the same reference, so they always agree. */}
                  <div
                    className="relative w-full"
                    style={{
                      // PAGE-WIDTH, ALWAYS. The scenes inside are %-of-total-time,
                      // so the track is simply 100% of the visible strip — a 3-min
                      // video crams more scenes into the SAME width instead of
                      // growing thousands of px and shoving the preview off-screen.
                      // (Zoom now only re-scales the SCENE widths via pxPerSec; the
                      // strip itself stays put and scrolls if scenes overflow.)
                      width: '100%',
                    }}
                  >
                    <TimeRuler
                      totalSec={total}
                      clips={project.clips}
                      zoom={pxPerSec / 36}
                      onScrub={seekTimeline}
                      wordMarks={
                        currentClip
                          ? (project.captions[currentClip.id] ?? []).map((w) => ({
                              t:
                                timelineStartOf(
                                  project.clips,
                                  Math.max(
                                    0,
                                    project.clips.findIndex((c) => c.id === currentClip.id),
                                  ),
                                ) + w.start,
                              label: w.word,
                            }))
                          : []
                      }
                    />
                    {/* R8 story card guides: FB/IG stories split at 15s — land cuts on a card edge */}
                    {isStoryTarget(postTarget) &&
                      total > 15 &&
                      Array.from({ length: Math.floor(total / 15) }, (_, k) => (k + 1) * 15)
                        .filter((t) => t < total)
                        .map((t, k) => (
                          <div
                            key={t}
                            className="pointer-events-none absolute top-0 z-20 h-6 border-l-2 border-amber-400/60 pl-0.5 text-[8px] font-bold leading-3 text-amber-300/90"
                            style={{ left: `${(t / total) * 100}%` }}
                            title={`Story card ${k + 2} starts here (15s cards)`}
                          >
                            ×{k + 2}
                          </div>
                        ))}

                  {/* R26: the target-length marker — where this platform wants the cut to land */}
                  {targetSec < total && (
                    <div
                      className="pointer-events-none absolute bottom-0 top-6 z-20 border-l-2 border-dashed border-amber-400/70 pl-1 text-[8px] font-bold leading-3 text-amber-300/90"
                      style={{ left: `${(targetSec / total) * 100}%` }}
                      title={`${targetTypeLabel(postTarget)} target: ${fmtSec(targetSec)} — you're ${fmtSec(total - targetSec)} over`}
                    >
                      ≈{fmtSec(targetSec)}
                    </div>
                  )}

                  <TimelineStrip
                    clips={project.clips}
                    pxPerSec={pxPerSec}
                    selectedId={selectedClip}
                    onSelect={setSelectedClip}
                    onTrim={(id, trim) => patchClip(id, { trimEndSec: trim })}
                    onReorder={(id, toIndex) => {
                      const from = project.clips.findIndex((c) => c.id === id);
                      if (from < 0 || from === toIndex) return;
                      const next = project.clips.slice();
                      const [item] = next.splice(from, 1);
                      next.splice(toIndex, 0, item);
                      patch({ clips: next });
                    }}
                    onScrub={scrubToCut}
                    onScrubIn={scrubToIn}
                    onLeftTrim={(c, s) => void leftTrimAt(c, s)}
                    onKeyMove={(c, ki, t) => setMotionKey(c, ki, { t })}
                    onTransition={(id, t) => {
                      // The seam picker: set/clear the transition INTO a clip.
                      // Undo-safe via patch; the plan + preview pick it up on
                      // the next render pass.
                      patch({
                        clips: project.clips.map((c) => {
                          if (c.id !== id) return c;
                          if (!t) {
                            const next = { ...c };
                            delete next.transitionIn;
                            return next;
                          }
                          return { ...c, transitionIn: t };
                        }),
                      });
                    }}
                  />

                  {/* R25 OVERLAY (b-roll) LAYERS lane — drag a block to re-time it */}
                  {(project.overlays ?? []).length > 0 && (
                    <div className="relative mt-1.5 h-9 overflow-hidden rounded-lg border border-violet-500/25 bg-violet-500/[0.06]">
                      {(project.overlays ?? []).map((o) => {
                        const eff = effectiveClipDuration(o);
                        return (
                          <div
                            key={o.id}
                            className="group absolute top-0 flex h-full cursor-grab items-center gap-1 overflow-hidden rounded-md border border-violet-400/50 bg-violet-500/25 px-1.5 active:cursor-grabbing"
                            style={{
                              left: `${Math.min(98, (o.offsetSec / Math.max(total, 0.001)) * 100)}%`,
                              width: `${Math.max(2, (eff / Math.max(total, 0.001)) * 100)}%`,
                            }}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              const el = e.currentTarget as HTMLElement;
                              const track = el.parentElement as HTMLElement;
                              const pxPerSec = track.getBoundingClientRect().width / Math.max(total, 0.001);
                              const startX = e.clientX;
                              const startOffset = o.offsetSec;
                              el.setPointerCapture(e.pointerId);
                              const move = (ev: PointerEvent) => {
                                const deltaSec = (ev.clientX - startX) / pxPerSec;
                                patchOverlay(o.id, {
                                  offsetSec:
                                    Math.round(Math.max(0, Math.min(startOffset + deltaSec, total - 0.1)) * 10) / 10,
                                });
                              };
                              const up = () => {
                                el.removeEventListener('pointermove', move);
                                el.removeEventListener('pointerup', up);
                              };
                              el.addEventListener('pointermove', move);
                              el.addEventListener('pointerup', up);
                            }}
                            title={`${o.name} — overlay @ ${fmtSec(o.offsetSec)} (drag to move)`}
                          >
                            <Layers className="h-3 w-3 shrink-0 text-violet-200" />
                            <span className="min-w-0 flex-1 truncate text-[9px] font-medium text-violet-100">
                              {o.name}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                patch({ overlays: (project.overlays ?? []).filter((x) => x.id !== o.id) });
                              }}
                              onPointerDown={(e) => e.stopPropagation()}
                              className="shrink-0 text-violet-200/60 hover:text-red-300"
                              title="Remove this layer"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* audio bed track — drag the block to re-time it against the cut */}
                  {project.audio && (
                    <div className="relative mt-1.5 h-10 overflow-hidden rounded-lg border border-bone/15 bg-ink/70">
                      <WaveformLane url={project.audio.url} />
                      <div
                        className="group absolute top-0 flex h-full cursor-grab items-center gap-1.5 overflow-hidden rounded-md border border-brass/40 bg-brass/15 px-2 active:cursor-grabbing"
                        style={{
                          left: `${(project.audio.offsetSec / Math.max(total, 0.001)) * 100}%`,
                          width: `${Math.max(
                            3,
                            (Math.min(
                              total - project.audio.offsetSec,
                              project.audio.durationSec ?? total - project.audio.offsetSec,
                            ) /
                              Math.max(total, 0.001)) *
                              100,
                          )}%`,
                        }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const el = e.currentTarget as HTMLElement;
                          const track = el.parentElement as HTMLElement;
                          const pxPerSec = track.getBoundingClientRect().width / Math.max(total, 0.001);
                          const startX = e.clientX;
                          const bed = project.audio as ReelAudioTrack;
                          const startOffset = bed.offsetSec;
                          el.setPointerCapture(e.pointerId);
                          const move = (ev: PointerEvent) => {
                            const deltaSec = (ev.clientX - startX) / pxPerSec;
                            const offset =
                              Math.round(
                                Math.max(0, Math.min(startOffset + deltaSec, total - 0.1)) * 10,
                              ) / 10;
                            patch({ audio: { ...bed, offsetSec: offset } });
                          };
                          const up = () => {
                            el.removeEventListener('pointermove', move);
                            el.removeEventListener('pointerup', up);
                            const v = previewRef.current;
                            syncAudioAt(playheadSec, v ? !v.paused : false);
                          };
                          el.addEventListener('pointermove', move);
                          el.addEventListener('pointerup', up);
                        }}
                        title="Drag to move the audio bed in time"
                      >
                        <Music className="h-3 w-3 shrink-0 text-brass" />
                        <span className="min-w-0 flex-1 truncate text-[9px] font-medium text-bone/85">
                          {project.audio.name}
                        </span>
                        <span className="shrink-0 text-[9px] font-semibold text-brass/80">
                          @{fmtSec(project.audio.offsetSec)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            patch({ audio: null });
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="shrink-0 text-bone/40 hover:text-red-300"
                          title="Remove the audio bed"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}
                  {/* the playhead — grab the line itself to scrub */}
                  <div
                    className="absolute bottom-0 top-6 z-30 w-px cursor-ew-resize bg-brass shadow-[0_0_6px_rgba(168,139,92,0.8)]"
                    style={{ left: `${Math.min(100, (playheadSec / Math.max(total, 0.001)) * 100)}%` }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      const el = e.currentTarget as HTMLElement;
                      const container = el.parentElement as HTMLElement;
                      el.setPointerCapture(e.pointerId);
                      // rAF-coalesced scrub: state updates at most once per painted frame,
                      // with one final commit on release.
                      let pendingFrac = 0;
                      let raf = 0;
                      const move = (ev: PointerEvent) => {
                        const rect = container.getBoundingClientRect();
                        pendingFrac = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
                        if (!raf) {
                          raf = requestAnimationFrame(() => {
                            raf = 0;
                            seekTimeline(Math.round(pendingFrac * total * 10) / 10);
                          });
                        }
                      };
                      const up = () => {
                        el.removeEventListener('pointermove', move);
                        el.removeEventListener('pointerup', up);
                        cancelAnimationFrame(raf);
                        seekTimeline(Math.round(pendingFrac * total * 10) / 10);
                      };

                      el.addEventListener('pointermove', move);
                      el.addEventListener('pointerup', up);
                    }}
                    title="Drag to scrub"
                  >
                    <span className="pointer-events-none absolute -left-[5px] top-0 h-3 w-3 rotate-45 rounded-[2px] bg-brass shadow" />
                    <span className="pointer-events-none absolute -left-[7px] top-0 h-full w-[15px]" />
                  </div>

                  </div>
                </div>
              ) : (

                <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-bone/10 text-xs text-bone/30">
                  The timeline is empty.
                </div>
              )}

              {project.composedUrl && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-brass/30 bg-brass/[0.06] px-2.5 py-2 text-[11px] text-bone/70">
                  <Check className="h-3.5 w-3.5 shrink-0 text-brass" />
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-bone/85">Composed MP4 ready</span>
                    {project.composedAt ? ` · ${new Date(project.composedAt).toLocaleString()}` : ''}
                  </span>
                  <button
                    onClick={() => {
                      void navigator.clipboard?.writeText(project.composedUrl);
                      setNote('Composed reel URL copied.');
                    }}
                    className="inline-flex shrink-0 items-center gap-1 rounded border border-brass/40 px-2 py-1 text-[10px] font-semibold text-brass hover:bg-brass/10"
                    title="Copy the composed MP4 link"
                  >
                    <Copy className="h-3 w-3" /> copy
                  </button>
                  <a
                    href={project.composedUrl}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 rounded bg-brass px-2 py-1 text-[10px] font-bold text-ink hover:bg-brass/90"
                    title="Download the composed MP4"
                  >
                    → download
                  </a>
                </div>
              )}
            </div>
            </div>

            {/* R9 right setup rail — aspect, fit, target, lens, captions */}
            <nav className="flex w-14 shrink-0 flex-col gap-1 border-l border-bone/10 p-1.5">
              <p className="mb-0.5 text-center text-[8px] font-semibold uppercase tracking-wide text-bone/30">
                setup
              </p>
              {(['9:16', '16:9', '1:1'] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setAspect(a)}
                  className={clsx(
                    'rounded-md border px-1 py-1 text-[9px] font-semibold',
                    aspect === a ? 'border-brass/50 bg-brass/10 text-brass' : 'border-bone/10 text-bone/45 hover:bg-bone/10',
                  )}
                  title={`Aspect ${a}`}
                >
                  {a}
                </button>
              ))}
              {(['contain', 'cover'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFit(f)}
                  className={clsx(
                    'rounded-md border px-1 py-1 text-[9px] font-semibold',
                    fit === f ? 'border-brass/50 bg-brass/10 text-brass' : 'border-bone/10 text-bone/45 hover:bg-bone/10',
                  )}
                  title={f === 'contain' ? 'Fit (no crop)' : 'Cover (crop preview only)'}
                >
                  {f === 'contain' ? 'Fit' : 'Cover'}
                </button>
              ))}
              <span className="rounded-md border border-brass/30 px-1 py-1 text-center text-[8px] font-semibold leading-3 text-brass/80" title={targetTypeLabel(postTarget)}>
                {targetTypeLabel(postTarget)}
              </span>
              <button
                onClick={() => setLensMode((m) => (m === 'platform' ? 'clean' : 'platform'))}
                className={clsx(
                  'rounded-md border px-1 py-1 text-[9px] font-semibold',
                  lensMode === 'platform' ? 'border-brass/50 text-brass' : 'border-bone/10 text-bone/40',
                )}
                title={lensMode === 'platform' ? 'Platform chrome on the canvas' : 'Clean canvas (no chrome)'}
              >
                {lensMode === 'platform' ? 'lens' : 'clean'}
              </button>
              {isStoryTarget(postTarget) && total > 15 && (
                <span
                  className="rounded-md border border-amber-500/30 bg-amber-500/10 px-1 py-1 text-center text-[8px] font-semibold leading-3 text-amber-200/90"
                  title="Facebook & Instagram Stories split video into 15-second cards"
                >
                  {Math.ceil(total / 15)} cards
                </span>
              )}
              {currentClip && (project.captions[currentClip.id]?.length ?? 0) > 0 && (
                <>
                  <button
                    onClick={() => setCcOn((v) => !v)}
                    className={clsx(
                      'rounded-md border px-1 py-1 text-[9px] font-semibold',
                      ccOn ? 'border-brass/50 text-brass' : 'border-bone/10 text-bone/40',
                    )}
                    title="Toggle karaoke captions"
                  >
                    CC
                  </button>
                  {CAPTION_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => void setCaptionStyle(p.id)}
                      title={p.hint}
                      className={clsx(
                        'rounded-md border px-1 py-1 text-[8px] font-semibold',
                        project.captionStyle === p.id
                          ? 'border-brass/50 bg-brass/10 text-brass'
                          : 'border-bone/10 text-bone/45 hover:bg-bone/10',
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </>
              )}
              <span className="mt-auto text-center text-[8px] leading-3 text-bone/25">
                {fmtSec(total)}
              </span>
            </nav>
            </div>
          </main>
        </div>
      )}
      {helpOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setHelpOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-bone/15 bg-ink p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-bone">Keyboard shortcuts</h2>
              <button onClick={() => setHelpOpen(false)} className="text-bone/40 hover:text-bone">
                ⋯
              </button>
            </div>
            <dl className="space-y-1.5 text-[11px]">
              {(
                [
                  ['Space', 'play / pause the preview'],
                  ['C', 'cut the tail at the playhead'],
                  ['S', 'TRUE split at the playhead'],
                  [', .', 'step one frame (1/30s)'],
                  ['← →', 'nudge 1s (Shift: 5s)'],
                  ['Delete', 'remove the selected scene'],
                  ['Ctrl/Cmd+Z', 'undo'],
                  ['Ctrl/Cmd+Shift+Z', 'redo'],
                  ['?', 'this overlay'],
                ] as [string, string][]
              ).map(([key, what]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <kbd className="rounded border border-bone/20 bg-bone/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-brass">
                    {key}
                  </kbd>
                  <span className="flex-1 text-right text-bone/55">{what}</span>
                </div>
              ))}
            </dl>
            <p className="mt-3 border-t border-bone/10 pt-2 text-[9px] text-bone/30">
              drag scenes to reorder · drag edges to trim · drag the ruler or playhead to scrub
            </p>
          </div>
        </div>
      )}
      {publishOpen && previewSrc && project && (
        <PublishSheet
          name={project.name}
          videoUrl={project.composedUrl || previewSrc}
          transcript={Object.values(project.captions ?? {})
            .flat()
            .map((w) => w.word)
            .join(' ')}
          onClose={() => setPublishOpen(false)}
          renderJob={renderJob}
          initialBrand={postTarget.brand}
          initialPlatform={postTarget.type}
          copy={copyPool ?? undefined}
          onCopyChange={setCopyPool}
          onSchedule={(brand, typeId) => {
            setPostTarget({ brand, type: typeId });
            setSchedOpen(true);
          }}
          captionWords={project.clips.flatMap((c, i) =>
            (project.captions[c.id] ?? []).map((w) => ({
              ...w,
              start: w.start + timelineStartOf(project.clips, i),
              end: w.end + timelineStartOf(project.clips, i),
            })),
          )}
          captionPreset={project.captionStyle}
          captionOverrides={project.captionOverrides}
        />
      )}
      {/* R13: the ONE Schedule sheet — current reel (renders first) or a Scoreboard variant */}
      {schedOpen && project && (
        <ScheduleSheet
          name={project.name}
          videoUrl={project.composedUrl || null}
          brand={postTarget.brand}
          typeId={postTarget.type}
          targetLabel={targetTypeLabel(postTarget)}
          durationSec={total}
          aspect={targetAspect(postTarget)}
          onRender={renderCurrent}
          onDone={(msg) => {
            setNote(msg);
            setSchedOpen(false);
          }}
          onClose={() => setSchedOpen(false)}
        />
      )}
      {schedRow && (
        <ScheduleSheet
          name={schedRow.projectName}
          videoUrl={schedRow.variant.composedUrl || null}
          variantId={schedRow.variant.id}
          brand={postTarget.brand}
          typeId={postTarget.type}
          targetLabel={targetTypeLabel(postTarget)}
          durationSec={total}
          aspect={targetAspect(postTarget)}
          onDone={(msg) => {
            setNote(msg);
            setSchedRow(null);
          }}
          onClose={() => setSchedRow(null)}
        />
      )}
      {/* Thumbnail Lab — a Scoreboard variant or the current reel */}
      {thumbLabRow && (
        <ThumbnailLabSheet
          hook={thumbLabRow.projectName}
          frameUrl={thumbLabRow.variant.composedUrl}
          onSaved={(url) => {
            setThumbByVariant((m) => ({ ...m, [thumbLabRow.variant.id]: url }));
            setNote(`Thumbnail exported to the library and attached to "${thumbLabRow.projectName}".`);
            setThumbLabRow(null);
          }}
          onClose={() => setThumbLabRow(null)}
        />
      )}
      {thumbLabReel && project && (
        <ThumbnailLabSheet
          hook={project.name}
          frameUrl={project.composedUrl || previewSrc}
          onSaved={() => {
            setNote(`Thumbnail exported to the library for "${project.name}".`);
            setThumbLabReel(false);
          }}
          onClose={() => setThumbLabReel(false)}
        />
      )}
      {/* R14 bulk schedule sheet — opens when the user hits "bulk schedule" */}
      {bulkOpen && bulkSelected.size > 0 && loopRows && (
        <BulkScheduleSheet
          rows={loopRows.filter((r) => bulkSelected.has(r.variant.id))}
          onDone={(msg) => {
            setNote(msg);
            setBulkOpen(false);
            setBulkMode(false);
            setBulkSelected(new Set());
            void loadLoop(); // refresh schedule chips after the batch lands
          }}
          onClose={() => setBulkOpen(false)}
        />
      )}
      {/* The canvas right-click word menu (Preview mode — Edit mode's
          WordDragLayer owns right-click there). Free-place / Remove placement /
          Behind the subject + the full per-word style editor. */}
      <CaptionWordContextMenu project={project} edit={captionEdit} />
    </div>
  );
}



