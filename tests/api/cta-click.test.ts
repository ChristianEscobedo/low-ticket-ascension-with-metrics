import { describe, it, expect, vi, beforeEach } from 'vitest';

const getUser = vi.fn();
const insert = vi.fn();
const from = vi.fn(() => ({ insert }));

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(() => ({}))
}));
vi.mock('@/utils/supabase/queries', () => ({ getUser }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from }))
}));

const reqPost = (body: unknown) =>
  ({
    json: async () => body
  } as unknown as import('next/server').NextRequest);

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  insert.mockResolvedValue({ error: null });
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
});

const VALID_LESSON = '00000000-0000-4000-a000-000000000001';

describe('POST /api/courses/cta-click', () => {
  it('returns 400 when lesson_id is missing', async () => {
    const { POST } = await import('@/app/api/courses/cta-click/route');
    const res = await POST(reqPost({ cta_id: 'cta_x' }));
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it('returns 400 when cta_id is missing', async () => {
    const { POST } = await import('@/app/api/courses/cta-click/route');
    const res = await POST(reqPost({ lesson_id: VALID_LESSON }));
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it('silently skips author-time preview clicks without inserting', async () => {
    const { POST } = await import('@/app/api/courses/cta-click/route');
    const res = await POST(
      reqPost({ lesson_id: '__preview__', cta_id: 'cta_x' })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, skipped: true });
    expect(insert).not.toHaveBeenCalled();
  });

  it('returns 400 when lesson_id is not a UUID', async () => {
    const { POST } = await import('@/app/api/courses/cta-click/route');
    const res = await POST(reqPost({ lesson_id: 'not-a-uuid', cta_id: 'cta_x' }));
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it('inserts a row with user_id when the caller is authenticated', async () => {
    getUser.mockResolvedValue({ id: 'user-123' });
    const { POST } = await import('@/app/api/courses/cta-click/route');
    const res = await POST(reqPost({ lesson_id: VALID_LESSON, cta_id: 'cta_x' }));
    expect(res.status).toBe(200);
    expect(insert).toHaveBeenCalledWith({
      lesson_id: VALID_LESSON,
      cta_id: 'cta_x',
      user_id: 'user-123'
    });
  });

  it('inserts a row with null user_id for anonymous callers', async () => {
    getUser.mockResolvedValue(null);
    const { POST } = await import('@/app/api/courses/cta-click/route');
    const res = await POST(reqPost({ lesson_id: VALID_LESSON, cta_id: 'cta_x' }));
    expect(res.status).toBe(200);
    expect(insert).toHaveBeenCalledWith({
      lesson_id: VALID_LESSON,
      cta_id: 'cta_x',
      user_id: null
    });
  });

  it('treats a thrown getUser as anonymous', async () => {
    getUser.mockRejectedValue(new Error('session expired'));
    const { POST } = await import('@/app/api/courses/cta-click/route');
    const res = await POST(reqPost({ lesson_id: VALID_LESSON, cta_id: 'cta_x' }));
    expect(res.status).toBe(200);
    expect(insert).toHaveBeenCalledWith({
      lesson_id: VALID_LESSON,
      cta_id: 'cta_x',
      user_id: null
    });
  });

  it('returns 500 when the insert errors', async () => {
    getUser.mockResolvedValue(null);
    insert.mockResolvedValueOnce({ error: { message: 'boom' } });
    const { POST } = await import('@/app/api/courses/cta-click/route');
    const res = await POST(reqPost({ lesson_id: VALID_LESSON, cta_id: 'cta_x' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('boom');
  });
});
