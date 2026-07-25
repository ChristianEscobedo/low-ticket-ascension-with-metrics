'use client';

/**
 * Email Marketing Kit — AI insights panel (Phase 4).
 *
 * Renders the structured `EmailInsightsReport` from `openai-email-insights.ts`
 * as a set of actionable cards. Each card shows:
 *   - Severity badge (critical / warning / opportunity / info)
 *   - Category label
 *   - Title + description
 *   - Estimated impact
 *   - "Apply" button (pre-fills editor changes) and "Dismiss" button
 *
 * The panel is refreshed on demand (button click) or after a sequence save.
 * It caches per kit and only re-runs when the admin explicitly refreshes.
 */
import { useState, useMemo } from 'react';
import {
  AlertTriangle,
  TrendingUp,
  Lightbulb,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  X,
} from 'lucide-react';
import type {
  EmailInsight,
  EmailInsightsReport,
  InsightSeverity,
} from '@/utils/integrations/openai-email-insights';

interface Props {
  /** The current insights report (may be empty). */
  report: EmailInsightsReport | null;
  /** Whether the AI is currently generating insights. */
  busy: boolean;
  /** Called when the admin clicks "Apply" on an insight. */
  onApply?: (insight: EmailInsight) => void;
  /** Called when the admin clicks "Dismiss" on an insight. */
  onDismiss?: (insightId: string) => void;
  /** Called when the admin clicks "Refresh insights". */
  onRefresh?: () => void;
}

// ---------------------------------------------------------------------------
// Severity styling
// ---------------------------------------------------------------------------

const SEVERITY_META: Record<
  InsightSeverity,
  { label: string; color: string; icon: React.ReactNode }
> = {
  critical: {
    label: 'Critical',
    color: 'border-red-500/50 bg-red-500/10 text-red-300',
    icon: <AlertTriangle className="h-3.5 w-3.5 text-red-400" />,
  },
  warning: {
    label: 'Warning',
    color: 'border-amber-500/50 bg-amber-500/10 text-amber-300',
    icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />,
  },
  opportunity: {
    label: 'Opportunity',
    color: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300',
    icon: <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />,
  },
  info: {
    label: 'Info',
    color: 'border-[#6ea8fe]/50 bg-[#6ea8fe]/10 text-[#9cc2ff]',
    icon: <Lightbulb className="h-3.5 w-3.5 text-[#9cc2ff]" />,
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  'dropoff-diagnosis': 'Drop-off',
  'subject-line': 'Subject line',
  pacing: 'Pacing',
  'content-gap': 'Content gap',
  forecast: 'Forecast',
  recommendation: 'Recommendation',
};

// ---------------------------------------------------------------------------
// Insight Card
// ---------------------------------------------------------------------------

function InsightCard({
  insight,
  onApply,
  onDismiss,
}: {
  insight: EmailInsight;
  onApply?: (insight: EmailInsight) => void;
  onDismiss?: (insightId: string) => void;
}) {
  const meta = SEVERITY_META[insight.severity] ?? SEVERITY_META.info;
  const categoryLabel = CATEGORY_LABELS[insight.category] ?? insight.category;

  return (
    <div className={`rounded-xl border p-4 ${meta.color.split(' ')[0]} bg-ink/30`}>
      {/* Header: severity + category + email label */}
      <div className="mb-2 flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.color}`}>
          {meta.icon}
          {meta.label}
        </span>
        <span className="rounded bg-bone/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-bone/50">
          {categoryLabel}
        </span>
        {insight.emailLabel ? (
          <span className="text-[10px] text-bone/40">{insight.emailLabel}</span>
        ) : null}
      </div>

      {/* Title + description */}
      <h4 className="text-sm font-semibold text-bone">{insight.title}</h4>
      <p className="mt-1 text-xs leading-relaxed text-bone/60">
        {insight.description}
      </p>

      {/* Impact + actions */}
      <div className="mt-3 flex items-center justify-between gap-2">
        {insight.estimatedImpact ? (
          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
            {insight.estimatedImpact}
          </span>
        ) : (
          <span className="text-[10px] text-bone/30">Impact estimate unavailable</span>
        )}
        <div className="flex items-center gap-1.5">
          {onApply && insight.actionType ? (
            <button
              type="button"
              onClick={() => onApply(insight)}
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-500/25"
            >
              {insight.actionLabel}
            </button>
          ) : null}
          {onDismiss ? (
            <button
              type="button"
              onClick={() => onDismiss(insight.id)}
              className="rounded-lg border border-bone/20 px-2 py-1 text-[11px] font-semibold text-bone/40 transition hover:border-bone/40 hover:text-bone/70"
              title="Dismiss this insight"
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Panel
// ---------------------------------------------------------------------------

export default function EmailInsightsPanel({
  report,
  busy,
  onApply,
  onDismiss,
  onRefresh,
}: Props) {
  const [filter, setFilter] = useState<'all' | InsightSeverity>('all');

  const filteredInsights = useMemo(() => {
    if (!report?.insights) return [];
    if (filter === 'all') return report.insights;
    return report.insights.filter((i) => i.severity === filter);
  }, [report, filter]);

  const hasInsights = (report?.totalInsights ?? 0) > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brass" />
          <h3 className="text-sm font-semibold text-bone">AI Insights</h3>
          {report ? (
            <span className="text-[10px] text-bone/40">
              {new Date(report.generatedAt).toLocaleTimeString()}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {/* Severity filter */}
          <div className="flex items-center gap-1">
            {(['all', 'critical', 'warning', 'opportunity', 'info'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-lg px-2 py-1 text-[10px] font-semibold capitalize transition ${
                  filter === f
                    ? 'bg-brass/20 text-brass'
                    : 'text-bone/40 hover:text-bone/70'
                }`}
              >
                {f === 'all' ? 'All' : f}
                {report && f !== 'all' ? (
                  <span className="ml-1 text-bone/30">({report.bySeverity[f]})</span>
                ) : null}
              </button>
            ))}
          </div>
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg border border-bone/20 px-2.5 py-1.5 text-xs font-semibold text-bone/70 transition hover:border-brass/50 hover:text-bone disabled:opacity-40"
              title="Refresh AI insights"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
              {busy ? 'Analyzing…' : 'Refresh'}
            </button>
          ) : null}
        </div>
      </div>

      {/* Executive summary */}
      {report?.executiveSummary ? (
        <div className="rounded-xl border border-brass/20 bg-brass/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brass/80">
            Executive summary
          </p>
          <p className="mt-1 text-sm leading-relaxed text-bone/80">
            {report.executiveSummary}
          </p>
        </div>
      ) : null}

      {/* Insights list */}
      {!hasInsights ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-bone/10 bg-ink/30 p-8 text-center">
          <div>
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500/30" />
            <p className="mt-3 text-sm font-medium text-bone/50">
              {busy ? 'Analyzing your sequence…' : 'No insights yet'}
            </p>
            <p className="mt-1 text-xs text-bone/30">
              {busy
                ? 'The AI is reviewing your sequence, stats, and enrollment data.'
                : 'Connect your ESP to populate analytics, then refresh to generate AI insights.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredInsights.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onApply={onApply}
              onDismiss={onDismiss}
            />
          ))}
        </div>
      )}
    </div>
  );
}