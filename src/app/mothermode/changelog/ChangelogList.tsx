'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ChangelogEntry, ChangelogType } from '@/lib/mothermode/help/types';

const TYPE_STYLES: Record<ChangelogType, string> = {
  added: 'border-emerald-500/40 bg-emerald-50 text-emerald-700',
  improved: 'border-sky-500/40 bg-sky-50 text-sky-700',
  fixed: 'border-amber-500/40 bg-amber-50 text-amber-700',
  removed: 'border-red-500/40 bg-red-50 text-red-700',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** The published changelog as a list of expandable cards. Each row shows the
 *  type tag, version, date, and title; clicking a card opens it to reveal the
 *  full body (what changed, why, and any fix detail). */
export default function ChangelogList({ entries }: { entries: ChangelogEntry[] }) {
  const [openId, setOpenId] = useState<string | null>(entries[0]?.id ?? null);

  return (
    <div className="mt-10 space-y-4">
      {entries.map((entry) => {
        const open = entry.id === openId;
        return (
          <article
            key={entry.id}
            className={`rounded-2xl border bg-white/50 transition-colors overflow-hidden ${
              open ? 'border-brass/40' : 'border-ink/10'
            }`}
          >
            <button
              type="button"
              onClick={() => setOpenId(open ? null : entry.id)}
              aria-expanded={open}
              className="w-full text-left px-6 py-5 flex items-start gap-4 hover:bg-white/60 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border ${TYPE_STYLES[entry.entryType]}`}
                  >
                    {entry.entryType}
                  </span>
                  {entry.version && (
                    <span className="text-sm font-semibold text-ink/70">{entry.version}</span>
                  )}
                  <span className="text-sm text-ink/45">{formatDate(entry.releasedOn)}</span>
                </div>
                <h2 className="mt-2 font-display text-lg font-semibold tracking-tight text-ink">
                  {entry.title}
                </h2>
              </div>
              <ChevronDown
                className={`h-5 w-5 flex-shrink-0 text-ink/40 transition-transform mt-1 ${
                  open ? 'rotate-180' : ''
                }`}
              />
            </button>

            {open && (
              <div className="px-6 pb-6 -mt-1">
                <div
                  className="prose prose-neutral max-w-none prose-sm border-t border-ink/10 pt-4"
                  // Body is trusted, hand-authored admin content, never buyer input.
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: entry.body }}
                />
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
