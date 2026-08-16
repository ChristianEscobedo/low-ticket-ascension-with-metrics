/**
 * Add a "reset caption words" escape hatch: one click strips every per-word
 * mark on the current scene (free-place positions, fx, color, scale, font,
 * hide, behind, card) so the captions snap back to the clean theme. The reel's
 * preset + captionOverrides are untouched — this clears the fp edits only.
 *
 * Two edits: (1) the resetCaptionWords function, (2) a ↺ button in the
 * Edit/Preview canvas pill (which shows exactly when there ARE fp edits).
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

// 1 — the resetCaptionWords function, right before onCaptionWordPointerDown.
rep(
  `  function onCaptionWordPointerDown(e: React.PointerEvent, surface: 'remotion' | 'stage') {`,
  `  /**
   * Reset the current scene's caption words to the clean theme — strips EVERY
   * per-word mark (free-place x/y, fx, color, scale, anim, ambient, font, hide,
   * behind, card). The reel's preset + captionOverrides are untouched; this is
   * the "undo all my fp edits" escape hatch.
   */
  async function resetCaptionWords() {
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
  }

  function onCaptionWordPointerDown(e: React.PointerEvent, surface: 'remotion' | 'stage') {`,
  'resetCaptionWords function',
);

// 2 — the ↺ reset button, first in the Edit/Preview canvas pill.
rep(
  `                        <div
                          data-stack-edit-toggle
                          className="pointer-events-auto absolute right-2 top-2 z-40 flex items-center gap-1 rounded-full border border-white/15 bg-black/70 p-0.5 text-[10px] shadow-lg backdrop-blur"
                        >
                          <button
                            type="button"
                            className={
                              stackEditMode
                                ? 'rounded-full bg-brass px-2.5 py-1 font-semibold text-ink'
                                : 'rounded-full px-2.5 py-1 text-white/70 hover:text-white'
                            }`,
  `                        <div
                          data-stack-edit-toggle
                          className="pointer-events-auto absolute right-2 top-2 z-40 flex items-center gap-1 rounded-full border border-white/15 bg-black/70 p-0.5 text-[10px] shadow-lg backdrop-blur"
                        >
                          <button
                            type="button"
                            onClick={() => void resetCaptionWords()}
                            className="rounded-full px-1.5 py-1 text-[11px] leading-none text-white/50 hover:text-red-300"
                            title="Reset caption edits — clear every free-place position + per-word style on this scene, back to the clean theme"
                          >
                            ↺
                          </button>
                          <button
                            type="button"
                            className={
                              stackEditMode
                                ? 'rounded-full bg-brass px-2.5 py-1 font-semibold text-ink'
                                : 'rounded-full px-2.5 py-1 text-white/70 hover:text-white'
                            }`,
  'the ↺ reset button in the canvas pill',
);

fs.writeFileSync(FILE, s, 'utf8');
console.log(`\n${n}/2 edits applied · ${before} → ${s.length} bytes`);
