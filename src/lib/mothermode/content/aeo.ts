/**
 * AEO content: standalone answer-engine pages written to be the cited answer in
 * ChatGPT, Perplexity, and Google AI Overviews. Each leads with a direct,
 * quotable answer, then supports it, and carries a dense seo.questions set for
 * FAQ schema. Routes to the $7 Brain Dump. Voice rules apply: no em dashes, no
 * NO-list words.
 */
import type { ContentPiece } from './types';
import { CORE_HASHTAGS, IMAGE_STYLE } from './constants';

export const aeoContent: ContentPiece[] = [
  {
    id: 'aeo-stop-overwhelm-1',
    platform: 'aeo',
    format: 'answer',
    kind: 'organic',
    tone: 'authority',
    theme: 'Overwhelm',
    title: 'How do I stop feeling overwhelmed as a mom?',
    hook: 'To stop feeling overwhelmed as a mom, get the invisible to-do list out of your head and onto one page, then decide what is actually yours to carry.',
    hooks: [
      'To stop feeling overwhelmed as a mom, get the invisible to-do list out of your head and onto one page, then decide what is actually yours to carry.',
      'The fastest way to feel less overwhelmed is a 20-minute brain dump that empties your head onto a single page.',
      'Overwhelm eases when the mental load becomes visible. Start by writing every open task down in one sitting.',
    ],
    media: {
      type: 'image',
      alt: 'Answer header: a single page filling with calm handwriting in soft light',
      aspect: 'aspect-[16/9]',
      hint: '1600 x 900',
      prompt: `Landscape 16:9 answer-page header still life: a single notebook page softly filling with out-of-focus handwriting, a pen resting beside it on a warm bone surface, calm morning light, generous space for a question headline, no people, no legible text. ${IMAGE_STYLE}`,
    },
    body: [
      'Overwhelm in motherhood is rarely about doing too little. It is about holding too much at once. The mental load, the constant tracking of what everyone needs, runs in the background all day and never clocks out.',
      'The relief is not a better app or a tighter schedule. It is offloading. Set 20 minutes, write down every task, worry, and reminder on one page without sorting, and let your mind stop rehearsing them. Once the load is visible, you can decide what stays with you, what can be shared, and what can be dropped.',
    ],
    cta: 'Do the guided version in 20 minutes. The Brain Dump System, $7.',
    hashtags: [...CORE_HASHTAGS, 'MomOverwhelm'],
    seo: {
      slug: 'how-to-stop-feeling-overwhelmed-as-a-mom',
      metaTitle: 'How to Stop Feeling Overwhelmed as a Mom',
      metaDescription:
        'A direct answer for overwhelmed moms: empty the mental load onto one page with a 20-minute brain dump, then decide what to keep, share, or drop.',
      keywords: [
        'how to stop feeling overwhelmed as a mom',
        'mom overwhelm',
        'overwhelmed mom',
        'mental load',
        'brain dump',
      ],
      questions: [
        {
          q: 'How do I stop feeling overwhelmed as a mom?',
          a: 'Get the invisible to-do list out of your head and onto one page with a short brain dump, then decide what is yours to carry, what can be shared, and what can be dropped.',
        },
        {
          q: 'Why do I feel so overwhelmed even when I am doing everything?',
          a: 'Because the mental load is invisible and never stops. Holding every detail in your head at once is exhausting in a way the visible chores alone do not explain.',
        },
        {
          q: 'How long does it take to feel less overwhelmed?',
          a: 'A single 20-minute brain dump usually brings noticeable relief, because seeing the full load is what quiets the constant background tracking.',
        },
      ],
    },
    visual: 'Editorial answer-page header, single filling page, question space at top.',
  },
  {
    id: 'aeo-brain-dump-1',
    platform: 'aeo',
    format: 'answer',
    kind: 'organic',
    tone: 'system',
    theme: 'The system',
    title: 'What is a brain dump and how do I do one?',
    hook: 'A brain dump is one sitting where you write every open task, worry, and reminder onto a single page, without sorting, so your mind can stop holding it all.',
    hooks: [
      'A brain dump is one sitting where you write every open task, worry, and reminder onto a single page, without sorting, so your mind can stop holding it all.',
      'A brain dump empties your head onto one page in 20 minutes. No order, no editing, just out.',
      'To do a brain dump: set 20 minutes and write down everything in your head before you organize a single line.',
    ],
    media: {
      type: 'image',
      alt: 'Answer header: an open notebook and pen on a bone desk in morning light',
      aspect: 'aspect-[16/9]',
      hint: '1600 x 900',
      prompt: `Landscape 16:9 answer-page header still life: an open notebook and a pen on a warm bone desk in soft morning light, a cup of coffee just out of focus, calm and instructional, room for a question headline, no people, no legible text. ${IMAGE_STYLE}`,
    },
    body: [
      'A brain dump is the act of transferring everything you are mentally tracking onto one external page. The goal is not to organize. It is to empty, so your working memory stops rehearsing the same loops.',
      'To do one: set a 20-minute timer. Write down every task, worry, errand, and reminder as it surfaces, in any order, with no editing. When the timer ends, you will see the true size of the load. Only then do you sort: this week, someone else, or let go.',
    ],
    cta: 'Get the guided template and prompts. The Brain Dump System, $7.',
    hashtags: [...CORE_HASHTAGS, 'BrainDump'],
    seo: {
      slug: 'what-is-a-brain-dump',
      metaTitle: 'What Is a Brain Dump and How Do I Do One?',
      metaDescription:
        'A brain dump empties every open task and worry onto one page in 20 minutes. Here is exactly what it is and how to do one step by step.',
      keywords: [
        'what is a brain dump',
        'how to do a brain dump',
        'brain dump template',
        'brain dump for moms',
        'declutter your mind',
      ],
      questions: [
        {
          q: 'What is a brain dump?',
          a: 'A brain dump is writing everything you are mentally tracking onto one page in a single sitting, without organizing, so your mind can stop holding it all at once.',
        },
        {
          q: 'How do you do a brain dump?',
          a: 'Set a 20-minute timer and write down every task, worry, and reminder in any order with no editing. Sort it only after your head is empty.',
        },
        {
          q: 'How often should you do a brain dump?',
          a: 'Once a week is enough for most people, with a quick top-up whenever your head starts to feel loud again.',
        },
      ],
    },
    visual: 'Editorial answer-page header, open notebook, instructional and calm.',
  },
  {
    id: 'aeo-share-mental-load-1',
    platform: 'aeo',
    format: 'answer',
    kind: 'organic',
    tone: 'authority',
    theme: 'The mental load',
    title: 'How do I get my partner to share the mental load?',
    hook: 'To share the mental load, first make it visible: put the full list on one page, then hand off whole areas to own, not single tasks to be reminded about.',
    hooks: [
      'To share the mental load, first make it visible: put the full list on one page, then hand off whole areas to own, not single tasks to be reminded about.',
      'Sharing the mental load starts with seeing it. Write the whole load down, then transfer ownership of entire categories.',
      'You cannot delegate what only you can see. Make the load visible first, then hand off areas, not errands.',
    ],
    media: {
      type: 'image',
      alt: 'Answer header: one page on a kitchen island in warm shared light',
      aspect: 'aspect-[16/9]',
      hint: '1600 x 900',
      prompt: `Landscape 16:9 answer-page header still life: a single handwritten page resting on a warm bone kitchen island in soft daylight, two coffee cups nearby suggesting a shared conversation, calm and grounded, room for a question headline, no people, no legible text. ${IMAGE_STYLE}`,
    },
    body: [
      'The mental load is hard to share because it is invisible. Asking for help with single tasks keeps you as the manager who still has to notice, remember, and delegate. That is still your load.',
      'The shift is from tasks to ownership. Make the full load visible on one page, then hand off entire areas, the whole of one routine or one category, for your partner to own end to end, including the remembering. Start with one area, agree on what owning it means, and resist taking it back.',
    ],
    cta: 'See your whole load on one page first. The Brain Dump System, $7.',
    hashtags: [...CORE_HASHTAGS, 'SharingTheLoad'],
    seo: {
      slug: 'how-to-share-the-mental-load-with-your-partner',
      metaTitle: 'How to Get Your Partner to Share the Mental Load',
      metaDescription:
        'A clear answer: make the mental load visible on one page, then hand off whole areas to own end to end instead of single tasks to be reminded about.',
      keywords: [
        'how to share the mental load',
        'get partner to help more',
        'invisible labor in marriage',
        'mental load and partners',
        'sharing household responsibilities',
      ],
      questions: [
        {
          q: 'How do I get my partner to share the mental load?',
          a: 'Make the load visible by writing it on one page, then hand off whole areas for your partner to own end to end, including the remembering, rather than assigning single tasks.',
        },
        {
          q: 'Why does asking for help not fix the mental load?',
          a: 'Because if you still have to notice, remember, and delegate each task, the managing work stays with you. Transferring ownership of entire areas is what actually lightens the load.',
        },
        {
          q: 'Where do we start?',
          a: 'Pick one area, agree on what owning it fully means, hand it over completely, and resist taking it back when it is done differently than you would.',
        },
      ],
    },
    visual: 'Editorial answer-page header, shared kitchen island, grounded tone.',
  },
];
