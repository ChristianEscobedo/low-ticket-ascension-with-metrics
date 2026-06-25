import Link from 'next/link';
import { Archive, CheckCircle2, MinusCircle, XCircle } from 'lucide-react';
import {
  getReceiptLogRetentionDays,
  getReceiptLogStats,
  getRecentReceiptLog,
  rollupReceiptLog,
  type ReceiptLogStatus
} from '@/utils/email/receipt-log';

export const dynamic = 'force-dynamic';

const STATUSES: ReceiptLogStatus[] = ['sent', 'skipped', 'failed'];

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

function formatAmount(cents: number | null, currency: string | null) {
  if (cents === null) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency || 'usd').toUpperCase(),
      minimumFractionDigits: 2
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency ?? ''}`;
  }
}

const STATUS_TONE: Record<ReceiptLogStatus, string> = {
  sent: 'border-emerald-400/30 bg-emerald-400/[0.06] text-emerald-200',
  skipped: 'border-white/15 bg-white/[0.03] text-white/50',
  failed: 'border-red-400/30 bg-red-400/[0.06] text-red-200'
};

const STATUS_ICON: Record<ReceiptLogStatus, JSX.Element> = {
  sent: <CheckCircle2 className="w-3 h-3" />,
  skipped: <MinusCircle className="w-3 h-3" />,
  failed: <XCircle className="w-3 h-3" />
};

export default async function ReceiptLogPage({
  searchParams
}: {
  searchParams: { status?: string; email?: string };
}) {
  const status = STATUSES.includes(searchParams.status as ReceiptLogStatus)
    ? (searchParams.status as ReceiptLogStatus)
    : null;
  const email = searchParams.email?.trim() || null;
  const hasFilters = !!(status || email);

  const [rows, stats] = await Promise.all([
    getRecentReceiptLog(200, { status, email }),
    getReceiptLogStats()
  ]);
  const totals = rollupReceiptLog(rows);
  const retentionDays = getReceiptLogRetentionDays();
  const oldestAgeDays =
    stats.oldest !== null
      ? Math.floor(
          (Date.now() - new Date(stats.oldest).getTime()) / 86_400_000
        )
      : null;

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.25em] text-amber-200/80 font-semibold mb-2">
          Email
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
          Receipt log
        </h1>
        <p className="text-sm text-white/60 mt-2 max-w-2xl">
          Every transactional receipt attempt, including no-ops (missing env)
          and provider failures. Use this to confirm a buyer received their
          receipt without leaving the dashboard.
        </p>
      </div>

      <form
        method="get"
        className="rounded-2xl border border-amber-200/15 bg-white/[0.02] p-4 mb-6 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end"
      >
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-white/50 font-semibold">
            Status
          </span>
          <select
            name="status"
            defaultValue={status ?? ''}
            className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-amber-300/50 focus:outline-none"
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-white/50 font-semibold">
            Email contains
          </span>
          <input
            type="text"
            name="email"
            defaultValue={email ?? ''}
            placeholder="buyer@example.com"
            className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-amber-300/50 focus:outline-none"
          />
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
              href="/admin/receipt-log"
              className="px-3 py-2 rounded-lg border border-white/10 text-sm text-white/60 hover:text-white hover:border-white/30"
            >
              Clear
            </Link>
          )}
        </div>
      </form>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Sent" value={totals.sent.toLocaleString()} tone="emerald" />
        <StatCard label="Skipped" value={totals.skipped.toLocaleString()} tone="neutral" />
        <StatCard label="Failed" value={totals.failed.toLocaleString()} tone="red" />
      </div>

      <ReceiptLogTable rows={rows} hasFilters={hasFilters} />

      <div className="mt-6 rounded-2xl border border-amber-200/15 bg-white/[0.02] p-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-white/50">
        <span className="inline-flex items-center gap-2 text-white/70">
          <Archive className="w-3.5 h-3.5 text-amber-200/80" />
          Retention
        </span>
        <span>
          Window:{' '}
          <span className="text-white font-semibold">{retentionDays} days</span>
        </span>
        <span>
          Total rows:{' '}
          <span className="text-white font-semibold">
            {stats.total === null ? '—' : stats.total.toLocaleString()}
          </span>
        </span>
        <span>
          Oldest:{' '}
          <span className="text-white font-semibold">
            {oldestAgeDays === null ? '—' : `${oldestAgeDays}d ago`}
          </span>
        </span>
        <span className="text-white/30">
          Nightly purge: <code className="font-mono">17 3 * * *</code> UTC
        </span>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: 'emerald' | 'neutral' | 'red';
}) {
  const toneCls =
    tone === 'emerald'
      ? 'text-emerald-200'
      : tone === 'red'
        ? 'text-red-200'
        : 'text-white';
  return (
    <div className="rounded-2xl border border-amber-200/15 bg-gradient-to-br from-white/[0.04] to-transparent p-5">
      <div className="text-[11px] uppercase tracking-[0.18em] text-white/50 font-semibold">
        {label}
      </div>
      <div className={`text-2xl font-black mt-1 ${toneCls}`}>{value}</div>
    </div>
  );
}

function ReceiptLogTable({
  rows,
  hasFilters
}: {
  rows: Awaited<ReturnType<typeof getRecentReceiptLog>>;
  hasFilters: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-200/15 bg-white/[0.02] p-10 text-center">
        <p className="text-white/70 font-medium">
          {hasFilters
            ? 'No receipt attempts match these filters'
            : 'No receipt attempts logged yet'}
        </p>
        <p className="text-sm text-white/40 mt-1">
          {hasFilters
            ? 'Try widening the filters or clearing them.'
            : 'Entries will appear here once your first paid order completes.'}
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-amber-200/15 bg-white/[0.02] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wider text-white/50">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">When</th>
              <th className="text-left px-4 py-3 font-semibold">Status</th>
              <th className="text-left px-4 py-3 font-semibold">Customer</th>
              <th className="text-right px-4 py-3 font-semibold">Amount</th>
              <th className="text-left px-4 py-3 font-semibold">Provider</th>
              <th className="text-left px-4 py-3 font-semibold">Delivery</th>
              <th className="text-left px-4 py-3 font-semibold">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-white/[0.02] align-top">
                <td className="px-4 py-3 text-white/60 text-xs whitespace-nowrap">
                  {formatDate(r.created_at)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold uppercase tracking-wider ${STATUS_TONE[r.status]}`}
                  >
                    {STATUS_ICON[r.status]}
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="text-white">{r.customer_email ?? '—'}</div>
                  {r.payment_intent_id && (
                    <div className="text-[11px] text-white/30 font-mono">
                      {r.payment_intent_id}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-white/70 font-mono text-xs">
                  {formatAmount(r.amount_cents, r.currency)}
                </td>
                <td className="px-4 py-3 text-white/50 text-xs">
                  {r.provider ?? '—'}
                  {r.http_status ? (
                    <span className="text-white/30"> · {r.http_status}</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-xs">
                  <DeliveryPill row={r} />
                </td>
                <td className="px-4 py-3 text-xs">
                  {r.status === 'sent' && r.message_id && (
                    <span className="text-emerald-200/80 font-mono">
                      {r.message_id}
                    </span>
                  )}
                  {r.status === 'skipped' && (
                    <span className="text-white/50">{r.skipped_reason}</span>
                  )}
                  {r.status === 'failed' && (
                    <span className="text-red-200/80">{r.error}</span>
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

const DELIVERY_TONE: Record<string, string> = {
  delivered: 'border-emerald-400/30 bg-emerald-400/[0.06] text-emerald-200',
  opened: 'border-sky-400/30 bg-sky-400/[0.06] text-sky-200',
  clicked: 'border-sky-400/30 bg-sky-400/[0.06] text-sky-200',
  bounced: 'border-red-400/30 bg-red-400/[0.06] text-red-200',
  failed: 'border-red-400/30 bg-red-400/[0.06] text-red-200',
  complained: 'border-amber-400/30 bg-amber-400/[0.06] text-amber-200',
  delayed: 'border-amber-400/30 bg-amber-400/[0.06] text-amber-200',
  sent: 'border-white/15 bg-white/[0.03] text-white/60'
};

function DeliveryPill({
  row
}: {
  row: Awaited<ReturnType<typeof getRecentReceiptLog>>[number];
}) {
  if (row.status !== 'sent') return <span className="text-white/30">—</span>;
  const s = row.delivery_status;
  if (!s) {
    return (
      <span className="text-white/40 text-[11px] italic">awaiting webhook</span>
    );
  }
  const tone =
    DELIVERY_TONE[s] ?? 'border-white/15 bg-white/[0.03] text-white/60';
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className={`inline-flex w-fit items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold uppercase tracking-wider ${tone}`}
      >
        {s}
      </span>
      {row.bounce_reason && (
        <span className="text-[10px] text-red-200/70 break-words">
          {row.bounce_reason}
        </span>
      )}
    </div>
  );
}
