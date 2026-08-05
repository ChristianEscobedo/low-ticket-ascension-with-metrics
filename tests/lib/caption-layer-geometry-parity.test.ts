import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * There must be exactly ONE caption layer, and the two compositions must both
 * defer to it.
 *
 * THE BUG THIS GUARDS
 * -------------------
 * There were two full copies of the caption layer — `remotion-project/` (what
 * the studio previews with) and `render-worker/remotion-project/` (what the
 * worker renders, vendored so the Docker image is self-contained) — and nothing
 * forced them to agree. They silently didn't:
 *
 *   preview:  fontSize = (layout.sizePx / 390) * plan.width
 *   worker:   fontSize = (layout.sizePx / 360) * plan.width
 *
 * An 8.3% font-size difference. Font size drives text width, text width drives
 * where rows wrap, so the caption block sat differently and broke across
 * different words in the MP4 than on the stage — the "alignment is different in
 * the render" bug, chased for multiple sessions inside the caption *styles*
 * where it never lived.
 *
 * WHY THIS TEST CHANGED SHAPE
 * ---------------------------
 * The first version of this file compared the two layers' geometry numbers to
 * each other. That is strictly better than the older `caption-vendor-parity`
 * test (which compared `captionCssFor` to `captionCssFor` — the same function on
 * both sides of a file copy, structurally incapable of seeing this class of
 * drift). But "two implementations that currently agree" is still two
 * implementations. The layer now lives in one module,
 * src/lib/mothermode/reel/render/captionLayer.tsx, and each composition is a
 * wrapper that supplies `useCurrentFrame()`.
 *
 * So the invariant worth defending moved: not "the numbers match" but "there is
 * only one place the numbers can be". This test asserts that
 *   1. the shared layer owns the geometry, and pins the 360px stage;
 *   2. neither wrapper re-implements any of it.
 * Byte-identity of the vendored copy of the shared file is enforced separately,
 * by tests/lib/render-vendor-parity.test.ts.
 *
 * Text-matching is deliberate: the worker copy is a separate module graph (its
 * imports resolve inside the worker tree, which the app tsconfig excludes), so
 * importing both and comparing behaviour would need a bundler. Reading the
 * source is crude and honest.
 */
const ROOT = join(__dirname, '..', '..');
const SHARED = join(ROOT, 'src', 'lib', 'mothermode', 'reel', 'render', 'captionLayer.tsx');
const PREVIEW_WRAPPER = join(ROOT, 'remotion-project', 'CaptionLayer.tsx');
const WORKER_WRAPPER = join(ROOT, 'render-worker', 'remotion-project', 'CaptionLayer.tsx');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

/**
 * The divisor that maps editor-stage px to frame px. Matches either
 * `CAPTION_STAGE_W = 360` or an inline `/ 360` in the fontSize expression, so
 * the test still works whichever shape the file is written in.
 */
function stageWidth(src: string): number {
  const named = src.match(/CAPTION_STAGE_W\s*=\s*(\d+)/);
  if (named) return Number(named[1]);
  const inline = src.match(/layout\.sizePx\s*\/\s*(\d+)\s*\)/);
  if (inline) return Number(inline[1]);
  throw new Error('No stage-width divisor found — the fontSize math was rewritten.');
}

/** The caption block's own box: these decide where text wraps and sits. */
function boxGeometry(src: string) {
  return {
    width: src.match(/width:\s*'([^']+)'/)?.[1] ?? null,
    gap: src.match(/gap:\s*'([^']+)'/)?.[1] ?? null,
    // bottom-anchored + centered by transform: the anchor model itself.
    bottomAnchored: /bottom:\s*`\$\{layout\.positionPct\}%`/.test(src),
    leftFromXPct: /left:\s*`\$\{layout\.xPct\}%`/.test(src),
    centeredX: /translateX\(-50%\)/.test(src),
    alignItems: src.match(/alignItems:\s*'([^']+)'/)?.[1] ?? null,
  };
}

const SHARED_IMPORT = '../src/lib/mothermode/reel/render/captionLayer';

/**
 * Strip comments before checking a wrapper for geometry. Both wrappers document
 * the 390-vs-360 bug in prose, and prose is exactly what we want future readers
 * to keep — only executable code should fail these checks.
 */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}


describe('one caption layer, two wrappers', () => {
  const shared = read(SHARED);
  const preview = read(PREVIEW_WRAPPER);
  const worker = read(WORKER_WRAPPER);

  it('scales sizePx by the 360px editor stage, in the shared layer', () => {
    // Pinned, not merely "equal on both sides": sizePx is authored against the
    // 360px stage, so if the number drifted the captions would be wrong in both
    // the preview AND the export — consistently wrong, which is harder to spot.
    expect(stageWidth(shared)).toBe(360);
  });

  it('keeps the anchor and block sizing in the shared layer', () => {
    // width/gap/anchor all feed wrapping and placement. Any one of them living
    // in a wrapper instead of here reproduces "it looks right in the preview".
    expect(boxGeometry(shared)).toEqual({
      width: '86%',
      gap: '0.15em',
      bottomAnchored: true,
      leftFromXPct: true,
      centeredX: true,
      alignItems: 'center',
    });
  });

  it('has both compositions import that single layer', () => {
    for (const [name, src] of [
      ['preview', preview],
      ['worker', worker],
    ] as const) {
      expect(src.includes(SHARED_IMPORT), `${name} wrapper must import ${SHARED_IMPORT}`).toBe(
        true,
      );
      expect(src.includes('CaptionLayerFrame'), `${name} wrapper must render the shared layer`).toBe(
        true,
      );
    }
  });

  it('has neither wrapper re-implement any geometry', () => {
    // This is the actual guard against the original bug: a wrapper that grows a
    // fontSize calculation, a stage width, or a positioning style has become a
    // second implementation again, and the two can then disagree.
    for (const [name, src] of [
      ['preview', code(preview)],
      ['worker', code(worker)],
    ] as const) {
      expect(/layout\.sizePx/.test(src), `${name} wrapper computes its own font size`).toBe(false);
      expect(/\b(360|390)\b/.test(src), `${name} wrapper hardcodes a stage width`).toBe(false);
      expect(/position:\s*'absolute'/.test(src), `${name} wrapper positions the block`).toBe(false);
      expect(/translateX\(-50%\)/.test(src), `${name} wrapper anchors the block`).toBe(false);
    }

  });
});
