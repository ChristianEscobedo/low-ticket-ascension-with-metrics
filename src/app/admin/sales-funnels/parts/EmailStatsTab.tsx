'use client';

import { type SalesEmailEvent } from '@/lib/mothermode/sales/types';
import { btnGhost, panelClass, StatChip } from './ui';

/**
 * One bound event's sequence roll-up, already summed in the shell so this tab
 * stays a pure renderer (and so the analytics module is imported once).
 */
export interface EmailStatsRow {
  event: SalesEmailEvent;
  eventLabel: string;
  kitId: string;
  kitName: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  bounced: number;
  revenue?: number;
  /** ISO timestamp of the last ingestion, or null when never populated. */
  updatedAt: string | null;
}

interface Props {
  /** Null until the tab has been opened once (the fetch is lazy). */
  rows: EmailStatsRow[] | null;
  busy: boolean;
  error: string | null;
  onReload: () => void;
}

function pct(part: number, whole: number): string {
  if (whole <= 0) return '—';
  return ((part / whole) * 100).toFixed(1) + '%';
}

/**
 * `Emails > Analytics`: per-event sequence performance for the kits bound to
 * this funnel.
 *
 * The fetch fires when this tab is opened rather than on editor load — one
 * request per bound kit is far too much to pay for an admin who is only there
 * to change a headline.
 */
export default function EmailStatsTab({ rows, busy, error, onReload }: Props) {
  const totals = (rows ?? []).reduce(
    (acc, r) => ({
      sent: acc.sent + r.sent,
      delivered: acc.delivered + r.delivered,
      opened: acc.opened + r.opened,
      clicked: acc.clicked + r.clicked,
      revenue: acc.revenue + (r.revenue ?? 0),
    }),
    { sent: 0, delivered: 0, opened: 0, clicked: 0, revenue: 0 },
  );

  return (
    <section className={panelClass + ' space-y-4'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brass/80">
            Email analytics
          </div>
          <p className="text-xs text-bone/40">
            Counters ingested from your ESP for the kits bound to this funnel. Numbers stay at
            zero until a provider posts events.
          </p>
        </div>
        <button type="button" onClick={onReload} disabled={busy} className={btnGhost}>
          {busy ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {rows === null && !error && <div className="text-xs text-bone/40">Reading stats…</div>}

      {rows !== null && rows.length === 0 && !error && (
        <div className="rounded-lg border border-bone/10 bg-ink/40 px-3 py-2 text-xs text-bone/45">
          No kits bound yet. Bind (or auto-build) sequences in the Kits tab and their numbers
          will show up here.
        </div>
      )}

      {rows !== null && rows.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatChip label="Sent" value={String(totals.sent)} />
            <StatChip label="Delivered" value={pct(totals.delivered, totals.sent)} />
            <StatChip label="Open rate" value={pct(totals.opened, totals.delivered)} />
            <StatChip label="Click rate" value={pct(totals.clicked, totals.delivered)} />
          </div>
          <div className="grid gap-1.5">
            {rows.map((row) => (
              <div
                key={row.event}
                className="rounded-lg border border-bone/10 bg-ink/40 px-2.5 py-2"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs text-bone/80">{row.eventLabel}</div>
                    <div className="truncate text-[11px] text-bone/40">{row.kitName}</div>
                  </div>
                  <a
                    href={'/admin/email-marketing?kit=' + encodeURIComponent(row.kitId)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-brass/80 hover:text-brass"
                  >
                    Open kit
                  </a>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-bone/45">
                  <span>Sent {row.sent}</span>
                  <span>Delivered {pct(row.delivered, row.sent)}</span>
                  <span>Opens {pct(row.opened, row.delivered)}</span>
                  <span>Clicks {pct(row.clicked, row.delivered)}</span>
                  <span>Unsubs {pct(row.unsubscribed, row.delivered)}</span>
                  <span>Bounces {pct(row.bounced, row.sent)}</span>
                  {row.revenue !== undefined && <span>Revenue ${row.revenue.toFixed(2)}</span>}
                  <span>
                    {row.updatedAt
                      ? 'Updated ' + new Date(row.updatedAt).toLocaleString()
                      : 'Never ingested'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
