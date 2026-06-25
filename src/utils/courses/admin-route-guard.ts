import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';
import { isAdminEmail } from '@/utils/courses/access';

export interface AdminGuardResult {
  ok: boolean;
  email: string | null;
  userId: string | null;
  response?: NextResponse;
}

/**
 * Confirm the caller is a signed-in admin (matches an ADMIN_EMAILS entry).
 * Returns an early NextResponse to short-circuit the route handler when
 * the check fails. Use as:
 *
 *   const guard = await requireAdminRoute();
 *   if (!guard.ok) return guard.response!;
 */
export async function requireAdminRoute(): Promise<AdminGuardResult> {
  try {
    const supabase = createClient();
    const user = await getUser(supabase);
    if (!user) {
      return {
        ok: false,
        email: null,
        userId: null,
        response: NextResponse.json(
          { success: false, error: 'Sign in required' },
          { status: 401 }
        )
      };
    }
    if (!isAdminEmail(user.email ?? null)) {
      return {
        ok: false,
        email: user.email ?? null,
        userId: user.id,
        response: NextResponse.json(
          { success: false, error: 'Admin access required' },
          { status: 403 }
        )
      };
    }
    return { ok: true, email: user.email ?? null, userId: user.id };
  } catch (error) {
    console.error('[requireAdminRoute] Failed:', error);
    return {
      ok: false,
      email: null,
      userId: null,
      response: NextResponse.json(
        { success: false, error: 'Auth check failed' },
        { status: 500 }
      )
    };
  }
}
