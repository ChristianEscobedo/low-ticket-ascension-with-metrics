/**
 * AI content helpers for the MotherMode content hub. Server-only operations the
 * Edit tab calls through /api/mothermode/ai:
 *   - generateContentImage: a post visual via the OpenAI GPT Image API.
 *   - rewriteContentText: rewrite or A/B-variant a hook, caption, or body, held
 *     to the brand voice rules (no em dashes, no NO-list words). The copy is
 *     written by a frontier text model: Claude Opus by default when an
 *     ANTHROPIC_API_KEY is set, otherwise GPT-5.5 on the OpenAI key.
 * Talks to each provider directly over REST. Never import from a browser bundle.
 *
 *   - generateContentBatch: write 3-10 formatted posts/ads, or several variations
 *     of one post, all grounded in a specific offer and held to the voice rules.
 */
import type {
  ContentFormat,
  ContentKind,
  ContentPiece,
  ContentPlatform,
  ContentSlide,
  ScriptBeat,
  ToneRegister,
} from '@/lib/mothermode/content/types';
import {
  getTextModel,
  getImageModel,
  isImageModel,
  type TextProvider,
  type ImageProvider,
} from '@/lib/mothermode/content/models';
import {
  perspectiveLine,
  sophisticationLine,
  PLATFORM_NORMS,
  type AmplifyTextDimension,
  type Perspective,
  type Sophistication,
} from '@/lib/mothermode/content/amplify';
import { stripDashes } from '@/lib/mothermode/content/compliance';
import {
  getOpenAiKey,
  getAnthropicKey,
  getGoogleKey,
  getImageModelOverride,
  getTextModelOverride,
  getTextProviderOverride,
} from './runtime-config';

const OPENAI_BASE = 'https://api.openai.com/v1';
const ANTHROPIC_BASE = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const DEFAULT_IMAGE_MODEL = 'gpt-image-2';

/** Default text models per provider. Both are current frontier writers. */
const DEFAULT_OPENAI_TEXT_MODEL = 'gpt-5.5';
const DEFAULT_ANTHROPIC_TEXT_MODEL = 'claude-opus-4-8';

export type AiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

/** The three sizes the GPT Image API accepts that the hub maps formats onto. */
export type ImageSize = '1024x1024' | '1024x1536' | '1536x1024';

/** Portrait formats: vertical 9:16-ish frames. */
const PORTRAIT_FORMATS = ['story', 'reel', 'video', 'idea', 'pin'];
/** Landscape formats: wide long-form surfaces. */
const LANDSCAPE_FORMATS = ['article', 'blog', 'answer', 'thread'];

/** Map a content format to the closest GPT Image aspect. Square is the default
 *  (Instagram feed, carousel), portrait for stories/reels, landscape for blogs. */
export function imageSizeForFormat(format?: string): ImageSize {
  if (format && PORTRAIT_FORMATS.includes(format)) return '1024x1536';
  if (format && LANDSCAPE_FORMATS.includes(format)) return '1536x1024';
  return '1024x1024';
}

export interface RewriteInput {
  field: 'hook' | 'caption' | 'body';
  /** Current text. Empty means write it fresh. */
  text: string;
  /** Free-form changes the reviewer wants applied. */
  instructions?: string;
  /** When true, produce a distinct alternative rather than a reword. */
  variant?: boolean;
  context?: { theme?: string; tone?: string; platform?: string; format?: string };
  /** Optional text model id from the selector. Empty/unknown means Auto. */
  model?: string;
}

/** OpenAI key: an enabled in-app integration wins, else OPENAI_API_KEY. */
async function apiKey(): Promise<string | null> {
  return getOpenAiKey();
}

/** Anthropic key: an enabled in-app integration wins, else ANTHROPIC_API_KEY. */
async function anthropicKey(): Promise<string | null> {
  return getAnthropicKey();
}

/**
 * The text provider and model that write the copy. Defaults to Claude Opus when
 * its key is present, otherwise OpenAI. Provider and model can be overridden
 * in-app (integrations) or via MOTHERMODE_AI_TEXT_PROVIDER / _TEXT_MODEL.
 */
async function textConfig(): Promise<{ provider: TextProvider; model: string }> {
  const override = (await getTextProviderOverride())?.toLowerCase();
  const provider: TextProvider =
    override === 'openai' || override === 'anthropic'
      ? override
      : (await anthropicKey())
        ? 'anthropic'
        : 'openai';
  const model =
    (await getTextModelOverride()) ||
    (provider === 'anthropic'
      ? DEFAULT_ANTHROPIC_TEXT_MODEL
      : DEFAULT_OPENAI_TEXT_MODEL);
  return { provider, model };
}

/**
 * The text provider and model for one run. A valid requested model (from the
 * selector catalog) wins and carries its own provider. Anything else, including
 * an empty "Auto" selection, falls back to the configured textConfig().
 */
