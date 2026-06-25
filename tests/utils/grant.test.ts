import { describe, it, expect, vi, beforeEach } from 'vitest';

const from = vi.fn();
const listUsers = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from,
    auth: { admin: { listUsers } }
  }))
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_test';
});

describe('grantCoursesForPurchase', () => {
  it('returns 0 when productId is missing', async () => {
    const { grantCoursesForPurchase } = await import('@/utils/courses/grant');
    const res = await grantCoursesForPurchase({
      productId: null,
      customerEmail: 'a@b.c'
    });
    expect(res.granted).toBe(0);
    expect(res.reason).toMatch(/no product_id/);
    expect(from).not.toHaveBeenCalled();
  });

  it('returns 0 when customerEmail is missing', async () => {
    const { grantCoursesForPurchase } = await import('@/utils/courses/grant');
    const res = await grantCoursesForPurchase({
      productId: 'prod_1',
      customerEmail: null
    });
    expect(res.granted).toBe(0);
    expect(res.reason).toMatch(/no customer_email/);
    expect(from).not.toHaveBeenCalled();
  });

  it('returns 0 when the product is not mapped to any course', async () => {
    const eq = vi.fn().mockResolvedValue({ data: [], error: null });
    from.mockReturnValueOnce({ select: vi.fn(() => ({ eq })) });
    const { grantCoursesForPurchase } = await import('@/utils/courses/grant');
    const res = await grantCoursesForPurchase({
      productId: 'prod_unmapped',
      customerEmail: 'a@b.c'
    });
    expect(res.granted).toBe(0);
    expect(res.reason).toMatch(/no course mapped/);
    expect(listUsers).not.toHaveBeenCalled();
  });

  it('returns 0 with a fallback note when the buyer has no auth user yet', async () => {
    const eq = vi
      .fn()
      .mockResolvedValue({ data: [{ course_id: 'c1' }], error: null });
    from.mockReturnValueOnce({ select: vi.fn(() => ({ eq })) });
    listUsers.mockResolvedValue({
      data: { users: [{ id: 'u_other', email: 'other@x.com' }] }
    });
    const { grantCoursesForPurchase } = await import('@/utils/courses/grant');
    const res = await grantCoursesForPurchase({
      productId: 'prod_1',
      customerEmail: 'ada@example.com'
    });
    expect(res.granted).toBe(0);
    expect(res.reason).toMatch(/no auth user yet/);
  });

  it('upserts one row per assigned course with case-insensitive email match', async () => {
    const eq = vi.fn().mockResolvedValue({
      data: [{ course_id: 'c1' }, { course_id: 'c2' }],
      error: null
    });
    const upsert = vi.fn().mockResolvedValue({ error: null });
    from
      .mockReturnValueOnce({ select: vi.fn(() => ({ eq })) })
      .mockReturnValueOnce({ upsert });
    listUsers.mockResolvedValue({
      data: { users: [{ id: 'u_ada', email: 'Ada@Example.com' }] }
    });

    const { grantCoursesForPurchase } = await import('@/utils/courses/grant');
    const res = await grantCoursesForPurchase({
      productId: 'prod_1',
      customerEmail: 'ada@example.com',
      accessType: 'subscription'
    });

    expect(res.granted).toBe(2);
    expect(upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          user_id: 'u_ada',
          course_id: 'c1',
          access_type: 'subscription'
        }),
        expect.objectContaining({
          user_id: 'u_ada',
          course_id: 'c2',
          access_type: 'subscription'
        })
      ],
      { onConflict: 'user_id,course_id' }
    );
  });

  it('surfaces assignment-lookup errors', async () => {
    const eq = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'boom' } });
    from.mockReturnValueOnce({ select: vi.fn(() => ({ eq })) });
    const { grantCoursesForPurchase } = await import('@/utils/courses/grant');
    const res = await grantCoursesForPurchase({
      productId: 'prod_1',
      customerEmail: 'a@b.c'
    });
    expect(res.granted).toBe(0);
    expect(res.reason).toBe('boom');
  });

  it('surfaces upsert errors and reports 0 granted', async () => {
    const eq = vi
      .fn()
      .mockResolvedValue({ data: [{ course_id: 'c1' }], error: null });
    const upsert = vi
      .fn()
      .mockResolvedValue({ error: { message: 'write denied' } });
    from
      .mockReturnValueOnce({ select: vi.fn(() => ({ eq })) })
      .mockReturnValueOnce({ upsert });
    listUsers.mockResolvedValue({
      data: { users: [{ id: 'u_ada', email: 'ada@example.com' }] }
    });
    const { grantCoursesForPurchase } = await import('@/utils/courses/grant');
    const res = await grantCoursesForPurchase({
      productId: 'prod_1',
      customerEmail: 'ada@example.com'
    });
    expect(res.granted).toBe(0);
    expect(res.reason).toBe('write denied');
  });
});
