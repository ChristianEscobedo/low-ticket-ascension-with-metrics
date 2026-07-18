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
  checkItem,
  checklist,
  divider,
  nextStep,
  doc,
} from '../kit';

/**
 * Order bump: 3 bonus domain mini-packs. $9.97.
 * Deeper brain-dump prompts for money, health, and household, so those three
 * domains get the same treatment as the core system. See
 * docs/offer-resources/brain-dump-system.md §7.3.
 */
export const domainMinipacks: DeliverableDoc = {
  slug: 'brain-dump-system',
  key: 'domain_minipacks',
  title: '3 Bonus Domain Mini-Packs',
  subtitle: 'Deeper brain-dump prompts for money, health, and household, so no domain gets left in your head.',
  html: doc(
    eyebrow('Order bump &middot; $9.97'),
    h1('3 Bonus Domain Mini-Packs'),
    lead(
      'The Brain Dump Template covers eight domains at a walking pace. These three, money, health, and household, are usually the ones with the most hidden weight underneath them. This pack goes deeper into each.',
    ),
    p(
      'Use these exactly like the original template: set a short timer, work through the prompts, write in fragments, and do not sort as you go. Each mini-pack is its own domain, and you can run them separately, on separate nights if that is easier.',
    ),

    divider(),

    h2('Mini-pack 1: Money'),
    small('Not a budget. Just naming what is currently open.'),
    checklist(
      [
        checkItem('Recurring bills', 'Everything on autopay and everything that still requires you to remember and pay it manually.'),
        checkItem('Subscriptions', 'Every recurring charge, including the ones you forgot existed until you saw the statement.'),
        checkItem('Debts and payments owed', 'Anything you owe, anything owed to you, and where each one currently stands.'),
        checkItem('Insurance', 'Policies up for renewal, claims in progress, coverage you meant to double-check.'),
        checkItem('Upcoming costs', 'Camp deposits, school fees, the big expense you know is coming but have not planned for yet.'),
        checkItem('Financial conversations pending', 'The talk about the budget, the savings goal, the thing you have been putting off discussing.'),
      ],
    ),
    callout(
      'Money items carry extra weight because they combine two jobs at once: remembering the task, and doing the math around it. Naming them here separates the two.',
    ),

    h2('Mini-pack 2: Health'),
    small('The tracking job that spans every person in the house, not just the kids.'),
    checklist(
      [
        checkItem('Everyone&rsquo;s appointments', 'Not just the kids. Yours, your partner&rsquo;s, and any aging parents you help coordinate for.'),
        checkItem('Ongoing conditions', 'Anything being monitored, managed, or followed up on across anyone in the household.'),
        checkItem('Medications', 'Refills, dosage changes, new prescriptions, anything currently in flux.'),
        checkItem('Mental health', 'Therapy appointments, check-ins, anything you have been meaning to look into for yourself or someone else.'),
        checkItem('Preventive care', 'The screenings and check-ups that fall off the radar because nothing is wrong yet.'),
        checkItem('Insurance and paperwork', 'Claims, referrals, records that need requesting or forwarding.'),
      ],
    ),
    p(
      'Health tends to be the domain mothers most underestimate on the original template, because it feels like it should be occasional. Written out fully, it rarely is.',
    ),

    h2('Mini-pack 3: Household'),
    small('The house running underneath the house, in more detail than the original pass.'),
    checklist(
      [
        checkItem('Deferred repairs', 'Everything broken long enough that you stopped consciously noticing it.'),
        checkItem('Seasonal transitions', 'Clothing swaps, storage rotations, the things that only come up twice a year and are easy to forget between.'),
        checkItem('Recurring maintenance', 'Filters, servicing, anything with a schedule attached that nobody is actually tracking.'),
        checkItem('Supplies and restocking', 'Not groceries specifically, household basics: cleaning supplies, paper goods, the things that run out quietly.'),
        checkItem('Service providers', 'Anyone you need to call, schedule, or follow up with, a repair person, a cleaner, a contractor.'),
        checkItem('Organization projects', 'The closet, the garage, the drawer, whatever project keeps getting pushed to "someday."'),
      ],
    ),

    divider(),

    h2('Running all three'),
    p(
      'You do not need to do all three mini-packs in one sitting. Each one takes roughly the same fifteen to twenty minutes as the original template, one domain at a time. Doing them on separate nights, spread across a week, works just as well as doing them back to back.',
    ),
    pullQuote('Half the work is just noticing what you are carrying.'),

    h3('After each mini-pack'),
    p(
      'Run whatever you wrote through The Sorting Pass, exactly the same way you sorted the original brain dump. These items get the same four questions: does it have to happen, could a tool handle it, was it actually assigned to you, or is it genuinely yours to keep.',
    ),

    nextStep(
      'Once all three mini-packs are sorted, fold the new items into your next <strong>Weekly Reset</strong> so money, health, and household stay part of the ongoing rhythm instead of a one-time deep clean.',
    ),
  ),
};
