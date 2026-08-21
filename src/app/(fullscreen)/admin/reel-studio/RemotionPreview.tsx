'use client';

/**
 * RemotionPreview — the SINGLE source of truth for what the final MP4 looks like.
 *
 * It renders the EXACT same <ReelComposition> the Remotion Lambda renderer uses,
 * fed by the SAME buildRenderPlan(project) call. Preview === render, by
 * construction — no separate canvas preview that drifts from the export (the
 * "fal doesn't respect the preview" failure mode this replaces).
 *
 * Both @remotion/player and the composition are browser-only, so they're loaded
 * with next/dynamic ssr:false.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Player, type PlayerRef } from '@remotion/player';
import { buildRenderPlan, DEFAULT_FPS, RENDER_SIZES } from '@/lib/mothermode/reel/render/plan';
import { planRebuildWaitMs } from '@/lib/mothermode/reel/previewThrottle';
import type { ReelProject } from '@/lib/mothermode/reel/types';

// The composition is browser-only (imports `remotion`); never SSR it.
const ReelComposition = dynamic(
  () => import('../../../../../remotion-project/ReelComposition').then((m) => m.ReelComposition),
  { ssr: false },
);

/**
 * The Player swallows component errors into a black frame with only a console
 * line — which is exactly how "the video doesn't mount" stayed invisible. This
 * boundary catches a crash in ReelComposition (a bad caption mark, a font that
 * throws, a clip the plan mis-shapes) and SHOWS it on the stage instead of a
 * silent black box.
 */
class PreviewErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface the real stack — this is the audit trail the black box hid.
    console.error('[RemotionPreview] composition crashed:', error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-black p-4 text-center">
          <p className="text-[11px] font-semibold text-red-300">Preview crashed</p>
          <p className="max-w-[260px] break-words text-[10px] leading-relaxed text-white/50">
            {this.state.error.message}
          </p>
          <p className="text-[9px] text-white/30">
            The full stack is in the console — this is the error the black frame was hiding.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function RemotionPreview({
  freePlaceEdit = false,
  showAllWords = false,
  project,
  aspect = 'vertical',
  fps = DEFAULT_FPS,
  playheadSec,
  onFrameSec,
  scrubbing = false,
}: {
  project: Pick<
    ReelProject,
    'clips' | 'audio' | 'captions' | 'captionStyle' | 'captionOverrides' | 'overlays'
  >;
  aspect?: keyof typeof RENDER_SIZES;
  fps?: number;
  /**
   * The studio timeline's playhead, in seconds. Omit for a standalone player.
   *
   * Without this the Player is an ISLAND: it was mounted with `controls` and
   * nothing else, so it owned a private clock the editor could not reach.
   * Dragging the timeline moved `previewTime` state — which is what the caption
   * overlay reads — while the Player kept showing whatever frame it was already
   * on. That's the "captions move but the video doesn't" split: two clocks, one
   * of them invisible to the ruler.
   */
  playheadSec?: number;
  /**
   * The Player's frame written BACK to the studio clock (seconds). The Player
   * has its own transport (controls), so without this it free-runs while it
   * plays and playheadSec goes stale — anything gated on the playhead (the
   * cue drag box's on-screen gate) stuck ON after the image flew out.
   */
  onFrameSec?: (sec: number) => void;
  freePlaceEdit?: boolean;
  /** Edit mode opt-in: show EVERY card word (not just the on-screen page). */
  showAllWords?: boolean;
  /**
   * THE SHAKE FIX. While the user drags the timeline playhead, the drag is the
   * SINGLE writer of time. Without this the Player kept playing (its own
   * transport) and reported frames back through onFrameSec while the drag also
   * wrote playheadSec — two writers fighting every frame, so the preview shook
   * and the playhead clunked. While `scrubbing` we pause the Player and ignore
   * its frame reports; on release one authoritative seek lands.
   */
  scrubbing?: boolean;
}) {
  const size = RENDER_SIZES[aspect] ?? RENDER_SIZES.vertical;
  const playerRef = useRef<PlayerRef>(null);
  /**
   * The frame the user is actually on, tracked across plan rebuilds. When a
   * caption change rebuilds the plan, the Player can remount and snap back to
   * frame 0 — this ref is what we restore from so a style tweak never restarts
   * the video. Updated from the Player's own frame on every render.
   */
  const lastFrameRef = useRef(0);

  // The SAME plan the renderer builds. When the editor state changes, the plan
  // (and therefore the preview) recomputes — identical to what gets rendered.
  // A throw here used to take the whole stage down; now it's caught + shown.
  //
  // THE LOCK-UP FIX: the plan is STATE, not a render-time memo. An edit during
  // a pointer drag streams state changes at pointermove rate (~60/s); rebuilding
  // the plan synchronously on each one re-rendered the ENTIRE composition 60
  // times a second — the "preview locks up every now and then" report. Now a
  // content signature decides whether anything changed at all (playback
  // re-renders skip even the stringify), and rebuilds are throttled to one per
  // PREVIEW_PLAN_MIN_GAP_MS with a trailing apply, so the final state is never
  // stale but a drag never floods the main thread.
  const buildArgsRef = useRef({ project, fps, width: size.width, height: size.height, freePlaceEdit, showAllWords });
  buildArgsRef.current = { project, fps, width: size.width, height: size.height, freePlaceEdit, showAllWords };

  const buildPlan = useCallback(() => {
    const a = buildArgsRef.current;
    try {
      const base = buildRenderPlan(a.project, { fps: a.fps, width: a.width, height: a.height });
      // Studio-only: free-place Edit mode. showAllWords is the opt-in "every
      // card word" toggle — off, Edit shows just the on-screen page (Preview's
      // visibility). Neither is ever set for the final render.
      return a.freePlaceEdit
        ? { ...base, freePlaceEdit: true as const, showAllWords: a.showAllWords }
        : base;
    } catch (e) {
      console.error('[RemotionPreview] buildRenderPlan threw:', e);
      return null;
    }
  }, []);

  const [plan, setPlan] = useState<ReturnType<typeof buildPlan>>(() => buildPlan());

  // The content signature. Field check first: playback re-renders (the
  // playhead ticks state at 30fps) keep the same project object + scalars, so
  // they skip the stringify entirely. Only a real content change produces a
  // new sig. (buildArgsRef.current is a fresh object per render, so compare
  // the FIELDS, not the wrapper.)
  const sigCacheRef = useRef<{
    project: unknown;
    fps: number;
    w: number;
    h: number;
    fp: boolean;
    sa: boolean;
    sig: string;
  } | null>(null);
  const cached = sigCacheRef.current;
  let sig: string;
  if (
    cached &&
    cached.project === project &&
    cached.fps === fps &&
    cached.w === size.width &&
    cached.h === size.height &&
    cached.fp === freePlaceEdit &&
    cached.sa === showAllWords
  ) {
    sig = cached.sig;
  } else {
    sig = JSON.stringify(buildArgsRef.current);
    sigCacheRef.current = {
      project,
      fps,
      w: size.width,
      h: size.height,
      fp: freePlaceEdit,
      sa: showAllWords,
      sig,
    };
  }

  const lastSigRef = useRef(sig);
  const lastBuildAtRef = useRef(0);
  useEffect(() => {
    if (sig === lastSigRef.current) return;
    lastSigRef.current = sig;
    const wait = planRebuildWaitMs(lastBuildAtRef.current, performance.now());
    const t = setTimeout(() => {
      lastBuildAtRef.current = performance.now();
      setPlan(buildPlan());
    }, wait);
    return () => clearTimeout(t);
  }, [sig, buildPlan]);

  /**
   * Follow the timeline. Seek only on a real difference (>1 frame) so we never
   * fight the Player's own playback: while it plays it advances itself, and a
   * seek every render would stutter it back. Rounding to whole frames is what
   * keeps a dragged playhead landing on the same frame the render would emit.
   *
   * ALSO: after a plan rebuild (a caption tweak), restore the tracked frame so
   * the video doesn't snap back to 0. The Player remounts on a new inputProps;
   * this puts the playhead back where it was.
   */
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !plan) return;
    try {
      const cur = p.getCurrentFrame();
      if (Number.isFinite(cur) && cur > 0) lastFrameRef.current = cur;
    } catch {
      /* not mounted yet */
    }
    if (playheadSec == null || !Number.isFinite(playheadSec)) return;
    const target = Math.max(
      0,
      Math.min(plan.durationInFrames - 1, Math.round(playheadSec * plan.fps)),
    );
    try {
      if (Math.abs(p.getCurrentFrame() - target) > 1) p.seekTo(target);
    } catch {
      // The Player isn't mounted yet on the first paint; the next effect run seeks.
    }
  }, [playheadSec, plan]);

  /**
   * Restore the tracked frame after a plan rebuild. When the plan changes the
   * Player gets new inputProps and can reset to frame 0; this seeks it back to
   * where the user was. Runs AFTER the plan change, on the next paint.
   */
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !plan) return;
    const restore = Math.min(lastFrameRef.current, plan.durationInFrames - 1);
    if (restore <= 1) return;
    try {
      if (Math.abs(p.getCurrentFrame() - restore) > 1) p.seekTo(restore);
    } catch {
      /* not mounted yet */
    }
  }, [plan]);

  /**
   * Write the Player's frame back to the studio clock. The Player has its own
   * transport (controls), so without this it free-runs: playheadSec froze at
   * the last timeline scrub while the video played on, and anything gated on
   * the playhead — the cue drag box's on-screen gate — stuck ON after the
   * image flew out. The seek effect above never fights this: the frame the
   * Player reports IS the seek target, so |cur − target| = 0 and no seek
   * fires. The callback rides a ref so the listener attaches once per mount,
   * not on every page re-render.
   */
  const onFrameSecRef = useRef(onFrameSec);
  onFrameSecRef.current = onFrameSec;
  // While scrubbing, the drag owns time — the Player's frame reports are stale
  // (it was mid-flight when the drag grabbed it) and must not write the clock.
  const scrubbingRef = useRef(scrubbing);
  scrubbingRef.current = scrubbing;
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !plan) return;
    const onFrame = (e: { detail?: { frame?: unknown } }) => {
      if (scrubbingRef.current) return;
      const cb = onFrameSecRef.current;
      if (!cb) return;
      const frame = e.detail?.frame;
      if (typeof frame === 'number' && Number.isFinite(frame)) {
        cb(Math.round((frame / plan.fps) * 100) / 100);
      }
    };
    p.addEventListener('frameupdate', onFrame as never);
    return () => p.removeEventListener('frameupdate', onFrame as never);
  }, [plan]);

  /**
   * Pause the Player the instant a scrub starts. The Player has `controls` and
   * no `playing` prop, so it free-runs; left alone it keeps advancing (and
   * firing frameupdate) while the drag tries to steer — the shake. Pausing on
   * scrub-start makes the drag the only thing moving time. We do NOT auto-
   * resume on release: the user hits play (or Space) to continue, which is the
   * CapCut/Premiere scrub behavior.
   */
  useEffect(() => {
    if (!scrubbing) return;
    const p = playerRef.current;
    if (!p) return;
    try {
      if (p.isPlaying()) p.pause();
    } catch {
      /* not mounted yet */
    }
  }, [scrubbing]);

  if (!plan) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-black p-4 text-center">
        <p className="text-[11px] font-semibold text-red-300">Could not build the render plan</p>
        <p className="text-[9px] text-white/30">The error is in the console.</p>
      </div>
    );
  }

  if (plan.clips.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black text-[11px] text-white/40">
        Add a clip to preview
      </div>
    );
  }

  return (
    <PreviewErrorBoundary>
      <Player
        ref={playerRef}
        component={ReelComposition as React.ComponentType<{ plan: typeof plan }>}
        inputProps={{ plan }}
        durationInFrames={plan.durationInFrames}
        compositionWidth={plan.width}
        compositionHeight={plan.height}
        fps={plan.fps}
        controls
        style={{ width: '100%', height: '100%', backgroundColor: 'black' }}
      />
    </PreviewErrorBoundary>
  );
}
