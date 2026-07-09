/**
 * GHL Social Planner basic CSV builder.
 * Headers match docs/social-planner-basic-sample.csv.
 */
import { csvDocument, csvLine, formatDateTime, slugFilename } from './csv';
import type { ExportOptions, ExportRow } from './types';

export const GHL_BASIC_HEADERS = [
  'postAtSpecificTime (YYYY-MM-DD HH:mm:ss)',
  'content',
  'link (OGmetaUrl)',
  'imageUrls',
  'gifUrl',
  'videoUrls',
  'thumbnailUrl',
] as const;

/** Comma-separated media list as GHL expects (space after comma in sample). */
function joinUrls(urls: string[]): string {
  return urls.join(', ');
}

export function ghlBasicRowCells(row: ExportRow): Array<string> {
  return [
    formatDateTime(row.scheduledAt),
    row.content,
    row.link ?? '',
    joinUrls(row.imageUrls),
    '',
    joinUrls(row.videoUrls),
    row.thumbnailUrl ?? '',
  ];
}

export function buildGhlBasicCsv(rows: ExportRow[]): string {
  const lines = [csvLine([...GHL_BASIC_HEADERS])];
  for (const row of rows) {
    lines.push(csvLine(ghlBasicRowCells(row)));
  }
  return csvDocument(lines);
}

export function ghlBasicFilename(options: ExportOptions): string {
  const day = options.campaignStart || 'export';
  return `ghl-social-basic-${slugFilename(day)}.csv`;
}
