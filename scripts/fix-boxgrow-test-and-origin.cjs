#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');

// 1) Update preset test: boxGrow no longer paints backgroundColor on active
//    (absolute plate in captionLayer does). Assert reserved padding instead.
{
  const p = path.join(root, 'tests/lib/caption-presets.test.ts');
  let t = fs.readFileSync(p, 'utf8');
  const old =
    "expect(captionCssFor(captionDefFor('bounce-box')).active.backgroundColor).toBeTruthy();";
  // try a few variants
  const patterns = [
    /expect\(captionCssFor\(captionDefFor\('bounce-box'\)\)\.active\.background[^\n]+/,
    /\/\/ boxGrow:[\s\S]{0,200}?expect\(captionCssFor\(captionDefFor\('bounce-box'\)\)\.active\.[^\n]+/,
  ];
  let hit = false;
  for (const re of patterns) {
    if (re.test(t)) {
      t = t.replace(
        re,
        `// boxGrow: layout padding reserved idle+active; plate is absolute in layer
    expect(captionCssFor(captionDefFor('bounce-box')).active.padding).toBeTruthy();
    expect(captionCssFor(captionDefFor('bounce-box')).word.padding).toBe(
      captionCssFor(captionDefFor('bounce-box')).active.padding,
    );
    expect(captionCssFor(captionDefFor('bounce-box')).active.backgroundColor).toBeUndefined();`,
      );
      hit = true;
      break;
    }
  }
  if (!hit) {
    // dump nearby lines
    const i = t.indexOf('bounce-box');
    console.log('context around bounce-box in test:');
    console.log(t.slice(Math.max(0, i - 300), i + 500));
    // broader search for backgroundColor expectation near bounce
    const j = t.indexOf("DefFor('bounce-box')");
    console.log('alt', t.slice(j, j + 200));
    process.exit(1);
  }
  fs.writeFileSync(p, t);
  console.log('test updated');
}

// 2) Layer transformOrigin
{
  const p = path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx');
  let s = fs.readFileSync(p, 'utf8');
  if (s.includes("transformOrigin: 'center center'")) {
    console.log('origin already present');
  } else {
    const needle = `const base: React.CSSProperties = {
              ...(isActive || power ? css.active : css.word),
              display: 'inline-block',
              position: 'relative',
            };`;
    const repl = `const base: React.CSSProperties = {
              ...(isActive || power ? css.active : css.word),
              display: 'inline-block',
              position: 'relative',
              transformOrigin: 'center center',
            };`;
    if (!s.includes(needle)) {
      // CRLF?
      const n2 = needle.replace(/\n/g, '\r\n');
      const r2 = repl.replace(/\n/g, '\r\n');
      if (s.includes(n2)) {
        s = s.replace(n2, r2);
        console.log('origin set (crlf)');
      } else {
        console.error('base block not found');
        const i = s.indexOf('const base: React.CSSProperties');
        console.log(JSON.stringify(s.slice(i, i + 220)));
        process.exit(1);
      }
    } else {
      s = s.replace(needle, repl);
      console.log('origin set');
    }
    fs.writeFileSync(p, s);
  }
}

execSync('node scripts/sync-vendored-captions.cjs', {
  cwd: root,
  stdio: 'inherit',
});
const workerLayer = path.join(
  root,
  'render-worker/src/lib/mothermode/reel/render/captionLayer.tsx',
);
if (fs.existsSync(workerLayer)) {
  fs.copyFileSync(
    path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx'),
    workerLayer,
  );
}

execSync(
  'pnpm exec vitest run tests/lib/caption-presets.test.ts tests/lib/caption-vendor-parity.test.ts --reporter=dot',
  { cwd: root, stdio: 'inherit' },
);
console.log('OK');
