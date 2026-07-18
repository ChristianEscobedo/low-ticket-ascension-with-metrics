import { describe, expect, it } from 'vitest';
import {
  checkPlatformHeuristics,
  scoreLocalCompliance,
  platformPackFor,
} from '@/lib/mothermode/content/platformCompliance';
import type { ContentPiece } from '@/lib/mothermode/content/types';

function base(over: Partial<ContentPiece> = {}): ContentPiece {
  return {
    id: 't1',
    platform: 'instagram',
    format: 'feed',
    kind: 'organic',
    tone: 'confidante',
    theme: 'Mental load',
    title: 'Test',
    hook: 'The system is broken.',
    cta: 'Start with the $7 kit.',
    ...over,
  };
}

describe('platformCompliance', () => {
  it('maps platforms to packs', () => {
    expect(platformPackFor('facebook')).toBe('meta');
    expect(platformPackFor('instagram')).toBe('meta');
    expect(platformPackFor('tiktok')).toBe('tiktok');
    expect(platformPackFor('email')).toBe('email');
    expect(platformPackFor('blog')).toBe('google');
  });

  it('flags brand NO-list and scores down', () => {
    const card = scoreLocalCompliance(
      base({ hook: 'You will thrive on this journey, mama.' }),
    );
    expect(card.blockCount).toBeGreaterThan(0);
    expect(card.grade).toBe('fail');
    expect(card.issues.some((i) => i.source === 'brand')).toBe(true);
  });

  it('flags Meta ad personal-attribute language', () => {
    const issues = checkPlatformHeuristics(
      base({
        kind: 'ad',
        ad: {
          primaryText: 'Are you a depressed single mom struggling?',
          headline: 'Fix it',
          button: 'LEARN_MORE',
        },
      }),
    );
    expect(issues.some((i) => i.id.includes('personal-attr'))).toBe(true);
  });

  it('flags income guarantees on ads only', () => {
    const organic = checkPlatformHeuristics(
      base({ hook: 'Guaranteed results and passive income.' }),
    );
    const ad = checkPlatformHeuristics(
      base({
        kind: 'ad',
        ad: {
          primaryText: 'Guaranteed results and passive income.',
          headline: 'Earn',
          button: 'SHOP_NOW',
        },
      }),
    );
    expect(organic.some((i) => i.id.includes('guarantee'))).toBe(false);
    expect(ad.some((i) => i.id.includes('guarantee') || i.id.includes('income'))).toBe(
      true,
    );
  });

  it('passes clean copy', () => {
    const card = scoreLocalCompliance(
      base({
        hook: 'Six tabs open in your head. Nobody else can see them.',
        body: ['Name what you are carrying. Then hand one thing off.'],
      }),
    );
    expect(card.blockCount).toBe(0);
    expect(card.score).toBeGreaterThanOrEqual(85);
    expect(card.grade).toBe('pass');
  });
});
