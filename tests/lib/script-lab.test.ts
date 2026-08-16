import { describe, expect, it } from 'vitest';
import {
  SOPHISTICATION_LEVELS,
  scriptLabGuides,
  scriptToText,
  steeredGuides,
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

describe('Script Lab steering (steeredGuides)', () => {
  it('the default (sharp) adds NO extra line — the bare transcript grounding', () => {
    expect(steeredGuides('the words', { sophistication: 'sharp' })).toBe(
      scriptLabGuides('the words'),
    );
    expect(steeredGuides('the words')).toBe(scriptLabGuides('the words'));
  });

  it('everyday + expert append their level line; the transcript stays the base', () => {
    const everyday = steeredGuides('the words', { sophistication: 'everyday' });
    expect(everyday).toContain('the words');
    expect(everyday).toContain('6th-grade');
    const expert = steeredGuides('the words', { sophistication: 'expert' });
    expect(expert).toContain('the words');
    expect(expert).toContain('industry');
  });

  it('the notes ride as a creator-direction line (capped at 300 chars)', () => {
    const g = steeredGuides('the words', { notes: 'make it punchier, more personal' });
    expect(g).toContain('make it punchier, more personal');
    expect(g).toContain('Direction from the creator');
    const long = steeredGuides('the words', { notes: 'x'.repeat(500) });
    expect(long.length).toBeLessThan(scriptLabGuides('the words').length + 400);
  });

  it('every sophistication level has a label + hint (the dial renders all three)', () => {
    expect(SOPHISTICATION_LEVELS.map((l) => l.id)).toEqual(['everyday', 'sharp', 'expert']);
    for (const l of SOPHISTICATION_LEVELS) {
      expect(l.label.length).toBeGreaterThan(0);
      expect(l.hint.length).toBeGreaterThan(0);
    }
  });
});

describe('Script Lab export (scriptToText)', () => {
  it('bundles the four sections with clear markers, full scripts first', () => {
    const txt = scriptToText(
      {
        full: ['the whole script'],
        hooks: ['hook one', 'hook two'],
        body: ['a middle'],
        ctas: ['an ask'],
      },
      'My Reel',
    );
    expect(txt).toContain('SCRIPT LAB — My Reel');
    expect(txt).toContain('FULL SCRIPT');
    expect(txt).toContain('the whole script');
    expect(txt).toContain('HOOK');
    expect(txt).toContain('hook two');
    expect(txt).toContain('an ask');
    // full script section comes before the hooks section
    expect(txt.indexOf('FULL SCRIPT')).toBeLessThan(txt.indexOf('HOOK'));
  });

  it('skips empty sections (a hooks-only lab exports just the hooks)', () => {
    const txt = scriptToText({ full: [], hooks: ['only a hook'], body: [], ctas: [] }, 'x');
    expect(txt).toContain('only a hook');
    expect(txt).not.toContain('FULL SCRIPT');
    expect(txt).not.toContain('CTA');
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
