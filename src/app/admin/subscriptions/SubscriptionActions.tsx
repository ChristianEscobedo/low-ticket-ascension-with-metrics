'use client';

import { useState, useTransition } from 'react';
import {
  cancelSubscriptionAction,
  compSubscriptionAction,
  refundLatestSubscriptionPaymentAction,
  revokeCompAction,
} from './actions';

/**
 * Row-level subscription management: cancel (period end / immediately) and
 * refund the latest payment, plus the comp-access form and comp revoke.
 * Server actions do the Stripe + DB work; these just confirm and report.
 */

const btn =
  'rounded-lg border border-brass/20 px-2.5 py-1 text-xs text-bone/70 transition-colors hover:bg-brass/[0.06] hover:border-brass/40 hover:text-brass disabled:opacity-40';
const btnDanger =
  'rounded-lg border border-red-400/30 px-2.5 py-1 text-xs text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-40';

export function SubscriptionRowActions({
  subscriptionId,
  status,
}: {
  subscriptionId: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const inactive = status === 'canceled' || status === 'incomplete_expired';

  const run = (fn: () => Promise<{ ok: boolean; message: string }>) => {
    setMessage(null);
    startTransition(async () => {
      const res = await fn();
      setMessage(res.message);
    });
  };

  if (inactive) return <span className="text-xs text-bone/30">—</span>;

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={pending}
          className={btn}
          onClick={() => {
            if (!confirm('Cancel at the end of the current period?')) return;
            run(() =>
              cancelSubscriptionAction({ subscriptionId, immediately: false }),
            );
          }}
        >
          Cancel at period end
        </button>
        <button
          type="button"
          disabled={pending}
          className={btnDanger}
          onClick={() => {
            if (
              !confirm(
                'Cancel IMMEDIATELY? Access ends now. This cannot be undone.',
              )
            )
              return;
            run(() =>
              cancelSubscriptionAction({ subscriptionId, immediately: true }),
            );
          }}
        >
          Cancel now
        </button>
        <button
          type="button"
          disabled={pending}
          className={btnDanger}
          onClick={() => {
            if (!confirm('Refund the latest payment on this subscription?'))
              return;
            run(() => refundLatestSubscriptionPaymentAction({ subscriptionId }));
          }}
        >
          Refund latest
        </button>
      </div>
      {message && <span className="text-[11px] text-bone/50">{message}</span>}
    </div>
  );
}

export function RevokeCompButton({ compId }: { compId: string }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        className={btnDanger}
        onClick={() => {
          if (!confirm('Revoke this comped access?')) return;
          startTransition(async () => {
            const res = await revokeCompAction(compId);
            setDone(res.message);
          });
        }}
      >
        Revoke
      </button>
      {done && <span className="text-[11px] text-bone/50">{done}</span>}
    </span>
  );
}

export function CompSubscriptionForm({
  products,
}: {
  products: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState('');
  const [productId, setProductId] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean>(false);

  return (
    <form
      className="grid grid-cols-1 gap-3 sm:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        const product = products.find((p) => p.id === productId);
        startTransition(async () => {
          const res = await compSubscriptionAction({
            email,
            productId: productId || null,
            productName: product?.name ?? null,
            note: note || null,
          });
          setOk(res.ok);
          setMessage(res.message);
          if (res.ok) {
            setEmail('');
            setNote('');
          }
        });
      }}
    >
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="customer@email.com"
        className="rounded-lg bg-bone/[0.03] border border-bone/10 px-3 py-2 text-sm text-bone placeholder-bone/30 focus:outline-none focus:border-brass/60"
      />
      <select
        value={productId}
        onChange={(e) => setProductId(e.target.value)}
        className="rounded-lg bg-bone/[0.03] border border-bone/10 px-3 py-2 text-sm text-bone focus:outline-none focus:border-brass/60"
      >
        <option value="">Product (optional)</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (why comped)"
        className="rounded-lg bg-bone/[0.03] border border-bone/10 px-3 py-2 text-sm text-bone placeholder-bone/30 focus:outline-none focus:border-brass/60"
      />
      <button
        type="submit"
        disabled={pending || !email.includes('@')}
        className="rounded-lg bg-brass hover:bg-brass/90 text-ink px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-40"
      >
        {pending ? 'Comping…' : 'Comp access'}
      </button>
      {message && (
        <p
          className={`sm:col-span-4 text-xs ${ok ? 'text-emerald-300' : 'text-red-300'}`}
        >
          {message}
        </p>
      )}
    </form>
  );
}
