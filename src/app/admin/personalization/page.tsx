'use client';

/**
 * /admin/personalization — the 1:1 Personalization control room.
 *
 * Per funnel: pick the mode (off / overlay / gated), steer the AI with
 * guidance, generate + review cached per-lead payloads, mint signed ?pp=
 * links for an ESP, and grab the dynamic per-recipient email image URL.
 */
import { useCallback, useEffect, useState } from 'react';
import { clsx } from 'clsx';
import {
  Sparkles,
  Loader2,
  Check,
  RefreshCw,
  Trash2,
  Link2,
  Image as ImageIcon,
  Copy,
  Eye,
  EyeOff,
  Zap,
  Shield,
  Lock,
} from 'lucide-react';

const API = '/api/admin/mothermode-personalize';

type Mode = 'off' | 'overlay' | 'gated';

interface FunnelRow {
  kind: 'sales' | 'optin';
  id: string;
  slug: string;
  name: string;
  status: string;
  leadCount: number;
  mode: Mode;
  guidance: string;
  baseImageUrl: string;
  emailImageEnabled: boolean;
  settingsUpdatedAt: string | null;
  personalizedCount: number;
}

interface PayloadRow {
  id: string;
  leadKey: string;
  firstName: string | null;
  intentSegment: string;
  model: string;
  source: string;
  generatedAt: string;
  payload: { intentSummary?: string };
}

const MODE_META: Record<Mode, { label: string; hint: string; icon: typeof Zap }> = {
  off: { label: 'Off', hint: 'Funnel behaves as before. Tokens ignored.', icon: EyeOff },
  overlay: {
    label: 'Overlay',
    hint: 'Signed-link visitors get their personalized page; everyone else sees the generic one.',
    icon: Zap,
  },
  gated: {
    label: 'Gated',
    hint: 'Only signed-link visitors see the offer at all. Everyone else gets the decoy page.',
    icon: Lock,
  },
};

