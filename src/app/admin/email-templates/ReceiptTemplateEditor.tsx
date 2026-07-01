'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Eye,
  RotateCcw,
  Save,
  Send,
  Trash2,
  XCircle
} from 'lucide-react';
import { renderTemplate } from '@/utils/email/render';
import {
  DEFAULT_RECEIPT_SUBJECT,
  DEFAULT_RECEIPT_BODY_HTML,
  DEFAULT_RECEIPT_BODY_TEXT,
} from '@/utils/email/defaults';
import TemplateDiffPanel from './TemplateDiffPanel';

interface Initial {
  subject: string;
  body_html: string;
  body_text: string;
}

interface Props {
  initial: Initial;
  isStored: boolean;
  lastUpdated: string | null;
  updatedBy: string | null;
  defaultTestEmail?: string;
  productId?: string | null;
  productName?: string | null;
}

// Sample token bag used for the in-editor preview. Mirrors the shape
// produced by buildReceiptTokens() on the server so the preview matches
// what real buyers will see.
const PREVIEW_TOKENS: Record<string, string> = {
  brand: 'MotherMode',
  amount: '$27.00',
  currency: 'USD',
  product: 'MotherMode Core',
  name: 'Sarah',
  email: 'sarah@example.com',
  ref: 'pi_3OqXyZ2eZvKYlo2C0abcdef1',
  signoff: 'The MotherMode team'
};

type PreviewTab = 'html' | 'text';

// The themed default receipt now lives in one place so the editor's starting
// point, the live sender fallback, and the preview all stay in sync.
export {
  DEFAULT_RECEIPT_SUBJECT,
  DEFAULT_RECEIPT_BODY_HTML,
  DEFAULT_RECEIPT_BODY_TEXT
} from '@/utils/email/defaults';

