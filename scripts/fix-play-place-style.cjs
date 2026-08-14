#!/usr/bin/env node
/**
 * Play / Place / Style modes + J/K/L + word ticks + word rail.
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

const rel = 'src/app/(fullscreen)/admin/reel-studio/page.tsx';
const p = path.join(root, rel);
const raw = fs.readFileSync(p, 'utf8');
const crlf = raw.includes('\r\n');
let s = norm(raw);

// ── 1) TimeRuler: optional word ticks ─────────────────────────────────────
{
  const oldSig = `function TimeRuler({
  totalSec,
  clips,
  zoom,
  onScrub,
}: {
  totalSec: number;
  clips: ReelClip[];
  zoom: number;
  onScrub: (timelineSec: number) => void;
}) {`;

  const neuSig = `function TimeRuler({
  totalSec,
  clips,
  zoom,
  onScrub,
  wordMarks = [],
}: {
  totalSec: number;
  clips: ReelClip[];
  zoom: number;
  onScrub: (timelineSec: number) => void;
  wordMarks?: { t: number; label: string }[];
}) {`;

  if (!s.includes(oldSig)) {
    if (s.includes('wordMarks = []')) console.log('TimeRuler already has wordMarks');
    else {
      console.error('TimeRuler signature not found');
      process.exit(1);
    }
  } else {
    s = s.replace(oldSig, neuSig);
    console.log('TimeRuler wordMarks prop');
  }

  const oldClose = `      {/* clip-boundary notches: which scene owns each stretch of the ruler */}
      {clips.map((c, i) => (`;

  const neuClose = `      {wordMarks.slice(0, 400).map((w, i) => (
        <div
          key={\`wm-\${i}-\${w.t}\`}
          data-word-tick
          title={w.label}
          className="pointer-events-none absolute bottom-0 h-2 w-px bg-brass/50"
          style={{ left: \`\${(w.t / Math.max(totalSec, 0.001)) * 100}%\` }}
        />
      ))}
      {/* clip-boundary notches: which scene owns each stretch of the ruler */}
      {clips.map((c, i) => (`;

  if (s.includes(oldClose) && !s.includes('data-word-tick')) {
    s = s.replace(oldClose, neuClose);
    console.log('word ticks painted');
  } else if (s.includes('data-word-tick')) {
    console.log('word ticks already present');
  } else {
    console.warn('clip-boundary comment not exact — skip ticks paint');
  }
}

// ── 2) Pass current-clip word marks into TimeRuler ────────────────────────
{
  const oldUse = `<TimeRuler totalSec={total} clips={project.clips} zoom={pxPerSec / 36} onScrub={seekTimeline} />`;
  const neuUse = `<TimeRuler
                      totalSec={total}
                      clips={project.clips}
                      zoom={pxPerSec / 36}
                      onScrub={seekTimeline}
                      wordMarks={
                        currentClip
                          ? (project.captions[currentClip.id] ?? []).map((w) => ({
                              t:
                                timelineStartOf(
                                  project.clips,
                                  Math.max(
                                    0,
                                    project.clips.findIndex((c) => c.id === currentClip.id),
                                  ),
                                ) + w.start,
                              label: w.word,
                            }))
                          : []
                      }
                    />`;
  if (s.includes(oldUse)) {
    s = s.replace(oldUse, neuUse);
    console.log('TimeRuler usage wired');
  } else if (s.includes('wordMarks={')) {
    console.log('TimeRuler usage already wired');
  } else {
    console.warn('TimeRuler usage not exact');
  }
}

// ── 3) Play / Place / Style chrome ────────────────────────────────────────
{
  const oldBtns = `onClick={() => setStackEditMode(true)}
                            title="Show every word in the stack card for drag/scale"
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
                            onClick={() => setStackEditMode(false)}
                            title="Preview karaoke/build timing"
                          >
                            Preview
                          </button>`;

  const neuBtns = `onClick={() => {
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

  if (s.includes(oldBtns)) {
    s = s.replace(oldBtns, neuBtns);
    console.log('Play/Place/Style buttons');
  } else if (s.includes('title="Place: freeze the clock')) {
    console.log('mode buttons already patched');
  } else {
    console.warn('Edit/Preview buttons not exact');
    const i = s.indexOf('title="Show every word');
    console.log(JSON.stringify(s.slice(i, i + 280)));
  }

  // Highlight Place only when placing (not Style)
  const oldPlaceCls = `stackEditMode
                                ? 'rounded-full bg-brass px-2.5 py-1 font-semibold text-ink'
                                : 'rounded-full px-2.5 py-1 text-white/70 hover:text-white'`;
  const neuPlaceCls = `stackEditMode && !fxMode
                                ? 'rounded-full bg-brass px-2.5 py-1 font-semibold text-ink'
                                : 'rounded-full px-2.5 py-1 text-white/70 hover:text-white'`;
  if (s.includes(oldPlaceCls)) {
    s = s.replace(oldPlaceCls, neuPlaceCls);
    console.log('Place highlight excludes Style');
  }
}

// ── 4) J/K/L + don't steal arrows in Place ────────────────────────────────
{
  const oldKeys = `      if (e.code === 'Space') {

        e.preventDefault();
        togglePlay();
      } else if (e.key === 's' || e.key === 'S') {
        splitAtPlayhead();
      } else if (e.key === 'c' || e.key === 'C') {
        // C = CUT the tail at the playhead (instant, undo-safe)
        e.preventDefault();
        cutTailAtPlayhead();
      } else if (e.key === ',' || e.key === '.') {
        // , / . = frame-step (1/30s) — the precision nudge before a cut
        e.preventDefault();
        stopClock();
        seekTimeline(clockRef.current.t + (e.key === ',' ? -1 : 1) / 30);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {

        e.preventDefault();
        const step = (e.shiftKey ? 5 : 1) * (e.key === 'ArrowLeft' ? -1 : 1);
        seekTimeline(clockRef.current.t + step);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClip && project) {`;

  const neuKeys = `      if (e.code === 'Space' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        stopClock();
        seekTimeline(clockRef.current.t - (e.shiftKey ? 5 : 1));
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        stopClock();
        seekTimeline(clockRef.current.t + (e.shiftKey ? 5 : 1));
      } else if (e.key === 's' || e.key === 'S') {
        splitAtPlayhead();
      } else if (e.key === 'c' || e.key === 'C') {
        // C = CUT the tail at the playhead (instant, undo-safe)
        e.preventDefault();
        cutTailAtPlayhead();
      } else if (e.key === ',' || e.key === '.') {
        // , / . = frame-step (1/30s) — the precision nudge before a cut
        e.preventDefault();
        stopClock();
        seekTimeline(clockRef.current.t + (e.key === ',' ? -1 : 1) / 30);
      } else if (
        (e.key === 'ArrowLeft' || e.key === 'ArrowRight') &&
        !stackEditMode
      ) {
        // In Place, WordDragLayer owns arrows as a 0.5% nudge.
        e.preventDefault();
        const step = (e.shiftKey ? 5 : 1) * (e.key === 'ArrowLeft' ? -1 : 1);
        seekTimeline(clockRef.current.t + step);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClip && project && !stackEditMode) {`;

  if (s.includes(oldKeys)) {
    s = s.replace(oldKeys, neuKeys);
    console.log('J/K/L + Place arrow guard');
  } else if (s.includes("e.key === 'j' || e.key === 'J'")) {
    console.log('J/K/L already present');
  } else {
    console.warn('keyboard block not exact');
  }

  s = s.replace(
    '  }, [project, selectedClip, total]);',
    '  }, [project, selectedClip, total, stackEditMode]);',
  );
}

// ── 5) Word rail + seek-on-select ─────────────────────────────────────────
{
  const oldSel = `onSelect={(index) => {
                            setFxMode(true);
                            setFxWords(new Set([index]));
                          }}`;
  const neuSel = `onSelect={(index) => {
                            setFxMode(true);
                            setFxTarget(index);
                            setFxWords(new Set([index]));
                            if (currentClip && project) {
                              const w = (project.captions[currentClip.id] ?? [])[index];
                              if (w) {
                                const start = timelineStartOf(
                                  project.clips,
                                  Math.max(
                                    0,
                                    project.clips.findIndex((c) => c.id === currentClip.id),
                                  ),
                                );
                                seekTimeline(start + w.start + 0.01);
                              }
                            }
                          }}`;
  if (s.includes(oldSel)) {
    s = s.replace(oldSel, neuSel);
    console.log('select seeks to word');
  } else if (s.includes('seekTimeline(start + w.start')) {
    console.log('select-seek already present');
  } else {
    console.warn('onSelect block not exact');
  }

  if (!s.includes('data-word-rail')) {
    const rail = `{stackEditMode && currentClip && (project.captions[currentClip.id] ?? []).length > 0 && (
                      <div
                        data-word-rail
                        className="absolute right-1 top-1 bottom-1 z-[28] w-[7.25rem] overflow-y-auto rounded-md border border-bone/15 bg-ink/85 p-1 backdrop-blur-sm"
                      >
                        <p className="px-1 pb-1 text-[9px] font-semibold uppercase tracking-wide text-bone/40">
                          Words
                        </p>
                        {(project.captions[currentClip.id] ?? []).map((w, i) => {
                          const clipSec = Math.max(
                            0,
                            playheadSec -
                              timelineStartOf(
                                project.clips,
                                Math.max(
                                  0,
                                  project.clips.findIndex((c) => c.id === currentClip.id),
                                ),
                              ),
                          );
                          const live = clipSec >= w.start - 0.04 && clipSec <= w.end + 0.12;
                          const picked = fxTarget === i || (fxWords && fxWords.has(i));
                          return (
                            <button
                              key={\`wr-\${i}\`}
                              type="button"
                              onClick={() => {
                                setFxMode(true);
                                setFxTarget(i);
                                setFxWords(new Set([i]));
                                const start = timelineStartOf(
                                  project.clips,
                                  Math.max(
                                    0,
                                    project.clips.findIndex((c) => c.id === currentClip.id),
                                  ),
                                );
                                seekTimeline(start + w.start + 0.01);
                              }}
                              className={
                                picked
                                  ? 'mb-0.5 block w-full truncate rounded bg-brass px-1.5 py-0.5 text-left text-[10px] font-semibold text-ink'
                                  : live
                                    ? 'mb-0.5 block w-full truncate rounded bg-white/15 px-1.5 py-0.5 text-left text-[10px] text-white'
                                    : 'mb-0.5 block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] text-bone/50 hover:bg-white/5 hover:text-bone/80'
                              }
                            >
                              {w.word}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {(!project || project.clips.length === 0) && (`;
    if (s.includes('{(!project || project.clips.length === 0) && (')) {
      s = s.replace('{(!project || project.clips.length === 0) && (', rail);
      console.log('word rail inserted');
    } else {
      console.warn('empty-start anchor missing for rail');
    }
  }
}

write(p, s, crlf);

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
        /page\.tsx|TimeRuler|wordMarks|word-rail|stackEditMode|fxWords/.test(l),
    );
  console.log('errors', lines.length);
  lines.slice(0, 30).forEach((l) => console.log(l));
  if (!lines.length) {
    out
      .split(/\r?\n/)
      .filter((l) => /error TS/.test(l))
      .slice(0, 12)
      .forEach((l) => console.log(l));
  }
  if (lines.length) process.exit(1);
}
console.log('OK');
