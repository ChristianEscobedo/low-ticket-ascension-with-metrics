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
  personHeader,
  scriptCard,
  divider,
  nextStep,
  interactiveSlot,
  doc,
} from '../kit';

/**
 * Core 3: The Delegate Scripts. $19.
 * Beat: Hand it off. Build spec: docs/offer-resources/brain-dump-system.md §5.3.
 * The exact words to hand off each Delegate-bucket item, grouped by recipient,
 * with a softer and firmer version of each ask, plus a "when it comes back" line.
 */
export const delegateScripts: DeliverableDoc = {
  slug: 'brain-dump-system',
  key: 'delegate-scripts',
  title: 'The Delegate Scripts',
  subtitle: 'The exact words to hand off what does not have to stay yours.',
  html: doc(
    eyebrow('Resource 3 of 5 &middot; Hand it off'),
    h1('The Delegate Scripts'),
    lead(
      'Knowing what to hand off was never the whole problem. Not knowing what to say when you hand it off is what quietly keeps it on your plate. These are the exact words.',
    ),
    p(
      'Every item in your Delegate bucket gets a script below, grouped by who it goes to. Each one has a softer version, a firmer version, and a line for when the task boomerangs back to you, because it usually tries to at least once.',
    ),
    note(
      'How to use these tonight',
      p(
        'Pick one script. Send it as-is or close to it. Do not soften it further in the moment, that is where these usually get lost. You already did the softening when you wrote it down calmly, earlier, not mid-request.',
      ),
    ),

    divider(),

    personHeader('A partner', 'the person sharing this house with you'),
    p('Use these for anything the sorting pass placed in Delegate and the other adult in the house is positioned to take.'),
    scriptCard(
      'Handing off a recurring task',
      'Softer',
      'I would like you to take over the dentist scheduling starting this month. I will send you the current info once, and it is yours from there.',
    ),
    scriptCard(
      'Handing off a recurring task',
      'Firmer',
      'The dentist scheduling is moving to you starting this month. I am sending the info once tonight.',
    ),
    scriptCard(
      'When it comes back',
      'When it comes back to me',
      'I moved this to you last month. What do you need from me to close it out yourself?',
    ),

    scriptCard(
      'Splitting a load, not just a task',
      'Softer',
      'I have been holding most of the school logistics. Could we split it so you take Tuesdays and Thursdays and I take the rest?',
    ),
    scriptCard(
      'Splitting a load, not just a task',
      'Firmer',
      'I need us to split the school logistics starting this week. You have Tuesdays and Thursdays.',
    ),

    divider(),

    personHeader('Kids', 'old enough to hold part of it'),
    p('Short, plain, age-appropriate handoffs for tasks that do not require an adult, only a reminder that they are capable of them.'),
    scriptCard(
      'A standing chore',
      'Softer',
      'Starting this week, packing your own lunch bag in the morning is your job. I will help you set it up tonight so tomorrow is easy.',
    ),
    scriptCard(
      'A standing chore',
      'Firmer',
      'Lunch bags are your job now. I already put everything you need at your spot.',
    ),
    scriptCard(
      'When it comes back',
      'When they say they forgot',
      'That happens. Tomorrow it is still yours. Want a reminder note by the door?',
    ),

    divider(),

    personHeader('Extended family', 'grandparents, in-laws, the wider circle'),
    p('For the remembering work and coordination that quietly became yours without anyone deciding it should be.'),
    scriptCard(
      'Handing back a coordination task',
      'Softer',
      'I have been the one keeping track of everyone&rsquo;s birthdays and calling to remind about visits. Could we set up a shared reminder so it is not just me holding it?',
    ),
    scriptCard(
      'Handing back a coordination task',
      'Firmer',
      'I am not going to keep being the reminder system for the whole family. I am setting up a shared calendar this week, everyone adds their own dates.',
    ),
    scriptCard(
      'When it comes back',
      'When someone asks you to remind them anyway',
      'It is on the shared calendar now. That is the best way for me to make sure you do not miss it.',
    ),

    divider(),

    personHeader('A friend or informal helper', 'carpool, playdates, favors'),
    p('For the social-logistics tasks that started as one favor and quietly became a standing arrangement.'),
    scriptCard(
      'Making an informal arrangement explicit',
      'Softer',
      'Would it work for you if we alternated carpool weeks instead of me driving every time? I am happy to start.',
    ),
    scriptCard(
      'Making an informal arrangement explicit',
      'Firmer',
      'I need us to alternate carpool weeks starting now. I will take this week, you take next.',
    ),

    divider(),

    interactiveSlot('delegate-tracker-workspace'),

    h2('When there is no one to hand it to'),
    p(
      'Some Delegate items genuinely have no other person available right now. That is real, and it is not a failure of this method. Two honest options: move it back to Keep for this season, or look again at whether it actually belongs in Drop or Automate instead. Delegate is not the only escape route.',
    ),

    h2('The line that makes all of these work'),
    pullQuote('State it as a decision already made, not a request for permission.'),
    p(
      'Notice the firmer scripts do not ask "would that be okay." They state what is happening and when. That is not about being harsh, it is about not making a task-handoff into a negotiation every single time. You already decided in the sorting pass. The script just delivers the decision.',
    ),

    h3('If it does not land the first time'),
    ul([
      'Repeat the same script again, unchanged. Do not escalate the wording, escalate the repetition.',
      'Give it a specific date, not "soon." "Starting Monday" works. "When you get a chance" does not.',
      'If it is a partner and it still is not moving, that is not a script problem anymore. Read The Partner Conversation, Extended for how to hold that talk when it gets tense.',
    ]),

    nextStep(
      'Whatever is left in Keep, plus whatever you automated, goes into <strong>The Weekly Reset</strong>, the ten-minute Sunday ritual that keeps all of this from quietly refilling by Wednesday.',
    ),
  ),
};
