/**
 * Turning click counts into a "how many people" reading — the one place.
 *
 * WHY THIS IS ITS OWN MODULE AND NOT PART OF links.ts
 * ---------------------------------------------------
 * `links.ts` constructs a Supabase service client at module scope. Four surfaces
 * need this derivation and two of them (`LinkTracking`, `PieceClickMetrics`) are
 * client components — importing `links.ts` from them would drag the service-role
 * key into a browser bundle. So the rule lives in a module with no imports at
 * all, which both halves can share.
 *
 * WHY THE RULE IS SHARED RATHER THAN RE-DERIVED PER SURFACE
 * --------------------------------------------------------
 * The interesting cases here are all judgement calls — when is a unique count
 * unknowable, when is it merely a floor, when does a small number of people mean
 * "you're clicking your own link". Re-implemented per surface, one of them
 * eventually renders a floor as a fact, and then two screens disagree about how
 * many people clicked the same link. That is the specific failure this file
 * exists to prevent.
 *
 * THE MEASUREMENT'S LIMITS, STATED ONCE
 * ------------------------------------
 * Uniques are `count(distinct ip_hash)`. A hashed IP is not a person:
 *   * one person on a train changing cell towers counts as several;
 *   * a whole office behind one NAT counts as one;
 *   * a click with no `ip_hash` at all counts as nobody — and that is the common
 *     case in local dev, where there is no `x-forwarded-for` header to hash.
 * Good enough to tell "3 people" from "300". Not good enough for anything that
 * gets reported as precise, which is why the labels say "people" loosely and the
 * floor cases are marked instead of rounded off.
 */

export interface PeopleReading {
  /**
   * Distinct people, or null when that genuinely cannot be determined.
   *
   * null is the whole point: if every click in the window arrived without an
   * `ip_hash`, the honest answer is "unknown", not 0. Rendering 0 people next to
   * 40 clicks would read as a broken counter and send someone hunting a bug
   * that isn't there.
   */
  people: number | null;
  /**
   * True when `people` is a floor rather than a count — some clicks in the
   * window had no hash, so there may be more people behind them.
   */
  atLeast: boolean;
  /** Clicks per person. Null unless both numbers are meaningful. */
  perPerson: number | null;
  /**
   * Many clicks, almost nobody behind them — the shape of an admin re-opening
   * their own link, not of an audience. Worth saying out loud, because a big
   * click number is otherwise read as traction.
   */
  selfTrafficLikely: boolean;
}

export interface PeopleInput {
  /** Human clicks in the same window the uniques were measured over. */
  recentClicks: number;
  /** Distinct hashed IPs in that window. */
  uniqueClicks: number;
  /** Clicks in that window that carried no hash and so belong to nobody. */
  unattributedClicks: number;
}

/**
 * Read a window's clicks as people.
 *
 * Both inputs must come from the SAME window. Pairing an all-time click counter
 * with a 30-day unique count would produce "40 clicks from 3 people" for a link
 * that had 40 clicks last year and 3 this month — a sentence that is arithmetic
 * nonsense and reads as insight.
 */
export function readPeople(input: PeopleInput): PeopleReading {
  const recent = Math.max(0, Math.floor(input.recentClicks || 0));
  const rawUnique = Math.max(0, Math.floor(input.uniqueClicks || 0));
  const unattributed = Math.max(0, Math.floor(input.unattributedClicks || 0));

  /*
   * People can never exceed clicks — clamped rather than trusted.
   *
   * The two numbers are produced by two different passes over the click log:
   * `recentClicks` counts rows that survived bot filtering, `uniqueClicks` sizes
   * a set of hashes. Any future change that filters one pass and not the other
   * (a new crawler pattern, a different window boundary) can transiently put
   * uniques above clicks. Unclamped, that renders as "1 click from 5 people" —
   * arithmetically impossible, and the kind of thing that destroys trust in
   * every other number on the page. Clamping degrades to a merely conservative
   * reading instead.
   */
  const unique = Math.min(rawUnique, recent);


  // Nothing happened in the window. Not "unknown" — measured, and empty.
  if (recent === 0 && unique === 0) {
    return {
      people: 0,
      atLeast: false,
      perPerson: null,
      selfTrafficLikely: false
    };
  }

  // Clicks exist but not one of them could be attributed. Unknown, not zero.
  if (unique === 0) {
    return {
      people: null,
      atLeast: false,
      perPerson: null,
      selfTrafficLikely: false
    };
  }

  const perPerson = unique > 0 ? recent / unique : null;

  return {
    people: unique,
    // Some clicks had no hash, so the real number of people is >= unique.
    atLeast: unattributed > 0,
    perPerson,
    /*
     * Thresholds, and why they are not tighter:
     *
     * A floor of 8 clicks keeps a brand-new post with 2 clicks from 1 person out
     * of it — that is simply a new post, not self-traffic, and accusing it would
     * train the reader to ignore the warning. The 5-clicks-per-person ratio is
     * where the gap stops being explicable by normal repeat visits (someone
     * opening a link, closing it, opening it again from a saved post) and starts
     * looking like one browser refreshing.
     *
     * Suppressed when `atLeast` is true: with unhashed clicks in the mix the
     * ratio is inflated by construction, and a false "this is just you" would be
     * the most expensive wrong statement on the screen — it invites deleting a
     * post that was actually working.
     */
    selfTrafficLikely:
      unattributed === 0 && recent >= 8 && perPerson !== null && perPerson >= 5
  };
}

/**
 * "3 people" / "at least 3 people" / "unknown" — the label, so four surfaces
 * cannot word the same reading three different ways.
 */
export function peopleLabel(reading: PeopleReading): string {
  if (reading.people === null) return 'not measurable';
  const noun = reading.people === 1 ? 'person' : 'people';
  return `${reading.atLeast ? 'at least ' : ''}${reading.people.toLocaleString()} ${noun}`;
}
