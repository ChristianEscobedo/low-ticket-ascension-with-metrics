/**
 * Email sequence definitions. Each sequence is an ordered list of steps with a
 * cumulative offset (hours from enrollment), a subject, and an EmailDoc builder
 * rendered through the shared Editorial Warm layout. The engine
 * (./engine) schedules and sends them; this file is pure copy + data so it can
 * be unit-tested and previewed without touching the database.
 *
 * Voice rules apply to every string: no em dashes, no NO-list words. Dynamic
 * values come from {@link SequenceContext} and are inlined by the builders, so
 * there are no {{tokens}} to render here.
 */
import type { EmailDoc } from '../layout';

/** Values a step builder can use. Normalized by the engine before building. */
export interface SequenceContext {
  /** Buyer first name, or 'there' when unknown. */
  name: string;
  email: string;
  /** Absolute CTA url for this sequence's target offer. */
  offerUrl: string;
  /** Human-readable deadline for deadline-driven sequences (coaching). */
  deadlineLabel?: string;
}

export interface SequenceStep {
  /** Stable id for logging / debugging. */
  key: string;
  /** Cumulative hours after enrollment when this step becomes due. */
  offsetHours: number;
  subject: (ctx: SequenceContext) => string;
  build: (ctx: SequenceContext) => EmailDoc;
}

export interface SequenceDefinition {
  id: string;
  /** Purchasing this product exits the enrollment as converted. */
  targetProductId: string;
  /** Window in hours for deadline-driven sequences; sets deadline_at. */
  windowHours?: number;
  steps: SequenceStep[];
}

/** Absolute due time for a step, or null when the index is past the end. */
export function stepDueAt(
  def: SequenceDefinition,
  stepIndex: number,
  enrolledAt: Date
): Date | null {
  const step = def.steps[stepIndex];
  if (!step) return null;
  return new Date(enrolledAt.getTime() + step.offsetHours * 3600_000);
}

// ---------------------------------------------------------------------------
// upsell_os: front-end buyers who have not joined the MotherMode OS yet.
// ---------------------------------------------------------------------------

const UPSELL_OS_SEQUENCE: SequenceDefinition = {
  id: 'upsell_os',
  targetProductId: 'mothermode_os',
  steps: [
    {
      key: 'os-keep-it-out',
      offsetHours: 24,
      subject: (c) => `The list is out, ${c.name}. Now keep it out.`,
      build: (c) => ({
        preheader: 'A pack empties the list once. Here is what keeps it empty.',
        eyebrow: 'The OS for modern motherhood.',
        title: 'The list is out. Now keep it out.',
        intro: [
          `Hi ${c.name}, by now you have run the dump and felt the quiet that comes when the list lives somewhere other than your head.`,
          'Here is the part no one tells you. A list empties once and starts refilling the next morning. The only question is what catches it next time.',
        ],
        sections: [
          {
            heading: 'What the OS does that a pack cannot',
            bullets: [
              'It holds the load with you every day, so nothing has to live in your memory.',
              'It plans meals, lists, and routines around your real week, not an ideal one.',
              'It adjusts when the week falls apart, because it always does, and that is fine.',
            ],
          },
        ],
        cta: { label: 'See the MotherMode OS', url: c.offerUrl },
        outro: [
          'No rush. The pack is yours to keep either way. This is simply what keeps it working past this week.',
        ],
      }),
    },
    {
      key: 'os-normal-tuesday',
      offsetHours: 72,
      subject: () => 'A normal Tuesday, run by the OS',
      build: (c) => ({
        preheader: 'Not a perfect day. A regular one, with the weight shared.',
        title: 'A normal Tuesday, run by the OS',
        intro: [
          `Hi ${c.name}, picture a regular Tuesday. Not a perfect one.`,
          'You ask the OS what is for dinner and it answers with what is already in your kitchen. You ask it to sort the morning and it hands you a sequence your kids can follow.',
        ],
        sections: [
          {
            heading: 'The difference is daily',
            bullets: [
              'No blank page at 5pm. The plan is already there.',
              'No mental tab open for the grocery run. The list builds itself.',
              'No holding the whole house in your head. It holds it with you.',
            ],
          },
        ],
        cta: { label: 'See the MotherMode OS', url: c.offerUrl },
        outro: ['You did the hard part already. This just makes it last.'],
      }),
    },
    {
      key: 'os-founding-rate',
      offsetHours: 168,
      subject: (c) => `Your founding rate is still open, ${c.name}`,
      build: (c) => ({
        preheader: 'The lowest the OS will ever cost, held for as long as you stay.',
        eyebrow: 'Founding rate',
        title: 'Your founding rate is still open',
        intro: [
          `Hi ${c.name}, a quick and honest note. The founding rate on the OS is the lowest it will ever be, and it holds for as long as you stay.`,
          'I am not going to pressure you. I will just tell you the truth. The price only goes up from here, and never for the mothers who came in early.',
        ],
        sections: [
          {
            heading: 'What you lock in',
            bullets: [
              'The full OS, every day, for less than a single takeout night.',
              'Every new pack and improvement, added as it ships.',
              'A rate that does not rise on you later.',
            ],
          },
        ],
        cta: { label: 'Lock my founding rate', url: c.offerUrl },
        outro: [
          'If the timing is wrong, that is okay. I would rather you join when it is right than when it is rushed.',
        ],
      }),
    },
    {
      key: 'os-door-open',
      offsetHours: 336,
      subject: () => 'Leaving the door open',
      build: (c) => ({
        preheader: 'The last note about the OS. The pack is yours regardless.',
        title: 'Leaving the door open',
        intro: [
          `Hi ${c.name}, this is the last note I will send about the OS.`,
          'If it is not the season for it, I understand completely. You already have the pack you bought, and it is yours for good.',
        ],
        sections: [
          {
            heading: 'When you are ready',
            paragraphs: [
              'The OS will be here. So will your founding rate, for a little while yet. When a week comes that you do not want to run alone, you know where it is.',
            ],
          },
        ],
        cta: { label: 'Open the MotherMode OS', url: c.offerUrl },
        outro: [
          'Thank you for letting me be a small part of your week. Truly.',
        ],
      }),
    },
  ],
};

