/**
 * Prompt styles for the content hub Generate drawer. Each style is a craft
 * recipe, not a generic template: conversational, viral, offer-grounded, and
 * held to the MotherMode voice. Client-safe so the selector and the server
 * prompt builders share one source of truth.
 */
import type { ContentFormat, ContentPlatform } from './types';

/** A selectable generation style with the craft block injected into the prompt. */
export interface PromptStyle {
  id: string;
  label: string;
  /** One-line hint under the chip. */
  hint: string;
  /**
   * Craft instructions the model must follow. Voice rules still win over these.
   * Written as direct orders so the model treats them as constraints, not vibes.
   */
  craft: string;
  /** Platforms this style is especially strong on. Empty = any. */
  platforms?: ContentPlatform[];
  /** Formats this style is especially strong on. Empty = any. */
  formats?: ContentFormat[];
  /** When true, this is the default for short-form video formats. */
  shortFormDefault?: boolean;
}

/** Let the server pick the best style for platform + format. */
export const AUTO_STYLE = 'auto';

/**
 * Curated viral / conversational styles. Nothing generic. Every style should
 * sound like a smart, slightly tired woman texting her smartest friend at 11pm,
 * never like a content mill or a wellness brand.
 */
export const PROMPT_STYLES: PromptStyle[] = [
  {
    id: AUTO_STYLE,
    label: 'Auto',
    hint: 'Best fit for this channel',
    craft: '',
  },
  {
    id: 'eleven-pm',
    label: '11pm text',
    hint: 'Late-night confidante truth',
    craft: [
      'Write like a brilliant, slightly tired woman texting her smartest friend the truth at 11pm.',
      'Short lines. Sentence fragments are good. Intimate, not performative.',
      'Name a specific felt moment before any product. Calibrate every bold claim within 1-2 sentences.',
      'End with permission, then a soft next step. Never hype. Never "you have got this."',
    ].join(' '),
    platforms: ['instagram', 'facebook', 'email', 'x'],
    formats: ['feed', 'email', 'thread'],
  },
  {
    id: 'storytime',
    label: 'Storytime',
    hint: 'Confession arc that lands a reframe',
    craft: [
      'Use a storytime structure: cold open on a specific, almost-embarrassing moment, then reveal what it was actually about.',
      'Concrete props and times (granola bar, parking lot, 11pm, 5pm). No abstract advice.',
      'Arc: scene → realize → name the system → what actually helped → soft CTA.',
      'Sound spoken and human. If this is a script, write voiceover the way someone actually talks on camera.',
    ].join(' '),
    platforms: ['tiktok', 'instagram', 'facebook'],
    formats: ['video', 'reel', 'feed'],
  },
  {
    id: 'pov-tabs',
    label: 'POV / open tabs',
    hint: 'Native POV that names the load',
    craft: [
      'Open with a native POV or "tabs open" frame that stops the scroll in under 2 seconds.',
      'List concrete open loops (dentist, shoes, form, text she never sent) before any reframe.',
      'Reframe: she is not scattered, she is holding a system with no place to put it down.',
      'Payoff is getting it out of her head. Soft bio/link CTA, never a hard sell.',
    ].join(' '),
    platforms: ['tiktok', 'instagram', 'facebook'],
    formats: ['video', 'reel', 'feed', 'story'],
  },
  {
    id: 'hot-take',
    label: 'Hot take',
    hint: 'Wedge claim, then calibrate',
    craft: [
      'Lead with a sharp, true hot take that challenges a cultural script (self-care baths, "just write it down", more patience).',
      'Immediately calibrate: bold claim → full truth → permission → next step.',
      'Enemy is the system, never partners, never other mothers. No fear-selling.',
      'Keep it premium and unapologetic, never girlboss or wellness-influencer.',
    ].join(' '),
    platforms: ['tiktok', 'instagram', 'x', 'facebook'],
    formats: ['video', 'reel', 'feed', 'thread'],
  },
  {
    id: 'list-invisible',
    label: 'Invisible list',
    hint: 'Numbered things she did not know counted',
    craft: [
      'Use a numbered list of invisible labor items she did not realize counted as the mental load.',
      'Each item is specific and visual, not abstract. End with the reframe that naming it changes everything.',
      'Close with a soft CTA to get the load onto one page. Conversational, not listicle-SEO.',
    ].join(' '),
    platforms: ['tiktok', 'instagram', 'facebook', 'pinterest'],
    formats: ['video', 'reel', 'carousel', 'feed', 'pin'],
  },
  {
    id: 'grwm-rant',
    label: 'GRWM / car rant',
    hint: 'Spoken, messy, native short-form',
    craft: [
      'Write as GRWM, car rant, or get-ready energy: mid-action, handheld, unpolished, fast in.',
      'Voiceover must sound like real speech, not caption copy. Contractions, asides, half-laughs in the direction notes are fine; keep the spoken lines clean and brand-safe.',
      'One clear insight lands mid-piece. Soft point-to-bio ending, human not salesy.',
    ].join(' '),
    platforms: ['tiktok', 'instagram'],
    formats: ['video', 'reel'],
    shortFormDefault: true,
  },
  {
    id: 'reply-comment',
    label: 'Reply to comment',
    hint: 'Tutorial reply structure',
    craft: [
      'Frame as replying to a real comment or question (how do I actually start, why does Sunday feel like dread).',
      'Teach a concrete micro-method in steps she can do tonight. No blank-page advice.',
      'End with free action first, paid system second. Helpful before promotional.',
    ].join(' '),
    platforms: ['tiktok', 'instagram', 'facebook'],
    formats: ['video', 'reel', 'feed', 'carousel'],
  },
  {
    id: 'scene-reframe',
    label: 'Scene reframe',
    hint: 'Specific hour, then the real problem',
    craft: [
      'Open on a precise time-of-day scene (2am wake, Sunday 7pm pit, 5pm witching hour, 7:48 shoes).',
      'Agitate with what she feels in her body, then reframe as a design problem not a character flaw.',
      'Offer the mechanism in plain language, then a soft next step tied to the offer.',
    ].join(' '),
    platforms: ['instagram', 'facebook', 'tiktok', 'email'],
    formats: ['feed', 'video', 'reel', 'email', 'story'],
  },
  {
    id: 'make-visible',
    label: 'Make it visible',
    hint: 'Handoff, partner, invisible work',
    craft: [
      'Center the idea that invisible work cannot be shared. Make the load visible first.',
      'Use a partner, family, or "where does this go" moment without punching down at fathers or partners.',
      'The fix is structural: out of her head, onto one page, then handoff scripts. Permission-heavy close.',
    ].join(' '),
    platforms: ['instagram', 'facebook', 'tiktok', 'email'],
    formats: ['feed', 'video', 'reel', 'carousel', 'email'],
  },
  {
    id: 'battle-cry',
    label: 'Battle cry',
    hint: 'Movement register, plural we',
    craft: [
      'Write in the Movement register: plural we, generational, refuse to disappear.',
      'Bigger than one product. Still honest and calibrated, never preachy or saccharine.',
      'Invite her in. "Are you in?" energy without hype or exclamation spam.',
    ].join(' '),
    platforms: ['instagram', 'facebook', 'email', 'x'],
    formats: ['feed', 'email', 'thread', 'story'],
  },
  {
    id: 'authority',
    label: 'Authority thesis',
    hint: 'Category claim, infrastructure',
    craft: [
      'Write in the Authority register: Mental Load Infrastructure, not productivity or wellness.',
      'Credible, structurally precise. Forever line energy: productivity optimizes, wellness copes, MotherMode replaces.',
      'Still human, never corporate buzzwords. Good for press-adjacent and high-sophistication readers.',
    ].join(' '),
    platforms: ['x', 'blog', 'aeo', 'facebook', 'email'],
    formats: ['feed', 'article', 'blog', 'answer', 'thread', 'email'],
  },
  {
    id: 'short-form-script',
    label: 'Short-form script',
    hint: 'Full viral video architecture',
    craft: [
      'Write a native short-form video script engineered to stop the scroll.',
      'Beat architecture: Hook (0-3s) → Relate → Reframe/Name the system → Proof or what helped → Soft CTA (bio/link).',
      'Every beat needs at, onScreen (short lowercase-friendly line), voiceover (spoken, conversational), visual (shot direction, real light, unpolished).',
      'Hook must work with sound off via on-screen text. No hard sell. No wellness clichés. Specific > abstract.',
      'Caption is a short afterthought, not a second essay. CTA points to bio or the offer without stuffing a URL.',
    ].join(' '),
    platforms: ['tiktok', 'instagram', 'facebook'],
    formats: ['video', 'reel'],
    shortFormDefault: true,
  },
  {
    id: 'carousel-truth',
    label: 'Carousel truth',
    hint: 'Slide-by-slide truth stack',
    craft: [
      'Build a carousel that stacks truth one slide at a time. Slide 1 is the scroll-stop. Middle slides name and reframe. Final slide is permission + soft CTA.',
      'Each slide text is short enough to read in under 3 seconds. Sub lines optional and quieter.',
      'Visual notes stay object-led and lived-in, not stock-smile motherhood.',
    ].join(' '),
    platforms: ['instagram', 'facebook', 'pinterest'],
    formats: ['carousel', 'idea', 'story'],
  },
  {
    id: 'email-confidante',
    label: 'Email confidante',
    hint: 'Letter from a smart friend',
    craft: [
      'Write as a confidante email: subject that earns the open without clickbait, preheader that continues the thought.',
      'Body reads like a letter, not a newsletter template. One clear story or insight, one CTA.',
      'No "hope you are well." No apology openers. Warm, direct, calibrated.',
    ].join(' '),
    platforms: ['email'],
    formats: ['email'],
  },
];

