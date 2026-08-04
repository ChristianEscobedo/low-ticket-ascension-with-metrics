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
import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Player } from '@remotion/player';
import { buildRenderPlan, DEFAULT_FPS, RENDER_SIZES } from '@/lib/mothermode/reel/render/plan';
import type { ReelProject } from '@/lib/mothermode/reel/types';

// The composition is browser-only (imports `remotion`); never SSR it.
const ReelComposition = dynamic(
  () => import('../../../../../remotion-project/ReelComposition').then((m) => m.ReelComposition),
  { ssr: false },
);

export default function RemotionPreview({
  project,
  aspect = 'vertical',
  fps = DEFAULT_FPS,
}: {
  project: Pick<
    ReelProject,
    'clips' | 'audio' | 'captions' | 'captionStyle' | 'captionOverrides' | 'overlays'
  >;
  aspect?: keyof typeof RENDER_SIZES;
  fps?: number;
}) {
  const size = RENDER_SIZES[aspect] ?? RENDER_SIZES.vertical;

  // The SAME plan the renderer builds. When the editor state changes, the plan
  // (and therefore the preview) recomputes — identical to what gets rendered.
  const plan = useMemo(
    () => buildRenderPlan(project, { fps, width: size.width, height: size.height }),
    [project, fps, size.width, size.height],
  );

  if (plan.clips.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black text-[11px] text-white/40">
        Add a clip to preview
      </div>
    );
  }

  return (
    <Player
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
