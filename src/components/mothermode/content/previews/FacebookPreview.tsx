'use client';

import React from 'react';
import {
  ThumbsUp,
  MessageCircle,
  Share2,
  Globe,
  MoreHorizontal,
  X as XIcon,
  Camera,
  Send,
  Heart,
} from 'lucide-react';
import {
  Avatar,
  DISPLAY_NAME,
  Hairline,
  PreviewMedia,
  StoryProgress,
  fmt,
  type PreviewProps,
} from './shared';
import {
  colorBlockBackground,
  colorBlockFontScale,
  colorBlockStyleFor,
  colorBlockTextColor,
  textPostBackground,
  textPostFontScale,
  textPostStyleFor,
  textPostTextColor,
  tweetCardFor,
  tweetThemeColors,
} from '@/lib/mothermode/content';
import { BadgeCheck } from 'lucide-react';

/** Header shared by every Facebook surface: name, time, audience glyph. */
const Head: React.FC = () => (
  <div className="flex items-center gap-2.5 px-3 pt-3">
    <Avatar size="h-10 w-10" />
    <div className="leading-tight">
      <p className="text-[13px] font-semibold text-[#050505]">{DISPLAY_NAME}</p>
      <p className="flex items-center gap-1 text-[11px] text-[#65676b]">
        2h <span aria-hidden>·</span> <Globe className="h-2.5 w-2.5" />
      </p>
    </div>
    <MoreHorizontal className="ml-auto h-5 w-5 text-[#65676b]" />
  </div>
);

/** The like / comment / share rail with counts above it. */
const Engagement: React.FC<PreviewProps> = ({ view }) => {
  const { metrics } = view;
  return (
    <>
      <div className="flex items-center justify-between px-3 py-1.5 text-[12px] text-[#65676b]">
        <span className="flex items-center gap-1">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#1877F2] text-white">
            <ThumbsUp className="h-2.5 w-2.5" fill="currentColor" />
          </span>
          {fmt(metrics.likes)}
        </span>
        <span>
          {fmt(metrics.comments)} comments · {fmt(metrics.shares)} shares
        </span>
      </div>
      <Hairline />
      <div className="flex items-center justify-around py-1 text-[13px] font-semibold text-[#65676b]">
        <span className="flex items-center gap-1.5 px-2 py-1.5">
          <ThumbsUp className="h-4 w-4" /> Like
        </span>
        <span className="flex items-center gap-1.5 px-2 py-1.5">
          <MessageCircle className="h-4 w-4" /> Comment
        </span>
        <span className="flex items-center gap-1.5 px-2 py-1.5">
          <Share2 className="h-4 w-4" /> Share
        </span>
      </div>
    </>
  );
};

/** Standard feed post, also used for carousel and article surfaces. */
const Feed: React.FC<PreviewProps> = ({ view }) => {
  const { piece } = view;
  const isAd = piece.kind === 'ad' || !!piece.ad;
  const caption = isAd
    ? (view.adPrimaryText ?? view.caption ?? view.hook)
    : (view.caption ?? view.hook);
  return (
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
      <Head />
      <p className="whitespace-pre-line px-3 py-2.5 text-[14px] leading-snug text-[#050505]">
        {caption}
      </p>
      {!isAd && view.body.length > 0 && (
        <p className="whitespace-pre-line px-3 pb-2.5 text-[14px] leading-snug text-[#050505]">
          {view.body.join('\n\n')}
        </p>
      )}
      <PreviewMedia
        src={view.image}
        alt={piece.title}
        aspect={piece.media?.aspect ?? 'aspect-[1.91/1]'}
        tint="#1877F2"
      />
      {(piece.ad || view.adHeadline) && (
        <div className="flex items-center justify-between bg-[#f0f2f5] px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-[11px] uppercase text-[#65676b]">
              mothermode.com
            </p>
            <p className="truncate text-[14px] font-semibold text-[#050505]">
              {view.adHeadline ?? piece.ad?.headline}
            </p>
            {view.adDescription ? (
              <p className="truncate text-[12px] text-[#65676b]">
                {view.adDescription}
              </p>
            ) : null}
          </div>
          <span className="ml-3 shrink-0 rounded-md bg-[#e4e6eb] px-3 py-1.5 text-[13px] font-semibold text-[#050505]">
            {view.adButton ?? piece.ad?.button ?? 'Learn more'}
          </span>
        </div>
      )}
      <Hairline />
      <Engagement view={view} />
    </div>
  );
};


