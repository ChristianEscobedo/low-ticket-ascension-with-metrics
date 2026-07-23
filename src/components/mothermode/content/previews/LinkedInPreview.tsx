'use client';

/**
 * Platform-accurate LinkedIn previews. LinkedIn reads as one professional feed
 * card (author headline, post copy, reactions bar) whose *surface* changes by
 * format the way FacebookPreview branches Story/Reel/Feed:
 *
 *  - feed     -> single image (1.91:1 feed) or a plain text post.
 *  - carousel -> a multi-page document (PDF-style) with a 4:5 page and a pager.
 *  - article  -> a cover-image article card with the newsletter/article label.
 *  - video    -> a 16:9 player with a play affordance.
 *
 * Copy comes from the computed view (catalog text with local edits applied);
 * reaction counts come from the captured metrics.
 */
import React from 'react';
import {
  ThumbsUp,
  MessageSquare,
  Repeat2,
  Send,
  Globe2,
  MoreHorizontal,
  FileText,
  Play,
  Heart,
  Lightbulb,
} from 'lucide-react';
import {
  Avatar,
  DISPLAY_NAME,
  Hairline,
  PreviewMedia,
  fmt,
  type PreviewProps,
} from './shared';

const BRAND = '#0A66C2';

/** Author row: avatar, name, a short professional headline, time + audience. */
const Head: React.FC = () => (
  <div className="flex items-start gap-2.5 px-3 pt-3">
    <Avatar size="h-11 w-11" />
    <div className="min-w-0 leading-tight">
      <p className="text-[14px] font-semibold text-[#000000e6]">
        {DISPLAY_NAME}
      </p>
      <p className="truncate text-[12px] text-[#00000099]">
        Redesigning motherhood, minus the mental load
      </p>
      <p className="flex items-center gap-1 text-[12px] text-[#00000099]">
        2h <span aria-hidden>·</span> <Globe2 className="h-3 w-3" />
      </p>
    </div>
    <MoreHorizontal className="ml-auto h-5 w-5 shrink-0 text-[#00000099]" />
  </div>
);

/** The reactions summary + comment/repost counts, then the action rail. */
const Engagement: React.FC<PreviewProps> = ({ view }) => {
  const { metrics } = view;
  const reactions = fmt(metrics.likes);
  return (
    <>
      <div className="flex items-center justify-between px-3 py-1.5 text-[12px] text-[#00000099]">
        <span className="flex items-center gap-1">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#378FE9] text-white">
            <ThumbsUp className="h-2.5 w-2.5" fill="currentColor" />
          </span>
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#DF704D] text-white">
            <Heart className="h-2.5 w-2.5" fill="currentColor" />
          </span>
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#F5BB5C] text-white">
            <Lightbulb className="h-2.5 w-2.5" fill="currentColor" />
          </span>
          <span className="ml-1">{reactions}</span>
        </span>
        <span>
          {fmt(metrics.comments)} comments · {fmt(metrics.shares)} reposts
        </span>
      </div>
      <Hairline />
      <div className="flex items-center justify-around py-1 text-[13px] font-semibold text-[#00000099]">
        <span className="flex items-center gap-1.5 px-2 py-1.5">
          <ThumbsUp className="h-4 w-4" /> Like
        </span>
        <span className="flex items-center gap-1.5 px-2 py-1.5">
          <MessageSquare className="h-4 w-4" /> Comment
        </span>
        <span className="flex items-center gap-1.5 px-2 py-1.5">
          <Repeat2 className="h-4 w-4" /> Repost
        </span>
        <span className="flex items-center gap-1.5 px-2 py-1.5">
          <Send className="h-4 w-4" /> Send
        </span>
      </div>
    </>
  );
};

/** The card shell every LinkedIn surface shares. */
const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mx-auto w-full max-w-md overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
    {children}
  </div>
);

