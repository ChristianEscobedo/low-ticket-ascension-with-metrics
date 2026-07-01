'use client';

import React from 'react';
import { MoreHorizontal, Share, Heart } from 'lucide-react';
import {
  Avatar,
  DISPLAY_NAME,
  PreviewMedia,
  fmt,
  type PreviewProps,
} from './shared';

/**
 * Pinterest pin surface: a tall rounded image with the save button overlaid,
 * the title and saver identity beneath. Idea pins read the same here, with the
 * hook as the cover title.
 */
export const PinterestPreview: React.FC<PreviewProps> = ({ view }) => {
  const { piece, metrics } = view;
  const title = piece.seo?.metaTitle ?? view.caption ?? view.hook;
  return (
    <div className="mx-auto w-full max-w-[260px]">
      <div className="relative overflow-hidden rounded-2xl">
        <PreviewMedia
          src={view.image}
          alt={piece.title}
          aspect={piece.media?.aspect ?? 'aspect-[2/3]'}
          tint="#E60023"
        />
        <button className="absolute right-2 top-2 rounded-full bg-[#E60023] px-4 py-2 text-[13px] font-semibold text-white">
          Save
        </button>
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#111]">
            <Share className="h-4 w-4" />
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#111]">
            <MoreHorizontal className="h-4 w-4" />
          </span>
        </div>
      </div>
      <p className="mt-2 px-1 text-[14px] font-semibold leading-snug text-[#111]">
        {title}
      </p>
      <div className="mt-2 flex items-center gap-2 px-1">
        <Avatar size="h-6 w-6" />
        <span className="text-[12px] text-[#5f5f5f]">{DISPLAY_NAME}</span>
        <span className="ml-auto flex items-center gap-1 text-[12px] text-[#5f5f5f]">
          <Heart className="h-3.5 w-3.5" /> {fmt(metrics.saves)}
        </span>
      </div>
    </div>
  );
};
