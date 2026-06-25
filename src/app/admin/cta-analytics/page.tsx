import Link from 'next/link';
import { Download, ExternalLink, MousePointerClick, Users } from 'lucide-react';
import {
  aggregateCtaRows,
  getCourseFilterOptions,
  getTopCtaPerformance
} from '@/utils/courses/cta-analytics';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function formatDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  } catch {
    return '—';
  }
}

export default async function CtaAnalyticsPage({
  searchParams
}: {
  searchParams: { from?: string; to?: string; course?: string };
}) {
  const from = searchParams.from && DATE_RE.test(searchParams.from)
    ? searchParams.from
    : null;
  const to = searchParams.to && DATE_RE.test(searchParams.to)
    ? searchParams.to
    : null;
  const courseId = searchParams.course?.trim() || null;
  const hasFilters = !!(from || to || courseId);
  const exportQs = new URLSearchParams();
  if (from) exportQs.set('from', from);
  if (to) exportQs.set('to', to);
  if (courseId) exportQs.set('course', courseId);
  const exportHref = `/api/admin/cta-analytics/export${
    exportQs.toString() ? `?${exportQs.toString()}` : ''
  }`;

  const [rows, courseOptions] = await Promise.all([
    getTopCtaPerformance(100, {
      startDate: from,
      endDate: to,
      courseId
    }),
    getCourseFilterOptions()
  ]);
  const totalClicks = rows.reduce((sum, r) => sum + r.clicks, 0);
  const totalViews = rows.reduce((sum, r) => sum + r.views, 0);
  const overallCtr = totalViews > 0 ? totalClicks / totalViews : null;
  const { byCourse, byLesson } = aggregateCtaRows(rows);
  const topLessons = byLesson.slice(0, 10);
  const lessonMaxClicks = topLessons.reduce(
    (max, l) => (l.clicks > max ? l.clicks : max),
    0
  );

  const formatCtr = (ctr: number | null) =>
    ctr === null ? '—' : `${(ctr * 100).toFixed(1)}%`;
  const ctrTone = (ctr: number | null) =>
    ctr === null
      ? 'text-white/30'
      : ctr >= 0.1
        ? 'text-emerald-300'
        : ctr >= 0.03
          ? 'text-amber-200'
          : 'text-white/60';

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-amber-200/80 font-semibold mb-2">
            Course Area
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            CTA Analytics
          </h1>
          <p className="text-sm text-white/60 mt-2 max-w-2xl">
            Top-performing in-video call-to-action overlays across the entire
            course library, ranked by total clicks.
          </p>
        </div>
        <a
          href={exportHref}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-200/30 bg-amber-300/[0.06] text-amber-200 text-sm font-semibold hover:bg-amber-300/[0.12] hover:border-amber-200/50"
        >
          <Download className="w-4 h-4" />
          Download CSV
        </a>
      </div>

      <form
        method="get"
        className="rounded-2xl border border-amber-200/15 bg-white/[0.02] p-4 mb-6 grid grid-cols-1 sm:grid-cols-[1fr_1fr_1.5fr_auto] gap-3 items-end"
      >
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-white/50 font-semibold">
            From
          </span>
          <input
            type="date"
            name="from"
            defaultValue={from ?? ''}
            className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-amber-300/50 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-white/50 font-semibold">
            To
          </span>
          <input
            type="date"
            name="to"
            defaultValue={to ?? ''}
            className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-amber-300/50 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-white/50 font-semibold">
            Course
          </span>
          <select
            name="course"
            defaultValue={courseId ?? ''}
            className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-amber-300/50 focus:outline-none"
          >
            <option value="">All courses</option>
            {courseOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 text-black text-sm font-bold hover:from-amber-300 hover:to-amber-400"
          >
            Apply
          </button>
          {hasFilters && (
            <Link
              href="/admin/cta-analytics"
              className="px-3 py-2 rounded-lg border border-white/10 text-sm text-white/60 hover:text-white hover:border-white/30"
            >
              Clear
            </Link>
          )}
        </div>
      </form>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total views" value={totalViews.toLocaleString()} />
        <StatCard label="Total clicks" value={totalClicks.toLocaleString()} />
        <StatCard label="Overall CTR" value={formatCtr(overallCtr)} />
        <StatCard
          label="Top performer"
          value={rows[0]?.clicks ? `${rows[0].clicks} clicks` : '—'}
          sub={rows[0]?.ctaTitle ?? rows[0]?.ctaId ?? undefined}
        />
      </div>

      {rows.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          <BreakdownPanel title="By course" subtitle="Aggregated across all CTAs">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-white/50">
                <tr>
                  <th className="text-left py-2 font-semibold">Course</th>
                  <th className="text-right py-2 font-semibold">Lessons</th>
                  <th className="text-right py-2 font-semibold">Views</th>
                  <th className="text-right py-2 font-semibold">Clicks</th>
                  <th className="text-right py-2 font-semibold">CTR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {byCourse.map((c) => (
                  <tr key={c.courseId ?? '__none__'}>
                    <td className="py-2 pr-2">
                      {c.courseId ? (
                        <Link
                          href={`/courses/${c.courseId}`}
                          className="text-amber-300 hover:text-amber-200"
                        >
                          {c.courseTitle ?? c.courseId}
                        </Link>
                      ) : (
                        <span className="text-white/30 italic">Unattributed</span>
                      )}
                    </td>
                    <td className="py-2 text-right text-white/50 text-xs font-mono">
                      {c.lessonCount}
                    </td>
                    <td className="py-2 text-right text-white/60 text-xs font-mono">
                      {c.views.toLocaleString()}
                    </td>
                    <td className="py-2 text-right text-white font-semibold">
                      {c.clicks.toLocaleString()}
                    </td>
                    <td className={`py-2 text-right text-xs font-semibold ${ctrTone(c.ctr)}`}>
                      {formatCtr(c.ctr)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </BreakdownPanel>

          <BreakdownPanel
            title="Top lessons"
            subtitle={`Showing ${topLessons.length} of ${byLesson.length}`}
          >
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-white/50">
                <tr>
                  <th className="text-left py-2 font-semibold">Lesson</th>
                  <th className="text-left py-2 font-semibold">Volume</th>
                  <th className="text-right py-2 font-semibold">Clicks</th>
                  <th className="text-right py-2 font-semibold">CTR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {topLessons.map((l) => {
                  const pct =
                    lessonMaxClicks > 0 ? (l.clicks / lessonMaxClicks) * 100 : 0;
                  return (
                    <tr key={l.lessonId}>
                      <td className="py-2 pr-2 max-w-[16rem]">
                        <div className="text-white truncate">
                          {l.lessonTitle ?? (
                            <span className="font-mono text-xs text-white/40">
                              {l.lessonId.slice(0, 8)}…
                            </span>
                          )}
                        </div>
                        {l.courseTitle && (
                          <div className="text-[11px] text-white/40 truncate">
                            {l.courseTitle}
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-2 w-[40%]">
                        <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-400 to-amber-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-2 text-right text-white font-semibold">
                        {l.clicks.toLocaleString()}
                      </td>
                      <td className={`py-2 text-right text-xs font-semibold ${ctrTone(l.ctr)}`}>
                        {formatCtr(l.ctr)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </BreakdownPanel>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-amber-200/15 bg-white/[0.02] p-10 text-center">
          <MousePointerClick className="w-8 h-8 text-amber-200/40 mx-auto mb-3" />
          <p className="text-white/70 font-medium">
            {hasFilters
              ? 'No CTA clicks match these filters'
              : 'No CTA clicks recorded yet'}
          </p>
          <p className="text-sm text-white/40 mt-1">
            {hasFilters
              ? 'Try widening the date range or selecting a different course.'
              : 'Once viewers start clicking overlays, performance data will appear here.'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-200/15 bg-white/[0.02] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wider text-white/50">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">CTA</th>
                  <th className="text-left px-4 py-3 font-semibold">Lesson</th>
                  <th className="text-left px-4 py-3 font-semibold">Course</th>
                  <th className="text-right px-4 py-3 font-semibold">Views</th>
                  <th className="text-right px-4 py-3 font-semibold">Clicks</th>
                  <th className="text-right px-4 py-3 font-semibold">CTR</th>
                  <th className="text-left px-4 py-3 font-semibold">
                    Last click
                  </th>
                  <th className="text-right px-4 py-3 font-semibold">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {rows.map((r) => (
                  <tr
                    key={`${r.lessonId}::${r.ctaId}`}
                    className="hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">
                        {r.ctaTitle ?? (
                          <span className="text-white/40 italic">
                            {r.ctaId}
                          </span>
                        )}
                      </div>
                      {r.ctaButtonText && (
                        <div className="text-xs text-white/40 mt-0.5">
                          “{r.ctaButtonText}”
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/70">
                      {r.lessonTitle ?? (
                        <span className="text-white/30 font-mono text-xs">
                          {r.lessonId.slice(0, 8)}…
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.courseId ? (
                        <Link
                          href={`/courses/${r.courseId}`}
                          className="text-amber-300 hover:text-amber-200"
                        >
                          {r.courseTitle ?? r.courseId}
                        </Link>
                      ) : (
                        <span className="text-white/30">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-white/60 text-xs font-mono">
                      {r.views.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.clicks > 0 ? (
                        <Link
                          href={`/admin/cta-analytics/clickers?lesson=${encodeURIComponent(r.lessonId)}&cta=${encodeURIComponent(r.ctaId)}${from ? `&from=${from}` : ''}${to ? `&to=${to}` : ''}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-300/[0.08] border border-amber-300/30 text-amber-200 text-xs font-semibold hover:bg-amber-300/[0.16]"
                          title="View clickers"
                        >
                          <MousePointerClick className="w-3 h-3" />
                          {r.clicks}
                          <Users className="w-3 h-3 opacity-60" />
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/10 text-white/30 text-xs font-semibold">
                          <MousePointerClick className="w-3 h-3" />0
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`text-xs font-semibold ${
                          r.ctr === null
                            ? 'text-white/30'
                            : r.ctr >= 0.1
                              ? 'text-emerald-300'
                              : r.ctr >= 0.03
                                ? 'text-amber-200'
                                : 'text-white/60'
                        }`}
                      >
                        {formatCtr(r.ctr)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/50 text-xs">
                      {formatDate(r.lastClickAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.ctaLink ? (
                        <a
                          href={r.ctaLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-amber-200"
                        >
                          Open
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-white/20">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-amber-200/15 bg-gradient-to-br from-white/[0.04] to-transparent p-5">
      <div className="text-[11px] uppercase tracking-[0.18em] text-white/50 font-semibold">
        {label}
      </div>
      <div className="text-2xl font-black text-white mt-1">{value}</div>
      {sub && (
        <div className="text-xs text-white/40 mt-1 truncate" title={sub}>
          {sub}
        </div>
      )}
    </div>
  );
}

function BreakdownPanel({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-amber-200/15 bg-white/[0.02] p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-white tracking-wide">
          {title}
        </h2>
        {subtitle && (
          <span className="text-[11px] text-white/40">{subtitle}</span>
        )}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
