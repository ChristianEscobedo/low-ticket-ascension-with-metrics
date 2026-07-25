'use client';

/**
 * Email Marketing Kit — analytics dashboard (Phase 3).
 *
 * A dedicated analytics surface with:
 *   - KPI cards (enrolled, active, completed, dropped, unsubscribed, revenue)
 *   - Per-email performance table (sortable)
 *   - Funnel diagram (SVG horizontal bars)
 *   - Cohort retention matrix (SVG heatmap)
 *   - A/B test results (variant comparison bars)
 *   - Time period selector (7d / 30d / 90d / all)
 *
 * All data comes from the pure analytics + enrollment modules. When no data
 * exists, the dashboard renders a clean "connect your ESP" empty state.
 */
import { useMemo, useState } from 'react';
import {
  Users,
  Activity,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  Mail,
  Target,
} from 'lucide-react';
import {
  hasAnyStats,
  sequenceTotals,
  openRate,
  ctr,
  clickToOpenRate,
  abVariantStats,
  type EmailSequence,
  type SequenceStats,
} from '@/lib/mothermode/email';
import {
  enrollmentFunnel,
  activeSubscribers,
  totalEnrolled,
  countByStatus,
  dropoffByEmail,
  cohortBuckets,
  hasEnrollments,
  type EnrollmentData,
} from '@/lib/mothermode/email/enrollment';

interface Props {
  sequence: EmailSequence;
  stats: SequenceStats | null;
  enrollment: EnrollmentData | null;
  onSelectEmail?: (emailId: string) => void;
}

type Period = '7d' | '30d' | '90d' | 'all';

function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

function fmt(n: number): string {
  return n.toLocaleString();
}

function fmtCurrency(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel?: string;
  accent: string;
}

