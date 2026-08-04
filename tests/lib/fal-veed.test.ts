import { describe, it, expect } from 'vitest';
import { buildVeedSubtitlePayload } from '@/utils/integrations/fal-veed';

describe('buildVeedSubtitlePayload', () => {
  it('defaults to word-level karaoke with no style when settings are empty', () => {
    expect(buildVeedSubtitlePayload('https://cdn.example.com/a.mp4')).toEqual({
      video_url: 'https://cdn.example.com/a.mp4',
      subtitle_type: 'word',
    });
  });

  it('maps the full settings surface into the snake_case style object', () => {
    expect(
      buildVeedSubtitlePayload('https://cdn.example.com/a.mp4', {
        subtitleType: 'line',
        font: 'Archivo Black',
        fontSize: 32,
        fontColor: '#ffd400',
        backgroundColor: '#000000',
        backgroundOpacity: 0.75,
        position: 'center',
        outlineColor: '#111111',
        outlineWidth: 2,
      }),
    ).toEqual({
      video_url: 'https://cdn.example.com/a.mp4',
      subtitle_type: 'line',
      style: {
        font: 'Archivo Black',
        font_size: 32,
        font_color: '#ffd400',
        background_color: '#000000',
        background_opacity: 0.75,
        position: 'center',
        outline_color: '#111111',
        outline_width: 2,
      },
    });
  });

  it('omits undefined style fields (veed defaults apply)', () => {
    expect(
      buildVeedSubtitlePayload('https://cdn.example.com/a.mp4', {
        fontColor: '#ffffff',
        backgroundOpacity: 0,
      }),
    ).toEqual({
      video_url: 'https://cdn.example.com/a.mp4',
      subtitle_type: 'word',
      style: { font_color: '#ffffff', background_opacity: 0 },
    });
  });
});
