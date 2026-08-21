import { describe, expect, it } from 'vitest';
import { planRebuildWaitMs, PREVIEW_PLAN_MIN_GAP_MS } from '@/lib/mothermode/reel/previewThrottle';

describe('planRebuildWaitMs: the preview lock-up throttle', () => {
  it('the first build is immediate (no prior build timestamp)', () => {
    expect(planRebuildWaitMs(0, 1000)).toBe(0);
    expect(planRebuildWaitMs(NaN, 1000)).toBe(0);
  });

  it('a change inside the gap waits out the remainder (bursts collapse)', () => {
    // Built at t=1000, next change at t=1040 → wait 60ms for the 100ms gap.
    expect(planRebuildWaitMs(1000, 1040)).toBe(PREVIEW_PLAN_MIN_GAP_MS - 40);
  });

  it('a change after the gap applies immediately', () => {
    expect(planRebuildWaitMs(1000, 1000 + PREVIEW_PLAN_MIN_GAP_MS)).toBe(0);
    expect(planRebuildWaitMs(1000, 5000)).toBe(0);
  });

  it('junk timestamps never block a rebuild', () => {
    expect(planRebuildWaitMs(1000, NaN)).toBe(0);
    expect(planRebuildWaitMs(-5, 1000)).toBe(0);
  });
});
