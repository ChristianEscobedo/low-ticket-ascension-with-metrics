/**
 * Lead Gen Kit generator (server-only). Turns an intake + chosen format into a
 * structured LeadGenDoc, then expands sections one at a time so even
 * ultra-long-form ebooks stay coherent without blowing a single context window.
 *
 * Passes (each its own export so the route can call them independently):
 *   - aiFillIntake:    flesh out a thin brief into a complete LeadGenIntake.
 *   - aiOutline:       title/subtitle/hook + section headings+summaries + CTA
 *                      (blocks left empty — this is the skeleton).
 *   - aiExpandSection: fill one section's blocks (and lessons for course-style
 *                      formats), given the full outline for context.
 *   - aiGenerateDoc:   outline then expand every section in order.
 *
 * Talks to OpenAI chat/completions in JSON mode with an Anthropic fallback,
 * exactly like openai-highticket.ts. The format library in
 * src/lib/mothermode/leadgen/formats is injected as authoritative structure, so
 * swapping a format module visibly changes output without touching this file.
 * Every response is coerced through the defensive normalizers in types.ts, so a
 * malformed reply degrades to blanks rather than throwing. Never import from a
 * browser bundle.
 */
import {
  blankSection,
  normalizeDoc,
  normalizeIntake,
  normalizeSection,
  type DocSection,
  type LeadGenDoc,
  type LeadGenIntake,
  type LeadMagnetFormat,
} from '@/lib/mothermode/leadgen/types';
import { formatSpec, formatUsesLessons } from '@/lib/mothermode/leadgen/formats';
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

export type AiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

// ---------------------------------------------------------------------------
// Voice + provider plumbing (mirrors openai-highticket.ts)
// ---------------------------------------------------------------------------

const VOICE_RULES = `
VOICE AND COMPLIANCE (always):
- Calm authority. Specific over clever. Lead with the reader, never the sale.
- Periods over exclamation points. No em dashes or en dashes; use commas,
  periods, or a colon.
- No hype, no false scarcity, no income/earnings claims, no medical claims.
- Plain, concrete language a real person would say out loud.
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
    return { ok: true, provider: 'anthropic', model: overrideModel || DEFAULT_ANTHROPIC_TEXT_MODEL, key: anthropicKey };
  }
  if (pref === 'openai' && openaiKey) {
    return { ok: true, provider: 'openai', model: overrideModel || DEFAULT_OPENAI_TEXT_MODEL, key: openaiKey };
  }
  if (pref === 'moonshot' && moonshotKey) {
    return { ok: true, provider: 'moonshot', model: overrideModel || DEFAULT_MOONSHOT_TEXT_MODEL, key: moonshotKey };
  }
  if (anthropicKey) {
    return { ok: true, provider: 'anthropic', model: DEFAULT_ANTHROPIC_TEXT_MODEL, key: anthropicKey };
  }
  if (moonshotKey) {
    return { ok: true, provider: 'moonshot', model: DEFAULT_MOONSHOT_TEXT_MODEL, key: moonshotKey };
  }
  return { ok: true, provider: 'openai', model: DEFAULT_OPENAI_TEXT_MODEL, key: openaiKey! };
}

/** Parse a JSON object from a model reply, tolerating markdown fences. */
function parseJson<T>(raw: string): T | null {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Best-effort: grab the first {...} span.
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

async function callOpenAiJson<T>(system: string, user: string): Promise<AiResult<T>> {
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
          max_tokens: 8192,
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
// Prompt context
// ---------------------------------------------------------------------------

/** Number of sections to aim for, by length band. */
function sectionTarget(length: string): string {
  switch (length) {
    case 'short':
      return '3 to 5 sections';
    case 'ultra':
      return '8 to 12 sections';
    default:
      return '5 to 8 sections';
  }
}

/**
 * Per-section depth directive driven by the same length knob. `sectionTarget`
 * controls HOW MANY sections; this controls HOW DEEP each one is written, so
 * "ultra" produces genuine long-form (more sections AND richer bodies) instead
 * of just a longer table of contents.
 */
function sectionDepth(length: LeadGenIntake['length']): string {
  switch (length) {
    case 'short':
      return 'Keep this section tight: 2-4 blocks, roughly 120-220 words total.';
    case 'ultra':
      return (
        'Write this section in depth: 7-12 blocks, roughly 600-900 words. ' +
        'Use multiple "h3" subheadings, at least one list, and at least one ' +
        '"note" or "nextStep". Include concrete examples, specifics, and ' +
        'worked detail — this is a comprehensive long-form document, so do not ' +
        'be brief or generic.'
      );
    default:
      return (
        'Write 4-6 blocks, roughly 280-450 words, including at least one list ' +
        'and one supporting block ("note", "pullQuote", or "nextStep").'
      );
  }
}


function intakeContext(intake: LeadGenIntake, format: LeadMagnetFormat): string {
  const spec = formatSpec(format);
  return `FORMAT: ${spec.label}

