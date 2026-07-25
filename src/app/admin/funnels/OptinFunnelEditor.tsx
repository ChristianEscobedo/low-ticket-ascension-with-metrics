'use client';

/**
 * MotherMode Optin Funnel editor (client).
 *
 * List funnels → create/edit identity + three content blocks (optin / oto /
 * thank-you) → save/publish. Leads table at the bottom. AI self-build is Phase 1b.
 */
import { useMemo, useState } from 'react';
import {
  defaultMotherModeFooter,
  defaultMotherModeOptin,
  defaultMotherModeOto,
  defaultMotherModeThankYou,
} from '@/lib/mothermode/optin/defaults';
import {
  OPTIN_FUNNEL_STATUSES,
  optinConversionRate,
  otoTakeRate,
  slugifyOptinName,
  type OptinFooterContent,
  type OptinFunnelRecord,
  type OptinFunnelStatus,
  type OptinLeadRecord,
  type OptinOtoContent,
  type OptinPageContent,
  type OptinThankYouContent,
} from '@/lib/mothermode/optin/types';


import {
  blankOptinAiIntake,
  type OptinAiIntake,
} from '@/lib/mothermode/optin/aiIntake';
import type { LeadGenKitRecord } from '@/lib/mothermode/leadgen/types';
import OptinPage from '@/components/mothermode/optin/OptinPage';
import OptinOtoPage from '@/components/mothermode/optin/OptinOtoPage';
import OptinThankYouPage from '@/components/mothermode/optin/OptinThankYouPage';



const CRUD_URL = '/api/admin/mothermode-optin';
const AI_URL = '/api/mothermode/optin-ai';


interface EmailKitOption {
  id: string;
  slug: string;
  name: string;
  status: string;
}

interface Props {
  initialFunnels: OptinFunnelRecord[];
  initialLeads: OptinLeadRecord[];
  leadGenKits?: LeadGenKitRecord[];
  emailKits?: EmailKitOption[];
}

type Busy = null | 'save' | 'delete' | 'loadDefaults' | 'generate' | 'duplicate';

type Tab = 'build' | 'optin' | 'oto' | 'thankyou' | 'footer' | 'links' | 'preview' | 'leads';



const inputClass =
  'w-full rounded-lg bg-ink/40 border border-bone/15 px-3 py-2 text-sm text-bone placeholder-bone/30 focus:outline-none focus:border-brass/40';
const labelClass = 'block text-xs uppercase tracking-wide text-bone/50 mb-1';
const btn =
  'rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
const btnPrimary = `${btn} bg-brass/[0.14] text-brass border border-brass/30 hover:bg-brass/20`;
const btnGhost = `${btn} text-bone/60 border border-bone/15 hover:text-bone hover:bg-bone/[0.05]`;
const btnDanger = `${btn} text-red-300/80 border border-red-400/20 hover:bg-red-500/10`;

