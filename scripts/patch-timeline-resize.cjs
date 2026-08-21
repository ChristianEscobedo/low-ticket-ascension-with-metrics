// One-shot: draggable splitter between the stage and the timeline.
// Drag UP to grow the timeline (the stage row is 1fr so the preview shrinks),
// drag DOWN to shrink the timeline (preview grows). Double-click resets to auto.
const fs = require('fs');
const FILE = 'src/app/(fullscreen)/admin/reel-studio/page.tsx';
let src = fs.readFileSync(FILE, 'utf8');
const nl = src.includes('\r\n') ? '\r\n' : '\n';

const rules = [
  [
    'state + ref',
    '  const stageRef = useRef<HTMLDivElement>(null);' + nl,
    '  const stageRef = useRef<HTMLDivElement>(null);' + nl +
      '  // Timeline vertical resize: 0 = auto height (the layout default).' + nl +
      '  // Dragging the splitter sets an explicit px height; the stage row above' + nl +
      '  // is grid 1fr, so it absorbs whatever the timeline gives up — which is' + nl +
      '  // also how you get a BIGGER preview (drag the timeline smaller).' + nl +
      '  const [timelineH, setTimelineH] = useState(0);' + nl +
      '  const timelineBoxRef = useRef<HTMLDivElement | null>(null);' + nl,
  ],
  [
    'splitter + sized box',
    '            <div className="shrink-0 px-4 pb-4">' + nl,
    '            {/* timeline resize splitter — drag up/down; double-click resets */}' + nl +
      '            <div' + nl +
      '              className="mx-4 mb-1 h-1.5 shrink-0 cursor-row-resize rounded-full bg-bone/10 transition-colors hover:bg-brass/40"' + nl +
      '              title="Drag to resize the timeline · double-click to reset"' + nl +
      '              onPointerDown={(e) => {' + nl +
      '                const el = timelineBoxRef.current;' + nl +
      '                if (!el) return;' + nl +
      '                e.preventDefault();' + nl +
      '                const startY = e.clientY;' + nl +
      '                const startH = el.offsetHeight;' + nl +
      '                const move = (ev: PointerEvent) => {' + nl +
      '                  const h = Math.min(' + nl +
      '                    Math.round(window.innerHeight * 0.7),' + nl +
      '                    Math.max(140, Math.round(startH + (startY - ev.clientY))),' + nl +
      '                  );' + nl +
      '                  setTimelineH(h);' + nl +
      '                };' + nl +
      '                const up = () => {' + nl +
      "                  window.removeEventListener('pointermove', move);" + nl +
      "                  window.removeEventListener('pointerup', up);" + nl +
      '                };' + nl +
      "                window.addEventListener('pointermove', move);" + nl +
      "                window.addEventListener('pointerup', up);" + nl +
      '              }}' + nl +
      '              onDoubleClick={() => setTimelineH(0)}' + nl +
      '            />' + nl +
      '            <div' + nl +
      '              ref={timelineBoxRef}' + nl +
      '              className={clsx(\'shrink-0 px-4 pb-4\', timelineH > 0 && \'overflow-y-auto\')}' + nl +
      '              style={timelineH > 0 ? { height: timelineH } : undefined}' + nl +
      '            >' + nl,
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
fs.writeFileSync(
  'tmp-resize-result.txt',
  (failed ? 'NOT WRITTEN' : 'written') + ' nl=' + (nl === '\r\n' ? 'crlf' : 'lf'),
  'utf8',
);
