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
  const plan = useMemo(() => {
    const base = buildRenderPlan(project, { fps, width: size.width, height: size.height });
    // Studio-only: free-place Edit mode shows every card word (not in final render).
    return freePlaceEdit ? { ...base, freePlaceEdit: true as const } : base;
  }, [project, fps, size.width, size.height, freePlaceEdit]);

  /**
   * Follow the timeline. Seek only on a real difference (>1 frame) so we never
   * fight the Player's own playback: while it plays it advances itself, and a
   * seek every render would stutter it back. Rounding to whole frames is what
   * keeps a dragged playhead landing on the same frame the render would emit.
   */
  useEffect(() => {
    const p = playerRef.current;
    if (!p || playheadSec == null || !Number.isFinite(playheadSec)) return;
    const target = Math.max(
      0,
      Math.min(plan.durationInFrames - 1, Math.round(playheadSec * plan.fps)),
    );
    try {
      if (Math.abs(p.getCurrentFrame() - target) > 1) p.seekTo(target);
    } catch {
      // The Player isn't mounted yet on the first paint; the next effect run seeks.
    }
  }, [playheadSec, plan.fps, plan.durationInFrames]);

  if (plan.clips.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black text-[11px] text-white/40">
        Add a clip to preview
      </div>
    );
  }

  return (
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
  );
}
