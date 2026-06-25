'use client';

import { useState } from 'react';
import { Eye, EyeOff, Loader2, Mic, Sparkles, X } from 'lucide-react';
import type { Lesson, LessonResource, VideoCTA } from './types';
import LessonResourcesManager from './LessonResourcesManager';
import LessonCtasManager from './LessonCtasManager';
import LessonCtasPreview from './LessonCtasPreview';

interface Props {
  courseId: string;
  lesson: Lesson | null;
  /** Defaults for new lessons when no prior lesson exists. */
  defaultChapter?: number;
  defaultPosition?: number;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Create / edit a lesson. Uses /api/admin/courses/[id]/lessons (POST/PUT).
 */
export default function LessonFormModal({
  courseId,
  lesson,
  defaultChapter = 1,
  defaultPosition = 1,
  onClose,
  onSaved
}: Props) {
  const [form, setForm] = useState({
    id: lesson?.id || '',
    title: lesson?.title || '',
    description: lesson?.description || '',
    video_url: lesson?.video_url || '',
    thumbnail_url: lesson?.thumbnail_url || '',
    video_duration_seconds: lesson?.video_duration_seconds || 0,
    chapter_number: lesson?.chapter_number || defaultChapter,
    lesson_number: lesson?.lesson_number || defaultPosition,
    is_preview: lesson?.is_preview ?? false,
    content_markdown: lesson?.content_markdown || '',
    resources: (lesson?.resources as LessonResource[] | null) || [],
    ctas: (lesson?.ctas as VideoCTA[] | null) || []
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState<'transcribe' | 'description' | null>(null);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [showCtaPreview, setShowCtaPreview] = useState(false);

  const transcribe = async () => {
    if (!lesson?.id || !form.video_url) return;
    setAiBusy('transcribe');
    setAiMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/courses/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId: lesson.id, videoUrl: form.video_url })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Transcription failed');
      setAiMessage(
        `Transcribed ${data.transcription?.wordCount ?? 0} words. You can now generate richer copy.`
      );
    } catch (e: any) {
      setError(e?.message || 'Transcription failed');
    } finally {
      setAiBusy(null);
    }
  };

