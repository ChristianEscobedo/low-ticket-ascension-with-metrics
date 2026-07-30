import { describe, it, expect } from 'vitest';
import {
  FORMAT_LABEL,
  PLATFORM_FORMATS,
  TEXT_POST_MAX_CHARS,
  TWEET_MAX_CHARS,
  DEFAULT_TWEET_NAME,
  DEFAULT_TWEET_HANDLE,
  textPostStyleFor,
  textPostFontScale,
  textPostDimensions,
  defaultTextPostAspect,
  fitsTextPost,
  tweetCardFor,
  tweetThemeColors,
  fitsTweet,
  type ContentPiece,
} from '@/lib/mothermode/content';

function piece(overrides: Partial<ContentPiece> = {}): ContentPiece {
  return {
    id: 't1',
    platform: 'facebook',
    format: 'textpost',
    kind: 'organic',
    tone: 'wedge',
    theme: 'The mental load',
    title: 'T',
    hook: 'A hook line.',
    cta: 'Go.',
    ...overrides,
  } as ContentPiece;
}

describe('textpost + tweet formats register everywhere', () => {
  it('labels resolve for both new formats', () => {
    expect(FORMAT_LABEL.textpost).toBe('Text overlay post');
    expect(FORMAT_LABEL.tweet).toBe('Twitter screen grab');
  });

  it('textpost is offered on tiktok, instagram, and facebook', () => {
    expect(PLATFORM_FORMATS.tiktok).toContain('textpost');
    expect(PLATFORM_FORMATS.instagram).toContain('textpost');
    expect(PLATFORM_FORMATS.facebook).toContain('textpost');
  });

  it('tweet is offered on instagram, facebook, and tiktok', () => {
    expect(PLATFORM_FORMATS.instagram).toContain('tweet');
    expect(PLATFORM_FORMATS.facebook).toContain('tweet');
    expect(PLATFORM_FORMATS.tiktok).toContain('tweet');
  });
});

describe('textpost style resolution', () => {
  it('defaults to the dark viral look with the platform aspect', () => {
    const style = textPostStyleFor(piece({ platform: 'tiktok' }));
    expect(style.bg).toBe('#1C1917');
    expect(style.aspect).toBe('9:16');
    expect(style.showHandle).toBe(true);
    expect(style.align).toBe('center');
  });

  it('explicit style wins over defaults', () => {
    const style = textPostStyleFor(
      piece({ textPost: { bg: '#532B3C', aspect: '1:1', align: 'left', showHandle: false } }),
    );
    expect(style.bg).toBe('#532B3C');
    expect(style.aspect).toBe('1:1');
    expect(style.align).toBe('left');
    expect(style.showHandle).toBe(false);
  });

  it('aspect default is vertical on tiktok and square elsewhere', () => {
    expect(defaultTextPostAspect('tiktok')).toBe('9:16');
    expect(defaultTextPostAspect('instagram')).toBe('1:1');
    expect(defaultTextPostAspect('facebook')).toBe('1:1');
  });

  it('dimensions map aspect to render pixels', () => {
    expect(textPostDimensions('9:16')).toEqual({ width: 1080, height: 1920 });
    expect(textPostDimensions('1:1')).toEqual({ width: 1080, height: 1080 });
  });
});

describe('textpost font scaling + fit', () => {
  it('stays full size when short, steps down as text lengthens', () => {
    const short = textPostFontScale('Short line.');
    const mid = textPostFontScale('x'.repeat(120));
    const long = textPostFontScale('x'.repeat(200));
    expect(short).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(long);
    expect(long).toBeGreaterThanOrEqual(0.55);
  });

  it('explicit fontScale multiplies the auto step, clamped', () => {
    const boosted = textPostFontScale('Short.', { bg: '#1C1917', fontScale: 1.4 });
    expect(boosted).toBeCloseTo(1.4, 5);
    const floored = textPostFontScale('x'.repeat(200), { bg: '#1C1917', fontScale: 0.5 });
    expect(floored).toBeGreaterThanOrEqual(0.55);
  });

  it('fitsTextPost honors the 220-char ceiling', () => {
    expect(fitsTextPost('x'.repeat(TEXT_POST_MAX_CHARS))).toBe(true);
    expect(fitsTextPost('x'.repeat(TEXT_POST_MAX_CHARS + 1))).toBe(false);
  });
});

describe('tweet card chrome resolution', () => {
  it('defaults to the brand identity with all chrome on, light theme', () => {
    const chrome = tweetCardFor(piece({ format: 'tweet' }));
    expect(chrome.name).toBe(DEFAULT_TWEET_NAME);
    expect(chrome.handle).toBe(DEFAULT_TWEET_HANDLE);
    expect(chrome.verified).toBe(true);
    expect(chrome.theme).toBe('light');
    expect(chrome.showMetrics).toBe(true);
    expect(chrome.showTimestamp).toBe(true);
  });

  it('per-piece overrides win and blank values fall back', () => {
    const chrome = tweetCardFor(
      piece({
        format: 'tweet',
        tweetCard: { name: 'Loni', theme: 'dark', showMetrics: false, handle: '  ' },
      }),
    );
    expect(chrome.name).toBe('Loni');
    expect(chrome.handle).toBe(DEFAULT_TWEET_HANDLE);
    expect(chrome.theme).toBe('dark');
    expect(chrome.showMetrics).toBe(false);
  });

  it('theme palettes differ and stay on-brand', () => {
    const light = tweetThemeColors('light');
    const dark = tweetThemeColors('dark');
    expect(light.backdrop).not.toBe(dark.backdrop);
    expect(light.avatarBg).toBe(dark.avatarBg);
    expect(light.badge).toBe(dark.badge);
  });

  it('fitsTweet honors the 280-char ceiling', () => {
    expect(fitsTweet('x'.repeat(TWEET_MAX_CHARS))).toBe(true);
    expect(fitsTweet('x'.repeat(TWEET_MAX_CHARS + 1))).toBe(false);
  });
});

describe('render guards', () => {
  it('canvas renders throw outside a browser', async () => {
    const { renderTextPostToDataUrl } = await import('@/lib/mothermode/content/textPost');
    const { renderTweetCardToDataUrl } = await import('@/lib/mothermode/content/tweetCard');
    await expect(renderTextPostToDataUrl({ text: 'hi' })).rejects.toThrow('browser');
    await expect(renderTweetCardToDataUrl({ text: 'hi' })).rejects.toThrow('browser');
  });
});
