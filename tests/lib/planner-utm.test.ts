import { describe, it, expect } from 'vitest';

import {
  slugifyUtm,
  funnelPagePath,
  funnelPageUrl,
  funnelPageLabel,
  buildUtmUrl,
  parseUtmFromUrl,
  mediumForFormat,
  suggestUtm,
  newShortCode,
  shortLinkUrl,
  uaFamily,
} from '../../src/lib/mothermode/planner/utm';

describe('slugifyUtm', () => {
  it('lowercases and underscores so one channel is not split into three', () => {
    expect(slugifyUtm('Instagram')).toBe('instagram');
    expect(slugifyUtm('Instagram Reels')).toBe('instagram_reels');
    expect(slugifyUtm("Mother's Day")).toBe('mothers_day');
  });

  it('trims separator runs rather than leaving empty segments', () => {
    expect(slugifyUtm('  hello --- world  ')).toBe('hello_world');
    expect(slugifyUtm('!!!')).toBe('');
  });

  it('survives empty and undefined-ish input', () => {
    expect(slugifyUtm('')).toBe('');
    expect(slugifyUtm(undefined as unknown as string)).toBe('');
  });
});

describe('funnelPagePath', () => {
  it('maps optin to the funnel index, not a nested /optin route', () => {
    expect(funnelPagePath('my-offer', 'optin')).toBe('/funnel/my-offer');
    expect(funnelPagePath('my-offer', '')).toBe('/funnel/my-offer');
  });

  it('maps upsell1 to the unsuffixed path and the rest to their real dirs', () => {
    expect(funnelPagePath('x', 'upsell1')).toBe('/funnel/x/upsell');
    expect(funnelPagePath('x', 'upsell2')).toBe('/funnel/x/upsell-2');
    expect(funnelPagePath('x', 'upsell3')).toBe('/funnel/x/upsell-3');
    expect(funnelPagePath('x', 'upsell4')).toBe('/funnel/x/upsell-4');
  });

  it('passes through the straightforward pages', () => {
    expect(funnelPagePath('x', 'sales')).toBe('/funnel/x/sales');
    expect(funnelPagePath('x', 'vsl')).toBe('/funnel/x/vsl');
    expect(funnelPagePath('x', 'checkout')).toBe('/funnel/x/checkout');
  });

  it('returns empty for a missing slug instead of a broken /funnel/ path', () => {
    expect(funnelPagePath('', 'sales')).toBe('');
    expect(funnelPagePath('   ', 'sales')).toBe('');
  });

  it('tolerates a slug pasted with slashes', () => {
    expect(funnelPagePath('/my-offer/', 'sales')).toBe('/funnel/my-offer/sales');
  });
});

describe('funnelPageUrl', () => {
  it('joins origin and path without doubling the slash', () => {
    expect(funnelPageUrl('https://site.com', 'x', 'sales')).toBe('https://site.com/funnel/x/sales');
    expect(funnelPageUrl('https://site.com/', 'x', 'sales')).toBe('https://site.com/funnel/x/sales');
  });

  it('is empty when the slug is missing, so no half-built URL escapes', () => {
    expect(funnelPageUrl('https://site.com', '', 'sales')).toBe('');
  });
});

describe('funnelPageLabel', () => {
  it('labels known pages and falls back for unknown/empty', () => {
    expect(funnelPageLabel('upsell2')).toBe('Upsell 2');
    expect(funnelPageLabel('optin')).toBe('Opt-in');
    expect(funnelPageLabel('')).toBe('Not linked');
    expect(funnelPageLabel('mystery')).toBe('mystery');
  });
});

describe('buildUtmUrl', () => {
  it('appends params to a clean URL', () => {
    const url = buildUtmUrl('https://site.com/funnel/x/sales', {
      source: 'instagram',
      medium: 'organic_social',
      campaign: 'my_offer',
      content: 'gen_12_3',
    });
    expect(url).toBe(
      'https://site.com/funnel/x/sales?utm_source=instagram&utm_medium=organic_social&utm_campaign=my_offer&utm_content=gen_12_3',
    );
  });

  it('merges into an existing query string instead of producing a second ?', () => {
    const url = buildUtmUrl('https://site.com/p?ref=partner', { source: 'ig' });
    expect(url).toBe('https://site.com/p?ref=partner&utm_source=ig');
    expect(url.match(/\?/g)).toHaveLength(1);
  });

  it('omits empty params rather than emitting utm_term=', () => {
    const url = buildUtmUrl('https://site.com/p', { source: 'ig', term: '   ' });
    expect(url).toBe('https://site.com/p?utm_source=ig');
    expect(url).not.toContain('utm_term');
  });

  it('replaces pre-existing utm_* so rebuilding twice does not duplicate keys', () => {
    const once = buildUtmUrl('https://site.com/p', { source: 'ig' });
    const twice = buildUtmUrl(once, { source: 'tiktok' });
    expect(twice).toBe('https://site.com/p?utm_source=tiktok');
    expect(twice.match(/utm_source/g)).toHaveLength(1);
  });

  it('keeps the hash fragment after the query, not before it', () => {
    expect(buildUtmUrl('https://site.com/p#pricing', { source: 'ig' })).toBe(
      'https://site.com/p?utm_source=ig#pricing',
    );
  });

  it('encodes values so a space cannot break the URL', () => {
    expect(buildUtmUrl('https://site.com/p', { campaign: 'spring sale' })).toContain(
      'utm_campaign=spring%20sale',
    );
  });

  it('returns the base untouched when there is nothing to add', () => {
    expect(buildUtmUrl('https://site.com/p', {})).toBe('https://site.com/p');
  });

  it('returns empty for an empty base', () => {
    expect(buildUtmUrl('', { source: 'ig' })).toBe('');
  });
});

