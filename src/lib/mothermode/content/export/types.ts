/**
 * Types for the content hub export system: Metricool calendar CSV and GHL
 * Social Planner (basic + advanced) CSV, with selection scopes and schedule
 * options that map week-based pieces onto real calendar dates.
 */
import type { ContentKind, ContentPiece, ContentPlatform } from '../types';
import type { PieceReview } from '../review';
import type { SavedVersion } from '../versions';

/** Destinations the exporter can target. */
export type ExportTarget = 'metricool' | 'ghl-basic' | 'ghl-advanced';

/** How the user picks which pieces leave the hub. */
export type ExportScope =
  | 'current'
  | 'selected'
  | 'weeks'
  | 'months'
  | 'platforms'
  | 'range'
  | 'all';

/** Campaign months over the 12-week plan: 1 = weeks 1-4, 2 = 5-8, 3 = 9-12. */
export type CampaignMonth = 1 | 2 | 3;

/** Platforms that map cleanly into Metricool / GHL social planners. */
export const SOCIAL_EXPORT_PLATFORMS: ContentPlatform[] = [
  'facebook',
  'instagram',
  'x',
  'tiktok',
  'pinterest',
];

/** Options that shape selection, schedule, and output. */
export interface ExportOptions {
  target: ExportTarget;
  scope: ExportScope;
  /** Explicit piece ids when scope is 'selected'. */
  selectedIds?: string[];
  /** Week numbers 1-12 when scope is 'weeks'. */
  weeks?: number[];
  /** Campaign months when scope is 'months'. */
  months?: CampaignMonth[];
  /** Platforms when scope is 'platforms' or 'range'. */
  platforms?: ContentPlatform[];
  /**
   * Inclusive campaign window (YYYY-MM-DD). Used with scope 'range' after
   * dates are assigned, and as the start for week→date mapping.
   */
  rangeStart?: string;
  rangeEnd?: string;
  /** Campaign start date (YYYY-MM-DD) used to map week N onto real days. */
  campaignStart: string;
  /** Default post time HH:mm:ss (24h). */
  defaultTime: string;
  /** Include paid ads. Default true. */
  includeAds?: boolean;
  /** Include email / blog / aeo as text-only rows. Default false. */
  includeNonSocial?: boolean;
  /** Prefer SavedVersion.scheduledFor when present. Default true. */
  useScheduledVersions?: boolean;
  /** Mark Metricool Draft column true. Default false. */
  asDraft?: boolean;
  /** Optional GHL advanced tags (comma-separated in CSV). */
  tags?: string[];
  /** Optional GHL advanced category. */
  category?: string;
  /** Offer URL used for CTA / OG link when piece.link is empty. */
  offerUrl?: string;
  /** Brand name for Metricool Brand name column. */
  brandName?: string;
}

/** One piece ready to serialize, with resolved schedule and media. */
export interface ExportRow {
  piece: ContentPiece;
  review?: PieceReview;
  version?: SavedVersion;
  /** Resolved publish datetime (local wall clock). */
  scheduledAt: Date;
  /** Publishable caption for the planner. */
  content: string;
  /** Absolute http(s) image URLs only. */
  imageUrls: string[];
  /** Absolute http(s) video URLs only. */
  videoUrls: string[];
  /** Absolute thumbnail / poster URL when available. */
  thumbnailUrl?: string;
  /** CTA / offer link. */
  link?: string;
  /** True when media was present but not exportable (data URL / relative). */
  missingMedia: boolean;
}

/** Summary shown in the export panel before download. */
export interface ExportPreview {
  count: number;
  withImages: number;
  missingMedia: number;
  byPlatform: Partial<Record<ContentPlatform, number>>;
}

/** Result of building a CSV. */
export interface ExportCsvResult {
  filename: string;
  csv: string;
  preview: ExportPreview;
  rows: ExportRow[];
}

export type { ContentKind, ContentPiece, ContentPlatform, PieceReview, SavedVersion };
