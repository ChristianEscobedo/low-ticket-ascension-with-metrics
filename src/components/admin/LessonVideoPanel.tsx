'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, ExternalLink, Play, X } from 'lucide-react';

export interface LessonInfo {
  lessonId: string;
  lessonTitle: string;
  lessonDescription?: string;
  videoUrl: string;
  courseId: string;
  courseTitle: string;
}

interface Props {
  lessonInfo: LessonInfo | null;
  onClose: () => void;
}

/**
 * Floating, draggable lesson video preview. Used by the admin lesson editor
 * for quick playback while editing other lessons in the same window.
 */
export default function LessonVideoPanel({ lessonInfo, onClose }: Props) {
  const [minimized, setMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 80 });
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent) => {
      setPosition({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
    };
    const up = () => setDragging(false);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [dragging, dragOffset]);

  if (!lessonInfo) return null;

  const onDragStart = (e: React.MouseEvent) => {
    setDragging(true);
    setDragOffset({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  return (
    <div
      className={`fixed z-50 rounded-xl border border-amber-200/20 bg-gradient-to-br from-gray-950 to-black shadow-2xl overflow-hidden transition-all ${
        minimized ? 'w-64' : 'w-96'
      }`}
      style={{ left: position.x, top: position.y }}
    >
      <div
        onMouseDown={onDragStart}
        className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-amber-500/15 to-amber-300/5 border-b border-white/10 cursor-move select-none"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Play className="w-4 h-4 text-amber-300 flex-shrink-0" />
          <span className="text-sm font-medium text-white truncate">
            {lessonInfo.lessonTitle}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setMinimized(!minimized)}
            className="p-1 text-white/50 hover:text-amber-200 transition-colors"
            title={minimized ? 'Expand' : 'Minimize'}
          >
            {minimized ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={onClose}
            className="p-1 text-white/50 hover:text-red-300 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!minimized && (
        <div>
          <div className="aspect-video bg-black">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={lessonInfo.videoUrl}
              controls
              className="w-full h-full"
            />
          </div>
          <div className="p-3 space-y-2">
            {lessonInfo.lessonDescription && (
              <p className="text-xs text-white/60 line-clamp-2">
                {lessonInfo.lessonDescription}
              </p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/40 truncate">
                {lessonInfo.courseTitle}
              </span>
              <Link
                href={`/courses/${lessonInfo.courseId}?lesson=${lessonInfo.lessonId}`}
                target="_blank"
                className="text-xs text-amber-300 hover:text-amber-200 flex items-center gap-1 shrink-0"
              >
                View lesson
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
