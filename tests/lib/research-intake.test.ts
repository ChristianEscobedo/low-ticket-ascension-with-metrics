import { describe, it, expect } from 'vitest';

import {
  normalizeResearchIntake,
  intakeHasSeeds,
  blankIntake,
  extractAmazonAsin,
  amazonProductLink,
  classifySeedLink,
  intakeBriefBlock,
} from '@/lib/mothermode/research/intake';

/**
 * The intake is the agent's search steering, so the coverage pins the two
 * ways it can fail: junk in (defensive normalization, because a model wrote
 * half of it) and the link-drop routing (because a user pastes anything).
 */

describe('normalizeResearchIntake', () => {
  it('normalizes a full brief and strips r/ prefixes', () => {
    const i = normalizeResearchIntake({
      goal: 'decide the next offer',
      audience: 'overwhelmed moms',
      problemKeywords: ['mental load', '', 'mental load', '5pm chaos'],
      categoryKeywords: ['mom planner'],
      competitorProducts: ['Fair Play'],
      competitorVoices: [
        { handle: '@mothercould', platform: 'instagram', url: 'https://instagram.com/mothercould' },
        { handle: 'fake', platform: 'myspace' },
        'junk',
      ],
      subreddits: ['r/Parenting', 'workingmoms'],
      seedLinks: ['https://example.com'],
    });
    expect(i.problemKeywords).toEqual(['mental load', '5pm chaos']);
    expect(i.competitorVoices).toHaveLength(2);
    expect(i.competitorVoices[0].handle).toBe('mothercould');
    expect(i.competitorVoices[1].platform).toBe('');
    expect(i.subreddits).toEqual(['Parenting', 'workingmoms']);
  });

  it('degrades junk to blanks without throwing', () => {
    expect(normalizeResearchIntake('nope')).toEqual(blankIntake());
    expect(normalizeResearchIntake(null)).toEqual(blankIntake());
    expect(normalizeResearchIntake({ problemKeywords: 'mental load' }).problemKeywords).toEqual([]);
  });
});

describe('research depth', () => {
  it('defaults to standard on blank and junk intakes', () => {
    expect(blankIntake().depth).toBe('standard');
    expect(normalizeResearchIntake(null).depth).toBe('standard');
    expect(normalizeResearchIntake({ depth: 'extreme' }).depth).toBe(
      'standard',
    );
  });

  it('keeps deep only when it was explicitly saved', () => {
    expect(normalizeResearchIntake({ depth: 'deep' }).depth).toBe('deep');
    // A pre-depth session row (no depth key at all) is standard, never deep:
    // the paid lane is opt-in only.
    expect(normalizeResearchIntake({ goal: 'x' }).depth).toBe('standard');
  });
});

describe('intakeHasSeeds', () => {
  it('is false for a blank brief and true with any one seed', () => {
    expect(intakeHasSeeds(blankIntake())).toBe(false);
    expect(
      intakeHasSeeds({ ...blankIntake(), subreddits: ['Parenting'] }),
    ).toBe(true);
  });
});

describe('extractAmazonAsin', () => {
  it('reads /dp/, /gp/product/, and ignores non-ASIN paths', () => {
    expect(
      extractAmazonAsin('https://www.amazon.com/Fair-Play-Game-Changing-Solution/dp/0593081661/'),
    ).toBe('0593081661');
    expect(extractAmazonAsin('https://amazon.com/gp/product/B0C1D2E3F4?tag=x')).toBe('B0C1D2E3F4');
    expect(extractAmazonAsin('https://amazon.com/s?k=mom+planner')).toBeNull();
    expect(extractAmazonAsin('not a url')).toBeNull();
  });
});

describe('amazonProductLink', () => {
  it('uses the canonical /dp/ link for a certain ASIN', () => {
    expect(amazonProductLink('Fair Play', '0593081661')).toBe(
      'https://amazon.com/dp/0593081661',
    );
    expect(amazonProductLink('X', 'b0c1d2e3f4')).toBe(
      'https://amazon.com/dp/B0C1D2E3F4',
    );
  });

  it('falls back to an exact-title search URL (never a fabricated ASIN)', () => {
    const link = amazonProductLink("Mom's One Line a Day");
    expect(link).toContain('amazon.com/s?k=');
    expect(decodeURIComponent(link)).toContain("Mom's One Line a Day");
    expect(amazonProductLink('X', 'not-an-asin')).toContain('/s?k=');
  });
});

describe('classifySeedLink', () => {
  it('routes amazon links to products with ASIN', () => {
    const k = classifySeedLink('https://www.amazon.com/dp/0593081661');
    expect(k.kind).toBe('amazon-product');
    if (k.kind === 'amazon-product') expect(k.asin).toBe('0593081661');
  });

  it('routes social profiles with platform + handle', () => {
    const ig = classifySeedLink('https://www.instagram.com/mothercould/');
    expect(ig.kind).toBe('social-profile');
    if (ig.kind === 'social-profile') {
      expect(ig.platform).toBe('instagram');
      expect(ig.handle).toBe('mothercould');
    }
    const tt = classifySeedLink('https://www.tiktok.com/@momlife');
    if (tt.kind === 'social-profile') expect(tt.platform).toBe('tiktok');
  });

  it('routes subreddits and falls back to plain links', () => {
    const sub = classifySeedLink('https://www.reddit.com/r/workingmoms/');
    expect(sub.kind).toBe('subreddit');
    if (sub.kind === 'subreddit') expect(sub.name).toBe('workingmoms');
    expect(classifySeedLink('https://someblog.com/post').kind).toBe('link');
    expect(classifySeedLink('  ').kind).toBe('link');
  });
});

describe('intakeBriefBlock', () => {
  it('renders the brief with every section', () => {
    const block = intakeBriefBlock(
      normalizeResearchIntake({
        goal: 'decide next offer',
        problemKeywords: ['mental load'],
        categoryKeywords: ['mom planner'],
        competitorProducts: ['Fair Play'],
        competitorVoices: [{ handle: 'mothercould', platform: 'instagram', url: '' }],
        subreddits: ['Parenting'],
      }),
    );
    expect(block).toContain('ACTIVE RESEARCH BRIEF');
    expect(block).toContain('mental load');
    expect(block).toContain('mom planner');
    expect(block).toContain('Fair Play');
    expect(block).toContain('instagram/mothercould');
    expect(block).toContain('r/Parenting');
    // And the anti-footgun: the block instructs searching seeds, not the name.
    expect(block).toContain('never with the offer name');
  });

  it('is empty for a blank brief', () => {
    expect(intakeBriefBlock(blankIntake())).toBe('');
  });
});
