/**
 * THE HOOK FAMILIES — the distilled hook registry (from the CopyPrompter
 * template library), one row per family: the template the writer MUST
 * execute, one example, the awareness gate (which temperature the family is
 * legal for), and the VISUAL HOOK direction — the pattern-interrupt shot
 * that plays under the line (skit-style: the visual grabs, the line expands).
 *
 * The Producer's intake picks (or defaults) a family; the script writer
 * executes the template for scene 1; the hooks generator on the run card
 * offers alternates across families.
 */

export type HookAwareness = 'cold' | 'warm' | 'hot';

export interface HookFamily {
  id: string;
  label: string;
  /** The awareness levels this family is legal for. */
  awareness: HookAwareness[];
  /** The template the hook line executes. */
  template: string;
  /** One worked example. */
  example: string;
  /** The visual hook — the pattern-interrupt shot under the line. */
  visual: string;
}

export const HOOK_FAMILIES: HookFamily[] = [
  {
    id: 'doing-it-backwards',
    label: "You've been doing it backwards",
    awareness: ['cold', 'warm'],
    template:
      '"You\'re not failing because of [the surface problem] — you\'re failing because of [the hidden cause]."',
    example:
      'You\'re not failing because your content sucks — you\'re failing because your offer isn\'t positioned to convert cold traffic.',
    visual:
      'The character stops mid-task and looks straight into the lens — a hard pattern interrupt, no movement, dead eye contact for the first second.',
  },
  {
    id: 'hot-take',
    label: 'The hot take',
    awareness: ['cold', 'warm'],
    template: '"[The common practice] doesn\'t work. [The contrarian belief] does."',
    example: 'Testimonials don\'t sell. Tension-filled storytelling does.',
    visual:
      'The character says it while doing something completely ordinary (pouring coffee, tying a shoe) — the casual delivery IS the interrupt.',
  },
  {
    id: 'sounds-crazy',
    label: 'This sounds crazy but…',
    awareness: ['cold'],
    template: '"This might sound crazy, but [the unexpected insight] is what actually [the desired outcome]."',
    example: 'This might sound crazy, but deleting 80% of my lead magnets tripled my conversions.',
    visual:
      'A beat of silence first — the character mid-action freezes, then delivers the line almost as a secret to the camera.',
  },
  {
    id: 'curiosity-loop',
    label: 'The curiosity loop',
    awareness: ['cold'],
    template: '"I spent [X time] doing [the surprising thing] — here\'s what happened."',
    example: 'I spent 30 days selling without a website — here\'s what happened.',
    visual:
      'Fast motion cut short — the character in the middle of the strange thing (filming in bed, deleting files), stopping to address the camera.',
  },
  {
    id: 'one-detail',
    label: 'The one detail everyone misses',
    awareness: ['warm'],
    template: '"Most people focus on [the surface layer] — but ignore [the hidden layer] that actually drives results."',
    example: 'Most people focus on CTA buttons — but ignore the buying context that happens 20 seconds before.',
    visual:
      'Extreme close-up on the overlooked detail (a finger hovering over a button), then a slow pull back to the character.',
  },
  {
    id: 'told-vs-works',
    label: "What they told you vs what works",
    awareness: ['warm'],
    template: '"You\'ve been told to [the common advice], but the real secret is [the contrarian advice]."',
    example: 'You\'ve been told to niche down. But the real secret is to productize what everyone needs first.',
    visual:
      'Split energy: the character mimes the "told" advice with exaggerated compliance, then drops the act for the real line.',
  },
  {
    id: 'disqualify',
    label: 'Disqualify + authority',
    awareness: ['warm', 'hot'],
    template: '"This isn\'t for you if you\'re still [the beginner action]. This is for people ready to [the real result]."',
    example: 'This isn\'t for you if you\'re still tweaking Canva covers. This is for people ready to generate $50K offers using AI.',
    visual:
      'The character literally waves off the camera — a dismissive "not you" gesture — then beckons the right viewer closer.',
  },
  {
    id: 'mechanism',
    label: 'The mechanism reveal',
    awareness: ['warm', 'hot'],
    template: '"Everyone\'s trying [the tactic] — but we built [the mechanism] that makes it automatic."',
    example: 'Everyone\'s trying to storyboard ads manually — but we built a tool that generates it in seconds with AI.',
    visual:
      'The old way made visible and absurd (a desk buried in sticky notes, 12 tabs open), the character calmly watching it, then the line.',
  },
  {
    id: 'proof-stack',
    label: 'The proof stack',
    awareness: ['hot'],
    template: '"Here\'s how [the persona] went from [the pain] to [the result] using [the mechanism]."',
    example: 'Here\'s how a fitness coach went from burnout to $24K/month using our 12-second video funnel.',
    visual:
      'Receipt-first framing — the result on screen (the dashboard, the notification), the character pointing at it, then the story.',
  },
  {
    id: 'the-mistake',
    label: 'The mistake I made',
    awareness: ['cold', 'warm', 'hot'],
    template: '"The mistake that cost me [the $$ or opportunity] — and how I\'ll never let it happen again."',
    example: 'The mistake that cost me $14K in ad spend — and how a 3-line script fix turned it around.',
    visual:
      'The character does the walk-and-talk away from camera, then turns back mid-stride to confess the number.',
  },
];

export function hookFamilyFor(id?: string): HookFamily {
  return HOOK_FAMILIES.find((f) => f.id === id) ?? HOOK_FAMILIES[0];
}

/** The families legal at an awareness level (empty = all). */
export function hookFamiliesFor(awareness?: HookAwareness): HookFamily[] {
  if (!awareness) return HOOK_FAMILIES;
  return HOOK_FAMILIES.filter((f) => f.awareness.includes(awareness));
}

/** The CTA destination — the writer's last line points HERE, subtly. */
export const CTA_TARGETS = [
  { id: 'comment', label: 'comment a word', line: 'ask for one word in the comments ("comment SYSTEM and I\'ll send it")' },
  { id: 'pinned', label: 'the pinned link', line: 'point at the pinned comment ("the pinned comment has it")' },
  { id: 'profile', label: 'the profile link', line: 'point at the profile ("it\'s the link on my profile")' },
  { id: 'dm', label: 'DM me', line: 'invite the DM ("DM me the word READY")' },
] as const;

export function ctaTargetFor(id?: string): (typeof CTA_TARGETS)[number] {
  return CTA_TARGETS.find((t) => t.id === id) ?? CTA_TARGETS[0];
}