// ---------------------------------------------------------------------------
// coaching_extension: the $997 coaching "I need more time" window. Enrolled by
// /api/coaching/extend with a deadline; steps escalate toward the close.
// ---------------------------------------------------------------------------

const COACHING_EXTENSION_SEQUENCE: SequenceDefinition = {
  id: 'coaching_extension',
  targetProductId: 'mothermode_coaching',
  windowHours: 120,
  steps: [
    {
      key: 'coach-window-open',
      offsetHours: 0,
      subject: (c) => `Your window is open, ${c.name}`,
      build: (c) => ({
        preheader: 'Your founding coaching seat is held. No decision tonight.',
        eyebrow: 'Founding Coaching',
        title: 'Your window is open',
        intro: [
          `Hi ${c.name}, you asked for a little more time, and you have it. Your seat in the founding coaching year is held for you until ${c.deadlineLabel ?? 'the date in your account'}.`,
          'No decision tonight. I just wanted you to have room to think without the offer closing behind you.',
        ],
        sections: [
          {
            heading: 'What you are deciding on',
            bullets: [
              'Two live group calls a month, all year, built around real weeks.',
              'A private circle of founding mothers carrying the same load.',
              'The full OS underneath it, so the coaching has a system to land on.',
            ],
          },
        ],
        cta: { label: 'Hold my coaching seat', url: c.offerUrl },
        outro: [
          'Take the days you need. I will send a couple of notes before the window closes so it does not slip past you.',
        ],
      }),
    },
    {
      key: 'coach-what-the-room-is-for',
      offsetHours: 48,
      subject: () => 'What the room is actually for',
      build: (c) => ({
        preheader: 'The part that is hard to put on a sales page.',
        eyebrow: 'Founding Coaching',
        title: 'What the room is actually for',
        intro: [
          `Hi ${c.name}, the part that is hard to put on a sales page is what the room feels like.`,
          'It is the place you bring the week that is not working and leave with the next move. Not advice for a mother who does not exist. Help for the exact one you are.',
        ],
        sections: [
          {
            heading: 'A seat is worth it when',
            bullets: [
              'You are tired of solving the same week alone, every week.',
              'You want eyes on your actual situation, not a generic checklist.',
              'You would show up for yourself if something was holding the time.',
            ],
          },
        ],
        cta: { label: 'Take my seat', url: c.offerUrl },
        outro: [
          `Your window is open until ${c.deadlineLabel ?? 'soon'}. Plenty of time, and I will remind you before it closes.`,
        ],
      }),
    },
    {
      key: 'coach-one-day-left',
      offsetHours: 96,
      subject: () => 'About a day left on your window',
      build: (c) => ({
        preheader: 'A gentle heads up before the hold closes.',
        eyebrow: 'One day left',
        title: 'About a day left on your window',
        intro: [
          `Hi ${c.name}, a gentle heads up. The hold on your founding coaching seat closes ${c.deadlineLabel ?? 'tomorrow'}.`,
          'If you have been waiting for a sign that it is okay to choose the thing that helps you, this is me handing it to you.',
        ],
        sections: [
          {
            heading: 'If you are on the fence',
            paragraphs: [
              'The mothers who get the most from this room are almost never the ones who felt ready. They are the ones who were tired enough to stop doing it alone. That is allowed to be reason enough.',
            ],
          },
        ],
        cta: { label: 'Claim my seat', url: c.offerUrl },
        outro: [
          'After the window closes the founding rate goes with it. I would hate for you to miss it by a day.',
        ],
      }),
    },
    {
      key: 'coach-last-call',
      offsetHours: 114,
      subject: () => 'Last call on your seat',
      build: (c) => ({
        preheader: 'Your founding coaching window closes today.',
        eyebrow: 'Closing today',
        title: 'Last call on your seat',
        intro: [
          `Hi ${c.name}, this is the final note. Your founding coaching window closes today, at ${c.deadlineLabel ?? 'the end of the day'}.`,
          'If it is a yes, now is the moment. If it is a no, that is genuinely okay, and there is nothing more you need to do.',
        ],
        sections: [
          {
            heading: 'One last thing',
            paragraphs: [
              'You do not have to have a perfect week to belong in this room. Come exactly as you are, on the hardest Tuesday of the month. That is who it was built for.',
            ],
          },
        ],
        cta: { label: 'Take the last seat', url: c.offerUrl },
        outro: ['Whatever you choose, thank you for considering it. I mean that.'],
      }),
    },
  ],
};

/** All sequences, keyed by id. The engine looks definitions up here. */
export const SEQUENCES: Record<string, SequenceDefinition> = {
  [UPSELL_OS_SEQUENCE.id]: UPSELL_OS_SEQUENCE,
  [COACHING_EXTENSION_SEQUENCE.id]: COACHING_EXTENSION_SEQUENCE,
};

export function getSequence(id: string): SequenceDefinition | null {
  return SEQUENCES[id] ?? null;
}