function linesToList(text: string): string[] {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function listToLines(list: string[]): string {
  return list.join('\n');
}

export default function OptinFunnelEditor({
  initialFunnels,
  initialLeads,
  leadGenKits = [],
  emailKits = [],
}: Props) {
  const [funnels, setFunnels] = useState<OptinFunnelRecord[]>(initialFunnels);
  const [leads] = useState<OptinLeadRecord[]>(initialLeads);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('optin');

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState<OptinFunnelStatus>('draft');
  const [offerSlug, setOfferSlug] = useState('');
  const [leadGenSlug, setLeadGenSlug] = useState('');
  const [deliverableSlug, setDeliverableSlug] = useState('');
  const [deliverableKey, setDeliverableKey] = useState('');
  const [emailKitId, setEmailKitId] = useState('');
  const [viewCount, setViewCount] = useState(0);
  const [conversionCount, setConversionCount] = useState(0);
  const [otoYesCount, setOtoYesCount] = useState(0);
  const [otoNoCount, setOtoNoCount] = useState(0);

  const [optin, setOptin] = useState<OptinPageContent>(defaultMotherModeOptin());
  const [oto, setOto] = useState<OptinOtoContent>(defaultMotherModeOto());
  const [thankyou, setThankyou] = useState<OptinThankYouContent>(
    defaultMotherModeThankYou(),
  );
  const [footer, setFooter] = useState<OptinFooterContent>(defaultMotherModeFooter());
  const [intake, setIntake] = useState<OptinAiIntake>(blankOptinAiIntake());


  const [busy, setBusy] = useState<Busy>(null);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);

  const publicUrl = useMemo(
    () => (slug ? `/optin/${slugifyOptinName(slug)}` : ''),
    [slug],
  );

  function resetToNew() {
    setSelectedId(null);
    setName('');
    setSlug('');
    setStatus('draft');
    setOfferSlug('');
    setLeadGenSlug('');
    setDeliverableSlug('');
    setDeliverableKey('');
    setEmailKitId('');
    setViewCount(0);
    setConversionCount(0);
    setOtoYesCount(0);
    setOtoNoCount(0);
    setOptin(defaultMotherModeOptin());

    setOto(defaultMotherModeOto());
    setThankyou(defaultMotherModeThankYou());
    setFooter(defaultMotherModeFooter());
    setIntake(blankOptinAiIntake());
    setSlugTouched(false);
    setError(null);
    setNotice(null);
    setTab('build');
  }



  function loadFunnel(f: OptinFunnelRecord) {
    setSelectedId(f.id);
    setName(f.name);
    setSlug(f.slug);
    setStatus(f.status);
    setOfferSlug(f.offerSlug ?? '');
    setLeadGenSlug(f.leadGenSlug ?? '');
    setDeliverableSlug(f.deliverableSlug ?? '');
    setDeliverableKey(f.deliverableKey ?? '');
    setEmailKitId(f.emailKitId ?? '');
    setViewCount(f.viewCount);
    setConversionCount(f.conversionCount);
    setOtoYesCount(f.otoYesCount);
    setOtoNoCount(f.otoNoCount);
    setOptin(f.optin);

    setOto(f.oto);
    setThankyou(f.thankyou);
    setFooter(f.footer);
    setSlugTouched(true);

    setError(null);
    setNotice(null);
    setTab('optin');
  }

  function setOptinField<K extends keyof OptinPageContent>(key: K, value: OptinPageContent[K]) {
    setOptin((prev) => ({ ...prev, [key]: value }));
  }
  function setOtoField<K extends keyof OptinOtoContent>(key: K, value: OptinOtoContent[K]) {
    setOto((prev) => ({ ...prev, [key]: value }));
  }
  function setThankField<K extends keyof OptinThankYouContent>(
    key: K,
    value: OptinThankYouContent[K],
  ) {
    setThankyou((prev) => ({ ...prev, [key]: value }));
  }

  async function onSave() {
    setBusy('save');
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(CRUD_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          id: selectedId,
          name,
          slug,
          status,
          offerSlug,
          leadGenSlug,
          deliverableSlug,
          deliverableKey,
          emailKitId: emailKitId || null,
          optin,
          oto,
          thankyou,
          footer,
        }),


      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `Save failed (HTTP ${res.status})`);
      }
      const item = data.item as OptinFunnelRecord;
      setFunnels((prev) => {
        const rest = prev.filter((f) => f.id !== item.id);
        return [item, ...rest];
      });
      setSelectedId(item.id);
      setSlug(item.slug);
      setEmailKitId(item.emailKitId ?? '');
      setViewCount(item.viewCount);
      setConversionCount(item.conversionCount);
      setOtoYesCount(item.otoYesCount);
      setOtoNoCount(item.otoNoCount);
      setNotice(status === 'published' ? 'Saved and published.' : 'Saved as draft.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(null);
    }
  }

  async function onDuplicate() {
    if (!selectedId) return;
    setBusy('duplicate');
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(CRUD_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate', id: selectedId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Duplicate failed');
      }
      const item = data.item as OptinFunnelRecord;
      setFunnels((prev) => [item, ...prev]);
      loadFunnel(item);
      setNotice('Duplicated as draft. Edit slug/name and save.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Duplicate failed');
    } finally {
      setBusy(null);
    }
  }

  function exportLeadsCsv() {
    const rows = selectedId ? leads.filter((l) => l.funnelId === selectedId) : leads;
    const header = ['email', 'first_name', 'funnel', 'status', 'utm_source', 'utm_medium', 'utm_campaign', 'created_at'];
    const lines = [header.join(',')];
    for (const l of rows) {
      const cells = [
        l.email,
        l.firstName || '',
        l.funnelSlug || l.funnelName || '',
        l.status,
        l.utmSource || '',
        l.utmMedium || '',
        l.utmCampaign || '',
        l.createdAt,
      ].map((c) => `"${String(c).replace(/"/g, '""')}"`);
      lines.push(cells.join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `optin-leads-${slug || 'all'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const checklist = useMemo(() => {
    const items: { ok: boolean; label: string }[] = [
      { ok: Boolean(slug.trim()), label: 'Slug set' },
      { ok: Boolean(optin.headline.trim()), label: 'Optin headline' },
      { ok: Boolean(optin.ctaText.trim()), label: 'Optin CTA' },
      { ok: Boolean(thankyou.ctaHref.trim() || offerSlug.trim()), label: 'Thank-you / offer link' },
      { ok: Boolean(footer.disclaimer.trim()), label: 'Footer disclaimer' },
      { ok: Boolean(emailKitId), label: 'Email kit linked (optional but recommended)' },
    ];
    return items;
  }, [slug, optin.headline, optin.ctaText, thankyou.ctaHref, offerSlug, footer.disclaimer, emailKitId]);

  const optinRate = optinConversionRate(viewCount, conversionCount);
  const otoRate = otoTakeRate(otoYesCount, otoNoCount);

  async function onDelete() {

    if (!selectedId) return;
    if (!confirm('Delete this funnel and its leads?')) return;
    setBusy('delete');
    setError(null);
    try {
      const res = await fetch(`${CRUD_URL}?id=${encodeURIComponent(selectedId)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Delete failed');
      }
      setFunnels((prev) => prev.filter((f) => f.id !== selectedId));
      resetToNew();
      setNotice('Deleted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(null);
    }
  }

  function loadDefaults() {
    setBusy('loadDefaults');
    setOptin(defaultMotherModeOptin());
    setOto(defaultMotherModeOto());
    setThankyou(defaultMotherModeThankYou());
    setFooter(defaultMotherModeFooter());
    if (!name) setName('Brain Dump Starter Optin');

    if (!slug) {
      setSlug('brain-dump-starter');
      setSlugTouched(true);
    }
    if (!offerSlug) setOfferSlug('brain-dump');
    setNotice('Loaded MotherMode default copy. Edit and save.');
    setBusy(null);
  }

  async function onGenerate() {
    setBusy('generate');
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(AI_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'generate', intake }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `Generate failed (HTTP ${res.status})`);
      }
      if (data.optin) setOptin(data.optin as OptinPageContent);
      if (data.oto) setOto(data.oto as OptinOtoContent);
      if (data.thankyou) setThankyou(data.thankyou as OptinThankYouContent);
      if (typeof data.name === 'string' && data.name.trim()) {
        setName(data.name.trim());
        if (!slugTouched && typeof data.slugHint === 'string') {
          setSlug(slugifyOptinName(data.slugHint || data.name));
        }
      } else if (!slugTouched && typeof data.slugHint === 'string' && data.slugHint) {
        setSlug(slugifyOptinName(data.slugHint));
      }
      if (intake.offerName && !offerSlug) {
        setOfferSlug(slugifyOptinName(intake.offerName));
      }
      setTab('optin');
      setNotice('AI filled optin, OTO, and thank-you. Review, then save.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generate failed');
    } finally {
      setBusy(null);
    }
  }

  function setIntakeField<K extends keyof OptinAiIntake>(key: K, value: OptinAiIntake[K]) {
    setIntake((prev) => ({ ...prev, [key]: value }));
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'build', label: 'AI build' },
    { id: 'optin', label: 'Optin page' },
    { id: 'oto', label: 'OTO' },
    { id: 'thankyou', label: 'Thank you' },
    { id: 'footer', label: 'Footer' },
    { id: 'links', label: 'Links' },
    { id: 'preview', label: 'Preview' },
    { id: 'leads', label: `Leads (${leads.length})` },
  ];




  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      {/* List */}
      <aside className="space-y-3">
        <button type="button" onClick={resetToNew} className={btnPrimary + ' w-full'}>
          + New funnel
        </button>
        <div className="rounded-xl border border-bone/10 bg-ink/30 divide-y divide-bone/10 max-h-[70vh] overflow-y-auto">
          {funnels.length === 0 && (
            <div className="p-4 text-sm text-bone/45">No funnels yet. Create one.</div>
          )}
          {funnels.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => loadFunnel(f)}
              className={`w-full text-left px-3 py-3 transition-colors ${
                selectedId === f.id ? 'bg-brass/[0.12]' : 'hover:bg-bone/[0.04]'
              }`}
            >
              <div className="text-sm font-semibold text-bone truncate">{f.name || f.slug}</div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-bone/45">
                <span
                  className={
                    f.status === 'published'
                      ? 'text-emerald-400/90'
                      : f.status === 'archived'
                        ? 'text-bone/35'
                        : 'text-brass/80'
                  }
                >
                  {f.status}
                </span>
                <span>·</span>
                <span>{f.conversionCount} leads</span>
              </div>
              <div className="mt-0.5 text-[11px] text-bone/35 truncate">/optin/{f.slug}</div>
            </button>
          ))}
        </div>
      </aside>

      {/* Editor */}
      <div className="space-y-5">
        {/* Identity */}
        <section className="rounded-xl border border-bone/10 bg-ink/30 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs uppercase tracking-[0.2em] text-brass/80 font-semibold">
              {selectedId ? 'Edit funnel' : 'New funnel'}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={loadDefaults}
                disabled={busy !== null}
                className={btnGhost}
              >
                Load MotherMode defaults
              </button>
              {selectedId && (
                <button
                  type="button"
                  onClick={onDuplicate}
                  disabled={busy !== null}
                  className={btnGhost}
                >
                  {busy === 'duplicate' ? 'Duplicating…' : 'Duplicate'}
                </button>
              )}
              {publicUrl && (

                <>
                  <a href={publicUrl} target="_blank" rel="noreferrer" className={btnGhost}>
                    Preview optin
                  </a>
                  <a href={`${publicUrl}/oto`} target="_blank" rel="noreferrer" className={btnGhost}>
                    Preview OTO
                  </a>
                  <a href={`${publicUrl}/thank-you`} target="_blank" rel="noreferrer" className={btnGhost}>
                    Preview thank-you
                  </a>
                </>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Name</label>
              <input
                className={inputClass}
                value={name}
                onChange={(e) => {
                  const v = e.target.value;
                  setName(v);
                  if (!slugTouched) setSlug(slugifyOptinName(v));
                }}
                placeholder="Brain Dump Starter Optin"
              />
            </div>
            <div>
              <label className={labelClass}>Slug (URL)</label>
              <input
                className={inputClass}
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                placeholder="brain-dump-starter"
              />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select
                className={inputClass}
                value={status}
                onChange={(e) => setStatus(e.target.value as OptinFunnelStatus)}
              >
                {OPTIN_FUNNEL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Email kit on optin</label>
              <select
                className={inputClass}
                value={emailKitId}
                onChange={(e) => setEmailKitId(e.target.value)}
              >
                <option value="">None — no auto-enroll</option>
                {emailKits.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name} ({k.status})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedId && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatChip label="Views" value={String(viewCount)} />
              <StatChip label="Optins" value={String(conversionCount)} />
              <StatChip label="Optin rate" value={`${(optinRate * 100).toFixed(1)}%`} />
              <StatChip label="OTO take" value={`${(otoRate * 100).toFixed(1)}%`} />
            </div>
          )}

          <div className="rounded-lg border border-bone/10 bg-ink/40 px-3 py-2">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-bone/45">
              Publish checklist
            </div>
            <ul className="grid gap-1 sm:grid-cols-2">
              {checklist.map((c) => (
                <li
                  key={c.label}
                  className={`text-xs ${c.ok ? 'text-emerald-400/90' : 'text-bone/40'}`}
                >
                  {c.ok ? '✓' : '○'} {c.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">

            <button
              type="button"
              onClick={onSave}
              disabled={busy !== null || !slug.trim()}
              className={btnPrimary}
            >
              {busy === 'save' ? 'Saving…' : status === 'published' ? 'Save & publish' : 'Save draft'}
            </button>
            {selectedId && (
              <button
                type="button"
                onClick={onDelete}
                disabled={busy !== null}
                className={btnDanger}
              >
                {busy === 'delete' ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}
          {notice && (
            <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {notice}
            </div>
          )}
        </section>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 border-b border-bone/10 pb-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                tab === t.id
                  ? 'bg-brass/[0.14] text-brass font-semibold border border-brass/30'
                  : 'text-bone/55 hover:text-bone border border-transparent'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'build' && (
          <section className="rounded-xl border border-bone/10 bg-ink/30 p-4 sm:p-5 space-y-4">
            <div>
              <div className="text-sm font-semibold text-bone">Self-building optin</div>
              <p className="mt-1 text-sm text-bone/55 max-w-2xl">
                Fill a short brief. AI writes the full optin page, OTO, and thank-you
                in MotherMode voice. You can edit every field after.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Niche / topic"
                value={intake.niche}
                onChange={(v) => setIntakeField('niche', v)}
                placeholder="Mental load for working mothers"
              />
              <Field
                label="Audience"
                value={intake.audience}
                onChange={(v) => setIntakeField('audience', v)}
                placeholder="Mothers who feel like the family OS runs on them"
              />
              <Field
                label="Free magnet name"
                value={intake.magnetName}
                onChange={(v) => setIntakeField('magnetName', v)}
                placeholder="The Brain Dump Starter"
              />
              <Field
                label="Magnet promise"
                value={intake.magnetPromise}
                onChange={(v) => setIntakeField('magnetPromise', v)}
                placeholder="Unload your head in 20 minutes and see what can come off your plate"
              />
              <Field
                label="Paid offer name (OTO)"
                value={intake.offerName}
                onChange={(v) => setIntakeField('offerName', v)}
                placeholder="The Brain Dump System"
              />
              <Field
                label="Paid offer price"
                value={intake.offerPrice}
                onChange={(v) => setIntakeField('offerPrice', v)}
                placeholder="$27"
              />
            </div>
            <Area
              label="Tone notes (optional)"
              value={intake.toneNotes}
              onChange={(v) => setIntakeField('toneNotes', v)}
              rows={2}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onGenerate}
                disabled={busy !== null}
                className={btnPrimary}
              >
                {busy === 'generate' ? 'Generating…' : 'AI: generate full funnel'}
              </button>
              <button
                type="button"
                onClick={loadDefaults}
                disabled={busy !== null}
                className={btnGhost}
              >
                Or load static defaults
              </button>
            </div>
          </section>
        )}

        {tab === 'optin' && (
          <section className="rounded-xl border border-bone/10 bg-ink/30 p-4 sm:p-5 space-y-4">
            <Field label="Eyebrow" value={optin.eyebrow} onChange={(v) => setOptinField('eyebrow', v)} />

            <Field label="Badge" value={optin.badgeText} onChange={(v) => setOptinField('badgeText', v)} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Headline" value={optin.headline} onChange={(v) => setOptinField('headline', v)} />
              <Field
                label="Emphasis (italic)"
                value={optin.headlineEmphasis}
                onChange={(v) => setOptinField('headlineEmphasis', v)}
              />
              <Field
                label="Headline suffix"
                value={optin.headlineSuffix}
                onChange={(v) => setOptinField('headlineSuffix', v)}
              />
            </div>
            <Area
              label="Subheadline"
              value={optin.subheadline}
              onChange={(v) => setOptinField('subheadline', v)}
            />
            <Area
              label="Audience line"
              value={optin.audience}
              onChange={(v) => setOptinField('audience', v)}
            />
            <Area
              label="Benefits (one per line)"
              value={listToLines(optin.benefits)}
              onChange={(v) => setOptinField('benefits', linesToList(v))}
              rows={5}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Magnet title"
                value={optin.magnetTitle}
                onChange={(v) => setOptinField('magnetTitle', v)}
              />
              <Field
                label="CTA button"
                value={optin.ctaText}
                onChange={(v) => setOptinField('ctaText', v)}
              />
            </div>
            <Area
              label="Magnet description"
              value={optin.magnetDescription}
              onChange={(v) => setOptinField('magnetDescription', v)}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Cover image URL"
                value={optin.coverImageUrl}
                onChange={(v) => setOptinField('coverImageUrl', v)}
                placeholder="https://…/cover.jpg"
              />
              <Field
                label="Hero video URL (YouTube or MP4)"
                value={optin.heroVideoUrl}
                onChange={(v) => setOptinField('heroVideoUrl', v)}
                placeholder="https://youtube.com/watch?v=… or .mp4"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Email placeholder"
                value={optin.emailPlaceholder}
                onChange={(v) => setOptinField('emailPlaceholder', v)}
              />
              <Field
                label="Name placeholder"
                value={optin.namePlaceholder}
                onChange={(v) => setOptinField('namePlaceholder', v)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-bone/70">
              <input
                type="checkbox"
                checked={optin.collectName}
                onChange={(e) => setOptinField('collectName', e.target.checked)}
              />
              Collect first name
            </label>
            <Field
              label="Privacy note"
              value={optin.privacyNote}
              onChange={(v) => setOptinField('privacyNote', v)}
            />
          </section>
        )}

        {tab === 'oto' && (
          <section className="rounded-xl border border-bone/10 bg-ink/30 p-4 sm:p-5 space-y-4">
            <label className="flex items-center gap-2 text-sm text-bone/70">
              <input
                type="checkbox"
                checked={oto.enabled}
                onChange={(e) => setOtoField('enabled', e.target.checked)}
              />
              Enable OTO step (if off, capture goes straight to thank-you)
            </label>
            <Field label="Eyebrow" value={oto.eyebrow} onChange={(v) => setOtoField('eyebrow', v)} />
            <Field label="Headline" value={oto.headline} onChange={(v) => setOtoField('headline', v)} />
            <Area
              label="Subheadline"
              value={oto.subheadline}
              onChange={(v) => setOtoField('subheadline', v)}
            />
            <Area
              label="Bullets (one per line)"
              value={listToLines(oto.bullets)}
              onChange={(v) => setOtoField('bullets', linesToList(v))}
              rows={5}
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field
                label="Price label"
                value={oto.priceLabel}
                onChange={(v) => setOtoField('priceLabel', v)}
                placeholder="$27"
              />
              <Field
                label="Original price"
                value={oto.originalPriceLabel}
                onChange={(v) => setOtoField('originalPriceLabel', v)}
                placeholder="$47"
              />
              <div>
                <label className={labelClass}>Timer (minutes)</label>
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={oto.timerMinutes}
                  onChange={(e) => setOtoField('timerMinutes', Number(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Yes CTA" value={oto.ctaYes} onChange={(v) => setOtoField('ctaYes', v)} />
              <Field label="No CTA" value={oto.ctaNo} onChange={(v) => setOtoField('ctaNo', v)} />
            </div>
            <Field
              label="Yes link (path or URL)"
              value={oto.yesHref}
              onChange={(v) => setOtoField('yesHref', v)}
              placeholder="/mothermode/brain-dump"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Product image URL"
                value={oto.imageUrl}
                onChange={(v) => setOtoField('imageUrl', v)}
                placeholder="https://…/product.jpg"
              />
              <Field
                label="Product video URL (YouTube or MP4)"
                value={oto.videoUrl}
                onChange={(v) => setOtoField('videoUrl', v)}
                placeholder="https://youtube.com/watch?v=… or .mp4"
              />
            </div>
            <p className="text-xs text-bone/40">
              Phase 1: OTO is display + link only (no Stripe charge yet).
            </p>
          </section>
        )}

        {tab === 'thankyou' && (
          <section className="rounded-xl border border-bone/10 bg-ink/30 p-4 sm:p-5 space-y-4">
            <Field
              label="Headline"
              value={thankyou.headline}
              onChange={(v) => setThankField('headline', v)}
            />
            <Area
              label="Subheadline"
              value={thankyou.subheadline}
              onChange={(v) => setThankField('subheadline', v)}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="CTA text"
                value={thankyou.ctaText}
                onChange={(v) => setThankField('ctaText', v)}
              />
              <Field
                label="CTA href"
                value={thankyou.ctaHref}
                onChange={(v) => setThankField('ctaHref', v)}
                placeholder="/mothermode/brain-dump"
              />
            </div>
            <Area
              label="Secondary note"
              value={thankyou.secondaryNote}
              onChange={(v) => setThankField('secondaryNote', v)}
            />
          </section>
        )}

        {tab === 'footer' && (
          <section className="rounded-xl border border-bone/10 bg-ink/30 p-4 sm:p-5 space-y-4">
            <label className="flex items-center gap-2 text-sm text-bone/70">
              <input
                type="checkbox"
                checked={footer.enabled}
                onChange={(e) => setFooter((prev) => ({ ...prev, enabled: e.target.checked }))}
              />
              Show footer on optin pages
            </label>
            <Field
              label="Brand line"
              value={footer.brandLine}
              onChange={(v) => setFooter((prev) => ({ ...prev, brandLine: v }))}
              placeholder="MotherMode"
            />
            <Area
              label="Disclaimer / advertising disclosure"
              value={footer.disclaimer}
              onChange={(v) => setFooter((prev) => ({ ...prev, disclaimer: v }))}
              rows={4}
            />
            <Area
              label="Footer links (label|href, one per line)"
              value={footer.links.map((l) => `${l.label}|${l.href}`).join('\n')}
              onChange={(v) =>
                setFooter((prev) => ({
                  ...prev,
                  links: v
                    .split('\n')
                    .map((line) => {
                      const [label, href] = line.split('|').map((s) => s.trim());
                      return { label: label || '', href: href || '' };
                    })
                    .filter((l) => l.label || l.href),
                }))
              }
              rows={5}
            />
            <Field
              label="Copyright"
              value={footer.copyright}
              onChange={(v) => setFooter((prev) => ({ ...prev, copyright: v }))}
            />
          </section>
        )}

        {tab === 'links' && (

          <section className="rounded-xl border border-bone/10 bg-ink/30 p-4 sm:p-5 space-y-4">
            <p className="text-sm text-bone/55">
              Optional hooks into the rest of MotherMode. Thank-you CTA falls back
              to offer slug, then deliverable, then /mothermode.
            </p>
            <Field
              label="Offer slug (/mothermode/[slug])"
              value={offerSlug}
              onChange={setOfferSlug}
              placeholder="brain-dump"
            />
            <Field
              label="Lead Gen kit slug"
              value={leadGenSlug}
              onChange={setLeadGenSlug}
              placeholder="optional"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Deliverable slug"
                value={deliverableSlug}
                onChange={setDeliverableSlug}
              />
              <Field
                label="Deliverable key"
                value={deliverableKey}
                onChange={setDeliverableKey}
              />
            </div>
          </section>
        )}

        {tab === 'leads' && (
          <section className="rounded-xl border border-bone/10 bg-ink/30 overflow-hidden">
            <div className="flex items-center justify-between border-b border-bone/10 px-3 py-2">
              <div className="text-xs text-bone/45">
                {selectedId
                  ? `${leads.filter((l) => l.funnelId === selectedId).length} for this funnel`
                  : `${leads.length} recent`}
              </div>
              <button type="button" onClick={exportLeadsCsv} className={btnGhost}>
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-bone/10 text-left text-xs uppercase tracking-wide text-bone/45">
                    <th className="px-3 py-2.5 font-semibold">Email</th>
                    <th className="px-3 py-2.5 font-semibold">Name</th>
                    <th className="px-3 py-2.5 font-semibold">Funnel</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-3 py-2.5 font-semibold">UTM</th>
                    <th className="px-3 py-2.5 font-semibold">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bone/10">
                  {leads.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-bone/40">
                        No leads yet. Publish a funnel and capture a test email.
                      </td>
                    </tr>
                  )}
                  {(selectedId ? leads.filter((l) => l.funnelId === selectedId) : leads).map((l) => (
                    <tr key={l.id} className="text-bone/80">
                      <td className="px-3 py-2.5 font-medium text-bone">{l.email}</td>
                      <td className="px-3 py-2.5">{l.firstName || '—'}</td>
                      <td className="px-3 py-2.5 text-bone/55">
                        {l.funnelName || l.funnelSlug || l.funnelId.slice(0, 8)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={
                            l.otoAccepted
                              ? 'text-emerald-400/90'
                              : l.status === 'oto_declined'
                                ? 'text-bone/40'
                                : 'text-brass/80'
                          }
                        >
                          {l.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-bone/45 text-xs max-w-[140px] truncate">
                        {[l.utmSource, l.utmMedium, l.utmCampaign].filter(Boolean).join(' / ') || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-bone/45 whitespace-nowrap">
                        {new Date(l.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function Area({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <textarea
        className={inputClass + ' min-h-[80px] resize-y'}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-bone/10 bg-ink/50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-bone/40">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-bone">{value}</div>
    </div>
  );
}


