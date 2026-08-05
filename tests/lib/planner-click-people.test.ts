/**
 * The people-reading rules.
 *
 * These are tested at all because every one of them is a judgement call that
 * looks like a bug from the outside. "Clicks but people: null" reads as a broken
 * counter; "40 clicks, 1 person, no warning" reads as a missing feature. Someone
 * will eventually be tempted to "fix" one by collapsing null to 0 or by dropping
 * the thresholds — these tests state why each case is deliberate, so that edit
 * fails loudly instead of quietly making four admin surfaces lie.
 */

import { describe, it, expect } from 'vitest';
import {
  readPeople,
  peopleLabel
} from '../../src/lib/mothermode/planner/clickPeople';

describe('readPeople', () => {
  it('reports a measured zero when the window is genuinely empty', () => {
    // Distinct from "unknown": nothing happened, and saying so is accurate.
    const r = readPeople({
      recentClicks: 0,
      uniqueClicks: 0,
      unattributedClicks: 0
    });
    expect(r.people).toBe(0);
    expect(r.atLeast).toBe(false);
    expect(r.selfTrafficLikely).toBe(false);
  });

  it('returns null — never 0 — when clicks exist but none could be attributed', () => {
    /*
     * The local-dev case: no x-forwarded-for header, so nothing to hash. This is
     * THE reason `people` is nullable. Rendering 0 people beside 12 clicks would
     * send someone hunting a counter bug that does not exist.
     */
    const r = readPeople({
      recentClicks: 12,
      uniqueClicks: 0,
      unattributedClicks: 12
    });
    expect(r.people).toBeNull();
    expect(peopleLabel(r)).toBe('not measurable');
  });

  it('marks the count as a floor when only some clicks lacked a hash', () => {
    // 3 known people plus 2 clicks belonging to nobody: there could be 4 or 5
    // people. "at least 3" is the only true statement available.
    const r = readPeople({
      recentClicks: 10,
      uniqueClicks: 3,
      unattributedClicks: 2
    });
    expect(r.people).toBe(3);
    expect(r.atLeast).toBe(true);
    expect(peopleLabel(r)).toBe('at least 3 people');
  });

  it('flags self-traffic on the many-clicks/few-people shape', () => {
    // 40 clicks from 2 people = 20 per person. Not an audience.
    const r = readPeople({
      recentClicks: 40,
      uniqueClicks: 2,
      unattributedClicks: 0
    });
    expect(r.selfTrafficLikely).toBe(true);
    expect(r.perPerson).toBe(20);
  });

  it('does not flag a brand-new post with a couple of clicks', () => {
    /*
     * 2 clicks from 1 person clears the ratio (2 >= ... no) but not the 8-click
     * floor. Warning here would train the reader to ignore the warning, which is
     * worse than not having it.
     */
    const r = readPeople({
      recentClicks: 2,
      uniqueClicks: 1,
      unattributedClicks: 0
    });
    expect(r.selfTrafficLikely).toBe(false);
  });

  it('suppresses the flag when unattributed clicks inflate the ratio', () => {
    /*
     * 30 clicks, 1 hashed person, 25 with no hash. The 30:1 ratio is an artifact
     * of missing hashes, not evidence. A false "this is just you" invites
     * deleting a post that was working — the most expensive wrong statement on
     * the screen, so the flag stays off.
     */
    const r = readPeople({
      recentClicks: 30,
      uniqueClicks: 1,
      unattributedClicks: 25
    });
    expect(r.people).toBe(1);
    expect(r.atLeast).toBe(true);
    expect(r.selfTrafficLikely).toBe(false);
  });

  it('treats a healthy spread as an audience, not as self-traffic', () => {
    // 24 clicks from 20 people — normal repeat visits.
    const r = readPeople({
      recentClicks: 24,
      uniqueClicks: 20,
      unattributedClicks: 0
    });
    expect(r.selfTrafficLikely).toBe(false);
  });

  it('never returns more people than clicks, even on inconsistent input', () => {
    /*
     * Defensive: uniques come from the click log and `recentClicks` from a
     * filtered pass over the same rows, so a bot-filtering change could briefly
     * make uniques exceed clicks. "1 click from 5 people" is nonsense no surface
     * should ever print.
     */
    const r = readPeople({
      recentClicks: 1,
      uniqueClicks: 5,
      unattributedClicks: 0
    });
    expect(r.people).toBeLessThanOrEqual(1);
  });

  it('singularises one person', () => {
    const r = readPeople({
      recentClicks: 3,
      uniqueClicks: 1,
      unattributedClicks: 0
    });
    expect(peopleLabel(r)).toBe('1 person');
  });
});
