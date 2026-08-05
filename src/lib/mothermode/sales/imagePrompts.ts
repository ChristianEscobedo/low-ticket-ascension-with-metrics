/**
 * Task C — congruent image-prompt derivation for the sales funnel.
 *
 * The problem this solves is not "we cannot generate images" — `aiGenerateImage`
 * and `FunnelMediaStudio` already exist and work. The problem is that the only
 * prompt derivation in the repo was an inline string literal inside
 * `SalesFunnelEditor.onGenerateImages`, hardcoding
 * `'Warm dark background, brass and bone palette, calm luxury'` — MotherMode's
 * visual world — into every funnel any user generates. That is the image-side
 * twin of the `'Loni Brown'` / `'MotherMode'` copy literals the coverage audit
 * found, and it fails the same way: confidently wrong rather than visibly empty.
 *
 * So prompts derive from `FunnelBrief.visual`, the same brief the copy
 * generators read (`funnelBrief.ts`). One brief → one visual world → congruent
 * images across optin, sales, checkout and the four upsells.
 *
 * Deliberate limits:
 *   - **Images only.** Video slots (`heroVideoUrl`, `vsl.videoUrl`,
 *     `welcomeVideoUrl`, `upsellN.videoUrl`) are Task D. `mediaVideoPoster` IS
 *     covered here — a poster is a still.
 *   - **No brand invention.** If `brief.visual` is empty the fallback is a
 *     neutral, offer-agnostic look, and the gap is reported in
 *     `SalesImagePromptSet.assumedVisualFields` so the hole stays countable
 *     rather than silently papered over with somebody else's palette.
 */

import type { FunnelBrief } from './funnelBrief';
import { normalizeFunnelBrief } from './funnelBrief';

/** Stable key per image slot. Mirrors the MEDIA rows in the coverage audit. */
export type SalesImageSlotKey =
  | 'optinCover'
  | 'salesHero'
  | 'salesFounder'
  | 'checkoutProduct'
  | 'upsell1Product'
  | 'upsell2Product'
  | 'upsell3Product'
  | 'upsell4Product'
  | 'upsell1Poster'
  | 'upsell2Poster'
  | 'upsell3Poster'
  | 'upsell4Poster'
  | 'upsell1Gallery'
  | 'upsell2Gallery'
  | 'upsell3Gallery'
  | 'upsell4Gallery';

/** What the image has to *do* on the page. Drives framing, not styling. */
export type SalesImageIntent =
  | 'lead-magnet-cover'
  | 'hero'
  | 'portrait'
  | 'product-thumbnail'
  | 'product-mockup'
  | 'video-poster'
  | 'gallery-shot';

/**
 * Aspect ratios `aiGenerateImage` accepts. Named so callers that thread a
 * slot's format through to the generator can type it without restating the
 * union and letting the two drift.
 */
export type SalesImageFormat = 'feed' | 'wide' | 'portrait' | 'square';

export interface SalesImageSlot {
  key: SalesImageSlotKey;
  /** Page block the field lives on, as named in `SalesFunnelRecord`. */
  page: 'optin' | 'sales' | 'checkout' | 'upsell1' | 'upsell2' | 'upsell3' | 'upsell4';
  /** Dotted field path inside that block. */
  field: string;
  label: string;
  intent: SalesImageIntent;
  /** Format hint passed straight to `aiGenerateImage(prompt, format)`. */
  format: SalesImageFormat;
  /** Gallery slots render several images from one slot definition. */
  count: number;
}

/**
 * Every image slot in the funnel, enumerated once.
 *
 * Source of truth is the MEDIA section of `scripts/ai-fill-coverage.txt`, minus
 * the pure-video fields. Keeping this as data (not a switch) is what lets the
 * audit assert slot coverage later instead of trusting a comment.
 */
