/**
 * Self-contained constants for the render-worker's composition. The main app's
 * plan.ts imports from @/lib/mothermode/... which doesn't resolve in the
 * render-worker, so the composition can't import from it. These are the same
 * values — keep them in sync with src/lib/mothermode/reel/render/plan.ts.
 */

export const DEFAULT_FPS = 30;

export const RENDER_SIZES = {
  vertical: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
  landscape: { width: 1920, height: 1080 },
} as const;

/** The plan shape the composition receives. Mirrors RenderPlan in the main app. */
export interface RenderClip {
  id: string;
  name: string;
  src: string;
  fromFrame: number;
  durationInFrames: number;
  trimStartSec: number;
  motion?: { t: number; scale?: number; x?: number; y?: number; rotate?: number }[];
}

export interface RenderOverlay extends RenderClip {
  layer: number;
}

export interface RenderAudio {
  src: string;
  fromFrame: number;
  durationInFrames: number;
}

export interface RenderWord {
  word: string;
  text: string;
  start: number;
  end: number;
  fromFrame: number;
  toFrame: number;
}

/**
 * A webfont the renderer must fetch before drawing. Fonts are NOT baked into
 * the Docker image — that could only ever cover families we shipped, and custom
 * caption styles let a user name any family. Instead the app resolves the face
 * to a URL and sends it here. See src/lib/mothermode/reel/captionFonts.ts.
 */
export interface RenderFont {
  family: string;
  cssUrl: string;
  weights?: number[];
}

export interface RenderPlan {
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  clips: RenderClip[];
  overlays: RenderOverlay[];
  audio: RenderAudio | null;
  words: RenderWord[];
  captionStyleId: string;
  captionStyle: Record<string, unknown>;
  captionLayout: Record<string, unknown>;
  powerWords: string[];
  /**
   * Optional: older plans predate this field, and FontLoader falls back to
   * deriving the font from `captionStyle` when it is absent.
   */
  fonts?: RenderFont[];
}
