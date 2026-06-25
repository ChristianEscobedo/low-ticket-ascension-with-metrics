'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  Loader2,
  PenLine,
  Play,
  Plus,
  Trash2
} from 'lucide-react';
import LessonFormModal from './LessonFormModal';
import LessonVideoPanel, { type LessonInfo } from '../LessonVideoPanel';
import type { Course, Lesson } from './types';

interface Props {
  course: Course;
  onBack: () => void;
}

/**
 * Per-course lessons list. Supports add/edit/delete/clone and reorder via
 * up/down buttons. Floating preview panel plays the selected lesson video.
 */
export default function CourseLessonsEditor({ course, onBack }: Props) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Lesson | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [preview, setPreview] = useState<LessonInfo | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchLessons = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/courses/${course.id}/lessons`);
      const data = await res.json();
      if (data.success) setLessons(data.lessons || []);
    } finally {
      setLoading(false);
    }
  }, [course.id]);

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  const remove = async (lesson: Lesson) => {
    if (!confirm(`Delete lesson "${lesson.title}"?`)) return;
    setBusyId(lesson.id);
    try {
      const res = await fetch(`/api/admin/courses/${course.id}/lessons`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lesson.id })
      });
      const data = await res.json();
      if (data.success) {
        setLessons((ls) => ls.filter((l) => l.id !== lesson.id));
      } else {
        alert(data.error || 'Delete failed');
      }
    } finally {
      setBusyId(null);
    }
  };

  const clone = async (lesson: Lesson) => {
    setBusyId(lesson.id);
    try {
      const res = await fetch(
        `/api/admin/courses/${course.id}/lessons/${lesson.id}/clone`,
        { method: 'POST' }
      );
      const data = await res.json();
      if (data.success) {
        await fetchLessons();
      } else {
        alert(data.error || 'Clone failed');
      }
    } finally {
      setBusyId(null);
    }
  };

  const move = async (lesson: Lesson, dir: -1 | 1) => {
    const sorted = [...lessons].sort(byOrder);
    const idx = sorted.findIndex((l) => l.id === lesson.id);
    const swapWith = sorted[idx + dir];
    if (!swapWith) return;
    const next = sorted.map((l, i) => {
      if (i === idx) return { ...l, lesson_number: swapWith.lesson_number };
      if (l.id === swapWith.id) return { ...l, lesson_number: lesson.lesson_number };
      return l;
    });
    setLessons(next);
    await fetch(`/api/admin/courses/${course.id}/lessons/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orders: next.map((l) => ({
          id: l.id,
          chapter_number: l.chapter_number || 1,
          lesson_number: l.lesson_number
        }))
      })
    }).catch(() => null);
  };

  const sorted = [...lessons].sort(byOrder);
  const nextChapter = sorted[sorted.length - 1]?.chapter_number || 1;
  const nextPosition = (sorted[sorted.length - 1]?.lesson_number || 0) + 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-amber-200"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to courses
        </button>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-black"
        >
          <Plus className="w-4 h-4" />
          Add lesson
        </button>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-white">{course.title}</h2>
        <p className="text-sm text-white/50">{lessons.length} lessons</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-white/50 text-sm p-6">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading lessons…
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-black/30 p-8 text-center text-white/50 text-sm">
          No lessons yet. Click <span className="text-amber-200">Add lesson</span> to start.
        </div>
      ) : (
        <ul className="space-y-2">
          {sorted.map((l, idx) => (
            <li
              key={l.id}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5"
            >
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => move(l, -1)}
                  disabled={idx === 0}
                  className="p-0.5 text-white/40 hover:text-amber-200 disabled:opacity-20"
                  aria-label="Move up"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => move(l, 1)}
                  disabled={idx === sorted.length - 1}
                  className="p-0.5 text-white/40 hover:text-amber-200 disabled:opacity-20"
                  aria-label="Move down"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="text-xs text-white/40 w-12 text-center">
                Ch {l.chapter_number} · {l.lesson_number}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{l.title}</div>
                {l.description && (
                  <div className="text-xs text-white/40 truncate">{l.description}</div>
                )}
              </div>
              {l.is_preview && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  Preview
                </span>
              )}

              <div className="flex items-center gap-1">
                {l.video_url && (
                  <IconButton
                    title="Preview"
                    onClick={() =>
                      setPreview({
                        lessonId: l.id,
                        lessonTitle: l.title,
                        lessonDescription: l.description || undefined,
                        videoUrl: l.video_url!,
                        courseId: course.id,
                        courseTitle: course.title
                      })
                    }
                  >
                    <Play className="w-3.5 h-3.5" />
                  </IconButton>
                )}
                <IconButton
                  title="Edit"
                  onClick={() => {
                    setEditing(l);
                    setShowForm(true);
                  }}
                >
                  <PenLine className="w-3.5 h-3.5" />
                </IconButton>
                <IconButton
                  title="Clone"
                  busy={busyId === l.id}
                  onClick={() => clone(l)}
                >
                  <Copy className="w-3.5 h-3.5" />
                </IconButton>
                <IconButton title="Delete" tone="danger" onClick={() => remove(l)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <LessonFormModal
          courseId={course.id}
          lesson={editing}
          defaultChapter={nextChapter}
          defaultPosition={nextPosition}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            fetchLessons();
          }}
        />
      )}

      <LessonVideoPanel lessonInfo={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

function byOrder(a: Lesson, b: Lesson) {
  const ch = (a.chapter_number || 0) - (b.chapter_number || 0);
  if (ch !== 0) return ch;
  return (a.lesson_number || 0) - (b.lesson_number || 0);
}

function IconButton({
  children,
  onClick,
  title,
  tone,
  busy
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  tone?: 'danger';
  busy?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={busy}
      className={`p-1.5 rounded hover:bg-white/5 disabled:opacity-40 ${
        tone === 'danger' ? 'text-red-300 hover:text-red-200' : 'text-white/60 hover:text-amber-200'
      }`}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : children}
    </button>
  );
}
