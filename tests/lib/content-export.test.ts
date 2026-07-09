import { describe, expect, it } from 'vitest';
import type { ContentPiece } from '@/lib/mothermode/content/types';
import {
  METRICOOL_HEADERS,
  GHL_BASIC_HEADERS,
  GHL_ADVANCED_FIELD_HEADERS,
  GHL_ADVANCED_GROUP_HEADERS,
  assignScheduleDate,
  buildExportCaption,
  buildGhlAdvancedCsv,
  buildGhlBasicCsv,
  buildMetricoolCsv,
  csvCell,
  metricoolRowCells,
  parseDateOnly,
  runExport,
  selectPieces,
  weeksForMonth,
  type ExportOptions,
} from '@/lib/mothermode/content/export';

const basePiece = (over: Partial<ContentPiece> = {}): ContentPiece => ({
  id: 'fb-feed-test-1',
  platform: 'facebook',
  format: 'feed',
  kind: 'organic',
  tone: 'confidante',
  week: 1,
  theme: 'Mental load',
  title: 'Test post',
  hook: 'You are not failing at motherhood.',
  body: ['The load is real.', 'Start with one page.'],
  cta: 'Start for $7.',
  link: 'https://example.com/offer',
  hashtags: ['MotherMode', 'MentalLoad'],
  media: {
    type: 'image',
    src: 'https://cdn.example.com/post.jpg',
    alt: 'Kitchen counter at dawn',
  },
  ...over,
});

const opts = (over: Partial<ExportOptions> = {}): ExportOptions => ({
  target: 'metricool',
  scope: 'all',
  campaignStart: '2026-07-06', // Monday
  defaultTime: '10:00:00',
  includeAds: true,
  includeNonSocial: false,
  ...over,
});

describe('csvCell', () => {
  it('escapes quotes and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell(true)).toBe('true');
    expect(csvCell(null)).toBe('');
  });
});

describe('schedule', () => {
  it('maps campaign months to weeks', () => {
    expect(weeksForMonth(1)).toEqual([1, 2, 3, 4]);
    expect(weeksForMonth(2)).toEqual([5, 6, 7, 8]);
    expect(weeksForMonth(3)).toEqual([9, 10, 11, 12]);
  });

  it('assigns week 1 to campaign start day', () => {
    const start = parseDateOnly('2026-07-06')!;
    const d = assignScheduleDate(start, 1, 0, { h: 10, m: 0, s: 0 });
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6); // July
    expect(d.getDate()).toBe(6);
    expect(d.getHours()).toBe(10);
  });

  it('staggers week 2 seven days later', () => {
    const start = parseDateOnly('2026-07-06')!;
    const d = assignScheduleDate(start, 2, 0, { h: 10, m: 0, s: 0 });
    expect(d.getDate()).toBe(13);
  });
});

describe('selectPieces', () => {
  const pieces = [
    basePiece({ id: 'a', platform: 'facebook', week: 1 }),
    basePiece({ id: 'b', platform: 'instagram', week: 2, format: 'reel' }),
    basePiece({ id: 'c', platform: 'email', format: 'email', week: 1 }),
    basePiece({ id: 'd', platform: 'tiktok', format: 'video', kind: 'ad', week: 3 }),
  ];

  it('excludes non-social by default', () => {
    const out = selectPieces(pieces, opts({ scope: 'all' }));
    expect(out.map((p) => p.id).sort()).toEqual(['a', 'b', 'd']);
  });

  it('filters by week', () => {
    const out = selectPieces(pieces, opts({ scope: 'weeks', weeks: [2] }));
    expect(out.map((p) => p.id)).toEqual(['b']);
  });

  it('filters by selected ids', () => {
    const out = selectPieces(
      pieces,
      opts({ scope: 'selected', selectedIds: ['a', 'c'] }),
    );
    // c is email and excluded unless includeNonSocial
    expect(out.map((p) => p.id)).toEqual(['a']);
  });

  it('can include non-social', () => {
    const out = selectPieces(
      pieces,
      opts({ scope: 'selected', selectedIds: ['c'], includeNonSocial: true }),
    );
    expect(out.map((p) => p.id)).toEqual(['c']);
  });
});

describe('buildExportCaption', () => {
  it('joins hook, body, cta, link, hashtags', () => {
    const text = buildExportCaption(basePiece());
    expect(text).toContain('You are not failing at motherhood.');
    expect(text).toContain('The load is real.');
    expect(text).toContain('Start for $7.');
    expect(text).toContain('https://example.com/offer');
    expect(text).toContain('#MotherMode');
  });
});

describe('metricool', () => {
  it('emits the official header row', () => {
    const csv = buildMetricoolCsv([], opts());
    const header = csv.trim().split('\n')[0];
    expect(header).toBe(METRICOOL_HEADERS.join(','));
  });

  it('sets the correct platform flag and date', () => {
    const result = runExport({
      allPieces: [basePiece()],
      options: opts({ target: 'metricool', scope: 'all' }),
    });
    expect(result.rows).toHaveLength(1);
    const cells = metricoolRowCells(result.rows[0], opts());
    expect(cells).toHaveLength(METRICOOL_HEADERS.length);
    // Text, Date, Time, Draft, Facebook...
    expect(cells[1]).toBe('2026-07-06');
    expect(cells[2]).toBe('10:00:00');
    expect(cells[4]).toBe(true); // Facebook
    expect(cells[8]).toBe(false); // Instagram
    expect(String(cells[0])).toContain('You are not failing');
    expect(cells[14]).toBe('https://cdn.example.com/post.jpg'); // Picture Url 1
  });

  it('maps x to Twitter/X flag', () => {
    const result = runExport({
      allPieces: [basePiece({ id: 'x1', platform: 'x', format: 'feed' })],
      options: opts({ target: 'metricool' }),
    });
    const cells = metricoolRowCells(result.rows[0], opts());
    expect(cells[5]).toBe(true); // Twitter/X
    expect(cells[4]).toBe(false); // Facebook
  });
});

describe('ghl basic', () => {
  it('matches sample headers', () => {
    const csv = buildGhlBasicCsv([]);
    expect(csv.trim().split('\n')[0]).toBe(GHL_BASIC_HEADERS.join(','));
  });

  it('writes postAtSpecificTime and content', () => {
    const result = runExport({
      allPieces: [basePiece()],
      options: opts({ target: 'ghl-basic' }),
    });
    const line = result.csv.trim().split('\n')[1];
    expect(line.startsWith('2026-07-06 10:00:00,')).toBe(true);
    expect(result.csv).toContain('https://cdn.example.com/post.jpg');
  });
});

describe('ghl advanced', () => {
  it('emits two header rows matching the sample', () => {
    const csv = buildGhlAdvancedCsv([], opts({ target: 'ghl-advanced' }));
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe(GHL_ADVANCED_GROUP_HEADERS.join(','));
    expect(lines[1]).toBe(GHL_ADVANCED_FIELD_HEADERS.join(','));
    expect(GHL_ADVANCED_GROUP_HEADERS).toHaveLength(
      GHL_ADVANCED_FIELD_HEADERS.length,
    );
  });
});
