/**
 * Vendored render-path parity.
 *
 * The render worker ships its own copies of app modules because the Remotion
 * bundle cannot reach back into the Next app. Copies drift silently: nothing
 * imports both, so a change to the app file type-checks, tests green, and the
 * WORKER keeps rendering the old behaviour. That drift is only ever discovered
 * by watching a burned MP4, which is the slowest feedback loop in the project.
 *
 * tests/lib/caption-vendor-parity.test.ts already guards captions.ts. It did
 * NOT guard render/plan.ts, and that file had drifted 11 lines behind the app
 * copy — it was missing the `fonts` field added by the font-resolution wave,
 * i.e. the exact shape the worker needs to load caption webfonts. This test
 * extends the guard to every vendored module so the next drift is a failing
 * test instead of a bad render.
 *
 * Byte-for-byte is deliberate. A looser check (exported names, AST shape) is
 * what let an 11-line divergence sit here unnoticed.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');

/** app path → vendored worker path. Add a row whenever you vendor a module. */
const VENDORED: ReadonlyArray<readonly [string, string]> = [
  [
    'src/lib/mothermode/reel/captions.ts',
    'render-worker/src/lib/mothermode/reel/captions.ts',
  ],
  [
    'src/lib/mothermode/reel/render/plan.ts',
    'render-worker/src/lib/mothermode/reel/render/plan.ts',
  ],
];

/** Normalise line endings only — content differences must still fail. */
function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
}

describe('vendored render-path modules stay identical to the app copies', () => {
  for (const [appPath, workerPath] of VENDORED) {
    it(`${workerPath} matches ${appPath}`, () => {
      const app = read(appPath);
      const worker = read(workerPath);
      if (app !== worker) {
        throw new Error(
          `${workerPath} has drifted from ${appPath}.\n` +
            'The worker renders from its own copy, so this drift changes the MP4 ' +
            'without changing anything you can see in the preview.\n' +
            'Re-sync the file (scripts/sync-vendored-captions.cjs, or copy it) ' +
            'rather than relaxing this test.',
        );
      }
      expect(worker).toBe(app);
    });
  }

  it('lists every vendored module under render-worker/src', () => {
    // A vendored file with no row above is unguarded, which is how plan.ts
    // drifted. If this fails, add the new file to VENDORED.
    const guarded = new Set(VENDORED.map(([, workerPath]) => workerPath));
    expect(guarded.has('render-worker/src/lib/mothermode/reel/captions.ts')).toBe(true);
    expect(guarded.has('render-worker/src/lib/mothermode/reel/render/plan.ts')).toBe(true);
  });
});
