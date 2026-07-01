/**
 * Paid ads across Meta (Facebook and Instagram), TikTok, and X. Each carries
 * ad-manager fields (primary text, headline, description, CTA button) plus the
 * creative concept. Wedge-led, calibrated, direct response to the $7 Brain Dump.
 * Voice rules apply: no em dashes, no NO-list words.
 */
import type { ContentPiece } from './types';
import { IMAGE_STYLE } from './constants';

export const adsContent: ContentPiece[] = [
  {
    id: 'ad-meta-feed-1',
    platform: 'facebook',
    format: 'feed',
    kind: 'ad',
    tone: 'wedge',
    theme: 'The mental load',
    title: 'Meta feed ad: the broken system',
    hook: 'Motherhood was built for a woman who does not exist.',
    hooks: [
      'Motherhood was built for a woman who does not exist.',
      'You are running an operating system written for a woman who never existed.',
      'The system you are using was designed for a woman with no job, no ambition, no inner life.',
    ],
    media: {
      type: 'image',
      alt: 'Static ad: notebook and pen on bone, Mode aubergine headline lockup',
      aspect: 'aspect-[1/1]',
      hint: '1080 x 1080',
      prompt: `Square 1:1 advertising still life: a single notebook and pen on a warm bone surface with clean empty space in the upper third reserved for a headline, soft directional daylight, premium and uncluttered, no people, no text. ${IMAGE_STYLE}`,
    },
    cta: 'Empty your head in 20 minutes. $7.',
    ad: {
      primaryText:
        'You are not disorganized. You are running an operating system written for a woman with no career, no ambition, no inner life. So of course it crashes. The first fix is the cheapest one: get the mental load out of your head and onto one page. The Brain Dump System does it in 20 minutes, for $7.',
      headline: 'Empty your head in 20 minutes',
      description: 'The Brain Dump System. $7 today.',
      button: 'Shop now',
    },
    visual:
      'Static or 6s video. Mode 3 quiet object: notebook and pen on bone. Mode aubergine headline lockup.',
  },
  {
    id: 'ad-meta-reel-1',
    platform: 'instagram',
    format: 'reel',
    kind: 'ad',
    tone: 'confidante',
    theme: 'Invisible labor',
    title: 'Meta reel ad: 6 tabs',
    hook: '6 things running in your head that nobody else in this house knows about.',
    hooks: [
      '6 things running in your head that nobody else in this house knows about.',
      'Six things are open in your head right now that no one else can see.',
      'Here are 6 tabs running in your mind that nobody in your house knows about.',
    ],
    media: {
      type: 'video',
      alt: 'Reel ad poster: documentary kitchen, hands on counter',
      aspect: 'aspect-[9/16]',
      hint: '1080 x 1920',
      prompt: `Vertical 9:16 advertising video still: close-up of a woman's hands resting on a kitchen counter in soft documentary daylight, a few everyday objects nearby, face out of frame, warm and authentic, room for a short on-screen caption at the top. ${IMAGE_STYLE}`,
    },
    script: [
      { at: 'Hook (0-3s)', onScreen: '6 tabs you never opened', voiceover: 'Six things are running in your head right now that nobody else in this house knows about.', visual: 'Documentary kitchen, hands on counter.' },
      { at: 'Build (3-12s)', onScreen: 'and they never close', voiceover: 'The dentist. The shoes. The field trip cash. The friend you meant to call. They never close, and they are exhausting you.', visual: 'Quick cuts of quiet objects.' },
      { at: 'CTA (12-20s)', onScreen: 'empty your head. $7.', voiceover: 'Get all of it onto one page in 20 minutes. Seven dollars. Tap shop now.', visual: 'Notebook page filling up.' },
    ],
    caption: 'The mental load is not the tasks. It is the remembering. $7.',
    cta: 'Tap Shop now. $7.',
    ad: {
      primaryText:
        'The mental load is not your to-do list. It is the remembering, for everyone, all the time. Get it out of your head in 20 minutes. The Brain Dump System, $7.',
      headline: 'Get your head back. $7',
      description: 'The Brain Dump System.',
      button: 'Shop now',
    },
    visual: 'Vertical 1080 x 1920, native reel look, warm grade.',
  },
  {
    id: 'ad-tiktok-1',
    platform: 'tiktok',
    format: 'video',
    kind: 'ad',
    tone: 'wedge',
    theme: 'Permission',
    title: 'TikTok Spark ad: canceling on yourself',
    hook: 'You did not skip your own appointment because you stopped caring.',
    hooks: [
      'You did not skip your own appointment because you stopped caring.',
      'You did not cancel on yourself because you stopped caring. You ran out of minutes.',
      'You keep canceling your own plans, and it is not for the reason you think.',
    ],
    media: {
      type: 'video',
      alt: 'Spark ad poster: creator talk-to-camera, native, no polish',
      aspect: 'aspect-[9/16]',
      hint: '1080 x 1920',
      prompt: `Vertical 9:16 native creator video still: a woman talking directly to camera in a real home, soft natural light, slightly handheld and unpolished like a genuine social post, candid expression, authentic and warm. ${IMAGE_STYLE}`,
    },
    script: [
      { at: 'Hook (0-2s)', onScreen: 'why you keep canceling on yourself', voiceover: 'You did not cancel your own appointment because you stopped caring about yourself.', visual: 'Creator talk-to-camera, native, no ad polish.' },
      { at: 'Truth (2-12s)', onScreen: 'you could not find 50 minutes', voiceover: 'You canceled because you could not find 50 minutes. The mental load takes your time first.', visual: 'Cut to calendar, back to face.' },
      { at: 'CTA (12-20s)', onScreen: 'start with your head. $7.', voiceover: 'It starts by getting the load out of your head. A 20-minute system. Seven dollars. Tap to get it.', visual: 'Notebook on bone surface.' },
    ],
    caption: 'you are not the problem. the system is. $7 to start.',
    cta: 'Tap to start. $7.',
    ad: {
      primaryText:
        'The mental load steals your time before it steals anything else. Get it out of your head in 20 minutes. The Brain Dump System, $7.',
      headline: 'Start with your head. $7',
      description: 'The Brain Dump System.',
      button: 'Shop now',
    },
    visual: 'Spark ad from a creator post. Keep it native and unpolished.',
  },
  {
    id: 'ad-x-1',
    platform: 'x',
    format: 'feed',
    kind: 'ad',
    tone: 'authority',
    theme: 'The mental load',
    title: 'X promoted post: the design problem',
    hook: 'The mental load is a design problem, not a character flaw.',
    hooks: [
      'The mental load is a design problem, not a character flaw.',
      'Your mental load is a design problem. It is not a flaw in you.',
      'The weight you carry is a design failure, not a personal one.',
    ],
    media: {
      type: 'image',
      alt: 'Single image card: quiet-object still, Mode aubergine headline',
      aspect: 'aspect-[1/1]',
      hint: '1080 x 1080',
      prompt: `Square 1:1 advertising still life: a single notebook with a pen on a warm bone surface, soft daylight, clean negative space reserved for a headline, restrained and premium, no people, no text. ${IMAGE_STYLE}`,
    },
    body: [
      'The mental load is a design problem, not a character flaw. The fix is not a better calendar. It is getting every open tab out of your head and onto one page. The Brain Dump System does it in 20 minutes. $7.',
    ],
    cta: 'The Brain Dump System. $7.',
    ad: {
      primaryText:
        'The mental load is a design problem, not a character flaw. Get every open tab out of your head in 20 minutes. $7.',
      headline: 'Empty your head in 20 minutes',
      description: 'The Brain Dump System, $7.',
      button: 'Learn more',
    },
    visual: 'Single image card: quiet-object still, Mode aubergine headline.',
  },
  {
    id: 'ad-meta-feed-2',
    platform: 'facebook',
    format: 'feed',
    kind: 'ad',
    tone: 'confidante',
    theme: 'The default parent',
    title: 'Meta feed ad: the family search engine',
    hook: 'You are the only one who knows where anything is. That is not a gift. It is unpaid overtime.',
    hooks: [
      'You are the only one who knows where anything is. That is not a gift. It is unpaid overtime.',
      'You are the family search engine. That is not devotion. It is unpaid overtime.',
      'Being the only one who knows where everything is is not a talent. It is a second shift.',
    ],
    media: {
      type: 'image',
      alt: 'Static ad: small shoes and a school form by a door, warm light',
      aspect: 'aspect-[4/5]',
      hint: '1080 x 1350',
      prompt: `Portrait 4:5 advertising still life: a pair of small children's shoes and a school permission form resting by a front door in warm afternoon light, lived-in and tender, no people, room for a headline above. ${IMAGE_STYLE}`,
    },
    cta: 'Get it out of your head in 20 minutes. $7.',
    ad: {
      primaryText:
        'You know the shoe sizes, the snack rotation, the day the form is due, and the name of the kid who was mean at recess. You are the family search engine, and the searching never stops. It does not have to live in your head. Get the whole load onto one page in 20 minutes. The Brain Dump System, $7.',
      headline: 'Get the load out of your head. $7',
      description: 'The Brain Dump System.',
      button: 'Shop now',
    },
    visual: 'Static or 6s video. Mode 3 quiet object, warm light. No faces.',
  },
];
