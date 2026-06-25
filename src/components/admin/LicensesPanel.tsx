'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Key,
  Loader2,
  Plus,
  Power,
  Trash2,
  X
} from 'lucide-react';
import LicenseFormModal from './licenses/LicenseFormModal';

export interface LicenseKey {
  id: string;
  license_key: string;
  course_id: string | null;
  course_title: string | null;
  is_all_access: boolean;
  is_active: boolean;
  max_activations: number;
  current_activations: number;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

interface CourseOption {
  id: string;
  title: string;
}

export default function LicensesPanel() {
  const [keys, setKeys] = useState<LicenseKey[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [keysRes, coursesRes] = await Promise.all([
        fetch('/api/admin/licenses'),
        fetch('/api/admin/courses')
      ]);
      const keysData = await keysRes.json();
      const coursesData = await coursesRes.json();
      if (!keysData.success) throw new Error(keysData.error || 'Load failed');
      setKeys(keysData.keys || []);
      setCourses(
        ((coursesData.courses || []) as { id: string; title: string }[]).map(
          (c) => ({ id: c.id, title: c.title })
        )
      );
    } catch (e: any) {
      setError(e?.message || 'Failed to load licenses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const toggleActive = async (k: LicenseKey) => {
    setBusyId(k.id);
    try {
      const res = await fetch(`/api/admin/licenses/${k.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !k.is_active })
      });
      const data = await res.json();
      if (data.success) {
        setKeys((prev) =>
          prev.map((p) => (p.id === k.id ? { ...p, ...data.key } : p))
        );
      } else {
        alert(data.error || 'Toggle failed');
      }
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (k: LicenseKey) => {
    if (!confirm(`Delete license "${k.license_key}"?`)) return;
    setBusyId(k.id);
    try {
      const res = await fetch(`/api/admin/licenses/${k.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setKeys((prev) => prev.filter((p) => p.id !== k.id));
      } else {
        alert(data.error || 'Delete failed');
      }
    } finally {
      setBusyId(null);
    }
  };

  const copy = async (k: LicenseKey) => {
    try {
      await navigator.clipboard.writeText(k.license_key);
      setCopiedId(k.id);
      setTimeout(() => setCopiedId((id) => (id === k.id ? null : id)), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div className="rounded-2xl border border-amber-200/15 bg-gradient-to-br from-gray-900/60 to-gray-950/60 backdrop-blur p-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-300/30 flex items-center justify-center">
            <Key className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">License Keys</h2>
            <p className="text-xs text-white/50">
              {keys.length} key{keys.length === 1 ? '' : 's'} issued
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400 transition-colors"
        >
          <Plus className="w-4 h-4" /> New license
        </button>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-white/60">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading licenses…
        </div>
      ) : keys.length === 0 ? (
        <EmptyKeys onCreate={() => setShowForm(true)} />
      ) : (
        <LicensesTable
          keys={keys}
          busyId={busyId}
          copiedId={copiedId}
          onCopy={copy}
          onToggle={toggleActive}
          onRemove={remove}
        />
      )}

      {showForm && (
        <LicenseFormModal
          courses={courses}
          onClose={() => setShowForm(false)}
          onCreated={(k) => {
            setKeys((prev) => [k, ...prev]);
            setShowForm(false);
          }}
        />
      )}
    </div>
  );
}

function EmptyKeys({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="text-center py-12 border border-dashed border-amber-200/20 rounded-xl">
      <Key className="w-10 h-10 text-amber-300/40 mx-auto mb-3" />
      <h3 className="text-lg font-semibold text-white">No licenses yet</h3>
      <p className="text-sm text-white/50 mt-1">
        Issue a key to grant course access without going through Stripe.
      </p>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400 transition-colors"
      >
        <Plus className="w-4 h-4" /> Create first license
      </button>
    </div>
  );
}

function LicensesTable({
  keys,
  busyId,
  copiedId,
  onCopy,
  onToggle,
  onRemove
}: {
  keys: LicenseKey[];
  busyId: string | null;
  copiedId: string | null;
  onCopy: (k: LicenseKey) => void;
  onToggle: (k: LicenseKey) => void;
  onRemove: (k: LicenseKey) => void;
}) {
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-white/40">
            <th className="px-2 py-2 font-medium">Key</th>
            <th className="px-2 py-2 font-medium">Scope</th>
            <th className="px-2 py-2 font-medium">Activations</th>
            <th className="px-2 py-2 font-medium">Expires</th>
            <th className="px-2 py-2 font-medium">Status</th>
            <th className="px-2 py-2 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => (
            <LicenseRow
              key={k.id}
              k={k}
              busy={busyId === k.id}
              copied={copiedId === k.id}
              onCopy={onCopy}
              onToggle={onToggle}
              onRemove={onRemove}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LicenseRow({
  k,
  busy,
  copied,
  onCopy,
  onToggle,
  onRemove
}: {
  k: LicenseKey;
  busy: boolean;
  copied: boolean;
  onCopy: (k: LicenseKey) => void;
  onToggle: (k: LicenseKey) => void;
  onRemove: (k: LicenseKey) => void;
}) {
  const expired = k.expires_at && new Date(k.expires_at) < new Date();
  const exhausted = k.current_activations >= k.max_activations;
  return (
    <tr className="border-t border-white/[0.06]">
      <td className="px-2 py-3">
        <div className="flex items-center gap-2">
          <code className="text-amber-200 text-xs tracking-wider">
            {k.license_key}
          </code>
          <button
            onClick={() => onCopy(k)}
            className="text-white/40 hover:text-amber-200 transition-colors"
            title="Copy license key"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
        {k.notes && (
          <div className="text-[11px] text-white/40 mt-0.5 line-clamp-1">
            {k.notes}
          </div>
        )}
      </td>
      <td className="px-2 py-3 text-white/70">
        {k.is_all_access ? (
          <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-300/30 text-amber-200 text-[11px] uppercase tracking-wider">
            All access
          </span>
        ) : (
          <span className="text-xs">{k.course_title ?? '—'}</span>
        )}
      </td>
      <td className="px-2 py-3 text-white/70 tabular-nums text-xs">
        {k.current_activations} / {k.max_activations}
      </td>
      <td className="px-2 py-3 text-white/70 text-xs">
        {k.expires_at
          ? new Date(k.expires_at).toLocaleDateString()
          : 'Never'}
      </td>
      <td className="px-2 py-3">
        {k.is_active && !expired && !exhausted ? (
          <span className="text-emerald-300 text-xs">Active</span>
        ) : expired ? (
          <span className="text-red-300 text-xs">Expired</span>
        ) : exhausted ? (
          <span className="text-amber-300 text-xs">Exhausted</span>
        ) : (
          <span className="text-white/40 text-xs">Disabled</span>
        )}
      </td>
      <td className="px-2 py-3 text-right">
        <div className="inline-flex items-center gap-1">
          <button
            onClick={() => onToggle(k)}
            disabled={busy}
            className="p-1.5 rounded-lg text-white/60 hover:text-amber-200 hover:bg-white/[0.04] transition-colors disabled:opacity-50"
            title={k.is_active ? 'Disable' : 'Re-enable'}
          >
            {k.is_active ? (
              <X className="w-4 h-4" />
            ) : (
              <Power className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => onRemove(k)}
            disabled={busy}
            className="p-1.5 rounded-lg text-white/60 hover:text-red-300 hover:bg-white/[0.04] transition-colors disabled:opacity-50"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
