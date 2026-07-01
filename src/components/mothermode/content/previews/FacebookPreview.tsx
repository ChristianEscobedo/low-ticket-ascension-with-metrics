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
  const caption = view.caption ?? view.hook;
  return (
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
      <Head />
      <p className="whitespace-pre-line px-3 py-2.5 text-[14px] leading-snug text-[#050505]">
        {caption}
      </p>
      {view.body.length > 0 && (
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
      {piece.ad && (
        <div className="flex items-center justify-between bg-[#f0f2f5] px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-[11px] uppercase text-[#65676b]">
              mothermode.com
            </p>
            <p className="truncate text-[14px] font-semibold text-[#050505]">
              {piece.ad.headline}
            </p>
          </div>
          <span className="ml-3 shrink-0 rounded-md bg-[#e4e6eb] px-3 py-1.5 text-[13px] font-semibold text-[#050505]">
            {piece.ad.button}
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
  <div className="relative mx-auto aspect-[9/16] w-full max-w-[280px] overflow-hidden rounded-xl bg-black text-white">
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
    <div className="absolute bottom-3 left-3 right-3">
      <p className="text-sm leading-snug text-white/95 line-clamp-4">
        {view.caption ?? view.hook}
      </p>
    </div>
  </div>
);

/**
 * Facebook story surface: the segmented progress bar, the author row with a
 * blue ring and a close control, a centered hook, and the native reply bar with
 * reaction and share affordances along the bottom.
 */
const Story: React.FC<PreviewProps> = ({ view }) => (
  <div className="relative mx-auto aspect-[9/16] w-full max-w-[280px] overflow-hidden rounded-xl bg-black text-white">
    <PreviewMedia
      src={view.image}
      alt={view.piece.title}
      aspect="aspect-[9/16]"
      tint="#1877F2"
      className="absolute inset-0"
    />
    <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/55" />
    <StoryProgress
      count={Math.max(1, view.images.length)}
      active={view.imageIndex}
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
    <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center">
      <p className="text-lg font-semibold leading-snug drop-shadow">
        {view.hook}
      </p>
    </div>
    <div className="absolute inset-x-3 bottom-3 flex items-center gap-2">
      <span className="flex flex-1 items-center gap-2 rounded-full border border-white/55 px-3 py-2 text-[12px] text-white/85">
        <Camera className="h-4 w-4" /> Send message
      </span>
      <Heart className="h-6 w-6" />
      <Send className="h-6 w-6" />
    </div>
  </div>
);

export const FacebookPreview: React.FC<PreviewProps> = (props) => {
  const f = props.view.piece.format;
  if (f === 'story') return <Story {...props} />;
  if (f === 'reel') return <Vertical {...props} />;
  return <Feed {...props} />;
};
