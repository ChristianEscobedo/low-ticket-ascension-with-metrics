'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type {
  AssignmentRole,
  AssignmentStep,
  DeliveryType,
  ProductFunnelAssignment,
} from '@/lib/mothermode/sales/productAssignments';

/**
 * Wires a Stripe product into a funnel step + declares how buyers receive it.
 * Saves through /api/admin/funnel-products; the funnel builder's product
 * pickers and the main-app delivery webhook read the same rows.
 */

const STEPS: { value: AssignmentStep; label: string }[] = [
  { value: 'checkout', label: 'Checkout (front end)' },
  { value: 'upsell1', label: 'Upsell 1' },
  { value: 'upsell2', label: 'Upsell 2' },
  { value: 'upsell3', label: 'Upsell 3' },
  { value: 'upsell4', label: 'Upsell 4' },
];

const ROLES: { value: AssignmentRole; label: string }[] = [
  { value: 'main', label: 'Main product' },
  { value: 'bump', label: 'Order bump' },
  { value: 'bonus', label: 'Bonus (free with purchase)' },
];

const DELIVERY: { value: DeliveryType; label: string; hint: string }[] = [
  { value: 'url', label: 'Link(s)', hint: 'one per line: Label | https://…' },
  { value: 'course', label: 'Course here', hint: 'course ids, comma separated' },
  { value: 'deliverable', label: 'Deliverable', hint: 'deliverable slug (+ key)' },
  { value: 'main_app', label: 'Main app (mothermode)', hint: 'product key in its builder' },
];

const inputCls =
  'rounded-lg bg-bone/[0.03] border border-bone/10 px-2.5 py-1.5 text-xs text-bone placeholder-bone/30 focus:outline-none focus:border-brass/60';
const chipCls =
  'inline-flex items-center gap-1.5 rounded-full border border-brass/25 bg-brass/[0.08] px-2.5 py-1 text-[11px] text-brass';

interface Props {
  productId: string;
  prices: { id: string; unit_amount: number | null; interval: string | null; active: boolean }[];
  funnels: { slug: string; name: string }[];
  assignments: ProductFunnelAssignment[];
}

