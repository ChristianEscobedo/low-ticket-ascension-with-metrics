'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  blankIntake,
  blankKit,
  blankDimeProblem,
  blankScriptPillar,
  blankProblemRow,
  HIGH_TICKET_STATUSES,
  KIT_SECTIONS,
  SEVEN_A_KEYS,
  type HighTicketIntake,
  type HighTicketKit,
  type HighTicketKitRecord,
  type HighTicketStatus,
  type KitSection,
  type SevenAKey,
} from '@/lib/mothermode/highticket/types';
import {
  SECTION_LABELS,
  SECTION_HINTS,
  SEVEN_A_LABELS,
  allSections,
  sectionToText,
  kitToText,
  kitToPrintableHtml,
} from '@/lib/mothermode/highticket/export';
import ContextRefEditor from '@/components/mothermode/context/ContextRefEditor';
import {
  type ContextRef,
  type ContextSourceOption,
} from '@/lib/mothermode/context';


// ---------------------------------------------------------------------------
// Small styled primitives (match the admin dark theme)
// ---------------------------------------------------------------------------

const inputCls =
  'w-full rounded-lg bg-black/20 border border-bone/15 px-3 py-2 text-sm text-bone placeholder-bone/30 focus:outline-none focus:border-brass/50';
const labelCls = 'block text-xs uppercase tracking-wider text-bone/50 mb-1';
const cardCls = 'rounded-xl border border-bone/10 bg-bone/[0.02] p-4';
const btnCls =
  'rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
const primaryBtn = `${btnCls} bg-brass/[0.15] text-brass border border-brass/30 hover:bg-brass/25`;
const ghostBtn = `${btnCls} text-bone/60 border border-bone/15 hover:text-bone hover:bg-bone/[0.05]`;
const rowBtn =
  'rounded-md px-2 py-1 text-xs text-bone/50 border border-bone/15 hover:text-bone hover:bg-bone/[0.05] disabled:opacity-40';

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

/** Edit a string[] as one item per line. */
function ListField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <textarea
        className={`${inputCls} min-h-[80px] resize-y`}
        value={value.join('\n')}
        placeholder={placeholder ?? 'One item per line'}
        onChange={(e) => onChange(e.target.value.split('\n'))}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

