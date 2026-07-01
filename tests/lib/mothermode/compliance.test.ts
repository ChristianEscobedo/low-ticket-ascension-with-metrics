import { describe, it, expect } from 'vitest';
import {
  checkText,
  isCompliant,
  passesHardRules,
  applyFixes,
  checkPiece,
} from '@/lib/mothermode/content/compliance';
import type { ContentPiece } from '@/lib/mothermode/content/types';

describe('checkText: dashes', () => {
  it('flags an em dash and an en dash as fixable errors', () => {
    const em = checkText('Both are true \u2014 enough.');
    expect(em).toHaveLength(1);
    expect(em[0]).toMatchObject({ rule: 'dash', severity: 'error', fixable: true });
    expect(checkText('9 \u2013 5')[0].rule).toBe('dash');
  });

  it('passes clean copy with no violations', () => {
    expect(isCompliant('Name what you are carrying. Then put it down.')).toBe(true);
  });
});

describe('checkText: banned words', () => {
  it('flags NO-list words and stems, with a suggestion where defined', () => {
    const v = checkText('We empower mothers to thrive.');
    expect(v.every((x) => x.rule === 'banned-word' && !x.fixable)).toBe(true);
    expect(v.map((x) => x.match).sort()).toEqual(['empower', 'thrive']);
    const empower = v.find((x) => x.match === 'empower');
    expect(empower?.suggestion).toBeTruthy();
    expect(checkText('empowering her')[0].match).toBe('empowering');
  });

  it('matches multi-word phrases, apostrophe insensitive', () => {
    expect(checkText('you\u2019ve got this')[0].rule).toBe('banned-word');
    expect(checkText("you've got this")[0].rule).toBe('banned-word');
  });

  it('does not flag the allowed "solution aware" but flags "solutions"', () => {
    expect(isCompliant('Reader is solution aware.')).toBe(true);
    expect(checkText('our solutions')[0].match).toBe('solutions');
  });
});

describe('checkText: exclamation and caps', () => {
  it('flags exclamation as a fixable warning', () => {
    const v = checkText('Welcome!');
    expect(v[0]).toMatchObject({ rule: 'exclamation', severity: 'warning', fixable: true });
  });

  it('flags 4+ letter ALL CAPS as a non-fixable warning, ignoring short acronyms', () => {
    expect(checkText('Run on the OS today.').some((x) => x.rule === 'all-caps')).toBe(
      false,
    );
    const v = checkText('This is URGENT.');
    expect(v[0]).toMatchObject({ rule: 'all-caps', severity: 'warning', fixable: false });
  });
});

describe('passesHardRules', () => {
  it('allows warnings but not errors', () => {
    expect(passesHardRules('Welcome!')).toBe(true);
    expect(passesHardRules('We empower her.')).toBe(false);
  });
});

describe('applyFixes', () => {
  it('replaces dashes and exclamation points and is idempotent', () => {
    const fixed = applyFixes('Both are true \u2014 enough! Now go!!!');
    expect(fixed).toBe('Both are true, enough. Now go.');
    expect(applyFixes(fixed)).toBe(fixed);
    expect(/[\u2014\u2013!]/.test(fixed)).toBe(false);
  });

  it('leaves banned words for a rewrite (does not delete them)', () => {
    expect(applyFixes('We empower her')).toContain('empower');
  });
});

describe('checkPiece', () => {
  const piece: ContentPiece = {
    id: 'x-1',
    platform: 'instagram',
    format: 'feed',
    kind: 'organic',
    tone: 'confidante',
    theme: 'Mental load',
    title: 'Test',
    hook: 'Both are true \u2014 enough.',
    cta: 'Empower yourself today!',
    body: ['One clean line.', 'Another clean line.'],
  };

  it('reports field-tagged violations and totals errors, warnings, fixables', () => {
    const r = checkPiece(piece);
    expect(r.ok).toBe(false);
    const fields = r.violations.map((v) => v.field);
    expect(fields).toContain('hook');
    expect(fields).toContain('cta');
    expect(r.errorCount).toBeGreaterThanOrEqual(2);
    expect(r.warningCount).toBeGreaterThanOrEqual(1);
    expect(r.fixableCount).toBeGreaterThanOrEqual(2);
  });

  it('passes a fully clean piece', () => {
    const clean: ContentPiece = {
      ...piece,
      hook: 'Name what you are carrying.',
      cta: 'Start the brain dump.',
    };
    expect(checkPiece(clean).ok).toBe(true);
  });
});