/** Vertical reel surface, dark with a minimal overlay. */
const Vertical: React.FC<PreviewProps> = ({ view }) => (
  // Fixed width (not w-full): absolute children give no intrinsic size, so a
  // percentage width inside a shrink-wrapped flex parent collapses to 0×0.
  <div className="relative mx-auto aspect-[9/16] w-[280px] max-w-full overflow-hidden rounded-xl bg-black text-white">

    <PreviewMedia
      src={view.image}
      alt={view.piece.title}
      aspect="aspect-[9/16]"
      tint="#1877F2"
      className="absolute inset-0"
    />
    <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
    <div className="absolute left-3 top-3 flex items-center gap-2">
      <Avatar size="h-7 w-7" />
      <span className="text-xs font-semibold">{DISPLAY_NAME}</span>
    </div>
    {view.showHookText !== false && (
      <div className="absolute bottom-3 left-3 right-3">
        <p className="text-sm leading-snug text-white/95 line-clamp-4">
          {view.caption ?? view.hook}
        </p>
      </div>
    )}

  </div>
);

/**
 * Facebook story surface: the segmented progress bar, the author row with a
 * blue ring and a close control, a centered hook, and the native reply bar with
 * reaction and share affordances along the bottom.
 */
const Story: React.FC<PreviewProps> = ({ view }) => {
  const frames = Math.max(1, view.images.length, view.slides.length);
  const activeSlide = view.slides[view.imageIndex];
  const headline = activeSlide?.text ?? view.hook;
  return (
  <div className="relative mx-auto aspect-[9/16] w-[280px] max-w-full overflow-hidden rounded-xl bg-black text-white">

    <PreviewMedia
      src={view.image}
      alt={view.piece.title}
      aspect="aspect-[9/16]"
      tint="#1877F2"
      className="absolute inset-0"
    />
    <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/55" />
    <StoryProgress
      count={frames}
      active={view.imageIndex}
      animate={view.autoplay}
      durationMs={view.frameDurationMs}
    />

    <div className="absolute inset-x-3 top-5 flex items-center gap-2">
      <span
        className="rounded-full p-[1.5px]"
        style={{ background: '#1877F2' }}
      >
        <span className="block rounded-full bg-black p-[1.5px]">
          <Avatar size="h-7 w-7" />
        </span>
      </span>
      <span className="text-[13px] font-semibold drop-shadow">
        {DISPLAY_NAME}
      </span>
      <span className="text-[11px] text-white/75">3h</span>
      <MoreHorizontal className="ml-auto h-5 w-5 text-white/90" />
      <XIcon className="h-5 w-5 text-white/90" />
    </div>
    {view.showHookText !== false && (
      <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center">
        <p className="text-lg font-semibold leading-snug drop-shadow">
          {headline}
        </p>
        {activeSlide?.sub && (
          <p className="mt-2 text-sm leading-snug text-white/90 drop-shadow">
            {activeSlide.sub}
          </p>
        )}
      </div>
    )}


    <div className="absolute inset-x-3 bottom-3 flex items-center gap-2">
      <span className="flex flex-1 items-center gap-2 rounded-full border border-white/55 px-3 py-2 text-[12px] text-white/85">
        <Camera className="h-4 w-4" /> Send message
      </span>
      <Heart className="h-6 w-6" />
      <Send className="h-6 w-6" />
    </div>
  </div>
  );
};

/**
 * Facebook color-block surface: the native big-text-on-color post. The header
 * and engagement rail match the feed card, but the media area is a solid (or
 * gradient) block with the active hook scaled the way FB scales it natively.
 */
