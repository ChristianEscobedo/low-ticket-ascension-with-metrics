import { describe, expect, it } from 'vitest';
import {
  scriptLabGuides,
  transcriptCta,
  transcriptForProject,
  transcriptHook,
} from '@/lib/mothermode/reel/scriptLab';
import { CAPTION_STYLE_DEFS, EDITOR_PACKS } from '@/lib/mothermode/reel/captions';
import { REEL_TRANSITIONS } from '@/lib/mothermode/reel/types';

const clip = (id: string) => ({
  id,
  name: id,
  url: `https://example.com/${id}.mp4`,
  durationSec: 4,
  trimEndSec: 0,
});

describe('Script Lab transcript builder', () => {
  it('joins every clip’s words in timeline order, skipping untranscribed clips', () => {
    const t = transcriptForProject({
      clips: [clip('a'), clip('b'), clip('c')],
      captions: {
        a: [
          { word: 'hello', start: 0, end: 0.3 },
          { word: 'world', start: 0.3, end: 0.6 },
        ],
        // b has no transcript — it contributes nothing, not even a blank line
        c: [{ word: 'again', start: 0, end: 0.4 }],
      },
    });
    expect(t).toBe('hello world\nagain');
  });

  it('returns "" for a reel with no captions at all (the panel gates on it)', () => {
    expect(transcriptForProject({ clips: [clip('a')], captions: {} })).toBe('');
  });

  it('transcriptHook is the first ~14 words; transcriptCta the last ~14', () => {
    const words = Array.from({ length: 40 }, (_, i) => `w${i + 1}`).join(' ');
    expect(transcriptHook(words)).toBe(
      Array.from({ length: 14 }, (_, i) => `w${i + 1}`).join(' '),
    );
    expect(transcriptCta(words)).toBe(
      Array.from({ length: 14 }, (_, i) => `w${i + 27}`).join(' '),
    );
    // short transcripts return whole for both
    expect(transcriptHook('one two three')).toBe('one two three');
    expect(transcriptCta('one two three')).toBe('one two three');
  });

  it('the guides ground every variant in the transcript (and cap its length)', () => {
    const g = scriptLabGuides('the actual words');
    expect(g).toContain('the actual words');
    expect(g).toContain('transcript');
    expect(scriptLabGuides('x'.repeat(5000)).length).toBeLessThan(2100);
  });
});

describe('creator packs (EDITOR_PACKS)', () => {
  it('has unique ids and every presetId resolves to a REAL def', () => {
    const ids = EDITOR_PACKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const defIds = new Set(CAPTION_STYLE_DEFS.map((d) => d.id));
    for (const p of EDITOR_PACKS) {
      expect(defIds.has(p.presetId), `${p.id} presetId ${p.presetId}`).toBe(true);
    }
  });

  it('ships the creator set (hormozi / mrbeast / cinematic / minimal-ish / neon)', () => {
    const ids = EDITOR_PACKS.map((p) => p.id);
    expect(ids).toContain('hormozi');
    expect(ids).toContain('mrbeast');
    expect(ids).toContain('cinematic');
    expect(ids).toContain('neon');
  });

  it('every pack transition is a real ReelTransitionType (or omitted for hard cuts)', () => {
    for (const p of EDITOR_PACKS) {
      if (p.transition) {
        expect(REEL_TRANSITIONS as readonly string[]).toContain(p.transition);
      }
    }
    // podcast deliberately hard-cuts
    expect(EDITOR_PACKS.find((p) => p.id === 'podcast')?.transition).toBeUndefined();
  });
});
