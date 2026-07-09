/**
 * Selection filters and week→calendar date assignment for content export.
 * Week assignment mirrors content/index weekOf without importing the aggregator
 * (avoids a circular module graph once the hub re-exports this package).
 */
import type { ContentPiece, ContentPlatform } from '../types';
import type { PieceReview } from '../review';
import type { SavedVersion } from '../versions';
import {
  parseDateOnly,
  parseTimeOnly,
  formatDate,
} from './csv';
import {
  buildExportCaption,
  collectImageUrls,
  collectVideoUrls,
  resolveLink,
} from './text';
import {
  SOCIAL_EXPORT_PLATFORMS,
  type CampaignMonth,
  type ExportOptions,
  type ExportPreview,
  type ExportRow,
} from './types';

/** Matches content/index TOTAL_WEEKS. */
const TOTAL_WEEKS = 12;

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Same rules as content/index weekOf. */
function weekOf(piece: ContentPiece): number {
  if (
    typeof piece.week === 'number' &&
    piece.week >= 1 &&
    piece.week <= TOTAL_WEEKS
  ) {
    return piece.week;
  }
  return (hashId(piece.id) % TOTAL_WEEKS) + 1;
}


/** Weeks covered by a campaign month (1-based months over a 12-week plan). */
export function weeksForMonth(month: CampaignMonth): number[] {
  const start = (month - 1) * 4 + 1;
  return [start, start + 1, start + 2, start + 3].filter(
    (w) => w >= 1 && w <= TOTAL_WEEKS,
  );
}

/** Expand selected months into a unique sorted week list. */
export function weeksForMonths(months: CampaignMonth[]): number[] {
  const set = new Set<number>();
  for (const m of months) for (const w of weeksForMonth(m)) set.add(w);
  return Array.from(set).sort((a, b) => a - b);
}

/** Stagger offsets (days into the week) so posts in the same week don't collide. */
const DAY_SLOTS = [0, 2, 4, 1, 3, 5, 6];

/**
 * Assign a local Date for a piece from campaign start + week number.
 * indexWithinWeek spreads multiple pieces across Mon/Wed/Fri-style slots and
 * adds a few minutes so bulk imports stay unique.
 */
export function assignScheduleDate(
  campaignStart: Date,
  week: number,
  indexWithinWeek: number,
  defaultTime: { h: number; m: number; s: number },
): Date {
  const safeWeek = Math.min(Math.max(week, 1), TOTAL_WEEKS);
  const dayOffset =
    (safeWeek - 1) * 7 + DAY_SLOTS[indexWithinWeek % DAY_SLOTS.length];
  const minuteBump = Math.floor(indexWithinWeek / DAY_SLOTS.length) * 5;
  const d = new Date(
    campaignStart.getFullYear(),
    campaignStart.getMonth(),
    campaignStart.getDate() + dayOffset,
    defaultTime.h,
    defaultTime.m + minuteBump,
    defaultTime.s,
    0,
  );
  return d;
}

