/**
 * Email sequence AI insights (server-only). Analyzes a sequence + its analytics
 * and produces structured, actionable recommendations.
 *
 * Unlike the generation module (which writes copy), this module READS the
 * sequence + stats + enrollment data and DIAGNOSES problems: drop-off points,
 * subject line weaknesses, pacing issues, content gaps, and projected impact.
 *
 * Every response is coerced through defensive normalizers so a malformed reply
 * degrades to an empty insight list rather than throwing. Never import from a
 * browser bundle.
 */
import type { EmailSequence } from '@/lib/mothermode/email/types';
import type { SequenceStats } from '@/lib/mothermode/email/analytics';
import type { EnrollmentData } from '@/lib/mothermode/email/enrollment';
import {
  getOpenAiKey,
  getAnthropicKey,
  getMoonshotKey,
  getTextModelOverride,
  getTextProviderOverride,
} from './runtime-config';
import { getTextModel, type TextProvider } from '@/lib/mothermode/content/models';

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
// Types
// ---------------------------------------------------------------------------

/** The category of an insight. */
export type InsightCategory =
  | 'dropoff-diagnosis'
  | 'subject-line'
  | 'pacing'
  | 'content-gap'
  | 'forecast'
  | 'recommendation';

/** The severity of an insight. */
export type InsightSeverity = 'critical' | 'warning' | 'opportunity' | 'info';

/** A single actionable insight. */
export interface EmailInsight {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  /** The email this insight applies to (empty for sequence-level insights). */
  emailId: string;
  /** Human-readable email label for display. */
  emailLabel: string;
  /** Short title for the insight card. */
  title: string;
  /** The full diagnosis / recommendation. */
  description: string;
  /** Suggested action to take (button label). */
  actionLabel: string;
  /** The action to perform (e.g. "edit-subject", "add-email", "shorten-subject"). */
  actionType: string;
  /** Estimated impact (e.g. "+15 subscribers/week", "+$450/week"). */
  estimatedImpact: string;
}

/** The full insights report for a sequence. */
export interface EmailInsightsReport {
  /** ISO timestamp when the report was generated. */
  generatedAt: string;
  /** Total number of insights. */
  totalInsights: number;
  /** Count by severity. */
  bySeverity: Record<InsightSeverity, number>;
  /** The insights, sorted by severity (critical first) then by impact. */
  insights: EmailInsight[];
  /** A short executive summary of the top 3 actions. */
  executiveSummary: string;
}

// ---------------------------------------------------------------------------
// Provider plumbing (mirrors openai-email.ts)
// ---------------------------------------------------------------------------

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
// Normalizers (defensive: model output is untyped)
// ---------------------------------------------------------------------------

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toInsightSeverity(value: unknown): InsightSeverity {
  const s = typeof value === 'string' ? value.toLowerCase() : '';
  if (s === 'critical') return 'critical';
  if (s === 'warning') return 'warning';
  if (s === 'opportunity') return 'opportunity';
  return 'info';
}

function toInsightCategory(value: unknown): InsightCategory {
  const s = typeof value === 'string' ? value.toLowerCase() : '';
  if (s.includes('drop')) return 'dropoff-diagnosis';
  if (s.includes('subject')) return 'subject-line';
  if (s.includes('pacing') || s.includes('timing')) return 'pacing';
  if (s.includes('content') || s.includes('gap')) return 'content-gap';
  if (s.includes('forecast') || s.includes('predict')) return 'forecast';
  return 'recommendation';
}

function normalizeInsight(input: unknown, fallbackId: string): EmailInsight {
  const o = (input ?? {}) as Record<string, unknown>;
  return {
    id: str(o.id) || fallbackId,
    category: toInsightCategory(o.category),
    severity: toInsightSeverity(o.severity),
    emailId: str(o.emailId),
    emailLabel: str(o.emailLabel),
    title: str(o.title),
    description: str(o.description),
    actionLabel: str(o.actionLabel) || 'Fix',
    actionType: str(o.actionType) || 'edit',
    estimatedImpact: str(o.estimatedImpact),
  };
}

function normalizeReport(input: unknown): EmailInsightsReport {
  const o = (input ?? {}) as Record<string, unknown>;
  const rawInsights = Array.isArray(o.insights) ? o.insights : [];
  const insights = rawInsights.map((i, idx) => normalizeInsight(i, `ins-${idx}`));

  const bySeverity: Record<InsightSeverity, number> = {
    critical: 0,
    warning: 0,
    opportunity: 0,
    info: 0,
  };
  for (const i of insights) bySeverity[i.severity]++;

  // Sort: critical first, then warning, then opportunity, then info.
  const severityOrder: Record<InsightSeverity, number> = {
    critical: 0,
    warning: 1,
    opportunity: 2,
    info: 3,
  };
  insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return {
    generatedAt: str(o.generatedAt) || new Date().toISOString(),
    totalInsights: insights.length,
    bySeverity,
    insights,
    executiveSummary: str(o.executiveSummary) || '',
  };
}

/** An empty report (drives the empty-state gate). */
export function emptyInsightsReport(): EmailInsightsReport {
  return {
    generatedAt: new Date().toISOString(),
    totalInsights: 0,
    bySeverity: { critical: 0, warning: 0, opportunity: 0, info: 0 },
    insights: [],
    executiveSummary: '',
  };
}

