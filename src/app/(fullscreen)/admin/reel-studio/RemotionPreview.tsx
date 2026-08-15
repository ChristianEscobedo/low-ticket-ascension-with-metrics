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
  project,
  aspect = 'vertical',
  fps = DEFAULT_FPS,
  playheadSec,
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
  freePlaceEdit?: boolean;
}) {
  const size = RENDER_SIZES[aspect] ?? RENDER_SIZES.vertical;
  const playerRef = useRef<PlayerRef>(null);

  // The SAME plan the renderer builds. When the editor state changes, the plan
  // (and therefore the preview) recomputes — identical to what gets rendered.
  // A throw here used to take the whole stage down; now it's caught + shown.
  const plan = useMemo(() => {
    try {
      const base = buildRenderPlan(project, { fps, width: size.width, height: size.height });
      // Studio-only: free-place Edit mode shows every card word (not in final render).
      return freePlaceEdit ? { ...base, freePlaceEdit: true as const } : base;
    } catch (e) {
      console.error('[RemotionPreview] buildRenderPlan threw:', e);
      return null;
    }
  }, [project, fps, size.width, size.height, freePlaceEdit]);

  /**
   * Follow the timeline. Seek only on a real difference (>1 frame) so we never
   * fight the Player's own playback: while it plays it advances itself, and a
   * seek every render would stutter it back. Rounding to whole frames is what
   * keeps a dragged playhead landing on the same frame the render would emit.
   */
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !plan || playheadSec == null || !Number.isFinite(playheadSec)) return;
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