const ColorBlock: React.FC<PreviewProps> = ({ view }) => {
  const { piece } = view;
  const style = colorBlockStyleFor(piece);
  const text = view.hook;
  const scale = colorBlockFontScale(text, style);
  const fontRem = 1.55 * scale;
  return (
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
      <Head />
      <div
        className="mx-3 mb-2.5 flex aspect-square w-[calc(100%-1.5rem)] items-center justify-center rounded-md px-6 text-center"
        style={{ background: colorBlockBackground(style) }}
      >
        <p
          className="font-bold leading-tight"
          style={{ color: colorBlockTextColor(style), fontSize: `${fontRem}rem` }}
        >
          {text}
        </p>
      </div>
      <Hairline />
      <Engagement view={view} />
    </div>
  );
};

/**
 * Text overlay surface: the viral big-text post on a plain brand background.
 * The header and engagement rail match the feed card; the media area is the
 * text block at its surface aspect (square for feed, vertical when styled so).
 */
const TextPost: React.FC<PreviewProps> = ({ view }) => {
  const { piece } = view;
  const style = textPostStyleFor(piece);
  const text = view.hook;
  const scale = textPostFontScale(text, style);
  const vertical = (style.aspect ?? '1:1') === '9:16';
  return (
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
      <Head />
      <div
        className={`mx-3 mb-2.5 flex items-center justify-center rounded-md px-6 text-center ${
          vertical ? 'mx-auto aspect-[9/16] w-2/3' : 'aspect-square w-[calc(100%-1.5rem)]'
        }`}
        style={{ background: textPostBackground(style) }}
      >
        <p
          className="font-extrabold leading-tight"
          style={{ color: textPostTextColor(style), fontSize: `${1.55 * scale}rem` }}
        >
          {text}
        </p>
      </div>
      <Hairline />
      <Engagement view={view} />
    </div>
  );
};

/**
 * Twitter screen-grab surface: the tweet chrome card posted to Facebook. The
 * header and engagement rail match the feed card; the media area is the
 * themed tweet card with avatar, name, badge, and text.
 */
const TweetGrab: React.FC<PreviewProps> = ({ view }) => {
  const { piece } = view;
  const chrome = tweetCardFor(piece);
  const colors = tweetThemeColors(chrome.theme);
  return (
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
      <Head />
      <div className="mx-3 mb-2.5 rounded-md p-3" style={{ background: colors.backdrop }}>
        <div
          className="rounded-lg border p-3"
          style={{ background: colors.card, borderColor: colors.border }}
        >
          <div className="flex items-center gap-2">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={{ background: colors.avatarBg, color: colors.avatarText }}
            >
              {chrome.name.trim().charAt(0).toUpperCase() || 'M'}
            </span>
            <div className="min-w-0 leading-tight">
              <p
                className="flex items-center gap-1 truncate text-[13px] font-bold"
                style={{ color: colors.ink }}
              >
                {chrome.name}
                {chrome.verified && (
                  <BadgeCheck className="h-3.5 w-3.5 shrink-0" style={{ color: colors.badge }} />
                )}
              </p>
              <p className="truncate text-[11px]" style={{ color: colors.sub }}>
                {chrome.handle}
              </p>
            </div>
          </div>
          <p
            className="mt-2 whitespace-pre-wrap text-[14px] leading-snug"
            style={{ color: colors.ink }}
          >
            {view.hook}
          </p>
        </div>
      </div>
      <Hairline />
      <Engagement view={view} />
    </div>
  );
};

export const FacebookPreview: React.FC<PreviewProps> = (props) => {

  const f = props.view.piece.format;
  if (f === 'story') return <Story {...props} />;
  if (f === 'reel') return <Vertical {...props} />;
  if (f === 'colorblock') return <ColorBlock {...props} />;
  if (f === 'textpost') return <TextPost {...props} />;
  if (f === 'tweet') return <TweetGrab {...props} />;
  return <Feed {...props} />;
};
