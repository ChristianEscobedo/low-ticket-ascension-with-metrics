import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { normalizePexelsClip, searchPexelsVideos } from '@/utils/integrations/pexels';

const RAW = {
  id: 1234567,
  width: 1080,
  height: 1920,
  duration: 12.4,
  image: 'https://images.pexels.com/videos/1234567/poster.jpeg',
  video_files: [
    { id: 1, quality: 'sd', width: 360, height: 640, link: 'https://v.pexels.com/sd.mp4' },
    { id: 2, quality: 'hd', width: 1080, height: 1920, link: 'https://v.pexels.com/hd.mp4' },
    { id: 3, quality: 'hd', width: 2160, height: 3840, link: 'https://v.pexels.com/4k.mp4' },
  ],
};

describe('normalizePexelsClip', () => {
  it('maps a full Pexels video to the house shape, picking the ≤1920 HD file', () => {
    const c = normalizePexelsClip(RAW);
    expect(c).toEqual({
      id: '1234567',
      durationSec: 12,
      width: 1080,
      height: 1920,
      videoUrl: 'https://v.pexels.com/hd.mp4', // the ≤1920 HD file, never the 4K
      thumbUrl: 'https://images.pexels.com/videos/1234567/poster.jpeg',
    });
  });

  it('returns null without an id or a usable file', () => {
    expect(normalizePexelsClip({ ...RAW, id: undefined })).toBeNull();
    expect(normalizePexelsClip(null)).toBeNull();
    expect(normalizePexelsClip({ id: 1, video_files: [] })).toBeNull();
  });

  it('falls back to the smallest file when every file is above 1920', () => {
    const c = normalizePexelsClip({
      id: 9,
      duration: 5,
      video_files: [{ id: 1, quality: 'hd', width: 2160, height: 3840, link: 'https://v.pexels.com/4k.mp4' }],
    });
    expect(c?.videoUrl).toBe('https://v.pexels.com/4k.mp4');
  });
});

describe('searchPexelsVideos', () => {
  const KEY = 'PEXELS_API_KEY';
  let saved: string | undefined;
  beforeEach(() => {
    saved = process.env[KEY];
  });
  afterEach(() => {
    if (saved === undefined) delete process.env[KEY];
    else process.env[KEY] = saved;
  });

  it('errors clearly when PEXELS_API_KEY is missing (never a cryptic 401)', async () => {
    delete process.env[KEY];
    const r = await searchPexelsVideos('money');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain('PEXELS_API_KEY');
      expect(r.status).toBe(500);
    }
  });

  it('errors on an empty query before hitting the network', async () => {
    process.env[KEY] = 'test-key';
    const r = await searchPexelsVideos('   ');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });
});
