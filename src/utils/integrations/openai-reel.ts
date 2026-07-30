/**
 * Reel Director text agents for the MotherMode video pipeline. Server-only.
 *
 * Two frontier-text operations back the Reel Director panel, both grounded in
 * the brand voice and returned as strict JSON:
 *   - generateReelStory: the Story Agent. Turns one raw idea into a four-chapter
 *     {@link ReelStory} (the narrative spine a storyboard pack is built from).
 *   - directReelShots: the Shot Director. Emits per-board camera + scene
 *     direction that later feeds buildSeedancePrompt() as the Camera / Scene
 *     Notes layers.
 *
 * Provider selection mirrors openai-content.ts: a valid requested model wins and
 * carries its provider when that provider has a key; otherwise Auto prefers
 * Anthropic when present, else OpenAI. Talks to each provider directly over
 * REST. Never import from a browser bundle.
 */
import type { ReelStory, ReelStoryChapter } from '@/lib/mothermode/content/review';
import type { AiResult } from './openai-content';
import { getTextModel, type TextProvider } from '@/lib/mothermode/content/models';
import {
  getOpenAiKey,
  getAnthropicKey,
  getMoonshotKey,
  getTextModelOverride,
  getTextProviderOverride,
} from './runtime-config';

const OPENAI_BASE = 'https://api.openai.com/v1';
const ANTHROPIC_BASE = 'https://api.anthropic.com/v1';
const MOONSHOT_BASE = 'https://api.moonshot.cn/v1';
const ANTHROPIC_VERSION = '2023-06-01';

const DEFAULT_OPENAI_TEXT_MODEL = 'gpt-5.5';
const DEFAULT_ANTHROPIC_TEXT_MODEL = 'claude-opus-4-8';
const DEFAULT_MOONSHOT_TEXT_MODEL = 'kimi-k3';

/** Exactly four chapters make a reel's arc: hook, build, turn, land. */
const CHAPTER_COUNT = 4;

/**
 * Condensed brand voice for the Reel Director. The full rules live in
 * openai-content.ts; these are the lines that matter for spoken, on-screen reel
 * storytelling so the story and shot direction never drift generic.
 */
const REEL_VOICE = [
  'Voice: a brilliant, slightly tired, deeply loving woman telling her smartest friend the truth. Calm authority, no hype.',
  'Never use em dashes or en dashes. Periods and short sentences. Never ALL CAPS for emphasis. No emoji spam.',
  'Specific scenes beat abstract advice. Concrete times, objects, and body-feel. Soft CTAs, never hard sells.',
  'Banned words and stems: mama, mompreneur, supermom, thrive, flourish, glow, bloom, journey, self-care, me-time, balance, hustle, grind, girlboss, empower, elevate, unlock, leverage, optimize, amazing, queen, tribe, crushing it.',
  'Enemy is the broken system, never partners, never other mothers. Never sell from fear. Never apologize for ambition.',
].join(' ');

// ---------------------------------------------------------------------------
// Provider resolution
// ---------------------------------------------------------------------------

/** Pick a text provider that actually has a key. Prefer Anthropic when both
 *  are present (historical default), else OpenAI. */
async function availableTextProvider(
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

/** The provider/model for one run. A known catalog model wins and carries its
 *  provider when its key is present; otherwise fall back to the frontier default
 *  for whichever provider has a key. Never hard-fails on an unknown selection. */
async function resolveTextModel(
  requested?: string,
): Promise<{ provider: TextProvider; model: string }> {
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

  const provider = await availableTextProvider(overrideProvider);
  const model =
    provider === 'anthropic'
      ? DEFAULT_ANTHROPIC_TEXT_MODEL
      : provider === 'moonshot'
        ? DEFAULT_MOONSHOT_TEXT_MODEL
        : DEFAULT_OPENAI_TEXT_MODEL;
  return { provider, model };
}

/** One provider-agnostic JSON text call. Temperature is omitted: the GPT-5 and
 *  Claude Opus reasoning families reject a non-default value. */
async function callTextJson(
  system: string,
  user: string,
  provider: TextProvider,
  model: string,
): Promise<AiResult<string>> {
  return provider === 'anthropic'
    ? anthropicJson(system, user, model)
    : openAiJson(system, user, model, provider);
}

async function openAiJson(
  system: string,
  user: string,
  model: string,
  provider: TextProvider = 'openai',
): Promise<AiResult<string>> {
  const moonshot = provider === 'moonshot';
  const key = moonshot ? await getMoonshotKey() : await getOpenAiKey();
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
        error: json?.error?.message || `Reel request failed (${res.status})`,
      };
    }
    const out = json?.choices?.[0]?.message?.content;
    if (typeof out !== 'string' || !out.trim()) {
      return { ok: false, status: 502, error: 'No content was returned' };
    }
    return { ok: true, data: out };
  } catch (err) {
    console.error('openAiJson (reel) failed', err);
    return { ok: false, status: 502, error: 'Could not reach OpenAI' };
  }
}

