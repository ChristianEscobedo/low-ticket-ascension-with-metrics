'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import CoursePlayerLayout from './CoursePlayerLayout';
import type { VideoSurfaceHandle } from './VideoSurface';
import type { VideoCTA } from './VideoCTAOverlay';

interface LessonResource {
  name: string;
  url: string;
  type: string;
}

interface Lesson {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  video_duration_seconds: number | null;
  content_markdown: string | null;
  chapter_number: number | null;
  lesson_number: number;
  is_preview: boolean | null;
  status?: string | null;
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
  lessons: Lesson[];
  isAdmin: boolean;
}

export default function CoursePlayer({ course, lessons, isAdmin }: Props) {
  const [activeId, setActiveId] = useState<string | null>(lessons[0]?.id ?? null);
  const [progress, setProgress] = useState<Map<string, ProgressRow>>(new Map());
  const [currentTime, setCurrentTime] = useState(0);
  const lastSavedRef = useRef<{ id: string; seconds: number } | null>(null);
  const videoHandleRef = useRef<VideoSurfaceHandle | null>(null);

  // Initial progress fetch + restore last-watched lesson.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/lessons/progress?course_id=${course.id}`);
      const data = await res.json();
      if (cancelled || !data.success) return;
      const map = new Map<string, ProgressRow>();
      for (const p of (data.progress as ProgressRow[]) ?? []) map.set(p.lesson_id, p);
      setProgress(map);
      const firstIncomplete = lessons.find((l) => !map.get(l.id)?.is_completed);
      if (firstIncomplete) setActiveId(firstIncomplete.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [course.id, lessons]);

  const activeLesson = useMemo(
    () => lessons.find((l) => l.id === activeId) ?? null,
    [lessons, activeId]
  );
  const activeIndex = activeLesson ? lessons.indexOf(activeLesson) : -1;
  const nextLesson = activeIndex >= 0 ? lessons[activeIndex + 1] : null;
  const prevLesson = activeIndex > 0 ? lessons[activeIndex - 1] : null;

  const chapters = useMemo(() => {
    const grouped = new Map<number, Lesson[]>();
    for (const l of lessons) {
      const key = l.chapter_number ?? 1;
      grouped.set(key, [...(grouped.get(key) ?? []), l]);
    }
    return Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]);
  }, [lessons]);

  const completedCount = lessons.filter((l) => progress.get(l.id)?.is_completed).length;
  const totalCount = lessons.length;

  async function saveProgress(
    lessonId: string,
    patch: { progress_seconds?: number; is_completed?: boolean }
  ) {
    setProgress((prev) => {
      const next = new Map(prev);
      const current = next.get(lessonId) ?? {
        lesson_id: lessonId,
        progress_seconds: 0,
        is_completed: false
      };
      next.set(lessonId, {
        ...current,
        progress_seconds: patch.progress_seconds ?? current.progress_seconds,
        is_completed:
          patch.is_completed !== undefined ? patch.is_completed : current.is_completed
      });
      return next;
    });
    await fetch('/api/lessons/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lesson_id: lessonId, ...patch })
    }).catch(() => null);
  }

  function handleTimeUpdate(seconds: number) {
    if (!activeLesson) return;
    setCurrentTime(seconds);
    const last = lastSavedRef.current;
    // Throttle to one save every ~10 seconds per lesson.
    if (last && last.id === activeLesson.id && Math.abs(seconds - last.seconds) < 10) {
      return;
    }
    lastSavedRef.current = { id: activeLesson.id, seconds };
    saveProgress(activeLesson.id, { progress_seconds: seconds });
  }

  function handleSeek(seconds: number) {
    videoHandleRef.current?.seek(seconds);
    setCurrentTime(seconds);
  }

  function handleEnded() {
    if (!activeLesson) return;
    saveProgress(activeLesson.id, { is_completed: true });
  }

  return (
    <CoursePlayerLayout
      course={course}
      isAdmin={isAdmin}
      chapters={chapters}
      progress={progress}
      activeId={activeId}
      setActiveId={(id) => {
        setActiveId(id);
        setCurrentTime(0);
      }}
      activeLesson={activeLesson}
      prevLesson={prevLesson}
      nextLesson={nextLesson}
      completedCount={completedCount}
      totalCount={totalCount}
      currentTime={currentTime}
      videoHandleRef={videoHandleRef}
      onTimeUpdate={handleTimeUpdate}
      onEnded={handleEnded}
      onSeek={handleSeek}
      onToggleComplete={(lessonId, value) => saveProgress(lessonId, { is_completed: value })}
    />
  );
}
