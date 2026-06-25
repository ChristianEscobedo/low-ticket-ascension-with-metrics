import { notFound, redirect } from 'next/navigation';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';
import {
  isAdminEmail,
  userHasCourseAccess
} from '@/utils/courses/access';
import CoursePlayer from './CoursePlayer';

export const dynamic = 'force-dynamic';

const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function CoursePage({
  params
}: {
  params: { id: string };
}) {
  const authed = createClient();
  const user = await getUser(authed);
  const isAdmin = isAdminEmail(user?.email);

  let courseQuery = (supabase as any)
    .from('courses')
    .select('*')
    .eq('id', params.id);
  if (!isAdmin) courseQuery = courseQuery.eq('is_published', true);
  const { data: course } = await courseQuery.single();

  if (!course) notFound();

  if (!user) {
    redirect(`/signin?next=${encodeURIComponent(`/courses/${params.id}`)}`);
  }

  const hasAccess =
    course.is_free === true ||
    isAdmin ||
    (await userHasCourseAccess(user.id, user.email ?? null, params.id));

  let lessonsQuery = (supabase as any)
    .from('lessons')
    .select(
      'id, course_id, title, description, video_url, thumbnail_url, video_duration_seconds, content_markdown, chapter_number, lesson_number, is_preview, status, resources, ctas'
    )
    .eq('course_id', params.id)
    .order('chapter_number', { ascending: true })
    .order('lesson_number', { ascending: true });
  if (!isAdmin) lessonsQuery = lessonsQuery.eq('status', 'published');
  const { data: lessons } = await lessonsQuery;

  if (!hasAccess) {
    return <AccessGate course={course} />;
  }

  return (
    <CoursePlayer
      course={course}
      lessons={lessons ?? []}
      isAdmin={isAdmin}
    />
  );
}

function AccessGate({ course }: { course: Record<string, any> }) {
  return (
    <section className="bg-black min-h-screen text-white relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-amber-200/[0.05] blur-3xl rounded-full pointer-events-none" />
      <div className="relative z-10 max-w-3xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-300/30 mb-6">
          <Lock className="w-6 h-6 text-amber-300" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
          {course.title}
        </h1>
        <p className="mt-3 text-white/60">
          This course is locked. Purchase the matching offer or activate a
          license to unlock every lesson.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/#pricing"
            className="px-5 py-2.5 rounded-xl bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400 transition-colors"
          >
            View pricing
          </Link>
          <Link
            href="/account"
            className="px-5 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-white text-sm hover:bg-white/[0.08] transition-colors"
          >
            Activate license
          </Link>
          <Link
            href="/courses"
            className="px-5 py-2.5 rounded-xl text-white/60 text-sm hover:text-white transition-colors"
          >
            Back to library
          </Link>
        </div>
      </div>
    </section>
  );
}
