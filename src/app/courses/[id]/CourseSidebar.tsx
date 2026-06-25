'use client';

import { CheckCircle2, Circle, PlayCircle, Sparkles } from 'lucide-react';

interface Lesson {
  id: string;
  title: string;
  chapter_number: number | null;
  lesson_number: number;
  video_duration_seconds: number | null;
}
interface ProgressRow {
  lesson_id: string;
  progress_seconds: number | null;
  is_completed: boolean | null;
}

interface Props {
  isAdmin?: boolean;
  chapters: [number, Lesson[]][];
  progress: Map<string, ProgressRow>;
  activeId: string | null;
  setActiveId: (id: string) => void;
  completedCount: number;
  totalCount: number;
  pct: number;
}

function formatLessonDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function CourseSidebar({
  isAdmin,
  chapters,
  progress,
  activeId,
  setActiveId,
  completedCount,
  totalCount,
  pct
}: Props) {
  return (
    <aside className="rounded-2xl border border-amber-200/15 bg-gradient-to-br from-gray-900/60 to-gray-950/60 backdrop-blur p-5 h-fit lg:sticky lg:top-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-amber-200/80">
          Course content
        </h2>
        {isAdmin && (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-200 border border-amber-300/30">
            <Sparkles className="w-3 h-3" /> Admin
          </span>
        )}
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-white/60 mb-1.5">
          <span>
            {completedCount} / {totalCount} complete
          </span>
          <span className="tabular-nums">{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full bg-amber-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        {chapters.length === 0 && (
          <div className="text-sm text-white/40 py-6 text-center">
            No lessons published yet.
          </div>
        )}
        {chapters.map(([chapterNumber, lessonsInChapter]) => (
          <div key={chapterNumber}>
            <div className="text-[11px] uppercase tracking-wider text-white/40 font-semibold mb-2 px-1">
              Chapter {chapterNumber}
            </div>
            <ul className="space-y-1">
              {lessonsInChapter.map((lesson) => {
                const isActive = lesson.id === activeId;
                const done = progress.get(lesson.id)?.is_completed;
                const dur = formatLessonDuration(lesson.video_duration_seconds);
                return (
                  <li key={lesson.id}>
                    <button
                      onClick={() => setActiveId(lesson.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg flex items-start gap-3 transition-colors ${
                        isActive
                          ? 'bg-amber-500/10 border border-amber-300/40'
                          : 'border border-transparent hover:bg-white/[0.04]'
                      }`}
                    >
                      <span className="flex-shrink-0 mt-0.5">
                        {done ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : isActive ? (
                          <PlayCircle className="w-4 h-4 text-amber-300" />
                        ) : (
                          <Circle className="w-4 h-4 text-white/30" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block text-sm leading-snug ${
                            isActive ? 'text-white font-semibold' : 'text-white/80'
                          }`}
                        >
                          {lesson.title}
                        </span>
                        {dur && (
                          <span className="block text-[11px] text-white/40 mt-0.5 tabular-nums">
                            {dur}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </aside>
  );
}
