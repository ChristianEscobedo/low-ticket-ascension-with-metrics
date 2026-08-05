import { redirect } from 'next/navigation';
import { PropsWithChildren } from 'react';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';

export const dynamic = 'force-dynamic';

const parseAdminEmails = () =>
  (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

/**
 * Fullscreen admin surfaces (currently the Research Lab). Same auth gate as
 * /admin's layout, deliberately WITHOUT the sidebar/max-width/footer chrome:
 * these pages are apps, not documents, and they own the whole viewport.
 */
export default async function FullscreenLayout({
  children,
}: PropsWithChildren) {
  const supabase = createClient();
  const user = await getUser(supabase);
  if (!user) return redirect('/signin');

  const adminEmails = parseAdminEmails();
  if (adminEmails.length > 0) {
    const email = (user.email ?? '').toLowerCase();
    if (!adminEmails.includes(email)) return redirect('/');
  }

  return (
    <section className="bg-ink h-screen overflow-hidden text-bone font-sans">
      {children}
    </section>
  );
}
