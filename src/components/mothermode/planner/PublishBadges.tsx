'use client';

/**
 * Shared publish badges: platform logos and publish-state chips.
 *
 * Lives in `components/mothermode/planner` rather than next to either consumer
 * because the Content Hub's Schedule tab and the admin Planner both draw these,
 * and they have to agree pixel-for-pixel. The whole point of the state chip is
 * that "Draft" means the same thing in both places; two implementations of it is
 * how "Scheduled" ends up looking like "Draft" on one screen and quietly
 * teaching the user the wrong thing.
 *
 * All logos are inline SVG paths, not <img> to a CDN or an icon package:
 *  - a calendar month renders dozens of these, so network round-trips per card
 *    would make the grid pop in raggedly;
 *  - `currentColor` lets one glyph sit on a dark card, a light drawer, and a
 *    muted "unscheduled" strip without a per-surface asset;
 *  - brand SVGs in the repo cannot 404 in a client's browser two years from now.
 */

import {
  canonicalPlatform,
  platformInitial,
  platformLabel,
} from '@/lib/mothermode/planner/platformGlyph';
import {
  publishStateLabel,
  publishStateTone,
  normalizePublishState,
} from '@/lib/mothermode/planner/publishState';
import type { PublishAccount } from '@/lib/mothermode/planner/types';

// ---------------------------------------------------------------------------
// Platform logos
// ---------------------------------------------------------------------------

/**
 * Single-path brand marks keyed by the canonical platform slug.
 *
 * Keyed by canonical slug, so 'twitter' and 'x' both land on the X mark — the
 * planner shows what the channel IS, not which spelling the scheduler happened
 * to use in its API response.
 */
