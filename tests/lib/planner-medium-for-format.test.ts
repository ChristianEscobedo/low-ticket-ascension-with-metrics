/**
 * mediumForFormat: which formats count as PAID traffic.
 *
 * This file exists because of a shipped bug. `mediumForFormat` tested
 * `f.includes('ad')`, so the `thread` format — a real ContentFormat with a dozen
 * organic X pieces behind it — was tagged `paid_social`. Since `paid_social` is
 * in PAID_MEDIUMS, every organic thread click and every lead it produced was
 * counted as paid traffic, inflating the paid opt-in rate and the paid EPC.
 *
 * That is the worst direction for the error: organic converts better than paid,
 * so the contamination raises the paid EPC, and the paid EPC is what the bid
 * ceiling is derived from. The paid/blended split was built specifically to keep
 * organic out of a bid decision, and a two-letter substring was defeating it
 * upstream of the entire mechanism.
 */

import { describe, it, expect } from 'vitest';
import { mediumForFormat } from '@/lib/mothermode/planner/utm';
import { FORMAT_LABEL } from '@/lib/mothermode/content/constants';
import { trafficType } from '@/lib/mothermode/planner/adMetrics';

/**
 * Asserted through `trafficType`, not against the medium string, because that is
 * the function every surface actually routes money through. A test that only
 * checked `=== 'paid_social'` would still pass if the bucketing changed.
 */
const isPaid = (format: string) => trafficType(mediumForFormat(format)) === 'paid';

describe('mediumForFormat: the substring trap', () => {
  it('does NOT call a thread paid — the exact bug, pinned', () => {
    expect(mediumForFormat('thread')).toBe('organic_social');
    expect(isPaid('thread')).toBe(false);
  });


  it('does not call these paid either, all of which contain "ad"', () => {
    // Every one of these is a plausible format or label an admin could type.
    for (const format of [
      'lead magnet',
      'roadmap',
      'headline test',
      'download',
      'thread reply',
      'threads post'
    ]) {
      expect(isPaid(format)).toBe(false);
    }

  });
});

describe('mediumForFormat: real ads still register', () => {
  it('classifies ad formats as paid_social, since the fix must not overshoot', () => {
    for (const format of [
      'ad',
      'ads',
      'story ad',
      'carousel ad',
      'Reel Ad',
      'paid social',
      'boosted post',
      'sponsored post',
      'promoted reel'
    ]) {
      expect(mediumForFormat(format)).toBe('paid_social');
      expect(isPaid(format)).toBe(true);

    }
  });
});

describe('every format the content hub can actually produce', () => {
  /*
   * A sweep rather than a list, so that adding a format to the hub without
   * thinking about attribution fails HERE rather than silently landing in the
   * paid bucket on someone's dashboard. If a genuinely paid format is added
   * later, this test is the place to declare it.
   */
  const KNOWN_PAID_FORMATS: string[] = [];

  it('routes no organic format into the paid bucket', () => {
    const misfiled = Object.keys(FORMAT_LABEL).filter(
      (format) => isPaid(format) && !KNOWN_PAID_FORMATS.includes(format)
    );


    expect(misfiled).toEqual([]);
  });
});
