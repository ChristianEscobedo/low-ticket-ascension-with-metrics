import { describe, it, expect } from 'vitest';

import {
  mapMonidInputs,
  normalizeDiscovered,
  compactPayload,
  normalizeRedditThreads,
  normalizeRedditComments,
  normalizeAmazonProducts,
  normalizeAmazonReviews,
  sanitizeRapidApiHost,
  normalizeSocialPosts,
  engagementRate,
} from '@/lib/mothermode/research/scrapeNormalize';

/**
 * Scraper payloads are the least trustworthy input in the whole system:
 * endpoint schemas drift, fields rename, and half the shapes on the
 * marketplace are "array under some key". These tests pin the defensive
 * normalizers so a silent drift shows up here, not in a wrong artifact.
 */

describe('mapMonidInputs', () => {
  it('fills query and limit fields by name from a properties schema', () => {
    const out = mapMonidInputs({
      query: 'mom burnout',
      limit: 15,
      schema: {
        input_schema: {
          properties: {
            search_query: { type: 'string' },
            max_results: { type: 'number' },
            region: { type: 'string' },
          },
        },
      },
    });
    expect(out).toEqual({ search_query: 'mom burnout', max_results: 15 });
  });

  it('reads array-shaped input lists', () => {
    const out = mapMonidInputs({
      query: 'morning routine',
      limit: 10,
      schema: { inputs: [{ name: 'keyword' }, { name: 'count' }] },
    });
    expect(out).toEqual({ keyword: 'morning routine', count: 10 });
  });

  it('guarantees the query lands somewhere even with unknown fields', () => {
    const out = mapMonidInputs({
      query: 'q',
      limit: 5,
      schema: { input_schema: { properties: { foo: {}, bar: {} } } },
    });
    expect(out.query).toBe('q');
    expect(out.foo).toBeUndefined();
  });

  it('falls back to the common shape when there is no schema', () => {
    expect(mapMonidInputs({ query: 'q', limit: 8, schema: null })).toEqual({
      query: 'q',
      limit: 8,
    });
  });

  it('fills plural query fields as ARRAYS (strict actors 400 on bare strings)', () => {
    const out = mapMonidInputs({
      query: 'momlife',
      limit: 12,
      schema: {
        input_schema: { properties: { hashtags: {}, maxItems: {} } },
      },
    });
    expect(out).toEqual({ hashtags: ['momlife'], maxItems: 12 });
  });

  it('fills platform on unified endpoints (the surf-search 400 fix)', () => {
    const out = mapMonidInputs({
      query: 'overwhelmed',
      limit: 10,
      platform: 'reddit',
      schema: {
        input_schema: {
          properties: { query: {}, platform: {}, limit: {} },
        },
      },
    });
    expect(out.platform).toBe('reddit');
    // No schema at all: platform still rides along.
    const bare = mapMonidInputs({
      query: 'q',
      limit: 5,
      schema: null,
      platform: 'tiktok',
    });
    expect(bare).toEqual({ query: 'q', limit: 5, platform: 'tiktok' });
  });
});

describe('normalizeDiscovered', () => {
  it('reads every wrapped shape Monid might return', () => {
    const shapes = [
      [{ id: 'a' }],
      { endpoints: [{ endpoint: 'b' }] },
      { results: [{ slug: 'c' }] },
      { data: [{ id: 'd', name: 'D' }] },
    ];
    for (const [i, shape] of Array.from(shapes.entries())) {
      const list = normalizeDiscovered(shape);
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(['a', 'b', 'c', 'd'][i]);
    }
    expect(normalizeDiscovered({ nope: true })).toEqual([]);
  });
});

describe('compactPayload', () => {
  it('caps long payloads with a truncation marker', () => {
    const big = { items: 'x'.repeat(10_000) };
    const out = compactPayload(big, 500);
    expect(out.length).toBeLessThan(600);
    expect(out).toContain('[truncated');
  });

  it('passes small payloads through', () => {
    const out = compactPayload({ a: 1 }, 500);
    expect(out).toContain('"a": 1');
  });
});

