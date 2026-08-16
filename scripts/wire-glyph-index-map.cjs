/**
 * Wire the clip→plan word-index map into the Remotion branch's WordDragLayer.
 *
 * The Remotion preview paints caption glyphs numbered by the TIMELINE-MERGED
 * plan list; the editor numbers per-clip. The drag layer's hit boxes looked
 * glyphs up by the per-clip index, so on a multi-clip or trimmed reel they
 * landed on the WRONG words ("highlighting words that aren't on screen, and
 * you can't select the ones that are"). planWordIndexFromClipIndex is the
 * inverse of the existing clipWordIndexFromPlanIndex; mapGlyphIndex feeds it
 * to the layer. The Edit stage numbers per-clip, so it stays identity.
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

// 1 — the inverse helper, right after clipWordIndexFromPlanIndex.
rep(
  `    if (rest < surviving.length) return { clipId: clip.id, index: surviving[rest] };
    rest -= surviving.length;
  }
  return null;
}

/**
 * Map a WordStylePatch (the word context menu's edit) onto a ReelWordMark`,
  `    if (rest < surviving.length) return { clipId: clip.id, index: surviving[rest] };
    rest -= surviving.length;
  }
  return null;
}

/**
 * The inverse of clipWordIndexFromPlanIndex: a clip's own captions index → the
 * index the Remotion layer paints on the glyph (the timeline-merged plan list).
 * The WordDragLayer's hit boxes look glyphs up by this, so they land on the
 * RIGHT word on a multi-clip or trimmed reel.
 */
function planWordIndexFromClipIndex(
  proj: ReelProject,
  clipId: string,
  clipIndex: number,
): number | null {
  let planOffset = 0;
  for (const clip of proj.clips) {
    const ws = proj.captions[clip.id] ?? [];
    const trimStart = clip.trimStartSec ?? 0;
    const effSec = effectiveClipDuration(clip);
    // The surviving-word list mirrors shiftWords' drop rule exactly.
    const surviving: number[] = [];
    for (let i = 0; i < ws.length; i += 1) {
      const w = ws[i];
      const ls = w.start - trimStart;
      const le = w.end - trimStart;
      if (le <= 0 || ls >= effSec || !w.word.trim()) continue;
      surviving.push(i);
    }
    if (clip.id === clipId) {
      const pos = surviving.indexOf(clipIndex);
      return pos < 0 ? null : planOffset + pos;
    }
    planOffset += surviving.length;
  }
  return null;
}

/**
 * Map a WordStylePatch (the word context menu's edit) onto a ReelWordMark`,
  'planWordIndexFromClipIndex helper',
);

// 2 — pass mapGlyphIndex to the Remotion branch's WordDragLayer (the one whose
// onSelect carries the "Select WITHOUT seeking" comment — the Edit stage's
// onSelect has no comment, so this anchor is unique to the Remotion branch).
rep(
  `                          onSelect={(index) => {
                            // Select WITHOUT seeking — clicking a word to edit it`,
  `                          mapGlyphIndex={(i) =>
                            currentClip
                              ? planWordIndexFromClipIndex(project, currentClip.id, i) ?? i
                              : i
                          }
                          onSelect={(index) => {
                            // Select WITHOUT seeking — clicking a word to edit it`,
  'mapGlyphIndex prop on the Remotion branch',
);

fs.writeFileSync(FILE, s, 'utf8');
console.log(`\n${n}/2 edits applied · ${before} → ${s.length} bytes`);
