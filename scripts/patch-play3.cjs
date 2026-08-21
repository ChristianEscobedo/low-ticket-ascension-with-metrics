// One-shot v3: remotion-mode play models the Player's own play button.
// Line-ending AWARE — the file may be CRLF after tool writes on Windows.
const fs = require('fs');
const FILE = 'src/app/(fullscreen)/admin/reel-studio/page.tsx';
let src = fs.readFileSync(FILE, 'utf8');
const nl = src.includes('\r\n') ? '\r\n' : '\n';

const rules = [
  [
    'startClock branch',
    '    if (!proj || proj.clips.length === 0 || c.playing) return;' + nl,
    '    if (!proj || proj.clips.length === 0 || c.playing) return;' + nl +
      '    // REMOTION MODE: the Player owns playback — flip the prop instead of' + nl +
      '    // running the rAF clock on top of it (the "timeline play is slow" drag).' + nl +
      "    if (previewMode === 'remotion' && !stageIsBlob) {" + nl +
      '      if (playheadSec >= tot - 0.05) seekTimeline(0); // replay from the top' + nl +
      '      setPlaying(true);' + nl +
      '      return;' + nl +
      '    }' + nl,
  ],
  [
    'togglePlay branch',
    '    if (clockRef.current.playing) stopClock();' + nl,
    "    if (previewMode === 'remotion' && !stageIsBlob) {" + nl +
      '      setPlaying((p) => !p);' + nl +
      '      return;' + nl +
      '    }' + nl +
      '    if (clockRef.current.playing) stopClock();' + nl,
  ],
  [
    'onEnded mount',
    '                        playing={playing}' + nl,
    '                        playing={playing}' + nl +
      '                        onEnded={() => setPlaying(false)}' + nl,
  ],
];

let failed = false;
for (const [name, search, replace] of rules) {
  const first = src.indexOf(search);
  const last = src.lastIndexOf(search);
  if (first < 0) {
    console.log('MISS  ' + name);
    failed = true;
    continue;
  }
  if (first !== last) {
    console.log('DUP   ' + name + ' — skipped');
    failed = true;
    continue;
  }
  src = src.slice(0, first) + replace + src.slice(first + search.length);
  console.log('ok    ' + name);
}
if (!failed) fs.writeFileSync(FILE, src);
fs.writeFileSync('tmp-play3-result.txt', (failed ? 'NOT WRITTEN' : 'written') + ' nl=' + (nl === '\r\n' ? 'crlf' : 'lf'), 'utf8');
