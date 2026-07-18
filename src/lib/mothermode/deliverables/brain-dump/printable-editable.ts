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
  ul,
  checkItem,
  checklist,
  divider,
  nextStep,
  doc,
} from '../kit';

/**
 * Order bump: Printable + editable pack. $4.97.
 * Print-ready and editable twins of the five core resources, for the fridge
 * and for any device. See docs/offer-resources/brain-dump-system.md §7.1.
 */
export const printableEditable: DeliverableDoc = {
  slug: 'brain-dump-system',
  key: 'printable_editable',
  title: 'Printable + Editable Pack',
  subtitle: 'Print-ready PDFs and editable versions of every core resource, for the fridge and for any device.',
  html: doc(
    eyebrow('Order bump &middot; $4.97'),
    h1('Printable + Editable Pack'),
    lead(
      'Everything in the Brain Dump System works on a screen. This bump makes it work on paper too, and gives you an editable copy you can adjust on your phone, tablet, or laptop whenever life changes the details.',
    ),
    p(
      'You do not need special software. Every printable below is built to look right straight off a home printer, and every editable version is a plain, fillable copy you can update as your list changes week to week.',
    ),

    h2('What is in the pack'),
    checklist(
      [
        checkItem(
          'The Brain Dump Template, printable',
          'One page per domain, fridge or binder ready, so you can write by hand if that feels easier than typing.',
        ),
        checkItem(
          'The Sorting Pass, printable',
          'The four questions and four buckets laid out as a worksheet, so you can sort with a pen at the kitchen table.',
        ),
        checkItem(
          'The Delegate Scripts, editable',
          'A fillable doc with the softer and firmer lines already in place. Swap in names and details, then copy straight into a text.',
        ),
        checkItem(
          'The Weekly Reset, printable',
          'A single card for the ten-minute Sunday ritual. Tape it inside a cabinet door or keep it in the planner you already use.',
        ),
        checkItem(
          'The Load Map, printable',
          'A blank domain-by-weight grid, ready to fill in by hand for a household conversation without a screen between you.',
        ),
      ],
    ),

    divider(),

    h2('How to use the printables'),
    ul([
      'Print The Brain Dump Template first and keep it somewhere you will actually see it this week, not filed in a drawer.',
      'Fill in The Sorting Pass by hand right after, while the items are still fresh from the dump.',
      'Post The Weekly Reset card somewhere visible for the recurring ten minutes, a cabinet, a binder cover, the fridge.',
      'Save The Load Map for a sit-down conversation, not a rushed five minutes between tasks.',
    ]),

    note(
      'Editing on any device',
      p(
        'The Delegate Scripts editable doc is built to be opened and typed into directly from a phone. Fill in the specific name and task, then copy the finished line straight into a text message. No retyping from scratch every time you need a new script.',
      ),
    ),

    h2('Why paper still matters'),
    p(
      'A screen is easy to close. A printed page taped inside a cabinet door gets seen every single day, without you having to remember to open an app. For a ten-minute weekly ritual especially, visibility beats convenience.',
    ),
    callout(
      'The goal of a printable is not to look nice. It is to be seen without being opened.',
    ),

    h3('Keep the digital versions too'),
    small(
      'The printables do not replace your original core resources, they sit alongside them. Use the screen version when you are moving fast, the paper version when you want the list somewhere you cannot accidentally close.',
    ),

    nextStep(
      'Print The Weekly Reset card first. It is the one resource meant to live somewhere visible, every single week, starting this one.',
    ),
  ),
};
