'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Clock, GraduationCap, PlayCircle } from 'lucide-react';

interface Course {
  id: string;
  title: string;
  description?: string;
  short_description?: string;
  thumbnail_url?: string;
  lesson_count?: number;
  total_duration_minutes?: number;
}

interface CourseAccessLinksProps {
  productId: string;
  // Retained for backwards compatibility with the success page call site;
  // the unified product_course_assignments table no longer needs it.
  productType?: 'low_ticket_offer' | 'reseller_kit';
  heading?: string;
}

export default function CourseAccessLinks({
  productId,
  heading = 'Your Course Access'
}: CourseAccessLinksProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchCourses() {
      try {
        const res = await fetch(
          `/api/product-courses/${encodeURIComponent(productId)}`
        );
        const data = await res.json();
        if (!cancelled && data.success && data.courses?.length > 0) {
          setCourses(data.courses);
        }
      } catch (e) {
        console.error('[CourseAccessLinks] fetch error:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchCourses();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (loading || courses.length === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-200/15 bg-gradient-to-br from-gray-900/60 to-gray-950/60 backdrop-blur p-6 md:p-8 shadow-[0_0_30px_rgba(251,191,36,0.04)]">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
          <GraduationCap className="w-5 h-5 text-amber-300" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white tracking-tight">{heading}</h3>
          <p className="text-sm text-white/60">
            {courses.length === 1
              ? 'You have access to the following course'
              : `You have access to ${courses.length} courses`}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {courses.map((course) => (
          <Link
            key={course.id}
            href={`/courses/${course.id}`}
            className="group flex flex-col rounded-xl border border-white/10 bg-black/40 overflow-hidden hover:border-amber-300/40 hover:bg-black/50 transition-all"
          >
            {course.thumbnail_url && (
              <div className="relative aspect-video bg-black/60 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={course.thumbnail_url}
                  alt={course.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-2 right-2 p-1.5 bg-black/60 rounded-lg backdrop-blur-sm">
                  <PlayCircle className="w-5 h-5 text-amber-300" />
                </div>
              </div>
            )}
            <div className="p-4 flex-1 flex flex-col">
              <h4 className="text-base font-semibold text-white group-hover:text-amber-200 transition-colors mb-1">
                {course.title}
              </h4>
              {(course.short_description || course.description) && (
                <p className="text-xs text-white/60 line-clamp-2 mb-3">
                  {course.short_description || course.description}
                </p>
              )}
              <div className="mt-auto flex items-center gap-3 text-[11px] text-white/40">
                {course.lesson_count != null && course.lesson_count > 0 && (
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    {course.lesson_count} lessons
                  </span>
                )}
                {course.total_duration_minutes != null &&
                  course.total_duration_minutes > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {course.total_duration_minutes} min
                    </span>
                  )}
              </div>
              <div className="mt-3 text-center py-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs font-semibold group-hover:bg-amber-500/25 transition-colors">
                Access Course →
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
