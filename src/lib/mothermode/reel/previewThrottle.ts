/**
 * Preview plan rebuild throttle — the fix for the "preview locks up every now
 * and then" report.
 *
 * The studio stage re-renders on every edit, and an edit during a pointer
 * drag streams state changes at pointermove rate (~60/s). Each change used to
 * rebuild the Remotion render plan synchronously and hand the Player new
 * inputProps, re-rendering the ENTIRE composition (every OffthreadVideo,
 * every caption word) 60 times a second. That is the lock-up: the main thread
 * never gets ahead of the drag.
 *
 * The rule: rebuild at most once per PREVIEW_PLAN_MIN_GAP_MS while changes
 * stream in; the trailing rebuild (the last change's timeout) always applies,
 * so the final state is never stale. Pure + exported for tests.
 */

/** Minimum gap between preview plan rebuilds while edits stream in. */
export const PREVIEW_PLAN_MIN_GAP_MS = 100;

/**
 * Milliseconds to wait before applying the next plan rebuild.
 * 0 when no build has happened yet or the gap already elapsed; otherwise the
 * remainder of the gap (the caller's setTimeout collapses bursts into one
 * trailing rebuild).
 */
export function planRebuildWaitMs(
  lastBuildAt: number,
  now: number,
  minGap: number = PREVIEW_PLAN_MIN_GAP_MS,
): number {
  if (!Number.isFinite(lastBuildAt) || lastBuildAt <= 0) return 0;
  if (!Number.isFinite(now)) return 0;
  const elapsed = now - lastBuildAt;
  return elapsed >= minGap ? 0 : Math.ceil(minGap - elapsed);
}