describe('normalizeRedditThreads', () => {
  it('reads the old-reddit { kind, data } wrapper shape', () => {
    const threads = normalizeRedditThreads({
      data: {
        children: [
          {
            kind: 't3',
            data: {
              id: 'abc',
              title: 'How do you survive the 5pm meltdown?',
              subreddit: 'Parenting',
              score: 342,
              num_comments: 87,
              permalink: '/r/Parenting/comments/abc/how_do_you/',
              selftext: 'Every day at 5pm it falls apart.',
            },
          },
          { kind: 't3', data: { no_title: true } },
        ],
      },
    });
    expect(threads).toHaveLength(1);
    expect(threads[0]).toMatchObject({
      id: 'abc',
      subreddit: 'Parenting',
      score: 342,
      numComments: 87,
      url: 'https://www.reddit.com/r/Parenting/comments/abc/how_do_you/',
    });
    expect(threads[0].text).toContain('5pm');
  });

  it('reads results/items wrapper keys too', () => {
    for (const wrapper of [
      { results: [{ title: 'A', permalink: '/r/x/comments/1/a/' }] },
      { items: [{ title: 'B', permalink: '/r/x/comments/2/b/' }] },
      { data: { results: [{ title: 'C', permalink: '/r/x/comments/3/c/' }] } },
    ]) {
      expect(normalizeRedditThreads(wrapper).length).toBe(1);
    }
  });

  it('reads flat scraper shapes and passes absolute post urls through', () => {
    const threads = normalizeRedditThreads({
      posts: [
        {
          post_title: 'Working moms, what is your evening routine?',
          community: 'workingmoms',
          upvotes: '1.2k',
          comments: 210,
          post_url: 'https://www.reddit.com/r/workingmoms/comments/x1/evening/',
        },
      ],
    });
    expect(threads).toHaveLength(1);
    expect(threads[0].score).toBe(1200);
    expect(threads[0].url).toContain('workingmoms');
  });
});

describe('normalizeRedditComments', () => {
  it('reads comment lists, clamps bodies, respects the cap', () => {
    const comments = normalizeRedditComments(
      {
        comments: [
          { author: 'momof2', body: 'Snacks. Snacks are the answer.', score: 88 },
          { author: 'tired', body: `  Long\n\nbody ${'x'.repeat(500)}`, ups: 5 },
          { author: 'empty', body: '   ' },
          { author: 'fourth', body: 'four', score: 1 },
        ],
      },
      3,
    );
    expect(comments).toHaveLength(3);
    expect(comments[0].body).toBe('Snacks. Snacks are the answer.');
    expect(comments[1].body.length).toBeLessThanOrEqual(400);
    expect(comments[1].body).not.toContain('\n');
    expect(comments.map((c) => c.author)).not.toContain('empty');
  });
});

describe('mapMonidInputs (search vs thread modes)', () => {
  it('thread mode fills url-style fields with the thread link', () => {
    const out = mapMonidInputs({
      query: 'https://www.reddit.com/r/Parenting/comments/abc/x/',
      limit: 4,
      mode: 'thread',
      schema: {
        input_schema: {
          properties: { post_url: { type: 'string' }, max_comments: {} },
        },
      },
    });
    expect(out.post_url).toBe(
      'https://www.reddit.com/r/Parenting/comments/abc/x/',
    );
  });

  it('search mode NEVER fills url-style fields with the phrase (the reddit bug)', () => {
    const out = mapMonidInputs({
      query: 'overwhelmed mom',
      limit: 10,
      mode: 'search',
      schema: {
        input_schema: {
          properties: { url: { type: 'string' }, search_query: {}, limit: {} },
        },
      },
    });
    expect(out.search_query).toBe('overwhelmed mom');
    expect(out.url).toBeUndefined();
  });

  it('thread mode never fills search-style fields with the link', () => {
    const out = mapMonidInputs({
      query: 'https://www.reddit.com/r/x/comments/1/t/',
      limit: 4,
      mode: 'thread',
      schema: {
        input_schema: { properties: { query: {}, url: {} } },
      },
    });
    expect(out.url).toBe('https://www.reddit.com/r/x/comments/1/t/');
    expect(out.query).toBeUndefined();
  });
});

