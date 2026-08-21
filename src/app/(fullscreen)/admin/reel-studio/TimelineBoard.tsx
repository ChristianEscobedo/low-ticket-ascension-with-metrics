'use client';

/**
 * TimelineBoard — the RVE-style timeline.
 *
 * The old strip was a single row of scene blocks with the captions/media lanes
 * bolted on below and no per-track identity. This rebuilds it the way
 * react-video-editor's timeline reads:
 *
 *   transport bar  — play/pause + timecode, on top
 *   ruler          — the scrub surface (unchanged behavior)
 *   lanes          — one ROW per type, each with a LEFT label gutter (icon +
 *                    name) and a track of colored blocks. Video scenes are the
 *                    filmstrip; captions / media / overlay / audio get their
 *                    own tinted blocks.
 *
 * Every block keeps the SAME handlers the old strip used (drag to reorder,
 * drag an edge to trim, click to select) — only the layout + look changed.
 * Pure presentational; the page owns all state.
 */
import React, { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Film,
  MessageSquareText,
  Image as ImageIcon,
  Layers,
  Music,
  Sticker,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  ReelClip,
  ReelMediaCue,
  ReelOverlayClip,
  ReelAudioTrack,
  ReelWord,
  ReelTransition,
  ReelTransitionType,
} from '@/lib/mothermode/reel/types';
import { effectiveClipDuration, reelDurationSec } from '@/lib/mothermode/reel/timeline';
import { REEL_TRANSITIONS } from '@/lib/mothermode/reel/types';
import { spriteCellStyle } from '@/lib/mothermode/reel/sceneCuts';
import { peaksFor } from '@/lib/mothermode/reel/waveform';

/** R4: the 4-frame sprite tile URL for a clip — ONE request instead of four. */
function spriteUrl(url: string, durSec: number, frames = 4): string {
  return `/api/admin/reel-sprite?url=${encodeURIComponent(url)}&dur=${Math.max(0.3, durSec).toFixed(1)}&frames=${frames}`;
}

