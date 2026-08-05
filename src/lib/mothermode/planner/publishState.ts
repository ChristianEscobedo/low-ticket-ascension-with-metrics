/**
 * Publish state: the machine fact of what a plan card was actually sent to a
 * scheduler as, and how to say it out loud.
 *
 * Pure functions only — no fetch, no Supabase, no `window` — because three
 * surfaces render these labels (the content hub's Schedule tab, the planner
 * calendar, the planner card drawer) and they must agree by construction. A
 * calendar chip reading "Scheduled" while the drawer for the same card reads
 * "Draft" is worse than either label being absent.
 *
 * WHY 'draft' AND 'scheduled' ARE DIFFERENT STATES AND NOT A BOOLEAN ON A DATE
 * ---------------------------------------------------------------------------
 * Both carry a date. The difference is whether the date is a *promise* (it will
 * publish itself) or a *plan* (someone still has to press go). Before this
 * existed, a calendar of drafts was pixel-identical to a calendar of live
 * schedules, and the failure mode was silent in the expensive direction: the
 * planner told you the work was done, so nobody checked.
 */

/**
 * The fixed vocabulary, matching mothermode_content_plan.publish_state.
 *
 * `''` is a real, common member of this set and not a missing value: almost
 * every card starts life planned here and sent nowhere. It gets a label
 * ("Planned") rather than a blank so the calendar never renders an unexplained
 * gap where every other card has a chip.
 */
export const PUBLISH_STATES = ['', 'draft', 'scheduled', 'published'] as const;

export type PublishState = (typeof PUBLISH_STATES)[number];

/** The three states a card can be *sent* in, for pickers. */
export const SENDABLE_PUBLISH_STATES = [
  'draft',
  'scheduled',
  'published',
] as const;

export type SendablePublishState = (typeof SENDABLE_PUBLISH_STATES)[number];

/**
 * Coerce arbitrary input onto the vocabulary.
 *
 * Unknown values collapse to `''` ("Planned") rather than to 'scheduled',
 * because the only safe direction for a corrupt value is the one that claims
 * nothing happened. Guessing 'scheduled' would invent a promise the scheduler
 * never made.
 */
export function normalizePublishState(value: unknown): PublishState {
  if (typeof value !== 'string') return '';
  const v = value.trim().toLowerCase();
  return (PUBLISH_STATES as readonly string[]).includes(v)
    ? (v as PublishState)
    : '';
}

/** Human label for a chip or a dropdown. */
export function publishStateLabel(state: unknown): string {
  switch (normalizePublishState(state)) {
    case 'draft':
      return 'Draft';
    case 'scheduled':
      return 'Scheduled';
    case 'published':
      return 'Published';
    default:
      return 'Planned';
  }
}

/**
 * One line of "so what does that mean", for tooltips.
 *
 * Spelled out because "Draft" is the one label a reader can plausibly
 * mis-assume: on most tools a dated draft still goes out.
 */
export function publishStateHelp(state: unknown): string {
  switch (normalizePublishState(state)) {
    case 'draft':
      return 'Held as a draft in the scheduler. It will NOT publish on its own — you still have to send it.';
    case 'scheduled':
      return 'Queued in the scheduler and will publish itself at this time.';
    case 'published':
      return 'Already out.';
    default:
      return 'Planned here only. Nothing has been sent to a scheduler.';
  }
}

/**
 * Tailwind classes for the chip.
 *
 * Draft is deliberately the muted one and Scheduled the bright one: at a glance
 * across a month, the eye should be drawn to the posts that are actually going
 * to happen.
 */
export function publishStateTone(state: unknown): string {
  switch (normalizePublishState(state)) {
    case 'draft':
      return 'border-amber-400/40 bg-amber-500/10 text-amber-200';
    case 'scheduled':
      return 'border-sky-400/40 bg-sky-500/10 text-sky-200';
    case 'published':
      return 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200';
    default:
      return 'border-bone/15 bg-bone/5 text-bone/50';
  }
}

/** True when this state means the scheduler will fire it without further action. */
export function willPublishItself(state: unknown): boolean {
  return normalizePublishState(state) === 'scheduled';
}

/**
 * Time-of-day for a calendar chip, or '' when there is no usable date.
 *
 * Returns '' rather than a placeholder so callers can omit the whole element;
 * "—:—" on a chip reads like a bug.
 */
export function scheduleTimeLabel(
  iso: string | null | undefined,
  locale?: string,
): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Date + time for a drawer header, or 'Unscheduled'. */
export function scheduleDateTimeLabel(
  iso: string | null | undefined,
  locale?: string,
): string {
  if (!iso) return 'Unscheduled';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unscheduled';
  return d.toLocaleString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * The one-line summary the calendar and the drawer both use.
 *
 * State first, then the date, because the state is the thing a reader is liable
 * to assume wrongly.
 */
export function describeSchedule(
  card: { scheduledAt?: string | null; publishState?: unknown },
  locale?: string,
): string {
  const label = publishStateLabel(card.publishState);
  const when = scheduleDateTimeLabel(card.scheduledAt, locale);
  return when === 'Unscheduled' ? label : `${label} · ${when}`;
}

/**
 * Convert a `datetime-local` input value to an ISO string.
 *
 * `new Date('2026-03-04T09:00')` is parsed as LOCAL time by every browser, which
 * is what we want — the admin means 9am where they are. Returns null for blank
 * or unparseable input so a cleared field reads as "unschedule this", which is a
 * real thing to want.
 */
export function localInputToIso(value: string): string | null {
  const v = (value || '').trim();
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Inverse of `localInputToIso`, for pre-filling the field.
 *
 * Built from the local getters rather than `toISOString().slice(0, 16)`: the
 * latter prints UTC, so anyone west of GMT would open the drawer and see their
 * 9am post sitting at 2pm, and saving without touching it would move the post.
 */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/**
 * Which board column a freshly sent post belongs in.
 *
 * A draft or a queued post is work that is *staged*, not shipped, so both land
 * in 'scheduled'; only an actual publish moves to the terminal column (which
 * also stamps `published_at`, in the store). The ids are the seeded defaults and
 * are passed through `coerceStage` server-side, so a board that renamed or
 * deleted them degrades to its first column instead of erroring.
 */
export function stageForPublishState(state: unknown): string {
  return normalizePublishState(state) === 'published'
    ? 'published'
    : 'scheduled';
}
