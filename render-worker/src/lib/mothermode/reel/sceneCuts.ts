/**
 * R4 pure helpers (unit-testable, zero server deps).
 *
 * - Cutdown v2: parse ffmpeg scene-change detection output and snap the
 *   model-picked segment bounds onto real visual cuts.
 * - Sprite sheets: the filmstrip's 4 frames ride ONE tiled JPEG — the cell
 *   math (which slice of the tile a frame lives at) lives here.
 * - Split-screen reaction: the ffmpeg filter_complex string, built once.
 */

/** ffmpeg `showinfo` lines carry `pts_time:<seconds>` — one per selected frame. */
export function parseSceneCutTimes(showinfoText: string): number[] {
  if (!showinfoText) return [];
  const out: number[] = [];
  const re = /pts_time:(\d+(?:\.\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(showinfoText)) !== null) {
    const t = Number(m[1]);
    if (Number.isFinite(t) && t >= 0 && !out.includes(t)) out.push(t);
  }
  return out.sort((a, b) => a - b);
}

/** The scene-detect threshold from the roadmap: gt(scene,0.4). */
export const SCENE_CUT_THRESHOLD = 0.4;

/** ffmpeg select expression for the given threshold. */
export function sceneSelectExpr(threshold = SCENE_CUT_THRESHOLD): string {
  return `select='gt(scene,${threshold})'`;
}

/** Nearest detected cut within `maxSnapSec` of t; t itself when none qualify. */
export function snapToSceneCut(tSec: number, cuts: number[], maxSnapSec = 1.5): number {
  let best = tSec;
  let bestDist = maxSnapSec + 1e-9;
  for (const c of cuts) {
    const d = Math.abs(c - tSec);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

/**
 * Snap a picked segment's bounds onto visual cuts. A snap that crushes the
 * segment below `minDurSec` is reverted (the transcript's boundary wins over
 * a prettier cut) — honesty over cosmetics.
 */
export function snapSegmentBounds(
  startSec: number,
  endSec: number,
  cuts: number[],
  opts?: { maxSnapSec?: number; minDurSec?: number },
): { startSec: number; endSec: number } {
  const maxSnap = opts?.maxSnapSec ?? 1.5;
  const minDur = opts?.minDurSec ?? 3;
  if (!cuts.length || endSec - startSec < minDur) return { startSec, endSec };
  const s = snapToSceneCut(startSec, cuts, maxSnap);
  const e = snapToSceneCut(endSec, cuts, maxSnap);
  if (e - s < minDur) return { startSec, endSec };
  return { startSec: Math.round(s * 100) / 100, endSec: Math.round(e * 100) / 100 };
}

// ---------------------------------------------------------------------------
// Sprite sheets (4×1 tiled JPEG per clip)
// ---------------------------------------------------------------------------

/** fps value for the sprite run: `frames` evenly spread over [0.5, dur-0.5]. */
export function spriteFpsValue(durSec: number, frames = 4): number {
  const span = Math.max(1, durSec - 1);
  return Math.round(((frames - 1) / span) * 1e6) / 1e6;
}

/** CSS for cell `index` of a `frames`×1 tile: sized so one cell fills the box. */
export function spriteCellStyle(
  index: number,
  frames = 4,
): { backgroundSize: string; backgroundPosition: string } {
  const i = Math.max(0, Math.min(index, frames - 1));
  const pct = frames <= 1 ? 0 : (i / (frames - 1)) * 100;
  return {
    backgroundSize: `${frames * 100}% 100%`,
    backgroundPosition: `${Math.round(pct * 100) / 100}% 50%`,
  };
}

// ---------------------------------------------------------------------------
// Split-screen reaction (main on top, reaction cam bottom third)
// ---------------------------------------------------------------------------

export const SPLITSCREEN = { width: 1080, topH: 1280, bottomH: 640 } as const;

/** ffmpeg filter_complex: crop-fill both inputs, vstack → 1080×1920. */
export function buildSplitScreenFilter(
  width = SPLITSCREEN.width,
  topH = SPLITSCREEN.topH,
  bottomH = SPLITSCREEN.bottomH,
): string {
  return (
    `[0:v]scale=${width}:${topH}:force_original_aspect_ratio=increase,` +
    `crop=${width}:${topH}[top];` +
    `[1:v]scale=${width}:${bottomH}:force_original_aspect_ratio=increase,` +
    `crop=${width}:${bottomH}[bot];` +
    `[top][bot]vstack=inputs=2[v]`
  );
}
