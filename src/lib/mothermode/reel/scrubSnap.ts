/**
 * Scrub snapping — the "better playhead" feel.
 *
 * Dragging the ruler used to land on whatever 0.1s the pointer resolved to,
 * so lining a cut up with a scene boundary was pure hand-eye. Now a scrub
 * within `thresholdSec` of a snap target (a clip boundary, 0, the end) lands
 * ON the target — the CapCut/Premiere magnet. Pure + exported for tests.
 */

export interface SnapResult {
  /** The time to seek to (the target when snapped, else the input). */
  t: number;
  /** The target that captured the scrub, or null when free. */
  snappedTo: number | null;
}

/**
 * Snap `t` to the nearest target within `thresholdSec`. Targets need not be
 * sorted; junk (non-finite) targets are ignored. A non-positive threshold or
 * an empty target list always returns the input untouched.
 */
export function snapToTargets(
  t: number,
  targets: readonly number[],
  thresholdSec: number,
): SnapResult {
  if (!Number.isFinite(t) || thresholdSec <= 0 || targets.length === 0) {
    return { t, snappedTo: null };
  }
  let best: number | null = null;
  let bestDist = thresholdSec;
  for (const target of targets) {
    if (!Number.isFinite(target)) continue;
    const dist = Math.abs(t - target);
    // <= so a target exactly at the threshold still captures.
    if (dist <= bestDist) {
      bestDist = dist;
      best = target;
    }
  }
  return best === null ? { t, snappedTo: null } : { t: best, snappedTo: best };
}

/**
 * The snap targets a reel timeline offers: 0, every clip's start, and the
 * reel's end. `clipStarts` are timeline-absolute seconds (timelineStartOf).
 */
export function timelineSnapTargets(clipStarts: readonly number[], totalSec: number): number[] {
  const out = [0, ...clipStarts.filter((s) => Number.isFinite(s) && s > 0)];
  if (Number.isFinite(totalSec) && totalSec > 0) out.push(totalSec);
  return out;
}
