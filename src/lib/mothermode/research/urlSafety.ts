/**
 * URL safety for the research tools (roadmap task 2.5): the SSRF allowlist.
 *
 * post_comments is the one tool that takes a raw URL from the model and
 * hands it to a paid scraper. Without a gate, a hallucinated or injected
 * URL ("http://169.254.169.254/latest/meta-data", "http://localhost:3000")
 * would ride along. The gate: the URL must be http(s) AND its host must
 * belong to the platform the tool claims it is.
 *
 * Pure: no imports.
 */

const PLATFORM_HOSTS: Record<string, string[]> = {
  tiktok: ['tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'],
  instagram: ['instagram.com', 'www.instagram.com', 'm.instagram.com'],
  x: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'],
  youtube: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'music.youtube.com'],
};

export type UrlCheck = { ok: true } | { ok: false; reason: string };

/**
 * May this URL go to the scraper for this platform? http(s) only, and the
 * host must be on the platform's allowlist (subdomains of an allowed host
 * pass; lookalikes like tiktok.com.evil.com do not).
 */
export function checkPostUrl(platform: string, url: string): UrlCheck {
  const clean = (url || '').trim();
  if (!clean) return { ok: false, reason: 'a post URL is required' };
  let parsed: URL;
  try {
    parsed = new URL(clean);
  } catch {
    return { ok: false, reason: `"${clean.slice(0, 60)}" is not a valid URL` };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      ok: false,
      reason: `only http(s) post URLs are allowed (got ${parsed.protocol}//)`,
    };
  }
  const allowed = PLATFORM_HOSTS[platform.toLowerCase()];
  if (!allowed) {
    return { ok: false, reason: `no URL allowlist for platform "${platform}"` };
  }
  const host = parsed.hostname.toLowerCase();
  const match = allowed.some(
    (h) => host === h || host.endsWith(`.${h}`),
  );
  if (!match) {
    return {
      ok: false,
      reason: `"${host}" is not a ${platform} host. post_comments only runs on real ${platform} post URLs (${allowed.slice(0, 2).join(' / ')}).`,
    };
  }
  return { ok: true };
}
