'use client';

import React from 'react';
import { Search, Sparkles } from 'lucide-react';
import { Avatar, DISPLAY_NAME, PreviewMedia, type PreviewProps } from './shared';

/**
 * Answer-engine surface: a search result card stacked over the citable Q and A
 * pairs, the way an assistant would surface the page. Used for the 'answer'
 * format and AEO platform pieces.
 */
const Answer: React.FC<PreviewProps> = ({ view }) => {
  const { piece } = view;
  const seo = piece.seo;
  return (
    <div className="mx-auto w-full max-w-md space-y-3">
      <div className="rounded-xl border border-black/10 bg-white p-4">
        <p className="text-[12px] text-[#202124]">
          mothermode.com{seo?.slug ? ` › ${seo.slug}` : ''}
        </p>
        <p className="mt-1 text-[18px] leading-snug text-[#1a0dab]">
          {seo?.metaTitle ?? piece.title}
        </p>
        <p className="mt-1 text-[13px] leading-snug text-[#4d5156]">
          {seo?.metaDescription ?? view.hook}
        </p>
      </div>
      {seo?.questions && seo.questions.length > 0 && (
        <div className="rounded-xl border border-black/10 bg-white p-4">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-[#5f6368]">
            <Sparkles className="h-3.5 w-3.5" /> AI overview
          </p>
          <div className="mt-2 space-y-3">
            {seo.questions.map((qa, i) => (
              <div key={i}>
                <p className="text-[14px] font-semibold text-[#202124]">
                  {qa.q}
                </p>
                <p className="mt-0.5 text-[13px] leading-snug text-[#4d5156]">
                  {qa.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Long-form blog surface: a published article header with hero, kicker, title,
 * byline, then the body set in a readable measure.
 */
const Article: React.FC<PreviewProps> = ({ view }) => {
  const { piece } = view;
  return (
    <article className="mx-auto w-full max-w-md overflow-hidden rounded-xl border border-black/10 bg-white">
      <PreviewMedia
        src={view.image}
        alt={piece.title}
        aspect="aspect-[16/9]"
        tint="#532B3C"
      />
      <div className="p-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[#A88B5C]">
          {piece.theme}
        </p>
        <h1 className="mt-2 font-serif text-2xl leading-tight text-[#1A1816]">
          {piece.seo?.metaTitle ?? piece.title}
        </h1>
        <div className="mt-3 flex items-center gap-2">
          <Avatar size="h-7 w-7" />
          <span className="text-[12px] text-[#6b6b6b]">
            {DISPLAY_NAME} · 5 min read
          </span>
        </div>
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
        {piece.seo?.keywords && (
          <p className="mt-4 flex items-center gap-1.5 border-t border-black/5 pt-3 text-[12px] text-[#A88B5C]">
            <Search className="h-3.5 w-3.5" />
            {piece.seo.keywords.join(' · ')}
          </p>
        )}
      </div>
    </article>
  );
};

export const BlogPreview: React.FC<PreviewProps> = (props) => {
  const { piece } = props.view;
  if (piece.platform === 'aeo' || piece.format === 'answer') {
    return <Answer {...props} />;
  }
  return <Article {...props} />;
};
