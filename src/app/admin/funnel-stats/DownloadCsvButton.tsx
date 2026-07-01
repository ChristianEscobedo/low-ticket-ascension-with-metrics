'use client';

import { useCallback } from 'react';

type Row = {
  id: string;
  created_at: string;
  product_id: string | null;
  page_type: string | null;
  customer_name: string | null;
  customer_email: string | null;
  amount_cents: number | null;
  currency: string | null;
  stripe_event_id?: string | null;
  payment_intent_id?: string | null;
  checkout_session_id?: string | null;
};

const HEADERS = [
  'created_at',
  'product_id',
  'page_type',
  'customer_name',
  'customer_email',
  'amount_cents',
  'currency',
  'stripe_event_id',
  'payment_intent_id',
  'checkout_session_id'
] as const;

// CSV-escape a single field: wrap in quotes and double any embedded quotes.
const esc = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return `"${s.replace(/"/g, '""')}"`;
};

export default function DownloadCsvButton({ rows }: { rows: Row[] }) {
  const onClick = useCallback(() => {
    const lines = [HEADERS.join(',')];
    for (const r of rows) {
      lines.push(HEADERS.map((h) => esc((r as any)[h])).join(','));
    }
    const blob = new Blob([lines.join('\n')], {
      type: 'text/csv;charset=utf-8;'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `funnel-purchases-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [rows]);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={rows.length === 0}
      className="inline-flex items-center gap-2 rounded-lg border border-brass/30 bg-brass/[0.04] px-3 py-1.5 text-sm font-medium text-brass hover:bg-brass/[0.08] hover:border-brass/50 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
    >
      Download CSV
    </button>
  );
}