  const generateDescription = async () => {
    if (!form.title.trim()) {
      setError('Add a title before generating a description.');
      return;
    }
    setAiBusy('description');
    setAiMessage(null);
    setError(null);
    try {
      // Pull the existing transcript (if any) so the model has real context.
      let transcriptText: string | undefined;
      if (lesson?.id) {
        try {
          const tr = await fetch(
            `/api/courses/transcribe?lessonId=${encodeURIComponent(lesson.id)}`
          );
          const td = await tr.json();
          if (td.success && td.transcription?.status === 'completed') {
            transcriptText = td.transcription.fullText;
          }
        } catch {
          /* transcript optional */
        }
      }

      const res = await fetch('/api/courses/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'lesson',
          title: form.title,
          existingDescription: form.description || undefined,
          transcriptText
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Generation failed');
      setForm((p) => ({ ...p, description: data.description as string }));
      setAiMessage('Description generated.');
    } catch (e: any) {
      setError(e?.message || 'Generation failed');
    } finally {
      setAiBusy(null);
    }
  };

  const save = async () => {
    if (!form.title.trim()) {
      setError('Title is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/courses/${courseId}/lessons`, {
        method: lesson ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Save failed');
      onSaved();
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl my-8 rounded-2xl border border-amber-200/20 bg-gradient-to-br from-gray-950 to-black p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            {lesson ? 'Edit lesson' : 'New lesson'}
          </h3>
          <button onClick={onClose} className="p-1 text-white/50 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <Field label="Title">
          <input
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            className={inputCls}
          />
        </Field>

        <Field label="Description">
          <textarea
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            rows={2}
            className={inputCls}
          />
          <button
            type="button"
            onClick={generateDescription}
            disabled={aiBusy !== null}
            className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md border border-amber-300/30 text-amber-200 hover:bg-amber-300/[0.08] disabled:opacity-50"
          >
            {aiBusy === 'description' ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            Generate description
          </button>
        </Field>

        <Field label="Video URL">
          <input
            value={form.video_url}
            onChange={(e) => setForm((p) => ({ ...p, video_url: e.target.value }))}
            placeholder="https://… (MP4, YouTube, Vimeo, etc.)"
            className={inputCls}
          />
          {lesson?.id && form.video_url && (
            <button
              type="button"
              onClick={transcribe}
              disabled={aiBusy !== null}
              className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md border border-amber-300/30 text-amber-200 hover:bg-amber-300/[0.08] disabled:opacity-50"
            >
              {aiBusy === 'transcribe' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Mic className="w-3 h-3" />
              )}
              Transcribe video
            </button>
          )}
          {lesson?.id && !form.video_url && (
            <p className="mt-1.5 text-[11px] text-white/40">
              Add a video URL to enable transcription.
            </p>
          )}
          {!lesson?.id && (
            <p className="mt-1.5 text-[11px] text-white/40">
              Save the lesson first to enable transcription.
            </p>
          )}
        </Field>

        <Field label="Thumbnail URL (optional)">
          <input
            value={form.thumbnail_url}
            onChange={(e) => setForm((p) => ({ ...p, thumbnail_url: e.target.value }))}
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Chapter">
            <input
              type="number"
              value={form.chapter_number}
              onChange={(e) =>
                setForm((p) => ({ ...p, chapter_number: parseInt(e.target.value) || 1 }))
              }
              className={inputCls}
            />
          </Field>
          <Field label="Position">
            <input
              type="number"
              value={form.lesson_number}
              onChange={(e) =>
                setForm((p) => ({ ...p, lesson_number: parseInt(e.target.value) || 1 }))
              }
              className={inputCls}
            />
          </Field>
          <Field label="Duration (s)">
            <input
              type="number"
              value={form.video_duration_seconds}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  video_duration_seconds: parseInt(e.target.value) || 0
                }))
              }
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Notes / markdown (optional)">
          <textarea
            value={form.content_markdown}
            onChange={(e) => setForm((p) => ({ ...p, content_markdown: e.target.value }))}
            rows={4}
            className={`${inputCls} font-mono text-xs`}
          />
        </Field>

        <Field label="Resources (downloads, links, references)">
          <LessonResourcesManager
            resources={form.resources}
            onChange={(next) => setForm((p) => ({ ...p, resources: next }))}
          />
        </Field>

        <Field label="Video CTAs (mid-roll & end-screen offers)">
          <LessonCtasManager
            ctas={form.ctas}
            onChange={(next) => setForm((p) => ({ ...p, ctas: next }))}
            lessonId={lesson?.id}
          />
          {form.video_url && form.ctas.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowCtaPreview((v) => !v)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md border border-amber-300/30 text-amber-200 hover:bg-amber-300/[0.08]"
              >
                {showCtaPreview ? (
                  <EyeOff className="w-3 h-3" />
                ) : (
                  <Eye className="w-3 h-3" />
                )}
                {showCtaPreview ? 'Hide CTA preview' : 'Preview CTAs while scrubbing'}
              </button>
              {showCtaPreview && (
                <LessonCtasPreview videoUrl={form.video_url} ctas={form.ctas} />
              )}
            </div>
          )}
          {!form.video_url && form.ctas.length > 0 && (
            <p className="mt-1.5 text-[11px] text-white/40">
              Add a video URL above to preview CTA timing live.
            </p>
          )}
        </Field>

        <label className="flex items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={form.is_preview}
            onChange={(e) => setForm((p) => ({ ...p, is_preview: e.target.checked }))}
          />
          Free preview lesson (no purchase required)
        </label>

        {error && (
          <div className="rounded-lg border border-red-400/30 bg-red-500/10 text-red-200 text-xs px-3 py-2">
            {error}
          </div>
        )}
        {aiMessage && (
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 text-xs px-3 py-2">
            {aiMessage}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-2 text-sm text-white/60 hover:text-white">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-black disabled:opacity-40"
          >
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            {saving ? 'Saving…' : lesson ? 'Save changes' : 'Create lesson'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  'w-full px-3 py-2 text-sm rounded-lg bg-black/40 border border-white/10 text-white placeholder-white/30 focus:border-amber-300/40 focus:outline-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-white/60">{label}</label>
      {children}
    </div>
  );
}