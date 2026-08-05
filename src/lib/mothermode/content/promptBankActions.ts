/**
 * Pure helpers for the Prompt Bank Test lab output actions
 * (docs/PROMPT_BANK_TEST_ACTIONS_TASK.md). The /admin/prompt-bank editor and
 * the test-route sequence action share these, and the unit tests exercise them
 * without any AI calls:
 *
 *   - appendExample: the "bank learns from real outputs" loop. Adds a test
 *     output's hook (or image prompt) to a recipe's exampleHooks with dedupe
 *     and a 6-cap, reporting the oldest example when it drops off.
 *   - deriveTemplateFromPiece / buildRemixDraft: draft a NEW custom recipe
 *     from what a test actually produced. Always an unsaved draft for human
 *     review; nothing here ever auto-saves.
 *   - funnelArcGuide: the guide text that turns a variations-mode batch into
 *     a connected post sequence (hook post, proof posts, CTA post).
 *
 * Client-safe and side-effect free. Voice rules apply to every literal here:
 * no em/en dashes, no NO-list stems.
 */
import type { ContentFormat, ContentPiece, ContentPlatform } from './types';
import { recipesFor, type PromptRecipe, type RecipeGroup } from './promptBank';

// ---------------------------------------------------------------------------
// Add as example
// ---------------------------------------------------------------------------

/** Hard cap on stored examples per recipe, so steering stays tight. */
export const EXAMPLE_HOOKS_CAP = 6;

export interface AppendExampleResult {
  /** The example list to store (unchanged when added is false). */
  next: string[];
  /** True when the candidate was new and got appended. */
  added: boolean;
  /** The oldest example that fell off the cap, when one did. */
  dropped: string | null;
}

/** Normalize for dedupe: collapse whitespace, compare case-insensitively. */
const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Append a candidate example to a recipe's exampleHooks. Dedupes against the
 * existing list (whitespace- and case-insensitive) and caps the list at
 * EXAMPLE_HOOKS_CAP, dropping the oldest entry when the cap is exceeded.
 */
export function appendExample(
  existing: string[],
  candidate: string,
  cap: number = EXAMPLE_HOOKS_CAP,
): AppendExampleResult {
  const clean = candidate.replace(/\s+/g, ' ').trim();
  if (!clean) return { next: existing, added: false, dropped: null };
  if (existing.some((e) => norm(e) === norm(clean))) {
    return { next: existing, added: false, dropped: null };
  }
  const next = [...existing, clean];
  let dropped: string | null = null;
  while (next.length > cap) dropped = next.shift() ?? null;
  return { next, added: true, dropped };
}

// ---------------------------------------------------------------------------
// Remix to a new prompt
// ---------------------------------------------------------------------------

/** First N words of a text, single-spaced, for slot hints and labels. */
function firstWords(text: string, n: number): string {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const out = words.slice(0, n).join(' ');
  return words.length > n ? `${out}...` : out;
}

/**
 * Re-derive a {Slot} template skeleton from the structure of one generated
 * piece. Heuristic on purpose: it names the beats the output actually used so
 * a human can tighten it before saving. Deterministic for tests.
 */
export function deriveTemplateFromPiece(piece: ContentPiece): string {
  const hookHint = firstWords(piece.hook || 'the opener', 8);
  if (piece.slides && piece.slides.length >= 2) {
    const last = piece.slides.length;
    return [
      `{Slide1Hook: on-slide line in the spirit of "${hookHint}"}`,
      ...(last > 2
        ? [`{Slides2to${last - 1}: one proof beat per slide, each stands alone}`]
        : []),
      `{Slide${last}: the soft CTA slide, points to the next step}`,
    ].join('\n');
  }
  if (piece.tweets && piece.tweets.length >= 2) {
    const last = piece.tweets.length;
    return [
      `{Tweet1Hook: opener in the spirit of "${hookHint}"}`,
      ...(last > 2
        ? [`{Tweets2to${last - 1}: one idea per post, short lines, no filler}`]
        : []),
      `{Tweet${last}: the payoff plus the soft CTA}`,
    ].join('\n');
  }
  if (piece.script && piece.script.length >= 2) {
    return [
      `{Beat1Hook: 0-3s opener in the spirit of "${hookHint}", on-screen text that lands muted}`,
      `{Beats2to${piece.script.length - 1}: one move per beat, specific shots and lines}`,
      `{Beat${piece.script.length}: the close plus the soft CTA}`,
    ].join('\n');
  }
  const paragraphs = piece.body?.length ?? 0;
  const lines = [`{Hook: opener in the spirit of "${hookHint}"}`];
  if (paragraphs > 0) {
    lines.push(
      '',
      `{Body: ${paragraphs} short paragraph${paragraphs === 1 ? '' : 's'} that prove the hook with specifics, not adjectives}`,
    );
  }
  if (piece.caption && paragraphs === 0) {
    lines.push('', '{Caption: the written-out take that pairs with the visual}');
  }
  lines.push('', '{SoftCTA}');
  return lines.join('\n');
}

