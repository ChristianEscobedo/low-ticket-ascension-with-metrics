/**
 * The Research Lab tool DEFINITIONS, pure and server-free.
 *
 * Why this is its own module (same reasoning as scrapeNormalize.ts): the
 * executor in tools.ts drags in the service-role stores and the paid
 * integrations, which build Supabase clients at module scope. The defs are
 * plain data — keeping them here means tests can pin the deep-mode filtering
 * (standard = 8 tools, deep = 11) without booting the store.
 *
 * `import type` on AgentToolDef is erased at compile time, so this module has
 * zero runtime imports.
 */
import type { AgentToolDef } from '@/utils/integrations/research-agent';

/** The tools that exist only when the session's research depth is deep. */
export const DEEP_TOOL_NAMES = [
  'top_posts',
  'post_comments',
  'voice_deep_dive',
] as const;

function deepToolDefs(): AgentToolDef[] {
  return [
    {
      name: 'top_posts',
      description:
        'DEEP MODE. Search a platform for a topic or hashtag and rank the results by REAL performance: engagement rate when follower counts come through, raw engagements then views otherwise. The answer to "which posts perform best" — captions show what hooks win, and every post keeps its URL so you can hand winners to post_comments to read the audience. Platforms: x, tiktok, instagram, youtube (reddit already has reddit_deep_dive). Same query discipline as social_search: 1-4 everyday words, never offer/product terms. Costs money per run; results are cached.',
      inputSchema: {
        type: 'object',
        properties: {
          platform: {
            type: 'string',
            enum: ['x', 'tiktok', 'instagram', 'youtube'],
            description: 'The platform to search.',
          },
          query: {
            type: 'string',
            description: 'Topic, hashtag, or phrase to rank posts for.',
          },
          limit: {
            type: 'number',
            description: 'Posts to rank (1-20, default 10).',
          },
        },
        required: ['platform', 'query'],
      },
    },
    {
      name: 'post_comments',
      description:
        'DEEP MODE. Mine the top comments on ONE specific post, reel, or video URL (tiktok, instagram, x, youtube). This is where the audience says what it wants next: objections, questions, "where do I get it". Use it after top_posts or voice_deep_dive surfaces a winner. Costs money per run; results are cached per URL.',
      inputSchema: {
        type: 'object',
        properties: {
          platform: {
            type: 'string',
            enum: ['x', 'tiktok', 'instagram', 'youtube'],
            description: 'The platform the post lives on.',
          },
          url: {
            type: 'string',
            description: 'Full URL of the post, reel, or video.',
          },
          limit: {
            type: 'number',
            description: 'Comments to pull (1-25, default 10).',
          },
        },
        required: ['platform', 'url'],
      },
    },
    {
      name: 'voice_deep_dive',
      description:
        'DEEP MODE. The full picture on one creator in a single call: a ladder of their recent posts ranked by performance (engagement rate, then views), the top comments mined on the strongest posts, and a deterministic comment-language rollup — the phrases the audience repeats and the questions they keep asking, counted in code, not guessed. Posts say what hooks WORK; the rollup says what the audience wants NEXT. Expensive (one posts run plus a comment run per mined post): use on the brief\'s competitor voices, one per turn unless the owner asks for a sweep.',
      inputSchema: {
        type: 'object',
        properties: {
          handle: {
            type: 'string',
            description: 'The creator handle, without @ (e.g. "biglittlefeelings").',
          },
          platform: {
            type: 'string',
            enum: ['tiktok', 'instagram', 'x', 'youtube'],
            description: 'The platform to dive on.',
          },
          topPosts: {
            type: 'number',
            description: 'Posts to rank (1-12, default 10).',
          },
          commentsPerPost: {
            type: 'number',
            description: 'Top comments per mined post (0-15, default 8).',
          },
          commentPosts: {
            type: 'number',
            description: 'Posts to mine comments on (0-6, default 5).',
          },
        },
        required: ['handle', 'platform'],
      },
    },
  ];
}

/**
 * The defs the agent can call this turn. Standard sessions get the everyday
 * eight; deep sessions get those plus the paid performance/comment lane. The
 * executor in tools.ts ALSO gates the deep tools on depth, so a stale def
 * list can never spend deep money on a standard session.
 *
 * `policy` is the expert's tool allowlist (roadmap 1.3): an intersection
 * applied AFTER the lane — a policy can only NARROW the lane, never widen
 * it (a Copy expert on a standard session can lose the scrapers; it cannot
 * gain deep tools the session didn't grant). Empty/absent = the full lane.
 */
export function filterToolDefs(
  defs: AgentToolDef[],
  policy: string[] | undefined,
): AgentToolDef[] {
  if (!policy || policy.length === 0) return defs;
  const allow = new Set(policy.map((t) => t.trim()).filter(Boolean));
  if (allow.size === 0) return defs;
  return defs.filter((d) => allow.has(d.name));
}