const GLYPH_PATHS: Record<string, string> = {
  instagram:
    'M12 2.2c3.2 0 3.6 0 4.9.07 1.2.06 1.8.25 2.2.42.6.23 1 .5 1.5 1 .5.5.77.9 1 1.5.17.4.36 1 .42 2.2.07 1.3.07 1.7.07 4.9s0 3.6-.07 4.9c-.06 1.2-.25 1.8-.42 2.2-.23.6-.5 1-1 1.5-.5.5-.9.77-1.5 1-.4.17-1 .36-2.2.42-1.3.07-1.7.07-4.9.07s-3.6 0-4.9-.07c-1.2-.06-1.8-.25-2.2-.42-.6-.23-1-.5-1.5-1-.5-.5-.77-.9-1-1.5-.17-.4-.36-1-.42-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.9c.06-1.2.25-1.8.42-2.2.23-.6.5-1 1-1.5.5-.5.9-.77 1.5-1 .4-.17 1-.36 2.2-.42C8.4 2.2 8.8 2.2 12 2.2zm0 1.8c-3.1 0-3.5 0-4.7.07-1 .04-1.5.2-1.9.35-.4.16-.7.35-1 .65-.3.3-.5.6-.65 1-.15.4-.3.9-.35 1.9C3.3 9.2 3.3 9.6 3.3 12s0 2.8.07 4c.04 1 .2 1.5.35 1.9.16.4.35.7.65 1 .3.3.6.5 1 .65.4.15.9.3 1.9.35 1.2.07 1.6.07 4.7.07s3.5 0 4.7-.07c1-.04 1.5-.2 1.9-.35.4-.16.7-.35 1-.65.3-.3.5-.6.65-1 .15-.4.3-.9.35-1.9.07-1.2.07-1.6.07-4s0-2.8-.07-4c-.04-1-.2-1.5-.35-1.9a2.7 2.7 0 0 0-.65-1c-.3-.3-.6-.5-1-.65-.4-.15-.9-.3-1.9-.35-1.2-.07-1.6-.07-4.7-.07zm0 3.1a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8zm0 1.8a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2zm6.2-2a1.15 1.15 0 1 1-2.3 0 1.15 1.15 0 0 1 2.3 0z',
  facebook:
    'M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.3c-1.2 0-1.6.75-1.6 1.6V12h2.8l-.45 2.9h-2.35v7A10 10 0 0 0 22 12z',
  x: 'M17.5 3h3.3l-7.2 8.3L22 21h-6.2l-4.4-5.7L6.3 21H3l7.5-8.6L2.6 3H9l4.1 5.4L17.5 3zm-1.1 16h1.8L7.7 4.9H5.8L16.4 19z',
  linkedin:
    'M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3V9zm7 0h3.8v1.7h.05c.53-1 1.8-2.05 3.7-2.05 3.95 0 4.45 2.45 4.45 5.65V21h-4v-5.9c0-1.4-.05-3.2-2-3.3-1.9 0-2.2 1.5-2.2 3.05V21h-3.8V9z',
  youtube:
    'M21.6 7.2c-.23-.86-.9-1.53-1.76-1.76C18.25 5 12 5 12 5s-6.25 0-7.84.44c-.86.23-1.53.9-1.76 1.76C2 8.8 2 12 2 12s0 3.2.4 4.8c.23.86.9 1.53 1.76 1.76C5.75 19 12 19 12 19s6.25 0 7.84-.44c.86-.23 1.53-.9 1.76-1.76.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15.5v-7l6 3.5-6 3.5z',
  tiktok:
    'M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.1v12.4a2.6 2.6 0 1 1-1.83-2.48V9.77a5.7 5.7 0 1 0 4.94 5.64V8.9a7.3 7.3 0 0 0 4.3 1.38V7.18a4.3 4.3 0 0 1-3.25-1.36z',
  pinterest:
    'M12 2a10 10 0 0 0-3.65 19.31c-.05-.8-.01-1.75.19-2.62.22-.94 1.45-6.15 1.45-6.15s-.36-.72-.36-1.78c0-1.67.97-2.92 2.17-2.92 1.02 0 1.52.77 1.52 1.7 0 1.03-.66 2.57-1 4-.28 1.2.6 2.18 1.79 2.18 2.14 0 3.79-2.26 3.79-5.52 0-2.89-2.07-4.9-5.03-4.9-3.42 0-5.43 2.57-5.43 5.22 0 1.03.4 2.14.9 2.75.1.12.11.22.08.34l-.33 1.35c-.05.22-.28.3-.48.2-1.35-.63-2.19-2.6-2.19-4.19 0-3.4 2.47-6.53 7.13-6.53 3.74 0 6.65 2.67 6.65 6.23 0 3.72-2.34 6.72-5.6 6.72-1.1 0-2.13-.57-2.48-1.24l-.68 2.58c-.24.94-.9 2.12-1.34 2.84A10 10 0 1 0 12 2z',
  threads:
    'M16.2 11.3c-.1-.05-.2-.1-.3-.14-.18-3.3-1.98-5.2-5-5.22h-.04c-1.8 0-3.3.77-4.22 2.17l1.66 1.14c.69-1.05 1.77-1.27 2.56-1.27h.03c.98 0 1.72.28 2.2.85.35.4.58.97.7 1.68a12.3 12.3 0 0 0-2.85-.14c-2.86.17-4.7 1.84-4.58 4.17.06 1.18.65 2.2 1.66 2.86.85.56 1.95.83 3.1.77 1.51-.08 2.7-.66 3.5-1.72.62-.8.99-1.85 1.16-3.16.68.41 1.18.95 1.46 1.6.47 1.1.5 2.92-.98 4.4-1.3 1.3-2.86 1.86-5.2 1.88-2.6-.02-4.57-.85-5.85-2.47C4.6 17.25 4 15.1 4 12s.6-5.25 1.79-6.75C7.07 3.63 9.04 2.8 11.64 2.78c2.62.02 4.6.85 5.9 2.48.63.8 1.11 1.8 1.43 2.98l1.94-.52c-.39-1.44-1-2.69-1.83-3.73C17.42 1.9 14.9.8 11.65.78h-.01C8.4.8 5.91 1.9 4.25 4c-1.48 1.87-2.24 4.47-2.26 7.99v.02c.02 3.52.78 6.12 2.26 7.99C5.9 22.1 8.4 23.2 11.64 23.22h.01c2.88-.02 4.9-.77 6.57-2.44 2.18-2.18 2.11-4.9 1.4-6.58-.52-1.2-1.5-2.18-2.83-2.9zm-4.83 5.05c-1.27.07-2.6-.5-2.66-1.7-.05-.89.63-1.88 2.74-2 .24-.02.48-.02.71-.02.77 0 1.49.08 2.14.22-.24 3.03-1.66 3.44-2.93 3.5z',
  email:
    'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1.4 2L12 12.3 19.6 7H4.4zM4 8.9V17h16V8.9l-8 5.6-8-5.6z',
  blog: 'M4 3h11l5 5v13H4V3zm2 2v14h12V9h-4V5H6zm2 6h8v2H8v-2zm0 4h8v2H8v-2z',
};

