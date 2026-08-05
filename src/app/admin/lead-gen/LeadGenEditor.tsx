'use client';

/**
 * Lead Gen Kit editor (client). The full workflow lives here:
 *
 *   1. Pick a format + fill a short intake (AI can flesh it out).
 *   2. Generate the outline (skeleton), or the whole doc in one pass.
 *   3. Expand sections one at a time (best for long-form) and edit any block.
 *   4. Save the kit, then Publish it to Deliverables at a chosen (slug, key).
 *
 * All AI runs server-side via /api/mothermode/leadgen-ai; persistence and
 * publishing via /api/admin/mothermode-leadgen. The doc is a plain LeadGenDoc,
 * so text export uses the shared docToText renderer.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  blankDoc,
  blankIntake,
  blankSection,
  blankBlock,
  DOC_BLOCK_KINDS,
  LEAD_GEN_LENGTHS,
  LEAD_GEN_STATUSES,
  LEAD_MAGNET_FORMATS,
  type DocBlock,
  type DocBlockKind,
  type DocSection,
  type LeadGenDoc,
  type LeadGenIntake,
  type LeadGenKitRecord,
  type LeadGenStatus,
  type LeadMagnetFormat,
} from '@/lib/mothermode/leadgen/types';
import { formatSpec } from '@/lib/mothermode/leadgen/formats';
import { docToDeliverableHtml, docToText } from '@/lib/mothermode/leadgen/export';


const AI_URL = '/api/mothermode/leadgen-ai';
const CRUD_URL = '/api/admin/mothermode-leadgen';

interface Props {
  initialKits: LeadGenKitRecord[];
}

type Busy =
  | null
  | 'fillIntake'
  | 'outline'
  | 'generate'
  | 'save'
  | 'publish'
  | 'delete'
  | `expand:${string}`;

const inputClass =
  'w-full rounded-lg bg-ink/40 border border-bone/15 px-3 py-2 text-sm text-bone placeholder-bone/30 focus:outline-none focus:border-brass/40';
const labelClass = 'block text-xs uppercase tracking-wide text-bone/50 mb-1';
const btn =
  'rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
const btnPrimary = `${btn} bg-brass/[0.14] text-brass border border-brass/30 hover:bg-brass/20`;
const btnGhost = `${btn} text-bone/60 border border-bone/15 hover:text-bone hover:bg-bone/[0.05]`;

export default function LeadGenEditor({ initialKits }: Props) {
  const [kits, setKits] = useState<LeadGenKitRecord[]>(initialKits);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState<LeadGenStatus>('draft');
  const [format, setFormat] = useState<LeadMagnetFormat>('guide');

  const [intake, setIntake] = useState<LeadGenIntake>(blankIntake());
  const [doc, setDoc] = useState<LeadGenDoc>(blankDoc());

  const [publishSlug, setPublishSlug] = useState('');
  const [publishKey, setPublishKey] = useState('');

  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const currentSpec = useMemo(() => formatSpec(format), [format]);
  // Exactly what a buyer sees: the same styled HTML the Publish step stores.
  const previewHtml = useMemo(() => docToDeliverableHtml(doc), [doc]);


  // -- helpers -------------------------------------------------------------

  function resetToNew() {
    setSelectedId(null);
    setName('');
    setSlug('');
    setStatus('draft');
    setFormat('guide');
    setIntake(blankIntake());
    setDoc(blankDoc());
    setPublishSlug('');
    setPublishKey('');
    setError(null);
    setNotice(null);
  }

  function loadKit(kit: LeadGenKitRecord) {
    setSelectedId(kit.id);
    setName(kit.name);
    setSlug(kit.slug);
    setStatus(kit.status);
    setFormat(kit.format);
    setIntake(kit.intake);
    setDoc(kit.doc);
    setPublishSlug(kit.publishedSlug ?? '');
    setPublishKey(kit.publishedKey ?? '');
    setError(null);
    setNotice(null);
  }

  // Deep-link: /admin/lead-gen?kit=<id> opens that kit directly. The prompt
  // bank Test lab "Lead magnet" action lands the admin here after seeding a
  // kit from a tested post.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('kit');
    if (!id) return;
    const kit = initialKits.find((k) => k.id === id);
    if (kit) loadKit(kit);
    // Mount-only: initialKits is the server-rendered list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function postJson(url: string, body: unknown) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      throw new Error(data?.error || `Request failed (HTTP ${res.status})`);
    }
    return data;
  }

  function setIntakeField<K extends keyof LeadGenIntake>(key: K, value: LeadGenIntake[K]) {
    setIntake((prev) => ({ ...prev, [key]: value }));
  }

  function setDocField<K extends keyof LeadGenDoc>(key: K, value: LeadGenDoc[K]) {
    setDoc((prev) => ({ ...prev, [key]: value }));
  }

  // -- AI actions ----------------------------------------------------------

  async function onFillIntake() {
    setBusy('fillIntake');
    setError(null);
    setNotice(null);
    try {
      const data = await postJson(AI_URL, { action: 'fillIntake', intake, format });
      setIntake(data.intake as LeadGenIntake);
      setNotice('Intake filled.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fill failed');
    } finally {
      setBusy(null);
    }
  }

  async function onOutline() {
    setBusy('outline');
    setError(null);
    setNotice(null);
    try {
      const data = await postJson(AI_URL, { action: 'outline', intake, format });
      setDoc(data.doc as LeadGenDoc);
      setNotice('Outline generated. Expand each section next.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Outline failed');
    } finally {
      setBusy(null);
    }
  }

  async function onGenerate() {
    setBusy('generate');
    setError(null);
    setNotice(null);
    try {
      const data = await postJson(AI_URL, { action: 'generate', intake, format });
      setDoc(data.doc as LeadGenDoc);
      setNotice('Full document generated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setBusy(null);
    }
  }

  async function onExpandSection(index: number) {
    const section = doc.sections[index];
    if (!section) return;
    setBusy(`expand:${section.id}`);
    setError(null);
    setNotice(null);
    try {
      const data = await postJson(AI_URL, {
        action: 'expand',
        intake,
        format,
        section,
        sections: doc.sections,
      });
      const filled = data.section as DocSection;
      setDoc((prev) => {
        const next = { ...prev, sections: prev.sections.slice() };
        next.sections[index] = filled;
        return next;
      });
      setNotice(`Expanded “${section.heading || 'section'}”.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Expand failed');
    } finally {
      setBusy(null);
    }
  }

  // -- persistence ---------------------------------------------------------

  async function onSave() {
    if (!slug.trim()) {
      setError('A unique slug is required to save.');
      return;
    }
    setBusy('save');
    setError(null);
    setNotice(null);
    try {
      const data = await postJson(CRUD_URL, {
        action: 'save',
        id: selectedId,
        slug,
        name,
        format,
        status,
        intake,
        doc,
      });
      const saved = data.item as LeadGenKitRecord;
      setKits((prev) => {
        const rest = prev.filter((k) => k.id !== saved.id);
        return [saved, ...rest];
      });
      setSelectedId(saved.id);
      setNotice('Saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(null);
    }
  }

  async function onPublish() {
    if (!selectedId) {
      setError('Save the kit before publishing.');
      return;
    }
    if (!publishSlug.trim() || !publishKey.trim()) {
      setError('Publish slug and key are required.');
      return;
    }
    setBusy('publish');
    setError(null);
    setNotice(null);
    try {
      await postJson(CRUD_URL, {
        action: 'publish',
        id: selectedId,
        publishedSlug: publishSlug,
        publishedKey: publishKey,
      });
      setKits((prev) =>
        prev.map((k) =>
          k.id === selectedId
            ? { ...k, publishedSlug: publishSlug, publishedKey: publishKey }
            : k,
        ),
      );
      setNotice(
        `Published to /mothermode/resource/${publishSlug.trim()}/${publishKey.trim()}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setBusy(null);
    }
  }

  async function onDelete() {
    if (!selectedId) return;
    if (!confirm('Delete this lead-gen kit? This cannot be undone.')) return;
    setBusy('delete');
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${CRUD_URL}?id=${encodeURIComponent(selectedId)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Delete failed');
      }
      setKits((prev) => prev.filter((k) => k.id !== selectedId));
      resetToNew();
      setNotice('Deleted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(null);
    }
  }

  function onCopyText() {
    const text = docToText(doc);
    navigator.clipboard?.writeText(text).then(
      () => setNotice('Document text copied.'),
      () => setError('Copy failed.'),
    );
  }

  // -- section / block mutators -------------------------------------------

  function updateSection(index: number, patch: Partial<DocSection>) {
    setDoc((prev) => {
      const sections = prev.sections.slice();
      sections[index] = { ...sections[index], ...patch };
      return { ...prev, sections };
    });
  }

  function addSection() {
    setDoc((prev) => ({ ...prev, sections: [...prev.sections, blankSection()] }));
  }

  function removeSection(index: number) {
    setDoc((prev) => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== index),
    }));
  }

  function moveSection(index: number, dir: -1 | 1) {
    setDoc((prev) => {
      const sections = prev.sections.slice();
      const target = index + dir;
      if (target < 0 || target >= sections.length) return prev;
      [sections[index], sections[target]] = [sections[target], sections[index]];
      return { ...prev, sections };
    });
  }

  function updateBlock(sIndex: number, bIndex: number, patch: Partial<DocBlock>) {
    setDoc((prev) => {
      const sections = prev.sections.slice();
      const blocks = sections[sIndex].blocks.slice();
      blocks[bIndex] = { ...blocks[bIndex], ...patch };
      sections[sIndex] = { ...sections[sIndex], blocks };
      return { ...prev, sections };
    });
  }

  function addBlock(sIndex: number) {
    setDoc((prev) => {
      const sections = prev.sections.slice();
      sections[sIndex] = {
        ...sections[sIndex],
        blocks: [...sections[sIndex].blocks, blankBlock('p')],
      };
      return { ...prev, sections };
    });
  }

  function removeBlock(sIndex: number, bIndex: number) {
    setDoc((prev) => {
      const sections = prev.sections.slice();
      sections[sIndex] = {
        ...sections[sIndex],
        blocks: sections[sIndex].blocks.filter((_, i) => i !== bIndex),
      };
      return { ...prev, sections };
    });
  }

  // -- render --------------------------------------------------------------

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
      {/* Saved kits list */}
      <div className="space-y-2">
        <button className={`${btnPrimary} w-full`} onClick={resetToNew}>
          + New kit
        </button>
        <div className="space-y-1 mt-3">
          {kits.length === 0 && (
            <div className="text-xs text-bone/40 px-1">No saved kits yet.</div>
          )}
          {kits.map((kit) => (
            <button
              key={kit.id}
              onClick={() => loadKit(kit)}
              className={`w-full text-left rounded-lg px-3 py-2 text-sm border transition-colors ${
                selectedId === kit.id
                  ? 'bg-brass/[0.12] text-brass border-brass/25'
                  : 'text-bone/60 border-transparent hover:bg-bone/[0.05]'
              }`}
            >
              <div className="font-medium truncate">{kit.name || kit.slug}</div>
              <div className="text-[11px] text-bone/40">
                {formatSpec(kit.format).label} · {kit.status}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="space-y-8 min-w-0">
        {(error || notice) && (
          <div
            className={`rounded-lg px-4 py-2 text-sm border ${
              error
                ? 'border-red-500/40 text-red-300 bg-red-500/10'
                : 'border-brass/30 text-brass bg-brass/[0.08]'
            }`}
          >
            {error || notice}
          </div>
        )}

        {/* Meta */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Internal name</label>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 7-Day Client Attraction Guide"
            />
          </div>
          <div>
            <label className={labelClass}>Slug (unique)</label>
            <input
              className={inputClass}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="client-attraction-guide"
            />
          </div>
          <div>
            <label className={labelClass}>Format</label>
            <select
              className={inputClass}
              value={format}
              onChange={(e) => setFormat(e.target.value as LeadMagnetFormat)}
            >
              {LEAD_MAGNET_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {formatSpec(f).label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-bone/40 mt-1">{currentSpec.hint}</p>
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select
              className={inputClass}
              value={status}
              onChange={(e) => setStatus(e.target.value as LeadGenStatus)}
            >
              {LEAD_GEN_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Intake */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Intake brief</h2>
            <button
              className={btnGhost}
              onClick={onFillIntake}
              disabled={busy !== null}
            >
              {busy === 'fillIntake' ? 'Filling…' : 'AI: fill intake'}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Topic" value={intake.topic} onChange={(v) => setIntakeField('topic', v)} />
            <Field label="Audience" value={intake.audience} onChange={(v) => setIntakeField('audience', v)} />
            <Field label="Lead-gen goal" value={intake.goal} onChange={(v) => setIntakeField('goal', v)} />
            <Field
              label="Transformation"
              value={intake.transformation}
              onChange={(v) => setIntakeField('transformation', v)}
            />
            <div>
              <label className={labelClass}>Length</label>
              <select
                className={inputClass}
                value={intake.length}
                onChange={(e) => setIntakeField('length', e.target.value)}
              >
                {LEAD_GEN_LENGTHS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <Field label="Tone / voice" value={intake.tone} onChange={(v) => setIntakeField('tone', v)} />
            <Field label="Call to action" value={intake.cta} onChange={(v) => setIntakeField('cta', v)} />
            <Field
              label="Offer slug (optional)"
              value={intake.offerSlug}
              onChange={(v) => setIntakeField('offerSlug', v)}
            />
          </div>
          <div>
            <label className={labelClass}>Notes</label>
            <textarea
              className={`${inputClass} min-h-[70px]`}
              value={intake.notes}
              onChange={(e) => setIntakeField('notes', e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={btnPrimary} onClick={onOutline} disabled={busy !== null}>
              {busy === 'outline' ? 'Generating…' : 'Generate outline'}
            </button>
            <button className={btnPrimary} onClick={onGenerate} disabled={busy !== null}>
              {busy === 'generate' ? 'Generating…' : 'Generate full document'}
            </button>
          </div>
        </section>

        {/* Document */}
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold">Document</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Title" value={doc.title} onChange={(v) => setDocField('title', v)} />
            <Field label="Subtitle" value={doc.subtitle} onChange={(v) => setDocField('subtitle', v)} />
          </div>
          <div>
            <label className={labelClass}>Hook / intro</label>
            <textarea
              className={`${inputClass} min-h-[70px]`}
              value={doc.hook}
              onChange={(e) => setDocField('hook', e.target.value)}
            />
          </div>
          <Field
            label="Cover image URL (optional)"
            value={doc.coverImageUrl}
            onChange={(v) => setDocField('coverImageUrl', v)}
          />

          {/* Sections */}
          <div className="space-y-5">
            {doc.sections.map((section, sIndex) => (
              <div
                key={section.id}
                className="rounded-xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-wide text-bone/40">
                    Section {sIndex + 1}
                  </span>
                  <div className="flex gap-1">
                    <button className={btnGhost} onClick={() => moveSection(sIndex, -1)}>
                      ↑
                    </button>
                    <button className={btnGhost} onClick={() => moveSection(sIndex, 1)}>
                      ↓
                    </button>
                    <button
                      className={btnGhost}
                      onClick={() => onExpandSection(sIndex)}
                      disabled={busy !== null}
                    >
                      {busy === `expand:${section.id}` ? 'Expanding…' : 'AI: expand'}
                    </button>
                    <button className={btnGhost} onClick={() => removeSection(sIndex)}>
                      Remove
                    </button>
                  </div>
                </div>
                <Field
                  label="Heading"
                  value={section.heading}
                  onChange={(v) => updateSection(sIndex, { heading: v })}
                />
                <Field
                  label="Summary"
                  value={section.summary}
                  onChange={(v) => updateSection(sIndex, { summary: v })}
                />

                {/* Blocks */}
                <div className="space-y-2">
                  {section.blocks.map((block, bIndex) => (
                    <BlockEditor
                      key={bIndex}
                      block={block}
                      onChange={(patch) => updateBlock(sIndex, bIndex, patch)}
                      onRemove={() => removeBlock(sIndex, bIndex)}
                    />
                  ))}
                  <button className={btnGhost} onClick={() => addBlock(sIndex)}>
                    + Add block
                  </button>
                </div>

                {section.lessons && section.lessons.length > 0 && (
                  <div className="text-[11px] text-bone/40">
                    {section.lessons.length} lesson(s) generated (course format).
                  </div>
                )}
              </div>
            ))}
            <button className={btnGhost} onClick={addSection}>
              + Add section
            </button>
          </div>

          {/* CTA */}
          <div className="rounded-xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 p-4 space-y-3">
            <span className="text-xs uppercase tracking-wide text-bone/40">Call to action</span>
            <Field
              label="CTA title"
              value={doc.cta.title}
              onChange={(v) => setDocField('cta', { ...doc.cta, title: v })}
            />
            <div>
              <label className={labelClass}>CTA body</label>
              <textarea
                className={`${inputClass} min-h-[60px]`}
                value={doc.cta.body}
                onChange={(e) => setDocField('cta', { ...doc.cta, body: e.target.value })}
              />
            </div>
            <Field
              label="Button label"
              value={doc.cta.button}
              onChange={(v) => setDocField('cta', { ...doc.cta, button: v })}
            />
          </div>
        </section>

        {/* Actions */}
        <section className="space-y-4 border-t border-bone/10 pt-6">
          <div className="flex flex-wrap gap-2">
            <button className={btnPrimary} onClick={onSave} disabled={busy !== null}>
              {busy === 'save' ? 'Saving…' : 'Save kit'}
            </button>
            <button className={btnGhost} onClick={onCopyText} disabled={busy !== null}>
              Copy text
            </button>
            <button className={btnGhost} onClick={() => setShowPreview((v) => !v)}>
              {showPreview ? 'Hide styled preview' : 'Styled preview'}
            </button>

            {selectedId && (
              <button className={btnGhost} onClick={onDelete} disabled={busy !== null}>
                {busy === 'delete' ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>

          <div className="rounded-xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 p-4 space-y-3">
            <span className="text-xs uppercase tracking-wide text-bone/40">
              Publish to Deliverables
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Offer slug"
                value={publishSlug}
                onChange={setPublishSlug}
              />
              <Field label="Resource key" value={publishKey} onChange={setPublishKey} />
            </div>
            <button className={btnPrimary} onClick={onPublish} disabled={busy !== null}>
              {busy === 'publish' ? 'Publishing…' : 'Publish document'}
            </button>
            <p className="text-[11px] text-bone/40">
              Renders the current document to brand-styled HTML and stores it for
              buyers at /mothermode/resource/&lt;slug&gt;/&lt;key&gt;. Save first.
            </p>
          </div>
        </section>

        {/* Styled preview — exactly what a buyer sees after publishing */}
        {showPreview && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">Styled preview</h2>
              <span className="text-[11px] text-bone/40">
                Buyer-facing render · {doc.sections.length} section(s)
              </span>
            </div>
            <div className="rounded-xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 overflow-hidden">
              <div
                className="bg-white overflow-y-auto max-h-[70vh] py-8"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Small sub-components
// ---------------------------------------------------------------------------

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function BlockEditor({
  block,
  onChange,
  onRemove,
}: {
  block: DocBlock;
  onChange: (patch: Partial<DocBlock>) => void;
  onRemove: () => void;
}) {
  const usesItems = block.kind === 'ul' || block.kind === 'checklist';
  const usesTitle =
    block.kind === 'note' || block.kind === 'nextStep' || block.kind === 'template';

  return (
    <div className="rounded-lg border border-bone/10 bg-ink/40 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <select
          className={`${inputClass} max-w-[160px]`}
          value={block.kind}
          onChange={(e) => onChange({ kind: e.target.value as DocBlockKind })}
        >
          {DOC_BLOCK_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <button className={btnGhost} onClick={onRemove}>
          ✕
        </button>
      </div>

      {usesTitle && (
        <input
          className={inputClass}
          placeholder="Label / title"
          value={block.title ?? ''}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      )}

      {usesItems ? (
        <textarea
          className={`${inputClass} min-h-[70px]`}
          placeholder="One item per line"
          value={(block.items ?? []).join('\n')}
          onChange={(e) =>
            onChange({ items: e.target.value.split('\n').map((s) => s) })
          }
        />
      ) : (
        <textarea
          className={`${inputClass} min-h-[70px]`}
          placeholder="Text"
          value={block.text ?? ''}
          onChange={(e) => onChange({ text: e.target.value })}
        />
      )}
    </div>
  );
}
