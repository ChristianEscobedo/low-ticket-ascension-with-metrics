'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink, FileText } from 'lucide-react';

export interface AssetLink {
  label: string;
  href?: string;
  note?: string;
  /** Optional link to the offer-specific content hub, shown next to Copy. */
  content?: string;
  /** Marks a link whose page does not exist yet. Renders as a muted row. */
  planned?: boolean;
}

export interface AssetGroup {
  title: string;
  description: string;
  items: AssetLink[];
}

export default function AssetHub({ groups }: { groups: AssetGroup[] }) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (href: string) => {
    const url =
      typeof window !== 'undefined' ? window.location.origin + href : href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(href);
      setTimeout(() => setCopied((c) => (c === href ? null : c)), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section
          key={group.title}
          className="rounded-2xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 backdrop-blur overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-brass/10">
            <h2 className="font-display text-lg font-semibold tracking-tight text-bone">
              {group.title}
            </h2>
            <p className="text-sm text-bone/50 mt-0.5">{group.description}</p>
          </div>
          <ul className="divide-y divide-bone/[0.06]">
            {group.items.map((item) => {
              const isLive = !!item.href && !item.planned;
              return (
                <li
                  key={item.href ?? item.label}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-bone/[0.02] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-bone truncate">
                        {item.label}
                      </span>
                      {item.note && (
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md border border-brass/25 text-brass/80 whitespace-nowrap">
                          {item.note}
                        </span>
                      )}
                    </div>
                    {item.href && (
                      <div className="text-xs text-bone/40 font-mono truncate mt-0.5">
                        {item.href}
                      </div>
                    )}
                  </div>
                  {isLive ? (
                    <>
                      <button
                        type="button"
                        onClick={() => copy(item.href!)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-bone/10 text-xs text-bone/60 hover:text-bone hover:border-bone/30 transition-colors whitespace-nowrap"
                      >
                        {copied === item.href ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-300" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" /> Copy
                          </>
                        )}
                      </button>
                      {item.content && (
                        <a
                          href={item.content}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-brass/30 text-xs text-brass hover:bg-brass/10 transition-colors whitespace-nowrap"
                        >
                          <FileText className="w-3.5 h-3.5" /> Content
                        </a>
                      )}
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brass text-ink text-xs font-semibold hover:bg-brass/90 transition-colors whitespace-nowrap"
                      >
                        Open <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </>
                  ) : (
                    <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-md border border-bone/10 text-bone/40 whitespace-nowrap">
                      Planned
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
