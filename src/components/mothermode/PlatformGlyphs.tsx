'use client';

/**
 * Monochrome UI glyphs for the platform-accurate publish previews.
 *
 * WHY THESE EXIST (AND WHY NOT EMOJI)
 * -----------------------------------
 * The previews used color emoji for the action rails — ❤️ 💬 🔖 👍 🔁 🌍. That
 * reads as "generic mockup" for three reasons, all of which a reviewer notices
 * immediately even if they can't name them:
 *
 *   1. No real platform ships a color emoji in its chrome. TikTok/Reels rails,
 *      the Facebook like bar and the X action row are all *flat monochrome line
 *      icons* that inherit the surrounding text color. A saturated multi-color
 *      glyph sitting in a white action bar is the single biggest tell.
 *   2. Emoji render per-OS. The same 👍 is a different shape, weight and hue on
 *      Windows, macOS, Android and in Chrome's fallback font — so the preview
 *      isn't even stable across the admin's own machines, and never matches the
 *      phone the post actually ships to.
 *   3. Emoji ignore `color`/`currentColor`. A white-on-video TikTok rail and a
 *      grey-on-white Facebook bar need the *same* icon in two different colors;
 *      an emoji can only ever be its own baked-in palette.
 *
 * So these are hand-traced single-path SVGs at a 24x24 viewBox that:
 *   - paint with `currentColor`, so a rail sets color once and every icon follows;
 *   - accept `filled` where the platform has a two-state control (heart, bookmark,
 *     thumb), because "liked" vs "not liked" is a fill change, not a new glyph;
 *   - size in `em`, so an icon tracks the font-size of the count sitting next to
 *     it instead of needing a matching pixel value at every call site.
 *
 * Keep these dumb and presentational. Anything platform-*specific* (which icons
 * appear, in what order, at what size) belongs in the preview component, not here.
 */

import React from 'react';

export interface GlyphProps {
  /** Size in em, tracking the adjacent text. Defaults to 1em. */
  size?: number | string;
  /** Solid variant for "active" states (liked, saved, reacted). */
  filled?: boolean;
  className?: string;
  /** Decorative by default; pass a label when the icon is the only content. */
  label?: string;
}

/** Shared wrapper: currentColor, em sizing, and correct a11y semantics. */
const Svg: React.FC<GlyphProps & { children: React.ReactNode }> = ({
  size = 1,
  className = '',
  label,
  children,
}) => (
  <svg
    viewBox="0 0 24 24"
    width={typeof size === 'number' ? `${size}em` : size}
    height={typeof size === 'number' ? `${size}em` : size}
    className={className}
    // Decorative icons are hidden from screen readers; the visible count next
    // to them already carries the meaning ("24K"). When an icon stands alone
    // it gets a role + title instead of being silently skipped.
    aria-hidden={label ? undefined : true}
    role={label ? 'img' : undefined}
    focusable="false"
    style={{ display: 'inline-block', verticalAlign: '-0.125em', flexShrink: 0 }}
  >
    {label ? <title>{label}</title> : null}
    {children}
  </svg>
);

/** Stroke defaults matching the ~1.75px optical weight the platforms use. */
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** Like / favourite. Filled = liked (platforms turn it red via `color`). */
export const HeartGlyph: React.FC<GlyphProps> = (p) => (
  <Svg {...p}>
    <path
      d="M12 20.3 3.9 12.2a5 5 0 0 1 7.1-7.1l1 1 1-1a5 5 0 0 1 7.1 7.1Z"
      {...stroke}
      fill={p.filled ? 'currentColor' : 'none'}
    />
  </Svg>
);

/** Comment / reply. The tail sits bottom-left like every native bubble. */
export const CommentGlyph: React.FC<GlyphProps> = (p) => (
  <Svg {...p}>
    <path
      d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.8 9.8 0 0 1-3.6-.7L3 21l1.9-4.9A8.2 8.2 0 0 1 3.6 11.5a8.4 8.4 0 0 1 9-8.4 8.4 8.4 0 0 1 8.4 8.4Z"
      {...stroke}
      fill={p.filled ? 'currentColor' : 'none'}
    />
  </Svg>
);

/** Save / bookmark. Filled = saved. */
export const BookmarkGlyph: React.FC<GlyphProps> = (p) => (
  <Svg {...p}>
    <path
      d="M6 3.8h12a1 1 0 0 1 1 1v15.4l-7-4.2-7 4.2V4.8a1 1 0 0 1 1-1Z"
      {...stroke}
      fill={p.filled ? 'currentColor' : 'none'}
    />
  </Svg>
);

