'use client';

import { useState, useTransition } from 'react';
import { createProductAction } from './actions';
import { PAGE_TYPES } from '@/utils/integrations/types';

export default function CreateProductForm() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (formData: FormData) => {
    setError(null);
    const dollars = Number(formData.get('amount') ?? 0);
    startTransition(async () => {
      try {
        await createProductAction({
          name: String(formData.get('name') ?? ''),
          description: String(formData.get('description') ?? ''),
          page_type: (formData.get('page_type') as string) || undefined,
          funnel: (formData.get('funnel') as string) || undefined,
          unit_amount_cents: Math.round(dollars * 100),
          currency: String(formData.get('currency') ?? 'usd'),
          interval: (formData.get('interval') as any) || 'one_time'
        });
        setOpen(false);
      } catch (err: any) {
        setError(err?.message ?? 'Failed to create product.');
      }
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-brass/20 px-4 py-2 text-sm text-brass hover:bg-brass/[0.06] hover:border-brass/40 transition-colors"
      >
        + Create product
      </button>
    );
  }

  return (
    <form
      action={onSubmit}
      className="rounded-2xl border border-brass/30 bg-gradient-to-br from-mode-deep/40 to-ink/70 backdrop-blur p-5 shadow-[0_0_30px_rgba(168,139,92,0.08)]"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold tracking-tight">New product</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-bone/40 hover:text-bone text-sm"
        >
          Cancel
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-sm sm:col-span-2">
          <span className="text-bone/70">Name</span>
          <input
            name="name"
            required
            placeholder="MotherMode FE"
            className="mt-1 w-full rounded-lg bg-bone/[0.03] border border-bone/10 px-3 py-2 text-sm text-bone placeholder-bone/30 focus:outline-none focus:border-brass/60"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-bone/70">Description</span>
          <textarea
            name="description"
            rows={2}
            className="mt-1 w-full rounded-lg bg-bone/[0.03] border border-bone/10 px-3 py-2 text-sm text-bone placeholder-bone/30 focus:outline-none focus:border-brass/60"
          />
        </label>
        <label className="block text-sm">
          <span className="text-bone/70">Price (USD)</span>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0.50"
            required
            placeholder="27.00"
            className="mt-1 w-full rounded-lg bg-bone/[0.03] border border-bone/10 px-3 py-2 text-sm text-bone placeholder-bone/30 focus:outline-none focus:border-brass/60"
          />
        </label>
        <label className="block text-sm">
          <span className="text-bone/70">Billing</span>
          <select
            name="interval"
            defaultValue="one_time"
            className="mt-1 w-full rounded-lg bg-bone/[0.03] border border-bone/10 px-3 py-2 text-sm text-bone focus:outline-none focus:border-brass/60"
          >
            <option value="one_time">One-time</option>
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-bone/70">Funnel stage</span>
          <select
            name="page_type"
            defaultValue=""
            className="mt-1 w-full rounded-lg bg-bone/[0.03] border border-bone/10 px-3 py-2 text-sm text-bone focus:outline-none focus:border-brass/60"
          >
            <option value="">(none)</option>
            {PAGE_TYPES.map((pt) => (
              <option key={pt} value={pt}>
                {pt}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-bone/70">Funnel slug</span>
          <input
            name="funnel"
            defaultValue="mothermode"
            className="mt-1 w-full rounded-lg bg-bone/[0.03] border border-bone/10 px-3 py-2 text-sm text-bone focus:outline-none focus:border-brass/60"
          />
        </label>
        <input type="hidden" name="currency" value="usd" />
      </div>
      {error && (
        <div className="text-sm text-red-300 mt-3">{error}</div>
      )}
      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brass hover:bg-brass/90 text-ink px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {pending ? 'Creating…' : 'Create in Stripe'}
        </button>
        <span className="text-xs text-bone/40">
          Creates a Stripe product + price and syncs to Supabase.
        </span>
      </div>
    </form>
  );
}
