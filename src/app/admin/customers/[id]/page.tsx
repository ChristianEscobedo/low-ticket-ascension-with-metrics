import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getCustomerActivity,
  getCustomerById
} from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';

const fmt = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const fmtSeconds = (s: number) => {
  if (!s || s < 60) return `${Math.max(0, Math.round(s))}s`;
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m}m ${r}s`;
};

export default async function CustomerDetailPage({
  params
}: {
  params: { id: string };
}) {
  const detail = await getCustomerById(params.id);
  if (!detail) return notFound();

  const { user, stripe_customer_id, subscriptions, purchases, lifetimeCents } =
    detail;
  const activity = await getCustomerActivity(user.id, user.email || null);

  return (
    <div>
      <Link
        href="/admin/customers"
        className="text-white/50 hover:text-amber-200 text-sm transition-colors"
      >
        ← Back to customers
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">{user.email}</h1>
        <a
          href={`/api/admin/customers/${user.id}/report`}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-200/25 bg-amber-400/[0.06] text-amber-200 text-xs font-semibold uppercase tracking-wider hover:bg-amber-400/[0.12]"
        >
          ↓ Download buyer report
        </a>
      </div>
      <p className="mt-2 text-white/60 text-sm">
        Joined {new Date(user.created_at).toLocaleString()} · user id{' '}
        <code className="text-white/80">{user.id}</code>
      </p>
      {stripe_customer_id && (
        <p className="mt-1 text-sm">
          Stripe customer{' '}
          <a
            href={`https://dashboard.stripe.com/customers/${stripe_customer_id}`}
            target="_blank"
            rel="noreferrer"
            className="text-amber-300 hover:text-amber-200 hover:underline"
          >
            {stripe_customer_id} ↗
          </a>
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
        <StatCard label="Lifetime spend" value={fmt(lifetimeCents)} />
        <StatCard label="Total purchases" value={String(purchases.length)} />
        <StatCard
          label="Subscriptions"
          value={String(subscriptions.length)}
        />
      </div>

      <h2 className="text-2xl font-bold mt-12 mb-4 tracking-tight">Subscriptions</h2>
      <div className="overflow-x-auto rounded-2xl border border-amber-200/15 bg-gradient-to-br from-gray-900/60 to-gray-950/60 backdrop-blur">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-amber-200/80 uppercase tracking-wider text-xs">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Status</th>
              <th className="text-left px-4 py-3 font-semibold">Plan</th>
              <th className="text-left px-4 py-3 font-semibold">Created</th>
              <th className="text-left px-4 py-3 font-semibold">Renews</th>
              <th className="text-left px-4 py-3 font-semibold">Stripe</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-white/40">
                  No subscriptions.
                </td>
              </tr>
            )}
            {subscriptions.map((s: any) => (
              <tr key={s.id} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-2.5">{s.status}</td>
                <td className="px-4 py-2.5">
                  {s.prices?.products?.name ?? '—'}{' '}
                  <span className="text-white/40 text-xs">
                    ({s.prices?.unit_amount ? fmt(s.prices.unit_amount) : '—'}/
                    {s.prices?.interval ?? '?'})
                  </span>
                </td>
                <td className="px-4 py-2.5 text-white/60">
                  {s.created ? new Date(s.created).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-2.5 text-white/60">
                  {s.current_period_end
                    ? new Date(s.current_period_end).toLocaleDateString()
                    : '—'}
                </td>
                <td className="px-4 py-2.5">
                  <a
                    href={`https://dashboard.stripe.com/subscriptions/${s.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-300 hover:text-amber-200 hover:underline"
                  >
                    open ↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-bold mt-12 mb-4 tracking-tight">Purchases</h2>
      <div className="overflow-x-auto rounded-2xl border border-amber-200/15 bg-gradient-to-br from-gray-900/60 to-gray-950/60 backdrop-blur">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-amber-200/80 uppercase tracking-wider text-xs">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">When</th>
              <th className="text-left px-4 py-3 font-semibold">Product</th>
              <th className="text-left px-4 py-3 font-semibold">Page</th>
              <th className="text-right px-4 py-3 font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {purchases.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-white/40">
                  No purchases.
                </td>
              </tr>
            )}
            {purchases.map((p) => (
              <tr key={p.id} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-2.5 text-white/60 whitespace-nowrap">
                  {new Date(p.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2.5">{p.product_id ?? '—'}</td>
                <td className="px-4 py-2.5">{p.page_type ?? '—'}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {fmt(p.amount_cents ?? 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-bold mt-12 mb-4 tracking-tight">
        Receipt deliveries
      </h2>
      <div className="overflow-x-auto rounded-2xl border border-amber-200/15 bg-gradient-to-br from-gray-900/60 to-gray-950/60 backdrop-blur">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-amber-200/80 uppercase tracking-wider text-xs">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">When</th>
              <th className="text-left px-4 py-3 font-semibold">Status</th>
              <th className="text-left px-4 py-3 font-semibold">Delivery</th>
              <th className="text-left px-4 py-3 font-semibold">Provider</th>
              <th className="text-right px-4 py-3 font-semibold">Amount</th>
              <th className="text-left px-4 py-3 font-semibold">Detail</th>
            </tr>
          </thead>
          <tbody>
            {activity.receiptLog.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-white/40">
                  No receipt attempts.
                </td>
              </tr>
            )}
            {activity.receiptLog.map((r) => (
              <tr
                key={r.id}
                className="border-t border-white/5 hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-4 py-2.5 text-white/60 whitespace-nowrap text-xs">
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2.5">
                  <span className="text-[11px] uppercase tracking-wider font-semibold">
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-white/70 text-xs">
                  {r.delivery_status ?? (r.status === 'sent' ? 'awaiting' : '—')}
                  {r.bounce_reason && (
                    <div className="text-red-200/70 text-[10px] mt-0.5">
                      {r.bounce_reason}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5 text-white/50 text-xs">
                  {r.provider ?? '—'}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                  {r.amount_cents != null ? fmt(r.amount_cents) : '—'}
                </td>
                <td className="px-4 py-2.5 text-xs text-white/50">
                  {r.error ?? r.skipped_reason ?? r.message_id ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-bold mt-12 mb-4 tracking-tight">
        CTA clicks
      </h2>
      <div className="overflow-x-auto rounded-2xl border border-amber-200/15 bg-gradient-to-br from-gray-900/60 to-gray-950/60 backdrop-blur">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-amber-200/80 uppercase tracking-wider text-xs">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">When</th>
              <th className="text-left px-4 py-3 font-semibold">Course</th>
              <th className="text-left px-4 py-3 font-semibold">Lesson</th>
              <th className="text-left px-4 py-3 font-semibold">CTA</th>
            </tr>
          </thead>
          <tbody>
            {activity.ctaClicks.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-white/40">
                  No CTA clicks recorded.
                </td>
              </tr>
            )}
            {activity.ctaClicks.map((c) => (
              <tr
                key={c.id}
                className="border-t border-white/5 hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-4 py-2.5 text-white/60 whitespace-nowrap text-xs">
                  {new Date(c.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-white/70 text-xs">
                  {c.course_title ?? '—'}
                </td>
                <td className="px-4 py-2.5 text-white/80 text-xs">
                  {c.lesson_title ?? c.lesson_id}
                </td>
                <td className="px-4 py-2.5 text-amber-200 font-mono text-xs">
                  {c.cta_id}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-bold mt-12 mb-4 tracking-tight">
        Lesson progress
      </h2>
      <div className="overflow-x-auto rounded-2xl border border-amber-200/15 bg-gradient-to-br from-gray-900/60 to-gray-950/60 backdrop-blur">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-amber-200/80 uppercase tracking-wider text-xs">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Last watched</th>
              <th className="text-left px-4 py-3 font-semibold">Course</th>
              <th className="text-left px-4 py-3 font-semibold">Lesson</th>
              <th className="text-left px-4 py-3 font-semibold">Progress</th>
              <th className="text-left px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {activity.lessonProgress.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-white/40">
                  No lessons watched yet.
                </td>
              </tr>
            )}
            {activity.lessonProgress.map((p) => (
              <tr
                key={p.lesson_id}
                className="border-t border-white/5 hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-4 py-2.5 text-white/60 whitespace-nowrap text-xs">
                  {p.last_watched_at
                    ? new Date(p.last_watched_at).toLocaleString()
                    : '—'}
                </td>
                <td className="px-4 py-2.5 text-white/70 text-xs">
                  {p.course_title ?? '—'}
                </td>
                <td className="px-4 py-2.5 text-white/80 text-xs">
                  {p.lesson_title ?? p.lesson_id}
                </td>
                <td className="px-4 py-2.5 text-white/70 tabular-nums text-xs">
                  {fmtSeconds(p.progress_seconds)}
                </td>
                <td className="px-4 py-2.5">
                  {p.is_completed ? (
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-200">
                      Completed
                    </span>
                  ) : (
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-amber-200/70">
                      In progress
                    </span>
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
    <div className="rounded-2xl border border-amber-200/15 bg-gradient-to-br from-gray-900/60 to-gray-950/60 backdrop-blur p-5 shadow-[0_0_30px_rgba(251,191,36,0.04)]">
      <div className="text-xs uppercase tracking-wider text-amber-200/70 font-semibold">{label}</div>
      <div className="mt-2 text-3xl font-bold tabular-nums tracking-tight">{value}</div>
    </div>
  );
}
