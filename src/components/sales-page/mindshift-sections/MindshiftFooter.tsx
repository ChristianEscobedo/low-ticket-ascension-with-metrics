'use client';

import React from 'react';
import Link from 'next/link';

export const MindshiftFooter: React.FC = () => {
  return (
    <footer className="border-t border-white/5 py-12 px-4">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-600">
        <p>© {new Date().getFullYear()} Millionaire Mindshift · All rights reserved.</p>
        <div className="flex items-center gap-6">
          <Link href="/terms" className="hover:text-amber-200/80 transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-amber-200/80 transition-colors">Privacy</Link>
          <Link href="/contact" className="hover:text-amber-200/80 transition-colors">Contact</Link>
        </div>
      </div>
    </footer>
  );
};
