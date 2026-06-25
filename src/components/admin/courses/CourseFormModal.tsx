'use client';

import { useRef, useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import type { Course } from './types';

interface Props {
  course: Course | null;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Create / edit a course. POSTs to /api/admin/courses for new, PUT for
 * existing. Thumbnail upload is delegated to /api/admin/upload-thumbnail.
 */
export default function CourseFormModal({ course, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    id: course?.id || '',
    title: course?.title || '',
    description: course?.description || '',
    short_description: course?.short_description || '',
    thumbnail_url: course?.thumbnail_url || '',
    instructor_name: course?.instructor_name || 'Course Team',
    price_cents: course?.price_cents || 0,
    is_free: course?.is_free ?? true,
    is_published: course?.is_published ?? false,
    is_featured: course?.is_featured ?? false,
    badge_text: course?.badge_text || ''
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file?.type.startsWith('image/')) return;
    setUploading(true);
    setError(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch('/api/admin/upload-thumbnail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Image: base64, folder: 'course-thumbnails' })
      });
      const data = await res.json();
      if (data.success && data.url) {
        setForm((p) => ({ ...p, thumbnail_url: data.url }));
      } else {
        setError(data.error || 'Upload failed');
      }
    } catch (err: any) {
      setError(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
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
      const res = await fetch('/api/admin/courses', {
        method: course ? 'PUT' : 'POST',
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
            {course ? 'Edit course' : 'New course'}
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

        <Field label="Short description">
          <input
            value={form.short_description}
            onChange={(e) => setForm((p) => ({ ...p, short_description: e.target.value }))}
            className={inputCls}
          />
        </Field>

        <Field label="Full description">
          <textarea
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            rows={3}
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Instructor name">
            <input
              value={form.instructor_name}
              onChange={(e) => setForm((p) => ({ ...p, instructor_name: e.target.value }))}
              className={inputCls}
            />
          </Field>
          <Field label="Badge text (optional)">
            <input
              value={form.badge_text}
              onChange={(e) => setForm((p) => ({ ...p, badge_text: e.target.value }))}
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Thumbnail">
          <div className="flex items-center gap-3">
            {form.thumbnail_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.thumbnail_url}
                alt=""
                className="w-20 h-12 object-cover rounded border border-white/10"
              />
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/10 disabled:opacity-40"
            >
              {uploading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Upload className="w-3 h-3" />
              )}
              {uploading ? 'Uploading…' : 'Upload image'}
            </button>
            {form.thumbnail_url && (
              <button
                onClick={() => setForm((p) => ({ ...p, thumbnail_url: '' }))}
                className="text-xs text-white/40 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>
          <input
            value={form.thumbnail_url}
            onChange={(e) => setForm((p) => ({ ...p, thumbnail_url: e.target.value }))}
            placeholder="…or paste a URL"
            className={`${inputCls} mt-2`}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Price (cents)">
            <input
              type="number"
              value={form.price_cents}
              onChange={(e) =>
                setForm((p) => ({ ...p, price_cents: parseInt(e.target.value) || 0 }))
              }
              disabled={form.is_free}
              className={`${inputCls} disabled:opacity-40`}
            />
          </Field>
          <div className="flex flex-col justify-end gap-2 text-sm text-white/70">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_free}
                onChange={(e) => setForm((p) => ({ ...p, is_free: e.target.checked }))}
              />
              Free course
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(e) =>
                  setForm((p) => ({ ...p, is_published: e.target.checked }))
                }
              />
              Published
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_featured}
                onChange={(e) =>
                  setForm((p) => ({ ...p, is_featured: e.target.checked }))
                }
              />
              Featured
            </label>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-400/30 bg-red-500/10 text-red-200 text-xs px-3 py-2">
            {error}
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
            {saving ? 'Saving…' : course ? 'Save changes' : 'Create course'}
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