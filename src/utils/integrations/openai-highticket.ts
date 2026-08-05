/**
 * High Ticket Kit generator. Server-only: turns a short HighTicketIntake into a
 * complete, structured offer + selling system, and regenerates any single
 * section on demand. Called only through the guarded
 * /api/mothermode/highticket-ai action switch.
 *
 * Talks to OpenAI chat/completions in JSON mode (response_format json_object),
 * with an Anthropic fallback, exactly like openai-community.ts. The owner
 * frameworks in src/lib/mothermode/highticket/frameworks are injected as
 * authoritative guidance, so swapping a framework visibly changes that section's
 * output without touching this file. Never import from a browser bundle.
 */
import {
  blankKit,
  normalizeIntake,
  normalizeKit,
  KIT_SECTIONS,
  type HighTicketIntake,
  type HighTicketKit,
  type KitSection,
} from '@/lib/mothermode/highticket/types';
import { frameworkForSection } from '@/lib/mothermode/highticket/frameworks';
import {
  contextPacksToPromptBlock,
  type ContextPack,
} from '@/lib/mothermode/context';
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
// Shared voice rules (mirrors the content hub's compliance posture)
// ---------------------------------------------------------------------------

const VOICE_RULES = `
VOICE AND COMPLIANCE (always):
- Calm authority. Specific over clever. Lead with the person, never the sale.
- Periods over exclamation points. No em dashes or en dashes; use commas,
  periods, or a colon.
- No hype, no false scarcity, no income/earnings claims, no medical claims.
- Plain, concrete language a real person would say out loud.
`.trim();

/** Turn the intake into a compact, labeled brief for the prompt. */
function intakeBrief(intake: HighTicketIntake): string {
  const lines = [
    `Niche: ${intake.niche}`,
    `Audience / avatar: ${intake.audience}`,
    `Core transformation / result: ${intake.transformation}`,
    `Mechanism / unique method: ${intake.mechanism}`,
    `Price band: ${intake.priceBand}`,
    `Proof / credibility: ${intake.proof}`,
    `Timeline / program length: ${intake.timeline}`,
    `Tone / brand voice: ${intake.tone}`,
    `Extra notes: ${intake.notes}`,
  ];
  return lines.filter((l) => l && !l.endsWith(': ')).join('\n');
}

// ---------------------------------------------------------------------------
// Provider-aware JSON call (mirrors the content hub's Auto resolution)
// ---------------------------------------------------------------------------

