import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';

const parseAdminEmails = () =>
  (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

// Shared admin gate for server actions under /admin. The layout already
// gates page renders; actions are separate endpoints and re-check here.
export async function assertAdmin() {
  const supabase = createClient();
  const user = await getUser(supabase);
  if (!user) redirect('/signin');
  const allow = parseAdminEmails();
  if (allow.length > 0 && !allow.includes((user.email ?? '').toLowerCase())) {
    redirect('/');
  }
}
