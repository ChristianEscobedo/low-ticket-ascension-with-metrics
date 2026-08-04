import { describe, it, expect } from 'vitest';
import { buildAssCaptions, buildForceStyle, groupWordsIntoLines } from '@/lib/mothermode/reel/assCaptions';
import type { ReelWord } from '@/lib/mothermode/reel/types';

const WORDS: ReelWord[] = [
  { word: 'you', start: 0.0, end: 0.4 },
  { word: 'keep', start: 0.4, end: 0.7 },
  { word: 'posting', start: 0.7, end: 1.2 },
  { word: 'every', start: 1.2, end: 1.5 },
  { word: 'day', start: 1.5, end: 1.9 },
  { word: 'and', start: 2.2, end: 2.5 },
  { word: 'nobody', start: 2.5, end: 2.9 },
  { word: 'watches', start: 2.9, end: 3.4 },
];

describe('ass captions', () => {
  it('groups words into caption lines (max 5 words or 2.5s per line)', () => {
    const lines = groupWordsIntoLines(WORDS);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines.flat().length).toBe(WORDS.length);
    // each line stays within the word cap
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(5);
  });

  it('builds a valid ASS document with the karaoke style + dialogue events', () => {
    const ass = buildAssCaptions(WORDS);
    expect(ass).toContain('[Script Info]');
    expect(ass).toContain('[V4+ Styles]');
    expect(ass).toContain('[Events]');
    expect(ass).toContain('Style: Karaoke,');
    expect(ass).toContain('Dialogue: 0,0:00:00.00');
  });

  it('every word gets a karaoke \\k tag with its duration in centiseconds', () => {
    const ass = buildAssCaptions(WORDS);
    // "you" spans 0.0–0.4 → 40 centiseconds
    expect(ass).toContain('{\\k40}YOU');
    // "keep" spans 0.4–0.7 → 30 centiseconds
    expect(ass).toContain('{\\k30}KEEP');
  });

  it('the default style is white text with a brass sweep on a dark box', () => {
    const ass = buildAssCaptions(WORDS);
    // brass sweep (#b88d57) as PrimaryColour (the ACTIVE word)
    expect(ass).toContain('&H00578DB8');
    // white (#ffffff) as SecondaryColour (idle words)
    expect(ass).toContain('&H00FFFFFF');
  });

  it('respects custom style knobs (font, size, alignment, no-uppercase)', () => {
    const ass = buildAssCaptions(WORDS, { fontName: 'Arial', fontSize: 24, alignment: 5, upper: false });
    expect(ass).toContain('Style: Karaoke,Arial,24');
    expect(ass).toContain(',5,20,20,40,1');
    expect(ass).toContain('{\\k40}you'); // not uppercased
  });

  it('returns an empty string for no words', () => {
    expect(buildAssCaptions([])).toBe('');
  });

  it('the force_style string matches the ASS style knobs', () => {
    const fs = buildForceStyle({ fontName: 'Inter', fontSize: 20, color: '#ffd400' });
    expect(fs).toContain('FontName=Inter');
    expect(fs).toContain('FontSize=20');
    expect(fs).toContain('PrimaryColour=&H0000D4FF'); // #ffd400 → BGR
  });
});
