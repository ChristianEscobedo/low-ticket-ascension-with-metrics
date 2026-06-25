'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BookOpen,
  Clock,
  Copy,
  Loader2,
  PenLine,
  Plus,
  Trash2
} from 'lucide-react';
import CourseFormModal from './courses/CourseFormModal';
import CourseLessonsEditor from './courses/CourseLessonsEditor';
import type { Course } from './courses/types';

/**
 * Admin: courses list + create/edit + drill into a course's lessons.
 * Keeps a single mode at a time (list | editing lessons of one course).
 */
export default function CoursesPanel() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/courses');
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Load failed');
      setCourses(data.courses || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const remove = async (course: Course) => {
    if (!confirm(`Delete "${course.title}" and all its lessons?`)) return;
    setBusyId(course.id);
    try {
      const res = await fetch(`/api/admin/courses/${course.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setCourses((cs) => cs.filter((c) => c.id !== course.id));
      } else {
        alert(data.error || 'Delete failed');
      }
    } finally {
      setBusyId(null);
    }
  };

  const clone = async (course: Course) => {
    setBusyId(course.id);
    try {
      const res = await fetch(`/api/admin/courses/${course.id}/clone`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        await fetchCourses();
      } else {
        alert(data.error || 'Clone failed');
      }
    } finally {
      setBusyId(null);
    }
  };

  if (activeCourse) {
    return (
      <CourseLessonsEditor
        course={activeCourse}
        onBack={() => {
          setActiveCourse(null);
          fetchCourses();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Courses</h2>
          <p className="text-sm text-white/50 mt-1">
            Create courses, edit lessons, and control publishing.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-black"
        >
          <Plus className="w-4 h-4" />
          New course
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-500/10 text-red-200 text-sm px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-white/50 text-sm p-6">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading courses…
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-black/30 p-8 text-center text-white/50 text-sm">
          No courses yet. Click <span className="text-amber-200">New course</span> to start.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <CourseCard
              key={c.id}
              course={c}
              busy={busyId === c.id}
              onOpen={() => setActiveCourse(c)}
              onEdit={() => {
                setEditing(c);
                setShowForm(true);
              }}
              onClone={() => clone(c)}
              onDelete={() => remove(c)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <CourseFormModal
          course={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            fetchCourses();
          }}
        />
      )}
    </div>
  );
}

function CourseCard({
  course,
  busy,
  onOpen,
  onEdit,
  onClone,
  onDelete
}: {
  course: Course;
  busy: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onClone: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group flex flex-col rounded-xl border border-white/10 bg-black/40 overflow-hidden hover:border-amber-300/30 transition-colors">
      <button
        onClick={onOpen}
        className="relative aspect-video bg-black/60 overflow-hidden text-left"
      >
        {course.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.thumbnail_url}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20">
            <BookOpen className="w-8 h-8" />
          </div>
        )}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          {!course.is_published && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/30 text-amber-200">
              Draft
            </span>
          )}
          {course.is_featured && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-500/30 text-purple-200">
              Featured
            </span>
          )}
          {course.badge_text && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/30 text-emerald-200">
              {course.badge_text}
            </span>
          )}
        </div>
      </button>
      <div className="p-3 flex flex-col gap-2 flex-1">
        <button onClick={onOpen} className="text-left">
          <h3 className="text-sm font-semibold text-white group-hover:text-amber-200 transition-colors line-clamp-2">
            {course.title}
          </h3>
          {course.short_description && (
            <p className="text-xs text-white/50 line-clamp-2 mt-1">
              {course.short_description}
            </p>
          )}
        </button>
        <div className="flex items-center gap-3 text-[11px] text-white/40 mt-auto">
          <span className="flex items-center gap-1">
            <BookOpen className="w-3 h-3" />
            {course.lesson_count || 0} lessons
          </span>
          {!!course.total_duration_minutes && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {course.total_duration_minutes} min
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 pt-2 border-t border-white/5">
          <button
            onClick={onEdit}
            className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded hover:bg-white/5 text-white/70 hover:text-amber-200"
          >
            <PenLine className="w-3 h-3" />
            Edit
          </button>
          <button
            onClick={onClone}
            disabled={busy}
            className="inline-flex items-center justify-center px-2 py-1.5 text-xs rounded hover:bg-white/5 text-white/60 hover:text-amber-200 disabled:opacity-40"
            aria-label="Clone"
            title="Clone"
          >
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />}
          </button>
          <button
            onClick={onDelete}
            className="inline-flex items-center justify-center px-2 py-1.5 text-xs rounded hover:bg-red-500/10 text-red-300 hover:text-red-200"
            aria-label="Delete"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
