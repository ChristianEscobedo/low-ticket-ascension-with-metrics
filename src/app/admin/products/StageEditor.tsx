'use client';

import { useState, useTransition } from 'react';
import { updateProductStageAction } from './actions';
import { PAGE_TYPES } from '@/utils/integrations/types';

interface Props {
  productId: string;
  initialPageType: string | null;
}

export default function StageEditor({ productId, initialPageType }: Props) {
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState<string>(initialPageType ?? '');
  const [error, setError] = useState<string | null>(null);

  const onChange = (next: string) => {
    setValue(next);
    setError(null);
    startTransition(async () => {
      try {
        await updateProductStageAction({
          product_id: productId,
          page_type: next || null
        });
      } catch (err: any) {
        setError(err?.message ?? 'Update failed.');
        setValue(initialPageType ?? '');
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-wider text-amber-200/70 font-semibold">
        Stage
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={pending}
        className="rounded-md bg-white/[0.04] border border-white/10 px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-300/60 disabled:opacity-50"
      >
        <option value="">— none —</option>
        {PAGE_TYPES.map((pt) => (
          <option key={pt} value={pt}>
            {pt}
          </option>
        ))}
      </select>
      {pending && <span className="text-xs text-white/40">saving…</span>}
      {error && <span className="text-xs text-red-300">{error}</span>}
    </div>
  );
}
