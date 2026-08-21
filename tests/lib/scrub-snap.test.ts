import { describe, expect, it } from 'vitest';
import { snapToTargets, timelineSnapTargets } from '@/lib/mothermode/reel/scrubSnap';

describe('snapToTargets: the playhead magnet', () => {
  const bounds = [0, 4.2, 9.7, 14.0];

  it('snaps to the nearest boundary inside the threshold', () => {
    expect(snapToTargets(4.0, bounds, 0.35)).toEqual({ t: 4.2, snappedTo: 4.2 });
    expect(snapToTargets(9.95, bounds, 0.35)).toEqual({ t: 9.7, snappedTo: 9.7 });
  });

  it('leaves a scrub between boundaries alone', () => {
    expect(snapToTargets(7.0, bounds, 0.35)).toEqual({ t: 7.0, snappedTo: null });
  });

  it('a target exactly at the threshold still captures', () => {
    expect(snapToTargets(4.55, bounds, 0.35)).toEqual({ t: 4.2, snappedTo: 4.2 });
  });

  it('no targets / no threshold / junk input never snap', () => {
    expect(snapToTargets(4.0, [], 0.35)).toEqual({ t: 4.0, snappedTo: null });
    expect(snapToTargets(4.0, bounds, 0)).toEqual({ t: 4.0, snappedTo: null });
    expect(snapToTargets(NaN, bounds, 0.35).snappedTo).toBeNull();
    expect(snapToTargets(4.0, [NaN, Infinity], 0.35)).toEqual({ t: 4.0, snappedTo: null });
  });
});

describe('timelineSnapTargets', () => {
  it('offers 0, every clip start, and the reel end', () => {
    expect(timelineSnapTargets([4.2, 9.7], 14)).toEqual([0, 4.2, 9.7, 14]);
  });

  it('drops junk starts and a missing end', () => {
    expect(timelineSnapTargets([NaN, -2], 0)).toEqual([0]);
  });
});
