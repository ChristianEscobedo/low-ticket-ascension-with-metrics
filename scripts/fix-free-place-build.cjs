#!/usr/bin/env node
/**
 * Fix remaining free-place build errors:
 * 1. cardWin undefined in free-place branch (declare before use)
 * 2. [...fxWords] downlevelIteration → Array.from
 * 3. SubtitlePanel prop fxWords vs fxWordIndexes
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const read = (r) => fs.readFileSync(path.join(root, r), 'utf8');
const write = (r, s) => fs.writeFileSync(path.join(root, r), s);

// ---------------------------------------------------------------------------
// 1) captionLayer — ensure cardWin is declared before free-place branch
// ---------------------------------------------------------------------------
{
  let s = read('src/lib/mothermode/reel/render/captionLayer.tsx');
  const lines = s.split(/\r?\n/);

  // Find free-place block start
  const freeIdx = lines.findIndex((l) => l.includes('const freePlaceCard'));
  if (freeIdx < 0) {
    console.error('freePlaceCard missing');
    process.exit(1);
  }

  // Is cardWin declared anywhere before freeIdx?
  let cardWinDecl = -1;
  for (let i = 0; i < freeIdx; i++) {
    if (/const cardWin\b/.test(lines[i]) || /let cardWin\b/.test(lines[i])) {
      cardWinDecl = i;
      break;
    }
  }

  // Find isBuildStack / stackMode nearby for insertion anchor
  let stackModeLine = -1;
  for (let i = 0; i < freeIdx; i++) {
    if (lines[i].includes('const isBuildStack')) stackModeLine = i;
  }

  if (cardWinDecl < 0) {
    // Need to declare cardWin. Prefer right after isBuildStack.
    const decl =
      '  const cardWin = resolveCardWindow(words, activeIdx);';
    // Also need stackMode if missing
    let insertAt = stackModeLine >= 0 ? stackModeLine + 1 : freeIdx;
    // Check if resolveCardWindow is called elsewhere later — remove dupes after free block
    lines.splice(insertAt, 0, decl);
    console.log('layer: inserted cardWin at', insertAt + 1);

    // Remove any later duplicate const cardWin
    for (let i = insertAt + 2; i < lines.length; i++) {
      if (/^\s*const cardWin\b/.test(lines[i])) {
        console.log('layer: removed dup cardWin at', i + 1);
        lines.splice(i, 1);
        break;
      }
    }
    s = lines.join('\n');
  } else {
    console.log('layer: cardWin already before free-place at', cardWinDecl + 1);
  }

  // If free-place still references cardWin but isBuildStack missing before it, fix
  if (!s.includes('const isBuildStack') && s.includes('isBuildStack')) {
    console.warn('isBuildStack used but not declared — check manually');
  }

  // Ensure free-place uses resolveCardWindow if cardWin was never from stack path
  // Re-read after edits
  if (!/const cardWin\s*=/.test(s)) {
    s = s.replace(
      /\/\/ Free-place stack card:/,
      `const cardWin = resolveCardWindow(words, activeIdx);\n\n  // Free-place stack card:`,
    );
    console.log('layer: cardWin via replace before free-place comment');
  }

  write('src/lib/mothermode/reel/render/captionLayer.tsx', s);
}

// Verify cardWin order
{
  const s = read('src/lib/mothermode/reel/render/captionLayer.tsx');
  const freeAt = s.indexOf('const freePlaceCard');
  const cardAt = s.indexOf('const cardWin');
  console.log('cardWin pos', cardAt, 'freePlace pos', freeAt, 'ok', cardAt >= 0 && cardAt < freeAt);
  if (!(cardAt >= 0 && cardAt < freeAt)) {
    // Force: inject immediately before freePlaceCard
    const inject = '  const cardWin = resolveCardWindow(words, activeIdx);\n\n  ';
    const next = s.replace(
      /(\s*)\/\/ Free-place stack card:/,
      `\n  const cardWin = resolveCardWindow(words, activeIdx);\n$1// Free-place stack card:`,
    );
    // Remove ALL other const cardWin to avoid redeclare
    let cleaned = next;
    const parts = cleaned.split(/\r?\n/);
    let seen = 0;
    const out = [];
    for (const line of parts) {
      if (/^\s*const cardWin\s*=/.test(line)) {
        seen++;
        if (seen > 1) {
          console.log('skip dup', line.trim());
          continue;
        }
      }
      out.push(line);
    }
    write('src/lib/mothermode/reel/render/captionLayer.tsx', out.join('\n'));
    const v = read('src/lib/mothermode/reel/render/captionLayer.tsx');
    console.log(
      'retry cardWin',
      v.indexOf('const cardWin'),
      'free',
      v.indexOf('const freePlaceCard'),
    );
  }
}

// ---------------------------------------------------------------------------
// 2) page.tsx — Array.from(fxWords) + SubtitlePanel prop name
// ---------------------------------------------------------------------------
{
  let p = read('src/app/(fullscreen)/admin/reel-studio/page.tsx');

  // Fix set iteration
  const before = (p.match(/\[\.\.\.fxWords\]/g) || []).length;
  p = p.replace(/\[\.\.\.fxWords\]/g, 'Array.from(fxWords)');
  console.log('page: Array.from fxWords', before);

  // SubtitlePanel expects fxWordIndexes — rename prop at call site
  // fxWords={fxWords} → fxWordIndexes={fxWords} when passing to SubtitlePanel
  // Careful: only the prop name on SubtitlePanel, not the state variable
  if (p.includes('fxWords={fxWords}') || p.includes('fxWords={')) {
    // Find SubtitlePanel blocks and fix prop
    p = p.replace(
      /(<SubtitlePanel[\s\S]*?)fxWords=\{/g,
      '$1fxWordIndexes={',
    );
    console.log('page: SubtitlePanel fxWordIndexes prop');
  }

  // Also if already wrong name left as fxWords= near SubtitlePanel
  const m = p.match(/SubtitlePanel[\s\S]{0,800}fxWords=/);
  if (m) {
    console.log('still has fxWords= near SubtitlePanel?');
  }

  write('src/app/(fullscreen)/admin/reel-studio/page.tsx', p);
}

// ---------------------------------------------------------------------------
// 3) SubtitlePanel — accept both names OR keep fxWordIndexes (already has it)
//    Ensure page matches. Optionally alias in panel.
// ---------------------------------------------------------------------------
{
  let g = read('src/app/(fullscreen)/admin/reel-studio/SubtitlePanel.tsx');
  // Add optional fxWords alias if only fxWordIndexes
  if (g.includes('fxWordIndexes') && !g.includes('fxWords?:')) {
    // destructure: add fxWords as alias
    if (/fxWordIndexes\s*[,}]/.test(g) && g.includes('fxWordIndexes?:')) {
      // In props type keep fxWordIndexes; in destructure accept either via rename at call site only
      console.log('panel: keeps fxWordIndexes (call site fixed)');
    }
  }
}

// vendor layer
execSync('node scripts/sync-vendored-captions.cjs', {
  cwd: root,
  stdio: 'inherit',
});
const wl = path.join(
  root,
  'render-worker/src/lib/mothermode/reel/render/captionLayer.tsx',
);
if (fs.existsSync(wl)) {
  fs.copyFileSync(
    path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx'),
    wl,
  );
}

// tsc filter
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
        /page\.tsx|WordDrag|SubtitlePanel|captionLayer|types\.ts|freePlace|cardWin|xPct|fxWord/.test(
          l,
        ),
    );
  console.log('relevant errors', lines.length);
  lines.slice(0, 40).forEach((l) => console.log(l));
  if (lines.length) process.exit(1);
}

execSync(
  'pnpm exec vitest run tests/lib/caption-free-place.test.ts --reporter=dot',
  { cwd: root, stdio: 'inherit' },
);
console.log('OK');
