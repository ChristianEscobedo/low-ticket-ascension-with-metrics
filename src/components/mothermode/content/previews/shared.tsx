'use client';

/**
 * Shared building blocks for the platform-accurate post previews. These render
 * a piece roughly as it would appear natively (handle, avatar, media, action
 * row) so a reviewer can see the post the way the audience will. Counts come
 * from the captured metrics; copy comes from the computed view (catalog text
 * with any local edits applied).
 */
import React from 'react';
import type { ContentPiece } from '@/lib/mothermode/content';
import type { PieceMetrics } from '@/lib/mothermode/content/review';

/** The account identity the previews render under. */
export const HANDLE = 'mothermode';
export const DISPLAY_NAME = 'MotherMode';

/** The catalog text with local edits applied, plus captured metrics. */
export interface PreviewView {
  piece: ContentPiece;
  /** The active image (frame or variant), when one is present. */
  image?: string;
  /** Every resolved image: story/carousel frames or A/B variants, in order. */
  images: string[];
  /** Index of the active image within `images`. */
  imageIndex: number;
  /** Primary hook/opener (the active variant). */
  hook: string;
  /** Every resolved hook variant, in order. */
  hooks: string[];
  /** Index of the active hook within `hooks`. */
  hookIndex: number;
  /** Caption line, when the piece carries one. */
  caption?: string;
  /** Body paragraphs (edited value wins). */
  body: string[];
  /** Paid ad fields with edits applied (when kind is ad). */
  adPrimaryText?: string;
  adHeadline?: string;
  adDescription?: string;
  adButton?: string;
  /** Email fields with edits applied. */
  emailSubject?: string;
  emailPreheader?: string;
  metrics: PieceMetrics;
}


export interface PreviewProps {
  view: PreviewView;
}

/** Compact count formatter: 942, 1.2K, 3.4M. Empty values read as 0. */
export function fmt(n?: number): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  if (v < 1000) return String(v);
  if (v < 1_000_000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K`;
  return `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M`;
}

interface AvatarProps {
  /** Tailwind size classes, e.g. 'h-8 w-8'. */
  size?: string;
  /** Instagram-style gradient ring around the avatar. */
  ring?: boolean;
  className?: string;
}

/** Round brand avatar with the MotherMode initial. */
export const Avatar: React.FC<AvatarProps> = ({
  size = 'h-9 w-9',
  ring = false,
  className = '',
}) => {
  const inner = (
    <div
      className={`flex ${size} items-center justify-center rounded-full bg-[#532B3C] font-semibold text-white ${className}`}
      style={{ fontSize: '0.7rem' }}
    >
      M
    </div>
  );
  if (!ring) return inner;
  return (
    <div
      className="rounded-full p-[2px]"
      style={{
        background:
          'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)',
      }}
    >
      <div className="rounded-full bg-white p-[2px]">{inner}</div>
    </div>
  );
};

interface PreviewMediaProps {
  src?: string;
  alt: string;
  /** Full aspect class, e.g. 'aspect-square' or 'aspect-[9/16]'. */
  aspect?: string;
  /** Brand tint for the empty-state placeholder. */
  tint?: string;
  className?: string;
}

/**
 * The post image, or a calm placeholder when no asset has been added yet. The
 * placeholder nudges the reviewer toward the Edit tab rather than looking broken.
 *
 * When used as an absolute fill (className includes `absolute` + `inset-0`),
 * the aspect class is dropped so the media stretches to the parent frame.
 * Pairing aspect-[9/16] with absolute inset-0 collapses or overflows the
 * reel/story surfaces on Facebook, Instagram, and TikTok.
 */
export const PreviewMedia: React.FC<PreviewMediaProps> = ({
  src,
  alt,
  aspect = 'aspect-square',
  tint = '#532B3C',
  className = '',
}) => {
  // Absolute-fill mode: parent owns the frame size; don't re-apply aspect.
  const fills =
    className.includes('absolute') && className.includes('inset-0');
  const frame = fills
    ? `h-full w-full overflow-hidden bg-black ${className}`
    : `${aspect} w-full overflow-hidden bg-black ${className}`;
  const emptyFrame = fills
    ? `flex h-full w-full items-center justify-center ${className}`
    : `${aspect} flex w-full items-center justify-center ${className}`;

  if (src) {
    return (
      <div className={frame}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      </div>
    );
  }
  return (
    <div
      className={emptyFrame}
      style={{
        background: `linear-gradient(135deg, ${tint}14, ${tint}33)`,
      }}
    >
      <span className="px-6 text-center text-xs text-black/40">
        Add an image in the Edit tab to preview the visual
      </span>
    </div>
  );
};


/** A thin, muted divider used inside the white preview cards. */
export const Hairline: React.FC = () => (
  <div className="h-px w-full bg-black/[0.08]" />
);

/**
 * The segmented progress bar at the top of a story, one segment per frame.
 * Segments before the active one read as watched, the active one part-filled,
 * later ones empty, mirroring how stories advance natively.
 */
export const StoryProgress: React.FC<{ count: number; active: number }> = ({
  count,
  active,
}) => (
  <div className="absolute inset-x-3 top-2.5 z-10 flex gap-1">
    {Array.from({ length: Math.max(1, count) }).map((_, i) => (
      <span
        key={i}
        className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/35"
      >
        <span
          className="block h-full rounded-full bg-white"
          style={{ width: i < active ? '100%' : i === active ? '40%' : '0%' }}
        />
      </span>
    ))}
  </div>
);

/** A row of carousel dots, the active slide highlighted. */
export const CarouselDots: React.FC<{ count: number; active: number }> = ({
  count,
  active,
}) => (
  <div className="absolute inset-x-0 bottom-2 z-10 flex items-center justify-center gap-1">
    {Array.from({ length: count }).map((_, i) => (
      <span
        key={i}
        className={`h-1.5 w-1.5 rounded-full ${
          i === active ? 'bg-white' : 'bg-white/55'
        }`}
      />
    ))}
  </div>
);
