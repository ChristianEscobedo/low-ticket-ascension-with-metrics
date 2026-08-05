import { describe, expect, it } from 'vitest';

import {
  OPTIN_PAGES,
  optinPageLabel,
  optinPagePath,
  optinPageUrl
} from '@/lib/mothermode/planner/utm';

/**
 * These lock the route shape, not the formatting. Every assertion here maps to a
 * real file under src/app/optin/[slug]/ — if a path stops matching the router,
 * a minted lead-magnet link 404s only after someone clicks it in the wild.
 */
describe('optin (lead magnet) step URLs', () => {
  it('treats step 1 as the funnel index, not a named child route', () => {
    // /optin/<slug>/optin does not exist; page.tsx is the opt-in step.
    expect(optinPagePath('free-guide', 'optin')).toBe('/optin/free-guide');
  });

  it('maps the named steps to their real child routes', () => {
    expect(optinPagePath('free-guide', 'oto')).toBe('/optin/free-guide/oto');
    expect(optinPagePath('free-guide', 'thank-you')).toBe(
      '/optin/free-guide/thank-you'
    );
  });

  it('defaults a missing step to the opt-in page rather than a bad path', () => {
    expect(optinPagePath('free-guide', '')).toBe('/optin/free-guide');
  });

  it('returns empty for a missing slug so callers can refuse to mint', () => {
    // Empty is a signal, not a URL: '/optin/' would be a live 404.
    expect(optinPagePath('', 'oto')).toBe('');
    expect(optinPageUrl('https://x.com', '', 'oto')).toBe('');
  });

  it('builds absolute URLs without doubling the slash', () => {
    expect(optinPageUrl('https://x.com/', 'g', 'oto')).toBe(
      'https://x.com/optin/g/oto'
    );
    expect(optinPageUrl('https://x.com', 'g', 'optin')).toBe(
      'https://x.com/optin/g'
    );
  });

  it('every declared step resolves to a non-empty path', () => {
    for (const p of OPTIN_PAGES) {
      expect(optinPagePath('s', p)).not.toBe('');
      expect(optinPageLabel(p)).toBeTruthy();
    }
  });

  it('labels an unknown step as itself instead of throwing', () => {
    expect(optinPageLabel('mystery')).toBe('mystery');
  });
});
