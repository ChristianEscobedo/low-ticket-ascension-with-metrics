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
        className="rounded-lg border border-amber-200/20 px-4 py-2 text-sm text-amber-200 hover:bg-amber-200/[0.06] hover:border-amber-200/40 transition-colors"
      >
        + Create product
      </button>
    );
  }

  return (
    <form
      action={onSubmit}
      className="rounded-2xl border border-amber-200/30 bg-gradient-to-br from-gray-900/80 to-gray-950/80 backdrop-blur p-5 shadow-[0_0_30px_rgba(251,191,36,0.08)]"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold tracking-tight">New product</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-white/40 hover:text-white text-sm"
        >
          Cancel
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-sm sm:col-span-2">
          <span className="text-white/70">Name</span>
          <input
            name="name"
            required
            placeholder="Millionaire Mindshift FE"
            className="mt-1 w-full rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-300/60"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-white/70">Description</span>
          <textarea
            name="description"
            rows={2}
            className="mt-1 w-full rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-300/60"
          />
        </label>
        <label className="block text-sm">
          <span className="text-white/70">Price (USD)</span>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0.50"
            required
            placeholder="27.00"
            className="mt-1 w-full rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-300/60"
          />
        </label>
        <label className="block text-sm">
          <span className="text-white/70">Billing</span>
          <select
            name="interval"
            defaultValue="one_time"
            className="mt-1 w-full rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-300/60"
          >
            <option value="one_time">One-time</option>
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-white/70">Funnel stage</span>
          <select
            name="page_type"
            defaultValue=""
            className="mt-1 w-full rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-300/60"
          >
            <option value="">— none —</option>
            {PAGE_TYPES.map((pt) => (
              <option key={pt} value={pt}>
                {pt}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-white/70">Funnel slug</span>
          <input
            name="funnel"
            defaultValue="millionaire-mindshift"
            className="mt-1 w-full rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-300/60"
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
          className="rounded-lg bg-amber-500 hover:bg-amber-400 text-black px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {pending ? 'Creating…' : 'Create in Stripe'}
        </button>
        <span className="text-xs text-white/40">
          Creates a Stripe product + price and syncs to Supabase.
        </span>
      </div>
    </form>
  );
}
