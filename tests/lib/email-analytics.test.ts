import { describe, it, expect } from 'vitest';
import {
  emptyStat,
  emptySequenceStats,
  normalizeStat,
  normalizeSequenceStats,
  deliveryRate,
  openRate,
  ctr,
  clickToOpenRate,
  unsubscribeRate,
  bounceRate,
  conversionRate,
  sequenceTotals,
  hasAnyStats,
  statFor,
  pickAbWinner,
  abVariantStats,
  type EmailStat,
  type AbVariantStat,
} from '@/lib/mothermode/email/analytics';
import type { EmailSequence } from '@/lib/mothermode/email';

/** A fully-populated stat helper for concise tests. */
function stat(partial: Partial<EmailStat> & { emailId: string }): EmailStat {
  return { ...emptyStat(partial.emailId), ...partial };
}

describe('normalizeStat', () => {
  it('coerces junk/negatives/floats to non-negative integers', () => {
    const s = normalizeStat(
      { emailId: 'e1', sent: '100', delivered: 90.7, opened: -5, clicked: 'x' },
    );
    expect(s).toMatchObject({ emailId: 'e1', sent: 100, delivered: 90, opened: 0, clicked: 0 });
    // revenue omitted when not provided
    expect(s.revenue).toBeUndefined();
  });

  it('accepts snake_case email_id and coerces revenue', () => {
    const s = normalizeStat({ email_id: 'e2', revenue: '19.99' });
    expect(s.emailId).toBe('e2');
    expect(s.revenue).toBeCloseTo(19.99);
  });

  it('falls back to the provided id when none present', () => {
    expect(normalizeStat({}, 'fallback').emailId).toBe('fallback');
  });
});

describe('normalizeSequenceStats', () => {
  it('reads a byEmail map', () => {
    const out = normalizeSequenceStats({
      kitId: 'k1',
      byEmail: { e1: { sent: 10 } },
      updatedAt: '2026-01-01',
    });
    expect(out.kitId).toBe('k1');
    expect(out.byEmail.e1.sent).toBe(10);
    expect(out.byEmail.e1.emailId).toBe('e1');
    expect(out.updatedAt).toBe('2026-01-01');
  });

  it('reads a flat stats array and snake_case updated_at', () => {
    const out = normalizeSequenceStats({
      kitId: 'k2',
      stats: [{ emailId: 'a', sent: 5 }, { emailId: 'b', sent: 7 }],
      updated_at: '2026-02-02',
    });
    expect(Object.keys(out.byEmail)).toHaveLength(2);
    expect(out.byEmail.b.sent).toBe(7);
    expect(out.updatedAt).toBe('2026-02-02');
  });

  it('returns an empty, well-formed shape for junk', () => {
    const out = normalizeSequenceStats(null);
    expect(out.byEmail).toEqual({});
    expect(out.updatedAt).toBeNull();
  });
});

describe('rate math is zero-safe and clamped', () => {
  it('returns 0 (never NaN) when denominators are 0', () => {
    const z = emptyStat('z');
    expect(openRate(z)).toBe(0);
    expect(ctr(z)).toBe(0);
    expect(clickToOpenRate(z)).toBe(0);
    expect(deliveryRate(z)).toBe(0);
    expect(unsubscribeRate(z)).toBe(0);
    expect(bounceRate(z)).toBe(0);
    expect(conversionRate(z)).toBe(0);
  });

  it('computes expected ratios', () => {
    const s = stat({ emailId: 's', sent: 100, delivered: 80, opened: 40, clicked: 20 });
    expect(deliveryRate(s)).toBeCloseTo(0.8);
    expect(openRate(s)).toBeCloseTo(0.5); // 40/80
    expect(ctr(s)).toBeCloseTo(0.25); // 20/80
    expect(clickToOpenRate(s)).toBeCloseTo(0.5); // 20/40
  });

  it('clamps impossible ratios to 1', () => {
    const s = stat({ emailId: 's', delivered: 10, opened: 50 });
    expect(openRate(s)).toBe(1);
  });
});

