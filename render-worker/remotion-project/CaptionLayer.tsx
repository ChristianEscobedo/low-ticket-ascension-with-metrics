// @ts-nocheck — this folder is compiled by Remotion's own bundler, which supplies
// `remotion`/`react`; the app's tsconfig excludes render-worker entirely.
/**
 * The render worker's caption layer — a WRAPPER, not an implementation.
 *
 * The layer itself lives in
 * render-worker/src/lib/mothermode/reel/render/captionLayer.tsx, which is a
 * machine-synced copy of src/lib/mothermode/reel/render/captionLayer.tsx (the
 * Docker image must be self-contained: `COPY . ./` from render-worker/, so the
 * bundle cannot reach up into the Next app). The preview composition imports the
 * app copy of that same file.
 *
 * WHY: there used to be two hand-written caption layers, and they disagreed on
 * the stage-width divisor — 390 in the preview, 360 here. An 8.3% font-size gap,
 * which moved where rows wrapped and therefore where the whole caption block sat,
 * so the MP4 broke lines across different words than the stage did. One file plus
 * scripts/sync-vendored-captions.cjs and tests/lib/render-vendor-parity.test.ts
 * makes that class of drift a failing test instead of a bad render.
 *
 * Keep this file thin. Anything added here is, by definition, something the
 * preview does not show.
 */
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { CaptionLayerFrame } from '../src/lib/mothermode/reel/render/captionLayer';
import type { RenderPlan } from './constants';

export {
  activeWordIndex,
  CAPTION_STAGE_W,
} from '../src/lib/mothermode/reel/render/captionLayer';

export const CaptionLayer: React.FC<{ plan: RenderPlan }> = ({ plan }) => {
  // The ONLY thing this layer adds: where "now" comes from.
  const frame = useCurrentFrame();
  return <CaptionLayerFrame plan={plan} frame={frame} />;
};
