'use client';

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, Check, Copy, FileText } from 'lucide-react';

interface VSLScriptViewerProps {
  content: string;
}

// Luxury Gold prose styling for the rendered markdown.
const PROSE = [
  'prose prose-invert max-w-none',
  '[&_h1]:text-3xl [&_h1]:md:text-4xl [&_h1]:font-black [&_h1]:text-white [&_h1]:mb-4',
  '[&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-12 [&_h2]:mb-3 [&_h2]:bg-gradient-to-r [&_h2]:from-amber-200 [&_h2]:via-amber-100 [&_h2]:to-amber-300 [&_h2]:bg-clip-text [&_h2]:text-transparent',
  '[&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-amber-100 [&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:uppercase [&_h3]:tracking-[0.04em]',
  '[&_p]:text-gray-300 [&_p]:leading-relaxed',
  '[&_strong]:text-amber-200 [&_strong]:font-semibold',
  '[&_a]:text-amber-300 [&_a]:underline',
  '[&_ul]:text-gray-300 [&_ol]:text-gray-300 [&_li]:my-1 [&_li]:marker:text-amber-200/60',
  '[&_code]:text-amber-100 [&_code]:bg-white/[0.06] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded',
  '[&_blockquote]:border-l-2 [&_blockquote]:border-amber-200/50 [&_blockquote]:bg-white/[0.03] [&_blockquote]:rounded-r-lg [&_blockquote]:px-4 [&_blockquote]:py-2 [&_blockquote]:text-gray-200 [&_blockquote]:not-italic',
  '[&_hr]:border-amber-200/15 [&_hr]:my-10',
  '[&_table]:text-sm [&_th]:text-amber-100 [&_th]:px-3 [&_th]:py-2 [&_td]:px-3 [&_td]:py-2 [&_td]:border-white/10',
].join(' ');

export const VSLScriptViewer: React.FC<VSLScriptViewerProps> = ({ content }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyAll = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be blocked; fail silently.
    }
  }, [content]);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-amber-200/20 selection:text-amber-100">
      {/* Ambient gold glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-40"
        style={{ background: 'radial-gradient(60% 50% at 50% 0%, rgba(251,191,36,0.10), transparent 70%)' }}
      />

      {/* Sticky toolbar */}
      <header className="sticky top-0 z-20 border-b border-amber-200/15 bg-black/80 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link
            href="/millionaire-mindshift/vsl"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-amber-200 text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to VSL page
          </Link>

          <div className="flex items-center gap-2 text-amber-200/80 text-xs uppercase tracking-[0.16em] font-semibold">
            <FileText className="w-4 h-4" />
            Script &amp; Prompts
          </div>

          <button
            onClick={handleCopyAll}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-200/30 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-amber-100 transition-colors hover:bg-amber-200/10"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy all'}
          </button>
        </div>
      </header>

      {/* Rendered document */}
      <main className="relative z-10 max-w-3xl mx-auto px-4 py-12">
        <article className={PROSE}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </article>
      </main>
    </div>
  );
};
