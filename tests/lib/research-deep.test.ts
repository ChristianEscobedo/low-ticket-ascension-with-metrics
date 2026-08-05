import { describe, it, expect } from 'vitest';

import {
  rollUpCommentLanguage,
  commentLanguageBlock,
} from '@/lib/mothermode/research/commentLanguage';
import {
  buildResearchToolDefs,
  DEEP_TOOL_NAMES,
} from '@/lib/mothermode/research/agent/toolDefs';

/**
 * Deep research mode has two testable contracts that never touch a paid
 * integration: the deterministic comment-language rollup (counts are real,
 * so the tests pin the counting) and the tool-list filtering (standard = 8,
 * deep = 11, and a standard session never even SEES the deep tools).
 */

describe('rollUpCommentLanguage', () => {
  it('surfaces repeated phrases with real counts', () => {
    const rollup = rollUpCommentLanguage([
      { author: 'a', body: 'The evening routine is killing me', score: 10 },
      { author: 'b', body: 'My evening routine falls apart every night', score: 4 },
      { author: 'c', body: 'evening routine? I gave up on ours', score: 2 },
    ]);
    const phrase = rollup.phrases.find((p) => p.phrase === 'evening routine');
    expect(phrase).toBeDefined();
    expect(phrase?.count).toBe(3);
    expect(rollup.commentCount).toBe(3);
  });

  it('ignores one-off wording (an anecdote is not a pattern)', () => {
    const rollup = rollUpCommentLanguage([
      { author: 'a', body: 'Bathtime is a war zone here', score: 1 },
      { author: 'b', body: 'Totally different words entirely', score: 1 },
    ]);
    expect(rollup.phrases).toEqual([]);
  });

  it('drops stopwords, links, and hashtag filler from the counts', () => {
    const rollup = rollUpCommentLanguage([
      { author: 'a', body: 'This is the best https://x.com #momlife', score: 1 },
      { author: 'b', body: 'lol omg yes', score: 1 },
    ]);
    expect(rollup.phrases).toEqual([]);
  });

  it('lets a longer swallow a shorter phrase with the same count', () => {
    const rollup = rollUpCommentLanguage([
      { author: 'a', body: 'carrying the mental load alone', score: 3 },
      { author: 'b', body: 'carrying the mental load every day', score: 3 },
    ]);
    const trigram = rollup.phrases.find(
      (p) => p.phrase === 'carrying mental load',
    );
    const bigram = rollup.phrases.find((p) => p.phrase === 'mental load');
    expect(trigram).toBeDefined();
    expect(bigram).toBeUndefined();
  });

  it('collects literal questions, best scored first, deduped', () => {
    const rollup = rollUpCommentLanguage([
      { author: 'a', body: 'Where do I get this?', score: 1 },
      { author: 'b', body: 'Where do I get this?', score: 9 },
      { author: 'c', body: 'Does it work for toddlers?', score: 5 },
      { author: 'd', body: 'No question here', score: 50 },
    ]);
    expect(rollup.questions).toEqual([
      'Where do I get this?',
      'Does it work for toddlers?',
    ]);
  });

  it('degrades cleanly on empty input', () => {
    expect(rollUpCommentLanguage([])).toEqual({
      commentCount: 0,
      phrases: [],
      questions: [],
    });
  });
});

describe('commentLanguageBlock', () => {
  it('renders phrases and questions with the honesty header', () => {
    const block = commentLanguageBlock({
      commentCount: 12,
      phrases: [{ phrase: 'evening routine', count: 4 }],
      questions: ['Where do I get this?'],
    });
    expect(block).toContain('12 comments mined');
    expect(block).toContain('"evening routine" x4');
    expect(block).toContain('? Where do I get this?');
  });

  it('is empty when there is nothing worth showing', () => {
    expect(
      commentLanguageBlock({ commentCount: 3, phrases: [], questions: [] }),
    ).toBe('');
  });
});

describe('buildResearchToolDefs', () => {
  const CORE_NAMES = [
    'web_search',
    'social_search',
    'voice_audit',
    'reddit_deep_dive',
    'amazon_reviews',
    'internal_metrics',
    'get_context',
    'create_artifact',
  ];

  it('standard depth is the everyday eight, unchanged', () => {
    const names = buildResearchToolDefs().map((d) => d.name);
    expect(names).toEqual(CORE_NAMES);
    expect(buildResearchToolDefs({ deep: false }).map((d) => d.name)).toEqual(
      CORE_NAMES,
    );
  });

  it('deep depth appends exactly the three deep tools, core order intact', () => {
    const names = buildResearchToolDefs({ deep: true }).map((d) => d.name);
    expect(names).toHaveLength(11);
    expect(names.slice(0, 8)).toEqual(CORE_NAMES);
    expect(names.slice(8)).toEqual([...DEEP_TOOL_NAMES]);
  });

  it('deep tool schemas require what the executor reads', () => {
    const defs = buildResearchToolDefs({ deep: true });
    const topPosts = defs.find((d) => d.name === 'top_posts');
    const postComments = defs.find((d) => d.name === 'post_comments');
    const deepDive = defs.find((d) => d.name === 'voice_deep_dive');
    expect(topPosts?.inputSchema.required).toEqual(['platform', 'query']);
    expect(postComments?.inputSchema.required).toEqual(['platform', 'url']);
    expect(deepDive?.inputSchema.required).toEqual(['handle', 'platform']);
  });

  it('no deep tool leaks into the standard list', () => {
    const names = buildResearchToolDefs().map((d) => d.name);
    for (const deepName of DEEP_TOOL_NAMES) {
      expect(names).not.toContain(deepName);
    }
  });
});
