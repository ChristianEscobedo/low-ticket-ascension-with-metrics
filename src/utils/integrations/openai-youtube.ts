/**
 * YouTube publishing-kit generator (server-only). Turns a content piece into a
 * ready-to-publish kit: A/B title options, an SEO-optimized description, search
 * tags, chapter markers, and thumbnail concept prompts. Uses the same text
 * providers, key handling, and JSON-mode call pattern as openai-content.ts and
 * openai-compliance.ts, kept self-contained so it never bloats those files.
 *
 * Thumbnails here are *concepts* (a landscape image prompt + a big on-thumbnail
 * text idea). The actual image render reuses the existing image action
 * (`aiGenerateImage`) on the client, then the URL is stitched back into the kit.
 */
import {
  getTextModel,
  type TextProvider,
} from '@/lib/mothermode/content/models';
import {
  getOpenAiKey,
  getAnthropicKey,
  getMoonshotKey,
  getTextModelOverride,
  getTextProviderOverride,
} from './runtime-config';
import type {
  YouTubeChapter,
  YouTubeThumbnail,
} from '@/lib/mothermode/content/review';

export type AiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

const OPENAI_BASE = 'https://api.openai.com/v1';
const ANTHROPIC_BASE = 'https://api.anthropic.com/v1';
const MOONSHOT_BASE = 'https://api.moonshot.cn/v1';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_OPENAI = 'gpt-5.5';
const DEFAULT_ANTHROPIC = 'claude-opus-4-8';
const DEFAULT_MOONSHOT = 'kimi-k3';

const VOICE_RULES = [
  'Never use em dashes or en dashes. Use periods or commas.',
  'No NO-list words (mama, thrive, journey, hustle, empower, balance, etc.).',
  'Periods over exclamation points. No ALL CAPS for emphasis.',
  'MotherMode: mental-load systems for mothers. Specific scenes. Soft CTA. Not medical, not income, not weight-loss.',
].join(' ');

async function availableProvider(
  preferred?: string | null,
): Promise<TextProvider> {
  const [oa, an, mo] = await Promise.all([getOpenAiKey(), getAnthropicKey(), getMoonshotKey()]);
  const pref = preferred?.toLowerCase();
  if (pref === 'anthropic' && an) return 'anthropic';
  if (pref === 'openai' && oa) return 'openai';
  if (pref === 'moonshot' && mo) return 'moonshot';
  if (an) return 'anthropic';
  if (oa) return 'openai';
  if (mo) return 'moonshot';
  return 'openai';
}

async function resolveModel(requested?: string): Promise<{
  provider: TextProvider;
  model: string;
}> {
  const picked = getTextModel(requested?.trim() || undefined);
  if (picked) {
    const key =
      picked.provider === 'anthropic'
        ? await getAnthropicKey()
        : picked.provider === 'moonshot'
          ? await getMoonshotKey()
          : await getOpenAiKey();
    if (key) return { provider: picked.provider, model: picked.id };
  }
  const overrideProvider = await getTextProviderOverride();
  const overrideModel = await getTextModelOverride();
  const overridePick = getTextModel(overrideModel);
  if (overridePick) {
    const key =
      overridePick.provider === 'anthropic'
        ? await getAnthropicKey()
        : overridePick.provider === 'moonshot'
          ? await getMoonshotKey()
          : await getOpenAiKey();
    if (key) return { provider: overridePick.provider, model: overridePick.id };
  }
  const provider = await availableProvider(overrideProvider);
  return {
    provider,
    model:
      provider === 'anthropic'
        ? DEFAULT_ANTHROPIC
        : provider === 'moonshot'
          ? DEFAULT_MOONSHOT
          : DEFAULT_OPENAI,
  };
}

