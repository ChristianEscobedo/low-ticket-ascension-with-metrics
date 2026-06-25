'use client';

import { useState } from 'react';
import { FileText, Film, Link as LinkIcon, Paperclip, Plus, Trash2 } from 'lucide-react';
import type { LessonResource, LessonResourceType } from './types';

interface Props {
  resources: LessonResource[];
  onChange: (next: LessonResource[]) => void;
}

const TYPE_OPTIONS: { value: LessonResourceType; label: string }[] = [
  { value: 'link', label: 'Link' },
  { value: 'pdf', label: 'PDF' },
  { value: 'doc', label: 'Doc' },
  { value: 'video', label: 'Video' },
  { value: 'file', label: 'File' }
];

/**
 * Inline manager for lessons.resources JSONB. Lets admins curate a short
 * downloads/links list shown to students under the player.
 */
export default function LessonResourcesManager({ resources, onChange }: Props) {
  const [draft, setDraft] = useState<LessonResource>({
    name: '',
    url: '',
    type: 'link'
  });
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    if (!draft.name.trim() || !draft.url.trim()) {
      setError('Name and URL are required.');
      return;
    }
    setError(null);
    onChange([...resources, { ...draft, name: draft.name.trim(), url: draft.url.trim() }]);
    setDraft({ name: '', url: '', type: 'link' });
  };

  const remove = (idx: number) => {
    onChange(resources.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      {resources.length > 0 && (
        <ul className="space-y-1.5">
          {resources.map((r, idx) => (
            <li
              key={`${r.url}-${idx}`}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-xs"
            >
              <ResourceIcon type={r.type} />
              <div className="flex-1 min-w-0">
                <div className="text-white truncate">{r.name}</div>
                <div className="text-white/40 truncate">{r.url}</div>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-white/40">
                {r.type}
              </span>
              <button
                type="button"
                onClick={() => remove(idx)}
                aria-label="Remove resource"
                className="p-1 text-white/40 hover:text-red-300"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-[1fr_1fr_90px_auto] gap-1.5">
        <input
          value={draft.name}
          onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
          placeholder="Name"
          className={inputCls}
        />
        <input
          value={draft.url}
          onChange={(e) => setDraft((p) => ({ ...p, url: e.target.value }))}
          placeholder="https://…"
          className={inputCls}
        />
        <select
          value={draft.type}
          onChange={(e) =>
            setDraft((p) => ({ ...p, type: e.target.value as LessonResourceType }))
          }
          className={inputCls}
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center justify-center gap-1 px-2.5 py-2 text-xs font-semibold rounded-md bg-amber-500 hover:bg-amber-400 text-black"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>

      {error && <p className="text-[11px] text-red-300">{error}</p>}
    </div>
  );
}

const inputCls =
  'w-full px-2.5 py-2 text-xs rounded-md bg-black/40 border border-white/10 text-white placeholder-white/30 focus:border-amber-300/40 focus:outline-none';

function ResourceIcon({ type }: { type: LessonResourceType }) {
  const cls = 'w-3.5 h-3.5 text-amber-200';
  if (type === 'pdf' || type === 'doc') return <FileText className={cls} />;
  if (type === 'video') return <Film className={cls} />;
  if (type === 'file') return <Paperclip className={cls} />;
  return <LinkIcon className={cls} />;
}
