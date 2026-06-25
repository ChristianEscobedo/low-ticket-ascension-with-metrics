import { describe, it, expect } from 'vitest';
import {
  aggregateCtaRows,
  type CtaPerformanceRow
} from '@/utils/courses/cta-analytics';

function row(over: Partial<CtaPerformanceRow>): CtaPerformanceRow {
  return {
    lessonId: 'l1',
    ctaId: 'cta-a',
    lessonTitle: 'Lesson One',
    courseId: 'c1',
    courseTitle: 'Course One',
    ctaTitle: 'Buy',
    ctaLink: null,
    ctaButtonText: null,
    clicks: 0,
    views: 0,
    ctr: null,
    lastClickAt: null,
    ...over
  };
}

describe('aggregateCtaRows', () => {
  it('returns empty arrays for an empty input', () => {
    expect(aggregateCtaRows([])).toEqual({ byCourse: [], byLesson: [] });
  });

  it('sums clicks/views per course and recomputes CTR', () => {
    const rows = [
      row({ lessonId: 'l1', ctaId: 'a', clicks: 10, views: 100 }),
      row({ lessonId: 'l2', ctaId: 'a', clicks: 5, views: 50 }),
      row({ lessonId: 'l2', ctaId: 'b', clicks: 5, views: 50 })
    ];
    const { byCourse } = aggregateCtaRows(rows);
    expect(byCourse).toHaveLength(1);
    expect(byCourse[0]).toMatchObject({
      courseId: 'c1',
      ctaCount: 3,
      lessonCount: 2,
      clicks: 20,
      views: 200,
      ctr: 0.1
    });
  });

  it('sums clicks/views per lesson and counts CTAs per lesson', () => {
    const rows = [
      row({ lessonId: 'l1', ctaId: 'a', clicks: 10, views: 100 }),
      row({ lessonId: 'l1', ctaId: 'b', clicks: 5, views: 0 }),
      row({ lessonId: 'l2', ctaId: 'a', clicks: 7, views: 70 })
    ];
    const { byLesson } = aggregateCtaRows(rows);
    expect(byLesson).toHaveLength(2);
    const l1 = byLesson.find((l) => l.lessonId === 'l1')!;
    expect(l1.clicks).toBe(15);
    expect(l1.views).toBe(100);
    expect(l1.ctaCount).toBe(2);
    expect(l1.ctr).toBeCloseTo(0.15);
    const l2 = byLesson.find((l) => l.lessonId === 'l2')!;
    expect(l2.ctr).toBeCloseTo(0.1);
  });

  it('sorts both groupings by clicks DESC', () => {
    const rows = [
      row({ lessonId: 'l1', ctaId: 'a', clicks: 3, views: 10, courseId: 'c1', courseTitle: 'A' }),
      row({ lessonId: 'l2', ctaId: 'a', clicks: 9, views: 10, courseId: 'c2', courseTitle: 'B' }),
      row({ lessonId: 'l3', ctaId: 'a', clicks: 6, views: 10, courseId: 'c3', courseTitle: 'C' })
    ];
    const { byCourse, byLesson } = aggregateCtaRows(rows);
    expect(byCourse.map((c) => c.clicks)).toEqual([9, 6, 3]);
    expect(byLesson.map((l) => l.clicks)).toEqual([9, 6, 3]);
  });

  it('emits null CTR when views is zero, not Infinity / NaN', () => {
    const rows = [
      row({ lessonId: 'l1', ctaId: 'a', clicks: 3, views: 0 })
    ];
    const { byCourse, byLesson } = aggregateCtaRows(rows);
    expect(byCourse[0].ctr).toBeNull();
    expect(byLesson[0].ctr).toBeNull();
  });

  it('collapses rows with null courseId under a single unattributed bucket', () => {
    const rows = [
      row({ lessonId: 'l1', courseId: null, courseTitle: null, clicks: 2, views: 10 }),
      row({ lessonId: 'l2', courseId: null, courseTitle: null, clicks: 4, views: 10 })
    ];
    const { byCourse } = aggregateCtaRows(rows);
    expect(byCourse).toHaveLength(1);
    expect(byCourse[0].courseId).toBeNull();
    expect(byCourse[0].clicks).toBe(6);
    expect(byCourse[0].lessonCount).toBe(2);
  });
});
