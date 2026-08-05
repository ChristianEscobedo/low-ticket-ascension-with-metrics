/**
 * Freshness + cache badges (roadmap 0.4): how old is this evidence, and
 * did this tool call come from the cache. Pure: no imports.
 */

/** Human age of an ISO timestamp: just now, 5m, 2h, 3d, 2w, 4mo. */
export function formatAge(iso: string | null, now = Date.now()): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const ms = now - t;
  if (ms < 0) return 'just now';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks}w`;
  return `${Math.floor(days / 30)}mo`;
}

/** Did this call's result come from the cache? (0.3 stamps "(cached)".) */
export function isCachedSummary(resultSummary: string): boolean {
  return /\(cached\)/i.test(resultSummary || '');
}