/** A single filmstrip frame (server thumb; degrades to a soft gradient cell). */
function StripFrame({ url, t, className }: { url: string; t: number; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return <div className={clsx('bg-gradient-to-br from-white/[0.07] to-white/[0.02]', className)} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/admin/reel-thumbnail?url=${encodeURIComponent(url)}&t=${Math.max(0, t).toFixed(1)}`}
      alt=""
      loading="lazy"
      draggable={false}
      onError={() => setBroken(true)}
      className={className}
    />
  );
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
          <StripFrame key={k} url={url} t={t} className={className} />
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

/** R14 waveform: canvas bars behind the audio bed block (peaks cached client-side). */
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
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
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

const TRANSITION_GLYPH: Record<ReelTransitionType, string> = {
  crossfade: '◐',
  whip: '≫',
  zoom: '◎',
};

function pct(t: number, total: number): number {
  return Math.min(100, Math.max(0, (t / Math.max(total, 0.001)) * 100));
}

/** A clip's start on the shared timeline (sum of the effective durations before it). */
function clipStartAt(clips: ReelClip[], index: number): number {
  let t = 0;
  for (let i = 0; i < index && i < clips.length; i += 1) {
    t += effectiveClipDuration(clips[i]);
  }
  return t;
}

/** One lane row: a label gutter on the left, the track on the right.
 *  The gutter's chevron folds the lane to a thin strip (RVE/Premiere lane
 *  collapse — per-element lanes need it to keep the board short). */
function Lane({
  label,
  icon,
  tint,
  height = 'h-9',
  gutterExtra,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  /** Border + bg tint classes for the track. */
  tint: string;
  height?: string;
  /** Extra controls in the gutter (e.g. the captions lane's canvas eye). */
  gutterExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex items-stretch gap-1 border-b border-white/[0.05] py-1">
      {/* the gutter: a faint tinted chip carries the lane's identity — the
          TRACK stays bare (RVE-style: only the BLOCKS are colored, and a block
          spans just its own time range, never the whole row) */}
      <div className={clsx('flex w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md py-1', tint)}>
        {icon}
        <span className="text-[7px] font-bold uppercase tracking-wide text-bone/40">{label}</span>
        <span className="flex items-center gap-0.5">
          {gutterExtra}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-bone/30 hover:text-bone/70"
            title={open ? 'Collapse this lane' : 'Expand this lane'}
          >
            {open ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
          </button>
        </span>
      </div>
      {open ? (
        <div className={clsx('relative min-w-0 flex-1', height)}>
          {children}
        </div>
      ) : (
        <div className="h-1.5 min-w-0 flex-1 self-center rounded-full bg-bone/[0.07]" />
      )}
    </div>
  );
}

/** A draggable + edge-trimmable block. Shared by every lane's blocks. */
function Block({
  fromPct,
  widthPct,
  tint,
  selected,
  title,
  onSelect,
  onDragMove,
  onDragEnd,
  onTrimLeft,
  onTrimRight,
  children,
}: {
  fromPct: number;
  widthPct: number;
  /** bg + border classes. */
  tint: string;
  selected?: boolean;
  title: string;
  onSelect?: () => void;
  /** Drag the whole block in time (delta seconds). */
  onDragMove?: (deltaSec: number) => void;
  /** Pointer-up after any drag (move or trim) — e.g. re-sync the audio bed. */
  onDragEnd?: () => void;
  /** Trim the left edge (delta seconds, + = later start). */
  onTrimLeft?: (deltaSec: number) => void;
  /** Trim the right edge (delta seconds, + = longer). */
  onTrimRight?: (deltaSec: number) => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function drag(e: React.PointerEvent, apply: (deltaSec: number) => void) {
    e.stopPropagation();
    e.preventDefault();
    const el = ref.current;
    const track = el?.parentElement;
    if (!el || !track) return;
    const rect = track.getBoundingClientRect();
    const startX = e.clientX;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const deltaPct = ((ev.clientX - startX) / Math.max(rect.width, 1)) * 100;
      apply(deltaPct);
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      onDragEnd?.();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  }

  return (
    <div
      ref={ref}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
      onPointerDown={onDragMove ? (e) => drag(e, onDragMove) : undefined}
      className={clsx(
        'group absolute top-0 flex h-full items-center overflow-hidden rounded-md border px-1',
        onDragMove && 'cursor-grab active:cursor-grabbing',
        tint,
        selected && 'z-10 ring-2 ring-brass',
      )}
      style={{ left: `${fromPct}%`, width: `${Math.max(1.5, widthPct)}%`, minWidth: 26 }}
      title={title}
    >
      {onTrimLeft && (
        <span
          onPointerDown={(e) => drag(e, onTrimLeft)}
          className="absolute left-0 top-0 z-20 flex h-full w-3 cursor-ew-resize items-center justify-center border-l-2 border-transparent opacity-0 transition-opacity hover:border-brass hover:bg-brass/30 group-hover:opacity-100"
          title="Drag to trim the start"
        >
          <span className="h-3.5 w-1 rounded-full bg-brass shadow" />
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {onTrimRight && (
        <span
          onPointerDown={(e) => drag(e, onTrimRight)}
          className="absolute right-0 top-0 z-20 flex h-full w-3 cursor-ew-resize items-center justify-center border-r-2 border-transparent opacity-0 transition-opacity hover:border-brass hover:bg-brass/30 group-hover:opacity-100"
          title="Drag to trim the end"
        >
          <span className="h-3.5 w-1 rounded-full bg-brass shadow" />
        </span>
      )}
    </div>
  );
}

export default function TimelineBoard({
  clips,
  captions,
  mediaCues,
  overlays,
  audio,
  total,
  selectedId,
  onSelect,
  onTrim,
  onReorder,
  onScrub,
  onScrubIn,
  onLeftTrim,
  onKeyMove,
  onTransition,
  onOverlayMove,
  onOverlayRemove,
  onAudioMove,
  onAudioRemove,
  onSeek,
  onAudioMoveEnd,
  playheadSec,
  onCueHold,
  onOverlayTrim,
  ccOn,
  onToggleCc,
}: {
  clips: ReelClip[];
  captions: Record<string, ReelWord[]>;
  mediaCues: ReelMediaCue[];
  overlays: ReelOverlayClip[];
  audio: ReelAudioTrack | null;
  total: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onTrim: (id: string, trimEndSec: number) => void;
  onReorder: (id: string, toIndex: number) => void;
  onScrub: (clip: ReelClip, trimEndSec: number) => void;
  onScrubIn: (clip: ReelClip, inSec: number) => void;
  onLeftTrim: (clip: ReelClip, inSec: number) => void;
  onKeyMove: (clip: ReelClip, keyIndex: number, tSec: number) => void;
  onTransition: (id: string, transitionIn: ReelTransition | null) => void;
  onOverlayMove: (id: string, offsetSec: number) => void;
  onOverlayRemove: (id: string) => void;
  onAudioMove: (offsetSec: number) => void;
  onAudioRemove: () => void;
  /** Click a caption/media block: seek the playhead to its start. */
  onSeek: (tSec: number) => void;
  /** Pointer-up after dragging the audio bed — re-sync the audio element. */
  onAudioMoveEnd?: () => void;
  /** The studio playhead — a snap target for block drags. */
  playheadSec?: number;
  /** A cue's right-edge drag commits a new holdSec (on release, not per move —
   *  the persist path POSTs, so a per-move commit would hammer the API). */
  onCueHold?: (id: string, holdSec: number) => void;
  /** An overlay's right-edge drag trims its tail (local state — safe per move). */
  onOverlayTrim?: (id: string, trimEndSec: number) => void;
  /** The captions lane's eye: is the caption layer showing on the canvas. */
  ccOn?: boolean;
  onToggleCc?: () => void;
}) {
  if (total <= 0) return null;
  const dragIndex = useRef<number | null>(null);
  const [liveTrim, setLiveTrim] = useState<{ id: string; trim: number } | null>(null);
  const [liveHold, setLiveHold] = useState<{ id: string; hold: number } | null>(null);
  // Ref mirror — the drag's pointerup closure comes from the pointerdown
  // render (liveHold was null then), so reading the STATE in onDragEnd never
  // saw the drag's value and the hold commit never fired. The ref is live.
  const liveHoldRef = useRef<{ id: string; hold: number } | null>(null);
  liveHoldRef.current = liveHold;

  // Snap targets for block drags: 0, every scene boundary, the end, the playhead
  // (the same magnet the ruler has — a drag near an edge lands ON it).
  const snapTargets = [
    0,
    ...clips.map((_, i) => clipStartAt(clips, i)),
    total,
    ...(typeof playheadSec === 'number' && Number.isFinite(playheadSec) ? [playheadSec] : []),
  ];
  function snapSec(t: number): number {
    const threshold = Math.max(0.08, total * 0.008);
    let best = t;
    let bestD = threshold;
    for (const s of snapTargets) {
      const d = Math.abs(t - s);
      if (d <= bestD) {
        best = s;
        bestD = d;
      }
    }
    return best;
  }

  // ---- captions + media blocks (same math the old TimelineLanes used) ------
  const captionBlocks = clips
    .map((c, i) => {
      const words = captions[c.id] ?? [];
      if (words.length === 0) return null;
      const start = clipStartAt(clips, i);
      const trimStart = c.trimStartSec ?? 0;
      const first = Math.max(0, words[0].start - trimStart);
      const last = Math.max(first + 0.1, words[words.length - 1].end - trimStart);
      // RVE shows the caption's TEXT on the block — the first words.
      const preview = words
        .slice(0, 5)
        .map((x) => x.word)
        .join(' ');
      return { id: c.id, name: c.name, from: start + first, to: start + last, count: words.length, preview };
    })
    .filter((b): b is NonNullable<typeof b> => b != null);

  const mediaBlocks = mediaCues
    .map((cue) => {
      const clipIdx = clips.findIndex((c) => c.id === cue.clipId);
      if (clipIdx < 0) return null;
      const w = (captions[cue.clipId] ?? [])[cue.wordIndex];
      if (!w) return null;
      const start = clipStartAt(clips, clipIdx);
      const trimStart = clips[clipIdx].trimStartSec ?? 0;
      const from = start + Math.max(0, w.start - trimStart);
      const wordTo = start + Math.max(0.1, w.end - trimStart);
      const hold = cue.holdSec ?? 1.0;
      const kind = cue.lottie ? 'lottie' : cue.animated ? 'sticker' : 'image';
      // The block shows the media's own thumbnail + filename (RVE-style) —
      // the trigger word moves to the tooltip.
      const name = cue.url.split('/').pop()?.split('?')[0]?.slice(0, 40) || kind;
      return { id: cue.id, from, wordTo, hold, kind, label: w.word, url: cue.url, name };
    })
    .filter((b): b is NonNullable<typeof b> => b != null);

  return (
    <div className="select-none">
      {/* VIDEO lane — the filmstrip scenes, drag to reorder + edge-trim. */}
      <Lane
        label="video"
        icon={<Film className="h-3 w-3 text-brass/80" />}
        tint="border-bone/15 bg-ink/50"
        height="h-20"
      >
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
                'group absolute top-0 h-full cursor-pointer overflow-hidden rounded-md border shadow-sm transition-colors',
                selected
                  ? 'z-10 border-brass bg-brass/25 ring-2 ring-brass shadow-[0_0_16px_rgba(168,139,92,0.4)]'
                  : 'border-white/10 bg-neutral-900/60 hover:border-white/25',
              )}
              style={{ left: `${pct(clipStartAt(clips, i), total)}%`, width: `${Math.max(2, pct(eff, total))}%` }}
              title={`${c.name} — ${shownDur.toFixed(1)}s`}
            >
              {/* transition seam picker (the top-left dot) */}
              {i > 0 && (
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
                    if (idx < 0 || idx === REEL_TRANSITIONS.length - 1) onTransition(c.id, null);
                    else onTransition(c.id, { ...c.transitionIn, type: REEL_TRANSITIONS[idx + 1] });
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
                    'absolute left-0.5 top-0.5 z-40 flex h-4 w-4 items-center justify-center rounded-full border text-[8px] font-bold leading-none',
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
              {/* the filmstrip — 4 sprite frames fill the block (the look the old
                  TimelineStrip had; selection is a brass WASH so frames show through) */}
              <div className="pointer-events-none flex h-full w-full opacity-90 transition-opacity duration-150 group-hover:opacity-100">
                <SpriteStrip url={c.url} durSec={c.durationSec} className="h-full w-1/4 object-cover" />
              </div>
              {/* keyframe diamonds */}
              {c.motion && c.motion.length >= 2 &&
                c.motion.map((k, ki) => (
                  <span
                    key={ki}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      const el = e.currentTarget as HTMLElement;
                      const block = el.parentElement as HTMLElement;
                      const startX = e.clientX;
                      const startT = k.t;
                      el.setPointerCapture(e.pointerId);
                      const move = (ev: PointerEvent) => {
                        const pps = block.getBoundingClientRect().width / Math.max(eff, 0.01);
                        const t = Math.round(Math.max(0, Math.min(startT + (ev.clientX - startX) / pps, eff)) * 100) / 100;
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
                      'absolute top-0.5 z-20 flex h-4 w-4 -translate-x-1/2 cursor-ew-resize items-center justify-center text-[10px] font-bold leading-none drop-shadow hover:scale-125',
                      selected ? 'text-ink' : 'text-brass',
                    )}
                    style={{ left: `${Math.min(97, (k.t / Math.max(eff, 0.01)) * 100)}%` }}
                    title={`key @ ${k.t.toFixed(2)}s — drag to re-time`}
                  >
                    ◆
                  </span>
                ))}
              {/* name + duration chips */}
              <div className="pointer-events-none absolute bottom-1 left-1 flex max-w-[70%] items-center gap-1 rounded bg-black/75 px-1 py-0.5">
                <span className="text-[8px] font-bold text-brass">{i + 1}</span>
                <span className="truncate text-[8px] text-white/85">{c.name}</span>
              </div>
              <span className={clsx(
                'pointer-events-none absolute bottom-1 right-1 rounded px-1 py-0.5 text-[8px] font-semibold',
                live != null && live > 0 ? 'bg-brass text-ink' : 'bg-black/75 text-white/60',
              )}>
                {shownDur.toFixed(1)}s
              </span>
              {/* left in-point handle */}
              <span
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const el = e.currentTarget as HTMLElement;
                  const block = el.parentElement as HTMLElement;
                  const pps = block.getBoundingClientRect().width / eff;
                  const startX = e.clientX;
                  let inSec = 0;
                  el.setPointerCapture(e.pointerId);
                  const move = (ev: PointerEvent) => {
                    inSec = Math.round(Math.max(0, Math.min((ev.clientX - startX) / pps, c.durationSec - 0.5)) * 10) / 10;
                    onScrubIn(c, inSec);
                  };
                  const up = () => {
                    el.removeEventListener('pointermove', move);
                    el.removeEventListener('pointerup', up);
                    if (inSec > 0.05) onLeftTrim(c, inSec);
                  };
                  el.addEventListener('pointermove', move);
                  el.addEventListener('pointerup', up);
                }}
                className="absolute left-0 top-0 z-20 flex h-full w-3 cursor-ew-resize items-center justify-center border-l-2 border-transparent opacity-0 transition-opacity hover:border-brass hover:bg-brass/30 group-hover:opacity-100"
                title="Drag to cut the head"
              >
                <span className="h-4 w-1 rounded-full bg-brass shadow" />
              </span>
              {/* right trim handle */}
              <span
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const el = e.currentTarget as HTMLElement;
                  const block = el.parentElement as HTMLElement;
                  const pps = block.getBoundingClientRect().width / eff;
                  const startX = e.clientX;
                  const startTrim = c.trimEndSec;
                  let trim = startTrim;
                  el.setPointerCapture(e.pointerId);
                  const move = (ev: PointerEvent) => {
                    trim = Math.round(Math.max(0, Math.min(startTrim - (ev.clientX - startX) / pps, c.durationSec - 0.1)) * 10) / 10;
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
                className="absolute right-0 top-0 z-20 flex h-full w-3 cursor-ew-resize items-center justify-center border-r-2 border-transparent opacity-0 transition-opacity hover:border-brass hover:bg-brass/30 group-hover:opacity-100"
                title="Drag to cut the tail"
              >
                <span className="h-4 w-1 rounded-full bg-brass shadow" />
              </span>
            </div>
          );
        })}
      </Lane>

      {/* CAPTIONS lane */}
      {captionBlocks.length > 0 && (
        <Lane
          label="captions"
          icon={<MessageSquareText className="h-3 w-3 text-sky-300/80" />}
          tint="border-sky-400/25 bg-sky-400/[0.05]"
          gutterExtra={
            onToggleCc ? (
              <button
                type="button"
                onClick={onToggleCc}
                className="text-bone/30 hover:text-bone/70"
                title={ccOn ? 'Hide captions on the canvas' : 'Show captions on the canvas'}
              >
                {ccOn ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
              </button>
            ) : undefined
          }
        >
          {captionBlocks.map((b) => (
            <Block
              key={b.id}
              fromPct={pct(b.from, total)}
              widthPct={pct(b.to, total) - pct(b.from, total)}
              tint="border-sky-300/50 bg-sky-500/60 hover:bg-sky-500/75"
              title={`${b.name} — ${b.count} words (click to seek)`}
              onSelect={() => onSeek(b.from)}
            >
              <span className="flex items-center gap-1 text-[8px] font-medium text-sky-100">
                <MessageSquareText className="h-2.5 w-2.5 shrink-0 text-sky-200" />
                <span className="truncate">{b.preview}</span>
                <span className="shrink-0 text-sky-200/60">{b.count}w</span>
              </span>
            </Block>
          ))}
        </Lane>
      )}

      {/* MEDIA lanes — ONE ROW PER FLY-IN (two cues can overlap in time, so a
          shared lane would stack them). Click seeks; the right edge drags the
          hold (how long it stays after its word) and commits on release. */}
      {mediaBlocks.map((b, bi) => {
        const Icon = b.kind === 'lottie' ? Sparkles : b.kind === 'sticker' ? Sticker : ImageIcon;
        const live = liveHold?.id === b.id ? liveHold.hold : null;
        const to = b.wordTo + (live ?? b.hold);
        return (
          <Lane
            key={b.id}
            label={`media ${bi + 1}`}
            icon={<Icon className="h-3 w-3 text-fuchsia-300/80" />}
            tint="border-fuchsia-400/25 bg-fuchsia-400/[0.05]"
          >
            <Block
              fromPct={pct(b.from, total)}
              widthPct={pct(to, total) - pct(b.from, total)}
              tint="border-fuchsia-300/50 bg-fuchsia-500/60 hover:bg-fuchsia-500/75"
              title={`${b.name} — ${b.kind} fly-in on "${b.label}" — click to seek · right edge = hold`}
              onSelect={() => onSeek(b.from)}
              onTrimRight={
                onCueHold
                  ? (deltaPct) => {
                      const deltaSec = (deltaPct / 100) * total;
                      const hold = Math.round(Math.max(0.3, Math.min(6, b.hold + deltaSec)) * 10) / 10;
                      setLiveHold({ id: b.id, hold });
                    }
                  : undefined
              }
              onDragEnd={() => {
                const held = liveHoldRef.current;
                if (held?.id === b.id && onCueHold) onCueHold(b.id, held.hold);
                setLiveHold(null);
              }}
            >
              <span className="flex items-center gap-1 text-[8px] font-medium text-fuchsia-100">
                {b.kind === 'lottie' ? (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-fuchsia-400/30">
                    <Icon className="h-2.5 w-2.5 text-fuchsia-200" />
                  </span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={b.url}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    className="h-5 w-5 shrink-0 rounded object-cover"
                  />
                )}
                <span className="truncate">{b.name}</span>
                {live != null && (
                  <span className="shrink-0 rounded bg-fuchsia-400/40 px-0.5 font-bold">{live.toFixed(1)}s</span>
                )}
              </span>
            </Block>
          </Lane>
        );
      })}

      {/* OVERLAY (b-roll) lanes — ONE ROW PER LAYER (layers overlap in time).
          Drag moves (snaps to scene edges + the playhead), right edge trims
          the tail, click seeks, × removes. */}
      {overlays.map((o, oi) => {
        const eff = effectiveClipDuration(o);
        return (
          <Lane
            key={o.id}
            label={`overlay ${oi + 1}`}
            icon={<Layers className="h-3 w-3 text-violet-300/80" />}
            tint="border-violet-500/25 bg-violet-500/[0.06]"
          >
            <Block
              fromPct={Math.min(98, pct(o.offsetSec, total))}
              widthPct={Math.max(2, pct(eff, total))}
              tint="border-violet-300/50 bg-violet-500/65"
              title={`${o.name} — overlay @ ${o.offsetSec.toFixed(1)}s · drag to move (snaps) · right edge trims · click seeks`}
              onSelect={() => onSeek(o.offsetSec)}
              onDragMove={(deltaPct) => {
                const deltaSec = (deltaPct / 100) * total;
                const next = Math.max(0, Math.min(o.offsetSec + deltaSec, total - 0.1));
                onOverlayMove(o.id, Math.round(snapSec(next) * 10) / 10);
              }}
              onTrimRight={
                onOverlayTrim
                  ? (deltaPct) => {
                      const deltaSec = (deltaPct / 100) * total;
                      const trim = Math.round(
                        Math.max(0, Math.min(o.trimEndSec - deltaSec, o.durationSec - 0.1)) * 10,
                      ) / 10;
                      onOverlayTrim(o.id, trim);
                    }
                  : undefined
              }
            >
              <span className="flex items-center gap-1 text-[8px] font-medium text-violet-100">
                {/\.(jpe?g|png|webp|gif)(\?|$)/i.test(o.url) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={o.url}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    className="h-5 w-5 shrink-0 rounded object-cover"
                  />
                ) : (
                  <span className="h-5 w-5 shrink-0 overflow-hidden rounded">
                    <StripFrame url={o.url} t={0.5} className="h-full w-full object-cover" />
                  </span>
                )}
                <span className="truncate">{o.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOverlayRemove(o.id);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="ml-auto shrink-0 text-violet-200/60 hover:text-red-300"
                  title="Remove this layer"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </span>
            </Block>
          </Lane>
        );
      })}

      {/* AUDIO lane — drag to re-time, × to remove. */}
      {audio && (
        <Lane
          label="audio"
          icon={<Music className="h-3 w-3 text-brass/80" />}
          tint="border-brass/30 bg-brass/[0.06]"
        >
          <Block
            fromPct={pct(audio.offsetSec, total)}
            widthPct={Math.max(3, pct(Math.min(total - audio.offsetSec, audio.durationSec ?? total - audio.offsetSec), total))}
            tint="border-brass/60 bg-brass/70"
            title={`${audio.name} — drag to move the audio bed`}
            onDragMove={(deltaPct) => {
              const deltaSec = (deltaPct / 100) * total;
              const next = Math.max(0, Math.min(audio.offsetSec + deltaSec, total - 0.1));
              onAudioMove(Math.round(snapSec(next) * 10) / 10);
            }}
            onDragEnd={onAudioMoveEnd}
          >
            {/* the waveform rides INSIDE the block (RVE-style: the block spans
                the bed's own time range, peaks in white on the brass fill) */}
            <WaveformLane url={audio.url} />
            <span className="relative z-10 flex items-center gap-1 text-[8px] font-semibold text-ink">
              <Music className="h-2.5 w-2.5 shrink-0" />
              {audio.name}
              <span className="shrink-0 text-ink/70">@{audio.offsetSec.toFixed(1)}s</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAudioRemove();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="ml-auto shrink-0 text-ink/50 hover:text-red-700"
                title="Remove the audio bed"
              >
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            </span>
          </Block>
        </Lane>
      )}
    </div>
  );
}
