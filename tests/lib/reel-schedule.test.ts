import { describe, expect, it } from 'vitest';
import {
  REEL_PLATFORMS,
  ALL_POST_TYPE_IDS,
  platformFor,
  postTypeFor,
  platformForPostType,
  lengthBudgetFor,
  aspectFor,
  postTypeLabel,
  isStoryType,
  similarPlatforms,
  utmForReel,
  utmSourceFor,
  validateScheduleSettings,
  allChecksPass,
  defaultPostType,
  platformTypeLabel,
} from '@/lib/mothermode/reel/schedule';

describe('reel schedule platform catalog', () => {
  it('has all six platforms', () => {
    expect(REEL_PLATFORMS.map((p) => p.id)).toEqual([
      'youtube',
      'tiktok',
      'instagram',
      'facebook',
      'x',
      'linkedin',
    ]);
  });

  it('has all post type ids', () => {
    expect(ALL_POST_TYPE_IDS).toContain('shorts');
    expect(ALL_POST_TYPE_IDS).toContain('reels');
    expect(ALL_POST_TYPE_IDS).toContain('fbstory');
    expect(ALL_POST_TYPE_IDS).toContain('listory');
    expect(ALL_POST_TYPE_IDS).toContain('x');
  });

  it('finds a platform by id', () => {
    expect(platformFor('youtube')?.label).toBe('YouTube');
    expect(platformFor('nope')).toBeNull();
    expect(platformFor(null)).toBeNull();
  });

  it('finds a post type by id', () => {
    expect(postTypeFor('shorts')?.label).toBe('Shorts');
    expect(postTypeFor('shorts')?.aspect).toBe('9:16');
    expect(postTypeFor('shorts')?.targetSec).toBe(60);
    expect(postTypeFor('shorts')?.maxSec).toBe(180);
    expect(postTypeFor('nope')).toBeNull();
  });

  it('finds the platform for a post type', () => {
    expect(platformForPostType('shorts')?.id).toBe('youtube');
    expect(platformForPostType('reels')?.id).toBe('instagram');
    expect(platformForPostType('nope')).toBeNull();
  });

  it('returns length budgets', () => {
    expect(lengthBudgetFor('shorts')).toEqual({ target: 60, max: 180 });
    expect(lengthBudgetFor('ytfeed')).toEqual({ target: 180, max: 0 });
    expect(lengthBudgetFor('nope')).toEqual({ target: 60, max: 0 });
  });

  it('returns aspect ratios', () => {
    expect(aspectFor('shorts')).toBe('9:16');
    expect(aspectFor('ytfeed')).toBe('16:9');
    expect(aspectFor('nope')).toBe('9:16');
  });

  it('returns post type labels', () => {
    expect(postTypeLabel('shorts')).toBe('Shorts');
    expect(postTypeLabel('nope')).toBe('nope');
    expect(postTypeLabel(null)).toBe('Reel');
  });

  it('detects story types', () => {
    expect(isStoryType('fbstory')).toBe(true);
    expect(isStoryType('listory')).toBe(true);
    expect(isStoryType('shorts')).toBe(false);
  });

  it('clusters similar platforms by aspect', () => {
    const vertical = similarPlatforms('shorts').map((p) => p.id);
    expect(vertical).toContain('youtube');
    expect(vertical).toContain('tiktok');
    expect(vertical).toContain('instagram');
    expect(vertical).toContain('facebook');
    expect(vertical).not.toContain('x');
    expect(vertical).not.toContain('linkedin');

    const horizontal = similarPlatforms('ytfeed').map((p) => p.id);
    expect(horizontal).toContain('youtube');
    expect(horizontal).toContain('facebook');
    expect(horizontal).toContain('x');
    expect(horizontal).toContain('linkedin');
    expect(horizontal).not.toContain('tiktok');
    expect(horizontal).not.toContain('instagram');

    const stories = similarPlatforms('fbstory').map((p) => p.id);
    expect(stories).toEqual(['facebook', 'linkedin']);
  });
});

describe('reel schedule UTM', () => {
  it('derives UTM from platform and piece id', () => {
    const utm = utmForReel({
      platform: 'youtube',
      typeId: 'shorts',
      pieceId: 'manual_20260803_abcde',
    });
    expect(utm.source).toBe('youtube');
    expect(utm.medium).toBe('organic_social');
    expect(utm.campaign).toBe('general');
    expect(utm.content).toBe('manual_20260803_abcde');
  });

  it('uses funnel slug as campaign', () => {
    const utm = utmForReel({
      platform: 'tiktok',
      typeId: 'tiktok',
      pieceId: 'plan_123',
      funnelSlug: 'mindshift',
    });
    expect(utm.campaign).toBe('mindshift');
  });

  it('returns slugified source', () => {
    expect(utmSourceFor('YouTube')).toBe('youtube');
    expect(utmSourceFor('')).toBe('direct');
  });
});

describe('reel schedule settings validation', () => {
  it('passes when aspect and length match', () => {
    const checks = validateScheduleSettings({
      platform: 'youtube',
      typeId: 'shorts',
      durationSec: 45,
      aspect: '9:16',
    });
    expect(allChecksPass(checks)).toBe(true);
  });

  it('warns on aspect mismatch', () => {
    const checks = validateScheduleSettings({
      platform: 'youtube',
      typeId: 'shorts',
      durationSec: 45,
      aspect: '16:9',
    });
    expect(allChecksPass(checks)).toBe(false);
    expect(checks[0].label).toBe('Aspect ratio');
    expect(checks[0].ok).toBe(false);
  });

  it('fails when over the hard cap', () => {
    const checks = validateScheduleSettings({
      platform: 'instagram',
      typeId: 'reels',
      durationSec: 120,
      aspect: '9:16',
    });
    expect(allChecksPass(checks)).toBe(false);
    expect(checks.some((c) => c.label === 'Length' && !c.ok)).toBe(true);
  });

  it('fails when a long reel goes to a story', () => {
    const checks = validateScheduleSettings({
      platform: 'facebook',
      typeId: 'fbstory',
      durationSec: 30,
      aspect: '9:16',
    });
    expect(allChecksPass(checks)).toBe(false);
    expect(checks.some((c) => c.label === 'Story format' && !c.ok)).toBe(true);
  });

  it('passes when a short reel goes to a story', () => {
    const checks = validateScheduleSettings({
      platform: 'facebook',
      typeId: 'fbstory',
      durationSec: 12,
      aspect: '9:16',
    });
    expect(allChecksPass(checks)).toBe(true);
  });
});

describe('reel schedule helpers', () => {
  it('returns default post type for a platform', () => {
    expect(defaultPostType('youtube')).toBe('shorts');
    expect(defaultPostType('tiktok')).toBe('tiktok');
    expect(defaultPostType('nope')).toBe('reels');
  });

  it('returns platform + type labels', () => {
    expect(platformTypeLabel('youtube', 'shorts')).toBe('YouTube Shorts');
    expect(platformTypeLabel('tiktok', 'tiktok')).toBe('TikTok For You');
    expect(platformTypeLabel('nope', 'nope')).toBe('Reel');
  });
});