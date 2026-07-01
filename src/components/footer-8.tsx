'use client';

import { motion } from 'motion/react';
import Link from 'next/link';

// Source: shadcn registry @reactbits-pro/footer-8. Adapted for the admin
// console: Editorial Warm brass accent on an ink base to match MotherMode,
// fixed malformed SVG viewBoxes and invalid border-oklch(...) classes from the
// upstream block, and rewired columns to point at our admin/funnel routes.

const socials = [
  {
    key: 'x',
    label: 'X',
    href: '#',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    )
  },
  {
    key: 'ig',
    label: 'Instagram',
    href: '#',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
      </svg>
    )
  },
  {
    key: 'yt',
    label: 'YouTube',
    href: '#',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M23.5 6.5a3 3 0 0 0-2.1-2.1C19.5 4 12 4 12 4s-7.5 0-9.4.4A3 3 0 0 0 .5 6.5C0 8.4 0 12 0 12s0 3.6.5 5.5a3 3 0 0 0 2.1 2.1C4.5 20 12 20 12 20s7.5 0 9.4-.4a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.5.5-5.5s0-3.6-.5-5.5zM9.6 15.6V8.4l6.4 3.6-6.4 3.6z" />
      </svg>
    )
  }
] as const;

const cols = [
  {
    title: 'Admin',
    links: [
      { label: 'Overview', href: '/admin' },
      { label: 'Funnel Stats', href: '/admin/funnel-stats' },
      { label: 'Purchases', href: '/admin/purchases' }
    ]
  },
  {
    title: 'Catalog',
    links: [
      { label: 'Subscriptions', href: '/admin/subscriptions' },
      { label: 'Customers', href: '/admin/customers' },
      { label: 'Products', href: '/admin/products' }
    ]
  },
  {
    title: 'Funnel',
    links: [
      { label: 'Sales page', href: '/' },
      { label: 'Content', href: '/mothermode/content' },
      { label: 'Checkout', href: '/mothermode/checkout' }
    ]
  }
] as const;

export default function Footer8() {
  return (
    <footer className="relative w-full border-t border-brass/10 bg-ink px-4 sm:px-6 lg:px-8 py-12 sm:py-16 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-brass/[0.05] blur-3xl rounded-full pointer-events-none" />
      <div className="relative max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr_1fr_1fr] gap-10 lg:gap-12">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-6"
          >
            <div className="flex items-center gap-3">
              <div className="h-px w-12 bg-gradient-to-r from-transparent to-brass/50" />
              <span className="font-display text-xl font-semibold tracking-tight text-bone">
                MotherMode
              </span>
            </div>
            <p className="text-sm sm:text-base text-bone/70 leading-relaxed max-w-xs">
              The OS for modern motherhood. Admin console for the funnel,
              customers, and recurring revenue.
            </p>
            <div className="flex items-center gap-2">
              {socials.map((s) => (
                <a
                  key={s.key}
                  href={s.href}
                  aria-label={s.label}
                  className="w-9 h-9 rounded-md border border-brass/20 text-brass/80 flex items-center justify-center hover:bg-brass/[0.08] hover:text-brass hover:border-brass/40 transition-colors"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </motion.div>

          {cols.map((col, ci) => (
            <motion.div
              key={col.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: 0.05 + ci * 0.05 }}
              className="flex flex-col gap-2 lg:border-t lg:border-brass/10 lg:pt-5"
            >
              <h4 className="text-xs font-semibold tracking-[0.15em] uppercase text-brass">
                {col.title}
              </h4>
              <ul className="flex flex-col gap-1">
                {col.links.map((link) => (
                  <li key={link.label} className="flex items-center gap-2">
                    <Link
                      href={link.href}
                      className="text-sm sm:text-base text-bone/70 hover:text-bone transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        <div
          className="relative mt-20 w-full"
          aria-hidden="true"
          style={{
            fontSize: 'min(14.2vw, 210px)',
            height: '0.74em',
            maskImage: 'linear-gradient(to bottom, #000 50%, transparent 95%)',
            WebkitMaskImage: 'linear-gradient(to bottom, #000 50%, transparent 95%)'
          }}
        >
          <div
            className="absolute inset-0 flex justify-center font-bold uppercase leading-none whitespace-nowrap"
            style={{
              fontSize: 'inherit',
              letterSpacing: '0.15em',
              paddingLeft: '0.15em',
              color: 'rgba(168, 139, 92, 0.07)',
              textShadow:
                '0 -1.5px rgba(168,139,92,0.18), 1.5px 1px 1px rgba(168,139,92,0.10)'
            }}
          >
            MotherMode
          </div>
        </div>

        <div className="pt-6 border-t border-brass/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs sm:text-sm text-bone/50">
          <p>© {new Date().getFullYear()} MotherMode</p>
          <div className="flex items-center gap-5">
            <a href="#" className="hover:text-brass transition-colors">
              Security
            </a>
            <a href="#" className="hover:text-brass transition-colors">
              Terms of service
            </a>
            <a href="#" className="hover:text-brass transition-colors">
              Privacy policy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
