#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const p = path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx');
let s = fs.readFileSync(p, 'utf8');

console.log('renderGradientWord refs', (s.match(/renderGradientWord/g) || []).length);
console.log('caption-grad-shadow refs', (s.match(/caption-grad-shadow/g) || []).length);
console.log('wordSyncedGhostOpacity refs', (s.match(/wordSyncedGhostOpacity/g) || []).length);
console.log('wordMotionPhase refs', (s.match(/wordMotionPhase/g) || []).length);
console.log('syncToWords refs', (s.match(/syncToWords/g) || []).length);

// Find main word return
const idx = s.indexOf("mark?.fx === 'marker'");
console.log('marker at', idx);
console.log(s.slice(idx - 400, idx + 100));

// Wire dual-layer if not called
if ((s.match(/renderGradientWord\(/g) || []).length < 2) {
  // Find: return (\n              <span key={`${idx}-${w.text}`} style={style}>
  const re = /return \(\s*\n\s*<span key=\{\`\$\{idx\}-\$\{w\.text\}\`\} style=\{style\}>/;
  const m = s.match(re);
  if (m) {
    const insert = `// Dual-layer gradient/shine (no silhouette).
            {
              const gradShadow = String(
                (style as Record<string, unknown>)['--caption-grad-shadow'] ?? '',
              );
              const isGradFill = !!(style as Record<string, unknown>)['backgroundImage'];
              if (
                isGradFill &&
                gradShadow &&
                !(ghostMeta && ghostMeta.staggerMode === 'letter')
              ) {
                return (
                  <span key={\`\${idx}-\${w.text}\`}>
                    {renderGradientWord(text, style, emoji, tail)}
                  </span>
                );
              }
            }

            return (
              <span key={\`\${idx}-\${w.text}\`} style={style}>`;
    s = s.replace(re, insert);
    console.log('wired dual-layer');
  } else {
    // try without newlines
    const i2 = s.indexOf('style={style}>');
    console.log('style={style}> count contexts');
    let c = 0;
    let pos = 0;
    while ((pos = s.indexOf('style={style}>', pos)) >= 0) {
      console.log('at', pos, JSON.stringify(s.slice(pos - 80, pos + 40)));
      pos += 10;
      c++;
      if (c > 5) break;
    }
  }
}

// Fix gradient mark fx filter path
if (s.includes("style.filter = `drop-shadow(${String(style.textShadow)")) {
  s = s.replace(
    /if \(style\.textShadow\) \{\s*style\.filter = `drop-shadow\(\$\{String\(style\.textShadow\)\.split\(','\)\[0\]\.trim\(\)\}\)`;\s*delete style\.textShadow;\s*\}/,
    `if (style.textShadow) {
        (style as Record<string, unknown>)['--caption-grad-shadow'] = style.textShadow;
        delete style.textShadow;
      } else {
        (style as Record<string, unknown>)['--caption-grad-shadow'] =
          '0 2px 8px rgba(0,0,0,0.55)';
      }
      delete style.filter;`,
  );
  console.log('fixed gradient mark fx');
}

// Shine: add shadow var if missing after shine case
if (s.includes("case 'shine':") && !s.includes("shine dual")) {
  // after shine's paintOrder delete, before pulse
  const shineBreak = s.indexOf("case 'shine':");
  const pulse = s.indexOf("case 'pulse':", shineBreak);
  const chunk = s.slice(shineBreak, pulse);
  if (!chunk.includes('--caption-grad-shadow')) {
    s = s.slice(0, pulse) +
      `      if (!(style as Record<string, unknown>)['--caption-grad-shadow']) {
        (style as Record<string, unknown>)['--caption-grad-shadow'] =
          '0 2px 8px rgba(0,0,0,0.5)';
      }
      delete style.filter;
      delete style.textShadow;
` + s.slice(pulse);
    console.log('shine shadow var');
  }
}

fs.writeFileSync(p, s);

let d = 0;
for (const ch of s) {
  if (ch === '{') d++;
  if (ch === '}') d--;
}
console.log('balance', d);
console.log('renderGradientWord calls', (s.match(/renderGradientWord\(/g) || []).length);

execSync('node scripts/sync-vendored-captions.cjs', { cwd: root, stdio: 'inherit' });
execSync(
  'pnpm exec vitest run tests/lib/caption-presets.test.ts tests/lib/caption-preset-round-trip.test.ts tests/lib/render-vendor-parity.test.ts tests/lib/caption-vendor-parity.test.ts',
  { cwd: root, stdio: 'inherit' },
);
console.log('OK');
