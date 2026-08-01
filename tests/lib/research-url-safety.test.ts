import { describe, it, expect } from 'vitest';

import { checkPostUrl } from '@/lib/mothermode/research/urlSafety';

/**
 * The SSRF allowlist (roadmap 2.5), pinned: real platform post URLs pass,
 * metadata endpoints / localhost / lookalike hosts / non-http schemes never
 * reach the paid scraper.
 */

describe('checkPostUrl', () => {
  it('passes real platform post URLs (and their subdomains)', () => {
    for (const [platform, url] of [
      ['tiktok', 'https://www.tiktok.com/@creator/video/7301234567890'],
      ['tiktok', 'https://vm.tiktok.com/ZMabc123/'],
      ['instagram', 'https://www.instagram.com/reel/ABC123/'],
      ['x', 'https://x.com/someone/status/123456'],
      ['x', 'https://twitter.com/someone/status/123456'],
      ['youtube', 'https://www.youtube.com/watch?v=abc123'],
      ['youtube', 'https://youtu.be/abc123'],
    ] as const) {
      expect(checkPostUrl(platform, url).ok, url).toBe(true);
    }
  });

  it('blocks the SSRF classics: metadata, localhost, internal IPs', () => {
    for (const url of [
      'http://169.254.169.254/latest/meta-data',
      'http://localhost:3000/api/admin',
      'http://127.0.0.1:8080/internal',
      'http://192.168.1.1/router',
    ]) {
      const check = checkPostUrl('tiktok', url);
      expect(check.ok, url).toBe(false);
    }
  });

  it('blocks lookalike hosts (tiktok.com.evil.com is not tiktok)', () => {
    const check = checkPostUrl('tiktok', 'https://tiktok.com.evil.com/@x/video/1');
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toContain('not a tiktok host');
  });

  it('blocks cross-platform URLs (an instagram URL is not a tiktok post)', () => {
    expect(checkPostUrl('tiktok', 'https://www.instagram.com/reel/ABC/').ok).toBe(
      false,
    );
  });

  it('blocks non-http schemes and junk', () => {
    expect(checkPostUrl('x', 'ftp://x.com/file').ok).toBe(false);
    expect(checkPostUrl('x', 'not a url at all').ok).toBe(false);
    expect(checkPostUrl('x', '').ok).toBe(false);
  });

  it('blocks platforms with no allowlist (reddit uses its own tool)', () => {
    const check = checkPostUrl('reddit', 'https://reddit.com/r/x/comments/1');
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toContain('no URL allowlist');
  });
});