export const SALES_IMAGE_SLOTS: SalesImageSlot[] = [
  { key: 'optinCover', page: 'optin', field: 'coverImageUrl', label: 'Optin cover', intent: 'lead-magnet-cover', format: 'feed', count: 1 },
  { key: 'salesHero', page: 'sales', field: 'heroImageUrl', label: 'Sales hero', intent: 'hero', format: 'wide', count: 1 },
  { key: 'salesFounder', page: 'sales', field: 'founderPhotoUrl', label: 'Founder photo', intent: 'portrait', format: 'portrait', count: 1 },
  { key: 'checkoutProduct', page: 'checkout', field: 'productImageUrl', label: 'Checkout product', intent: 'product-thumbnail', format: 'square', count: 1 },
  { key: 'upsell1Product', page: 'upsell1', field: 'imageUrl', label: 'Upsell 1 product', intent: 'product-mockup', format: 'feed', count: 1 },
  { key: 'upsell2Product', page: 'upsell2', field: 'imageUrl', label: 'Upsell 2 product', intent: 'product-mockup', format: 'feed', count: 1 },
  { key: 'upsell3Product', page: 'upsell3', field: 'imageUrl', label: 'Upsell 3 product', intent: 'product-mockup', format: 'feed', count: 1 },
  { key: 'upsell4Product', page: 'upsell4', field: 'imageUrl', label: 'Upsell 4 product', intent: 'product-mockup', format: 'feed', count: 1 },
  { key: 'upsell1Poster', page: 'upsell1', field: 'mediaVideoPoster', label: 'Upsell 1 video poster', intent: 'video-poster', format: 'wide', count: 1 },
  { key: 'upsell2Poster', page: 'upsell2', field: 'mediaVideoPoster', label: 'Upsell 2 video poster', intent: 'video-poster', format: 'wide', count: 1 },
  { key: 'upsell3Poster', page: 'upsell3', field: 'mediaVideoPoster', label: 'Upsell 3 video poster', intent: 'video-poster', format: 'wide', count: 1 },
  { key: 'upsell4Poster', page: 'upsell4', field: 'mediaVideoPoster', label: 'Upsell 4 video poster', intent: 'video-poster', format: 'wide', count: 1 },
  { key: 'upsell1Gallery', page: 'upsell1', field: 'gallery[].imageUrl', label: 'Upsell 1 gallery', intent: 'gallery-shot', format: 'feed', count: 3 },
  { key: 'upsell2Gallery', page: 'upsell2', field: 'gallery[].imageUrl', label: 'Upsell 2 gallery', intent: 'gallery-shot', format: 'feed', count: 3 },
  { key: 'upsell3Gallery', page: 'upsell3', field: 'gallery[].imageUrl', label: 'Upsell 3 gallery', intent: 'gallery-shot', format: 'feed', count: 3 },
  { key: 'upsell4Gallery', page: 'upsell4', field: 'gallery[].imageUrl', label: 'Upsell 4 gallery', intent: 'gallery-shot', format: 'feed', count: 3 },
];

/**
 * Page-level nouns the brief does not carry (a lead magnet title, an upsell
 * name). Everything here is optional — a missing name degrades the prompt to
 * the offer name rather than blocking generation.
 */
export interface SalesImagePromptContext {
  magnetTitle?: string;
  founderRole?: string;
  checkoutProductName?: string;
  /** Index 0 → upsell1 … index 3 → upsell4. */
  upsellNames?: (string | undefined)[];
}

export interface SalesImagePrompt {
  slot: SalesImageSlotKey;
  page: SalesImageSlot['page'];
  field: string;
  label: string;
  format: SalesImageSlot['format'];
  intent: SalesImageIntent;
  /** The positive prompt. */
  imagePrompt: string;
  /** Fed to models that accept one; also readable as "what went wrong last time". */
  negativePrompt: string;
  /** For gallery slots: one prompt per shot, already varied. */
  variants: string[];
}

