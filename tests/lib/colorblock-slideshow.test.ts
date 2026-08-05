import { describe, it, expect } from 'vitest';
import {
  FORMAT_LABEL,
  PLATFORM_FORMATS,
  allContent,
  getPiece,
  pieceToText,
  canvasSizeForFormat,
  defaultPresetIdsForFormat,
  isMultiFrameFormat,
  colorBlockBackground,
  colorBlockFontScale,
  colorBlockStyleFor,
  fitsColorBlock,
  COLOR_BLOCK_SWATCHES,
  COLOR_BLOCK_MAX_CHARS,
} from '@/lib/mothermode/content';
import {
  withSlideOverlay,
  withoutSlideOverlay,
  isEmptyReview,
  type PieceReview,
  type StoredImageOverlay,
} from '@/lib/mothermode/content/review';
import { scoreLocalCompliance } from '@/lib/mothermode/content/platformCompliance';

const OVERLAY: StoredImageOverlay = {
  text: 'the mental load',
  fontId: 'sans',
  styleId: 'scrim',
  size: 'xl',
  weight: 'black',
  color: 'white',
  vAlign: 'middle',
  hAlign: 'center',
};

describe('colorblock + slideshow formats', () => {
  it('labels both formats and wires them into the right platforms', () => {
    expect(FORMAT_LABEL.colorblock).toBe('Color block post');
    expect(FORMAT_LABEL.slideshow).toBe('Photo slideshow');
    expect(PLATFORM_FORMATS.facebook).toContain('colorblock');
    expect(PLATFORM_FORMATS.tiktok).toContain('slideshow');
  });

  it('sizes the formats for canvas + presets', () => {
    expect(canvasSizeForFormat('colorblock')).toEqual({ width: 1080, height: 1080 });
    expect(canvasSizeForFormat('slideshow')).toEqual({ width: 1080, height: 1920 });
    expect(defaultPresetIdsForFormat('colorblock')).toEqual(['ig-fb-feed-11']);
    expect(defaultPresetIdsForFormat('slideshow')).toEqual(['ig-fb-story']);
    expect(isMultiFrameFormat('slideshow')).toBe(true);
    expect(isMultiFrameFormat('colorblock')).toBe(false);
  });

  it('resolves a piece color-block style with a default fallback', () => {
    const p = getPiece('fb-colorblock-1');
    expect(p).toBeDefined();
    expect(p!.format).toBe('colorblock');
    expect(colorBlockStyleFor(p!).bg).toBe('#532B3C');
    const def = colorBlockStyleFor({ ...p!, colorBlock: undefined });
    expect(COLOR_BLOCK_SWATCHES.some((s) => s.bg === def.bg)).toBe(true);
  });

  it('builds a CSS background from solid or gradient swatches', () => {
    expect(colorBlockBackground({ bg: '#532B3C' })).toContain('linear-gradient');
    const grad = colorBlockBackground({ bg: '#2E2230', gradient: ['#2E2230', '#532B3C'] });
    expect(grad).toContain('#2E2230');
    expect(grad).toContain('#532B3C');
  });

  it('scales the block text down as it lengthens, like native FB', () => {
    const short = colorBlockFontScale('short');
    const long = colorBlockFontScale('x'.repeat(120));
    expect(short).toBeGreaterThan(long);
    expect(long).toBeGreaterThanOrEqual(0.6);
  });

  it('knows the native big-text ceiling', () => {
    expect(fitsColorBlock('short hook')).toBe(true);
    expect(fitsColorBlock('x'.repeat(COLOR_BLOCK_MAX_CHARS + 1))).toBe(false);
  });

  it('renders a colorblock piece to text with its background noted', () => {
    const p = getPiece('fb-colorblock-1')!;
    const txt = pieceToText(p);
    expect(txt).toContain('Color block post');
    expect(txt).toContain('COLOR BLOCK');
    expect(txt).toContain('#532B3C');
    expect(txt).toContain(p.hook);
  });

  it('renders a slideshow piece to text with its slides', () => {
    const p = getPiece('tt-slideshow-1')!;
    expect(p.format).toBe('slideshow');
    const txt = pieceToText(p);
    expect(txt).toContain('Photo slideshow');
    expect(txt).toContain('Slide 1:');
    expect(txt).toContain(p.caption!);
  });

  it('carries both new catalogs in allContent', () => {
    const cbs = allContent.filter((p) => p.format === 'colorblock');
    const shows = allContent.filter((p) => p.format === 'slideshow');
    expect(cbs.length).toBeGreaterThanOrEqual(6);
    expect(shows.length).toBeGreaterThanOrEqual(4);
    for (const p of cbs) expect(p.platform).toBe('facebook');
    for (const p of shows) expect(p.platform).toBe('tiktok');
  });

  it('stores and clears a per-slide overlay without touching other slides', () => {
    let r: PieceReview = {};
    r = withSlideOverlay(r, 2, OVERLAY);
    r = withSlideOverlay(r, 0, { ...OVERLAY, text: 'other' });
    expect(r.slideOverlays?.[2]?.text).toBe('the mental load');
    expect(r.slideOverlays?.[0]?.text).toBe('other');
    r = withoutSlideOverlay(r, 2);
    expect(r.slideOverlays?.[2]).toBeUndefined();
    expect(r.slideOverlays?.[0]?.text).toBe('other');
    // Slide overlays alone do not count as a meaningful review to persist.
    expect(isEmptyReview(withSlideOverlay({}, 0, OVERLAY))).toBe(true);
  });

  it('flags an over-long color-block hook in compliance', () => {
    const p = getPiece('fb-colorblock-1')!;
    const over = { ...p, hook: 'x'.repeat(COLOR_BLOCK_MAX_CHARS + 20) };
    const card = scoreLocalCompliance(over);
    expect(card.issues.some((i) => i.id === 'fmt-colorblock-length')).toBe(true);
  });

  it('passes a well-formed color-block hook in compliance (no fmt issue)', () => {
    const p = getPiece('fb-colorblock-1')!;
    const card = scoreLocalCompliance(p);
    expect(card.issues.some((i) => i.id === 'fmt-colorblock-length')).toBe(false);
  });
});
