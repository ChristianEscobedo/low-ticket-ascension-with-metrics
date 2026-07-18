'use client';

import React from 'react';
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  Music2,
} from 'lucide-react';
import {
  Avatar,
  CarouselDots,
  HANDLE,
  PreviewMedia,
  StoryProgress,
  fmt,
  type PreviewProps,
} from './shared';

/** Hashtags rendered the Instagram way: muted blue, space joined. */
const Tags: React.FC<{ tags?: string[] }> = ({ tags }) =>
  tags && tags.length > 0 ? (
    <span className="text-[#00376b]">
      {' '}
      {tags.map((t) => `#${t}`).join(' ')}
    </span>
  ) : null;

/** Standard feed / carousel post. */
const Feed: React.FC<PreviewProps> = ({ view }) => {
  const { piece, metrics } = view;
  const caption = view.caption ?? view.hook;
  const isCarousel = piece.format === 'carousel' && view.images.length > 1;
  return (
    <div className="mx-auto w-full max-w-sm overflow-hidden rounded-xl border border-black/10 bg-white text-[13px] text-black">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <Avatar size="h-8 w-8" ring />
        <span className="font-semibold">{HANDLE}</span>
        <MoreHorizontal className="ml-auto h-4 w-4 text-black/70" />
      </div>
      <div className="relative">
        <PreviewMedia
          src={view.image}
          alt={piece.title}
          aspect={piece.media?.aspect ?? 'aspect-square'}
          tint="#E1306C"
        />
        {isCarousel && (
          <CarouselDots count={view.images.length} active={view.imageIndex} />
        )}
      </div>
      <div className="px-3 pb-3 pt-2.5">
        <div className="flex items-center gap-4">
          <Heart className="h-6 w-6" />
          <MessageCircle className="h-6 w-6 -scale-x-100" />
          <Send className="h-6 w-6" />
          <Bookmark className="ml-auto h-6 w-6" />
        </div>
        <p className="mt-2 font-semibold">{fmt(metrics.likes)} likes</p>
        <p className="mt-1 leading-snug">
          <span className="font-semibold">{HANDLE}</span> {caption}
          <Tags tags={piece.hashtags} />
        </p>
        <p className="mt-1.5 text-black/45">
          View all {fmt(metrics.comments)} comments
        </p>
        <p className="mt-1 text-[10px] uppercase tracking-wide text-black/40">
          2 hours ago
        </p>
      </div>
    </div>
  );
};

/** Vertical reel with the right-hand action rail. */
const Reel: React.FC<PreviewProps> = ({ view }) => {
  const { piece, metrics } = view;
  const caption = view.caption ?? view.hook;
  return (
    <div className="relative mx-auto aspect-[9/16] w-[280px] max-w-full overflow-hidden rounded-xl bg-black text-white">
      <PreviewMedia
        src={view.image}
        alt={piece.title}
        aspect="aspect-[9/16]"
        tint="#E1306C"
        className="absolute inset-0"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
      <div className="absolute bottom-3 left-3 right-14">
        <p className="text-sm font-semibold">{HANDLE}</p>
        <p className="mt-1 text-xs leading-snug text-white/90 line-clamp-3">
          {caption}
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-white/85">
          <Music2 className="h-3 w-3" /> Original audio
        </p>
      </div>
      <div className="absolute bottom-4 right-2 flex flex-col items-center gap-4">
        <Rail icon={<Heart className="h-6 w-6" />} label={fmt(metrics.likes)} />
        <Rail
          icon={<MessageCircle className="h-6 w-6" />}
          label={fmt(metrics.comments)}
        />
        <Rail icon={<Send className="h-6 w-6" />} label={fmt(metrics.shares)} />
        <Rail
          icon={<Bookmark className="h-6 w-6" />}
          label={fmt(metrics.saves)}
        />
      </div>
    </div>
  );
};

const Rail: React.FC<{ icon: React.ReactNode; label: string }> = ({
  icon,
  label,
}) => (
  <div className="flex flex-col items-center gap-0.5">
    {icon}
    <span className="text-[10px]">{label}</span>
  </div>
);

/** Full-bleed story frame with a per-frame progress bar and centered hook. */
const Story: React.FC<PreviewProps> = ({ view }) => (
  <div className="relative mx-auto aspect-[9/16] w-[280px] max-w-full overflow-hidden rounded-xl bg-black text-white">

    <PreviewMedia
      src={view.image}
      alt={view.piece.title}
      aspect="aspect-[9/16]"
      tint="#E1306C"
      className="absolute inset-0"
    />
    <StoryProgress
      count={Math.max(1, view.images.length)}
      active={view.imageIndex}
    />
    <div className="absolute left-2 top-4 flex items-center gap-2">
      <Avatar size="h-7 w-7" />
      <span className="text-xs font-semibold">{HANDLE}</span>
      <span className="text-[10px] text-white/70">3h</span>
    </div>
    <div className="absolute inset-x-5 top-1/2 -translate-y-1/2 text-center">
      <p className="text-lg font-semibold leading-snug drop-shadow">
        {view.hook}
      </p>
    </div>
  </div>
);

export const InstagramPreview: React.FC<PreviewProps> = (props) => {
  if (props.view.piece.format === 'reel') return <Reel {...props} />;
  if (props.view.piece.format === 'story') return <Story {...props} />;
  return <Feed {...props} />;
};
