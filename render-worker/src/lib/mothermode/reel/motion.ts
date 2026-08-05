/**
 * R15 Motion Lab — keyframed scene motion (punch-ins, pans, shakes) as data.
 *
 * A scene's motion is a list of keyframes; `sampleMotion` interpolates linearly
 * between them. The SAME sampler drives the CSS preview AND (phase 2) the
 * ffmpeg filter-string builder — preview and render can't drift.
 *
 * Design choice: PRESETS OVER PRIMITIVES. The UI offers named presets; each
 * expands to keyframes. Freehand keyframe editing comes after the render bake
 * proves the math.
 */

export interface MotionKey {
  /** Seconds into the clip's effective (trimmed) duration. */
  t: number;
  /** Zoom factor. 1 = none. */
  scale: number;
  /** Horizontal/vertical pan in % of frame width/height. 0 = centered. */
  panX: number;
  panY: number;
  /** 2D roll in degrees. */
  rotateDeg: number;
}

export const MOTION_NEUTRAL: MotionKey = { t: 0, scale: 1, panX: 0, panY: 0, rotateDeg: 0 };

/** Linear interpolation between keyframes; clamps outside the key range. */
export function sampleMotion(keys: MotionKey[] | undefined, tSec: number): MotionKey {
  if (!keys || keys.length === 0) return { ...MOTION_NEUTRAL, t: tSec };
  const sorted = [...keys].sort((a, b) => a.t - b.t);
  if (tSec <= sorted[0].t) return { ...sorted[0], t: tSec };
  const last = sorted[sorted.length - 1];
  if (tSec >= last.t) return { ...last, t: tSec };
  let i = 0;
  while (i < sorted.length - 1 && sorted[i + 1].t < tSec) i += 1;
  const a = sorted[i];
  const b = sorted[i + 1];
  const span = b.t - a.t;
  const f = span <= 0 ? 0 : (tSec - a.t) / span;
  const lerp = (x: number, y: number) => x + (y - x) * f;
  return {
    t: tSec,
    scale: lerp(a.scale, b.scale),
    panX: lerp(a.panX, b.panX),
    panY: lerp(a.panY, b.panY),
    rotateDeg: lerp(a.rotateDeg, b.rotateDeg),
  };
}

/** CSS transform for a sampled key — the preview's live render. */
export function motionCssTransform(k: MotionKey): string {
  const parts: string[] = [];
  if (Math.abs(k.panX) > 0.01 || Math.abs(k.panY) > 0.01) {
    parts.push(`translate(${k.panX.toFixed(2)}%, ${k.panY.toFixed(2)}%)`);
  }
  if (Math.abs(k.rotateDeg) > 0.01) parts.push(`rotate(${k.rotateDeg.toFixed(2)}deg)`);
  if (Math.abs(k.scale - 1) > 0.001) parts.push(`scale(${k.scale.toFixed(3)})`);
  return parts.length ? parts.join(' ') : 'none';
}

export type MotionPresetId =
  | 'punch-in'
  | 'punch-out'
  | 'slow-zoom'
  | 'pan-l'
  | 'pan-r'
  | 'tilt-up'
  | 'shake'
  | 'rotate-sway';

export interface MotionPreset {
  id: MotionPresetId;
  label: string;
  hint: string;
}

export const MOTION_PRESETS: MotionPreset[] = [
  { id: 'punch-in', label: 'punch in', hint: 'Snap-zoom to 115% in the first 0.3s — the viral jump-cut look' },
  { id: 'punch-out', label: 'punch out', hint: 'Release from 115% back to full frame' },
  { id: 'slow-zoom', label: 'slow zoom', hint: 'Ken Burns creep-in across the whole scene' },
  { id: 'pan-l', label: 'pan ←', hint: 'Drift left-to-right at 110% zoom' },
  { id: 'pan-r', label: 'pan →', hint: 'Drift right-to-left at 110% zoom' },
  { id: 'tilt-up', label: 'tilt up', hint: 'Rise from below at 110% zoom' },
  { id: 'shake', label: 'shake', hint: 'Handheld micro-shake the whole scene' },
  { id: 'rotate-sway', label: 'sway', hint: 'Gentle ±1.5° roll — a floating camera feel' },
];

/** Expand a preset into keyframes for a clip of `durSec` effective seconds. */
export function presetKeys(id: MotionPresetId, durSec: number): MotionKey[] {
  const d = Math.max(0.5, durSec);
  const k = (t: number, over: Partial<MotionKey>): MotionKey => ({ ...MOTION_NEUTRAL, t, ...over });
  switch (id) {
    case 'punch-in':
      return [k(0, {}), k(Math.min(0.3, d * 0.4), { scale: 1.15 }), k(d, { scale: 1.15 })];
    case 'punch-out':
      return [k(0, { scale: 1.15 }), k(Math.min(0.35, d * 0.5), {}), k(d, {})];
    case 'slow-zoom':
      return [k(0, {}), k(d, { scale: 1.18 })];
    case 'pan-l':
      return [k(0, { scale: 1.1, panX: -4 }), k(d, { scale: 1.1, panX: 4 })];
    case 'pan-r':
      return [k(0, { scale: 1.1, panX: 4 }), k(d, { scale: 1.1, panX: -4 })];
    case 'tilt-up':
      return [k(0, { scale: 1.1, panY: 4 }), k(d, { scale: 1.1, panY: -4 })];
    case 'shake': {
      const keys: MotionKey[] = [];
      const n = Math.max(4, Math.round(d / 0.25));
      for (let i = 0; i <= n; i += 1) {
        const even = i % 2 === 0;
        keys.push(k((i / n) * d, { panX: even ? 1.2 : -1.2, panY: even ? -0.8 : 0.8 }));
      }
      return keys;
    }
    case 'rotate-sway':
      return [
        k(0, { rotateDeg: -1.5 }),
        k(d / 2, { rotateDeg: 1.5 }),
        k(d, { rotateDeg: -1.5 }),
      ];
    default:
      return [k(0, {})];
  }
}

/** Which preset (if any) a scene's keys match — for the active chip. */
export function detectPreset(keys: MotionKey[] | undefined, durSec: number): MotionPresetId | null {
  if (!keys || keys.length < 2) return null;
  for (const p of MOTION_PRESETS) {
    const ref = presetKeys(p.id, durSec);
    if (ref.length !== keys.length) continue;
    const same = ref.every(
      (r, i) =>
        Math.abs(r.t - keys[i].t) < 0.05 &&
        Math.abs(r.scale - keys[i].scale) < 0.005 &&
        Math.abs(r.panX - keys[i].panX) < 0.05 &&
        Math.abs(r.panY - keys[i].panY) < 0.05 &&
        Math.abs(r.rotateDeg - keys[i].rotateDeg) < 0.05,
    );
    if (same) return p.id;
  }
  return null;
}