FORMAT SKELETON (follow this structure):
${spec.skeleton}

AUTHORING STYLE:
${spec.styleNote}

INTAKE BRIEF:
- Topic: ${intake.topic || '(unspecified)'}
- Audience: ${intake.audience || '(unspecified)'}
- Lead-gen goal: ${intake.goal || '(unspecified)'}
- Promised transformation: ${intake.transformation || '(unspecified)'}
- Length: ${intake.length || 'standard'}
- Tone / voice: ${intake.tone || '(default confident, plain-spoken)'}
- Call to action: ${intake.cta || '(unspecified)'}
- Notes: ${intake.notes || '(none)'}`;
}

/** Drop empty string fields so they don't overwrite model output. */
function pruneEmpty(intake: LeadGenIntake): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(intake)) {
    if (typeof v === 'string' && v.trim()) out[k] = v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pass 1: fill intake
// ---------------------------------------------------------------------------

const INTAKE_SYSTEM = `You are a senior direct-response strategist. You expand a thin
lead-magnet brief into a complete, specific intake. Keep the owner's given
values; only fill blanks and sharpen vague ones. Respond with a JSON object with
exactly these string keys: topic, audience, goal, transformation, length, tone,
cta, offerSlug, notes. "length" must be one of: short, standard, ultra.

${VOICE_RULES}`;

export async function aiFillIntake(
  intake: LeadGenIntake,
  format: LeadMagnetFormat,
): Promise<AiResult<LeadGenIntake>> {
  const spec = formatSpec(format);
  const user = `We are producing a ${spec.label}. Complete this intake.\n\n${JSON.stringify(
    intake,
    null,
    2,
  )}`;
  const res = await callOpenAiJson<Record<string, unknown>>(INTAKE_SYSTEM, user);
  if (!res.ok) return res;
  // Preserve any owner-provided values over blanks the model returned.
  return { ok: true, data: normalizeIntake({ ...res.data, ...pruneEmpty(intake) }) };
}

// ---------------------------------------------------------------------------
// Pass 2: outline
// ---------------------------------------------------------------------------

const OUTLINE_SYSTEM = `You are an expert lead-magnet author. Produce ONLY the
document skeleton — do not write section bodies yet. Respond with a JSON object:
{
  "title": string,
  "subtitle": string,
  "hook": string,        // 2-4 sentence intro that earns the read
  "sections": [ { "heading": string, "summary": string } ],
  "cta": { "title": string, "body": string, "button": string }
}
Headings are specific and benefit-driven. Summaries are one line each. Follow the
provided format skeleton for how many sections and what they cover.

${VOICE_RULES}`;

export async function aiOutline(
  intake: LeadGenIntake,
  format: LeadMagnetFormat,
): Promise<AiResult<LeadGenDoc>> {
  const user = `${intakeContext(intake, format)}

