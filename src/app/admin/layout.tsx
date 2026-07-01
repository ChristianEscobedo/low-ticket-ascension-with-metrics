import { redirect } from 'next/navigation';
import { PropsWithChildren } from 'react';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';
import AdminSidebar from './AdminSidebar';
import Footer8 from '@/components/footer-8';

export const dynamic = 'force-dynamic';

const parseAdminEmails = () =>
  (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

// Single source of truth for the admin auth gate. Every page under /admin
// inherits this layout, so individual pages no longer need to repeat the
// signin redirect / ADMIN_EMAILS check.
export default async function AdminLayout({ children }: PropsWithChildren) {
  const supabase = createClient();
  const user = await getUser(supabase);
  if (!user) return redirect('/signin');

  const adminEmails = parseAdminEmails();
  if (adminEmails.length > 0) {
    const email = (user.email ?? '').toLowerCase();
    if (!adminEmails.includes(email)) return redirect('/');
  }

  return (
    <section className="bg-ink min-h-screen text-bone font-sans flex flex-col relative">
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 2px 2px, rgba(245,241,235,0.04) 1px, transparent 0)',
            backgroundSize: '30px 30px'
          }}
        />
      </div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-brass/[0.06] blur-3xl rounded-full pointer-events-none" />
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8">
          <AdminSidebar userEmail={user.email ?? ''} />
          <div className="min-w-0">{children}</div>
        </div>
      </div>
      <Footer8 />
    </section>
  );
}
