import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The editor stage must draw captions with THE render layer — never a look-alike.
 *
 * THE BUG THIS GUARDS
 * -------------------
 * "The MP4's captions don't match what I see" survived two rounds of unifying the
 * Remotion caption layers, because there were THREE implementations, not two, and
 * the third was the one on screen. Which one you were looking at depended on the
 * stage's Remotion / Edit toggle:
 *
 *   Remotion stage → remotion-project/CaptionLayer.tsx        → CaptionLayerFrame
 *   MP4 (worker)   → render-worker/remotion-project/...       → CaptionLayerFrame
 *   Edit stage     → `KaraokeLine`, local to reel-studio/page.tsx  ← the third copy
 *
 * `KaraokeLine` shared only `captionCssFor()` with the render and diverged in
 * every way that changes what you see: raw `layout.sizePx` with no
 * `/ CAPTION_STAGE_W * frameWidth` scale, a `w-max` chip instead of the 86%
 * centred block (so text wrapped at a different width → different line breaks),
 * clip-local active-word selection held forever, and `opacity-70` on idle rows.
 *
 * The Edit stage now renders `StageCaptions`, a thin seconds→frames wrapper over
 * `CaptionLayerFrame`. `KaraokeLine` survives ONLY for the decorative
 * platform-mock swatches inside the fake phone frames, which are not video
 * frames. Hence the occurrence count below: exactly one JSX use site. A second
 * one means copy #4 is back on a video frame, which is the whole bug.
 *
 * Text-matching rather than rendering: page.tsx is a 7k-line client component
 * with the entire studio's state in it, so mounting it to inspect the caption DOM
 * would test the harness more than the invariant. Counting use sites is crude and
 * honest, and it fails for exactly the reason we care about.
 */
const ROOT = join(__dirname, '..', '..');
const STAGE = join(ROOT, 'src', 'app', '(fullscreen)', 'admin', 'reel-studio', 'page.tsx');

const src = readFileSync(STAGE, 'utf8');

/** Source with comments stripped — prose about the bug must stay legal. */
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('the editor stage draws captions with the render layer', () => {
  it('imports the shared caption layer', () => {
    expect(code).toContain('CaptionLayerFrame');
    expect(code).toContain('@/lib/mothermode/reel/render/captionLayer');
  });

  it('has StageCaptions delegate to CaptionLayerFrame', () => {
    expect(code).toMatch(/function StageCaptions/);
    // The wrapper's whole job: convert the stage's seconds to the layer's frames
    // and hand over the real component. If it stopped rendering the layer it
    // would be a fourth implementation wearing the right name.
    const wrapper = code.slice(code.indexOf('function StageCaptions'));
    expect(wrapper).toContain('<CaptionLayerFrame');
  });

  it('renders StageCaptions on the Edit-mode stage', () => {
    expect(countOccurrences(code, '<StageCaptions')).toBeGreaterThanOrEqual(1);
  });

  it('uses KaraokeLine exactly once — the platform-mock swatch, never a video frame', () => {
    // THE tripwire. One use site = the decorative chip in PlatformMockView.
    // Two = someone put the look-alike back on a stage or a preview.
    expect(countOccurrences(code, '<KaraokeLine')).toBe(1);
  });

  it('does not let the stage compute its own caption font size or block width', () => {
    // These are the specific divergences that made the render disagree. They
    // belong to CaptionLayerFrame; the only file-local `layout.sizePx` left is
    // KaraokeLine's, inside the platform mock.
    expect(countOccurrences(code, 'layout.sizePx')).toBe(1);
    expect(code).not.toContain('CAPTION_STAGE_W');
  });
});
