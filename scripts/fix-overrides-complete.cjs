#!/usr/bin/env node
/**
 * Sweep captions.ts + CaptionGallery for overrides.X / onCustomize({ X })
 * and ensure every key exists on CaptionOverrides. Then sync vendor + tsc-check.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');

const capsPath = path.join(root, 'src/lib/mothermode/reel/captions.ts');
const galleryPath = path.join(
  root,
  'src/app/(fullscreen)/admin/reel-studio/CaptionGallery.tsx',
);

let caps = fs.readFileSync(capsPath, 'utf8');
const gallery = fs.existsSync(galleryPath)
  ? fs.readFileSync(galleryPath, 'utf8')
  : '';

// Extract CaptionOverrides body
const start = caps.indexOf('export interface CaptionOverrides');
if (start < 0) {
  console.error('CaptionOverrides not found');
  process.exit(1);
}
const brace = caps.indexOf('{', start);
let depth = 0;
let end = -1;
for (let i = brace; i < caps.length; i++) {
  if (caps[i] === '{') depth++;
  else if (caps[i] === '}') {
    depth--;
    if (depth === 0) {
      end = i;
      break;
    }
  }
}
if (end < 0) {
  console.error('could not find end of CaptionOverrides');
  process.exit(1);
}
const body = caps.slice(brace + 1, end);
const existing = new Set(
  [...body.matchAll(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\??:/gm)].map((m) => m[1]),
);
console.log('existing fields', existing.size);

// Collect used keys from overrides.X and onCustomize({ X:
const used = new Set();
const sources = [caps, gallery];
for (const src of sources) {
  for (const m of src.matchAll(/overrides\.([a-zA-Z_][a-zA-Z0-9_]*)/g)) {
    used.add(m[1]);
  }
  for (const m of src.matchAll(/onCustomize\(\{\s*([a-zA-Z_][a-zA-Z0-9_]*)/g)) {
    used.add(m[1]);
  }
  // pack.overrides / Partial patches like { motionTrail: true }
  for (const m of src.matchAll(
    /(?:overrides|patchOv|partial)\s*[:=]\s*\{[^}]{0,400}?([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g,
  )) {
    // too noisy — skip
  }
}

// Also scan resolveCaptionStyle for overrides.X more carefully
const resolveIdx = caps.indexOf('function resolveCaptionStyle');
if (resolveIdx >= 0) {
  const chunk = caps.slice(resolveIdx, resolveIdx + 8000);
  for (const m of chunk.matchAll(/overrides\.([a-zA-Z_][a-zA-Z0-9_]*)/g)) {
    used.add(m[1]);
  }
}

// Known type hints for missing fields (best-effort)
const typeHints = {
  motionTrail: 'boolean',
  outlineFill: 'boolean',
  anim: "CaptionAnim | ''",
  highlightMode: 'HighlightMode',
  waveBounce: 'boolean',
  handDrawn: "false | 'underline' | 'circle'",
  punchIn: 'boolean',
  letterbox: 'boolean',
  springExit: 'boolean',
  blockMotion: "'still' | 'float' | 'wiggle'",
  floatOn: 'boolean',
  wiggleOn: 'boolean',
  floatAmpEm: 'number',
  floatPeriodSec: 'number',
  wiggleDeg: 'number',
  wigglePeriodSec: 'number',
  ghostEase: "'linear' | 'smooth'",
  ghostDriftEm: 'number',
  ghostSyncToWords: 'boolean',
  motionSyncToWords: 'boolean',
  ghostFade: 'boolean',
  dropShadow: 'number',
  outerGlow: '{ strength: number; color?: string }',
  gradientFill:
    "{ colors: [string, string] | [string, string, string]; scope?: 'active' | 'all'; angle?: number; shift?: boolean }",
  ghostFadeInSec: 'number',
  ghostFadeOutSec: 'number',
  ghostStagger: "'block' | 'word' | 'letter'",
  ghostStaggerSec: 'number',
  positionPct: 'number',
  xPct: 'number',
  sizePx: 'number',
  colors: 'string[]',
  wordsPerRow: 'number',
  rows: 'number',
  letterSpacing: 'number',
  wordSpacing: 'number',
  powerWords: 'string[]',
};

const missing = [...used].filter((k) => !existing.has(k)).sort();
console.log('used keys', [...used].sort().join(', '));
console.log('missing', missing.join(', ') || '(none)');

if (missing.length) {
  const nl = caps.includes('\r\n') ? '\r\n' : '\n';
  let insert = '';
  for (const k of missing) {
    const t = typeHints[k] || 'boolean | number | string | object';
    insert += `  /** Auto-added for Vercel tsc (used in resolve/UI). */${nl}`;
    insert += `  ${k}?: ${t};${nl}`;
  }
  // insert before closing brace of interface
  caps = caps.slice(0, end) + insert + caps.slice(end);
  fs.writeFileSync(capsPath, caps);
  console.log('added', missing.length, 'fields');
} else {
  console.log('CaptionOverrides already complete');
}

// Re-read and double-check
caps = fs.readFileSync(capsPath, 'utf8');
const still = [];
for (const k of used) {
  // property must appear as "  key?:" in interface
  if (!new RegExp(`\\b${k}\\?:`).test(caps)) still.push(k);
}
if (still.length) {
  console.error('still missing after write:', still);
  process.exit(1);
}

execSync('node scripts/sync-vendored-captions.cjs', {
  cwd: root,
  stdio: 'inherit',
});

// Typecheck just the captions module via a quick node parse isn't enough —
// run tsc filtered if available
try {
  const out = execSync(
    'pnpm exec tsc --noEmit -p tsconfig.json --pretty false 2>&1',
    { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
  );
  const lines = out
    .split(/\r?\n/)
    .filter((l) => /captions\.ts|CaptionGallery|CaptionOverrides|error TS/.test(l));
  console.log('tsc caption-related lines:', lines.length);
  lines.slice(0, 30).forEach((l) => console.log(l));
  if (lines.some((l) => /error TS/.test(l) && /captions|CaptionGallery/.test(l))) {
    process.exit(1);
  }
} catch (e) {
  const out = String(e.stdout || e.message || e);
  const lines = out
    .split(/\r?\n/)
    .filter((l) => /captions\.ts|CaptionGallery|CaptionOverrides|error TS\d+/.test(l));
  console.log('tsc failed; caption-related:');
  lines.slice(0, 40).forEach((l) => console.log(l));
  // Only fail if captions-related
  if (
    lines.some(
      (l) =>
        /error TS/.test(l) &&
        (/captions\.ts|CaptionGallery/.test(l) || /CaptionOverrides/.test(l)),
    )
  ) {
    process.exit(1);
  }
  console.log('(other tsc errors ignored for this fix)');
}

console.log('OK');
