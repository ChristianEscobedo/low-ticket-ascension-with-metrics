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
  table,
  divider,
  nextStep,
  appPromo,
  doc,
} from '../kit';

/**
 * Core 2: The Sorting Pass. $24.
 * Beat: Decide once. Build spec: docs/offer-resources/brain-dump-system.md §5.2.
 * Moves every item from the Brain Dump into Drop, Automate, Delegate, or Keep,
 * one time, using one deciding question per bucket instead of open judgment.
 */
export const sortingPass: DeliverableDoc = {
  slug: 'brain-dump-system',
  key: 'sorting-pass',
  title: 'The Sorting Pass',
  subtitle: 'Move each item into Drop, Automate, Delegate, or Keep. One time, not every night.',
  html: doc(
    eyebrow('Resource 2 of 5 &middot; Decide once'),
    h1('The Sorting Pass'),
    lead(
      'Writing the list down was never the hard part. The hard part is deciding what to do with each line, over and over, every time it crosses your mind. This resource makes that decision exactly once per item.',
    ),
    p(
      'Take the list from The Brain Dump Template. You are going to run every single item through four short questions, in order. The first question that gets a yes decides where it goes. Do not think longer than a few seconds per item. Speed is part of the method, not a shortcut around it.',
    ),

    h2('The four questions, in order'),
    p('Ask these about one item at a time. Stop at the first yes.'),
    table(
      ['Question', 'A yes means'],
      [
        ['Does this actually have to happen at all?', 'No: <strong class="text-mode">Drop it.</strong> Cross it off. Nothing replaces it.'],
        ['Could a tool or a standing order do this instead?', 'Yes: <strong class="text-mode">Automate it.</strong> A subscription, an autopay, a recurring calendar hold.'],
        ['Did anyone actually assign this to you?', 'No: <strong class="text-mode">Delegate it.</strong> It goes to Core 3, The Delegate Scripts.'],
        ['None of the above', '<strong class="text-mode">Keep it.</strong> It is genuinely yours, for now.'],
      ],
    ),
    note(
      'The order matters',
      p(
        'Always ask "does this have to happen" first. Mothers skip straight to "who should do this" and end up delegating tasks that should have been dropped entirely. Drop before you delegate. A task no one has to do is lighter than a task someone else does.',
      ),
    ),

    divider(),

    h2('Drop: does this actually have to happen?'),
    p(
      'Most lists have more of these than you expect. A "no" here does not mean you failed to do it. It means the task was never load-bearing in the first place.',
    ),
    ul([
      'The birthday card you feel obligated to mail but no one would notice missing.',
      'The Pinterest-worthy lunch when a sandwich is fine.',
      'The RSVP to an event you do not actually want to attend.',
      'The subscription box that arrives and gets set aside, unopened, every month.',
    ]),
    callout(
      'Ask it plainly: if this never happened, what would actually go wrong? If the honest answer is "nothing," you have your yes.',
    ),

    h2('Automate: could a tool or a standing order do this?'),
    p(
      'This bucket is for anything that repeats on a predictable schedule and does not need your judgment each time it happens.',
    ),
    ul([
      'Bills on autopay instead of a mental due-date calendar.',
      'A standing grocery order for the staples that never change.',
      'Prescription auto-refill instead of a monthly pharmacy call.',
      'A recurring calendar hold for the thing that happens every single week anyway.',
    ]),
    p(
      'Automate is not "figure out the perfect system later." It is: does this specific task have a switch you can flip once and stop thinking about? If yes, flip it this week.',
    ),

    h2('Delegate: did anyone actually assign this to you?'),
    p(
      'This is the question that catches the most invisible labor. Most delegate items were never formally handed to you. They landed on you by default, because you were the one who noticed first, the one time, and then it just stayed.',
    ),
    ul([
      'The dentist scheduling that became yours because you called once, three years ago.',
      'The gift-buying for his side of the family.',
      'The permission slip that could just as easily be signed by anyone in the house who can hold a pen.',
      'The grandparent updates that somehow always come from you.',
    ]),
    callout(
      'If no one actually assigned it, it is not more yours than anyone else&rsquo;s. It is just the one nobody else has picked up yet.',
    ),
    small(
      'Put every item that lands here into a running Delegate bucket. The Delegate Scripts resource writes the exact words to hand each one off.',
    ),

    h2('Keep: what is left'),
    p(
      'Whatever survives all three questions is genuinely, currently yours. That is not a defeat. A shorter Keep pile that you chose on purpose carries differently than a long one you never looked at directly.',
    ),
    p(
      'Some Keep items are keep-for-now, not keep-forever. Flag anything that might move buckets once circumstances change (a kid gets older, a partner&rsquo;s schedule shifts). The Weekly Reset revisits these.',
    ),

    divider(),

    h2('A worked example'),
    p('Here is the sorting pass run on five real items from a brain dump, so you can see the pace.'),
    table(
      ['Item', 'Question that landed', 'Bucket'],
      [
        ['Birthday card for a coworker&rsquo;s kid', 'Does this have to happen? No.', 'Drop'],
        ['Pediatric dentist reminder', 'Tool could handle it. Auto-reminder set.', 'Automate'],
        ['Grandma&rsquo;s birthday call', 'Assigned to you? No, just always you.', 'Delegate'],
        ['Field trip form, due Friday', 'Assigned to you? Yes, you are the signer.', 'Keep'],
        ['Weekly grocery restock of staples', 'Tool could handle it. Standing order set.', 'Automate'],
      ],
    ),

    h2('Count it when you are done'),
    p(
      'Add up how many items landed in each bucket. Most mothers see roughly a third of the list leave the Keep pile entirely between Drop and Automate, before anyone has to have a single conversation about delegating anything.',
    ),
    pullQuote('A third of the list is gone before you do a single task.'),

    h3('Why this works'),
    p(
      'The real cost of a task was never doing it. It was re-deciding it, every time it resurfaced, at whatever hour it happened to cross your mind. You just paid that decision cost once, on purpose, instead of nightly, by accident.',
    ),

    appPromo(
      'While you are here',
      'The OS does this sorting automatically',
      'You just ran four questions on a page. The MotherMode OS runs the same judgment on anything new that lands in your family, in the background, so a fresh item never sits unsorted in your head waiting for the next brain dump.',
      [
        'New requests get sorted the moment they arrive, not once a week.',
        'Automate-bucket items become real standing orders and calendar holds, not just a note to set one up.',
        'Delegate-bucket items go out as real assignments your partner can accept, not just a script you have to remember to send.',
      ],
      'See the OS',
    ),

    nextStep(
      'Take everything in your Delegate bucket to <strong>The Delegate Scripts</strong>. That resource writes the exact words to hand each one off, so asking stops being harder than doing.',
    ),
  ),
};