function KpiCard({ icon, label, value, sublabel, accent }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-bone/10 bg-ink/30 p-4">
      <div className="flex items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${accent}`}>
          {icon}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-bone/50">
          {label}
        </span>
      </div>
      <p className="mt-2 font-display text-2xl text-bone">{value}</p>
      {sublabel ? <p className="mt-0.5 text-xs text-bone/40">{sublabel}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Funnel Chart
// ---------------------------------------------------------------------------

function FunnelChart({ steps }: { steps: { stage: string; count: number; rate: number; cumulativeRate: number }[] }) {
  if (steps.length === 0) return null;
  const maxCount = steps[0].count || 1;
  const barHeight = 32;

  return (
    <div className="space-y-1">
      {steps.map((step, i) => {
        const widthPct = step.count / maxCount;
        const color = i === 0 ? '#6ea8fe' : i === steps.length - 1 ? '#c9a227' : `rgba(110,168,254,${0.4 + widthPct * 0.6})`;
        return (
          <div key={step.stage} className="flex items-center gap-3">
            <span className="w-24 text-right text-xs font-medium text-bone/60">
              {step.stage}
            </span>
            <div className="relative flex-1" style={{ height: barHeight }}>
              <div
                className="absolute left-0 top-0 flex items-center justify-end rounded-md px-2 transition-all"
                style={{
                  width: `${Math.max(widthPct * 100, 0.5)}%`,
                  height: barHeight,
                  backgroundColor: color,
                }}
              >
                <span className="text-xs font-semibold text-ink">
                  {fmt(step.count)}
                </span>
              </div>
            </div>
            <span className="w-16 text-xs text-bone/40">
              {i === 0 ? '100%' : pct(step.cumulativeRate)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-Email Performance Table
// ---------------------------------------------------------------------------

interface EmailRow {
  index: number;
  emailId: string;
  subject: string;
  role: string;
  sent: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  revenue: number;
  openRate: number;
  ctr: number;
  ctor: number;
  dropoffRate: number;
}

type SortKey = 'index' | 'sent' | 'opened' | 'clicked' | 'openRate' | 'ctr' | 'dropoffRate' | 'revenue';
type SortDir = 'asc' | 'desc';

function EmailPerformanceTable({
  rows,
  onSelectEmail,
}: {
  rows: EmailRow[];
  onSelectEmail?: (emailId: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('index');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const th = 'px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-bone/40 cursor-pointer hover:text-bone/70';
  const td = 'px-3 py-2 text-xs text-bone/80';

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-bone/10">
            <th className={th} onClick={() => toggleSort('index')}>#</th>
            <th className={th}>Subject</th>
            <th className={th} onClick={() => toggleSort('sent')}>Sent</th>
            <th className={th} onClick={() => toggleSort('opened')}>Opened</th>
            <th className={th} onClick={() => toggleSort('openRate')}>Open %</th>
            <th className={th} onClick={() => toggleSort('ctr')}>CTR</th>
            <th className={th} onClick={() => toggleSort('dropoffRate')}>Drop-off</th>
            <th className={th} onClick={() => toggleSort('revenue')}>Revenue</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={row.emailId}
              className="border-b border-bone/5 transition hover:bg-bone/5"
              onClick={() => onSelectEmail?.(row.emailId)}
              style={{ cursor: onSelectEmail ? 'pointer' : 'default' }}
            >
              <td className={td}>
                <span className="rounded bg-bone/10 px-1.5 py-0.5 text-[10px] font-semibold text-brass">
                  {row.index}
                </span>
              </td>
              <td className={`${td} max-w-[200px]`}>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-bone/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-bone/50">
                    {row.role}
                  </span>
                  <span className="truncate">{row.subject || '(no subject)'}</span>
                </div>
              </td>
              <td className={td}>{fmt(row.sent)}</td>
              <td className={td}>{fmt(row.opened)}</td>
              <td className={td}>
                <span className={row.openRate >= 0.3 ? 'text-emerald-300' : row.openRate >= 0.15 ? 'text-amber-300' : 'text-red-300'}>
                  {pct(row.openRate)}
                </span>
              </td>
              <td className={td}>
                <span className="text-sky-300">{pct(row.ctr)}</span>
              </td>
              <td className={td}>
                {row.dropoffRate > 0.1 ? (
                  <span className="flex items-center gap-1 text-red-300">
                    <AlertTriangle className="h-3 w-3" />
                    {pct(row.dropoffRate)}
                  </span>
                ) : (
                  <span className="text-bone/40">{pct(row.dropoffRate)}</span>
                )}
              </td>
              <td className={td}>
                {row.revenue > 0 ? (
                  <span className="text-brass">{fmtCurrency(row.revenue)}</span>
                ) : (
                  <span className="text-bone/30">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cohort Retention Matrix
// ---------------------------------------------------------------------------

function CohortMatrix({ cohorts }: { cohorts: { label: string; enrolled: number; retention: number[] }[] }) {
  if (cohorts.length === 0) return null;
  const maxEmails = Math.max(...cohorts.map((c) => c.retention.length));

  function heatColor(value: number): string {
    if (value >= 0.75) return 'bg-emerald-500/80';
    if (value >= 0.5) return 'bg-emerald-500/50';
    if (value >= 0.25) return 'bg-amber-500/50';
    if (value > 0) return 'bg-red-500/40';
    return 'bg-bone/5';
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse">
        <thead>
          <tr>
            <th className="px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-wide text-bone/40">
              Cohort
            </th>
            <th className="px-2 py-1 text-right text-[10px] font-semibold uppercase tracking-wide text-bone/40">
              Size
            </th>
            {Array.from({ length: maxEmails }).map((_, i) => (
              <th key={i} className="px-2 py-1 text-center text-[10px] font-semibold text-bone/40">
                E{i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((cohort) => (
            <tr key={cohort.label}>
              <td className="px-2 py-1 text-xs font-medium text-bone/60">
                {cohort.label}
              </td>
              <td className="px-2 py-1 text-right text-xs text-bone/40">
                {cohort.enrolled}
              </td>
              {Array.from({ length: maxEmails }).map((_, i) => {
                const val = cohort.retention[i] ?? 0;
                return (
                  <td key={i} className="p-0.5">
                    <div
                      className={`flex h-6 w-10 items-center justify-center rounded text-[9px] font-semibold ${heatColor(val)} ${
                        val > 0 ? 'text-bone' : 'text-bone/20'
                      }`}
                      title={`${cohort.label} · Email ${i + 1}: ${pct(val)} retained`}
                    >
                      {val > 0 ? pct(val) : '—'}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// A/B Test Results
// ---------------------------------------------------------------------------

function AbTestResults({
  sequence,
  stats,
}: {
  sequence: EmailSequence;
  stats: SequenceStats | null;
}) {
  const abResults = useMemo(
    () => abVariantStats(sequence, stats, 'open'),
    [sequence, stats],
  );

  if (abResults.length === 0) return null;

  return (
    <div className="space-y-3">
      {abResults.map((result) => {
        const maxSent = Math.max(...result.variants.map((v) => v.stat.sent), 1);
        return (
          <div key={result.emailId} className="rounded-lg border border-bone/10 bg-ink/40 p-3">
            <p className="mb-2 text-xs font-semibold text-bone/60">
              A/B Test · {result.emailId}
            </p>
            <div className="space-y-2">
              {result.variants.map((variant) => {
                const widthPct = variant.stat.sent / maxSent;
                const isWinner = result.winner?.id === variant.id;
                return (
                  <div key={variant.id} className="flex items-center gap-2">
                    <span className="w-16 text-xs font-medium text-bone/60">
                      {variant.label}
                    </span>
                    <div className="relative flex-1" style={{ height: 20 }}>
                      <div
                        className={`absolute left-0 top-0 flex items-center justify-end rounded px-2 ${
                          isWinner ? 'bg-emerald-500/60' : 'bg-[#6ea8fe]/40'
                        }`}
                        style={{ width: `${Math.max(widthPct * 100, 2)}%`, height: 20 }}
                      >
                        <span className="text-[10px] font-semibold text-ink">
                          {fmt(variant.stat.sent)} sent · {pct(openRate(variant.stat))} open
                        </span>
                      </div>
                    </div>
                    {isWinner ? (
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-300">
                        Winner
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export default function EmailAnalyticsDashboard({
  sequence,
  stats,
  enrollment,
  onSelectEmail,
}: Props) {
  const [period, setPeriod] = useState<Period>('all');

  const showStats = useMemo(() => hasAnyStats(stats), [stats]);
  const showEnrollment = useMemo(() => hasEnrollments(enrollment), [enrollment]);
  const hasData = showStats || showEnrollment;

  // KPI computations
  const totals = useMemo(() => (stats ? sequenceTotals(stats) : null), [stats]);
  const funnel = useMemo(() => enrollmentFunnel(stats), [stats]);
  const activeCount = useMemo(() => activeSubscribers(enrollment), [enrollment]);
  const totalEnrolledCount = useMemo(() => totalEnrolled(enrollment), [enrollment]);
  const statusCounts = useMemo(() => countByStatus(enrollment), [enrollment]);
  const dropoff = useMemo(
    () => dropoffByEmail(sequence, stats, enrollment),
    [sequence, stats, enrollment],
  );
  const cohorts = useMemo(
    () => cohortBuckets(sequence, enrollment, 'week'),
    [sequence, enrollment],
  );

  // Per-email table rows
  const emailRows = useMemo<EmailRow[]>(() => {
    const emails = sequence?.emails ?? [];
    const dropoffMap = new Map(dropoff.map((d) => [d.emailId, d]));
    return emails.map((email, i) => {
      const stat = stats?.byEmail?.[email.id];
      const drop = dropoffMap.get(email.id);
      return {
        index: i + 1,
        emailId: email.id,
        subject: email.subject,
        role: email.role,
        sent: stat?.sent ?? 0,
        opened: stat?.opened ?? 0,
        clicked: stat?.clicked ?? 0,
        unsubscribed: stat?.unsubscribed ?? 0,
        revenue: stat?.revenue ?? 0,
        openRate: stat ? openRate(stat) : 0,
        ctr: stat ? ctr(stat) : 0,
        ctor: stat ? clickToOpenRate(stat) : 0,
        dropoffRate: drop?.dropoffRate ?? 0,
      };
    });
  }, [sequence, stats, dropoff]);

  if (!hasData) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-bone/10 bg-ink/30 p-8 text-center">
        <div>
          <Mail className="mx-auto h-10 w-10 text-bone/20" />
          <p className="mt-3 text-sm font-medium text-bone/50">
            Connect your ESP to see analytics
          </p>
          <p className="mt-1 text-xs text-bone/30">
            Enrollment data, open rates, CTR, and drop-off will appear here once
            an ESP webhook populates the analytics tables.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-bone/40">
          Period:
        </span>
        {(['7d', '30d', '90d', 'all'] as Period[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              period === p
                ? 'bg-brass/20 text-brass'
                : 'text-bone/40 hover:text-bone/70'
            }`}
          >
            {p === 'all' ? 'All time' : `Last ${p}`}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          icon={<Users className="h-4 w-4 text-[#9cc2ff]" />}
          label="Enrolled"
          value={fmt(totalEnrolledCount)}
          sublabel="Total subscribers"
          accent="bg-[#6ea8fe]/15"
        />
        <KpiCard
          icon={<Activity className="h-4 w-4 text-emerald-400" />}
          label="Active"
          value={fmt(activeCount)}
          sublabel="In flight"
          accent="bg-emerald-500/15"
        />
        <KpiCard
          icon={<Target className="h-4 w-4 text-brass" />}
          label="Completed"
          value={fmt(statusCounts.completed)}
          sublabel="Finished sequence"
          accent="bg-brass/15"
        />
        <KpiCard
          icon={<TrendingDown className="h-4 w-4 text-red-400" />}
          label="Dropped"
          value={fmt(statusCounts.dropped)}
          sublabel="Exited early"
          accent="bg-red-500/15"
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4 text-sky-400" />}
          label="Open Rate"
          value={totals ? pct(openRate(totals)) : '—'}
          sublabel="Sequence avg"
          accent="bg-sky-500/15"
        />
        <KpiCard
          icon={<DollarSign className="h-4 w-4 text-brass" />}
          label="Revenue"
          value={totals ? fmtCurrency(totals.revenue ?? 0) : '—'}
          sublabel="Attributed"
          accent="bg-brass/15"
        />
      </div>

      {/* Funnel + A/B side by side */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Funnel */}
        <div className="rounded-xl border border-bone/10 bg-ink/30 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-bone">
            <TrendingUp className="h-4 w-4 text-brass" />
            Enrollment Funnel
          </h3>
          {funnel.length > 0 ? (
            <FunnelChart steps={funnel} />
          ) : (
            <p className="py-4 text-center text-xs text-bone/30">
              No funnel data yet.
            </p>
          )}
        </div>

        {/* A/B Tests */}
        <div className="rounded-xl border border-bone/10 bg-ink/30 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-bone">
            <Activity className="h-4 w-4 text-[#9cc2ff]" />
            A/B Test Results
          </h3>
          <AbTestResults sequence={sequence} stats={stats} />
        </div>
      </div>

      {/* Per-email performance table */}
      <div className="rounded-xl border border-bone/10 bg-ink/30 p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-bone">
          <Mail className="h-4 w-4 text-brass" />
          Per-Email Performance
        </h3>
        {emailRows.length > 0 ? (
          <EmailPerformanceTable rows={emailRows} onSelectEmail={onSelectEmail} />
        ) : (
          <p className="py-4 text-center text-xs text-bone/30">
            No emails in this sequence.
          </p>
        )}
      </div>

      {/* Cohort retention matrix */}
      <div className="rounded-xl border border-bone/10 bg-ink/30 p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-bone">
          <Users className="h-4 w-4 text-[#9cc2ff]" />
          Cohort Retention Matrix
        </h3>
        {cohorts.length > 0 ? (
          <CohortMatrix cohorts={cohorts} />
        ) : (
          <p className="py-4 text-center text-xs text-bone/30">
            No cohort data yet. Enrollments will appear here once subscribers
            enter the sequence.
          </p>
        )}
      </div>
    </div>
  );
}
