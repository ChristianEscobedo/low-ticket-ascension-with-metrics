/**
 * Force a real file download in the browser for any URL — including
 * cross-origin/remote URLs (e.g. Supabase Storage, fal CDN, OpenAI) where a
 * plain `<a download>` is ignored by the browser and just navigates/opens the
 * asset, or writes a placeholder file the OS can't open.
 *
 * Strategy (server-driven, no JS blob reconstruction):
 *  - `data:` URLs download directly (the `download` attribute is honored).
 *  - Same-origin / `blob:` URLs download directly (same-origin honors the
 *    `download` attribute).
 *  - Remote http(s) URLs are downloaded through our same-origin proxy
 *    (`/api/mothermode/download`). The proxy streams the real bytes with
 *    `Content-Disposition: attachment`, so the browser writes the file straight
 *    from the network response. Because the anchor now targets a *same-origin*
 *    URL, the `download` attribute is respected and the file always saves
 *    intact — fixing the Windows "cannot find …\Downloads\<name>" error caused
 *    by corrupt/placeholder cross-origin downloads.
 *
 * This deliberately avoids `fetch()` + `URL.createObjectURL()` blob downloads:
 * a script-constructed object-URL download is both slower for large images and
 * more likely to be flagged/removed by aggressive endpoint-protection
 * heuristics. A normal same-origin attachment download behaves like any other
 * file download in the app.
 */
export function downloadUrl(url: string, filename: string): void {
  if (!url) return;
  const safeName = sanitizeFilename(filename);

  // data:, same-origin and blob: URLs can be downloaded directly — the
  // `download` attribute is honored by the browser in all three cases.
  if (
    url.startsWith('data:') ||
    url.startsWith('blob:') ||
    isSameOrigin(url)
  ) {
    triggerAnchorDownload(url, safeName);
    return;
  }

  // Remote http(s): route through the same-origin proxy so the response is
  // same-origin (download attribute honored) *and* carries
  // Content-Disposition: attachment (forces save with the right filename).
  const proxied = `/api/mothermode/download?url=${encodeURIComponent(
    url,
  )}&name=${encodeURIComponent(safeName)}`;
  triggerAnchorDownload(proxied, safeName);
}

/** True when `url` resolves to the current page origin. */
function isSameOrigin(url: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

/** Click a synthetic anchor to trigger the browser's download UI. */
function triggerAnchorDownload(href: string, filename: string): void {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** Keep filenames filesystem-safe and default a sensible extension. */
export function sanitizeFilename(name: string): string {
  const cleaned = (name || 'download')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || 'download';
}
