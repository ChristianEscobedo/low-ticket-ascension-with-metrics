// Reel Studio scheduling helpers.
import { slugifyUtm, suggestUtm, type UtmParams } from '@/lib/mothermode/planner/utm';

export interface ReelPostType {
  id: string;
  label: string;
  aspect: '9:16' | '16:9';
  targetSec: number;
  maxSec: number;
}

export interface ReelPlatform {
  id: string;
  label: string;
  types: ReelPostType[];
}

export const REEL_PLATFORMS: ReelPlatform[] = [
  {
    id: 'youtube',
    label: 'YouTube',
    types: [
      { id: 'shorts', label: 'Shorts', aspect: '9:16', targetSec: 60, maxSec: 180 },
      { id: 'ytfeed', label: 'Feed', aspect: '16:9', targetSec: 180, maxSec: 0 },
      { id: 'youtube', label: 'Watch', aspect: '16:9', targetSec: 480, maxSec: 0 },
    ],
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    types: [{ id: 'tiktok', label: 'For You', aspect: '9:16', targetSec: 60, maxSec: 600 }],
  },
  {
    id: 'instagram',
    label: 'Instagram',
    types: [{ id: 'reels', label: 'Reels', aspect: '9:16', targetSec: 90, maxSec: 90 }],
  },
  {
    id: 'facebook',
    label: 'Facebook',
    types: [
      { id: 'fbreels', label: 'Reels', aspect: '9:16', targetSec: 90, maxSec: 90 },
      { id: 'fbstory', label: 'Story · 15s cards', aspect: '9:16', targetSec: 15, maxSec: 15 },
      { id: 'fbfeed', label: 'Feed', aspect: '16:9', targetSec: 120, maxSec: 240 },
    ],
  },
  {
    id: 'x',
    label: 'X',
    types: [{ id: 'x', label: 'Feed', aspect: '16:9', targetSec: 140, maxSec: 140 }],
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    types: [
      { id: 'linkedin', label: 'Feed', aspect: '16:9', targetSec: 120, maxSec: 600 },
      { id: 'listory', label: 'Story · 15s cards', aspect: '9:16', targetSec: 15, maxSec: 15 },
    ],
  },
];

export const ALL_POST_TYPE_IDS: string[] = REEL_PLATFORMS.flatMap((p) =>
  p.types.map((t) => t.id),
);

export function platformFor(id: string | null | undefined): ReelPlatform | null {
  if (!id) return null;
  return REEL_PLATFORMS.find((p) => p.id === id) ?? null;
}

export function postTypeFor(id: string | null | undefined): ReelPostType | null {
  if (!id) return null;
  for (const p of REEL_PLATFORMS) {
    const t = p.types.find((x) => x.id === id);
    if (t) return t;
  }
  return null;
}

export function platformForPostType(typeId: string | null | undefined): ReelPlatform | null {
  if (!typeId) return null;
  return REEL_PLATFORMS.find((p) => p.types.some((t) => t.id === typeId)) ?? null;
}

export function lengthBudgetFor(typeId: string | null | undefined): { target: number; max: number } {
  const t = postTypeFor(typeId);
  return { target: t?.targetSec ?? 60, max: t?.maxSec ?? 0 };
}

export function aspectFor(typeId: string | null | undefined): '9:16' | '16:9' {
  return postTypeFor(typeId)?.aspect ?? '9:16';
}

export function postTypeLabel(typeId: string | null | undefined): string {
  return postTypeFor(typeId)?.label ?? typeId ?? 'Reel';
}

export function isStoryType(typeId: string | null | undefined): boolean {
  return typeId === 'fbstory' || typeId === 'listory';
}

export function similarPlatforms(typeId: string | null | undefined): ReelPlatform[] {
  const t = postTypeFor(typeId);
  if (!t) return REEL_PLATFORMS;
  if (isStoryType(typeId)) {
    return REEL_PLATFORMS.filter((p) => p.types.some((x) => isStoryType(x.id)));
  }
  if (t.aspect === '9:16') {
    return REEL_PLATFORMS.filter((p) =>
      p.types.some((x) => x.aspect === '9:16' && !isStoryType(x.id)),
    );
  }
  return REEL_PLATFORMS.filter((p) =>
    p.types.some((x) => x.aspect === '16:9' && !isStoryType(x.id)),
  );
}

export function utmForReel(input: {
  platform: string;
  typeId: string;
  pieceId: string;
  funnelSlug?: string | null;
  campaignOverride?: string | null;
}): UtmParams {
  return suggestUtm({
    platform: input.platform,
    format: 'reel',
    pieceId: input.pieceId,
    funnelSlug: input.funnelSlug,
    campaignOverride: input.campaignOverride,
  });
}

export function utmSourceFor(platform: string): string {
  return slugifyUtm(platform) || 'direct';
}

export interface ScheduleSettings {
  platform: string;
  typeId: string;
  durationSec: number;
  aspect: '9:16' | '16:9';
}

export interface ScheduleCheck {
  ok: boolean;
  label: string;
  detail: string;
}

export function validateScheduleSettings(s: ScheduleSettings): ScheduleCheck[] {
  const t = postTypeFor(s.typeId);
  const checks: ScheduleCheck[] = [];

  const targetAspect = t?.aspect ?? '9:16';
  checks.push({
    ok: s.aspect === targetAspect,
    label: 'Aspect ratio',
    detail:
      s.aspect === targetAspect
        ? `${s.aspect} matches ${t?.label ?? s.typeId}`
        : `${s.aspect} reel → ${targetAspect} ${t?.label ?? s.typeId} (will be letterboxed/cropped)`,
  });

  const budget = lengthBudgetFor(s.typeId);
  if (budget.max > 0 && s.durationSec > budget.max) {
    checks.push({
      ok: false,
      label: 'Length',
      detail: `${s.durationSec.toFixed(1)}s exceeds the ${budget.max}s cap for ${t?.label ?? s.typeId}`,
    });
  } else if (budget.target > 0 && s.durationSec > budget.target) {
    checks.push({
      ok: true,
      label: 'Length',
      detail: `${s.durationSec.toFixed(1)}s is over the ${budget.target}s sweet spot for ${t?.label ?? s.typeId}`,
    });
  } else {
    checks.push({
      ok: true,
      label: 'Length',
      detail: `${s.durationSec.toFixed(1)}s is within the ${budget.target}s sweet spot for ${t?.label ?? s.typeId}`,
    });
  }

  if (isStoryType(s.typeId) && s.durationSec > 15) {
    checks.push({
      ok: false,
      label: 'Story format',
      detail: `${s.durationSec.toFixed(1)}s is too long for a 15s story card`,
    });
  }

  return checks;
}

export function allChecksPass(checks: ScheduleCheck[]): boolean {
  return checks.every((c) => c.ok);
}

export function defaultPostType(platformId: string | null | undefined): string {
  return platformFor(platformId)?.types[0]?.id ?? 'reels';
}

export function platformTypeLabel(platformId: string, typeId: string): string {
  const p = platformFor(platformId);
  const t = postTypeFor(typeId);
  if (p && t) return `${p.label} ${t.label}`;
  if (p) return p.label;
  if (t) return t.label;
  return 'Reel';
}
