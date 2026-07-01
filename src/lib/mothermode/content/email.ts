/**
 * Email content: broadcasts and sequence emails for the MotherMode list. Each
 * carries a subject, preheader, body, and a single clear CTA to the $7 Brain
 * Dump. A header media slot is included on each. Confidante, Authority, Wedge,
 * and System registers. Voice rules apply: no em dashes, no NO-list words.
 */
import type { ContentPiece } from './types';
import { IMAGE_STYLE } from './constants';

const FROM = 'Loni at MotherMode';

export const emailContent: ContentPiece[] = [
  {
    id: 'email-welcome-1',
    platform: 'email',
    format: 'email',
    kind: 'organic',
    tone: 'confidante',
    theme: 'Welcome',
    title: 'Welcome email: the one page that quiets your head',
    hook: 'You signed up because something is running you, and you are ready for it to stop.',
    hooks: [
      'You signed up because something is running you, and you are ready for it to stop.',
      'You are here because the noise in your head finally got loud enough. Good. Start here.',
      'Something has been running you. You signed up to take it back. This is step one.',
    ],
    email: {
      subject: 'The 40 tabs in your head (and the one page that closes them)',
      preheader: 'Start here. It takes 20 minutes and it is the most relief I know.',
      from: FROM,
    },
    media: {
      type: 'image',
      alt: 'MotherMode header: a single notebook and pen on a bone surface',
      aspect: 'aspect-[16/9]',
      hint: '1200 x 600',
      prompt: `Landscape 16:9 email header still life: a single closed notebook and a slim pen on a warm bone surface, soft natural light and a long gentle shadow, generous negative space, calm and welcoming, no people. ${IMAGE_STYLE}`,
    },
    body: [
      'Here is the thing nobody says out loud. You are not disorganized. You are running an operating system that was written for a woman with no career, no ambition, and no inner life. So of course it crashes.',
      'The fix is not a better calendar. It is getting the load out of your head and onto one page, so your brain stops running 40 tabs at once. That is the whole first move, and it is the one that produces relief fastest.',
      'I built a 20-minute system that walks you through it. It is called the Brain Dump, and it is $7. Not a course. Not one more app to keep up with. Just the first honest step.',
    ],
    cta: 'Empty your head in 20 minutes. The Brain Dump System, $7.',
    visual: 'Header image plus a single CTA button in Mode aubergine.',
  },
  {
    id: 'email-story-1',
    platform: 'email',
    format: 'email',
    kind: 'organic',
    tone: 'authority',
    theme: 'Invisible labor',
    title: 'Broadcast: the family CEO nobody pays',
    hook: 'Every family has a CEO. She is also exhausted, invisible, and slowly disappearing.',
    hooks: [
      'Every family has a CEO. She is also exhausted, invisible, and slowly disappearing.',
      'You run the most complex operation in your house, unpaid and unseen.',
      'There is a CEO in your family. Nobody pays her, and nobody sees the work.',
    ],
    email: {
      subject: 'You are the CEO of your family. Nobody pays you.',
      preheader: 'The load is not heavy because you are bad at this. It is heavy because of where it lives.',
      from: FROM,
    },
    media: {
      type: 'image',
      alt: 'Quiet object: calendar corner and mail on a bone island',
      aspect: 'aspect-[16/9]',
      hint: '1200 x 600',
      prompt: `Landscape 16:9 still life: the corner of a wall calendar and a small stack of unopened mail on a warm bone kitchen island, soft daylight, a set of keys nearby, the quiet evidence of a household being managed, no people. ${IMAGE_STYLE}`,
    },
    body: [
      'You know the pediatrician number by heart. You track the dentist, the school deadlines, the shoes two sizes up by spring. You carry the emotional weather for everyone, and you notice when something is off with one of the kids before anyone else does.',
      'You run the most complex operation most companies could not survive, with no salary and no system. The economists call it invisible labor. The women living it call it suffocation.',
      'Here is the part that matters. The load is not heavy because you are bad at organizing. It is heavy because it all lives in one place: your head. The redesign starts by moving it onto a page you can see.',
    ],
    cta: 'Start the redesign for $7. The Brain Dump System.',
    visual: 'Header image, then body, then one Mode aubergine button.',
  },
  {
    id: 'email-permission-1',
    platform: 'email',
    format: 'email',
    kind: 'organic',
    tone: 'wedge',
    theme: 'Permission',
    title: 'Broadcast: you canceled on yourself again',
    hook: 'You canceled your own appointment again, and it was not because you stopped caring.',
    hooks: [
      'You canceled your own appointment again, and it was not because you stopped caring.',
      'You canceled on yourself again. Not from neglect. From a load that takes your time first.',
      'The thing you canceled this week was yours. Here is why it keeps happening.',
    ],
    email: {
      subject: 'Why you keep canceling on yourself',
      preheader: 'You could not find the 50 minutes. The load takes your time first.',
      from: FROM,
    },
    media: {
      type: 'image',
      alt: 'Quiet object: a phone face-down on a nightstand in warm lamp light',
      aspect: 'aspect-[16/9]',
      hint: '1200 x 600',
      prompt: `Landscape 16:9 still life: a smartphone face-down on a wooden nightstand beside a warm glowing lamp, the room dim around it, a book and a glass of water nearby, intimate late-evening mood, no people. ${IMAGE_STYLE}`,
    },
    body: [
      'You did not cancel because you stopped caring about yourself. You canceled because you could not find the 50 minutes. The mental load takes your time first, before it takes anything else you love.',
      'Here is your permission. You are allowed to want that time back. Not when things calm down. They are not going to calm down on their own.',
      'It starts by getting the load out of your head. I made a 20-minute system for exactly that. Seven dollars. The first room of a much larger redesign.',
    ],
    cta: 'Start with your head. The Brain Dump System, $7.',
    visual: 'Header image, short body, single button.',
  },
  {
    id: 'email-ascension-1',
    platform: 'email',
    format: 'email',
    kind: 'organic',
    tone: 'system',
    theme: 'The system',
    title: 'Sequence: from one page to an assistant that carries it',
    hook: 'You emptied your head once. Here is how to keep it that way.',
    hooks: [
      'You emptied your head once. Here is how to keep it that way.',
      'The one page gave you a quiet hour. Here is how to get the quiet back every day.',
      'You did the brain dump. Now let something carry the load with you.',
    ],
    email: {
      subject: 'You emptied your head. Now keep it that way.',
      preheader: 'The pack empties one list, once. This carries the load with you every day.',
      from: FROM,
    },
    media: {
      type: 'image',
      alt: 'App screenshot: chat planning the week on a phone',
      aspect: 'aspect-[16/9]',
      hint: '1200 x 600',
      prompt: `Editorial product mockup, landscape 16:9: a warm bone background with a single smartphone held gently in frame, the screen showing a calm minimal messaging-style planning assistant in deep aubergine (#532B3C) and bone (#F5F1EB) with aged brass (#A88B5C) accents, soft natural light, shallow depth of field, fine film grain, photorealistic, high resolution, no brand logos.`,
    },
    body: [
      'The Brain Dump empties one list, one time. That is the relief. But the load fills back up, because the week keeps coming.',
      'The MotherMode OS is the next step. It is an assistant you talk to like a text. Tell it about your kids once, and it plans the meals, builds the routines, and writes the grocery list with you. No streak to protect, no feed, nothing blinking for your attention. It does the work and waits.',
      'If the one page gave you a quiet hour, this gives you the quiet back every day.',
    ],
    cta: 'Meet the MotherMode OS. Open your account to see it.',
    link: '/mothermode/upsell',
    visual: 'Header screenshot, then body, then a single Mode aubergine button.',
  },
];
