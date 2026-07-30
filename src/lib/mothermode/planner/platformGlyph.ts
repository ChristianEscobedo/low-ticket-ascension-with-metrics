/**
 * Loose platform string -> the canonical channel key the logo set is keyed by.
 *
 * WHY A MAPPER AND NOT A CAST
 * ---------------------------
 * `mothermode_content_plan.platform` is free TEXT: a card can be typed straight
 * onto the board (see AddPlanCard) and GoHighLevel reports its own spellings
 * ('twitter' for X, 'instagram_business', 'google_business'). The logo set in
 * `PlatformIcon` / `PLATFORM_BRAND` is keyed by the `ContentPlatform` union.
 * Casting one to the other compiles and then renders nothing, silently — a card
 * with a perfectly good platform would just have no logo, which reads as "we
 * don't support that channel" rather than "we spelled it differently".
 *
 * So the aliases are enumerated here once, and anything genuinely unknown
 * returns null so the caller can draw a letter chip instead of an empty box.
 *
 * Pure string transforms only, so this is unit tested directly and reused by the
 * planner calendar, the planner card drawer, and the schedule panel.
 */

import type { ContentPlatform } from '@/lib/mothermode/content';

/**
 * Alias -> canonical. Keys are already normalized (lowercase, no separators).
 *
 * Note 'twitter' -> 'x': GHL still reports the old name, and treating them as
 * two channels would split one account's posts across two logos.
 */
const ALIASES: Record<string, ContentPlatform> = {
  facebook: 'facebook',
  fb: 'facebook',
  facebookpage: 'facebook',
  meta: 'facebook',

  instagram: 'instagram',
  ig: 'instagram',
  insta: 'instagram',
  instagrambusiness: 'instagram',

  x: 'x',
  twitter: 'x',
  tweet: 'x',

  tiktok: 'tiktok',
  tt: 'tiktok',

  youtube: 'youtube',
  yt: 'youtube',
  youtubeshorts: 'youtube',
  shorts: 'youtube',

  linkedin: 'linkedin',
  li: 'linkedin',
  linkedinpage: 'linkedin',

  pinterest: 'pinterest',
  pin: 'pinterest',

  email: 'email',
  newsletter: 'email',
  mail: 'email',

  blog: 'blog',
  article: 'blog',
  wordpress: 'blog',

  aeo: 'aeo',
  seo: 'aeo',
};

/** Lowercase and strip everything that isn't a letter or digit. */
function key(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Canonical channel for a loose platform string, or null when unrecognised.
 *
 * Falls back to a prefix scan before giving up, so 'instagram_business_account'
 * and 'facebook page (main)' resolve rather than losing their logo to a suffix
 * nobody anticipated.
 */
export function canonicalPlatform(
  value: string | null | undefined,
): ContentPlatform | null {
  const k = key(value || '');
  if (!k) return null;
  const exact = ALIASES[k];
  if (exact) return exact;
  // Longest alias first: 'instagram' must win over 'ig' for 'instagrambusiness',
  // otherwise a short alias that happens to prefix a longer name would claim it.
  const names = Object.keys(ALIASES).sort((a, b) => b.length - a.length);
  for (const name of names) {
    if (k.startsWith(name)) return ALIASES[name];
  }
  return null;
}

/**
 * Display label for a loose platform string.
 *
 * Never returns '' for a non-empty input: an unknown platform is shown as the
 * admin typed it (title-cased) rather than as "Unknown", because the value they
 * typed is more useful to them than our failure to recognise it.
 */
export function platformLabel(value: string | null | undefined): string {
  const raw = (value || '').trim();
  if (!raw) return '';
  switch (canonicalPlatform(raw)) {
    case 'facebook':
      return 'Facebook';
    case 'instagram':
      return 'Instagram';
    case 'x':
      return 'X';
    case 'tiktok':
      return 'TikTok';
    case 'youtube':
      return 'YouTube';
    case 'linkedin':
      return 'LinkedIn';
    case 'pinterest':
      return 'Pinterest';
    case 'email':
      return 'Email';
    case 'blog':
      return 'Blog';
    case 'aeo':
      return 'AEO';
    default:
      return raw.charAt(0).toUpperCase() + raw.slice(1);
  }
}

/** Single character for the fallback chip when there is no logo. */
export function platformInitial(value: string | null | undefined): string {
  const raw = (value || '').trim();
  return raw ? raw.charAt(0).toUpperCase() : '?';
}
