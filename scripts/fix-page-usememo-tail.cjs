#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const p = path.join(root, 'src/app/(fullscreen)/admin/reel-studio/page.tsx');
let s = fs.readFileSync(p, 'utf8');

// Remove leftover deps line from botched move
s = s.replace(/\n\s*,\s*\[project, currentClip, wordPlaceLocal, wordScaleLocal\]\);\n/, '\n');
console.log('junk removed');

// Close incomplete useMemo after projectWithWordPlace
const open = 'const projectWithWordPlace = useMemo(() => {';
const oi = s.indexOf(open);
if (oi < 0) {
  console.error('projectWithWordPlace missing');
  process.exit(1);
}
// Find the return block end that currently closes with bare `}`
const ret = s.indexOf('return {\n      ...project,\n      captions:', oi);
if (ret < 0) {
  console.error('return block missing');
  process.exit(1);
}
// From return, find matching braces for the return object then the useMemo
// Simpler: look for pattern after return that ends useMemo without deps
const snippet = s.slice(oi, oi + 1200);
console.log('snippet:\n', snippet);

// Replace incomplete close: `};\n  }\n  // R25` -> with deps
const fixed = s.replace(
  /(const projectWithWordPlace = useMemo\(\(\) => \{[\s\S]*?return \{\s*\.\.\.project,\s*captions: \{ \.\.\.project\.captions, \[currentClip\.id\]: next \},\s*\};\s*)\}\s*\n(\s*\/\/ R25:)/,
  '$1}, [project, currentClip, wordPlaceLocal, wordScaleLocal]);\n\n$2',
);

if (fixed === s) {
  // try simpler
  const a = s.indexOf(
    `    return {
      ...project,
      captions: { ...project.captions, [currentClip.id]: next },
    };
  }
  // R25:`,
  );
  if (a < 0) {
    console.error('could not locate incomplete close');
    // dump around end of useMemo body
    const endish = s.indexOf('captions: { ...project.captions, [currentClip.id]: next }', oi);
    console.log(JSON.stringify(s.slice(endish, endish + 200)));
    process.exit(1);
  }
  s =
    s.slice(0, a) +
    `    return {
      ...project,
      captions: { ...project.captions, [currentClip.id]: next },
    };
  }, [project, currentClip, wordPlaceLocal, wordScaleLocal]);

  // R25:` +
    s.slice(a + `    return {
      ...project,
      captions: { ...project.captions, [currentClip.id]: next },
    };
  }
  // R25:`.length);
} else {
  s = fixed;
}
console.log('useMemo closed');

// Ensure RemotionPreview uses it
if (!s.includes('projectWithWordPlace ?? project') && !s.includes('project={projectWithWordPlace')) {
  const before = s;
  s = s.replace(
    /(<RemotionPreview\b[\s\S]{0,120}?project=\{)project(\})/,
    '$1projectWithWordPlace ?? project$2',
  );
  if (s === before) {
    s = s.replace(
      /<RemotionPreview\s*\n(\s*)project=\{project\}/,
      '<RemotionPreview\n$1project={projectWithWordPlace ?? project}',
    );
  }
  console.log('wired preview', s !== before);
} else {
  console.log('preview already wired');
}

// useMemo import
if (!/useMemo/.test(s.match(/from 'react'/) ? s.slice(0, s.indexOf("from 'react'")) : '')) {
  // check import line
}
if (!s.match(/import\s*\{[^}]*\buseMemo\b[^}]*\}\s*from\s*['"]react['"]/)) {
  s = s.replace(
    /import\s*\{([^}]+)\}\s*from\s*['"]react['"]/,
    (m, g) => {
      if (g.includes('useMemo')) return m;
      return `import {${g.replace(/\s+$/, '')}, useMemo } from 'react'`;
    },
  );
  console.log('added useMemo import');
}

fs.writeFileSync(p, s);

// copy caption layer to worker
const src = path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx');
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
        /page\.tsx|captionLayer|WordDrag|projectWithWordPlace|freePlace/.test(l),
    );
  console.log('errors', lines.length);
  lines.slice(0, 30).forEach((l) => console.log(l));
  if (!lines.length) {
    out
      .split(/\r?\n/)
      .filter((l) => /error TS/.test(l))
      .slice(0, 15)
      .forEach((l) => console.log(l));
  }
  if (lines.length) process.exit(1);
}
console.log('OK');
