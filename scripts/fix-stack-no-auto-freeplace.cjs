#!/usr/bin/env node
/**
 * Stack card must NOT auto-scatter words.
 * - toggleStackCard: only mark.card (same karaoke layout + theme)
 * - Free-place coords only when user clicks "Free place"
 * - freePlace render path unchanged (only when xPct/yPct exist)
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');

// ─── SubtitlePanel: stack without coords + Free place action ─────────────────
{
  const rel = 'src/app/(fullscreen)/admin/reel-studio/SubtitlePanel.tsx';
  let s = fs.readFileSync(path.join(root, rel), 'utf8');

  // Replace toggleStackCard body to only set card
  const oldToggle = `function toggleStackCard(from: number, to: number) {
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
  }`;

  const newToggle = `function toggleStackCard(from: number, to: number) {
    const existing = phraseCardId(words, from, to);
    if (existing) {
      // Remove card + any free-place coords (back to normal karaoke).
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
    // Stack ONLY tags the phrase — layout/theme stay identical to normal
    // captions until the user opts into Free place (xPct/yPct) or per-word style.
    const id = newCardId();
    const count = to - from;
    const wordsPerRow = Math.min(4, Math.max(1, count));
    const rows = Math.min(3, Math.max(1, Math.ceil(count / wordsPerRow)));
    const next = words.map((w, i) => {
      if (i < from || i >= to) return w;
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
        },
      };
    });
    onEdit(next);
  }

  /** Opt-in free-place: scatter card words so they can be dragged on stage. */
  function enableFreePlace(from: number, to: number) {
    const id = phraseCardId(words, from, to);
    if (!id) return;
    const count = to - from;
    const sample = words[from]?.mark?.card;
    const wordsPerRow = sample?.wordsPerRow ?? Math.min(4, Math.max(1, count));
    const rows = sample?.rows ?? Math.min(3, Math.max(1, Math.ceil(count / wordsPerRow)));
    const layout = defaultStackLayout(count, { rows, wordsPerRow });
    const next = words.map((w, i) => {
      if (i < from || i >= to) return w;
      if (!w.mark?.card || w.mark.card.id !== id) return w;
      const li = i - from;
      const pos = layout[li] ?? { xPct: 50, yPct: 40 };
      return {
        ...w,
        mark: {
          ...w.mark,
          xPct: pos.xPct,
          yPct: pos.yPct,
        },
      };
    });
    onEdit(next);
  }

  function clearFreePlace(from: number, to: number) {
    const id = phraseCardId(words, from, to);
    if (!id) return;
    const next = words.map((w, i) => {
      if (i < from || i >= to) return w;
      if (!w.mark?.card || w.mark.card.id !== id) return w;
      const mark = { ...w.mark };
      delete mark.xPct;
      delete mark.yPct;
      return { ...w, mark };
    });
    onEdit(next);
  }`;

  if (!s.includes(oldToggle)) {
    // try CRLF
    const oldCrlf = oldToggle.replace(/\n/g, '\r\n');
    if (s.includes(oldCrlf)) {
      s = s.replace(oldCrlf, newToggle.replace(/\n/g, '\r\n'));
      console.log('toggleStackCard replaced (crlf)');
    } else {
      console.error('toggleStackCard not found');
      const i = s.indexOf('function toggleStackCard');
      console.log(JSON.stringify(s.slice(i, i + 200)));
      process.exit(1);
    }
  } else {
    s = s.replace(oldToggle, newToggle);
    console.log('toggleStackCard replaced');
  }

  // UI: free-place toggle next to stack when card is on
  // Find stack button block and add free-place button after it
  if (!s.includes('enableFreePlace(')) {
    console.error('enableFreePlace missing after replace');
    process.exit(1);
  }

  // Inject free-place button after stack Layers button closing
  const stackBtnEnd = `                    <Layers className="h-3 w-3" />
                  </button>
                </div>`;

  const stackBtnWithFree = `                    <Layers className="h-3 w-3" />
                  </button>
                  {cardId ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const hasFp = words
                          .slice(p.from, p.to)
                          .some(
                            (w) =>
                              typeof w.mark?.xPct === 'number' &&
                              typeof w.mark?.yPct === 'number',
                          );
                        if (hasFp) clearFreePlace(p.from, p.to);
                        else enableFreePlace(p.from, p.to);
                      }}
                      title={
                        words
                          .slice(p.from, p.to)
                          .some(
                            (w) =>
                              typeof w.mark?.xPct === 'number' &&
                              typeof w.mark?.yPct === 'number',
                          )
                          ? 'Exit free-place — back to normal caption layout'
                          : 'Free place — drag words anywhere on the frame'
                      }
                      className={clsx(
                        'rounded p-0.5 text-[8px] font-bold leading-none',
                        words
                          .slice(p.from, p.to)
                          .some(
                            (w) =>
                              typeof w.mark?.xPct === 'number' &&
                              typeof w.mark?.yPct === 'number',
                          )
                          ? 'bg-brass/20 text-brass'
                          : 'text-bone/30 hover:bg-bone/10 hover:text-bone/70',
                      )}
                    >
                      FP
                    </button>
                  ) : null}
                </div>`;

  if (s.includes(stackBtnEnd) && !s.includes('enableFreePlace(p.from')) {
    s = s.replace(stackBtnEnd, stackBtnWithFree);
    console.log('FP button injected');
  } else if (s.includes('enableFreePlace(p.from')) {
    console.log('FP button already present');
  } else {
    // CRLF
    const a = stackBtnEnd.replace(/\n/g, '\r\n');
    const b = stackBtnWithFree.replace(/\n/g, '\r\n');
    if (s.includes(a)) {
      s = s.replace(a, b);
      console.log('FP button injected (crlf)');
    } else {
      console.warn('FP button inject point not found — stack UI may need manual wire');
    }
  }

  // Update stack title text
  s = s.replace(
    'Make stack card — words build & hold as a phrase block',
    'Stack phrase — same caption look; use FP to free-place words',
  );

  fs.writeFileSync(path.join(root, rel), s);
  console.log('SubtitlePanel updated');
}

// ─── page.tsx: only hide caption drag when free-place coords exist ───────────
// (already gated on freePlaceWordsFrom which requires xPct — OK)

// ─── tsc ─────────────────────────────────────────────────────────────────────
try {
  execSync('pnpm exec tsc --noEmit -p tsconfig.json --pretty false 2>&1', {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  console.log('tsc clean');
} catch (e) {
  const out = String(e.stdout || e.message || e);
  const lines = out
    .split(/\r?\n/)
    .filter(
      (l) =>
        /error TS/.test(l) &&
        /SubtitlePanel|WordDrag|captionLayer|page\.tsx/.test(l),
    );
  console.log('errors', lines.length);
  lines.slice(0, 30).forEach((l) => console.log(l));
  if (lines.length) process.exit(1);
}
console.log('OK');
