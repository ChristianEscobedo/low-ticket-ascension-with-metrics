'use client';

/**
 * TimelineLanes — the per-type rows under the video strip.
 *
 * The timeline used to show ONLY the video clips (plus an overlay lane and an
 * audio lane when those existed). Captions and media cues (image / GIF sticker
 * / Lottie fly-ins) had NO row — you couldn't see where a sticker or a caption
 * landed in time without opening a side panel. This adds the two missing rows:
 *
 *   captions  — one block per transcribed clip, spanning its spoken words
 *   media     — one block per cue, spanning its trigger word + the hold
 *
 * Every block is a seek target: click it and the playhead jumps to its start.
 * Pure presentational + an onSeek callback — the page owns all state.
 */
import React from 'react';
import { clsx } from 'clsx';
import { MessageSquareText, Image as ImageIcon, Sticker, Sparkles } from 'lucide-react';
import type { ReelClip, ReelMediaCue, ReelWord } from '@/lib/mothermode/reel/types';
import { effectiveClipDuration } from '@/lib/mothermode/reel/timeline';

/** A clip's start on the shared timeline (sum of the effective durations before it). */
function clipStartAt(clips: ReelClip[], index: number): number {
  let t = 0;
  for (let i = 0; i < index && i < clips.length; i += 1) {
    t += effectiveClipDuration(clips[i]);
  }
  return t;
}

function pct(t: number, total: number): number {
  return Math.min(100, Math.max(0, (t / Math.max(total, 0.001)) * 100));
}

/**
 * One lane row: a FULL-WIDTH track with the label as a chip in its top-left.
 *
 * THE ALIGNMENT FIX. This used to be a `w-16` label gutter + a `flex-1` track.
 * The gutter pushed the track right by 4rem+gap, but the video strip and the
 * playhead above span the FULL container width — so a block at `left: 30%` of
 * the track sat at a different time than the video frame at 30% of the strip.
 * The lane blocks looked "started into the main video" and the timing read
 * "way off". Matching the overlay/audio lanes (full-width track, no gutter)
 * puts every lane on the SAME 0→100% time axis as the filmstrip + playhead.
 */
function Lane({
  label,
  icon,
  tint,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  /** Border + bg tint classes for the track. */
  tint: string;
  children: React.ReactNode;
}) {
  return (
    <div className={clsx('relative mt-1.5 h-8 overflow-hidden rounded-md border', tint)}>
      {/* label chip — non-interactive, sits over the track's left edge */}
      <div className="pointer-events-none absolute left-1 top-1/2 z-10 flex -translate-y-1/2 items-center gap-1 rounded bg-ink/70 px-1 py-0.5">
        {icon}
        <span className="text-[7px] font-bold uppercase tracking-wide text-bone/50">{label}</span>
      </div>
      {children}
    </div>
  );
}


export default function TimelineLanes({
  clips,
  captions,
  mediaCues,
  total,
  onSeek,
}: {
  clips: ReelClip[];
  /** clipId → its Whisper words (project.captions). */
  captions: Record<string, ReelWord[]>;
  mediaCues: ReelMediaCue[];
  total: number;
  /** Seek the shared playhead to a timeline-second. */
  onSeek: (timelineSec: number) => void;
}) {
  if (total <= 0) return null;

  // ---- captions lane: one block per clip that has words -------------------
  const captionBlocks = clips
    .map((c, i) => {
      const words = captions[c.id] ?? [];
      if (words.length === 0) return null;
      const start = clipStartAt(clips, i);
      const trimStart = c.trimStartSec ?? 0;
      const first = Math.max(0, words[0].start - trimStart);
      const lastWord = words[words.length - 1];
      const last = Math.max(first + 0.1, lastWord.end - trimStart);
      return { id: c.id, name: c.name, from: start + first, to: start + last, count: words.length };
    })
    .filter((b): b is NonNullable<typeof b> => b != null);

  // ---- media lane: one block per cue (image / GIF sticker / Lottie) --------
  const mediaBlocks = mediaCues
    .map((cue) => {
      const clipIdx = clips.findIndex((c) => c.id === cue.clipId);
      if (clipIdx < 0) return null;
      const words = captions[cue.clipId] ?? [];
      const w = words[cue.wordIndex];
      if (!w) return null;
      const start = clipStartAt(clips, clipIdx);
      const trimStart = clips[clipIdx].trimStartSec ?? 0;
      const from = start + Math.max(0, w.start - trimStart);
      const to = start + Math.max(0.1, w.end - trimStart) + (cue.holdSec ?? 1.0);
      const kind = cue.lottie ? 'lottie' : cue.animated ? 'sticker' : 'image';
      const label = w.word;
      return { id: cue.id, from, to, kind, label };
    })
    .filter((b): b is NonNullable<typeof b> => b != null);

  if (captionBlocks.length === 0 && mediaBlocks.length === 0) return null;

  return (
    <div className="select-none">
      {captionBlocks.length > 0 && (
        <Lane
          label="captions"
          icon={<MessageSquareText className="h-3 w-3 text-sky-300/80" />}
          tint="border-sky-400/25 bg-sky-400/[0.05]"
        >
          {captionBlocks.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => onSeek(b.from + 0.01)}
              title={`${b.name} — ${b.count} words (click to seek)`}
              className="absolute top-0 flex h-full items-center gap-1 overflow-hidden rounded-sm border border-sky-400/40 bg-sky-400/20 px-1 hover:bg-sky-400/35"
              style={{ left: `${pct(b.from, total)}%`, width: `${Math.max(1.5, pct(b.to, total) - pct(b.from, total))}%` }}
            >
              <MessageSquareText className="h-2.5 w-2.5 shrink-0 text-sky-200" />
              <span className="min-w-0 flex-1 truncate text-[8px] font-medium text-sky-100">
                {b.count}w
              </span>
            </button>
          ))}
        </Lane>
      )}

      {mediaBlocks.length > 0 && (
        <Lane
          label="media"
          icon={<ImageIcon className="h-3 w-3 text-fuchsia-300/80" />}
          tint="border-fuchsia-400/25 bg-fuchsia-400/[0.05]"
        >
          {mediaBlocks.map((b) => {
            const Icon = b.kind === 'lottie' ? Sparkles : b.kind === 'sticker' ? Sticker : ImageIcon;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => onSeek(b.from + 0.01)}
                title={`${b.kind} fly-in on "${b.label}" (click to seek)`}
                className="absolute top-0 flex h-full items-center gap-1 overflow-hidden rounded-sm border border-fuchsia-400/40 bg-fuchsia-400/20 px-1 hover:bg-fuchsia-400/35"
                style={{ left: `${pct(b.from, total)}%`, width: `${Math.max(1.5, pct(b.to, total) - pct(b.from, total))}%` }}
              >
                <Icon className="h-2.5 w-2.5 shrink-0 text-fuchsia-200" />
                <span className="min-w-0 flex-1 truncate text-[8px] font-medium text-fuchsia-100">
                  {b.label}
                </span>
              </button>
            );
          })}
        </Lane>
      )}
    </div>
  );
}