export default function ProductAssignmentEditor({
  productId,
  prices,
  funnels,
  assignments: initialAssignments,
}: Props) {
  const router = useRouter();
  const [assignments, setAssignments] = useState(initialAssignments);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [funnelSlug, setFunnelSlug] = useState('');
  const [step, setStep] = useState<AssignmentStep>('checkout');
  const [role, setRole] = useState<AssignmentRole>('main');
  const [priceId, setPriceId] = useState('');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('url');
  const [linksText, setLinksText] = useState('');
  const [courseIdsText, setCourseIdsText] = useState('');
  const [deliverableSlug, setDeliverableSlug] = useState('');
  const [deliverableKey, setDeliverableKey] = useState('');
  const [productKey, setProductKey] = useState('');
  const [license, setLicense] = useState(true);
  const [seats, setSeats] = useState(1);

  function buildDelivery() {
    if (deliveryType === 'url') {
      const links = linksText
        .split('\n')
        .map((line) => {
          const [label, href, description] = line.split('|').map((s) => s.trim());
          return { label: label || '', href: href || '', description: description || '' };
        })
        .filter((l) => l.label || l.href);
      return { links };
    }
    if (deliveryType === 'course') {
      return {
        courseIds: courseIdsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      };
    }
    if (deliveryType === 'deliverable') {
      return { deliverableSlug, deliverableKey };
    }
    return { productKey, license, seats };
  }

  function save() {
    setError(null);
    if (!funnelSlug) {
      setError('Pick a funnel.');
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/funnel-products', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            productId,
            priceId: priceId || null,
            funnelSlug,
            step,
            role,
            deliveryType,
            delivery: buildDelivery(),
          }),
        });
        const json = await res.json();
        if (!res.ok || !json?.success) throw new Error(json?.error || 'Save failed');
        setAssignments((prev) => [
          ...prev.filter((a) => a.id !== json.item.id),
          json.item,
        ]);
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Save failed');
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/funnel-products?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        const json = await res.json();
        if (!res.ok || !json?.success) throw new Error(json?.error || 'Delete failed');
        setAssignments((prev) => prev.filter((a) => a.id !== id));
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Delete failed');
      }
    });
  }

  const stepLabel = (s: string) => STEPS.find((x) => x.value === s)?.label ?? s;
  const roleLabel = (r: string) => ROLES.find((x) => x.value === r)?.label ?? r;

  return (
    <div className="mt-2">
      {assignments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {assignments.map((a) => (
            <span key={a.id} className={chipCls}>
              {a.funnelSlug} · {stepLabel(a.step)} · {roleLabel(a.role)}
              <button
                type="button"
                aria-label="Remove assignment"
                onClick={() => remove(a.id)}
                className="text-brass/60 hover:text-red-300"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg border border-brass/20 px-2.5 py-1 text-xs text-bone/70 transition-colors hover:bg-brass/[0.06] hover:border-brass/40 hover:text-brass"
        >
          + Assign to funnel page
        </button>
      ) : (
        <div className="rounded-xl border border-brass/20 bg-ink/40 p-3 space-y-2.5 max-w-2xl">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-brass/70">
            Assign to funnel page
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <select className={inputCls} value={funnelSlug} onChange={(e) => setFunnelSlug(e.target.value)}>
              <option value="">Funnel…</option>
              {funnels.map((f) => (
                <option key={f.slug} value={f.slug}>
                  {f.name || f.slug}
                </option>
              ))}
            </select>
            <select className={inputCls} value={step} onChange={(e) => setStep(e.target.value as AssignmentStep)}>
              {STEPS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value as AssignmentRole)}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <select className={inputCls} value={priceId} onChange={(e) => setPriceId(e.target.value)}>
              <option value="">Price: first active (default)</option>
              {prices.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.unit_amount != null ? `$${(p.unit_amount / 100).toFixed(2)}` : '?'}
                  {p.interval ? `/${p.interval}` : ' one-time'} · {p.id.slice(-8)}
                  {!p.active ? ' (inactive)' : ''}
                </option>
              ))}
            </select>
            <select
              className={inputCls}
              value={deliveryType}
              onChange={(e) => setDeliveryType(e.target.value as DeliveryType)}
            >
              {DELIVERY.map((d) => (
                <option key={d.value} value={d.value}>
                  Deliver via: {d.label}
                </option>
              ))}
            </select>
          </div>

          {deliveryType === 'url' && (
            <textarea
              className={inputCls + ' w-full'}
              rows={2}
              placeholder={'Label | https://link | optional note\n(one per line)'}
              value={linksText}
              onChange={(e) => setLinksText(e.target.value)}
            />
          )}
          {deliveryType === 'course' && (
            <input
              className={inputCls + ' w-full'}
              placeholder="Course ids, comma separated"
              value={courseIdsText}
              onChange={(e) => setCourseIdsText(e.target.value)}
            />
          )}
          {deliveryType === 'deliverable' && (
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                className={inputCls}
                placeholder="Deliverable slug"
                value={deliverableSlug}
                onChange={(e) => setDeliverableSlug(e.target.value)}
              />
              <input
                className={inputCls}
                placeholder="Key (optional)"
                value={deliverableKey}
                onChange={(e) => setDeliverableKey(e.target.value)}
              />
            </div>
          )}
          {deliveryType === 'main_app' && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                className={inputCls + ' flex-1 min-w-[180px]'}
                placeholder="Product key in the main app's builder"
                value={productKey}
                onChange={(e) => setProductKey(e.target.value)}
              />
              <label className="flex items-center gap-1.5 text-xs text-bone/70">
                <input type="checkbox" checked={license} onChange={(e) => setLicense(e.target.checked)} />
                Issue license
              </label>
              <label className="flex items-center gap-1.5 text-xs text-bone/70">
                Seats
                <input
                  type="number"
                  min={1}
                  className={inputCls + ' w-16'}
                  value={seats}
                  onChange={(e) => setSeats(Math.max(1, Number(e.target.value) || 1))}
                />
              </label>
            </div>
          )}

          {error && <p className="text-xs text-red-300">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={save}
              className="rounded-lg bg-brass hover:bg-brass/90 text-ink px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40"
            >
              {pending ? 'Saving…' : 'Save assignment'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-bone/15 px-3 py-1.5 text-xs text-bone/60 hover:text-bone"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