/**
 * Build an unsaved custom-recipe draft from a source recipe and the piece a
 * Test lab run produced. The id is `<sourceId>-remix` with a numeric suffix
 * when that id is taken. The caller lands this in the editor for human review;
 * nothing here saves.
 */
export function buildRemixDraft(
  source: PromptRecipe,
  piece: ContentPiece,
  existingIds: string[],
): PromptRecipe {
  const baseId = `${source.id}-remix`.slice(0, 57);
  let id = baseId;
  let n = 2;
  while (existingIds.includes(id)) {
    id = `${baseId}-${n}`;
    n += 1;
  }

  const isImage = source.group === 'image';
  const example = (isImage ? piece.media?.prompt : piece.hook) ?? piece.hook;
  const hookShort = firstWords(piece.hook || piece.theme || piece.title, 5);

  return {
    id,
    label: `${source.label} remix (${hookShort})`.slice(0, 80),
    hint: piece.theme || source.hint,
    group: source.group,
    goal: source.goal,
    whyItWorks: [
      `Remixed from "${source.label}" after a Test lab run produced a strong output.`,
      ...source.whyItWorks.slice(0, 2),
    ],
    template: deriveTemplateFromPiece(piece),
    exampleHooks: example ? [example] : [],
    craft: source.craft,
    platforms: source.platforms.length ? [...source.platforms] : [piece.platform],
    formats: source.formats.length ? [...source.formats] : [piece.format],
    kind: source.kind,
    sizePresetIds: source.sizePresetIds ? [...source.sizePresetIds] : undefined,
    platformNotes: { ...(source.platformNotes ?? {}) },
    sourceUrls: [],
    builtin: false,
    enabled: true,
  };
}

// ---------------------------------------------------------------------------
// Post sequence / content funnel
// ---------------------------------------------------------------------------

/** Sequence size bounds (spec: a connected 3-5 post funnel). */
export const SEQUENCE_MIN = 3;
export const SEQUENCE_MAX = 5;

/** Clamp a requested sequence size into the 3-5 band. */
export function clampSequenceCount(count: number): number {
  if (!Number.isFinite(count)) return 4;
  return Math.max(SEQUENCE_MIN, Math.min(SEQUENCE_MAX, Math.round(count)));
}

/** The proof-beat job each middle post does, by position (1-based post no). */
const MIDDLE_JOBS: Record<number, string> = {
  2: 'proves: receipts, specifics, or a mini story that makes post 1 believable',
  3: 'deepens: the teaching beat or the personal story behind the proof',
  4: 'flips the objection: names the reason she hesitates and reframes it',
};

/**
 * The funnel-arc guide injected into a variations-mode batch so the N sibling
 * pieces read as one connected sequence: post 1 hooks, middles prove, the last
 * converts. Deterministic so the route and the tests agree.
 */
