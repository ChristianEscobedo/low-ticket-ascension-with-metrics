import { describe, expect, it } from 'vitest';
import { isCaptionVisibleAt } from '@/lib/mothermode/reel/captions';

describe('caption mute + visibility', () => {
  it('respects captionsOn false', () => {
    expect(isCaptionVisibleAt(1, { captionsOn: false })).toBe(false);
    expect(isCaptionVisibleAt(1, { captionsOn: true })).toBe(true);
  });
  it('mutes inside ranges', () => {
    const ov = { muteRanges: [{ fromSec: 2, toSec: 5 }] };
    expect(isCaptionVisibleAt(1, ov)).toBe(true);
    expect(isCaptionVisibleAt(2, ov)).toBe(false);
    expect(isCaptionVisibleAt(4.9, ov)).toBe(false);
    expect(isCaptionVisibleAt(5, ov)).toBe(true);
  });
  it('default visible', () => {
    expect(isCaptionVisibleAt(0, null)).toBe(true);
    expect(isCaptionVisibleAt(0, {})).toBe(true);
  });
});
