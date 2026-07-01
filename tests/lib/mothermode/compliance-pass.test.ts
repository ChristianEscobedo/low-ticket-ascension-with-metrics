import { describe, it, expect } from 'vitest';
import {
  effectiveCopy,
  effectivePiece,
  isEditableField,
  complianceFixPatch,
} from '@/lib/mothermode/content/compliancePass';
import type { ContentPiece } from '@/lib/mothermode/content/types';

/** A minimal catalog piece; tests override only the fields they exercise. */
function piece(over: Partial<ContentPiece> = {}): ContentPiece {
  return {
    id: 'ig-feed-1',
    platform: 'instagram',
    format: 'feed',
    kind: 'organic',
    tone: 'wedge',
    theme: 'The mental load',
    title: 'Test piece',
    hook: 'A plain hook.',
    cta: 'Read the guide.',
    body: ['First para.', 'Second para.'],
    caption: 'A caption.',
    ...over,
  };
}

describe('effectiveCopy', () => {
  it('lets edits win over the catalog copy', () => {
    const c = effectiveCopy(piece(), {
      hooks: ['Edited hook.'],
      caption: 'Edited caption.',
      body: 'Edited body.',
    });
    expect(c).toEqual({
      hooks: ['Edited hook.'],
      caption: 'Edited caption.',
      body: 'Edited body.',
    });
  });

  it('falls back to the catalog, joining body paragraphs on a blank line', () => {
    const c = effectiveCopy(piece(), undefined);
    expect(c.hooks).toEqual(['A plain hook.']);
    expect(c.caption).toBe('A caption.');
    expect(c.body).toBe('First para.\n\nSecond para.');
  });
});

describe('effectivePiece', () => {
  it('reflects edits and blanks the legacy single hook', () => {
    const p = effectivePiece(piece(), { hooks: ['H1', 'H2'], body: 'New.' });
    expect(p.hook).toBe('');
    expect(p.hooks).toEqual(['H1', 'H2']);
    expect(p.body).toEqual(['New.']);
  });
});

describe('isEditableField', () => {
  it('is true only for the fields the editor writes back', () => {
    expect(isEditableField('hook')).toBe(true);
    expect(isEditableField('hooks[0]')).toBe(true);
    expect(isEditableField('caption')).toBe(true);
    expect(isEditableField('body[2]')).toBe(true);
  });

  it('is false for catalog-only fields', () => {
    expect(isEditableField('cta')).toBe(false);
    expect(isEditableField('seo.metaTitle')).toBe(false);
    expect(isEditableField('tweets[1]')).toBe(false);
  });
});

describe('complianceFixPatch', () => {
  it('strips dashes and exclamation points from the editable copy', () => {
    const patch = complianceFixPatch(piece(), {
      hooks: ['A hook \u2014 with a dash.'],
      caption: 'Wow!',
      body: 'Body line.',
    });
    expect(patch.hooks).toEqual(['A hook, with a dash.']);
    expect(patch.caption).toBe('Wow.');
    expect(patch.body).toBeUndefined();
  });

  it('is empty when the live copy is already clean', () => {
    expect(complianceFixPatch(piece(), undefined)).toEqual({});
  });

  it('leaves banned words untouched (no deterministic fix)', () => {
    const patch = complianceFixPatch(piece(), { hooks: ['Time to thrive today.'] });
    expect(patch).toEqual({});
  });
});
