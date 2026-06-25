import { describe, it, expect } from 'vitest';
import {
  ctaPerformanceRowsToCsv,
  type CtaPerformanceRow
} from '@/utils/courses/cta-analytics';

const baseRow: CtaPerformanceRow = {
  lessonId: 'l1',
  ctaId: 'cta-a',
  lessonTitle: 'Lesson One',
  courseId: 'c1',
  courseTitle: 'Course One',
  ctaTitle: 'Buy now',
  ctaLink: 'https://example.com/buy',
  ctaButtonText: 'Get it',
  clicks: 12,
  views: 100,
  ctr: 0.12,
  lastClickAt: '2026-06-15T12:00:00.000Z'
};

describe('ctaPerformanceRowsToCsv', () => {
  it('emits a stable header row even when given an empty input', () => {
    const csv = ctaPerformanceRowsToCsv([]);
    const [header, ...rest] = csv.split('\r\n');
    expect(header).toBe(
      'cta_id,cta_title,cta_button_text,cta_link,lesson_id,lesson_title,course_id,course_title,views,clicks,ctr_pct,last_click_at'
    );
    expect(rest.filter(Boolean)).toEqual([]);
  });

  it('serializes a normal row with CTR rendered as a percentage', () => {
    const csv = ctaPerformanceRowsToCsv([baseRow]);
    const line = csv.split('\r\n')[1];
    expect(line).toBe(
      'cta-a,Buy now,Get it,https://example.com/buy,l1,Lesson One,c1,Course One,100,12,12.00,2026-06-15T12:00:00.000Z'
    );
  });

  it('emits an empty ctr_pct cell when views is zero', () => {
    const csv = ctaPerformanceRowsToCsv([
      { ...baseRow, clicks: 0, views: 0, ctr: null }
    ]);
    const cols = csv.split('\r\n')[1].split(',');
    // ctr_pct is the 11th column (index 10)
    expect(cols[10]).toBe('');
  });

  it('quotes cells containing commas, quotes, or newlines (RFC 4180)', () => {
    const csv = ctaPerformanceRowsToCsv([
      {
        ...baseRow,
        ctaTitle: 'Buy "now", today',
        lessonTitle: 'Line one\nLine two'
      }
    ]);
    const line = csv.split('\r\n')[1];
    expect(line).toContain('"Buy ""now"", today"');
    expect(line).toContain('"Line one\nLine two"');
  });

  it('renders null string fields as empty cells', () => {
    const csv = ctaPerformanceRowsToCsv([
      {
        ...baseRow,
        ctaTitle: null,
        ctaLink: null,
        ctaButtonText: null,
        courseTitle: null,
        lessonTitle: null,
        lastClickAt: null
      }
    ]);
    expect(csv.split('\r\n')[1]).toBe('cta-a,,,,l1,,c1,,100,12,12.00,');
  });

  it('terminates the document with a trailing CRLF', () => {
    const csv = ctaPerformanceRowsToCsv([baseRow]);
    expect(csv.endsWith('\r\n')).toBe(true);
  });
});
