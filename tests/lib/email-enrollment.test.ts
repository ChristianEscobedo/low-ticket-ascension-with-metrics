/**
 * Tests for the email enrollment analytics module (Phase 5).
 *
 * Mirrors the style of email-analytics.test.ts: pure, zero-dependency,
 * covers the happy path, zero-safe edge cases, and defensive coercion.
 */
import { describe, it, expect } from 'vitest';
import {
  enrollmentFunnel,
  activeSubscribers,
  totalEnrolled,
  countByStatus,
  dropoffByEmail,
  cohortBuckets,
  journeyForSubscriber,
  normalizeEnrollment,
  normalizeEvent,
  normalizeEnrollmentData,
  emptyEnrollmentData,
  hasEnrollments,
  toEnrollmentStatus,
  type EnrollmentData,
  type Enrollment,
  type EmailEvent,
} from '@/lib/mothermode/email/enrollment';
import type { EmailSequence } from '@/lib/mothermode/email/types';
import type { SequenceStats } from '@/lib/mothermode/email/analytics';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSequence(emailIds: string[]): EmailSequence {
  return {
    name: 'Test',
    goal: 'Convert',
    trigger: 'optin',
    emails: emailIds.map((id) => ({
      id,
      role: 'nurture' as const,
      framework: 'story-lesson' as const,
      sendOffset: '+1d',
      subject: `Subject ${id}`,
      subjectIdeas: [],
      preview: '',
      bodyText: '',
      bodyHtml: '',
      cta: { label: '', url: '' },
      summary: '',
      branch: 'always' as const,
      parentId: null,
      psFramework: 'none' as const,
      images: [],
    })),
  };
}

function makeStats(
  byEmail: Record<string, { sent: number; opened: number; clicked: number; delivered?: number }>,
): SequenceStats {
  const result: SequenceStats = {
    kitId: 'kit-1',
    byEmail: {},
    updatedAt: '2026-07-01T00:00:00Z',
  };
  for (const [id, s] of Object.entries(byEmail)) {
    result.byEmail[id] = {
      emailId: id,
      sent: s.sent,
      delivered: s.delivered ?? s.sent,
      opened: s.opened,
      clicked: s.clicked,
      unsubscribed: 0,
      bounced: 0,
    };
  }
  return result;
}

function makeEnrollmentData(enrollments: Enrollment[]): EnrollmentData {
  return { kitId: 'kit-1', enrollments, updatedAt: '2026-07-01T00:00:00Z' };
}

// ---------------------------------------------------------------------------
// enrollmentFunnel
// ---------------------------------------------------------------------------

describe('enrollmentFunnel', () => {
  it('returns empty for null/undefined stats', () => {
    expect(enrollmentFunnel(null)).toEqual([]);
    expect(enrollmentFunnel(undefined)).toEqual([]);
  });

  it('returns empty when no sent volume', () => {
    const stats = makeStats({ eml1: { sent: 0, opened: 0, clicked: 0 } });
    expect(enrollmentFunnel(stats)).toEqual([]);
  });

  it('computes funnel with correct rates', () => {
    const stats = makeStats({
      eml1: { sent: 100, opened: 50, clicked: 10 },
    });
    const funnel = enrollmentFunnel(stats);
    expect(funnel).toHaveLength(5);
    expect(funnel[0]).toEqual({
      stage: 'Enrolled',
      count: 100,
      rate: 1,
      cumulativeRate: 1,
    });
    expect(funnel[1].count).toBe(100); // delivered = sent
    expect(funnel[2].count).toBe(50); // opened
    expect(funnel[3].count).toBe(10); // clicked
    expect(funnel[2].rate).toBeCloseTo(0.5, 5); // 50/100
  });
});

// ---------------------------------------------------------------------------
// activeSubscribers / totalEnrolled / countByStatus
// ---------------------------------------------------------------------------

