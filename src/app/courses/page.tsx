'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Clock, GraduationCap, Lock, Search } from 'lucide-react';

interface Course {
  id: string;
  title: string;
  short_description?: string | null;
  description?: string | null;
  thumbnail_url?: string | null;
  lesson_count?: number | null;
  total_duration_minutes?: number | null;
  is_free?: boolean | null;
  badge_text?: string | null;
}

const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

/**
 * Public courses listing. Anyone can browse the catalog; clicking through
 * to /courses/[id] enforces access against user_course_access /
 * product_course_assignments at read time.
 */
export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'free' | 'premium'>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/courses');
        const data = await res.json();
        if (!cancelled && data.success) setCourses(data.courses || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    return courses.filter((c) => {
      if (filter === 'free' && !c.is_free) return false;
      if (filter === 'premium' && c.is_free) return false;
      if (query) {
        const q = query.toLowerCase();
        if (
          !(c.title || '').toLowerCase().includes(q) &&
          !(c.short_description || '').toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [courses, filter, query]);

  return (
    <section className="bg-black min-h-screen text-white relative">
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.04) 1px, transparent 0)',
            backgroundSize: '30px 30px'
          }}
        />
      </div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-amber-200/[0.04] blur-3xl rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
          <div>
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-amber-200/80 font-semibold mb-3">
              <GraduationCap className="w-3.5 h-3.5" />
              Course Library
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight">
              Learn what moves the needle
            </h1>
            <p className="mt-3 text-white/60 max-w-xl">
              Every course unlocks the moment your purchase clears. Sign in
              with the email you used at checkout to pick up where you left off.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search courses…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder-white/40 focus:outline-none focus:border-amber-300/60"
            />
          </div>
          <div className="inline-flex rounded-xl bg-white/[0.03] border border-white/10 p-1">
            {(['all', 'free', 'premium'] as const).map((k) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`px-4 py-1.5 text-sm rounded-lg capitalize transition-colors ${
                  filter === k
                    ? 'bg-amber-500 text-black font-semibold'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <SkeletonGrid />
        ) : filtered.length === 0 ? (
          <EmptyState hasQuery={query.length > 0 || filter !== 'all'} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}


function CourseCard({ course }: { course: Course }) {
  return (
    <Link
      href={`/courses/${course.id}`}
      className="group relative rounded-2xl border border-amber-200/15 bg-gradient-to-br from-gray-900/60 to-gray-950/60 backdrop-blur overflow-hidden shadow-[0_0_30px_rgba(251,191,36,0.04)] hover:border-amber-200/40 hover:shadow-[0_0_40px_rgba(251,191,36,0.12)] transition-all"
    >
      <div className="relative aspect-video bg-black overflow-hidden">
        {course.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-500/10 to-transparent">
            <BookOpen className="w-12 h-12 text-amber-300/40" />
          </div>
        )}
        {course.badge_text && (
          <span className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-amber-500 text-black text-[10px] font-bold uppercase tracking-wider">
            {course.badge_text}
          </span>
        )}
        {!course.is_free && (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur text-amber-200 text-[10px] font-semibold uppercase tracking-wider border border-amber-200/30">
            <Lock className="w-3 h-3" />
            Premium
          </span>
        )}
      </div>
      <div className="p-5">
        <h3 className="font-bold text-lg tracking-tight text-white group-hover:text-amber-200 transition-colors line-clamp-2">
          {course.title}
        </h3>
        {course.short_description && (
          <p className="mt-2 text-sm text-white/60 line-clamp-2">
            {course.short_description}
          </p>
        )}
        <div className="mt-4 flex items-center gap-4 text-xs text-white/50">
          {course.lesson_count != null && (
            <span className="inline-flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" />
              {course.lesson_count} lesson{course.lesson_count === 1 ? '' : 's'}
            </span>
          )}
          {course.total_duration_minutes != null &&
            course.total_duration_minutes > 0 && (
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatDuration(course.total_duration_minutes)}
              </span>
            )}
        </div>
      </div>
    </Link>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden animate-pulse"
        >
          <div className="aspect-video bg-white/[0.04]" />
          <div className="p-5 space-y-3">
            <div className="h-4 bg-white/[0.06] rounded w-3/4" />
            <div className="h-3 bg-white/[0.04] rounded w-full" />
            <div className="h-3 bg-white/[0.04] rounded w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className="rounded-2xl border border-amber-200/15 bg-gradient-to-br from-gray-900/60 to-gray-950/60 backdrop-blur p-12 text-center">
      <BookOpen className="w-12 h-12 text-amber-300/40 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-white">
        {hasQuery ? 'No courses match your filters' : 'No courses yet'}
      </h3>
      <p className="mt-2 text-sm text-white/50 max-w-md mx-auto">
        {hasQuery
          ? 'Try clearing the search or switching the filter.'
          : 'New courses will appear here as soon as they are published.'}
      </p>
    </div>
  );
}
