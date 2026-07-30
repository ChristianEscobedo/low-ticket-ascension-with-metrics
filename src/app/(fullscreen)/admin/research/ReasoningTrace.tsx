'use client';

/**
 * The reasoning trace: one row per tool call the agent ran, persisted on the
 * assistant message so the "how did it get this answer" story survives reload.
 */
import { useState } from 'react';
import { clsx } from 'clsx';
import {
  Search,
  MessageSquare,
  ShoppingCart,
  BarChart3,
  BookOpen,
  FilePlus2,
  Wrench,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import type { ToolCallRecord } from '@/lib/mothermode/research/types';
import {
  PlatformIcon,
  PLATFORM_BRAND,
} from '@/components/mothermode/content/PlatformIcon';
import { canonicalPlatform } from '@/lib/mothermode/planner/platformGlyph';
import type { ContentPlatform } from '@/lib/mothermode/content';

const TOOL_ICONS: Record<string, typeof Search> = {
  web_search: Search,
  social_search: MessageSquare,
  reddit_deep_dive: MessageSquare,
  amazon_reviews: ShoppingCart,
  internal_metrics: BarChart3,
  get_context: BookOpen,
  create_artifact: FilePlus2,
};

/** Real brand marks the hub's icon set doesn't carry (reddit, tiktok). */
const BRAND_SVG: Record<string, string> = {
  reddit: 'https://thesvg.org/icons/reddit/default.svg',
  tiktok: 'https://thesvg.org/icons/tiktok/default.svg',
};

/** The platform logo for a call, when one applies (social_search's input
 *  summary starts "tiktok: ..."; reddit_deep_dive always gets the reddit
 *  badge). */
function platformFor(call: ToolCallRecord): ContentPlatform | 'reddit' | null {
  if (call.name === 'reddit_deep_dive') return 'reddit';
  if (call.name === 'social_search' || call.name === 'voice_audit') {
    const platform = canonicalPlatform(call.inputSummary.split(':')[0]);
    if (platform) return platform;
  }
  return null;
}

function toolLabel(name: string): string {
  return (
    {
      web_search: 'Web search',
      social_search: 'Social search',
      voice_audit: 'Voice audit',
      reddit_deep_dive: 'Reddit deep-dive',
      amazon_reviews: 'Amazon reviews',
      internal_metrics: 'Internal metrics',
      get_context: 'Context',
      create_artifact: 'Saved artifact',
    }[name] ?? name
  );
}

export default function ReasoningTrace({
  calls,
  live = false,
}: {
  calls: ToolCallRecord[];
  live?: boolean;
}) {
  const [open, setOpen] = useState(live);
  if (calls.length === 0 && !live) return null;

  return (
    <div className="rounded-lg border border-bone/10 bg-ink/40 text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-bone/60 hover:text-bone"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        <span className="font-semibold uppercase tracking-[0.15em]">
          Reasoning
        </span>
        <span className="text-bone/40">
          {calls.length} step{calls.length === 1 ? '' : 's'}
        </span>
        {live && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-brass" />}
      </button>
      {open && (
        <ol className="space-y-1 border-t border-bone/10 px-3 py-2">
          {calls.map((call, i) => {
            const Icon = TOOL_ICONS[call.name] ?? Wrench;
            const platform = platformFor(call);
            return (
              <li key={`${call.id}-${i}`} className="flex items-start gap-2">
                {platform && BRAND_SVG[platform as string] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={BRAND_SVG[platform as string]}
                    alt={platform}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  />
                ) : platform ? (
                  <PlatformIcon
                    platform={platform as ContentPlatform}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                    style={{
                      color: PLATFORM_BRAND[platform as ContentPlatform],
                    }}
                  />
                ) : (
                  <Icon
                    className={clsx(
                      'mt-0.5 h-3.5 w-3.5 shrink-0',
                      call.status === 'error' ? 'text-red-400' : 'text-brass/80',
                    )}
                  />
                )}
                <div className="min-w-0">
                  <span className="font-medium text-bone/80">
                    {toolLabel(call.name)}
                  </span>{' '}
                  <span className="text-bone/50">{call.inputSummary}</span>
                  <div
                    className={clsx(
                      'truncate',
                      call.status === 'error' ? 'text-red-300/80' : 'text-bone/40',
                    )}
                  >
                    {call.status === 'error' && (
                      <AlertTriangle className="mr-1 inline h-3 w-3" />
                    )}
                    {call.resultSummary}
                    {call.ms > 0 && (
                      <span className="ml-1 text-bone/30">
                        ({(call.ms / 1000).toFixed(1)}s)
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
          {live && calls.length === 0 && (
            <li className="text-bone/40">Working on it.</li>
          )}
        </ol>
      )}
    </div>
  );
}
