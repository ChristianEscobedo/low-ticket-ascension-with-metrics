/**
 * Two caption-editing fixes:
 *
 * 1. The Edit/Preview canvas pill is ALWAYS on screen (top-right) whenever the
 *    scene has captions — it used to hide until a word was free-placed, so you
 *    couldn't reach Edit on a fresh reel.
 *
 * 2. The ↺ reset is scoped to the words ON the current timestamp (the page
 *    showing at the playhead), not the whole scene — "reset only the words
 *    shown on the timestamp, not all words."
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'src', 'app', '(fullscreen)', 'admin', 'reel-studio', 'page.tsx');
let s = fs.readFileSync(FILE, 'utf8');
const before = s.length;
let n = 0;
const NL = s.includes('\r\n') ? '\r\n' : '\n';
const nl = (str) => str.split('\n').join(NL);

function rep(oldStr, newStr, label) {
  const needle = nl(oldStr);
  if (!s.includes(needle)) {
    console.error(`MISS: ${label}`);
    return;
  }
  s = s.split(needle).join(nl(newStr));
  n += 1;
  console.log(`ok: ${label}`);
}

// 1 — the toggle shows whenever the scene has captions (not just once a word
// is free-placed). Both stage containers carry this gate; split/join hits both.
rep(
  `                      (project.captions[currentClip.id] ?? []).some(
                        (w) =>
                          w.mark?.card?.freePlace === true ||
                          (typeof w.mark?.xPct === 'number' &&
                            typeof w.mark?.yPct === 'number'),
                      ) && (`,
  `                      (project.captions[currentClip.id] ?? []).length > 0 && (`,
  'toggle always visible when the scene has captions',
);

// 2 — the reset is scoped to the current timestamp's page, not the whole scene.
rep(
  `async function resetCaptionWords() {
    if (!project || !currentClip) return;
    const words = (project.captions[currentClip.id] ?? []).map((w) => ({
      word: w.word,
      start: w.start,
      end: w.end,
    }));
    const updated: ReelProject = {
      ...project,
      captions: { ...project.captions, [currentClip.id]: words },
    };
    setProject(updated);
    setWordPlaceLocal({});
    setWordScaleLocal({});
    setFxWords(new Set());
    setFxTarget(null);
    await post({ action: 'save', project: updated });
    setNote('Caption words reset to the clean theme.');
  }`,
  `async function resetCaptionWords() {
    if (!project || !currentClip) return;
    const all = project.captions[currentClip.id] ?? [];
    // Scope to the words ON the current timestamp — the page showing at the
    // playhead — not the whole scene. Compute the page from the active word +
    // the layout's page size (wordsPerRow × rows).
    const clipIdx = Math.max(
      0,
      project.clips.findIndex((c) => c.id === currentClip.id),
    );
    const clipSec = Math.max(0, playheadSec - timelineStartOf(project.clips, clipIdx));
    let activeIdx = 0;
    for (let i = 0; i < all.length; i += 1) {
      if (clipSec < all[i].start) break;
      activeIdx = i;
    }
    const wpr = project.captionOverrides?.wordsPerRow ?? 3;
    const rowCount = project.captionOverrides?.rows ?? 1;
    const pageSize = Math.max(1, wpr * rowCount);
    const pageFrom = Math.floor(activeIdx / pageSize) * pageSize;
    const pageEnd = Math.min(all.length, pageFrom + pageSize);
    const inPage = new Set<number>();
    for (let i = pageFrom; i < pageEnd; i += 1) inPage.add(i);
    // Strip the marks on JUST this page's words; every other word keeps its edit.
    const words = all.map((w, i) =>
      inPage.has(i) ? { word: w.word, start: w.start, end: w.end } : w,
    );
    const updated: ReelProject = {
      ...project,
      captions: { ...project.captions, [currentClip.id]: words },
    };
    setProject(updated);
    setWordPlaceLocal({});
    setWordScaleLocal({});
    setFxWords(new Set());
    setFxTarget(null);
    await post({ action: 'save', project: updated });
    setNote('Reset the words on this timestamp to the clean theme.');
  }`,
  'reset scoped to the current timestamp page',
);

fs.writeFileSync(FILE, s, 'utf8');
console.log(`\n${n}/2 edits applied · ${before} → ${s.length} bytes`);