/** Share / send — the arrow, not a paper plane, matching IG + TikTok. */
export const ShareGlyph: React.FC<GlyphProps> = (p) => (
  <Svg {...p}>
    <path d="M4 12.6v6.2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6.2" {...stroke} />
    <path d="M12 15.4V3.6M7.6 8l4.4-4.4L16.4 8" {...stroke} />
  </Svg>
);

/** Repost / retweet — the two-arrow loop used by X and LinkedIn. */
export const RepostGlyph: React.FC<GlyphProps> = (p) => (
  <Svg {...p}>
    <path d="M4 9.2V8a3 3 0 0 1 3-3h10M4 9.2 1.9 7M4 9.2l2.1-2.2" {...stroke} />
    <path
      d="M20 14.8V16a3 3 0 0 1-3 3H7M20 14.8l2.1 2.2M20 14.8l-2.1 2.2"
      {...stroke}
    />
  </Svg>
);

/** Thumbs up — Facebook / LinkedIn reactions. Filled = reacted. */
export const ThumbUpGlyph: React.FC<GlyphProps> = (p) => (
  <Svg {...p}>
    <path
      d="M7 10.5 11 3a2.2 2.2 0 0 1 2.2 2.2V9h4.6a2 2 0 0 1 2 2.4l-1.3 6.4a2.4 2.4 0 0 1-2.3 1.9H7Z"
      {...stroke}
      fill={p.filled ? 'currentColor' : 'none'}
    />
    <path d="M7 10.5v9.2H4.6a1.4 1.4 0 0 1-1.4-1.4v-6.4a1.4 1.4 0 0 1 1.4-1.4Z" {...stroke} />
  </Svg>
);

/** Play count — the solid triangle YouTube/TikTok use next to view counts. */
export const PlayGlyph: React.FC<GlyphProps> = (p) => (
  <Svg {...p}>
    <path d="M7.5 4.6 19 12 7.5 19.4Z" fill="currentColor" />
  </Svg>
);

/**
 * Public/globe — the audience chip in the Facebook & LinkedIn post header
 * ("Just now · 🌍"). Native is a tiny grey globe, not a blue-and-green emoji.
 */
export const GlobeGlyph: React.FC<GlyphProps> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.6" {...stroke} />
    <path d="M3.4 12h17.2M12 3.4a13 13 0 0 1 0 17.2 13 13 0 0 1 0-17.2Z" {...stroke} />
  </Svg>
);

/** Overflow menu — the three dots on every post header. */
export const MoreGlyph: React.FC<GlyphProps> = (p) => (
  <Svg {...p}>
    <circle cx="5" cy="12" r="1.6" fill="currentColor" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    <circle cx="19" cy="12" r="1.6" fill="currentColor" />
  </Svg>
);

/** Send / direct message — the paper plane on the LinkedIn action bar. */
export const SendGlyph: React.FC<GlyphProps> = (p) => (
  <Svg {...p}>
    <path d="M21 3 10.5 13.5M21 3l-6.8 18-3.7-7.5L3 9.8Z" {...stroke} />
  </Svg>
);

/**
 * Name -> component, so a preview can drive a rail from data
 * (`[['heart','24K'], ['comment','812']]`) instead of hard-coding JSX per
 * platform. This is what lets the rails stay terse tuples the way they were
 * written with emoji, minus the emoji.
 */
export const GLYPHS = {
  heart: HeartGlyph,
  comment: CommentGlyph,
  bookmark: BookmarkGlyph,
  share: ShareGlyph,
  repost: RepostGlyph,
  thumb: ThumbUpGlyph,
  play: PlayGlyph,
  globe: GlobeGlyph,
  more: MoreGlyph,
  send: SendGlyph,
} as const;

export type GlyphName = keyof typeof GLYPHS;

/**
 * Render a glyph by name. Unknown names render nothing rather than throwing —
 * a preview missing one icon is a cosmetic bug; a preview that crashes the
 * whole Reel Studio page because of a typo in a rail tuple is not.
 */
export const Glyph: React.FC<GlyphProps & { name: GlyphName }> = ({
  name,
  ...rest
}) => {
  const Cmp = GLYPHS[name];
  return Cmp ? <Cmp {...rest} /> : null;
};
