'use client';

/**
 * Email Marketing Kit editor (admin, client component).
 *
 * Left rail: saved kits + "new". Main column: intake, campaign/framework
 * pickers, attached context sources, and the generated sequence. The heavy work
 * runs server-side:
 *   - POST /api/mothermode/email-ai  (fillIntake | outline | expand | generate)
 *   - POST/DELETE /api/admin/mothermode-email  (persist / remove)
 *
 * The plain-text body of each email is the source of truth; the copy buttons use
 * the shared pure renderers so what you copy matches what is saved.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  allCampaigns,
  allFrameworks,
  EMAIL_CAMPAIGN_SPECS,
  EMAIL_FRAMEWORK_SPECS,
  EMAIL_ROLES,
  EMAIL_TIMING_STYLES,
  blankIntake,
  blankSequence,
  makeEmailId,
  makeAbVariantId,
  blankEmail,

  EMAIL_BRANCH_CONDITIONS,
  EMAIL_PS_FRAMEWORKS,
  EMAIL_PS_FRAMEWORK_LABELS,
  sequenceToText,

  sequenceToHtml,
  EMAIL_MERGE_TOKENS,
  EMAIL_TRIGGER_LABELS,
  EMAIL_TRIGGER_DESCRIPTIONS,
  emailTriggerGroups,
  emailTriggerLocationLabel,
  emailTriggerCategory,
  emailTriggerLabel,
  resolveTriggerLocationLabel,
  resolveTriggerBindingLabel,
  EMAIL_FUNNEL_PAGE_LABELS,



  type EmailKitRecord,
  type EmailTriggerEvent,
  type EmailFunnelPage,
  type EmailTriggerConfig,
  type EmailAbTest,


  type EmailKitIntake,
  type EmailCampaignType,
  type EmailFramework,
  type EmailKitStatus,
  type EmailMessage,
  type EmailRole,
  type EmailSequence,
  type EmailBranchCondition,
  type EmailPsFramework,
} from '@/lib/mothermode/email';

import {
  CONTEXT_SOURCE_KINDS,
  isInlineContextKind,
  type ContextRef,
  type ContextSourceKind,
  type ContextSourceOption,
} from '@/lib/mothermode/context';
import {
  KitRichTextField,
  type RichTextToken,
} from '@/components/mothermode/context/KitRichTextField';
import EmailImageStudio from '@/components/mothermode/email/EmailImageStudio';
import EmailFlowPanel from '@/components/mothermode/email/EmailFlowPanel';
import EmailPreviewModal from '@/components/mothermode/email/EmailPreviewModal';

import {
  customTokenValues,
  type CustomToken,
} from '@/lib/mothermode/email/customTokens';



interface Props {
  initialKits: EmailKitRecord[];
  /** Selectable offers/kits (real names) for the attached-context picker. */
  sources?: ContextSourceOption[];
}

type Busy = null | 'generate' | 'outline' | 'intake' | 'save' | 'delete' | string;

const KIND_LABEL: Record<ContextSourceKind, string> = {
  offer: 'Offer',
  'offer-bonuses': 'Offer bonuses',
  'community-kit': 'Community kit',
  'high-ticket-kit': 'High-ticket kit',
  'lead-gen-kit': 'Lead-gen kit',
  'email-kit': 'Email kit',
  'brand-bible': 'Brand Bible',
  link: 'Link (URL)',
  text: 'Free text',
};


function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Append an image at the end of the email body as its own paragraph. Used by the
 * Image Studio's "Insert into body" action; the controlled `KitRichTextField`
 * repaints from the new `value`, so no imperative editor handle is required.
 */
function appendImageToBody(body: string, src: string): string {
  const img = `<img src="${src}" alt="" />`;
  const current = (body || '').trim();
  if (!current) return `<p>${img}</p>`;
  return `${body}<p>${img}</p>`;
}

