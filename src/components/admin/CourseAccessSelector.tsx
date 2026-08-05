'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Check, GraduationCap, Loader2, X } from 'lucide-react';

interface Course {
  id: string;
  title: string;
  thumbnail_url?: string;
  lesson_count?: number;
  total_duration_minutes?: number;
  is_published?: boolean;
}

interface Props {
  productId: string;
  // Compact mode renders a single badge that opens the editor on click.
  compact?: boolean;
}

/**
 * Per-product course assignment editor. Reads/writes via
 * /api/admin/product-courses. Used inline on the admin products page.
 */
export default function CourseAccessSelector({ productId, compact }: Props) {
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [coursesRes, assignRes] = await Promise.all([
        fetch('/api/admin/courses'),
        fetch(
          `/api/admin/product-courses?product_id=${encodeURIComponent(productId)}`
        )
      ]);
      const coursesData = await coursesRes.json();
      const assignData = await assignRes.json();
      if (coursesData.success) setAllCourses(coursesData.courses || []);
      if (assignData.success) {
        setAssignedIds(
          (assignData.assignments || []).map(
            (a: { course_id: string }) => a.course_id
          )
        );
      }
    } catch (e) {
      console.error('[CourseAccessSelector] fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleCourse = (id: string) => {
    setAssignedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setSavedMsg(null);
  };

  const save = async () => {
    setSaving(true);
    setSavedMsg(null);
    try {
      const res = await fetch('/api/admin/product-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          course_ids: assignedIds
        })
      });
      const data = await res.json();
      setSavedMsg(data.success ? 'Saved' : data.error || 'Save failed');
    } catch (e: any) {
      setSavedMsg(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-bone/40 text-xs">
        <Loader2 className="w-3 h-3 animate-spin" />
        Loading courses…
      </div>
    );
  }

  if (compact && !open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-brass/15 hover:bg-brass/25 text-brass border border-brass/30 transition-colors"
      >
        <GraduationCap className="w-3.5 h-3.5" />
        <span>Courses</span>
        {assignedIds.length > 0 && (
          <span className="px-1.5 py-0.5 bg-brass/25 rounded-full text-[10px] font-bold">
            {assignedIds.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-brass/15 bg-ink/60 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-brass" />
          <span className="text-sm font-semibold text-bone">Course Access</span>
          {assignedIds.length > 0 && (
            <span className="px-1.5 py-0.5 bg-brass/20 text-brass rounded-full text-[10px] font-bold">
              {assignedIds.length} assigned
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brass hover:bg-brass/90 text-ink disabled:opacity-40 transition-colors"
          >
            {saving ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Check className="w-3 h-3" />
            )}
            {saving ? 'Saving…' : 'Save'}
          </button>
          {compact && (
            <button
              onClick={() => setOpen(false)}
              className="p-1 hover:bg-bone/5 rounded-lg"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-bone/50" />
            </button>
          )}
          {savedMsg && (
            <span className="text-xs text-bone/60">{savedMsg}</span>
          )}
        </div>
      </div>

      <p className="text-[11px] text-bone/40">
        Pick which courses customers unlock when they purchase this product.
      </p>

      {allCourses.length === 0 ? (
        <p className="text-xs text-bone/50 py-2">
          No courses found. Create one in the Courses panel first.
        </p>
      ) : (
        <div className="grid gap-2 max-h-64 overflow-y-auto pr-1">
          {allCourses.map((course) => {
            const isAssigned = assignedIds.includes(course.id);
            return (
              <button
                key={course.id}
                onClick={() => toggleCourse(course.id)}
                className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all ${
                  isAssigned
                    ? 'bg-brass/10 border-brass/40 ring-1 ring-brass/20'
                    : 'bg-bone/[0.02] border-bone/10 hover:border-bone/20'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                    isAssigned
                      ? 'bg-brass text-ink'
                      : 'bg-bone/[0.05] text-bone/30'
                  }`}
                >
                  {isAssigned && <Check className="w-3 h-3" />}
                </div>
                {course.thumbnail_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={course.thumbnail_url}
                    alt=""
                    className="w-10 h-10 rounded object-cover shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-bone truncate">
                    {course.title}
                  </div>
                  <div className="text-[10px] text-bone/40 flex items-center gap-2">
                    {course.lesson_count != null && (
                      <span>{course.lesson_count} lessons</span>
                    )}
                    {course.total_duration_minutes != null && (
                      <span>{course.total_duration_minutes} min</span>
                    )}
                    {!course.is_published && (
                      <span className="text-brass font-medium">Draft</span>
                    )}
                  </div>
                </div>
                <BookOpen
                  className={`w-4 h-4 shrink-0 ${isAssigned ? 'text-brass' : 'text-bone/30'}`}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
