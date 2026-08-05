'use client';

import React from 'react';
import { Heart, MessageCircle, Bookmark, Share2, Music2, Plus, Images, BadgeCheck } from 'lucide-react';
import { Avatar, CarouselDots, HANDLE, PreviewMedia, fmt, type PreviewProps } from './shared';
import {
  textPostBackground,
  textPostFontScale,
  textPostStyleFor,
  textPostTextColor,
  tweetCardFor,
  tweetThemeColors,
} from '@/lib/mothermode/content';

/** One control on the right-hand action rail. */
const Rail: React.FC<{ icon: React.ReactNode; label: string }> = ({
  icon,
  label,
}) => (
  <div className="flex flex-col items-center gap-1">
    <span className="flex h-9 w-9 items-center justify-center text-white drop-shadow">
      {icon}
    </span>
    <span className="text-[11px] font-semibold text-white drop-shadow">
      {label}
    </span>
  </div>
);

/**
 * TikTok photo-mode surface: a swipeable multi-image post. The active slide
 * fills the frame with its per-slide text, a photo-mode chip and swipe dots
 * mark it as a photo post, and the caption + engagement rail match the video
 * surface.
 */
const PhotoMode: React.FC<PreviewProps> = ({ view }) => {
  const { piece, metrics } = view;
  const caption = view.caption ?? view.hook;
  const frames = Math.max(1, view.images.length, view.slides.length);
  const activeSlide = view.slides[view.imageIndex];
  return (
    <div className="relative mx-auto aspect-[9/16] w-[280px] max-w-full overflow-hidden rounded-xl bg-black text-white">
      <PreviewMedia
        src={view.image}
        alt={piece.title}
        aspect="aspect-[9/16]"
        tint="#1A1816"
        className="absolute inset-0"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />

      <p className="absolute left-1/2 top-3 -translate-x-1/2 text-sm font-semibold">
        Following <span className="text-white/50">|</span>{' '}
        <span className="border-b-2 border-white pb-0.5">For You</span>
      </p>

      {/* Photo-mode chip + swipe counter */}
      <div className="absolute right-2 top-9 flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[10px] font-semibold">
        <Images className="h-3 w-3" />
        {view.imageIndex + 1}/{frames}
      </div>

      {/* Per-slide text (the TikTok text-editing layer). */}
      {view.showHookText !== false && activeSlide?.text && (
        <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 text-center">
          <p className="text-xl font-bold leading-tight drop-shadow">
            {activeSlide.text}
          </p>
          {activeSlide.sub && (
            <p className="mt-2 text-sm leading-snug text-white/90 drop-shadow">
              {activeSlide.sub}
            </p>
          )}
        </div>
      )}

      <div className="absolute bottom-4 left-3 right-16">
        <p className="text-[15px] font-semibold">@{HANDLE}</p>
        {view.showHookText !== false && (
          <p className="mt-1 text-[13px] leading-snug text-white/95 line-clamp-2">
            {caption}
          </p>
        )}
        <p className="mt-2 flex items-center gap-1.5 text-[12px]">
          <Music2 className="h-3.5 w-3.5" /> original sound - {HANDLE}
        </p>
      </div>

      <div className="absolute bottom-4 right-2 flex flex-col items-center gap-4">
        <div className="relative mb-1">
          <Avatar size="h-11 w-11" className="ring-2 ring-white" />
          <span className="absolute -bottom-2 left-1/2 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full bg-[#FE2C55] text-white">
            <Plus className="h-3 w-3" />
          </span>
        </div>
        <Rail
          icon={<Heart className="h-8 w-8" fill="currentColor" />}
          label={fmt(metrics.likes)}
        />
        <Rail
          icon={<MessageCircle className="h-8 w-8" fill="currentColor" />}
          label={fmt(metrics.comments)}
        />
        <Rail
          icon={<Bookmark className="h-8 w-8" fill="currentColor" />}
          label={fmt(metrics.saves)}
        />
        <Rail
          icon={<Share2 className="h-8 w-8" fill="currentColor" />}
          label={fmt(metrics.shares)}
        />
      </div>

      <CarouselDots count={frames} active={view.imageIndex} />
    </div>
  );
};

/**
 * Full-bleed vertical TikTok surface: video fills the frame, caption and audio
 * sit bottom-left, the engagement rail runs down the right with the spinning
 * record at its base.
 */
/**
 * Text overlay surface: the viral big-text post on a plain brand background,
 * framed as a vertical TikTok with the caption + handle chrome at the bottom.
 */