describe('activeSubscribers', () => {
  it('returns 0 for empty data', () => {
    expect(activeSubscribers(null)).toBe(0);
    expect(activeSubscribers(undefined)).toBe(0);
  });

  it('counts only non-terminal statuses', () => {
    const data = makeEnrollmentData([
      {
        subscriberId: 's1',
        emailId: 'eml1',
        status: 'enrolled',
        enrolledAt: '',
        lastEventAt: '',
      },
      {
        subscriberId: 's2',
        emailId: 'eml1',
        status: 'opened',
        enrolledAt: '',
        lastEventAt: '',
      },
      {
        subscriberId: 's3',
        emailId: 'eml1',
        status: 'completed',
        enrolledAt: '',
        lastEventAt: '',
      },
      {
        subscriberId: 's4',
        emailId: 'eml1',
        status: 'dropped',
        enrolledAt: '',
        lastEventAt: '',
      },
      {
        subscriberId: 's5',
        emailId: 'eml1',
        status: 'unsubscribed',
        enrolledAt: '',
        lastEventAt: '',
      },
    ]);
    expect(activeSubscribers(data)).toBe(2);
  });
});

describe('totalEnrolled', () => {
  it('returns 0 for empty data', () => {
    expect(totalEnrolled(null)).toBe(0);
  });

  it('counts all enrollments', () => {
    const data = makeEnrollmentData([
      {
        subscriberId: 's1',
        emailId: '',
        status: 'enrolled',
        enrolledAt: '',
        lastEventAt: '',
      },
      {
        subscriberId: 's2',
        emailId: '',
        status: 'completed',
        enrolledAt: '',
        lastEventAt: '',
      },
    ]);
    expect(totalEnrolled(data)).toBe(2);
  });
});

