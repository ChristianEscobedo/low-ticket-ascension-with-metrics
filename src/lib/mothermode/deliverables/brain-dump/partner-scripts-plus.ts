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
  personHeader,
  scriptCard,
  divider,
  nextStep,
  appPromo,
  doc,
} from '../kit';

/**
 * Order bump: The partner conversation, extended. $7.97.
 * The full library for the harder asks, plus how to hold the conversation
 * when it gets tense. See docs/offer-resources/brain-dump-system.md §7.2.
 */
export const partnerScriptsPlus: DeliverableDoc = {
  slug: 'brain-dump-system',
  key: 'partner_scripts_plus',
  title: 'The Partner Conversation, Extended',
  subtitle: 'The full script library for the harder asks, and how to hold it when it gets tense.',
  html: doc(
    eyebrow('Order bump &middot; $7.97'),
    h1('The Partner Conversation, Extended'),
    lead(
      'The Delegate Scripts cover the everyday handoffs. This is for the harder ones: the pattern that has repeated for years, the load that never got named out loud, and the conversation that might not go smoothly the first time you have it.',
    ),
    p(
      'Nothing here is about winning an argument. It is about saying the true thing plainly, staying with it when it gets uncomfortable, and having a way back to the topic if it goes sideways the first time.',
    ),

    divider(),

    h2('Before the conversation'),
    ol([
      'Pick a low-stakes moment. Not mid-conflict, not right before either of you has to leave the house.',
      'Have The Load Map filled out and ready to show, not summarized from memory.',
      'Decide the one thing you actually want to change from this conversation. One thing, not five.',
      'Expect it might take more than one sitting. That is normal, not a failure of the conversation.',
    ]),

    h2('Opening the harder conversation'),
    scriptCard(
      'Naming the pattern, not just the task',
      'Softer',
      'I want to talk about something that is not really about any one task. It is about a pattern I have noticed, and I would like us to look at it together.',
    ),
    scriptCard(
      'Naming the pattern, not just the task',
      'Firmer',
      'This is not about the dishes tonight. It is about a pattern that has gone on for a while, and I need us to actually talk about it, not just this one thing.',
    ),
    scriptCard(
      'Showing the Load Map',
      'Opening line',
      'I mapped out who is holding what across the house. I am not showing you this to make a point. I want us to look at it together and see if it matches what you would have guessed.',
    ),

    divider(),

    personHeader('When it gets defensive', 'the moment most conversations stall'),
    scriptCard(
      'When he says "I do plenty"',
      'Redirect, not counter',
      'I am not saying you do nothing. I am saying these specific domains have sat with me for a long time, and I want that to change, starting with one of them.',
    ),
    scriptCard(
      'When he says "just ask me and I will do it"',
      'Naming the real ask',
      'The asking is part of what I am carrying. I want you to notice these things too, not just wait for me to assign them.',
    ),
    scriptCard(
      'When the conversation goes quiet',
      'Holding the pause',
      'We do not have to solve this all tonight. Can we agree on one thing to change this week, and talk about the rest later?',
    ),

    divider(),

    personHeader('When it gets tense', 'raised voices, shutting down, or walking away'),
    p(
      'These are for the moments the conversation stops being productive. The goal here is not to finish the conversation. It is to leave the door open for round two.',
    ),
    scriptCard(
      'If voices are rising',
      'De-escalating without dropping it',
      'I do not want this to turn into a fight. Can we pause for ten minutes and come back to it? This still matters to me and I am not letting it go.',
    ),
    scriptCard(
      'If he shuts down or goes quiet',
      'Keeping the door open',
      'I can tell this is hard to hear. We do not have to finish this tonight, but I want to come back to it this week, not let it drop.',
    ),
    scriptCard(
      'Re-opening after a hard round',
      'A day or two later',
      'I have been thinking about what we started talking about. Can we pick it back up? I still want us to land somewhere on it together.',
    ),

    callout(
      'A conversation that stalls once is not a failed conversation. It is round one of a conversation that continues. Come back to it.',
    ),

    divider(),

    h2('Landing on something concrete'),
    p(
      'Every version of this conversation should end with one specific, dated change, not a general feeling of "we talked about it." Vague agreements dissolve by Wednesday. Specific ones do not.',
    ),
    ul([
      '"You take the dentist scheduling starting this month" beats "you will help more with appointments."',
      '"We will look at the Load Map again in a month" beats "let us keep talking about this."',
      'Write the agreement down somewhere both of you will see it again. A shared note, a calendar entry, anything that outlives the conversation itself.',
    ]),

    pullQuote('A page that just shows the shape tends to land as information, not an attack.'),

    h3('If this becomes a repeating fight'),
    p(
      'If the same conversation keeps happening without anything actually changing, that is worth naming directly, and it is also worth considering outside support, a counselor or a mediator, not because anything is broken beyond repair, but because some patterns are easier to shift with a third person in the room.',
    ),

    appPromo(
      'Beyond the conversation',
      'Some patterns need a system, not just a talk',
      'A script can open the conversation. It cannot enforce a shared calendar every single week for the next ten years. The MotherMode OS gives both of you the same view of the household, with real assignments and real notifications, so the change from this conversation has something to live in besides goodwill.',
      [
        'Both partners see the same tasks, groceries, and calendar, not two separate mental lists.',
        'Assignments come with an accept and decline workflow, not a hope that it gets done.',
        'The Load Map becomes a living view instead of a page you filled out once.',
      ],
      'See family collaboration',
    ),

    nextStep(
      'Whatever you agree on, write it into next week&rsquo;s <strong>Weekly Reset</strong> so it becomes part of the rhythm instead of a one-time promise that quietly fades.',
    ),
  ),
};
