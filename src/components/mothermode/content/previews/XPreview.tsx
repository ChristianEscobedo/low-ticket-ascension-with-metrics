'use client';

import React from 'react';
import {
  MessageCircle,
  Repeat2,
  Heart,
  BarChart3,
  Bookmark,
  Share,
} from 'lucide-react';
import {
  Avatar,
  DISPLAY_NAME,
  HANDLE,
  PreviewMedia,
  fmt,
  type PreviewProps,
} from './shared';

/** The grey action row under every tweet. */
const Actions: React.FC<{ metrics: PreviewProps['view']['metrics'] }> = ({
  metrics,
}) => (
  <div className="mt-2 flex max-w-sm items-center justify-between text-[#536471]">
    <span className="flex items-center gap-1 text-[12px]">
      <MessageCircle className="h-[18px] w-[18px]" /> {fmt(metrics.comments)}
    </span>
    <span className="flex items-center gap-1 text-[12px]">
      <Repeat2 className="h-[18px] w-[18px]" /> {fmt(metrics.shares)}
    </span>
    <span className="flex items-center gap-1 text-[12px]">
      <Heart className="h-[18px] w-[18px]" /> {fmt(metrics.likes)}
    </span>
    <span className="flex items-center gap-1 text-[12px]">
      <BarChart3 className="h-[18px] w-[18px]" /> {fmt(metrics.views)}
    </span>
    <span className="flex items-center gap-2">
      <Bookmark className="h-[18px] w-[18px]" />
      <Share className="h-[18px] w-[18px]" />
    </span>
  </div>
);

/** The author identity line: name, verified handle, dot, time. */
const Identity: React.FC = () => (
  <span className="flex flex-wrap items-center gap-1 text-[15px]">
    <span className="font-bold text-[#0f1419]">{DISPLAY_NAME}</span>
    <span className="text-[#536471]">@{HANDLE}</span>
    <span className="text-[#536471]">· 2h</span>
  </span>
);

/** A single tweet body: text, optional media, action row. */
const Tweet: React.FC<{
  text: string;
  image?: string;
  alt: string;
  metrics: PreviewProps['view']['metrics'];
  showMedia?: boolean;
  thread?: boolean;
}> = ({ text, image, alt, metrics, showMedia = false, thread = false }) => (
  <div className="flex gap-3 px-4 py-3">
    <div className="flex flex-col items-center">
      <Avatar size="h-10 w-10" />
      {thread && <div className="mt-1 w-px flex-1 bg-black/10" />}
    </div>
    <div className="min-w-0 flex-1">
      <Identity />
      <p className="mt-0.5 whitespace-pre-line text-[15px] leading-snug text-[#0f1419]">
        {text}
      </p>
      {showMedia && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-black/10">
          <PreviewMedia src={image} alt={alt} aspect="aspect-[16/9]" tint="#1A1816" />
        </div>
      )}
      <Actions metrics={metrics} />
    </div>
  </div>
);

export const XPreview: React.FC<PreviewProps> = ({ view }) => {
  const { piece, metrics } = view;
  const isThread =
    piece.format === 'thread' && piece.tweets && piece.tweets.length > 0;
  const posts = isThread ? piece.tweets! : [view.caption ?? view.hook];
  return (
    <div className="mx-auto w-full max-w-md divide-y divide-black/10 overflow-hidden rounded-xl border border-black/10 bg-white">
      {posts.map((t, i) => (
        <Tweet
          key={i}
          text={t}
          image={view.image}
          alt={piece.title}
          metrics={metrics}
          showMedia={i === 0 && (!!view.image || !isThread)}
          thread={isThread && i < posts.length - 1}
        />
      ))}
    </div>
  );
};
