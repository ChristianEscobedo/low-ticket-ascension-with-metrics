/**
 * RFC 4180-style CSV helpers shared by Metricool and GHL exporters.
 */

/** Escape a single cell: wrap when needed, double embedded quotes. */
export function csvCell(
  value: string | number | boolean | null | undefined,
): string {
  if (value === null || value === undefined) return '';
  const s =
    typeof value === 'string'
      ? value
      : typeof value === 'boolean'
        ? value
          ? 'true'
          : 'false'
        : String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Join cells into one CSV line. */
export function csvLine(
  cells: Array<string | number | boolean | null | undefined>,
): string {
  return cells.map(csvCell).join(',');
}

/** Join lines with LF (Metricool / GHL samples use plain newlines). */
export function csvDocument(lines: string[]): string {
  return lines.join('\n') + (lines.length ? '\n' : '');
}

/** Format a Date as YYYY-MM-DD using local wall-clock fields. */
export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Format a Date as HH:mm:ss using local wall-clock fields. */
export function formatTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/** Format a Date as YYYY-MM-DD HH:mm:ss (GHL postAtSpecificTime). */
export function formatDateTime(d: Date): string {
  return `${formatDate(d)} ${formatTime(d)}`;
}

/** Parse YYYY-MM-DD into a local Date at midnight. Invalid → null. */
export function parseDateOnly(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d, 0, 0, 0, 0);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== mo ||
    dt.getDate() !== d
  ) {
    return null;
  }
  return dt;
}

/** Parse HH:mm or HH:mm:ss into {h,m,s}. Invalid → null. */
export function parseTimeOnly(
  raw: string,
): { h: number; m: number; s: number } | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(raw.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const s = m[3] != null ? Number(m[3]) : 0;
  if (h > 23 || min > 59 || s > 59) return null;
  return { h, m: min, s };
}

/** Safe filename fragment: alphanumerics, dash, underscore. */
export function slugFilename(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
