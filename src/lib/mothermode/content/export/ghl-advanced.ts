/**
 * GHL Social Planner advanced CSV builder.
 * Two header rows match docs/social-planner-advance-sample.csv.
 */
import type { ContentFormat } from '../types';
import { csvDocument, csvLine, formatDateTime, slugFilename } from './csv';
import type { ExportOptions, ExportRow } from './types';

/** Row 1: platform group labels (exact sample order). */
export const GHL_ADVANCED_GROUP_HEADERS = [
  'All Social',
  'All Social',
  'All Social',
  'All Social',
  'All Social',
  'All Social',
  'All Social',
  'All Social',
  'All Social',
  'All Social',
  'All Social',
  'All Social',
  'Facebook',
  'Instagram',
  'LinkedIn',
  'LinkedIn',
  'Google (GBP)',
  'Google (GBP)',
  'Google (GBP)',
  'Google (GBP)',
  'Google (GBP)',
  'Google (GBP)',
  'Google (GBP)',
  'Google (GBP)',
  'Google (GBP)',
  'Google (GBP)',
  'YouTube',
  'YouTube',
  'YouTube',
  'TikTok',
  'TikTok',
  'TikTok',
  'TikTok',
  'TikTok',
  'TikTok',
  'TikTok',
  'Community',
  'Community',
  'Pinterest',
  'Pinterest',
] as const;

/** Row 2: field names (exact sample order). */
export const GHL_ADVANCED_FIELD_HEADERS = [
  'postAtSpecificTime (YYYY-MM-DD HH:mm:ss)',
  'content',
  'OGmetaUrl (url)',
  'imageUrls (comma-separated)',
  'gifUrl',
  'videoUrls (comma-separated)',
  'thumbnailUrl',
  'mediaOptimization (true/false)',
  'applyWatermark (true/false)',
  'tags (comma-separated)',
  'category',
  'followUpComment',
  'type (post/story/reel)', // Facebook
  'type (post/story/reel)', // Instagram
  'pdfTitle',
  'postAsPdf (true/false)',
  'eventType (call_to_action/event/offer)',
  'actionType (none/order/book/shop/learn_more/call/sign_up)',
  'title', // GBP
  'offerTitle',
  'startDate (YYYY-MM-DD HH:mm:ss)',
  'endDate (YYYY-MM-DD HH:mm:ss)',
  'termsConditions',
  'couponCode',
  'redeemOnlineUrl',
  'actionUrl',
  'title', // YouTube
  'privacyLevel (private/public/unlisted)',
  'type (video/short)',
  'privacyLevel (everyone/friends/only_me)', // TikTok
  'promoteOtherBrand (true/false)',
  'enableComment (true/false)',
  'enableDuet (true/false)',
  'enableStitch (true/false)',
  'videoDisclosure (true/false)',
  'promoteYourBrand (true/false)',
  'title', // Community
  'notifyAllGroupMembers (true/false)',
  'title', // Pinterest
  'link',
] as const;

function joinUrls(urls: string[]): string {
  return urls.join(', ');
}

function ghlType(format: ContentFormat): 'post' | 'story' | 'reel' {
  if (format === 'story') return 'story';
  if (format === 'reel') return 'reel';
  return 'post';
}

export function ghlAdvancedRowCells(
  row: ExportRow,
  options: ExportOptions,
): Array<string | boolean> {
  const platform = row.piece.platform;
  const type = ghlType(row.piece.format);
  const isFb = platform === 'facebook';
  const isIg = platform === 'instagram';
  const isTt = platform === 'tiktok';
  const isPin = platform === 'pinterest';
  const tags = (options.tags ?? []).join(',');
  const pinTitle =
    row.piece.seo?.metaTitle ?? row.piece.title ?? '';

  return [
    formatDateTime(row.scheduledAt),
    row.content,
    row.link ?? '',
    joinUrls(row.imageUrls),
    '',
    joinUrls(row.videoUrls),
    row.thumbnailUrl ?? '',
    true, // mediaOptimization
    false, // applyWatermark
    tags,
    options.category ?? '',
    '', // followUpComment
    isFb ? type : '',
    isIg ? type : '',
    '', // pdfTitle
    false,
    '', // eventType
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '', // YouTube title
    '',
    '',
    isTt ? 'everyone' : '',
    false,
    true,
    true,
    true,
    false,
    false,
    '', // Community title
    false,
    isPin ? pinTitle : '',
    isPin ? row.link ?? '' : '',
  ];
}

export function buildGhlAdvancedCsv(
  rows: ExportRow[],
  options: ExportOptions,
): string {
  const lines = [
    csvLine([...GHL_ADVANCED_GROUP_HEADERS]),
    csvLine([...GHL_ADVANCED_FIELD_HEADERS]),
  ];
  for (const row of rows) {
    lines.push(csvLine(ghlAdvancedRowCells(row, options)));
  }
  return csvDocument(lines);
}

export function ghlAdvancedFilename(options: ExportOptions): string {
  const day = options.campaignStart || 'export';
  return `ghl-social-advanced-${slugFilename(day)}.csv`;
}