/** Best-effort JSON parse that tolerates code fences / prose around the object. */
function parseJson<T>(raw: string): T | null {
  const s = raw.trim();
  try {
    return JSON.parse(s) as T;
  } catch {
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(s.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function resolveTextConfig(): Promise<
  { ok: true; provider: TextProvider; model: string; key: string } | { ok: false; error: string }
> {
  const [openaiKey, anthropicKey, moonshotKey] = await Promise.all([getOpenAiKey(), getAnthropicKey(), getMoonshotKey()]);
  if (!openaiKey && !anthropicKey && !moonshotKey) {
    return { ok: false, error: 'No AI text provider is configured (set an OpenAI or Anthropic key).' };
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
// Full-kit generation
// ---------------------------------------------------------------------------

function fullKitSystem(): string {
  return [
    'You are an offer strategist producing a complete high-ticket offer using the D.I.M.E. method and the 7 A\'s contrarian-copy framework.',
    'Return ONE JSON object matching the schema below. No prose outside the JSON.',
    '',
    VOICE_RULES,
    '',
    'FRAMEWORKS (authoritative — follow their structure, fill specifics from the brief):',
    '',
    '## Basics',
    frameworkForSection('basics'),
    '',
    "## The 7 A's",
    frameworkForSection('sevenAs'),
    '',
    '## The extracted offer',
    frameworkForSection('offer'),
    '',
    '## D.I.M.E. problem pillars',
    frameworkForSection('problems'),
    '',
    '## The offer script',
    frameworkForSection('offerScript'),
    '',
    'JSON SCHEMA (exact keys):',
    '{',
    '  "basics": {',
    '    "avatar": { "genders": string, "ageRange": string, "labels": string },',
    '    "problems": [ { "problem": string, "cost": string, "result": string } ]',
    '  },',
    '  "sevenAs": {',
    '    "attention": string, "acknowledge": string, "agitate": string,',
    '    "authority": string, "angst": string, "ambiguity": string, "appeal": string',
    '  },',
    '  "offer": {',
    '    "nameOptions": string[5], "chosenName": string, "iHelpStatement": string,',
    '    "price": string, "paymentOptions": string[], "guarantee": string,',
    '    "addOns": string[], "positioning": string',
    '  },',
    '  "problems": [ { "title": string, "problem": string, "angst": string, "solution": string, "implementation": string[5] } ],',
    '  "offerScript": [ { "label": string, "body": string } ]',
    '}',
    '',
    'Rules:',
    '- Produce 3-4 items in "problems" (one per Ambiguity obstacle) and one "offerScript" pillar per problem, in the same order.',
    '- chosenName must be one of nameOptions verbatim.',
    '- iHelpStatement must follow the Super "I help" template exactly.',
    '- Each problem.implementation has 5 concrete numbered steps (strings, no leading numbers).',
    '- Each offerScript.body is the fully spoken pillar and ends with "Does that make sense?".',
    '- Keep everything internally consistent and grounded in the brief.',
  ].join('\n');
}


/** Generate a complete kit from the intake. */
export async function generateHighTicketKit(
  intake: HighTicketIntake,
  packs: ContextPack[] = [],
): Promise<AiResult<HighTicketKit>> {
  const system = fullKitSystem();
  const user = [
    'Produce the full high-ticket kit for this brief:',
    '',
    intakeBrief(intake),
    contextPacksToPromptBlock(packs, 'kit'),
  ].join('\n');


  const res = await callOpenAiJson<Record<string, unknown>>(system, user);
  if (!res.ok) return res;
  return { ok: true, data: normalizeKit(res.data) };
}

/**
 * Generate only the chosen sections (from the post-intake wizard). Runs each
 * selected section through the focused per-section generator in parallel and
 * merges the results onto a blank kit. Per-section generation gives each block
 * the full token budget and a tightly-scoped framework, which produces
 * noticeably better copy than one giant call. Unselected sections stay blank.
 */
export async function generateHighTicketKitSections(
  intake: HighTicketIntake,
  sections: KitSection[],
  packs: ContextPack[] = [],
): Promise<AiResult<HighTicketKit>> {
  const wanted = sections.filter((s) => KIT_SECTIONS.includes(s));
  if (wanted.length === 0) {
    return { ok: false, status: 400, error: 'Select at least one section to generate.' };
  }

  const results = await Promise.all(
    wanted.map((section) => regenerateKitSection(section, intake, undefined, packs)),
  );


  const firstError = results.find((r) => !r.ok);
  if (firstError && !firstError.ok) return firstError;

  let kit = blankKit();
  for (const r of results) {
    if (r.ok) kit = { ...kit, ...r.data };
  }
  return { ok: true, data: normalizeKit(kit) };
}

// ---------------------------------------------------------------------------
// AI intake fill (baseline seed -> full intake)
// ---------------------------------------------------------------------------

/**
 * Expand a sparse seed (usually just niche + audience, maybe a note) into a
 * complete, sensible HighTicketIntake the admin can review and tweak before
 * generating the kit. Any field the admin already filled is treated as a fact
 * to honor, not overwrite; blanks get inferred.
 */
export async function fillHighTicketIntake(
  seed: Partial<HighTicketIntake>,
): Promise<AiResult<HighTicketIntake>> {
  const known = normalizeIntake(seed);
  const provided = Object.entries(known)
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  const system = [
    'You are an offer strategist completing a short high-ticket intake brief.',
    'Given whatever the admin has provided (often only the niche and audience),',
    'infer the most likely, specific, on-brand value for EVERY remaining field.',
    'Never overwrite a field the admin already filled: repeat it verbatim.',
    'Return ONE JSON object with exactly these keys and string values:',
    '{',
    '  "niche": string,            // market / topic',
    '  "audience": string,         // the avatar it is for',
    '  "transformation": string,   // the core result / transformation',
    '  "mechanism": string,        // the unique method / why it works',
    '  "priceBand": string,        // e.g. 3k-5k, 5k-10k, 10k+',
    '  "proof": string,            // credibility / results to weave in',
    '  "timeline": string,         // program length / cadence',
    '  "tone": string,             // brand voice in a few words',
    '  "notes": string             // any extra guidance worth honoring',
    '}',
    '',
    VOICE_RULES,
    '',
    'Be concrete and realistic, not generic. Keep the price band appropriate for a',
    'high-ticket coaching, consulting, or done-with-you offer.',
  ].join('\n');

  const user = [
    'Complete the intake. Fields already provided (honor these exactly):',
    '',
    provided || '(none provided yet)',
  ].join('\n');

  const res = await callOpenAiJson<Record<string, unknown>>(system, user);
  if (!res.ok) return res;
  return { ok: true, data: normalizeIntake({ ...res.data, ...seed }) };
}

// ---------------------------------------------------------------------------
// Per-section regeneration
// ---------------------------------------------------------------------------

interface SectionSpec {
  schema: string;
  instruction: string;
}

function sectionSpec(section: KitSection): SectionSpec {
  switch (section) {
    case 'basics':
      return {
        schema:
          '{ "basics": { "avatar": { "genders": string, "ageRange": string, "labels": string }, "problems": [ { "problem": string, "cost": string, "result": string } ] } }',
        instruction:
          'Map who you help (avatar) and 3-5 problem / cost / result rows per the framework.',
      };
    case 'sevenAs':
      return {
        schema:
          '{ "sevenAs": { "attention": string, "acknowledge": string, "agitate": string, "authority": string, "angst": string, "ambiguity": string, "appeal": string } }',
        instruction:
          "Fill all 7 A's as tight paragraphs, answering each element's mapped questions. Ambiguity must name the 4-5 obstacles that become the DIME pillars.",
      };
    case 'offer':
      return {
        schema:
          '{ "offer": { "nameOptions": string[5], "chosenName": string, "iHelpStatement": string, "price": string, "paymentOptions": string[], "guarantee": string, "addOns": string[], "positioning": string } }',
        instruction:
          'Extract the core offer. iHelpStatement must follow the Super "I help" template exactly. chosenName must be one of nameOptions verbatim.',
      };
    case 'problems':
      return {
        schema:
          '{ "problems": [ { "title": string, "problem": string, "angst": string, "solution": string, "implementation": string[5] } ] }',
        instruction:
          'Produce 3-4 D.I.M.E. problem pillars (one per Ambiguity obstacle). Each implementation has 5 concrete steps (no leading numbers).',
      };
    case 'offerScript':
      return {
        schema: '{ "offerScript": [ { "label": string, "body": string } ] }',
        instruction:
          'Assemble one spoken script pillar per problem, in order. Label them "SCRIPT | PILLAR ONE" etc. Each body ends with "Does that make sense?".',
      };
    default:
      return { schema: '{}', instruction: '' };
  }
}


/** Regenerate a single section; returns a partial kit with only that section
 *  populated (merge into the current kit on the client/route). */
export async function regenerateKitSection(
  section: KitSection,
  intake: HighTicketIntake,
  currentKit?: HighTicketKit,
  packs: ContextPack[] = [],
): Promise<AiResult<Partial<HighTicketKit>>> {

  const spec = sectionSpec(section);
  const system = [
    'You are an offer strategist regenerating ONE section of a high-ticket kit.',
    'Return ONE JSON object with only the requested keys. No prose outside the JSON.',
    '',
    VOICE_RULES,
    '',
    'FRAMEWORK (authoritative):',
    frameworkForSection(section),
    '',
    'OUTPUT SCHEMA:',
    spec.schema,
    '',
    spec.instruction,
  ].join('\n');

  const context = currentKit
    ? [
        '',
        'For consistency, the current kit context is:',
        `Chosen name: ${currentKit.offer.chosenName}`,
        `I help statement: ${currentKit.offer.iHelpStatement}`,
        `Price: ${currentKit.offer.price}`,
        `Agitate (real problem + mechanism): ${currentKit.sevenAs.agitate}`,
      ].join('\n')
    : '';


  const user = [
    `Regenerate the "${section}" section for this brief:`,
    '',
    intakeBrief(intake),
    context,
    contextPacksToPromptBlock(packs, 'kit'),
  ].join('\n');


  const res = await callOpenAiJson<Record<string, unknown>>(system, user);
  if (!res.ok) return res;

  const merged = normalizeKit({ ...(currentKit ?? blankKit()), ...res.data });
  const partial: Partial<HighTicketKit> = {};
  switch (section) {
    case 'basics':
      partial.basics = merged.basics;
      break;
    case 'sevenAs':
      partial.sevenAs = merged.sevenAs;
      break;
    case 'offer':
      partial.offer = merged.offer;
      break;
    case 'problems':
      partial.problems = merged.problems;
      break;
    case 'offerScript':
      partial.offerScript = merged.offerScript;
      break;
  }
  return { ok: true, data: partial };
}


