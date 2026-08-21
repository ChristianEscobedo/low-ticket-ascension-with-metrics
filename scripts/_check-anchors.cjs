const fs = require('fs');
const s = fs.readFileSync('src/app/(fullscreen)/admin/reel-studio/page.tsx', 'utf8');
const checks = [
  'const [playing, setPlaying] = useState(false);',
  'const stageRef',
  '<div className="shrink-0 px-4 pb-4">',
  'const [zoom, setZoom]',
  '<div ref={stageRef}',
];
for (const c of checks) {
  let n = 0, i = -1;
  while ((i = s.indexOf(c, i + 1)) >= 0) n++;
  console.log(n + 'x  ' + c);
}
