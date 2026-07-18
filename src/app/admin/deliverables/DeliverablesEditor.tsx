'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Eye,
  ExternalLink,
  RotateCcw,
  Save,
  Trash2,
  XCircle,
} from 'lucide-react';

export interface DeliverableItem {
  key: string;
  defaultTitle: string;
  defaultSubtitle: string;
  defaultHtml: string;
  title: string;
  subtitle: string;
  html: string;
  customized: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface Props {
  slug: string;
  items: DeliverableItem[];
}

/**
 * Lists every registered resource for an offer on the left, and edits the
 * selected one on the right: title, subtitle, and the full HTML body, with a
 * live sandboxed preview matching what the buyer sees on the delivery page.
 */
export default function DeliverablesEditor({ slug, items }: Props) {
  const [activeKey, setActiveKey] = useState(items[0]?.key ?? '');
  const active = items.find((i) => i.key === activeKey) ?? items[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
      <nav className="space-y-1.5">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setActiveKey(item.key)}
            className={`w-full text-left rounded-lg px-3 py-2.5 text-sm border transition-colors ${
              item.key === activeKey
                ? 'border-brass/30 bg-brass/[0.1] text-brass font-semibold'
                : 'border-transparent text-bone/60 hover:text-bone hover:bg-bone/[0.05]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate">{item.defaultTitle}</span>
              {item.customized && (
                <span className="flex-shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md border border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-200">
                  Custom
                </span>
              )}
            </div>
          </button>
        ))}
      </nav>

      {active ? (
        <ResourceEditorPanel key={active.key} slug={slug} item={active} />
      ) : (
        <p className="text-sm text-bone/50">Select a resource.</p>
      )}
    </div>
  );
}

function ResourceEditorPanel({ slug, item }: { slug: string; item: DeliverableItem }) {
  const router = useRouter();
  const [title, setTitle] = useState(item.title);
  const [subtitle, setSubtitle] = useState(item.subtitle);
  const [html, setHtml] = useState(item.html);
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const dirty = title !== item.title || subtitle !== item.subtitle || html !== item.html;

  const previewDoc = useMemo(
    () =>
      `<!doctype html><html><head><meta charset="utf-8" />` +
      `<script src="https://cdn.tailwindcss.com"></script>` +
      `<style>body{background:#F5F1EB;color:#1A1816;font-family:ui-sans-serif,system-ui,sans-serif;padding:24px;}</style>` +
      `</head><body><p style="text-transform:uppercase;letter-spacing:.2em;font-size:11px;color:#A88B5C;">Preview</p>${html}</body></html>`,
    [html],
  );

  const previewUrl = `/mothermode/resource/${slug}/${item.key}`;

  const save = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/mothermode-deliverables', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, key: item.key, title, subtitle, html }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.success) {
        setResult({ ok: true, message: 'Published.' });
        router.refresh();
      } else {
        setResult({ ok: false, message: body.error ?? `Save failed (HTTP ${res.status})` });
      }
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : 'Network error' });
    } finally {
      setBusy(false);
    }
  };

  const resetToDefault = () => {
    setTitle(item.defaultTitle);
    setSubtitle(item.defaultSubtitle);
    setHtml(item.defaultHtml);
  };

  const removeOverride = async () => {
    if (
      !window.confirm(
        `Remove the custom version of "${item.defaultTitle}"? Buyers will see the shipped default again.`,
      )
    ) {
      return;
    }
    setResetting(true);
    setResult(null);
    try {
      const res = await fetch(
        `/api/admin/mothermode-deliverables?slug=${encodeURIComponent(slug)}&key=${encodeURIComponent(item.key)}`,
        { method: 'DELETE' },
      );
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.success) {
        setResult({ ok: true, message: 'Override removed.' });
        router.refresh();
      } else {
        setResult({ ok: false, message: body.error ?? `Delete failed (HTTP ${res.status})` });
      }
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : 'Network error' });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-bone/50">
        <span
          className={`px-2 py-0.5 rounded-md border font-semibold uppercase tracking-wider ${
            item.customized
              ? 'border-emerald-400/30 bg-emerald-400/[0.05] text-emerald-200'
              : 'border-bone/10 bg-bone/[0.03] text-bone/40'
          }`}
        >
          {item.customized ? 'Custom' : 'Default'}
        </span>
        <span className="px-2 py-0.5 rounded-md border border-brass/30 bg-brass/[0.06] text-brass font-semibold uppercase tracking-wider">
          {item.key}
        </span>
        {item.updatedAt && (
          <span>
            Last saved {new Date(item.updatedAt).toLocaleString()}
            {item.updatedBy ? ` by ${item.updatedBy}` : ''}
          </span>
        )}
        <a
          href={previewUrl}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-brass hover:text-brass/80"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open live page
        </a>
      </div>

      <Field label="Title" htmlFor="dv-title">
        <input
          id="dv-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-ink/40 border border-bone/10 rounded-lg px-3 py-2 text-sm text-bone focus:border-brass/50 focus:outline-none"
        />
      </Field>

      <Field label="Subtitle" htmlFor="dv-subtitle">
        <input
          id="dv-subtitle"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          className="w-full bg-ink/40 border border-bone/10 rounded-lg px-3 py-2 text-sm text-bone focus:border-brass/50 focus:outline-none"
        />
      </Field>

      <Field label="Document HTML" htmlFor="dv-html">
        <textarea
          id="dv-html"
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          rows={20}
          spellCheck={false}
          className="w-full bg-ink/40 border border-bone/10 rounded-lg px-3 py-2 text-xs font-mono text-bone focus:border-brass/50 focus:outline-none"
        />
      </Field>

      <div className="rounded-xl border border-brass/15 bg-ink/30 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 bg-bone/[0.02] border-b border-bone/5 text-[11px] uppercase tracking-wider text-bone/50 font-semibold">
          <Eye className="w-3.5 h-3.5" />
          Live preview
        </div>
        <iframe
          title="Resource HTML preview"
          srcDoc={previewDoc}
          sandbox="allow-scripts"
          className="w-full h-[420px] bg-bone"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="button"
          onClick={save}
          disabled={busy || !dirty}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brass text-ink text-sm font-bold hover:bg-brass/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {busy ? 'Publishing…' : 'Publish'}
        </button>
        <button
          type="button"
          onClick={resetToDefault}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-bone/10 text-sm text-bone/60 hover:text-bone hover:border-bone/30"
        >
          <RotateCcw className="w-3 h-3" />
          Reset editor to default
        </button>
        {item.customized && (
          <button
            type="button"
            onClick={removeOverride}
            disabled={resetting}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-400/30 bg-red-500/[0.06] text-red-200 text-sm font-semibold hover:bg-red-500/[0.12] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {resetting ? 'Removing…' : 'Remove override'}
          </button>
        )}
        {result && (
          <span
            className={`inline-flex items-center gap-1 text-xs ${
              result.ok ? 'text-emerald-200' : 'text-red-200'
            }`}
          >
            {result.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
            {result.message}
          </span>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="text-[11px] uppercase tracking-wider text-bone/50 font-semibold">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
