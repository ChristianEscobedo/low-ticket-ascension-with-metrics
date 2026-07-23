/**
 * Community Kit generator. Server-only: turns a short CommunityIntake into a
 * complete, structured launch kit, and regenerates any single section on
 * demand. Called only through the guarded /api/mothermode/ai action switch.
 *
 * Talks to OpenAI chat/completions in JSON mode (response_format json_object),
 * exactly like openai-content.ts. The owner frameworks in
 * src/lib/mothermode/community/frameworks are injected as authoritative
 * guidance so swapping a framework visibly changes that section's output
 * without touching this file. Never import from a browser bundle.
 */
import {
  blankKit,
  normalizeIntake,
  normalizeKit,
  platformHint,
  type CommunityIntake,
  type CommunityKit,
  type CommunityType,
  type KitSection,
} from '@/lib/mothermode/community/types';


import { COMMUNITY_FRAMEWORKS } from '@/lib/mothermode/community/frameworks';
import { getTextModel, type TextProvider } from '@/lib/mothermode/content/models';
import {
  getOpenAiKey,
  getAnthropicKey,
  getTextModelOverride,
  getTextProviderOverride,
} from './runtime-config';

const OPENAI_BASE = 'https://api.openai.com/v1';
const ANTHROPIC_BASE = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';

/** Frontier defaults per provider, matching the content hub. */
const DEFAULT_OPENAI_TEXT_MODEL = 'gpt-5.5';
const DEFAULT_ANTHROPIC_TEXT_MODEL = 'claude-opus-4-8';


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
function intakeBrief(intake: CommunityIntake, communityType: CommunityType): string {
  const hint = platformHint(intake.platform);
  const lines = [
    `Community type: ${communityType}`,
    `Niche: ${intake.niche}`,
    `Audience / avatar: ${intake.audience}`,
    `Core promise / result: ${intake.promise}`,
    `Unexpected way / mechanism: ${intake.unexpectedWay}`,
    `Pains and obstacles: ${intake.pains}`,
    `Platform: ${intake.platform}`,
    hint ? `Platform notes (tailor formatting/CTA to this): ${hint}` : '',
    `Primary goal / conversion (drives every CTA): ${intake.goal}`,
    `Next step the community leads to: ${intake.nextStep}`,
    `Price point (if any): ${intake.price}`,
    `Lead magnet / welcome asset: ${intake.freebie}`,
    `Tone / brand voice: ${intake.tone}`,
    `Extra notes: ${intake.notes}`,
  ];
  return lines.filter((l) => l && !l.endsWith(': ')).join('\n');
}


