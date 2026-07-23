import { describe, expect, it } from 'vitest';
import {
  VO_JOINER,
  alignmentDurationSec,
  beatDriftSec,
  beatMarksFromAlignment,
  buildCombinedVoText,
  type AlignmentLike,
} from '@/lib/mothermode/content/voiceover';

/** Build a per-character alignment where each character lasts `step` seconds. */
function evenAlignment(text: string, step = 0.1): AlignmentLike {
  const characters = text.split('');
  const character_start_times_seconds = characters.map((_, i) => i * step);
  const character_end_times_seconds = characters.map((_, i) => (i + 1) * step);
  return {
    characters,
    character_start_times_seconds,
    character_end_times_seconds,
  };
}

describe('voiceover timing math', () => {
  describe('buildCombinedVoText', () => {
    it('joins beats with the joiner and records start offsets', () => {
      const { text, offsets } = buildCombinedVoText([
        { index: 0, text: 'Hello' },
        { index: 1, text: 'world' },
        { index: 2, text: 'again' },
      ]);
      expect(text).toBe(`Hello${VO_JOINER}world${VO_JOINER}again`);
      // "Hello" = 5 chars, +1 joiner = 6, "world" = 5, +1 joiner = 12.
      expect(offsets).toEqual([0, 6, 12]);
      // Each offset points at the first character of its beat.
      expect(text[offsets[0]]).toBe('H');
      expect(text[offsets[1]]).toBe('w');
      expect(text[offsets[2]]).toBe('a');
    });

    it('trims each beat and preserves empty beats for index alignment', () => {
      const { text, offsets } = buildCombinedVoText([
        { index: 0, text: '  Trim me  ' },
        { index: 1, text: '' },
        { index: 2, text: 'End' },
      ]);
      expect(offsets).toHaveLength(3);
      expect(text.startsWith('Trim me')).toBe(true);
    });

    it('handles a single beat with no joiner', () => {
      const { text, offsets } = buildCombinedVoText([{ index: 0, text: 'Solo' }]);
      expect(text).toBe('Solo');
      expect(offsets).toEqual([0]);
    });
  });

  describe('alignmentDurationSec', () => {
    it('returns the last character end time', () => {
      const a = evenAlignment('abcde', 0.2); // 5 chars * 0.2 = 1.0s
      expect(alignmentDurationSec(a)).toBeCloseTo(1.0, 5);
    });

    it('returns 0 for an empty alignment', () => {
      expect(
        alignmentDurationSec({
          characters: [],
          character_start_times_seconds: [],
          character_end_times_seconds: [],
        }),
      ).toBe(0);
    });
  });

  describe('beatMarksFromAlignment', () => {
    it('maps offsets to contiguous per-beat windows', () => {
      const { text, offsets } = buildCombinedVoText([
        { index: 0, text: 'Hello' },
        { index: 1, text: 'world' },
      ]);
      // text = "Hello world" (11 chars). step 0.1 -> total 1.1s.
      const align = evenAlignment(text, 0.1);
      const marks = beatMarksFromAlignment(offsets, align);
      expect(marks).toHaveLength(2);
      // Beat 0 starts at char 0 (0.0s), ends where beat 1 starts (char 6 -> 0.6s).
      expect(marks[0].index).toBe(0);
      expect(marks[0].startSec).toBeCloseTo(0.0, 5);
      expect(marks[0].endSec).toBeCloseTo(0.6, 5);
      // Beat 1 starts at char 6 (0.6s), ends at track end (1.1s).
      expect(marks[1].startSec).toBeCloseTo(0.6, 5);
      expect(marks[1].endSec).toBeCloseTo(1.1, 5);
    });

    it('clamps offsets that run past the alignment length', () => {
      const align = evenAlignment('abc', 0.1); // 3 chars
      const marks = beatMarksFromAlignment([0, 99], align);
      expect(marks).toHaveLength(2);
      expect(marks[1].startSec).toBeGreaterThanOrEqual(marks[0].startSec);
      // endSec never precedes startSec.
      marks.forEach((m) => expect(m.endSec).toBeGreaterThanOrEqual(m.startSec));
    });

    it('returns zeroed marks for an empty alignment', () => {
      const marks = beatMarksFromAlignment([0, 5], {
        characters: [],
        character_start_times_seconds: [],
        character_end_times_seconds: [],
      });
      expect(marks).toEqual([
        { index: 0, startSec: 0, endSec: 0 },
        { index: 1, startSec: 0, endSec: 0 },
      ]);
    });
  });

  describe('beatDriftSec', () => {
    it('is positive when the VO lands later than planned', () => {
      expect(beatDriftSec(9.4, 9.0)).toBeCloseTo(0.4, 5);
    });
    it('is negative when the VO lands earlier than planned', () => {
      expect(beatDriftSec(8.7, 9.0)).toBeCloseTo(-0.3, 5);
    });
  });
});
