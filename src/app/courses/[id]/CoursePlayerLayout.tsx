'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  PlayCircle,
  Sparkles
} from 'lucide-react';
import VideoSurface, { type VideoSurfaceHandle } from './VideoSurface';
import CourseSidebar from './CourseSidebar';
import TranscriptViewer from './TranscriptViewer';
import LessonResources from './LessonResources';
import VideoCTAOverlay, { type VideoCTA } from './VideoCTAOverlay';

interface LessonResource {
  name: string;
  url: string;
  type: string;
}

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  video_duration_seconds: number | null;
  content_markdown: string | null;
  chapter_number: number | null;
  lesson_number: number;
  resources?: LessonResource[] | null;
  ctas?: VideoCTA[] | null;
}
interface ProgressRow {
  lesson_id: string;
  progress_seconds: number | null;
  is_completed: boolean | null;
}

interface Props {
  course: Record<string, any>;
  isAdmin: boolean;
  chapters: [number, Lesson[]][];
  progress: Map<string, ProgressRow>;
  activeId: string | null;
  setActiveId: (id: string) => void;
  activeLesson: Lesson | null;
  prevLesson: Lesson | null;
  nextLesson: Lesson | null;
  completedCount: number;
  totalCount: number;
  currentTime: number;
  videoHandleRef: React.Ref<VideoSurfaceHandle>;
  onTimeUpdate: (seconds: number) => void;
  onEnded: () => void;
  onSeek: (seconds: number) => void;
  onToggleComplete: (lessonId: string, value: boolean) => void;
}

export default function CoursePlayerLayout(p: Props) {
  const pct = p.totalCount > 0 ? Math.round((p.completedCount / p.totalCount) * 100) : 0;
  return (
    <section className="bg-black min-h-screen text-white relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[400px] bg-amber-200/[0.04] blur-3xl rounded-full pointer-events-none" />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/courses"
          className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-amber-200 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to library
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          <div className="space-y-5">
            <div className="relative rounded-2xl overflow-hidden border border-amber-200/15 bg-black aspect-video">
              {p.activeLesson?.video_url ? (
                <VideoSurface
                  key={p.activeLesson.id}
                  src={p.activeLesson.video_url}
                  poster={p.activeLesson.thumbnail_url || undefined}
                  startSeconds={p.progress.get(p.activeLesson.id)?.progress_seconds ?? 0}
                  onTimeUpdate={p.onTimeUpdate}
                  onEnded={p.onEnded}
                  handleRef={p.videoHandleRef}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/40">
                  <div className="text-center">
                    <PlayCircle className="w-12 h-12 mx-auto mb-2" />
                    <p className="text-sm">No video for this lesson yet</p>
                  </div>
                </div>
              )}
              {p.activeLesson?.video_url && (p.activeLesson.ctas?.length ?? 0) > 0 && (
                <VideoCTAOverlay
                  key={p.activeLesson.id}
                  ctas={p.activeLesson.ctas}
                  lessonId={p.activeLesson.id}
                  currentTime={p.currentTime}
                />
              )}
            </div>

            <div className="rounded-2xl border border-amber-200/15 bg-gradient-to-br from-gray-900/60 to-gray-950/60 backdrop-blur p-6">
              <div className="text-xs uppercase tracking-[0.25em] text-amber-200/80 font-semibold mb-2">
                {p.course.title}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                {p.activeLesson?.title ?? 'Select a lesson'}
              </h1>
              {p.activeLesson?.description && (
                <p className="mt-3 text-white/70 leading-relaxed">
                  {p.activeLesson.description}
                </p>
              )}
              {p.activeLesson?.content_markdown && (
                <div className="mt-5 text-sm text-white/70 whitespace-pre-wrap leading-relaxed border-t border-white/10 pt-5">
                  {p.activeLesson.content_markdown}
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
                {p.activeLesson && (
                  <button
                    onClick={() =>
                      p.onToggleComplete(
                        p.activeLesson!.id,
                        !p.progress.get(p.activeLesson!.id)?.is_completed
                      )
                    }
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                      p.progress.get(p.activeLesson.id)?.is_completed
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-400/30'
                        : 'bg-white/[0.05] text-white border border-white/10 hover:bg-white/[0.08]'
                    }`}
                  >
                    {p.progress.get(p.activeLesson.id)?.is_completed ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Completed
                      </>
                    ) : (
                      <>
                        <Circle className="w-4 h-4" />
                        Mark complete
                      </>
                    )}
                  </button>
                )}
                {p.prevLesson && (
                  <button
                    onClick={() => p.setActiveId(p.prevLesson!.id)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-white/70 hover:text-white hover:bg-white/[0.05] transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Previous
                  </button>
                )}
                {p.nextLesson && (
                  <button
                    onClick={() => p.setActiveId(p.nextLesson!.id)}
                    className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-amber-500 text-black hover:bg-amber-400 transition-colors"
                  >
                    Next lesson
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {p.activeLesson && <LessonResources resources={p.activeLesson.resources} />}

            {p.activeLesson && (
              <TranscriptViewer
                key={p.activeLesson.id}
                lessonId={p.activeLesson.id}
                currentTime={p.currentTime}
                onSeek={p.onSeek}
              />
            )}
          </div>

          <CourseSidebar {...p} pct={pct} />
        </div>
      </div>
    </section>
  );
}