/** Which audiences to produce qualifying questions for, from the type. */
function audiencesFor(type: CommunityType): Array<'paid' | 'free'> {
  if (type === 'both') return ['paid', 'free'];
  return [type];
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

/**
 * Resolve the text provider + model the same way the content hub does, so this
 * generator never hard-fails on an invalid default. A known catalog model in
 * the override wins and carries its provider (when that key exists); otherwise
 * prefer Anthropic when its key is present, then OpenAI, each with its frontier
 * default. This is why the content hub works while a hardcoded OpenAI default
 * would 400 on accounts without that model.
 */
async function resolveTextConfig(): Promise<
  { ok: true; provider: TextProvider; model: string; key: string } | { ok: false; error: string }
> {
  const [openaiKey, anthropicKey] = await Promise.all([
    getOpenAiKey(),
    getAnthropicKey(),
  ]);
  if (!openaiKey && !anthropicKey) {
    return { ok: false, error: 'No AI text provider is configured (set an OpenAI or Anthropic key).' };
  }

  const overrideModel = await getTextModelOverride();
  const overridePick = getTextModel(overrideModel);
  if (overridePick) {
    const key = overridePick.provider === 'anthropic' ? anthropicKey : openaiKey;
    if (key) return { ok: true, provider: overridePick.provider, model: overridePick.id, key };
  }

  const pref = (await getTextProviderOverride())?.toLowerCase();
  if (pref === 'anthropic' && anthropicKey) {
    return { ok: true, provider: 'anthropic', model: overrideModel || DEFAULT_ANTHROPIC_TEXT_MODEL, key: anthropicKey };
  }
  if (pref === 'openai' && openaiKey) {
    return { ok: true, provider: 'openai', model: overrideModel || DEFAULT_OPENAI_TEXT_MODEL, key: openaiKey };
  }
  if (anthropicKey) {
    return { ok: true, provider: 'anthropic', model: DEFAULT_ANTHROPIC_TEXT_MODEL, key: anthropicKey };
  }
  return { ok: true, provider: 'openai', model: DEFAULT_OPENAI_TEXT_MODEL, key: openaiKey! };
}

async function callOpenAiJson<T>(
  system: string,
  user: string,
): Promise<AiResult<T>> {
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
          // Claude has no json_object mode; instruct JSON-only and parse tolerantly.

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
      const payload = (await res.json()) as {
        content?: Array<{ text?: string }>;
      };
      raw = payload.content?.map((c) => c.text ?? '').join('') ?? '';
    } else {
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

function fullKitSystem(type: CommunityType): string {
  const audiences = audiencesFor(type);
  return [
    'You are a launch strategist producing a complete community launch kit.',
    'Return ONE JSON object matching the schema below. No prose outside the JSON.',
    '',
    VOICE_RULES,
    '',
    'FRAMEWORKS (authoritative — follow their structure, fill specifics from the brief):',
    '',
    '## Name and description',
    COMMUNITY_FRAMEWORKS.namesDescription,
    '',
    '## Qualifying questions',
    COMMUNITY_FRAMEWORKS.qualifyingQuestions,
    '',
    '## DM scripts',
    COMMUNITY_FRAMEWORKS.dmScripts,
    '',
    ...(type !== 'free'
      ? ['## Sales call', COMMUNITY_FRAMEWORKS.salesCall, '']
      : []),
    '## Ads style',
    COMMUNITY_FRAMEWORKS.adsStyle,
    '',
    '## Lead form',
    COMMUNITY_FRAMEWORKS.leadForm,
    '',
    '## Pinned post',
    COMMUNITY_FRAMEWORKS.pinnedPost,
    '',
    'JSON SCHEMA (exact keys):',
    '{',
    '  "nameOptions": string[5],            // 5 distinct community name options',
    '  "chosenName": string,                // your single best pick from nameOptions',
    '  "description": string,               // public community description, 2-4 sentences',
    '  "qualifyingQuestions": {',
    `    ${audiences.map((a) => `"${a}": Question[3]`).join(', ')}   // EXACTLY 3 each`,
    '  },',
    '  "dmScript": { "stages": Stage[] },   // welcome, qualify, invite, reengage',
    type !== 'free'
      ? '  "salesCallScript": { "phases": Phase[] },  // full call script'
      : '  "salesCallScript": { "phases": [] },       // free community: leave empty',
    '  "ad": { "concept": string, "primaryText": string, "headline": string, "description": string, "imagePrompt": string },',
    '  "leadForm": { "headline": string, "description": string, "questions": string[], "completionHeadline": string, "completionDescription": string, "callToAction": string, "groupUrl": string },',
    '  "pinnedPost": string                 // the community\'s first pinned post',
    '}',
    '',
    'Question = { "prompt": string, "type": "multiple_choice"|"short_text"|"email", "options"?: string[], "required": boolean }',
    'Stage    = { "key": string, "label": string, "message": string }',
    'Phase    = { "key": string, "label": string, "lines": string[] }',
    '',
    'Rules: qualifyingQuestions must have EXACTLY 3 questions per audience, in the',
    'framework order (diagnose, email capture, next-step yes/no). headline <= 40',
    'chars, ad description <= 30 chars.',
  ].join('\n');
}

/** Generate a complete kit from the intake. */
export async function generateCommunityKit(
  intake: CommunityIntake,
  communityType: CommunityType,
): Promise<AiResult<CommunityKit>> {
  const system = fullKitSystem(communityType);
  const user = [
    'Produce the full community launch kit for this brief:',
    '',
    intakeBrief(intake, communityType),
  ].join('\n');

  const res = await callOpenAiJson<Record<string, unknown>>(system, user);
  if (!res.ok) return res;
  // normalizeKit guarantees the full shape even if the model omits a key.
  return { ok: true, data: normalizeKit(res.data) };
}

/**
 * Generate only the chosen sections (from the post-intake wizard). Runs each
 * selected section through the focused per-section generator in parallel and
 * merges the results onto a blank kit. Per-section generation gives each block
 * the full token budget and a tightly-scoped framework, which produces
 * noticeably better copy than one giant call. Unselected sections stay blank.
 */
export async function generateCommunityKitSections(
  intake: CommunityIntake,
  communityType: CommunityType,
  sections: KitSection[],
): Promise<AiResult<CommunityKit>> {
  const wanted = sections.filter((s) => (s === 'salesCall' ? communityType !== 'free' : true));
  if (wanted.length === 0) {
    return { ok: false, status: 400, error: 'Select at least one section to generate.' };
  }

  const results = await Promise.all(
    wanted.map((section) => regenerateKitSection(section, intake, communityType)),
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
 * complete, sensible CommunityIntake the admin can review and tweak before
 * generating the kit. Any field the admin already filled is treated as a fact
 * to honor, not overwrite; blanks get inferred. This is the "AI fill" that
 * turns baseline input into the full brief.
 */
export async function fillCommunityIntake(
  seed: Partial<CommunityIntake>,
  communityType: CommunityType,
): Promise<AiResult<CommunityIntake>> {
  const known = normalizeIntake(seed);
  const provided = Object.entries(known)
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  const system = [
    'You are a launch strategist completing a short community intake brief.',
    'Given whatever the admin has provided (often only the niche and audience),',
    'infer the most likely, specific, on-brand value for EVERY remaining field.',
    'Never overwrite a field the admin already filled: repeat it verbatim.',
    'Return ONE JSON object with exactly these keys and string values:',
    '{',
    '  "niche": string,          // market / topic',
    '  "audience": string,       // the avatar it is for',
    '  "promise": string,        // the core result / transformation',
    '  "unexpectedWay": string,  // the mechanism / unexpected way they get it',
    '  "pains": string,          // 3-5 real pains, one per line',
    '  "platform": string,       // Skool, Facebook Group, Circle, Discord, etc.',
    `  "goal": string,           // the conversion this ${communityType} community drives`,
    '  "nextStep": string,       // entry offer, strategy call, workshop, or webinar',
    '  "price": string,          // price point if paid, else "Free"',
    '  "freebie": string,        // named lead magnet / welcome asset',
    '  "tone": string,           // brand voice in a few words',
    '  "notes": string           // any extra guidance worth honoring',
    '}',
    '',
    VOICE_RULES,
    '',
    `This is a ${communityType} community. Make goal, nextStep, and price consistent`,
    'with that (a free community usually leads to a call, workshop, or webinar; a',
    'paid one names a price). Be concrete and realistic, not generic.',
  ].join('\n');

  const user = [
    'Complete the intake. Fields already provided (honor these exactly):',
    '',
    provided || '(none provided yet)',
  ].join('\n');

  const res = await callOpenAiJson<Record<string, unknown>>(system, user);
  if (!res.ok) return res;
  // Merge over the known seed so admin-provided values always win, then
  // normalize to guarantee the full shape.
  return { ok: true, data: normalizeIntake({ ...res.data, ...seed }) };
}

// ---------------------------------------------------------------------------
// Per-section regeneration
// ---------------------------------------------------------------------------


interface SectionSpec {
  /** Framework text to inject, if any. */
  framework?: string;
  /** JSON schema fragment for just this section's output. */
  schema: string;
  /** Extra instruction. */
  instruction: string;
}

function sectionSpec(section: KitSection, type: CommunityType): SectionSpec {
  const audiences = audiencesFor(type);
  switch (section) {
    case 'names':
      return {
        framework: COMMUNITY_FRAMEWORKS.names,
        schema: '{ "nameOptions": string[5], "chosenName": string }',
        instruction:
          'Produce 5 distinct community name options and pick your single best as chosenName. chosenName must be one of nameOptions verbatim.',
      };
    case 'description':
      return {
        framework: COMMUNITY_FRAMEWORKS.description,
        schema: '{ "description": string }',
        instruction:
          'Write the public community description in 2-4 sentences: who it is for, the promise, and what happens inside.',
      };
    case 'qualifyingQuestions':
      return {
        framework: COMMUNITY_FRAMEWORKS.qualifyingQuestions,
        schema: `{ "qualifyingQuestions": { ${audiences
          .map((a) => `"${a}": Question[3]`)
          .join(', ')} } }
Question = { "prompt": string, "type": "multiple_choice"|"short_text"|"email", "options"?: string[], "required": boolean }`,
        instruction:
          'Produce EXACTLY 3 questions per audience in framework order (diagnose, email capture, next-step yes/no).',
      };
    case 'dmScript':
      return {
        framework: COMMUNITY_FRAMEWORKS.dmScripts,
        schema: `{ "dmScript": { "stages": Stage[] } }
Stage = { "key": string, "label": string, "message": string }`,
        instruction: 'Produce the DM stages defined by the framework.',
      };
    case 'salesCall':
      return {
        framework: COMMUNITY_FRAMEWORKS.salesCall,
        schema: `{ "salesCallScript": { "phases": Phase[] } }
Phase = { "key": string, "label": string, "lines": string[] }`,
        instruction: 'Produce the full sales-call script by phase.',
      };
    case 'ad':
      return {
        framework: COMMUNITY_FRAMEWORKS.adsStyle,
        schema:
          '{ "ad": { "concept": string, "primaryText": string, "headline": string, "description": string, "imagePrompt": string } }',
        instruction:
          'Produce one ad concept that drives cold traffic to JOIN the community. headline <= 40 chars, description <= 30 chars.',
      };
    case 'leadForm':
      return {
        framework: COMMUNITY_FRAMEWORKS.leadForm,
        schema:
          '{ "leadForm": { "headline": string, "description": string, "questions": string[], "completionHeadline": string, "completionDescription": string, "callToAction": string, "groupUrl": string } }',
        instruction:
          'Produce paste-ready Meta lead-form copy that gets the right person to opt in for the free lead magnet and into the community toward the goal.',
      };
    case 'pinnedPost':
      return {
        framework: COMMUNITY_FRAMEWORKS.pinnedPost,
        schema: '{ "pinnedPost": string }',
        instruction:
          "Write the community's first pinned post: a warm welcome, deliver the freebie, one house rule, and the single next step that matches the goal.",
      };
    default:
      return { schema: '{}', instruction: '' };
  }
}

/** Regenerate a single section; returns a partial kit with only that section
 *  populated (merge into the current kit on the client/route). */
export async function regenerateKitSection(
  section: KitSection,
  intake: CommunityIntake,
  communityType: CommunityType,
  currentKit?: CommunityKit,
): Promise<AiResult<Partial<CommunityKit>>> {
  const spec = sectionSpec(section, communityType);
  const system = [
    'You are a launch strategist regenerating ONE section of a community launch kit.',
    'Return ONE JSON object with only the requested keys. No prose outside the JSON.',
    '',
    VOICE_RULES,
    ...(spec.framework ? ['', 'FRAMEWORK (authoritative):', spec.framework] : []),
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
        `Chosen name: ${currentKit.chosenName}`,
        `Description: ${currentKit.description}`,
      ].join('\n')
    : '';

  const user = [
    `Regenerate the "${section}" section for this brief:`,
    '',
    intakeBrief(intake, communityType),
    context,
  ].join('\n');

  const res = await callOpenAiJson<Record<string, unknown>>(system, user);
  if (!res.ok) return res;

  // Normalize a merged object so only the requested section is trusted, then
  // pick just that section out to return as a partial.
  const merged = normalizeKit({ ...(currentKit ?? blankKit()), ...res.data });
  const partial: Partial<CommunityKit> = {};
  switch (section) {
    case 'names':
      partial.nameOptions = merged.nameOptions;
      partial.chosenName = merged.chosenName;
      break;
    case 'description':
      partial.description = merged.description;
      break;
    case 'qualifyingQuestions':
      partial.qualifyingQuestions = merged.qualifyingQuestions;
      break;
    case 'dmScript':
      partial.dmScript = merged.dmScript;
      break;
    case 'salesCall':
      partial.salesCallScript = merged.salesCallScript;
      break;
    case 'ad':
      partial.ad = merged.ad;
      break;
    case 'leadForm':
      partial.leadForm = merged.leadForm;
      break;
    case 'pinnedPost':
      partial.pinnedPost = merged.pinnedPost;
      break;
  }
  return { ok: true, data: partial };
}
