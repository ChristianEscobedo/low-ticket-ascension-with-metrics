'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  blankIntake,
  blankKit,
  COMMUNITY_TYPES,
  COMMUNITY_STATUSES,
  COMMUNITY_PLATFORMS,
  type CommunityIntake,
  type CommunityKit,
  type CommunityKitRecord,
  type CommunityType,
  type CommunityStatus,
  type KitSection,
  type QualifyingQuestion,
} from '@/lib/mothermode/community/types';
import {
  SECTION_LABELS,
  SECTION_HINTS,
  sectionsForType,
  sectionToText,
  kitToText,
  kitToPrintableHtml,
} from '@/lib/mothermode/community/export';
import type { ContextRef, ContextSourceOption } from '@/lib/mothermode/context';
import ContextRefEditor from '@/components/mothermode/context/ContextRefEditor';


// ---------------------------------------------------------------------------
// Small styled primitives (match the admin dark theme)
// ---------------------------------------------------------------------------

const inputCls =
  'w-full rounded-lg bg-black/20 border border-bone/15 px-3 py-2 text-sm text-bone placeholder-bone/30 focus:outline-none focus:border-brass/50';
const labelCls = 'block text-xs uppercase tracking-wider text-bone/50 mb-1';
const cardCls = 'rounded-xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 p-4';
const btnCls =
  'rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
