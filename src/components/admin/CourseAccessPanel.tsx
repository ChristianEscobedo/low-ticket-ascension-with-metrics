'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Search, Trash2, UserPlus, X } from 'lucide-react';

interface AccessRow {
  id: string;
  user_id: string;
  course_id: string;
  access_type: string;
  granted_at: string;
  expires_at: string | null;
  courses: {
    id: string;
    title: string;
    short_description?: string | null;
    is_published?: boolean;
  } | null;
}

interface AdminUser {
  id: string;
  email: string | null;
  full_name: string | null;
}

interface Course {
  id: string;
  title: string;
  is_published?: boolean;
}

/**
 * Admin panel: manage manual course grants (user_course_access).
 * - List all grants with user/course details
 * - Grant access: email typeahead -> pick course -> POST
 * - Revoke per row
 */
export default function CourseAccessPanel() {
  const [rows, setRows] = useState<AccessRow[]>([]);
  const [users, setUsers] = useState<Record<string, AdminUser>>({});
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGrant, setShowGrant] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [accessRes, usersRes, coursesRes] = await Promise.all([
        fetch('/api/admin/user-course-access'),
        fetch('/api/admin/users'),
        fetch('/api/admin/courses')
      ]);
      const accessData = await accessRes.json();
      const usersData = await usersRes.json();
      const coursesData = await coursesRes.json();

      if (!accessData.success) throw new Error(accessData.error || 'Load failed');
      setRows(accessData.courseAccess || []);

      if (usersData.success) {
        const map: Record<string, AdminUser> = {};
        for (const u of usersData.users as AdminUser[]) map[u.id] = u;
        setUsers(map);
      }
      if (coursesData.success) setCourses(coursesData.courses || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const revoke = async (id: string) => {
    if (!confirm('Revoke this course grant?')) return;
    try {
      const res = await fetch(`/api/admin/user-course-access?id=${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Revoke failed');
      setRows((r) => r.filter((x) => x.id !== id));
      setToast('Access revoked');
    } catch (e: any) {
      setToast(e?.message || 'Revoke failed');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-white/50 p-6">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading grants…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Course Access</h2>
          <p className="text-sm text-white/50 mt-1">
            Manually grant or revoke course access for specific users.
          </p>
        </div>
        <button
          onClick={() => setShowGrant(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-black transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Grant access
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-500/10 text-red-200 text-sm px-3 py-2">
          {error}
        </div>
      )}
      {toast && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 text-amber-200 text-sm px-3 py-2 flex items-center justify-between">
          <span>{toast}</span>
          <button onClick={() => setToast(null)} className="text-amber-200/70 hover:text-amber-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <GrantsTable rows={rows} users={users} onRevoke={revoke} />

      {showGrant && (
        <GrantModal
          courses={courses}
          onClose={() => setShowGrant(false)}
          onGranted={(msg) => {
            setShowGrant(false);
            setToast(msg);
            fetchAll();
          }}
        />
      )}
    </div>
  );
}

function GrantsTable({
  rows,
  users,
  onRevoke
}: {
  rows: AccessRow[];
  users: Record<string, AdminUser>;
  onRevoke: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/30 p-8 text-center text-white/50 text-sm">
        No course grants yet. Click <span className="text-amber-200">Grant access</span> to add one.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/30">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-white/50 text-xs uppercase tracking-wide">
            <th className="text-left py-2.5 px-3 font-medium">User</th>
            <th className="text-left py-2.5 px-3 font-medium">Course</th>
            <th className="text-left py-2.5 px-3 font-medium">Source</th>
            <th className="text-left py-2.5 px-3 font-medium">Granted</th>
            <th className="text-right py-2.5 px-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const u = users[row.user_id];
            return (
              <tr key={row.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="py-2 px-3">
                  <div className="font-medium text-white">
                    {u?.full_name || u?.email || row.user_id.slice(0, 8)}
                  </div>
                  {u?.email && u.full_name && (
                    <div className="text-xs text-white/40">{u.email}</div>
                  )}
                </td>
                <td className="py-2 px-3 text-white/80">
                  {row.courses?.title || row.course_id.slice(0, 8)}
                </td>
                <td className="py-2 px-3">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      row.access_type === 'admin'
                        ? 'bg-amber-500/20 text-amber-200'
                        : row.access_type === 'purchase'
                          ? 'bg-emerald-500/20 text-emerald-200'
                          : 'bg-white/10 text-white/60'
                    }`}
                  >
                    {row.access_type}
                  </span>
                </td>
                <td className="py-2 px-3 text-white/50">
                  {new Date(row.granted_at).toLocaleDateString()}
                </td>
                <td className="py-2 px-3 text-right">
                  <button
                    onClick={() => onRevoke(row.id)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-300 hover:text-red-200 hover:bg-red-500/10 rounded"
                  >
                    <Trash2 className="w-3 h-3" />
                    Revoke
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GrantModal({
  courses,
  onClose,
  onGranted
}: {
  courses: Course[];
  onClose: () => void;
  onGranted: (message: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminUser[]>([]);
  const [picked, setPicked] = useState<AdminUser | null>(null);
  const [courseId, setCourseId] = useState('');
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (picked) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (data.success) setResults(data.users || []);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query, picked]);

  const submit = async () => {
    if (!picked || !courseId) {
      setErr('Pick a user and a course');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch('/api/admin/user-course-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: picked.id, course_id: courseId })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Grant failed');
      onGranted(`Granted access to ${picked.email || picked.id}`);
    } catch (e: any) {
      setErr(e?.message || 'Grant failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-amber-200/20 bg-gradient-to-br from-gray-950 to-black p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Grant course access</h3>
          <button
            onClick={onClose}
            className="p-1 text-white/50 hover:text-white"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium text-white/60">User</label>
          {picked ? (
            <div className="flex items-center justify-between rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2">
              <div>
                <div className="text-sm font-medium text-white">
                  {picked.full_name || picked.email}
                </div>
                {picked.email && picked.full_name && (
                  <div className="text-xs text-white/50">{picked.email}</div>
                )}
              </div>
              <button
                onClick={() => {
                  setPicked(null);
                  setQuery('');
                }}
                className="text-xs text-white/60 hover:text-white"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by email…"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-black/40 border border-white/10 text-white placeholder-white/30 focus:border-amber-300/40 focus:outline-none"
              />
              {(results.length > 0 || searching) && (
                <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-white/10 bg-gray-950 shadow-xl">
                  {searching && (
                    <div className="px-3 py-2 text-xs text-white/40 flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Searching…
                    </div>
                  )}
                  {results.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => setPicked(u)}
                      className="w-full text-left px-3 py-2 hover:bg-white/5 border-b border-white/5 last:border-0"
                    >
                      <div className="text-sm text-white">{u.email}</div>
                      {u.full_name && (
                        <div className="text-xs text-white/50">{u.full_name}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium text-white/60">Course</label>
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg bg-black/40 border border-white/10 text-white focus:border-amber-300/40 focus:outline-none"
          >
            <option value="">Select course…</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
                {c.is_published === false ? ' (draft)' : ''}
              </option>
            ))}
          </select>
        </div>

        {err && (
          <div className="rounded-lg border border-red-400/30 bg-red-500/10 text-red-200 text-xs px-3 py-2">
            {err}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm text-white/60 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || !picked || !courseId}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-black disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            {saving ? 'Granting…' : 'Grant access'}
          </button>
        </div>
      </div>
    </div>
  );
}