// ---------------------------------------------------------------------------
// Insight generation
// ---------------------------------------------------------------------------

const INSIGHT_SYSTEM = `You are an expert email lifecycle analyst. You are given an
email sequence, its per-email engagement stats, and enrollment data. Diagnose
problems and opportunities, then produce a prioritized list of actionable insights.

For each insight, provide:
- category: one of "dropoff-diagnosis", "subject-line", "pacing", "content-gap", "forecast", "recommendation"
- severity: "critical" (revenue-impacting), "warning" (significant), "opportunity" (improvement), "info" (observation)
- emailId: the email id this applies to (empty for sequence-level insights)
- emailLabel: a short human label for the email (e.g. "Email #3 · nurture")
- title: a short headline for the insight card
- description: the full diagnosis or recommendation in 2-4 sentences
- actionLabel: a short button label for the fix (e.g. "Shorten subject", "Add proof email")
- actionType: a machine key for the action (e.g. "shorten-subject", "add-email", "edit-subject", "add-branch")
- estimatedImpact: a projected impact estimate (e.g. "+15 subscribers/week", "+$450/week")

Sort insights by severity (critical first). Limit to the 10 most impactful.
Respond with a JSON object:
{
  "insights": [ { "id": string, "category": string, "severity": string, "emailId": string, "emailLabel": string, "title": string, "description": string, "actionLabel": string, "actionType": string, "estimatedImpact": string } ],
  "executiveSummary": string
}`;

/** Build the analytics summary block for the prompt. */
function analyticsBlock(
  sequence: EmailSequence,
  stats: SequenceStats | null,
  enrollment: EnrollmentData | null,
): string {
  const emails = sequence?.emails ?? [];
  const lines: string[] = [];

  lines.push('SEQUENCE OVERVIEW:');
  lines.push(`- Name: ${sequence.name || '(unnamed)'}`);
  lines.push(`- Goal: ${sequence.goal || '(unspecified)'}`);
  lines.push(`- Emails: ${emails.length}`);
  lines.push(`- Trigger: ${sequence.trigger}`);

  if (stats) {
    const totalSent = Object.values(stats.byEmail).reduce((s, e) => s + e.sent, 0);
    const totalOpened = Object.values(stats.byEmail).reduce((s, e) => s + e.opened, 0);
    const totalClicked = Object.values(stats.byEmail).reduce((s, e) => s + e.clicked, 0);
    const totalRevenue = Object.values(stats.byEmail).reduce((s, e) => s + (e.revenue ?? 0), 0);
    lines.push(`- Total sent: ${totalSent}`);
    lines.push(`- Total opened: ${totalOpened} (${totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0}%)`);
    lines.push(`- Total clicked: ${totalClicked} (${totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0}%)`);
    lines.push(`- Total revenue: $${totalRevenue.toFixed(2)}`);
  } else {
    lines.push('- No engagement stats available (ESP not connected).');
  }

  if (enrollment) {
    const enrolled = enrollment.enrollments.length;
    const active = enrollment.enrollments.filter(
      (e) => e.status !== 'completed' && e.status !== 'dropped' && e.status !== 'unsubscribed',
    ).length;
    const dropped = enrollment.enrollments.filter((e) => e.status === 'dropped').length;
    lines.push(`- Enrolled: ${enrolled}`);
    lines.push(`- Active: ${active}`);
    lines.push(`- Dropped: ${dropped}`);
  } else {
    lines.push('- No enrollment data available.');
  }

  lines.push('\nPER-EMAIL STATS:');
  emails.forEach((email, i) => {
    const stat = stats?.byEmail?.[email.id];
    const drop = enrollment?.enrollments?.filter(
      (e) => e.status === 'dropped' && e.emailId === email.id,
    ).length ?? 0;
    lines.push(
      `${i + 1}. id=${email.id} · role=${email.role} · subject="${email.subject || '(no subject)'}" · sent=${stat?.sent ?? 0} · opened=${stat?.opened ?? 0} · clicked=${stat?.clicked ?? 0} · dropoff=${drop}`,
    );
  });

  return lines.join('\n');
}

/**
 * Generate AI insights for a sequence + its analytics.
 *
 * Returns a normalized `EmailInsightsReport` with prioritized insights. An
 * empty report (no insights) when no analytics data exists.
 */
export async function aiGenerateInsights(
  sequence: EmailSequence,
  stats: SequenceStats | null,
  enrollment: EnrollmentData | null,
): Promise<AiResult<EmailInsightsReport>> {
  // No data → empty report (don't call the model).
  if (!stats && !enrollment) {
    return { ok: true, data: emptyInsightsReport() };
  }

  const user = `${analyticsBlock(sequence, stats, enrollment)}

Analyze this sequence and produce actionable insights. Focus on:
1. Drop-off diagnosis: which emails are losing the most subscribers and why.
2. Subject line optimization: subjects that are too long, too vague, or low-performing.
3. Pacing analysis: send timing that causes disengagement.
4. Content gaps: missing email types for the campaign goal.
5. Forecast: projected performance at current pace.`;

  const res = await callOpenAiJson<{ insights?: unknown; executiveSummary?: unknown }>(
    INSIGHT_SYSTEM,
    user,
  );
  if (!res.ok) return res;

  const report = normalizeReport({
    insights: res.data.insights,
    executiveSummary: res.data.executiveSummary,
  });

  return { ok: true, data: report };
}