export default function ReceiptTemplateEditor({
  initial,
  isStored,
  lastUpdated,
  updatedBy,
  defaultTestEmail = '',
  productId = null,
  productName = null
}: Props) {
  const [subject, setSubject] = useState(initial.subject);
  const [bodyHtml, setBodyHtml] = useState(initial.body_html);
  const [bodyText, setBodyText] = useState(initial.body_text);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    { ok: boolean; message: string } | null
  >(null);
  const [previewTab, setPreviewTab] = useState<PreviewTab>('html');
  const [testEmail, setTestEmail] = useState(defaultTestEmail);
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState<
    { ok: boolean; message: string } | null
  >(null);

  const dirty =
    subject !== initial.subject ||
    bodyHtml !== initial.body_html ||
    bodyText !== initial.body_text;

  const renderedSubject = useMemo(
    () => renderTemplate(subject, PREVIEW_TOKENS),
    [subject]
  );
  const renderedHtml = useMemo(
    () => renderTemplate(bodyHtml, PREVIEW_TOKENS, { escapeHtml: true }),
    [bodyHtml]
  );
  const renderedText = useMemo(
    () => renderTemplate(bodyText, PREVIEW_TOKENS),
    [bodyText]
  );

  const save = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/receipt-template', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subject,
          body_html: bodyHtml,
          body_text: bodyText,
          product_id: productId
        })
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.success) {
        setResult({ ok: true, message: 'Template saved.' });
      } else {
        setResult({
          ok: false,
          message: body.error ?? `Save failed (HTTP ${res.status})`
        });
      }
    } catch (err) {
      setResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Network error'
      });
    } finally {
      setBusy(false);
    }
  };

  const resetToDefaults = () => {
    setSubject(DEFAULT_RECEIPT_SUBJECT);
    setBodyHtml(DEFAULT_RECEIPT_BODY_HTML);
    setBodyText(DEFAULT_RECEIPT_BODY_TEXT);
  };

  const router = useRouter();
  const [resetting, setResetting] = useState(false);
  const resetProductOverride = async () => {
    if (!productId) return;
    const label = productName ?? productId;
    if (
      !window.confirm(
        `Remove the custom receipt template for "${label}"? Future receipts will fall back to the default template.`
      )
    ) {
      return;
    }
    setResetting(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/receipt-template', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ product_id: productId })
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.success) {
        setResult({ ok: true, message: 'Override removed.' });
        router.refresh();
      } else {
        setResult({
          ok: false,
          message: body.error ?? `Delete failed (HTTP ${res.status})`
        });
      }
    } catch (err) {
      setResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Network error'
      });
    } finally {
      setResetting(false);
    }
  };

  const sendTest = async () => {
    const to = testEmail.trim();
    if (!to) return;
    setTestBusy(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/send-test-receipt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: to,
          draft: {
            subject,
            body_html: bodyHtml,
            body_text: bodyText
          }
        })
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.success) {
        setTestResult({
          ok: true,
          message: `Sent to ${body.to} via ${body.provider ?? 'provider'}`
        });
      } else {
        setTestResult({
          ok: false,
          message:
            body.skipped ??
            body.error ??
            (body.status ? `HTTP ${body.status}` : `HTTP ${res.status}`)
        });
      }
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Network error'
      });
    } finally {
      setTestBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-bone/50">
        <span
          className={`px-2 py-0.5 rounded-md border font-semibold uppercase tracking-wider ${
            isStored
              ? 'border-emerald-400/30 bg-emerald-400/[0.05] text-emerald-200'
              : 'border-bone/10 bg-bone/[0.03] text-bone/40'
          }`}
        >
          {isStored ? 'Custom' : 'Defaults'}
        </span>
        <span
          className={`px-2 py-0.5 rounded-md border font-semibold uppercase tracking-wider ${
            productId
              ? 'border-brass/30 bg-brass/[0.06] text-brass'
              : 'border-bone/10 bg-bone/[0.03] text-bone/50'
          }`}
        >
          {productId ? `Product · ${productName ?? productId}` : 'Default scope'}
        </span>
        {lastUpdated && (
          <span>
            Last saved {new Date(lastUpdated).toLocaleString()}
            {updatedBy ? ` by ${updatedBy}` : ''}
          </span>
        )}
      </div>

      <Field label="Subject" htmlFor="rt-subject">
        <input
          id="rt-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full bg-ink/40 border border-bone/10 rounded-lg px-3 py-2 text-sm text-bone focus:border-brass/50 focus:outline-none"
        />
      </Field>

      <Field label="HTML body" htmlFor="rt-html">
        <textarea
          id="rt-html"
          value={bodyHtml}
          onChange={(e) => setBodyHtml(e.target.value)}
          rows={14}
          spellCheck={false}
          className="w-full bg-ink/40 border border-bone/10 rounded-lg px-3 py-2 text-xs font-mono text-bone focus:border-brass/50 focus:outline-none"
        />
      </Field>

      <Field label="Plaintext body" htmlFor="rt-text">
        <textarea
          id="rt-text"
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          rows={8}
          spellCheck={false}
          className="w-full bg-ink/40 border border-bone/10 rounded-lg px-3 py-2 text-xs font-mono text-bone focus:border-brass/50 focus:outline-none"
        />
      </Field>

      <div className="rounded-xl border border-brass/15 bg-ink/30 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-bone/[0.02] border-b border-bone/5">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-bone/50 font-semibold">
            <Eye className="w-3.5 h-3.5" />
            Live preview
            <span className="text-bone/30 normal-case tracking-normal font-normal">
              · sample data
            </span>
          </div>
          <div className="flex gap-1">
            {(['html', 'text'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setPreviewTab(tab)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider ${
                  previewTab === tab
                    ? 'bg-brass/[0.12] text-brass border border-brass/30'
                    : 'text-bone/40 hover:text-bone/70 border border-transparent'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        <div className="px-3 py-2 border-b border-bone/5 text-xs">
          <span className="text-bone/40 mr-2">Subject:</span>
          <span className="text-bone">{renderedSubject}</span>
        </div>
        {previewTab === 'html' ? (
          <iframe
            title="Receipt HTML preview"
            srcDoc={renderedHtml}
            sandbox=""
            className="w-full h-[420px] bg-white"
          />
        ) : (
          <pre className="m-0 p-4 text-xs font-mono text-bone/80 whitespace-pre-wrap break-words bg-ink/40 max-h-[420px] overflow-auto">
            {renderedText}
          </pre>
        )}
      </div>

      <TemplateDiffPanel
        dirty={dirty}
        sections={[
          { label: 'Subject', before: initial.subject, after: subject },
          { label: 'HTML', before: initial.body_html, after: bodyHtml },
          { label: 'Text', before: initial.body_text, after: bodyText }
        ]}
      />

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="button"
          onClick={save}
          disabled={busy || !dirty}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brass text-ink text-sm font-bold hover:bg-brass/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {busy ? 'Saving…' : 'Save template'}
        </button>
        <button
          type="button"
          onClick={resetToDefaults}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-bone/10 text-sm text-bone/60 hover:text-bone hover:border-bone/30"
        >
          <RotateCcw className="w-3 h-3" />
          Reset to defaults
        </button>
        {productId && isStored && (
          <button
            type="button"
            onClick={resetProductOverride}
            disabled={resetting}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-400/30 bg-red-500/[0.06] text-red-200 text-sm font-semibold hover:bg-red-500/[0.12] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {resetting ? 'Removing…' : 'Remove product override'}
          </button>
        )}
        {result && (
          <span
            className={`inline-flex items-center gap-1 text-xs ${
              result.ok ? 'text-emerald-200' : 'text-red-200'
            }`}
          >
            {result.ok ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <XCircle className="w-3.5 h-3.5" />
            )}
            {result.message}
          </span>
        )}
      </div>

      <div className="rounded-xl border border-brass/15 bg-ink/30 p-4 mt-2">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-bone/50 font-semibold mb-2">
          <Send className="w-3.5 h-3.5" />
          Send test to my email
          <span className="text-bone/30 normal-case tracking-normal font-normal">
            · uses the unsaved draft above
          </span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="flex-1 bg-ink/40 border border-bone/10 rounded-lg px-3 py-2 text-sm text-bone focus:border-brass/50 focus:outline-none"
          />
          <button
            type="button"
            onClick={sendTest}
            disabled={testBusy || !testEmail.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-brass/40 bg-brass/[0.08] text-brass text-sm font-bold hover:bg-brass/[0.15] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-3.5 h-3.5" />
            {testBusy ? 'Sending…' : 'Send test'}
          </button>
        </div>
        {testResult && (
          <div
            className={`mt-3 flex items-start gap-2 text-xs rounded-lg px-3 py-2 border ${
              testResult.ok
                ? 'border-emerald-400/30 bg-emerald-400/[0.05] text-emerald-200'
                : 'border-red-400/30 bg-red-400/[0.05] text-red-200'
            }`}
          >
            {testResult.ok ? (
              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            ) : (
              <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            )}
            <span className="break-words">{testResult.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children
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
