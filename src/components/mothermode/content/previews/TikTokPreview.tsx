'use client';

import React from 'react';
import { Heart, MessageCircle, Bookmark, Share2, Music2, Plus } from 'lucide-react';
import { Avatar, HANDLE, PreviewMedia, fmt, type PreviewProps } from './shared';

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
 * Full-bleed vertical TikTok surface: video fills the frame, caption and audio
 * sit bottom-left, the engagement rail runs down the right with the spinning
 * record at its base.
 */
export const TikTokPreview: React.FC<PreviewProps> = ({ view }) => {
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
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

      <p className="absolute left-1/2 top-3 -translate-x-1/2 text-sm font-semibold">
        Following <span className="text-white/50">|</span>{' '}
        <span className="border-b-2 border-white pb-0.5">For You</span>
      </p>

      <div className="absolute bottom-4 left-3 right-16">
        <p className="text-[15px] font-semibold">@{HANDLE}</p>
        <p className="mt-1 text-[13px] leading-snug text-white/95 line-clamp-3">
          {caption}
        </p>
        {piece.hashtags && piece.hashtags.length > 0 && (
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
