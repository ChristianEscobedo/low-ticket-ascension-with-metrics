/**
 * Email Marketing Kit generator (server-only). Turns an intake + chosen campaign
 * + framework + resolved context packs into a complete EmailSequence.
 *
 * The campaign blueprint (roles + timing + per-role framework) is authoritative
 * and built deterministically in code, so the model never decides how many
 * emails to write or what each one is for. The passes only write COPY:
 *
 *   - aiFillIntake:      flesh a thin brief into a complete EmailKitIntake.
 *   - aiOutline:         from the blueprint, write each email's subject +
 *                        preview + one-line summary (bodies left empty).
 *   - aiExpandEmail:     write one email's body + subject ideas + CTA, given the
 *                        whole outline so emails do not repeat each other.
 *   - aiGenerateSequence: outline then expand every email in order.
 *
 * Talks to OpenAI chat/completions in JSON mode with an Anthropic fallback,
 * exactly like openai-leadgen.ts. Every response is coerced through the
 * defensive normalizers in the email types module, so a malformed reply
 * degrades to blanks rather than throwing. Never import from a browser bundle.
 */
import {
  blankEmail,
  makeEmailId,
  normalizeEmail,
  normalizeIntake,
  toEmailFramework,
  type EmailKitIntake,
  type EmailCampaignType,
  type EmailFramework,
  type EmailMessage,
  type EmailPsFramework,
  type EmailSequence,
} from '@/lib/mothermode/email/types';

import { campaignSpec, scaleTiming } from '@/lib/mothermode/email/campaigns';
import { frameworkSpec } from '@/lib/mothermode/email/frameworks';
import {
  contextPacksToPromptBlock,
  type ContextPack,
} from '@/lib/mothermode/context';
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

const DEFAULT_OPENAI_TEXT_MODEL = 'gpt-5.5';
const DEFAULT_ANTHROPIC_TEXT_MODEL = 'claude-opus-4-8';

export type AiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

// ---------------------------------------------------------------------------
// Voice + provider plumbing (mirrors openai-leadgen.ts)
// ---------------------------------------------------------------------------

const VOICE_RULES = `
VOICE AND COMPLIANCE (always):
- Calm authority. Specific over clever. Lead with the reader, never the sale.
- Periods over exclamation points. No em dashes or en dashes; use commas,
  periods, or a colon.
- No hype, no false scarcity, no income/earnings claims, no medical claims.
- Plain, concrete language a real person would say out loud.
- One clear call to action per email.
`.trim();

/**
 * Readability + formatting contract shared by every body-writing pass. This is
 * what makes the copy skimmable and "designed" rather than a wall of text.
 */
const FORMATTING_RULES = `
FORMATTING AND READABILITY (always):
- Super digestible. Keep every paragraph to 1-3 sentences MAX. Never write a
  long block of text. Prefer short lines with white space between them.
- Open with a strong HOOK in the first 1-2 lines: a pattern-interrupt, a
  question, or a bold claim that earns the next line. No slow warm-ups.
- Use a short HEADLINE at the top and SUB-HEADLINES to break up sections so the
  email is scannable in five seconds.
- BOLD the 3-6 words or short phrases that carry the meaning, spaced naturally
  through the copy the way a good copywriter does. Do not bold whole sentences.
- Use bullet lists for any run of 3+ parallel points.
- Place a clear call-to-action BUTTON on its own line where the reader is most
  likely to act. Mark it exactly as [BUTTON: label -> URL] (URL may be a
  placeholder like [OFFER_URL]).
- Where a visual would help, mark an image slot on its own line as
  [IMAGE: one-line description of the visual]. Use at most one or two per email.
- Inline links read as natural anchor text, never a raw URL pasted in prose.
`.trim();


type TextConfig =
  | { ok: true; provider: TextProvider; model: string; key: string }
  | { ok: false; error: string };