async function resolveTextModel(requested?: string): Promise<{
  provider: TextProvider;
  model: string;
}> {
  const picked = getTextModel(requested);
  if (picked) return { provider: picked.provider, model: picked.id };
  return textConfig();
}

/** The image model and provider for one run: a known requested model wins and
 *  carries its own provider, else the configured default (assumed OpenAI). */
async function resolveImageModel(
  requested?: string,
): Promise<{ provider: ImageProvider; model: string }> {
  const model = isImageModel(requested)
    ? requested
    : (await getImageModelOverride()) || DEFAULT_IMAGE_MODEL;
  return { provider: getImageModel(model)?.provider ?? 'openai', model };
}

/** The brand voice rules every rewrite must obey. See design-guide.txt. */
const VOICE_RULES = [
  'Never use em dashes or en dashes. Use periods or commas instead.',
  'Never use these words: mama, thrive, empower, journey, girlboss, hustle, elevate, grind.',
  'Write time with numerals, e.g. "5 pm", "20 minutes".',
  'Warm, direct, editorial. No hype and no emojis unless the current text already has them.',
].join(' ');

/** Generate a single post image and return it as a base64 data URL. The model
 *  is the selector's choice when valid, otherwise the env-configured default,
 *  and the provider it carries decides which image API serves the render. */
export async function generateContentImage(
  prompt: string,
  size: ImageSize,
  model?: string,
): Promise<AiResult<string>> {
  if (!prompt.trim()) return { ok: false, status: 400, error: 'A prompt is required' };
  const resolved = await resolveImageModel(model);
  return resolved.provider === 'google'
    ? generateGeminiImage(prompt, size, resolved.model)
    : generateOpenAiImage(prompt, size, resolved.model);
}

/** GPT Image render via the OpenAI images API. Model is already resolved. */
async function generateOpenAiImage(
  prompt: string,
  size: ImageSize,
  model: string,
): Promise<AiResult<string>> {
  const key = await apiKey();
  if (!key) return { ok: false, status: 501, error: 'OPENAI_API_KEY is not configured' };
  try {
    const res = await fetch(`${OPENAI_BASE}/images/generations`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model, prompt, size, n: 1 }),
    });
    const json = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: json?.error?.message || `Image generation failed (${res.status})`,
      };
    }
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) return { ok: false, status: 502, error: 'No image was returned' };
    return { ok: true, data: `data:image/png;base64,${b64}` };
  } catch (err) {
    console.error('generateOpenAiImage failed', err);
    return { ok: false, status: 502, error: 'Could not reach OpenAI' };
  }
}

/** Map an OpenAI image size onto the closest Gemini aspect-ratio hint. */
function geminiAspect(size: ImageSize): string {
  if (size === '1024x1536') return '9:16';
  if (size === '1536x1024') return '16:9';
  return '1:1';
}

/** Nano Banana render via the Gemini generateContent API. The key travels in a
 *  header (never the URL) and the image returns as inline base64. */
