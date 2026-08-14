#!/usr/bin/env node
/**
 * Simplify stack/FP edit:
 * - Remove on-video word rail
 * - Restore Edit / Preview (drop Place/Style/Play chrome)
 * - Outline ONLY the selected word
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

// ── 1) page.tsx: drop word rail + restore Edit/Preview ────────────────────
{
  const rel = 'src/app/(fullscreen)/admin/reel-studio/page.tsx';
  const p = path.join(root, rel);
  const raw = fs.readFileSync(p, 'utf8');
  const crlf = raw.includes('\r\n');
  let s = norm(raw);

  // Remove word rail block
  const railStart = s.indexOf('{stackEditMode && currentClip && (project.captions[currentClip.id] ?? []).length > 0 && (');
  const railEndMarker = '{(!project || project.clips.length === 0) && (';
  if (railStart >= 0) {
    const end = s.indexOf(railEndMarker, railStart);
    if (end > railStart) {
      s = s.slice(0, railStart) + s.slice(end);
      console.log('removed word rail');
    } else {
      console.warn('rail end not found');
    }
  } else {
    console.log('word rail already gone');
  }

  // Restore Edit / Preview buttons
  const oldBtns = `onClick={() => {
                              setStackEditMode(true);
                              setFxMode(false);
                            }}
                            title="Place: freeze the clock and drag words"
                          >
                            Place
                          </button>
                          <button
                            type="button"
                            className={
                              stackEditMode && fxMode
                                ? 'rounded-full bg-brass px-2.5 py-1 font-semibold text-ink'
                                : 'rounded-full px-2.5 py-1 text-white/70 hover:text-white'
                            }
                            onClick={() => {
                              setStackEditMode(true);
                              setFxMode(true);
                            }}
                            title="Style: place + inspector for the selected word"
                          >
                            Style
                          </button>
                          <button
                            type="button"
                            className={
                              !stackEditMode
                                ? 'rounded-full bg-white/15 px-2.5 py-1 font-semibold text-white'
                                : 'rounded-full px-2.5 py-1 text-white/70 hover:text-white'
                            }
                            onClick={() => {
                              setStackEditMode(false);
                              setFxMode(false);
                            }}
                            title="Play: karaoke timing, clock owns the playhead"
                          >
                            Play
                          </button>`;

  const neuBtns = `onClick={() => {
                              setStackEditMode(true);
                              setFxMode(false);
                            }}
                            title="Edit: show every word in this section — click to move / style"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={
                              !stackEditMode
                                ? 'rounded-full bg-white/15 px-2.5 py-1 font-semibold text-white'
                                : 'rounded-full px-2.5 py-1 text-white/70 hover:text-white'
                            }
                            onClick={() => {
                              setStackEditMode(false);
                              setFxMode(false);
                            }}
                            title="Preview this section with karaoke timing"
                          >
                            Preview
                          </button>`;

  if (s.includes(oldBtns)) {
    s = s.replace(oldBtns, neuBtns);
    console.log('restored Edit/Preview');
  } else if (s.includes('title="Edit: show every word')) {
    console.log('Edit/Preview already restored');
  } else {
    console.warn('mode buttons not exact');
  }

  // Place highlight: stackEditMode && !fxMode → just stackEditMode
  const oldPlaceCls = `stackEditMode && !fxMode
                                ? 'rounded-full bg-brass px-2.5 py-1 font-semibold text-ink'
                                : 'rounded-full px-2.5 py-1 text-white/70 hover:text-white'`;
  const neuPlaceCls = `stackEditMode
                                ? 'rounded-full bg-brass px-2.5 py-1 font-semibold text-ink'
                                : 'rounded-full px-2.5 py-1 text-white/70 hover:text-white'`;
  if (s.includes(oldPlaceCls)) {
    s = s.replace(oldPlaceCls, neuPlaceCls);
    console.log('Edit highlight restored');
  }

  write(p, s, crlf);
}

// ── 2) WordDragLayer: outline ONLY the selected word ──────────────────────
{
  const rel = 'src/app/(fullscreen)/admin/reel-studio/WordDragLayer.tsx';
  const p = path.join(root, rel);
  const raw = fs.readFileSync(p, 'utf8');
  const crlf = raw.includes('\r\n');
  let s = norm(raw);

  const oldRing = `              className={clsx(
                'absolute inset-0 rounded-sm',
                isSel
                  ? 'ring-2 ring-brass ring-offset-0 bg-brass/10'
                  : 'ring-1 ring-white/25 hover:ring-brass/50 hover:bg-white/[0.06]',
                w.fx === 'gradient' && 'ring-1 ring-fuchsia-400/40',
              )}`;

  const neuRing = `              className={clsx(
                'absolute inset-0 rounded-sm',
                isSel
                  ? 'ring-2 ring-brass ring-offset-0 bg-brass/10'
                  : 'hover:bg-white/[0.04]',
              )}`;

  if (s.includes(oldRing)) {
    s = s.replace(oldRing, neuRing);
    console.log('outline only selected word');
  } else if (s.includes("isSel\n                  ? 'ring-2 ring-brass") && s.includes("hover:bg-white/[0.04]")) {
    console.log('outline already selected-only');
  } else {
    console.warn('ring block not exact');
    const i = s.indexOf("'absolute inset-0 rounded-sm'");
    console.log(JSON.stringify(s.slice(i, i + 280)));
  }

  write(p, s, crlf);
}

try {
  execSync('pnpm exec tsc --noEmit -p tsconfig.json --pretty false 2>&1', {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  console.log('tsc clean');
} catch (e) {
  const out = String(e.stdout || e.message || e);
  const lines = out.split(/\r?\n/).filter((l) => /error TS/.test(l) && /page\.tsx|WordDrag/.test(l));
  console.log('errors', lines.length);
  lines.slice(0, 20).forEach((l) => console.log(l));
  if (lines.length) process.exit(1);
}
console.log('OK');
