import { describe, it, expect } from 'vitest';

import {
  collectPhraseItems,
  phraseBankRollup,
} from '@/lib/mothermode/research/phraseBank';
import type { ResearchMessage } from '@/lib/mothermode/research/types';
import type { ResearchEvidence } from '@/lib/mothermode/research/evidence';

/**
 * The phrase bank (roadmap 2.3), pinned: the corpus collection (cards +
 * evidence) and the windowed trend math. Deterministic, because "what is
 * the audience saying more of" is a number, not a vibe.
 */

const NOW = '2026-07-30T12:00:00.000Z';
const daysAgo = (n: number) =>
  new Date(new Date(NOW).getTime() - n * 86400000).toISOString();

function msgWithCardText(texts: string[], at: string | null): ResearchMessage {
  return {
    id: 'm1',
    sessionId: 's1',
    role: 'assistant',
    content: '',
    toolCalls: [
      {
        id: 'c1',
        name: 'post_comments',
        inputSummary: '',
        status: 'ok',
        resultSummary: '',
        ms: 1,
        cards: [
          {
            kind: 'comments',
            title: 't',
            items: texts.map((text) => ({ text, meta: '', url: '', lines: [] })),
          },
        ],
      },
    ],
    model: '',
    expertSlug: '',
    recipeRunId: '',
    recipeStepIndex: null,
    createdAt: at,
  };
}

function ev(body: string, at: string | null): ResearchEvidence {
  return {
    id: `e_${body}`,
    sessionId: 's1',
    artifactId: '',
    offerSlug: '',
    kind: 'phrase',
    body,
    sourceUrl: '',
    sourceTool: '',
    expert: '',
    createdBy: 'owner',
    createdAt: at,
  };
}

describe('collectPhraseItems', () => {
  it('collects card texts, nested lines, and evidence with their dates', () => {
    const items = collectPhraseItems({
      messages: [
        {
          ...msgWithCardText([], daysAgo(2)),
          toolCalls: [
            {
              id: 'c',
              name: 'voice_audit',
              inputSummary: '',
              status: 'ok',
              resultSummary: '',
              ms: 1,
              cards: [
                {
                  kind: 'posts',
                  title: 't',
                  items: [
                    {
                      text: 'post caption',
                      meta: '',
                      url: '',
                      lines: ['comment one', 'comment two'],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      evidence: [ev('mental load', daysAgo(1))],
    });
    expect(items.map((i) => i.text)).toEqual([
      'post caption',
      'comment one',
      'comment two',
      'mental load',
    ]);
    expect(items[0].at).toBe(daysAgo(2));
    expect(items[3].at).toBe(daysAgo(1));
  });
});

describe('phraseBankRollup', () => {
  it('counts a new phrase as new when it only repeats this week', () => {
    const items = [
      { text: 'witching hour witching hour', at: daysAgo(1), score: null },
      { text: 'the witching hour again', at: daysAgo(2), score: null },
    ];
    const rows = phraseBankRollup({ items, now: NOW });
    const row = rows.find((r) => r.phrase === 'witching hour');
    expect(row).toBeDefined();
    expect(row!.recent).toBeGreaterThan(0);
    expect(row!.prior).toBe(0);
    expect(row!.trend).toBe('new');
  });

  it('splits recent vs prior windows and trends down', () => {
    const items = [
      { text: 'mental load mental load', at: daysAgo(10), score: null },
      { text: 'the mental load', at: daysAgo(9), score: null },
      { text: 'mental load', at: daysAgo(1), score: null },
    ];
    const rows = phraseBankRollup({ items, now: NOW });
    const row = rows.find((r) => r.phrase === 'mental load');
    expect(row!.prior).toBeGreaterThan(row!.recent);
    expect(row!.trend).toBe('down');
  });

  it('undated items ride the prior bucket, never the recent trend', () => {
    const items = [
      { text: 'mental load mental load', at: null, score: null },
      { text: 'mental load', at: null, score: null },
    ];
    const rows = phraseBankRollup({ items, now: NOW });
    const row = rows.find((r) => r.phrase === 'mental load');
    expect(row!.recent).toBe(0);
    expect(row!.prior).toBeGreaterThan(0);
    expect(row!.trend).not.toBe('new');
  });

  it('is empty on an empty corpus and respects the limit', () => {
    expect(phraseBankRollup({ items: [], now: NOW })).toEqual([]);
    const items = Array.from({ length: 40 }, (_, i) => ({
      text: `unique phrase ${i} unique phrase ${i}`,
      at: daysAgo(1),
      score: null,
    }));
    const rows = phraseBankRollup({ items, now: NOW, limit: 5 });
    expect(rows.length).toBeLessThanOrEqual(5);
  });
});
