import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink, MousePointerClick, Users } from 'lucide-react';
import { getCtaClickers, getCtaContext } from '@/utils/supabase/admin';

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

export default async function CtaClickersPage({
  searchParams
}: {
  searchParams: { lesson?: string; cta?: string; from?: string; to?: string };
}) {
  const lessonId = searchParams.lesson?.trim();
  const ctaId = searchParams.cta?.trim();
  if (!lessonId || !ctaId) return notFound();

  const from =
    searchParams.from && DATE_RE.test(searchParams.from)
      ? searchParams.from
      : null;
  const to =
    searchParams.to && DATE_RE.test(searchParams.to) ? searchParams.to : null;

  const [context, clickers] = await Promise.all([
    getCtaContext(lessonId, ctaId),
    getCtaClickers(lessonId, ctaId, { startDate: from, endDate: to })
  ]);

  const backQs = new URLSearchParams();
  if (from) backQs.set('from', from);
  if (to) backQs.set('to', to);
  const backHref = `/admin/cta-analytics${
    backQs.toString() ? `?${backQs.toString()}` : ''
  }`;

  const totalClicks = clickers.reduce((s, c) => s + c.clicks, 0);
  const knownClickers = clickers.filter((c) => c.user_id).length;
  const anonClickers = clickers.find((c) => !c.user_id)?.clicks ?? 0;

  return (
    <div>
      <Link
        href={backHref}
        className="text-white/50 hover:text-amber-200 text-sm transition-colors"
      >
        ← Back to CTA analytics
      </Link>
      <div className="mt-2 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-amber-200/80 font-semibold mb-2">
            CTA clickers
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            {context?.ctaTitle ?? (
              <span className="font-mono text-2xl">{ctaId}</span>
            )}
          </h1>
          <p className="text-sm text-white/60 mt-2">
            {context?.courseTitle && (
              <Link
                href={`/courses/${context.courseId}`}
                className="text-amber-300 hover:text-amber-200"
              >
                {context.courseTitle}
              </Link>
            )}
            {context?.courseTitle && context?.lessonTitle && ' · '}
            {context?.lessonTitle ?? lessonId}
          </p>
          {context?.ctaLink && (
            <a
              href={context.ctaLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-amber-200 mt-2"
            >
              {context.ctaLink}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-8">
        <StatCard label="Total clicks" value={totalClicks.toLocaleString()} />
        <StatCard label="Unique buyers" value={knownClickers.toLocaleString()} />
        <StatCard label="Anonymous" value={anonClickers.toLocaleString()} />
      </div>

      <div className="mt-8 rounded-2xl border border-amber-200/15 bg-gradient-to-br from-gray-900/60 to-gray-950/60 backdrop-blur overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wider text-amber-200/80">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Buyer</th>
              <th className="text-right px-4 py-3 font-semibold">Clicks</th>
              <th className="text-left px-4 py-3 font-semibold">First</th>
              <th className="text-left px-4 py-3 font-semibold">Last</th>
              <th className="text-right px-4 py-3 font-semibold">Open</th>
            </tr>
          </thead>
          <tbody>
            {clickers.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-white/40"
                >
                  <Users className="w-6 h-6 mx-auto mb-2 text-amber-200/30" />
                  No clicks recorded for this CTA.
                </td>
              </tr>
            )}
            {clickers.map((c) => (
              <tr
                key={c.user_id ?? '__anon__'}
                className="border-t border-white/5 hover:bg-white/[0.02]"
              >
                <td className="px-4 py-2.5">
                  {c.user_id ? (
                    c.email ?? (
                      <span className="font-mono text-xs text-white/60">
                        {c.user_id.slice(0, 8)}…
                      </span>
                    )
                  ) : (
                    <span className="text-white/30 italic">Anonymous</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-300/[0.08] border border-amber-300/30 text-amber-200 text-xs font-semibold">
                    <MousePointerClick className="w-3 h-3" />
                    {c.clicks}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-white/50 text-xs">
                  {formatDate(c.first_click_at)}
                </td>
                <td className="px-4 py-2.5 text-white/50 text-xs">
                  {formatDate(c.last_click_at)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {c.user_id ? (
                    <Link
                      href={`/admin/customers/${c.user_id}`}
                      className="text-amber-300 hover:text-amber-200 text-xs"
                    >
                      open ↗
                    </Link>
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
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-amber-200/15 bg-gradient-to-br from-white/[0.04] to-transparent p-5">
      <div className="text-[11px] uppercase tracking-[0.18em] text-white/50 font-semibold">
        {label}
      </div>
      <div className="text-2xl font-black text-white mt-1">{value}</div>
    </div>
  );
}
