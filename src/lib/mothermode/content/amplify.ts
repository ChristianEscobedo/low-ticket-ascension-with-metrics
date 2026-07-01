/**
 * Shared types and prompt helpers for the Amplify feature in the content hub.
 * Amplify takes one existing piece and multiplies it: more hooks, angles, CTAs,
 * or body variants for the open piece, or whole new pieces (full posts and
 * cross-platform adaptations) saved to the hub. Imported by both the browser
 * panel and the server generator, so it holds no server-only code. Voice rules
 * still apply: no em dashes, no NO-list words.
 */
import type { ContentPlatform } from './types';

/**
 * What an Amplify run produces. The first four are single-text dimensions that
 * merge into the open piece; 'full' and 'crossPlatform' return whole pieces.
 */
export type AmplifyDimension =
  | 'hooks'
  | 'angles'
  | 'ctas'
  | 'bodies'
  | 'full'
  | 'crossPlatform';

/** A single-text dimension, parsed back as a list of strings. */
export type AmplifyTextDimension = 'hooks' | 'angles' | 'ctas' | 'bodies';

/** Narrative voice the copy is written in. */
export type Perspective = 'first' | 'second' | 'third';

/**
 * Market sophistication (awareness), least to most aware, used to pitch the
 * copy at the right level for the reader. See classic awareness ladder.
 */
export type Sophistication =
  | 'unaware'
  | 'problem'
  | 'solution'
  | 'product'
  | 'most';

/** True for the single-text dimensions that merge into the open piece. */
export function isTextDimension(d: AmplifyDimension): d is AmplifyTextDimension {
  return d === 'hooks' || d === 'angles' || d === 'ctas' || d === 'bodies';
}

/** A labelled option for a select control. */
export interface AmplifyOption<T extends string> {
  value: T;
  label: string;
  /** Short hint shown under or beside the option, where the UI has room. */
  hint?: string;
}

export const AMPLIFY_DIMENSIONS: AmplifyOption<AmplifyDimension>[] = [
  { value: 'hooks', label: 'Hooks', hint: 'Scroll-stopping openers' },
  { value: 'angles', label: 'Angles', hint: 'New strategic directions' },
  { value: 'ctas', label: 'CTAs', hint: 'Calls to the next step' },
  { value: 'bodies', label: 'Bodies', hint: 'Alternate body copy' },
  { value: 'full', label: 'Full posts', hint: 'Whole new posts, same channel' },
  {
    value: 'crossPlatform',
    label: 'Cross-platform',
    hint: 'Adapt to another channel',
  },
];

/** The four single-text parts, in canonical order, that a Refine run targets. */
export const ALL_TEXT_DIMENSIONS: AmplifyTextDimension[] = [
  'hooks',
  'angles',
  'ctas',
  'bodies',
];

/** The selectable parts for the multi-part Refine command box, with labels. */
export const AMPLIFY_PARTS: AmplifyOption<AmplifyTextDimension>[] =
  AMPLIFY_DIMENSIONS.filter((d): d is AmplifyOption<AmplifyTextDimension> =>
    isTextDimension(d.value),
  );

/** Per-part counts for one Refine run. Absent or 0 means "skip this part". */
export type PartCounts = Partial<Record<AmplifyTextDimension, number>>;

/** The most variants a single part can produce in one run. */
export const MAX_PART_COUNT = 10;

/** Clamp a per-part count into [0, MAX_PART_COUNT]. */
export function clampPartCount(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(MAX_PART_COUNT, Math.round(n)));
}

/** The parts a selection will actually run (count > 0), in canonical order. */
export function activeParts(
  counts: PartCounts,
): { dimension: AmplifyTextDimension; count: number }[] {
  return ALL_TEXT_DIMENSIONS.map((dimension) => ({
    dimension,
    count: clampPartCount(counts[dimension] ?? 0),
  })).filter((p) => p.count > 0);
}

export const PERSPECTIVES: AmplifyOption<Perspective>[] = [
  { value: 'first', label: '1st person', hint: 'I, we' },
  { value: 'second', label: '2nd person', hint: 'you' },
  { value: 'third', label: '3rd person', hint: 'she, they' },
];

export const SOPHISTICATIONS: AmplifyOption<Sophistication>[] = [
  { value: 'unaware', label: 'Problem unaware' },
  { value: 'problem', label: 'Problem aware' },
  { value: 'solution', label: 'Solution aware' },
  { value: 'product', label: 'Product aware' },
  { value: 'most', label: 'Most aware' },
];

/** True when a value is a known perspective. */
export function isPerspective(v: unknown): v is Perspective {
  return v === 'first' || v === 'second' || v === 'third';
}

/** True when a value is a known sophistication level. */
export function isSophistication(v: unknown): v is Sophistication {
  return (
    v === 'unaware' ||
    v === 'problem' ||
    v === 'solution' ||
    v === 'product' ||
    v === 'most'
  );
}

/** A prompt line steering the narrative voice. */
export function perspectiveLine(p?: Perspective): string {
  switch (p) {
    case 'first':
      return 'Write in the first person (I, we), as the founder speaking.';
    case 'third':
      return 'Write in the third person (she, they), describing the reader.';
    case 'second':
      return 'Write in the second person (you), speaking directly to the reader.';
    default:
      return '';
  }
}

/** A prompt line pitching the copy at a market sophistication level. */
export function sophisticationLine(s?: Sophistication): string {
  switch (s) {
    case 'unaware':
      return 'Reader is problem unaware: open by naming the felt experience before any solution.';
    case 'problem':
      return 'Reader is problem aware but not solution aware: agitate the problem, then point to a way out.';
    case 'solution':
      return 'Reader is solution aware: show why this approach beats the alternatives she has tried.';
    case 'product':
      return 'Reader is product aware: lead with the specific offer and what makes it different.';
    case 'most':
      return 'Reader is most aware: lead with the offer and a direct reason to act now.';
    default:
      return '';
  }
}

/** Native conventions per channel, used when adapting a piece cross-platform. */
export const PLATFORM_NORMS: Record<ContentPlatform, string> = {
  facebook:
    'Facebook: warm, longer narrative, line breaks for skimming, minimal hashtags.',
  instagram:
    'Instagram: visual-first caption, a strong first line, a few tasteful hashtags.',
  x: 'X: tight and punchy, number the thread when long, no hashtags, one idea per post.',
  tiktok:
    'TikTok: spoken-word script, a fast hook in the first 3 seconds, casual cadence.',
  email:
    'Email: a subject and preheader, conversational, one clear call to action.',
  pinterest:
    'Pinterest: keyword-rich, helpful and search-led, descriptive caption.',
  blog: 'Blog: structured long-form, scannable subheads, helpful and thorough.',
  aeo: 'Answer page: concise, citable question-and-answer pairs, direct.',
};
