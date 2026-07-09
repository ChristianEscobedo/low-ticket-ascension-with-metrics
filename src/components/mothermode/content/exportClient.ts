/**
 * Browser helpers for content export: trigger a CSV download, and optionally
 * push the same rows to Google Sheets via the admin export API.
 */
import {
  runExport,
  type ExportOptions,
  type ExportPreview,
  type RunExportInput,
} from '@/lib/mothermode/content/export';

/** Trigger a file download in the browser. */
export function downloadTextFile(
  filename: string,
  contents: string,
  mime = 'text/csv;charset=utf-8',
): void {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Build CSV client-side and download it. */
export function downloadExportCsv(input: RunExportInput): {
  preview: ExportPreview;
  filename: string;
  count: number;
} {
  const result = runExport(input);
  downloadTextFile(result.filename, result.csv);
  return {
    preview: result.preview,
    filename: result.filename,
    count: result.rows.length,
  };
}

export type SheetsExportResult =
  | { ok: true; url: string; spreadsheetId: string }
  | { ok: false; error: string };

/**
 * Ask the server to create a Google Sheet from the same export options.
 * The server re-runs the mapper so media/review state is not required in the
 * body beyond options + piece ids (pieces are resolved server-side from the
 * catalog + generated table when possible). For v1 we send the prebuilt CSV.
 */
export async function exportToGoogleSheets(args: {
  title: string;
  csv: string;
  target: ExportOptions['target'];
}): Promise<SheetsExportResult> {
  try {
    const res = await fetch('/api/mothermode/content/export', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        destination: 'sheets',
        title: args.title,
        csv: args.csv,
        target: args.target,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      url?: string;
      spreadsheetId?: string;
    };
    if (!res.ok || !json.ok || !json.url || !json.spreadsheetId) {
      return {
        ok: false,
        error: json.error ?? `Export failed (${res.status})`,
      };
    }
    return { ok: true, url: json.url, spreadsheetId: json.spreadsheetId };
  } catch {
    return { ok: false, error: 'Could not reach the export API' };
  }
}

/** Build CSV without downloading (for Sheets upload). */
export function buildExportCsv(input: RunExportInput) {
  return runExport(input);
}