export default function PersonalizationAdminPage() {
  const [funnels, setFunnels] = useState<FunnelRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Per-funnel local edit state: mode + guidance + image fields.
  const [edits, setEdits] = useState<Record<string, { mode: Mode; guidance: string; baseImageUrl: string; emailImageEnabled: boolean }>>({});
  const [payloads, setPayloads] = useState<Record<string, PayloadRow[]>>({});
  const [links, setLinks] = useState<Record<string, { email: string; firstName: string; url: string }>>({});
  const [imageLinks, setImageLinks] = useState<Record<string, { template: string; path: string }[]>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch(API);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Load failed');
      setFunnels(json.funnels);
      const seed: typeof edits = {};
      for (const f of json.funnels as FunnelRow[]) {
        seed[f.id] = {
          mode: f.mode,
          guidance: f.guidance,
          baseImageUrl: f.baseImageUrl,
          emailImageEnabled: f.emailImageEnabled,
        };
      }
      setEdits(seed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Action failed');
      return json;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function save(f: FunnelRow) {
    const e = edits[f.id];
    if (!e) return;
    const res = await post({
      action: 'save',
      funnelKind: f.kind,
      funnelId: f.id,
      mode: e.mode,
      guidance: e.guidance,
      baseImageUrl: e.baseImageUrl,
      emailImageEnabled: e.emailImageEnabled,
    });
    if (res) {
      setNote(`Saved ${f.name}: mode = ${e.mode}`);
      await load();
    }
  }

  async function generate(f: FunnelRow, force: boolean) {
    const res = await post({ action: 'generate', funnelKind: f.kind, funnelId: f.id, force });
    if (res) {
      const r = res.result as { attempted: number; generated: number; skipped: number; failed: number };
      setNote(
        `Generation on ${f.name}: ${r.generated} generated, ${r.skipped} skipped, ${r.failed} failed of ${r.attempted}.`,
      );
      await load();
    }
  }

  async function clear(f: FunnelRow) {
    const res = await post({ action: 'clear', funnelKind: f.kind, funnelId: f.id });
    if (res) {
      setNote(`Cleared cached payloads on ${f.name}.`);
      await load();
    }
  }

  async function viewPayloads(f: FunnelRow) {
    const res = await post({ action: 'payloads', funnelKind: f.kind, funnelId: f.id });
    if (res) {
      setPayloads((p) => ({ ...p, [f.id]: (res.payloads as PayloadRow[]) || [] }));
    }
  }

  async function mintLink(f: FunnelRow) {
    const l = links[f.id];
    if (!l?.email) {
      setError('Enter an email to mint a link for.');
      return;
    }
    const res = await post({
      action: 'link',
      funnelKind: f.kind,
      funnelId: f.id,
      email: l.email,
      firstName: l.firstName,
    });
    if (res) {
      setLinks((p) => ({ ...p, [f.id]: { ...l, url: String(res.url || '') } }));
    }
  }

  async function mintImageLinks(f: FunnelRow) {
    const res = await post({ action: 'image-link', funnelKind: f.kind, funnelId: f.id });
    if (res) {
      setImageLinks((p) => ({
        ...p,
        [f.id]: (res.images as { template: string; path: string }[]) || [],
      }));
    }
  }

  function copy(text: string) {
    void navigator.clipboard?.writeText(text).catch(() => {});
    setNote('Copied to clipboard.');
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5 flex items-center gap-3">
        <Sparkles className="h-6 w-6 text-brass" />
        <div>
          <h1 className="font-display text-2xl font-semibold text-bone">1:1 Personalization</h1>
          <p className="text-sm text-bone/45">
            One funnel, a different page for every lead — AI copy merged server-side from a signed
            email link. Gated mode hides the offer from everyone without a key.
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={busy}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-bone/15 px-3 py-1.5 text-sm text-bone/60 hover:bg-bone/10 disabled:opacity-50"
        >
          <RefreshCw className={clsx('h-4 w-4', busy && 'animate-spin')} /> Refresh
        </button>
      </div>

      {note && (
        <p className="mb-3 rounded-lg border border-brass/30 bg-brass/10 px-3 py-2 text-sm text-brass/90">
          {note}
        </p>
      )}
      {error && (
        <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/100/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {/* ESP how-to */}
      <div className="mb-5 rounded-xl border border-bone/10 bg-bone/[0.03] p-4 text-xs leading-relaxed text-bone/55">
        <p className="mb-1 flex items-center gap-1.5 font-semibold text-bone/75">
          <Shield className="h-3.5 w-3.5 text-brass" /> How the loop works
        </p>
        <ol className="ml-4 list-decimal space-y-0.5">
          <li>Set a funnel to <b>overlay</b> (or <b>gated</b>) and save.</li>
          <li>Generate payloads for existing leads — new opt-ins generate automatically at capture.</li>
          <li>Mint a signed link per lead below, or export tokens in bulk as an ESP custom field
              (<code className="text-brass/80">{'{{contact.pp_token}}'}</code>) on your CTA URL.</li>
          <li>The page renders their copy server-side: headline, benefits, CTA, problem scene,
              checkout copy — price and Stripe fields can never change.</li>
          <li>Optional: embed the dynamic email image so every opener sees their own name in the creative.</li>
        </ol>
      </div>

      {funnels === null ? (
        <Loader2 className="h-5 w-5 animate-spin text-bone/40" />
      ) : funnels.length === 0 ? (
        <p className="rounded-lg border border-bone/10 px-3 py-3 text-xs text-bone/40">
          No funnels yet — create a sales or optin funnel first.
        </p>
      ) : (
        <div className="space-y-4">
          {funnels.map((f) => {
            const e = edits[f.id] || { mode: f.mode, guidance: '', baseImageUrl: '', emailImageEnabled: false };
            const l = links[f.id] || { email: '', firstName: '', url: '' };
            const pl = payloads[f.id];
            const il = imageLinks[f.id];
            return (
              <div key={f.id} className="rounded-xl border border-bone/10 bg-bone/[0.03] p-4">
                {/* header row */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-bone/90">{f.name || f.slug}</span>
                  <span className="rounded-full border border-bone/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-bone/45">
                    {f.kind}
                  </span>
                  <span className="rounded-full border border-bone/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-bone/45">
                    {f.status}
                  </span>
                  <span className="text-[10px] text-bone/35">
                    {f.leadCount} leads · {f.personalizedCount} personalized
                  </span>
                  <a
                    href={(f.kind === 'sales' ? '/funnel/' : '/optin/') + f.slug}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto inline-flex items-center gap-1 text-[11px] text-bone/40 hover:text-bone"
                  >
                    <Eye className="h-3 w-3" /> view page
                  </a>
                </div>

                {/* mode picker */}
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {(Object.keys(MODE_META) as Mode[]).map((m) => {
                    const Meta = MODE_META[m];
                    const Icon = Meta.icon;
                    const active = e.mode === m;
                    return (
                      <button
                        key={m}
                        onClick={() => setEdits((p) => ({ ...p, [f.id]: { ...e, mode: m } }))}
                        className={clsx(
                          'rounded-lg border px-3 py-2 text-left transition-colors',
                          active
                            ? 'border-brass/50 bg-brass/10'
                            : 'border-bone/10 bg-ink/40 hover:border-bone/25',
                        )}
                      >
                        <span className={clsx('flex items-center gap-1.5 text-xs font-semibold', active ? 'text-brass' : 'text-bone/70')}>
                          <Icon className="h-3.5 w-3.5" /> {Meta.label}
                        </span>
                        <span className="mt-0.5 block text-[10px] leading-snug text-bone/40">
                          {Meta.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* guidance */}
                <textarea
                  value={e.guidance}
                  onChange={(ev) => setEdits((p) => ({ ...p, [f.id]: { ...e, guidance: ev.target.value } }))}
                  placeholder="AI guidance (optional) — e.g. 'These leads came from a TikTok about chaotic mornings. Keep the tone warm, not salesy. Emphasize the 10-minute setup.'"
                  rows={2}
                  className="mt-3 w-full resize-y rounded-lg border border-bone/15 bg-ink px-2 py-1.5 text-xs text-bone/80 outline-none placeholder:text-bone/25 focus:border-brass/40"
                />

                {/* actions */}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                  <button
                    onClick={() => void save(f)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brass px-3 py-1.5 font-semibold text-ink hover:bg-brass/90 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Save settings
                  </button>
                  <button
                    onClick={() => void generate(f, false)}
                    disabled={busy || e.mode === 'off'}
                    className="inline-flex items-center gap-1 rounded-lg border border-bone/15 px-2.5 py-1.5 text-bone/60 hover:bg-bone/10 disabled:opacity-40"
                    title="Generate payloads for leads that don't have one yet"
                  >
                    <Sparkles className="h-3 w-3" /> generate missing
                  </button>
                  <button
                    onClick={() => void generate(f, true)}
                    disabled={busy || e.mode === 'off'}
                    className="inline-flex items-center gap-1 rounded-lg border border-bone/15 px-2.5 py-1.5 text-bone/60 hover:bg-bone/10 disabled:opacity-40"
                    title="Regenerate ALL leads, overwriting existing AI payloads (admin edits are locked unless cleared)"
                  >
                    <RefreshCw className="h-3 w-3" /> regenerate all
                  </button>
                  <button
                    onClick={() => void viewPayloads(f)}
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded-lg border border-bone/15 px-2.5 py-1.5 text-bone/60 hover:bg-bone/10 disabled:opacity-40"
                  >
                    <Eye className="h-3 w-3" /> review payloads
                  </button>
                  <button
                    onClick={() => void clear(f)}
                    disabled={busy}
                    className="ml-auto inline-flex items-center gap-1 rounded-lg border border-red-500/25 px-2.5 py-1.5 text-red-300/70 hover:bg-red-500/100/10 disabled:opacity-40"
                  >
                    <Trash2 className="h-3 w-3" /> clear payloads
                  </button>
                </div>

                {/* link minter */}
                <div className="mt-3 rounded-lg border border-bone/10 bg-ink/40 p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-bone/40">
                    <Link2 className="h-3 w-3" /> Signed link for one lead
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={l.email}
                      onChange={(ev) => setLinks((p) => ({ ...p, [f.id]: { ...l, email: ev.target.value } }))}
                      placeholder="lead@email.com"
                      className="min-w-0 flex-1 rounded border border-bone/15 bg-ink px-1.5 py-1 text-[11px] text-bone/80 outline-none placeholder:text-bone/25"
                    />
                    <input
                      value={l.firstName}
                      onChange={(ev) => setLinks((p) => ({ ...p, [f.id]: { ...l, firstName: ev.target.value } }))}
                      placeholder="First name (optional)"
                      className="w-36 rounded border border-bone/15 bg-ink px-1.5 py-1 text-[11px] text-bone/80 outline-none placeholder:text-bone/25"
                    />
                    <button
                      onClick={() => void mintLink(f)}
                      disabled={busy || e.mode === 'off'}
                      className="rounded bg-brass px-2.5 py-1 text-[10px] font-semibold text-ink disabled:opacity-40"
                    >
                      mint link
                    </button>
                  </div>
                  {l.url && (
                    <div className="mt-2 flex items-center gap-2">
                      <code className="min-w-0 flex-1 truncate rounded bg-ink/60 px-1.5 py-1 font-mono text-[10px] text-brass/80">
                        {l.url}
                      </code>
                      <button onClick={() => copy(l.url)} className="text-bone/40 hover:text-bone" title="Copy">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* email image */}
                <div className="mt-3 rounded-lg border border-bone/10 bg-ink/40 p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-bone/40">
                    <ImageIcon className="h-3 w-3" /> Per-recipient email image
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <label className="inline-flex items-center gap-1.5 text-bone/60">
                      <input
                        type="checkbox"
                        checked={e.emailImageEnabled}
                        onChange={(ev) =>
                          setEdits((p) => ({ ...p, [f.id]: { ...e, emailImageEnabled: ev.target.checked } }))
                        }
                      />
                      enable endpoint
                    </label>
                    <input
                      value={e.baseImageUrl}
                      onChange={(ev) =>
                        setEdits((p) => ({ ...p, [f.id]: { ...e, baseImageUrl: ev.target.value } }))
                      }
                      placeholder="Optional branded background image URL"
                      className="min-w-0 flex-1 rounded border border-bone/15 bg-ink px-1.5 py-1 text-[11px] text-bone/80 outline-none placeholder:text-bone/25"
                    />
                    <button
                      onClick={() => void mintImageLinks(f)}
                      disabled={busy}
                      className="rounded border border-bone/15 px-2 py-1 text-[10px] text-bone/60 hover:bg-bone/10 disabled:opacity-40"
                    >
                      get ESP image URLs
                    </button>
                  </div>
                  {il && (
                    <div className="mt-2 space-y-1.5">
                      {il.map((img) => (
                        <div key={img.template} className="flex items-center gap-2">
                          <span className="w-20 shrink-0 text-[10px] text-bone/40">{img.template}</span>
                          <code className="min-w-0 flex-1 truncate rounded bg-ink/60 px-1.5 py-1 font-mono text-[10px] text-brass/80">
                            {img.path}
                          </code>
                          <button onClick={() => copy(img.path)} className="text-bone/40 hover:text-bone" title="Copy">
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      <p className="text-[10px] text-bone/30">
                        Use as an {'<img>'} src in your ESP — it fills the recipient name at open
                        time. Remember to save settings after enabling.
                      </p>
                    </div>
                  )}
                </div>

                {/* payloads review */}
                {pl && (
                  <div className="mt-3 rounded-lg border border-bone/10 bg-ink/40 p-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-bone/40">
                      Cached payloads ({pl.length})
                    </p>
                    {pl.length === 0 ? (
                      <p className="text-[11px] text-bone/35">
                        None yet — generate, or wait for the next opt-in.
                      </p>
                    ) : (
                      <div className="max-h-56 space-y-1.5 overflow-auto">
                        {pl.map((row) => (
                          <div key={row.id} className="rounded border border-bone/10 bg-ink/60 px-2 py-1.5">
                            <div className="flex items-center gap-2 text-[11px]">
                              <span className="font-medium text-bone/75">{row.leadKey}</span>
                              {row.intentSegment && (
                                <span className="rounded-full border border-brass/30 px-1.5 py-0.5 text-[9px] text-brass/80">
                                  {row.intentSegment}
                                </span>
                              )}
                              <span className="ml-auto text-[9px] text-bone/30">
                                {row.model || 'model?'} · {row.source} · {new Date(row.generatedAt).toLocaleDateString()}
                              </span>
                            </div>
                            {row.payload?.intentSummary && (
                              <p className="mt-0.5 text-[10px] leading-snug text-bone/45">
                                {row.payload.intentSummary}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
