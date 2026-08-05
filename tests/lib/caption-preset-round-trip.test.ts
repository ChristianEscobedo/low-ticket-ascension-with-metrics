import { describe, expect, it } from 'vitest';
import { CAPTION_STYLE_DEFS, captionDefFor } from '@/lib/mothermode/reel/captions';
import {
  normalizeCaptionPreset,
  normalizeProjectJson,
  projectToJson,
} from '@/lib/mothermode/reel/types';
import { buildRenderPlan } from '@/lib/mothermode/reel/render/plan';

/**
 * Every caption preset must survive the trip from the picker to the renderer.
 *
 * THE BUG THIS GUARDS
 * -------------------
 * `normalizeCaptionPreset` validated against a hand-written four-id set:
 *
 *   new Set(['karaoke', 'beast', 'hormozi', 'minimal'])
 *
 * while `CAPTION_STYLE_DEFS` holds 41 presets. The other 37 — every Hormozi
 * variant, every creator look, every modern animation — failed the check and
 * were silently rewritten to `'karaoke'`.
 *
 * It ran in two places that both matter:
 *   - `projectToJson`, so choosing a preset SAVED karaoke to the database;
 *   - `normalizeProjectJson`, which the render route runs over the posted
 *     project, so the RenderPlan got karaoke too.
 *
 * The studio stage never called it — it reads `captionDefFor(project.captionStyle)`
 * straight off live state — so the preview showed the chosen preset while the
 * MP4 came back karaoke, on every reel, forever. Three sessions were spent
 * inside the caption *layer*, which was innocent: it drew exactly the style it
 * was handed.
 *
 * These tests are parameterised over the registry rather than a copied list,
 * because a copied list is the bug. Adding a preset to captions.ts extends the
 * test automatically; nothing has to be kept in sync by hand.
 */

const PRESET_IDS = CAPTION_STYLE_DEFS.map((d) => d.id);

/** A minimal project that produces a valid plan, parameterised by preset. */
function projectWith(captionStyle: string) {
  return {
    clips: [
      {
        id: 'c1',
        name: 'Clip',
        url: 'https://example.com/a.mp4',
        durationSec: 4,
        trimEndSec: 0,
      },
    ],
    audio: null,
    captions: { c1: [{ word: 'hello', start: 0, end: 0.4 }] },
    captionStyle,
  };
}

describe('caption preset round-trip (picker → DB → render plan)', () => {
  it('has a registry big enough for this test to mean something', () => {
    // Sanity: if the registry ever collapsed to the old four ids, the rest of
    // this file would pass trivially and prove nothing.
    expect(PRESET_IDS.length).toBeGreaterThan(10);
    expect(PRESET_IDS).toContain('karaoke');
  });

  it.each(PRESET_IDS)('normalizeCaptionPreset keeps %s', (id) => {
    expect(normalizeCaptionPreset(id)).toBe(id);
  });

  it.each(PRESET_IDS)('projectToJson persists %s instead of collapsing it', (id) => {
    // This is the save path. It used to write 'karaoke' for 37 of these.
    expect(projectToJson(projectWith(id) as never).captionStyle).toBe(id);
  });

  it.each(PRESET_IDS)('normalizeProjectJson (the render route) keeps %s', (id) => {
    expect(normalizeProjectJson(projectWith(id)).captionStyle).toBe(id);
  });

  it.each(PRESET_IDS)('the RenderPlan carries the real style for %s', (id) => {
    // The end of the chain: what the worker actually draws. Compare against the
    // registry's own def so this asserts the resolved LOOK, not just the id.
    const plan = buildRenderPlan(normalizeProjectJson(projectWith(id)) as never, {
      width: 1080,
      height: 1920,
    });
    expect(plan.captionStyleId).toBe(id);
    expect(plan.captionStyle.font).toBe(captionDefFor(id).font);
    expect(plan.captionStyle.id).toBe(id);
  });

  it('still falls back to karaoke for junk and missing values', () => {
    for (const junk of [undefined, null, '', 42, {}, 'not-a-real-preset']) {
      expect(normalizeCaptionPreset(junk)).toBe('karaoke');
    }
  });
});
