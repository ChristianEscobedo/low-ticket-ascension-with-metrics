import { describe, it, expect } from 'vitest';
import {
  htmlToPromptText,
  looksLikeHtml,
  kitTextForPrompt,
} from '@/lib/mothermode/richtext';

describe('htmlToPromptText', () => {
  it('passes plain text through unchanged', () => {
    expect(htmlToPromptText('Just plain copy.')).toBe('Just plain copy.');
  });

  it('strips inline formatting tags', () => {
    expect(htmlToPromptText('<p>Hello <strong>bold</strong> <em>italic</em></p>')).toBe(
      'Hello bold italic',
    );
  });

  it('turns paragraphs into blank-line separated blocks', () => {
    expect(htmlToPromptText('<p>One</p><p>Two</p>')).toBe('One\n\nTwo');
  });

  it('converts <br> to a single newline', () => {
    expect(htmlToPromptText('<p>Line one<br>Line two</p>')).toBe('Line one\nLine two');
  });

  it('bullets list items', () => {
    const out = htmlToPromptText('<ul><li>First</li><li>Second</li></ul>');
    expect(out).toBe('- First\n- Second');
  });

  it('keeps link targets when they add information', () => {
    expect(
      htmlToPromptText('<p>Read the <a href="https://x.co/guide">guide</a></p>'),
    ).toBe('Read the guide (https://x.co/guide)');
  });

  it('decodes entities', () => {
    expect(htmlToPromptText('<p>Tom &amp; Jerry &#39;95</p>')).toBe("Tom & Jerry '95");
  });

  it('drops script/style content', () => {
    expect(htmlToPromptText('<p>ok</p><script>alert(1)</script>')).toBe('ok');
  });
});

describe('looksLikeHtml', () => {
  it('detects tags', () => {
    expect(looksLikeHtml('<p>x</p>')).toBe(true);
    expect(looksLikeHtml('plain')).toBe(false);
  });
});

describe('kitTextForPrompt', () => {
  it('handles null/undefined', () => {
    expect(kitTextForPrompt(null)).toBe('');
    expect(kitTextForPrompt(undefined)).toBe('');
  });

  it('flattens html but trims plain text', () => {
    expect(kitTextForPrompt('  spaced  ')).toBe('spaced');
    expect(kitTextForPrompt('<p>x <b>y</b></p>')).toBe('x y');
  });
});
