'use client';

import { useState, useTransition } from 'react';
import { syncProductsAction } from './actions';

export default function SyncButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  const onClick = () => {
    setResult(null);
    startTransition(async () => {
      try {
        const r = await syncProductsAction();
        setResult(`Synced ${r.products} products, ${r.prices} prices.`);
      } catch (e: any) {
        setResult(`Failed: ${e?.message ?? 'unknown error'}`);
      }
    });
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded-lg bg-brass hover:bg-brass/90 text-ink px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? 'Syncing…' : 'Sync from Stripe'}
      </button>
      {result && <span className="text-sm text-bone/60">{result}</span>}
    </div>
  );
}
