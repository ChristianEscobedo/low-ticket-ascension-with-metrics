'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';

const NAV: Array<{ href: string; label: string }> = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/funnel-stats', label: 'Funnel Stats' },
  { href: '/admin/purchases', label: 'Purchases' },
  { href: '/admin/subscriptions', label: 'Subscriptions' },
  { href: '/admin/customers', label: 'Customers' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/courses', label: 'Courses' },
  { href: '/admin/course-access', label: 'Course Access' },
  { href: '/admin/cta-analytics', label: 'CTA Analytics' },
  { href: '/admin/licenses', label: 'Licenses' },
  { href: '/admin/integrations', label: 'Integrations' },
  { href: '/admin/email-templates', label: 'Email Templates' },
  { href: '/admin/receipt-log', label: 'Receipt Log' },
  { href: '/admin/stripe', label: 'Stripe' }
];

const isActive = (pathname: string, href: string) =>
  href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

export default function AdminSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  return (
    <aside className="lg:sticky lg:top-10 lg:self-start">
      <div className="mb-5">
        <div className="text-xs uppercase tracking-[0.25em] text-amber-200/80 font-semibold">
          Admin
        </div>
        <div className="text-sm text-white/60 truncate mt-1" title={userEmail}>
          {userEmail}
        </div>
      </div>
      <nav className="flex flex-row lg:flex-col gap-1 overflow-x-auto">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              'rounded-lg px-3 py-2 text-sm transition-colors whitespace-nowrap',
              isActive(pathname, item.href)
                ? 'bg-amber-200/[0.08] text-amber-200 font-semibold border border-amber-200/20'
                : 'text-white/60 hover:text-white hover:bg-white/[0.04] border border-transparent'
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
