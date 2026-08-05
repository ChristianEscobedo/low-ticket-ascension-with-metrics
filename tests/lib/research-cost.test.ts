import { describe, it, expect } from 'vitest';

import {
  estimateCallCost,
  summarizeCalls,
  formatSpendLine,
  TOOL_COST_ESTIMATES_CENTS,
} from '@/lib/mothermode/research/agent/cost';
import { DEEP_TOOL_NAMES } from '@/lib/mothermode/research/agent/toolDefs';

/**
 * The spend meter's honesty rules, pinned: cached calls are free (pay
 * once), failed/blocked calls never bill, free tools never bill, and the
 * meter line says "est." because these are estimates, not a ledger.
 */

describe('estimateCallCost', () => {
  it('free tools never bill', () => {
    for (const name of [
      'web_search',
      'internal_metrics',
      'get_context',
      'create_artifact',
    ]) {
      const est = estimateCallCost({ name, resultSummary: 'ok' });
      expect(est.paid).toBe(false);
      expect(est.estCostCents).toBe(0);
    }
  });

  it('a fresh paid call bills its table estimate', () => {
    const est = estimateCallCost({
      name: 'social_search',
      resultSummary: '4521 chars',
    });
    expect(est.paid).toBe(true);
    expect(est.estCostCents).toBe(TOOL_COST_ESTIMATES_CENTS.social_search);
  });

  it('cached calls cost zero, whichever marker shape the executor used', () => {
    for (const resultSummary of [
      'cached, 4521 chars',
      '6 posts ranked (cached)',
      '12 comments (cached)',
    ]) {
      const est = estimateCallCost({
        name: 'social_search',
        resultSummary,
      });
      expect(est.cached).toBe(true);
      expect(est.paid).toBe(false);
      expect(est.estCostCents).toBe(0);
    }
  });

  it('failed and blocked calls never count as paid runs', () => {
    for (const resultSummary of [
      'failed: Monid 400',
      'blocked: standard depth',
    ]) {
      const est = estimateCallCost({
        name: 'voice_deep_dive',
        resultSummary,
      });
      expect(est.paid).toBe(false);
      expect(est.estCostCents).toBe(0);
    }
  });

  it('every deep tool has an estimate row (the deep lane is the spend)', () => {
    for (const name of DEEP_TOOL_NAMES) {
      expect(TOOL_COST_ESTIMATES_CENTS[name]).toBeGreaterThan(0);
    }
  });
});

describe('summarizeCalls', () => {
  it('rolls a turn into runs / cached / paid / cents', () => {
    const s = summarizeCalls([
      { name: 'social_search', resultSummary: '4521 chars' },
      { name: 'social_search', resultSummary: 'cached, 4521 chars' },
      { name: 'web_search', resultSummary: '800 chars, cited' },
      { name: 'voice_deep_dive', resultSummary: '10 posts, 5 mined, 6 phrases' },
    ]);
    expect(s.runs).toBe(4);
    expect(s.cachedRuns).toBe(1);
    expect(s.paidRuns).toBe(2);
    expect(s.estCostCents).toBe(
      TOOL_COST_ESTIMATES_CENTS.social_search +
        TOOL_COST_ESTIMATES_CENTS.voice_deep_dive,
    );
  });

  it('is all zeros on an empty turn', () => {
    expect(summarizeCalls([])).toEqual({
      runs: 0,
      cachedRuns: 0,
      paidRuns: 0,
      estCostCents: 0,
    });
  });
});

describe('formatSpendLine', () => {
  it('renders the estimate with cached count', () => {
    expect(
      formatSpendLine({ runs: 5, cachedRuns: 2, paidRuns: 3, estCostCents: 19 }),
    ).toBe('5 runs · 2 cached · ~$0.19 est.');
  });

  it('says no paid calls when nothing billed', () => {
    expect(
      formatSpendLine({ runs: 3, cachedRuns: 1, paidRuns: 0, estCostCents: 0 }),
    ).toBe('3 runs · 1 cached · no paid calls');
    expect(
      formatSpendLine({ runs: 1, cachedRuns: 0, paidRuns: 0, estCostCents: 0 }),
    ).toBe('1 run · no paid calls');
  });
});