async function openAiJson(
  system: string,
  user: string,
  model: string,
  provider: TextProvider = 'openai',
): Promise<AiResult<string>> {
  const moonshot = provider === 'moonshot';
  const key = moonshot ? await getMoonshotKey() : await getOpenAiKey();
  if (!key)
    return { ok: false, status: 501, error: moonshot ? 'MOONSHOT_API_KEY is not configured' : 'OPENAI_API_KEY is not configured' };
  try {
    const res = await fetch(`${moonshot ? MOONSHOT_BASE : OPENAI_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
    };
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: json?.error?.message || `OpenAI failed (${res.status})`,
      };
    }
    const content = json?.choices?.[0]?.message?.content;
    if (!content)
      return { ok: false, status: 502, error: 'Empty model response' };
    return { ok: true, data: content };
  } catch {
    return { ok: false, status: 502, error: 'Could not reach OpenAI' };
  }
}

async function anthropicJson(
  system: string,
  user: string,
  model: string,
): Promise<AiResult<string>> {
  const key = await getAnthropicKey();
  if (!key)
    return {
      ok: false,
      status: 501,
      error: 'ANTHROPIC_API_KEY is not configured',
    };
  try {
    const res = await fetch(`${ANTHROPIC_BASE}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
      content?: Array<{ type?: string; text?: string }>;
    };
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: json?.error?.message || `Anthropic failed (${res.status})`,
      };
    }
    const text = (json.content ?? [])
      .filter((b) => b.type === 'text' && b.text)
      .map((b) => b.text)
      .join('\n');
    if (!text.trim())
      return { ok: false, status: 502, error: 'Empty model response' };
    return { ok: true, data: text };
  } catch {
    return { ok: false, status: 502, error: 'Could not reach Anthropic' };
  }
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const s = raw.trim();
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(s.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// YouTube kit
// ---------------------------------------------------------------------------

/** The piece context the kit is built from. */
export interface YouTubeKitPiece {
  hook: string;
  hooks?: string[];
  caption?: string;
  body?: string[];
  /** Second-by-second VO lines, when a script already exists (informs chapters). */
  script?: string[];
  theme: string;
  tone: string;
}

export interface YouTubeKitInput {
  piece: YouTubeKitPiece;
  /** Long-form runtime in seconds; drives how many chapters to plan. */
  durationSec?: number;
  /** Number of A/B title options (2-6). */
  titleCount?: number;
  /** Number of thumbnail concepts (1-4). */
  thumbnailCount?: number;
  /** Freeform extra direction (keywords to target, tone, do/don't). */
  guides?: string;
  model?: string;
}

export interface YouTubeKitResult {
  titles: string[];
  description: string;
  tags: string[];
  chapters: YouTubeChapter[];
  thumbnails: YouTubeThumbnail[];
  model: string;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function strList(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => str(x))
    .filter(Boolean)
    .slice(0, max);
}

function normalizeChapters(
  v: unknown,
  durationSec: number,
): YouTubeChapter[] {
  if (!Array.isArray(v)) return [];
  const out: YouTubeChapter[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== 'object') continue;
    const rec = raw as Record<string, unknown>;
    const title = str(rec.title);
    let startSec = Number(rec.startSec);
    if (!title) continue;
    if (!Number.isFinite(startSec) || startSec < 0) startSec = 0;
    // Clamp within the runtime when a duration is known.
    if (durationSec > 0) startSec = Math.min(startSec, durationSec);
    out.push({ startSec: Math.round(startSec), title });
  }
  out.sort((a, b) => a.startSec - b.startSec);
  // Chapters must start at 0 and be strictly increasing to be YouTube-valid.
  if (out.length > 0) {
    out[0] = { ...out[0], startSec: 0 };
    for (let i = 1; i < out.length; i++) {
      if (out[i].startSec <= out[i - 1].startSec) {
        out[i] = { ...out[i], startSec: out[i - 1].startSec + 1 };
      }
    }
  }
  return out.slice(0, 20);
}

function normalizeThumbnails(v: unknown, max: number): YouTubeThumbnail[] {
  if (!Array.isArray(v)) return [];
  const out: YouTubeThumbnail[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== 'object') continue;
    const rec = raw as Record<string, unknown>;
    const prompt = str(rec.prompt);
    if (!prompt) continue;
    out.push({
      concept: str(rec.concept) || 'Thumbnail concept',
      prompt,
      overlayText: str(rec.overlayText) || undefined,
    });
    if (out.length >= max) break;
  }
  return out;
}

