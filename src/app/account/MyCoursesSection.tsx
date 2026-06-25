import Link from 'next/link';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BookOpen, Clock, GraduationCap } from 'lucide-react';
import { getUserCourseAccess } from '@/utils/courses/access';

// Service-role client — lazy so module import never throws on missing env.
let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;
  _supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
  return _supabase;
}

interface CourseSummary {
  id: string;
  title: string;
  short_description: string | null;
  thumbnail_url: string | null;
  lesson_count: number | null;
  total_duration_minutes: number | null;
}

interface Row {
  course: CourseSummary;
  total: number;
  completed: number;
  pct: number;
  accessType: string;
}

export default async function MyCoursesSection({
  userId,
  email
}: {
  userId: string;
  email: string | null;
}) {
  const access = await getUserCourseAccess(userId, email);
  if (access.length === 0) return <EmptyState />;

  const supabase = getSupabase();
  const courseIds = access.map((a) => a.course_id);
  const { data: courses } = await (supabase as any)
    .from('courses')
    .select(
      'id, title, short_description, thumbnail_url, lesson_count, total_duration_minutes'
    )
    .in('id', courseIds);

  const courseMap = new Map<string, CourseSummary>(
    ((courses as CourseSummary[] | null) ?? []).map((c) => [c.id, c])
  );

  const { data: lessons } = await (supabase as any)
    .from('lessons')
    .select('id, course_id')
    .in('course_id', courseIds)
    .eq('status', 'published');

  const lessonIdsByCourse = new Map<string, string[]>();
  for (const l of (lessons as { id: string; course_id: string }[] | null) ?? []) {
    lessonIdsByCourse.set(l.course_id, [
      ...(lessonIdsByCourse.get(l.course_id) ?? []),
      l.id
    ]);
  }
  const allLessonIds = Array.from(lessonIdsByCourse.values()).flat();

  let completedByLesson = new Set<string>();
  if (allLessonIds.length > 0) {
    const { data: progress } = await (supabase as any)
      .from('user_lesson_progress')
      .select('lesson_id, is_completed')
      .eq('user_id', userId)
      .in('lesson_id', allLessonIds);
    completedByLesson = new Set(
      ((progress as { lesson_id: string; is_completed: boolean }[] | null) ?? [])
        .filter((p) => p.is_completed)
        .map((p) => p.lesson_id)
    );
  }

  const rows: Row[] = [];
  for (const a of access) {
    const course = courseMap.get(a.course_id);
    if (!course) continue;
    const ids = lessonIdsByCourse.get(a.course_id) ?? [];
    const total = ids.length;
    const completed = ids.filter((id) => completedByLesson.has(id)).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    rows.push({ course, total, completed, pct, accessType: a.access_type });
  }

  return (
    <div className="rounded-2xl border border-amber-200/15 bg-gradient-to-br from-gray-900/60 to-gray-950/60 backdrop-blur p-6 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-300/30 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">My Courses</h2>
            <p className="text-xs text-white/50">
              {rows.length} course{rows.length === 1 ? '' : 's'} unlocked
            </p>
          </div>
        </div>
        <Link
          href="/courses"
          className="text-sm text-amber-300 hover:text-amber-200 transition-colors"
        >
          Browse library →
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((row) => (
          <MyCourseCard key={row.course.id} row={row} />
        ))}
      </div>
    </div>
  );
}

function MyCourseCard({ row }: { row: Row }) {
  const { course, completed, total, pct, accessType } = row;
  return (
    <Link
      href={`/courses/${course.id}`}
      className="group rounded-xl border border-amber-200/15 bg-black/40 overflow-hidden hover:border-amber-200/40 transition-colors"
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
            <BookOpen className="w-10 h-10 text-amber-300/40" />
          </div>
        )}
        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur text-[10px] uppercase tracking-wider text-amber-200 border border-amber-200/30">
          {accessType}
        </span>
      </div>
      <CardMeta course={course} completed={completed} total={total} pct={pct} />
    </Link>
  );
}


function CardMeta({
  course,
  completed,
  total,
  pct
}: {
  course: CourseSummary;
  completed: number;
  total: number;
  pct: number;
}) {
  return (
    <div className="p-4">
      <h3 className="font-semibold text-white text-sm tracking-tight line-clamp-2 group-hover:text-amber-200 transition-colors">
        {course.title}
      </h3>
      <div className="mt-3 flex items-center gap-3 text-[11px] text-white/50">
        <span className="inline-flex items-center gap-1">
          <BookOpen className="w-3 h-3" />
          {total} lesson{total === 1 ? '' : 's'}
        </span>
        {course.total_duration_minutes != null &&
          course.total_duration_minutes > 0 && (
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {course.total_duration_minutes}m
            </span>
          )}
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] text-white/60 mb-1">
          <span>
            {completed} / {total} done
          </span>
          <span className="tabular-nums">{pct}%</span>
        </div>
        <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full bg-amber-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-amber-200/15 bg-gradient-to-br from-gray-900/60 to-gray-950/60 backdrop-blur p-8 text-center mb-6">
      <GraduationCap className="w-10 h-10 text-amber-300/40 mx-auto mb-3" />
      <h2 className="text-lg font-semibold text-white">No courses yet</h2>
      <p className="mt-1 text-sm text-white/50">
        Pick something up from the library to start learning.
      </p>
      <Link
        href="/courses"
        className="inline-block mt-4 px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400 transition-colors"
      >
        Browse courses
      </Link>
    </div>
  );
}
