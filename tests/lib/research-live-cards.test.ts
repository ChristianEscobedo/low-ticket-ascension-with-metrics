import { describe, it, expect } from 'vitest';

import {
  postsCard,
  commentsCard,
  reviewsCard,
  normalizeCards,
} from '@/lib/mothermode/research/liveCards';

/**
 * Live result cards (roadmap 2.2), pinned: the builders the executors call
 * and the defensive normalizer that defends stored traces at the JSONB
 * boundary.
 */

describe('postsCard', () => {
  const post = {
    caption: 'Day in the life of a mom of 3',
    likes: 4200,
    comments: 310,
    views: 98000,
    engagement: null,
    url: 'https://tiktok.com/@x/video/1',
    topComments: [
      { body: 'the 5pm chaos is real', score: 88 },
      { body: 'where is this planner', score: null },
    ],
  };

  it('carries meta, url, and nested comment lines', () => {
    const card = postsCard('tiktok · 1 post', [post]);
    expect(card.kind).toBe('posts');
    const item = card.items[0];
    expect(item.meta).toBe('4,200 likes · 310 comments · 98,000 views');
    expect(item.url).toBe('https://tiktok.com/@x/video/1');
    expect(item.lines).toEqual([
      'the 5pm chaos is real (88 pts)',
      'where is this planner',
    ]);
  });

  it('engagement rate wins the meta when it exists', () => {
    const card = postsCard('t', [{ ...post, engagement: 0.124 }]);
    expect(card.items[0].meta).toBe('12.4% engagement');
  });

  it('empty captions never crash the row', () => {
    expect(postsCard('t', [{ ...post, caption: '' }]).items[0].text).toBe(
      '(no caption)',
    );
  });
});

describe('commentsCard + reviewsCard', () => {
  it('comments carry scores', () => {
    const card = commentsCard('tiktok · 2 comments', [
      { body: 'same here', score: 42 },
      { body: 'me too', score: null },
    ]);
    expect(card.kind).toBe('comments');
    expect(card.items[0].meta).toBe('42 pts');
    expect(card.items[1].meta).toBe('');
  });

  it('reviews keep the low-star slice and join title+body', () => {
    const card = reviewsCard('Book · 2 reviews', [
      { stars: 2, title: 'Not for me', body: 'wanted examples' },
      { stars: null, title: '', body: 'ok' },
    ]);
    expect(card.kind).toBe('reviews');
    expect(card.items[0].text).toBe('Not for me — wanted examples');
    expect(card.items[0].meta).toBe('2★');
    expect(card.items[1].text).toBe('ok');
  });
});

describe('normalizeCards', () => {
  it('keeps valid cards, drops junk kinds and empty items', () => {
    const out = normalizeCards([
      postsCard('t', [
        {
          caption: 'c',
          likes: null,
          comments: null,
          views: null,
          engagement: null,
          url: null,
        },
      ]),
      { kind: 'banana', items: [{ text: 'x' }] },
      { kind: 'posts', items: [] },
      'junk',
      null,
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('posts');
    expect(out[0].items[0].text).toBe('c');
  });

  it('caps and one-lines stored payloads defensively', () => {
    const long = 'x'.repeat(500);
    const out = normalizeCards([
      {
        kind: 'comments',
        title: 't',
        items: Array.from({ length: 30 }, (_, i) => ({
          text: `${long}${i}`,
          meta: 42,
        })),
      },
    ]);
    expect(out[0].items.length).toBeLessThanOrEqual(15);
    expect(out[0].items[0].text.length).toBeLessThanOrEqual(240);
    expect(out[0].items[0].meta).toBe('');
  });

  it('returns [] for non-arrays', () => {
    expect(normalizeCards(undefined)).toEqual([]);
    expect(normalizeCards({})).toEqual([]);
  });
});
