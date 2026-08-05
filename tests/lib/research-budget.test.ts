import { describe, it, expect } from 'vitest';

import {
  checkBudget,
  budgetBlockedOutcome,
  DEFAULT_RESEARCH_BUDGET,
  ZERO_USAGE,
} from '@/lib/mothermode/research/agent/budget';

/**
 * The budget gate (roadmap 2.4), pinned: the kill switch wins, the
 * per-round cap caps (not cancels), the daily caps stop the day, and the
 * blocked outcome is a readable tool result, never a crash.
 */

describe('checkBudget', () => {
  it('allows a normal round within every cap', () => {
    expect(
      checkBudget({
        usage: ZERO_USAGE,
        plannedPaidRuns: 2,
        plannedEstCostCents: 12,
      }).allowed,
    ).toBe(true);
  });

  it('the kill switch blocks everything paid, first', () => {
    const check = checkBudget({
      usage: ZERO_USAGE,
      plannedPaidRuns: 1,
      plannedEstCostCents: 4,
      killSwitch: true,
    });
    expect(check.allowed).toBe(false);
    if (!check.allowed) {
      expect(check.reason).toContain('kill switch');
      expect(check.reason).toContain('RESEARCH_PAID_TOOLS_OFF');
    }
  });

  it('the per-round cap blocks an over-wide sweep with a correctable reason', () => {
    const check = checkBudget({
      usage: ZERO_USAGE,
      plannedPaidRuns: DEFAULT_RESEARCH_BUDGET.turnPaidRuns + 1,
      plannedEstCostCents: 30,
    });
    expect(check.allowed).toBe(false);
    if (!check.allowed) {
      expect(check.reason).toContain('per-round cap');
      expect(check.reason).toContain('fewer paid tools');
    }
  });

  it('the daily run cap stops the day (usage + planned)', () => {
    const check = checkBudget({
      usage: { paidRunsToday: 24, estCostCentsToday: 100 },
      plannedPaidRuns: 2,
      plannedEstCostCents: 8,
    });
    expect(check.allowed).toBe(false);
    if (!check.allowed) expect(check.reason).toContain('25');
  });

  it('the daily cost cap stops the day in dollars', () => {
    const check = checkBudget({
      usage: { paidRunsToday: 3, estCostCentsToday: 198 },
      plannedPaidRuns: 1,
      plannedEstCostCents: 8,
    });
    expect(check.allowed).toBe(false);
    if (!check.allowed) expect(check.reason).toContain('$2.00');
  });

  it('exactly at the caps is still allowed', () => {
    expect(
      checkBudget({
        usage: { paidRunsToday: 24, estCostCentsToday: 192 },
        plannedPaidRuns: 1,
        plannedEstCostCents: 8,
      }).allowed,
    ).toBe(true);
  });
});

describe('budgetBlockedOutcome', () => {
  it('is a readable tool result, never a crash', () => {
    const out = budgetBlockedOutcome('voice_deep_dive', 'daily budget spent');
    expect(out.content).toContain('voice_deep_dive blocked by the research budget');
    expect(out.content).toContain('daily budget spent');
    expect(out.resultSummary).toBe('blocked: budget');
  });
});
