'use client';

import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import type { LicenseKey } from '../LicensesPanel';

interface CourseOption {
  id: string;
  title: string;
}

export default function LicenseFormModal({
  courses,
  onClose,
  onCreated
}: {
  courses: CourseOption[];
  onClose: () => void;
  onCreated: (k: LicenseKey) => void;
}) {
  const [isAllAccess, setIsAllAccess] = useState(false);
  const [courseId, setCourseId] = useState<string>(courses[0]?.id ?? '');
  const [maxActivations, setMaxActivations] = useState(1);
  const [expiresAt, setExpiresAt] = useState('');
  const [notes, setNotes] = useState('');
  const [customKey, setCustomKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          license_key: customKey.trim() || undefined,
          course_id: isAllAccess ? null : courseId || null,
          is_all_access: isAllAccess,
          max_activations: maxActivations,
          expires_at: expiresAt || null,
          notes: notes.trim() || null
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Create failed');
      const created = data.key as LicenseKey;
      const enriched: LicenseKey = {
        ...created,
        course_title:
          (created.is_all_access
            ? null
            : courses.find((c) => c.id === created.course_id)?.title) ?? null
      };
      onCreated(enriched);
    } catch (e: any) {
      setError(e?.message || 'Failed to create license');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur">
      <form
        onSubmit={submit}
        className="w-full max-w-lg rounded-2xl border border-amber-200/20 bg-gradient-to-br from-gray-900 to-gray-950 p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-white">New license key</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.06]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
            <input
              type="checkbox"
              checked={isAllAccess}
              onChange={(e) => setIsAllAccess(e.target.checked)}
              className="accent-amber-500"
            />
            All-access (grants every published course)
          </label>

          {!isAllAccess && (
            <Field label="Course">
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-sm focus:border-amber-300/60 focus:outline-none"
              >
                <option value="">— Pick a course —</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Max activations">
              <input
                type="number"
                min={1}
                value={maxActivations}
                onChange={(e) =>
                  setMaxActivations(Math.max(1, Number(e.target.value) || 1))
                }
                className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-sm focus:border-amber-300/60 focus:outline-none"
              />
            </Field>
            <Field label="Expires (optional)">
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-sm focus:border-amber-300/60 focus:outline-none"
              />
            </Field>
          </div>

          <Field label="Custom key (optional — leave blank to auto-generate)">
            <input
              type="text"
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value.toUpperCase())}
              placeholder="LAUNCH-2026-VIP"
              className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-sm font-mono tracking-wider focus:border-amber-300/60 focus:outline-none"
            />
          </Field>

          <Field label="Notes (optional)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Black Friday promo, gift to Jane"
              className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-sm focus:border-amber-300/60 focus:outline-none resize-none"
            />
          </Field>
        </div>

        {error && (
          <div className="mt-4 px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm text-white/70 hover:text-white hover:bg-white/[0.06]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400 disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Create license
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-white/50 mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
