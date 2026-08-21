import { describe, expect, it } from 'vitest';
import { normalizeLottieFile } from '@/utils/integrations/lottiefiles';

describe('normalizeLottieFile', () => {
  it('maps a full node', () => {
    expect(
      normalizeLottieFile({
        id: 'a1',
        name: 'Confetti',
        jsonUrl: 'https://x.json',
        imageUrl: 'https://x.png',
      }),
    ).toEqual({ id: 'a1', name: 'Confetti', jsonUrl: 'https://x.json', imageUrl: 'https://x.png' });
  });

  it('drops nodes without a playable jsonUrl', () => {
    expect(normalizeLottieFile({ id: 'a1', name: 'X' })).toBeNull();
    expect(normalizeLottieFile(null)).toBeNull();
    expect(normalizeLottieFile({ id: 'a1', jsonUrl: '' })).toBeNull();
  });

  it('defaults the name and tolerates a missing preview image', () => {
    expect(normalizeLottieFile({ id: 'a1', jsonUrl: 'https://x.json' })).toEqual({
      id: 'a1',
      name: 'Lottie',
      jsonUrl: 'https://x.json',
      imageUrl: '',
    });
  });
});
