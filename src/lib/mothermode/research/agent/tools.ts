/**
 * Research Lab agent tools: the six capabilities the agent can call, their
 * schemas, and the server-side executor. Each execution returns the content
 * the model sees plus the one-line input/result summaries the reasoning trace
 * persists.
 *
 * Server-only: pulls in the service-role stores and the paid integrations.
 */
import type { AgentToolDef } from '@/utils/integrations/research-agent';
import {
  runWebSearch,
} from '@/utils/integrations/research-agent';
import {
  socialSearch,
  redditDeepDive,
  voiceAudit,
  topPosts,
  postComments,
  voiceDeepDive,
} from '@/utils/integrations/monid';
import { amazonReviewDigest } from '@/utils/integrations/amazon-rapidapi';
import { commentLanguageBlock } from '../commentLanguage';
import { checkPostUrl } from '../urlSafety';
import { buildResearchToolDefs } from './toolDefs';
import { isSkillToolName, runSkillTool } from './skillBridge';
import { fenceIfExternal } from './fencing';

import {
  postsCard,
  commentsCard,
  reviewsCard,
  type LiveResultCard,
} from '../liveCards';
import {
  expertAllowsArtifact,
  DEFAULT_RESEARCH_EXPERT,
  type ResearchExpert,
} from '../experts/types';
import { readInternalMetrics } from '../metrics';
import { upsertArtifact } from '../store';
import {
  isResearchArtifactType,
  type ResearchArtifact,
  type ResearchSession,
} from '../types';
import { resolveContextRefs } from '@/lib/mothermode/context/resolve';
import { contextPacksToPromptBlock } from '@/lib/mothermode/context/prompt';
import { getOffer } from '@/lib/mothermode/offers';
import type { ContextRef } from '@/lib/mothermode/context';

// ---------------------------------------------------------------------------
// Definitions (provider-agnostic; research-agent maps per provider)
//
// The defs live in ./toolDefs (pure, no server imports) so tests can pin the
// deep-mode filtering without booting the store. researchToolDefs stays the
// loop's import surface.
// ---------------------------------------------------------------------------