/** Look up a style by id. */
export function getPromptStyle(id?: string | null): PromptStyle | undefined {
  return id ? PROMPT_STYLES.find((s) => s.id === id) : undefined;
}

/** Styles that are a strong fit for a platform/format pair (plus Auto always). */
export function stylesFor(
  platform?: ContentPlatform,
  format?: ContentFormat,
): PromptStyle[] {
  return PROMPT_STYLES.filter((s) => {
    if (s.id === AUTO_STYLE) return true;
    const platformOk =
      !s.platforms?.length || !platform || s.platforms.includes(platform);
    const formatOk =
      !s.formats?.length || !format || s.formats.includes(format);
    return platformOk && formatOk;
  });
}

/**
 * Resolve which style craft to inject. Auto picks a strong default for
 * short-form video, else 11pm text for social, else authority for long-form.
 */
export function resolvePromptStyle(
  id: string | undefined,
  platform: ContentPlatform,
  format: ContentFormat,
): PromptStyle {
  if (id && id !== AUTO_STYLE) {
    const picked = getPromptStyle(id);
    if (picked) return picked;
  }
  const shortForm = format === 'video' || format === 'reel';
  if (shortForm) {
    return (
      PROMPT_STYLES.find((s) => s.id === 'short-form-script') ??
      PROMPT_STYLES[0]
    );
  }
  if (format === 'email' || platform === 'email') {
    return (
      PROMPT_STYLES.find((s) => s.id === 'email-confidante') ?? PROMPT_STYLES[0]
    );
  }
  if (format === 'carousel' || format === 'idea') {
    return (
      PROMPT_STYLES.find((s) => s.id === 'carousel-truth') ?? PROMPT_STYLES[0]
    );
  }
  if (
    format === 'blog' ||
    format === 'answer' ||
    format === 'article' ||
    platform === 'blog' ||
    platform === 'aeo'
  ) {
    return PROMPT_STYLES.find((s) => s.id === 'authority') ?? PROMPT_STYLES[0];
  }
  return PROMPT_STYLES.find((s) => s.id === 'eleven-pm') ?? PROMPT_STYLES[0];
}

/** Craft block for the resolved style, or empty when there is nothing to add. */
export function styleCraftLine(
  id: string | undefined,
  platform: ContentPlatform,
  format: ContentFormat,
): string {
  const style = resolvePromptStyle(id, platform, format);
  if (!style.craft) return '';
  return `Prompt style "${style.label}": ${style.craft}`;
}
