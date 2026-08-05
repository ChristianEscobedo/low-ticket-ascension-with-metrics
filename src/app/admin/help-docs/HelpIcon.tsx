'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HelpCircle } from 'lucide-react';
import { adminHelpDocHref } from './helpLinks';

/**
 * A small contextual help icon for admin screens. It reads the current route
 * and links to the most relevant admin help doc, opening in a new tab so you
 * never lose your place. Drop it into a page header next to the title.
 */
export default function HelpIcon({ route }: { route?: string }) {
  const pathname = usePathname();
  const target = route ?? pathname ?? '/admin';
  const href = adminHelpDocHref(target);

  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      title="Open the guide for this screen"
      aria-label="Open the guide for this screen"
      className="inline-flex items-center justify-center text-bone/40 hover:text-brass transition-colors"
    >
      <HelpCircle className="w-5 h-5" />
    </Link>
  );
}
