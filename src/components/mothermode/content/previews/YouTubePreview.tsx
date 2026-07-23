'use client';

/**
 * Platform-accurate YouTube previews. YouTube carries two very different native
 * surfaces under one platform, split by format:
 *
 *  - `reel`  -> Shorts: a full-bleed 9:16 vertical player with the right-hand
 *              like/dislike/comment/share rail and the "Shorts" wordmark, close
 *              to the TikTok surface but with YouTube chrome.
 *  - default -> long-form: a 16:9 landscape player (red scrubber) sitting above
 *              the title, the channel row with avatar + subscribe, and the
 *              view/like/description meta the way a watch page reads.
 *
 * Copy comes from the computed view (catalog text with local edits applied);
 * counts come from the captured metrics.
 */
import React from 'react';
import {
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  Forward,
  MoreVertical,
  Music2,
  Play,
} from 'lucide-react';
import {
  Avatar,
  DISPLAY_NAME,
  HANDLE,
  PreviewMedia,
  fmt,
  type PreviewProps,
} from './shared';

/** The red "YouTube" wordmark used in the Shorts header. */
const Wordmark: React.FC = () => (
  <span className="flex items-center gap-1 text-[15px] font-semibold tracking-tight">
    <span className="flex h-4 w-6 items-center justify-center rounded-[4px] bg-[#FF0000]">
      <Play className="h-2.5 w-2.5 text-white" fill="currentColor" />
    </span>
    Shorts
  </span>
);

/** One pill on the Shorts right-hand action rail. */
const Rail: React.FC<{ icon: React.ReactNode; label: string }> = ({
  icon,
  label,
}) => (
  <div className="flex flex-col items-center gap-1">
    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white drop-shadow">
      {icon}
    </span>
    <span className="text-[11px] font-semibold text-white drop-shadow">
      {label}
    </span>
  </div>
);

/** Full-bleed vertical Shorts surface. */
const Short: React.FC<PreviewProps> = ({ view }) => {
  const { piece, metrics } = view;
  const caption = view.caption ?? view.hook;
  return (
    <div className="relative mx-auto aspect-[9/16] w-[280px] max-w-full overflow-hidden rounded-xl bg-black text-white">
      <PreviewMedia
        src={view.image}
        alt={piece.title}
        aspect="aspect-[9/16]"
        tint="#1A1816"
        className="absolute inset-0"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/25" />

      <div className="absolute inset-x-3 top-3 flex items-center justify-between">
        <Wordmark />
        <MoreVertical className="h-5 w-5 text-white/90" />
      </div>

      <div className="absolute bottom-4 left-3 right-16">
        <div className="flex items-center gap-2">
          <Avatar size="h-8 w-8" className="ring-1 ring-white/70" />
          <span className="text-[13px] font-semibold">@{HANDLE}</span>
          <span className="rounded-md border border-white/70 px-2 py-0.5 text-[11px] font-semibold">
            Subscribe
          </span>
        </div>
        {view.showHookText !== false && (
          <p className="mt-2 text-[13px] leading-snug text-white/95 line-clamp-3">
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
        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-white/90">
          <Music2 className="h-3.5 w-3.5" /> original sound - {HANDLE}
        </p>
      </div>

      <div className="absolute bottom-4 right-2 flex flex-col items-center gap-4">
        <Rail
          icon={<ThumbsUp className="h-5 w-5" fill="currentColor" />}
          label={fmt(metrics.likes)}
        />
        <Rail icon={<ThumbsDown className="h-5 w-5" />} label="Dislike" />
        <Rail
          icon={<MessageCircle className="h-5 w-5" fill="currentColor" />}
          label={fmt(metrics.comments)}
        />
        <Rail
          icon={<Forward className="h-5 w-5" />}
          label={fmt(metrics.shares)}
        />
        <span className="mt-1 flex h-8 w-8 animate-spin items-center justify-center rounded-md bg-gradient-to-br from-[#333] to-black [animation-duration:3s]">
          <Music2 className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
};

/**
 * Long-form watch surface: a 16:9 player with the red scrubber, then the title,
 * the channel + subscribe row, the like/share action chips, and a collapsed
 * description snippet, matching a YouTube watch page. There is no dedicated
 * subscriber metric captured, so the channel line reuses reach as a stand-in.
 */
const Watch: React.FC<PreviewProps> = ({ view }) => {
  const { piece, metrics } = view;
  const title = view.hook || piece.title;
  const description =
    view.caption ??
    (view.body.length > 0 ? view.body.join('\n\n') : undefined);
  return (
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
      {/* Player */}
      <div className="relative">
        <PreviewMedia
          src={view.image}
          alt={piece.title}
          aspect="aspect-video"
          tint="#FF0000"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55">
            <Play className="h-6 w-6 text-white" fill="currentColor" />
          </span>
        </div>
        {/* Scrubber */}
        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/40">
          <div className="h-full w-1/3 bg-[#FF0000]" />
        </div>
      </div>

      {/* Title + meta */}
      <div className="px-3 pt-2.5">
        <p className="text-[15px] font-semibold leading-snug text-[#0f0f0f]">
          {title}
        </p>
        <p className="mt-0.5 text-[12px] text-[#606060]">
          {fmt(metrics.views)} views · {fmt(metrics.impressions)} impressions
        </p>
      </div>

      {/* Channel row */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <Avatar size="h-9 w-9" />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[13px] font-semibold text-[#0f0f0f]">
            {DISPLAY_NAME}
          </p>
          <p className="text-[11px] text-[#606060]">
            {fmt(metrics.reach)} subscribers
          </p>
        </div>
        <span className="ml-auto shrink-0 rounded-full bg-[#0f0f0f] px-3 py-1.5 text-[12px] font-semibold text-white">
          Subscribe
        </span>
      </div>

      {/* Action chips */}
      <div className="flex items-center gap-2 px-3 pb-2.5 text-[12px] font-semibold text-[#0f0f0f]">
        <span className="flex items-center gap-1.5 rounded-full bg-[#f2f2f2] px-3 py-1.5">
          <ThumbsUp className="h-4 w-4" /> {fmt(metrics.likes)}
          <span className="mx-1 h-4 w-px bg-black/15" />
          <ThumbsDown className="h-4 w-4" />
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-[#f2f2f2] px-3 py-1.5">
          <Forward className="h-4 w-4" /> Share
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-[#f2f2f2] px-3 py-1.5">
          <MessageCircle className="h-4 w-4" /> {fmt(metrics.comments)}
        </span>
      </div>

      {/* Description snippet */}
      {description ? (
        <div className="mx-3 mb-3 rounded-lg bg-[#f2f2f2] px-3 py-2">
          <p className="whitespace-pre-line text-[12px] leading-snug text-[#0f0f0f] line-clamp-4">
            {description}
          </p>
          {piece.hashtags && piece.hashtags.length > 0 && (
            <p className="mt-1 text-[12px] font-semibold text-[#065fd4]">
              {piece.hashtags.map((h) => `#${h}`).join(' ')}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
};

export const YouTubePreview: React.FC<PreviewProps> = (props) => {
  // Shorts render vertically; every other YouTube format is a long-form watch.
  if (props.view.piece.format === 'reel') return <Short {...props} />;
  return <Watch {...props} />;
};