describe('sequenceTotals / hasAnyStats / statFor', () => {
  const stats = normalizeSequenceStats({
    kitId: 'k',
    byEmail: {
      e1: { sent: 100, delivered: 90, opened: 45, clicked: 10, revenue: 50 },
      e2: { sent: 50, delivered: 40, opened: 10, clicked: 5, revenue: 25 },
    },
  });

  it('sums all counters and revenue', () => {
    const total = sequenceTotals(stats);
    expect(total.sent).toBe(150);
    expect(total.opened).toBe(55);
    expect(total.revenue).toBe(75);
  });

  it('detects presence of real volume', () => {
    expect(hasAnyStats(stats)).toBe(true);
    expect(hasAnyStats(emptySequenceStats('k'))).toBe(false);
    expect(hasAnyStats(null)).toBe(false);
  });

  it('returns a zeroed default for a missing email', () => {
    expect(statFor(stats, 'nope')).toEqual(emptyStat('nope'));
    expect(statFor(stats, 'e1').sent).toBe(100);
  });
});

describe('pickAbWinner', () => {
  const mk = (id: string, s: Partial<EmailStat>): AbVariantStat => ({
    id,
    label: id.toUpperCase(),
    stat: stat({ emailId: id, ...s }),
  });

  it('returns null when there is no volume', () => {
    expect(pickAbWinner([mk('a', {}), mk('b', {})])).toBeNull();
    expect(pickAbWinner([])).toBeNull();
  });

  it('picks the higher open rate by default', () => {
    const a = mk('a', { sent: 100, delivered: 100, opened: 30 });
    const b = mk('b', { sent: 100, delivered: 100, opened: 60 });
    expect(pickAbWinner([a, b])?.id).toBe('b');
  });

  it('honors the chosen metric (click)', () => {
    const a = mk('a', { delivered: 100, opened: 90, clicked: 10 });
    const b = mk('b', { delivered: 100, opened: 40, clicked: 30 });
    expect(pickAbWinner([a, b], 'open')?.id).toBe('a');
    expect(pickAbWinner([a, b], 'click')?.id).toBe('b');
  });

  it('breaks ties by weight then label', () => {
    const a: AbVariantStat = { id: 'a', label: 'A', weight: 40, stat: stat({ emailId: 'a', delivered: 100, opened: 50 }) };
    const b: AbVariantStat = { id: 'b', label: 'B', weight: 60, stat: stat({ emailId: 'b', delivered: 100, opened: 50 }) };
    expect(pickAbWinner([a, b])?.id).toBe('b'); // higher weight wins the tie
  });
});

describe('abVariantStats', () => {
  const sequence = {
    name: 'seq',
    emails: [
      {
        id: 'e1',
        abTest: {
          enabled: true,
          metric: 'open',
          variants: [
            { id: 'v1', label: 'A', weight: 50 },
            { id: 'v2', label: 'B', weight: 50 },
          ],
        },
      },
      { id: 'e2' }, // no abTest → skipped
      { id: 'e3', abTest: { enabled: false, metric: 'open', variants: [{ id: 'x', label: 'X' }] } }, // disabled → skipped
    ],
  } as unknown as EmailSequence;

  it('rolls up only enabled splits and resolves a winner by variant-id stats', () => {
    const stats = normalizeSequenceStats({
      kitId: 'k',
      byEmail: {
        v1: { sent: 100, delivered: 100, opened: 20 },
        v2: { sent: 100, delivered: 100, opened: 60 },
      },
    });
    const rolled = abVariantStats(sequence, stats, 'open');
    expect(rolled).toHaveLength(1);
    expect(rolled[0].emailId).toBe('e1');
    expect(rolled[0].variants).toHaveLength(2);
    expect(rolled[0].winner?.id).toBe('v2');
  });

  it('returns a null winner when there is no data yet', () => {
    const rolled = abVariantStats(sequence, emptySequenceStats('k'), 'open');
    expect(rolled[0].winner).toBeNull();
  });
});
