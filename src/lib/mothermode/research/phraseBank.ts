/**
 * The phrase bank (roadmap task 2.3): the longitudinal read-model over the
 * session's own language — card item texts (posts, comments, reviews from
 * the live result cards) plus pinned evidence bodies — rolled up by the
 * deterministic n-gram counter, split into rolling windows so the answer to
 * "what is the audience saying MORE of lately" is a number, not a vibe.
 *
 * Computed on read, not persisted: the evidence table and the stored traces
 * ARE the bank; snapshots arrive with watchlists (4.2).
 *
 * Pure: no server imports.
 */
import { rollUpCommentLanguage } from './commentLanguage';
import type { ResearchMessage } from './types';
import type { ResearchEvidence } from './evidence';

export type PhraseTrend = 'up' | 'down' | 'new' | 'steady';

export interface PhraseBankRow {
  phrase: string;
  /** Total repeats across the whole session corpus. */
  count: number;
  /** Repeats in the recent window (default: last 7 days). */
  recent: number;
  /** Repeats in the window before that (default: the 7 days before). */
  prior: number;
  trend: PhraseTrend;
}

/** One countable text with its date and score. */
interface PhraseItem {
  text: string;
  at: string | null;
  score: number | null;
}

/**
 * The session corpus: every card item text (and nested comment line) from
 * the stored tool traces, dated by the message, plus every pinned evidence
 * body, dated by the pin.
 */
export function collectPhraseItems(input: {
  messages: ResearchMessage[];
  evidence: ResearchEvidence[];
}): PhraseItem[] {
  const out: PhraseItem[] = [];
  for (const m of input.messages) {
    for (const call of m.toolCalls) {
      for (const card of call.cards ?? []) {
        for (const item of card.items) {
          if (item.text) out.push({ text: item.text, at: m.createdAt, score: null });
          for (const line of item.lines) {
            if (line) out.push({ text: line, at: m.createdAt, score: null });
          }
        }
      }
    }
  }
  for (const e of input.evidence) {
    if (e.body) out.push({ text: e.body, at: e.createdAt, score: null });
  }
  return out;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Roll the corpus up with trend windows. `recentDays` is the recent window
 * (7 default); `priorDays` is the comparison window before it (7 more).
 * Undated items count toward the total and the prior window, never the
 * recent one — an old trace must not read as this week's trend.
 */
export function phraseBankRollup(input: {
  items: PhraseItem[];
  now?: string;
  recentDays?: number;
  priorDays?: number;
  limit?: number;
}): PhraseBankRow[] {
  if (input.items.length === 0) return [];
  const now = input.now ? new Date(input.now).getTime() : Date.now();
  const recentDays = input.recentDays ?? 7;
  const priorDays = input.priorDays ?? 7;
  const recentAfter = now - recentDays * DAY_MS;
  const priorAfter = now - (recentDays + priorDays) * DAY_MS;

  const toSource = (items: PhraseItem[]) =>
    items.map((i) => ({ author: '', body: i.text, score: i.score }));

  const recent = input.items.filter(
    (i) => i.at && new Date(i.at).getTime() >= recentAfter,
  );
  const prior = input.items.filter((i) => {
    if (!i.at) return true; // undated rides the prior bucket
    const t = new Date(i.at).getTime();
    return t < recentAfter && t >= priorAfter;
  });

  const allRoll = rollUpCommentLanguage(toSource(input.items));
  const recentRoll = rollUpCommentLanguage(toSource(recent));
  const priorRoll = rollUpCommentLanguage(toSource(prior));
  const recentCount = new Map(recentRoll.phrases.map((p) => [p.phrase, p.count]));
  const priorCount = new Map(priorRoll.phrases.map((p) => [p.phrase, p.count]));

  // Union of phrases across the windows (the all-corpus rollup may swallow
  // a phrase that only repeats inside one window).
  const names = new Set<string>();
  for (const p of allRoll.phrases) names.add(p.phrase);
  for (const p of recentRoll.phrases) names.add(p.phrase);
  for (const p of priorRoll.phrases) names.add(p.phrase);
  const allCount = new Map(allRoll.phrases.map((p) => [p.phrase, p.count]));

  const rows: PhraseBankRow[] = [];
  for (const phrase of Array.from(names)) {
    const r = recentCount.get(phrase) ?? 0;
    const p = priorCount.get(phrase) ?? 0;
    const count = Math.max(allCount.get(phrase) ?? 0, r + p);
    const trend: PhraseTrend =
      r > p ? (p === 0 ? 'new' : 'up') : r < p ? 'down' : 'steady';
    rows.push({ phrase, count, recent: r, prior: p, trend });
  }
  rows.sort(
    (a, b) =>
      b.recent - a.recent || b.count - a.count || a.phrase.localeCompare(b.phrase),
  );
  return rows.slice(0, input.limit ?? 12);
}
