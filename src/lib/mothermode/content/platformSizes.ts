/**
 * Named platform image sizes for the Variation Lab smart-resize step.
 * Each preset is a pixel-perfect WxH target for fal-ai/smart-resize.
 */

export interface PlatformSizePreset {
  id: string;
  label: string;
  /** Exact "widthxheight" for fal target_sizes. */
  size: string;
  width: number;
  height: number;
  /** Platforms this size is commonly used on. */
  platforms?: string[];
  /** Content formats this size maps to. */
  formats?: string[];
  /** Short aspect label, e.g. "9:16". */
  aspect: string;
  /** Group for UI packing. */
  group: 'feed' | 'story' | 'carousel' | 'video' | 'longform' | 'ads' | 'other';
}

/** All named platform sizes the lab can target. */
export const PLATFORM_SIZE_PRESETS: PlatformSizePreset[] = [
  {
    id: 'ig-feed-45',
    label: 'IG Feed 4:5',
    size: '1080x1350',
    width: 1080,
    height: 1350,
    platforms: ['instagram'],
    formats: ['feed'],
    aspect: '4:5',
    group: 'feed',
  },
  {
    id: 'ig-fb-feed-11',
    label: 'IG/FB Feed 1:1',
    size: '1080x1080',
    width: 1080,
    height: 1080,
    platforms: ['instagram', 'facebook'],
    formats: ['feed', 'carousel'],
    aspect: '1:1',
    group: 'feed',
  },
  {
    id: 'ig-fb-story',
    label: 'Story / Reel / TikTok 9:16',
    size: '1080x1920',
    width: 1080,
    height: 1920,
    platforms: ['instagram', 'facebook', 'tiktok'],
    formats: ['story', 'reel', 'video', 'idea'],
    aspect: '9:16',
    group: 'story',
  },
  {
    id: 'ig-carousel-square',
    label: 'Carousel square',
    size: '1080x1080',
    width: 1080,
    height: 1080,
    platforms: ['instagram', 'facebook'],
    formats: ['carousel'],
    aspect: '1:1',
    group: 'carousel',
  },
  {
    id: 'ig-carousel-45',
    label: 'Carousel 4:5',
    size: '1080x1350',
    width: 1080,
    height: 1350,
    platforms: ['instagram'],
    formats: ['carousel'],
    aspect: '4:5',
    group: 'carousel',
  },
  {
    id: 'fb-feed-landscape',
    label: 'FB link / landscape',
    size: '1200x630',
    width: 1200,
    height: 630,
    platforms: ['facebook'],
    formats: ['feed'],
    aspect: '1.91:1',
    group: 'feed',
  },
  {
    id: 'x-blog-aeo',
    label: 'X / Blog / AEO 16:9',
    size: '1600x900',
    width: 1600,
    height: 900,
    platforms: ['x', 'blog', 'aeo'],
    formats: ['feed', 'article', 'blog', 'answer', 'thread'],
    aspect: '16:9',
    group: 'longform',
  },
  {
    id: 'pinterest-pin',
    label: 'Pinterest pin 2:3',
    size: '1000x1500',
    width: 1000,
    height: 1500,
    platforms: ['pinterest'],
    formats: ['pin'],
    aspect: '2:3',
    group: 'feed',
  },
  {
    id: 'pinterest-idea',
    label: 'Pinterest idea 9:16',
    size: '1080x1920',
    width: 1080,
    height: 1920,
    platforms: ['pinterest'],
    formats: ['idea'],
    aspect: '9:16',
    group: 'story',
  },
  {
    id: 'email-header',
    label: 'Email header',
    size: '1200x600',
    width: 1200,
    height: 600,
    platforms: ['email'],
    formats: ['email'],
    aspect: '2:1',
    group: 'longform',
  },
  {
    id: 'ad-45',
    label: 'Ad 4:5',
    size: '1080x1350',
    width: 1080,
    height: 1350,
    platforms: ['instagram', 'facebook'],
    formats: ['feed'],
    aspect: '4:5',
    group: 'ads',
  },
  {
    id: 'ad-11',
    label: 'Ad 1:1',
    size: '1080x1080',
    width: 1080,
    height: 1080,
    platforms: ['instagram', 'facebook'],
    formats: ['feed'],
    aspect: '1:1',
    group: 'ads',
  },
  {
    id: 'ad-916',
    label: 'Ad / Spark 9:16',
    size: '1080x1920',
    width: 1080,
    height: 1920,
    platforms: ['instagram', 'facebook', 'tiktok'],
    formats: ['reel', 'video', 'story'],
    aspect: '9:16',
    group: 'ads',
  },
];