/** Parse SavedVersion.scheduledFor (ISO) into a Date, or null. */
export function parseScheduledFor(iso?: string): Date | null {
  if (!iso || !iso.trim()) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** True when a piece is a social channel we export by default. */
export function isSocialPlatform(p: ContentPlatform): boolean {
  return SOCIAL_EXPORT_PLATFORMS.includes(p);
}

/**
 * Filter the library down to the export scope. `currentPieces` is the hub's
 * already-filtered list (used when scope is 'current').
 */
export function selectPieces(
  allPieces: ContentPiece[],
  options: ExportOptions,
  currentPieces?: ContentPiece[],
): ContentPiece[] {
  const includeAds = options.includeAds !== false;
  const includeNonSocial = options.includeNonSocial === true;

  let base: ContentPiece[];
  switch (options.scope) {
    case 'current':
      base = currentPieces ?? allPieces;
      break;
    case 'selected': {
      const ids = new Set(options.selectedIds ?? []);
      base = allPieces.filter((p) => ids.has(p.id));
      break;
    }
    case 'weeks': {
      const weeks = new Set(options.weeks ?? []);
      base = allPieces.filter((p) => weeks.has(weekOf(p)));
      break;
    }
    case 'months': {
      const weeks = new Set(weeksForMonths(options.months ?? []));
      base = allPieces.filter((p) => weeks.has(weekOf(p)));
      break;
    }
    case 'platforms': {
      const plats = new Set(options.platforms ?? SOCIAL_EXPORT_PLATFORMS);
      base = allPieces.filter((p) => plats.has(p.platform));
      break;
    }
    case 'range': {
      // Platform filter first; date window applied after schedule assignment.
      const plats = options.platforms?.length
        ? new Set(options.platforms)
        : null;
      base = plats
        ? allPieces.filter((p) => plats.has(p.platform))
        : allPieces;
      break;
    }
    case 'all':
    default:
      base = allPieces;
      break;
  }

  return base.filter((p) => {
    if (!includeAds && p.kind === 'ad') return false;
    if (!includeNonSocial && !isSocialPlatform(p.platform)) return false;
    return true;
  });
}

export interface BuildRowsInput {
  pieces: ContentPiece[];
  options: ExportOptions;
  /** Review state keyed by piece id. */
  reviews?: Record<string, PieceReview>;
  /** Optional best scheduled version per piece id. */
  versionsByPiece?: Record<string, SavedVersion | undefined>;
}

/**
 * Build ordered ExportRows with resolved captions, media, and schedule times.
 * Sorted by scheduledAt ascending.
 */
export function buildExportRows(input: BuildRowsInput): ExportRow[] {
  const { pieces, options, reviews = {}, versionsByPiece = {} } = input;
  const start = parseDateOnly(options.campaignStart);
  if (!start) {
    throw new Error('Invalid campaign start date (use YYYY-MM-DD)');
  }
  const time =
    parseTimeOnly(options.defaultTime) ?? ({ h: 10, m: 0, s: 0 } as const);
  const useVersions = options.useScheduledVersions !== false;

  // Group by week so indexWithinWeek is stable per week.
  const byWeek = new Map<number, ContentPiece[]>();
  for (const p of pieces) {
    const w = weekOf(p);
    const list = byWeek.get(w) ?? [];
    list.push(p);
    byWeek.set(w, list);
  }
  // Stable order within week: platform then id.
  Array.from(byWeek.values()).forEach((list) => {
    list.sort((a: ContentPiece, b: ContentPiece) =>
      a.platform === b.platform
        ? a.id.localeCompare(b.id)
        : a.platform.localeCompare(b.platform),
    );
  });

  const weekIndex = new Map<string, number>();
  Array.from(byWeek.values()).forEach((list) => {
    list.forEach((p: ContentPiece, i: number) => weekIndex.set(p.id, i));
  });


  const rangeStart = options.rangeStart
    ? parseDateOnly(options.rangeStart)
    : null;
  const rangeEnd = options.rangeEnd ? parseDateOnly(options.rangeEnd) : null;
  // Inclusive end-of-day for rangeEnd.
  const rangeEndExclusive = rangeEnd
    ? new Date(
        rangeEnd.getFullYear(),
        rangeEnd.getMonth(),
        rangeEnd.getDate() + 1,
      )
    : null;

  const rows: ExportRow[] = [];
  for (const piece of pieces) {
    const review = reviews[piece.id];
    const version = useVersions ? versionsByPiece[piece.id] : undefined;
    const fromVersion = useVersions
      ? parseScheduledFor(version?.scheduledFor)
      : null;
    const scheduledAt =
      fromVersion ??
      assignScheduleDate(
        start,
        weekOf(piece),
        weekIndex.get(piece.id) ?? 0,
        time,
      );

    if (options.scope === 'range') {
      if (rangeStart && scheduledAt < rangeStart) continue;
      if (rangeEndExclusive && scheduledAt >= rangeEndExclusive) continue;
    }

    const { urls: imageUrls, missingMedia } = collectImageUrls(
      piece,
      review,
      version,
    );
    const { videos, thumbnail } = collectVideoUrls(piece, review);
    // Prefer images for still posts; if only video, leave images empty.
    const content = buildExportCaption(
      piece,
      review,
      version,
      options.offerUrl,
    );

    rows.push({
      piece,
      review,
      version,
      scheduledAt,
      content,
      imageUrls,
      videoUrls: videos,
      thumbnailUrl: thumbnail,
      link: resolveLink(piece, options.offerUrl),
      missingMedia,
    });
  }

  rows.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  return rows;
}

/** Summarize rows for the export panel. */
export function previewRows(rows: ExportRow[]): ExportPreview {
  const byPlatform: ExportPreview['byPlatform'] = {};
  let withImages = 0;
  let missingMedia = 0;
  for (const r of rows) {
    byPlatform[r.piece.platform] = (byPlatform[r.piece.platform] ?? 0) + 1;
    if (r.imageUrls.length > 0 || r.videoUrls.length > 0) withImages += 1;
    if (r.missingMedia) missingMedia += 1;
  }
  return { count: rows.length, withImages, missingMedia, byPlatform };
}

/** Default campaign start: next Monday (local). */
export function defaultCampaignStart(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = d.getDay(); // 0 Sun
  const add = day === 1 ? 0 : day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + add);
  return formatDate(d);
}