async function anthropicJson(
  system: string,
  user: string,
  model: string,
): Promise<AiResult<string>> {
  const key = await getAnthropicKey();
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
        max_tokens: 2048,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    const json = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: json?.error?.message || `Reel request failed (${res.status})`,
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
    console.error('anthropicJson (reel) failed', err);
    return { ok: false, status: 502, error: 'Could not reach Anthropic' };
  }
}

/** Parse a JSON object out of a model reply, tolerant of stray prose or fences. */
function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw.trim()) as Record<string, unknown>;
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Coerce a value into a trimmed string array, tolerant of a single string. */
function strArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(str).filter(Boolean);
  const s = str(v);
  return s ? [s] : [];
}

// ---------------------------------------------------------------------------
// Story Agent
// ---------------------------------------------------------------------------

export interface ReelStoryInput {
  /** The raw idea, angle, or topic the reel should tell. */
  idea: string;
  /** Optional soft CTA the last chapter lands on. */
  cta?: string;
  /** Brand Bible / voice notes that ground the tone. */
  brandVoice?: string;
  /** Extra offer or campaign context to keep claims accurate. */
  context?: string;
  /** Optional text model id from the selector. Empty/unknown means Auto. */
  model?: string;
}

/**
 * The Story Agent. Turn one idea into a four-chapter {@link ReelStory}: the
 * narrative spine (hook, build, turn, land) a storyboard pack is generated from.
 * The story carries its opening hook, core emotion, and ordered arc beats, plus
 * each chapter's purpose, emotional state, visual goal, and transition. Returns
 * the story with the writing model stamped on.
 */