export function buildResearchToolDefs(
  opts: { deep?: boolean; policy?: string[]; extra?: AgentToolDef[] } = {},
): AgentToolDef[] {
  const defs: AgentToolDef[] = [
    {
      name: 'web_search',
      description:
        'Search the web for a topic, trend, competitor, or tactic. Returns a compact cited answer. Use for broad research questions.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query.' },
        },
        required: ['query'],
      },
    },
    {
      name: 'social_search',
      description:
        'Search real social posts on one platform (x, tiktok, instagram, reddit, youtube) via the Monid scraping gateway. Mine hooks, angles, and audience language. Query like a real user posts or follows: niche topics ("mom burnout", "evening routine"), plain questions, hashtags, or a creator name/handle for voice research. 1-4 words, never offer/product terms, never keyword stacks. Costs money per run; results are cached.',
      inputSchema: {
        type: 'object',
        properties: {
          platform: {
            type: 'string',
            enum: ['x', 'tiktok', 'instagram', 'reddit', 'youtube'],
            description: 'The platform to search.',
          },
          query: {
            type: 'string',
            description: 'Topic, hashtag, or phrase to search for.',
          },
          limit: {
            type: 'number',
            description: 'Max posts to pull (1-50, default 12).',
          },
        },
        required: ['platform', 'query'],
      },
    },
    {
      name: 'voice_audit',
      description:
        'Audit a creator\'s feed on one platform (tiktok, instagram, x, youtube): recent posts ranked by engagement RATE (likes+comments ÷ followers — the honest viral number, not raw counts), then the top comments on the strongest posts. Posts say what hooks WORK; comments say what the audience wants NEXT. Use on competitor voices from the research brief (e.g. sheisapaigeturner, biglittlefeelings). In deep mode prefer voice_deep_dive for the long ladder plus the comment-language rollup.',
      inputSchema: {
        type: 'object',
        properties: {
          handle: {
            type: 'string',
            description: 'The creator handle, without @ (e.g. "biglittlefeelings").',
          },
          platform: {
            type: 'string',
            enum: ['tiktok', 'instagram', 'x', 'youtube'],
            description: 'The platform to audit.',
          },
          topPosts: {
            type: 'number',
            description: 'Posts to rank (1-10, default 6; deep mode allows 15).',
          },
          commentsPerPost: {
            type: 'number',
            description: 'Top comments per post (0-10, default 5; deep mode allows 15).',
          },
        },
        required: ['handle', 'platform'],
      },
    },
    {
      name: 'reddit_deep_dive',
      description:
        'Mine Reddit for a topic: search threads (optionally scoped to one subreddit) AND pull the top comments on the strongest threads. The comments are where raw pain language and objections live. ONE short pain phrase per call (1-3 words like "mental load" or "evening chaos"): Reddit ANDs words, so long phrases return nothing. Use before drafting hooks, offers, or lead magnets for the mom audience (r/Parenting, r/workingmoms, r/Mommit).',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Topic to search (e.g. "after school meltdown").',
          },
          subreddit: {
            type: 'string',
            description: 'Optional subreddit scope (e.g. "Parenting", "workingmoms").',
          },
          threadLimit: {
            type: 'number',
            description: 'Threads to return (1-10, default 5).',
          },
          commentsPerThread: {
            type: 'number',
            description: 'Top comments per thread (0-10, default 4).',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'amazon_reviews',
      description:
        'Mine Amazon reviews for a book/product in the niche, by search query or ASIN. Returns a digest with low-star objections kept visible. Use for pain language, desired outcomes, and objection mining.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Product/book search (e.g. "mom planner book").',
          },
          asin: { type: 'string', description: 'Direct ASIN (wins over query).' },
          maxReviews: {
            type: 'number',
            description: 'Reviews to include (1-25, default 14).',
          },
        },
      },
    },
    {
      name: 'internal_metrics',
      description:
        'Read the business\'s OWN numbers: tracked-link clicks, opt-ins, purchases, attributed revenue by piece and campaign, paid vs organic split. Quote exactly; prefer over guesses.',
      inputSchema: {
        type: 'object',
        properties: {
          filter: {
            type: 'string',
            description: 'Optional substring to focus one piece/campaign/source.',
          },
          sinceDays: {
            type: 'number',
            description: 'Optional window for leads (e.g. 30). Clicks are all-time.',
          },
        },
      },
    },
    {
      name: 'get_context',
      description:
        'Load the session\'s attached context packs (offer, kits, brand bible) plus the scoped offer. Call before drafting anything that names an offer, price, or promise.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'create_artifact',
      description:
        'Save a durable research output (brief, plan, concept) to the session. The markdown is human-readable; structured carries the handoff payload in the exact documented shape.',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [
              'research-brief',
              'offer-brief',
              'content-plan',
              'lead-magnet',
              'ad-angles',
              'email-outline',
              'notes',
            ],
          },
          title: { type: 'string' },
          markdown: { type: 'string', description: 'The full document.' },
          structured: {
            type: 'object',
            description:
              'Handoff payload: {items:[...]} for content-plan/ad-angles; concept fields for lead-magnet/email-outline/offer-brief; {} otherwise.',
          },
        },
        required: ['type', 'title', 'markdown'],
      },
    },
  ];
  if (opts.deep) defs.push(...deepToolDefs());
  // Declarative skills (Phase 3): the active set joins the lane BEFORE the
  // policy filter — an expert's policy narrows skills exactly like tools.
  if (opts.extra && opts.extra.length > 0) defs.push(...opts.extra);
  return filterToolDefs(defs, opts.policy);
}
