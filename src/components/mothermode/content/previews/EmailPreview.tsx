'use client';

import React from 'react';
import { Star, CornerUpLeft, MoreVertical } from 'lucide-react';
import { Avatar, DISPLAY_NAME, PreviewMedia, type PreviewProps } from './shared';

/**
 * Inbox-accurate email surface: the subject line, sender row with avatar and
 * preheader, then the rendered body in the brand frame. Mirrors how the message
 * lands in a reader's client.
 */
export const EmailPreview: React.FC<PreviewProps> = ({ view }) => {
  const { piece } = view;
  const email = piece.email;
  const from = email?.from ?? `${DISPLAY_NAME} <hello@mothermode.com>`;
  return (
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-xl border border-black/10 bg-white text-[#202124]">
      <div className="px-4 pt-4">
        <h1 className="text-[20px] font-normal leading-snug text-[#202124]">
          {email?.subject ?? piece.title}
        </h1>
      </div>
      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar size="h-9 w-9" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[13px]">
            <span className="font-semibold">{DISPLAY_NAME}</span>{' '}
            <span className="text-[#5f6368]">
              &lt;{from.replace(/^.*</, '').replace(/>$/, '')}&gt;
            </span>
          </p>
          <p className="text-[12px] text-[#5f6368]">to me</p>
        </div>
        <Star className="h-4 w-4 text-[#5f6368]" />
        <CornerUpLeft className="h-4 w-4 text-[#5f6368]" />
        <MoreVertical className="h-4 w-4 text-[#5f6368]" />
      </div>

      <div className="border-t border-black/5 bg-[#F5F1EB] p-5">
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <p className="text-center text-[13px] font-semibold uppercase tracking-[0.2em] text-[#532B3C]">
            {DISPLAY_NAME}
          </p>
          {email?.preheader && (
            <p className="mt-3 text-center text-[13px] italic text-[#6b6b6b]">
              {email.preheader}
            </p>
          )}
          {view.image && (
            <div className="mt-4 overflow-hidden rounded-lg">
              <PreviewMedia
                src={view.image}
                alt={piece.title}
                aspect="aspect-[16/9]"
                tint="#A88B5C"
              />
            </div>
          )}
          <p className="mt-4 text-[15px] font-medium leading-relaxed text-[#1A1816]">
            {view.hook}
          </p>
          {view.body.map((p, i) => (
            <p
              key={i}
              className="mt-3 text-[15px] leading-relaxed text-[#33312e]"
            >
              {p}
            </p>
          ))}
          <div className="mt-5 text-center">
            <span className="inline-block rounded-full bg-[#532B3C] px-6 py-3 text-[14px] font-semibold text-white">
              {piece.cta}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