describe('countByStatus', () => {
  it('returns zeroed map for empty data', () => {
    const counts = countByStatus(null);
    expect(counts.enrolled).toBe(0);
    expect(counts.completed).toBe(0);
    expect(counts.dropped).toBe(0);
  });

  it('counts each status', () => {
    const data = makeEnrollmentData([
      {
        subscriberId: 's1',
        emailId: '',
        status: 'enrolled',
        enrolledAt: '',
        lastEventAt: '',
      },
      {
        subscriberId: 's2',
        emailId: '',
        status: 'enrolled',
        enrolledAt: '',
        lastEventAt: '',
      },
      {
        subscriberId: 's3',
        emailId: '',
        status: 'dropped',
        enrolledAt: '',
        lastEventAt: '',
      },
    ]);
    const counts = countByStatus(data);
    expect(counts.enrolled).toBe(2);
    expect(counts.dropped).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// dropoffByEmail
// ---------------------------------------------------------------------------

describe('dropoffByEmail', () => {
  it('returns empty for empty sequence', () => {
    expect(dropoffByEmail(null, null, null)).toEqual([]);
  });

  it('computes per-email drop-off', () => {
    const seq = makeSequence(['eml1', 'eml2']);
    const stats = makeStats({
      eml1: { sent: 100, opened: 50, clicked: 10 },
      eml2: { sent: 80, opened: 40, clicked: 5 },
    });
    const enrollment = makeEnrollmentData([
      {
        subscriberId: 's1',
        emailId: 'eml1',
        status: 'dropped',
        enrolledAt: '',
        lastEventAt: '',
      },
      {
        subscriberId: 's2',
        emailId: 'eml1',
        status: 'dropped',
        enrolledAt: '',
        lastEventAt: '',
      },
    ]);
    const result = dropoffByEmail(seq, stats, enrollment);
    expect(result).toHaveLength(2);
    expect(result[0].emailId).toBe('eml1');
    expect(result[0].sent).toBe(100);
    expect(result[0].dropped).toBe(2);
    expect(result[0].dropoffRate).toBeCloseTo(0.02, 5);
  });
});

// ---------------------------------------------------------------------------
// cohortBuckets
// ---------------------------------------------------------------------------

describe('cohortBuckets', () => {
  it('returns empty for empty data', () => {
    expect(cohortBuckets(null, null)).toEqual([]);
  });

  it('groups enrollments by week', () => {
    const seq = makeSequence(['eml1', 'eml2']);
    const data = makeEnrollmentData([
      {
        subscriberId: 's1',
        emailId: 'eml1',
        status: 'enrolled',
        enrolledAt: '2026-07-01T00:00:00Z',
        lastEventAt: '',
      },
      {
        subscriberId: 's2',
        emailId: 'eml1',
        status: 'opened',
        enrolledAt: '2026-07-01T00:00:00Z',
        lastEventAt: '',
      },
      {
        subscriberId: 's3',
        emailId: 'eml1',
        status: 'dropped',
        enrolledAt: '2026-07-15T00:00:00Z',
        lastEventAt: '',
      },
    ]);
    const cohorts = cohortBuckets(seq, data, 'week');
    expect(cohorts.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// journeyForSubscriber
// ---------------------------------------------------------------------------

describe('journeyForSubscriber', () => {
  it('returns empty for empty events', () => {
    expect(journeyForSubscriber(null, null, 's1')).toEqual([]);
  });

  it('builds ordered timeline', () => {
    const seq = makeSequence(['eml1', 'eml2']);
    const events: EmailEvent[] = [
      {
        subscriberId: 's1',
        emailId: '',
        eventType: 'enrolled',
        occurredAt: '2026-07-01T00:00:00Z',
      },
      {
        subscriberId: 's1',
        emailId: 'eml1',
        eventType: 'sent',
        occurredAt: '2026-07-02T00:00:00Z',
      },
      {
        subscriberId: 's1',
        emailId: 'eml1',
        eventType: 'opened',
        occurredAt: '2026-07-02T01:00:00Z',
      },
      {
        subscriberId: 's2',
        emailId: 'eml1',
        eventType: 'opened',
        occurredAt: '2026-07-03T00:00:00Z',
      },
    ];
    const journey = journeyForSubscriber(events, seq, 's1');
    expect(journey).toHaveLength(3);
    expect(journey[0].eventType).toBe('enrolled');
    expect(journey[1].eventType).toBe('sent');
    expect(journey[2].eventType).toBe('opened');
    expect(journey[1].subject).toBe('Subject eml1');
  });
});

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

describe('normalizeEnrollment', () => {
  it('coerces partial input', () => {
    const e = normalizeEnrollment({ subscriber_id: 's1', status: 'opened' });
    expect(e.subscriberId).toBe('s1');
    expect(e.status).toBe('opened');
    expect(e.emailId).toBe('');
  });

  it('defaults status to enrolled for junk', () => {
    const e = normalizeEnrollment({ subscriberId: 's1', status: 'garbage' });
    expect(e.status).toBe('enrolled');
  });
});

describe('normalizeEvent', () => {
  it('coerces snake_case fields', () => {
    const e = normalizeEvent({
      subscriber_id: 's1',
      email_id: 'eml1',
      event_type: 'opened',
      occurred_at: '2026-01-01',
    });
    expect(e.subscriberId).toBe('s1');
    expect(e.emailId).toBe('eml1');
    expect(e.eventType).toBe('opened');
  });
});

describe('normalizeEnrollmentData', () => {
  it('coerces a full payload', () => {
    const data = normalizeEnrollmentData({
      kitId: 'k1',
      enrollments: [{ subscriberId: 's1', status: 'enrolled' }],
      updatedAt: '2026-01-01',
    });
    expect(data.kitId).toBe('k1');
    expect(data.enrollments).toHaveLength(1);
    expect(data.updatedAt).toBe('2026-01-01');
  });

  it('handles empty input', () => {
    const data = normalizeEnrollmentData(null);
    expect(data.kitId).toBe('');
    expect(data.enrollments).toEqual([]);
    expect(data.updatedAt).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Empty state helpers
// ---------------------------------------------------------------------------

describe('emptyEnrollmentData', () => {
  it('produces a well-formed empty shape', () => {
    const empty = emptyEnrollmentData('kit-1');
    expect(empty.kitId).toBe('kit-1');
    expect(empty.enrollments).toEqual([]);
    expect(empty.updatedAt).toBeNull();
  });
});

describe('hasEnrollments', () => {
  it('returns false for null', () => {
    expect(hasEnrollments(null)).toBe(false);
  });

  it('returns false for empty', () => {
    expect(hasEnrollments(emptyEnrollmentData('k1'))).toBe(false);
  });

  it('returns true when enrollments exist', () => {
    const data = makeEnrollmentData([
      {
        subscriberId: 's1',
        emailId: '',
        status: 'enrolled',
        enrolledAt: '',
        lastEventAt: '',
      },
    ]);
    expect(hasEnrollments(data)).toBe(true);
  });
});

describe('toEnrollmentStatus', () => {
  it('returns valid statuses', () => {
    expect(toEnrollmentStatus('enrolled')).toBe('enrolled');
    expect(toEnrollmentStatus('completed')).toBe('completed');
    expect(toEnrollmentStatus('dropped')).toBe('dropped');
  });

  it('defaults to enrolled for invalid', () => {
    expect(toEnrollmentStatus('garbage')).toBe('enrolled');
    expect(toEnrollmentStatus(42)).toBe('enrolled');
    expect(toEnrollmentStatus(null)).toBe('enrolled');
  });
});