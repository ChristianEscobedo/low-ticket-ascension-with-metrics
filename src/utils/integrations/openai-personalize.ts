/**
 * 1:1 Personalization AI pass (server-only). One lead + one funnel in, a
 * LeadPersonalizationPayload out.
 *
 * The model writes COPY ONLY, inside a strict JSON contract. It never sees
 * and can never set pricing, Stripe ids, hrefs or product ids — the merge
 * layer whitelists copy fields anyway, so a model that hallucinates extra
 * keys is doubly harmless. Output is coerced through normalizePayload, so a
 * malformed reply degrades to blanks (no overrides) rather than throwing.
 *
 * Provider plumbing mirrors openai-email.ts: OpenAI chat/completions in JSON
 * mode with an Anthropic fallback, keys via runtime-config. Never import from
 * a browser bundle.
 */
import {
  normalizePayload,
  type LeadPersonalizationPayload,
} from '@/lib/mothermode/personalize/types';
import type { LeadAiContext } from '@/lib/mothermode/personalize/context';
import {
  getOpenAiKey,
  getAnthropicKey,
  getTextModelOverride,
  getTextProviderOverride,
} from './runtime-config';

const OPENAI_BASE = 'https://api.openai.com/v1';
const ANTHROPIC_BASE = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';

const DEFAULT_OPENAI_MODEL = 'gpt-5.5';
const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-4-8';

export type PersonalizeAiResult =
  | { ok: true; payload: LeadPersonalizationPayload; model: string }
  | { ok: false; status: number; error: string };

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const SYSTEM = `
You write 1:1 personalized landing-page copy for ONE specific lead of a sales
funnel. You are given the lead's profile snapshot, the funnel's current copy,
and optional admin guidance. You output sparse COPY OVERRIDES in JSON: only
the fields that would materially convert better for THIS person. Anything
generic stays empty so the base copy shows through.

RULES (always):
- Calm authority. Specific over clever. Periods over exclamation points.
- No hype, no false scarcity, no income/earnings claims, no medical claims.
- Use the lead's situation, traffic source, and buying stage — never their
  email address or anything that reads as surveillance. "We know everything
  about you" kills conversions; "this was made for someone exactly like you"
  wins them.
- You may use {name} in any copy field; it resolves to their first name at
  render time (or 'there' when unknown), so it must read well BOTH ways.
  Prefer at most one {name} per field.
- Match the existing voice and length band of the field you override. A
  headline stays a headline: under ~12 words.
- benefits/problemPoints/bullets arrays: 3-6 tight items, one idea each.
- intentSegment: a short snake-case label for this lead's buying stage, e.g.
  'fresh-optin', 'warm-clicker', 'cart-abandoner', 'buyer', 'cold-dormant'.
- intentSummary: one plain sentence for the admin explaining your read and
  the angle you took. Not shown to the lead.
- urgencyAngle: 'deadline' | 'bonus' | 'founding-price' | 'soft' | 'none'.
- heroImagePrompt: one sentence describing a personalized hero image for
  this lead (used by a later image pass; describe the SCENE, no text in it).
- accentColor: a hex color that fits this lead's context (e.g. team/brand
  colors) or empty. Must be '#rgb' or '#rrggbb'.
- Output ONLY the JSON object, no prose, no markdown fences.
`.trim();

const RESPONSE_SHAPE = `
{
  "intentSegment": "",
  "intentSummary": "",
  "urgencyAngle": "",
  "optin": {
    "eyebrow": "", "headline": "", "headlineEmphasis": "", "headlineSuffix": "",
    "subheadline": "", "audience": "", "benefits": [], "ctaText": "",
    "badgeText": "", "magnetTitle": "", "magnetDescription": ""
  },
  "sales": {
    "eyebrow": "", "headline": "", "headlineEmphasis": "", "headlineSuffix": "",
    "subheadline": "", "promise": "", "problemHeading": "", "problemScene": "",
    "problemPoints": [], "ctaText": "", "ctaSubtext": "",
    "finalCtaHeading": "", "finalCtaBody": ""
  },
  "checkout": { "eyebrow": "", "headline": "", "subheadline": "", "ctaText": "", "bullets": [] },
  "upsell": { "eyebrow": "", "headline": "", "headlineEmphasis": "", "headlineSuffix": "", "subheadline": "", "bigIdea": "" },
  "heroImagePrompt": "",
  "accentColor": ""
}
`.trim();

