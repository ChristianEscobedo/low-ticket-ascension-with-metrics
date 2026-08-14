#!/usr/bin/env node
/**
 * FP/stack Edit must:
 *  - paint EVERY word in the current caption section
 *  - keep full theme weight (no thin idle paint)
 *  - never fade/hide a word on select
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');

function norm(s) {
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}
function write(file, content, crlf) {
  fs.writeFileSync(file, crlf ? content.replace(/\n/g, '\r\n') : content);
}

const rel = 'src/lib/mothermode/reel/render/captionLayer.tsx';
const p = path.join(root, rel);
const raw = fs.readFileSync(p, 'utf8');
const crlf = raw.includes('\r\n');
let s = norm(raw);
let n = 0;

// 1) Don't blank the whole layer in Edit when karaoke has no active word.
{
  const old = `  const activeIdx = activeWordIndex(words, frame, holdFrames);
  if (activeIdx < 0) return null;`;
  const neu = `  const activeIdx = activeWordIndex(words, frame, holdFrames);
  // Edit: still paint the section even if the playhead is between words.
  if (activeIdx < 0 && !freePlaceEdit) return null;`;
  if (s.includes(old)) {
    s = s.replace(old, neu);
    n++;
    console.log('skip empty-active gate in edit');
  } else if (s.includes('activeIdx < 0 && !freePlaceEdit')) {
    console.log('empty-active gate already skipped');
  } else {
    console.warn('activeIdx gate not exact');
  }
}

// 2) In Edit, include unplaced words in the abs overlay using line fallbacks
//    so the whole section is on screen (not only words that already have x/y).
{
  const old = `  const freePlacedAbs = words
    .map((w, idx) => ({ w, idx }))
    .filter(
      ({ w }) =>
        !w.mark?.hidden &&
        typeof w.mark?.xPct === 'number' &&
        typeof w.mark?.yPct === 'number',
    )`;
  const neu = `  const freePlacedAbs = words
    .map((w, idx) => ({ w, idx }))
    .filter(({ w }) => !w.mark?.hidden)
    .filter(({ w }) => {
      if (freePlaceEdit) return true; // Edit: every word in this section
      return typeof w.mark?.xPct === 'number' && typeof w.mark?.yPct === 'number';
    })`;
  if (s.includes(old)) {
    s = s.replace(old, neu);
    n++;
    console.log('edit includes unplaced words');
  } else if (s.includes("if (freePlaceEdit) return true; // Edit: every word")) {
    console.log('unplaced already included');
  } else {
    console.warn('freePlacedAbs filter not exact');
  }
}

// 3) Abs paint: fallback x/y + always use active (full-weight) theme in Edit.
{
  const old = `          const isActive = idx === activeIdx;
          const power = isPowerWord(w.text, powerWords as string[]);
          const mark = w.mark;
          const x = mark!.xPct as number;
          const y = mark!.yPct as number;

          // --- identical base to normal path ---
          const themePaint = (isActive || power ? css.active : css.word) ?? css.word ?? {};`;
  const neu = `          const isActive = idx === activeIdx;
          const power = isPowerWord(w.text, powerWords as string[]);
          const mark = w.mark;
          const x =
            typeof mark?.xPct === 'number' ? (mark.xPct as number) : 50;
          const y =
            typeof mark?.yPct === 'number' ? (mark.yPct as number) : 18;
          // Edit: full theme weight for every word. Idle css.word is the thin look.
          const themePaint =
            (freePlaceEdit || isActive || power ? css.active : css.word) ??
            css.word ??
            {};`;
  if (s.includes(old)) {
    s = s.replace(old, neu);
    n++;
    console.log('edit uses active weight + xy fallback');
  } else if (s.includes('freePlaceEdit || isActive || power')) {
    console.log('active weight already');
  } else {
    console.warn('abs themePaint not exact');
  }
}

// 4) Force opacity 1 in Edit so entrance/ghost fades can't hide a selected word.
{
  const old = `            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          };`;
  const neu = `            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            ...(freePlaceEdit ? { opacity: 1, visibility: 'visible' as const } : {}),
          };`;
  // Only the abs-placed base block — first occurrence after left/bottom abs
  const needle = `            left: \`\${x}%\`,
            bottom: \`\${y}%\`,
            transform: 'translate(-50%, 50%)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          };`;
  const repl = `            left: \`\${x}%\`,
            bottom: \`\${y}%\`,
            transform: 'translate(-50%, 50%)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            ...(freePlaceEdit ? { opacity: 1, visibility: 'visible' as const } : {}),
          };`;
  if (s.includes(needle)) {
    s = s.replace(needle, repl);
    n++;
    console.log('force opacity 1 in edit');
  } else if (s.includes('freePlaceEdit ? { opacity: 1')) {
    console.log('opacity already forced');
  } else {
    console.warn('abs base tail not exact');
  }
}

write(p, s, crlf);
const dst = path.join(root, 'render-worker/src/lib/mothermode/reel/render/captionLayer.tsx');
if (fs.existsSync(dst)) fs.copyFileSync(p, dst);

try {
  execSync('pnpm exec tsc --noEmit -p tsconfig.json --pretty false 2>&1', {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  console.log('tsc clean');
} catch (e) {
  const out = String(e.stdout || e.message || e);
  const lines = out.split(/\r?\n/).filter((l) => /error TS/.test(l) && /captionLayer/.test(l));
  console.log('errors', lines.length);
  lines.slice(0, 16).forEach((l) => console.log(l));
  if (lines.length) process.exit(1);
}
console.log('patches', n);
console.log('OK');
