'use client';

/**
 * The map's AI chat — a full-height sheet docked to the RIGHT edge, and it
 * SEES the graph. Ask it "why is the checkout leaking?", "which reel made the
 * most", "what should I fix first" — it answers grounded in the live picture
 * (the funnels + their metrics, the conversion rate on every edge, the
 * leaks). Read-only: the chat never edits the graph. When there's a leak, a
 * "Draft the fix" action hands off to the blueprint creator (the gated path).
 *
 * Controlled: the page owns `open` (so clicking a node's peek and opening the
 * chat don't fight over the right edge).
 */
import { useEffect, useRef, useState } from 'react';
import { MessageSquare, X, Loader2, Send, Wrench } from 'lucide-react';
import type { SystemMapInput } from '@/lib/mothermode/systemMap';
import type {
  SystemMapAnalysis,
  SystemMapLeak,
} from '@/lib/mothermode/systemMapAnalysis';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const money = (cents: number) =>
  cents > 0
    ? (cents / 100).toLocaleString(undefined, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      })
    : '';

/** The compact text summary the model reads — the live picture of the map. */
function buildContext(
  input: SystemMapInput,
  analysis: SystemMapAnalysis | null,
): string {
  const lines: string[] = [];
  for (const f of input.funnels) {
    const m = f.metrics;
    lines.push(
      `FUNNEL "${f.name}" (${f.kind}, ${f.status}): ${m.views} views → ${m.leads} leads → ${m.checkouts} checkouts → ${m.purchases} sales, ${money(m.revenueCents)} revenue. Pages: ${f.pages.map((p) => p.label).join(', ')}. Emails: ${f.emails.map((e) => `${e.kitName} (${e.event})`).join(', ') || 'none'}.`,
    );
  }
  if (analysis) {
    for (const e of analysis.edgeRates) {
      lines.push(
        `EDGE ${e.label} on ${e.funnelId}: ${(e.rate * 100).toFixed(1)}% (${e.toCount}/${e.fromCount}) — ${e.health}.`,
      );
    }
    if (analysis.leaks.length > 0) {
      lines.push('LEAKS (worst first):');
      for (const l of analysis.leaks) {
        lines.push(
          `- "${l.funnelName}" leaks at ${l.label}: ${(l.rate * 100).toFixed(1)}% (${l.fromCount} reached the prior step).`,
        );
      }
    } else {
      lines.push('LEAKS: none — every edge is performing.');
    }
  }
  return lines.join('\n');
}

const SUGGESTIONS = [
  'What should I fix first?',
  "Where's the biggest leak?",
  'Which content is making money?',
];

export default function MapChatDock({
  input,
  analysis,
  open,
  onToggle,
  onDraftFix,
}: {
  input: SystemMapInput | null;
  analysis: SystemMapAnalysis | null;
  open: boolean;
  onToggle: (open: boolean) => void;
  /** Hand a leak to the blueprint creator (the gated fix path). */
  onDraftFix: (leak: SystemMapLeak) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const topLeak = analysis?.leaks[0] ?? null;
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the latest message in view.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: q }];
    setMessages(next);
    setDraft('');
    setBusy(true);
    try {
      const res = await fetch('/api/admin/system-map/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next,
          context: input ? buildContext(input, analysis) : '',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Chat failed');
      setMessages([...next, { role: 'assistant', content: json.answer }]);
    } catch (e) {
      setMessages([
        ...next,
        {
          role: 'assistant',
          content: e instanceof Error ? e.message : 'Something went wrong.',
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  // Closed: a slim tab on the right edge that opens the sheet.
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => onToggle(true)}
        title="Ask the map — the AI chat that sees the whole system"
        className="absolute right-0 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-2 rounded-l-xl border-y border-l border-brass/50 bg-ink/95 px-2 py-4 text-brass shadow-lg hover:bg-brass/15"
      >
        <MessageSquare className="h-4 w-4" />
        <span
          className="text-[10px] font-semibold tracking-widest"
          style={{ writingMode: 'vertical-rl' }}
        >
          ASK THE MAP
        </span>
      </button>
    );
  }

  // Open: the full-height right sheet.
  return (
    <div className="absolute right-0 top-0 z-30 flex h-full w-[360px] flex-col border-l border-bone/15 bg-ink/98 shadow-2xl">
      <div className="flex shrink-0 items-center justify-between border-b border-bone/10 px-4 py-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-bone">
          <MessageSquare className="h-3.5 w-3.5 text-brass" /> Ask the map
        </p>
        <button
          type="button"
          onClick={() => onToggle(false)}
          className="rounded p-1 text-bone/40 hover:text-bone"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-3"
      >
        {messages.length === 0 && (
          <div>
            <p className="text-[11px] leading-relaxed text-bone/45">
              I can see the whole system — the funnels, the conversion rate on
              every connection, and where it's leaking. Ask me anything.
            </p>
            <div className="mt-3 space-y-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void ask(s)}
                  className="block w-full rounded-lg border border-bone/10 bg-bone/[0.03] px-3 py-2 text-left text-[11px] text-bone/60 hover:border-brass/40 hover:text-bone"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-xl px-3 py-2 text-[11px] leading-relaxed ${
              m.role === 'user'
                ? 'ml-6 bg-brass/15 text-bone'
                : 'mr-6 bg-bone/[0.06] text-bone/80'
            }`}
          >
            {m.content}
          </div>
        ))}
        {busy && (
          <div className="mr-6 flex items-center gap-1.5 rounded-xl bg-bone/[0.06] px-3 py-2 text-[11px] text-bone/50">
            <Loader2 className="h-3 w-3 animate-spin" /> Reading the map…
          </div>
        )}
      </div>

      {/* the fix path — hand the worst leak to the blueprint creator */}
      {topLeak && (
        <div className="shrink-0 border-t border-bone/10 px-4 py-2.5">
          <button
            type="button"
            onClick={() => onDraftFix(topLeak)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-[10px] font-semibold text-red-300 hover:bg-red-400/20"
          >
            <Wrench className="h-3 w-3" /> Draft the fix for the {topLeak.label}{' '}
            leak ({topLeak.funnelName})
          </button>
        </div>
      )}

      <div className="flex shrink-0 items-center gap-2 border-t border-bone/10 px-4 py-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void ask(draft);
          }}
          placeholder="Ask about this map…"
          className="min-w-0 flex-1 rounded-lg border border-bone/15 bg-noir px-3 py-2 text-xs text-bone outline-none placeholder:text-bone/30 focus:border-brass/50"
        />
        <button
          type="button"
          onClick={() => void ask(draft)}
          disabled={busy || !draft.trim()}
          className="shrink-0 rounded-lg border border-brass/50 bg-brass/15 p-2 text-brass hover:bg-brass/25 disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
