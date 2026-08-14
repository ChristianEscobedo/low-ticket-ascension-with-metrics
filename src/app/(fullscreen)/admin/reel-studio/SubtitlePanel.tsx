'use client';

/**
 * R20 Subtitle Panel — the word track as clean PHRASE rows (like CapCut/Descript).
 *
 * Words are grouped into readable lines (a new line starts at sentence-ending
 * punctuation or a ~0.9s timing gap), each row showing its start timecode and
 * the phrase as flowing text. The currently-spoken word is highlighted inline
 * and its row auto-scrolls into view during playback. Click a row to seek;
 * click a word to edit it inline. This reads as a subtitle script, not a word dump.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { AlignLeft, Check, Eye, EyeOff, Layers, Loader2, Mic, X } from 'lucide-react';
import {
  defaultStackLayout,
  wordMarkSummary,
  type ReelWord,
} from '@/lib/mothermode/reel/types';

function tc(s: number): string {
  const v = Math.max(0, s);
  const m = Math.floor(v / 60);
  const sec = Math.floor(v - m * 60);
  const cs = Math.round((v - Math.floor(v)) * 100);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

interface Phrase {
  /** Global word index of the first word. */
  from: number;
  /** Global word index one past the last word. */
  to: number;
}

/** Group the flat word list into readable phrase rows (punctuation or a timing gap). */
function phrasesFor(words: ReelWord[]): Phrase[] {
  const out: Phrase[] = [];
  let from = 0;
  for (let i = 0; i < words.length; i += 1) {
    const w = words[i];
    const next = words[i + 1];
    const sentenceEnd = /[.!?…]["'”]?$/.test(w.word) || /[,;:]["'”]?$/.test(w.word);
    const gap = next ? next.start - w.end : 0;
    const tooLong = i - from + 1 >= 12; // never let a row run past ~12 words
    if (sentenceEnd || gap > 0.9 || tooLong || !next) {
      out.push({ from, to: i + 1 });
      from = i + 1;
    }
  }
  return out.length ? out : [{ from: 0, to: words.length }];
}

/** The word index the playhead is inside (holds the last word through a gap). */
function activeIndexAt(words: ReelWord[], tSec: number): number {
  let idx = -1;
  for (let i = 0; i < words.length; i += 1) {
    if (tSec < words[i].start) break;
    if (tSec <= words[i].end) {
      idx = i;
      break;
    }
    idx = i;
  }
  return idx;
}

function phraseMuted(words: ReelWord[], from: number, to: number): boolean {
  let n = 0;
  for (let i = from; i < to; i += 1) if (words[i]?.mark?.hidden) n += 1;
  return n > 0 && n >= to - from;
}

function phraseCardId(words: ReelWord[], from: number, to: number): string | null {
  const id = words[from]?.mark?.card?.id;
  if (!id) return null;
  for (let i = from; i < to; i += 1) {
    if (words[i]?.mark?.card?.id !== id) return null;
  }
  return id;
}

function newCardId(): string {
  return `card_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}


export function SubtitlePanel({
  words,
  clipName,
  playheadSec,
  transcribing = false,
  onTranscribe,
  onSeek,
  onEdit,
  cueMode = false,
  onCueWord,
  cuedWordIndexes,
  fxMode = false,
  onFxWord,
  fxWordIndexes,
}: {
  words: ReelWord[];
  clipName: string;
  playheadSec: number;
  transcribing?: boolean;
  onTranscribe: () => void;
  onSeek: (clipSec: number) => void;
  onEdit: (words: ReelWord[]) => void;
  /**
   * Media-cue mode: clicking a word attaches an image fly-in to it instead of
   * opening the inline editor. Cued words get a violet underline.
   */
  cueMode?: boolean;
  onCueWord?: (wordIndex: number) => void;
  cuedWordIndexes?: ReadonlySet<number>;
  /**
   * Word FX mode: clicking a word toggles it in the FX bar's picked set
   * (amber underline) instead of opening the editor — the bar applies the
   * effect to every picked word.
   */
  fxMode?: boolean;
  onFxWord?: (wordIndex: number) => void;
  fxWordIndexes?: ReadonlySet<number>;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const activeIdx = useMemo(() => activeIndexAt(words, playheadSec), [words, playheadSec]);
  const phrases = useMemo(() => phrasesFor(words), [words]);
  const activeRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeIdx]);

  function commit(i: number) {
    const next = words.slice();
    const text = draft.trim().slice(0, 60);
    if (text) next[i] = { ...next[i], word: text };
    onEdit(next);
    setEditing(null);
  }

  function toggleMutePhrase(from: number, to: number) {
    const muted = phraseMuted(words, from, to);
    const next = words.map((w, i) => {
      if (i < from || i >= to) return w;
      const mark = { ...(w.mark ?? {}) };
      if (muted) delete mark.hidden;
      else mark.hidden = true;
      const empty = Object.keys(mark).length === 0;
      return empty ? { word: w.word, start: w.start, end: w.end } : { ...w, mark };
    });
    onEdit(next);
  }

  function toggleStackCard(from: number, to: number) {
    const existing = phraseCardId(words, from, to);
    if (existing) {
      // Remove card + free-place coords
      const next = words.map((w, i) => {
        if (i < from || i >= to) return w;
        const mark = { ...(w.mark ?? {}) };
        delete mark.card;
        delete mark.xPct;
        delete mark.yPct;
        const empty = Object.keys(mark).length === 0;
        return empty ? { word: w.word, start: w.start, end: w.end } : { ...w, mark };
      });
      onEdit(next);
      return;
    }
    const id = newCardId();
    const count = to - from;
    const wordsPerRow = Math.min(4, Math.max(1, count));
    const rows = Math.min(3, Math.max(1, Math.ceil(count / wordsPerRow)));
    const layout = defaultStackLayout(count, { rows, wordsPerRow });
    const next = words.map((w, i) => {
      if (i < from || i >= to) return w;
      const li = i - from;
      const pos = layout[li] ?? { xPct: 50, yPct: 40 };
      return {
        ...w,
        mark: {
          ...(w.mark ?? {}),
          card: {
            id,
            mode: 'build' as const,
            rows,
            wordsPerRow,
          },
          xPct: pos.xPct,
          yPct: pos.yPct,
        },
      };
    });
    onEdit(next);
  }

  function setCardMode(from: number, to: number, mode: 'build' | 'page') {
    const id = phraseCardId(words, from, to);
    if (!id) return;
    const next = words.map((w, i) => {
      if (i < from || i >= to) return w;
      if (!w.mark?.card || w.mark.card.id !== id) return w;
      return {
        ...w,
        mark: { ...w.mark, card: { ...w.mark.card, mode } },
      };
    });
    onEdit(next);
  }


  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-bone/10 bg-ink/40">
      {/* header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-bone/10 bg-bone/[0.03] px-3 py-2">
        <AlignLeft className="h-3.5 w-3.5 text-brass/80" />
        <span className="text-[11px] font-semibold text-bone/80">
          Subtitles
          <span className="ml-2 font-normal text-bone/30">
            {words.length > 0 ? `${phrases.length} lines · ${words.length} words` : 'none'}
          </span>
        </span>
        <button
          onClick={onTranscribe}
          disabled={transcribing}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-brass/40 px-2.5 py-1 text-[10px] font-semibold text-brass hover:bg-brass/10 disabled:opacity-40"
        >
          {transcribing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mic className="h-3 w-3" />}
          {words.length ? 're-run' : 'transcribe'}
        </button>
      </div>
      {clipName && (
        <p className="shrink-0 truncate border-b border-bone/[0.06] px-3 py-1 text-[9px] text-bone/25">
          {clipName}
        </p>
      )}

      {/* the phrase rows */}
      {words.length === 0 ? (
        <div className="px-4 py-5 text-[11px] leading-relaxed text-bone/35">
          No words yet — hit <strong className="text-brass/80">transcribe</strong> to pull this
          scene's word timings. They drive the karaoke captions, this editor, and the burn-in.
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1.5">
          {phrases.map((p, pi) => {
            const rowActive = activeIdx >= p.from && activeIdx < p.to;
            const muted = phraseMuted(words, p.from, p.to);
            const cardId = phraseCardId(words, p.from, p.to);
            const cardMode = cardId ? words[p.from]?.mark?.card?.mode : null;
            return (
              <div
                key={pi}
                ref={rowActive ? activeRowRef : undefined}
                className={clsx(
                  'flex gap-2.5 rounded-lg px-2.5 py-2 transition-colors',
                  rowActive
                    ? 'bg-brass/[0.10] ring-1 ring-inset ring-brass/25'
                    : muted
                      ? 'bg-rose-500/[0.04] opacity-70'
                      : cardId
                        ? 'bg-brass/[0.04]'
                        : 'hover:bg-bone/[0.04]',
                )}
              >
                {/* timecode — click to seek */}
                <button
                  onClick={() => onSeek(words[p.from].start)}
                  className={clsx(
                    'shrink-0 pt-0.5 font-mono text-[9px] tabular-nums leading-5',
                    rowActive ? 'font-semibold text-brass' : 'text-bone/35 hover:text-brass/80',
                  )}
                  title={`Seek to ${tc(words[p.from].start)}`}
                >
                  {tc(words[p.from].start)}
                </button>

                {/* mute + stack card */}
                <div className="flex shrink-0 flex-col items-center gap-0.5 pt-0.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMutePhrase(p.from, p.to);
                    }}
                    title={muted ? 'Show captions for this line' : 'Mute captions for this line'}
                    className={clsx(
                      'rounded p-0.5',
                      muted
                        ? 'text-rose-300 hover:bg-rose-400/15'
                        : 'text-bone/30 hover:bg-bone/10 hover:text-bone/70',
                    )}
                  >
                    {muted ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStackCard(p.from, p.to);
                    }}
                    title={
                      cardId
                        ? 'Remove stack card (back to normal karaoke)'
                        : 'Make stack card — words build & hold as a phrase block'
                    }
                    className={clsx(
                      'rounded p-0.5',
                      cardId
                        ? 'text-brass hover:bg-brass/15'
                        : 'text-bone/30 hover:bg-bone/10 hover:text-bone/70',
                    )}
                  >
                    <Layers className="h-3 w-3" />
                  </button>
                </div>

                {/* the phrase — words as flowing text, active word highlighted inline */}
                <p
                  className={clsx(
                    'min-w-0 flex-1 text-[12px] leading-5',
                    muted ? 'text-bone/25 line-through decoration-bone/20' : 'text-bone/80',
                    cardId && !muted && 'text-bone/90',
                  )}
                >
                  {words.slice(p.from, p.to).map((w, k) => {
                    const i = p.from + k;
                    const isActive = i === activeIdx;
                    if (editing === i) {
                      return (
                        <span key={i} className="inline-flex items-center gap-1 align-middle">
                          <input
                            autoFocus
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commit(i);
                              if (e.key === 'Escape') setEditing(null);
                            }}
                            className="w-20 rounded border border-brass/50 bg-ink px-1 py-0 text-[11px] text-bone/90 outline-none"
                          />
                          <button onClick={() => commit(i)} className="text-brass">
                            <Check className="h-3 w-3" />
                          </button>
                          <button onClick={() => setEditing(null)} className="text-bone/40">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    }
                    const cued = cuedWordIndexes?.has(i) ?? false;
                    const fxed = fxWordIndexes?.has(i) ?? false;
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          if (fxMode) {
                            onFxWord?.(i);
                            return;
                          }
                          if (cueMode) {
                            onCueWord?.(i);
                            return;
                          }
                          setEditing(i);
                          setDraft(w.word);
                        }}
                        className={clsx(
                          'rounded px-0.5 transition-colors',
                          isActive
                            ? 'bg-brass/25 font-semibold text-brass'
                            : 'hover:bg-bone/10',
                          cueMode && 'cursor-copy hover:bg-violet-500/25 hover:text-violet-200',
                          cued && 'underline decoration-violet-400 decoration-2 underline-offset-4',
                          fxMode && 'cursor-crosshair hover:bg-amber-400/25 hover:text-amber-200',
                          fxed && 'underline decoration-amber-400 decoration-2 underline-offset-4',
                        )}
                        title={
                          (fxMode
                            ? `Pick "${w.word}" for a Word FX (${tc(w.start)}–${tc(w.end)})`
                            : cueMode
                              ? `Attach an image fly-in to "${w.word}" (${tc(w.start)}–${tc(w.end)})`
                              : `Edit "${w.word}" (${tc(w.start)}–${tc(w.end)})`) +
                          // The per-word effects readout — hover any word and see
                          // exactly what it carries ("glow · ×2 · Anton · sfx ✓").
                          (wordMarkSummary(w.mark) ? `\n→ ${wordMarkSummary(w.mark)}` : '')
                        }
                      >
                        {w.word}
                      </button>
                    );
                  })}
                </p>
                {cardId ? (
                  <div className="flex shrink-0 flex-col gap-0.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setCardMode(p.from, p.to, 'build')}
                      className={clsx(
                        'rounded px-1 py-0.5 text-[8px] font-bold uppercase',
                        cardMode === 'build'
                          ? 'bg-brass text-ink'
                          : 'border border-bone/15 text-bone/40 hover:bg-bone/10',
                      )}
                      title="Build & hold — words appear on speech and stay"
                    >
                      build
                    </button>
                    <button
                      type="button"
                      onClick={() => setCardMode(p.from, p.to, 'page')}
                      className={clsx(
                        'rounded px-1 py-0.5 text-[8px] font-bold uppercase',
                        cardMode === 'page'
                          ? 'bg-brass text-ink'
                          : 'border border-bone/15 text-bone/40 hover:bg-bone/10',
                      )}
                      title="Karaoke page — whole card visible, highlight walks"
                    >
                      page
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      <p className="shrink-0 border-t border-bone/[0.06] bg-bone/[0.02] px-3 py-1.5 text-[8px] text-bone/25">
        {fxMode
          ? 'fx mode: click words to pick them · amber-underlined words are picked'
          : cueMode
            ? 'cue mode: click a word to attach an image fly-in · underlined words have one'
            : 'eye = mute line · layers = stack card · click timecode to seek · click word to edit'}
      </p>
    </div>
  );
}
