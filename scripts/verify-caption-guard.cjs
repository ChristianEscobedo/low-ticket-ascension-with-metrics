#!/usr/bin/env node
/**
 * Mutation-tests the vendored caption guard (tests/lib/caption-vendor-parity.test.ts).
 *
 * WHY THIS EXISTS
 * ---------------
 * A guard test that has only ever been seen GREEN is not evidence of anything.
 * It could be asserting on the wrong file, matching a substring that is always
 * present, or silently passing because `read()` returned the canonical copy.
 * The failure mode it defends against (vendored caption drift) is invisible in
 * preview and in every other test, so a broken guard would restore exactly the
 * blindness it was written to remove.
 *
 * This script reintroduces the two real defects — the truthy `wordSpacing` gate
 * and the missing `whiteSpace` — into the vendored copy, asserts the guard goes
 * RED, then restores the file. The restore runs in a `finally`, so an exception
 * or a failed assertion still leaves the working tree clean.
 *
 * Usage:  node scripts/verify-caption-guard.cjs
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const VENDORED = path.join(ROOT, 'render-worker', 'src', 'lib', 'mothermode', 'reel', 'captions.ts');
const TEST = 'tests/lib/caption-vendor-parity.test.ts';

const WORD_SPACING_FIXED = 'wordSpacing: `${def.wordSpacingEm ?? 0}em`';
const WORD_SPACING_BROKEN =
  '...(def.wordSpacingEm ? { wordSpacing: `${def.wordSpacingEm}em` } : {})';
const WHITE_SPACE = "whiteSpace: 'pre-wrap',";

/**
 * Runs the guard and returns true when it PASSES.
 *
 * `shell: true` is required: on Windows the runner is `npx.cmd`, and Node >= 20
 * refuses to spawn a `.cmd` without a shell (EINVAL). Without it every run
 * "fails", which would make the mutations below look detected when nothing had
 * actually been checked — a harness that lies in the safe-looking direction.
 * So distinguish "the test ran and failed" from "the test never ran".
 */
function runGuard() {
  const res = spawnSync('npx', ['vitest', 'run', TEST, '--reporter=dot'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
  });

  if (res.error) {
    throw new Error(`could not run vitest: ${res.error.message}`);
  }
  // Vitest exits 0 (pass) or 1 (test failures). Anything else — a crash, a
  // missing file, a config error — means we learned nothing.
  if (res.status !== 0 && res.status !== 1) {
    throw new Error(
      `vitest exited with ${res.status}, so the guard never really ran.\n` +
        `${res.stdout ?? ''}\n${res.stderr ?? ''}`,
    );
  }
  return res.status === 0;
}


const original = fs.readFileSync(VENDORED, 'utf8');
let failures = 0;

function check(label, expected, actual) {
  const ok = expected === actual;
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) console.log(`        expected guard ${expected ? 'GREEN' : 'RED'}, got ${actual ? 'GREEN' : 'RED'}`);
}

try {
  console.log('\nMutation-testing the vendored caption guard\n');

  // Baseline. If this is not green the repo is already drifted and every
  // result below would be meaningless.
  check('guard is GREEN on the real, synced tree', true, runGuard());
  if (failures) throw new Error('baseline is not green — fix drift before trusting this script');

  // Defect 1: the truthy gate that drops wordSpacing at 0em.
  if (!original.includes(WORD_SPACING_FIXED)) {
    throw new Error(`could not find the fixed wordSpacing line to mutate:\n  ${WORD_SPACING_FIXED}`);
  }
  fs.writeFileSync(VENDORED, original.replace(WORD_SPACING_FIXED, WORD_SPACING_BROKEN));
  check('guard goes RED when the truthy wordSpacing gate returns', false, runGuard());

  // Defect 2: the missing whiteSpace that lets inline-block trim the spaces.
  if (!original.includes(WHITE_SPACE)) {
    throw new Error(`could not find a whiteSpace declaration to remove:\n  ${WHITE_SPACE}`);
  }
  fs.writeFileSync(VENDORED, original.replace(WHITE_SPACE, ''));
  check('guard goes RED when a whiteSpace declaration is dropped', false, runGuard());

  // Defect 3: drift the guard was NOT explicitly told about. This is the real
  // test of byte-identity — the last drift was in an export nobody had named.
  fs.writeFileSync(VENDORED, `${original}\nexport const DRIFT = 1;\n`);
  check('guard goes RED on unnamed drift (byte-identity, not just the 2 known bugs)', false, runGuard());
} finally {
  fs.writeFileSync(VENDORED, original);
  const restored = fs.readFileSync(VENDORED, 'utf8') === original;
  console.log(`\n  ${restored ? 'restored' : 'FAILED TO RESTORE'} ${path.relative(ROOT, VENDORED)}`);
  if (!restored) process.exitCode = 1;
}

console.log(failures === 0 ? '\nGuard verified: it fails when it should.\n' : `\n${failures} check(s) failed.\n`);
if (failures > 0) process.exitCode = 1;
