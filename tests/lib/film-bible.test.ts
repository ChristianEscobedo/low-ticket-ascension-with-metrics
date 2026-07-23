import { describe, it, expect } from 'vitest';
import {
  emptyFilmBible,
  mergeContinuity,
  continuityFromBoard,
  filmBibleFromStory,
  filmBibleToPromptBlock,
  type FilmBible,
  type ContinuityDelta,
} from '@/lib/mothermode/content/filmBible';
import type {
  StoryboardBoard,
  ReelStory,
} from '@/lib/mothermode/content/review';

function board(overrides: Partial<StoryboardBoard> = {}): StoryboardBoard {
  return {
    index: 1,
    title: 'Board One',
    scenes: ['a', 'b'],
    imagePrompt: 'a kitchen at dawn',
    videoPrompt: 'slow push in, handheld',
    lookbackSummary: 'mother in grey cardigan, warm light',
    ...overrides,
  } as StoryboardBoard;
}

describe('emptyFilmBible', () => {
  it('applies sensible defaults', () => {
    const b = emptyFilmBible();
    expect(b.film.genre).toBe('social short film');
    expect(b.film.aspectRatio).toBe('9:16');
    expect(b.characters).toEqual([]);
    expect(b.continuity).toEqual([]);
  });

  it('honors seed values and dedupes the arc', () => {
    const b = emptyFilmBible({
      title: 'Quiet Morning',
      genre: 'vignette',
      emotionalArc: ['Hook', 'Hook', 'Release'],
    });
    expect(b.film.title).toBe('Quiet Morning');
    expect(b.film.genre).toBe('vignette');
    expect(b.emotionalArc).toEqual(['Hook', 'Release']);
  });
});

describe('mergeContinuity', () => {
  const base = emptyFilmBible({ title: 'T' });

  it('unions characters by id and appends deduped lines', () => {
    const delta: ContinuityDelta = {
      characters: [{ id: 'mom', name: 'the mother', wardrobe: 'grey cardigan' }],
      continuity: ['warm light'],
      cameraRules: ['handheld'],
      emotionalArc: ['Hook'],
    };
    const merged = mergeContinuity(base, delta);
    expect(merged.characters).toHaveLength(1);
    expect(merged.continuity).toEqual(['warm light']);
    expect(merged.cameraRules).toEqual(['handheld']);
    // Base is not mutated.
    expect(base.characters).toHaveLength(0);
  });

  it('is idempotent for identical deltas', () => {
    const delta: ContinuityDelta = {
      characters: [{ id: 'mom', name: 'the mother' }],
      continuity: ['warm light'],
    };
    const once = mergeContinuity(base, delta);
    const twice = mergeContinuity(once, delta);
    expect(twice.characters).toHaveLength(1);
    expect(twice.continuity).toEqual(['warm light']);
  });

  it('merges same-id characters, delta filling missing fields', () => {
    const step1 = mergeContinuity(base, {
      characters: [{ id: 'mom', name: 'the mother' }],
    });
    const step2 = mergeContinuity(step1, {
      characters: [{ id: 'mom', name: 'the mother', wardrobe: 'grey cardigan' }],
    });
    expect(step2.characters).toHaveLength(1);
    expect(step2.characters[0].wardrobe).toBe('grey cardigan');
  });

  it('is case-insensitive when deduping continuity lines', () => {
    const step1 = mergeContinuity(base, { continuity: ['Warm Light'] });
    const step2 = mergeContinuity(step1, { continuity: ['warm light'] });
    expect(step2.continuity).toHaveLength(1);
  });
});

describe('continuityFromBoard', () => {
  it('lifts lookbackSummary into a titled continuity line and camera rule', () => {
    const delta = continuityFromBoard(board());
    expect(delta.continuity?.[0]).toContain('Board One');
    expect(delta.continuity?.[0]).toContain('grey cardigan');
    expect(delta.cameraRules?.[0]).toContain('handheld');
  });

  it('is safe when optional fields are missing', () => {
    const delta = continuityFromBoard(
      board({ videoPrompt: undefined, lookbackSummary: '' }),
    );
    expect(delta.continuity).toEqual([]);
    expect(delta.cameraRules).toEqual([]);
  });
});

describe('filmBibleFromStory', () => {
  it('seeds the emotional arc from chapter emotional states in order', () => {
    const story: ReelStory = {
      title: 'Quiet Morning',
      cta: 'save this',
      chapters: [
        { index: 2, emotionalState: 'Release' } as ReelStory['chapters'][number],
        { index: 1, emotionalState: 'Hook' } as ReelStory['chapters'][number],
      ],
    } as ReelStory;
    const b = filmBibleFromStory(story);
    expect(b.film.title).toBe('Quiet Morning');
    expect(b.emotionalArc).toEqual(['Hook', 'Release']);
  });
});

describe('filmBibleToPromptBlock', () => {
  it('omits empty sections and renders present ones', () => {
    const b: FilmBible = mergeContinuity(emptyFilmBible({ title: 'T' }), {
      characters: [{ id: 'mom', name: 'the mother', wardrobe: 'grey cardigan' }],
      continuity: ['warm light'],
      emotionalArc: ['Hook', 'Release'],
    });
    const block = filmBibleToPromptBlock(b);
    expect(block).toContain('FILM BIBLE');
    expect(block).toContain('the mother');
    expect(block).toContain('Emotional arc: Hook -> Release.');
    expect(block).not.toContain('Locations:');
  });
});