describe('parseUtmFromUrl', () => {
  it('round-trips buildUtmUrl', () => {
    const params = {
      source: 'instagram',
      medium: 'organic_social',
      campaign: 'spring sale',
      content: 'plan_abc',
      term: 'x',
    };
    expect(parseUtmFromUrl(buildUtmUrl('https://site.com/p', params))).toEqual(params);
  });

  it('returns blanks for a URL with no params', () => {
    expect(parseUtmFromUrl('https://site.com/p')).toEqual({
      source: '',
      medium: '',
      campaign: '',
      content: '',
      term: '',
    });
  });

  it('does not throw on a malformed escape sequence', () => {
    expect(() => parseUtmFromUrl('https://site.com/p?utm_source=%E0%A4%A')).not.toThrow();
  });
});

describe('mediumForFormat', () => {
  it('groups channels coarsely', () => {
    expect(mediumForFormat('email newsletter')).toBe('email');
    expect(mediumForFormat('paid ad')).toBe('paid_social');
    expect(mediumForFormat('blog post')).toBe('organic_search');
    expect(mediumForFormat('DM script')).toBe('direct_message');
    expect(mediumForFormat('bio link')).toBe('bio_link');
  });

  it('defaults unknown and empty formats to organic_social', () => {
    expect(mediumForFormat('reel')).toBe('organic_social');
    expect(mediumForFormat('')).toBe('organic_social');
  });
});

describe('suggestUtm', () => {
  it('derives source/medium/campaign and uses pieceId as content', () => {
    expect(
      suggestUtm({
        platform: 'Instagram',
        format: 'Reel',
        pieceId: 'gen_7_2',
        funnelSlug: 'weekend-pack',
      }),
    ).toEqual({
      source: 'instagram',
      medium: 'organic_social',
      campaign: 'weekend_pack',
      content: 'gen_7_2',
      term: '',
    });
  });

  it('does NOT slugify pieceId, because it must match the lead row exactly', () => {
    expect(suggestUtm({ pieceId: 'plan_9f3B-2A' }).content).toBe('plan_9f3B-2A');
  });

  it('prefers an explicit campaign override over the funnel slug', () => {
    expect(suggestUtm({ funnelSlug: 'a', campaignOverride: 'Black Friday' }).campaign).toBe(
      'black_friday',
    );
  });

  it('falls back to direct/general rather than emitting empty params', () => {
    expect(suggestUtm({})).toEqual({
      source: 'direct',
      medium: 'organic_social',
      campaign: 'general',
      content: '',
      term: '',
    });
  });
});

describe('newShortCode', () => {
  it('honours the requested length', () => {
    expect(newShortCode(8, () => 0)).toHaveLength(8);
    expect(newShortCode(4, () => 0)).toHaveLength(4);
  });

  it('avoids vowels and ambiguous glyphs so codes can be read aloud', () => {
    const code = newShortCode(200, (() => {
      let i = 0;
      // Walk the whole alphabet deterministically.
      return () => (i++ % 28) / 28;
    })());
    expect(code).not.toMatch(/[aeiou01lIO]/);
  });

  it('is deterministic under an injected random, which is what makes it testable', () => {
    expect(newShortCode(6, () => 0)).toBe(newShortCode(6, () => 0));
  });
});

describe('shortLinkUrl', () => {
  it('builds /go/<code> without doubling the slash', () => {
    expect(shortLinkUrl('https://site.com/', 'bcd234')).toBe('https://site.com/go/bcd234');
  });

  it('is empty without a code, so no bare /go/ link is ever shown', () => {
    expect(shortLinkUrl('https://site.com', '')).toBe('');
  });
});

describe('uaFamily', () => {
  it('flags link-preview fetchers as bots so day-one counts are not inflated', () => {
    expect(uaFamily('facebookexternalhit/1.1')).toBe('bot');
    expect(uaFamily('Slackbot-LinkExpanding 1.0')).toBe('bot');
    expect(uaFamily('WhatsApp/2.0')).toBe('bot');
    expect(uaFamily('curl/8.1.2')).toBe('bot');
  });

  it('classifies real devices coarsely', () => {
    expect(uaFamily('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe('ios');
    expect(uaFamily('Mozilla/5.0 (Linux; Android 14)')).toBe('android');
    expect(uaFamily('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)')).toBe('desktop');
  });

  it('returns unknown for a missing UA instead of guessing', () => {
    expect(uaFamily('')).toBe('unknown');
    expect(uaFamily(null)).toBe('unknown');
    expect(uaFamily(undefined)).toBe('unknown');
  });
});
