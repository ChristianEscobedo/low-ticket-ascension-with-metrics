'use client';

/**
 * Email Marketing Kit — inbox preview modal (Phase 3, testing surface).
 *
 * Renders the selected email through the SAME brand renderer used for export
 * (`renderEmailPreview` → `renderEmailHtml` → `renderEmail`), so what the admin
 * previews here is what an ESP paste produces. Tokens resolve from sample +
 * custom-token defaults + in-modal overrides; any unfilled token stays literal
 * so gaps are obvious.
 *
 * Zero persistence: reads live editor state. The render runs in a sandboxed
 * `<iframe srcDoc>` so the email's inline CSS can't leak into the admin page.
 *
 * The "Send test" control is intentionally a disabled stub — wiring it needs a
 * transactional sender decision (see EMAIL_TESTING_INBOX_PREVIEW_SYSTEM_PORT.md).
 */
import { useEffect, useMemo, useState } from 'react';
import { X, Monitor, Smartphone, ChevronLeft, ChevronRight, Send } from 'lucide-react';
import {
  renderEmailPreview,
  sampleTokenValues,
  PREVIEW_WIDTHS,
  EMAIL_MERGE_TOKENS,
  type EmailSequence,
  type PreviewDevice,
} from '@/lib/mothermode/email';

interface Props {
  open: boolean;
  onClose: () => void;
  sequence: EmailSequence;
  /** Which email to open first; falls back to the first email. */
  initialEmailId: string | null;
  /** Custom-token defaults (from customTokenValues) to seed the token form. */
  tokenValues?: Record<string, string>;
}

