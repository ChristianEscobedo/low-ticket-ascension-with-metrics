/**
 * Compliance agent (server-only): score + fix copy for brand voice and
 * platform ad policies. Uses the same text providers as openai-content.
 */
import type {
  ContentFormat,
  ContentKind,
  ContentPiece,
  ContentPlatform,
  ToneRegister,
} from '@/lib/mothermode/content/types';
import { applyFixes } from '@/lib/mothermode/content/compliance';
import {
  platformPolicyBrief,
  scoreLocalCompliance,
  type ComplianceGrade,
  type ComplianceIssue,
  type ComplianceIssueSeverity,
  type ComplianceScorecard,
  type ComplianceSource,
} from '@/lib/mothermode/content/platformCompliance';
import {
  getTextModel,
  type TextProvider,
} from '@/lib/mothermode/content/models';
import {
  getOpenAiKey,
  getAnthropicKey,
  getTextModelOverride,
  getTextProviderOverride,
} from './runtime-config';

export type AiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

const OPENAI_BASE = 'https://api.openai.com/v1';
const ANTHROPIC_BASE = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_OPENAI = 'gpt-5.5';
const DEFAULT_ANTHROPIC = 'claude-opus-4-8';

const VOICE_RULES = [
  'Never use em dashes or en dashes. Use periods or commas.',
  'No NO-list words (mama, thrive, journey, hustle, empower, balance, etc.).',
  'Periods over exclamation points. No ALL CAPS for emphasis.',
  'MotherMode: mental-load systems for mothers. Specific scenes. Soft CTA. Not medical, not income, not weight-loss.',
].join(' ');

async function availableProvider(
  preferred?: string | null,
): Promise<TextProvider> {
  const [oa, an] = await Promise.all([getOpenAiKey(), getAnthropicKey()]);
  const pref = preferred?.toLowerCase();
  if (pref === 'anthropic' && an) return 'anthropic';
  if (pref === 'openai' && oa) return 'openai';
  if (an) return 'anthropic';
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
        : await getOpenAiKey();
    if (key) return { provider: overridePick.provider, model: overridePick.id };
  }
  const provider = await availableProvider(overrideProvider);
  return {
    provider,
    model: provider === 'anthropic' ? DEFAULT_ANTHROPIC : DEFAULT_OPENAI,
  };
}

