import { describe, it, expect } from 'vitest';
import {
  ALL_VEED_PRESETS,
  VEED_BASIC_PRESETS,
  VEED_DYNAMIC_PRESETS,
  VEED_EXAMPLE_VIDEO_URL,
  veedCostEstimate,
  veedCostMultiplier,
  veedPresetFor,
  veedResolutionMultiplier,
  veedTierMultiplier,
} from '@/lib/mothermode/reel/veedPresets';

describe('veed presets', () => {
  it('has 21 basic and 9 dynamic presets with unique ids', () => {
    expect(VEED_BASIC_PRESETS).toHaveLength(21);
    expect(VEED_DYNAMIC_PRESETS).toHaveLength(9);
    const ids = ALL_VEED_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(30);
  });

  it('basic presets are all tier basic; dynamic presets are all tier dynamic', () => {
    expect(VEED_BASIC_PRESETS.every((p) => p.tier === 'basic')).toBe(true);
    expect(VEED_DYNAMIC_PRESETS.every((p) => p.tier === 'dynamic')).toBe(true);
  });

  it('backdrop and backdrop2 are in the dynamic tier (text-behind subtitles)', () => {
    const ids = VEED_DYNAMIC_PRESETS.map((p) => p.id);
    expect(ids).toContain('backdrop');
    expect(ids).toContain('backdrop2');
  });

  it('the example video URL is the official preset compilation', () => {
    expect(VEED_EXAMPLE_VIDEO_URL).toContain('substyle-example-output-compilation');
    expect(VEED_EXAMPLE_VIDEO_URL).toMatch(/^https:\/\//);
  });

  it('tier multipliers: basic 1×, dynamic 2×', () => {
    expect(veedTierMultiplier('basic')).toBe(1);
    expect(veedTierMultiplier('dynamic')).toBe(2);
  });

  it('resolution multipliers: 1080p 1×, 4k 2×', () => {
    expect(veedResolutionMultiplier('1080p')).toBe(1);
    expect(veedResolutionMultiplier('4k')).toBe(2);
  });

  it('cost multiplier compounds tier × resolution (4K Dynamic = 4×)', () => {
    expect(veedCostMultiplier('glass', '4k')).toBe(4); // dynamic 2× × 4k 2×
    expect(veedCostMultiplier('glass', '1080p')).toBe(2); // dynamic 2×
    expect(veedCostMultiplier('simple', '4k')).toBe(2); // basic 1× × 4k 2×
    expect(veedCostMultiplier('simple', '1080p')).toBe(1); // basic 1×
  });

  it('unknown preset ids fall back to basic 1× cost', () => {
    expect(veedCostMultiplier('not-a-preset', '1080p')).toBe(1);
    expect(veedCostMultiplier('not-a-preset', '4k')).toBe(2);
  });

  it('veedPresetFor looks up a preset and falls back to the first basic', () => {
    expect(veedPresetFor('backdrop').tier).toBe('dynamic');
    expect(veedPresetFor('nope').id).toBe(VEED_BASIC_PRESETS[0].id);
  });

  it('cost estimate: 60s at 1× base = $0.10; 60s at 4× = $0.40', () => {
    expect(veedCostEstimate({ presetId: 'simple', resolution: '1080p', durationSec: 60 })).toBe(0.1);
    expect(veedCostEstimate({ presetId: 'glass', resolution: '4k', durationSec: 60 })).toBe(0.4);
    expect(veedCostEstimate({ presetId: 'simple', resolution: '1080p', durationSec: 0 })).toBe(0);
  });
});
