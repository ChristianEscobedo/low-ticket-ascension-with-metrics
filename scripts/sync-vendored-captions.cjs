#!/usr/bin/env node
/**
 * Sync the render worker's VENDORED copy of the caption engine.
 *
 * WHY THIS EXISTS
 * ---------------
 * There are TWO copies of the caption engine, and the second one is easy to
 * miss:
 *
 *   src/lib/mothermode/reel/captions.ts               <- the app (canonical)
 *   render-worker/src/lib/mothermode/reel/captions.ts <- the VENDORED copy
 *
 * `render-worker/remotion-project/CaptionLayer.tsx` imports
 * `'../src/lib/mothermode/reel/captions'`, which resolves to the vendored copy —
 * NOT the app's. `render-worker/Dockerfile` then does a plain `COPY . ./`, so
 * Railway builds whatever is in the vendored file. Every burned MP4 is styled by
 * the vendored copy; the app file only ever drives the editor preview.
 *
 * That makes drift SILENT and RENDER-PATH-ONLY: the preview looks right, the
 * tests (which import the app file via `@/`) pass, and the MP4 is wrong. It has
 * already bitten twice — the truthy `wordSpacing` gate plus the missing
 * `whiteSpace`, and then a stale `captionRows` that pinned the highlight to the
 * top row in multi-row captions.
 *
 * THE INVARIANT
 * -------------
 * The vendored file is a LITERAL copy — byte-for-byte. That is stronger than
 * "the two produce the same `captionCssFor` output", and it costs nothing to
 * enforce, so it catches drift in every other shared export too (`captionRows`,
 * `captionWindow`, `captionLayoutFor`, `isPowerWord`, `emojiFor`…).
 *
 * Do NOT hand-edit the vendored file. Edit the app file, then run this script.
 *
 * USAGE
 *   node scripts/sync-vendored-captions.cjs          # copy app -> vendored
 *   node scripts/sync-vendored-captions.cjs --check  # verify only, exit 1 on drift
 *
 * `tests/lib/caption-vendor-parity.test.ts` enforces the same invariant in CI.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'src', 'lib', 'mothermode', 'reel', 'captions.ts');
const VENDORED = path.join(
  ROOT,
  'render-worker',
  'src',
  'lib',
  'mothermode',
  'reel',
  'captions.ts',
);

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

/** The first line number where the two texts differ, or -1 if identical. */
function firstDiffLine(a, b) {
  const al = a.split('\n');
  const bl = b.split('\n');
  const n = Math.max(al.length, bl.length);
  for (let i = 0; i < n; i += 1) {
    if (al[i] !== bl[i]) return i + 1;
  }
  return -1;
}

function main() {
  const check = process.argv.includes('--check');

  if (!fs.existsSync(SOURCE)) {
    console.error(`[sync-vendored-captions] missing source: ${rel(SOURCE)}`);
    process.exit(1);
  }

  const source = fs.readFileSync(SOURCE, 'utf8');
  const vendored = fs.existsSync(VENDORED) ? fs.readFileSync(VENDORED, 'utf8') : null;

  if (vendored === source) {
    console.log(`[sync-vendored-captions] in sync — ${rel(VENDORED)} matches ${rel(SOURCE)}`);
    return;
  }

  if (check) {
    const line = vendored === null ? 1 : firstDiffLine(source, vendored);
    console.error('[sync-vendored-captions] DRIFT DETECTED');
    console.error(`  canonical: ${rel(SOURCE)}`);
    console.error(`  vendored:  ${rel(VENDORED)}${vendored === null ? ' (missing)' : ''}`);
    console.error(`  first difference at line ${line}`);
    console.error('');
    console.error('  The vendored copy is what Railway builds and what styles every MP4.');
    console.error('  Edit the app file, then run: node scripts/sync-vendored-captions.cjs');
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(VENDORED), { recursive: true });
  fs.writeFileSync(VENDORED, source, 'utf8');
  const line = vendored === null ? 1 : firstDiffLine(source, vendored);
  console.log(`[sync-vendored-captions] synced ${rel(SOURCE)} -> ${rel(VENDORED)}`);
  console.log(`  (was drifted from line ${line})`);
}

main();