async function resolveTextConfig(): Promise<TextConfig> {
  const openaiKey = await getOpenAiKey();
  const anthropicKey = await getAnthropicKey();
  if (!openaiKey && !anthropicKey) {
    return { ok: false, error: 'No AI provider key configured.' };
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

/** Parse a JSON object from a model reply, tolerating markdown fences. */
function parseJson<T>(raw: string): T | null {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
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
// Prompt context
// ---------------------------------------------------------------------------

function intakeContext(
  intake: EmailKitIntake,
  campaignType: EmailCampaignType,
  packs: ContextPack[],
): string {
  const campaign = campaignSpec(campaignType);
  const contextBlock = contextPacksToPromptBlock(packs, 'content');
  return `CAMPAIGN: ${campaign.label}
CAMPAIGN GOAL: ${campaign.goal}
STRATEGY: ${campaign.strategyNote}

INTAKE BRIEF:
- Audience: ${intake.audience || '(unspecified)'}
- Goal: ${intake.goal || campaign.goal}
- Sender name: ${intake.senderName || '(the founder)'}
- Tone / voice: ${intake.tone || '(default calm, plain-spoken authority)'}
- Timing style: ${intake.timingStyle}
- Notes: ${intake.notes || '(none)'}
${contextBlock ? `\n${contextBlock}` : ''}`;
}

/** Resolve the framework used for a role: campaign override, else kit default. */
function frameworkForRole(
  campaignType: EmailCampaignType,
  role: EmailMessage['role'],
  kitFramework: EmailFramework,
): EmailFramework {
  const byRole = campaignSpec(campaignType).frameworkByRole?.[role];
  return byRole ?? kitFramework;
}

/** Drop empty string fields so they don't overwrite model output. */
function pruneEmpty(intake: EmailKitIntake): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(intake)) {
    if (typeof v === 'string' && v.trim()) out[k] = v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Deterministic skeleton from the campaign blueprint
// ---------------------------------------------------------------------------

/**
 * Build the email skeleton from the campaign blueprint: one EmailMessage per
 * role, in order, with scaled send-offsets and the resolved per-role framework.
 * All copy fields start empty; the passes below fill them.
 */
export function buildSkeleton(
  campaignType: EmailCampaignType,
  kitFramework: EmailFramework,
  timingStyle: EmailKitIntake['timingStyle'],
): EmailMessage[] {
  const campaign = campaignSpec(campaignType);
  const timing = scaleTiming(campaign.defaultTiming, timingStyle);
  return campaign.emailRoles.map((role, i) => ({
    ...blankEmail(makeEmailId()),
    role,
    framework: frameworkForRole(campaignType, role, kitFramework),
    sendOffset: timing[i] ?? campaign.defaultTiming[i] ?? '+1d',
  }));
}

// ---------------------------------------------------------------------------
// Pass 1: fill intake
// ---------------------------------------------------------------------------

const INTAKE_SYSTEM = `You are a senior lifecycle-email strategist. You expand a thin
campaign brief into a complete, specific intake. Keep the owner's given values;
only fill blanks and sharpen vague ones. Respond with a JSON object with exactly
these string keys: audience, goal, senderName, tone, offerSlug, timingStyle,
notes. "timingStyle" must be one of: aggressive, standard, gentle.

${VOICE_RULES}`;

export async function aiFillIntake(
  intake: EmailKitIntake,
  campaignType: EmailCampaignType,
): Promise<AiResult<EmailKitIntake>> {
  const campaign = campaignSpec(campaignType);
  const user = `We are producing a "${campaign.label}" campaign whose goal is: ${campaign.goal}. Complete this intake.\n\n${JSON.stringify(
    intake,
    null,
    2,
  )}`;
  const res = await callOpenAiJson<Record<string, unknown>>(INTAKE_SYSTEM, user);
  if (!res.ok) return res;
  return { ok: true, data: normalizeIntake({ ...res.data, ...pruneEmpty(intake) }) };
}

// ---------------------------------------------------------------------------
// Pass 2: outline (subjects + previews + summaries for the fixed skeleton)
// ---------------------------------------------------------------------------

const OUTLINE_SYSTEM = `You are an expert email copywriter. You are given a FIXED
sequence of emails (roles, order, and timing are already decided). Write ONLY the
routing copy for each email: a subject line, inbox preview text, and a one-line
summary of what the body will accomplish. Do NOT write bodies yet. Respond with a
JSON object:
{
  "name": string,          // a short name for the whole sequence
  "goal": string,          // one line: what the sequence achieves
  "emails": [ { "id": string, "subject": string, "preview": string, "summary": string } ]
}
Return exactly one entry per provided email id, in the same order. Subjects are
specific and curiosity-driven without clickbait. Keep every promise deliverable.

${VOICE_RULES}`;

export async function aiOutline(
  intake: EmailKitIntake,
  campaignType: EmailCampaignType,
  kitFramework: EmailFramework,
  packs: ContextPack[],
  skeleton?: EmailMessage[],
): Promise<AiResult<EmailSequence>> {
  const emails = skeleton ?? buildSkeleton(campaignType, kitFramework, intake.timingStyle);
  const roster = emails
    .map(
      (e, i) =>
        `${i + 1}. id=${e.id} · role=${e.role} · framework=${e.framework} · send=${e.sendOffset}`,
    )
    .join('\n');

  const user = `${intakeContext(intake, campaignType, packs)}

FIXED SEQUENCE (write routing copy for each, same order and ids):
${roster}`;

  const res = await callOpenAiJson<{
    name?: unknown;
    goal?: unknown;
    emails?: unknown;
  }>(OUTLINE_SYSTEM, user);
  if (!res.ok) return res;

  const byId = new Map<string, Record<string, unknown>>();
  if (Array.isArray(res.data.emails)) {
    for (const raw of res.data.emails) {
      if (raw && typeof raw === 'object') {
        const rec = raw as Record<string, unknown>;
        if (typeof rec.id === 'string') byId.set(rec.id, rec);
      }
    }
  }

  const merged: EmailMessage[] = emails.map((e, i) => {
    // Prefer id match, else fall back to positional order.
    const hit =
      byId.get(e.id) ??
      (Array.isArray(res.data.emails)
        ? (res.data.emails[i] as Record<string, unknown> | undefined)
        : undefined);
    return {
      ...e,
      subject: typeof hit?.subject === 'string' ? hit.subject : '',
      preview: typeof hit?.preview === 'string' ? hit.preview : '',
      summary: typeof hit?.summary === 'string' ? hit.summary : '',
    };
  });

  return {
    ok: true,
    data: {
      name: typeof res.data.name === 'string' ? res.data.name : campaignSpec(campaignType).label,
      goal: typeof res.data.goal === 'string' ? res.data.goal : campaignSpec(campaignType).goal,
      // Phase 2: entry trigger. The model doesn't pick this; default to 'optin'
      // (the editor lets an admin change it) so the shape stays valid.
      trigger: 'optin' as const,
      emails: merged,

    },
  };
}

// ---------------------------------------------------------------------------
// Pass 3: expand one email
// ---------------------------------------------------------------------------

/** The body-copy contract varies by requested format (plain vs light HTML). */
export type EmailBodyFormat = 'text' | 'html';

/** How long the body should run, relative to the framework's default target. */
export type EmailBodyLength = 'default' | 'short' | 'long';

function bodyLengthRule(length: EmailBodyLength, frameworkTarget: string): string {
  switch (length) {
    case 'short':
      return `LENGTH TARGET: SHORT-FORM. Keep it tight and skimmable, noticeably
shorter than usual (roughly 90-150 words). Cut throat-clearing; every line earns
its place. (Framework default for reference: ${frameworkTarget}.)`;
    case 'long':
      return `LENGTH TARGET: LONG-FORM. Write a thorough, immersive email
(roughly 350-600 words) with fuller stories, examples, and detail, while staying
on-message. (Framework default for reference: ${frameworkTarget}.)`;
    default:
      return `LENGTH TARGET: ${frameworkTarget}`;
  }
}

function bodyFormatRule(format: EmailBodyFormat): string {
  return format === 'html'
    ? `Write the full body as CLEAN, SEMANTIC HTML using ONLY these tags:
<h2>, <h3>, <p>, <strong>, <em>, <ul>, <ol>, <li>, <a href="…">. Use <h2> for the
headline and <h3> for sub-headlines. Wrap every paragraph in <p>…</p> and keep
each <p> to 1-3 sentences. Use <strong> for the few words that carry meaning.
Keep the [BUTTON: label -> URL] and [IMAGE: description] markers on their own
lines exactly as written. No inline styles, no classes, no <div>/<span>, no
scripts.`
    : `Write the full body as PLAIN TEXT. Put the headline on the first line and
sub-headlines on their own lines. Separate paragraphs with a blank line and keep
each to 1-3 sentences. Bullet lists are lines that begin with "- ". Mark emphasis
by wrapping key words in *asterisks*. Keep the [BUTTON: label -> URL] and
[IMAGE: description] markers on their own lines. No HTML.`;
}

/**
 * Per-P.S.-framework guidance. Each string tells the model how to write the
 * post-script for that selling angle. 'none' has no entry (no P.S. is added).
 */
const PS_FRAMEWORK_GUIDANCE: Record<
  Exclude<EmailPsFramework, 'none'>,
  string
> = {
  'free-or-paid-resource': `Point to ONE free or paid resource that solves a
specific roadblock you just discussed. Name the resource, say in one line who it
is for and what it unlocks, then link it with natural anchor text.`,
  'offer-limited-spots': `Introduce the core program and state plainly that only
a few spots are open right now. One line on who it is for, one line on the
transformation, then a clear "Apply here" link. No invented numbers.`,
  'offer-promotion': `Invite the reader into the program in a warm, personal
voice. Promise the specific help you will give them inside, note you take a
limited number of clients, then a single "Apply here" ask.`,
  'sending-traffic': `Reference a recent post or announcement on a named platform
(LinkedIn, Instagram, Facebook, YouTube). Tease what it covers in one line and
send them to check it out. End with a single curiosity emoji like 👀.`,
  'handling-objections': `Open with "Love the idea of X, but feel Y?" Normalize
the objection in one line, reframe it as a good sign, then bridge to the resource
that resolves it and link it. Empathetic, never pushy.`,
  'booking-call': `Offer a consultation call. State the format plainly: price (or
free), duration, and that there is no pitch at the end, just help. Then a "Book
your slot here" link. Optionally note that if no times appear, it is fully
booked.`,
  'low-ticket-offer': `Present a low-cost resource or guide as an easy yes. One
line on the outcome it delivers, name it, then "Grab your copy here." Keep the
risk and price feel small.`,
};

/** Build the P.S. instruction block for the chosen framework, or '' for none. */
function psBlock(ps: EmailPsFramework): string {
  if (ps === 'none') return '';
  return `\nADD A POST-SCRIPT: End the email with a P.S. on its own line,
starting literally with "P.S." Write it in this framework:
${PS_FRAMEWORK_GUIDANCE[ps]}
Keep the P.S. to 2-4 short sentences and honor all voice + compliance rules.`;
}

function expandSystem(format: EmailBodyFormat): string {
  return `You are an expert email copywriter writing ONE email in a
larger sequence. Follow the given framework structure exactly.
${bodyFormatRule(format)}
Respond with a JSON object:
{
  "subject": string,
  "subjectIdeas": string[],   // 2-3 alternate subject lines
  "preview": string,          // inbox preview text
  "bodyText": string,         // the full email body, in the format above
  "cta": { "label": string, "url": string }   // url may be a placeholder like [OFFER_URL]
}
Do not repeat content already covered by earlier emails in the outline.

${FORMATTING_RULES}

${VOICE_RULES}`;
}


export async function aiExpandEmail(
  intake: EmailKitIntake,
  campaignType: EmailCampaignType,
  email: EmailMessage,
  allEmails: EmailMessage[],
  packs: ContextPack[],
  bodyFormat: EmailBodyFormat = 'text',
  bodyLength: EmailBodyLength = 'default',
): Promise<AiResult<EmailMessage>> {
  const spec = frameworkSpec(email.framework);
  const outline = allEmails
    .map((e, i) => `${i + 1}. [${e.role}] ${e.subject || e.summary}`)
    .join('\n');

  const user = `${intakeContext(intake, campaignType, packs)}

FULL OUTLINE (for context, do not rewrite other emails):
${outline}

WRITE THIS EMAIL ONLY:
- Role in sequence: ${email.role}
- Send timing: ${email.sendOffset}
- Planned subject: ${email.subject}
- Summary of its job: ${email.summary}

FRAMEWORK: ${spec.label}
${spec.structure}

${bodyLengthRule(bodyLength, spec.lengthTarget)}
STYLE: ${spec.styleNote}${psBlock(email.psFramework)}`;


  const res = await callOpenAiJson<{
    subject?: unknown;
    subjectIdeas?: unknown;
    preview?: unknown;
    bodyText?: unknown;
    cta?: unknown;
  }>(expandSystem(bodyFormat), user);
  if (!res.ok) return res;

  const merged = normalizeEmail({
    id: email.id,
    role: email.role,
    framework: email.framework,
    sendOffset: email.sendOffset,
    subject: typeof res.data.subject === 'string' ? res.data.subject : email.subject,
    subjectIdeas: res.data.subjectIdeas,
    preview: typeof res.data.preview === 'string' ? res.data.preview : email.preview,
    bodyText: res.data.bodyText,
    cta: res.data.cta,
    summary: email.summary,
    branch: email.branch,
    parentId: email.parentId,
    psFramework: email.psFramework,
  });
  return { ok: true, data: merged };

}

// ---------------------------------------------------------------------------
// Convenience: outline + expand every email
// ---------------------------------------------------------------------------

/**
 * Full build: outline, then expand each email sequentially so later emails see
 * the whole outline and avoid repeating earlier ground. Short-circuits on the
 * first failing pass.
 */
export async function aiGenerateSequence(
  intake: EmailKitIntake,
  campaignType: EmailCampaignType,
  kitFramework: EmailFramework,
  packs: ContextPack[],
  bodyFormat: EmailBodyFormat = 'text',
  bodyLength: EmailBodyLength = 'default',
): Promise<AiResult<EmailSequence>> {
  const framework = toEmailFramework(kitFramework);
  const skeleton = buildSkeleton(campaignType, framework, intake.timingStyle);
  const outline = await aiOutline(intake, campaignType, framework, packs, skeleton);
  if (!outline.ok) return outline;

  const seq = outline.data;
  const expanded: EmailMessage[] = [];
  for (const email of seq.emails) {
    const filled = await aiExpandEmail(intake, campaignType, email, seq.emails, packs, bodyFormat, bodyLength);
    if (!filled.ok) return filled;
    expanded.push(filled.data);
  }
  seq.emails = expanded;
  return { ok: true, data: seq };
}

// ---------------------------------------------------------------------------
// Extend: append more emails to an EXISTING sequence, with full look-back
// ---------------------------------------------------------------------------

/** How an extension block should behave relative to the existing sequence. */
export type EmailExtendMode = 'continue' | 'deep-nurture' | 'reengage';

const EXTEND_MODE_META: Record<
  EmailExtendMode,
  { role: EmailMessage['role']; note: string }
> = {
  continue: {
    role: 'nurture',
    note: 'Continue the existing arc naturally, advancing toward the same goal without repeating earlier ground.',
  },
  'deep-nurture': {
    role: 'nurture',
    note: 'Deepen the relationship: teach, tell stories, and build trust over a longer horizon before asking again. Value first, soft asks only.',
  },
  reengage: {
    role: 'reengage',
    note: 'Win back readers who went quiet: pattern-interrupt subjects, acknowledge the gap, and re-offer the core value plainly.',
  },
};

const EXTEND_OUTLINE_SYSTEM = `You are an expert lifecycle-email copywriter. You are
EXTENDING an existing sequence with additional emails. You are given the emails
already written (for look-back) and a list of NEW emails to plan. Write ONLY the
routing copy for the NEW emails: a subject line, inbox preview text, and a
one-line summary of what each new body will accomplish. Do NOT rewrite the
existing emails and do NOT write bodies yet. Respond with a JSON object:
{
  "emails": [ { "id": string, "subject": string, "preview": string, "summary": string } ]
}
Return exactly one entry per NEW email id, in the same order. Build on what was
already said; never repeat earlier emails.

${VOICE_RULES}`;

/**
 * Append `count` new emails to `existing`, planned and written with the whole
 * existing sequence as look-back context so the extension never repeats prior
 * ground. Returns ONLY the new emails (caller concatenates). Short-circuits on
 * the first failing pass.
 */
export async function aiExtendSequence(
  intake: EmailKitIntake,
  campaignType: EmailCampaignType,
  kitFramework: EmailFramework,
  existing: EmailMessage[],
  count: number,
  packs: ContextPack[],
  bodyFormat: EmailBodyFormat = 'text',
  bodyLength: EmailBodyLength = 'default',
  mode: EmailExtendMode = 'deep-nurture',
): Promise<AiResult<EmailMessage[]>> {
  const framework = toEmailFramework(kitFramework);
  const n = Math.max(1, Math.min(12, Math.floor(count) || 1));
  const meta = EXTEND_MODE_META[mode];

  // New skeleton: N blank emails in the chosen role/framework.
  const newSkeleton: EmailMessage[] = Array.from({ length: n }, () => ({
    ...blankEmail(makeEmailId()),
    role: meta.role,
    framework,
    sendOffset: '+2d',
  }));

  const priorRoster = existing
    .map((e, i) => `${i + 1}. [${e.role}] ${e.subject || e.summary || '(untitled)'}`)
    .join('\n');
  const newRoster = newSkeleton
    .map((e, i) => `${i + 1}. id=${e.id} · role=${e.role} · framework=${e.framework}`)
    .join('\n');

  const outlineUser = `${intakeContext(intake, campaignType, packs)}

EXTENSION MODE: ${mode} — ${meta.note}

EMAILS ALREADY WRITTEN (look-back only, do not rewrite):
${priorRoster || '(none)'}

NEW EMAILS TO PLAN (write routing copy for each, same order and ids):
${newRoster}`;

  const outlineRes = await callOpenAiJson<{ emails?: unknown }>(
    EXTEND_OUTLINE_SYSTEM,
    outlineUser,
  );
  if (!outlineRes.ok) return outlineRes;

  const byId = new Map<string, Record<string, unknown>>();
  if (Array.isArray(outlineRes.data.emails)) {
    for (const raw of outlineRes.data.emails) {
      if (raw && typeof raw === 'object') {
        const rec = raw as Record<string, unknown>;
        if (typeof rec.id === 'string') byId.set(rec.id, rec);
      }
    }
  }

  const outlinedNew: EmailMessage[] = newSkeleton.map((e, i) => {
    const hit =
      byId.get(e.id) ??
      (Array.isArray(outlineRes.data.emails)
        ? (outlineRes.data.emails[i] as Record<string, unknown> | undefined)
        : undefined);
    return {
      ...e,
      subject: typeof hit?.subject === 'string' ? hit.subject : '',
      preview: typeof hit?.preview === 'string' ? hit.preview : '',
      summary: typeof hit?.summary === 'string' ? hit.summary : '',
    };
  });

  // Expand each new email with the FULL sequence (existing + new) as context.
  const fullOutline = [...existing, ...outlinedNew];
  const expanded: EmailMessage[] = [];
  for (const email of outlinedNew) {
    const filled = await aiExpandEmail(
      intake,
      campaignType,
      email,
      fullOutline,
      packs,
      bodyFormat,
      bodyLength,
    );
    if (!filled.ok) return filled;
    expanded.push(filled.data);
  }

  return { ok: true, data: expanded };
}


