import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * GUARD: the render worker's vendored caption engine must not drift.
 *
 * There are two copies of the caption engine:
 *
 *   src/lib/mothermode/reel/captions.ts               <- canonical (editor preview)
 *   render-worker/src/lib/mothermode/reel/captions.ts <- vendored   (burned MP4)
 *
 * `render-worker/remotion-project/CaptionLayer.tsx` imports
 * `'../src/lib/mothermode/reel/captions'` — that relative specifier resolves to
 * the VENDORED copy, not the app's. `render-worker/Dockerfile` then does a plain
 * `COPY . ./`, so Railway builds the vendored copy verbatim.
 *
 * Consequence: caption drift is SILENT and RENDER-PATH-ONLY. The preview looks
 * correct, every other test in this suite passes (they all import the app file
 * through `@/`), and only the MP4 is wrong. Nobody finds out until they watch
 * the export. This has already happened twice.
 *
 * WHY BYTE-IDENTITY RATHER THAN "SAME captionCssFor OUTPUT"
 * ---------------------------------------------------------
 * Comparing `captionCssFor` output would only cover the one export we happened
 * to think of — the last drift was in `captionRows`, which `captionCssFor`
 * never touches. Byte-identity subsumes an output comparison and covers every
 * other shared export for free.
 *
 * WHY THIS TEST READS FILES INSTEAD OF IMPORTING THEM
 * ---------------------------------------------------
 * It would be more natural to import both modules and compare results, but the
 * vendored copy cannot be imported from here: `tsconfig.json` excludes
 * `render-worker`, and the vendored file's `import ... from './types'` has no
 * sibling `types.ts` inside the worker tree (it resolves at Docker build time
 * against the worker's own tsconfig). A static import would resolve the file
 * into the app's TS program and fail `next build` with TS2307. Reading the text
 * keeps the guard honest without dragging the worker tree into the app build.
 */

const ROOT = path.resolve(__dirname, '..', '..');
const CANONICAL = path.join(ROOT, 'src', 'lib', 'mothermode', 'reel', 'captions.ts');
const VENDORED = path.join(
  ROOT,
  'render-worker',
  'src',
  'lib',
  'mothermode',
  'reel',
  'captions.ts',
);

const read = (p: string) => fs.readFileSync(p, 'utf8');

function firstDiff(a: string, b: string) {
  const al = a.split('\n');
  const bl = b.split('\n');
  for (let i = 0; i < Math.max(al.length, bl.length); i += 1) {
    if (al[i] !== bl[i]) {
      return { line: i + 1, canonical: al[i], vendored: bl[i] };
    }
  }
  return null;
}

describe('render worker vendored caption engine', () => {
  it('exists where CaptionLayer.tsx resolves it', () => {
    expect(fs.existsSync(CANONICAL)).toBe(true);
    expect(
      fs.existsSync(VENDORED),
      'render-worker/remotion-project/CaptionLayer.tsx imports ../src/lib/mothermode/reel/captions',
    ).toBe(true);
  });

  it('is byte-identical to the canonical app copy', () => {
    const canonical = read(CANONICAL);
    const vendored = read(VENDORED);
    const diff = firstDiff(canonical, vendored);

    expect(
      diff,
      diff
        ? [
            '',
            'The render worker caption engine has DRIFTED from the app copy.',
            'The vendored file is what Railway builds and what styles every burned MP4,',
            'so this drift is invisible in preview and in every other test.',
            '',
            `  first difference at line ${diff.line}`,
            `  canonical: ${JSON.stringify(diff.canonical)}`,
            `  vendored:  ${JSON.stringify(diff.vendored)}`,
            '',
            'Fix: edit src/lib/mothermode/reel/captions.ts (never the vendored copy), then run',
            '  node scripts/sync-vendored-captions.cjs',
            '',
          ].join('\n')
        : undefined,
    ).toBeNull();
  });

  /**
   * These two regressions are the reason the guard exists, and both lived only
   * in the vendored file. Byte-identity above already covers them, but naming
   * them makes a failure self-explanatory instead of just "line N differs" —
   * and it pins the mechanism so a future edit to the app copy cannot quietly
   * reintroduce either one on the render path.
   */
  describe('regressions that were previously render-path-only', () => {
    it('emits wordSpacing unconditionally, not behind a truthy gate', () => {
      const vendored = read(VENDORED);
      // A truthy gate (`def.wordSpacingEm ? ... : ''`) drops the declaration at
      // 0em, so the browser default wins and a user cannot dial spacing back
      // down to zero. `?? 0` keeps the declaration present at every value.
      expect(vendored).toContain('wordSpacing: `${def.wordSpacingEm ?? 0}em`');
    });


    it('sets whiteSpace on both the word and active styles', () => {
      const vendored = read(VENDORED);
      // Each word renders as its own inline-block for per-word animation, and
      // inline-block collapses/trims the whitespace between elements. Without
      // an explicit whiteSpace, wordSpacing has no space character left to
      // widen — which is exactly why letterSpacing appeared to work while
      // wordSpacing silently did nothing.
      //
      // It must be on BOTH shared styles: the active word carries the pop/scale
      // transform, so if only `word` had it the highlighted word would lose its
      // trailing space and the line would twitch as the highlight moves.
      const occurrences = vendored.split("whiteSpace: 'pre-wrap'").length - 1;
      expect(occurrences, 'expected whiteSpace on both the word and active styles').toBe(2);
    });

  });
});
