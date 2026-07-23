import { describe, it, expect } from 'vitest';
import { buildComposePayload } from '@/utils/integrations/fal-ffmpeg';

describe('buildComposePayload', () => {
  it('lays clips end to end on a single video track', () => {
    const payload = buildComposePayload({
      clips: [
        { url: 'https://a/1.mp4', durationSec: 15 },
        { url: 'https://a/2.mp4', durationSec: 18 },
      ],
    });
    const tracks = payload.tracks as any[];
    expect(tracks).toHaveLength(1);
    expect(tracks[0].type).toBe('video');
    const kf = tracks[0].keyframes;
    expect(kf[0]).toMatchObject({ url: 'https://a/1.mp4', timestamp: 0, duration: 15 });
    // Second clip starts exactly where the first ended.
    expect(kf[1]).toMatchObject({ url: 'https://a/2.mp4', timestamp: 15, duration: 18 });
  });

  it('adds a voiceover audio track spanning the full runtime', () => {
    const payload = buildComposePayload({
      clips: [
        { url: 'https://a/1.mp4', durationSec: 10 },
        { url: 'https://a/2.mp4', durationSec: 20 },
      ],
      audioUrl: 'https://a/v.mp3',
    });
    const tracks = payload.tracks as any[];
    expect(tracks).toHaveLength(2);
    const audio = tracks.find((t) => t.type === 'audio');
    expect(audio).toBeTruthy();
    expect(audio.keyframes[0]).toMatchObject({
      url: 'https://a/v.mp3',
      timestamp: 0,
      duration: 30,
    });
  });

  it('omits the audio track when no voiceover is present', () => {
    const payload = buildComposePayload({
      clips: [{ url: 'https://a/1.mp4', durationSec: 5 }],
    });
    const tracks = payload.tracks as any[];
    expect(tracks.every((t) => t.type !== 'audio')).toBe(true);
  });
});
