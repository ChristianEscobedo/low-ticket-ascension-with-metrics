/**
 * Research intake suggestion engines, in two modes:
 *
 *   suggestIntakeFromContext  CHEAP mode. Drafts the brief from the offer /
 *      kit / brand context packs alone. One model call, no external data.
 *
 *   findResearchContext       WEB mode ("find for me"). Runs a small number of
 *      model-native web searches (no Monid/RapidAPI spend) for category
 *      products, niche voices, and communities, then assembles the full brief
 *      (products with Amazon links, voices with profile URLs, subreddits).
 *      Everything it returns is a SUGGESTION the user verifies before any
 *      paid scraper run — the prompt says so, and the panel shows it.
 *
 * Server-only: model calls through research-agent.ts; context through the
 * Context Bridge.
 */
import { callAgentModel, runWebSearch } from '@/utils/integrations/research-agent';
import { resolveContextRefs } from '@/lib/mothermode/context/resolve';
import { contextPacksToPromptBlock } from '@/lib/mothermode/context/prompt';
import {
  normalizeResearchIntake,
  amazonProductLink,
  type ResearchIntake,
} from './intake';
import { getOffer } from '@/lib/mothermode/offers';
import type { ContextRef } from '@/lib/mothermode/context';

export type IntakeEngineResult =
  | { ok: true; intake: ResearchIntake; sources: string[] }
  | { ok: false; error: string; status: number };

const OUTPUT_CONTRACT = `
Respond with JSON ONLY, no markdown fences, exactly this shape:
{
  "goal": "one sentence: what this research should decide",
  "audience": "who it is about",
  "problemKeywords": ["6-10 pain/topic phrases real people type or say"],
  "categoryKeywords": ["3-5 product-category phrases that EXIST on Amazon/Google"],
  "competitorProducts": ["3-4 real, well-known products to mine reviews on, as 'Name (amazon.com/dp/ASIN-if-known)' or just 'Name'"],
  "competitorVoices": [{"handle": "name-or-handle", "platform": "instagram|tiktok|youtube|x|facebook|pinterest|linkedin", "url": "profile url or empty"}],
  "subreddits": ["3-5 subreddit names without r/"],
  "seedLinks": ["0-3 useful URLs"]
}

RULES:
- The product/offer NAME is not a research query. Never put it in keywords.
- problemKeywords are BROAD EVERYDAY words the buyer types at 11pm, one or two each: "overwhelmed", "exhausted", "drowning", "chaos", "burnt out", "witching hour" — feelings and situations, never niche jargon like "mental load".
- categoryKeywords must be phrases that return results on Amazon today.
- competitorProducts must be real, popular products with real review volume (books, planners, binders, apps), never the offer itself.
- competitorVoices must be real creators in the niche with real followings. No invented handles. Empty url when unsure, never a fabricated link.`.trim();


/**
 * One JSON-producing model call. Returns the parsed object, or a REAL error
 * string — the 502 the panel shows names the cause (missing key, provider
 * 400, unparseable output) instead of "the model did not return a brief".
 */
