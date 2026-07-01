/**
 * Types for the MotherMode content hub: every organic post and paid ad for the
 * funnel, formatted per platform and per native format. Content is value-forward
 * and always routes back to the $7 front-end offer. Voice rules apply throughout:
 * no em dashes, no NO-list words, numerals for time. See design-guide.txt.
 */

/** The channels the hub covers. LinkedIn is intentionally excluded. */
export type ContentPlatform =
  | 'facebook'
  | 'instagram'
  | 'x'
  | 'tiktok'
  | 'email'
  | 'pinterest'
  | 'blog'
  | 'aeo';

/** Organic reach vs paid placement. */
export type ContentKind = 'organic' | 'ad';

/** Every native format across the covered channels. */
export type ContentFormat =
  | 'feed' // single feed post (FB, IG, X)
  | 'carousel' // multi-slide post (IG, FB)
  | 'story' // vertical story frames (FB, IG)
  | 'reel' // short vertical video (FB, IG)
  | 'thread' // multi-post thread (X)
  | 'article' // long-form (X article, FB note)
  | 'video' // TikTok video
  | 'email' // broadcast or sequence email
  | 'pin' // standard Pinterest pin
  | 'idea' // Pinterest idea pin (multi-page)
  | 'blog' // long-form SEO/AEO blog post
  | 'answer'; // answer-engine page (concise, citable Q and A)

/** The five tone registers from the brand guide. */
export type ToneRegister =
  | 'wedge'
  | 'confidante'
  | 'authority'
  | 'movement'
  | 'system';

/** A media slot for a piece or a frame. Renders a real asset or, until one is
 *  dropped in /public/mothermode, an on-brand labelled placeholder. */
export interface ContentMedia {
  /** Image still or a video with a poster. */
  type: 'image' | 'video';
  /** Path under /public, e.g. /mothermode/content/fb-feed-1.jpg. */
  src?: string;
  /** Poster still for a video, shown before play. */
  poster?: string;
  /** Alt text and placeholder label. */
  alt: string;
  /** Full Tailwind aspect class, e.g. 'aspect-[9/16]'. */
  aspect?: string;
  /** Pixel hint for the slot, e.g. '1080 x 1920'. */
  hint?: string;
  /** Detailed GPT Image generation prompt for producing this asset. */
  prompt?: string;
}

/** One frame in a story or one slide in a carousel. */
export interface ContentSlide {
  /** The large on-frame line. */
  text: string;
  /** Optional supporting line within the frame. */
  sub?: string;
  /** Shot or layout direction for the frame. */
  visual?: string;
  /** Optional media slot for this frame. */
  media?: ContentMedia;
}

/** Subject-line fields for an email piece. */
export interface EmailFields {
  /** The subject line. */
  subject: string;
  /** Preview/preheader text shown after the subject in the inbox. */
  preheader?: string;
  /** Optional from-name override, e.g. "Loni at MotherMode". */
  from?: string;
}

/** One scripted beat in a reel or TikTok video. */
export interface ScriptBeat {
  /** Timecode or beat label, e.g. "Hook (0-3s)". */
  at: string;
  /** On-screen text overlay. */
  onScreen?: string;
  /** The spoken line. */
  voiceover?: string;
  /** Shot direction, per the imagery guide. */
  visual?: string;
}

/** One question and its concise answer, for Answer Engine Optimization. */
export interface AeoPair {
  /** The question a parent might ask an assistant or search engine. */
  q: string;
  /** A direct, citable answer, 1-3 sentences. */
  a: string;
}

/** Search and answer-engine metadata, present on blog and pin pieces. */
export interface SeoFields {
  /** URL slug, e.g. 'mental-load-of-motherhood'. */
  slug?: string;
  /** Title tag, ideally under 60 characters. */
  metaTitle: string;
  /** Meta description, ideally 140-160 characters. */
  metaDescription: string;
  /** Target keywords and phrases, primary first. */
  keywords: string[];
  /** Answer-engine question/answer pairs for AI snippets and FAQ schema. */
  questions?: AeoPair[];
}

/** Ad-manager fields, present when kind is 'ad'. */
export interface AdFields {
  /** Primary text above the creative. */
  primaryText: string;
  /** Headline under the creative. */
  headline: string;
  /** Link description (Meta). */
  description?: string;
  /** CTA button label, e.g. "Shop now". */
  button: string;
}

/** One piece of content: an organic post or a paid ad for a single format. */
export interface ContentPiece {
  /** Stable id, e.g. 'fb-feed-1'. */
  id: string;
  platform: ContentPlatform;
  format: ContentFormat;
  kind: ContentKind;
  tone: ToneRegister;
  /**
   * Calendar week (1-12) this piece belongs to. Optional: when absent, the hub
   * derives a stable week from the id so every piece still files under a week.
   */
  week?: number;
  /** The angle, e.g. "The mental load". */
  theme: string;
  /** Internal label shown in the hub list. */
  title: string;
  /** The scroll-stopping opener. The primary, also used as the default. */
  hook: string;
  /** Three openers to A/B in order. First should equal hook when present. */
  hooks?: string[];
  /** The primary media slot for the post (image still or video). */
  media?: ContentMedia;
  /** Subject-line fields, present when platform is 'email'. */
  email?: EmailFields;
  /** Body paragraphs, for feed, article, and email posts. */
  body?: string[];
  /** Carousel slides or story frames. */
  slides?: ContentSlide[];
  /** Thread posts, one string each. */
  tweets?: string[];
  /** Reel or video script beats. */
  script?: ScriptBeat[];
  /** Post caption, for formats where the script is separate. */
  caption?: string;
  /** The line that turns value into the next step toward the offer. */
  cta: string;
  /** Where the CTA points. Defaults to the front-end offer. */
  link?: string;
  /** Hashtags, without the leading #. */
  hashtags?: string[];
  /** Creative direction, per the imagery guide. */
  visual?: string;
  /** Search and answer-engine metadata, for blog and pin pieces. */
  seo?: SeoFields;
  /** Ad-manager fields, present when kind is 'ad'. */
  ad?: AdFields;
  /** True for AI-batch-generated pieces stored in Supabase rather than the
   *  static catalog. Lets the hub badge and filter them. */
  generated?: boolean;
}