export function funnelArcGuide(count: number): string {
  const n = clampSequenceCount(count);
  const middle: string[] = [];
  for (let post = 2; post <= n - 1; post += 1) {
    middle.push(`- Post ${post} ${MIDDLE_JOBS[post] ?? MIDDLE_JOBS[4]}.`);
  }
  return [
    `These ${n} posts are ONE connected content funnel, not ${n} siblings. Order matters.`,
    `- Post 1 hooks: the strongest scroll-stopper, opens the loop on the core angle. No pitch.`,
    ...middle,
    `- Post ${n} converts: the payoff post. Recap the arc in one line, then a clear soft CTA to the offer.`,
    'Every post keeps the assigned framework structure and the MotherMode voice. Each stands alone in a feed and rewards reading in order.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Generator-surface pickers
// ---------------------------------------------------------------------------

/**
 * Order the merged bank for a generator-surface picker
 * (docs/PROMPT_BANK_GENERATOR_PICKERS_TASK.md): disabled recipes drop out,
 * only the groups the surface can execute stay in (text surfaces: framework +
 * style; image stages: image), and strong fits for the surface's
 * platform/format lead, registry order otherwise. Pure and deterministic so
 * the hook, the <FrameworkPicker>, and the tests all agree without AI calls.
 *
 * `fitsOnly` narrows the list to the channel's recommendations alone (the
 * Generate drawer's behavior: nothing from other platforms shows), instead of
 * fits-first-then-the-rest.
 */
export function orderRecipesForPicker(
  recipes: PromptRecipe[],
  platform?: ContentPlatform,
  format?: ContentFormat,
  groups?: RecipeGroup[],
  fitsOnly?: boolean,
): PromptRecipe[] {
  const allowed = groups && groups.length > 0 ? new Set(groups) : null;
  const pool = recipes.filter(
    (r) => r.enabled !== false && (!allowed || allowed.has(r.group)),
  );
  const fits = recipesFor(platform, format, pool);
  if (fitsOnly) return fits;
  const fitIds = new Set(fits.map((r) => r.id));
  return [...fits, ...pool.filter((r) => !fitIds.has(r.id))];
}

// ---------------------------------------------------------------------------
// Email kit trigger-to-recipe wiring (round 5)
// ---------------------------------------------------------------------------

/**
 * The recipe families a sequence's enrollment trigger suggests first in the
 * kit editor's Bank framework picker (docs/PROMPT_BANK_EMAIL_ROUND_TASK.md
 * §9). Prefix-matched against recipe ids: the purchase/upsell/refund/booking
 * triggers map onto the round-5 embuy- / emgoal- families, and cart
 * abandonment maps onto the honest-close structures.
 */
const TRIGGER_RECIPE_PREFIX: Record<string, string[]> = {
  purchase: ['embuy-', 'emgoal-'],
  upsell_purchase: ['embuy-oto', 'embuy-'],
  refund: ['embuy-refund', 'embuy-'],
  booking: ['emgoal-book-call', 'emgoal-'],
  abandon: ['email-honest-last-call', 'email-ps-close'],
};

/**
 * Order the email-fit framework recipes for the kit editor's Bank framework
 * picker: email-platform framework recipes only (image recipes, styles, and
 * other channels stay out), trigger-matched families first, registry order
 * otherwise. Pure and deterministic so the editor, the canvas hint, and the
 * tests all agree without AI calls.
 */
export function orderEmailRecipesForTrigger(
  recipes: PromptRecipe[],
  trigger?: string,
): PromptRecipe[] {
  const pool = recipes.filter(
    (r) =>
      r.group === 'framework' &&
      r.enabled !== false &&
      r.platforms.includes('email'),
  );
  const prefixes = trigger ? TRIGGER_RECIPE_PREFIX[trigger] : undefined;
  if (!prefixes?.length) return pool;
  const rank = (r: PromptRecipe) => {
    const i = prefixes.findIndex((p) => r.id.startsWith(p));
    return i === -1 ? prefixes.length : i;
  };
  return [...pool].sort((a, b) => rank(a) - rank(b));
}

/**
 * One-line hint for the flow canvas trigger node: the bank recipe family
 * that fits this trigger, or '' when there is no natural fit.
 */
export function triggerRecipeFamilyLabel(trigger?: string): string {
  switch (trigger) {
    case 'purchase':
    case 'upsell_purchase':
    case 'refund':
      return 'Bank: embuy- buyer nurture fits';
    case 'booking':
      return 'Bank: emgoal- book-a-call fits';
    case 'abandon':
      return 'Bank: honest last call fits';
    default:
      return '';
  }
}
