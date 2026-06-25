'use client';

import {
  Download,
  ExternalLink,
  FileText,
  Film,
  Link as LinkIcon,
  Paperclip
} from 'lucide-react';

interface Resource {
  name: string;
  url: string;
  type: string;
}

interface Props {
  resources: Resource[] | null | undefined;
}

/**
 * Student-facing resources list for the active lesson. Renders nothing when
 * the lesson has no curated downloads/links.
 */
export default function LessonResources({ resources }: Props) {
  if (!resources?.length) return null;

  return (
    <div className="rounded-2xl border border-amber-200/15 bg-gradient-to-br from-gray-900/60 to-gray-950/60 backdrop-blur p-6">
      <div className="flex items-center gap-2 mb-4">
        <Download className="w-4 h-4 text-amber-300" />
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-200/80">
          Resources & downloads
        </h2>
      </div>
      <ul className="space-y-2">
        {resources.map((r, idx) => (
          <li key={`${r.url}-${idx}`}>
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 hover:border-amber-300/30 hover:bg-amber-300/[0.04] transition-colors"
            >
              <ResourceIcon type={r.type} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">
                  {r.name}
                </div>
                <div className="text-[11px] text-white/40 truncate">{r.url}</div>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-white/40 group-hover:text-amber-200">
                {r.type}
              </span>
              <ExternalLink className="w-3.5 h-3.5 text-white/30 group-hover:text-amber-200" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResourceIcon({ type }: { type: string }) {
  const cls = 'w-4 h-4 text-amber-200';
  if (type === 'pdf' || type === 'doc') return <FileText className={cls} />;
  if (type === 'video') return <Film className={cls} />;
  if (type === 'file') return <Paperclip className={cls} />;
  return <LinkIcon className={cls} />;
}