async function generateGeminiImage(
  prompt: string,
  size: ImageSize,
  model: string,
): Promise<AiResult<string>> {
  const key = await getGoogleKey();
  if (!key) return { ok: false, status: 501, error: 'GEMINI_API_KEY is not configured' };
  try {
    const res = await fetch(`${GEMINI_BASE}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['IMAGE'],
          imageConfig: { aspectRatio: geminiAspect(size) },
        },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: json?.error?.message || `Image generation failed (${res.status})`,
      };
    }
    const parts = json?.candidates?.[0]?.content?.parts ?? [];
    const inline = parts.find((p: any) => p?.inlineData?.data)?.inlineData;
    if (!inline?.data) return { ok: false, status: 502, error: 'No image was returned' };
    return {
      ok: true,
      data: `data:${inline.mimeType || 'image/png'};base64,${inline.data}`,
    };
  } catch (err) {
    console.error('generateGeminiImage failed', err);
    return { ok: false, status: 502, error: 'Could not reach Google' };
  }
}

/** Rewrite or A/B-variant a single copy field, held to the brand voice. The
 *  provider and model come from textConfig(); response parsing is per provider. */
export async function rewriteContentText(
  input: RewriteInput,
): Promise<AiResult<string>> {
  const fieldLabel =
    input.field === 'hook'
      ? 'scroll-stopping hook, one or two short lines'
      : input.field === 'caption'
        ? 'caption'
        : 'body copy, keeping a blank line between paragraphs';
  const c = input.context;
  const ctxLine = c
    ? `Context: platform ${c.platform ?? 'social'}, format ${c.format ?? 'post'}, tone ${c.tone ?? 'warm'}, theme "${c.theme ?? ''}".`
    : '';
  const task = input.variant
    ? `Write ONE new, distinctly different ${fieldLabel} that could A/B test against the current one. Change the angle, do not just reword.`
    : `Rewrite the following ${fieldLabel}.`;
  const changeLine = input.instructions?.trim()
    ? `Apply these requested changes: ${input.instructions.trim()}`
    : '';
  const current = input.text.trim()
    ? `Current text:\n"""\n${input.text.trim()}\n"""`
    : 'There is no current text. Write it fresh.';
  const system = `You are the MotherMode brand copywriter. MotherMode helps mothers reclaim time and offload the mental load. ${VOICE_RULES} Output ONLY the ${input.field} text. No quotes, no labels, no preamble.`;
  const user = [task, ctxLine, changeLine, current].filter(Boolean).join('\n\n');

  const { provider, model } = await resolveTextModel(input.model);
  return provider === 'anthropic'
    ? anthropicRewrite(system, user, model)
    : openAiRewrite(system, user, model);
}

/**
 * OpenAI chat-completions text call. Temperature is omitted: GPT-5 family
 * reasoning models reject a non-default value, and the variant angle is driven
 * by the prompt instead.
 */
async function openAiRewrite(
  system: string,
  user: string,
  model: string,
): Promise<AiResult<string>> {
  const key = await apiKey();
  if (!key) return { ok: false, status: 501, error: 'OPENAI_API_KEY is not configured' };
  try {
    const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    const json = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: json?.error?.message || `Rewrite failed (${res.status})`,
      };
    }
    const out = json?.choices?.[0]?.message?.content;
    if (typeof out !== 'string' || !out.trim()) {
      return { ok: false, status: 502, error: 'No text was returned' };
    }
    return { ok: true, data: stripDashes(out) };
  } catch (err) {
    console.error('openAiRewrite failed', err);
    return { ok: false, status: 502, error: 'Could not reach OpenAI' };
  }
}

/**
 * Anthropic messages text call. The system prompt goes in the top-level field
 * and temperature is omitted (Claude Opus 4.7+ rejects it). Text comes back as
 * an array of content blocks.
 */
async function anthropicRewrite(
  system: string,
  user: string,
  model: string,
): Promise<AiResult<string>> {
  const key = await anthropicKey();
  if (!key) return { ok: false, status: 501, error: 'ANTHROPIC_API_KEY is not configured' };
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
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    const json = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: json?.error?.message || `Rewrite failed (${res.status})`,
      };
    }
    const blocks = Array.isArray(json?.content) ? json.content : [];
    const out = blocks
      .filter((b: any) => b?.type === 'text')
      .map((b: any) => b.text)
      .join('')
      .trim();
    if (!out) return { ok: false, status: 502, error: 'No text was returned' };
    return { ok: true, data: stripDashes(out) };
  } catch (err) {
    console.error('anthropicRewrite failed', err);
    return { ok: false, status: 502, error: 'Could not reach Anthropic' };
  }
}

/** The offer facts injected into a batch so every claim stays accurate. */
export interface BatchOfferContext {
  name: string;
  category?: string;
  tagline?: string;
  audience?: string;
  promise?: string;
  problemPoints?: string[];
  cost?: string;
  insideOutcomes?: string[];
  priceLabel?: string;
  /** The app-relative URL every CTA in the batch routes to. */
  url: string;
}

export interface BatchInput {
  /** 'batch' = distinct posts; 'variations' = siblings of one post. */
  mode: 'batch' | 'variations';
  count: number;
  platform: ContentPlatform;
  format: ContentFormat;
  kind: ContentKind;
  tone: ToneRegister;
  theme?: string;
  guides?: string;
  offer: BatchOfferContext;
  /** Variations mode: the existing piece to riff on. When its platform differs
   *  from `platform`, the batch is treated as a cross-platform adaptation. */
  source?: ContentPiece;
  /** Optional narrative voice for the copy. */
  perspective?: Perspective;
  /** Optional market sophistication level the copy is pitched at. */
  sophistication?: Sophistication;
  /** Optional text model id from the selector. Empty/unknown means Auto. */
  model?: string;
}

/**
 * Generate a batch of formatted, offer-grounded pieces in one pass. Uses the
 * same provider/model as rewrites, in JSON mode, then validates and voice-checks
 * each piece into a real ContentPiece. Malformed pieces are dropped, not shown.
 */
export async function generateContentBatch(
  input: BatchInput,
): Promise<AiResult<{ pieces: ContentPiece[]; model: string }>> {
  const count = Math.max(1, Math.min(10, Math.round(input.count || 0)));
  const { provider, model } = await resolveTextModel(input.model);
  const system = buildBatchSystem(input);
  const user = buildBatchUser(input, count);
  const raw =
    provider === 'anthropic'
      ? await anthropicJson(system, user, model)
      : await openAiJson(system, user, model);
  if (!raw.ok) return raw;
  const pieces = normalizeBatch(raw.data, input, count);
  if (pieces.length === 0)
    return { ok: false, status: 502, error: 'No usable pieces were returned' };
  return { ok: true, data: { pieces, model } };
}

/** The brand + offer-fact system prompt that grounds the whole batch. */
function buildBatchSystem(input: BatchInput): string {
  const o = input.offer;
  const facts = [
    `Offer: ${o.name}${o.category ? ` (${o.category})` : ''}.`,
    o.tagline ? `Promise: ${o.tagline}` : '',
    o.priceLabel ? `Price: ${o.priceLabel}.` : '',
    o.audience ? `Who it is for: ${o.audience}` : '',
    o.problemPoints?.length
      ? `Pains it solves: ${o.problemPoints.join('; ')}.`
      : '',
    o.cost ? `What the problem costs her: ${o.cost}` : '',
    o.insideOutcomes?.length
      ? `Outcomes she gets: ${o.insideOutcomes.join('; ')}.`
      : '',
  ]
    .filter(Boolean)
    .join(' ');
  return [
    'You are the MotherMode brand copywriter. MotherMode helps mothers reclaim time and offload the mental load.',
    VOICE_RULES,
    'Write only about this offer, and keep every claim consistent with these facts:',
    facts,
    'Return ONLY a JSON object. No prose, no code fences.',
  ].join(' ');
}

/** The per-format field guide so the model fills the right copy fields. */
function formatFieldGuide(format: ContentFormat, kind: ContentKind): string {
  const base: Partial<Record<ContentFormat, string>> = {
    feed: 'body (2-5 short paragraphs as an array of strings)',
    article: 'body (4-8 paragraphs as an array of strings)',
    blog: 'body (6-12 paragraphs), seo {metaTitle, metaDescription, keywords[]}',
    answer:
      'body (2-4 short paragraphs), seo {metaTitle, metaDescription, keywords[], questions:[{q,a}]}',
    carousel: 'slides (4-8 items, each {text, sub, visual}), caption',
    story: 'slides (3-6 frames, each {text, sub, visual}), caption',
    idea: 'slides (4-8 pages, each {text, sub, visual}), caption',
    reel: 'script (4-7 beats, each {at, onScreen, voiceover, visual}), caption',
    video: 'script (5-8 beats, each {at, onScreen, voiceover, visual}), caption',
    thread: 'tweets (4-8 posts as an array of strings)',
    email: 'email {subject, preheader}, body (3-6 paragraphs)',
    pin: 'caption, visual',
  };
  const fields = base[format] ?? 'body (array of short paragraphs)';
  const ad =
    kind === 'ad'
      ? ' Also fill ad {primaryText, headline, description, button}.'
      : '';
  return `${fields}.${ad}`;
}

/** A compact text summary of a source piece for variations mode. */
function sourceSummary(p: ContentPiece): string {
  const lines: string[] = [];
  if (p.title) lines.push(`Title: ${p.title}`);
  if (p.theme) lines.push(`Theme: ${p.theme}`);
  if (p.hook) lines.push(`Hook: ${p.hook}`);
  if (p.caption) lines.push(`Caption: ${p.caption}`);
  if (p.body?.length) lines.push(`Body: ${p.body.join(' / ')}`);
  if (p.cta) lines.push(`CTA: ${p.cta}`);
  return lines.join('\n');
}

/** The user prompt: intent, format, theme, guides, source, and JSON shape. */
function buildBatchUser(input: BatchInput, count: number): string {
  const fmt = `platform ${input.platform}, format ${input.format}, kind ${input.kind}, tone register ${input.tone}`;
  const theme = input.theme?.trim() ? `Theme/angle: ${input.theme.trim()}.` : '';
  const guides = input.guides?.trim()
    ? `Follow these prompt guides, but the voice rules above always win: ${input.guides.trim()}`
    : '';
  const intent =
    input.mode === 'variations'
      ? `Write ${count} variations of the SAME post. Keep the core angle, change the execution each time (different opening image, rhythm, emphasis). They must read as siblings, not as ${count} unrelated posts.`
      : `Write ${count} DISTINCT posts. Each takes a different angle so together they make a varied batch, never repeating the same opening or idea.`;
  const source =
    input.mode === 'variations' && input.source
      ? `Base the variations on this existing post:\n"""\n${sourceSummary(input.source)}\n"""`
      : '';
  const adapt =
    input.source && input.source.platform !== input.platform
      ? `Adapt this post from ${input.source.platform} to ${input.platform}. Keep the core message and the MotherMode voice, but reshape the style, cultural conventions, and structure to be native to the target. ${PLATFORM_NORMS[input.platform]} Remap the format to ${input.format}.`
      : '';
  const persp = perspectiveLine(input.perspective);
  const soph = sophisticationLine(input.sophistication);
  const schema = [
    'Respond with this exact JSON shape:',
    '{ "pieces": [ { "title": string, "theme": string, "hook": string, "hooks": [string, string, string], "cta": string, "hashtags": string[], "visual": string } ] }',
    `Each piece is for ${fmt}. Fill these format-specific fields: ${formatFieldGuide(input.format, input.kind)}`,
    'Omit fields that do not apply. "title" is a short internal label. "hooks" are 3 openers to A/B, the first equal to "hook". "cta" moves her to the next step. Do not put any URL in the text; the link is added automatically.',
  ].join('\n');
  return [intent, `Each post is ${fmt}.`, theme, adapt, persp, soph, guides, source, schema]
    .filter(Boolean)
    .join('\n\n');
}

/** OpenAI chat-completions call in JSON mode. */
async function openAiJson(
  system: string,
  user: string,
  model: string,
): Promise<AiResult<string>> {
  const key = await apiKey();
  if (!key) return { ok: false, status: 501, error: 'OPENAI_API_KEY is not configured' };
  try {
    const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    const json = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: json?.error?.message || `Batch failed (${res.status})`,
      };
    }
    const out = json?.choices?.[0]?.message?.content;
    if (typeof out !== 'string' || !out.trim()) {
      return { ok: false, status: 502, error: 'No content was returned' };
    }
    return { ok: true, data: out };
  } catch (err) {
    console.error('openAiJson failed', err);
    return { ok: false, status: 502, error: 'Could not reach OpenAI' };
  }
}

/** Anthropic messages call; JSON is requested in the prompt and parsed out. */
async function anthropicJson(
  system: string,
  user: string,
  model: string,
): Promise<AiResult<string>> {
  const key = await anthropicKey();
  if (!key) return { ok: false, status: 501, error: 'ANTHROPIC_API_KEY is not configured' };
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
        max_tokens: 8000,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    const json = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: json?.error?.message || `Batch failed (${res.status})`,
      };
    }
    const blocks = Array.isArray(json?.content) ? json.content : [];
    const out = blocks
      .filter((b: any) => b?.type === 'text')
      .map((b: any) => b.text)
      .join('')
      .trim();
    if (!out) return { ok: false, status: 502, error: 'No content was returned' };
    return { ok: true, data: out };
  } catch (err) {
    console.error('anthropicJson failed', err);
    return { ok: false, status: 502, error: 'Could not reach Anthropic' };
  }
}

/** Parse a JSON object out of a raw model response, tolerant of stray text. */
function parseJsonObject(raw: string): any {
  const s = raw.trim();
  try {
    return JSON.parse(s);
  } catch {
    // fall through to bracket extraction
  }
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(s.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

/** A short, url-safe id for generated pieces. */
function randomId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  const base = uuid ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return base.replace(/-/g, '').slice(0, 10);
}

type Text = (v: unknown) => string | undefined;

const toText: Text = (v) =>
  typeof v === 'string' && v.trim() ? stripDashes(v) : undefined;

const toList = (v: unknown): string[] | undefined =>
  Array.isArray(v)
    ? v.map(toText).filter((x): x is string => !!x)
    : undefined;

/** Ensure the primary hook leads and the variant list is unique, max 3. */
function dedupeHooks(primary: string, hooks: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const h of [primary, ...hooks]) {
    const key = h.trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(h);
    }
  }
  return out.slice(0, 3);
}

function normalizeSlides(raw: unknown): ContentSlide[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ContentSlide[] = [];
  for (const s of raw) {
    if (!s || typeof s !== 'object') continue;
    const text = toText((s as any).text);
    if (!text) continue;
    out.push({ text, sub: toText((s as any).sub), visual: toText((s as any).visual) });
  }
  return out.length ? out : undefined;
}

function normalizeScript(raw: unknown): ScriptBeat[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ScriptBeat[] = [];
  for (const b of raw) {
    if (!b || typeof b !== 'object') continue;
    const at = toText((b as any).at);
    if (!at) continue;
    out.push({
      at,
      onScreen: toText((b as any).onScreen),
      voiceover: toText((b as any).voiceover),
      visual: toText((b as any).visual),
    });
  }
  return out.length ? out : undefined;
}

function normalizeQa(raw: unknown): { q: string; a: string }[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: { q: string; a: string }[] = [];
  for (const qa of raw) {
    if (!qa || typeof qa !== 'object') continue;
    const q = toText((qa as any).q);
    const a = toText((qa as any).a);
    if (q && a) out.push({ q, a });
  }
  return out.length ? out : undefined;
}

/** Validate and voice-check one raw piece into a ContentPiece, or drop it. */
function normalizePiece(
  raw: any,
  input: BatchInput,
  id: string,
): ContentPiece | null {
  if (!raw || typeof raw !== 'object') return null;
  const hooks = toList(raw.hooks);
  const hook = toText(raw.hook) ?? hooks?.[0];
  if (!hook) return null;

  const piece: ContentPiece = {
    id,
    platform: input.platform,
    format: input.format,
    kind: input.kind,
    tone: input.tone,
    theme: toText(raw.theme) ?? input.theme ?? input.offer.name,
    title: toText(raw.title) ?? `${input.offer.name} ${input.format}`,
    hook,
    cta: toText(raw.cta) ?? 'Get the system.',
    link: input.offer.url,
    generated: true,
  };

  if (hooks?.length) piece.hooks = dedupeHooks(hook, hooks);
  const body = toList(raw.body);
  if (body?.length) piece.body = body;
  const caption = toText(raw.caption);
  if (caption) piece.caption = caption;
  const tweets = toList(raw.tweets);
  if (tweets?.length) piece.tweets = tweets;
  const hashtags = toList(raw.hashtags);
  if (hashtags?.length) piece.hashtags = hashtags.map((h) => h.replace(/^#/, ''));
  const visual = toText(raw.visual);
  if (visual) piece.visual = visual;
  const slides = normalizeSlides(raw.slides);
  if (slides?.length) piece.slides = slides;
  const script = normalizeScript(raw.script);
  if (script?.length) piece.script = script;

  if (raw.email && typeof raw.email === 'object') {
    const subject = toText(raw.email.subject);
    if (subject)
      piece.email = {
        subject,
        preheader: toText(raw.email.preheader),
        from: toText(raw.email.from),
      };
  }

  if (input.kind === 'ad' && raw.ad && typeof raw.ad === 'object') {
    const primaryText = toText(raw.ad.primaryText);
    const headline = toText(raw.ad.headline);
    const button = toText(raw.ad.button);
    if (primaryText && headline && button)
      piece.ad = { primaryText, headline, description: toText(raw.ad.description), button };
  }

  if (raw.seo && typeof raw.seo === 'object') {
    const metaTitle = toText(raw.seo.metaTitle);
    const metaDescription = toText(raw.seo.metaDescription);
    if (metaTitle && metaDescription)
      piece.seo = {
        metaTitle,
        metaDescription,
        keywords: toList(raw.seo.keywords) ?? [],
        slug: toText(raw.seo.slug),
        questions: normalizeQa(raw.seo.questions),
      };
  }

  return piece;
}

/** Parse the model output and normalize up to `count` pieces. */
function normalizeBatch(
  raw: string,
  input: BatchInput,
  count: number,
): ContentPiece[] {
  const parsed = parseJsonObject(raw);
  const arr = Array.isArray(parsed?.pieces)
    ? parsed.pieces
    : Array.isArray(parsed)
      ? parsed
      : [];
  const batch = randomId();
  const out: ContentPiece[] = [];
  for (let i = 0; i < arr.length && out.length < count; i++) {
    const piece = normalizePiece(arr[i], input, `gen_${batch}_${out.length + 1}`);
    if (piece) out.push(piece);
  }
  return out;
}

/** The controls one Amplify text run is built from. */
export interface AmplifyTextInput {
  /** Which single-text dimension to multiply. */
  dimension: AmplifyTextDimension;
  count: number;
  /** The existing piece the variants are grounded in. */
  source: ContentPiece;
  perspective?: Perspective;
  sophistication?: Sophistication;
  guides?: string;
  context?: { theme?: string; tone?: string; platform?: string; format?: string };
  /** Optional text model id from the selector. Empty/unknown means Auto. */
  model?: string;
  /** Existing variants to steer away from, so a run never repeats what we have. */
  avoid?: string[];
}

/** One part of a multi-part Refine run: a dimension and how many to write. */
export interface AmplifyPart {
  dimension: AmplifyTextDimension;
  count: number;
  /** Existing items for this part to avoid repeating. */
  avoid?: string[];
}

/** The shared controls a multi-part Refine run applies to every part. */
export interface AmplifyPartsInput {
  parts: AmplifyPart[];
  source: ContentPiece;
  perspective?: Perspective;
  sophistication?: Sophistication;
  guides?: string;
  context?: { theme?: string; tone?: string; platform?: string; format?: string };
  model?: string;
}

/**
 * Run several single-text parts (hooks, angles, CTAs, bodies) in one pass,
 * each as its own JSON-mode call so the output stays clean and parsable, all
 * fired in parallel. Returns a per-dimension map of voice-checked variants and
 * the model used. A part that fails yields an empty list rather than failing
 * the whole run.
 */
export async function amplifyParts(
  input: AmplifyPartsInput,
): Promise<AiResult<{ parts: Partial<Record<AmplifyTextDimension, string[]>>; model: string }>> {
  const parts = input.parts.filter((p) => Math.round(p.count) > 0);
  if (parts.length === 0)
    return { ok: false, status: 400, error: 'Select at least one part to make' };
  const { model } = await resolveTextModel(input.model);
  const settled = await Promise.all(
    parts.map((p) =>
      amplifyContent({
        dimension: p.dimension,
        count: p.count,
        source: input.source,
        perspective: input.perspective,
        sophistication: input.sophistication,
        guides: input.guides,
        context: input.context,
        model: input.model,
        avoid: p.avoid,
      }),
    ),
  );
  const out: Partial<Record<AmplifyTextDimension, string[]>> = {};
  for (let i = 0; i < parts.length; i++) {
    const r = settled[i];
    out[parts[i].dimension] = r.ok ? r.data.items : [];
  }
  if (Object.values(out).every((items) => !items || items.length === 0))
    return { ok: false, status: 502, error: 'No usable variants were returned' };
  return { ok: true, data: { parts: out, model } };
}

/**
 * Multiply one piece into a list of single-dimension variants (hooks, angles,
 * CTAs, or full body versions) in one JSON-mode pass, held to the brand voice.
 * Returns deduped, voice-checked strings, capped at `count`.
 */
export async function amplifyContent(
  input: AmplifyTextInput,
): Promise<AiResult<{ items: string[]; model: string }>> {
  const count = Math.max(1, Math.min(10, Math.round(input.count || 0)));
  const { provider, model } = await resolveTextModel(input.model);
  const system = [
    'You are the MotherMode brand copywriter. MotherMode helps mothers reclaim time and offload the mental load.',
    VOICE_RULES,
    'Return ONLY a JSON object. No prose, no code fences.',
  ].join(' ');
  const user = buildAmplifyUser(input, count);
  const raw =
    provider === 'anthropic'
      ? await anthropicJson(system, user, model)
      : await openAiJson(system, user, model);
  if (!raw.ok) return raw;
  const items = parseAmplifyItems(raw.data);
  if (items.length === 0) {
    console.warn(
      `amplifyContent: no items parsed for ${input.dimension} (model ${model}). Raw:`,
      raw.data.slice(0, 500),
    );
    return { ok: false, status: 502, error: 'No usable variants were returned' };
  }
  return { ok: true, data: { items: items.slice(0, count), model } };
}

/** The controls one image-prompt run is built from. A version's hook leads,
 *  with theme/format and any guides shaping the scene. */
export interface ImagePromptsInput {
  count: number;
  /** The version's hook the imagery must make a viewer feel before reading. */
  hook: string;
  context?: { theme?: string; tone?: string; platform?: string; format?: string };
  guides?: string;
  /** Existing scene prompts to steer away from, so a run never repeats them. */
  avoid?: string[];
  /** Optional text model id from the selector. Empty/unknown means Auto. */
  model?: string;
}

/**
 * Stage one of the image pipeline: turn a version's hook (plus theme/format)
 * into N distinct, photographic SCENE descriptions an image model can render.
 * Each scene is object-led and free of any hook quote or on-image text, because
 * buildImagePrompt() wraps the hook and IMAGE_STYLE around it downstream.
 */
export async function amplifyImagePrompts(
  input: ImagePromptsInput,
): Promise<AiResult<{ prompts: string[]; model: string }>> {
  const count = Math.max(1, Math.min(10, Math.round(input.count || 0)));
  const { provider, model } = await resolveTextModel(input.model);
  const system = [
    'You are the MotherMode art director writing photographic scene briefs for editorial brand imagery.',
    'Scenes are quiet and object-led, lived-in and authentic, telling the story through objects, light, and atmosphere rather than literally.',
    VOICE_RULES,
    'Return ONLY a JSON object. No prose, no code fences.',
  ].join(' ');
  const user = buildImagePromptsUser(input, count);
  const raw =
    provider === 'anthropic'
      ? await anthropicJson(system, user, model)
      : await openAiJson(system, user, model);
  if (!raw.ok) return raw;
  const prompts = parseAmplifyItems(raw.data).slice(0, count);
  if (prompts.length === 0) {
    console.warn(
      `amplifyImagePrompts: no scenes parsed (model ${model}). Raw:`,
      raw.data.slice(0, 500),
    );
    return { ok: false, status: 502, error: 'No usable image prompts were returned' };
  }
  return { ok: true, data: { prompts, model } };
}

/** The user prompt for an image-prompt run: the hook, context, guides, shape. */
function buildImagePromptsUser(input: ImagePromptsInput, count: number): string {
  const c = input.context;
  const ctxLine = c
    ? `Context: platform ${c.platform ?? 'social'}, format ${c.format ?? 'post'}, tone ${c.tone ?? 'warm'}, theme "${c.theme ?? ''}".`
    : '';
  const intent = `Write ${count} distinct photographic scene descriptions for imagery that makes a viewer feel this hook before they read a word: "${input.hook.trim()}". Each scene must take a different setting, object, or moment, never a reword of another.`;
  const rules =
    "Each scene is one or two sentences describing the setting, key objects, light, and mood. No faces unless essential. No text or logos in the scene. Do not include the hook itself or any quotation in the scene text.";
  const guides = input.guides?.trim()
    ? `Follow these prompt guides, but the rules above always win: ${input.guides.trim()}`
    : '';
  const avoidList = (input.avoid ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 12);
  const avoid = avoidList.length
    ? `Do not repeat or closely paraphrase these existing scenes:\n${avoidList.map((s) => `- ${s}`).join('\n')}`
    : '';
  const shape =
    'Respond with this exact JSON shape: { "items": [string] } where each string is one scene description.';
  return [intent, rules, ctxLine, guides, avoid, shape].filter(Boolean).join('\n\n');
}

/** Per-dimension guidance for what each amplified item should be. */
const AMPLIFY_GUIDE: Record<AmplifyTextDimension, string> = {
  hooks: 'scroll-stopping hooks, one or two short lines each',
  angles:
    'distinct strategic angles on the same offer, each written as an opening line',
  ctas: 'single-line calls to action that move the reader to the next step',
  bodies:
    'full alternative body versions, each 2 to 5 short paragraphs with a blank line between paragraphs',
};

/** The user prompt for an Amplify run: intent, context, voice, source, shape. */
function buildAmplifyUser(input: AmplifyTextInput, count: number): string {
  const c = input.context;
  const ctxLine = c
    ? `Context: platform ${c.platform ?? 'social'}, format ${c.format ?? 'post'}, tone ${c.tone ?? 'warm'}, theme "${c.theme ?? ''}".`
    : '';
  const intent = `Write ${count} ${AMPLIFY_GUIDE[input.dimension]}. Each must be distinct, never a reword of another.`;
  const persp = perspectiveLine(input.perspective);
  const soph = sophisticationLine(input.sophistication);
  const guides = input.guides?.trim()
    ? `Follow these prompt guides, but the voice rules above always win: ${input.guides.trim()}`
    : '';
  const avoidList = (input.avoid ?? [])
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
  const avoid = avoidList.length
    ? `Do not repeat or closely paraphrase these existing items:\n${avoidList.map((s) => `- ${s}`).join('\n')}`
    : '';
  const source = `Amplify this existing post:\n"""\n${sourceSummary(input.source)}\n"""`;
  const shape =
    input.dimension === 'bodies'
      ? 'Respond with this exact JSON shape: { "items": [string] } where each string is one full body, paragraphs separated by a blank line.'
      : 'Respond with this exact JSON shape: { "items": [string] }. No URLs in the text.';
  return [intent, ctxLine, persp, soph, guides, avoid, source, shape]
    .filter(Boolean)
    .join('\n\n');
}

/** Keys a model might use for the variant list, in order of preference. */
const ITEM_LIST_KEYS = [
  'items',
  'variants',
  'results',
  'hooks',
  'angles',
  'ctas',
  'bodies',
  'list',
  'output',
];

/** Fields a model might wrap a single variant in, in order of preference. */
const ITEM_TEXT_KEYS = [
  'text',
  'hook',
  'cta',
  'body',
  'angle',
  'value',
  'content',
  'variant',
];

/** Find the variant list in a parsed response, tolerant of key drift. */
function pickItemsArray(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    const rec = parsed as Record<string, unknown>;
    for (const k of ITEM_LIST_KEYS) if (Array.isArray(rec[k])) return rec[k];
    const firstArray = Object.values(rec).find((v) => Array.isArray(v));
    if (Array.isArray(firstArray)) return firstArray;
  }
  return [];
}

/** Coerce one variant (a string, or an object with a text-like field) to text. */
function itemToText(v: unknown): string | undefined {
  if (typeof v === 'string') return toText(v);
  if (v && typeof v === 'object') {
    const rec = v as Record<string, unknown>;
    for (const k of ITEM_TEXT_KEYS) {
      const t = toText(rec[k]);
      if (t) return t;
    }
    for (const val of Object.values(rec)) {
      const t = toText(val);
      if (t) return t;
    }
  }
  return undefined;
}

/**
 * Parse the model output into a deduped list of voice-checked strings. Tolerant
 * of shape drift: the list may sit under items/variants/hooks/etc. (or be the
 * whole array), and each entry may be a plain string or an object wrapping one.
 */
function parseAmplifyItems(raw: string): string[] {
  const arr = pickItemsArray(parseJsonObject(raw));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of arr) {
    const t = itemToText(v);
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}
