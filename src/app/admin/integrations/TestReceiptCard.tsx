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
    <div className="rounded-2xl border border-amber-200/15 bg-gradient-to-br from-white/[0.04] to-transparent p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-amber-300/[0.08] border border-amber-300/30 flex items-center justify-center text-amber-200 flex-shrink-0">
          <Mail className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white">
              Send test receipt
            </h3>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-300/[0.08] border border-amber-300/30 text-amber-200 font-semibold">
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
          className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-300/50 focus:outline-none"
          autoComplete="email"
        />
        <button
          type="button"
          onClick={send}
          disabled={busy || !email.trim()}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 text-black text-sm font-bold hover:from-amber-300 hover:to-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
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
