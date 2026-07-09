/**
 * Content hub export: Metricool + GHL Social Planner CSV builders and selection.
 */
import type { ContentPiece } from '../types';
import type { PieceReview } from '../review';
import type { SavedVersion } from '../versions';
import { buildGhlAdvancedCsv, ghlAdvancedFilename } from './ghl-advanced';
import { buildGhlBasicCsv, ghlBasicFilename } from './ghl-basic';
import { buildMetricoolCsv, metricoolFilename } from './metricool';
import {
  buildExportRows,
  previewRows,
  selectPieces,
  defaultCampaignStart,
} from './schedule';
import type {
  ExportCsvResult,
  ExportOptions,
  ExportPreview,
} from './types';

export * from './types';
export * from './csv';
export * from './text';
export * from './schedule';
export * from './metricool';
export * from './ghl-basic';
export * from './ghl-advanced';

export interface RunExportInput {
  /** Full library (static + generated). */
  allPieces: ContentPiece[];
  /** Hub's currently filtered list (for scope 'current'). */
  currentPieces?: ContentPiece[];
  options: ExportOptions;
  reviews?: Record<string, PieceReview>;
  versionsByPiece?: Record<string, SavedVersion | undefined>;
}

/** Select, schedule, and serialize pieces for the chosen target. */
export function runExport(input: RunExportInput): ExportCsvResult {
  const pieces = selectPieces(
    input.allPieces,
    input.options,
    input.currentPieces,
  );
  const rows = buildExportRows({
    pieces,
    options: input.options,
    reviews: input.reviews,
    versionsByPiece: input.versionsByPiece,
  });
  const preview = previewRows(rows);

  let csv: string;
  let filename: string;
  switch (input.options.target) {
    case 'ghl-basic':
      csv = buildGhlBasicCsv(rows);
      filename = ghlBasicFilename(input.options);
      break;
    case 'ghl-advanced':
      csv = buildGhlAdvancedCsv(rows, input.options);
      filename = ghlAdvancedFilename(input.options);
      break;
    case 'metricool':
    default:
      csv = buildMetricoolCsv(rows, input.options);
      filename = metricoolFilename(input.options);
      break;
  }

  return { filename, csv, preview, rows };
}

/** Preview counts without building the full CSV string. */
export function previewExport(input: RunExportInput): ExportPreview {
  const pieces = selectPieces(
    input.allPieces,
    input.options,
    input.currentPieces,
  );
  const rows = buildExportRows({
    pieces,
    options: input.options,
    reviews: input.reviews,
    versionsByPiece: input.versionsByPiece,
  });
  return previewRows(rows);
}

export { defaultCampaignStart };
