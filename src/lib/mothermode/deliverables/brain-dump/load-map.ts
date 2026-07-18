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
  table,
  loadBar,
  divider,
  nextStep,
  interactiveSlot,
  doc,
} from '../kit';

/**
 * Core 5: The Load Map. $10.
 * Beat: See the whole picture. Build spec: docs/offer-resources/brain-dump-system.md §5.5.
 * A one-page visual of who is carrying what across the whole household,
 * built from the domains already sorted in the earlier resources.
 */
export const loadMap: DeliverableDoc = {
  slug: 'brain-dump-system',
  key: 'load-map',
  title: 'The Load Map',
  subtitle: 'One page that shows who is actually carrying what, across the whole house.',
  html: doc(
    eyebrow('Resource 5 of 5 &middot; See the whole picture'),
    h1('The Load Map'),
    lead(
      'Every resource so far has worked on your list. This one steps back and shows the shape of the whole load, across every domain, across every person in the house. Not to keep score. To finally see it.',
    ),
    p(
      'You cannot fix a shape you cannot see. Most households never lay this out plainly because it is uncomfortable to look at directly. That discomfort is exactly why it is worth doing once.',
    ),

    h2('Build it in three passes'),
    ol([
      'List your eight domains: school, health, home, money, food, social, work-logistics, extended family.',
      'For each domain, write who currently holds it: you, your partner, split, a kid, or nobody yet.',
      'Add a rough weight, light, medium, or heavy, based on how much ongoing attention it actually takes, not how it looks from outside.',
    ]),

    interactiveSlot('load-map-workspace'),

    h2('A filled example'),
    small('This is a real shape from a household with two working parents and two school-age kids. Yours will look different. The point is seeing it laid out at all.'),
    table(
      ['Domain', 'Currently held by', 'Weight'],
      [
        ['School', 'You', 'Heavy'],
        ['Health', 'You', 'Heavy'],
        ['Home', 'Split', 'Medium'],
        ['Money', 'Partner', 'Medium'],
        ['Food', 'You', 'Heavy'],
        ['Social', 'You', 'Medium'],
        ['Work logistics', 'Split', 'Light'],
        ['Extended family', 'You', 'Medium'],
      ],
    ),

    h2('What the shape usually shows'),
    p(
      'In the example above, five of eight domains sit with one person, and the heaviest three (school, health, food) all land on the same side. This is the pattern the Load Map is built to catch: not that one person does more, but that the same person holds the domains that never turn off.',
    ),
    loadBar('Held by you', 63, 'mode'),
    loadBar('Held by partner', 12, 'brass'),
    loadBar('Split', 25, 'mode'),

    callout(
      'A domain being heavy is not about the number of tasks in it. It is about whether it ever fully stops needing attention. School and health rarely turn off. That is what makes them heavy even when the task list inside them looks short.',
    ),

    divider(),

    h2('Once your map is drawn'),
    p('Look for these three patterns specifically. They point straight at what to do next.'),
    ul([
      '<strong>A domain with no clear owner.</strong> Usually the one quietly falling through, not because no one cares, but because everyone assumed someone else had it.',
      '<strong>The heaviest domains stacked on one person.</strong> Even a household that looks 50/50 by task count can be lopsided by weight if the heavy ones cluster on one side.',
      '<strong>A domain everyone assumes is split that is not.</strong> The gap between what a couple thinks is shared and what the map actually shows is often the most useful, and most uncomfortable, thing this resource surfaces.',
    ]),

    h2('What to do with what you see'),
    p(
      'This is not a resource for assigning blame. It is a resource for having an accurate conversation instead of a foggy one. "I feel like I do everything" is easy to argue with. A domain-by-domain map with weights on it is much harder to wave away, for either person looking at it.',
    ),
    pullQuote('You cannot fix a shape you cannot see.'),

    h3('Using it with a partner'),
    p(
      'Show the map, not a summary of it. Let your partner sit with the actual shape for a minute before either of you talks. Most of the defensiveness in these conversations comes from feeling accused. A page that just shows domains and weights, with no commentary attached, tends to land as information instead of an attack.',
    ),

    nextStep(
      'If the map surfaces a conversation that needs more than a quick script, use <strong>The Partner Conversation, Extended</strong> to hold it well, especially the parts that could get tense.',
    ),
  ),
};
