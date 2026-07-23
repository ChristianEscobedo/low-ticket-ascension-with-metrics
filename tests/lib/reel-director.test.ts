import { describe, it, expect } from 'vitest';
import {
  buildSeedancePrompt,
  brandBibleToPromptBlock,
  MASTER_VIDEO_META_PROMPT,
  NEGATIVE_PROMPT,
  REEL_WRAPPERS,
  REEL_WRAPPER_LIST,
  MAX_SEEDANCE_PROMPT_CHARS,
  type BrandBible,
} from '@/lib/mothermode/content/reelDirector';

import { emptyFilmBible, mergeContinuity } from '@/lib/mothermode/content/filmBible';
import type { StoryboardBoard } from '@/lib/mothermode/content/review';

const brand: BrandBible = {
  name: 'MotherMode',
  visualStyle: 'editorial, lived-in, natural light',
  colorPalette: 'warm neutrals, muted',
  emotion: 'relief',
  cameraLanguage: 'handheld, close, patient',
  negatives: ['no stock-photo smiles'],
};

function board(overrides: Partial<StoryboardBoard> = {}): StoryboardBoard {
  return {
    index: 1,
    title: 'Morning',
    scenes: ['mother wakes', 'reaches for coffee'],
    imagePrompt: 'a mother at a kitchen counter, dawn light',
    videoPrompt: 'slow push in, handheld',
    lookbackSummary: 'grey cardigan, warm light',
    brollNotes: 'insert: steam rising from mug',
    ...overrides,
  } as StoryboardBoard;
}

describe('REEL_WRAPPERS', () => {
  it('gates voice/music per preset', () => {
    expect(REEL_WRAPPERS.silent.voice).toBe(false);
    expect(REEL_WRAPPERS.silent.music).toBe(false);
    expect(REEL_WRAPPERS.music.music).toBe(true);
    expect(REEL_WRAPPERS.voice.voice).toBe(true);
    expect(REEL_WRAPPERS['voice+music'].voice).toBe(true);
    expect(REEL_WRAPPERS['voice+music'].music).toBe(true);
  });

  it('lists all four in order', () => {
    expect(REEL_WRAPPER_LIST.map((w) => w.id)).toEqual([
      'silent',
      'music',
      'voice',
      'voice+music',
    ]);
  });
});

describe('brandBibleToPromptBlock', () => {
  it('renders the brand fields', () => {
    const block = brandBibleToPromptBlock(brand);
    expect(block).toContain('BRAND BIBLE');
    expect(block).toContain('MotherMode');
    expect(block).toContain('relief');
  });
});

describe('buildSeedancePrompt', () => {
  it('always includes the master meta prompt and negatives', () => {
    const p = buildSeedancePrompt({ board: board() });
    expect(p).toContain(MASTER_VIDEO_META_PROMPT);
    expect(p).toContain('NEGATIVE:');
    expect(p).toContain(NEGATIVE_PROMPT);
  });

  it('orders storyboard ahead of brand so it wins conflicts', () => {
    const p = buildSeedancePrompt({ board: board(), brandBible: brand });
    const storyAt = p.indexOf('STORYBOARD (source of truth');
    const brandAt = p.indexOf('BRAND BIBLE');
    expect(storyAt).toBeGreaterThanOrEqual(0);
    expect(brandAt).toBeGreaterThan(storyAt);
  });

  it('orders film bible ahead of the storyboard', () => {
    const fb = mergeContinuity(emptyFilmBible({ title: 'T' }), {
      continuity: ['warm light throughout'],
    });
    const p = buildSeedancePrompt({ board: board(), filmBible: fb });
    const bibleAt = p.indexOf('FILM BIBLE');
    const storyAt = p.indexOf('STORYBOARD (source of truth');
    expect(bibleAt).toBeGreaterThanOrEqual(0);
    expect(storyAt).toBeGreaterThan(bibleAt);
  });

  it('includes the frame target when a frame is given', () => {
    const p = buildSeedancePrompt({ board: board(), frame: 2 });
    expect(p).toContain('Render panel 2');
  });

  it('drops voice and music for the silent wrapper', () => {
    const p = buildSeedancePrompt({
      board: board(),
      wrapper: 'silent',
      voice: 'she breathes out',
      music: 'soft piano',
    });
    expect(p).not.toContain('NARRATION');
    expect(p).not.toContain('MUSIC DIRECTION');
  });

  it('includes voice but not music for the voice wrapper', () => {
    const p = buildSeedancePrompt({
      board: board(),
      wrapper: 'voice',
      voice: 'she breathes out',
      music: 'soft piano',
    });
    expect(p).toContain('NARRATION');
    expect(p).not.toContain('MUSIC DIRECTION');
  });

  it('includes both layers for voice+music', () => {
    const p = buildSeedancePrompt({
      board: board(),
      wrapper: 'voice+music',
      voice: 'she breathes out',
      music: 'soft piano',
    });
    expect(p).toContain('NARRATION');
    expect(p).toContain('MUSIC DIRECTION');
  });

  it('appends brand negatives to the always-on negatives', () => {
    const p = buildSeedancePrompt({ board: board(), brandBible: brand });
    expect(p).toContain('no stock-photo smiles');
    expect(p).toContain(NEGATIVE_PROMPT);
  });

  it('carries scene notes and explicit camera direction', () => {
    const p = buildSeedancePrompt({
      board: board(),
      camera: '35mm, shallow depth of field',
    });
    expect(p).toContain('SCENE NOTES:');
    expect(p).toContain('steam rising from mug');
    expect(p).toContain('CAMERA:');
    expect(p).toContain('35mm');
  });

  it('clamps the prompt to MUAPI\'s 4000-char cap', () => {
    const p = buildSeedancePrompt({
      board: board({ imagePrompt: 'x'.repeat(6000) }),
      brandBible: brand,
      voice: 'a'.repeat(500),
      music: 'b'.repeat(500),
      camera: 'c'.repeat(500),
    });
    expect(p.length).toBeLessThanOrEqual(MAX_SEEDANCE_PROMPT_CHARS);
  });

  it('drops optional layers before touching the storyboard when over the cap', () => {
    // Storyboard alone is comfortably under the cap; the overflow comes from
    // the optional layers, so those should be shed and the storyboard kept.
    const p = buildSeedancePrompt({
      board: board({ imagePrompt: 'y'.repeat(2000) }),
      brandBible: brand,
      voice: 'a'.repeat(1500),
      music: 'b'.repeat(1500),
      camera: 'c'.repeat(1500),
    });
    expect(p.length).toBeLessThanOrEqual(MAX_SEEDANCE_PROMPT_CHARS);
    // Load-bearing sections survive.
    expect(p).toContain(MASTER_VIDEO_META_PROMPT);
    expect(p).toContain('STORYBOARD (source of truth');
    expect(p).toContain('NEGATIVE:');
    expect(p).toContain('y'.repeat(2000));

    // Lowest-priority optional layers are shed first.
    expect(p).not.toContain('MUSIC DIRECTION');
    expect(p).not.toContain('CAMERA:');
  });

  it('keeps the negatives even when the storyboard itself must be truncated', () => {
    const p = buildSeedancePrompt({
      board: board({ imagePrompt: 'z'.repeat(6000) }),
    });
    expect(p.length).toBeLessThanOrEqual(MAX_SEEDANCE_PROMPT_CHARS);
    expect(p).toContain(MASTER_VIDEO_META_PROMPT);
    expect(p).toContain('NEGATIVE:');
    expect(p).toContain(NEGATIVE_PROMPT);
    expect(p).toContain('…');
  });
});