async function openAiJson(
  system: string,
  user: string,
  model: string,
): Promise<AiResult<string>> {
  const key = await getOpenAiKey();
  if (!key)
    return { ok: false, status: 501, error: 'OPENAI_API_KEY is not configured' };
  try {
    const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
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
        temperature: 0.2,
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

export interface ComplianceAgentPiece {
  hook?: string;
  hooks?: string[];
  caption?: string;
  body?: string[];
  cta?: string;
  title?: string;
  theme?: string;
  tone?: string;
  platform: string;
  format: string;
  kind: string;
  adPrimaryText?: string;
  adHeadline?: string;
  adDescription?: string;
  emailSubject?: string;
  emailPreheader?: string;
}

function pieceFromAgentInput(p: ComplianceAgentPiece): ContentPiece {
  return {
    id: 'compliance-temp',
    platform: (p.platform as ContentPlatform) || 'instagram',
    format: (p.format as ContentFormat) || 'feed',
    kind: (p.kind as ContentKind) || 'organic',
    tone: (p.tone as ToneRegister) || 'confidante',
    theme: p.theme || '',
    title: p.title || '',
    hook: p.hook || p.hooks?.[0] || '',
    hooks: p.hooks,
    caption: p.caption,
    body: p.body,
    cta: p.cta || '',
    ad:
      p.adPrimaryText || p.adHeadline
        ? {
            primaryText: p.adPrimaryText || '',
            headline: p.adHeadline || '',
            description: p.adDescription,
            button: 'LEARN_MORE',
          }
        : undefined,
    email: p.emailSubject
      ? { subject: p.emailSubject, preheader: p.emailPreheader }
      : undefined,
  };
}

function copyBlock(p: ComplianceAgentPiece): string {
  const lines: string[] = [];
  if (p.title) lines.push(`Title: ${p.title}`);
  if (p.hooks?.length)
    p.hooks.forEach((h, i) => lines.push(`Hook[${i}]: ${h}`));
  else if (p.hook) lines.push(`Hook: ${p.hook}`);
  if (p.caption) lines.push(`Caption: ${p.caption}`);
  if (p.body?.length) lines.push(`Body:\n${p.body.join('\n\n')}`);
  if (p.cta) lines.push(`CTA: ${p.cta}`);
  if (p.adPrimaryText) lines.push(`Ad primary: ${p.adPrimaryText}`);
  if (p.adHeadline) lines.push(`Ad headline: ${p.adHeadline}`);
  if (p.adDescription) lines.push(`Ad description: ${p.adDescription}`);
  if (p.emailSubject) lines.push(`Email subject: ${p.emailSubject}`);
  if (p.emailPreheader) lines.push(`Email preheader: ${p.emailPreheader}`);
  return lines.join('\n');
}

function parseIssue(raw: unknown, idx: number): ComplianceIssue | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const message = typeof r.message === 'string' ? r.message.trim() : '';
  if (!message) return null;
  const sevRaw = String(r.severity || 'warn').toLowerCase();
  const severity: ComplianceIssueSeverity =
    sevRaw === 'block' || sevRaw === 'error'
      ? 'block'
      : sevRaw === 'note'
        ? 'note'
        : 'warn';
  const srcRaw = String(r.source || 'general').toLowerCase();
  const allowed: ComplianceSource[] = [
    'brand',
    'meta',
    'tiktok',
    'google',
    'x',
    'email',
    'pinterest',
    'general',
  ];
  const source = (
    allowed.includes(srcRaw as ComplianceSource) ? srcRaw : 'general'
  ) as ComplianceSource;
  const fixRaw = String(r.fixable || 'ai').toLowerCase();
  const fixable =
    fixRaw === 'deterministic' || fixRaw === 'manual' ? fixRaw : 'ai';
  return {
    id: typeof r.id === 'string' && r.id.trim() ? r.id.trim() : `ai-${idx}`,
    severity,
    source,
    field:
      typeof r.field === 'string' && r.field.trim() ? r.field.trim() : 'copy',
    message,
    match: typeof r.match === 'string' ? r.match : undefined,
    suggestion: typeof r.suggestion === 'string' ? r.suggestion : undefined,
    fixable: fixable as ComplianceIssue['fixable'],
  };
}

function parseGrade(v: unknown): ComplianceGrade | undefined {
  const s = String(v || '').toLowerCase();
  if (s === 'pass' || s === 'review' || s === 'fail') return s;
  return undefined;
}

/** AI compliance score on top of local heuristics. */
export async function scoreComplianceWithAgent(input: {
  piece: ComplianceAgentPiece;
  local?: ComplianceScorecard;
  model?: string;
}): Promise<AiResult<ComplianceScorecard>> {
  const piece = pieceFromAgentInput(input.piece);
  const local = input.local ?? scoreLocalCompliance(piece);
  const { provider, model } = await resolveModel(input.model);
  const policy = platformPolicyBrief(input.piece.platform, input.piece.kind);
  const system = [
    'You are the MotherMode compliance agent for social and paid ads.',
    'Score copy 0-100 for brand voice AND platform ad policy risk.',
    'Grades: pass (85+ no blocks), review (60-84 or warnings), fail (under 60 or any block).',
    'Return ONLY valid JSON. No prose, no code fences. No em dashes in any string.',
    VOICE_RULES,
    policy,
  ].join(' ');
  const user = [
    `Platform: ${input.piece.platform} | format: ${input.piece.format} | kind: ${input.piece.kind}`,
    `Local score already computed: ${local.score} (${local.grade}). brand=${local.brandScore} platform=${local.platformScore}.`,
    `Local issues (${local.issues.length}):`,
    local.issues
      .slice(0, 40)
      .map(
        (i) =>
          `- [${i.severity}/${i.source}] ${i.field}: ${i.message}${
            i.match ? ` ("${i.match}")` : ''
          }`,
      )
      .join('\n') || '(none)',
    'Copy to judge:',
    copyBlock(input.piece),
    'JSON shape:',
    '{ "score": number, "grade": "pass"|"review"|"fail", "brandScore": number, "platformScore": number, "claimScore": number, "summary": string, "issues": [ { "id", "severity", "source", "field", "message", "match?", "suggestion?", "fixable": "ai"|"manual"|"deterministic" } ] }',
    'Include local issues you still agree with plus any new AI-found issues. Prefer field paths like hooks[0], caption, body, ad.primaryText, ad.headline, email.subject.',
  ].join('\n\n');

  const raw =
    provider === 'anthropic'
      ? await anthropicJson(system, user, model)
      : await openAiJson(system, user, model);
  if (!raw.ok) return raw;
  const parsed = parseJsonObject(raw.data);
  if (!parsed) {
    return { ok: false, status: 502, error: 'No compliance score was returned' };
  }
  const issues: ComplianceIssue[] = [];
  const list = Array.isArray(parsed.issues) ? parsed.issues : [];
  list.forEach((it: unknown, i: number) => {
    const issue = parseIssue(it, i);
    if (issue) issues.push(issue);
  });
  for (const li of local.issues) {
    if (
      li.severity === 'block' &&
      !issues.some(
        (x) =>
          x.id === li.id ||
          (x.field === li.field && x.message === li.message),
      )
    ) {
      issues.push(li);
    }
  }
  const blockCount = issues.filter((i) => i.severity === 'block').length;
  const warnCount = issues.filter((i) => i.severity === 'warn').length;
  const noteCount = issues.filter((i) => i.severity === 'note').length;
  let score =
    typeof parsed.score === 'number' && Number.isFinite(parsed.score)
      ? Math.max(0, Math.min(100, Math.round(parsed.score)))
      : local.score;
  if (blockCount > 0 && score >= 85) score = Math.min(score, 59);
  const grade =
    parseGrade(parsed.grade) ||
    (blockCount > 0 || score < 60
      ? 'fail'
      : score < 85
        ? 'review'
        : 'pass');

  const card: ComplianceScorecard = {
    score,
    grade,
    brandScore:
      typeof parsed.brandScore === 'number'
        ? Math.max(0, Math.min(100, Math.round(parsed.brandScore)))
        : local.brandScore,
    platformScore:
      typeof parsed.platformScore === 'number'
        ? Math.max(0, Math.min(100, Math.round(parsed.platformScore)))
        : local.platformScore,
    claimScore:
      typeof parsed.claimScore === 'number'
        ? Math.max(0, Math.min(100, Math.round(parsed.claimScore)))
        : local.claimScore,
    blockCount,
    warnCount,
    noteCount,
    issues,
    summary:
      typeof parsed.summary === 'string' && parsed.summary.trim()
        ? parsed.summary.replace(/[\u2014\u2013]/g, ',')
        : local.summary,
    platformPack: local.platformPack,
    isAd: local.isAd,
    scoredAt: new Date().toISOString(),
    model,
  };
  return { ok: true, data: card };
}

export interface ComplianceFixOut {
  patch: {
    hooks?: string[];
    caption?: string;
    body?: string;
    adPrimaryText?: string;
    adHeadline?: string;
    adDescription?: string;
    emailSubject?: string;
    emailPreheader?: string;
  };
  changelog: string[];
  model: string;
}

/** AI rewrite of non-compliant fields into a safe edits patch. */
export async function fixComplianceWithAgent(input: {
  piece: ComplianceAgentPiece;
  issues?: ComplianceIssue[];
  model?: string;
}): Promise<AiResult<ComplianceFixOut>> {
  const piece = pieceFromAgentInput(input.piece);
  const local = scoreLocalCompliance(piece);
  const focus =
    input.issues && input.issues.length > 0
      ? input.issues
      : local.issues.filter(
          (i) => i.severity === 'block' || i.severity === 'warn',
        );
  const { provider, model } = await resolveModel(input.model);
  const policy = platformPolicyBrief(input.piece.platform, input.piece.kind);
  const system = [
    'You are the MotherMode compliance fix agent.',
    'Rewrite ONLY the fields needed so copy passes brand voice and platform ad policy.',
    'Keep meaning and MotherMode tone. Soft CTA. Specific scenes. No em or en dashes. No NO-list words. No ALL CAPS emphasis. Periods over exclamation points.',
    'Do not invent medical, income, or guaranteed-outcome claims.',
    'Return ONLY valid JSON. No prose, no code fences.',
    VOICE_RULES,
    policy,
  ].join(' ');
  const user = [
    `Platform: ${input.piece.platform} | format: ${input.piece.format} | kind: ${input.piece.kind}`,
    'Issues to fix:',
    focus
      .map((i) => `- [${i.severity}/${i.source}] ${i.field}: ${i.message}`)
      .join('\n') || '(general cleanup)',
    'Current copy:',
    copyBlock(input.piece),
    'JSON shape (include only fields you change):',
    '{ "changelog": string[], "hooks"?: string[], "caption"?: string, "body"?: string, "adPrimaryText"?: string, "adHeadline"?: string, "adDescription"?: string, "emailSubject"?: string, "emailPreheader"?: string }',
    'body is the full body as paragraphs separated by blank lines. hooks is the full hooks array when any hook changes.',
  ].join('\n\n');

  const raw =
    provider === 'anthropic'
      ? await anthropicJson(system, user, model)
      : await openAiJson(system, user, model);
  if (!raw.ok) return raw;
  const parsed = parseJsonObject(raw.data);
  if (!parsed) {
    return { ok: false, status: 502, error: 'No compliance fix was returned' };
  }
  const clean = (s: unknown) =>
    typeof s === 'string' && s.trim() ? applyFixes(s) : undefined;
  const hooks = Array.isArray(parsed.hooks)
    ? (parsed.hooks as unknown[])
        .filter((h) => typeof h === 'string' && String(h).trim())
        .map((h) => applyFixes(String(h)))
    : undefined;
  const patch = {
    hooks: hooks && hooks.length ? hooks : undefined,
    caption: clean(parsed.caption),
    body: clean(parsed.body),
    adPrimaryText: clean(parsed.adPrimaryText),
    adHeadline: clean(parsed.adHeadline),
    adDescription: clean(parsed.adDescription),
    emailSubject: clean(parsed.emailSubject),
    emailPreheader: clean(parsed.emailPreheader),
  };
  const hasAny = Object.values(patch).some((v) =>
    Array.isArray(v) ? v.length > 0 : typeof v === 'string' && v.length > 0,
  );
  if (!hasAny) {
    return { ok: false, status: 502, error: 'Agent returned no field changes' };
  }
  const changelog = Array.isArray(parsed.changelog)
    ? (parsed.changelog as unknown[])
        .filter((c) => typeof c === 'string')
        .map((c) => applyFixes(String(c)))
    : ['Rewrote flagged fields for compliance.'];
  return { ok: true, data: { patch, changelog, model } };
}
