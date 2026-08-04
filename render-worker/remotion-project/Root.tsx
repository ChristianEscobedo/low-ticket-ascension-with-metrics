// @ts-nocheck — compiled by Remotion's bundler (see ReelComposition.tsx).
/**
 * Composition registry. ONE composition ("Reel") whose size/fps/duration are
 * all driven by the plan via calculateMetadata, so a 9:16 60s reel and a 1:1
 * 20s cutdown are the same code path — no per-format compositions to keep in
 * sync (and no wrong-aspect exports).
 */
import React from 'react';
import { Composition } from 'remotion';
import { ReelComposition } from './ReelComposition';
import { DEFAULT_FPS, RENDER_SIZES, type RenderPlan } from './constants';


/** Shown in `remotion studio` when no real plan is passed. */
const previewPlan: RenderPlan = {
  fps: DEFAULT_FPS,
  width: RENDER_SIZES.vertical.width,
  height: RENDER_SIZES.vertical.height,
  durationInFrames: DEFAULT_FPS * 3,
  clips: [],
  overlays: [],
  audio: null,
  words: [],
  captionStyleId: 'karaoke',
  captionStyle: {} as RenderPlan['captionStyle'],
  captionLayout: {} as RenderPlan['captionLayout'],
  powerWords: [],
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Reel"
    component={ReelComposition}
    durationInFrames={previewPlan.durationInFrames}
    fps={previewPlan.fps}
    width={previewPlan.width}
    height={previewPlan.height}
    defaultProps={{ plan: previewPlan }}
    // The plan is the single source of truth for geometry and length.
    calculateMetadata={({ props }) => {
      const plan = (props as { plan?: RenderPlan }).plan;
      if (!plan) return {};
      return {
        durationInFrames: Math.max(1, plan.durationInFrames),
        fps: plan.fps,
        width: plan.width,
        height: plan.height,
      };
    }}
  />
);
