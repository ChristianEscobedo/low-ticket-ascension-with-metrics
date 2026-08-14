#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');

// 1) Fix CaptionAnim cast
{
  const p = path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx');
  let s = fs.readFileSync(p, 'utf8');
  s = s.replace(
    /entranceStyle\(wordAnim as CaptionAnim \| string, wordEnterT\)/g,
    'entranceStyle(wordAnim as string, wordEnterT)',
  );
  fs.writeFileSync(p, s);
  console.log('fixed CaptionAnim cast');
}

// 2) applyWordMark clear undefined (CRLF-safe)
{
  const p = path.join(
    root,
    'src/app/(fullscreen)/admin/reel-studio/page.tsx',
  );
  let s = fs.readFileSync(p, 'utf8');
  if (s.includes('undefined in partial means')) {
    console.log('applyWordMark already clears');
  } else {
    const re =
      /const words = \(project\.captions\[currentClip\.id\] \?\? \[\]\)\.map\(\(w, i\) =>\s*i === index \? \{ \.\.\.w, mark: \{ \.\.\.\(w\.mark \?\? \{\}\), \.\.\.partial \} \} : w,\s*\);/;
    const neu = `const words = (project.captions[currentClip.id] ?? []).map((w, i) => {
      if (i !== index) return w;
      // undefined in partial means "clear this field" (spread alone keeps old).
      const next: Record<string, unknown> = { ...(w.mark ?? {}) };
      for (const [k, v] of Object.entries(partial)) {
        if (v === undefined) delete next[k];
        else next[k] = v;
      }
      const empty = Object.keys(next).length === 0;
      return empty
        ? { word: w.word, start: w.start, end: w.end }
        : { ...w, mark: next as import('@/lib/mothermode/reel/types').ReelWordMark };
    });`;
    if (!re.test(s)) {
      console.error('applyWordMark map not matched');
      const i = s.indexOf('async function applyWordMark');
      console.log(JSON.stringify(s.slice(i, i + 400)));
      process.exit(1);
    }
    s = s.replace(re, neu);
    fs.writeFileSync(p, s);
    console.log('applyWordMark clears undefined');
  }
}

// vendor copy
const src = path.join(
  root,
  'src/lib/mothermode/reel/render/captionLayer.tsx',
);
const dst = path.join(
  root,
  'render-worker/src/lib/mothermode/reel/render/captionLayer.tsx',
);
if (fs.existsSync(dst)) fs.copyFileSync(src, dst);

try {
  execSync('pnpm exec tsc --noEmit -p tsconfig.json --pretty false 2>&1', {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  console.log('tsc clean');
} catch (e) {
  const out = String(e.stdout || e.message || e);
  const lines = out
    .split(/\r?\n/)
    .filter(
      (l) =>
        /error TS/.test(l) &&
        /captionLayer|WordDrag|page\.tsx|applyWordMark/.test(l),
    );
  console.log('errors', lines.length);
  lines.slice(0, 30).forEach((l) => console.log(l));
  if (lines.length) process.exit(1);
  // unrelated errors ok
  console.log('no relevant errors');
}
console.log('OK');
