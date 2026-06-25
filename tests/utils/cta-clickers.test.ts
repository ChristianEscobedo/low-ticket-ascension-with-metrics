import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://stub.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'stub';
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
  vi.doUnmock('@supabase/supabase-js');
});

function mockSupabase(clickRows: any[], users: any[]) {
  const builder = {
    _q: { lesson_id: '', cta_id: '', gte: null as string | null, lte: null as string | null },
    select() { return this; },
    order() { return this; },
    limit() { return this; },
    eq(col: string, val: string) {
      if (col === 'lesson_id') this._q.lesson_id = val;
      if (col === 'cta_id') this._q.cta_id = val;
      return this;
    },
    gte(_c: string, v: string) { this._q.gte = v; return this; },
    lte(_c: string, v: string) { this._q.lte = v; return this; },
    then(resolve: any) {
      const filtered = clickRows.filter((r) => {
        if (this._q.gte && r.created_at < this._q.gte) return false;
        if (this._q.lte && r.created_at > this._q.lte) return false;
        return true;
      });
      resolve({ data: filtered, error: null });
    }
  };
  vi.doMock('@supabase/supabase-js', () => ({
    createClient: () => ({
      from: () => ({
        select() { return builder; }
      }),
      auth: {
        admin: {
          listUsers: async () => ({ data: { users }, error: null })
        }
      }
    })
  }));
}

describe('getCtaClickers', () => {
  it('groups clicks per user and resolves emails, sorting by click count', async () => {
    mockSupabase(
      [
        { user_id: 'u1', created_at: '2026-01-10T00:00:00Z' },
        { user_id: 'u1', created_at: '2026-01-12T00:00:00Z' },
        { user_id: 'u1', created_at: '2026-01-11T00:00:00Z' },
        { user_id: 'u2', created_at: '2026-01-09T00:00:00Z' },
        { user_id: null, created_at: '2026-01-08T00:00:00Z' }
      ],
      [
        { id: 'u1', email: 'one@example.com' },
        { id: 'u2', email: 'two@example.com' }
      ]
    );
    const { getCtaClickers } = await import('@/utils/supabase/admin');
    const rows = await getCtaClickers('lesson_x', 'cta_buy');
    expect(rows).toEqual([
      {
        user_id: 'u1',
        email: 'one@example.com',
        clicks: 3,
        first_click_at: '2026-01-10T00:00:00Z',
        last_click_at: '2026-01-12T00:00:00Z'
      },
      {
        user_id: 'u2',
        email: 'two@example.com',
        clicks: 1,
        first_click_at: '2026-01-09T00:00:00Z',
        last_click_at: '2026-01-09T00:00:00Z'
      },
      {
        user_id: null,
        email: null,
        clicks: 1,
        first_click_at: '2026-01-08T00:00:00Z',
        last_click_at: '2026-01-08T00:00:00Z'
      }
    ]);
  });

  it('respects the YYYY-MM-DD endDate by expanding it to end-of-day UTC', async () => {
    mockSupabase(
      [
        { user_id: 'u1', created_at: '2026-01-10T12:00:00Z' },
        { user_id: 'u1', created_at: '2026-01-11T00:00:00Z' }
      ],
      [{ id: 'u1', email: 'one@example.com' }]
    );
    const { getCtaClickers } = await import('@/utils/supabase/admin');
    const rows = await getCtaClickers('lesson_x', 'cta_buy', {
      endDate: '2026-01-10'
    });
    expect(rows).toEqual([
      {
        user_id: 'u1',
        email: 'one@example.com',
        clicks: 1,
        first_click_at: '2026-01-10T12:00:00Z',
        last_click_at: '2026-01-10T12:00:00Z'
      }
    ]);
  });

});
