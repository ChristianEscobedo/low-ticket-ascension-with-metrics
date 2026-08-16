/**
 * The two-level editing model (the user's vision):
 *
 *   DEFAULT (Preview)  = EDIT CAPTIONS — always on. Drag + corner-scale the
 *                        WHOLE caption block (CaptionDragLayer) and images.
 *   EDIT (the toggle)  = EDIT PER WORD — the fp mode. Drag + scale + style
 *                        individual words (WordDragLayer + the direct word drag).
 *
 * The regression this fixes: the direct word-drag on the stage container fired
 * in BOTH modes, so it hijacked the block drag — "the normal drag and scale for
 * the captions doesn't work." Now the word drag only fires in per-word mode,
 * and the block box shows whenever you're NOT in per-word mode.
 *
 * Two edits: (1) the CaptionDragLayer gate `!hasPlaced` → `!stackEditMode`
 * (both stage containers), (2) the word drag gated to per-word mode.
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

// 1 — the block box (CaptionDragLayer) shows whenever you're NOT in per-word
// mode — "edit captions always on". (It used to hide the moment a word was
// free-placed.) Both stage containers carry this gate; split/join hits both.
rep(
  `{!(() => {
                        if (!currentClip) return false;
                        const ws = project.captions[currentClip.id] ?? [];
                        return ws.some(
                          (w) =>
                            typeof w.mark?.xPct === 'number' &&
                            typeof w.mark?.yPct === 'number',
                        );
                      })() && (`,
  `{!stackEditMode && (`,
  'block box always on except in per-word mode',
);

// 2 — the direct word drag is a PER-WORD-mode gesture. In default mode it must
// NOT fire, or it hijacks the block drag. (Right-click → Free-place is the
// always-available way to place a word; the Edit toggle enters per-word mode.)
rep(
  `  function onCaptionWordPointerDown(e: React.PointerEvent, surface: 'remotion' | 'stage') {
    if (!project || !ccOn) return;
    if (e.button !== 0) return; // left press drags; right press opens the menu`,
  `  function onCaptionWordPointerDown(e: React.PointerEvent, surface: 'remotion' | 'stage') {
    if (!project || !ccOn) return;
    // Word drag is a PER-WORD-mode (Edit) gesture. In default mode the block
    // box owns the drag — "edit captions always on, edit per word is the toggle".
    if (!stackEditMode) return;
    if (e.button !== 0) return; // left press drags; right press opens the menu`,
  'word drag gated to per-word mode',
);

fs.writeFileSync(FILE, s, 'utf8');
console.log(`\n${n}/2 edits applied · ${before} → ${s.length} bytes`);
