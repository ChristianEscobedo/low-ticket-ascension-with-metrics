'use client';

import { useState, useTransition } from 'react';
import { refundPurchaseAction } from './actions';

/** Per-row refund control for /admin/purchases. Full refund by default; the
 *  prompt accepts an optional partial amount in dollars. */
export default function RefundButton({
  purchaseId,
  amountCents,
  status,
}: {
  purchaseId: string;
  amountCents: number;
  status: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (status === 'refunded') {
    return <span className="text-xs text-red-300/80">refunded</span>;
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const dollars = (amountCents / 100).toFixed(2);
          const input = window.prompt(
            `Refund this purchase? Type an amount for a partial refund, or leave blank for a full ${dollars} refund.`,
            '',
          );
          if (input === null) return; // cancelled
          const trimmed = input.trim();
          let amount: number | null = null;
          if (trimmed.length > 0) {
            const parsed = Math.round(parseFloat(trimmed.replace(/[$,]/g, '')) * 100);
            if (!Number.isFinite(parsed) || parsed <= 0 || parsed > amountCents) {
              setMessage('Invalid amount.');
              return;
            }
            amount = parsed;
          }
          setMessage(null);
          startTransition(async () => {
            const res = await refundPurchaseAction({
              purchaseId,
              amountCents: amount,
            });
            setMessage(res.message);
          });
        }}
        className="rounded-lg border border-red-400/30 px-2.5 py-1 text-xs text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-40"
      >
        {pending ? 'Refunding…' : 'Refund'}
      </button>
      {message && (
        <span className="max-w-[180px] text-right text-[11px] text-bone/50">
          {message}
        </span>
      )}
    </span>
  );
}