const TextPost: React.FC<PreviewProps> = ({ view }) => {
  const { piece } = view;
  const style = textPostStyleFor(piece);
  const scale = textPostFontScale(view.hook, style);
  return (
    <div
      className="relative mx-auto aspect-[9/16] w-[280px] max-w-full overflow-hidden rounded-xl text-white"
      style={{ background: textPostBackground(style) }}
    >
      <p className="absolute left-1/2 top-3 -translate-x-1/2 text-sm font-semibold">
        Following <span className="text-white/50">|</span>{' '}
        <span className="border-b-2 border-white pb-0.5">For You</span>
      </p>
      <div className="absolute inset-x-5 top-1/2 -translate-y-1/2 text-center">
        <p
          className="font-extrabold leading-tight"
          style={{ color: textPostTextColor(style), fontSize: `${1.5 * scale}rem` }}
        >
          {view.hook}
        </p>
      </div>
      <div className="absolute bottom-4 left-3 right-16">
        <p className="text-[15px] font-semibold" style={{ color: textPostTextColor(style) }}>
          @{HANDLE}
        </p>
        <p className="mt-1 text-[13px] leading-snug text-white/95 line-clamp-2">
          {view.caption ?? view.hook}
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-[12px]">
          <Music2 className="h-3.5 w-3.5" /> original sound - {HANDLE}
        </p>
      </div>
      <div className="absolute bottom-4 right-2 flex flex-col items-center gap-4">
        <Avatar size="h-11 w-11" className="ring-2 ring-white" />
      </div>
    </div>
  );
};

/**
 * Twitter screen-grab surface: the tweet chrome card centered on a dark
 * vertical frame, the way screen-grabs land on TikTok.
 */
const TweetGrab: React.FC<PreviewProps> = ({ view }) => {
  const { piece } = view;
  const chrome = tweetCardFor(piece);
  const colors = tweetThemeColors(chrome.theme);
  return (
    <div
      className="relative mx-auto aspect-[9/16] w-[280px] max-w-full overflow-hidden rounded-xl"
      style={{ background: colors.backdrop }}
    >
      <p className="absolute left-1/2 top-3 -translate-x-1/2 text-sm font-semibold text-white">
        Following <span className="text-white/50">|</span>{' '}
        <span className="border-b-2 border-white pb-0.5">For You</span>
      </p>
      <div className="absolute inset-x-4 top-1/2 -translate-y-1/2">
        <div
          className="rounded-xl border p-3.5"
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
      <div className="absolute bottom-4 left-3 right-16">
        <p className="text-[15px] font-semibold text-white">@{HANDLE}</p>
        <p className="mt-1 text-[13px] leading-snug text-white/95 line-clamp-2">
          {view.caption ?? view.hook}
        </p>
      </div>
    </div>
  );
};

export const TikTokPreview: React.FC<PreviewProps> = ({ view }) => {
  const { piece, metrics } = view;
  if (piece.format === 'textpost') return <TextPost view={view} />;
  if (piece.format === 'tweet') return <TweetGrab view={view} />;
  const caption = view.caption ?? view.hook;
  if (piece.format === 'slideshow') return <PhotoMode view={view} />;
  return (
    <div className="relative mx-auto aspect-[9/16] w-[280px] max-w-full overflow-hidden rounded-xl bg-black text-white">

      <PreviewMedia
        src={view.image}
        alt={piece.title}
        aspect="aspect-[9/16]"
        tint="#1A1816"
        className="absolute inset-0"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

      <p className="absolute left-1/2 top-3 -translate-x-1/2 text-sm font-semibold">
        Following <span className="text-white/50">|</span>{' '}
        <span className="border-b-2 border-white pb-0.5">For You</span>
      </p>

      <div className="absolute bottom-4 left-3 right-16">
        <p className="text-[15px] font-semibold">@{HANDLE}</p>
        {view.showHookText !== false && (
          <p className="mt-1 text-[13px] leading-snug text-white/95 line-clamp-3">
            {caption}
          </p>
        )}
        {view.showHookText !== false &&
          piece.hashtags &&
          piece.hashtags.length > 0 && (
            <p className="mt-1 text-[13px] font-semibold">
              {piece.hashtags.map((h) => `#${h}`).join(' ')}
            </p>
          )}

        <p className="mt-2 flex items-center gap-1.5 text-[12px]">
          <Music2 className="h-3.5 w-3.5" /> original sound - {HANDLE}
        </p>
      </div>

      <div className="absolute bottom-4 right-2 flex flex-col items-center gap-4">
        <div className="relative mb-1">
          <Avatar size="h-11 w-11" className="ring-2 ring-white" />
          <span className="absolute -bottom-2 left-1/2 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full bg-[#FE2C55] text-white">
            <Plus className="h-3 w-3" />
          </span>
        </div>
        <Rail
          icon={<Heart className="h-8 w-8" fill="currentColor" />}
          label={fmt(metrics.likes)}
        />
        <Rail
          icon={<MessageCircle className="h-8 w-8" fill="currentColor" />}
          label={fmt(metrics.comments)}
        />
        <Rail
          icon={<Bookmark className="h-8 w-8" fill="currentColor" />}
          label={fmt(metrics.saves)}
        />
        <Rail
          icon={<Share2 className="h-8 w-8" fill="currentColor" />}
          label={fmt(metrics.shares)}
        />
        <span className="mt-1 flex h-10 w-10 animate-spin items-center justify-center rounded-full bg-gradient-to-br from-[#333] to-black [animation-duration:3s]">
          <Music2 className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
};