/** Post copy above the media, when present. */
const Copy: React.FC<PreviewProps> = ({ view }) => {
  const text = view.caption ?? view.hook;
  return (
    <div className="px-3 py-2.5">
      <p className="whitespace-pre-line text-[14px] leading-snug text-[#000000e6]">
        {text}
      </p>
      {view.piece.hashtags && view.piece.hashtags.length > 0 && (
        <p className="mt-1 text-[14px] font-semibold text-[#0A66C2]">
          {view.piece.hashtags.map((h) => `#${h}`).join(' ')}
        </p>
      )}
    </div>
  );
};

/** Single-image (or text-only) feed post. */
const Feed: React.FC<PreviewProps> = (props) => {
  const { view } = props;
  return (
    <Card>
      <Head />
      <Copy view={view} />
      {view.image !== undefined || view.piece.media ? (
        <PreviewMedia
          src={view.image}
          alt={view.piece.title}
          aspect={view.piece.media?.aspect ?? 'aspect-[1.91/1]'}
          tint={BRAND}
        />
      ) : null}
      <Hairline />
      <Engagement view={view} />
    </Card>
  );
};

/** Multi-page document carousel (PDF-style), with a 4:5 page and a pager. */
const Document: React.FC<PreviewProps> = (props) => {
  const { view } = props;
  const pages = Math.max(1, view.images.length, view.slides.length);
  const active = view.imageIndex;
  const slide = view.slides[active];
  return (
    <Card>
      <Head />
      <Copy view={view} />
      <div className="relative bg-[#f3f2ef]">
        <PreviewMedia
          src={view.image}
          alt={view.piece.title}
          aspect="aspect-[4/5]"
          tint={BRAND}
        />
        {view.showHookText !== false && slide?.text ? (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
            <p className="text-[15px] font-semibold leading-snug text-white">
              {slide.text}
            </p>
            {slide.sub ? (
              <p className="mt-1 text-[12px] leading-snug text-white/85">
                {slide.sub}
              </p>
            ) : null}
          </div>
        ) : null}
        {/* Document meta bar, like LinkedIn's PDF pager. */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-black/45 px-3 py-1.5 text-[11px] font-medium text-white">
          <span className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Document
          </span>
          <span>
            {active + 1} / {pages}
          </span>
        </div>
      </div>
      <Hairline />
      <Engagement view={view} />
    </Card>
  );
};

/** Cover-image article/newsletter card. */
const Article: React.FC<PreviewProps> = (props) => {
  const { view } = props;
  const title = view.hook || view.piece.title;
  return (
    <Card>
      <Head />
      <Copy view={view} />
      <div className="border-y border-black/10">
        <PreviewMedia
          src={view.image}
          alt={view.piece.title}
          aspect="aspect-[1.91/1]"
          tint={BRAND}
        />
        <div className="bg-[#f3f2ef] px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wide text-[#00000099]">
            Article on LinkedIn
          </p>
          <p className="mt-0.5 text-[15px] font-semibold leading-snug text-[#000000e6]">
            {title}
          </p>
        </div>
      </div>
      <Engagement view={view} />
    </Card>
  );
};

/** 16:9 native video player. */
const Video: React.FC<PreviewProps> = (props) => {
  const { view } = props;
  return (
    <Card>
      <Head />
      <Copy view={view} />
      <div className="relative">
        <PreviewMedia
          src={view.image}
          alt={view.piece.title}
          aspect="aspect-video"
          tint={BRAND}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55">
            <Play className="h-6 w-6 text-white" fill="currentColor" />
          </span>
        </div>
      </div>
      <Hairline />
      <Engagement view={view} />
    </Card>
  );
};

export const LinkedInPreview: React.FC<PreviewProps> = (props) => {
  switch (props.view.piece.format) {
    case 'carousel':
      return <Document {...props} />;
    case 'article':
      return <Article {...props} />;
    case 'video':
    case 'reel':
      return <Video {...props} />;
    default:
      return <Feed {...props} />;
  }
};
