/**
 * LinkedIn organic content, written entirely in the founder's first-person
 * voice: I built MotherMode, and I use it. The audience is career and business
 * women, so the framing is operational, the mental load as an operations
 * problem, not a feelings problem. One piece of each native LinkedIn type: a
 * text feed post, a single-image post, a document carousel, an article, and a
 * native video. Every CTA routes to the $7 Brain Dump. Voice rules apply: no
 * em dashes, no NO-list words.
 */
import type { ContentPiece } from './types';
import { CORE_HASHTAGS, IMAGE_STYLE } from './constants';

export const linkedinContent: ContentPiece[] = [
  {
    id: 'li-text-1',
    platform: 'linkedin',
    format: 'feed',
    kind: 'organic',
    tone: 'authority',
    theme: 'Founder POV',
    title: 'Text post: I run a company and I could not run my own house',
    hook: 'I can run a company and I could not run my own house. Here is what finally changed.',
    hooks: [
      'I can run a company and I could not run my own house. Here is what finally changed.',
      'I had a system for every project at work and none for the one running in my head at home.',
      'The most capable women I know are quietly drowning at home. I was one of them.',
    ],
    caption: `I can run a company. For years I could not run my own house.

Not because I lacked the skill. At work I had a system for everything: owners, deadlines, a single place the whole plan lived. At home, the plan lived in exactly one place. My head. And I was the only person who could see it.

That is the mental load, and it is an operations problem, not a personality flaw. It is the invisible work of noticing, remembering, and deciding for everyone, with no handoff and no off switch. You can be excellent at your job and completely underwater in this at the same time. The two are not related, which is exactly why so many high-performing women miss it in themselves.

What changed for me was simple and a little embarrassing, given what I do for a living. I gave my own life the same treatment I give a project. Once a week, I get every open loop out of my head and onto one page. Then I sort it: keep, share, simplify, drop. Then I hand off whole areas, not single tasks, so I stop being the manager who has to notice and remind.

I built MotherMode because I could not find a version of this that respected that we are competent adults. If you are the capable one who is somehow still carrying all of it, start by seeing the true size of the load. It is the first honest step.`,
    cta: 'I turned my weekly reset into a 20-minute tool. The Brain Dump System is $7, link below.',
    hashtags: [...CORE_HASHTAGS, 'MentalLoad', 'WorkingParents'],
    visual: 'Text-only LinkedIn feed post. No media, first-person founder voice.',
  },
  {
    id: 'li-image-1',
    platform: 'linkedin',
    format: 'feed',
    kind: 'organic',
    tone: 'authority',
    theme: 'The mental load at work',
    title: 'Single image: your best people are running two operating systems',
    hook: 'Your best people are running two operating systems. You only pay for one.',
    hooks: [
      'Your best people are running two operating systems. You only pay for one.',
      'The load that burns out your top performers is not the one on their calendar.',
      'She is not distracted. She is running an entire second job you cannot see.',
    ],
    media: {
      type: 'image',
      alt: 'LinkedIn image: a clean desk with a laptop on one side and a family calendar on the other in soft daylight',
      aspect: 'aspect-[1.91/1]',
      hint: '1200 x 627',
      prompt: `Landscape 1.91:1 professional LinkedIn image: a clean modern desk photographed from above with a laptop on one side and a full handwritten family calendar on the other, soft daylight, the quiet collision of work and home, generous negative space for a short overlay, no people, no text. ${IMAGE_STYLE}`,
    },
    caption: `Your best people are running two operating systems. You only pay for one.

At work she owns a function, a team, a number. At home she owns the invisible system that keeps a household alive: the appointments, the sizes, the forms, the who-needs-what-and-when. No handoff. No off switch. It runs in the background of every meeting she is in.

We call the result distraction, or say she has taken her foot off the gas. It is neither. It is a capacity problem created by carrying a second full-time load that no one can see and no one measures.

I built MotherMode because I lived this, and because the fix is not another wellness perk. It is helping people get the invisible load out of their heads, onto one page, and off their plates in whole pieces. That is what actually returns capacity.

If this is you, or someone on your team, the first step is simply seeing the true size of what you are carrying.`,
    cta: 'The Brain Dump System gets it onto one page in 20 minutes. It is $7, link below.',
    hashtags: [...CORE_HASHTAGS, 'WomenInLeadership', 'Burnout'],
    visual: 'Single-image LinkedIn feed post, 1200 x 627 landscape, work-and-home still life.',
  },
  {
    id: 'li-carousel-1',
    platform: 'linkedin',
    format: 'carousel',
    kind: 'organic',
    tone: 'system',
    theme: 'The brain dump',
    title: 'Document carousel: the 20-minute reset I run on my own head',
    hook: 'The 20-minute reset I run on my own head every week (a founder walkthrough).',
    hooks: [
      'The 20-minute reset I run on my own head every week (a founder walkthrough).',
      'I gave my life the same operating discipline I give my company. Here is the exact process.',
      'Save this: the weekly reset that took the mental load off my plate in 20 minutes.',
    ],
    media: {
      type: 'image',
      alt: 'LinkedIn document cover: a bold title slide on a warm bone background with a single notebook',
      aspect: 'aspect-[4/5]',
      hint: '1080 x 1350',
      prompt: `Portrait 4:5 LinkedIn document slide background: a warm bone paper texture with a single notebook and pen in soft light at the base, clean editorial layout with generous room at the top for a bold title, calm and professional, no text. ${IMAGE_STYLE}`,
    },
    caption: `I run a weekly reset on my own head, the same way I run a review on my company. It takes 20 minutes and it is the reason I am not carrying the mental load in the background of every meeting anymore. The exact process is in the slides. Swipe through.`,
    slides: [
      { text: 'The 20-minute reset I run on my own head', sub: 'A founder walkthrough of the weekly mental-load review' },
      { text: '1. Do not start with a blank page', sub: 'Blank pages freeze you. Walk your prompts instead: rooms, then people, then time.' },
      { text: '2. Empty every open loop', sub: 'Write down every task, worry, and half-decision. No sorting yet. You are just getting it out of your head.' },
      { text: '3. Then sort, once', sub: 'Mark each item keep, share, simplify, or drop. Most of the list is not actually yours to carry.' },
      { text: '4. Hand off areas, not tasks', sub: 'Owning dinner is not cooking when told. It is running the whole thing, including the remembering.' },
      { text: '5. Repeat weekly', sub: 'The load refills. A short, repeatable reset beats one heroic cleanup that never lasts.' },
      { text: 'I built this into a $7 tool', sub: 'The Brain Dump System is the guided version, so you never face a blank page. Link below.' },
    ],
    cta: 'Get the guided version. The Brain Dump System is $7, link below.',
    hashtags: [...CORE_HASHTAGS, 'Productivity', 'MentalLoad'],
    visual: 'LinkedIn document carousel, 1080 x 1350 pages, 7-slide process walkthrough.',
  },
  {
    id: 'li-article-1',
    platform: 'linkedin',
    format: 'article',
    kind: 'organic',
    tone: 'movement',
    theme: 'Founder POV',
    title: 'Article: why I built MotherMode',
    hook: 'Why I Built MotherMode: The Load No One Was Naming',
    hooks: [
      'Why I Built MotherMode: The Load No One Was Naming',
      'I Built MotherMode Because Competence at Work Does Not Cancel Overwhelm at Home',
      'The Second Job I Was Doing for Free, and Why I Built a Company About It',
    ],
    media: {
      type: 'image',
      alt: 'Article cover: a warm bone desk with an open notebook and morning light, editorial and calm',
      aspect: 'aspect-[1.91/1]',
      hint: '1200 x 627',
      prompt: `Landscape 1.91:1 LinkedIn article cover: a warm bone desk with an open notebook, a pen, and a cup of coffee in soft morning light, editorial and calm, generous negative space on the left for a title, no people, no text. ${IMAGE_STYLE}`,
    },
    caption: `I wrote about the load no one was naming, and why I stopped waiting for someone else to build the fix. My full story is in the article.`,
    body: [
      'I spent years being told I had it together. I hit the numbers, I ran the team, I answered every message. And every night my brain refused to go quiet, running a list no one else could see: the appointments, the sizes, the forms, the small fires waiting for me at home. I assumed that was just the cost of doing everything. It is not. It is a load, and it has a name.',
      'The mental load is the invisible, never-ending work of noticing, remembering, and deciding for a whole household. It is not the doing, it is the managing, and it lives in one head with no handoff. What surprised me most was that being excellent at my job did nothing to protect me from it. Competence at work does not cancel overwhelm at home. The two run on separate tracks, which is exactly why so many capable women miss it in themselves until they are running on empty.',
      'For a long time I tried to fix it the way I fix everything: with more tools. A new app, a prettier planner, a fresh system every January. None of it worked, because adding tools to an overloaded mind is like adding lanes to a flooded road. The problem was never a lack of structure. The problem was that the entire load was still living invisibly inside my head, uncounted, so I never saw the true size of what I was carrying.',
      'The move that finally worked was almost too simple. I gave my own life the same operating discipline I give my company. Once a week I get every open loop out of my head and onto one page. Then I sort it, keep, share, simplify, drop. Then I hand off whole areas, not single tasks, so I stop being the manager who has to notice and remind. Seeing the load, then shrinking it, in that order.',
      'I built MotherMode because I could not find a version of this that treated women like the competent adults they are. No pep talks, no pastel platitudes, just a clear operating system for the load. It starts with the Brain Dump System, a 20-minute guided reset that gets everything out of your head and onto one page, so you can finally decide what is yours to carry and what is not.',
      'If you are the capable one who is quietly carrying all of it, I want you to know two things. You are not failing, you are overloaded, and those are very different problems. And you are allowed to want a version of your life that does not cost you yourself. That want is not selfish. It is the first honest signal that something in the system needs to change, and it can start in the next 20 minutes.',
    ],
    cta: 'Start where I started. The Brain Dump System is $7, link below.',
    hashtags: [...CORE_HASHTAGS, 'Founders', 'MentalLoad'],
    visual: 'LinkedIn article, 1200 x 627 cover, first-person founder essay.',
  },
  {
    id: 'li-video-1',
    platform: 'linkedin',
    format: 'video',
    kind: 'organic',
    tone: 'confidante',
    theme: 'Quiet burnout',
    title: 'Native video: the burnout that hides in your best people',
    hook: 'The burnout that hides in your most capable people (and how I found it in myself).',
    hooks: [
      'The burnout that hides in your most capable people (and how I found it in myself).',
      'You cannot see this burnout on a calendar. I could not see it in myself for years.',
      'Why your highest performers crash on the inside first.',
    ],
    media: {
      type: 'video',
      alt: 'Video poster: founder talking to camera in a bright, simple office in daytime light',
      aspect: 'aspect-video',
      hint: '1920 x 1080',
      prompt: `Landscape 16:9 professional video still: a founder talking directly to camera in a bright, simple office with soft daylight, composed and credible, warm and human framing, shallow depth of field, authentic and unpolished. ${IMAGE_STYLE}`,
    },
    caption: `The most dangerous burnout is the one you cannot see on a calendar. Here is how I found it in myself, and what I do about it now. 90 seconds.`,
    script: [
      { at: 'Hook (0:00)', onScreen: 'the burnout you cannot see', voiceover: 'The most dangerous burnout in your best people is the one you will never see on a calendar. I know, because I could not see it in myself for years.', visual: 'Founder to camera, bright office, direct and warm.' },
      { at: 'The gap (0:12)', onScreen: 'performance is not capacity', voiceover: 'I hit every number. I answered every message. So no one raised a flag, least of all me. But performance is not the same as capacity. You can deliver at full speed and be completely empty underneath.', visual: 'Steady to camera. Simple lower-third: performance vs capacity.' },
      { at: 'The cause (0:32)', onScreen: 'two operating systems, one person', voiceover: 'The reason was a second operating system I was running for free. The mental load at home. The noticing, the remembering, the deciding for everyone, with no handoff and no off switch. It ran in the background of every meeting I was in.', visual: 'B-roll of a full calendar, then back to camera.' },
      { at: 'The fix (0:55)', onScreen: 'give your life a system', voiceover: 'What changed was giving my own life the discipline I give my company. Once a week I get every open loop onto one page, sort it, and hand off whole areas, not single tasks. A lighter baseline is what actually protects your capacity.', visual: 'To camera. Brief graphic: task vs area.' },
      { at: 'CTA (1:15)', onScreen: 'the reset is $7. link below.', voiceover: 'I built that reset into a 20-minute tool called the Brain Dump System. It is 7 dollars and the link is below. If you are the capable one running on empty, start by seeing the true size of the load.', visual: 'Warm close, gesture to the link.' },
    ],
    cta: 'See the true size of the load. The Brain Dump System is $7, link below.',
    hashtags: [...CORE_HASHTAGS, 'Leadership', 'Burnout'],
    visual: 'LinkedIn native video, 16:9, founder talking head, ~90 seconds.',
  },
];
