/**
 * Variation Lab: dimensions, brief/variation system copy, and helpers for
 * brief → prompt → generate and seed-based creative testing.
 */

export type VariationDimensionId =
  | 'headline'
  | 'hook'
  | 'format_structure'
  | 'color'
  | 'action_placement'
  | 'device_mockup'
  | 'crop_framing'
  | 'lighting_mood'
  | 'background'
  | 'text_treatment'
  | 'cta_badge'
  | 'carousel_continuity'
  | 'story_sequence';

export interface VariationDimension {
  id: VariationDimensionId;
  label: string;
  description: string;
  /** Hint injected into the variation planner for this axis. */
  plannerHint: string;
  /** Formats where this dimension is especially useful. */
  formats?: string[];
}

/** All creative-test axes the lab can run. */
export const VARIATION_DIMENSIONS: VariationDimension[] = [
  {
    id: 'headline',
    label: 'Headline',
    description: 'On-image headline copy and hierarchy',
    plannerHint:
      'Change only the on-image headline treatment: wording feel (still no legible tiny text if the model struggles — use bold short phrases or clear headline space), scale, and hierarchy. Keep subject and scene.',
  },
  {
    id: 'hook',
    label: 'Hook',
    description: 'Visual gut-punch tied to alternate hooks',
    plannerHint:
      'Reframe the image so a different emotional hook leads: new focal tension or opening beat while keeping brand world and subject identity.',
  },
  {
    id: 'format_structure',
    label: 'Format / structure',
    description: 'Layout: full-bleed, split, type-led, object-led',
    plannerHint:
      'Change composition structure only: full-bleed vs split layout vs type-led negative space vs object-centered still. Same story, different structure.',
  },
  {
    id: 'color',
    label: 'Color',
    description: 'Palette and grade',
    plannerHint:
      'Shift color grade and palette while keeping subject and framing. Prefer warm bone, soft aubergine accents, brass highlights, or a clear alternate grade for A/B.',
  },
  {
    id: 'action_placement',
    label: 'Action / placement',
    description: 'Pose, props, CTA zone, safe margins',
    plannerHint:
      'Change subject action, prop placement, and where the eye lands for a CTA-safe zone. Keep identity and environment family.',
  },
  {
    id: 'device_mockup',
    label: 'Device mockup',
    description: 'Phone / laptop / tablet or story UI chrome',
    plannerHint:
      'Place the creative inside a realistic device mockup (phone story UI, laptop browser, tablet) or add subtle native UI chrome. Premium product-shot feel, not clipart.',
  },
  {
    id: 'crop_framing',
    label: 'Crop / framing',
    description: 'Tight vs wide, thirds, negative space',
    plannerHint:
      'Reframe only: tighter crop, wider establishing, rule-of-thirds, or generous negative space for type. Same moment.',
  },
  {
    id: 'lighting_mood',
    label: 'Lighting / mood',
    description: 'Time of day, contrast, warmth',
    plannerHint:
      'Change lighting and mood only: dawn, golden hour, overcast soft, low lamp night, higher contrast editorial. Same subjects.',
  },
  {
    id: 'background',
    label: 'Background / environment',
    description: 'Setting swap, keep subject',
    plannerHint:
      'Swap or simplify the environment/background while locking the main subject and product. Lived-in home world preferred.',
  },
  {
    id: 'text_treatment',
    label: 'Text treatment',
    description: 'Caption bar, editorial type feel, stickers',
    plannerHint:
      'Vary how text would sit: clean editorial type zone, soft caption bar, minimal sticker-style accent. Prefer reserved space over tiny illegible copy.',
  },
  {
    id: 'cta_badge',
    label: 'CTA badge',
    description: 'Soft offer chip or button placement',
    plannerHint:
      'Add or relocate a soft CTA badge/chip (e.g. subtle corner pill) without clutter. Premium and quiet, not shouty banner ads.',
  },
  {
    id: 'carousel_continuity',
    label: 'Carousel continuity',
    description: 'One variable across a slide system',
    plannerHint:
      'Design as one slide in a consistent carousel system: shared margins, type zone, accent language. Only the tested variable changes; continuity with sibling slides is required.',
    formats: ['carousel'],
  },
  {
    id: 'story_sequence',
    label: 'Story sequence',
    description: 'Vertical beat: hook → proof → CTA',
    plannerHint:
      'Treat as one frame in a vertical story sequence (hook / proof / CTA). Safe zones top and bottom for UI. Clear single beat per frame.',
    formats: ['story', 'idea', 'reel'],
  },
];

export function variationDimensionById(
  id: string,
): VariationDimension | undefined {
  return VARIATION_DIMENSIONS.find((d) => d.id === id);
}

/** Dimensions shown by default for a format. */
export function defaultDimensionsForFormat(format?: string): VariationDimensionId[] {
  const base: VariationDimensionId[] = [
    'headline',
    'hook',
    'color',
    'crop_framing',
    'lighting_mood',
  ];
  if (format === 'carousel') return [...base, 'format_structure', 'carousel_continuity'];
  if (format === 'story' || format === 'idea')
    return [...base, 'story_sequence', 'text_treatment'];
  if (format === 'reel' || format === 'video')
    return ['hook', 'action_placement', 'lighting_mood', 'crop_framing', 'device_mockup'];
  return [...base, 'format_structure', 'cta_badge'];
}

/** System craft for brief → image prompt conversion. */
export const VARIATION_BRIEF_SYSTEM = `You are the MotherMode art director converting a short creative brief into ready-to-render image prompts.

Rules:
- Object-led, lived-in, editorial documentary feel. Quiet premium. Warm bone surfaces, soft natural light, restrained aubergine/brass accents when color is implied.
- No em dashes. No stock-photo clichés. No busy collages.
- Prefer faces soft, partial, or absent unless the brief needs a person.
- Do not burn long paragraphs of text into the image; short headline space is ok when asked.
- Prompts must be complete scene directions: subject, setting, light, lens/mood, negative space, what to avoid.
- For carousel or story frame packs: ordered frames with a clear job each (cover/hook, proof, reframe, CTA). Shared visual system across frames.
- Return ONLY valid JSON. No prose, no code fences.`;

/** System craft for variation edit-instruction planning. */
export const VARIATION_PLAN_SYSTEM = `You are the MotherMode creative testing lead. Given a seed image context and selected test dimensions, you write precise image-edit instructions for each variant.

Rules:
- Each variant changes ONE primary dimension (or a clearly labeled combo if asked).
- Instructions are imperative and concrete for an image-edit model (what to keep, what to change).
- Preserve subject identity and brand world unless the dimension is background or full restyle.
- No em dashes. No vague "make it better."
- For carousel_continuity and story_sequence, stress safe margins and system consistency.
- Return ONLY valid JSON. No prose, no code fences.`;
