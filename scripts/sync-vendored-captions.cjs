#!/usr/bin/env node
/**
 * Sync the render worker's VENDORED copies of the caption/render modules.
 *
 * WHY THIS EXISTS
 * ---------------
 * `render-worker/Dockerfile` does a plain `COPY . ./` with render-worker/ as the
 * build context, so the Remotion bundle Railway builds cannot reach up into the
 * Next app. Every module the worker's composition needs therefore exists twice:
 *
 *   src/lib/mothermode/reel/captions.ts               <- the app (canonical)
 *   render-worker/src/lib/mothermode/reel/captions.ts <- the VENDORED copy
 *   ... and one row per file in FILES below.
 *
 * `render-worker/remotion-project/*` imports `'../src/lib/...'`, which resolves
 * to the VENDORED copy — NOT the app's. So every burned MP4 is produced by the
 * vendored files; the app files only ever drive the editor preview.
 *
 * That makes drift SILENT and RENDER-PATH-ONLY: the preview looks right, the
 * tests (which import the app files via `@/`) pass, and the MP4 is wrong. It has
 * bitten repeatedly — the truthy `wordSpacing` gate plus the missing
 * `whiteSpace`; a stale `captionRows` pinning the highlight to the top row; a
 * `plan.ts` missing the `fonts` field; and worst of all TWO hand-written caption
 * layers whose stage-width divisors disagreed (390 vs 360), which changed the
 * font size, which changed where rows wrapped, which moved the whole caption
 * block in the export. That last one is why captionLayer.tsx is on this list
 * instead of being a second component: there is now ONE caption layer, copied by
 * this script and checked by CI.
 *
 * THE INVARIANT
 * -------------
 * Each vendored file is a LITERAL copy — byte-for-byte. That is stronger than
 * "the two produce the same output", and it costs nothing to enforce, so it
 * catches drift in every export for free.
 *
 * Do NOT hand-edit the vendored files. Edit the app file, then run this script.
 *
 * USAGE
 *   node scripts/sync-vendored-captions.cjs          # copy app -> vendored
 *   node scripts/sync-vendored-captions.cjs --check  # verify only, exit 1 on drift
 *
 * `tests/lib/render-vendor-parity.test.ts` enforces the same invariant in CI.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

/**
 * Every module the worker vendors, as repo-relative paths. Add a row whenever a
 * new file is imported by render-worker/remotion-project/* from '../src/...'.
 * A vendored file with no row here is unguarded, which is how plan.ts drifted.
 */
const FILES = [
  'src/lib/mothermode/reel/captions.ts',
  // plan.ts imports ReelMediaCueStyle/ReelProject/ReelWord from '../types' —
  // the vendored plan resolves that to the vendored types.ts, so it must be
  // a literal copy too (cue style/holdSec fields live there).
  'src/lib/mothermode/reel/types.ts',
  // plan.ts imports transitionOverlapSec from '../timeline' (the seam-overlap
  // math every transition rides on) — vendored plan → vendored timeline.
  'src/lib/mothermode/reel/timeline.ts',
  'src/lib/mothermode/reel/render/plan.ts',
  // The ONE caption layer, shared by the preview composition and the worker's.
  'src/lib/mothermode/reel/render/captionLayer.tsx',
];

/** app path -> vendored path (the worker mirrors the app's src/ tree). */
const vendoredPathFor = (appRel) => path.join('render-worker', appRel);

const abs = (rel) => path.join(ROOT, rel);

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
  let drifted = 0;
  let synced = 0;

  for (const appRel of FILES) {
    const workerRel = vendoredPathFor(appRel);

    if (!fs.existsSync(abs(appRel))) {
      console.error(`[sync-vendored-captions] missing source: ${appRel}`);
      process.exit(1);
    }

    const source = fs.readFileSync(abs(appRel), 'utf8');
    const vendored = fs.existsSync(abs(workerRel))
      ? fs.readFileSync(abs(workerRel), 'utf8')
      : null;

    if (vendored === source) {
      console.log(`[sync-vendored-captions] in sync — ${workerRel}`);
      continue;
    }

    const line = vendored === null ? 1 : firstDiffLine(source, vendored);

    if (check) {
      drifted += 1;
      console.error(`[sync-vendored-captions] DRIFT: ${workerRel}`);
      console.error(`  canonical: ${appRel}`);
      console.error(`  vendored:  ${vendored === null ? '(missing)' : workerRel}`);
      console.error(`  first difference at line ${line}`);
      continue;
    }

    fs.mkdirSync(path.dirname(abs(workerRel)), { recursive: true });
    fs.writeFileSync(abs(workerRel), source, 'utf8');
    synced += 1;
    console.log(`[sync-vendored-captions] synced ${appRel} -> ${workerRel}`);
    console.log(`  (was ${vendored === null ? 'missing' : `drifted from line ${line}`})`);
  }

  if (check && drifted > 0) {
    console.error('');
    console.error(`  ${drifted} vendored file(s) drifted.`);
    console.error('  The vendored copies are what Railway builds and what produce every MP4.');
    console.error('  Edit the app file, then run: node scripts/sync-vendored-captions.cjs');
    process.exit(1);
  }

  if (!check) {
    console.log(`[sync-vendored-captions] done — ${synced} written, ${FILES.length} tracked.`);
  }
}

main();