export interface PlatformGlyphProps {
  platform: string | null | undefined;
  /** Pixel box. 14 for card chips, 18 for the drawer header. */
  size?: number;
  className?: string;
  /** Set false inside a chip that already labels the platform in text. */
  withTitle?: boolean;
}

/**
 * One platform logo, or a lettered fallback.
 *
 * The fallback is a letter in a circle rather than a generic "globe" or nothing
 * at all: an unknown platform still needs to be visually distinct from its
 * neighbours on a card, and a shared placeholder icon would make three different
 * unknown channels look like the same channel.
 */
export function PlatformGlyph({
  platform,
  size = 14,
  className = '',
  withTitle = true,
}: PlatformGlyphProps) {
  const key = canonicalPlatform(platform);
  const label = platformLabel(platform);
  // `canonicalPlatform` returns null for a channel it doesn't recognise, which
  // is exactly the lettered-fallback case below.
  const path = key ? GLYPH_PATHS[key] : undefined;

  if (!path) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full border border-current/40 font-semibold leading-none ${className}`}
        style={{ width: size, height: size, fontSize: Math.max(8, size * 0.6) }}
        title={withTitle ? label : undefined}
        aria-hidden={withTitle ? undefined : true}
      >
        {platformInitial(platform)}
      </span>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={`shrink-0 ${className}`}
      role={withTitle ? 'img' : 'presentation'}
      aria-hidden={withTitle ? undefined : true}
    >
      {withTitle ? <title>{label}</title> : null}
      <path d={path} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Account rail
// ---------------------------------------------------------------------------

export interface PlatformRailProps {
  /** Snapshotted accounts; falls back to the card's own platform when empty. */
  accounts?: PublishAccount[];
  fallbackPlatform?: string | null;
  size?: number;
  /** Cap before "+N", so a 9-account post can't bury the card's title. */
  max?: number;
  className?: string;
}

/**
 * The row of logos on a planner card.
 *
 * Falls back to the card's own `platform` when there are no snapshotted accounts
 * — a piece planned here but never pushed to a scheduler still has a channel,
 * and showing nothing would make a planned Instagram reel indistinguishable from
 * a card with no channel at all.
 */
export function PlatformRail({
  accounts,
  fallbackPlatform,
  size = 14,
  max = 4,
  className = '',
}: PlatformRailProps) {
  const list = accounts?.length
    ? accounts
    : fallbackPlatform
      ? [{ id: '', platform: fallbackPlatform, name: '' }]
      : [];
  if (!list.length) return null;

  const shown = list.slice(0, max);
  const extra = list.length - shown.length;

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {shown.map((account, i) => (
        <PlatformGlyph
          key={account.id || `${account.platform}-${i}`}
          platform={account.platform}
          size={size}
          // Account name wins the tooltip when we have one: on a card with two
          // Instagram accounts, "Instagram" twice tells you nothing.
          className={account.name ? '' : undefined}
        />
      ))}
      {extra > 0 ? (
        <span className="text-[10px] font-semibold opacity-70">+{extra}</span>
      ) : null}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Publish state chip
// ---------------------------------------------------------------------------

export interface PublishChipProps {
  state: unknown;
  /** Appends the schedule time, for calendar cards where date is context. */
  detail?: string;
  className?: string;
}

/**
 * The Draft / Scheduled / Published / Planned chip.
 *
 * Colour comes from `publishStateTone` in the lib layer, not from here, so the
 * chip, the drawer's status picker, and the Schedule tab's confirmation all pull
 * the same palette from one place.
 */
export function PublishChip({ state, detail, className = '' }: PublishChipProps) {
  const normalized = normalizePublishState(state);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${publishStateTone(normalized)} ${className}`}
    >
      {/* A dot as well as colour + text: the four states have to be tellable
          apart by someone who can't distinguish the amber from the emerald. */}
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {publishStateLabel(normalized)}
      {detail ? (
        <span className="font-normal normal-case opacity-80">· {detail}</span>
      ) : null}
    </span>
  );
}