/** Multi-select packs that fill several target sizes at once. */
export interface PlatformSizePack {
  id: string;
  label: string;
  description: string;
  /** Preset ids included in this pack (deduped by size string when resolved). */
  presetIds: string[];
}

export const PLATFORM_SIZE_PACKS: PlatformSizePack[] = [
  {
    id: 'ig-organic',
    label: 'IG organic set',
    description: 'Feed 4:5, square, story/reel',
    presetIds: ['ig-feed-45', 'ig-fb-feed-11', 'ig-fb-story'],
  },
  {
    id: 'ig-carousel',
    label: 'Carousel set',
    description: 'Square + 4:5 carousel slides',
    presetIds: ['ig-carousel-square', 'ig-carousel-45'],
  },
  {
    id: 'story-vertical',
    label: 'Stories & vertical video',
    description: '1080×1920 for story, reel, TikTok, idea pins',
    presetIds: ['ig-fb-story'],
  },
  {
    id: 'fb-set',
    label: 'Facebook set',
    description: 'Square feed, landscape link, story',
    presetIds: ['ig-fb-feed-11', 'fb-feed-landscape', 'ig-fb-story'],
  },
  {
    id: 'ads-core',
    label: 'Ads core',
    description: '1:1, 4:5, 9:16 ad units',
    presetIds: ['ad-11', 'ad-45', 'ad-916'],
  },
  {
    id: 'longform',
    label: 'Long-form headers',
    description: 'Blog/X/AEO 16:9 + email',
    presetIds: ['x-blog-aeo', 'email-header'],
  },
  {
    id: 'pinterest',
    label: 'Pinterest',
    description: 'Pin 2:3 + idea 9:16',
    presetIds: ['pinterest-pin', 'pinterest-idea'],
  },
  {
    id: 'all-social',
    label: 'All social',
    description: 'Common feed, story, pin, landscape',
    presetIds: [
      'ig-feed-45',
      'ig-fb-feed-11',
      'ig-fb-story',
      'fb-feed-landscape',
      'pinterest-pin',
      'x-blog-aeo',
    ],
  },
];

/** Validate a freeform "WxH" size string. */
export function parseSizeString(raw: string): { width: number; height: number; size: string } | null {
  const m = raw.trim().toLowerCase().match(/^(\d{2,5})\s*[x×]\s*(\d{2,5})$/);
  if (!m) return null;
  const width = Number(m[1]);
  const height = Number(m[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (width < 64 || height < 64 || width > 8192 || height > 8192) return null;
  return { width, height, size: `${width}x${height}` };
}

/** Resolve preset ids + custom sizes into a unique list of "WxH" strings (max 10). */
export function resolveTargetSizes(args: {
  presetIds?: string[];
  customSizes?: string[];
  max?: number;
}): string[] {
  const max = Math.max(1, Math.min(10, args.max ?? 10));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of args.presetIds ?? []) {
    const p = PLATFORM_SIZE_PRESETS.find((x) => x.id === id);
    if (!p || seen.has(p.size)) continue;
    seen.add(p.size);
    out.push(p.size);
    if (out.length >= max) return out;
  }
  for (const c of args.customSizes ?? []) {
    const parsed = parseSizeString(c);
    if (!parsed || seen.has(parsed.size)) continue;
    seen.add(parsed.size);
    out.push(parsed.size);
    if (out.length >= max) return out;
  }
  return out;
}

/** Default size preset ids for a content format (carousel/story aware). */
export function defaultPresetIdsForFormat(format?: string): string[] {
  switch (format) {
    case 'story':
    case 'reel':
    case 'video':
    case 'idea':
      return ['ig-fb-story'];
    case 'carousel':
      return ['ig-carousel-square', 'ig-carousel-45'];
    case 'pin':
      return ['pinterest-pin'];
    case 'blog':
    case 'article':
    case 'answer':
    case 'thread':
      return ['x-blog-aeo'];
    case 'email':
      return ['email-header'];
    case 'feed':
    default:
      return ['ig-feed-45', 'ig-fb-feed-11'];
  }
}

/** Whether a format is multi-frame (carousel / story / idea pin). */
export function isMultiFrameFormat(format?: string): boolean {
  return format === 'carousel' || format === 'story' || format === 'idea';
}