const primaryBtn = `${btnCls} bg-brass/[0.15] text-brass border border-brass/30 hover:bg-brass/25`;
const ghostBtn = `${btnCls} text-bone/60 border border-bone/15 hover:text-bone hover:bg-bone/[0.05]`;

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {textarea ? (
        <textarea
          className={`${inputCls} min-h-[80px] resize-y`}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className={inputCls}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

const INTAKE_FIELDS: Array<{ key: keyof CommunityIntake; label: string; textarea?: boolean }> = [
  { key: 'niche', label: 'Niche / topic' },
  { key: 'audience', label: 'Audience (avatar)' },
  { key: 'promise', label: 'Core promise / result' },
  { key: 'unexpectedWay', label: 'Unexpected way / mechanism' },
  { key: 'pains', label: 'Pains and obstacles', textarea: true },
  { key: 'platform', label: 'Platform (Skool, Facebook, Circle...)' },
  { key: 'goal', label: 'Primary goal (book a call, sell offer, masterclass/webinar)' },
  { key: 'nextStep', label: 'Next step (call, workshop, webinar, offer)' },
  { key: 'price', label: 'Price point (if any)' },
  { key: 'freebie', label: 'Lead magnet / welcome asset' },
  { key: 'tone', label: 'Tone / brand voice' },
  { key: 'notes', label: 'Extra notes', textarea: true },
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function CommunityEditor({
  initialKits,
  sources = [],
}: {
  initialKits: CommunityKitRecord[];
  sources?: ContextSourceOption[];
}) {

  const [kits, setKits] = useState<CommunityKitRecord[]>(initialKits);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Working draft
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [communityType, setCommunityType] = useState<CommunityType>('paid');
  const [status, setStatus] = useState<CommunityStatus>('draft');
  const [intake, setIntake] = useState<CommunityIntake>(blankIntake());
  const [kit, setKit] = useState<CommunityKit>(blankKit());
  const [contextRefs, setContextRefs] = useState<ContextRef[]>([]);


  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Post-intake wizard: pick which sections to generate.
  const [showWizard, setShowWizard] = useState(false);
  const [wizardSections, setWizardSections] = useState<KitSection[]>([]);

  const hasKit = useMemo(
    () => kit.nameOptions.length > 0 || kit.description.trim().length > 0,
    [kit],
  );

  const resetDraft = useCallback(() => {
    setSelectedId(null);
    setSlug('');
    setName('');
    setCommunityType('paid');
    setStatus('draft');
    setIntake(blankIntake());
    setKit(blankKit());
    setContextRefs([]);
    setMessage(null);
  }, []);

  const loadKit = useCallback((record: CommunityKitRecord) => {
    setSelectedId(record.id);
    setSlug(record.slug);
    setName(record.name);
    setCommunityType(record.communityType);
    setStatus(record.status);
    setIntake(record.intake);
    setKit(record.kit);
    setContextRefs(record.contextRefs);
    setMessage(null);
  }, []);


  const setIntakeField = (key: keyof CommunityIntake, value: string) =>
    setIntake((prev) => ({ ...prev, [key]: value }));

  // -------------------------------------------------------------------------
  // AI calls
  // -------------------------------------------------------------------------

  // Actual generation call. `sections` limits output to the wizard's picks;
  // omit or pass all to generate the whole kit.
  const runGenerate = useCallback(
    async (sections?: KitSection[]) => {
      setBusy('generate');
      setMessage(null);
      try {
        const res = await fetch('/api/mothermode/community-ai', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'generate', intake, communityType, sections, contextRefs }),

        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Generation failed');
        setKit((prev) => ({ ...prev, ...(data.kit as CommunityKit) }));
        if (!name && data.kit?.chosenName) setName(data.kit.chosenName);
        if (!slug && data.kit?.chosenName) setSlug(slugify(data.kit.chosenName));
        setMessage({ ok: true, text: 'Kit generated. Review and edit any section.' });
      } catch (err) {
        setMessage({ ok: false, text: err instanceof Error ? err.message : 'Failed' });
      } finally {
        setBusy(null);
      }
    },
    [intake, communityType, name, slug, contextRefs],
  );


  // Open the "which sections?" wizard (defaults to everything for this type).
  const openWizard = useCallback(() => {
    if (!intake.niche.trim() && !intake.audience.trim()) {
      setMessage({ ok: false, text: 'Add at least a niche or audience first.' });
      return;
    }
    setWizardSections(sectionsForType(communityType));
    setShowWizard(true);
  }, [intake.niche, intake.audience, communityType]);

  const confirmWizard = useCallback(() => {
    const chosen = wizardSections;
    if (chosen.length === 0) {
      setMessage({ ok: false, text: 'Pick at least one section to generate.' });
      return;
    }
    setShowWizard(false);
    const all = sectionsForType(communityType);
    // Pass sections only when it is a real subset; otherwise generate the full kit.
    void runGenerate(chosen.length === all.length ? undefined : chosen);
  }, [wizardSections, communityType, runGenerate]);

  const toggleWizardSection = useCallback((section: KitSection) => {
    setWizardSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section],
    );
  }, []);

  // -------------------------------------------------------------------------
  // Export (copy a section, copy everything, or print the whole kit to PDF)
  // -------------------------------------------------------------------------

  const copySection = useCallback(
    async (section: KitSection) => {
      const text = sectionToText(kit, section, communityType);
      try {
        await navigator.clipboard.writeText(text || '');
        setMessage({ ok: true, text: `Copied: ${SECTION_LABELS[section]}` });
      } catch {
        setMessage({ ok: false, text: 'Clipboard unavailable in this browser.' });
      }
    },
    [kit, communityType],
  );

  const copyAll = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(kitToText(kit, communityType, name));
      setMessage({ ok: true, text: 'Full kit copied as text.' });
    } catch {
      setMessage({ ok: false, text: 'Clipboard unavailable in this browser.' });
    }
  }, [kit, communityType, name]);

  const exportPdf = useCallback(() => {
    const html = kitToPrintableHtml(kit, communityType, name);
    const win = window.open('', '_blank');
    if (!win) {
      setMessage({ ok: false, text: 'Allow pop-ups to export the PDF.' });
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }, [kit, communityType, name]);

  const fillIntake = useCallback(async () => {
    setBusy('fillIntake');
    setMessage(null);
    try {
      const res = await fetch('/api/mothermode/community-ai', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'fillIntake', intake, communityType }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Intake fill failed');
      setIntake(data.intake as CommunityIntake);
      setMessage({
        ok: true,
        text: 'Intake filled from your baseline. Review, tweak, then generate the kit.',
      });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setBusy(null);
    }
  }, [intake, communityType]);

  const regenerate = useCallback(
    async (section: KitSection) => {
      setBusy(section);
      setMessage(null);
      try {
        const res = await fetch('/api/mothermode/community-ai', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'regenerate',
            section,
            intake,
            communityType,
            kit,
            contextRefs,
          }),

        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Regeneration failed');
        setKit((prev) => ({ ...prev, ...(data.patch as Partial<CommunityKit>) }));
        setMessage({ ok: true, text: `Regenerated: ${SECTION_LABELS[section]}` });
      } catch (err) {
        setMessage({ ok: false, text: err instanceof Error ? err.message : 'Failed' });
      } finally {
        setBusy(null);
      }
    },
    [intake, communityType, kit, contextRefs],
  );


  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  const save = useCallback(async () => {
    if (!slug.trim()) {
      setMessage({ ok: false, text: 'Add a slug before saving.' });
      return;
    }
    setBusy('save');
    setMessage(null);
    try {
      const res = await fetch('/api/admin/mothermode-community', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: selectedId,
          slug,
          name,
          communityType,
          status,
          intake,
          kit,
          contextRefs,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Save failed');
      const saved = data.item as CommunityKitRecord;

      setKits((prev) => {
        const rest = prev.filter((k) => k.id !== saved.id);
        return [saved, ...rest];
      });
      setSelectedId(saved.id);
      setMessage({ ok: true, text: 'Saved.' });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setBusy(null);
    }
  }, [selectedId, slug, name, communityType, status, intake, kit, contextRefs]);


  const remove = useCallback(async () => {
    if (!selectedId) return;
    if (!confirm('Delete this community kit?')) return;
    setBusy('delete');
    try {
      const res = await fetch(`/api/admin/mothermode-community?id=${selectedId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Delete failed');
      setKits((prev) => prev.filter((k) => k.id !== selectedId));
      resetDraft();
      setMessage({ ok: true, text: 'Deleted.' });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setBusy(null);
    }
  }, [selectedId, resetDraft]);

  // -------------------------------------------------------------------------
  // Kit field setters
  // -------------------------------------------------------------------------

  const setKitField = <K extends keyof CommunityKit>(key: K, value: CommunityKit[K]) =>
    setKit((prev) => ({ ...prev, [key]: value }));

  const audiences = communityType === 'both' ? (['paid', 'free'] as const) : ([communityType] as const);

  return (
    <div className="grid lg:grid-cols-[240px_1fr] gap-6">
      {/* Saved kits list */}
      <div className="space-y-2">
        <button className={`${primaryBtn} w-full`} onClick={resetDraft}>
          + New kit
        </button>
        <div className="space-y-1">
          {kits.map((k) => (
            <button
              key={k.id}
              onClick={() => loadKit(k)}
              className={`block w-full text-left rounded-lg px-3 py-2 text-sm border transition-colors ${
                selectedId === k.id
                  ? 'border-brass/30 bg-brass/[0.10] text-brass'
                  : 'border-transparent text-bone/60 hover:bg-bone/[0.04]'
              }`}
            >
              <div className="font-medium truncate">{k.name || k.slug}</div>
              <div className="text-[11px] text-bone/40 uppercase tracking-wide">
                {k.communityType} · {k.status}
              </div>
            </button>
          ))}
          {kits.length === 0 && (
            <p className="text-xs text-bone/40 px-1">No kits yet.</p>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="space-y-6">
        {message && (
          <div
            className={`rounded-lg px-3 py-2 text-sm border ${
              message.ok
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-red-500/30 bg-red-500/10 text-red-300'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Meta */}
        <div className={cardCls}>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Name" value={name} onChange={setName} placeholder="Chosen community name" />
            <Field label="Slug" value={slug} onChange={setSlug} placeholder="my-community" />
            <div>
              <label className={labelCls}>Community type</label>
              <select
                className={inputCls}
                value={communityType}
                onChange={(e) => setCommunityType(e.target.value as CommunityType)}
              >
                {COMMUNITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select
                className={inputCls}
                value={status}
                onChange={(e) => setStatus(e.target.value as CommunityStatus)}
              >
                {COMMUNITY_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Intake */}
        <div className={cardCls}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg font-semibold">Intake</h2>
            <div className="flex items-center gap-2">
              <button className={ghostBtn} onClick={fillIntake} disabled={busy !== null}>
                {busy === 'fillIntake' ? 'Filling…' : 'AI fill intake'}
              </button>
              <button className={primaryBtn} onClick={openWizard} disabled={busy !== null}>
                {busy === 'generate' ? 'Generating…' : 'Generate kit'}
              </button>
            </div>
          </div>
          <p className="text-xs text-bone/40 mb-3">
            Enter at least a niche and audience, then let AI fill the rest of the
            brief. Review and tweak before generating the full kit.
          </p>

          <div className="grid sm:grid-cols-2 gap-4">
            {INTAKE_FIELDS.map((f) =>
              f.key === 'platform' ? (
                <div key={f.key}>
                  <label className={labelCls}>Platform</label>
                  <input
                    className={inputCls}
                    list="community-platforms"
                    value={intake.platform}
                    placeholder="Skool, Facebook Group, Circle, Discord…"
                    onChange={(e) => setIntakeField('platform', e.target.value)}
                  />
                  <datalist id="community-platforms">
                    {COMMUNITY_PLATFORMS.map((p) => (
                      <option key={p.value} value={p.value} />
                    ))}
                  </datalist>
                </div>
              ) : (
                <div key={f.key} className={f.textarea ? 'sm:col-span-2' : ''}>
                  <Field
                    label={f.label}
                    value={intake[f.key]}
                    onChange={(v) => setIntakeField(f.key, v)}
                    textarea={f.textarea}
                  />
                </div>
              ),
            )}
          </div>
        </div>

        {/* Attached context */}
        <ContextRefEditor
          refs={contextRefs}
          onChange={setContextRefs}
          sources={sources}
          disabled={busy !== null}
        />

        {hasKit && (

          <>
            {/* Export toolbar */}
            <div className={`${cardCls} flex flex-wrap items-center justify-between gap-3`}>
              <p className="text-xs text-bone/50">
                Export the whole kit, or copy any section from its card.
              </p>
              <div className="flex items-center gap-2">
                <button className={ghostBtn} onClick={copyAll} disabled={busy !== null}>
                  Copy all as text
                </button>
                <button className={primaryBtn} onClick={exportPdf} disabled={busy !== null}>
                  Export PDF
                </button>
              </div>
            </div>

            {/* Names */}
            <SectionCard
              title="Name options"
              section="names"
              busy={busy}
              onRegenerate={regenerate}
              onCopy={copySection}
            >
              <Field
                label="Chosen name"
                value={kit.chosenName}
                onChange={(v) => setKitField('chosenName', v)}
              />
              <label className={`${labelCls} mt-3`}>Options</label>
              <div className="space-y-2">
                {kit.nameOptions.map((opt, i) => (
                  <input
                    key={i}
                    className={inputCls}
                    value={opt}
                    onChange={(e) => {
                      const next = [...kit.nameOptions];
                      next[i] = e.target.value;
                      setKitField('nameOptions', next);
                    }}
                  />
                ))}
              </div>
            </SectionCard>

            {/* Description */}
            <SectionCard
              title="Public description"
              section="description"
              busy={busy}
              onRegenerate={regenerate}
              onCopy={copySection}
            >
              <textarea
                className={`${inputCls} min-h-[100px] resize-y`}
                value={kit.description}
                onChange={(e) => setKitField('description', e.target.value)}
              />
            </SectionCard>

            {/* Qualifying questions */}
            <SectionCard
              title="Qualifying questions"
              section="qualifyingQuestions"
              busy={busy}
              onRegenerate={regenerate}
              onCopy={copySection}
            >
              {audiences.map((aud) => (
                <div key={aud} className="mb-4">
                  <div className="text-xs uppercase tracking-wider text-brass/70 mb-2">
                    {aud} group
                  </div>
                  <div className="space-y-3">
                    {kit.qualifyingQuestions[aud].map((q, i) => (
                      <QuestionEditor
                        key={i}
                        question={q}
                        onChange={(next) => {
                          const list = [...kit.qualifyingQuestions[aud]];
                          list[i] = next;
                          setKitField('qualifyingQuestions', {
                            ...kit.qualifyingQuestions,
                            [aud]: list,
                          });
                        }}
                      />
                    ))}
                    {kit.qualifyingQuestions[aud].length === 0 && (
                      <p className="text-xs text-bone/40">No questions yet.</p>
                    )}
                  </div>
                </div>
              ))}
            </SectionCard>

            {/* DM script */}
            <SectionCard
              title="DM script"
              section="dmScript"
              busy={busy}
              onRegenerate={regenerate}
              onCopy={copySection}
            >
              <div className="space-y-3">
                {kit.dmScript.stages.map((s, i) => (
                  <div key={i}>
                    <label className={labelCls}>{s.label || s.key || `Stage ${i + 1}`}</label>
                    <textarea
                      className={`${inputCls} min-h-[70px] resize-y`}
                      value={s.message}
                      onChange={(e) => {
                        const next = [...kit.dmScript.stages];
                        next[i] = { ...s, message: e.target.value };
                        setKitField('dmScript', { stages: next });
                      }}
                    />
                  </div>
                ))}
                {kit.dmScript.stages.length === 0 && (
                  <p className="text-xs text-bone/40">No DM stages yet.</p>
                )}
              </div>
            </SectionCard>

            {/* Sales call (paid / both only) */}
            {communityType !== 'free' && (
              <SectionCard
                title="Sales-call script"
                section="salesCall"
                busy={busy}
                onRegenerate={regenerate}
                onCopy={copySection}
              >
                <div className="space-y-3">
                  {kit.salesCallScript.phases.map((p, i) => (
                    <div key={i}>
                      <label className={labelCls}>{p.label || p.key || `Phase ${i + 1}`}</label>
                      <textarea
                        className={`${inputCls} min-h-[70px] resize-y`}
                        value={p.lines.join('\n')}
                        onChange={(e) => {
                          const next = [...kit.salesCallScript.phases];
                          next[i] = { ...p, lines: e.target.value.split('\n') };
                          setKitField('salesCallScript', { phases: next });
                        }}
                      />
                    </div>
                  ))}
                  {kit.salesCallScript.phases.length === 0 && (
                    <p className="text-xs text-bone/40">No phases yet.</p>
                  )}
                </div>
              </SectionCard>
            )}

            {/* Ad concept */}
            <SectionCard
              title="Ad concept"
              section="ad"
              busy={busy}
              onRegenerate={regenerate}
              onCopy={copySection}
            >
              <Field
                label="Concept / angle"
                value={kit.ad.concept}
                onChange={(v) => setKitField('ad', { ...kit.ad, concept: v })}
                textarea
              />
              <div className="mt-3">
                <Field
                  label="Primary text"
                  value={kit.ad.primaryText}
                  onChange={(v) => setKitField('ad', { ...kit.ad, primaryText: v })}
                  textarea
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4 mt-3">
                <Field
                  label="Headline"
                  value={kit.ad.headline}
                  onChange={(v) => setKitField('ad', { ...kit.ad, headline: v })}
                />
                <Field
                  label="Description"
                  value={kit.ad.description}
                  onChange={(v) => setKitField('ad', { ...kit.ad, description: v })}
                />
              </div>
              <div className="mt-3">
                <Field
                  label="Image prompt"
                  value={kit.ad.imagePrompt}
                  onChange={(v) => setKitField('ad', { ...kit.ad, imagePrompt: v })}
                  textarea
                />
              </div>
            </SectionCard>

            {/* Lead form */}
            <SectionCard
              title="Lead form (Facebook / Meta)"
              section="leadForm"
              busy={busy}
              onRegenerate={regenerate}
              onCopy={copySection}
            >
              <Field
                label="Intro headline"
                value={kit.leadForm.headline}
                onChange={(v) => setKitField('leadForm', { ...kit.leadForm, headline: v })}
              />
              <div className="mt-3">
                <Field
                  label="Intro description (value stack)"
                  value={kit.leadForm.description}
                  onChange={(v) => setKitField('leadForm', { ...kit.leadForm, description: v })}
                  textarea
                />
              </div>
              <div className="mt-3">
                <label className={labelCls}>Pre-qualify questions (one per line)</label>
                <textarea
                  className={`${inputCls} min-h-[60px] resize-y`}
                  value={kit.leadForm.questions.join('\n')}
                  placeholder="Optional. One question per line."
                  onChange={(e) =>
                    setKitField('leadForm', {
                      ...kit.leadForm,
                      questions: e.target.value.split('\n'),
                    })
                  }
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4 mt-3">
                <Field
                  label="Completion headline"
                  value={kit.leadForm.completionHeadline}
                  onChange={(v) =>
                    setKitField('leadForm', { ...kit.leadForm, completionHeadline: v })
                  }
                />
                <Field
                  label="Call to action (button)"
                  value={kit.leadForm.callToAction}
                  onChange={(v) => setKitField('leadForm', { ...kit.leadForm, callToAction: v })}
                />
              </div>
              <div className="mt-3">
                <Field
                  label="Completion description (deliver + next step)"
                  value={kit.leadForm.completionDescription}
                  onChange={(v) =>
                    setKitField('leadForm', { ...kit.leadForm, completionDescription: v })
                  }
                  textarea
                />
              </div>
              <div className="mt-3">
                <Field
                  label="Group / community URL"
                  value={kit.leadForm.groupUrl}
                  onChange={(v) => setKitField('leadForm', { ...kit.leadForm, groupUrl: v })}
                  placeholder="https://www.facebook.com/groups/your-group"
                />
              </div>
            </SectionCard>

            {/* Pinned post */}
            <SectionCard
              title="First pinned post"
              section="pinnedPost"
              busy={busy}
              onRegenerate={regenerate}
              onCopy={copySection}
            >
              <textarea
                className={`${inputCls} min-h-[140px] resize-y`}
                value={kit.pinnedPost}
                onChange={(e) => setKitField('pinnedPost', e.target.value)}
              />
            </SectionCard>
          </>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button className={primaryBtn} onClick={save} disabled={busy !== null}>
            {busy === 'save' ? 'Saving…' : 'Save kit'}
          </button>
          {selectedId && (
            <button className={ghostBtn} onClick={remove} disabled={busy !== null}>
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Section wizard */}
      {showWizard && (
        <GenerateWizard
          type={communityType}
          selected={wizardSections}
          onToggle={toggleWizardSection}
          onCancel={() => setShowWizard(false)}
          onConfirm={confirmWizard}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section card with Copy + Regenerate buttons
// ---------------------------------------------------------------------------

function SectionCard({
  title,
  section,
  busy,
  onRegenerate,
  onCopy,
  children,
}: {
  title: string;
  section: KitSection;
  busy: string | null;
  onRegenerate: (s: KitSection) => void;
  onCopy?: (s: KitSection) => void;
  children: React.ReactNode;
}) {
  return (
    <div className={cardCls}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <div className="flex items-center gap-2">
          {onCopy && (
            <button className={ghostBtn} onClick={() => onCopy(section)} disabled={busy !== null}>
              Copy
            </button>
          )}
          <button
            className={ghostBtn}
            onClick={() => onRegenerate(section)}
            disabled={busy !== null}
          >
            {busy === section ? 'Regenerating…' : 'Regenerate'}
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generate wizard modal (pick which sections to produce)
// ---------------------------------------------------------------------------

function GenerateWizard({
  type,
  selected,
  onToggle,
  onCancel,
  onConfirm,
}: {
  type: CommunityType;
  selected: KitSection[];
  onToggle: (s: KitSection) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const sections = sectionsForType(type);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-bone/15 bg-[#141210] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl font-semibold mb-1">What should we build?</h2>
        <p className="text-xs text-bone/50 mb-4">
          Pick the sections to generate for this {type} community. You can regenerate
          any single section later.
        </p>
        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {sections.map((s) => {
            const on = selected.includes(s);
            return (
              <button
                key={s}
                onClick={() => onToggle(s)}
                className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                  on
                    ? 'border-brass/40 bg-brass/[0.10]'
                    : 'border-bone/10 hover:bg-bone/[0.04]'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
                    on ? 'border-brass bg-brass/30 text-brass' : 'border-bone/30 text-transparent'
                  }`}
                >
                  ✓
                </span>
                <span>
                  <span className="block text-sm font-medium text-bone">
                    {SECTION_LABELS[s]}
                  </span>
                  <span className="block text-xs text-bone/45">{SECTION_HINTS[s]}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-5 flex items-center justify-end gap-3">
          <button className={ghostBtn} onClick={onCancel}>
            Cancel
          </button>
          <button className={primaryBtn} onClick={onConfirm}>
            Generate {selected.length} section{selected.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Qualifying question editor
// ---------------------------------------------------------------------------

function QuestionEditor({
  question,
  onChange,
}: {
  question: QualifyingQuestion;
  onChange: (q: QualifyingQuestion) => void;
}) {
  return (
    <div className="rounded-lg border border-bone/10 bg-black/20 p-3 space-y-2">
      <input
        className={inputCls}
        value={question.prompt}
        placeholder="Question prompt"
        onChange={(e) => onChange({ ...question, prompt: e.target.value })}
      />
      <div className="flex items-center gap-3">
        <select
          className={`${inputCls} w-auto`}
          value={question.type}
          onChange={(e) =>
            onChange({ ...question, type: e.target.value as QualifyingQuestion['type'] })
          }
        >
          <option value="multiple_choice">multiple_choice</option>
          <option value="short_text">short_text</option>
          <option value="email">email</option>
        </select>
        <label className="text-xs text-bone/50 flex items-center gap-1">
          <input
            type="checkbox"
            checked={question.required}
            onChange={(e) => onChange({ ...question, required: e.target.checked })}
          />
          required
        </label>
      </div>
      {question.type === 'multiple_choice' && (
        <textarea
          className={`${inputCls} min-h-[60px] resize-y`}
          value={(question.options ?? []).join('\n')}
          placeholder="One option per line"
          onChange={(e) =>
            onChange({ ...question, options: e.target.value.split('\n') })
          }
        />
      )}
    </div>
  );
}
