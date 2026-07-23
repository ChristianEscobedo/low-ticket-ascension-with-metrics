'use client';

/**
 * Dispatcher for the platform-accurate previews. Given a catalog piece and its
 * local review state, it builds the computed view (edits applied over catalog
 * text, image and captured metrics merged in) and renders the surface that
 * matches the piece's platform, so each post reads as it will in the wild.
 */
import React from 'react';
import type { ContentPiece } from '@/lib/mothermode/content';
import {
  clampIndex,
  reviewHooks,
  reviewImages,
  type PieceReview,
} from '@/lib/mothermode/content/review';
import type { PreviewView } from './shared';
import { InstagramPreview } from './InstagramPreview';
import { FacebookPreview } from './FacebookPreview';
import { XPreview } from './XPreview';
import { TikTokPreview } from './TikTokPreview';
import { PinterestPreview } from './PinterestPreview';
import { BlogPreview } from './BlogPreview';
import { EmailPreview } from './EmailPreview';
import { YouTubePreview } from './YouTubePreview';
import { LinkedInPreview } from './LinkedInPreview';

/** The piece media source, preferring a video poster for stills. */
function catalogImage(piece: ContentPiece): string | undefined {
  if (!piece.media) return undefined;
  return piece.media.type === 'video' ? piece.media.poster : piece.media.src;
}

/** The still source for a slide/frame, preferring a video poster. */
function slideImage(media: ContentPiece['media']): string | undefined {
  if (!media) return undefined;
  return media.type === 'video' ? media.poster : media.src;
}

/** Catalog image frames: every slide's still for carousels/stories, else the
 *  single piece media. Empty when the piece has no imagery yet. */
function catalogFrames(piece: ContentPiece): string[] {
  const fromSlides = (piece.slides ?? [])
    .map((s) => slideImage(s.media))
    .filter((s): s is string => Boolean(s));
  if (fromSlides.length > 0) return fromSlides;
  const single = catalogImage(piece);
  return single ? [single] : [];
}

/** Catalog hook variants: the explicit list when present, else the single hook. */
function catalogHooks(piece: ContentPiece): string[] {
  return piece.hooks && piece.hooks.length > 0 ? piece.hooks : [piece.hook];
}

/** Split an edited body textarea into paragraphs on blank lines. */
function splitBody(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Merge catalog copy with any local edits and review state into a view. The
 *  reviewer's image gallery and hook variants win over the catalog; the active
 *  index selects which frame and hook the surface renders. */
export function buildView(piece: ContentPiece, review: PieceReview): PreviewView {
  const edits = review.edits ?? {};
  const body =
    edits.body && edits.body.trim() !== ''
      ? splitBody(edits.body)
      : (piece.body ?? []);

  const editedImages = reviewImages(review);
  const images = editedImages.length > 0 ? editedImages : catalogFrames(piece);

  // Per-slide copy for carousels/stories/idea pins. The active frame index runs
  // across the larger of the image gallery and the slide list, so a multi-slide
  // piece still paginates even when it has a single (or no) rendered image yet.
  const slides = (piece.slides ?? []).map((s) => ({
    text: s.text,
    sub: s.sub,
  }));
  const frameCount = Math.max(images.length, slides.length, 1);
  const imageIndex = clampIndex(review.imageIndex, frameCount);
  // Fall back to the last available image when there are more slides than
  // rendered frames, so the media never collapses to the empty placeholder.
  const activeImage =
    images[imageIndex] ?? images[images.length - 1] ?? undefined;


  const editedHooks = reviewHooks(edits);
  const hooks = editedHooks.length > 0 ? editedHooks : catalogHooks(piece);
  const hookIndex = clampIndex(edits.hookIndex, hooks.length);

  return {
    piece,
    images,
    imageIndex,
    image: activeImage,
    slides,
    hooks,

    hookIndex,
    hook: hooks[hookIndex] ?? piece.hook,
    caption: edits.caption?.trim() ? edits.caption : piece.caption,
    body,
    adPrimaryText: edits.adPrimaryText?.trim()
      ? edits.adPrimaryText
      : piece.ad?.primaryText,
    adHeadline: edits.adHeadline?.trim()
      ? edits.adHeadline
      : piece.ad?.headline,
    adDescription: edits.adDescription?.trim()
      ? edits.adDescription
      : piece.ad?.description,
    adButton: piece.ad?.button,
    emailSubject: edits.emailSubject?.trim()
      ? edits.emailSubject
      : piece.email?.subject,
    emailPreheader: edits.emailPreheader?.trim()
      ? edits.emailPreheader
      : piece.email?.preheader,
    metrics: review.metrics ?? {},
  };
}


/** Pick the surface that matches the piece's platform. */
function surfaceFor(piece: ContentPiece, view: PreviewView): React.ReactElement {
  switch (piece.platform) {
    case 'instagram':
      return <InstagramPreview view={view} />;
    case 'facebook':
      return <FacebookPreview view={view} />;
    case 'x':
      return <XPreview view={view} />;
    case 'tiktok':
      return <TikTokPreview view={view} />;
    case 'youtube':
      // Shorts render vertically; long-form reads as a watch page.
      return <YouTubePreview view={view} />;
    case 'linkedin':
      // A professional feed card whose surface changes by format.
      return <LinkedInPreview view={view} />;
    case 'pinterest':

      return <PinterestPreview view={view} />;

    case 'blog':
    case 'aeo':
      return <BlogPreview view={view} />;
    case 'email':
      return <EmailPreview view={view} />;
    default:
      return <FacebookPreview view={view} />;
  }
}

export const PlatformPreview: React.FC<{
  piece: ContentPiece;
  review: PieceReview;
  /** When false, hide the hook/caption painted on top of the image. */
  showHookText?: boolean;
  /** When true, story/reel surfaces animate the progress bar as they advance. */
  autoplay?: boolean;
  /** Per-frame duration (ms) for the autoplay progress sweep. */
  frameDurationMs?: number;
}> = ({
  piece,
  review,
  showHookText = true,
  autoplay = false,
  frameDurationMs = 3500,
}) => {
  const view = {
    ...buildView(piece, review),
    showHookText,
    autoplay,
    frameDurationMs,
  };

  // Force left alignment so post copy reads the way it does natively, immune to
  // any centered ancestor; surfaces that intentionally center (story hooks) set
  // their own alignment on the inner element and still win.
  return <div className="text-left">{surfaceFor(piece, view)}</div>;
};