export async function generateReelStory(
  input: ReelStoryInput,
): Promise<AiResult<ReelStory>> {
  const idea = input.idea?.trim();
  if (!idea) return { ok: false, status: 400, error: 'An idea is required' };

  const { provider, model } = await resolveTextModel(input.model);

  const system = [
    'You are the MotherMode Reel Director working as the Story Agent. You turn one idea into the narrative spine of a short vertical reel (15 to 45 seconds).',
    REEL_VOICE,
    `Structure the reel as exactly ${CHAPTER_COUNT} chapters that form an arc: 1) hook that stops the scroll, 2) build that names the load, 3) turn that reframes, 4) land with permission and a soft CTA.`,
    'Each chapter needs a clear PURPOSE, the EMOTIONAL STATE it lives in, a concrete VISUAL GOAL for its storyboard, and how it TRANSITIONS into the next chapter.',
    'Return ONLY a JSON object. No prose, no code fences.',
  ].join(' ');

  const user = [
    `Idea / angle: ${idea}`,
    input.cta?.trim() ? `Soft CTA to land on: ${input.cta.trim()}` : '',
    input.brandVoice?.trim() ? `Brand voice notes: ${input.brandVoice.trim()}` : '',
    input.context?.trim() ? `Context (keep claims consistent): ${input.context.trim()}` : '',
    `Respond with this exact JSON shape: { "title": "...", "hook": "...", "coreEmotion": "...", "arc": ["Beginning", "Conflict", "Escalation", "Breakthrough", "Payoff"], "cta": "...", "chapters": [ { "index": 1, "purpose": "...", "emotionalState": "...", "visualGoal": "...", "transition": "..." } ] } where "hook" is the opening line that stops the scroll, "coreEmotion" is the single emotional throughline, "arc" is an ordered list of short narrative beats (Beginning, Conflict, Escalation, Breakthrough, Payoff), and there are exactly ${CHAPTER_COUNT} chapters, indexed 1 to ${CHAPTER_COUNT} in order.`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const raw = await callTextJson(system, user, provider, model);
  if (!raw.ok) return raw;

  const obj = parseJsonObject(raw.data);
  if (!obj) return { ok: false, status: 502, error: 'The story was not valid JSON' };

  const rawChapters = Array.isArray(obj.chapters) ? obj.chapters : [];
  const chapters: ReelStoryChapter[] = rawChapters
    .slice(0, CHAPTER_COUNT)
    .map((c, i) => {
      const o = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
      const idx = typeof o.index === 'number' ? o.index : i + 1;
      return {
        index: idx,
        purpose: str(o.purpose),
        emotionalState: str(o.emotionalState),
        visualGoal: str(o.visualGoal),
        transition: str(o.transition),
      };
    })
    .filter((c) => c.purpose || c.visualGoal);

  if (chapters.length === 0) {
    return { ok: false, status: 502, error: 'No story chapters were returned' };
  }

  const story: ReelStory = {
    title: str(obj.title) || idea.slice(0, 80),
    hook: str(obj.hook),
    coreEmotion: str(obj.coreEmotion),
    arc: strArray(obj.arc),
    cta: str(obj.cta) || input.cta?.trim() || '',
    chapters,
    model,
  };
  return { ok: true, data: story };
}

// ---------------------------------------------------------------------------
// Shot Director
// ---------------------------------------------------------------------------

/** Per-board camera + scene direction for one storyboard clip. */
export interface ReelShotDirection {
  /** 1-based board index this direction applies to. */
  index: number;
  /** Camera framing and movement for the clip (e.g. "slow push-in, handheld"). */
  camera: string;
  /** The action and scene beats Seedance should animate. */
  sceneNotes: string;
  /** Optional motion emphasis (what moves, how fast). */
  motion: string;
}

export interface ShotDirectionInput {
  /** The story the boards were built from. */
  story: ReelStory;
  /** Optional short description of each storyboard board, in order. When
   *  omitted, direction is derived from the story chapters alone. */
  boardSummaries?: string[];
  /** Brand Bible / voice notes to keep the look consistent. */
  brandVoice?: string;
  /** Optional text model id from the selector. Empty/unknown means Auto. */
  model?: string;
}

/**
 * The Shot Director. Emit per-board camera and scene direction for the reel's
 * storyboard clips. The output feeds buildSeedancePrompt() as the Camera and
 * Scene Notes layers. Boards are keyed by 1-based index so the caller can map
 * each direction onto its StoryboardBoard.
 */
export async function directReelShots(
  input: ShotDirectionInput,
): Promise<AiResult<ReelShotDirection[]>> {
  const story = input.story;
  if (!story?.chapters?.length) {
    return { ok: false, status: 400, error: 'A story with chapters is required' };
  }

  const boards = input.boardSummaries?.filter((b) => b && b.trim()) ?? [];
  const count = boards.length || story.chapters.length;

  const { provider, model } = await resolveTextModel(input.model);

  const system = [
    'You are the MotherMode Reel Director working as the Shot Director. You translate a reel story into concrete, filmable camera and scene direction for an AI video model (Seedance).',
    REEL_VOICE,
    'Direction must be physical and specific: real camera moves (push-in, pull-out, slow pan, static lock-off, handheld drift), real framing (close on hands, wide of the room), and grounded action beats. No abstract mood words alone.',
    'Keep the look consistent clip to clip so the reel reads as one continuous piece.',
    'Return ONLY a JSON object. No prose, no code fences.',
  ].join(' ');

  const storyBlock = [
    `Title: ${story.title}`,
    story.hook ? `Hook: ${story.hook}` : '',
    story.coreEmotion ? `Core emotion: ${story.coreEmotion}` : '',
    story.arc?.length ? `Arc: ${story.arc.join(' > ')}` : '',
    `CTA: ${story.cta}`,
    'Chapters:',
    ...story.chapters.map(
      (c) =>
        `  ${c.index}. purpose: ${c.purpose} | emotion: ${c.emotionalState} | visual goal: ${c.visualGoal} | transition: ${c.transition}`,
    ),
  ]
    .filter(Boolean)
    .join('\n');

  const boardBlock = boards.length
    ? ['Storyboard boards (in order):', ...boards.map((b, i) => `  ${i + 1}. ${b.trim()}`)].join('\n')
    : `There are ${count} boards, one per story chapter, in order.`;

  const user = [
    storyBlock,
    boardBlock,
    input.brandVoice?.trim() ? `Brand voice notes: ${input.brandVoice.trim()}` : '',
    `Respond with this exact JSON shape: { "shots": [ { "index": 1, "camera": "...", "sceneNotes": "...", "motion": "..." } ] } containing exactly ${count} shots, indexed 1 to ${count} in order.`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const raw = await callTextJson(system, user, provider, model);
  if (!raw.ok) return raw;

  const obj = parseJsonObject(raw.data);
  if (!obj) return { ok: false, status: 502, error: 'The shot direction was not valid JSON' };

  const rawShots = Array.isArray(obj.shots) ? obj.shots : [];
  const shots: ReelShotDirection[] = rawShots
    .slice(0, count)
    .map((s, i) => {
      const o = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
      const idx = typeof o.index === 'number' ? o.index : i + 1;
      return {
        index: idx,
        camera: str(o.camera),
        sceneNotes: str(o.sceneNotes),
        motion: str(o.motion),
      };
    })
    .filter((s) => s.camera || s.sceneNotes);

  if (shots.length === 0) {
    return { ok: false, status: 502, error: 'No shot direction was returned' };
  }
  return { ok: true, data: shots };
}
