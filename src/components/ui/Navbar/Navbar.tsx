import { createClient } from '@/utils/supabase/server';
import s from './Navbar.module.css';
import Navlinks from './Navlinks';

const parseAdminEmails = () =>
  (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

export default async function Navbar() {
  const supabase = createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const adminEmails = parseAdminEmails();
  const email = (user?.email ?? '').toLowerCase();
  // When ADMIN_EMAILS is unset we treat any signed-in user as admin so the
  // /admin/funnel-stats link is reachable in dev without extra config.
  const isAdmin = !!user && (adminEmails.length === 0 || adminEmails.includes(email));

  return (
    <nav className={s.root}>
      <a href="#skip" className="sr-only focus:not-sr-only">
        Skip to content
      </a>
      <div className="max-w-6xl px-6 mx-auto">
        <Navlinks user={user} isAdmin={isAdmin} />
      </div>
    </nav>
  );
}
