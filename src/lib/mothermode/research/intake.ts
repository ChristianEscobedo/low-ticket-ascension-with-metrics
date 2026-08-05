/**
 * Research session intake: the brief the agent searches WITH.
 *
 * The core insight this module encodes: an offer name is not a research
 * query. A $7 product has no public footprint, so searching its name on
 * Reddit/Amazon/X returns nothing. What has a footprint is the problem
 * space, the category analogs, and named competitors. The intake carries
 * those seeds, and the agent's system prompt is instructed to use them.
 *
 * Pure: no server imports. The normalizer defends the JSONB boundary, the
 * classifiers turn a pasted link into the right seed, and `intakeBriefBlock`
 * renders the prompt block — all unit-testable.
 */

export const SOCIAL_PLATFORMS = [
  'instagram',
  'tiktok',
  'youtube',
  'x',
  'facebook',
  'pinterest',
  'linkedin',
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

/** A competitor voice worth watching, with its real profile link. */
export interface ResearchVoice {
  handle: string;
  platform: SocialPlatform | '';
  url: string;
}

export const RESEARCH_MODES = ['auto', 'external', 'internal'] as const;
export type ResearchMode = (typeof RESEARCH_MODES)[number];

export const RESEARCH_DEPTHS = ['standard', 'deep'] as const;
export type ResearchDepth = (typeof RESEARCH_DEPTHS)[number];

/** The research brief attached to a session. */
export interface ResearchIntake {
  /** Evidence strategy: auto leans internal as metrics thicken. */
  mode: ResearchMode;
  /**
   * Tool lane: standard is the everyday eight tools; deep unlocks the paid
   * performance/comment lane (top_posts, post_comments, voice_deep_dive) and
   * raises the voice_audit caps. Deep spends more per turn, so it is opt-in
   * per session.
   */
  depth: ResearchDepth;
  /** What the user is deciding (free text). */
  goal: string;
  /** Who the research is about. */
  audience: string;
  /** Pain/topic keywords to mine (the problem space). */
  problemKeywords: string[];
  /** Category analogs for Amazon/product research ("mom planner"). */
  categoryKeywords: string[];
  /** Competitor products to mine reviews on (names, links, or ASINs). */
  competitorProducts: string[];
  /** Competitor voices/influencers to watch. */
  competitorVoices: ResearchVoice[];
  /** Subreddits for reddit_deep_dive. */
  subreddits: string[];
  /** Anything else the user dropped (kept as link context). */
  seedLinks: string[];
}

export function blankIntake(): ResearchIntake {
  return {
    mode: 'auto',
    depth: 'standard',
    goal: '',
    audience: '',
    problemKeywords: [],
    categoryKeywords: [],
    competitorProducts: [],
    competitorVoices: [],
    subreddits: [],
    seedLinks: [],
  };
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function strList(v: unknown, cap = 12): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const s = str(item);
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= cap) break;
  }
  return out;
}

function voiceList(v: unknown, cap = 8): ResearchVoice[] {
  if (!Array.isArray(v)) return [];
  const out: ResearchVoice[] = [];
  for (const item of v) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const handle = str(rec.handle).replace(/^@/, '');
    if (!handle) continue;
    const p = str(rec.platform).toLowerCase();
    out.push({
      handle,
      platform: (SOCIAL_PLATFORMS as readonly string[]).includes(p)
        ? (p as SocialPlatform)
        : '',
      url: str(rec.url),
    });
    if (out.length >= cap) break;
  }
  return out;
}

