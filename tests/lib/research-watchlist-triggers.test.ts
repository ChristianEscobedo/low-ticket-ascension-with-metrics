/**
 * Metric triggers on watchlists (Phase 2): the trigger spec's defense, the
 * evaluator's spending rule (an unknown metric NEVER fires a paid run),
 * the cooldown clock, the row mapping, and the card's armed line.
 */
import { describe, expect, it } from 'vitest';
import {
  evaluateWatchTrigger,
  isTriggerCoolingDown,
  normalizeWatchTrigger,
  rowToWatchlist,
  TRIGGER_DEFAULT_COOLDOWN_HOURS,
  type WatchTriggerMetrics,
} from '@/lib/mothermode/research/watchlists';
import { watchTriggerLine } from '@/lib/mothermode/research/recipes/crew';

const METRICS: WatchTriggerMetrics = {
  recentClicks: 87,
  totalClicks: 1400,
  optins: 31,
  purchases: 4,
  revenueCents: 41200,
};

describe('normalizeWatchTrigger', () => {
  it('accepts a valid spec and clamps the cooldown at a month', () => {
    expect(
      normalizeWatchTrigger({ metric: 'recentClicks', op: 'lt', value: 100 }),
    ).toEqual({ metric: 'recentClicks', op: 'lt', value: 100 });
    expect(
      normalizeWatchTrigger({
        metric: 'revenueCents',
        op: 'gte',
        value: 50000,
        cooldownHours: 9999,
      }),
    ).toEqual({
      metric: 'revenueCents',
      op: 'gte',
      value: 50000,
      cooldownHours: 720,
    });
  });

  it('rejects junk — never a silent "no trigger" interpretation', () => {
    expect(normalizeWatchTrigger(null)).toBeNull();
    expect(normalizeWatchTrigger('recentClicks')).toBeNull();
    // No CTR trigger exists (no impressions table) — unknown metrics die here.
    expect(normalizeWatchTrigger({ metric: 'ctr', op: 'lt', value: 1 })).toBeNull();
    expect(normalizeWatchTrigger({ metric: 'optins', op: 'eq', value: 1 })).toBeNull();
    expect(normalizeWatchTrigger({ metric: 'optins', op: 'lt', value: NaN })).toBeNull();
    expect(normalizeWatchTrigger({ metric: 'optins', op: 'lt', value: '100' })).toBeNull();
  });
});

describe('evaluateWatchTrigger', () => {
  it('lt trips below the floor and not at it', () => {
    const t = { metric: 'recentClicks', op: 'lt', value: 100 } as const;
    const tripped = evaluateWatchTrigger(t, METRICS);
    expect(tripped.tripped).toBe(true);
    expect(tripped.observed).toBe(87);
    expect(tripped.reason).toContain('87');
    expect(
      evaluateWatchTrigger(t, { ...METRICS, recentClicks: 100 }).tripped,
    ).toBe(false);
  });

  it('gte trips at the milestone and not below it', () => {
    const t = { metric: 'revenueCents', op: 'gte', value: 40000 } as const;
    expect(evaluateWatchTrigger(t, METRICS).tripped).toBe(true);
    expect(
      evaluateWatchTrigger(t, { ...METRICS, revenueCents: 39999 }).tripped,
    ).toBe(false);
  });

  it('THE SPENDING RULE: an unknown metric never trips', () => {
    const unknown: WatchTriggerMetrics = {
      recentClicks: null,
      totalClicks: null,
      optins: null,
      purchases: null,
      revenueCents: null,
    };
    const verdict = evaluateWatchTrigger(
      { metric: 'recentClicks', op: 'lt', value: 100 },
      unknown,
    );
    expect(verdict.tripped).toBe(false);
    expect(verdict.observed).toBeNull();
    expect(verdict.reason).toContain('never fires on a failed read');
  });
});

describe('isTriggerCoolingDown', () => {
  const now = Date.parse('2026-07-31T12:00:00Z');
  it('never fired → not cooling; inside the window → cooling; past it → armed', () => {
    expect(
      isTriggerCoolingDown({ lastTriggeredAt: null, trigger: null }, now),
    ).toBe(false);
    expect(
      isTriggerCoolingDown(
        {
          lastTriggeredAt: '2026-07-31T06:00:00Z', // 6h ago, default 24h
          trigger: { metric: 'optins', op: 'gte', value: 10 },
        },
        now,
      ),
    ).toBe(true);
    expect(
      isTriggerCoolingDown(
        {
          lastTriggeredAt: '2026-07-30T06:00:00Z', // 30h ago > default 24h
          trigger: { metric: 'optins', op: 'gte', value: 10 },
        },
        now,
      ),
    ).toBe(false);
  });

  it('honors a custom cooldown and survives a junk timestamp', () => {
    expect(
      isTriggerCoolingDown(
        {
          lastTriggeredAt: '2026-07-30T12:00:00Z', // exactly 24h ago
          trigger: { metric: 'optins', op: 'gte', value: 10, cooldownHours: 48 },
        },
        now,
      ),
    ).toBe(true);
    expect(
      isTriggerCoolingDown(
        { lastTriggeredAt: 'not-a-date', trigger: null },
        now,
      ),
    ).toBe(false);
    expect(TRIGGER_DEFAULT_COOLDOWN_HOURS).toBe(24);
  });
});

describe('rowToWatchlist', () => {
  const base = {
    id: 'w1',
    session_id: 's1',
    recipe_slug: 'niche-watch',
    cadence: 'weekly',
    last_run_at: null,
    status: 'active',
    created_at: null,
  };

  it('maps the trigger columns, degrading cleanly pre-migration', () => {
    // A checkout ahead of the migration: the columns are absent.
    expect(rowToWatchlist(base).trigger).toBeNull();
    expect(rowToWatchlist(base).lastTriggeredAt).toBeNull();

    const armed = rowToWatchlist({
      ...base,
      metric_trigger: { metric: 'recentClicks', op: 'lt', value: 100 },
      last_triggered_at: '2026-07-31T00:00:00Z',
    });
    expect(armed.trigger).toEqual({
      metric: 'recentClicks',
      op: 'lt',
      value: 100,
    });
    expect(armed.lastTriggeredAt).toBe('2026-07-31T00:00:00Z');

    // Junk in the JSONB never crashes the row.
    expect(
      rowToWatchlist({ ...base, metric_trigger: '{"oops' }).trigger,
    ).toBeNull();
  });
});

describe('watchTriggerLine (the card’s armed line)', () => {
  it('reads counts as counts, revenue as dollars, and the cooldown when set', () => {
    expect(
      watchTriggerLine({ metric: 'recentClicks', op: 'lt', value: 100 }),
    ).toBe('also runs when 30-day clicks drop below 100');
    expect(
      watchTriggerLine({ metric: 'revenueCents', op: 'gte', value: 41200 }),
    ).toBe('also runs when attributed revenue reach $412');
    expect(
      watchTriggerLine({
        metric: 'optins',
        op: 'gte',
        value: 50,
        cooldownHours: 72,
      }),
    ).toBe('also runs when attributed leads reach 50 (max once per 72h)');
    expect(watchTriggerLine(null)).toBeNull();
  });
});
