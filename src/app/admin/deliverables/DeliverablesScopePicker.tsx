'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

interface Props {
  offers: Array<{ slug: string; name: string }>;
  currentSlug: string;
}

/** Selects which offer's resource documents to view/edit below. */
export default function DeliverablesScopePicker({ offers, currentSlug }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onChange = (val: string) => {
    startTransition(() =>
      router.replace(`/admin/deliverables?slug=${encodeURIComponent(val)}`),
    );
  };

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-brass/15 bg-bone/[0.02] px-4 py-3">
      <label
        htmlFor="deliverables-scope"
        className="text-[11px] uppercase tracking-[0.18em] text-bone/50 font-semibold"
      >
        Offer
      </label>
      <select
        id="deliverables-scope"
        value={currentSlug}
        onChange={(e) => onChange(e.target.value)}
        disabled={pending}
        className="bg-ink/40 border border-bone/10 rounded-lg px-3 py-1.5 text-sm text-bone focus:border-brass/50 focus:outline-none disabled:opacity-50"
      >
        {offers.map((o) => (
          <option key={o.slug} value={o.slug}>
            {o.name}
          </option>
        ))}
      </select>
      {pending && <span className="text-[11px] text-bone/40">Loading…</span>}
    </div>
  );
}