/** Defensive JSONB -> intake. Unknown shapes degrade to blanks, never throw. */
export function normalizeResearchIntake(value: unknown): ResearchIntake {
  const rec = (value && typeof value === 'object' ? value : {}) as Record<
    string,
    unknown
  >;
  return {
    mode:
      rec.mode === 'external' || rec.mode === 'internal' ? rec.mode : 'auto',
    // Sessions saved before the depth flag degrade to standard, never deep:
    // the paid lane is opt-in only.
    depth: rec.depth === 'deep' ? 'deep' : 'standard',
    goal: str(rec.goal),
    audience: str(rec.audience),
    problemKeywords: strList(rec.problemKeywords),
    categoryKeywords: strList(rec.categoryKeywords),
    competitorProducts: strList(rec.competitorProducts),
    competitorVoices: voiceList(rec.competitorVoices),
    subreddits: strList(rec.subreddits).map((s) => s.replace(/^r\//i, '')),
    seedLinks: strList(rec.seedLinks),
  };
}

/** True when the intake has at least one usable seed. */
export function intakeHasSeeds(intake: ResearchIntake): boolean {
  return (
    intake.problemKeywords.length > 0 ||
    intake.categoryKeywords.length > 0 ||
    intake.competitorProducts.length > 0 ||
    intake.competitorVoices.length > 0 ||
    intake.subreddits.length > 0 ||
    intake.seedLinks.length > 0
  );
}

// ---------------------------------------------------------------------------
// Link classifiers
// ---------------------------------------------------------------------------

/** Extract an ASIN from an Amazon URL (/dp/, /gp/product/, or bare path). */
export function extractAmazonAsin(url: string): string | null {
  const m =
    url.match(/\/(?:dp|gp\/product|product)\/([A-Z0-9]{10})(?:[/?]|$)/i) ||
    url.match(/amazon\.[a-z.]+\/([A-Z0-9]{10})(?:[/?]|$)/i);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Build a working Amazon link for a suggested product. A certain ASIN gets
 * the canonical /dp/ link; otherwise a search URL for the exact title, which
 * always lands on the real product (never a hallucinated ASIN).
 */
export function amazonProductLink(title: string, asin?: string | null): string {
  const a = (asin || '').trim().toUpperCase();
  if (/^[A-Z0-9]{10}$/.test(a)) return `https://amazon.com/dp/${a}`;
  return `https://www.amazon.com/s?k=${encodeURIComponent(title)}`;
}

export type SeedLinkKind =
  | { kind: 'amazon-product'; asin: string | null; url: string }
  | { kind: 'social-profile'; platform: SocialPlatform; handle: string; url: string }
  | { kind: 'subreddit'; name: string; url: string }
  | { kind: 'link'; url: string };

const SOCIAL_HOST: Array<[RegExp, SocialPlatform]> = [
  [/instagram\.com/i, 'instagram'],
  [/tiktok\.com/i, 'tiktok'],
  [/(?:youtube\.com|youtu\.be)/i, 'youtube'],
  [/(?:twitter\.com|x\.com)/i, 'x'],
  [/facebook\.com/i, 'facebook'],
  [/pinterest\.com/i, 'pinterest'],
  [/linkedin\.com/i, 'linkedin'],
];

/**
 * Classify a pasted link into the seed it belongs to: an Amazon product (with
 * ASIN when extractable), a social profile (with platform + handle), a
 * subreddit, or a generic seed link. The intake panel applies the result;
 * the user can always override.
 */
export function classifySeedLink(rawUrl: string): SeedLinkKind {
  const url = rawUrl.trim();
  if (!url) return { kind: 'link', url };

  if (/amazon\.[a-z.]+/i.test(url)) {
    return { kind: 'amazon-product', asin: extractAmazonAsin(url), url };
  }

  const subMatch = url.match(/reddit\.com\/r\/([A-Za-z0-9_]+)/i);
  if (subMatch) {
    return { kind: 'subreddit', name: subMatch[1], url };
  }

  for (const [re, platform] of SOCIAL_HOST) {
    if (re.test(url)) {
      const handleMatch = url.match(
        /(?:instagram\.com|tiktok\.com\/@|x\.com|twitter\.com)\/@?([A-Za-z0-9_.]{2,30})/i,
      );
      return {
        kind: 'social-profile',
        platform,
        handle: handleMatch ? handleMatch[1] : '',
        url,
      };
    }
  }

  return { kind: 'link', url };
}

// ---------------------------------------------------------------------------
// Prompt block
// ---------------------------------------------------------------------------

/**
 * Render the ACTIVE RESEARCH BRIEF section of the system prompt. Returns ''
 * when the intake has no seeds, so unscoped sessions degrade to the
 * ask-for-seed behavior rather than a fake brief.
 */
export function intakeBriefBlock(intake: ResearchIntake): string {
  if (!intakeHasSeeds(intake) && !intake.goal && !intake.audience) return '';
  const lines: string[] = ['ACTIVE RESEARCH BRIEF (search WITH these seeds, never with the offer name):'];
  if (intake.goal) lines.push(`Goal: ${intake.goal}`);
  if (intake.audience) lines.push(`Audience: ${intake.audience}`);
  if (intake.problemKeywords.length) {
    lines.push(`Problem-space keywords: ${intake.problemKeywords.join(', ')}`);
  }
  if (intake.categoryKeywords.length) {
    lines.push(`Category analogs (Amazon/web): ${intake.categoryKeywords.join(', ')}`);
  }
  if (intake.competitorProducts.length) {
    lines.push(`Competitor products to mine: ${intake.competitorProducts.join(', ')}`);
  }
  if (intake.competitorVoices.length) {
    lines.push(
      `Competitor voices: ${intake.competitorVoices
        .map((v) => `${v.platform ? `${v.platform}/` : ''}${v.handle}${v.url ? ` (${v.url})` : ''}`)
        .join(', ')}`,
    );
  }
  if (intake.subreddits.length) {
    lines.push(`Subreddits: ${intake.subreddits.map((s) => `r/${s}`).join(', ')}`);
  }
  if (intake.seedLinks.length) {
    lines.push(`Seed links: ${intake.seedLinks.join(', ')}`);
  }
  return lines.join('\n');
}
