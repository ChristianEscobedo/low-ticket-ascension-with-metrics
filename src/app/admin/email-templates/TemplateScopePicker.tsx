'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

interface Props {
  products: Array<{ id: string; name: string }>;
  productsWithOverride: string[];
  currentProductId: string | null;
}

export default function TemplateScopePicker({
  products,
  productsWithOverride,
  currentProductId
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const overrideSet = new Set(productsWithOverride);

  const onChange = (val: string) => {
    const next = val
      ? `/admin/email-templates?product_id=${encodeURIComponent(val)}`
      : '/admin/email-templates';
    startTransition(() => router.replace(next));
  };

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200/15 bg-white/[0.02] px-4 py-3">
      <label
        htmlFor="rt-scope"
        className="text-[11px] uppercase tracking-[0.18em] text-white/50 font-semibold"
      >
        Editing
      </label>
      <select
        id="rt-scope"
        value={currentProductId ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={pending}
        className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-amber-300/50 focus:outline-none disabled:opacity-50"
      >
        <option value="">Default (all products)</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} {overrideSet.has(p.id) ? '· custom' : ''}
          </option>
        ))}
      </select>
      {currentProductId && (
        <span className="text-[11px] text-amber-200/70">
          Falls back to the default template when fields are left empty.
        </span>
      )}
      {pending && <span className="text-[11px] text-white/40">Loading…</span>}
    </div>
  );
}
