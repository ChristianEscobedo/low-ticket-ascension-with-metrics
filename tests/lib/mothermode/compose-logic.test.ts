import { describe, it, expect } from 'vitest';
import {
  splitParas,
  versionText,
  versionSignature,
  withFallback,
  versionCount,
  cartesian,
  buildVersions,
  splitSentences,
  readableParagraphs,
  diffVersion,
  type VersionParts,
} from '@/lib/mothermode/content/compose';

describe('splitParas', () => {
  it('splits on blank lines and trims, dropping empties', () => {
    expect(splitParas('one\n\ntwo\n\n\n  three  ')).toEqual([
      'one',
      'two',
      'three',
    ]);
    expect(splitParas('')).toEqual([]);
  });
});

describe('versionText and signature', () => {
  const v: VersionParts = { hook: 'Hook.', body: ['A.', 'B.'], cta: 'Go.' };
  it('joins parts with a blank line and skips empty parts', () => {
    expect(versionText(v)).toBe('Hook.\n\nA.\n\nB.\n\nGo.');
    expect(versionText({ hook: 'H', body: [], cta: '' })).toBe('H');
  });
  it('signature equals the text so identical combos collide', () => {
    expect(versionSignature(v)).toBe(versionText(v));
  });
  it('folds the image into the signature so a new visual is a new version', () => {
    const a: VersionParts = { ...v, image: 'https://cdn/a.png' };
    const b: VersionParts = { ...v, image: 'https://cdn/b.png' };
    expect(versionSignature(a)).not.toBe(versionSignature(b));
    expect(versionSignature(a)).not.toBe(versionSignature(v));
    expect(versionSignature({ ...v, image: 'https://cdn/a.png' })).toBe(
      versionSignature(a),
    );
  });
});

describe('withFallback', () => {
  it('keeps picks when present, else uses the fallback', () => {
    expect(withFallback(['a'], ['orig'])).toEqual(['a']);
    expect(withFallback([], ['orig'])).toEqual(['orig']);
    expect(withFallback([], [])).toEqual([]);
  });
});

describe('versionCount', () => {
  it('multiplies the three axis lengths', () => {
    expect(versionCount(['a', 'b', 'c'], [['x'], ['y']], ['z'])).toBe(6);
    expect(versionCount([], [['y']], ['z'])).toBe(0);
  });
  it('adds images as a fourth axis in multiply mode', () => {
    expect(versionCount(['a', 'b'], [['x']], ['z'], ['i1', 'i2'])).toBe(4);
  });
  it('keeps the text count in pair mode regardless of image count', () => {
    expect(versionCount(['a', 'b'], [['x']], ['z'], ['i1', 'i2'], 'pair')).toBe(
      2,
    );
  });
});

describe('cartesian', () => {
  it('produces every combination in nested order', () => {
    const out = cartesian(['h1', 'h2'], [['b1'], ['b2']], ['c1']);
    expect(out).toHaveLength(4);
    expect(out[0]).toEqual({ hook: 'h1', body: ['b1'], cta: 'c1' });
    expect(out[3]).toEqual({ hook: 'h2', body: ['b2'], cta: 'c1' });
  });
  it('repeats each text combo per image in multiply mode', () => {
    const out = cartesian(['h1'], [['b1']], ['c1'], ['i1', 'i2']);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ hook: 'h1', body: ['b1'], cta: 'c1', image: 'i1' });
    expect(out[1].image).toBe('i2');
  });
  it('cycles one image per text combo in pair mode', () => {
    const out = cartesian(['h1', 'h2', 'h3'], [['b1']], ['c1'], ['i1', 'i2'], 'pair');
    expect(out.map((v) => v.image)).toEqual(['i1', 'i2', 'i1']);
  });
});

describe('buildVersions', () => {
  it('returns all combinations when nothing exists yet', () => {
    const made = buildVersions(['h1', 'h2'], [['b1']], ['c1']);
    expect(made).toHaveLength(2);
  });

  it('skips combinations already in the tray (no duplicates on re-run)', () => {
    const existing = buildVersions(['h1'], [['b1']], ['c1']);
    const again = buildVersions(['h1', 'h2'], [['b1']], ['c1'], existing);
    expect(again).toHaveLength(1);
    expect(again[0].hook).toBe('h2');
  });

  it('treats the same copy with different images as distinct versions', () => {
    const made = buildVersions(['h1'], [['b1']], ['c1'], [], ['i1', 'i2']);
    expect(made).toHaveLength(2);
    expect(made.map((v) => v.image)).toEqual(['i1', 'i2']);
  });
});

describe('splitSentences', () => {
  it('splits on terminal punctuation and trims', () => {
    expect(splitSentences('One. Two! Three?')).toEqual([
      'One.',
      'Two!',
      'Three?',
    ]);
  });
  it('keeps a terminator-less run as one sentence and drops empties', () => {
    expect(splitSentences('no period here')).toEqual(['no period here']);
    expect(splitSentences('   ')).toEqual([]);
  });
});

describe('readableParagraphs', () => {
  it('chunks each paragraph to at most two sentences', () => {
    expect(readableParagraphs(['A. B. C. D.'])).toEqual(['A. B.', 'C. D.']);
  });
  it('keeps short paragraphs untouched and drops empties', () => {
    expect(readableParagraphs(['One sentence', '', '  '])).toEqual([
      'One sentence',
    ]);
  });
});

describe('diffVersion', () => {
  const original: VersionParts = {
    hook: 'Original hook',
    body: ['Original body'],
    cta: 'Original cta',
  };
  it('flags only the parts that were rewritten', () => {
    const v: VersionParts = {
      hook: 'New hook',
      body: ['A reworked body'],
      cta: 'Original cta',
    };
    expect(diffVersion(original, v)).toEqual({
      hook: 'changed',
      body: 'changed',
      cta: 'kept',
    });
  });
  it('ignores whitespace and case when comparing', () => {
    const v: VersionParts = {
      hook: '  original   HOOK ',
      body: ['Original body'],
      cta: 'Original cta',
    };
    const d = diffVersion(original, v);
    expect(d.hook).toBe('kept');
    expect(d.body).toBe('kept');
    expect(d.cta).toBe('kept');
  });
});
