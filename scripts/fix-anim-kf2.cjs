#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const p = path.join(root, 'src/lib/mothermode/reel/captions.ts');
let s = fs.readFileSync(p, 'utf8');

const NEW_CASES_KF = `
    case 'slam':
      return \`@keyframes cap-slam{0%{transform:translateY(-0.55em) scale(1.55);opacity:0}100%{transform:translateY(0) scale(1);opacity:1}}\`;
    case 'typewriter':
      return \`@keyframes cap-typewriter{0%{opacity:0}100%{opacity:1}}\`;
    case 'blurPop':
      return \`@keyframes cap-blurpop{0%{filter:blur(8px);transform:scale(0.85);opacity:0}100%{filter:blur(0);transform:scale(1);opacity:1}}\`;
    case 'neonPulse':
      return \`@keyframes cap-neonpulse{0%{opacity:.6;transform:scale(0.96)}100%{opacity:1;transform:scale(1)}}\`;
    case 'zoomSnap':
      return \`@keyframes cap-zoomsnap{0%{transform:scale(0.4);opacity:0}100%{transform:scale(1);opacity:1}}\`;
    case 'dropIn':
      return \`@keyframes cap-dropin{0%{transform:translateY(-1.1em);opacity:0}100%{transform:translateY(0);opacity:1}}\`;
    case 'tilt3d':
      return \`@keyframes cap-tilt3d{0%{transform:perspective(500px) rotateY(55deg) scale(0.85);opacity:0}100%{transform:perspective(500px) rotateY(0) scale(1);opacity:1}}\`;
    case 'outlineFill':
      return \`@keyframes cap-outlinefill{0%{-webkit-text-stroke:2px currentColor;color:transparent;opacity:.5}100%{-webkit-text-stroke:0;color:currentColor;opacity:1}}\`;
    case 'dualTone':
      return \`@keyframes cap-dualtone{0%{opacity:.6}100%{opacity:1}}\`;
    case 'motionTrail':
      return \`@keyframes cap-motiontrail{0%{transform:translateX(-0.2em);opacity:.3;filter:blur(2px)}100%{transform:none;opacity:1;filter:blur(0)}}\`;
    case 'tickUp':
      return \`@keyframes cap-tickup{0%{transform:translateY(0.4em);opacity:0}100%{transform:translateY(0);opacity:1}}\`;
`;

const NEW_CASES_CSS = `
    case 'slam':
      return 'cap-slam 200ms cubic-bezier(0.2,0.9,0.3,1.3)';
    case 'typewriter':
      return 'cap-typewriter 160ms ease';
    case 'blurPop':
      return 'cap-blurpop 220ms ease-out';
    case 'neonPulse':
      return 'cap-neonpulse 220ms ease-out';
    case 'zoomSnap':
      return 'cap-zoomsnap 180ms cubic-bezier(0.2,0.9,0.3,1.2)';
    case 'dropIn':
      return 'cap-dropin 200ms cubic-bezier(0.2,0.9,0.3,1.2)';
    case 'tilt3d':
      return 'cap-tilt3d 220ms cubic-bezier(0.2,0.9,0.3,1.2)';
    case 'outlineFill':
      return 'cap-outlinefill 220ms ease-out';
    case 'dualTone':
      return 'cap-dualtone 200ms ease';
    case 'motionTrail':
      return 'cap-motiontrail 200ms ease-out';
    case 'tickUp':
      return 'cap-tickup 180ms cubic-bezier(0.2,0.9,0.3,1.2)';
`;

// Patch captionAnimKeyframes: find cascade case then default within that function
{
  const fnStart = s.indexOf('export function captionAnimKeyframes');
  const fnEnd = s.indexOf('export function captionAnimCss');
  const body = s.slice(fnStart, fnEnd);
  if (!body.includes("case 'slam':")) {
    // insert before default in this function only
    const rel = body.lastIndexOf("default:\n      return '';");
    if (rel < 0) {
      console.error('no default in keyframes');
      process.exit(1);
    }
    const abs = fnStart + rel;
    s = s.slice(0, abs) + NEW_CASES_KF + s.slice(abs);
    console.log('keyframes patched');
  } else {
    console.log('keyframes already have slam');
  }
}

// Patch captionAnimCss
{
  const fnStart = s.indexOf('export function captionAnimCss');
  const fnEnd = s.indexOf('export const CAPTION_ANIMS');
  const body = s.slice(fnStart, fnEnd);
  if (!body.includes("case 'slam':")) {
    const rel = body.lastIndexOf("default:\n      return '';");
    if (rel < 0) {
      console.error('no default in css');
      process.exit(1);
    }
    const abs = fnStart + rel;
    s = s.slice(0, abs) + NEW_CASES_CSS + s.slice(abs);
    console.log('css patched');
  } else {
    console.log('css already have slam');
  }
}

fs.writeFileSync(p, s);

// quick check
const a = s.indexOf('export function captionAnimKeyframes');
const b = s.indexOf('export function captionAnimCss');
console.log('slam in kf', s.slice(a, b).includes("case 'slam'"));
console.log('slam in css', s.slice(b, s.indexOf('export const CAPTION_ANIMS')).includes("case 'slam'"));

execSync('node scripts/sync-vendored-captions.cjs', { cwd: root, stdio: 'inherit' });
execSync(
  'pnpm exec vitest run tests/lib/caption-presets.test.ts tests/lib/caption-preset-round-trip.test.ts tests/lib/render-vendor-parity.test.ts tests/lib/caption-vendor-parity.test.ts',
  { cwd: root, stdio: 'inherit' },
);
console.log('OK');