async function modelJson(
  system: string,
  user: string,
): Promise<{ json: Record<string, unknown> | null; error: string | null }> {
  const res = await callAgentModel({
    system,
    messages: [{ role: 'user', content: user }],
    tools: [],
    maxTokens: 3000,
  });
  if (!res.ok) return { json: null, error: res.error };
  const text = res.data.text.replace(/```(?:json)?/g, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) {
    return {
      json: null,
      error: `The model answered without JSON. Its reply began: "${text.slice(0, 120)}"`,
    };
  }
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return {
      json:
        parsed && typeof parsed === 'object'
          ? (parsed as Record<string, unknown>)
          : null,
      error: null,
    };
  } catch {
    return {
      json: null,
      error: `The model returned malformed JSON: "${text.slice(start, start + 120)}"`,
    };
  }
}

async function packsFor(opts: {
  offerSlug?: string;
  contextRefs?: ContextRef[];
}): Promise<string> {
  const refs: ContextRef[] = [...(opts.contextRefs ?? [])];
  if (
    opts.offerSlug &&
    !refs.some((r) => r.kind === 'offer' && r.id === opts.offerSlug)
  ) {
    const offer = getOffer(opts.offerSlug);
    refs.unshift({
      kind: 'offer',
      id: opts.offerSlug,
      label: offer?.name ?? opts.offerSlug,
    });
  }
  const packs = await resolveContextRefs(refs);
  return contextPacksToPromptBlock(packs, 'kit');
}

/**
 * CHEAP mode: draft the brief from context packs only (no external data).
 */
export async function suggestIntakeFromContext(opts: {
  offerSlug?: string;
  contextRefs?: ContextRef[];
  goal?: string;
  model?: string;
}): Promise<IntakeEngineResult> {
  const block = await packsFor(opts);
  const system =
    'You are a research strategist for a business selling low-ticket resources to overwhelmed moms. ' +
    'Draft a research brief the owner can search WITH. ' +
    OUTPUT_CONTRACT;
  const user = [
    block || 'CONTEXT: low-ticket resources for overwhelmed moms (mental load, time scarcity, evening chaos).',
    opts.goal ? `OWNER GOAL: ${opts.goal}` : '',
    'Draft the brief.',
  ]
    .filter(Boolean)
    .join('\n\n');

  const { json, error } = await modelJson(system, user);
  if (!json) {
    return {
      ok: false,
      error: error ?? 'The model did not return a usable brief. Try again or fill it manually.',
      status: 502,
    };
  }
  return { ok: true, intake: normalizeResearchIntake(json), sources: [] };
}

/**
 * PRODUCT mode ("suggest book links"): real, related books/products the owner
 * can mine reviews on, with working Amazon links. Cheap mode (model knowledge,
 * no RapidAPI spend): ASINs only when certain, search links otherwise, so no
 * link is ever a hallucinated /dp/.
 */
export type ProductEngineResult =
  | { ok: true; products: Array<{ title: string; link: string }> }
  | { ok: false; error: string; status: number };

export async function suggestAmazonProducts(opts: {
  offerSlug?: string;
  contextRefs?: ContextRef[];
  goal?: string;
  categoryKeywords?: string[];
  audience?: string;
  model?: string;
}): Promise<ProductEngineResult> {
  const block = await packsFor(opts);
  const categories = (opts.categoryKeywords ?? []).filter(Boolean);
  const system =
    'You are a research strategist. Name 5-7 REAL, well-known books or physical products in this niche that have substantial Amazon review volume (hundreds+ ratings). ' +
    'Respond with JSON ONLY, an array: [{"title":"exact product title","asin":"10-char ASIN or empty string"}]. ' +
    'RULES: only products that exist on Amazon today. asin only when you are certain — empty string otherwise. No invented products, no invented ASINs.';
  const user = [
    block ? `CONTEXT:\n${block}` : 'CONTEXT: low-ticket resources for overwhelmed moms (mental load, time scarcity, evening chaos).',
    categories.length ? `CATEGORY PHRASES: ${categories.join(', ')}` : '',
    opts.audience ? `AUDIENCE: ${opts.audience}` : '',
    opts.goal ? `GOAL: ${opts.goal}` : '',
    'Name the products.',
  ]
    .filter(Boolean)
    .join('\n\n');

  const res = await callAgentModel({
    system,
    messages: [{ role: 'user', content: user }],
    tools: [],
    maxTokens: 1500,
  });
  if (!res.ok) return { ok: false, error: res.error, status: 502 };
  const text = res.data.text.replace(/```(?:json)?/g, '').trim();
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end <= start) {
    return {
      ok: false,
      error: `The model answered without a product list. Its reply began: "${text.slice(0, 120)}"`,
      status: 502,
    };
  }
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    const products = (Array.isArray(parsed) ? parsed : [])
      .map((p: unknown) => {
        if (!p || typeof p !== 'object') return null;
        const rec = p as Record<string, unknown>;
        const title = typeof rec.title === 'string' ? rec.title.trim() : '';
        if (!title) return null;
        const asin = typeof rec.asin === 'string' ? rec.asin.trim() : '';
        return { title, link: amazonProductLink(title, asin) };
      })
      .filter(
        (p): p is { title: string; link: string } =>
          p !== null && !!p.title,
      )
      .slice(0, 7);
    if (products.length === 0) {
      return {
        ok: false,
        error: 'The model returned an empty product list. Try again.',
        status: 502,
      };
    }
    return { ok: true, products };
  } catch {
    return {
      ok: false,
      error: 'The model returned malformed JSON. Try again.',
      status: 502,
    };
  }
}

