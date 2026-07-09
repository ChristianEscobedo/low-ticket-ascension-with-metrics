/**
 * Metricool calendar CSV builder. Headers match docs/Mtr_calendar_template.csv.
 */
import type { ContentFormat, ContentPlatform } from '../types';
import { csvDocument, csvLine, formatDate, formatTime, slugFilename } from './csv';
import type { ExportOptions, ExportRow } from './types';

/** Exact Metricool header row from the official template. */
export const METRICOOL_HEADERS = [
  'Text',
  'Date',
  'Time',
  'Draft',
  'Facebook',
  'Twitter/X',
  'LinkedIn',
  'GBP',
  'Instagram',
  'Pinterest',
  'TikTok',
  'Youtube',
  'Threads',
  'Bluesky',
  'Picture Url 1',
  'Picture Url 2',
  'Picture Url 3',
  'Picture Url 4',
  'Picture Url 5',
  'Picture Url 6',
  'Picture Url 7',
  'Picture Url 8',
  'Picture Url 9',
  'Picture Url 10',
  'Alt text picture 1',
  'Alt text picture 2',
  'Alt text picture 3',
  'Alt text picture 4',
  'Alt text picture 5',
  'Alt text picture 6',
  'Alt text picture 7',
  'Alt text picture 8',
  'Alt text picture 9',
  'Alt text picture 10',
  'Document title',
  'Shortener',
  'Video Thumbnail Url',
  'Video Cover Frame',
  'Twitter/X Can reply',
  'Twitter/X Type',
  'Twitter/X Poll Duration minutes',
  'Twitter/X Poll Option 1',
  'Twitter/X Poll Option 2',
  'Twitter/X Poll Option 3',
  'Twitter/X Poll Option 4',
  'Pinterest Board',
  'Pinterest Pin Title',
  'Pinterest Pin Link',
  'Pinterest Pin New Format',
  'Instagram Post Type',
  'Instagram Show Reel On Feed',
  'Youtube Video Title',
  'Youtube Video Type',
  'Youtube Video Privacy',
  'Youtube video for kids',
  'Youtube Video Category',
  'Youtube Video Tags',
  'Youtube playlist',
  'GBP Post Type',
  'Facebook Post Type',
  'Facebook Title',
  'First Comment Text',
  'TikTok Title',
  'TikTok disable comments',
  'TikTok disable duet',
  'TikTok disable stitch',
  'TikTok Post Privacy',
  'TikTok Branded Content',
  'TikTok Your Brand',
  'TikTok Auto Add Music',
  'TikTok Photo Cover Index',
  'TikTok musicId',
  'TikTok music title',
  'TikTok music author',
  'TikTok music previewUrl',
  'TikTok music thumbnailUrl',
  'TikTok music soundVolume',
  'TikTok music originalVolume',
  'TikTok music startMillis',
  'TikTok music endMillis',
  'TikTok Ai generated content',
  'LinkedIn Type',
  'LinkedIn Poll Question',
  'LinkedIn Poll Option 1',
  'LinkedIn Poll Option 2',
  'LinkedIn Poll Option 3',
  'LinkedIn Poll Option 4',
  'LinkedIn Poll Duration',
  'LinkedIn Show link preview',
  'LinkedIn Images as Carousel',
  'Threads Reply Control',
  'Threads Is Spoiler',
  'Threads Post Type',
  'Brand name',
] as const;

const PLATFORM_COL: Record<
  'Facebook' | 'Twitter/X' | 'LinkedIn' | 'GBP' | 'Instagram' | 'Pinterest' | 'TikTok' | 'Youtube' | 'Threads' | 'Bluesky',
  ContentPlatform | null
> = {
  Facebook: 'facebook',
  'Twitter/X': 'x',
  LinkedIn: null,
  GBP: null,
  Instagram: 'instagram',
  Pinterest: 'pinterest',
  TikTok: 'tiktok',
  Youtube: null,
  Threads: null,
  Bluesky: null,
};