function buildUser(input: YouTubeKitInput): string {
  const { piece } = input;
  const titleCount = Math.max(2, Math.min(6, input.titleCount ?? 4));
  const thumbnailCount = Math.max(1, Math.min(4, input.thumbnailCount ?? 3));
  const durationSec = Math.max(0, Math.round(input.durationSec ?? 0));
  const wantChapters = durationSec >= 120;
  const lines: string[] = [];
  lines.push('Build a complete YouTube publishing kit for this video.');
  lines.push('');
  lines.push(`Theme: ${piece.theme || '(none)'}`);
  lines.push(`Tone: ${piece.tone || '(none)'}`);
  lines.push(`Primary hook: ${piece.hook}`);
  if (piece.hooks?.length)
    lines.push(`Alt hooks: ${piece.hooks.slice(0, 6).join(' | ')}`);
  if (piece.caption) lines.push(`Caption: ${piece.caption}`);
  if (piece.body?.length)
    lines.push(`Body points:\n- ${piece.body.slice(0, 12).join('\n- ')}`);
  if (piece.script?.length)
    lines.push(
      `Script VO (for chapter timing):\n${piece.script.slice(0, 40).join('\n')}`,
    );
  if (durationSec > 0)
    lines.push(`Target runtime: ~${Math.round(durationSec / 60)} minute(s).`);
  if (input.guides) lines.push(`Extra direction: ${input.guides}`);
  lines.push('');
  lines.push('Return ONLY this JSON object (no prose, no code fences):');
  lines.push('{');
  lines.push(
    `  "titles": [${titleCount} distinct, click-worthy title options, most compelling first, <= 70 chars each, front-load the keyword, no clickbait lies],`,
  );
  lines.push(
    '  "description": "SEO description. 3-5 short paragraphs: a strong first two lines (what the viewer gets), the body value, then a soft CTA. Plain text. No links unless implied.",',
  );
  lines.push(
    '  "tags": [12-20 search tags/keywords, lowercase, no # symbol, most important first],',
  );
  if (wantChapters) {
    lines.push(
      '  "chapters": [{ "startSec": 0, "title": "Intro" }, ... 4-10 chapters spanning the runtime; first MUST be startSec 0; strictly increasing],',
    );
  } else {
    lines.push('  "chapters": [],');
  }
  lines.push(
    `  "thumbnails": [${thumbnailCount} concepts, each { "concept": "short label", "prompt": "full 16:9 landscape image-generation prompt: subject, expression, composition, background, lighting, leave negative space for text on one side", "overlayText": "3-5 word bold on-thumbnail text" }]`,
  );
  lines.push('}');
  return lines.join('\n');
}

/**
 * Generate the full YouTube kit. Returns normalized, YouTube-valid data (title
 * options, description, tags, chapters starting at 0, and thumbnail concepts).
 */
export async function generateYouTubeKit(
  input: YouTubeKitInput,
): Promise<AiResult<YouTubeKitResult>> {
  if (!input.piece?.hook?.trim())
    return { ok: false, status: 400, error: 'piece.hook is required' };
  const durationSec = Math.max(0, Math.round(input.durationSec ?? 0));
  const { provider, model } = await resolveModel(input.model);
  const system = [
    'You are a YouTube growth strategist and SEO copywriter for the MotherMode brand.',
    VOICE_RULES,
    'You write titles that earn the click honestly, descriptions that rank, and thumbnail concepts a designer can execute.',
    'Return ONLY a JSON object. No prose, no code fences.',
  ].join(' ');
  const user = buildUser(input);
  const raw =
    provider === 'anthropic'
      ? await anthropicJson(system, user, model)
      : await openAiJson(system, user, model, provider);
  if (!raw.ok) return raw;
  const parsed = parseJsonObject(raw.data);
  if (!parsed)
    return { ok: false, status: 502, error: 'No usable kit was returned' };
  const titles = strList(parsed.titles, 6);
  const description = str(parsed.description);
  if (titles.length === 0 && !description) {
    console.warn(
      `generateYouTubeKit: empty kit (model ${model}). Raw:`,
      raw.data.slice(0, 500),
    );
    return { ok: false, status: 502, error: 'No usable kit was returned' };
  }
  return {
    ok: true,
    data: {
      titles,
      description,
      tags: strList(parsed.tags, 25),
      chapters: normalizeChapters(parsed.chapters, durationSec),
      thumbnails: normalizeThumbnails(
        parsed.thumbnails,
        Math.max(1, Math.min(4, input.thumbnailCount ?? 3)),
      ),
      model,
    },
  };
}