/**
 * WEB mode ("find for me"): a few model-native web searches, then assemble.
 * Sources are the search answers the brief was built from, for the panel's
 * "found via web" note.
 */
export async function findResearchContext(opts: {
  offerSlug?: string;
  contextRefs?: ContextRef[];
  goal?: string;
  /** 'specific' digs one goal; 'broad' fans out across the whole niche. */
  scope?: 'broad' | 'specific';
  audience?: string;
  model?: string;
}): Promise<IntakeEngineResult> {
  const block = await packsFor(opts);
  const niche =
    opts.goal ||
    (block ? '' : 'overwhelmed moms (mental load, time scarcity, evening chaos)');
  const broad = opts.scope === 'broad';

  // Broad scan goes QUESTIONS-FIRST (what real people ask), then keywords,
  // then influencers and communities — the owner's ask: generate the language
  // before mining it. Specific dig focuses the same lanes on the goal.
  const queries = broad
    ? [
        `the 10 most-asked questions by ${opts.audience || 'overwhelmed moms'} right now (plain everyday language, e.g. "why am I so tired all the time")`,
        `best selling planner, organizer, or home-management books for busy moms on Amazon (mental load, family organization)`,
        `most popular mom burnout, motherhood, or parenting creators on Instagram TikTok and YouTube (mental load niche)`,
        `best subreddits and online communities for overwhelmed moms and working mothers`,
      ]
    : [
        `best selling books or products related to: ${niche.slice(0, 160)}`,
        `popular creators or influencers talking about: ${niche.slice(0, 160)}`,
        `subreddits and online communities for: ${niche.slice(0, 160)}`,
      ];

  // Searches run in PARALLEL: each takes ~25-30s and the route's duration
  // cap kills the sequential version (that was the 504).
  const settled = await Promise.allSettled(
    queries.map((q) => runWebSearch(`${q}. Niche context: ${niche.slice(0, 200)}`)),
  );
  const sources: string[] = [];
  const answers: string[] = [];
  settled.forEach((s, i) => {
    if (s.status === 'fulfilled' && s.value.ok) {
      answers.push(`QUERY: ${queries[i]}\n${s.value.data}`);
      sources.push(queries[i]);
    }
    // A failed search drops out rather than failing the whole find.
  });

  const system =
    'You are a research strategist. Assemble a research brief from the web findings below. ' +
    'Only include products, creators, and communities the findings actually name. ' +
    'This brief is a draft the owner will VERIFY before any paid scraping, so accuracy beats coverage: no invented products, handles, ASINs, or links. ' +
    OUTPUT_CONTRACT;
  const user = [
    block ? `OWNER CONTEXT:\n${block}` : '',
    answers.length
      ? `WEB FINDINGS:\n\n${answers.join('\n\n---\n\n')}`
      : 'WEB FINDINGS: none (searches unavailable) — draft from context only and keep competitor fields conservative.',
    'Assemble the brief.',
  ]
    .filter(Boolean)
    .join('\n\n');

  const { json, error } = await modelJson(system, user);
  if (!json) {
    return {
      ok: false,
      error: error ?? 'The model did not return a usable brief. Try again or fill it manually.',
      status: 502,
    };
  }
  return { ok: true, intake: normalizeResearchIntake(json), sources };
}
