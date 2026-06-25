'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, MousePointerClick, Plus, Trash2 } from 'lucide-react';
import type {
  VideoCTA,
  VideoCTAPosition,
  VideoCTAStyle,
  VideoCTAType
} from './types';

interface Props {
  ctas: VideoCTA[];
  onChange: (next: VideoCTA[]) => void;
  /** When provided, fetch and display per-CTA click counts. */
  lessonId?: string;
}

const TYPES: { value: VideoCTAType; label: string }[] = [
  { value: 'offer', label: 'Offer' },
  { value: 'book-call', label: 'Book call' },
  { value: 'webinar', label: 'Webinar' },
  { value: 'link', label: 'Link' }
];
const STYLES: { value: VideoCTAStyle; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'glass', label: 'Glass' },
  { value: 'gradient', label: 'Gradient' },
  { value: 'pulse', label: 'Pulse' }
];
const POSITIONS: { value: VideoCTAPosition; label: string }[] = [
  { value: 'bottom-bar', label: 'Bottom bar' },
  { value: 'bottom-right', label: 'Bottom-right' },
  { value: 'top-bar', label: 'Top bar' },
  { value: 'center-modal', label: 'Center modal' }
];

/** Generates a stable opaque id for new CTAs without pulling in crypto. */
function newId() {
  return `cta_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Inline editor for the lessons.ctas JSONB array. Each CTA fires at
 * `showAfterSeconds` and may auto-hide. Kept slim — supports the most
 * common configs (no A/B, no exit-intent, no analytics).
 */
export default function LessonCtasManager({ ctas, onChange, lessonId }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [clickCounts, setClickCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!lessonId) return;
    let cancelled = false;
    void fetch(`/api/admin/cta-clicks?lesson_id=${encodeURIComponent(lessonId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled || !body?.success) return;
        setClickCounts(body.counts ?? {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  const add = () => {
    const next: VideoCTA = {
      id: newId(),
      title: 'New CTA',
      subtitle: null,
      buttonText: 'Learn more',
      link: 'https://',
      linkTarget: '_blank',
      type: 'offer',
      style: 'solid',
      position: 'bottom-bar',
      showAfterSeconds: 30,
      autoHideSeconds: null,
      dismissable: true,
      showOnce: false
    };
    onChange([...ctas, next]);
    setOpenIdx(ctas.length);
  };

  const update = (idx: number, patch: Partial<VideoCTA>) => {
    onChange(ctas.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  const remove = (idx: number) => {
    onChange(ctas.filter((_, i) => i !== idx));
    if (openIdx === idx) setOpenIdx(null);
  };

  return (
    <div className="space-y-2">
      {ctas.length > 0 && (
        <ul className="space-y-1.5">
          {ctas.map((c, idx) => (
            <li
              key={c.id}
              className="rounded-lg border border-white/10 bg-black/30 overflow-hidden"
            >
              <div className="flex items-center gap-2 px-2.5 py-2 text-xs">
                <button
                  type="button"
                  onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
                  className="p-1 text-white/50 hover:text-amber-200"
                  aria-label={openIdx === idx ? 'Collapse' : 'Expand'}
                >
                  {openIdx === idx ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-white truncate">{c.title}</div>
                  <div className="text-white/40 truncate">
                    {c.type} · @{c.showAfterSeconds}s · {c.position}
                  </div>
                </div>
                {lessonId && (clickCounts[c.id] ?? 0) > 0 && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-300/[0.08] border border-amber-300/30 text-amber-200 text-[10px] font-medium"
                    title={`${clickCounts[c.id]} click${clickCounts[c.id] === 1 ? '' : 's'} since launch`}
                  >
                    <MousePointerClick className="w-3 h-3" />
                    {clickCounts[c.id]}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="p-1 text-white/40 hover:text-red-300"
                  aria-label="Remove CTA"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {openIdx === idx && (
                <div className="grid grid-cols-2 gap-2 p-2.5 border-t border-white/5">
                  <Labeled label="Title">
                    <input
                      value={c.title}
                      onChange={(e) => update(idx, { title: e.target.value })}
                      className={inputCls}
                    />
                  </Labeled>
                  <Labeled label="Subtitle (optional)">
                    <input
                      value={c.subtitle ?? ''}
                      onChange={(e) =>
                        update(idx, { subtitle: e.target.value || null })
                      }
                      className={inputCls}
                    />
                  </Labeled>
                  <Labeled label="Button text">
                    <input
                      value={c.buttonText}
                      onChange={(e) => update(idx, { buttonText: e.target.value })}
                      className={inputCls}
                    />
                  </Labeled>
                  <Labeled label="Link URL">
                    <input
                      value={c.link}
                      onChange={(e) => update(idx, { link: e.target.value })}
                      className={inputCls}
                    />
                  </Labeled>
                  <Labeled label="Type">
                    <select
                      value={c.type}
                      onChange={(e) =>
                        update(idx, { type: e.target.value as VideoCTAType })
                      }
                      className={inputCls}
                    >
                      {TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </Labeled>
                  <Labeled label="Style">
                    <select
                      value={c.style}
                      onChange={(e) =>
                        update(idx, { style: e.target.value as VideoCTAStyle })
                      }
                      className={inputCls}
                    >
                      {STYLES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </Labeled>
                  <Labeled label="Position">
                    <select
                      value={c.position}
                      onChange={(e) =>
                        update(idx, { position: e.target.value as VideoCTAPosition })
                      }
                      className={inputCls}
                    >
                      {POSITIONS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </Labeled>
                  <Labeled label="Show after (seconds)">
                    <input
                      type="number"
                      min={0}
                      value={c.showAfterSeconds}
                      onChange={(e) =>
                        update(idx, {
                          showAfterSeconds: parseInt(e.target.value) || 0
                        })
                      }
                      className={inputCls}
                    />
                  </Labeled>
                  <Labeled label="Auto-hide after (seconds, optional)">
                    <input
                      type="number"
                      min={0}
                      value={c.autoHideSeconds ?? ''}
                      onChange={(e) =>
                        update(idx, {
                          autoHideSeconds: e.target.value
                            ? parseInt(e.target.value) || null
                            : null
                        })
                      }
                      className={inputCls}
                    />
                  </Labeled>
                  <div className="col-span-2 flex flex-wrap gap-4 text-xs text-white/70">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={c.dismissable}
                        onChange={(e) =>
                          update(idx, { dismissable: e.target.checked })
                        }
                      />
                      Dismissable
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={!!c.showOnce}
                        onChange={(e) => update(idx, { showOnce: e.target.checked })}
                      />
                      Only show once per viewer
                    </label>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-amber-300/30 text-amber-200 hover:bg-amber-300/[0.08]"
      >
        <Plus className="w-3.5 h-3.5" />
        Add CTA
      </button>
    </div>
  );
}

const inputCls =
  'w-full px-2.5 py-2 text-xs rounded-md bg-black/40 border border-white/10 text-white placeholder-white/30 focus:border-amber-300/40 focus:outline-none';

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-[11px] font-medium text-white/50">{label}</label>
      {children}
    </div>
  );
}
