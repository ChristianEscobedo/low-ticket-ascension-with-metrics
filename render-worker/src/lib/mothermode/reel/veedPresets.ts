/**
 * The VEED Subtitles API preset catalog — Basic (1×) and Dynamic (2×) tiers,
 * with cost multipliers and the official example compilation video.
 *
 * WHY THE TIERS MATTER
 * --------------------
 * Pricing compounds: base rate ($0.10/min) × preset tier (Basic 1×, Dynamic
 * 2×) × resolution (≤1080p 1×, >1080p 2×). A 4K Dynamic render bills at
 * 2×2 = 4× the base rate. The UI shows the multiplier so a render never
 * surprises the bill.
 */
export type VeedPresetTier = 'basic' | 'dynamic';

export interface VeedPreset {
  id: string;
  tier: VeedPresetTier;
  label: string;
  hint: string;
}

/** The official VEED preset compilation — what each style looks like. */
export const VEED_EXAMPLE_VIDEO_URL =
  'https://vxnikdhgwmcmvanqjeug.supabase.co/storage/v1/object/public/media/reel-studio/c5_GsxsCQaMZ3z-g2ehs2_substyle-example-output-compilation-v3%20(2).mp4';

export const VEED_BASIC_PRESETS: VeedPreset[] = [
  { id: 'simple', tier: 'basic', label: 'Simple', hint: 'Clean minimal captions' },
  { id: 'plain', tier: 'basic', label: 'Plain', hint: 'No-frills readable lines' },
  { id: 'beans', tier: 'basic', label: 'Beans', hint: 'Rounded friendly type' },
  { id: 'corpo', tier: 'basic', label: 'Corpo', hint: 'Corporate lower-third look' },
  { id: 'boo', tier: 'basic', label: 'Boo', hint: 'Playful bold captions' },
  { id: 'shadeplay', tier: 'basic', label: 'Shadeplay', hint: 'Strong drop-shadow style' },
  { id: 'casper', tier: 'basic', label: 'Casper', hint: 'Soft ghost-light captions' },
  { id: 'capri', tier: 'basic', label: 'Capri', hint: 'Bright casual captions' },
  { id: 'lowkey', tier: 'basic', label: 'Lowkey', hint: 'Subtle understated style' },
  { id: 'vinta', tier: 'basic', label: 'Vinta', hint: 'Vintage-feel type' },
  { id: 'diego', tier: 'basic', label: 'Diego', hint: 'Warm hand-feel captions' },
  { id: 'ali', tier: 'basic', label: 'Ali', hint: 'Boxing-ring bold energy' },
  { id: 'slay', tier: 'basic', label: 'Slay', hint: 'High-confidence glossy type' },
  { id: 'kitty', tier: 'basic', label: 'Kitty', hint: 'Cute rounded captions' },
  { id: 'hustle', tier: 'basic', label: 'Hustle', hint: 'Grind-culture bold style' },
  { id: 'karl', tier: 'basic', label: 'Karl', hint: 'Fashion-editorial look' },
  { id: 'sprout', tier: 'basic', label: 'Sprout', hint: 'Fresh organic-feel type' },
  { id: 'flex', tier: 'basic', label: 'Flex', hint: 'Gym-energy bold captions' },
  { id: 'mint', tier: 'basic', label: 'Mint', hint: 'Cool fresh-toned captions' },
  { id: 'rizz', tier: 'basic', label: 'Rizz', hint: 'Gen-Z energy captions' },
  { id: 'vegas', tier: 'basic', label: 'Vegas', hint: 'Neon marquee style' },
];

export const VEED_DYNAMIC_PRESETS: VeedPreset[] = [
  { id: 'glass', tier: 'dynamic', label: 'Glass', hint: 'Glassmorphism caption panels' },
  { id: 'whisper', tier: 'dynamic', label: 'Whisper', hint: 'Soft animated word reveals' },
  { id: 'glide', tier: 'dynamic', label: 'Glide', hint: 'Smooth sliding karaoke' },
  { id: 'glide2', tier: 'dynamic', label: 'Glide 2', hint: 'Glide with extra motion polish' },
  { id: 'fusion', tier: 'dynamic', label: 'Fusion', hint: 'Blended animated styles' },
  { id: 'terminal', tier: 'dynamic', label: 'Terminal', hint: 'Typewriter console look' },
  { id: 'handwritten', tier: 'dynamic', label: 'Handwritten', hint: 'Animated hand-drawn feel' },
  { id: 'backdrop', tier: 'dynamic', label: 'Backdrop', hint: 'Text BEHIND the subject — cinematic depth' },
  { id: 'backdrop2', tier: 'dynamic', label: 'Backdrop 2', hint: 'Backdrop with a second depth treatment' },
];

export const ALL_VEED_PRESETS: VeedPreset[] = [...VEED_BASIC_PRESETS, ...VEED_DYNAMIC_PRESETS];

/** The cost multiplier for a preset tier (compounds with the resolution tier). */
export function veedTierMultiplier(tier: VeedPresetTier): number {
  return tier === 'dynamic' ? 2 : 1;
}

/** The cost multiplier for a resolution tier. */
export function veedResolutionMultiplier(resolution: '1080p' | '4k'): number {
  return resolution === '4k' ? 2 : 1;
}

/** Total cost multiplier for a render, e.g. 4K Dynamic = 2×2 = 4× the base rate. */
export function veedCostMultiplier(presetId: string, resolution: '1080p' | '4k'): number {
  const preset = ALL_VEED_PRESETS.find((p) => p.id === presetId);
  const tier = preset?.tier ?? 'basic';
  return veedTierMultiplier(tier) * veedResolutionMultiplier(resolution);
}

/** Estimated cost in dollars for a render at $0.10/min base. */
export function veedCostEstimate(opts: {
  presetId: string;
  resolution: '1080p' | '4k';
  durationSec: number;
}): number {
  const mult = veedCostMultiplier(opts.presetId, opts.resolution);
  const minutes = Math.max(0, opts.durationSec) / 60;
  return Math.round(minutes * 0.1 * mult * 100) / 100;
}

/** Look up a preset; falls back to the first basic preset for unknown ids. */
export function veedPresetFor(id: string): VeedPreset {
  return ALL_VEED_PRESETS.find((p) => p.id === id) ?? VEED_BASIC_PRESETS[0];
}