function platformFlags(platform: ContentPlatform): Record<string, boolean> {
  const flags: Record<string, boolean> = {};
  for (const [col, mapped] of Object.entries(PLATFORM_COL)) {
    flags[col] = mapped === platform;
  }
  return flags;
}

/** Map our format to Metricool Instagram Post Type. */
function igPostType(format: ContentFormat): string {
  if (format === 'reel') return 'REEL';
  if (format === 'story') return 'STORY';
  return 'POST';
}

/** Map our format to Metricool Facebook Post Type. */
function fbPostType(format: ContentFormat): string {
  if (format === 'reel') return 'REEL';
  if (format === 'story') return 'STORY';
  return 'POST';
}

/** One Metricool data row as ordered cell values matching METRICOOL_HEADERS. */
export function metricoolRowCells(
  row: ExportRow,
  options: ExportOptions,
): Array<string | boolean> {
  const flags = platformFlags(row.piece.platform);
  const pics = row.imageUrls.slice(0, 10);
  const alts = Array.from({ length: 10 }, (_, i) =>
    pics[i] ? row.piece.media?.alt ?? row.piece.title : '',
  );
  const picCells = Array.from({ length: 10 }, (_, i) => pics[i] ?? '');

  const isIg = row.piece.platform === 'instagram';
  const isFb = row.piece.platform === 'facebook';
  const isPin = row.piece.platform === 'pinterest';
  const isTt = row.piece.platform === 'tiktok';
  const isX = row.piece.platform === 'x';

  const pinTitle =
    row.piece.seo?.metaTitle ??
    row.piece.title ??
    '';
  const pinLink = row.link ?? '';

  const cells: Array<string | boolean> = [
    row.content,
    formatDate(row.scheduledAt),
    formatTime(row.scheduledAt),
    options.asDraft === true,
    flags.Facebook,
    flags['Twitter/X'],
    flags.LinkedIn,
    flags.GBP,
    flags.Instagram,
    flags.Pinterest,
    flags.TikTok,
    flags.Youtube,
    flags.Threads,
    flags.Bluesky,
    ...picCells,
    ...alts,
    '', // Document title
    true, // Shortener
    row.thumbnailUrl ?? '',
    '', // Video Cover Frame
    '', // Twitter/X Can reply
    isX ? 'POST' : '',
    '',
    '',
    '',
    '',
    '',
    '', // Pinterest Board
    isPin ? pinTitle.slice(0, 100) : '',
    isPin ? pinLink : '',
    false, // Pinterest Pin New Format
    isIg ? igPostType(row.piece.format) : '',
    isIg && row.piece.format === 'reel' ? true : '',
    '', // Youtube Video Title
    '',
    '',
    '',
    '',
    '',
    '',
    '', // GBP Post Type
    isFb ? fbPostType(row.piece.format) : '',
    '', // Facebook Title
    '', // First Comment Text
    isTt ? row.piece.title.slice(0, 90) : '',
    false,
    false,
    false,
    isTt ? 'PUBLIC_TO_EVERYONE' : '',
    false,
    false,
    false,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    false, // TikTok Ai generated content
    '', // LinkedIn Type
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '', // Threads Reply Control
    '',
    '',
    options.brandName ?? 'MotherMode',
  ];

  return cells;
}

/** Build the full Metricool CSV string. */
export function buildMetricoolCsv(
  rows: ExportRow[],
  options: ExportOptions,
): string {
  const lines = [csvLine([...METRICOOL_HEADERS])];
  for (const row of rows) {
    lines.push(csvLine(metricoolRowCells(row, options)));
  }
  return csvDocument(lines);
}

export function metricoolFilename(options: ExportOptions): string {
  const day = options.campaignStart || 'export';
  return `metricool-${slugFilename(day)}.csv`;
}
