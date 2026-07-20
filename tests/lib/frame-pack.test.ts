import { describe, expect, it } from 'vitest';
import {
  clampSlideCount,
  defaultPackAspect,
  defaultSlideCount,
  emptyFramePack,
  framesFromCatalogSlides,
  normalizeFrameRole,
  supportsFramePack,
  targetSlideCount,
  withFrameImages,
  withPlannedFrames,
  MAX_FRAME_PACK,
  MIN_FRAME_PACK,
} from '@/lib/mothermode/content/framePack';
import type { ContentPiece } from '@/lib/mothermode/content/types';

function piece(partial: Partial<ContentPiece> & Pick<ContentPiece, 'format'>): ContentPiece {
  return {
    id: 't1',
    platform: 'instagram',
    kind: 'organic',
    tone: 'confidante',
    theme: 'test',
    title: 'Test',
    hook: 'Hook line',
    cta: 'Get it',
    ...partial,
  };
}

describe('framePack', () => {
  it('supports multi-frame formats only', () => {
    expect(supportsFramePack('carousel')).toBe(true);
    expect(supportsFramePack('story')).toBe(true);
    expect(supportsFramePack('idea')).toBe(true);
    expect(supportsFramePack('feed')).toBe(false);
    expect(supportsFramePack('reel')).toBe(false);
  });

  it('clamps slide counts', () => {
    expect(clampSlideCount(1)).toBe(MIN_FRAME_PACK);
    expect(clampSlideCount(99)).toBe(MAX_FRAME_PACK);
    expect(clampSlideCount(5)).toBe(5);
  });

  it('defaults aspect and count by format', () => {
    expect(defaultPackAspect('story')).toBe('9:16');
    expect(defaultPackAspect('carousel')).toBe('1:1');
    expect(defaultSlideCount('carousel')).toBe(5);
    expect(defaultSlideCount('story')).toBe(3);
  });

  it('prefers catalog slides for target count', () => {
    const p = piece({
      format: 'carousel',
      slides: [
        { text: 'A' },
        { text: 'B' },
        { text: 'C' },
        { text: 'D' },
      ],
    });
    expect(targetSlideCount(p)).toBe(4);
    expect(targetSlideCount(p, 7)).toBe(7);
  });

  it('normalizes roles', () => {
    expect(normalizeFrameRole('Cover')).toBe('cover');
    expect(normalizeFrameRole('scroll-stop')).toBe('hook');
    expect(normalizeFrameRole('close')).toBe('cta');
    expect(normalizeFrameRole('weird')).toBe('weird');
  });

  it('builds empty pack from catalog', () => {
    const p = piece({
      format: 'story',
      slides: [
        { text: 'Open', sub: 's' },
        { text: 'Mid' },
        { text: 'Close' },
      ],
    });
    const pack = emptyFramePack(p);
    expect(pack.slideCount).toBe(3);
    expect(pack.aspect).toBe('9:16');
    expect(pack.frames).toHaveLength(3);
    expect(pack.frames[0].role).toBe('cover');
    expect(pack.frames[0].text).toBe('Open');
    expect(pack.frames[2].role).toBe('cta');
  });

  it('merges planned frames and images', () => {
    const p = piece({ format: 'carousel' });
    const base = emptyFramePack(p, { slideCount: 3 });
    const planned = withPlannedFrames(base, [
      {
        index: 9,
        role: 'hook',
        text: 'Stop',
        prompt: 'scene one',
        lookbackSummary: 'locked light',
      },
      {
        index: 9,
        role: 'cta',
        text: 'Go',
        prompt: 'scene two',
        lookbackSummary: 'locked type',
      },
    ]);
    expect(planned.frames).toHaveLength(2);
    expect(planned.frames[0].index).toBe(1);
    expect(planned.frames[1].index).toBe(2);
    const withImgs = withFrameImages(planned, ['http://a', 'http://b']);
    expect(withImgs.frames[0].imageUrl).toBe('http://a');
    expect(withImgs.frames[1].imageUrl).toBe('http://b');
  });

  it('framesFromCatalogSlides pads roles', () => {
    const frames = framesFromCatalogSlides([{ text: 'Only' }], 3);
    expect(frames).toHaveLength(3);
    expect(frames[0].role).toBe('cover');
    expect(frames[1].role).toBe('hook');
    expect(frames[2].role).toBe('cta');
  });
});