export function researchToolDefs(
  opts: { deep?: boolean; policy?: string[]; extra?: AgentToolDef[] } = {},
): AgentToolDef[] {
  return buildResearchToolDefs(opts);
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export interface ToolRunOutcome {
  /** The text the model sees as the tool result. */
  content: string;
  /** One line for the reasoning trace (`x: "query" limit 12`). */
  inputSummary: string;
  /** One line for the reasoning trace (`47 posts via twitter-posts-search`). */
  resultSummary: string;
  /** The structured, pinnable result (roadmap 2.2) for data tools. */
  cards?: LiveResultCard[];
  /** Set when a create_artifact call persisted an artifact. */
  artifact?: ResearchArtifact;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}
function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
function oneLine(v: string, cap = 140): string {
  const clean = v.replace(/\s+/g, ' ').trim();
  return clean.length <= cap ? clean : `${clean.slice(0, cap - 1)}…`;
}

/** The deep-mode gate: a readable refusal, never a crash or a silent run. */
function deepBlocked(name: string, inputSummary: string): ToolRunOutcome {
  return {
    content:
      `${name} is a Deep research mode tool, and this session is on Standard depth. ` +
      'Tell the owner to flip the Research depth toggle in the brief panel to Deep (it spends more per turn), then retry.',
    inputSummary,
    resultSummary: 'blocked: standard depth',
  };
}

/** The raw executor. Do NOT export — every caller goes through the fencing
 *  wrapper below so external results reach the model behind the fence. */
async function runResearchToolRaw(opts: {
  name: string;
  input: Record<string, unknown>;
  session: ResearchSession;
  /** The expert running this turn (default: the research config). */
  expert?: ResearchExpert;
}): Promise<ToolRunOutcome> {
  const { name, input, session } = opts;

  const expert = opts.expert ?? DEFAULT_RESEARCH_EXPERT;
  // The session's tool lane. Defense in depth: even if a stale def list let a
  // deep tool through, a standard session never spends deep money here.
  const deep = session.intake.depth === 'deep';
  // The expert's tool policy. Same defense-in-depth: a stale def list never
  // runs a tool the expert wasn't granted.
  if (
    expert.tools.length > 0 &&
    !expert.tools.includes(name) &&
    name !== 'create_artifact'
  ) {
    return {
      content: `${name} is not in the ${expert.name} expert's tool policy (granted: ${expert.tools.join(', ')}). Use a granted tool.`,
      inputSummary: '',
      resultSummary: 'blocked: outside policy',
    };
  }

  // ------------------------------------------------------------- web_search
  if (name === 'web_search') {
    const query = str(input.query);
    const inputSummary = `"${oneLine(query, 60)}"`;
    const res = await runWebSearch(query);
    if (!res.ok) {
      return {
        content: `web_search failed: ${res.error}`,
        inputSummary,
        resultSummary: 'failed',
      };
    }
    return {
      content: res.data,
      inputSummary,
      resultSummary: `${res.data.length} chars, cited`,
    };
  }

  // ---------------------------------------------------------- social_search
  if (name === 'social_search') {
    const platform = str(input.platform).toLowerCase();
    const query = str(input.query);
    const limit = num(input.limit, 12);
    const inputSummary = `${platform}: "${oneLine(query, 48)}"`;
    const res = await socialSearch({ platform, query, limit });
    if (!res.ok) {
      return {
        content: `social_search failed: ${res.error}`,
        inputSummary,
        resultSummary: `failed: ${oneLine(res.error)}`,
      };
    }
    return {
      content: `SOURCE: ${platform} via Monid endpoint "${res.data.endpointName}" (${res.data.endpoint})${res.cached ? ' [cached]' : ''}\nQuery: "${query}"\n\n${res.data.payloadText}`,
      inputSummary,
      resultSummary: `${res.cached ? 'cached, ' : ''}${res.data.payloadText.length} chars`,
    };
  }

  // ------------------------------------------------------------ voice_audit
  if (name === 'voice_audit') {
    const handle = str(input.handle);
    const platform = str(input.platform).toLowerCase();
    // Deep sessions get the longer ladder and comments on more posts;
    // standard keeps the cheap audit it has always had.
    const topPosts = Math.min(num(input.topPosts, 6), deep ? 15 : 10);
    const commentsPerPost = Math.min(
      num(input.commentsPerPost, 5),
      deep ? 15 : 10,
    );
    const commentPosts = deep ? 5 : 3;
    const inputSummary = `${platform}: @${oneLine(handle, 32)}`;
    const res = await voiceAudit({
      handle,
      platform,
      topPosts,
      commentsPerPost,
      commentPosts,
    });
    if (!res.ok) {
      return {
        content: `voice_audit failed: ${res.error}`,
        inputSummary,
        resultSummary: `failed: ${oneLine(res.error)}`,
      };
    }
    const d = res.data;
    const lines: string[] = [
      `VOICE AUDIT: @${d.handle} on ${d.platform} — ${d.posts.length} posts ranked${res.cached ? ' [cached]' : ''}`,
      'Posts are ranked by engagement RATE when follower counts came through, raw engagements otherwise.',
      '',
    ];
    d.posts.forEach((p, i) => {
      const eng =
        p.engagement !== null
          ? `${(p.engagement * 100).toFixed(1)}% engagement rate`
          : `${p.likes ?? '?'} likes, ${p.comments ?? '?'} comments`;
      lines.push(
        `${i + 1}. ${p.caption || '(no caption)'} [${eng}]`,
        p.postedAt ? `   posted ${p.postedAt}` : '',
        ...p.topComments.map(
          (c) => `   > ${c.body}${c.score !== null ? ` (${c.score} pts)` : ''}`,
        ),
        '',
      );
    });
    lines.push(
      `Comment language mined on ${d.commentsOn} of the top posts. Use the repeated phrases and objections in hooks and copy.`,
    );
    return {
      content: lines.filter(Boolean).join('\n'),
      inputSummary,
      resultSummary: `${d.posts.length} posts, ${d.commentsOn} with comments${res.cached ? ' (cached)' : ''}`,
      cards: [
        postsCard(
          `@${d.handle} on ${d.platform} · ${d.posts.length} posts ranked`,
          d.posts,
        ),
      ],
    };
  }

  // ------------------------------------------------------------- top_posts
  if (name === 'top_posts') {
    const platform = str(input.platform).toLowerCase();
    const query = str(input.query);
    const limit = num(input.limit, 10);
    const inputSummary = `${platform}: "${oneLine(query, 48)}"`;
    if (!deep) return deepBlocked(name, inputSummary);
    const res = await topPosts({ platform, query, limit });
    if (!res.ok) {
      return {
        content: `top_posts failed: ${res.error}`,
        inputSummary,
        resultSummary: `failed: ${oneLine(res.error)}`,
      };
    }
    const d = res.data;
    if (d.posts.length === 0) {
      return {
        content:
          `TOP POSTS: ${platform} "${d.query}" — the endpoint ran but no posts could be normalized from its payload.\n` +
          `Say plainly that the search RAN and returned data in an unexpected shape (do NOT say the platform has nothing on this topic), and read whatever is usable from the raw payload below.\n\n` +
          `RAW PAYLOAD (compacted):\n${d.rawPreview ?? '(no preview available)'}`,
        inputSummary,
        resultSummary: 'no posts normalized, raw payload shown',
      };
    }
    const lines: string[] = [
      `TOP POSTS: ${platform} "${d.query}" — ${d.posts.length} posts ranked by performance${res.cached ? ' [cached]' : ''} (via ${d.endpointName || d.endpoint})`,
      'Ranked by engagement RATE when follower counts came through, raw engagements then views otherwise. URLs are kept: hand a winner to post_comments to read what the audience says under it.',
      '',
    ];
    d.posts.forEach((p, i) => {
      const eng =
        p.engagement !== null
          ? `${(p.engagement * 100).toFixed(1)}% engagement rate`
          : `${p.likes ?? '?'} likes, ${p.comments ?? '?'} comments`;
      const views =
        p.views !== null ? `, ${p.views.toLocaleString()} views` : '';
      lines.push(
        `${i + 1}. ${p.caption || '(no caption)'} [${eng}${views}]`,
        p.url ? `   ${p.url}` : '',
        p.postedAt ? `   posted ${p.postedAt}` : '',
      );
    });
    return {
      content: lines.filter(Boolean).join('\n'),
      inputSummary,
      resultSummary: `${d.posts.length} posts ranked${res.cached ? ' (cached)' : ''}`,
      cards: [
        postsCard(
          `${platform} "${oneLine(d.query, 40)}" · ${d.posts.length} posts ranked`,
          d.posts,
        ),
      ],
    };
  }

  // ---------------------------------------------------------- post_comments
  if (name === 'post_comments') {
    const platform = str(input.platform).toLowerCase();
    const url = str(input.url);
    const limit = num(input.limit, 10);
    const inputSummary = `${platform}: ${oneLine(url, 52)}`;
    if (!deep) return deepBlocked(name, inputSummary);
    // The SSRF gate (2.5): only real platform post URLs reach the scraper.
    const urlCheck = checkPostUrl(platform, url);
    if (!urlCheck.ok) {
      return {
        content: `post_comments blocked: ${urlCheck.reason}`,
        inputSummary,
        resultSummary: 'blocked: url not allowed',
      };
    }
    const res = await postComments({ platform, url, limit });
    if (!res.ok) {
      return {
        content: `post_comments failed: ${res.error}`,
        inputSummary,
        resultSummary: `failed: ${oneLine(res.error)}`,
      };
    }
    const d = res.data;
    const lines: string[] = [
      `POST COMMENTS: ${platform} — ${d.comments.length} top comments${res.cached ? ' [cached]' : ''}`,
      url,
      '',
    ];
    d.comments.forEach((c, i) => {
      lines.push(
        `${i + 1}. ${c.body}${c.score !== null ? ` (${c.score} pts)` : ''}`,
      );
    });
    lines.push(
      '',
      'Mine the repeated phrases, objections, and questions for hooks and copy. Quote the audience exactly.',
    );
    return {
      content: lines.join('\n'),
      inputSummary,
      resultSummary: `${d.comments.length} comments${res.cached ? ' (cached)' : ''}`,
      cards: [
        commentsCard(
          `${platform} · ${d.comments.length} top comments`,
          d.comments,
        ),
      ],
    };
  }

  // --------------------------------------------------------- voice_deep_dive
  if (name === 'voice_deep_dive') {
    const handle = str(input.handle);
    const platform = str(input.platform).toLowerCase();
    const inputSummary = `${platform}: @${oneLine(handle, 32)} (deep)`;
    if (!deep) return deepBlocked(name, inputSummary);
    const res = await voiceDeepDive({
      handle,
      platform,
      topPosts: num(input.topPosts, 10),
      commentsPerPost: num(input.commentsPerPost, 8),
      commentPosts: num(input.commentPosts, 5),
    });
    if (!res.ok) {
      return {
        content: `voice_deep_dive failed: ${res.error}`,
        inputSummary,
        resultSummary: `failed: ${oneLine(res.error)}`,
      };
    }
    const d = res.data;
    const lines: string[] = [
      `VOICE DEEP DIVE: @${d.handle} on ${d.platform} — ${d.posts.length} posts ranked${res.cached ? ' [cached]' : ''}`,
      'Ranked by engagement RATE when follower counts came through, raw engagements then views otherwise.',
      '',
    ];
    d.posts.forEach((p, i) => {
      const eng =
        p.engagement !== null
          ? `${(p.engagement * 100).toFixed(1)}% engagement rate`
          : `${p.likes ?? '?'} likes, ${p.comments ?? '?'} comments`;
      const views =
        p.views !== null ? `, ${p.views.toLocaleString()} views` : '';
      lines.push(
        `${i + 1}. ${p.caption || '(no caption)'} [${eng}${views}]`,
        p.url ? `   ${p.url}` : '',
        ...p.topComments.map(
          (c) => `   > ${c.body}${c.score !== null ? ` (${c.score} pts)` : ''}`,
        ),
        '',
      );
    });
    const rollup = commentLanguageBlock(d.language);
    if (rollup) {
      lines.push(rollup);
    } else {
      lines.push(
        `Comment language mined on ${d.commentsOn} of the top posts (too thin for a phrase rollup — read the comments above directly).`,
      );
    }
    return {
      content: lines.filter(Boolean).join('\n'),
      inputSummary,
      resultSummary: `${d.posts.length} posts, ${d.commentsOn} mined, ${d.language.phrases.length} phrases${res.cached ? ' (cached)' : ''}`,
      cards: [
        postsCard(
          `@${d.handle} deep dive · ${d.posts.length} posts ranked`,
          d.posts,
        ),
      ],
    };
  }

  // ------------------------------------------------------ reddit_deep_dive
  if (name === 'reddit_deep_dive') {
    const query = str(input.query);
    const subreddit = str(input.subreddit);
    const threadLimit = num(input.threadLimit, 5);
    const commentsPerThread = num(input.commentsPerThread, 4);
    const inputSummary = `"${oneLine(query, 44)}"${subreddit ? ` in r/${subreddit}` : ''}`;
    const res = await redditDeepDive({
      query,
      subreddit: subreddit || undefined,
      threadLimit,
      commentsPerThread,
    });
    if (!res.ok) {
      return {
        content: `reddit_deep_dive failed: ${res.error}`,
        inputSummary,
        resultSummary: `failed: ${oneLine(res.error)}`,
      };
    }
    const d = res.data;
    // The endpoint ran but nothing normalized: the agent still gets the raw
    // payload (and must say the normalizer failed, not that reddit is empty).
    if (d.threads.length === 0 && d.rawPreview) {
      return {
        content:
          `REDDIT DIGEST: "${d.query}" — the endpoint returned data but no threads could be normalized from it.\n` +
          `Say plainly that the search RAN and returned data in an unexpected shape (do NOT say reddit has nothing on this topic), and read whatever language is usable from the raw payload below.\n\n` +
          `RAW PAYLOAD (compacted):\n${d.rawPreview}`,
        inputSummary,
        resultSummary: `no threads normalized, raw payload shown${res.cached ? ' (cached)' : ''}`,
      };
    }
    const lines: string[] = [
      `REDDIT DIGEST: "${d.query}" — ${d.threads.length} threads${res.cached ? ' [cached]' : ''}` +
        (d.commentsEndpoint ? '' : ' (comments endpoint unavailable: posts only)'),
      '',
    ];
    d.threads.forEach((t, i) => {
      lines.push(
        `${i + 1}. ${t.title}` +
          (t.subreddit ? ` [r/${t.subreddit}]` : '') +
          (t.score !== null ? ` — ${t.score} pts` : '') +
          (t.numComments !== null ? `, ${t.numComments} comments` : ''),
      );
      if (t.text) lines.push(`   self: ${t.text}`);
      for (const c of t.comments) {
        lines.push(
          `   > ${c.body}${c.score !== null ? ` (${c.score} pts)` : ''}`,
        );
      }
      lines.push('');
    });
    const totalComments = d.threads.reduce((n, t) => n + t.comments.length, 0);
    return {
      content: lines.join('\n'),
      inputSummary,
      resultSummary: `${d.threads.length} threads, ${totalComments} comments${res.cached ? ' (cached)' : ''}`,
      cards: [
        postsCard(
          `reddit "${oneLine(d.query, 36)}" · ${d.threads.length} threads`,
          d.threads.map((t) => ({
            caption: t.text ? `${t.title} — ${t.text}` : t.title,
            likes: t.score,
            comments: t.numComments,
            views: null,
            engagement: null,
            url: t.url,
            topComments: t.comments,
          })),
        ),
      ],
    };
  }

  // --------------------------------------------------------- amazon_reviews
  if (name === 'amazon_reviews') {
    const query = str(input.query);
    const asin = str(input.asin);
    const maxReviews = num(input.maxReviews, 14);
    const inputSummary = asin ? `asin ${asin}` : `"${oneLine(query, 48)}"`;
    const res = await amazonReviewDigest({ query, asin, maxReviews });
    if (!res.ok) {
      return {
        content: `amazon_reviews failed: ${res.error}`,
        inputSummary,
        resultSummary: `failed: ${oneLine(res.error)}`,
      };
    }
    const d = res.data;
    const lines: string[] = [
      `PRODUCT: ${d.product.title || d.product.asin} (asin ${d.product.asin}` +
        (d.product.rating !== null ? `, ${d.product.rating} stars` : '') +
        (d.product.ratingsTotal !== null
          ? `, ${d.product.ratingsTotal.toLocaleString()} ratings`
          : '') +
        `)${res.cached ? ' [cached]' : ''} [via ${d.provider}]`,
      `REVIEWS SHOWN: ${d.reviews.length} of ${d.totalFound} (low-star objections first)`,
      '',
    ];
    d.reviews.forEach((r, i) => {
      lines.push(
        `${i + 1}. [${r.stars ?? '?'}★] ${r.title}`,
        `   ${r.body}`,
      );
    });
    return {
      content: lines.join('\n'),
      inputSummary,
      resultSummary: `${d.reviews.length} reviews on "${oneLine(d.product.title || d.product.asin, 32)}"${res.cached ? ' (cached)' : ''}`,
      cards: [
        reviewsCard(
          `${oneLine(d.product.title || d.product.asin, 44)} · ${d.reviews.length} reviews (low-star first)`,
          d.reviews,
        ),
      ],
    };
  }

  // ------------------------------------------------------- internal_metrics
  if (name === 'internal_metrics') {
    const filter = str(input.filter) || undefined;
    const sinceDays = num(input.sinceDays, 0) || undefined;
    const inputSummary = filter ? `filter "${oneLine(filter, 40)}"` : 'overview';
    const { text, summary } = await readInternalMetrics({ filter, sinceDays });
    return {
      content: text,
      inputSummary,
      resultSummary: `${summary.totals.links} links, ${summary.totals.clicks.toLocaleString()} clicks`,
    };
  }

  // ------------------------------------------------------------- get_context
  if (name === 'get_context') {
    const refs: ContextRef[] = [...session.contextRefs];
    if (
      session.offerSlug &&
      !refs.some((r) => r.kind === 'offer' && r.id === session.offerSlug)
    ) {
      const offer = getOffer(session.offerSlug);
      refs.unshift({
        kind: 'offer',
        id: session.offerSlug,
        label: offer?.name ?? session.offerSlug,
      });
    }
    const packs = await resolveContextRefs(refs);
    const block = contextPacksToPromptBlock(packs, 'kit');
    return {
      content:
        block ||
        'No context packs resolved. The session has no attached offer/kit context (or the sources were deleted).',
      inputSummary: `${refs.length} ref(s)`,
      resultSummary: packs.length
        ? `${packs.length} pack(s): ${oneLine(packs.map((p) => p.title).join(', '), 60)}`
        : 'none resolved',
    };
  }

  // --------------------------------------------------------- create_artifact
  if (name === 'create_artifact') {
    const type = str(input.type);
    const title = str(input.title);
    const markdown = typeof input.markdown === 'string' ? input.markdown : '';
    const structured =
      input.structured &&
      typeof input.structured === 'object' &&
      !Array.isArray(input.structured)
        ? (input.structured as Record<string, unknown>)
        : {};
    const inputSummary = `${type}: "${oneLine(title, 40)}"`;
    if (!isResearchArtifactType(type)) {
      return {
        content: `create_artifact failed: unknown type "${type}".`,
        inputSummary,
        resultSummary: 'failed',
      };
    }
    // The expert's artifact contract (roadmap 1.2): an empty contract allows
    // every type; a set one rejects with a readable, model-correctable reason.
    const contract = expertAllowsArtifact(expert, type);
    if (!contract.allowed) {
      return {
        content: `create_artifact failed: ${contract.reason}.`,
        inputSummary,
        resultSummary: 'blocked: outside contract',
      };
    }
    if (!title || !markdown.trim()) {
      return {
        content: 'create_artifact failed: title and markdown are required.',
        inputSummary,
        resultSummary: 'failed',
      };
    }
    const artifact = await upsertArtifact({
      sessionId: session.id,
      type,
      title,
      markdown,
      structured,
      // Provenance (roadmap 1.4): the expert that wrote it, not a person.
      createdBy: expert.slug,
    });
    return {
      content: `Artifact saved (${artifact.id}): ${type} "${title}". It is visible in the artifacts panel now; the user can hand it off from there.`,
      inputSummary,
      resultSummary: `saved ${type}`,
      artifact,
    };
  }

  // --------------------------------------------------------- declarative skills
  // Phase 3: `skill_<slug>` dispatches through the audited runner (the
  // allowlist / per-day limit / breaker all live there). The expert's
  // policy check above already narrowed the lane; a skill's OWN guards
  // are its row, so the session's deep/standard lane doesn't apply here.
  if (isSkillToolName(name)) {
    const outcome = await runSkillTool({ name, input });
    return {
      content: outcome.content,
      inputSummary: oneLine(JSON.stringify(input).slice(0, 80), 80),
      resultSummary: outcome.resultSummary,
    };
  }

  return {
    content: `Unknown tool "${name}".`,
    inputSummary: '',
    resultSummary: 'failed',
  };
}

/**
 * THE executor every caller uses (loop, recipes, tests). Fencing v1
 * (./fencing.ts): a tool result carrying STRANGER text (the scrape lane,
 * and every skill — arbitrary HTTP by definition) reaches the model
 * behind the fence markers, sanitized; house-internal results
 * (internal_metrics, get_context, the create_artifact confirmation) pass
 * through byte-identical. The trace fields, cards, and artifact are
 * never touched — only the model-facing content.
 */
export async function runResearchTool(opts: {
  name: string;
  input: Record<string, unknown>;
  session: ResearchSession;
  /** The expert running this turn (default: the research config). */
  expert?: ResearchExpert;
}): Promise<ToolRunOutcome> {
  const outcome = await runResearchToolRaw(opts);
  return {
    ...outcome,
    content: fenceIfExternal(opts.name, outcome.content),
  };
}


