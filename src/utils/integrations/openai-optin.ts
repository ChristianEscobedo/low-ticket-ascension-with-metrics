/**
 * MotherMode Optin Funnel AI generator (server-only).
 *
 * From a short intake (niche, audience, magnet, offer, price) produces a full
 * set of optin + OTO + thank-you copy blocks in Editorial Warm voice.
 *
 * Mirrors openai-leadgen.ts: OpenAI JSON mode with Anthropic fallback, defensive
 * normalizers so bad replies degrade to blanks. Never import from a browser bundle.
 */
import {
  normalizeOptinOto,
  normalizeOptinPage,
  normalizeOptinThankYou,
  type OptinOtoContent,
  type OptinPageContent,
  type OptinThankYouContent,
} from '@/lib/mothermode/optin/types';
import type { OptinAiIntake } from '@/lib/mothermode/optin/aiIntake';
import { BRAND, FOUNDER } from '@/lib/mothermode/brand';
import { getTextModel, type TextProvider } from '@/lib/mothermode/content/models';
import {
  getOpenAiKey,
  getAnthropicKey,
  getMoonshotKey,
  getTextModelOverride,
  getTextProviderOverride,
} from './runtime-config';

// Re-export intake helpers so server callers can import from one place.
export type { OptinAiIntake } from '@/lib/mothermode/optin/aiIntake';
export { blankOptinAiIntake, normalizeOptinAiIntake } from '@/lib/mothermode/optin/aiIntake';

const OPENAI_BASE = 'https://api.openai.com/v1';
const ANTHROPIC_BASE = 'https://api.anthropic.com/v1';
const MOONSHOT_BASE = 'https://api.moonshot.cn/v1';
const ANTHROPIC_VERSION = '2023-06-01';

const DEFAULT_OPENAI_TEXT_MODEL = 'gpt-5.5';
const DEFAULT_ANTHROPIC_TEXT_MODEL = 'claude-opus-4-8';
const DEFAULT_MOONSHOT_TEXT_MODEL = 'kimi-k3';

export type AiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

export interface OptinAiBundle {
  name: string;
  slugHint: string;
  optin: OptinPageContent;
  oto: OptinOtoContent;
  thankyou: OptinThankYouContent;
}


// ---------------------------------------------------------------------------
// Provider plumbing (same pattern as openai-leadgen)
// ---------------------------------------------------------------------------

const VOICE_RULES = `
VOICE AND COMPLIANCE (always):
- Brand: ${BRAND.name}. Line: "${BRAND.brandLine}". Founder: ${FOUNDER.name}.
- Calm authority. Specific over clever. Lead with the reader, never the sale.
- Periods over exclamation points. No em dashes or en dashes; use commas,
  periods, or a colon.
- No hype, no false scarcity, no income/earnings claims, no medical claims.
- Banned words/phrases: thrive, mama, empower, journey, girlboss, boss babe,
  superwoman, lean in, self-care (as a fix), hustle culture praise.
- Plain, concrete language a real mother would say out loud.
- Headline may split into headline + headlineEmphasis (italic middle) + headlineSuffix.
`.trim();

type TextConfig =
  | { ok: true; provider: TextProvider; model: string; key: string }
  | { ok: false; error: string };

async function resolveTextConfig(): Promise<TextConfig> {
  const openaiKey = await getOpenAiKey();
  const anthropicKey = await getAnthropicKey();
  const moonshotKey = await getMoonshotKey();
  if (!openaiKey && !anthropicKey && !moonshotKey) {
    return { ok: false, error: 'No AI provider key configured.' };
  }

  const overrideModel = await getTextModelOverride();
  const overridePick = getTextModel(overrideModel);
  if (overridePick) {
    const key =
      overridePick.provider === 'anthropic'
        ? anthropicKey
        : overridePick.provider === 'moonshot'
          ? moonshotKey
          : openaiKey;
    if (key) return { ok: true, provider: overridePick.provider, model: overridePick.id, key };
  }

  const pref = (await getTextProviderOverride())?.toLowerCase();
  if (pref === 'anthropic' && anthropicKey) {
    return {
      ok: true,
      provider: 'anthropic',
      model: overrideModel || DEFAULT_ANTHROPIC_TEXT_MODEL,
      key: anthropicKey,
    };
  }
  if (pref === 'openai' && openaiKey) {
    return {
      ok: true,
      provider: 'openai',
      model: overrideModel || DEFAULT_OPENAI_TEXT_MODEL,
      key: openaiKey,
    };
  }
  if (pref === 'moonshot' && moonshotKey) {
    return {
      ok: true,
      provider: 'moonshot',
      model: overrideModel || DEFAULT_MOONSHOT_TEXT_MODEL,
      key: moonshotKey,
    };
  }
  if (anthropicKey) {
    return {
      ok: true,
      provider: 'anthropic',
      model: DEFAULT_ANTHROPIC_TEXT_MODEL,
      key: anthropicKey,
    };
  }
  if (moonshotKey) {
    return {
      ok: true,
      provider: 'moonshot',
      model: DEFAULT_MOONSHOT_TEXT_MODEL,
      key: moonshotKey,
    };
  }
  return { ok: true, provider: 'openai', model: DEFAULT_OPENAI_TEXT_MODEL, key: openaiKey! };
}

