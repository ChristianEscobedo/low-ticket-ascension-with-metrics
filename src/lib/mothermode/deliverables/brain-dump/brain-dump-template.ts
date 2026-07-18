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
  pullQuote,
  ul,
  checkItem,
  checklist,
  divider,
  nextStep,
  interactiveSlot,
  doc,
} from '../kit';

/**
 * Core 1: The Brain Dump Template. $27.
 * Beat: Get it out. Build spec: docs/offer-resources/brain-dump-system.md §5.1.
 * Pulls every open tab out of her head, domain by domain, onto one page.
 */
export const brainDumpTemplate: DeliverableDoc = {
  slug: 'brain-dump-system',
  key: 'brain-dump-template',
  title: 'The Brain Dump Template',
  subtitle: 'Get every open tab out of your head and onto one page.',
  html: doc(
    eyebrow('Resource 1 of 5 &middot; Get it out'),
    h1('The Brain Dump Template'),
    lead(
      'A blank page has failed you before. This is not a blank page. This is a set of prompts, domain by domain, built so nothing has to stay stored in your head by tonight.',
    ),
    p(
      'You do not need to remember everything at once. You only need to walk each domain below and write down whatever is already sitting there. Half the work is just noticing what you are carrying. This page does the noticing for you.',
    ),
    note(
      'How to use this tonight',
      p(
        'Set a timer for 20 minutes. Work top to bottom. Do not organize as you go, do not decide what matters yet, and do not skip a domain because it feels small. Small is still weight. Write in fragments if that is faster. This is a dump, not an essay.',
      ),
    ),

    h2('Before you start'),
    p(
      'Answer these once, in your head or on the page. They shape which domains actually apply to your house tonight.',
    ),
    ul([
      'How many kids, and roughly what ages.',
      'The domains that touch your life right now: school, health, home, money, food, social, work, extended family.',
      'The one thing already nagging you, right now, before you even start the list.',
    ]),
    p(
      'Write that nagging thing down first. Get it out of the way. Everything else on this page can wait a few seconds, but that one will not stop pulling at you until it is on paper.',
    ),

    interactiveSlot('brain-dump-workspace'),

    divider(),

    h2('Domain 1: School'),
    small('Anything with a due date, a form, or a teacher attached.'),
    checklist(
      [
        checkItem('Permission slips', 'Field trips, photo releases, activity forms.'),
        checkItem('Supply lists', 'Classroom asks, project materials, the thing due Friday.'),
        checkItem('Deadlines', 'Registration windows, project due dates, picture day.'),
        checkItem('Communication', 'Emails from teachers you meant to reply to.'),
        checkItem('Logistics', 'Pickup changes, early releases, half days.'),
        checkItem('Money', 'Field trip fees, book fair cash, fundraiser envelopes.'),
      ],
    ),

    h2('Domain 2: Health'),
    small('The tracking job nobody sees until it is overdue.'),
    checklist(
      [
        checkItem('Appointments', 'Dentist, pediatrician, orthodontist, the eye exam you keep pushing.'),
        checkItem('Prescriptions', 'Refills, the pharmacy that is out of stock, insurance calls.'),
        checkItem('Symptoms to watch', 'The thing you noticed and meant to mention at the next visit.'),
        checkItem('Growth logistics', 'Shoes that do not fit, the coat that is too small, sizes to check.'),
        checkItem('Records', 'Forms for camp, sports physicals, vaccine records for school.'),
      ],
    ),

    h2('Domain 3: Home'),
    small('The house running underneath the house.'),
    checklist(
      [
        checkItem('Repairs', 'The thing that has been broken long enough you stopped noticing it.'),
        checkItem('Maintenance', 'Filters, batteries, the smoke detector that chirps at 2am.'),
        checkItem('Supplies', 'What is actually low, not what you think is low.'),
        checkItem('Seasonal', 'The bin that needs swapping, the thing that only matters twice a year.'),
        checkItem('Services', 'The appointment you need to book and keep forgetting to call for.'),
      ],
    ),

    h2('Domain 4: Money'),
    small('Not budgeting. Just naming what is open.'),
    checklist(
      [
        checkItem('Bills', 'Anything due, anything you are not sure got paid.'),
        checkItem('Subscriptions', 'The one you meant to cancel three months ago.'),
        checkItem('Reimbursements', 'Receipts to submit, forms to file, money owed to you.'),
        checkItem('Upcoming costs', 'Camp deposits, registration fees, the thing coming next month.'),
      ],
    ),

    h2('Domain 5: Food'),
    small('The decision that repeats every single day.'),
    checklist(
      [
        checkItem('This week', 'What is actually planned versus what you are hoping to figure out.'),
        checkItem('Groceries', 'What is out, what is almost out, what someone asked for.'),
        checkItem('Lunches', 'What needs packing, what they will not eat anymore.'),
        checkItem('Special requests', 'Allergies, the picky new phase, the birthday snack sign-up.'),
      ],
    ),

    h2('Domain 6: Social'),
    small('The invitations and obligations that live in your inbox, not theirs.'),
    checklist(
      [
        checkItem('Invitations', 'RSVPs waiting on you, the party you have not responded to.'),
        checkItem('Gifts', 'Birthdays coming up, the gift you still need to buy or wrap.'),
        checkItem('Playdates', 'The one you promised and never scheduled.'),
        checkItem('Your own', 'The friend you owe a text, the plan you keep pushing.'),
      ],
    ),

    h2('Domain 7: Work'),
    small('Only if it is tangled with home logistics right now.'),
    checklist(
      [
        checkItem('Schedule conflicts', 'The meeting that collides with pickup.'),
        checkItem('Time off', 'PTO you need to request for a school event or appointment.'),
        checkItem('Loose threads', 'The task you keep meaning to close out.'),
      ],
    ),

    h2('Domain 8: Extended family'),
    small('The remembering that quietly became your job.'),
    checklist(
      [
        checkItem('Dates', 'Birthdays, anniversaries, the call you keep meaning to make.'),
        checkItem('Care coordination', 'A parent, an in-law, a favor that got left with you.'),
        checkItem('Visits', 'The trip that needs planning, the visit that needs a plan.'),
      ],
    ),

    divider(),

    h2('If a domain does not apply'),
    p(
      'Skip it. This is not a test of thoroughness. A domain with nothing in it is not a failure, it is just not where your weight is sitting right now. Move to the next one.',
    ),

    h2('When you are done'),
    p(
      'Read it back once. Do not fix anything, do not judge the length. You will likely notice one of two things: either you already feel lighter, or you feel a little exposed by how much was actually in there. Both are the point. This is the first time the list has existed anywhere other than your head.',
    ),
    pullQuote('That is the list. It is out of your head and on the page now.'),

    h3('What just happened'),
    p(
      'A list that lives only in your head has exactly one feature: only you can read it. It cannot be shared, questioned, or split, so it defaults to you every time, by design. The moment it leaves your head and lands on a page, it becomes something someone else can see and carry. That is the whole trick, and you just did it.',
    ),

    nextStep(
      'Open <strong>The Sorting Pass</strong> and run this exact list through it. You do not have to decide what to do with any of this alone. The next resource does that part for you, one item at a time.',
    ),
  ),
};
