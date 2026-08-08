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
import { styleCraftLine } from '@/lib/mothermode/content/promptStyles';
import { stripDashes } from '@/lib/mothermode/content/compliance';
import {
  getOpenAiKey,
  getAnthropicKey,
  getMoonshotKey,
  getGoogleKey,
  getImageModelOverride,
  getTextModelOverride,
  getTextProviderOverride,
} from './runtime-config';
import {
  VARIATION_BRIEF_SYSTEM,
  VARIATION_PLAN_SYSTEM,
  VARIATION_DIMENSIONS,
  variationDimensionById,
  type VariationDimensionId,
} from '@/lib/mothermode/content/variationLab';
import {
  recipeCraftBlock,
  recipeInputsBlock,
  frameworkRotation,
  rotationAssignmentLines,
  type PromptRecipe,
} from '@/lib/mothermode/content/promptBank';
import { imageRecipeCraftBlock } from '@/lib/mothermode/content/imagePromptBank';
import {
  resolveEnabledRecipes,
  resolveRecipeById,
  resolveImageRecipeById,
} from '@/lib/mothermode/content/promptBankStore';
import { AUTO_STYLE } from '@/lib/mothermode/content/promptStyles';



const OPENAI_BASE = 'https://api.openai.com/v1';
const ANTHROPIC_BASE = 'https://api.anthropic.com/v1';
const MOONSHOT_BASE = 'https://api.moonshot.cn/v1';
const ANTHROPIC_VERSION = '2023-06-01';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const DEFAULT_IMAGE_MODEL = 'gpt-image-2';

/** Default text models per provider. Both are current frontier writers. */
const DEFAULT_OPENAI_TEXT_MODEL = 'gpt-5.5';
const DEFAULT_ANTHROPIC_TEXT_MODEL = 'claude-opus-4-8';
const DEFAULT_MOONSHOT_TEXT_MODEL = 'kimi-k3';

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
  /** Optional prompt-bank framework id: restructure the text to execute it. */
  framework?: string;
  /**
   * Filled custom inputs for the framework, keyed by field id. Injected as
   * user-supplied material right after the craft block; blank values are
   * skipped and generation runs from the offer facts as before.
   */
  recipeInputs?: Record<string, string>;
}

/** OpenAI key: an enabled in-app integration wins, else OPENAI_API_KEY. */

async function apiKey(): Promise<string | null> {
  return getOpenAiKey();
}

/** Anthropic key: an enabled in-app integration wins, else ANTHROPIC_API_KEY. */
async function anthropicKey(): Promise<string | null> {
  return getAnthropicKey();
}

/** Moonshot key for the Kimi text models (env-configured). */
async function moonshotKey(): Promise<string | null> {
  return getMoonshotKey();
}

/**
 * Pick a text provider that actually has a key. Prefer Anthropic when both are
 * present (matches the historical default), otherwise OpenAI. Never return a
 * provider whose key is missing — that is the main Auto-mode failure mode when
 * an integration override points at Anthropic without a key.
 */
async function availableTextProvider(
  preferred?: string | null,
): Promise<TextProvider> {
  const [oa, an, mo] = await Promise.all([apiKey(), anthropicKey(), moonshotKey()]);
  const pref = preferred?.toLowerCase();
  if (pref === 'anthropic' && an) return 'anthropic';
  if (pref === 'openai' && oa) return 'openai';
  if (pref === 'moonshot' && mo) return 'moonshot';
  if (an) return 'anthropic';
  if (oa) return 'openai';
  if (mo) return 'moonshot';
  return 'openai';
}

/**
 * The text provider and model that write the copy when the selector is Auto.
 * Uses in-app / env overrides only when they resolve to a known catalog model
 * (or a provider that has a key). Anything unknown falls back to the frontier
 * default for the available provider so Auto never hard-fails.
 */
async function textConfig(): Promise<{ provider: TextProvider; model: string }> {
  const overrideProvider = await getTextProviderOverride();
  const overrideModel = await getTextModelOverride();

  // A known catalog model in the override wins and carries its provider — but
  // only if that provider has a key. Otherwise keep walking.
  const overridePick = getTextModel(overrideModel);
  if (overridePick) {
    const key =
      overridePick.provider === 'anthropic'
        ? await anthropicKey()
        : overridePick.provider === 'moonshot'
          ? await moonshotKey()
          : await apiKey();
    if (key) return { provider: overridePick.provider, model: overridePick.id };
  }

  const provider = await availableTextProvider(overrideProvider);
  const model =
    provider === 'anthropic'
      ? DEFAULT_ANTHROPIC_TEXT_MODEL
      : provider === 'moonshot'
        ? DEFAULT_MOONSHOT_TEXT_MODEL
        : DEFAULT_OPENAI_TEXT_MODEL;
  return { provider, model };
}

/**
 * The text provider and model for one run. A valid requested model (from the
 * selector catalog) wins and carries its own provider when its key is present.
 * Empty/"Auto"/unknown selections fall back to textConfig(). If the requested
 * model’s provider has no key, fall back rather than erroring.
 */
async function resolveTextModel(requested?: string): Promise<{
  provider: TextProvider;
  model: string;
}> {
  const picked = getTextModel(requested?.trim() || undefined);
  if (picked) {
    const key =
      picked.provider === 'anthropic'
        ? await anthropicKey()
        : picked.provider === 'moonshot'
          ? await moonshotKey()
          : await apiKey();
    if (key) return { provider: picked.provider, model: picked.id };
  }
  return textConfig();
}

/** The image model and provider for one run: a known requested model wins and
 *  carries its own provider, else a known override, else the OpenAI default. */
async function resolveImageModel(
  requested?: string,
): Promise<{ provider: ImageProvider; model: string }> {
  if (isImageModel(requested)) {
    return {
      provider: getImageModel(requested)!.provider,
      model: requested,
    };
  }
  const override = await getImageModelOverride();
  if (isImageModel(override)) {
    return {
      provider: getImageModel(override)!.provider,
      model: override,
    };
  }
  return { provider: 'openai', model: DEFAULT_IMAGE_MODEL };
}


/**
 * Full MotherMode brand voice for generation. Drawn from the brand system:
 * honest before flattering, calibrated not extreme, premium not precious,
 * generational, confident. Signature move: bold claim → calibrate → permission
 * → next step. See private/brand/mothermode-brand-system.pdf.
 */
