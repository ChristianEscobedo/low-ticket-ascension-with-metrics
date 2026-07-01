'use client';

/**
 * Renders a composed version as a platform-accurate post. It synthesizes a
 * PieceReview whose edits swap the piece's hook, caption, and body for the
 * version's parts, then runs that through the very same PlatformPreview pipeline
 * the review surfaces use, so each variation reads exactly as it would in the
 * wild. The card renders at a fixed design width and is scaled to a tile so a
 * wall of variations fits the studio canvas; click-to-enlarge shows it full size.
 */
import React, { useLayoutEffect, useRef, useState } from 'react';
import type { ContentPiece, VersionParts } from '@/lib/mothermode/content';
import { readableParagraphs } from '@/lib/mothermode/content';
import type { PieceReview } from '@/lib/mothermode/content/review';
import { PlatformPreview } from './previews/PlatformPreview';

/** The natural width the preview cards are designed against (max-w-sm). */
const DESIGN_WIDTH = 384;

/** Build the review override that paints a version onto the piece's surfaces.
 *  The hook drives titles and caption openers; the body carries the paragraphs
 *  (reflowed to at most two sentences a block so it reads easily); the cta is
 *  appended so it shows on surfaces that render the body. */
export function versionReview(v: VersionParts): PieceReview {
  const paras = readableParagraphs(v.body);
  const body = (v.cta ? [...paras, v.cta] : paras)
    .map((p) => p.trim())
    .filter(Boolean)
    .join('\n\n');
  return {
    ...(v.image ? { images: [v.image], imageIndex: 0 } : {}),
    edits: {
      hooks: v.hook ? [v.hook] : [],
      caption: v.hook,
      body,
    },
  };
}

/** The piece a version renders against: the source with its cta swapped in, so
 *  surfaces that read piece.cta (email) reflect the version. */
export function versionPiece(piece: ContentPiece, v: VersionParts): ContentPiece {
  return { ...piece, cta: v.cta };
}

/** Renders children at DESIGN_WIDTH, scaled down to `width`, reserving the
 *  correct height so the scaled card never overlaps its neighbours. */
const Scaled: React.FC<{ width: number; children: React.ReactNode }> = ({
  width,
  children,
}) => {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const scale = width / DESIGN_WIDTH;

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const measure = () => setHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div style={{ width, height: height * scale }} className="overflow-hidden">
      <div
        ref={inner}
        style={{
          width: DESIGN_WIDTH,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export const VersionPreview: React.FC<{
  piece: ContentPiece;
  version: VersionParts;
  /** Tile width in px. Omit to render at full design width (the lightbox). */
  width?: number;
  onEnlarge?: () => void;
}> = ({ piece, version, width, onEnlarge }) => {
  const card = (
    <PlatformPreview piece={versionPiece(piece, version)} review={versionReview(version)} />
  );
  if (!width) return card;
  return (
    <button
      type="button"
      onClick={onEnlarge}
      title="Click to enlarge"
      className="block cursor-zoom-in rounded-xl bg-white/60 p-2 ring-1 ring-ink/10 transition-shadow hover:shadow-md"
    >
      <Scaled width={width}>{card}</Scaled>
    </button>
  );
};
