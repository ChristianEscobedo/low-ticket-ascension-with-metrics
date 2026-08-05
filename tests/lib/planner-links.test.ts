import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Tests for the admin half of the link registry.
 *
 * The store is a thin layer over PostgREST, so the parts worth testing are the
 * decisions it makes *around* the query: what gets slugified, what happens on
 * each of the two UNIQUE violations, and how click rows and lead rows are
 * folded into numbers. Those are the places a wrong answer is silent.
 *
 * Supabase is faked with a chainable stub rather than a live database: these
 * assertions are about our logic, and a test that needs a network connection to
 * tell you that utm_content wasn't slugified isn't a test anyone will run.
 */

const state = vi.hoisted(() => ({
  handler: (_q: Record<string, any>) => ({ data: null, error: null }) as any,
  calls: [] as Record<string, any>[],
}));

vi.mock('@supabase/supabase-js', () => {
  function makeQuery(table: string) {
    const q: Record<string, any> = { table, op: 'select' };
    const chain: any = {
      insert(row: unknown) {
        q.op = 'insert';
        q.row = row;
        return chain;
      },
      update(row: unknown) {
        q.op = 'update';
        q.row = row;
        return chain;
      },
      delete() {
        q.op = 'delete';
        return chain;
      },
      select() {
        return chain;
      },
      eq() {
        return chain;
      },
      not() {
        return chain;
      },
      gte() {
        return chain;
      },
      order() {
        return chain;
      },
      limit() {
        return chain;
      },
      single: () => resolve(),
      maybeSingle: () => resolve(),
      then: (res: any, rej: any) => resolve().then(res, rej),
    };
    function resolve() {
      state.calls.push(q);
      return Promise.resolve(state.handler(q));
    }
    return chain;
  }
  return { createClient: () => ({ from: (table: string) => makeQuery(table) }) };
});

import {
  createUtmLink,
  getLinkClickStats,
  getPieceAttribution,
  safeDestination,
  DuplicateUtmLinkError,
} from '../../src/lib/mothermode/planner/links';

/** Echo the inserted row back the way PostgREST would. */
function insertOk(q: Record<string, any>) {
  return { data: { id: 'link-1', click_count: 0, ...(q.row as object) }, error: null };
}

beforeEach(() => {
  state.calls = [];
  state.handler = () => ({ data: null, error: null });
});

describe('safeDestination', () => {
  it('accepts http(s) URLs and same-origin paths', () => {
    expect(safeDestination('https://x.com/a')).toBe('https://x.com/a');
    expect(safeDestination('/funnel/my-offer')).toBe('/funnel/my-offer');
    expect(safeDestination('  /funnel/x  ')).toBe('/funnel/x');
  });

  it('rejects the things that would turn a redirect into a vector', () => {
    expect(safeDestination('javascript:alert(1)')).toBeNull();
    expect(safeDestination('data:text/html,<script>')).toBeNull();
    // Protocol-relative: reads like a path, leaves the site.
    expect(safeDestination('//evil.com')).toBeNull();
    expect(safeDestination('')).toBeNull();
    expect(safeDestination(null)).toBeNull();
  });
});

