import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  normalizeGiphySticker,
  searchGiphyStickers,
} from '@/utils/integrations/giphy';

const RAW = {
  id: 'abc123',
  title: 'Fire sticker',
  images: {
    original: {
      url: 'https://media.giphy.com/media/abc123/giphy.gif',
      webp: 'https://media.giphy.com/media/abc123/giphy.webp',
      width: '480',
      height: '480',
    },
    fixed_width_still: {
      url: 'https://media.giphy.com/media/abc123/200w_s.gif',
      width: '200',
      height: '200',
    },
  },
};

describe('normalizeGiphySticker', () => {
  it('maps a full GIPHY sticker to the house shape', () => {
    const s = normalizeGiphySticker(RAW);
    expect(s).toEqual({
      id: 'abc123',
      title: 'Fire sticker',
      stillUrl: 'https://media.giphy.com/media/abc123/200w_s.gif',
      gifUrl: 'https://media.giphy.com/media/abc123/giphy.gif',
      webpUrl: 'https://media.giphy.com/media/abc123/giphy.webp',
      width: 480,
      height: 480,
    });
  });

  it('returns null without an id', () => {
    expect(normalizeGiphySticker({ ...RAW, id: undefined })).toBeNull();
    expect(normalizeGiphySticker(null)).toBeNull();
    expect(normalizeGiphySticker('nope')).toBeNull();
  });

  it('returns null with no usable image', () => {
    expect(normalizeGiphySticker({ id: 'x', images: {} })).toBeNull();
  });

  it('falls back to the gif when the still is missing, and a default title', () => {
    const s = normalizeGiphySticker({
      id: 'x',
      title: '',
      images: { original: { url: 'https://x/g.gif' } },
    });
    expect(s?.stillUrl).toBe('https://x/g.gif');
    expect(s?.title).toBe('Sticker');
  });
});

describe('searchGiphyStickers', () => {
  const KEY = 'GIPHY_API_KEY';
  let saved: string | undefined;
  beforeEach(() => {
    saved = process.env[KEY];
  });
  afterEach(() => {
    if (saved === undefined) delete process.env[KEY];
    else process.env[KEY] = saved;
  });

  it('errors clearly when GIPHY_API_KEY is missing (never a cryptic 401)', async () => {
    delete process.env[KEY];
    const r = await searchGiphyStickers('fire');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain('GIPHY_API_KEY');
      expect(r.status).toBe(500);
    }
  });

  it('errors on an empty query before hitting the network', async () => {
    process.env[KEY] = 'test-key';
    const r = await searchGiphyStickers('   ');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });
});
