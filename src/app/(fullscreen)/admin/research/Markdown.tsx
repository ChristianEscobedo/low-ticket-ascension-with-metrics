'use client';

/**
 * House markdown renderer for the Research Lab (chat turns + artifact
 * documents). The project has no typography plugin, so every element carries
 * explicit Editorial Warm styling.
 */
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (p) => (
            <h3
              className="mb-2 mt-4 font-display text-lg font-semibold text-bone"
              {...p}
            />
          ),
          h2: (p) => (
            <h4
              className="mb-2 mt-4 font-display text-base font-semibold text-bone"
              {...p}
            />
          ),
          h3: (p) => (
            <h5
              className="mb-1.5 mt-3 text-sm font-semibold uppercase tracking-wide text-bone/90"
              {...p}
            />
          ),
          p: (p) => (
            <p className="my-2 text-sm leading-relaxed text-bone/80" {...p} />
          ),
          ul: (p) => (
            <ul
              className="my-2 list-disc space-y-1 pl-5 text-sm text-bone/80"
              {...p}
            />
          ),
          ol: (p) => (
            <ol
              className="my-2 list-decimal space-y-1 pl-5 text-sm text-bone/80"
              {...p}
            />
          ),
          li: (p) => <li className="leading-relaxed" {...p} />,
          a: (p) => (
            <a
              className="text-brass underline underline-offset-2 hover:text-brass/80"
              target="_blank"
              rel="noreferrer"
              {...p}
            />
          ),
          code: (p) => (
            <code
              className="rounded bg-bone/10 px-1 py-0.5 text-[0.85em] text-bone"
              {...p}
            />
          ),
          pre: (p) => (
            <pre
              className="my-3 overflow-x-auto rounded-lg border border-bone/10 bg-black/40 p-3 text-xs"
              {...p}
            />
          ),
          table: (p) => (
            <table className="my-3 w-full border-collapse text-xs" {...p} />
          ),
          th: (p) => (
            <th
              className="border border-bone/15 bg-bone/5 px-2 py-1 text-left font-semibold text-bone/70"
              {...p}
            />
          ),
          td: (p) => (
            <td
              className="border border-bone/15 px-2 py-1 align-top text-bone/70"
              {...p}
            />
          ),
          blockquote: (p) => (
            <blockquote
              className="my-2 border-l-2 border-brass/50 pl-3 italic text-bone/60"
              {...p}
            />
          ),
          hr: () => <hr className="my-4 border-bone/10" />,
          strong: (p) => <strong className="font-semibold text-bone" {...p} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