Produce ${sectionTarget(intake.length)} in the outline. Skeleton only — no bodies.`;
  const res = await callOpenAiJson<Record<string, unknown>>(OUTLINE_SYSTEM, user);
  if (!res.ok) return res;

  // Normalize, then stamp fresh ids and ensure blocks start empty.
  const doc = normalizeDoc(res.data);
  doc.sections = doc.sections.map((s) => ({
    ...blankSection(),
    heading: s.heading,
    summary: s.summary,
    lessons: [],
    blocks: [],
  }));
  return { ok: true, data: doc };
}

// ---------------------------------------------------------------------------
// Pass 3: expand one section
// ---------------------------------------------------------------------------

const EXPAND_SYSTEM = `You are an expert lead-magnet author writing ONE section of a
larger document. Write rich, concrete, non-repetitive content that fits the
section's heading and summary and the overall format. Respond with a JSON object:
{
  "blocks": [ Block, ... ],
  "lessons": [ { "title": string, "blocks": [ Block, ... ] } ]  // only for course-style formats, else []
}
A Block is one of:
  { "kind": "lead", "text": string }        // opening line of the section
  { "kind": "p", "text": string }           // paragraph
  { "kind": "h3", "text": string }          // subsection heading
  { "kind": "ul", "items": string[] }       // bullet list
  { "kind": "checklist", "items": string[] }
  { "kind": "note", "title": string, "text": string }
  { "kind": "pullQuote", "text": string }
  { "kind": "nextStep", "title": string, "text": string }
  { "kind": "template", "title": string, "text": string }  // reusable fill-in copy with [PLACEHOLDERS]
Use only these kinds. Do not repeat content covered by earlier sections.

${VOICE_RULES}`;

export async function aiExpandSection(
  intake: LeadGenIntake,
  format: LeadMagnetFormat,
  section: DocSection,
  allSections: DocSection[],
): Promise<AiResult<DocSection>> {
  const outline = allSections
    .map((s, i) => `${i + 1}. ${s.heading} — ${s.summary}`)
    .join('\n');
  const usesLessons = formatUsesLessons(format);

  const user = `${intakeContext(intake, format)}

FULL OUTLINE (for context — do not rewrite other sections):
${outline}

Expand THIS section only:
Heading: ${section.heading}
Summary: ${section.summary}

DEPTH (length is "${intake.length || 'standard'}"): ${sectionDepth(intake.length)}
${usesLessons ? 'This format uses lessons: return 2-4 lessons under "lessons".' : 'Return "lessons" as an empty array.'}`;


  const res = await callOpenAiJson<{ blocks?: unknown; lessons?: unknown }>(
    EXPAND_SYSTEM,
    user,
  );
  if (!res.ok) return res;

  const merged = normalizeSection({
    id: section.id,
    heading: section.heading,
    summary: section.summary,
    blocks: res.data.blocks,
    lessons: usesLessons ? res.data.lessons : [],
  });
  return { ok: true, data: merged };
}

// ---------------------------------------------------------------------------
// Convenience: outline + expand every section
// ---------------------------------------------------------------------------

/**
 * Full build: outline, then expand each section sequentially so later sections
 * see the whole outline and avoid repeating earlier ground. Short-circuits on
 * the first failing pass.
 */
export async function aiGenerateDoc(
  intake: LeadGenIntake,
  format: LeadMagnetFormat,
): Promise<AiResult<LeadGenDoc>> {
  const outline = await aiOutline(intake, format);
  if (!outline.ok) return outline;

  const doc = outline.data;
  const expanded: DocSection[] = [];
  for (const section of doc.sections) {
    const filled = await aiExpandSection(intake, format, section, doc.sections);
    if (!filled.ok) return filled;
    expanded.push(filled.data);
  }
  doc.sections = expanded;
  return { ok: true, data: doc };
}
