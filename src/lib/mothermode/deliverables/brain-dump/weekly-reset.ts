import type { DeliverableDoc } from '../types';
import {
  eyebrow,
  h1,
  h2,
  h3,
  lead,
  p,
  small,
  note,
  callout,
  pullQuote,
  ul,
  ol,
  checkItem,
  checklist,
  divider,
  nextStep,
  interactiveSlot,
  doc,
} from '../kit';

/**
 * Core 4: The Weekly Reset. $17.
 * Beat: Stay caught up. Build spec: docs/offer-resources/brain-dump-system.md §5.4.
 * A ten-minute Sunday ritual that catches what refilled during the week before
 * it becomes a new brain dump.
 */
export const weeklyReset: DeliverableDoc = {
  slug: 'brain-dump-system',
  key: 'weekly-reset',
  title: 'The Weekly Reset',
  subtitle: 'A ten-minute Sunday ritual so the list never gets big enough to need a dump again.',
  html: doc(
    eyebrow('Resource 4 of 5 &middot; Stay caught up'),
    h1('The Weekly Reset'),
    lead(
      'A brain dump empties the list once. Life keeps adding to it. The reset is what keeps the list from filling back up to the point where you need to do this all over again.',
    ),
    p(
      'This is not a new system. It is the same four questions from The Sorting Pass, run on a ten-minute timer, once a week, on whatever new items landed since last time. Small and boring on purpose. That is the entire point.',
    ),
    note(
      'Set it once',
      p(
        'Pick a day and a time that already exists in your week, Sunday night after the kids are down, or Sunday morning with coffee before anyone is up. Put a ten-minute recurring hold on the calendar right now. This resource is what happens inside that hold.',
      ),
    ),

    divider(),

    h2('The ten-minute sequence'),
    ol([
      '<strong>Two minutes: catch what is new.</strong> Anything that landed on you this week that is not already sorted. Write it down, do not sort it yet.',
      '<strong>Four minutes: run the sorting pass on it.</strong> Drop, Automate, Delegate, or Keep. Same four questions, same order, same speed as before.',
      '<strong>Two minutes: check the Delegate bucket.</strong> Did anything you handed off boomerang back? If yes, use the "when it comes back" line, do not just quietly take it back.',
      '<strong>Two minutes: look one week ahead.</strong> Anything with a deadline in the next seven days that needs a decision now instead of at 9pm the night before.',
    ]),

    h2('The weekly checklist'),
    small('Run through this every time. It should feel identical each week, that is the design.'),
    checklist(
      [
        checkItem('New items captured', 'Whatever landed on you since the last reset.'),
        checkItem('New items sorted', 'Every one placed in Drop, Automate, Delegate, or Keep.'),
        checkItem('Delegate bucket checked', 'Anything that boomeranged back, addressed with a script.'),
        checkItem('Next 7 days scanned', 'Any deadline that needs a decision before it becomes urgent.'),
        checkItem('Automations still holding', 'Nothing quietly reverted to manual (a cancelled autopay, a paused order).'),
      ],
    ),

    interactiveSlot('weekly-reset-workspace'),

    divider(),

    h2('What good enough looks like'),
    p(
      'You are not trying to have zero open items after a reset. You are trying to have zero items that have been sitting, unsorted, in your head instead of on the page. Keep can still have things in it. Keep with things you chose is a different weight than Keep by default.',
    ),
    callout(
      'The goal is not an empty list. The goal is a list that lives on paper instead of in you.',
    ),

    h2('If you skip a week'),
    p(
      'You will, at some point. The reset does not break because you missed one. Just do a slightly longer one next time, fifteen minutes instead of ten, and catch two weeks of new items instead of one. It does not compound the way an unsorted brain dump does, because you already have the buckets built. You are just refilling a system that exists, not building one from nothing.',
    ),

    h2('Signs it is time for a bigger reset'),
    ul([
      'Your Keep bucket has quietly grown past what feels manageable in ten minutes.',
      'You are avoiding the weekly reset itself, which usually means something in it feels heavier than it should.',
      'A whole new domain has entered your life (a new school year, a new diagnosis, a move) that the original brain dump never covered.',
    ]),
    p(
      'When you notice any of these, do not force it into the ten-minute version. Go back to The Brain Dump Template for that one domain and run it fresh. The weekly reset is maintenance. It is not built to absorb a full new season on its own.',
    ),

    pullQuote('Boring on purpose is the feature, not the failure.'),

    h3('Why ten minutes works'),
    p(
      'A weekly cadence catches things while they are still small and specific, not after they have piled up into something vague and heavy that feels impossible to start on. Ten minutes is short enough that you will not skip it, and long enough to actually catch what matters.',
    ),

    nextStep(
      'Once the reset feels automatic, use <strong>The Load Map</strong> to see the whole picture: who is actually carrying what across the house, not just what is on your personal list.',
    ),
  ),
};