function parseJson<T>(raw: string): T | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function callJson<T>(system: string, user: string): Promise<AiResult<T>> {
  const cfg = await resolveTextConfig();
  if (!cfg.ok) return { ok: false, status: 400, error: cfg.error };

  try {
    let raw = '';
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
          max_tokens: 4096,
          system: `${system}\n\nReturn ONLY the JSON object. No markdown, no prose.`,
          messages: [{ role: 'user', content: user }],
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        return {
          ok: false,
          status: res.status,
          error: `Anthropic request failed (HTTP ${res.status}). ${detail.slice(0, 300)}`,
        };
      }
      const payload = (await res.json()) as { content?: Array<{ text?: string }> };
      raw = payload.content?.map((c) => c.text ?? '').join('') ?? '';
    } else {
      // Kimi (Moonshot) speaks the OpenAI-compatible chat API on its own base.
      const base = cfg.provider === 'moonshot' ? MOONSHOT_BASE : OPENAI_BASE;
      const res = await fetch(`${base}/chat/completions`, {
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
        const detail = await res.text().catch(() => '');
        return {
          ok: false,
          status: res.status,
          error: `OpenAI request failed (HTTP ${res.status}). ${detail.slice(0, 300)}`,
        };
      }
      const payload = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      raw = payload.choices?.[0]?.message?.content ?? '';
    }

    const parsed = parseJson<T>(raw);
    if (!parsed) {
      return { ok: false, status: 502, error: 'Model returned unparseable JSON.' };
    }
    return { ok: true, data: parsed };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return { ok: false, status: 500, error: message };
  }
}

// ---------------------------------------------------------------------------
// Generate full funnel
// ---------------------------------------------------------------------------

interface RawBundle {
  name?: string;
  slugHint?: string;
  optin?: unknown;
  oto?: unknown;
  thankyou?: unknown;
}

/**
 * One-shot: intake → full optin + OTO + thank-you copy.
 * Returns normalized blocks ready to drop into the editor / DB.
 */
export async function aiGenerateOptinFunnel(
  intake: OptinAiIntake,
): Promise<AiResult<OptinAiBundle>> {
  const system = `
You write lead-capture funnel copy for ${BRAND.name}.
${VOICE_RULES}

Return a single JSON object with this exact shape:
{
  "name": "short internal funnel name",
  "slugHint": "url-safe-kebab-slug",
  "optin": {
    "eyebrow": string,
    "headline": string,
    "headlineEmphasis": string,
    "headlineSuffix": string,
    "subheadline": string,
    "audience": string,
    "benefits": string[3-5],
    "ctaText": string,
    "badgeText": string,
    "magnetTitle": string,
    "magnetDescription": string,
    "coverImageUrl": "",
    "emailPlaceholder": "you@email.com",
    "namePlaceholder": "First name",
    "collectName": true,
    "privacyNote": string
  },
  "oto": {
    "enabled": true,
    "eyebrow": string,
    "headline": string,
    "subheadline": string,
    "bullets": string[3-5],
    "priceLabel": string,
    "originalPriceLabel": string,
    "ctaYes": string,
    "ctaNo": string,
    "yesHref": string,
    "timerMinutes": 15
  },
  "thankyou": {
    "headline": string,
    "subheadline": string,
    "ctaText": string,
    "ctaHref": string,
    "secondaryNote": string
  }
}

Rules for structure:
- optin is free lead magnet capture. Promise is clear and specific.
- oto is a paid upgrade offered right after optin. Soft, structural, not pushy.
- thankyou confirms delivery and points to the next step (paid offer or resource).
- yesHref and ctaHref should be paths like /mothermode/<offer-slug> when an offer is named; otherwise leave a sensible path or empty string.
- priceLabel should match the intake offer price when provided (e.g. "$27").
- Keep coverImageUrl empty.
`.trim();

  const user = `
INTAKE
- Niche / topic: ${intake.niche || '(not set)'}
- Audience: ${intake.audience || '(not set)'}
- Free magnet name: ${intake.magnetName || '(not set)'}
- Magnet promise: ${intake.magnetPromise || '(not set)'}
- Paid offer name (OTO / next step): ${intake.offerName || '(not set)'}
- Paid offer price: ${intake.offerPrice || '(not set)'}
- Tone notes: ${intake.toneNotes || '(default MotherMode calm authority)'}

Write the full funnel JSON now.
`.trim();

  const result = await callJson<RawBundle>(system, user);
  if (!result.ok) return result;

  const raw = result.data;
  const optin = normalizeOptinPage(raw.optin);
  const oto = normalizeOptinOto(raw.oto);
  const thankyou = normalizeOptinThankYou(raw.thankyou);

  // Prefer intake price/magnet when model leaves blanks.
  if (!optin.magnetTitle && intake.magnetName) optin.magnetTitle = intake.magnetName;
  if (!oto.priceLabel && intake.offerPrice) oto.priceLabel = intake.offerPrice;
  if (!oto.yesHref && intake.offerName) {
    const hint = intake.offerName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);
    if (hint) oto.yesHref = `/mothermode/${hint}`;
  }
  if (!thankyou.ctaHref && oto.yesHref) thankyou.ctaHref = oto.yesHref;

  const name =
    (typeof raw.name === 'string' && raw.name.trim()) ||
    intake.magnetName ||
    intake.niche ||
    'New optin funnel';
  const slugHint =
    (typeof raw.slugHint === 'string' && raw.slugHint.trim()) ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64);

  return {
    ok: true,
    data: { name, slugHint, optin, oto, thankyou },
  };
}