function buildUserPrompt(ctx: LeadAiContext): string {
  return [
    'LEAD SNAPSHOT (JSON):',
    JSON.stringify(ctx.lead, null, 2),
    '',
    'FUNNEL + CURRENT COPY (JSON):',
    JSON.stringify(ctx.funnel, null, 2),
    '',
    ctx.guidance ? `ADMIN GUIDANCE: ${ctx.guidance}` : 'ADMIN GUIDANCE: (none)',
    '',
    'Respond with ONE JSON object in EXACTLY this shape (empty string / [] where no override):',
    RESPONSE_SHAPE,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Provider plumbing (compact mirror of openai-email.ts)
// ---------------------------------------------------------------------------

type TextConfig =
  | { ok: true; provider: 'openai' | 'anthropic'; model: string; key: string }
  | { ok: false; error: string };

async function resolveTextConfig(): Promise<TextConfig> {
  const openaiKey = await getOpenAiKey();
  const anthropicKey = await getAnthropicKey();
  if (!openaiKey && !anthropicKey) return { ok: false, error: 'No AI provider key configured.' };

  const override = (await getTextModelOverride())?.trim();
  const pref = (await getTextProviderOverride())?.toLowerCase();
  if (pref === 'anthropic' && anthropicKey) {
    return { ok: true, provider: 'anthropic', model: override || DEFAULT_ANTHROPIC_MODEL, key: anthropicKey };
  }
  if (pref === 'openai' && openaiKey) {
    return { ok: true, provider: 'openai', model: override || DEFAULT_OPENAI_MODEL, key: openaiKey };
  }
  if (openaiKey) {
    return { ok: true, provider: 'openai', model: override || DEFAULT_OPENAI_MODEL, key: openaiKey };
  }
  return { ok: true, provider: 'anthropic', model: override || DEFAULT_ANTHROPIC_MODEL, key: anthropicKey! };
}

/** Parse a JSON object from a model reply, tolerating markdown fences. */
function parseJson(raw: string): unknown | null {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function callModel(system: string, user: string): Promise<
  | { ok: true; raw: string; model: string }
  | { ok: false; status: number; error: string }
> {
  const cfg = await resolveTextConfig();
  if (!cfg.ok) return { ok: false, status: 400, error: cfg.error };

  try {
    if (cfg.provider === 'anthropic') {
      const res = await fetch(`${ANTHROPIC_BASE}/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': cfg.key,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: cfg.model,
          max_tokens: 2200,
          system,
          messages: [{ role: 'user', content: user }],
        }),
      });
      if (!res.ok) {
        return { ok: false, status: res.status, error: `Anthropic error ${res.status}: ${(await res.text()).slice(0, 200)}` };
      }
      const json = (await res.json()) as { content?: { type: string; text?: string }[] };
      const raw = (json.content || []).filter((b) => b.type === 'text').map((b) => b.text || '').join('\n');
      if (!raw.trim()) return { ok: false, status: 502, error: 'Empty Anthropic reply' };
      return { ok: true, raw, model: cfg.model };
    }

    const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${cfg.key}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) {
      return { ok: false, status: res.status, error: `OpenAI error ${res.status}: ${(await res.text()).slice(0, 200)}` };
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content || '';
    if (!raw.trim()) return { ok: false, status: 502, error: 'Empty OpenAI reply' };
    return { ok: true, raw, model: cfg.model };
  } catch (err) {
    return { ok: false, status: 500, error: err instanceof Error ? err.message : 'AI call failed' };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate one lead's personalization payload. The caller (generate.ts)
 * decides WHEN (capture-time, admin regenerate) and stores the result; this
 * function only talks to the model and normalizes.
 */
export async function aiGeneratePersonalization(
  ctx: LeadAiContext,
): Promise<PersonalizeAiResult> {
  const res = await callModel(SYSTEM, buildUserPrompt(ctx));
  if (!res.ok) return { ok: false, status: res.status, error: res.error };
  const parsed = parseJson(res.raw);
  if (!parsed) {
    return { ok: false, status: 502, error: 'Model reply was not parseable JSON' };
  }
  return { ok: true, payload: normalizePayload(parsed), model: res.model };
}