export default function EmailKitEditor({ initialKits, sources = [] }: Props) {

  const [kits, setKits] = useState<EmailKitRecord[]>(initialKits);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialKits[0]?.id ?? null,
  );
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Editable form state.
  const [slug, setSlug] = useState('');
  // Whether the admin has hand-edited the slug. While false, the slug auto-
  // follows the name (slugified) so a slug is always applied without manual work.
  const [slugTouched, setSlugTouched] = useState(false);
  const [name, setName] = useState('');

  const [status, setStatus] = useState<EmailKitStatus>('draft');
  const [campaignType, setCampaignType] =
    useState<EmailCampaignType>('nurture-to-offer');
  const [framework, setFramework] = useState<EmailFramework>('story-lesson');
  const [intake, setIntake] = useState<EmailKitIntake>(blankIntake());
  const [contextRefs, setContextRefs] = useState<ContextRef[]>([]);
  const [sequence, setSequence] = useState<EmailSequence>(blankSequence());
  // Whether AI writes bodies as plain text or lightly-formatted HTML (bold,
  // bullets). Both are sanitized to clean text wherever they feed a prompt.
  const [bodyFormat, setBodyFormat] = useState<'text' | 'html'>('text');
  // Whether AI aims for the framework's default length, a tight short-form, or
  // a fuller long-form email. Applies to both full generation and per-email
  // rewrites (it rides along in every callAi payload).
  const [bodyLength, setBodyLength] = useState<'default' | 'short' | 'long'>(
    'default',
  );
  // Per-email length overrides (by email id). Falls back to the global
  // bodyLength when an email has no explicit override.
  const [emailLength, setEmailLength] = useState<
    Record<string, 'default' | 'short' | 'long'>
  >({});
  // "Extend sequence" controls: how many emails to append and in what mode.
  const [extendCount, setExtendCount] = useState(3);
  const [extendMode, setExtendMode] = useState<
    'deep-nurture' | 'continue' | 'reengage'
  >('deep-nurture');

  // Admin-defined custom merge tokens (loaded once). These merge into the body
  // editor's Tokens dropdown alongside the static EMAIL_MERGE_TOKENS, and their
  // default values resolve at export via applyEmailTokens.
  const [customTokens, setCustomTokens] = useState<CustomToken[]>([]);
  const [tokenDraft, setTokenDraft] = useState({
    key: '',
    label: '',
    defaultValue: '',
  });
  const [tokenBusy, setTokenBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/mothermode-custom-tokens')
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && Array.isArray(j?.items)) {
          setCustomTokens(j.items as CustomToken[]);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Merge the static catalog + custom tokens into the shape the editor wants.
  const bodyTokens = useMemo<RichTextToken[]>(() => {
    const base: RichTextToken[] = EMAIL_MERGE_TOKENS.map((t) => ({
      token: t.token,
      label: t.label,
      description: t.description,
    }));
    const custom: RichTextToken[] = customTokens.map((t) => ({
      token: `{{${t.key}}}`,
      label: t.label,
      description:
        t.description || `Custom token (default: ${t.defaultValue || '—'})`,
    }));
    return [...base, ...custom];
  }, [customTokens]);

  async function saveCustomToken() {
    if (!tokenDraft.key.trim() || !tokenDraft.label.trim()) {
      setError('A custom token needs a key and a label.');
      return;
    }
    setTokenBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/mothermode-custom-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tokenDraft),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Save failed');
      const saved = json.item as CustomToken;
      setCustomTokens((prev) =>
        [...prev.filter((t) => t.id !== saved.id), saved].sort((a, b) =>
          a.key.localeCompare(b.key),
        ),
      );
      setTokenDraft({ key: '', label: '', defaultValue: '' });
      setNotice(`Saved token {{${saved.key}}}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save token.');
    } finally {
      setTokenBusy(false);
    }
  }

  async function removeCustomToken(id: string) {
    setTokenBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/mothermode-custom-tokens?id=${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Delete failed');
      setCustomTokens((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete token.');
    } finally {
      setTokenBusy(false);
    }
  }
  // Which email's Image Studio is open (email id), or null when closed.
  const [imageFor, setImageFor] = useState<string | null>(null);
  // Whether the read-only sequence flow canvas is open.
  const [flowOpen, setFlowOpen] = useState(false);
  // Which email the inbox-preview modal is open for (email id), or null.
  const [previewFor, setPreviewFor] = useState<string | null>(null);

  /**
   * Close the flow view and scroll the clicked email's card into view, giving
   * it a brief highlight so the admin can see which node they picked.
   */
  function focusEmailCard(emailId: string) {
    setFlowOpen(false);
    requestAnimationFrame(() => {
      const el = document.getElementById(`email-card-${emailId}`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-brass');
      setTimeout(() => el.classList.remove('ring-2', 'ring-brass'), 1600);
    });
  }




  const isNew = selectedId === null;

  function loadKit(kit: EmailKitRecord) {
    setSelectedId(kit.id);
    setSlug(kit.slug);
    setSlugTouched(true);
    setName(kit.name);

    setStatus(kit.status);
    setCampaignType(kit.campaignType);
    setFramework(kit.framework);
    setIntake(kit.intake);
    setContextRefs(kit.contextRefs);
    setSequence(kit.sequence);
    setError(null);
    setNotice(null);
  }

  function startNew() {
    setSelectedId(null);
    setSlug('');
    setName('');
    setStatus('draft');
    setCampaignType('nurture-to-offer');
    setFramework('story-lesson');
    setIntake(blankIntake());
    setContextRefs([]);
    setSequence(blankSequence());
    setError(null);
    setNotice(null);
  }

  const campaign = EMAIL_CAMPAIGN_SPECS[campaignType];

  function patchIntake(patch: Partial<EmailKitIntake>) {
    setIntake((prev) => ({ ...prev, ...patch }));
  }

  function patchEmail(id: string, patch: Partial<EmailMessage>) {
    setSequence((prev) => ({
      ...prev,
      emails: prev.emails.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  }

  /**
   * Merge a patch into the sequence's trigger mapping, dropping any keys that
   * become empty and clearing the whole config when nothing is set. Shared by
   * the editor's waterfall dropdowns and the flow-canvas trigger node.
   */
  function patchTriggerConfig(patch: Partial<EmailTriggerConfig>) {
    setSequence((prev) => {
      const tc: EmailTriggerConfig = { ...(prev.triggerConfig ?? {}), ...patch };
      (Object.keys(tc) as (keyof EmailTriggerConfig)[]).forEach((k) => {
        if (!tc[k]) delete tc[k];
      });
      const any = tc.funnelPage || tc.offerSlug || tc.contentRef || tc.note;
      return { ...prev, triggerConfig: any ? tc : undefined };
    });
  }


  // ----- API helpers --------------------------------------------------------

  async function callAi(action: string, extra: Record<string, unknown>) {
    const res = await fetch('/api/mothermode/email-ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action,
        intake,
        campaignType,
        framework,
        contextRefs,
        bodyFormat,
        bodyLength,
        ...extra,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      throw new Error(json.error || `Request failed (HTTP ${res.status}).`);
    }
    return json;
  }

  async function handleFillIntake() {
    setBusy('intake');
    setError(null);
    try {
      const json = await callAi('fillIntake', {});
      setIntake(json.intake);
      setNotice('Intake completed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete intake.');
    } finally {
      setBusy(null);
    }
  }

  async function handleOutline() {
    setBusy('outline');
    setError(null);
    try {
      const json = await callAi('outline', {});
      setSequence(json.sequence);
      setNotice('Outline generated. Expand any email to write its body.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to outline.');
    } finally {
      setBusy(null);
    }
  }

  async function handleGenerate() {
    setBusy('generate');
    setError(null);
    try {
      const json = await callAi('generate', {});
      setSequence(json.sequence);
      if (!name.trim() && json.sequence?.name) setName(json.sequence.name);
      if (!slug.trim() && json.sequence?.name) setSlug(slugify(json.sequence.name));
      setNotice('Full sequence generated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate.');
    } finally {
      setBusy(null);
    }
  }

  async function handleExpand(email: EmailMessage) {
    setBusy(`expand-${email.id}`);
    setError(null);
    try {
      const json = await callAi('expand', {
        email,
        emails: sequence.emails,
        bodyLength: emailLength[email.id] ?? bodyLength,
      });
      patchEmail(email.id, json.email);
      setNotice(`Rewrote email ${email.id}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to expand email.');
    } finally {
      setBusy(null);
    }
  }

  function handleAddEmail() {
    // Append a blank email on the linear trunk; the admin can then "Write body"
    // to fill it with full look-back over the existing sequence.
    setSequence((prev) => ({
      ...prev,
      emails: [...prev.emails, { ...blankEmail(), framework }],
    }));
    setNotice('Added a blank email. Use "Write body" to fill it.');
  }

  async function handleExtend() {
    if (sequence.emails.length === 0) {
      setError('Generate or outline a sequence before extending it.');
      return;
    }
    setBusy('extend');
    setError(null);
    try {
      const json = await callAi('extend', {
        emails: sequence.emails,
        count: extendCount,
        mode: extendMode,
      });
      const added: EmailMessage[] = Array.isArray(json.emails) ? json.emails : [];
      setSequence((prev) => ({ ...prev, emails: [...prev.emails, ...added] }));
      setNotice(`Added ${added.length} email${added.length === 1 ? '' : 's'}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extend sequence.');
    } finally {
      setBusy(null);
    }
  }

  async function handleSave() {
    if (!slug.trim()) {
      setError('A slug is required to save.');
      return;
    }
    setBusy('save');
    setError(null);
    try {
      const res = await fetch('/api/admin/mothermode-email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: selectedId ?? undefined,
          slug: slug.trim(),
          name,
          campaignType,
          framework,
          status,
          intake,
          contextRefs,
          sequence,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Save failed (HTTP ${res.status}).`);
      }
      const saved = json.item as EmailKitRecord;
      setKits((prev) => {
        const rest = prev.filter((k) => k.id !== saved.id);
        return [saved, ...rest];
      });
      loadKit(saved);
      setNotice('Saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (!selectedId) {
      startNew();
      return;
    }
    if (!confirm('Delete this email kit? This cannot be undone.')) return;
    setBusy('delete');
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/mothermode-email?id=${encodeURIComponent(selectedId)}`,
        { method: 'DELETE' },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Delete failed (HTTP ${res.status}).`);
      }
      setKits((prev) => prev.filter((k) => k.id !== selectedId));
      startNew();
      setNotice('Deleted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setBusy(null);
    }
  }

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${label} copied to clipboard.`);
    } catch {
      setError('Clipboard copy failed.');
    }
  }

  // ----- context refs -------------------------------------------------------

  function addRef() {
    setContextRefs((prev) => [...prev, { kind: 'offer', id: '' }]);
  }
  function patchRef(index: number, patch: Partial<ContextRef>) {
    setContextRefs((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
  }
  function removeRef(index: number) {
    setContextRefs((prev) => prev.filter((_, i) => i !== index));
  }

  // Custom-token default values, resolved into copy/export output. Standard ESP
  // tokens (first_name, etc.) have no value here so they stay intact for send-time.
  const tokenValues = useMemo(
    () => customTokenValues(customTokens),
    [customTokens],
  );
  const plainText = useMemo(
    () => sequenceToText(sequence, tokenValues),
    [sequence, tokenValues],
  );

  // ----- render -------------------------------------------------------------

  const inputClass =
    'w-full rounded-lg bg-ink/40 border border-bone/15 px-3 py-2 text-sm text-bone placeholder:text-bone/30 focus:outline-none focus:border-brass/60';
  const labelClass =
    'block text-xs uppercase tracking-wider text-bone/50 mb-1 font-semibold';
  const btn =
    'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed';
  const btnPrimary = `${btn} bg-brass text-ink hover:bg-brass/90`;
  const btnGhost = `${btn} border border-bone/20 text-bone hover:border-brass/50`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
      {/* Left rail */}
      <aside className="space-y-2">
        <button className={`${btnPrimary} w-full justify-center`} onClick={startNew}>
          + New sequence
        </button>
        <div className="mt-3 space-y-1">
          {kits.length === 0 && (
            <p className="text-xs text-bone/40 px-1">No saved sequences yet.</p>
          )}
          {kits.map((kit) => (
            <button
              key={kit.id}
              onClick={() => loadKit(kit)}
              className={`w-full text-left rounded-lg px-3 py-2 text-sm transition border ${
                kit.id === selectedId
                  ? 'border-brass/60 bg-brass/10 text-bone'
                  : 'border-transparent hover:bg-ink/40 text-bone/70'
              }`}
            >
              <div className="font-medium truncate">{kit.name || kit.slug}</div>
              <div className="text-[11px] text-bone/40 flex items-center gap-1">
                <span>{EMAIL_CAMPAIGN_SPECS[kit.campaignType]?.label}</span>
                <span>·</span>
                <span className="uppercase">{kit.status}</span>
                <span>·</span>
                <span>{kit.sequence.emails.length} emails</span>
              </div>
              {/* Context/resource badges: which sources this sequence supports. */}
              {kit.contextRefs.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {kit.contextRefs.slice(0, 3).map((ref, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center rounded-full border border-brass/30 bg-brass/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brass/90"
                      title={ref.label || KIND_LABEL[ref.kind]}
                    >
                      {ref.label || KIND_LABEL[ref.kind]}
                    </span>
                  ))}
                  {kit.contextRefs.length > 3 && (
                    <span className="text-[9px] text-bone/40 self-center">
                      +{kit.contextRefs.length - 3}
                    </span>
                  )}
                </div>
              )}
            </button>

          ))}
        </div>
      </aside>

      {/* Main column */}
      <main className="space-y-6">
        {(error || notice) && (
          <div
            className={`rounded-lg px-4 py-2 text-sm ${
              error
                ? 'bg-red-500/10 border border-red-500/40 text-red-300'
                : 'bg-emerald-500/10 border border-emerald-500/40 text-emerald-300'
            }`}
          >
            {error || notice}
          </div>
        )}

        {/* Identity + status */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-bone/10 bg-ink/30 p-4">
          <div>
            <label className={labelClass}>Name</label>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => {
                const next = e.target.value;
                setName(next);
                // Until the admin hand-edits the slug, keep it auto-applied from
                // the name so a valid slug is always present at save time.
                if (!slugTouched) setSlug(slugify(next));
              }}
              placeholder="e.g. Free Guide → Starter Offer"
            />

          </div>
          <div>
            <label className={labelClass}>Slug</label>
            <input
              className={inputClass}
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              onBlur={() => slug && setSlug(slugify(slug))}
              placeholder="auto-filled from name"

            />
          </div>
          <div>
            <label className={labelClass}>Campaign type</label>
            <select
              className={inputClass}
              value={campaignType}
              onChange={(e) => setCampaignType(e.target.value as EmailCampaignType)}
            >
              {allCampaigns().map((c) => (
                <option key={c} value={c}>
                  {EMAIL_CAMPAIGN_SPECS[c].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Default framework</label>
            <select
              className={inputClass}
              value={framework}
              onChange={(e) => setFramework(e.target.value as EmailFramework)}
            >
              {allFrameworks().map((f) => (
                <option key={f} value={f}>
                  {EMAIL_FRAMEWORK_SPECS[f].label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 text-xs text-bone/50">
            <span className="text-brass/80 font-semibold">Arc:</span>{' '}
            {campaign.emailRoles.join(' → ')}
            <div className="mt-1 text-bone/40">{campaign.strategyNote}</div>
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select
              className={inputClass}
              value={status}
              onChange={(e) => setStatus(e.target.value as EmailKitStatus)}
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Enrollment trigger</label>
            <select
              className={inputClass}
              value={sequence.trigger}
              onChange={(e) =>
                setSequence((prev) => ({
                  ...prev,
                  trigger: e.target.value as EmailTriggerEvent,
                }))
              }
              title={EMAIL_TRIGGER_DESCRIPTIONS[sequence.trigger]}
            >
              {emailTriggerGroups().map((group) => (
                <optgroup key={group.category} label={group.label}>
                  {group.events.map((t) => (
                    <option key={t} value={t}>
                      {EMAIL_TRIGGER_LABELS[t]}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-bone/40">
              <span className="rounded bg-brass/15 px-1.5 py-0.5 font-semibold text-brass/90">
                Fires: {emailTriggerLocationLabel(sequence.trigger)}
              </span>
              <span>{EMAIL_TRIGGER_DESCRIPTIONS[sequence.trigger]}</span>
            </p>

            {/* Editable trigger mapping — cascading (waterfall) dropdowns that
                bind the enrollment event to a real funnel page + offer (funnel
                triggers) or a content asset (content triggers). No free-text
                slugs/ids. Writes back through the existing save path. The same
                dropdowns appear on the flow canvas trigger node. */}
            <div className="mt-3 space-y-3 rounded-lg border border-bone/10 bg-ink/40 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-bone/40">
                Trigger mapping (optional)
              </div>
              {/* Plain-language wiring summary — reads the mapping back as a
                  sentence so the admin can confirm the enrollment at a glance
                  without decoding the dropdowns. */}
              <p className="rounded-md bg-ink/50 px-2.5 py-1.5 text-[11px] leading-relaxed text-bone/60">
                When{' '}
                <span className="font-semibold text-brass/90">
                  {emailTriggerLabel(sequence.trigger)}
                </span>{' '}
                fires on{' '}
                <span className="font-semibold text-bone/80">
                  {resolveTriggerLocationLabel(
                    sequence.trigger,
                    sequence.triggerConfig,
                  )}
                </span>
                {(() => {
                  const binding = resolveTriggerBindingLabel(
                    sequence.trigger,
                    sequence.triggerConfig,
                  );
                  return binding ? (
                    <>
                      {' '}
                      (
                      <span className="font-semibold text-bone/80">
                        {binding}
                      </span>
                      )
                    </>
                  ) : null;
                })()}
                , enroll the subscriber into this sequence.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {emailTriggerCategory(sequence.trigger) === 'funnel' ? (
                  <>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-medium text-bone/50">
                        Funnel page
                      </span>
                      <select
                        className={inputClass}
                        value={sequence.triggerConfig?.funnelPage ?? ''}
                        title="Which funnel page this enrollment event fires on."
                        onChange={(e) =>
                          patchTriggerConfig({
                            funnelPage: (e.target.value || undefined) as
                              | EmailFunnelPage
                              | undefined,
                          })
                        }
                      >
                        <option value="">
                          Default ({emailTriggerLocationLabel(sequence.trigger)})
                        </option>
                        {(
                          Object.entries(EMAIL_FUNNEL_PAGE_LABELS) as [
                            EmailFunnelPage,
                            string,
                          ][]
                        ).map(([page, label]) => (
                          <option key={page} value={page}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-medium text-bone/50">
                        Offer
                      </span>
                      <select
                        className={inputClass}
                        value={sequence.triggerConfig?.offerSlug ?? ''}
                        title="Which offer this enrollment event is tied to."
                        onChange={(e) =>
                          patchTriggerConfig({
                            offerSlug: e.target.value || undefined,
                          })
                        }
                      >
                        <option value="">No specific offer</option>
                        {sources
                          .filter(
                            (s) =>
                              s.kind === 'offer' || s.kind === 'offer-bonuses',
                          )
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                      </select>
                    </label>
                  </>
                ) : (
                  <label className="flex flex-col gap-1 sm:col-span-2">
                    <span className="text-[11px] font-medium text-bone/50">
                      Content asset
                    </span>
                    <select
                      className={inputClass}
                      value={sequence.triggerConfig?.contentRef ?? ''}
                      title="Which content asset this event is tied to."
                      onChange={(e) =>
                        patchTriggerConfig({
                          contentRef: e.target.value || undefined,
                        })
                      }
                    >
                      <option value="">No specific asset</option>
                      {sources
                        .filter((s) => s.kind !== 'link' && s.kind !== 'text')
                        .map((s) => (
                          <option key={`${s.kind}:${s.id}`} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-[11px] font-medium text-bone/50">
                    Canvas note
                  </span>
                  <select
                    className={inputClass}
                    value={sequence.triggerConfig?.note ?? ''}
                    title="Optional note shown on the canvas (e.g. the GHL workflow this maps to)."
                    onChange={(e) =>
                      patchTriggerConfig({ note: e.target.value || undefined })
                    }
                  >
                    <option value="">No note</option>
                    {sources
                      .filter((s) => s.kind !== 'link' && s.kind !== 'text')
                      .map((s) => (
                        <option key={`note:${s.kind}:${s.id}`} value={s.label}>
                          {s.label}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
            </div>



          </div>
        </section>



        {/* Intake */}
        <section className="rounded-xl border border-bone/10 bg-ink/30 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg">Intake</h2>
            <button
              className={btnGhost}
              onClick={handleFillIntake}
              disabled={busy !== null}
            >
              {busy === 'intake' ? 'Completing…' : 'AI complete intake'}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Audience</label>
              <input
                className={inputClass}
                value={intake.audience}
                onChange={(e) => patchIntake({ audience: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Goal</label>
              <input
                className={inputClass}
                value={intake.goal}
                onChange={(e) => patchIntake({ goal: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Sender name</label>
              <input
                className={inputClass}
                value={intake.senderName}
                onChange={(e) => patchIntake({ senderName: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Offer slug (optional)</label>
              <input
                className={inputClass}
                value={intake.offerSlug}
                onChange={(e) => patchIntake({ offerSlug: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Tone / voice</label>
              <input
                className={inputClass}
                value={intake.tone}
                onChange={(e) => patchIntake({ tone: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Timing style</label>
              <select
                className={inputClass}
                value={intake.timingStyle}
                onChange={(e) =>
                  patchIntake({ timingStyle: e.target.value as EmailKitIntake['timingStyle'] })
                }
              >
                {EMAIL_TIMING_STYLES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Notes</label>
              <textarea
                className={`${inputClass} min-h-[70px]`}
                value={intake.notes}
                onChange={(e) => patchIntake({ notes: e.target.value })}
              />
            </div>
          </div>
        </section>

        {/* Context sources */}
        <section className="rounded-xl border border-bone/10 bg-ink/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg">Attached context</h2>
            <button className={btnGhost} onClick={addRef} disabled={busy !== null}>
              + Add source
            </button>
          </div>
          <p className="text-xs text-bone/40">
            Point the sequence at what it should promote. Sources are resolved to
            live facts at generation time. Suggested for this campaign:{' '}
            {campaign.expectsContext.map((k) => KIND_LABEL[k]).join(', ')}.
          </p>
          {contextRefs.length === 0 && (
            <p className="text-xs text-bone/30">No sources attached.</p>
          )}
          {contextRefs.map((ref, i) => {
            const inline = isInlineContextKind(ref.kind);
            const matches = sources.filter((s) => s.kind === ref.kind);
            return (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select
                  className={`${inputClass} max-w-[180px]`}
                  value={ref.kind}
                  onChange={(e) => {
                    const kind = e.target.value as ContextSourceKind;
                    // Reset the ref payload so a stale id/value can't leak across
                    // kinds when the admin switches the source type.
                    patchRef(i, { kind, id: '', value: '' });
                  }}
                >
                  {CONTEXT_SOURCE_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABEL[k]}
                    </option>
                  ))}
                </select>

                {ref.kind === 'link' ? (
                  <input
                    className={`${inputClass} flex-1 min-w-[200px]`}
                    value={ref.value ?? ''}
                    onChange={(e) => patchRef(i, { value: e.target.value })}
                    placeholder="https://…"
                  />
                ) : ref.kind === 'text' ? (
                  <textarea
                    className={`${inputClass} flex-1 min-w-[200px] min-h-[60px]`}
                    value={ref.value ?? ''}
                    onChange={(e) => patchRef(i, { value: e.target.value })}
                    placeholder="Paste positioning notes, facts, or do/don't guidance…"
                  />
                ) : matches.length > 0 ? (
                  <select
                    className={`${inputClass} flex-1 min-w-[200px]`}
                    value={ref.id}
                    onChange={(e) => {
                      const id = e.target.value;
                      const picked = matches.find((m) => m.id === id);
                      patchRef(i, { id, label: picked?.label ?? ref.label });
                    }}
                  >
                    <option value="">Select {KIND_LABEL[ref.kind]}…</option>
                    {matches.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                        {m.hint ? ` (${m.hint})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={`${inputClass} flex-1 min-w-[200px]`}
                    value={ref.id}
                    onChange={(e) => patchRef(i, { id: e.target.value })}
                    placeholder="slug or id"
                  />
                )}

                {!inline && (
                  <input
                    className={`${inputClass} max-w-[180px]`}
                    value={ref.label ?? ''}
                    onChange={(e) => patchRef(i, { label: e.target.value })}
                    placeholder="label (optional)"
                  />
                )}

                <button
                  className="text-bone/40 hover:text-red-400 text-sm px-2"
                  onClick={() => removeRef(i)}
                  aria-label="Remove source"
                >
                  ✕
                </button>
              </div>
            );
          })}

        </section>

        {/* Available merge tokens */}
        <section className="rounded-xl border border-bone/10 bg-ink/30 p-4 space-y-3">
          <h2 className="font-display text-lg">Available tokens</h2>
          <p className="text-xs text-bone/40">
            Drop these <code className="text-brass/80">{'{{token}}'}</code> markers
            into any subject, preview, or body. They stay intact through export so
            your ESP fills them per-recipient at send time. Click to copy.
          </p>
          <div className="flex flex-wrap gap-2">
            {EMAIL_MERGE_TOKENS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => copyToClipboard(t.token, t.token)}
                title={t.description}
                className="inline-flex items-center gap-1 rounded-full border border-bone/20 bg-ink/40 px-2.5 py-1 text-[11px] text-bone/80 transition hover:border-brass/50 hover:text-bone"
              >
                <code className="text-brass/80">{t.token}</code>
                <span className="text-bone/40">· {t.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Generate actions */}
        <section className="flex flex-wrap items-center gap-2">
          <button className={btnPrimary} onClick={handleGenerate} disabled={busy !== null}>
            {busy === 'generate' ? 'Generating…' : 'Generate full sequence'}
          </button>
          <button className={btnGhost} onClick={handleOutline} disabled={busy !== null}>
            {busy === 'outline' ? 'Outlining…' : 'Outline only'}
          </button>
          <label className="flex items-center gap-2 text-xs text-bone/50">
            <span className="uppercase tracking-wider font-semibold">Body format</span>
            <select
              className={`${inputClass} max-w-[170px] py-1.5`}
              value={bodyFormat}
              onChange={(e) => setBodyFormat(e.target.value as 'text' | 'html')}
              disabled={busy !== null}
              title="How AI writes email bodies. Rich adds bold and bullets; both stay compliant and are flattened wherever they feed a prompt."
            >
              <option value="text">Plain text</option>
              <option value="html">Rich (bold, bullets)</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-bone/50">
            <span className="uppercase tracking-wider font-semibold">Length</span>
            <select
              className={`${inputClass} max-w-[150px] py-1.5`}
              value={bodyLength}
              onChange={(e) =>
                setBodyLength(e.target.value as 'default' | 'short' | 'long')
              }
              disabled={busy !== null}
              title="How long each email body runs. Applies to full generation and to per-email rewrites."
            >
              <option value="default">Default</option>
              <option value="short">Short-form</option>
              <option value="long">Long-form</option>
            </select>
          </label>
          <div className="flex-1" />
          <button
            className={btnGhost}
            onClick={() => setFlowOpen(true)}
            disabled={sequence.emails.length === 0}
            title="Open a read-only map of the sequence trunk and branches."
          >
            View flow
          </button>
          <button
            className={btnGhost}
            onClick={() => setPreviewFor(sequence.emails[0]?.id ?? null)}
            disabled={sequence.emails.length === 0}
            title="Open a rendered inbox preview of the sequence."
          >
            Preview inbox
          </button>
          <button
            className={btnGhost}
            onClick={() => copyToClipboard(plainText, 'Plain text')}
            disabled={sequence.emails.length === 0}
          >
            Copy text
          </button>

          <button
            className={btnGhost}
            onClick={() =>
              copyToClipboard(sequenceToHtml(sequence, tokenValues), 'HTML')
            }
            disabled={sequence.emails.length === 0}
          >
            Copy HTML
          </button>
        </section>

        {/* Sequence */}
        <section className="space-y-4">
          {sequence.emails.length === 0 ? (
            <div className="rounded-xl border border-dashed border-bone/15 p-8 text-center text-bone/40 text-sm">
              No emails yet. Generate a full sequence or an outline to begin.
            </div>
          ) : (
            sequence.emails.map((email, idx) => (
              <article
                key={email.id}
                id={`email-card-${email.id}`}
                className="scroll-mt-24 rounded-xl border border-bone/10 bg-ink/30 p-4 space-y-3 transition"
              >

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-brass/80">
                    Email {idx + 1}
                  </span>
                  <select
                    className={`${inputClass} max-w-[150px]`}
                    value={email.role}
                    onChange={(e) =>
                      patchEmail(email.id, { role: e.target.value as EmailRole })
                    }
                  >
                    {EMAIL_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <select
                    className={`${inputClass} max-w-[170px]`}
                    value={email.framework}
                    onChange={(e) =>
                      patchEmail(email.id, {
                        framework: e.target.value as EmailFramework,
                      })
                    }
                  >
                    {allFrameworks().map((f) => (
                      <option key={f} value={f}>
                        {EMAIL_FRAMEWORK_SPECS[f].label}
                      </option>
                    ))}
                  </select>
                  <input
                    className={`${inputClass} max-w-[90px]`}
                    value={email.sendOffset}
                    onChange={(e) =>
                      patchEmail(email.id, { sendOffset: e.target.value })
                    }
                    placeholder="+1d"
                  />
                  <select
                    className={`${inputClass} max-w-[150px]`}
                    value={email.branch}
                    onChange={(e) =>
                      patchEmail(email.id, {
                        branch: e.target.value as EmailBranchCondition,
                        // Reverting to 'always' returns this email to the linear
                        // trunk, so clear any parent it was branched from.
                        ...(e.target.value === 'always'
                          ? { parentId: null }
                          : {}),
                      })
                    }
                    title="Recipient condition that gates this email (basic branching)."
                  >
                    {EMAIL_BRANCH_CONDITIONS.map((b) => (
                      <option key={b} value={b}>
                        {b === 'always' ? 'always (trunk)' : `if ${b}`}
                      </option>
                    ))}
                  </select>
                  {email.branch !== 'always' && (
                    <select
                      className={`${inputClass} max-w-[160px]`}
                      value={email.parentId ?? ''}
                      onChange={(e) =>
                        patchEmail(email.id, { parentId: e.target.value || null })
                      }
                      title="Which earlier email this condition is evaluated against."
                    >
                      <option value="">vs. previous email</option>
                      {sequence.emails.slice(0, idx).map((p, pIdx) => (
                        <option key={p.id} value={p.id}>
                          vs. Email {pIdx + 1}
                        </option>
                      ))}
                    </select>
                  )}
                  <select
                    className={`${inputClass} max-w-[220px]`}
                    value={email.psFramework}
                    onChange={(e) =>
                      patchEmail(email.id, {
                        psFramework: e.target.value as EmailPsFramework,
                      })
                    }
                    title="Optional soft-sell post-script (P.S.) appended when you (re)write this email's body."
                  >
                    {EMAIL_PS_FRAMEWORKS.map((ps) => (
                      <option key={ps} value={ps}>
                        {EMAIL_PS_FRAMEWORK_LABELS[ps]}
                      </option>
                    ))}
                  </select>
                  <div className="flex-1" />
                  <select
                    className={`${inputClass} max-w-[120px]`}
                    value={emailLength[email.id] ?? bodyLength}

                    onChange={(e) =>
                      setEmailLength((prev) => ({
                        ...prev,
                        [email.id]: e.target.value as
                          | 'default'
                          | 'short'
                          | 'long',
                      }))
                    }
                    disabled={busy !== null}
                    title="Length for this email when you (re)write its body."
                  >
                    <option value="default">Default len</option>
                    <option value="short">Short</option>
                    <option value="long">Long</option>
                  </select>
                </div>

                <input
                  className={inputClass}
                  value={email.subject}
                  onChange={(e) => patchEmail(email.id, { subject: e.target.value })}
                  placeholder="Subject line"
                />
                {email.subjectIdeas.length > 0 && (
                  <p className="text-xs text-bone/40">
                    Alt: {email.subjectIdeas.join('  |  ')}
                  </p>
                )}
                <input
                  className={inputClass}
                  value={email.preview}
                  onChange={(e) => patchEmail(email.id, { preview: e.target.value })}
                  placeholder="Inbox preview text"
                />
                {/* Primary action: write/rewrite the body, clearly separated
                    from the settings selects above. */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    className={btnPrimary}
                    onClick={() => handleExpand(email)}
                    disabled={busy !== null}
                  >
                    {busy === `expand-${email.id}`
                      ? 'Writing…'
                      : email.bodyText.trim()
                        ? '✍ Rewrite body with AI'
                        : '✍ Write body with AI'}
                  </button>
                  <span className="text-[11px] text-bone/40">
                    Uses the settings above and the full sequence context.
                  </span>
                  <div className="flex-1" />
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => setPreviewFor(email.id)}
                    title="Preview this email exactly as it renders in an inbox."
                  >
                    Preview
                  </button>
                </div>
                <KitRichTextField
                  value={email.bodyText}
                  minHeight="180px"
                  disabled={busy !== null}
                  placeholder="Email body"
                  tokens={bodyTokens}
                  onChange={(html) => patchEmail(email.id, { bodyText: html })}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    className={inputClass}
                    value={email.cta.label}
                    onChange={(e) =>
                      patchEmail(email.id, {
                        cta: { ...email.cta, label: e.target.value },
                      })
                    }
                    placeholder="CTA label"
                  />
                  <input
                    className={inputClass}
                    value={email.cta.url}
                    onChange={(e) =>
                      patchEmail(email.id, {
                        cta: { ...email.cta, url: e.target.value },
                      })
                    }
                    placeholder="CTA url"
                  />
                </div>

                {/* A/B split test (optional). Toggling on seeds two variants
                    from the email's current subject; the canvas renders these
                    as a split node. All fields are optional and back-compat. */}
                <div className="rounded-lg border border-bone/10 bg-ink/20 p-3 space-y-2">
                  <label className="flex items-center gap-2 text-xs text-bone/60">
                    <input
                      type="checkbox"
                      checked={!!email.abTest?.enabled}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const seeded: EmailAbTest = email.abTest
                            ? { ...email.abTest, enabled: true }
                            : {
                                enabled: true,
                                metric: 'open',
                                variants: [

                                  {
                                    id: makeAbVariantId(),
                                    label: 'A',
                                    subject: email.subject,
                                    weight: 50,
                                  },
                                  {
                                    id: makeAbVariantId(),
                                    label: 'B',
                                    subject: '',
                                    weight: 50,
                                  },
                                ],
                              };
                          patchEmail(email.id, { abTest: seeded });
                        } else if (email.abTest) {
                          patchEmail(email.id, {
                            abTest: { ...email.abTest, enabled: false },
                          });
                        }
                      }}
                    />
                    <span className="uppercase tracking-wider font-semibold">
                      A/B split test
                    </span>
                  </label>
                  {email.abTest?.enabled && (
                    <div className="space-y-2">
                      {/* Live split bar — visualizes each variant's share of the
                          total weight, with a one-click even balance so weights
                          always read as an intentional split rather than raw
                          numbers. Purely presentational; writes back weights. */}
                      {(() => {
                        const variants = email.abTest!.variants;
                        const total = variants.reduce(
                          (s, x) => s + (x.weight ?? 0),
                          0,
                        );
                        const colors = [
                          'bg-brass',
                          'bg-emerald-500',
                          'bg-sky-500',
                          'bg-fuchsia-500',
                          'bg-amber-500',
                        ];
                        return (
                          <div className="space-y-1">
                            <div className="flex h-2.5 overflow-hidden rounded-full bg-ink/60">
                              {variants.map((x, i) => (
                                <div
                                  key={x.id}
                                  className={colors[i % colors.length]}
                                  style={{
                                    width: `${
                                      total > 0
                                        ? ((x.weight ?? 0) / total) * 100
                                        : 100 / variants.length
                                    }%`,
                                  }}
                                  title={`${x.label || `V${i + 1}`}: ${
                                    x.weight ?? 0
                                  }%`}
                                />
                              ))}
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-bone/40">
                              <span>
                                Total {total}%{' '}
                                {total !== 100 && (
                                  <span className="text-amber-400">
                                    (should be 100%)
                                  </span>
                                )}
                              </span>
                              <button
                                type="button"
                                className="text-brass hover:text-brass/80"
                                onClick={() => {
                                  const n = variants.length;
                                  const base = Math.floor(100 / n);
                                  const balanced = variants.map((x, i) => ({
                                    ...x,
                                    weight:
                                      i === n - 1
                                        ? 100 - base * (n - 1)
                                        : base,
                                  }));
                                  patchEmail(email.id, {
                                    abTest: {
                                      ...email.abTest!,
                                      variants: balanced,
                                    },
                                  });
                                }}
                              >
                                Balance evenly
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                      {email.abTest.variants.map((v, vIdx) => (
                        <div key={v.id} className="flex flex-wrap items-center gap-2">
                          <input
                            className={`${inputClass} max-w-[70px]`}
                            value={v.label}
                            onChange={(e) => {
                              const variants = email.abTest!.variants.map((x) =>
                                x.id === v.id ? { ...x, label: e.target.value } : x,
                              );
                              patchEmail(email.id, {
                                abTest: { ...email.abTest!, variants },
                              });
                            }}
                            placeholder={`V${vIdx + 1}`}
                          />
                          <input
                            className={`${inputClass} flex-1 min-w-[200px]`}
                            value={v.subject}
                            onChange={(e) => {
                              const variants = email.abTest!.variants.map((x) =>
                                x.id === v.id
                                  ? { ...x, subject: e.target.value }
                                  : x,
                              );
                              patchEmail(email.id, {
                                abTest: { ...email.abTest!, variants },
                              });
                            }}
                            placeholder="Variant subject line"
                          />
                          <input
                            type="number"
                            min={0}
                            max={100}
                            className={`${inputClass} max-w-[80px]`}
                            value={v.weight ?? 0}
                            onChange={(e) => {
                              const weight = Math.max(
                                0,
                                Math.min(100, Number(e.target.value) || 0),
                              );
                              const variants = email.abTest!.variants.map((x) =>
                                x.id === v.id ? { ...x, weight } : x,
                              );
                              patchEmail(email.id, {
                                abTest: { ...email.abTest!, variants },
                              });
                            }}
                            title="Split weight (%)."
                          />
                          {email.abTest!.variants.length > 2 && (
                            <button
                              type="button"
                              className="text-bone/40 hover:text-red-400 text-sm px-2"
                              onClick={() => {
                                const variants = email.abTest!.variants.filter(
                                  (x) => x.id !== v.id,
                                );
                                patchEmail(email.id, {
                                  abTest: { ...email.abTest!, variants },
                                });
                              }}
                              aria-label="Remove variant"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        className="text-xs text-brass hover:text-brass/80"
                        onClick={() => {
                          const variants = [
                            ...email.abTest!.variants,
                            {
                              id: makeAbVariantId(),
                              label: String.fromCharCode(
                                65 + email.abTest!.variants.length,
                              ),
                              subject: '',
                              weight: 0,
                            },
                          ];
                          patchEmail(email.id, {
                            abTest: { ...email.abTest!, variants },
                          });
                        }}
                      >
                        + Add variant
                      </button>
                    </div>
                  )}
                </div>

                {/* Image placeholder — opens the per-email Image Studio */}
                <div className="flex items-center gap-3">

                  <button
                    type="button"
                    onClick={() => setImageFor(email.id)}
                    className="group relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-bone/15 bg-ink/40 transition hover:border-brass/50"
                    title={
                      email.images.length
                        ? 'Edit images'
                        : 'Add an image for this email'
                    }
                  >
                    {email.images[0] ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={email.images[0]}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                        {email.images.length > 1 && (
                          <span className="absolute bottom-1 right-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            {email.images.length}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-[11px] text-bone/40 group-hover:text-brass/70">
                        + Image
                      </span>
                    )}
                  </button>
                  <div className="text-xs text-bone/40">
                    {email.images.length
                      ? `${email.images.length} image${
                          email.images.length === 1 ? '' : 's'
                        } attached — first is the hero.`
                      : 'Generate or upload a hero image for this email.'}
                    <button
                      type="button"
                      onClick={() => setImageFor(email.id)}
                      className="ml-2 text-brass hover:text-brass/80"
                    >
                      {email.images.length ? 'Manage images' : 'Open Image Studio'}
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>

        {/* Per-email Image Studio (single instance bound to the active email) */}
        {(() => {
          const active = sequence.emails.find((e) => e.id === imageFor);
          if (!active) return null;
          return (
            <EmailImageStudio
              open={imageFor !== null}
              onClose={() => setImageFor(null)}
              images={active.images}
              onChange={(next) => patchEmail(active.id, { images: next })}
              onInsertToBody={(src) =>
                patchEmail(active.id, {
                  bodyText: appendImageToBody(active.bodyText, src),
                })
              }
              hook={active.subject || active.summary}
              context={{ theme: intake.audience, tone: intake.tone }}
            />
          );
        })()}

        {/* Read-only sequence flow canvas (Phase 1) */}
        <EmailFlowPanel
          open={flowOpen}
          onClose={() => setFlowOpen(false)}
          sequence={sequence}
          onSelectEmail={focusEmailCard}
          onChangeTrigger={(trigger) =>
            setSequence((prev) => ({ ...prev, trigger }))
          }
          onChangeTriggerConfig={patchTriggerConfig}
          offerOptions={sources
            .filter((s) => s.kind === 'offer' || s.kind === 'offer-bonuses')
            .map((s) => ({ id: s.id, label: s.label }))}
          contentOptions={sources
            .filter((s) => s.kind !== 'link' && s.kind !== 'text')
            .map((s) => ({ id: s.id, label: s.label }))}
        />



        {/* Inbox preview modal (Phase 3) — renders through the export pipeline */}
        <EmailPreviewModal
          open={previewFor !== null}
          onClose={() => setPreviewFor(null)}
          sequence={sequence}
          initialEmailId={previewFor}
          tokenValues={tokenValues}
        />



        {/* Extend / add */}
        {sequence.emails.length > 0 && (
          <section className="flex flex-wrap items-center gap-2 rounded-xl border border-bone/10 bg-ink/30 p-4">
            <h2 className="font-display text-lg mr-2">Extend</h2>
            <label className="flex items-center gap-2 text-xs text-bone/50">
              <span className="uppercase tracking-wider font-semibold">Add</span>
              <input
                type="number"
                min={1}
                max={12}
                className={`${inputClass} max-w-[70px] py-1.5`}
                value={extendCount}
                onChange={(e) =>
                  setExtendCount(
                    Math.max(1, Math.min(12, Number(e.target.value) || 1)),
                  )
                }
                disabled={busy !== null}
              />
              <span className="uppercase tracking-wider font-semibold">emails</span>
            </label>
            <select
              className={`${inputClass} max-w-[180px] py-1.5`}
              value={extendMode}
              onChange={(e) =>
                setExtendMode(
                  e.target.value as 'deep-nurture' | 'continue' | 'reengage',
                )
              }
              disabled={busy !== null}
              title="How the appended emails behave relative to the existing sequence."
            >
              <option value="deep-nurture">Deep nurture</option>
              <option value="continue">Continue arc</option>
              <option value="reengage">Re-engage</option>
            </select>
            <button
              className={btnPrimary}
              onClick={handleExtend}
              disabled={busy !== null}
            >
              {busy === 'extend' ? 'Extending…' : 'Extend sequence'}
            </button>
            <div className="flex-1" />
            <button
              className={btnGhost}
              onClick={handleAddEmail}
              disabled={busy !== null}
            >
              + Add one email
            </button>
          </section>
        )}

        {/* Custom merge tokens */}
        <section className="rounded-xl border border-bone/10 bg-ink/30 p-4 space-y-3">
          <div>
            <h2 className="font-display text-lg">Custom tokens</h2>
            <p className="text-xs text-bone/40">
              Reusable {'{{key}}'} markers with a default value. They appear in
              the body editor&apos;s Tokens menu and resolve at export.
            </p>
          </div>
          {customTokens.length > 0 && (
            <ul className="space-y-1.5">
              {customTokens.map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-sm">
                  <code className="rounded bg-bone/10 px-1.5 py-0.5 text-xs text-brass">
                    {`{{${t.key}}}`}
                  </code>
                  <span className="text-bone/70">{t.label}</span>
                  {t.defaultValue && (
                    <span className="text-xs text-bone/40">→ {t.defaultValue}</span>
                  )}
                  <div className="flex-1" />
                  <button
                    type="button"
                    className="text-xs text-red-300 hover:text-red-200 disabled:opacity-40"
                    onClick={() => removeCustomToken(t.id)}
                    disabled={tokenBusy}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input
              className={inputClass}
              value={tokenDraft.key}
              onChange={(e) =>
                setTokenDraft((d) => ({ ...d, key: e.target.value }))
              }
              placeholder="key (e.g. coach_name)"
            />
            <input
              className={inputClass}
              value={tokenDraft.label}
              onChange={(e) =>
                setTokenDraft((d) => ({ ...d, label: e.target.value }))
              }
              placeholder="Label"
            />
            <input
              className={inputClass}
              value={tokenDraft.defaultValue}
              onChange={(e) =>
                setTokenDraft((d) => ({ ...d, defaultValue: e.target.value }))
              }
              placeholder="Default value (optional)"
            />
          </div>
          <button
            type="button"
            className={btnGhost}
            onClick={saveCustomToken}
            disabled={
              tokenBusy || !tokenDraft.key.trim() || !tokenDraft.label.trim()
            }
          >
            {tokenBusy ? 'Saving…' : 'Add token'}
          </button>
        </section>

        {/* Save / delete */}
        <section className="flex flex-wrap gap-2 pt-2 border-t border-bone/10">
          <button className={btnPrimary} onClick={handleSave} disabled={busy !== null}>
            {busy === 'save' ? 'Saving…' : isNew ? 'Save new sequence' : 'Save changes'}
          </button>
          {!isNew && (
            <button
              className={`${btnGhost} text-red-300 border-red-500/30 hover:border-red-500/60`}
              onClick={handleDelete}
              disabled={busy !== null}
            >
              {busy === 'delete' ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </section>
      </main>
    </div>
  );
}

// Keep makeEmailId referenced for future "add email" UX without an import churn.
void makeEmailId;
