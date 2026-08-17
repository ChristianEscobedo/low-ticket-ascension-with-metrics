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
import React, { useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Player, type PlayerRef } from '@remotion/player';
import { buildRenderPlan, DEFAULT_FPS, RENDER_SIZES } from '@/lib/mothermode/reel/render/plan';
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
  const plan = useMemo(() => {
    try {
      const base = buildRenderPlan(project, { fps, width: size.width, height: size.height });
      // Studio-only: free-place Edit mode. showAllWords is the opt-in "every
      // card word" toggle — off, Edit shows just the on-screen page (Preview's
      // visibility). Neither is ever set for the final render.
      return freePlaceEdit
        ? { ...base, freePlaceEdit: true as const, showAllWords }
        : base;
    } catch (e) {
      console.error('[RemotionPreview] buildRenderPlan threw:', e);
      return null;
    }
  }, [project, fps, size.width, size.height, freePlaceEdit, showAllWords]);

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
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !plan) return;
    const onFrame = (e: { detail?: { frame?: unknown } }) => {
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