describe('normalizeSocialPosts + engagementRate (voice audit)', () => {
  it('maps apidojo-style posts with author follower counts', () => {
    const posts = normalizeSocialPosts({
      data: {
        posts: [
          {
            id: 'p1',
            caption: 'The 5pm routine that saves me',
            diggCount: '12.4k',
            commentCount: '1.2k',
            playCount: '800k',
            videoUrl: 'https://tiktok.com/@voice/video/1',
            createTimeISO: '2026-07-20T12:00:00Z',
            authorMeta: { fans: '500k' },
          },
          { no_caption_no_url: true },
        ],
      },
    });
    expect(posts).toHaveLength(1);
    expect(posts[0].likes).toBe(12_400);
    expect(posts[0].comments).toBe(1_200);
    expect(posts[0].views).toBe(800_000);
    expect(posts[0].authorFollowers).toBe(500_000);
    // (12.4k + 1.2k) / 500k = 2.72% engagement rate.
    expect(engagementRate(posts[0])).toBeCloseTo(0.0272, 3);
  });

  it('returns null engagement when follower count is unknown', () => {
    const posts = normalizeSocialPosts({
      items: [{ caption: 'x', likes: 100, comments: 10 }],
    });
    expect(posts).toHaveLength(1);
    expect(engagementRate(posts[0])).toBeNull();
  });
});

describe('sanitizeRapidApiHost', () => {
  it('strips scheme, path, and case from a pasted URL', () => {
    expect(
      sanitizeRapidApiHost('https://Real-Time-Amazon-Data.p.rapidapi.com/'),
    ).toBe('real-time-amazon-data.p.rapidapi.com');
    expect(sanitizeRapidApiHost('  real-time-amazon-data.p.rapidapi.com ')).toBe(
      'real-time-amazon-data.p.rapidapi.com',
    );
    expect(sanitizeRapidApiHost('https://example.com/some/path?x=1')).toBe(
      'example.com',
    );
  });

  it('strips a pasted header line (x-rapidapi-host: host)', () => {
    expect(
      sanitizeRapidApiHost('x-rapidapi-host: real-time-amazon-data.p.rapidapi.com'),
    ).toBe('real-time-amazon-data.p.rapidapi.com');
  });
});

describe('normalizeAmazonProducts', () => {
  it('maps the real-time-amazon-data search shape', () => {
    const products = normalizeAmazonProducts({
      data: {
        products: [
          {
            asin: 'B001',
            product_title: 'Mom Planner',
            product_star_rating: '4.6',
            product_num_ratings: 1200,
            product_price: '$14.99',
            product_url: 'https://amazon.com/dp/B001',
          },
          { no_asin: true },
        ],
      },
    });
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      asin: 'B001',
      title: 'Mom Planner',
      rating: 4.6,
      ratingsTotal: 1200,
    });
  });
});

describe('normalizeAmazonReviews', () => {
  it('maps reviews, clamps bodies, drops empty rows', () => {
    const reviews = normalizeAmazonReviews({
      data: {
        reviews: [
          {
            review_star_rating: '1.0',
            review_title: 'Not for working moms',
            review_comment: `  Way  too\n\nlong. ${'x'.repeat(500)}`,
            review_date: 'June 2026',
            is_verified_purchase: true,
          },
          { review_title: '' },
        ],
      },
    });
    expect(reviews).toHaveLength(1);
    expect(reviews[0].stars).toBe(1);
    expect(reviews[0].body.length).toBeLessThanOrEqual(400);
    expect(reviews[0].body).not.toContain('\n');
    expect(reviews[0].verified).toBe(true);
  });
});
