import { describe, expect, it } from 'vitest';

import { isLoopbackUrl } from '@/lib/mothermode/planner/links';

/**
 * The cost of a false negative here is a permanent row: base_url/full_url are
 * stored and /go/<code> redirects to the stored value, so a localhost link that
 * slips through is dead for everyone except the machine that minted it.
 */
describe('isLoopbackUrl', () => {
  it('catches the hosts a dev environment actually produces', () => {
    expect(isLoopbackUrl('http://localhost:3000/funnel/x')).toBe(true);
    expect(isLoopbackUrl('http://127.0.0.1:3000/optin/x')).toBe(true);
    expect(isLoopbackUrl('http://0.0.0.0:3000/')).toBe(true);
    expect(isLoopbackUrl('http://app.localhost:3000/')).toBe(true);
    expect(isLoopbackUrl('http://mymac.local/')).toBe(true);
  });

  it('leaves real domains alone, including ones containing "localhost"', () => {
    expect(isLoopbackUrl('https://example.com/funnel/x')).toBe(false);
    // Substring matching would wrongly flag this; the check is host-anchored.
    expect(isLoopbackUrl('https://localhost.example.com/')).toBe(false);
    expect(isLoopbackUrl('https://notlocal.com/')).toBe(false);
  });

  it('treats an unparseable URL as not-loopback', () => {
    // A malformed URL is a different error. Reporting it as loopback would
    // block minting while naming the wrong cause.
    expect(isLoopbackUrl('')).toBe(false);
    expect(isLoopbackUrl('not a url')).toBe(false);
  });
});
