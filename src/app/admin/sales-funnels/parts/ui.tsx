'use client';

import { useState, type ReactNode } from 'react';

/**
 * Shared primitives for the sales-funnel admin editor.
 *
 * These used to live at the bottom of SalesFunnelEditor.tsx. They are lifted
 * here so each tab body can be its own file without importing the 1500-line
 * shell (which would be a circular import).
 */

/**
 * `min-w-0` is load-bearing, not decoration.
 *
 * An <input> has an intrinsic minimum width (~20 characters). Grid items default
 * to `min-width: auto`, so inside `grid-cols-2` neither column could shrink below
 * that intrinsic floor: two inputs plus `gap-3` overflowed the panel, the columns
 * crowded into each other and the right-hand field clipped at the panel edge.
 * `min-w-0` here (and on the wrappers below) lets the columns actually shrink so
 * the declared gap survives. Do not drop it when editing these classes.
 */
export const inputClass =
  'w-full min-w-0 max-w-full rounded-lg bg-ink/40 border border-bone/15 px-3 py-2 text-sm text-bone placeholder-bone/30 focus:outline-none focus:border-brass/40';
/**
 * `selectClass`, not `inputClass`, for every <select>.
 *
 * A native <select> adds its own internal padding on top of `px-3 py-2`, so it
 * renders ~4px taller than an <input> that carries the identical classes. Inside
 * `grid-cols-2` the row grows to its tallest cell, so a single select knocked the
 * whole row out of alignment with its neighbour and read as overlapping fields.
 * The explicit height pins select and input to the same 38px box
 * (py-2 = 8+8, text-sm line-height 20, 1px border x2).
 *
 * This is why the height lives here and NOT on `inputClass`: `Area` reuses
 * `inputClass` for <textarea> and must stay free to grow (`min-h-[80px] resize-y`).
 * Adding a fixed height there would break the textareas instead.
 */
export const selectClass = inputClass + ' cursor-pointer';
export const labelClass = 'block text-xs uppercase tracking-wide text-bone/50 mb-1';

export const btn = 'rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
export const btnPrimary = btn + ' bg-brass/[0.14] text-brass border border-brass/30 hover:bg-brass/20';
export const btnGhost = btn + ' text-bone/60 border border-bone/15 hover:text-bone hover:bg-bone/[0.05]';
export const btnDanger = btn + ' text-red-300/80 border border-red-400/20 hover:bg-red-500/10';

export const panelClass = 'rounded-xl border border-bone/10 bg-ink/30 p-4 sm:p-5';

export function linesToList(text: string): string[] {
  return text.split('\n').map((s) => s.trim()).filter(Boolean);
}

export function listToLines(list: string[]): string {
  return list.join('\n');
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="min-w-0">
      <label className={labelClass}>{label}</label>
      <input className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

export function Area({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div className="min-w-0">
      <label className={labelClass}>{label}</label>
      <textarea className={inputClass + ' min-h-[80px] resize-y'} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="min-w-0">
      <label className={labelClass}>{label}</label>
      <input type="number" min={0} className={inputClass} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </div>
  );
}

export function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-bone/10 bg-ink/50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-bone/40">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-bone">{value}</div>
    </div>
  );
}

/**
 * Collapsible subsection built on <details>.
 *
 * Deliberately NOT a conditional render: a closed <details> keeps its children
 * mounted and the browser hides them, so half-typed input inside a collapsed
 * group survives collapsing. Open/closed is the only local state here, and it
 * carries no user content.
 */
export function Collapse({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="rounded-xl border border-bone/10 bg-ink/20"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass/80">{title}</span>
        <span className="text-[10px] uppercase tracking-wide text-bone/35">{open ? 'Hide' : 'Show'}</span>
      </summary>
      {hint && <p className="px-3 pb-1 text-xs text-bone/45">{hint}</p>}
      <div className="space-y-3 px-3 pb-4 pt-1">{children}</div>
    </details>
  );
}

/**
 * "Regenerate this page" bar shown at the top of every page tab.
 *
 * `busy` drives the button *text* (this page is regenerating right now).
 * `disabled` drives whether it can be clicked, and defaults to `busy`.
 * The two are separate because the original inline bars disabled on ANY
 * in-flight operation (`busy !== null`) but only said "Regenerating…" for
 * `busy === 'generatePage'`.
 */
export function RegenerateBar({
  onRegenerate,
  busy,
  disabled,
  label = 'Rewrite this page from the Offer tab stack.',
}: {
  onRegenerate: () => void;
  busy?: boolean;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div className="mb-1 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brass/25 bg-brass/[0.05] px-3 py-2">
      <p className="text-[11px] text-bone/60">{label}</p>
      <button
        type="button"
        disabled={disabled ?? Boolean(busy)}

        onClick={onRegenerate}
        className="rounded-lg border border-brass/30 bg-brass/[0.14] px-3 py-1.5 text-[11px] font-semibold text-brass hover:bg-brass/20 disabled:opacity-40"
      >
        {busy ? 'Regenerating…' : 'Regenerate this page'}
      </button>
    </div>
  );
}