/** Human label for a token key: static catalog first, else humanized key. */
const TOKEN_LABELS: Record<string, string> = Object.fromEntries(
  EMAIL_MERGE_TOKENS.map((t) => [t.key, t.label]),
);
function tokenLabel(key: string): string {
  return TOKEN_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function EmailPreviewModal({
  open,
  onClose,
  sequence,
  initialEmailId,
  tokenValues = {},
}: Props) {
  const emails = sequence?.emails ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(initialEmailId);
  const [device, setDevice] = useState<PreviewDevice>('desktop');
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  // Re-seed the selected email whenever the modal is (re)opened for a target.
  useEffect(() => {
    if (open) setSelectedId(initialEmailId ?? emails[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialEmailId]);

  const activeIndex = useMemo(
    () => emails.findIndex((e) => e.id === selectedId),
    [emails, selectedId],
  );
  const activeEmail = activeIndex >= 0 ? emails[activeIndex] : emails[0];

  // sample floor → custom-token defaults → admin overrides (later wins).
  const mergedValues = useMemo(
    () => sampleTokenValues({ ...tokenValues, ...overrides }),
    [tokenValues, overrides],
  );

  const preview = useMemo(
    () => (activeEmail ? renderEmailPreview(activeEmail, mergedValues) : null),
    [activeEmail, mergedValues],
  );

  if (!open) return null;

  const fromName = mergedValues.sender_name || 'Sender';

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/60 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-5xl flex-col bg-ink shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-bone/10 px-5 py-3">
          <h2 className="font-display text-lg text-bone">Inbox preview</h2>
          <span className="text-xs text-bone/40">
            Renders exactly like the export / ESP paste.
          </span>
          <div className="flex-1" />
          {/* Device toggle */}
          <div className="flex items-center gap-1 rounded-lg border border-bone/15 p-0.5">
            <button
              type="button"
              onClick={() => setDevice('desktop')}
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
                device === 'desktop' ? 'bg-brass text-ink' : 'text-bone/60 hover:text-bone'
              }`}
              title="Desktop width"
            >
              <Monitor size={14} /> Desktop
            </button>
            <button
              type="button"
              onClick={() => setDevice('mobile')}
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
                device === 'mobile' ? 'bg-brass text-ink' : 'text-bone/60 hover:text-bone'
              }`}
              title="Mobile width"
            >
              <Smartphone size={14} /> Mobile
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-bone/15 p-1.5 text-bone/60 hover:text-bone"
            aria-label="Close preview"
          >
            <X size={16} />
          </button>
        </div>

        {emails.length === 0 || !activeEmail || !preview ? (
          <div className="flex flex-1 items-center justify-center p-10 text-center text-sm text-bone/40">
            Nothing to preview yet — add an email to the sequence first.
          </div>
        ) : (
          <div className="flex min-h-0 flex-1">
            {/* Left: controls */}
            <aside className="w-72 shrink-0 space-y-4 overflow-y-auto border-r border-bone/10 p-4">
              {/* Email selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-bone/50">
                  Email
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="rounded border border-bone/15 p-1 text-bone/60 hover:text-bone disabled:opacity-30"
                    disabled={activeIndex <= 0}
                    onClick={() => setSelectedId(emails[activeIndex - 1]?.id ?? null)}
                    aria-label="Previous email"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <select
                    className="min-w-0 flex-1 rounded-lg border border-bone/15 bg-ink/40 px-2 py-1.5 text-xs text-bone"
                    value={activeEmail.id}
                    onChange={(e) => setSelectedId(e.target.value)}
                  >
                    {emails.map((em, i) => (
                      <option key={em.id} value={em.id}>
                        Email {i + 1} · {em.subject || '(no subject)'}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="rounded border border-bone/15 p-1 text-bone/60 hover:text-bone disabled:opacity-30"
                    disabled={activeIndex >= emails.length - 1}
                    onClick={() => setSelectedId(emails[activeIndex + 1]?.id ?? null)}
                    aria-label="Next email"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Token value form */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-bone/50">
                  Sample token values
                </label>
                {preview.usedTokens.length === 0 ? (
                  <p className="text-xs text-bone/40">
                    This email uses no merge tokens.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {preview.usedTokens.map((key) => {
                      const unresolved = preview.unresolvedTokens.includes(key);
                      return (
                        <div key={key} className="space-y-0.5">
                          <div className="flex items-center gap-1">
                            <code className="rounded bg-bone/10 px-1 py-0.5 text-[10px] text-brass">
                              {`{{${key}}}`}
                            </code>
                            <span className="text-[11px] text-bone/50">{tokenLabel(key)}</span>
                            {unresolved && (
                              <span className="ml-auto text-[10px] text-amber-400/70">
                                unfilled
                              </span>
                            )}
                          </div>
                          <input
                            className="w-full rounded-lg border border-bone/15 bg-ink/40 px-2 py-1 text-xs text-bone"
                            value={overrides[key] ?? mergedValues[key] ?? ''}
                            onChange={(e) =>
                              setOverrides((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                            placeholder={`Sample ${tokenLabel(key).toLowerCase()}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Send test (stub) */}
              <div className="space-y-1 border-t border-bone/10 pt-3">
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    disabled
                    className="min-w-0 flex-1 cursor-not-allowed rounded-lg border border-bone/10 bg-ink/20 px-2 py-1.5 text-xs text-bone/40"
                    placeholder="you@example.com"
                    title="Wire a transactional sender to enable test sends."
                  />
                  <button
                    type="button"
                    disabled
                    className="flex cursor-not-allowed items-center gap-1 rounded-lg border border-bone/10 px-2 py-1.5 text-xs text-bone/40"
                    title="Wire a transactional sender to enable test sends."
                  >
                    <Send size={13} /> Send test
                  </button>
                </div>
                <p className="text-[10px] text-bone/30">
                  Test sends need a transactional sender (future work).
                </p>
              </div>
            </aside>

            {/* Right: inbox chrome + iframe render */}
            <div className="flex min-w-0 flex-1 flex-col bg-ink/40">
              {/* Inbox chrome */}
              <div className="space-y-1 border-b border-bone/10 px-5 py-3">
                <div className="text-xs text-bone/50">
                  From: <span className="text-bone/80">{fromName}</span>
                </div>
                <div className="truncate text-sm font-semibold text-bone">
                  {preview.subject || '(no subject)'}
                </div>
                {preview.preview && (
                  <div className="truncate text-xs text-bone/40">{preview.preview}</div>
                )}
              </div>
              {/* Render surface */}
              <div className="flex flex-1 justify-center overflow-auto bg-neutral-200 p-4">
                <iframe
                  title="Email preview"
                  srcDoc={preview.html}
                  sandbox=""
                  className="h-full rounded-lg border border-black/10 bg-white shadow"
                  style={{ width: PREVIEW_WIDTHS[device], maxWidth: '100%' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
