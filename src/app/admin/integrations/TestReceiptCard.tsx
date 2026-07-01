'use client';

import { useState } from 'react';
import { CheckCircle2, Mail, XCircle } from 'lucide-react';

interface ResultState {
  ok: boolean;
  message: string;
  detail?: string;
}

export default function TestReceiptCard({
  defaultEmail
}: {
  defaultEmail?: string;
}) {
  const [email, setEmail] = useState(defaultEmail ?? '');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ResultState | null>(null);

  const send = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/send-test-receipt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.success) {
        setResult({
          ok: true,
          message: `Sent via ${body.provider ?? 'provider'}`,
          detail: `Delivered to ${body.to}`
        });
      } else {
        setResult({
          ok: false,
          message: body.skipped
            ? 'Receipts are disabled or misconfigured'
            : 'Provider rejected the request',
          detail:
            body.skipped ??
            body.error ??
            (body.status ? `HTTP ${body.status}` : 'Unknown error')
        });
      }
    } catch (err) {
      setResult({
        ok: false,
        message: 'Network error',
        detail: err instanceof Error ? err.message : String(err)
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-brass/[0.08] border border-brass/30 flex items-center justify-center text-brass flex-shrink-0">
          <Mail className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white">
              Send test receipt
            </h3>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-brass/[0.08] border border-brass/30 text-brass font-semibold">
              Live
            </span>
          </div>
          <p className="text-sm text-white/60 mt-1">
            Fires a synthetic purchase receipt through the currently-configured
            email provider so you can verify branding, deliverability, and
            inbox placement without taking a real order.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="flex-1 bg-ink/40 border border-bone/10 rounded-lg px-3 py-2 text-sm text-bone focus:border-brass/50 focus:outline-none"
          autoComplete="email"
        />
        <button
          type="button"
          onClick={send}
          disabled={busy || !email.trim()}
          className="px-4 py-2 rounded-lg bg-brass text-ink text-sm font-bold hover:bg-brass/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? 'Sending…' : 'Send test'}
        </button>
      </div>

      {result && (
        <div
          className={`mt-3 flex items-start gap-2 text-sm rounded-lg px-3 py-2 border ${
            result.ok
              ? 'border-emerald-400/30 bg-emerald-400/[0.05] text-emerald-200'
              : 'border-red-400/30 bg-red-400/[0.05] text-red-200'
          }`}
        >
          {result.ok ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          )}
          <div className="min-w-0">
            <div className="font-medium">{result.message}</div>
            {result.detail && (
              <div className="text-xs opacity-80 mt-0.5 break-words">
                {result.detail}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