const VOICE_RULES = [
  'Voice: a brilliant, slightly tired, deeply loving woman texting her smartest friend the truth at 11pm, with calm authority.',
  'Equation: Truth + Calibration + Permission + Mission. Signature move: bold claim, then immediate calibration, then permission, then a next step.',
  'Never use em dashes or en dashes. Use periods, commas, and short sentences instead.',
  'Periods over exclamation points. Sentence fragments are encouraged. Never ALL CAPS for emphasis. No emoji spam.',
  'Never use these words or their stems: mama, mommy, mompreneur, supermom, thrive, flourish, glow, bloom, journey, glow-up, self-care, me-time, balance, harmony, holistic, mindful, embrace, hustle, grind, girlboss, boss babe, empower, elevate, delight, unlock, leverage, optimize, solutions, innovative, cutting-edge, revolutionary, ecosystem, synergy, amazing, queen, warrior, tribe, village, hot mess, wine mom, crushing it, killing it.',
  'Never write: "you have got this", "hope you are well", "just a quick note", bath-bomb wellness, vibe/manifest language, or productivity-bro advice.',
  'Use brand idioms when they fit: the system is broken, refuse to disappear, name what you are carrying, both are true, you are allowed to want this, the work no one sees, run on MotherMode.',
  'Hard lines: never punch down at partners or other mothers; never weaponize children; never sell from fear; never apologize for ambition; enemy is the system, not people.',
  'Write time and counts with numerals, e.g. "5 pm", "20 minutes", "40 tabs".',
  'Conversational and viral, never generic content-mill copy. Specific scenes beat abstract advice. Soft CTAs, not hard sells.',
  'No hype. Warm without being soft. Sharp without being cruel.',
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

/** A decoded image ready for a provider edit call. */
export interface ImageInput {
  mime: string;
  base64: string;
  /** Filename hint for multipart uploads. */
  name: string;
}

/** Edit a seed image (with optional reference images) and return a base64 data URL. */
export async function editContentImage(
  prompt: string,
  size: ImageSize,
  seed: string,
  references: string[] = [],
  model?: string,
): Promise<AiResult<string>> {
  if (!prompt.trim()) return { ok: false, status: 400, error: 'A prompt is required' };
  if (!seed?.trim()) return { ok: false, status: 400, error: 'A seed image is required' };

  const seedImg = await resolveImageInput(seed, 'seed');
  if (!seedImg.ok) return seedImg;

  const refs: ImageInput[] = [];
  for (let i = 0; i < references.length; i++) {
    const ref = await resolveImageInput(references[i], `ref-${i + 1}`);
    if (!ref.ok) return ref;
    refs.push(ref.data);
  }

  // Prefer an edit-capable model. DALL-E 3 and unknown ids fall back to GPT Image.
  let resolved = await resolveImageModel(model);
  const supportsEdit = getImageModel(resolved.model)?.supportsEdit === true;
  if (!supportsEdit) {
    resolved = { provider: 'openai', model: DEFAULT_IMAGE_MODEL };
  }

  return resolved.provider === 'google'
    ? editGeminiImage(prompt, size, resolved.model, seedImg.data, refs)
    : editOpenAiImage(prompt, size, resolved.model, seedImg.data, refs);
}

/** Decode a data-URL or fetch a public http(s) URL into base64 + mime. */
async function resolveImageInput(
  src: string,
  label: string,
): Promise<AiResult<ImageInput>> {
  const trimmed = src.trim();
  if (!trimmed) return { ok: false, status: 400, error: `Missing ${label} image` };

  const dataMatch = trimmed.match(/^data:([^;]+);base64,(.+)$/);
  if (dataMatch) {
    const mime = dataMatch[1] || 'image/png';
    const base64 = dataMatch[2];
    if (!base64) return { ok: false, status: 400, error: `Invalid ${label} image data` };
    return {
      ok: true,
      data: {
        mime,
        base64,
        name: `${label}.${extForMime(mime)}`,
      },
    };
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    return {
      ok: false,
      status: 400,
      error: `${label} must be a data URL or http(s) image URL`,
    };
  }

  try {
    const res = await fetch(trimmed);
    if (!res.ok) {
      return {
        ok: false,
        status: 400,
        error: `Could not load ${label} image (${res.status})`,
      };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    // Cap ~12MB so edit payloads stay within provider limits.
    if (buf.byteLength > 12 * 1024 * 1024) {
      return { ok: false, status: 400, error: `${label} image is too large` };
    }
    const mime =
      res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/png';
    if (!mime.startsWith('image/')) {
      return { ok: false, status: 400, error: `${label} URL is not an image` };
    }
    return {
      ok: true,
      data: {
        mime,
        base64: buf.toString('base64'),
        name: `${label}.${extForMime(mime)}`,
      },
    };
  } catch (err) {
    console.error('resolveImageInput failed', err);
    return { ok: false, status: 502, error: `Could not load ${label} image` };
  }
}

function extForMime(mime: string): string {
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  return 'png';
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

/** GPT Image edit via multipart /images/edits. Seed is first; refs follow. */
async function editOpenAiImage(
  prompt: string,
  size: ImageSize,
  model: string,
  seed: ImageInput,
  references: ImageInput[],
): Promise<AiResult<string>> {
  const key = await apiKey();
  if (!key) return { ok: false, status: 501, error: 'OPENAI_API_KEY is not configured' };
  try {
    // GPT Image accepts multiple images; seed first so it anchors the edit.
    // Repeat the `image` field (OpenAI multipart convention for multi-image edits).
    const all = [seed, ...references];
    const buildForm = (imageField: string) => {
      const form = new FormData();
      form.append('model', model);
      form.append('prompt', prompt);
      form.append('size', size);
      form.append('n', '1');
      for (const img of all) {
        const bytes = new Uint8Array(Buffer.from(img.base64, 'base64'));
        form.append(imageField, new Blob([bytes], { type: img.mime }), img.name);
      }
      return form;
    };

    let res = await fetch(`${OPENAI_BASE}/images/edits`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}` },
      body: buildForm('image'),
    });
    let json = (await res.json().catch(() => ({}))) as any;
    // A proxy that only accepts array syntax rejects repeated `image` fields
    // ("Duplicate parameter: 'image'"). Retry once with `image[]` — self-heals.
    if (
      !res.ok &&
      all.length > 1 &&
      /duplicate parameter|only one is allowed/i.test(
        String(json?.error?.message ?? json?.message ?? ''),
      )
    ) {
      res = await fetch(`${OPENAI_BASE}/images/edits`, {
        method: 'POST',
        headers: { authorization: `Bearer ${key}` },
        body: buildForm('image[]'),
      });
      json = (await res.json().catch(() => ({}))) as any;
    }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: json?.error?.message || `Image edit failed (${res.status})`,
      };
    }
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) return { ok: false, status: 502, error: 'No image was returned' };
    return { ok: true, data: `data:image/png;base64,${b64}` };
  } catch (err) {
    console.error('editOpenAiImage failed', err);
    return { ok: false, status: 502, error: 'Could not reach OpenAI' };
  }
}

/** Gemini multi-image edit: seed + refs as inline parts, then the text prompt. */
async function editGeminiImage(
  prompt: string,
  size: ImageSize,
  model: string,
  seed: ImageInput,
  references: ImageInput[],
): Promise<AiResult<string>> {
  const key = await getGoogleKey();
  if (!key) return { ok: false, status: 501, error: 'GEMINI_API_KEY is not configured' };
  try {
    const parts: Array<Record<string, unknown>> = [
      {
        inlineData: {
          mimeType: seed.mime,
          data: seed.base64,
        },
      },
      ...references.map((r) => ({
        inlineData: {
          mimeType: r.mime,
          data: r.base64,
        },
      })),
      {
        text: [
          'Edit the first image (the seed). Any images after it are references to incorporate as described.',
          prompt,
        ].join('\n\n'),
      },
    ];
    const res = await fetch(`${GEMINI_BASE}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
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
        error: json?.error?.message || `Image edit failed (${res.status})`,
      };
    }
    const outParts = json?.candidates?.[0]?.content?.parts ?? [];
    const inline = outParts.find((p: any) => p?.inlineData?.data)?.inlineData;
    if (!inline?.data) return { ok: false, status: 502, error: 'No image was returned' };
    return {
      ok: true,
      data: `data:${inline.mimeType || 'image/png'};base64,${inline.data}`,
    };
  } catch (err) {
    console.error('editGeminiImage failed', err);
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
  const bankRecipe = await resolveRecipeById(input.framework);
  const frameworkLine = bankRecipe
    ? `Restructure the text so it executes this proven framework (keep the offer facts intact):\n${recipeCraftBlock(bankRecipe)}`
    : '';
  const inputsLine = bankRecipe
    ? recipeInputsBlock(bankRecipe, input.recipeInputs)
    : '';
  const current = input.text.trim()
    ? `Current text:\n"""\n${input.text.trim()}\n"""`
    : 'There is no current text. Write it fresh.';
  const system = `You are the MotherMode brand copywriter. MotherMode helps mothers reclaim time and offload the mental load. ${VOICE_RULES} Output ONLY the ${input.field} text. No quotes, no labels, no preamble.`;
  const user = [task, ctxLine, changeLine, frameworkLine, inputsLine, current]
    .filter(Boolean)
    .join('\n\n');


  const { provider, model } = await resolveTextModel(input.model);
  return provider === 'anthropic'
    ? anthropicRewrite(system, user, model)
    : openAiRewrite(system, user, model, provider);
}

export interface TextVariationsInput {
  /** The current editor text to multiply into alternatives. */
  text: string;
  /** The current sub / secondary line, rewritten to match each variation. */
  sub?: string;
  /** How many alternatives to return (clamped 1..10). */
  count: number;
  /** Free-form guidance applied to every variation. */
  instructions?: string;
  context?: { theme?: string; tone?: string; platform?: string; format?: string };
  /** Existing variations the model must not repeat or lightly reword. */
  avoid?: string[];
  /** Optional text model id from the selector. Empty/unknown means Auto. */
  model?: string;
}

/** One text variation: a primary line and a matching sub / second line. */
export interface TextVariation {
  text: string;
  sub: string;
}

/**
 * Rewrite one piece of plain editor text into N distinct alternatives, held to
 * the brand voice. Each alternative carries its own matching sub line so the
 * secondary text moves with the primary instead of staying fixed. Pure text
 * output for the overlay Primary-text "Variations" control — it never renders
 * or touches an image. Returns `TextVariation[]`.
 */
export async function generateTextVariations(
  input: TextVariationsInput,
): Promise<AiResult<TextVariation[]>> {
  const text = input.text.trim();
  if (!text) {
    return { ok: false, status: 400, error: 'Text is required to make variations' };
  }
  const sub = input.sub?.trim() ?? '';
  const count = Math.max(1, Math.min(10, Math.round(input.count || 3)));
  const c = input.context;
  const ctxLine = c
    ? `Context: platform ${c.platform ?? 'social'}, format ${c.format ?? 'post'}, tone ${c.tone ?? 'warm'}, theme "${c.theme ?? ''}".`
    : '';
  const changeLine = input.instructions?.trim()
    ? `Apply these requested changes to every variation: ${input.instructions.trim()}`
    : '';
  const avoidLine = input.avoid?.length
    ? `Do not repeat or lightly reword any of these existing lines: ${input.avoid
        .filter((a) => a && a.trim())
        .map((a) => `"${a.trim()}"`)
        .join('; ')}.`
    : '';
  const subGuide = sub
    ? `Each variation also needs a matching "sub" (the smaller second line). Rewrite the sub so it pairs with that variation's primary line, not the original. Keep it about the same length.`
    : `Each variation may include a short "sub" (a smaller second line) only if it strengthens that specific primary line; otherwise return "sub" as an empty string.`;
  const system = `You are the MotherMode brand copywriter. MotherMode helps mothers reclaim time and offload the mental load. ${VOICE_RULES} You rewrite one short piece of on-image or caption text into distinct alternatives, each with a matching sub line. Keep each roughly the same length and intent as the original. Return ONLY a JSON object, no prose, no code fences.`;
  const user = [
    `Rewrite the text below into ${count} distinct alternatives. Change the angle, rhythm, and wording each time. They must read as siblings of the same idea, not ${count} unrelated lines.`,
    ctxLine,
    changeLine,
    avoidLine,
    subGuide,
    `Original primary text:\n"""\n${text}\n"""`,
    sub ? `Original sub line:\n"""\n${sub}\n"""` : '',
    `Respond with this exact JSON shape: { "items": [ { "text": "...", "sub": "..." } ] } containing exactly ${count} objects. No labels, no numbering, no surrounding quotes inside the strings.`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const { provider, model } = await resolveTextModel(input.model);
  const raw =
    provider === 'anthropic'
      ? await anthropicJson(system, user, model)
      : await openAiJson(system, user, model, provider);
  if (!raw.ok) return raw;
  const items = parseVariationItems(raw.data)
    .map((v) => ({
      text: stripDashes(v.text.trim()),
      sub: stripDashes(v.sub.trim()),
    }))
    .filter((v) => v.text.length > 0)
    .slice(0, count);
  if (items.length === 0) {
    return { ok: false, status: 502, error: 'No variations were returned' };
  }
  return { ok: true, data: items };
}

/**
 * Parse a `{ items: [...] }` payload into `{ text, sub }` pairs. Tolerant of the
 * model returning bare strings (older shape) or objects with either key style.
 */
function parseVariationItems(raw: string): TextVariation[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) return [];
    try {
      parsed = JSON.parse(raw.slice(start, end + 1));
    } catch {
      return [];
    }
  }
  const container = parsed as { items?: unknown };
  const list = Array.isArray(container?.items) ? container.items : [];
  const out: TextVariation[] = [];
  for (const it of list) {
    if (typeof it === 'string') {
      out.push({ text: it, sub: '' });
    } else if (it && typeof it === 'object') {
      const o = it as Record<string, unknown>;
      const text = typeof o.text === 'string' ? o.text : '';
      const subv = typeof o.sub === 'string' ? o.sub : '';
      out.push({ text, sub: subv });
    }
  }
  return out;
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
  provider: TextProvider = 'openai',
): Promise<AiResult<string>> {
  const moonshot = provider === 'moonshot';
  const key = moonshot ? await moonshotKey() : await apiKey();
  if (!key) return { ok: false, status: 501, error: moonshot ? 'MOONSHOT_API_KEY is not configured' : 'OPENAI_API_KEY is not configured' };
  try {
    const res = await fetch(`${moonshot ? MOONSHOT_BASE : OPENAI_BASE}/chat/completions`, {
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
  /** Hero / problem scene that makes the pain concrete. */
  scene?: string;
  problemIntro?: string;
  problemPoints?: string[];
  cost?: string;
  /** Why this works when planners and apps fail. */
  mechanismLabel?: string;
  mechanism?: string;
  mechanismPoints?: string[];
  /** What is inside, as outcome-forward lines. */
  insideOutcomes?: string[];
  /** Method steps, compressed. */
  methodSteps?: string[];
  oldWay?: string[];
  newWay?: string[];
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
  /** Prompt style id from the Generate drawer. Empty/auto resolves server-side. */
  style?: string;
  /**
   * Optional image-bank recipe id (imagePromptBank.ts). When set and the
   * format is visual, every media.prompt in the batch executes that image
   * creative framework instead of the default scene brief.
   */
  imageFramework?: string;
  /**
   * Values for the explicit recipe's custom input fields (recipe.inputs),
   * keyed by field id. Filled in the Test lab or the Generate drawer when an
   * admin picks a framework that asks for real material (a story, a lesson).
   * Empty/missing values are skipped; Auto rotation never carries them.
   */
  recipeInputs?: Record<string, string>;
}

/**
 * The prompt-bank wiring for one batch: the explicit framework pick (when the
 * style id names a bank recipe) or the Auto rotation that assigns a different
 * proven framework to every piece in a distinct-posts run.
 */
export interface BatchBank {
  /** Set when `input.style` resolves to an enabled bank recipe. */
  explicit?: PromptRecipe;
  /** One framework per piece, in order, for Auto batch runs. */
  rotation: PromptRecipe[];
  /** Set when `input.imageFramework` resolves to an enabled image recipe. */
  imageRecipe?: PromptRecipe;
}

/**
 * Resolve the bank for a batch. An explicit recipe id in `style` always wins.
 * Otherwise, Auto + batch mode rotates enabled frameworks across pieces so
 * "distinct posts" means distinct proven structures, not rewords of one angle.
 * The pool comes from the DB-merged bank and degrades to the code registry.
 */
async function resolveBankForBatch(
  input: BatchInput,
  count: number,
): Promise<BatchBank> {
  const pool = await resolveEnabledRecipes();
  const styleId = input.style?.trim();
  // Text picks only: an image recipe id in `style` never shapes copy.
  const explicit =
    styleId && styleId !== AUTO_STYLE
      ? pool.find((r) => r.id === styleId && r.group !== 'image')
      : undefined;
  const imageId = input.imageFramework?.trim();
  const imageRecipe = imageId
    ? pool.find((r) => r.id === imageId && r.group === 'image')
    : undefined;
  if (explicit) return { explicit, rotation: [], imageRecipe };
  if (input.mode !== 'batch') return { rotation: [], imageRecipe };
  const frameworks = pool.filter((r) => r.group === 'framework');
  if (frameworks.length === 0) return { rotation: [], imageRecipe };
  return {
    rotation: frameworkRotation(input.platform, input.format, count, frameworks),
    imageRecipe,
  };
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
  const bank = await resolveBankForBatch(input, count);
  const system = buildBatchSystem(input);
  const user = buildBatchUser(input, count, bank);
  const raw =
    provider === 'anthropic'
      ? await anthropicJson(system, user, model)
      : await openAiJson(system, user, model, provider);
  if (!raw.ok) return raw;
  const pieces = normalizeBatch(raw.data, input, count, bank);
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
    o.promise ? `Delivery promise: ${o.promise}` : '',
    o.audience ? `Who it is for: ${o.audience}` : '',
    o.scene ? `Concrete scene from the offer page: ${o.scene}` : '',
    o.problemIntro ? `Problem frame: ${o.problemIntro}` : '',
    o.problemPoints?.length
      ? `Pains it solves: ${o.problemPoints.join('; ')}.`
      : '',
    o.cost ? `What the problem costs her: ${o.cost}` : '',
    o.mechanismLabel ? `Mechanism in one line: ${o.mechanismLabel}` : '',
    o.mechanism ? `Why it works: ${o.mechanism}` : '',
    o.mechanismPoints?.length
      ? `Mechanism steps: ${o.mechanismPoints.join('; ')}.`
      : '',
    o.insideOutcomes?.length
      ? `Outcomes she gets: ${o.insideOutcomes.join('; ')}.`
      : '',
    o.methodSteps?.length
      ? `How it works: ${o.methodSteps.join(' → ')}.`
      : '',
    o.oldWay?.length ? `The old way (contrast against): ${o.oldWay.join('; ')}.` : '',
    o.newWay?.length ? `The MotherMode way: ${o.newWay.join('; ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
  return [
    'You are the MotherMode brand copywriter writing sophisticated, modern, viral, ULTRA high-value content. Not generic social copy. Not thin captions. Conversational long-form that teaches, names, and reframes before it sells.',
    'MotherMode is Mental Load Infrastructure. Not a productivity app. Not a wellness app. The operating system for modern motherhood.',
    VOICE_RULES,
    'Write only about this offer, and keep every claim consistent with these facts from the offer page:',
    facts,
    'Quality bar (non-negotiable):',
    '1. VALUE FIRST. Lead with insight, scene, reframe, or method. The offer is the soft last step, never the whole post.',
    '2. ULTRA LONG-FORM for the format. Fill the full length ranges below. Short, thin, or listicle-lite posts fail.',
    '3. SPECIFIC. Concrete times, objects, dialogues, and body-feel. No abstract pep talks.',
    '4. STRUCTURE. Scene or hook → name the system → teach or reframe with real substance → permission → soft CTA.',
    '5. HOOK VARIANTS. Every piece needs multiple distinct openers to A/B, not rewords of one line.',
    '6. IMAGE PROMPT when the format is visual. A full photographic scene brief tied to the primary hook.',
    'Every piece must feel like it could only be MotherMode. Never content-mill filler.',
    'Return ONLY a JSON object. No prose, no code fences.',
  ].join(' ');
}

/** Formats that need a full image generation prompt on the piece. */
function needsImagePrompt(format: ContentFormat): boolean {
  return (
    format === 'feed' ||
    format === 'carousel' ||
    format === 'slideshow' ||
    format === 'story' ||
    format === 'reel' ||
    format === 'video' ||
    format === 'pin' ||
    format === 'idea' ||
    format === 'article'
  );
}

/** The per-format field guide so the model fills the right copy fields. */
function formatFieldGuide(format: ContentFormat, kind: ContentKind): string {
  const shortFormScript =
    'script (7-12 beats, each {at, onScreen, voiceover, visual}), caption (2-4 sentences of value, not a one-liner). ' +
    'Script craft: Hook in 0-3s that works with sound off via onScreen. ' +
    'Then relate with concrete open loops, reframe the system, teach one real micro-method or insight with substance, proof or what helped, soft bio CTA. ' +
    'Voiceover is spoken and conversational, long enough to feel like a real talk-to-camera piece (roughly 45-90 seconds when read aloud), not caption-speak. ' +
    'Visual notes are real light, unpolished, object-led. Soft bio CTA only on the last beat.';
  const base: Partial<Record<ContentFormat, string>> = {
    feed:
      'body (6-12 substantial paragraphs as an array of strings). Ultra long-form feed post: scene, name the load, reframe, teach, permission, soft CTA. Each paragraph 1-3 sentences. Dense value, not fluff.',
    article:
      'body (10-18 substantial paragraphs as an array of strings). Magazine-length narrative with clear arc and takeaways.',
    blog:
      'body (12-20 substantial paragraphs), seo {metaTitle, metaDescription, keywords[]}. Deep, scannable, value-forward long-form with subhead-worthy turns inside paragraphs.',
    answer:
      'body (5-10 substantial paragraphs), seo {metaTitle, metaDescription, keywords[], questions:[{q,a}] with 4-8 pairs}. Direct, citable, still human and specific.',
    carousel:
      'slides (8-12 items, each {text, sub, visual}), caption (long-form caption, 4-8 short paragraphs as one string with line breaks). Slide 1 stops the scroll; middle slides teach; final slide permission + soft CTA.',
    colorblock:
      'No body, no media. This is the native Facebook big-text-on-color post. hook is the ONLY text on the block, so make it punchy and under 130 characters (the native ceiling). Fill colorBlock: { bg: "#RRGGBB" } using one of the brand backgrounds (#532B3C aubergine, #1C1917 charcoal, #B08D57 brass, #F4F0E8 bone, #A3B18A sage, #E8B4B8 rose) and optionally gradient: ["#RRGGBB", "#RRGGBB"] for a two-stop fade. cta is one short line pointing to the comments link. Keep the hook a complete felt moment, not a fragment.',
    textpost:
      'No body, no media. This is the native viral text-overlay post: big bold text on a plain brand background, the kind that fills a reel, TikTok slide, story, or feed square. hook is the ONLY text on the screen, so keep it under 220 characters, one or two short lines, a complete felt moment with real weight. Fill textPost: { bg: "#RRGGBB" } using one of the brand backgrounds (#1C1917 charcoal, #532B3C aubergine, #B08D57 brass, #F4F0E8 bone) and aspect: "9:16" (reel/slide/story) or "1:1" (feed). cta is one short line pointing to the link.',
    tweet:
      'No body, no media. This is a Twitter screen-grab card: the tweet text IS the post, screenshot-worthy and standalone. hook is the tweet itself: under 280 characters, one sharp, plain-spoken idea a real person would screenshot and share. No hashtags in the tweet. cta is one short line pointing to the link (it lives in the surrounding caption, not the card).',
    slideshow:
      'slides (4-8 items, each {text, sub, visual}), caption (2-4 sentences, native lowercase TikTok voice), media. This is TikTok photo-mode: a swipeable multi-image post. Slide 1 is the cover that stops the scroll; each middle slide lands one concrete item, step, or truth with a short bold text (the on-slide line) and a quieter sub; the final slide is the soft bio CTA. Each slide.text is short enough to read in under 3 seconds. media.prompt is the cover-slide photographic scene (real light, lived-in, object-led, negative space up top for big text).',
    story:
      'slides (5-8 frames, each {text, sub, visual}), caption. Each frame advances a mini-arc; not decorative.',
    idea:
      'slides (8-12 pages, each {text, sub, visual}), caption. Idea-pin depth: teach a full micro-system across pages.',
    reel: shortFormScript,
    video: shortFormScript,
    thread:
      'tweets (8-15 posts as an array of strings). Numbered thread energy without sounding corporate. Each tweet advances the argument; last is soft CTA.',
    email:
      'email {subject, preheader}, body (8-14 substantial paragraphs). Confidante letter: story, insight, method, permission, one CTA.',
    pin:
      'caption (long keyword-rich but human caption, multiple short paragraphs), visual. Teach in the pin copy, not just label the image.',
  };
  const fields = base[format] ?? 'body (array of substantial paragraphs)';
  const ad =
    kind === 'ad'
      ? ' Also fill ad {primaryText (long primary text, multiple short paragraphs), headline, description, button}.'
      : '';
  const image =
    needsImagePrompt(format)
      ? ' Also fill media: { type: "image" or "video", alt: string, prompt: string } where prompt is a full photographic scene brief (setting, objects, light, mood, lens feel) engineered so the viewer feels the primary hook before reading. No on-image text, no logos, faces soft or out of frame unless essential. Object-led, lived-in, editorial.'
      : '';
  return `${fields}.${ad}${image}`;
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

/** The user prompt: intent, format, theme, guides, source, and JSON shape.
 *  When the bank assigns an explicit framework or an Auto rotation, the
 *  matching craft blocks and per-piece assignments are injected here. */
function buildBatchUser(
  input: BatchInput,
  count: number,
  bank?: BatchBank,
): string {

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
  const platformNorm = PLATFORM_NORMS[input.platform] ?? '';
  const styleLine = bank?.explicit
    ? recipeCraftBlock(bank.explicit, input.platform)
    : styleCraftLine(input.style, input.platform, input.format);
  const inputsLine = bank?.explicit
    ? recipeInputsBlock(bank.explicit, input.recipeInputs)
    : '';
  const rotationLine = bank?.rotation.length
    ? [
        'FRAMEWORK ROTATION (strict): each piece executes a DIFFERENT proven framework below, in order. Piece i must fully execute its framework structure, not just borrow its surface style.',
        rotationAssignmentLines(bank.rotation, input.platform),
      ].join('\n')
    : '';
  const visualLine =
    bank?.imageRecipe && needsImagePrompt(input.format)
      ? `VISUAL CREATIVE FRAMEWORK (strict): compose every media.prompt by executing this proven image creative framework. Anchor it to the piece's primary hook; the scene stays wordless (words are overlaid later):\n${imageRecipeCraftBlock(bank.imageRecipe, input.platform)}`
      : '';
  const persp = perspectiveLine(input.perspective);

  const soph = sophisticationLine(input.sophistication);
  const antiGeneric =
    'Anti-generic bar: no "you have got this", no bath bombs, no planner pep talks, no corporate filler. Open on a felt moment. Name the system. Teach something real. Soft CTA only at the end.';
  const valueForward =
    'Value-forward mandate: at least 70% of each piece must be insight, scene, reframe, or usable method. Product mention is brief and earned. If a reader never clicked the CTA, she should still feel smarter and more seen.';
  const lengthBar =
    'Length mandate: hit the UPPER half of every length range in the format guide. Thin posts are failures. Prefer one deep piece over a shallow one.';
  const frameworkRule = bank?.explicit
    ? `"framework" MUST be "${bank.explicit.id}" on every piece.`
    : bank?.rotation.length
      ? '"framework" is REQUIRED on every piece: the id of the rotation framework that piece executed.'
      : '';
  const schema = [
    'Respond with this exact JSON shape:',
    '{ "pieces": [ { "title": string, "theme": string, "framework": string, "hook": string, "hooks": [string, string, string, string, string], "cta": string, "hashtags": string[], "visual": string, "media": { "type": "image"|"video", "alt": string, "prompt": string } } ] }',
    `Each piece is for ${fmt}. Fill these format-specific fields: ${formatFieldGuide(input.format, input.kind)}`,
    'Omit fields that do not apply.',
    frameworkRule,
    '"title" is a short internal label.',

    '"hooks" MUST be exactly 5 distinct openers to A/B. Different angles, not rewords. The first equals "hook".',
    '"cta" moves her to the next step without stuffing a URL; the link is added automatically.',
    needsImagePrompt(input.format)
      ? '"media.prompt" is required: a complete image-generation scene brief matched to the primary hook (and usable with hook variants). "visual" is a short creative note; "media.prompt" is the full prompt.'
      : 'Skip media when the format is not visual.',
  ].join('\n');
  return [
    intent,
    `Each post is ${fmt}. ${platformNorm}`,
    theme,
    styleLine,
    inputsLine,
    rotationLine,
    visualLine,
    adapt,
    persp,
    soph,
    valueForward,
    lengthBar,
    antiGeneric,
    guides,
    source,
    schema,
  ]
    .filter(Boolean)
    .join('\n\n');
}


/** OpenAI chat-completions call in JSON mode. */
async function openAiJson(
  system: string,
  user: string,
  model: string,
  provider: TextProvider = 'openai',
): Promise<AiResult<string>> {
  const moonshot = provider === 'moonshot';
  const key = moonshot ? await getMoonshotKey() : await apiKey();
  if (!key) return { ok: false, status: 501, error: moonshot ? 'MOONSHOT_API_KEY is not configured' : 'OPENAI_API_KEY is not configured' };
  try {
    const res = await fetch(`${moonshot ? MOONSHOT_BASE : OPENAI_BASE}/chat/completions`, {
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
        // Long-form multi-piece batches need headroom (hooks + bodies + scripts + image prompts).
        max_tokens: 16000,
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

/** Ensure the primary hook leads and the variant list is unique, max 5. */
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
  return out.slice(0, 5);
}

/** Aspect class hint for generated media by format. */
function aspectForFormat(format: ContentFormat): string {
  if (
    format === 'story' ||
    format === 'reel' ||
    format === 'video' ||
    format === 'idea'
  )
    return 'aspect-[9/16]';
  if (format === 'pin') return 'aspect-[2/3]';
  if (format === 'article' || format === 'blog' || format === 'answer')
    return 'aspect-[16/9]';
  return 'aspect-square';
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

/** Validate and voice-check one raw piece into a ContentPiece, or drop it.
 *  `frameworkAssigned` is the bank assignment for this slot (explicit pick or
 *  rotation position); the model's own "framework" field wins when present. */
function normalizePiece(
  raw: any,
  input: BatchInput,
  id: string,
  frameworkAssigned?: string,
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

  // Badge the framework the piece executed (review chips + analytics compare).
  const frameworkId = toText(raw.framework) ?? frameworkAssigned;
  if (frameworkId) piece.framework = frameworkId;

  // Always store hook variants (at least the primary) so the review UI can A/B.
  piece.hooks = dedupeHooks(hook, hooks ?? []);

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

  // Image / video generation brief for visual formats.
  const mediaRaw =
    raw.media && typeof raw.media === 'object' ? (raw.media as any) : null;
  const mediaPrompt =
    toText(mediaRaw?.prompt) ??
    toText(raw.imagePrompt) ??
    toText(raw.image_prompt);
  if (mediaPrompt || needsImagePrompt(input.format)) {
    const isVideo = input.format === 'video' || input.format === 'reel';
    const type =
      mediaRaw?.type === 'video' || mediaRaw?.type === 'image'
        ? (mediaRaw.type as 'image' | 'video')
        : isVideo
          ? 'video'
          : 'image';
    piece.media = {
      type,
      alt:
        toText(mediaRaw?.alt) ??
        visual ??
        `${piece.title} visual`,
      aspect: aspectForFormat(input.format),
      prompt: mediaPrompt ?? visual,
    };
  }

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

  // FB color-block styling. Validate the bg hex; ignore malformed output.
  if (raw.colorBlock && typeof raw.colorBlock === 'object') {
    const bg = toText(raw.colorBlock.bg);
    const gradient = Array.isArray(raw.colorBlock.gradient)
      ? raw.colorBlock.gradient
          .map((g: unknown) => toText(g))
          .filter((g: string | undefined): g is string => !!g && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(g))
      : undefined;
    if (bg && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(bg)) {
      piece.colorBlock = {
        bg,
        gradient: gradient && gradient.length >= 2 ? gradient : undefined,
      };
    }
  }

  // Textpost styling. Validate the bg hex + aspect; ignore malformed output.
  if (raw.textPost && typeof raw.textPost === 'object') {
    const bg = toText(raw.textPost.bg);
    const aspect = toText(raw.textPost.aspect);
    if (bg && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(bg)) {
      piece.textPost = {
        bg,
        ...(aspect === '9:16' || aspect === '1:1' ? { aspect } : {}),
      };
    }
  }

  // Tweet screen-grab chrome. Identity overrides only; theme/flags default.
  if (raw.tweetCard && typeof raw.tweetCard === 'object') {
    const name = toText(raw.tweetCard.name);
    const handle = toText(raw.tweetCard.handle);
    const theme = toText(raw.tweetCard.theme);
    if (name || handle || theme) {
      piece.tweetCard = {
        ...(name ? { name } : {}),
        ...(handle ? { handle } : {}),
        ...(theme === 'dark' || theme === 'light' ? { theme } : {}),
      };
    }
  }

  return piece;
}

/** Parse the model output and normalize up to `count` pieces. */
function normalizeBatch(
  raw: string,
  input: BatchInput,
  count: number,
  bank?: BatchBank,
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
    const assigned = bank?.explicit?.id ?? bank?.rotation[out.length]?.id;
    const piece = normalizePiece(
      arr[i],
      input,
      `gen_${batch}_${out.length + 1}`,
      assigned,
    );
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
  /** Optional prompt-bank framework id: shape every variant through it. */
  framework?: string;
  /** Filled custom inputs for the framework, keyed by field id. */
  recipeInputs?: Record<string, string>;
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
  /** Optional prompt-bank framework id, applied to every part. */
  framework?: string;
  /** Filled custom inputs for the framework, keyed by field id. */
  recipeInputs?: Record<string, string>;
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
        framework: input.framework,
        recipeInputs: input.recipeInputs,
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
  const bankRecipe = await resolveRecipeById(input.framework);
  const user = buildAmplifyUser(input, count, bankRecipe);

  const raw =
    provider === 'anthropic'
      ? await anthropicJson(system, user, model)
      : await openAiJson(system, user, model, provider);
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
  /**
   * Optional image-bank recipe id (imagePromptBank.ts). When set, every scene
   * executes that image creative framework (FB ad structures, IG organic
   * stills, YT thumbnail frameworks).
   */
  imageFramework?: string;
  /** Filled custom inputs for the image recipe, keyed by field id. */
  recipeInputs?: Record<string, string>;
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
  const imageRecipe = await resolveImageRecipeById(input.imageFramework);
  const user = buildImagePromptsUser(input, count, imageRecipe);
  const raw =
    provider === 'anthropic'
      ? await anthropicJson(system, user, model)
      : await openAiJson(system, user, model, provider);
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
function buildImagePromptsUser(
  input: ImagePromptsInput,
  count: number,
  imageRecipe?: PromptRecipe,
): string {
  const c = input.context;
  const ctxLine = c
    ? `Context: platform ${c.platform ?? 'social'}, format ${c.format ?? 'post'}, tone ${c.tone ?? 'warm'}, theme "${c.theme ?? ''}".`
    : '';
  const intent = `Write ${count} distinct photographic scene descriptions for imagery that makes a viewer feel this hook before they read a word: "${input.hook.trim()}". Each scene must take a different setting, object, or moment, never a reword of another.`;
  const rules =
    "Each scene is one or two sentences describing the setting, key objects, light, and mood. No faces unless essential. No text or logos in the scene. Do not include the hook itself or any quotation in the scene text.";
  const frameworkLine = imageRecipe
    ? `Execute this proven image creative framework for EVERY scene (its structure and art direction, anchored to the hook; never copy the examples):\n${imageRecipeCraftBlock(imageRecipe, (input.context?.platform as ContentPlatform | undefined) ?? undefined)}`
    : '';
  const inputsLine = imageRecipe
    ? recipeInputsBlock(imageRecipe, input.recipeInputs)
    : '';
  const guides = input.guides?.trim()
    ? `Follow these prompt guides, but the rules above always win: ${input.guides.trim()}`
    : '';
  const avoidList = (input.avoid ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 12);
  const avoid = avoidList.length
    ? `Do not repeat or closely paraphrase these existing scenes:\n${avoidList.map((s) => `- ${s}`).join('\n')}`
    : '';
  const shape =
    'Respond with this exact JSON shape: { "items": [string] } where each string is one scene description.';
  return [intent, rules, frameworkLine, inputsLine, ctxLine, guides, avoid, shape]
    .filter(Boolean)
    .join('\n\n');
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

/** The user prompt for an Amplify run: intent, context, voice, source, shape.
 *  An optional bank recipe shapes every variant through one framework. */
function buildAmplifyUser(
  input: AmplifyTextInput,
  count: number,
  recipe?: PromptRecipe,
): string {

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
  const frameworkLine = recipe
    ? `Shape EVERY item through this proven framework (craft, structure, and opener energy, adapted to the source post):\n${recipeCraftBlock(recipe)}`
    : '';
  const inputsLine = recipe
    ? recipeInputsBlock(recipe, input.recipeInputs)
    : '';
  const shape =
    input.dimension === 'bodies'
      ? 'Respond with this exact JSON shape: { "items": [string] } where each string is one full body, paragraphs separated by a blank line.'
      : 'Respond with this exact JSON shape: { "items": [string] }. No URLs in the text.';
  return [intent, ctxLine, frameworkLine, inputsLine, persp, soph, guides, avoid, source, shape]
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

/** The controls one video script run is built from: the piece's existing copy,
 *  the target runtime, and any freeform production guides. */
export interface VideoScriptInput {
  piece: {
    hook: string;
    hooks?: string[];
    caption?: string;
    body?: string[];
    script?: ScriptBeat[];
    theme: string;
    tone: string;
    platform: string;
    format: string;
  };
  /** Target runtime in seconds, e.g. 15, 30, 45, 60, 90. */
  durationSec: number;
  guides?: string;
  /** Optional text model id from the selector. Empty/unknown means Auto. */
  model?: string;
}

/** One second-by-second beat of a shooting script, as returned by the model. */
export interface VideoScriptBeatOut {
  startSec: number;
  endSec: number;
  shot?: string;
  onScreen?: string;
  voiceover: string;
  action?: string;
  broll?: string;
  brollPrompt?: string;
}

/** A compact summary of the source piece's existing copy for grounding. */
function scriptSourceSummary(p: VideoScriptInput['piece']): string {
  const lines: string[] = [];
  lines.push(`Theme: ${p.theme}`);
  lines.push(`Hook: ${p.hook}`);
  if (p.hooks?.length) lines.push(`Alt hooks: ${p.hooks.join(' / ')}`);
  if (p.caption) lines.push(`Caption: ${p.caption}`);
  if (p.body?.length) lines.push(`Body: ${p.body.join(' / ')}`);
  if (p.script?.length) {
    lines.push('Existing beat notes:');
    for (const b of p.script) {
      lines.push(`  ${b.at}: ${b.voiceover ?? b.onScreen ?? b.visual ?? ''}`);
    }
  }
  return lines.join('\n');
}

/** The user prompt for a video-script run: intent, pacing rules, source, shape. */
function buildVideoScriptUser(input: VideoScriptInput): string {
  const dur = Math.max(6, Math.round(input.durationSec));
  const wordBudget = Math.round(dur * 2.4);
  const intent = `Write a complete second-by-second shooting script for a ${dur}-second ${input.piece.platform} ${input.piece.format}. This script is a production guide: someone should be able to read it and shoot the video exactly, beat by beat, with no guesswork.`;
  const pacing = [
    `Beats MUST cover 0 to ${dur} seconds with NO gaps and NO overlaps. The first beat starts at 0. The last beat ends at exactly ${dur}.`,
    'Beats are typically 2-6 seconds each. Use shorter beats for punchy hooks and cuts, longer beats for a sustained talking point.',
    `Total spoken word count across all beats should land close to ${wordBudget} words (roughly 2.2-2.5 spoken words per second), so the voiceover naturally fills the runtime without rushing or padding.`,
    'Alternate between "Talking head" beats (direct to camera) and "B-roll" beats (cutaway) where it serves the story. Not every beat needs b-roll: use it for emphasis, proof, or visual variety, not as decoration.',
    'Every B-roll beat must include: broll (a plain description of the cutaway) and brollPrompt (a complete photographic/video-still scene prompt: setting, objects, light, mood, lens feel; no on-image text, no logos, faces soft or absent unless essential; object-led and lived-in, matching an editorial documentary style).',
    'Every beat needs an exact voiceover line (the literal words to say), a shot direction, and when useful, an action (physical direction: look, gesture, prop, movement) and onScreen (a short caption overlay).',
  ].join(' ');
  const opening =
    'The first beat (0-3s) must work as a scroll-stopping hook, with on-screen text that lands even with sound off.';
  const source = `Ground the script in this existing post so the message matches:\n"""\n${scriptSourceSummary(input.piece)}\n"""`;
  const guides = input.guides?.trim()
    ? `Follow these production guides, but the rules above always win: ${input.guides.trim()}`
    : '';
  const shape = [
    'Respond with this exact JSON shape:',
    '{ "beats": [ { "startSec": number, "endSec": number, "shot": string, "onScreen": string, "voiceover": string, "action": string, "broll": string, "brollPrompt": string } ] }',
    'Omit "broll" and "brollPrompt" on talking-head beats. Numbers are seconds from the start of the video, not timestamps.',
  ].join('\n');
  return [intent, pacing, opening, source, guides, shape]
    .filter(Boolean)
    .join('\n\n');
}

/** Clamp, sort, and fill gaps in a beat list so it covers 0..durationSec with
 *  no gaps or overlaps, dropping beats too malformed to place. */
function normalizeVideoBeats(
  raw: unknown,
  durationSec: number,
): VideoScriptBeatOut[] {
  if (!Array.isArray(raw)) return [];
  const candidates: VideoScriptBeatOut[] = [];
  for (const b of raw) {
    if (!b || typeof b !== 'object') continue;
    const rec = b as Record<string, unknown>;
    const voiceover = toText(rec.voiceover);
    if (!voiceover) continue;
    let start = Number(rec.startSec);
    let end = Number(rec.endSec);
    if (!Number.isFinite(start)) start = 0;
    if (!Number.isFinite(end) || end <= start) end = start + 3;
    start = Math.max(0, Math.min(durationSec, start));
    end = Math.max(start + 0.5, Math.min(durationSec, end));
    candidates.push({
      startSec: start,
      endSec: end,
      shot: toText(rec.shot),
      onScreen: toText(rec.onScreen),
      voiceover,
      action: toText(rec.action),
      broll: toText(rec.broll),
      brollPrompt: toText(rec.brollPrompt),
    });
  }
  candidates.sort((a, b) => a.startSec - b.startSec);
  // Stitch beats end-to-end so the runtime has no gaps or overlaps: each beat's
  // end becomes the next beat's start, and the last beat is pinned to the total.
  const out: VideoScriptBeatOut[] = [];
  let cursor = 0;
  for (let i = 0; i < candidates.length; i++) {
    const b = candidates[i];
    const start = cursor;
    const isLast = i === candidates.length - 1;
    const end = isLast ? durationSec : Math.max(start + 0.5, b.endSec);
    if (end <= start) continue;
    out.push({ ...b, startSec: start, endSec: end });
    cursor = end;
  }
  if (out.length > 0) out[out.length - 1].endSec = durationSec;
  return out;
}

/**
 * Generate a full second-by-second production script for a reel/video piece:
 * exact voiceover paced to the runtime, shot direction, and (for cutaway
 * beats) a ready-to-render b-roll prompt. Beats cover the whole runtime with
 * no gaps, so the script can guide production directly.
 */
export async function generateVideoScript(
  input: VideoScriptInput,
): Promise<AiResult<{ beats: VideoScriptBeatOut[]; model: string }>> {
  const durationSec = Math.max(
    6,
    Math.min(180, Math.round(input.durationSec || 30)),
  );
  const { provider, model } = await resolveTextModel(input.model);
  const system = [
    'You are the MotherMode video producer and director, writing exact shooting scripts for reels and short-form video.',
    VOICE_RULES,
    'You write like a real production call sheet: precise timing, exact words, concrete shots. Never vague ("talk about the problem"); always literal ("say: ...").',
    'Return ONLY a JSON object. No prose, no code fences.',
  ].join(' ');
  const user = buildVideoScriptUser({ ...input, durationSec });
  const raw =
    provider === 'anthropic'
      ? await anthropicJson(system, user, model)
      : await openAiJson(system, user, model, provider);
  if (!raw.ok) return raw;
  const parsed = parseJsonObject(raw.data);
  const beats = normalizeVideoBeats(parsed?.beats, durationSec);
  if (beats.length === 0) {
    console.warn(
      `generateVideoScript: no beats parsed (model ${model}). Raw:`,
      raw.data.slice(0, 500),
    );
    return { ok: false, status: 502, error: 'No usable script was returned' };
  }
  return { ok: true, data: { beats, model } };
}

// ---------------------------------------------------------------------------
// Storyboard plan (1–4 connected cinematic contact sheets with lookback)
// ---------------------------------------------------------------------------

export interface StoryboardPlanPiece {
  hook: string;
  hooks?: string[];
  caption?: string;
  body?: string[];
  script?: ScriptBeat[];
  theme: string;
  tone: string;
  platform: string;
  format: string;
  /** Optional existing video-script b-roll notes to seed broll mode. */
  brollSeeds?: string[];
}

/**
 * One clip-sized window of a video script fed to the planner as a single board.
 * Board N renders exactly this window (a 15s or 18s video generation), so its
 * imagePrompt/videoPrompt reflect only what happens inside [startSec, endSec).
 */
export interface StoryboardSegmentInput {
  index: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  beats: Array<{
    shot?: string;
    onScreen?: string;
    voiceover: string;
    action?: string;
    broll?: string;
    brollPrompt?: string;
  }>;
}

export interface StoryboardPlanInput {
  piece: StoryboardPlanPiece;
  /** 1–6 connected boards (script-driven packs reach 6). */
  boardCount: number;
  mode: 'narrative' | 'broll';
  guides?: string;
  /** Whether a character reference image will be attached at render time. */
  hasCharacterRef?: boolean;
  /** Whether product/environment refs will be attached at render time. */
  hasReferenceImages?: boolean;
  /**
   * Where the plan is driven from. 'script' switches the planner to a
   * one-board-per-segment instruction using `segments`; 'post' (default) uses
   * the classic post-driven arc.
   */
  sourceMode?: 'post' | 'script';
  /**
   * Clip-sized script windows, one per board, when sourceMode is 'script'.
   * Board k renders segment k's beats as a single video generation.
   */
  segments?: StoryboardSegmentInput[];
  model?: string;
}



export interface StoryboardBoardOut {
  index: number;
  title: string;
  scenes: string[];
  imagePrompt: string;
  videoPrompt?: string;
  lookbackSummary: string;
  brollNotes?: string;
  /** Clip window this board renders, echoed from the source segment. */
  startSec?: number;
  endSec?: number;
  segmentDuration?: number;
}


function storyboardSourceSummary(p: StoryboardPlanPiece): string {
  const lines: string[] = [];
  lines.push(`Theme: ${p.theme}`);
  lines.push(`Hook: ${p.hook}`);
  if (p.hooks?.length) lines.push(`Alt hooks: ${p.hooks.join(' / ')}`);
  if (p.caption) lines.push(`Caption: ${p.caption}`);
  if (p.body?.length) lines.push(`Body: ${p.body.join(' / ')}`);
  if (p.script?.length) {
    lines.push('Existing script beats:');
    for (const b of p.script) {
      lines.push(`  ${b.at}: ${b.voiceover ?? b.onScreen ?? b.visual ?? ''}`);
    }
  }
  if (p.brollSeeds?.length) {
    lines.push('B-roll seeds:');
    for (const s of p.brollSeeds) lines.push(`  - ${s}`);
  }
  return lines.join('\n');
}

function buildStoryboardPlanUser(input: StoryboardPlanInput, count: number): string {
  const modeLine =
    input.mode === 'broll'
      ? `MODE: b-roll. Each board is a multi-panel contact sheet of object-led cutaways, inserts, and environmental storytelling that supports the post — not a talking-head arc. Still keep continuity of world, props, and light across boards.`
      : `MODE: narrative. Each board advances the same character through a connected cinematic arc of the post's message. Board 1 opens; later boards escalate and resolve.`;
  const intent = `Plan exactly ${count} connected cinematic multi-panel storyboard contact sheet(s) for a ${input.piece.platform} ${input.piece.format}. Someone should be able to feed each board's imagePrompt into an image model and get a premium production contact sheet.`;
  const continuity = [

    'LOOKBACK / CONTINUITY (STRICT):',
    'Board 1 has no prior lookback; it establishes character, wardrobe, primary environment, and emotional baseline.',
    'For board k (k>1), you MUST continue from board k-1. Read prior lookbackSummary values as locked facts. Do not reset wardrobe, face, or world. Evolve location, emotion, and action naturally.',
    'Each board.lookbackSummary must state what THIS board locked for the next board (character state, environment, props, emotional beat) in 2-4 sentences.',
  ].join('\n');
  const refs = [
    input.hasCharacterRef
      ? 'A CHARACTER REFERENCE image will be attached at render time. Write imagePrompt assuming that exact person appears in every panel.'
      : 'No character reference image. Invent one consistent real-world character and lock their description in board 1 lookback and every imagePrompt.',
    input.hasReferenceImages
      ? 'PRODUCT / ENVIRONMENT reference images will be attached at render time. Call for integrating those refs faithfully in every imagePrompt.'
      : '',
  ]
    .filter(Boolean)
    .join(' ');
  const promptRules = [
    'imagePrompt rules:',
    '- Write a COMPLETE board-specific direction block (scene titles, actions, environments, camera mix, emotional arc for THIS board only).',
    '- Do NOT repeat the global cinematic system manifesto; a fixed system prompt is prepended at render time.',
    '- Include 4-8 distinct panel ideas inside the prompt text.',
    '- End imagePrompt with a short "VIDEO PROMPT FOR THIS STORYBOARD:" subsection (cinematography, movement, lighting, pacing, transitions).',
    '- Also put that production block alone in videoPrompt.',
    '- scenes[] is a short list of panel one-liners matching the prompt.',
  ].join('\n');
  const source = `Ground every board in this post:\n"""\n${storyboardSourceSummary(input.piece)}\n"""`;
  const guides = input.guides?.trim()
    ? `Production guides (voice and continuity still win): ${input.guides.trim()}`
    : '';
  // Script-driven: one board per clip-sized segment. Each board renders exactly
  // its window's beats as a single 15s/18s video generation.
  const segmentBlock =
    input.sourceMode === 'script' && input.segments?.length
      ? buildStoryboardSegmentBlock(input.segments)
      : '';
  const shape = [
    'Respond with this exact JSON shape:',
    `{ "boards": [ { "index": number, "title": string, "scenes": [string], "imagePrompt": string, "videoPrompt": string, "lookbackSummary": string, "brollNotes": string } ] }`,
    `Return exactly ${count} boards with index 1..${count} in order. Omit brollNotes unless mode is broll.`,
  ].join('\n');
  return [intent, modeLine, continuity, refs, promptRules, source, segmentBlock, guides, shape]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Build the one-board-per-segment instruction: board k renders segment k's clip
 * window and is composed only from that window's beats, so its imagePrompt and
 * videoPrompt cover exactly that clip. Lookback still carries continuity across
 * all segments.
 */
function buildStoryboardSegmentBlock(segments: StoryboardSegmentInput[]): string {
  const lines: string[] = [
    'SCRIPT SEGMENTS (ONE BOARD PER SEGMENT):',
    `This storyboard is driven by a video script. There is exactly one board per segment (${segments.length} total). Board k renders segment k as a SINGLE video generation.`,
    'For each board:',
    "- Compose the contact sheet ONLY from that segment's beats below (voiceover, on-screen, shot, action, b-roll).",
    '- The videoPrompt MUST be a shootable clip direction for that segment length only (its start-to-end window), not the whole video.',
    '- Keep character, wardrobe, and world congruent with the other segments via lookbackSummary.',
  ];
  for (const seg of segments) {
    lines.push(
      `\nSegment ${seg.index} · covers ${seg.startSec}-${seg.endSec}s (${seg.durationSec}s clip):`,
    );
    if (!seg.beats.length) {
      lines.push('  (no beats in this window; extend the prior beat visually.)');
      continue;
    }
    seg.beats.forEach((b, i) => {
      const parts: string[] = [];
      if (b.shot) parts.push(`shot: ${b.shot}`);
      if (b.onScreen) parts.push(`on-screen: ${b.onScreen}`);
      parts.push(`VO: ${b.voiceover}`);
      if (b.action) parts.push(`action: ${b.action}`);
      if (b.broll) parts.push(`b-roll: ${b.broll}`);
      if (b.brollPrompt) parts.push(`b-roll prompt: ${b.brollPrompt}`);
      lines.push(`  ${i + 1}. ${parts.join(' | ')}`);
    });
  }
  return lines.join('\n');
}



function normalizeStoryboardBoards(

  raw: unknown,
  count: number,
  segments?: StoryboardSegmentInput[],
): StoryboardBoardOut[] {
  if (!Array.isArray(raw)) return [];
  const out: StoryboardBoardOut[] = [];
  for (let i = 0; i < raw.length && out.length < count; i++) {
    const b = raw[i];
    if (!b || typeof b !== 'object') continue;
    const rec = b as Record<string, unknown>;
    const imagePrompt = toText(rec.imagePrompt);
    const lookbackSummary = toText(rec.lookbackSummary);
    if (!imagePrompt || !lookbackSummary) continue;
    const scenes = toList(rec.scenes) ?? [];
    const index = out.length + 1;
    // Echo the clip window from the matching source segment (script-driven),
    // so a board always knows exactly which 15s/18s clip it renders.
    const seg = segments?.find((s) => s.index === index) ?? segments?.[index - 1];
    out.push({
      index,
      title: toText(rec.title) ?? `Board ${index}`,
      scenes: scenes.length ? scenes : [imagePrompt.slice(0, 120)],
      imagePrompt,
      videoPrompt: toText(rec.videoPrompt),
      lookbackSummary,
      brollNotes: toText(rec.brollNotes),
      startSec: seg?.startSec,
      endSec: seg?.endSec,
      segmentDuration: seg?.durationSec,
    });
  }
  return out;
}


/**
 * Plan 1–4 connected cinematic storyboard contact sheets for a content piece.
 * Board N is written with explicit lookback from boards 1..N-1 so the arc
 * continues without resetting character or world.
 */
export async function generateStoryboardPlan(
  input: StoryboardPlanInput,
): Promise<AiResult<{ boards: StoryboardBoardOut[]; model: string }>> {
  const count = Math.max(1, Math.min(6, Math.round(input.boardCount || 1)));
  const { provider, model } = await resolveTextModel(input.model);
  const system = [
    'You are the MotherMode film director and storyboard artist planning premium cinematic multi-panel contact sheets for social and commercial production.',
    VOICE_RULES,
    'Expand minimal post copy into production-grade scene direction. Be concrete: props, light sources, lens feel, wardrobe, emotion.',
    'Never generic stock poses. Never symmetrical boring grids in the written direction.',
    'Return ONLY a JSON object. No prose, no code fences.',
  ].join(' ');
  const user = buildStoryboardPlanUser(input, count);
  const raw =
    provider === 'anthropic'
      ? await anthropicJson(system, user, model)
      : await openAiJson(system, user, model, provider);
  if (!raw.ok) return raw;
  const parsed = parseJsonObject(raw.data);
  const boards = normalizeStoryboardBoards(parsed?.boards, count, input.segments);
  if (boards.length === 0) {
    console.warn(
      `generateStoryboardPlan: no boards parsed (model ${model}). Raw:`,
      raw.data.slice(0, 500),
    );
    return { ok: false, status: 502, error: 'No usable storyboard was returned' };
  }
  return { ok: true, data: { boards, model } };
}

// ---------------------------------------------------------------------------
// Frame pack plan (carousel / story / idea ordered slides)
// ---------------------------------------------------------------------------

export interface FramePackPlanPiece {
  hook: string;
  hooks?: string[];
  caption?: string;
  body?: string[];
  theme: string;
  tone: string;
  platform: string;
  format: string;
  /** Existing catalog slides when present. */
  slides?: Array<{ text?: string; sub?: string; visual?: string }>;
}

export interface FramePackPlanInput {
  piece: FramePackPlanPiece;
  /** 2–10 frames. */
  slideCount: number;
  /** frames = N separate images; strip = one multi-panel board to split. */
  mode: 'frames' | 'strip';
  aspect?: '1:1' | '4:5' | '9:16';
  guides?: string;
  model?: string;
}

export interface FramePackFrameOut {
  index: number;
  role: string;
  text?: string;
  sub?: string;
  visual?: string;
  prompt: string;
  lookbackSummary: string;
}

function framePackSourceSummary(p: FramePackPlanPiece): string {
  const lines: string[] = [];
  lines.push(`Theme: ${p.theme}`);
  lines.push(`Tone: ${p.tone}`);
  lines.push(`Hook: ${p.hook}`);
  if (p.hooks?.length) lines.push(`Alt hooks: ${p.hooks.join(' / ')}`);
  if (p.caption) lines.push(`Caption: ${p.caption}`);
  if (p.body?.length) lines.push(`Body: ${p.body.join(' / ')}`);
  if (p.slides?.length) {
    lines.push('Existing slides:');
    p.slides.forEach((s, i) => {
      lines.push(
        `  ${i + 1}. ${s.text ?? ''}${s.sub ? ` | ${s.sub}` : ''}${s.visual ? ` [${s.visual}]` : ''}`,
      );
    });
  }
  return lines.join('\n');
}

function buildFramePackPlanUser(
  input: FramePackPlanInput,
  count: number,
): string {
  const aspect =
    input.aspect ??
    (input.piece.format === 'story' || input.piece.format === 'idea'
      ? '9:16'
      : '1:1');
  const format = input.piece.format;
  const isStory = format === 'story' || format === 'idea';
  const isCarousel = format === 'carousel';
  const modeLine =
    input.mode === 'strip'
      ? `MODE: strip. You are designing ONE multi-panel contact strip that will be split into ${count} equal panels. Each frame.prompt still describes its panel, and systemNotes must describe the shared strip layout (gutters, shared baseline, panel order left-to-right).`
      : `MODE: frames. You are designing ${count} SEPARATE postable images that share one visual system. Frame 1 establishes; later frames continue via lookback.`;
  const arc = isStory
    ? 'STORY / IDEA arc: Frame 1 = scroll-stop hook (safe zones top and bottom for UI). Middle = proof or reframe. Last = permission + soft CTA. One clear beat per frame. Vertical 9:16.'
    : isCarousel
      ? 'CAROUSEL arc: Frame 1 = cover/scroll-stop. Middle slides stack truth one beat at a time (short enough to read in under 3 seconds). Final = permission + soft CTA. Shared margins, type zone, and accent language across all slides.'
      : 'Multi-frame arc: open strong, develop, close with a soft next step.';
  const intent = `Plan exactly ${count} ordered frames for a ${input.piece.platform} ${format} (${aspect}). Someone should feed each frame.prompt into an image model and get a postable still that matches the slide job.`;
  const continuity = [
    'LOOKBACK / CONTINUITY (STRICT):',
    'Frame 1 establishes palette, light direction, subject/world, margins, and type-safe zone. lookbackSummary locks those facts.',
    'Frame k (k>1) MUST continue from prior lookbackSummary values. Same visual system; only the narrative beat and focal composition change.',
    'Each lookbackSummary is 1-3 sentences of what THIS frame locked for the next.',
  ].join('\n');
  const promptRules = [
    'prompt rules (each frame.prompt):',
    `- Complete scene direction for a single ${aspect} still: subject, setting, light, lens/mood, negative space for type, what to avoid.`,
    '- Prefer object-led, lived-in editorial photography. No logos. No tiny illegible text baked in (leave clean headline space).',
    '- Mention shared system: consistent margins, type zone, color grade.',
    '- text/sub are the on-slide words the designer may burn later; keep them short.',
    '- role is one of: cover, hook, proof, reframe, cta, other.',
  ].join('\n');
  const source = `Ground every frame in this post:\n"""\n${framePackSourceSummary(input.piece)}\n"""`;
  const guides = input.guides?.trim()
    ? `Production guides (voice and continuity still win): ${input.guides.trim()}`
    : '';
  const shape = [
    'Respond with this exact JSON shape:',
    `{ "systemNotes": string, "frames": [ { "index": number, "role": string, "text": string, "sub": string, "visual": string, "prompt": string, "lookbackSummary": string } ] }`,
    `Return exactly ${count} frames with index 1..${count} in order. systemNotes is shared design system (margins, palette, type zone).`,
  ].join('\n');
  return [intent, modeLine, arc, continuity, promptRules, source, guides, shape]
    .filter(Boolean)
    .join('\n\n');
}

function normalizeFramePackFrames(
  raw: unknown,
  count: number,
): FramePackFrameOut[] {
  if (!Array.isArray(raw)) return [];
  const out: FramePackFrameOut[] = [];
  for (let i = 0; i < raw.length && out.length < count; i++) {
    const b = raw[i];
    if (!b || typeof b !== 'object') continue;
    const rec = b as Record<string, unknown>;
    const prompt = toText(rec.prompt);
    const lookbackSummary = toText(rec.lookbackSummary) ?? '';
    if (!prompt) continue;
    const index = out.length + 1;
    out.push({
      index,
      role: toText(rec.role) ?? (index === 1 ? 'cover' : index === count ? 'cta' : 'proof'),
      text: toText(rec.text),
      sub: toText(rec.sub),
      visual: toText(rec.visual),
      prompt,
      lookbackSummary:
        lookbackSummary ||
        `Frame ${index} established the beat and visual system for continuity.`,
    });
  }
  return out;
}

/**
 * Plan an ordered multi-slide pack for carousel, story, or idea pins.
 * Frames include role, on-slide copy, image prompts, and lookback continuity.
 */
export async function generateFramePackPlan(
  input: FramePackPlanInput,
): Promise<
  AiResult<{
    frames: FramePackFrameOut[];
    systemNotes?: string;
    model: string;
  }>
> {
  const count = Math.max(2, Math.min(10, Math.round(input.slideCount || 5)));
  const { provider, model } = await resolveTextModel(input.model);
  const system = [
    'You are the MotherMode multi-slide art director planning carousel slides and story frames for social.',
    VOICE_RULES,
    'Design ordered frame packs with shared visual systems and clear narrative jobs per slide.',
    'Be concrete: props, light, negative space for type, continuity across frames.',
    'Return ONLY a JSON object. No prose, no code fences.',
  ].join(' ');
  const user = buildFramePackPlanUser(input, count);
  const raw =
    provider === 'anthropic'
      ? await anthropicJson(system, user, model)
      : await openAiJson(system, user, model, provider);
  if (!raw.ok) return raw;
  const parsed = parseJsonObject(raw.data);
  const frames = normalizeFramePackFrames(parsed?.frames, count);
  if (frames.length === 0) {
    console.warn(
      `generateFramePackPlan: no frames parsed (model ${model}). Raw:`,
      raw.data.slice(0, 500),
    );
    return { ok: false, status: 502, error: 'No usable frame pack was returned' };
  }
  return {
    ok: true,
    data: {
      frames,
      systemNotes: toText(parsed?.systemNotes),
      model,
    },
  };
}

// ---------------------------------------------------------------------------
// Variation Lab: brief → prompts, and dimension-based edit plans
// ---------------------------------------------------------------------------

export interface VariationBriefInput {

  brief: string;
  platform?: string;
  format?: string;
  hook?: string;
  theme?: string;
  tone?: string;
  /** Number of alternate single-image prompts (1–6). Default 3. */
  altCount?: number;
  /**
   * When > 1, also return an ordered frame pack for carousel/story.
   * 0 or 1 = single-image mode only.
   */
  frameCount?: number;
  guides?: string;
  model?: string;
  /**
   * Optional image-bank recipe id (imagePromptBank.ts). When set, the master,
   * alt, and frame prompts all execute that image creative framework.
   */
  imageFramework?: string;
  /** Filled custom inputs for the image recipe, keyed by field id. */
  recipeInputs?: Record<string, string>;
}

export interface VariationFrameOut {
  index: number;
  role: string;
  prompt: string;
}

export interface VariationBriefOut {
  masterPrompt: string;
  altPrompts: string[];
  frames: VariationFrameOut[];
  model: string;
}

export interface VariationPlanInput {
  /** Selected dimension ids. */
  dimensions: string[];
  /** Variants to write per dimension (1–4). */
  perDimension?: number;
  /** Optional description of the seed / scene. */
  seedDescription?: string;
  platform?: string;
  format?: string;
  hook?: string;
  theme?: string;
  guides?: string;
  model?: string;
}

export interface VariationPlanItemOut {
  id: string;
  dimension: VariationDimensionId | string;
  label: string;
  /** Imperative edit instruction for imageEdit. */
  editPrompt: string;
}

export interface VariationPlanOut {
  items: VariationPlanItemOut[];
  model: string;
}

function buildVariationBriefUser(
  input: VariationBriefInput,
  imageRecipe?: PromptRecipe,
): string {
  const altCount = Math.max(1, Math.min(6, Math.round(input.altCount ?? 3)));
  const frameCount = Math.max(0, Math.min(10, Math.round(input.frameCount ?? 0)));
  const multi = frameCount > 1;
  const lines = [
    `Convert this creative brief into image prompts for ${input.platform ?? 'instagram'} ${input.format ?? 'feed'}.`,
    `Brief:\n"""\n${input.brief.trim()}\n"""`,
  ];
  if (imageRecipe) {
    lines.push(
      `Execute this proven image creative framework for the masterPrompt, every altPrompt, and every frame (its structure and art direction; never copy the examples):\n${imageRecipeCraftBlock(imageRecipe, (input.platform as ContentPlatform | undefined) ?? undefined)}`,
    );
    const inputsBlock = recipeInputsBlock(imageRecipe, input.recipeInputs);
    if (inputsBlock) lines.push(inputsBlock);
  }
  if (input.hook?.trim()) lines.push(`Primary hook: ${input.hook.trim()}`);
  if (input.theme?.trim()) lines.push(`Theme: ${input.theme.trim()}`);
  if (input.tone?.trim()) lines.push(`Tone: ${input.tone.trim()}`);
  if (input.guides?.trim()) lines.push(`Extra guides: ${input.guides.trim()}`);
  lines.push(
    `Return exactly 1 masterPrompt (best single render) and ${altCount} altPrompts (distinct scene alternatives for A/B).`,
  );
  if (multi) {
    lines.push(
      `Also return frames[] with exactly ${frameCount} ordered items for a ${input.format} set. Each frame has index 1..${frameCount}, role (e.g. cover, proof, reframe, cta), and prompt. Shared visual system across frames; each frame has one clear job.`,
    );
  } else {
    lines.push('Set frames to an empty array.');
  }
  lines.push(
    'JSON shape:',
    '{ "masterPrompt": string, "altPrompts": [string], "frames": [ { "index": number, "role": string, "prompt": string } ] }',
  );
  return lines.join('\n\n');
}

/**
 * Turn a short creative brief into a master image prompt, alt prompts, and
 * optional carousel/story frame pack.
 */
export async function generateVariationBrief(
  input: VariationBriefInput,
): Promise<AiResult<VariationBriefOut>> {
  const brief = input.brief?.trim();
  if (!brief) return { ok: false, status: 400, error: 'A brief is required' };
  const altCount = Math.max(1, Math.min(6, Math.round(input.altCount ?? 3)));
  const frameCount = Math.max(0, Math.min(10, Math.round(input.frameCount ?? 0)));
  const { provider, model } = await resolveTextModel(input.model);
  const system = [VARIATION_BRIEF_SYSTEM, VOICE_RULES].join(' ');
  const imageRecipe = await resolveImageRecipeById(input.imageFramework);
  const user = buildVariationBriefUser(
    { ...input, altCount, frameCount },
    imageRecipe,
  );
  const raw =
    provider === 'anthropic'
      ? await anthropicJson(system, user, model)
      : await openAiJson(system, user, model, provider);
  if (!raw.ok) return raw;
  const parsed = parseJsonObject(raw.data);
  const masterPrompt = toText(parsed?.masterPrompt) ?? toText(parsed?.prompt);
  if (!masterPrompt) {
    return { ok: false, status: 502, error: 'No master prompt was returned' };
  }
  const altRaw = Array.isArray(parsed?.altPrompts) ? parsed.altPrompts : [];
  const altPrompts = altRaw
    .map((s: unknown) => toText(s))
    .filter((s: string | undefined): s is string => !!s)
    .slice(0, altCount);
  const frames: VariationFrameOut[] = [];
  if (frameCount > 1 && Array.isArray(parsed?.frames)) {
    for (const f of parsed.frames) {
      if (!f || typeof f !== 'object') continue;
      const rec = f as Record<string, unknown>;
      const prompt = toText(rec.prompt);
      if (!prompt) continue;
      const index = frames.length + 1;
      if (index > frameCount) break;
      frames.push({
        index,
        role: toText(rec.role) ?? `frame-${index}`,
        prompt,
      });
    }
  }
  return {
    ok: true,
    data: { masterPrompt, altPrompts, frames, model },
  };
}

function buildVariationPlanUser(input: VariationPlanInput, perDim: number): string {
  const dims = input.dimensions.map((id) => {
    const known = variationDimensionById(id);
    return {
      id,
      label: known?.label ?? id,
      plannerHint: known?.plannerHint ?? `Vary along: ${id}`,
    };
  });
  const dimBlock = dims
    .map((d) => `- ${d.id} (${d.label}): ${d.plannerHint}`)
    .join('\n');

  const total = dims.length * perDim;
  return [
    `Write image-edit instructions for creative testing on ${input.platform ?? 'instagram'} ${input.format ?? 'feed'}.`,
    input.seedDescription?.trim()
      ? `Seed / scene context:\n"""\n${input.seedDescription.trim()}\n"""`
      : 'Seed: use the attached image as the base (identity and main subject stay locked unless a dimension says otherwise).',
    input.hook?.trim() ? `Hook: ${input.hook.trim()}` : '',
    input.theme?.trim() ? `Theme: ${input.theme.trim()}` : '',
    input.guides?.trim() ? `Guides: ${input.guides.trim()}` : '',
    `Dimensions (write ${perDim} distinct variant(s) each):\n${dimBlock}`,
    `Return exactly ${total} items (or fewer only if a dimension is impossible). Each item: one primary dimension, concrete editPrompt.`,
    'JSON shape:',
    '{ "items": [ { "id": string, "dimension": string, "label": string, "editPrompt": string } ] }',
    'id should be like "color-1". label is short for UI (e.g. "Color · cool grade").',
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Plan a matrix of image-edit instructions across selected variation dimensions.
 */
export async function generateVariationPlan(
  input: VariationPlanInput,
): Promise<AiResult<VariationPlanOut>> {
  const dimensions = (input.dimensions ?? [])
    .map((d) => String(d).trim())
    .filter(Boolean)
    .slice(0, 12);
  if (!dimensions.length) {
    return { ok: false, status: 400, error: 'Select at least one dimension' };
  }
  const perDimension = Math.max(1, Math.min(4, Math.round(input.perDimension ?? 2)));
  const { provider, model } = await resolveTextModel(input.model);
  const system = [VARIATION_PLAN_SYSTEM, VOICE_RULES].join(' ');
  const user = buildVariationPlanUser({ ...input, dimensions }, perDimension);
  const raw =
    provider === 'anthropic'
      ? await anthropicJson(system, user, model)
      : await openAiJson(system, user, model, provider);
  if (!raw.ok) return raw;
  const parsed = parseJsonObject(raw.data);
  const items: VariationPlanItemOut[] = [];
  const list = Array.isArray(parsed?.items) ? parsed.items : [];
  for (const it of list) {
    if (!it || typeof it !== 'object') continue;
    const rec = it as Record<string, unknown>;
    const editPrompt = toText(rec.editPrompt);
    if (!editPrompt) continue;
    const dimension = toText(rec.dimension) ?? 'custom';
    const known = VARIATION_DIMENSIONS.some((d) => d.id === dimension);
    items.push({
      id: toText(rec.id) ?? `${dimension}-${items.length + 1}`,
      dimension: known ? (dimension as VariationDimensionId) : dimension,
      label: toText(rec.label) ?? dimension,
      editPrompt,
    });
  }
  if (!items.length) {
    return { ok: false, status: 502, error: 'No variation plan was returned' };
  }
  return { ok: true, data: { items, model } };
}

// ---------------------------------------------------------------------------
// AI Clone: per-beat script with voice programming (the Clone tab, step 2)
// ---------------------------------------------------------------------------

export interface CloneScriptInput {
  /** What the video is about / selling (the topic or offer). */
  topic: string;
  /**
   * Offer/lead-magnet/research grounding, resolved server-side (the route's
   * funnelContextBlock + owner notes). Every claim must stay consistent.
   */
  contextBlock?: string;
  /** Video type label (Hook ad, UGC testimonial, VSL, tutorial, announcement). */
  typeLabel: string;
  /** The framework label + the ordered beat roles the script must execute. */
  frameworkLabel: string;
  frameworkBeats: string[];
  /** Seconds per beat on the honest 5/10/15 grid. */
  beatSec: number;
  /** Target beat count. */
  beatCount: number;
  /** Who is speaking (clone name + description) and the locked look bible. */
  persona: string;
  lookBible: string;
  guides?: string;
  /**
   * THE 80% — the pre-writing truth block from the Producer's intake: the
   * 1am story, what failed before, why it really failed, the mechanism.
   */
  eightyPercent?: string;
  /** The hook family the scene-1 line MUST execute (template + example). */
  hookTemplate?: string;
  hookExample?: string;
  /** The visual hook direction for scene 1 (the pattern interrupt). */
  hookVisual?: string;
  /** The CTA destination line (comment / pinned / profile / DM). */
  ctaLine?: string;
  /** An optional prompt-bank framework craft block steering the script. */
  frameworkCraft?: string;
  model?: string;
}

export interface CloneScriptBeatOut {
  /** The spoken line (avatar beats) or empty for visual-only b-roll. */
  line: string;
  kind: 'avatar' | 'broll';
  shot: 'close' | 'medium' | 'wide';
  durationSec: number;
  /** Voice programming: pace, energy, emphasis words, pause placement. */
  pace: 'slow' | 'natural' | 'fast';
  energy: 'low' | 'medium' | 'high';
  emphasis: string[];
  pauseAfterWord: number;
  brollPrompt?: string;
}

const CLONE_PACES = ['slow', 'natural', 'fast'];
const CLONE_ENERGIES = ['low', 'medium', 'high'];
const CLONE_SHOTS = ['close', 'medium', 'wide'];

/** Defensive per-beat normalizer — the grid and enums hold no matter what the model says. */
function normalizeCloneScriptBeats(
  raw: unknown,
  beatCount: number,
  beatSec: number,
): CloneScriptBeatOut[] {
  if (!Array.isArray(raw)) return [];
  const out: CloneScriptBeatOut[] = [];
  for (const item of raw.slice(0, 12)) {
    const o = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const kind = o.kind === 'broll' ? ('broll' as const) : ('avatar' as const);
    const line = toText(o.line) ?? '';
    if (kind === 'avatar' && !line) continue;
    const dur = Math.round(Number(o.durationSec) || beatSec);
    const emphasis = Array.isArray(o.emphasis)
      ? o.emphasis
          .filter((s): s is string => typeof s === 'string' && !!s.trim())
          .map((s) => s.trim().slice(0, 40))
          .slice(0, 6)
      : [];
    out.push({
      line: line.slice(0, 300),
      kind,
      shot: CLONE_SHOTS.includes(String(o.shot))
        ? (o.shot as CloneScriptBeatOut['shot'])
        : 'medium',
      durationSec: Math.max(5, Math.min(15, dur)),
      pace: CLONE_PACES.includes(String(o.pace))
        ? (o.pace as CloneScriptBeatOut['pace'])
        : 'natural',
      energy: CLONE_ENERGIES.includes(String(o.energy))
        ? (o.energy as CloneScriptBeatOut['energy'])
        : 'medium',
      emphasis,
      pauseAfterWord: Math.max(0, Math.min(40, Math.round(Number(o.pauseAfterWord) || 0))),
      ...(toText(o.brollPrompt) ? { brollPrompt: toText(o.brollPrompt)!.slice(0, 500) } : {}),
    });
  }
  return out.slice(0, Math.max(1, beatCount));
}

/**
 * The Clone tab's "AI fill" (step 1): one loose sentence about the person
 * becomes the structured clone fields — a stage name, a foundry-ready
 * description, and the look bible (wardrobe / backdrop / lighting / lens).
 */
export interface CloneAutofillResult {
  name: string;
  description: string;
  wardrobe: string;
  backdrop: string;
  lighting: string;
  lens: string;
}

export async function generateCloneAutofill(input: {
  description: string;
  model?: string;
}): Promise<AiResult<CloneAutofillResult & { model: string }>> {
  const description = (input.description ?? '').trim().slice(0, 400);
  if (!description) return { ok: false, status: 400, error: 'Describe the person first' };
  const { provider, model } = await resolveTextModel(input.model);
  const system = [
    'You cast and style AI video avatars for short-form ads. Given a loose description of a person, you write the structured clone fields a video generation pipeline consumes.',
    'Return ONLY a JSON object. No prose, no code fences.',
  ].join(' ');
  const user = [
    `The person: ${description}.`,
    'Return {"name","description","wardrobe","backdrop","lighting","lens"} where:',
    '"name": a short stage name (2–4 words, e.g. "The Founder"),',
    '"description": ONE vivid casting sentence (age, face, hair, build, vibe) an image model can render,',
    '"wardrobe": the ONE outfit, specific and repeatable (e.g. "navy crewneck, no logos"),',
    '"backdrop": the ONE setting (e.g. "warm gray studio wall"),',
    '"lighting": the ONE lighting setup (e.g. "soft key from camera-left"),',
    '"lens": the ONE lens look (e.g. "50mm, shallow depth of field").',
  ].join('\n');
  const raw =
    provider === 'anthropic'
      ? await anthropicJson(system, user, model)
      : await openAiJson(system, user, model, provider);
  if (!raw.ok) return raw;
  const parsed = parseJsonObject(raw.data);
  const txt = (v: unknown, max: number) =>
    typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : '';
  const out: CloneAutofillResult = {
    name: txt(parsed?.name, 80),
    description: txt(parsed?.description, 300),
    wardrobe: txt(parsed?.wardrobe, 200),
    backdrop: txt(parsed?.backdrop, 200),
    lighting: txt(parsed?.lighting, 200),
    lens: txt(parsed?.lens, 200),
  };
  if (!out.description) {
    return { ok: false, status: 502, error: 'The autofill came back empty — try again' };
  }
  return { ok: true, data: { ...out, model } };
}

/**
 * Write the clone script: one line per beat (max ~25 words — the 5/10/15s
 * grid is honest), each line carrying its voice programming (pace, energy,
 * emphasis words, pause placement). B-roll beats carry a visual prompt that
 * names the character so the same person shows up INSIDE the footage.
 */
export async function generateCloneScript(
  input: CloneScriptInput,
): Promise<AiResult<{ beats: CloneScriptBeatOut[]; model: string }>> {
  const topic = input.topic.trim();
  if (!topic) return { ok: false, status: 400, error: 'A topic is required' };
  const beatCount = Math.max(1, Math.min(12, Math.round(input.beatCount) || 3));
  const beatSec = Math.max(5, Math.min(15, Math.round(input.beatSec) || 10));
  const maxWords = Math.floor((beatSec * 5) / 2); // ~2.5 words/sec of speech
  const { provider, model } = await resolveTextModel(input.model);
  const system = [
    "You are the MotherMode clone-video scriptwriter — a veteran direct-response writer crafting short SPOKEN scripts for an AI avatar, one line per beat, with the director's voice notes attached to every line.",
    VOICE_RULES,
    'Craft bars (non-negotiable): The hook line creates an open loop or names a felt moment — never a greeting, never a yes/no question the viewer skips past. One idea per line. Concrete nouns, numbers, and scenes beat abstractions. Write for the EAR: short sentences, fragments, rhythm — if a line reads like ad copy, it is wrong.',
    'THE HOOK, specifically: the first line MUST stop the exact person this is for. Use one of these proven openers, made specific to the topic: the precise timestamp confession ("It is 6:12 and the day already won"), the called-out person ("If your brain has 40 tabs open by breakfast, this is you"), the number that should not exist ("I spent $4,100 on planners that never worked"), the forbidden reframe ("Nobody tells you the list IS the problem"). Vague scene-setting ("kids screaming") is NOT a hook — it is wallpaper.',
    'Every middle line names ONE concrete thing the viewer recognizes (a time, an object, a number, a tiny scene) — never an abstraction like "the chaos" or "the struggle".',
    'THE CTA, specifically: name the exact next step in plain words ("the link under this video opens the 2-minute version") — never filler like "go peek", "no pressure", "check it out", "link in bio". One step, spoken like a friend, with the reason it is worth 2 minutes.',
    `Exactly ${beatCount} beats — never fewer. A short script fails the video; write every beat.`,
    `Every line is SPOKEN WORD by the avatar: literal, sayable, never stage directions. Each line max ${maxWords} words (that is the honest speech budget for its beat). Return ONLY a JSON object. No prose, no code fences.`,
    input.hookTemplate
      ? `THE HOOK FAMILY (strict): scene 1's line executes THIS template, made specific to the topic: ${input.hookTemplate}${input.hookExample ? ` A worked example of the shape: "${input.hookExample}" — never copy it, execute the SHAPE.` : ''}${input.hookVisual ? ` And the b-roll/shot direction for scene 1 must stage this visual hook: ${input.hookVisual}` : ''}`
      : '',
    input.ctaLine
      ? `THE CTA (strict): the final beat ${input.ctaLine} — subtle, spoken like a friend, never a hard sell.`
      : '',
    input.frameworkCraft
      ? `STEER THE WHOLE SCRIPT through this proven framework (its craft, not its surface):\n${input.frameworkCraft}`
      : '',
    input.eightyPercent?.trim()
      ? `THE 80% (the pre-writing truth — every line mirrors this; the deeper core, not the surface):\n${input.eightyPercent.trim().slice(0, 900)}`
      : '',
  ].join(' ');
  const user = [
    `Write a ${beatCount}-beat ${input.typeLabel} script about: ${topic}.`,
    `Framework: ${input.frameworkLabel} — the beats execute these roles in order: ${input.frameworkBeats.join(' → ')}. One beat per role (drop the tail roles if the count is shorter).`,
    "Each role is a JOB, not a label — the line DOES the job, never talks about it: agitate twists the knife with a specific cost; proof is a scene or a number, never a claim; cta is one soft next step. A b-roll beat's visual shows the line's claim or its cost with the character inside the footage — never decoration.",
    `The speaker: ${input.persona}.`,
    input.contextBlock?.trim()
      ? `GROUNDING — every claim in the script must stay consistent with these facts (the promise, the problem, the proof); never invent numbers that aren't here:\n${input.contextBlock.trim().slice(0, 1500)}`
      : '',
    input.lookBible
      ? `The locked look (b-roll prompts must agree with it): ${input.lookBible}.`
      : '',
    `Each beat is ${beatSec}s. Return {"beats": [...]} where each beat is:`,
    `{ "line": the spoken words (max ${maxWords} words; empty string ONLY for a b-roll beat),`,
    `  "kind": "avatar" (talking head) or "broll" (visual cutaway — at most ${Math.max(1, Math.floor(beatCount / 3))} b-roll beats, never the first or the last),`,
    `  "shot": "close" | "medium" | "wide" (the talking-head angle for avatar beats),`,
    `  "durationSec": ${beatSec},`,
    `  "pace": "slow" | "natural" | "fast" — the read speed for THIS line,`,
    `  "energy": "low" | "medium" | "high" — the emotional charge for THIS line,`,
    `  "emphasis": [up to 3 words from the line that get the stress],`,
    `  "pauseAfterWord": a word index (1-based) where the voice takes a beat, or 0,`,
    `  "brollPrompt": only for broll beats — a visual prompt naming the same character so they appear INSIDE the footage }`,
    input.guides?.trim() ? `Direction from the owner: ${input.guides.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const raw =
    provider === 'anthropic'
      ? await anthropicJson(system, user, model)
      : await openAiJson(system, user, model, provider);
  if (!raw.ok) return raw;
  const parsed = parseJsonObject(raw.data);
  const beats = normalizeCloneScriptBeats(parsed?.beats, beatCount, beatSec);
  if (!beats.length) {
    console.warn(
      `generateCloneScript: no beats parsed (model ${model}). Raw:`,
      raw.data.slice(0, 500),
    );
    return { ok: false, status: 502, error: 'No usable script was returned' };
  }
  return { ok: true, data: { beats, model } };
}


// ---------------------------------------------------------------------------
// THE PRODUCER — brief + style → the Production Plan (the pipeline, scoped)
// ---------------------------------------------------------------------------

/**
 * The Producer's planner: a plain-words brief + a style preset becomes the
 * full Production Plan — type, framework, scene count/seconds, per-scene
 * intent (kind + idea + tier), sheet needs, the voice plan, and the caption
 * preset. The plan card renders it editable; approving writes the manifest.
 */
export async function generateProductionPlan(input: {
  brief: string;
  styleLabel: string;
  styleVideoType: string;
  styleCaption: string;
  persona: string;
  hasSheet: boolean;
  hasVoice: boolean;
  grounding?: string;
  model?: string;
}): Promise<AiResult<{ plan: Record<string, unknown>; model: string }>> {
  const brief = (input.brief ?? '').trim().slice(0, 600);
  if (!brief) return { ok: false, status: 400, error: 'A brief is required' };
  const { provider, model } = await resolveTextModel(input.model);
  const system = [
    'You are a veteran short-form video producer scoping ONE video for an AI pipeline. Given a brief and a style preset, you return a production plan the pipeline executes: script scenes, sheet needs, voice, captions.',
    'Be concrete and honest: scenes are shootable ideas, never labels. The plan is edited by a human before anything is spent.',
    'Return ONLY a JSON object. No prose, no code fences.',
  ].join(' ');
  const user = [
    `The brief: ${brief}.`,
    `The style preset: ${input.styleLabel} (video type ${input.styleVideoType}, captions ${input.styleCaption}). Stay inside its rails.`,
    `The cast: ${input.persona} — ${input.hasSheet ? 'a character sheet EXISTS' : 'NO character sheet yet'}; ${input.hasVoice ? 'a cloned/picked voice EXISTS' : 'NO voice picked yet'}.`,
    input.grounding?.trim()
      ? `GROUNDING — the plan must stay consistent with these facts:\n${input.grounding.trim().slice(0, 1000)}`
      : '',
    'Return this exact shape:',
    '{ "title": a short working title,',
    '  "topic": the one-two sentence topic the script writer runs on (grounded, specific),',
    '  "videoType": "hook-ad" | "ugc" | "vsl" | "tutorial" | "announcement" (the preset, unless the brief demands another),',
    '  "framework": "pas" | "aida" | "hook-story-offer" | "vsl",',
    '  "beatCount": 3-7 (the scene count; VSL may go to 8),',
    '  "beatSec": 5 | 10 | 15,',
    '  "scenes": [ one per beat, in order: { "kind": "avatar" | "broll", "idea": the concrete scene/line idea, "world": a short location label for this scene (e.g. "gym", "desk", "car") — scenes sharing a world forge ONE scene sheet together, so label consistently, "seedanceTier": "seedance-2.5" ONLY for hero b-roll moments } ],',
    '  "needsCharacterSheet": true only when the cast has NO sheet and the video shows the person,',
    '  "scenePanels": how many panels the scene sheet should carry (usually = beatCount),',
    '  "voicePlan": "twin-voice" (a voice exists / talking head) | "stock-voice" | "record-voice" (they should record theirs),',
    '  "captionPreset": a caption preset id from the style,',
    '  "notes": one-two sentences of producer direction for the script writer }',
  ]
    .filter(Boolean)
    .join('\n');
  const raw =
    provider === 'anthropic'
      ? await anthropicJson(system, user, model)
      : await openAiJson(system, user, model, provider);
  if (!raw.ok) return raw;
  const parsed = parseJsonObject(raw.data);
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, status: 502, error: 'No plan was returned' };
  }
  return { ok: true, data: { plan: parsed as Record<string, unknown>, model } };
}

// ---------------------------------------------------------------------------
// THE HOOKS GENERATOR — written hooks across the registry families
// ---------------------------------------------------------------------------

/**
 * The run card's hook generator: N written hooks for scene 1, each executing
 * a DIFFERENT registry family's template, grounded in the topic (+ the 80%).
 */
export async function generateCloneHooks(input: {
  topic: string;
  count?: number;
  /** The registry rows to execute, resolved by the route: 'label — template'. */
  families: string[];
  eightyPercent?: string;
  model?: string;
}): Promise<AiResult<{ hooks: string[]; model: string }>> {
  const topic = (input.topic ?? '').trim();
  if (!topic) return { ok: false, status: 400, error: 'A topic is required' };
  const count = Math.max(1, Math.min(8, Math.round(input.count || 5)));
  const { provider, model } = await resolveTextModel(input.model);
  const system = [
    'You are a direct-response hook writer for short-form video. One spoken line per hook, each EXECUTING the named template shape — made specific to the topic, never copying the example.',
    'Written for the ear. No filler openers. Return ONLY a JSON object.',
  ].join(' ');
  const user = [
    `Write ${count} distinct hooks for a video about: ${topic}.`,
    'One hook per template family below (cycle if more are needed):',
    input.families.join('\n'),
    input.eightyPercent?.trim()
      ? `The deeper truth every hook mirrors:\n${input.eightyPercent.trim().slice(0, 600)}`
      : '',
    'Respond with this exact JSON shape: { "items": [string] }.',
  ]
    .filter(Boolean)
    .join('\n\n');
  const raw =
    provider === 'anthropic'
      ? await anthropicJson(system, user, model)
      : await openAiJson(system, user, model, provider);
  if (!raw.ok) return raw;
  const hooks = parseAmplifyItems(raw.data).slice(0, count);
  if (!hooks.length) return { ok: false, status: 502, error: 'No hooks were returned' };
  return { ok: true, data: { hooks, model } };
}