export interface SalesImagePromptSet {
  prompts: Record<SalesImageSlotKey, SalesImagePrompt>;
  /**
   * Dotted `visual.*` paths that were empty and got a neutral fallback. Non-empty
   * means the images are generic, not on-brand — surface it, do not swallow it.
   */
  assumedVisualFields: string[];
  /** The shared style sentence every prompt in this set embeds verbatim. */
  styleLine: string;
}

// ---------------------------------------------------------------------------
// Visual resolution
// ---------------------------------------------------------------------------

/**
 * Neutral fallback. Chosen to be *forgettable* rather than tasteful: if the
 * brief has no visual direction, generic-clean is honest, whereas inheriting a
 * previous brand's palette is a lie that renders.
 */
const NEUTRAL_STYLE = ['clean', 'editorial', 'uncluttered'];
const NEUTRAL_LIGHTING = 'soft even daylight';
const NEUTRAL_COMPOSITION = 'centred subject, generous negative space';
const BASE_AVOID = ['text', 'watermarks', 'logos', 'distorted hands', 'busy backgrounds'];

interface ResolvedVisual {
  subject: string;
  palette: string[];
  styleKeywords: string[];
  lighting: string;
  composition: string;
  avoid: string[];
  assumed: string[];
}

function resolveVisual(brief: FunnelBrief): ResolvedVisual {
  const v = brief.visual;
  const assumed: string[] = [];

  const subject = v.subject.trim() || brief.offer.name.trim() || brief.audience.niche.trim();
  if (!v.subject.trim()) assumed.push('visual.subject');

  const palette = v.palette.length ? v.palette : [];
  if (!v.palette.length) assumed.push('visual.palette');

  const styleKeywords = v.styleKeywords.length ? v.styleKeywords : NEUTRAL_STYLE;
  if (!v.styleKeywords.length) assumed.push('visual.styleKeywords');

  const lighting = v.lighting.trim() || NEUTRAL_LIGHTING;
  if (!v.lighting.trim()) assumed.push('visual.lighting');

  const composition = v.composition.trim() || NEUTRAL_COMPOSITION;
  if (!v.composition.trim()) assumed.push('visual.composition');

  const avoid = Array.from(new Set([...BASE_AVOID, ...v.avoid]));

  return { subject, palette, styleKeywords, lighting, composition, avoid, assumed };
}

/**
 * The one sentence every image in the funnel shares. Congruence lives here: if
 * two images differ, they differ in framing, never in world.
 */
export function formatVisualStyleLine(brief: FunnelBrief): string {
  const v = resolveVisual(normalizeFunnelBrief(brief));
  const bits = [
    v.styleKeywords.join(', '),
    v.palette.length ? `${v.palette.join(' and ')} palette` : '',
    v.lighting,
    v.composition,
  ].filter(Boolean);
  return bits.join('. ') + '.';
}

// ---------------------------------------------------------------------------
// Per-slot framing
// ---------------------------------------------------------------------------

function nameFor(slot: SalesImageSlot, brief: FunnelBrief, ctx: SalesImagePromptContext): string {
  const offer = brief.offer.name.trim() || brief.audience.niche.trim() || 'the offer';
  switch (slot.key) {
    case 'optinCover':
      return ctx.magnetTitle?.trim() || offer;
    case 'checkoutProduct':
      return ctx.checkoutProductName?.trim() || offer;
    case 'upsell1Product':
    case 'upsell1Poster':
    case 'upsell1Gallery':
      return ctx.upsellNames?.[0]?.trim() || brief.offer.upsellNames[0] || offer;
    case 'upsell2Product':
    case 'upsell2Poster':
    case 'upsell2Gallery':
      return ctx.upsellNames?.[1]?.trim() || brief.offer.upsellNames[1] || offer;
    case 'upsell3Product':
    case 'upsell3Poster':
    case 'upsell3Gallery':
      return ctx.upsellNames?.[2]?.trim() || brief.offer.upsellNames[2] || offer;
    case 'upsell4Product':
    case 'upsell4Poster':
    case 'upsell4Gallery':
      return ctx.upsellNames?.[3]?.trim() || brief.offer.upsellNames[3] || offer;
    default:
      return offer;
  }
}

