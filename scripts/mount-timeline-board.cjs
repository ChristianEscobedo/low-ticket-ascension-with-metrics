// Mount TimelineBoard in reel-studio page.tsx:
//  - swap the TimelineLanes import for TimelineBoard
//  - drop imports that only the old strip/lanes used
//  - delete SpriteStrip, TRANSITION_GLYPH + TimelineStrip, WaveformLane
//  - replace the TimelineStrip + overlay lane + audio lane + TimelineLanes
//    mount block with ONE <TimelineBoard />
// Every splice is anchor-checked; the script bails before writing if any
// anchor moved.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'src', 'app', '(fullscreen)', 'admin', 'reel-studio', 'page.tsx');
const raw = fs.readFileSync(FILE, 'utf8');
const EOL = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);

function expect(idx, pred, what) {
  if (!pred(lines[idx])) {
    console.error(`ANCHOR FAIL at line ${idx + 1} (${what}): ${JSON.stringify(lines[idx])}`);
    process.exit(1);
  }
}
const isBlank = (s) => typeof s === 'string' && s.trim() === '';

// ---- verify anchors (0-based indices) --------------------------------------
expect(72, (l) => l === '  ReelAudioTrack,', 'ReelAudioTrack import');
expect(99, (l) => l.includes("spriteCellStyle") && l.includes('sceneCuts'), 'spriteCellStyle import');
expect(145, (l) => l.includes('REEL_TRANSITIONS') && l.includes("reel/types"), 'types import line');
expect(147, (l) => l === "import TimelineLanes from './TimelineLanes';", 'TimelineLanes import');
expect(174, (l) => l === "import { peaksFor } from '@/lib/mothermode/reel/waveform';", 'peaksFor import');

expect(448, (l) => l.startsWith('/** R4 filmstrip frames'), 'SpriteStrip doc');
expect(449, (l) => l.startsWith('function SpriteStrip'), 'SpriteStrip fn');
expect(485, (l) => l === '}', 'SpriteStrip end');
expect(486, isBlank, 'blank after SpriteStrip');
expect(487, isBlank, 'blank 2 after SpriteStrip');
expect(488, isBlank, 'blank 3 after SpriteStrip');

expect(489, (l) => l.startsWith('// ---'), 'strip section comment');
expect(494, (l) => l.startsWith('const TRANSITION_GLYPH'), 'TRANSITION_GLYPH');
expect(500, (l) => l.startsWith('function TimelineStrip'), 'TimelineStrip fn');
expect(772, (l) => l === '}', 'TimelineStrip end');

expect(889, isBlank, 'blank before WaveformLane doc');
expect(890, (l) => l.startsWith('/** R14 waveform lane'), 'WaveformLane doc');
expect(917, (l) => l === '}', 'WaveformLane end');

expect(9402, (l) => l.includes('<TimelineStrip'), 'TimelineStrip mount');
expect(9573, (l) => l.trim() === '/>', 'TimelineLanes mount end');
expect(9574, (l) => l.includes('the playhead'), 'playhead comment after lanes');

// ---- the new mount ----------------------------------------------------------
const MOUNT = `                  {/* RVE timeline board — ONE component, one lane per type:
                      video (filmstrip) / captions / media / overlay / audio.
                      Same handlers the old strip + lanes used; TimeRuler and
                      the playhead line stay where they were. */}
                  <TimelineBoard
                    clips={project.clips}
                    captions={project.captions ?? {}}
                    mediaCues={project.mediaCues ?? []}
                    overlays={project.overlays ?? []}
                    audio={project.audio ?? null}
                    total={total}
                    selectedId={selectedClip}
                    onSelect={setSelectedClip}
                    onTrim={(id, trim) => patchClip(id, { trimEndSec: trim })}
                    onReorder={(id, toIndex) => {
                      const from = project.clips.findIndex((c) => c.id === id);
                      if (from < 0 || from === toIndex) return;
                      const next = project.clips.slice();
                      const [item] = next.splice(from, 1);
                      next.splice(toIndex, 0, item);
                      patch({ clips: next });
                    }}
                    onScrub={scrubToCut}
                    onScrubIn={scrubToIn}
                    onLeftTrim={(c, s) => void leftTrimAt(c, s)}
                    onKeyMove={(c, ki, t) => setMotionKey(c, ki, { t })}
                    onTransition={(id, t) => {
                      // The seam picker: set/clear the transition INTO a clip.
                      patch({
                        clips: project.clips.map((c) => {
                          if (c.id !== id) return c;
                          if (!t) {
                            const next = { ...c };
                            delete next.transitionIn;
                            return next;
                          }
                          return { ...c, transitionIn: t };
                        }),
                      });
                    }}
                    onOverlayMove={(id, offsetSec) => patchOverlay(id, { offsetSec })}
                    onOverlayRemove={(id) =>
                      patch({ overlays: (project.overlays ?? []).filter((x) => x.id !== id) })
                    }
                    onAudioMove={(offsetSec) => patch({ audio: { ...project.audio!, offsetSec } })}
                    onAudioRemove={() => patch({ audio: null })}
                  />`.split('\n');

// ---- apply splices, descending so indices stay valid ------------------------
lines.splice(9402, 9573 - 9402 + 1, ...MOUNT); // mount block
lines.splice(889, 917 - 889 + 1); // WaveformLane (+ one blank before it)
lines.splice(489, 772 - 489 + 1); // section comment + TRANSITION_GLYPH + TimelineStrip
lines.splice(448, 488 - 448 + 1); // SpriteStrip + trailing blanks

// single-line edits (content-matched, unique)
function editLine(idx, next) {
  lines[idx] = next;
}
editLine(174, undefined); // peaksFor — mark for removal
editLine(147, "import TimelineBoard from './TimelineBoard';");
editLine(145, "import { makeClipId, WORD_FONTS, type ReelMediaCue, type ReelOverlayClip } from '@/lib/mothermode/reel/types';");
editLine(99, undefined); // spriteCellStyle
editLine(72, undefined); // ReelAudioTrack

const out = lines.filter((l) => l !== undefined).join(EOL);
fs.writeFileSync(FILE, out);
console.log('OK — TimelineBoard mounted, old strip/lanes removed. Lines:', lines.length, '->', out.split('\n').length);