describe('createUtmLink', () => {
  it('slugifies the report dimensions but never utm_content', async () => {
    state.handler = insertOk;
    const record = await createUtmLink({
      baseUrl: 'https://site.com/funnel/x',
      pieceId: 'gen_A1_07',
      utmSource: 'Instagram Reels',
      utmMedium: 'Organic Social',
      utmCampaign: "Mother's Day",
      withShortLink: false,
    });

    expect(record.utmSource).toBe('instagram_reels');
    expect(record.utmMedium).toBe('organic_social');
    expect(record.utmCampaign).toBe('mothers_day');
    // The join key must survive byte for byte, casing and all.
    expect(record.utmContent).toBe('gen_A1_07');
  });

  it('materializes full_url so the published string is what we stored', async () => {
    state.handler = insertOk;
    const record = await createUtmLink({
      baseUrl: 'https://site.com/funnel/x',
      pieceId: 'p1',
      utmSource: 'instagram',
      utmMedium: 'social',
      withShortLink: false,
    });
    expect(record.fullUrl).toContain('utm_source=instagram');
    expect(record.fullUrl).toContain('utm_content=p1');
    expect(record.baseUrl).toBe('https://site.com/funnel/x');
  });

  it('refuses a destination that could never resolve', async () => {
    await expect(
      createUtmLink({ baseUrl: 'javascript:alert(1)', pieceId: 'p1' }),
    ).rejects.toThrow(/http\(s\) URL or a same-origin path/);
    await expect(createUtmLink({ baseUrl: '  ' })).rejects.toThrow(
      /destination URL is required/i,
    );
  });

  it('retries a short-code collision instead of surfacing it', async () => {
    let attempts = 0;
    state.handler = (q) => {
      attempts += 1;
      if (attempts < 3) {
        return {
          data: null,
          error: {
            code: '23505',
            message:
              'duplicate key value violates unique constraint "mothermode_utm_links_short_code_key"',
          },
        };
      }
      return insertOk(q);
    };

    const record = await createUtmLink({
      baseUrl: '/funnel/x',
      pieceId: 'p1',
      withShortLink: true,
    });
    expect(attempts).toBe(3);
    expect(record.shortCode).toBeTruthy();
  });

  it('gives up rather than looping forever on codes', async () => {
    state.handler = () => ({
      data: null,
      error: {
        code: '23505',
        message: 'duplicate key value violates unique constraint "…short_code…"',
      },
    });
    await expect(
      createUtmLink({ baseUrl: '/funnel/x', withShortLink: true }),
    ).rejects.toThrow(/unused short code after 5 attempts/);
  });

  it('surfaces a duplicate UTM combo as its own error type', async () => {
    state.handler = () => ({
      data: null,
      error: {
        code: '23505',
        message:
          'duplicate key value violates unique constraint "idx_mm_utm_links_unique_combo"',
      },
    });
    // Retrying this one would just mint the duplicate the index refused: the
    // two identical rows would split one piece's clicks in half.
    await expect(
      createUtmLink({ baseUrl: '/funnel/x', pieceId: 'p1', withShortLink: true }),
    ).rejects.toBeInstanceOf(DuplicateUtmLinkError);
  });
});

describe('getLinkClickStats', () => {
  it('counts humans and bots separately so the numbers can be reconciled', async () => {
    state.handler = () => ({
      data: [
        { link_id: 'a', clicked_at: '2026-01-03T00:00:00Z', ua_family: 'ios' },
        { link_id: 'a', clicked_at: '2026-01-02T00:00:00Z', ua_family: 'bot' },
        { link_id: 'a', clicked_at: '2026-01-01T00:00:00Z', ua_family: 'android' },
        { link_id: 'b', clicked_at: '2026-01-04T00:00:00Z', ua_family: 'bot' },
      ],
      error: null,
    });

    const stats = await getLinkClickStats();
    const a = stats.get('a')!;
    // 2 humans, not 3: click_count never moved for the bot either, so these
    // agree instead of contradicting each other on screen.
    expect(a.recent).toBe(2);
    expect(a.bots).toBe(1);
    // Rows arrive newest-first.
    expect(a.lastClickAt).toBe('2026-01-03T00:00:00Z');
    expect(a.firstClickAt).toBe('2026-01-01T00:00:00Z');

    expect(stats.get('b')!.recent).toBe(0);
    expect(stats.get('b')!.bots).toBe(1);
  });

  it('throws rather than reporting zero clicks on a failed query', async () => {
    state.handler = () => ({ data: null, error: { message: 'boom' } });
    await expect(getLinkClickStats()).rejects.toThrow(/boom/);
  });
});

describe('getPieceAttribution', () => {
  it('joins both lead tables on utm_content and only counts sales purchases', async () => {
    state.handler = (q) => {
      if (q.table === 'mothermode_sales_funnel_leads') {
        return {
          data: [
            { utm_content: 'piece_a', purchased: true },
            { utm_content: 'piece_a', purchased: false },
            { utm_content: '  ', purchased: true },
          ],
          error: null,
        };
      }
      return {
        data: [{ utm_content: 'piece_a' }, { utm_content: 'piece_b' }],
        error: null,
      };
    };

    const attr = await getPieceAttribution();
    const a = attr.get('piece_a')!;
    expect(a.optins).toBe(3); // 2 sales + 1 optin
    expect(a.purchases).toBe(1);
    expect(attr.get('piece_b')!.purchases).toBe(0);
    // A blank utm_content is not a piece; bucketing it would invent a row.
    expect(attr.has('')).toBe(false);
  });

  it('throws when a lead table errors instead of reporting zero opt-ins', async () => {
    // The failure this whole feature is prone to: a broken join and "0 opt-ins"
    // look identical to the reader, so the store refuses to make them identical.
    state.handler = (q) =>
      q.table === 'mothermode_sales_funnel_leads'
        ? { data: null, error: { message: 'column utm_content does not exist' } }
        : { data: [], error: null };

    await expect(getPieceAttribution()).rejects.toThrow(
      /utm_content does not exist/,
    );
  });
});
