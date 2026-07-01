import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Inbox,
  Mail,
  PlugZap
} from 'lucide-react';
import type { ResendWebhookHealth } from '@/utils/email/receipt-log';

function formatRelative(iso: string | null, now: Date = new Date()): string {
  if (!iso) return 'never';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 'never';
  const diff = Math.max(0, now.getTime() - t);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatPct(rate: number | null): string {
  if (rate === null) return '-';
  return `${(rate * 100).toFixed(1)}%`;
}

interface Props {
  health: ResendWebhookHealth;
}

export default function ResendHealthCard({ health }: Props) {
  const {
    sent7d,
    delivered7d,
    bounced7d,
    complained7d,
    awaiting7d,
    bounceRate,
    complaintRate,
    lastSendAt,
    lastEventAt,
    lastEventType,
    configured
  } = health;

  const hasEvents = !!lastEventAt;
  const hasSends = !!lastSendAt;
  const bounceTrouble = bounceRate !== null && bounceRate >= 0.05;
  const complaintTrouble = complaintRate !== null && complaintRate >= 0.001;
  const noEventsButSends = hasSends && !hasEvents;

  return (
    <div className="rounded-2xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 p-5">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <PlugZap className="w-4 h-4 text-brass/80" />
          <h3 className="text-sm font-bold tracking-wide text-white uppercase">
            Resend webhook
          </h3>
          {!configured ? (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/10 text-white/40 font-semibold">
              Not configured
            </span>
          ) : noEventsButSends ? (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-brass/[0.08] border border-brass/30 text-brass font-semibold">
              No events received
            </span>
          ) : bounceTrouble || complaintTrouble ? (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-red-500/[0.08] border border-red-400/30 text-red-200 font-semibold">
              Investigate
            </span>
          ) : hasEvents ? (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-400/[0.08] border border-emerald-400/30 text-emerald-200 font-semibold">
              Healthy
            </span>
          ) : (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/10 text-white/40 font-semibold">
              Idle
            </span>
          )}
        </div>
        <Link
          href="/admin/receipt-log"
          className="text-xs text-brass/80 hover:text-brass"
        >
          View audit log →
        </Link>
      </div>

      <p className="text-xs text-white/50 mb-4 max-w-2xl">
        Last 7 days of receipt sends, cross-referenced with Resend's
        delivery / bounce / complaint webhooks. POST{' '}
        <code className="text-brass/80">/api/webhooks/resend</code> with
        your signing secret to keep this in sync.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        <Stat icon={<Mail className="w-3.5 h-3.5" />} label="Sent" value={sent7d} />
        <Stat
          icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />}
          label="Delivered"
          value={delivered7d}
        />
        <Stat
          icon={<AlertTriangle className="w-3.5 h-3.5 text-red-300" />}
          label="Bounced"
          value={bounced7d}
          accent={bounceTrouble ? 'red' : undefined}
          sub={formatPct(bounceRate)}
        />
        <Stat
          icon={<AlertTriangle className="w-3.5 h-3.5 text-brass" />}
          label="Complaints"
          value={complained7d}
          accent={complaintTrouble ? 'red' : undefined}
          sub={formatPct(complaintRate)}
        />
        <Stat
          icon={<Inbox className="w-3.5 h-3.5 text-white/40" />}
          label="Awaiting"
          value={awaiting7d}
          sub="no event yet"
        />
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-white/50 pt-3 border-t border-white/[0.05]">
        <span>
          Last send: <span className="text-white/80">{formatRelative(lastSendAt)}</span>
        </span>
        <span>
          Last event:{' '}
          <span className="text-white/80">{formatRelative(lastEventAt)}</span>
          {lastEventType && (
            <span className="text-white/40"> ({lastEventType})</span>
          )}
        </span>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
  accent
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
  accent?: 'red';
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 ${
        accent === 'red'
          ? 'border-red-400/30 bg-red-500/[0.04]'
          : 'border-white/[0.08] bg-black/30'
      }`}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/50 font-semibold">
        {icon}
        {label}
      </div>
      <div className="text-xl font-bold text-white tabular-nums mt-0.5">
        {value.toLocaleString()}
      </div>
      {sub && <div className="text-[10px] text-white/40 mt-0.5">{sub}</div>}
    </div>
  );
}
