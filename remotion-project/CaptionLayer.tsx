/**
 * The preview composition's caption layer — a WRAPPER, not an implementation.
 *
 * Everything that decides how captions look and where they sit now lives in
 * src/lib/mothermode/reel/render/captionLayer.tsx, imported by this file AND by
 * the render worker's copy of this file. That is the whole point: this used to be
 * a second full implementation of the layer, and it disagreed with the worker's
 * on the stage-width divisor (390 here vs 360 there). Font size drives text
 * width, text width drives where rows wrap, so the caption block landed
 * somewhere else and broke across different words in the MP4 than on the stage.
 *
 * Keep this file thin. Anything added here is, by definition, something the
 * render does not do.
 */
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { CaptionLayerFrame } from '../src/lib/mothermode/reel/render/captionLayer';
import type { RenderPlan } from '../src/lib/mothermode/reel/render/plan';

export {
  activeWordIndex,
  CAPTION_STAGE_W,
} from '../src/lib/mothermode/reel/render/captionLayer';

export const CaptionLayer: React.FC<{ plan: RenderPlan }> = ({ plan }) => {
  // The ONLY thing this layer adds: where "now" comes from.
  const frame = useCurrentFrame();
  return <CaptionLayerFrame plan={plan} frame={frame} />;
};
