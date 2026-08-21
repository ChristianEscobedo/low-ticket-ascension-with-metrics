const fs = require('fs');
const files = [
  'src/app/(fullscreen)/admin/reel-studio/useCaptionEdit.ts',
  'src/app/(fullscreen)/admin/reel-studio/CaptionEditSurface.tsx',
  'src/app/(fullscreen)/admin/reel-studio/WordDragLayer.tsx',
];
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  console.log('=== ' + f);
  lines.slice(0, 40).forEach((l, i) => {
    if (l.includes('react')) console.log((i + 1) + ': ' + l.trim());
  });
}
const a = fs.readFileSync('src/lib/mothermode/reel/render/captionLayer.tsx', 'utf8');
const b = fs.readFileSync('render-worker/src/lib/mothermode/reel/render/captionLayer.tsx', 'utf8');
console.log('vendored identical to canonical: ' + (a === b));
console.log('---- remotion-project shim ----');
console.log(fs.readFileSync('remotion-project/CaptionLayer.tsx', 'utf8').slice(0, 500));
// anchor uniqueness checks
const anchors = [
  ['useCaptionEdit.ts', files[0], '  const [fxTarget, setFxTarget] = useState<number | null>(null);'],
  ['useCaptionEdit.ts', files[0], "    setProject(updated);\n    await post({ action: 'save', project: updated });\n  }"],
  ['useCaptionEdit.ts', files[0], "    const baseTransform = t.style.transform || '';"],
  ['useCaptionEdit.ts', files[0], '      t.style.transform = `${baseTransform} translate(${delta.x}px, ${delta.y}px)`;'],
  ['captionLayer.tsx', 'src/lib/mothermode/reel/render/captionLayer.tsx', '            // skip free-placed words (painted in absOverlay)'],
  ['CaptionEditSurface.tsx', files[1], '  const dragWords = (() => {'],
  ['CaptionEditSurface.tsx', files[1], '    return list;\n  })();'],
  ['WordDragLayer.tsx', files[2], '      setGlyphBox(next);\n    };'],
];
for (const [name, f, a2] of anchors) {
  const s = fs.readFileSync(f, 'utf8');
  const norm = s.includes('\r\n') ? a2.replace(/\n/g, '\r\n') : a2;
  let n = 0, i = -1;
  while ((i = s.indexOf(norm, i + 1)) >= 0) n++;
  console.log(n + 'x  [' + name + '] ' + a2.slice(0, 60).replace(/\n/g, '\\n'));
}
