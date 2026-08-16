/**
 * Free-place "show all words" toggle + cue drag box only-when-showing.
 *
 * 1. Edit mode shows just the on-screen page by default (Preview's visibility);
 *    a new "all" toggle on the Edit/Preview pill expands to every card word.
 * 2. The image fly-in drag box shows ONLY while the cue's image is on screen at
 *    the playhead (it used to pin to the selected cue forever), and clicking the
 *    box selects that cue. The ⚙ editor auto-seeks to the cue's word to reach it.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'src', 'app', '(fullscreen)', 'admin', 'reel-studio', 'page.tsx');
let s = fs.readFileSync(FILE, 'utf8');
const before = s.length;
let n = 0;
// The file uses CRLF (Windows) line endings — match them or multi-line
// search strings never find their target.
const NL = s.includes('\r\n') ? '\r\n' : '\n';
const nl = (str) => str.split('\n').join(NL);

function rep(oldStr, newStr, label) {
  const needle = nl(oldStr);
  if (!s.includes(needle)) {
    console.error(`MISS: ${label}`);
    return;
  }
  s = s.split(needle).join(nl(newStr)); // replace all (the cue IIFE is duplicated)
  n += 1;
  console.log(`ok: ${label}`);
}

// 1 — the showAllCardWords state, after stackEditMode (idempotent).
if (!s.includes('const [showAllCardWords')) {
  rep(
    `  const [stackEditMode, setStackEditMode] = useState(false);`,
    `  const [stackEditMode, setStackEditMode] = useState(false);
  /** Edit mode opt-in: show EVERY word on the card (off = just the on-screen
   *  page, same as Preview — the default, so Edit no longer scatters the card). */
  const [showAllCardWords, setShowAllCardWords] = useState(false);`,
    'showAllCardWords state',
  );
} else {
  console.log('skip: showAllCardWords state (already present)');
}

// 2 — StageCaptions: destructure + props type + plan + deps.
rep(
  `  freePlaceEdit = false,
}: {`,
  `  freePlaceEdit = false,
  showAllWords = false,
}: {`,
  'StageCaptions destructure',
);
rep(
  `  /** Edit mode: show every free-placed word (not just the spoken one). */
  freePlaceEdit?: boolean;
}) {`,
  `  /** Edit mode: show every free-placed word (not just the spoken one). */
  freePlaceEdit?: boolean;
  /** Edit mode opt-in: show EVERY card word (off = just the on-screen page). */
  showAllWords?: boolean;
}) {`,
  'StageCaptions props type',
);
rep(
  `      powerWords: overrides?.powerWords ?? [],
      freePlaceEdit,
    }),
    [words, fps, stageW, def, layout, overrides?.powerWords, freePlaceEdit],
  );`,
  `      powerWords: overrides?.powerWords ?? [],
      freePlaceEdit,
      showAllWords,
    }),
    [words, fps, stageW, def, layout, overrides?.powerWords, freePlaceEdit, showAllWords],
  );`,
  'StageCaptions plan',
);

// 3 — the RemotionPreview call: pass showAllWords.
rep(
  `                        playheadSec={playheadSec}
                        freePlaceEdit={stackEditMode}
                      />`,
  `                        playheadSec={playheadSec}
                        freePlaceEdit={stackEditMode}
                        showAllWords={stackEditMode && showAllCardWords}
                      />`,
  'RemotionPreview showAllWords prop',
);

// 4 — the "all" toggle on the Edit/Preview pill (Edit mode only).
rep(
  `                            onClick={exitStackEdit}
                            title="Preview this section with karaoke timing (saves the placement)"
                          >
                            Preview
                          </button>
                        </div>
                      )}`,
  `                            onClick={exitStackEdit}
                            title="Preview this section with karaoke timing (saves the placement)"
                          >
                            Preview
                          </button>
                          {/* Edit mode opt-in: show EVERY word on the card.
                              Off (default) = just the on-screen page, same as
                              Preview — so Edit no longer scatters the card. */}
                          {stackEditMode && (
                            <button
                              type="button"
                              className={
                                showAllCardWords
                                  ? 'rounded-full bg-violet-500 px-2.5 py-1 font-semibold text-white'
                                  : 'rounded-full px-2.5 py-1 text-white/50 hover:text-white'
                              }
                              onClick={() => setShowAllCardWords((v) => !v)}
                              title="Show every word on this card (off = just the words on screen, same as Preview)"
                            >
                              all
                            </button>
                          )}
                        </div>
                      )}`,
  'show-all toggle button',
);

// 5 — the cueOnScreen helper, after cueWindowSec.
rep(
  `  function cueWindowSec(cue: ReelMediaCue): number {
    const w = project?.captions[cue.clipId]?.[cue.wordIndex];
    return Math.max(0.5, (w ? w.end - w.start : 0.4) + (cue.holdSec ?? 1.0));
  }`,
  `  function cueWindowSec(cue: ReelMediaCue): number {
    const w = project?.captions[cue.clipId]?.[cue.wordIndex];
    return Math.max(0.5, (w ? w.end - w.start : 0.4) + (cue.holdSec ?? 1.0));
  }

  /** Is the cue's image actually ON SCREEN at the playhead? The drag box shows
   *  only then (it used to pin to the selected cue forever). Window = the
   *  trigger word's span + the hold, in timeline seconds. */
  function cueOnScreen(cue: ReelMediaCue): boolean {
    if (!project) return false;
    const clipIdx = project.clips.findIndex((c) => c.id === cue.clipId);
    if (clipIdx < 0) return false;
    const w = project.captions[cue.clipId]?.[cue.wordIndex];
    if (!w) return false;
    const clipStart = timelineStartOf(project.clips, clipIdx);
    const trimStart = project.clips[clipIdx].trimStartSec ?? 0;
    const from = clipStart + Math.max(0, w.start - trimStart);
    const to = clipStart + Math.max(0.1, w.end - trimStart) + (cue.holdSec ?? 1.0);
    return playheadSec >= from - 0.05 && playheadSec <= to;
  }`,
  'cueOnScreen helper',
);

// 6 — the CueDragLayer IIFE (appears twice, identical): on-screen gate + onSelect.
const cueIifeOld = `                    {(() => {
                      // Same always-visible rule as the style editor: the drag
                      // box shows for the cue the editor is editing — the ⚙
                      // pick when set, else the clip's first cue. Hiding it
                      // behind the ⚙ toggle is what made it "gone".
                      const clipCues = (project.mediaCues ?? []).filter(
                        (x) => x.clipId === currentClip?.id,
                      );
                      const cue =
                        clipCues.find((x) => x.id === cueStyleEditId) ?? clipCues[0];
                      if (!cue) return null;
                      const sx = cue.style?.xPct ?? 60;
                      const sy = cue.style?.yPct ?? 16;
                      const sw = cue.style?.widthPct ?? 34;
                      return (
                        <CueDragLayer
                          xPct={cueDragLocal?.xPct ?? sx}
                          yPct={cueDragLocal?.yPct ?? sy}
                          widthPct={cueDragLocal?.widthPct ?? sw}
                          src={cue.url}
                          word={project.captions[cue.clipId]?.[cue.wordIndex]?.word ?? ''}
                          onMove={(x, y) =>
                            setCueDragLocal({
                              xPct: x,
                              yPct: y,
                              widthPct: cueDragLocal?.widthPct ?? sw,
                            })
                          }
                          onCommit={(x, y) => {
                            setCueDragLocal(null);
                            void patchCueStyle(cue.id, { xPct: x, yPct: y });
                          }}
                          onResize={(w) =>
                            setCueDragLocal({
                              xPct: cueDragLocal?.xPct ?? sx,
                              yPct: cueDragLocal?.yPct ?? sy,
                              widthPct: w,
                            })
                          }
                          onResizeCommit={(w) => {
                            setCueDragLocal(null);
                            void patchCueStyle(cue.id, { widthPct: w });
                          }}
                        />
                      );
                    })()}`;
const cueIifeNew = `                    {(() => {
                      const clipCues = (project.mediaCues ?? []).filter(
                        (x) => x.clipId === currentClip?.id,
                      );
                      // The drag box shows ONLY while the cue's image is actually
                      // on screen at the playhead — it used to pin to the selected
                      // cue forever. Click the box to grab + select that cue; the
                      // ⚙ editor auto-seeks to the word so the image appears.
                      const onScreen = clipCues.filter((c) => cueOnScreen(c));
                      if (!onScreen.length) return null;
                      return onScreen.map((cue) => {
                        const sx = cue.style?.xPct ?? 60;
                        const sy = cue.style?.yPct ?? 16;
                        const sw = cue.style?.widthPct ?? 34;
                        const local = cue.id === cueStyleEditId ? cueDragLocal : null;
                        return (
                          <CueDragLayer
                            key={cue.id}
                            xPct={local?.xPct ?? sx}
                            yPct={local?.yPct ?? sy}
                            widthPct={local?.widthPct ?? sw}
                            src={cue.url}
                            word={project.captions[cue.clipId]?.[cue.wordIndex]?.word ?? ''}
                            onSelect={() => {
                              setCueStyleEditId(cue.id);
                              setCueDragLocal(null);
                            }}
                            onMove={(x, y) => {
                              setCueStyleEditId(cue.id);
                              setCueDragLocal({
                                xPct: x,
                                yPct: y,
                                widthPct: local?.widthPct ?? sw,
                              });
                            }}
                            onCommit={(x, y) => {
                              setCueDragLocal(null);
                              void patchCueStyle(cue.id, { xPct: x, yPct: y });
                            }}
                            onResize={(w) => {
                              setCueStyleEditId(cue.id);
                              setCueDragLocal({
                                xPct: local?.xPct ?? sx,
                                yPct: local?.yPct ?? sy,
                                widthPct: w,
                              });
                            }}
                            onResizeCommit={(w) => {
                              setCueDragLocal(null);
                              void patchCueStyle(cue.id, { widthPct: w });
                            }}
                          />
                        );
                      });
                    })()}`;
rep(cueIifeOld, cueIifeNew, 'CueDragLayer on-screen gate (both branches)');

// 7 — the ⚙ button auto-seeks to the cue's word so the image (and box) appear.
rep(
  `                                <button
                                  onClick={() =>
                                    setCueStyleEditId((v) => (v === c.id ? null : c.id))
                                  }
                                  className={clsx(
                                    'text-violet-300/60 hover:text-violet-100',
                                    (c.style || c.motion) && 'text-violet-300',
                                  )}
                                  title="Style + motion for this fly-in"
                                >
                                  ⚙
                                </button>`,
  `                                <button
                                  onClick={() => {
                                    const opening = cueStyleEditId !== c.id;
                                    setCueStyleEditId(opening ? c.id : null);
                                    if (opening) {
                                      // Seek to the cue's word so the image (and
                                      // its drag box) appear on the canvas.
                                      const w = project.captions[c.clipId]?.[c.wordIndex];
                                      const clipIdx = project.clips.findIndex((x) => x.id === c.clipId);
                                      if (w && clipIdx >= 0) {
                                        const trimStart = project.clips[clipIdx].trimStartSec ?? 0;
                                        seekTimeline(
                                          timelineStartOf(project.clips, clipIdx) +
                                            Math.max(0, w.start - trimStart) +
                                            0.01,
                                        );
                                      }
                                    }
                                  }}
                                  className={clsx(
                                    'text-violet-300/60 hover:text-violet-100',
                                    (c.style || c.motion) && 'text-violet-300',
                                  )}
                                  title="Style + motion for this fly-in (seeks to it on the canvas)"
                                >
                                  ⚙
                                </button>`,
  '⚙ auto-seek',
);

fs.writeFileSync(FILE, s, 'utf8');
console.log(`\n${n}/7 edits applied · ${before} → ${s.length} bytes`);
