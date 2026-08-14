#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const p = path.join(root, 'src/lib/mothermode/reel/captions.ts');
let s = fs.readFileSync(p, 'utf8');

// Ensure keyframes for all CAPTION_ANIMS that fall through to default ''
const missingKf = [
  ['slam', `@keyframes cap-slam{0%{transform:translateY(-0.55em) scale(1.55);opacity:0}100%{transform:translateY(0) scale(1);opacity:1}}`],
  ['typewriter', `@keyframes cap-typewriter{0%{opacity:0}100%{opacity:1}}`],
  ['blurPop', `@keyframes cap-blurpop{0%{filter:blur(8px);transform:scale(0.85);opacity:0}100%{filter:blur(0);transform:scale(1);opacity:1}}`],
  ['neonPulse', `@keyframes cap-neonpulse{0%{opacity:.6;transform:scale(0.96);text-shadow:0 0 4px currentColor}100%{opacity:1;transform:scale(1);text-shadow:0 0 14px currentColor}}`],
  ['zoomSnap', `@keyframes cap-zoomsnap{0%{transform:scale(0.4);opacity:0}100%{transform:scale(1);opacity:1}}`],
  ['dropIn', `@keyframes cap-dropin{0%{transform:translateY(-1.1em);opacity:0}100%{transform:translateY(0);opacity:1}}`],
];

const missingCss = [
  ['slam', 'cap-slam 200ms cubic-bezier(0.2,0.9,0.3,1.3)'],
  ['typewriter', 'cap-typewriter 160ms ease'],
  ['blurPop', 'cap-blurpop 220ms ease-out'],
  ['neonPulse', 'cap-neonpulse 220ms ease-out'],
  ['zoomSnap', 'cap-zoomsnap 180ms cubic-bezier(0.2,0.9,0.3,1.2)'],
  ['dropIn', 'cap-dropin 200ms cubic-bezier(0.2,0.9,0.3,1.2)'],
];

// Insert keyframes before default: return ''
if (!s.includes("case 'slam':")) {
  // in captionAnimKeyframes
  const kfFn = s.indexOf('export function captionAnimKeyframes');
  const def = s.indexOf("default:\n      return '';", kfFn);
  if (def > 0) {
    let block = '';
    for (const [name, kf] of missingKf) {
      if (!s.includes(`case '${name}':`)) {
        block += `    case '${name}':\n      return \`${kf}\`;\n`;
      }
    }
    // also ensure tilt3d etc exist
    const extras = [
      ['tilt3d', `@keyframes cap-tilt3d{0%{transform:perspective(500px) rotateY(55deg) scale(0.85);opacity:0}100%{transform:perspective(500px) rotateY(0) scale(1);opacity:1}}`],
      ['outlineFill', `@keyframes cap-outlinefill{0%{-webkit-text-stroke:2px currentColor;color:transparent;opacity:.5}100%{-webkit-text-stroke:0;color:currentColor;opacity:1}}`],
      ['dualTone', `@keyframes cap-dualtone{0%{opacity:.6}100%{opacity:1}}`],
      ['motionTrail', `@keyframes cap-motiontrail{0%{transform:translateX(-0.2em);opacity:.3;filter:blur(2px)}100%{transform:none;opacity:1;filter:blur(0)}}`],
      ['tickUp', `@keyframes cap-tickup{0%{transform:translateY(0.4em);opacity:0}100%{transform:translateY(0);opacity:1}}`],
    ];
    for (const [name, kf] of extras) {
      if (!s.includes(`case '${name}':`)) {
        block += `    case '${name}':\n      return \`${kf}\`;\n`;
      }
    }
    s = s.slice(0, def) + block + s.slice(def);
    console.log('keyframes cases added');
  }
}

// captionAnimCss
if (!s.includes("case 'slam':\n      return 'cap-slam")) {
  const cssFn = s.indexOf('export function captionAnimCss');
  const def = s.indexOf("default:\n      return '';", cssFn);
  if (def > 0) {
    let block = '';
    for (const [name, css] of missingCss) {
      if (!s.includes(`case '${name}':\n      return 'cap-`)) {
        block += `    case '${name}':\n      return '${css}';\n`;
      }
    }
    const extras = [
      ['tilt3d', 'cap-tilt3d 220ms cubic-bezier(0.2,0.9,0.3,1.2)'],
      ['outlineFill', 'cap-outlinefill 220ms ease-out'],
      ['dualTone', 'cap-dualtone 200ms ease'],
      ['motionTrail', 'cap-motiontrail 200ms ease-out'],
      ['tickUp', 'cap-tickup 180ms cubic-bezier(0.2,0.9,0.3,1.2)'],
    ];
    for (const [name, css] of extras) {
      if (!s.includes(`case '${name}':\n      return 'cap-`)) {
        block += `    case '${name}':\n      return '${css}';\n`;
      }
    }
    s = s.slice(0, def) + block + s.slice(def);
    console.log('css cases added');
  }
}

fs.writeFileSync(p, s);

// verify all anims
const m = s.match(/export const CAPTION_ANIMS[\s\S]*?\];/);
console.log(m ? m[0].slice(0, 200) : 'no anims');

execSync('node scripts/sync-vendored-captions.cjs', { cwd: root, stdio: 'inherit' });
execSync(
  'pnpm exec vitest run tests/lib/caption-presets.test.ts tests/lib/caption-preset-round-trip.test.ts tests/lib/render-vendor-parity.test.ts tests/lib/caption-vendor-parity.test.ts',
  { cwd: root, stdio: 'inherit' },
);
console.log('KEYFRAMES OK');