/** Framing per intent: what is in shot and how it is shot. Never styling. */
function framingFor(
  intent: SalesImageIntent,
  subjectName: string,
  brief: FunnelBrief,
  ctx: SalesImagePromptContext,
  variantIndex: number,
): string {
  const audience = brief.audience.avatar.trim() || brief.audience.niche.trim();
  const forWhom = audience ? ` for ${audience}` : '';

  switch (intent) {
    case 'lead-magnet-cover':
      return `Cover mockup for the free resource "${subjectName}"${forWhom}, shown as a physical-feeling digital artefact on a flat surface`;
    case 'hero':
      return `Wide hero image showing "${subjectName}" in the context it is actually used${forWhom}, aspirational but calm, room at the left for a headline overlay`;
    case 'portrait': {
      const role = ctx.founderRole?.trim() || brief.identity.founderRole.trim();
      const who = role ? `the ${role}` : 'the founder';
      return `Editorial portrait-style brand image representing ${who} behind "${subjectName}", relaxed, at eye level, shallow depth of field`;
    }
    case 'product-thumbnail':
      return `Compact order-summary thumbnail of "${subjectName}", small in frame, single object, clean surface`;
    case 'product-mockup':
      return `Product mockup for the upgrade "${subjectName}", presented as a tangible kit or device screen, three-quarter angle`;
    case 'video-poster':
      return `Video poster frame for "${subjectName}", a paused-moment feel with an implied subject mid-action, 16:9, uncropped centre for a play button`;
    case 'gallery-shot': {
      // Varied angles so a 3-up gallery reads as a set, not three near-duplicates.
      const angles = [
        'overhead flat-lay of the components',
        'close detail crop of one element',
        'in-use context shot at a desk or table',
      ];
      return `Gallery shot ${variantIndex + 1} of "${subjectName}": ${angles[variantIndex % angles.length]}`;
    }
    default:
      return `Image representing "${subjectName}"`;
  }
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

/** One slot's prompt. Exported for per-slot regeneration from the media studio. */
export function buildSalesImagePrompt(
  brief: FunnelBrief,
  slot: SalesImageSlot,
  ctx: SalesImagePromptContext = {},
): SalesImagePrompt {
  const b = normalizeFunnelBrief(brief);
  const v = resolveVisual(b);
  const styleLine = formatVisualStyleLine(b);
  const subjectName = nameFor(slot, b, ctx);

  const variants: string[] = [];
  for (let i = 0; i < Math.max(1, slot.count); i += 1) {
    variants.push([framingFor(slot.intent, subjectName, b, ctx, i), styleLine, 'No text in the image.'].join(' '));
  }

  return {
    slot: slot.key,
    page: slot.page,
    field: slot.field,
    label: slot.label,
    format: slot.format,
    intent: slot.intent,
    imagePrompt: variants[0],
    negativePrompt: v.avoid.join(', '),
    variants,
  };
}

/** Every image slot in the funnel, derived from one brief in one pass. */
export function buildSalesImagePrompts(
  brief: FunnelBrief,
  ctx: SalesImagePromptContext = {},
): SalesImagePromptSet {
  const b = normalizeFunnelBrief(brief);
  const prompts = {} as Record<SalesImageSlotKey, SalesImagePrompt>;
  SALES_IMAGE_SLOTS.forEach((slot) => {
    prompts[slot.key] = buildSalesImagePrompt(b, slot, ctx);
  });
  return {
    prompts,
    assumedVisualFields: resolveVisual(b).assumed,
    styleLine: formatVisualStyleLine(b),
  };
}

/** Lookup helper so callers do not hand-index `SALES_IMAGE_SLOTS`. */
export function salesImageSlot(key: SalesImageSlotKey): SalesImageSlot {
  const found = SALES_IMAGE_SLOTS.find((s) => s.key === key);
  if (!found) throw new Error('Unknown sales image slot: ' + key);
  return found;
}
