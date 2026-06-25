import { describe, it, expect, vi, beforeEach } from 'vitest';

const getUser = vi.fn();
const from = vi.fn();

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(() => ({}))
}));
vi.mock('@/utils/supabase/queries', () => ({ getUser }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from }))
}));

const reqGet = (url: string) =>
  ({ url } as unknown as import('next/server').NextRequest);

const reqPost = (body: unknown) =>
  ({
    json: async () => body
  } as unknown as import('next/server').NextRequest);

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
});

describe('GET /api/lessons/progress', () => {
  it('returns empty progress for anonymous users', async () => {
    getUser.mockResolvedValue(null);
    const { GET } = await import('@/app/api/lessons/progress/route');
    const res = await GET(
      reqGet('http://x/api/lessons/progress?course_id=c1')
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, progress: [] });
    expect(from).not.toHaveBeenCalled();
  });

  it('returns 400 when course_id is missing', async () => {
    getUser.mockResolvedValue({ id: 'u1' });
    const { GET } = await import('@/app/api/lessons/progress/route');
    const res = await GET(reqGet('http://x/api/lessons/progress'));
    expect(res.status).toBe(400);
  });

  it('returns empty list when the course has no lessons', async () => {
    getUser.mockResolvedValue({ id: 'u1' });
    const eq = vi.fn().mockResolvedValue({ data: [], error: null });
    from.mockReturnValueOnce({ select: vi.fn(() => ({ eq })) });
    const { GET } = await import('@/app/api/lessons/progress/route');
    const res = await GET(
      reqGet('http://x/api/lessons/progress?course_id=c1')
    );
    expect(await res.json()).toEqual({ success: true, progress: [] });
  });

  it('returns progress rows joined to the lessons of the course', async () => {
    getUser.mockResolvedValue({ id: 'u1' });
    const lessonsEq = vi
      .fn()
      .mockResolvedValue({ data: [{ id: 'l1' }, { id: 'l2' }], error: null });
    const progressIn = vi.fn().mockResolvedValue({
      data: [{ lesson_id: 'l1', progress_seconds: 42, is_completed: false }],
      error: null
    });
    const progressEq = vi.fn(() => ({ in: progressIn }));
    from
      .mockReturnValueOnce({ select: vi.fn(() => ({ eq: lessonsEq })) })
      .mockReturnValueOnce({ select: vi.fn(() => ({ eq: progressEq })) });

    const { GET } = await import('@/app/api/lessons/progress/route');
    const res = await GET(
      reqGet('http://x/api/lessons/progress?course_id=c1')
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.progress).toEqual([
      { lesson_id: 'l1', progress_seconds: 42, is_completed: false }
    ]);
    expect(progressIn).toHaveBeenCalledWith('lesson_id', ['l1', 'l2']);
  });
});

describe('POST /api/lessons/progress', () => {
  it('silently skips for anonymous users', async () => {
    getUser.mockResolvedValue(null);
    const { POST } = await import('@/app/api/lessons/progress/route');
    const res = await POST(reqPost({ lesson_id: 'l1', progress_seconds: 10 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, skipped: true });
    expect(from).not.toHaveBeenCalled();
  });

  it('returns 400 when lesson_id is missing', async () => {
    getUser.mockResolvedValue({ id: 'u1' });
    const { POST } = await import('@/app/api/lessons/progress/route');
    const res = await POST(reqPost({ progress_seconds: 10 }));
    expect(res.status).toBe(400);
  });

  it('upserts floored progress + sets completed_at when is_completed=true', async () => {
    getUser.mockResolvedValue({ id: 'u1' });
    const upsert = vi.fn().mockResolvedValue({ error: null });
    from.mockReturnValueOnce({ upsert });

    const { POST } = await import('@/app/api/lessons/progress/route');
    const res = await POST(
      reqPost({ lesson_id: 'l1', progress_seconds: 60.7, is_completed: true })
    );
    expect(res.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u1',
        lesson_id: 'l1',
        progress_seconds: 60,
        is_completed: true,
        completed_at: expect.any(String),
        last_watched_at: expect.any(String)
      }),
      { onConflict: 'user_id,lesson_id' }
    );
  });

  it('clears completed_at when is_completed=false', async () => {
    getUser.mockResolvedValue({ id: 'u1' });
    const upsert = vi.fn().mockResolvedValue({ error: null });
    from.mockReturnValueOnce({ upsert });
    const { POST } = await import('@/app/api/lessons/progress/route');
    await POST(reqPost({ lesson_id: 'l1', is_completed: false }));
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ is_completed: false, completed_at: null }),
      expect.any(Object)
    );
  });

  it('returns 500 when the upsert errors', async () => {
    getUser.mockResolvedValue({ id: 'u1' });
    const upsert = vi.fn().mockResolvedValue({ error: { message: 'boom' } });
    from.mockReturnValueOnce({ upsert });
    const { POST } = await import('@/app/api/lessons/progress/route');
    const res = await POST(reqPost({ lesson_id: 'l1', progress_seconds: 5 }));
    expect(res.status).toBe(500);
  });
});
