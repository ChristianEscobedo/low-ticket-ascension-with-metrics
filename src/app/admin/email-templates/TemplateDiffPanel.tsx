'use client';

import { useMemo, useState } from 'react';
import { GitCompare } from 'lucide-react';
import {
  collapseUnchanged,
  lineDiff,
  type DiffResult,
  type DiffRow
} from '@/utils/text/line-diff';

interface Section {
  label: string;
  before: string;
  after: string;
}

interface Props {
  sections: Section[];
  /** When false, the panel collapses to a compact "no changes" placeholder. */
  dirty: boolean;
}

type Tab = number;

export default function TemplateDiffPanel({ sections, dirty }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>(0);
  const [onlyChanges, setOnlyChanges] = useState(true);

  const diffs = useMemo<DiffResult[]>(
    () => sections.map((s) => lineDiff(s.before, s.after)),
    [sections]
  );
  const rows = useMemo<DiffRow[][]>(
    () =>
      diffs.map((d) =>
        onlyChanges
          ? collapseUnchanged(d, 2)
          : d.lines.map((l) => ({ kind: 'line' as const, ...l }))
      ),
    [diffs, onlyChanges]
  );

  const totals = diffs.reduce(
    (acc, d) => {
      acc.added += d.summary.added;
      acc.removed += d.summary.removed;
      return acc;
    },
    { added: 0, removed: 0 }
  );

  if (!dirty) {
    return (
      <div className="rounded-xl border border-brass/15 bg-ink/30 px-4 py-3 text-[11px] uppercase tracking-wider text-bone/40 font-semibold flex items-center gap-2">
        <GitCompare className="w-3.5 h-3.5" />
        Diff vs saved · no pending changes
      </div>
    );
  }

  const active = diffs[activeTab];
  const activeRows = rows[activeTab];
  const activeSection = sections[activeTab];
  const sectionTotal =
    active.summary.added + active.summary.removed;

  return (
    <div className="rounded-xl border border-brass/15 bg-ink/30 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-bone/[0.02] border-b border-bone/5">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-bone/50 font-semibold">
          <GitCompare className="w-3.5 h-3.5" />
          Diff vs saved
          <span className="text-emerald-300 normal-case tracking-normal font-normal">
            +{totals.added}
          </span>
          <span className="text-red-300 normal-case tracking-normal font-normal">
            -{totals.removed}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-bone/50 normal-case tracking-normal font-normal cursor-pointer">
            <input
              type="checkbox"
              checked={onlyChanges}
              onChange={(e) => setOnlyChanges(e.target.checked)}
              className="accent-brass w-3 h-3"
            />
            only changes
          </label>
          <div className="w-px h-4 bg-bone/10" />
          {sections.map((s, i) => {
            const t = diffs[i].summary;
            const changed = t.added + t.removed;
            return (
              <button
                key={s.label}
                type="button"
                onClick={() => setActiveTab(i)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider ${
                  activeTab === i
                    ? 'bg-brass/[0.12] text-brass border border-brass/30'
                    : 'text-bone/40 hover:text-bone/70 border border-transparent'
                }`}
              >
                {s.label}
                {changed > 0 && (
                  <span className="ml-1 text-[10px] text-bone/40 normal-case tracking-normal">
                    +{t.added}/-{t.removed}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      {sectionTotal === 0 ? (
        <div className="px-4 py-3 text-xs text-bone/40 italic">
          {activeSection.label} unchanged.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-0 text-xs font-mono max-h-[420px] overflow-auto">
          <DiffColumn rows={activeRows} side="left" />
          <DiffColumn rows={activeRows} side="right" />
        </div>
      )}
    </div>
  );
}

function DiffColumn({
  rows,
  side
}: {
  rows: DiffRow[];
  side: 'left' | 'right';
}) {
  const wantedOp = side === 'left' ? 'removed' : 'added';
  return (
    <div className="border-r border-bone/5 last:border-r-0 bg-ink/40">
      {rows.map((row, idx) => {
        if (row.kind === 'gap') {
          return (
            <div
              key={`${side}-gap-${idx}`}
              className="flex gap-2 px-2 py-0.5 bg-bone/[0.015] text-bone/30 select-none"
            >
              <span className="w-8 text-right text-bone/20 flex-shrink-0">
                ⋮
              </span>
              <span className="flex-1 min-w-0 italic">
                {row.count} unchanged line{row.count === 1 ? '' : 's'}
              </span>
            </div>
          );
        }
        const showOriginal = row.op === 'equal' || row.op === wantedOp;
        const no = side === 'left' ? row.leftNo : row.rightNo;
        const isChange = row.op === wantedOp;
        const cls = isChange
          ? side === 'left'
            ? 'bg-red-500/[0.08] text-red-100'
            : 'bg-emerald-500/[0.08] text-emerald-100'
          : row.op === 'equal'
            ? 'text-bone/60'
            : 'text-bone/15';
        return (
          <div
            key={`${side}-${idx}`}
            className={`flex gap-2 px-2 py-0.5 ${cls} whitespace-pre-wrap break-words`}
          >
            <span className="w-8 text-right text-bone/25 select-none flex-shrink-0">
              {no ?? ''}
            </span>
            <span className="flex-1 min-w-0">
              {showOriginal ? row.text || '\u00a0' : '\u00a0'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