const INTAKE_FIELDS: Array<{
  key: keyof HighTicketIntake;
  label: string;
  textarea?: boolean;
}> = [
  { key: 'niche', label: 'Niche / topic' },
  { key: 'audience', label: 'Audience (avatar)' },
  { key: 'transformation', label: 'Core transformation / result' },
  { key: 'mechanism', label: 'Mechanism / unique method' },
  { key: 'priceBand', label: 'Price band (5k-10k, 10k+)' },
  { key: 'proof', label: 'Proof / credibility', textarea: true },
  { key: 'timeline', label: 'Timeline / program length' },
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

export default function HighTicketEditor({
  initialKits,
  sources = [],
}: {
  initialKits: HighTicketKitRecord[];
  sources?: ContextSourceOption[];
}) {

  const [kits, setKits] = useState<HighTicketKitRecord[]>(initialKits);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Working draft
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<HighTicketStatus>('draft');
  const [intake, setIntake] = useState<HighTicketIntake>(blankIntake());
  const [kit, setKit] = useState<HighTicketKit>(blankKit());
  const [contextRefs, setContextRefs] = useState<ContextRef[]>([]);


  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Post-intake wizard: pick which sections to generate.
  const [showWizard, setShowWizard] = useState(false);
  const [wizardSections, setWizardSections] = useState<KitSection[]>([]);

  const hasKit = useMemo(
    () =>
      kit.offer.chosenName.trim().length > 0 ||
      kit.offer.iHelpStatement.trim().length > 0 ||
      kit.basics.problems.length > 0 ||
      kit.problems.length > 0 ||
      SEVEN_A_KEYS.some((k) => kit.sevenAs[k].trim().length > 0),
    [kit],
  );

  const resetDraft = useCallback(() => {
    setSelectedId(null);
    setSlug('');
    setName('');
    setStatus('draft');
    setIntake(blankIntake());
    setKit(blankKit());
    setContextRefs([]);
    setMessage(null);
  }, []);

  const loadKit = useCallback((record: HighTicketKitRecord) => {
    setSelectedId(record.id);
    setSlug(record.slug);
    setName(record.name);
    setStatus(record.status);
    setIntake(record.intake);
    setKit(record.kit);
    setContextRefs(record.contextRefs ?? []);
    setMessage(null);
  }, []);


  const setIntakeField = (key: keyof HighTicketIntake, value: string) =>
    setIntake((prev) => ({ ...prev, [key]: value }));

  // -------------------------------------------------------------------------
  // AI calls
  // -------------------------------------------------------------------------

  const runGenerate = useCallback(
    async (sections?: KitSection[]) => {
      setBusy('generate');
      setMessage(null);
      try {
        const res = await fetch('/api/mothermode/highticket-ai', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'generate', intake, sections, contextRefs }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Generation failed');
        const nextKit = data.kit as HighTicketKit;
        setKit((prev) => ({ ...prev, ...nextKit }));
        const chosen = nextKit?.offer?.chosenName;
        if (!name && chosen) setName(chosen);
        if (!slug && chosen) setSlug(slugify(chosen));
        setMessage({ ok: true, text: 'Kit generated. Review and edit any section.' });
      } catch (err) {
        setMessage({ ok: false, text: err instanceof Error ? err.message : 'Failed' });
      } finally {
        setBusy(null);
      }
    },
    [intake, name, slug, contextRefs],
  );


  const openWizard = useCallback(() => {
    if (!intake.niche.trim() && !intake.audience.trim()) {
      setMessage({ ok: false, text: 'Add at least a niche or audience first.' });
      return;
    }
    setWizardSections(allSections());
    setShowWizard(true);
  }, [intake.niche, intake.audience]);

  const confirmWizard = useCallback(() => {
    const chosen = wizardSections;
    if (chosen.length === 0) {
      setMessage({ ok: false, text: 'Pick at least one section to generate.' });
      return;
    }
    setShowWizard(false);
    const all = allSections();
    void runGenerate(chosen.length === all.length ? undefined : chosen);
  }, [wizardSections, runGenerate]);

  const toggleWizardSection = useCallback((section: KitSection) => {
    setWizardSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section],
    );
  }, []);

  // -------------------------------------------------------------------------
  // Export
  // -------------------------------------------------------------------------

  const copySection = useCallback(
    async (section: KitSection) => {
      const text = sectionToText(kit, section);
      try {
        await navigator.clipboard.writeText(text || '');
        setMessage({ ok: true, text: `Copied: ${SECTION_LABELS[section]}` });
      } catch {
        setMessage({ ok: false, text: 'Clipboard unavailable in this browser.' });
      }
    },
    [kit],
  );

  const copyAll = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(kitToText(kit, name));
      setMessage({ ok: true, text: 'Full kit copied as text.' });
    } catch {
      setMessage({ ok: false, text: 'Clipboard unavailable in this browser.' });
    }
  }, [kit, name]);

  const exportPdf = useCallback(() => {
    const html = kitToPrintableHtml(kit, name);
    const win = window.open('', '_blank');
    if (!win) {
      setMessage({ ok: false, text: 'Allow pop-ups to export the PDF.' });
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }, [kit, name]);

  const fillIntake = useCallback(async () => {
    setBusy('fillIntake');
    setMessage(null);
    try {
      const res = await fetch('/api/mothermode/highticket-ai', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'fillIntake', intake }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Intake fill failed');
      setIntake(data.intake as HighTicketIntake);
      setMessage({
        ok: true,
        text: 'Intake filled from your baseline. Review, tweak, then generate the kit.',
      });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setBusy(null);
    }
  }, [intake]);

  const regenerate = useCallback(
    async (section: KitSection) => {
      setBusy(section);
      setMessage(null);
      try {
        const res = await fetch('/api/mothermode/highticket-ai', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'regenerate', section, intake, kit, contextRefs }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Regeneration failed');
        setKit((prev) => ({ ...prev, ...(data.patch as Partial<HighTicketKit>) }));
        setMessage({ ok: true, text: `Regenerated: ${SECTION_LABELS[section]}` });
      } catch (err) {
        setMessage({ ok: false, text: err instanceof Error ? err.message : 'Failed' });
      } finally {
        setBusy(null);
      }
    },
    [intake, kit, contextRefs],
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
      const res = await fetch('/api/admin/mothermode-highticket', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: selectedId, slug, name, status, intake, kit, contextRefs }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Save failed');
      const saved = data.item as HighTicketKitRecord;
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
  }, [selectedId, slug, name, status, intake, kit, contextRefs]);


  const remove = useCallback(async () => {
    if (!selectedId) return;
    if (!confirm('Delete this high-ticket kit?')) return;
    setBusy('delete');
    try {
      const res = await fetch(`/api/admin/mothermode-highticket?id=${selectedId}`, {
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

  const setKitField = <K extends keyof HighTicketKit>(key: K, value: HighTicketKit[K]) =>
    setKit((prev) => ({ ...prev, [key]: value }));

  const setBasics = (value: HighTicketKit['basics']) => setKitField('basics', value);
  const setSevenA = (key: SevenAKey, value: string) =>
    setKit((prev) => ({ ...prev, sevenAs: { ...prev.sevenAs, [key]: value } }));
  const setOffer = (patch: Partial<HighTicketKit['offer']>) =>
    setKit((prev) => ({ ...prev, offer: { ...prev.offer, ...patch } }));
  const setProblems = (value: HighTicketKit['problems']) => setKitField('problems', value);
  const setOfferScript = (value: HighTicketKit['offerScript']) =>
    setKitField('offerScript', value);

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
                {k.status}
              </div>
            </button>
          ))}
          {kits.length === 0 && <p className="text-xs text-bone/40 px-1">No kits yet.</p>}
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
            <Field label="Name" value={name} onChange={setName} placeholder="Chosen offer name" />
            <Field label="Slug" value={slug} onChange={setSlug} placeholder="my-offer" />
            <div>
              <label className={labelCls}>Status</label>
              <select
                className={inputCls}
                value={status}
                onChange={(e) => setStatus(e.target.value as HighTicketStatus)}
              >
                {HIGH_TICKET_STATUSES.map((s) => (
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
            {INTAKE_FIELDS.map((f) => (
              <div key={f.key} className={f.textarea ? 'sm:col-span-2' : ''}>
                <Field
                  label={f.label}
                  value={intake[f.key]}
                  onChange={(v) => setIntakeField(f.key, v)}
                  textarea={f.textarea}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Attached context sources */}
        <ContextRefEditor refs={contextRefs} onChange={setContextRefs} sources={sources} disabled={busy !== null} />

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

            {/* Basics */}
            <SectionCard
              title={SECTION_LABELS.basics}
              section="basics"
              busy={busy}
              onRegenerate={regenerate}
              onCopy={copySection}
            >
              <label className={labelCls}>Avatar</label>
              <div className="grid sm:grid-cols-3 gap-3">
                <Field
                  label="Gender(s)"
                  value={kit.basics.avatar.genders}
                  onChange={(v) =>
                    setBasics({ ...kit.basics, avatar: { ...kit.basics.avatar, genders: v } })
                  }
                />
                <Field
                  label="Age range"
                  value={kit.basics.avatar.ageRange}
                  onChange={(v) =>
                    setBasics({ ...kit.basics, avatar: { ...kit.basics.avatar, ageRange: v } })
                  }
                />
                <Field
                  label="Identity / labels"
                  value={kit.basics.avatar.labels}
                  onChange={(v) =>
                    setBasics({ ...kit.basics, avatar: { ...kit.basics.avatar, labels: v } })
                  }
                />
              </div>

              <div className="mt-4 flex items-center justify-between">
                <label className={labelCls}>Problem / cost / result</label>
                <button
                  className={rowBtn}
                  disabled={busy !== null}
                  onClick={() =>
                    setBasics({ ...kit.basics, problems: [...kit.basics.problems, blankProblemRow()] })
                  }
                >
                  + Add row
                </button>
              </div>
              <div className="space-y-3">
                {kit.basics.problems.map((row, i) => (
                  <div key={i} className="rounded-lg border border-bone/10 bg-black/20 p-3">
                    <div className="grid sm:grid-cols-3 gap-3">
                      <Field
                        label="Problem"
                        value={row.problem}
                        onChange={(v) => {
                          const next = [...kit.basics.problems];
                          next[i] = { ...row, problem: v };
                          setBasics({ ...kit.basics, problems: next });
                        }}
                        textarea
                      />
                      <Field
                        label="Cost"
                        value={row.cost}
                        onChange={(v) => {
                          const next = [...kit.basics.problems];
                          next[i] = { ...row, cost: v };
                          setBasics({ ...kit.basics, problems: next });
                        }}
                        textarea
                      />
                      <Field
                        label="Result"
                        value={row.result}
                        onChange={(v) => {
                          const next = [...kit.basics.problems];
                          next[i] = { ...row, result: v };
                          setBasics({ ...kit.basics, problems: next });
                        }}
                        textarea
                      />
                    </div>
                    <div className="mt-2 text-right">
                      <button
                        className={rowBtn}
                        disabled={busy !== null}
                        onClick={() =>
                          setBasics({
                            ...kit.basics,
                            problems: kit.basics.problems.filter((_, j) => j !== i),
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                {kit.basics.problems.length === 0 && (
                  <p className="text-xs text-bone/40">No rows yet.</p>
                )}
              </div>
            </SectionCard>

            {/* 7 A's */}
            <SectionCard
              title={SECTION_LABELS.sevenAs}
              section="sevenAs"
              busy={busy}
              onRegenerate={regenerate}
              onCopy={copySection}
            >
              <div className="space-y-3">
                {SEVEN_A_KEYS.map((key) => (
                  <Field
                    key={key}
                    label={SEVEN_A_LABELS[key]}
                    value={kit.sevenAs[key]}
                    onChange={(v) => setSevenA(key, v)}
                    textarea
                  />
                ))}
              </div>
            </SectionCard>

            {/* Offer */}
            <SectionCard
              title={SECTION_LABELS.offer}
              section="offer"
              busy={busy}
              onRegenerate={regenerate}
              onCopy={copySection}
            >
              <Field
                label="Chosen name"
                value={kit.offer.chosenName}
                onChange={(v) => setOffer({ chosenName: v })}
              />
              <div className="mt-3">
                <ListField
                  label="Name options"
                  value={kit.offer.nameOptions}
                  onChange={(v) => setOffer({ nameOptions: v })}
                />
              </div>
              <div className="mt-3">
                <Field
                  label={'Super "I help" statement'}
                  value={kit.offer.iHelpStatement}
                  onChange={(v) => setOffer({ iHelpStatement: v })}
                  textarea
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4 mt-3">
                <Field
                  label="Price"
                  value={kit.offer.price}
                  onChange={(v) => setOffer({ price: v })}
                />
                <div>
                  <ListField
                    label="Payment options"
                    value={kit.offer.paymentOptions}
                    onChange={(v) => setOffer({ paymentOptions: v })}
                  />
                </div>
              </div>
              <div className="mt-3">
                <Field
                  label="Guarantee / risk reversal"
                  value={kit.offer.guarantee}
                  onChange={(v) => setOffer({ guarantee: v })}
                  textarea
                />
              </div>
              <div className="mt-3">
                <ListField
                  label="Appeal add-ons"
                  value={kit.offer.addOns}
                  onChange={(v) => setOffer({ addOns: v })}
                />
              </div>
              <div className="mt-3">
                <Field
                  label="Positioning (who it's for / not for)"
                  value={kit.offer.positioning}
                  onChange={(v) => setOffer({ positioning: v })}
                  textarea
                />
              </div>
            </SectionCard>

            {/* D.I.M.E. problem pillars */}
            <SectionCard
              title={SECTION_LABELS.problems}
              section="problems"
              busy={busy}
              onRegenerate={regenerate}
              onCopy={copySection}
              headerAction={
                <button
                  className={rowBtn}
                  disabled={busy !== null}
                  onClick={() => setProblems([...kit.problems, blankDimeProblem()])}
                >
                  + Add pillar
                </button>
              }
            >
              <div className="space-y-4">
                {kit.problems.map((p, i) => (
                  <div key={i} className="rounded-lg border border-bone/10 bg-black/20 p-3">
                    <Field
                      label={`Pillar ${i + 1} title`}
                      value={p.title}
                      onChange={(v) => {
                        const next = [...kit.problems];
                        next[i] = { ...p, title: v };
                        setProblems(next);
                      }}
                    />
                    <div className="mt-3">
                      <Field
                        label="Problem"
                        value={p.problem}
                        onChange={(v) => {
                          const next = [...kit.problems];
                          next[i] = { ...p, problem: v };
                          setProblems(next);
                        }}
                        textarea
                      />
                    </div>
                    <div className="mt-3">
                      <Field
                        label="Angst"
                        value={p.angst}
                        onChange={(v) => {
                          const next = [...kit.problems];
                          next[i] = { ...p, angst: v };
                          setProblems(next);
                        }}
                        textarea
                      />
                    </div>
                    <div className="mt-3">
                      <Field
                        label="Solution"
                        value={p.solution}
                        onChange={(v) => {
                          const next = [...kit.problems];
                          next[i] = { ...p, solution: v };
                          setProblems(next);
                        }}
                        textarea
                      />
                    </div>
                    <div className="mt-3">
                      <ListField
                        label="Implementation steps"
                        value={p.implementation}
                        onChange={(v) => {
                          const next = [...kit.problems];
                          next[i] = { ...p, implementation: v };
                          setProblems(next);
                        }}
                      />
                    </div>
                    <div className="mt-2 text-right">
                      <button
                        className={rowBtn}
                        disabled={busy !== null}
                        onClick={() => setProblems(kit.problems.filter((_, j) => j !== i))}
                      >
                        Remove pillar
                      </button>
                    </div>
                  </div>
                ))}
                {kit.problems.length === 0 && (
                  <p className="text-xs text-bone/40">No pillars yet.</p>
                )}
              </div>
            </SectionCard>

            {/* Offer script */}
            <SectionCard
              title={SECTION_LABELS.offerScript}
              section="offerScript"
              busy={busy}
              onRegenerate={regenerate}
              onCopy={copySection}
              headerAction={
                <button
                  className={rowBtn}
                  disabled={busy !== null}
                  onClick={() => setOfferScript([...kit.offerScript, blankScriptPillar()])}
                >
                  + Add pillar
                </button>
              }
            >
              <div className="space-y-4">
                {kit.offerScript.map((s, i) => (
                  <div key={i} className="rounded-lg border border-bone/10 bg-black/20 p-3 space-y-2">
                    <input
                      className={inputCls}
                      value={s.label}
                      placeholder={`SCRIPT | PILLAR ${i + 1}`}
                      onChange={(e) => {
                        const next = [...kit.offerScript];
                        next[i] = { ...s, label: e.target.value };
                        setOfferScript(next);
                      }}
                    />
                    <textarea
                      className={`${inputCls} min-h-[120px] resize-y`}
                      value={s.body}
                      onChange={(e) => {
                        const next = [...kit.offerScript];
                        next[i] = { ...s, body: e.target.value };
                        setOfferScript(next);
                      }}
                    />
                    <div className="text-right">
                      <button
                        className={rowBtn}
                        disabled={busy !== null}
                        onClick={() => setOfferScript(kit.offerScript.filter((_, j) => j !== i))}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                {kit.offerScript.length === 0 && (
                  <p className="text-xs text-bone/40">No script pillars yet.</p>
                )}
              </div>
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
  headerAction,
  children,
}: {
  title: string;
  section: KitSection;
  busy: string | null;
  onRegenerate: (s: KitSection) => void;
  onCopy?: (s: KitSection) => void;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={cardCls}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <div className="flex items-center gap-2">
          {headerAction}
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
  selected,
  onToggle,
  onCancel,
  onConfirm,
}: {
  selected: KitSection[];
  onToggle: (s: KitSection) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
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
          Pick the sections to generate. You can regenerate any single section later.
        </p>
        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {KIT_SECTIONS.map((s) => {
            const on = selected.includes(s);
            return (
              <button
                key={s}
                onClick={() => onToggle(s)}
                className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                  on ? 'border-brass/40 bg-brass/[0.10]' : 'border-bone/10 hover:bg-bone/[0.04]'
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
                  <span className="block text-sm font-medium text-bone">{SECTION_LABELS[s]}</span>
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
