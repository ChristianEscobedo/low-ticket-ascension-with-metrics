'use client';

/**
 * The change legend for a built or saved version: one chip per part (hook, body,
 * cta) showing whether the variation rewrote it or kept the original. Changed
 * parts read in the brand mode color; kept parts stay muted. Each chip carries a
 * tooltip with the before/after text so a reviewer can see exactly what moved
 * without opening anything. The diff is the pure diffVersion helper.
 */
import React from 'react';
import type { VersionParts } from '@/lib/mothermode/content';
import { diffVersion, type PartChange } from '@/lib/mothermode/content';

/** Collapse copy to a single line and clip it for a tooltip. */
function clip(s: string, n = 140): string {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return '(empty)';
  return t.length > n ? `${t.slice(0, n)}...` : t;
}

export const VersionChanges: React.FC<{
  original: VersionParts;
  version: VersionParts;
}> = ({ original, version }) => {
  const diff = diffVersion(original, version);
  const rows: {
    key: string;
    label: string;
    change: PartChange;
    before: string;
    after: string;
  }[] = [
    {
      key: 'hook',
      label: 'Hook',
      change: diff.hook,
      before: original.hook,
      after: version.hook,
    },
    {
      key: 'body',
      label: 'Body',
      change: diff.body,
      before: original.body.join('\n\n'),
      after: version.body.join('\n\n'),
    },
    {
      key: 'cta',
      label: 'CTA',
      change: diff.cta,
      before: original.cta,
      after: version.cta,
    },
  ];

  if (rows.every((r) => r.change === 'kept')) {
    return (
      <p className="text-[11px] text-ink/40">Matches the original post.</p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.16em] text-ink/40">
        Changes
      </span>
      {rows.map((r) =>
        r.change === 'changed' ? (
          <span
            key={r.key}
            title={`Was: ${clip(r.before)}\nNow: ${clip(r.after)}`}
            className="cursor-help rounded-full bg-mode/10 px-2 py-0.5 text-[10px] font-semibold text-mode ring-1 ring-mode/20"
          >
            New {r.label.toLowerCase()}
          </span>
        ) : (
          <span
            key={r.key}
            title={`${r.label} kept from the original`}
            className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[10px] text-ink/45"
          >
            {r.label.toLowerCase()} kept
          </span>
        ),
      )}
    </div>
  );
};
