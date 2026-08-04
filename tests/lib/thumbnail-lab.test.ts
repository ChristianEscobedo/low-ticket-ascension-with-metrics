import { describe, it, expect } from 'vitest';
import {
  SAFE_ZONE,
  THUMBNAIL_TEMPLATES,
  clampToSafeZone,
  compositionFromTemplate,
  estimateTextWidthPx,
  fitLayer,
  layerFits,
  variantStampComposition,
  type ThumbnailTextLayer,
} from '@/lib/mothermode/reel/thumbnailLab';

const layer = (over: Partial<ThumbnailTextLayer> = {}): ThumbnailTextLayer => ({
  id: 't1',
  text: 'HELLO',
  xPct: 50,
  yPct: 50,
  fontPx: 96,
  color: '#fff',
  strokeColor: '#000',
  strokePx: 8,
  align: 'center',
  upper: true,
  weight: 900,
  ...over,
});

describe('thumbnail lab', () => {
  it('has four templates with unique ids', () => {
    expect(THUMBNAIL_TEMPLATES).toHaveLength(4);
    const ids = THUMBNAIL_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(4);
  });

  it('clamps positions into the safe zone', () => {
    expect(clampToSafeZone(0, 200)).toEqual({
      xPct: SAFE_ZONE.leftPct,
      yPct: SAFE_ZONE.bottomPct,
    });
    expect(clampToSafeZone(50, 50)).toEqual({ xPct: 50, yPct: 50 });
    expect(clampToSafeZone(99, 0)).toEqual({
      xPct: SAFE_ZONE.rightPct,
      yPct: SAFE_ZONE.topPct,
    });
  });

  it('builds a composition from a template with the hook text', () => {
    const comp = compositionFromTemplate('bold-left', 'Stop scrolling', 'https://x/bg.jpg');
    expect(comp.width).toBe(1280);
    expect(comp.height).toBe(720);
    expect(comp.backgroundUrl).toBe('https://x/bg.jpg');
    expect(comp.treatment).toBe('darken');
    expect(comp.textLayers).toHaveLength(1);
    expect(comp.textLayers[0].text).toBe('Stop scrolling');
  });

  it('falls back to the first template for an unknown id', () => {
    const comp = compositionFromTemplate('nope', 'x', 'https://x/bg.jpg');
    expect(comp.textLayers[0].text).toBe('x');
  });

  it('question-hook template adds a WATCH badge and two text layers', () => {
    const comp = compositionFromTemplate('question-hook', 'Why?', 'https://x/bg.jpg');
    expect(comp.badges).toHaveLength(1);
    expect(comp.badges[0].text).toBe('WATCH');
    expect(comp.textLayers).toHaveLength(2);
  });

  it('episode template adds an EP badge', () => {
    const comp = compositionFromTemplate('episode', 'Part one', 'https://x/bg.jpg');
    expect(comp.badges[0].text).toBe('EP 1');
  });

  it('variant stamping alternates layouts between adjacent variants', () => {
    const a = variantStampComposition({ hook: 'A', backgroundUrl: 'u', variantIndex: 0 });
    const b = variantStampComposition({ hook: 'B', backgroundUrl: 'u', variantIndex: 1 });
    const c = variantStampComposition({ hook: 'C', backgroundUrl: 'u', variantIndex: 2 });
    expect(a.treatment).toBe('darken'); // bold-left
    expect(b.treatment).toBe('vignette'); // center-stat
    expect(c.treatment).toBe('darken'); // bold-left again
  });

  it('estimates text width from character count and weight', () => {
    const narrow = estimateTextWidthPx(layer({ text: 'HI', fontPx: 100, weight: 800, upper: false }));
    const wide = estimateTextWidthPx(layer({ text: 'HELLO WORLD', fontPx: 100, weight: 900 }));
    expect(narrow).toBeLessThan(wide);
  });

  it('layerFits is true when centered text is inside the safe zone', () => {
    expect(layerFits(layer({ text: 'OK', xPct: 50, fontPx: 60 }))).toBe(true);
  });

  it('layerFits is false when text overflows the safe zone', () => {
    const big = layer({ text: 'THIS IS A VERY LONG HOOK THAT OVERFLOWS', xPct: 20, fontPx: 120 });
    expect(layerFits(big)).toBe(false);
  });

  it('fitLayer shrinks the font until the layer fits', () => {
    const big = layer({ text: 'THIS IS A VERY LONG HOOK THAT OVERFLOWS', xPct: 50, fontPx: 160 });
    const fitted = fitLayer(big);
    expect(fitted.fontPx).toBeLessThan(160);
    expect(layerFits(fitted) || fitted.fontPx === 24).toBe(true);
  });
});
