'use client';

/**
 * Presentational controls for the Amplify command box. A mode segment, a
 * part checklist with per-part counts and lock chips (the heart of "swap the
 * hooks, keep the body and CTA"), multi-select chips for the posts matrix, plus
 * a few shared primitives and the live plan line. All state lives in the panel.
 */
import React from 'react';
import { Lock, Minus, Plus } from 'lucide-react';
import {
  AMPLIFY_PARTS,
  MAX_PART_COUNT,
  clampPartCount,
  type AmplifyOption,
  type AmplifyTextDimension,
  type PartCounts,
} from '@/lib/mothermode/content';

export const fieldCls =
  'w-full rounded-lg border border-ink/15 bg-white/70 px-2.5 py-1.5 text-sm text-ink focus:border-mode focus:outline-none';
export const labelCls = 'mb-1 block text-xs uppercase tracking-wide text-ink/45';

export const Select: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}> = ({ label, value, onChange, children }) => (
  <div>
    <label className={labelCls}>{label}</label>
    <select value={value} onChange={(e) => onChange(e.target.value)} className={fieldCls}>
      {children}
    </select>
  </div>
);

/** A compact -/value/+ stepper bounded to [min, max]. */
export const Stepper: React.FC<{
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}> = ({ value, onChange, min = 1, max = MAX_PART_COUNT, disabled }) => {
  const set = (n: number) => onChange(Math.max(min, Math.min(max, n)));
  const btn =
    'grid h-7 w-7 place-items-center rounded-md border border-ink/15 text-ink/70 disabled:opacity-40 hover:border-ink/30';
  return (
    <div className={`flex items-center gap-1 ${disabled ? 'opacity-40' : ''}`}>
      <button type="button" className={btn} disabled={disabled} onClick={() => set(value - 1)}>
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="w-6 text-center text-sm font-semibold tabular-nums text-ink">{value}</span>
      <button type="button" className={btn} disabled={disabled} onClick={() => set(value + 1)}>
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

/** Mode segment: Refine this piece vs New posts. */
export const Segmented: React.FC<{
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}> = ({ value, options, onChange }) => (
  <div className="flex rounded-lg border border-ink/15 bg-white/50 p-0.5">
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        onClick={() => onChange(o.value)}
        className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
          value === o.value ? 'bg-mode text-bone' : 'text-ink/65 hover:text-ink'
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

/** The part checklist: tick a part to make N of it; untick to lock (keep) it. */
export const PartChecklist: React.FC<{
  counts: PartCounts;
  onChange: (dimension: AmplifyTextDimension, count: number) => void;
  defaultCount?: number;
}> = ({ counts, onChange, defaultCount = 5 }) => (
  <div className="space-y-1.5">
    {AMPLIFY_PARTS.map((p) => {
      const n = clampPartCount(counts[p.value] ?? 0);
      const on = n > 0;
      return (
        <div
          key={p.value}
          className={`flex items-center gap-3 rounded-lg border p-2 ${
            on ? 'border-mode/30 bg-mode/5' : 'border-ink/12 bg-white/40'
          }`}
        >
          <button
            type="button"
            onClick={() => onChange(p.value, on ? 0 : defaultCount)}
            className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${
              on ? 'border-mode bg-mode text-bone' : 'border-ink/25 text-transparent'
            }`}
            aria-pressed={on}
          >
            <Plus className="h-3 w-3" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{p.label}</p>
            {p.hint && <p className="truncate text-xs text-ink/45">{p.hint}</p>}
          </div>
          {on ? (
            <Stepper value={n} onChange={(v) => onChange(p.value, v)} />
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-ink/12 px-2 py-1 text-[11px] text-ink/45">
              <Lock className="h-3 w-3" /> Kept
            </span>
          )}
        </div>
      );
    })}
  </div>
);

/** Generic multi-select chip row for the posts matrix (voices, awareness). */
export function ChipMulti<T extends string>({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: AmplifyOption<T>[];
  selected: T[];
  onToggle: (value: T) => void;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onToggle(o.value)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                on
                  ? 'border-mode bg-mode text-bone'
                  : 'border-ink/15 text-ink/65 hover:border-ink/30'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The live plan line: what this run will produce, in one sentence. */
export const PlanLine: React.FC<{ text: string }> = ({ text }) => (
  <p className="rounded-lg border border-brass/30 bg-brass/5 px-3 py-2 text-xs text-ink/70">
    {text}
  </p>
);
